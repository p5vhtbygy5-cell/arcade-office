#!/usr/bin/env node
// Pushes the desk state to the office every 60 s. Contract: /workspace/desk/OFFICE_FEED.md
// Source: /workspace/desk/office-feed.json if present (written by CHIEF), otherwise derived from board.json + logs/*.log.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const DESK=process.env.DESK_DIR||'/workspace/desk',LOG=path.join(__dirname,'sync.log');
const TARGETS=[{name:'render',url:process.env.FEED_URL||'https://arcade-office.onrender.com/api/feed',tokenFile:'/home/box/.arcade-bot-token',timeout:90000},
 {name:'local',url:process.env.LOCAL_FEED_URL||'http://localhost:3000/api/feed',tokenFile:process.env.LOCAL_TOKEN_FILE||path.join(__dirname,'.bot-token'),timeout:10000}]
 .filter(t=>!process.env.FEED_ONLY||process.env.FEED_ONLY.split(',').includes(t.name)); // FEED_ONLY=local -> push only to the local target
const EVERY=60000,HEARTBEAT=5*60000,ONCE=process.argv.includes('--once'),DRY=process.argv.includes('--dry');
const log=m=>{const l=new Date().toISOString().replace('T',' ').slice(0,19)+'Z '+m;fs.appendFileSync(LOG,l+'\n');if(ONCE||DRY)console.log(l);};
const readJSON=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}};
const ROLE_FILES=['scan','vet','book','size','fills','risk','chief'];
const SKIP=new Set(['board.patched','position.open','heartbeat']);
function text(e){const p=e.payload||{},t=e.type;switch(t){
 case 'scan.batch':return `Skan: ${p.universe??'?'} tokenów${p.cheap_pass!=null?`, ${p.cheap_pass} przeszło sito`:''}`;
 case 'handoff':return `Przekazuję ${p.n??'?'} do ${String(p.to||'?').toUpperCase()}`;
 case 'soft.reject':case 'hard.reject':return `Odrzucam ${p.ticker||'?'}`;
 case 'soft.pass':case 'hard.pass':return `Przepuszczam ${p.ticker||'?'}`;
 case 'vet.summary':return `Weryfikacja: ${p.hard_pass??'?'}/${p.in??'?'} przeszło`;
 case 'order.blocked':return `Zlecenie ${p.ticker||'?'} zablokowane: ${String(p.reason||'').slice(0,60)}`;
 case 'order.placed':case 'order.filled':return `Zlecenie ${p.ticker||p.token||'?'} ${t=='order.filled'?'wypełnione':'złożone'}`;
 case 'pick.skipped':return `Pomijam wybór (${String(p.reason||'').slice(0,50)})`;
 case 'pick':case 'pick.made':return `Wybieram ${p.ticker||'?'}`;
 case 'position.close':case 'position.closed':return `Zamykam ${p.token||p.ticker||'?'}`;
 case 'seat.restarted':return `Restart stanowiska ${String(p.seat||'?').toUpperCase()}`;
 case 'supervisor.start':return 'Nadzór biura uruchomiony';
 default:return t.replace(/[._]/g,' ');}}
// ---- portfolio history (read-only): trades.jsonl + state.json. Real data only; empty arrays/nulls when there is no history ----
const START_BANK=+process.env.START_BANK||1000;
const num=v=>typeof v=='number'&&isFinite(v)?v:null;
function portfolio(positions){const st=readJSON(path.join(DESK,'state.json'))||{};let trades=[];
 try{trades=fs.readFileSync(path.join(DESK,'trades.jsonl'),'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(t=>t&&num(t.net)!=null);}catch{}
 trades.sort((a,b)=>Date.parse(a.closed)-Date.parse(b.closed));
 const series=[];if(trades.length){series.push({ts:trades[0].opened||trades[0].closed,bank:num(trades[0].bank_before)??START_BANK});for(const t of trades)series.push({ts:t.closed,bank:num(t.bank_after)});}
 let peak=-Infinity,ddPct=0,ddUsd=0;for(const p of series){if(p.bank==null)continue;peak=Math.max(peak,p.bank);ddUsd=Math.max(ddUsd,peak-p.bank);ddPct=Math.max(ddPct,(peak-p.bank)/peak*100);}
 const bank=num(st.bank)??(series.length?series[series.length-1].bank:null),realized=trades.reduce((a,t)=>a+t.net,0),wins=trades.filter(t=>t.net>0).length;
 const pick=t=>t?{token:String(t.token),net:t.net,pct:num(t.net_pct),closed:t.closed,partial:!!t.partial}:null;
 const by=[...trades].sort((a,b)=>b.net-a.net);
 const recent=trades.map(t=>({ts:t.closed,kind:'close',token:String(t.token),net:t.net,pct:num(t.net_pct),partial:!!t.partial,mode:t.shadow?'SHADOW':'REAL'}))
  .concat((positions||[]).filter(p=>p.openedAt).map(p=>({ts:p.openedAt,kind:'open',token:String(p.symbol),size:p.size??null,mode:p.mode,runner:String(p.id).startsWith('runner-')})))
  .sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts)).slice(0,8);
 return {start:START_BANK,bank,realizedPnl:trades.length?realized:0,roiPct:bank!=null?(bank-START_BANK)/START_BANK*100:null,trades:trades.length,partial:trades.filter(t=>t.partial).length,
  wins,winRate:trades.length?wins/trades.length*100:null,maxDrawdownPct:trades.length?ddPct:null,maxDrawdownUsd:trades.length?ddUsd:null,best:pick(by[0]),worst:pick(by[by.length-1]),series,recent,
  mode:trades.length&&trades.every(t=>t.shadow)?'SHADOW':trades.some(t=>!t.shadow)?'REAL':null,updatedAt:new Date().toISOString()};}
// ---- world news from the LOCAL WorldMonitor (never api.worldmonitor.app), cached 5 min -> optional 'news' field for prod ----
const WM_URL=(process.env.WM_URL||'http://[::1]:3004').replace(/\/$/,'');const NEWS_MS=5*60000,NEWS_CATS=['politics','us','europe','middleeast','asia','intel','finance','energy','africa','latam','ai','tech'];
let newsCache=null,newsAt=0;
async function refreshNews(){if(/worldmonitor\.app/i.test(WM_URL))return null;if(Date.now()-newsAt<NEWS_MS)return newsCache;newsAt=Date.now();
 try{const r=await fetch(WM_URL+'/api/news/v1/list-feed-digest?variant=full&lang=en',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();const seen=new Set(),all=[];
  for(const c of NEWS_CATS)for(const it of ((j.categories||{})[c]||{}).items||[]){const title=String(it.title||'').replace(/\s+/g,' ').trim();const k=title.toLowerCase().slice(0,60);if(!title||seen.has(k))continue;seen.add(k);
   all.push({title:title.slice(0,140),source:String(it.source||'').slice(0,40),category:c,publishedAt:+it.publishedAt||null,score:+it.importanceScore||0});}
  all.sort((a,b)=>b.score-a.score||(b.publishedAt||0)-(a.publishedAt||0));const items=all.slice(0,15).map(({score,...x})=>x);if(!items.length)throw new Error('pusta lista');
  newsCache={items,updatedAt:new Date().toISOString(),source:'worldmonitor-local'};}
 catch(e){log('news: '+e.message+' (zostawiam poprzednie)');}return newsCache;}
// ---- botEvents: each bot's last 10 REAL events (ledger + logs + trades.jsonl) as short Polish ASCII lines. Only whitelisted fields; no addresses/keys ----
const ASC=x=>String(x??'').replace(/ł/g,'l').replace(/Ł/g,'L').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,'').replace(/\s+/g,' ').trim();
const TK=x=>ASC(x).split(' ')[0].slice(0,14);
const SYM=(tok,chain,addr)=>{let s=String(tok||'').toUpperCase().replace(/[^A-Z0-9_.-]/g,'').slice(0,20);if(s)return s;const a=String(addr||'').replace(/[^A-Za-z0-9]/g,'');const c=String(chain||'TOK').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3)||'TOK';return (c+(a.slice(-6)||'X')).slice(0,20);};
const REASON=r=>{r=ASC(r);if(/momentum_already_spent/.test(r))return 'juz wycenione';if(/shape crowd/.test(r))return 'slaby tlum';if(/position already open/.test(r))return 'pozycja juz otwarta';if(/single survivor/.test(r))return 'tylko jeden kandydat';
 if(/0 survivors/.test(r))return '0 kandydatow po VET';return r.replace(/0x[0-9a-fA-F]{6,}|[1-9A-HJ-NP-Za-km-z]{30,}/g,'').slice(0,28);};
const BOTS7=['SCAN','VET','BOOK','SIZE','FILLS','RISK','CHIEF'];
function evLine(e){const p=e.payload||{},t=e.type;const pct=v=>(v>=0?'+':'')+(+v).toFixed(1)+'%';switch(t){
 case 'scan.batch':return p.universe!=null?`Przeskanowalem ${p.universe} tokenow${p.cheap_pass!=null?`, ${p.cheap_pass} przez sito`:''}`:null;
 case 'handoff':return `Przekazalem ${p.n!=null?p.n+' ':''}do ${ASC(p.to).toUpperCase()}`;
 case 'soft.reject':case 'hard.reject':case 'vet.reject':return p.ticker?`Odrzucilem ${TK(p.ticker)}${(p.reasons||[]).length?' - '+REASON(p.reasons[0]):p.reason?' - '+REASON(p.reason):''}`:null;
 case 'soft.pass':case 'hard.pass':return p.ticker?`Przepuszczam ${TK(p.ticker)}`:null;
 case 'vet.summary':return p.in!=null?`Weryfikacja: ${p.hard_pass??'?'}/${p.in} przeszlo`:null;
 case 'vet.recheck':return p.ticker?`Ponownie sprawdzilem ${TK(p.ticker)}: ${p.passed?'OK':'odrzucony'}`:null;
 case 'order.blocked':return p.ticker?`Zlecenie ${TK(p.ticker)} zablokowane - ${REASON(p.reason)}`:null;
 case 'no_order':return `Brak zlecenia - ${REASON(p.reason)}`;
 case 'pick.skipped':return `Pomijam ${p.ticker?TK(p.ticker)+' ':''}- ${REASON(p.reason)}`;
 case 'ticket':return p.ticket_usd!=null?`Bilet $${(+p.ticket_usd).toFixed(2)}${p.stake_pct!=null?` (${(p.stake_pct*100).toFixed(0)}% banku)`:''}`:null;
 case 'board.posted':return p.symbol?`Wystawilem ${TK(p.symbol)} na tablice`:null;
 case 'fill':case 'order.shadow':return (p.token||p.ticker)?`Wypelnione: ${TK(p.token||p.ticker)}`:null;
 case 'position.open':return p.token&&p.unrealised_pct!=null?`Pilnuje ${TK(p.token)}: ${pct(p.unrealised_pct)}`:null;
 case 'runner.open':return p.token&&p.unrealised_pct!=null?`Runner ${TK(p.token)}: ${pct(p.unrealised_pct)}`:null;
 case 'seat.restarted':return p.seat?`Restart stanowiska ${ASC(p.seat).toUpperCase()}`:null;
 case 'supervisor.start':return 'Nadzor biura uruchomiony';
 default:return null;}}
function botEvents(){const evs=[];const day=d=>new Date(d).toLocaleDateString('sv-SE',{timeZone:'Europe/Warsaw'});
 const files=[...new Set([day(Date.now()),day(Date.now()-864e5)])].map(d=>path.join(DESK,'ledger',d+'.jsonl')).concat(ROLE_FILES.map(r=>path.join(DESK,'logs',r+'.log')));
 for(const f of files){let lines=[];try{lines=fs.readFileSync(f,'utf8').trim().split('\n').slice(-600);}catch{continue;}
  for(const l of lines){let e;try{e=JSON.parse(l);}catch{continue;}const bot=String(e&&e.role||'').toUpperCase();if(!BOTS7.includes(bot))continue;const text=evLine(e);if(!text)continue;
   const p=e.payload||{};evs.push({bot,ts:e.ts,text:ASC(text).slice(0,60),key:bot+'|'+e.type+'|'+ASC(p.ticker||p.token||p.symbol||p.seat||'')});}}
 try{for(const l of fs.readFileSync(path.join(DESK,'trades.jsonl'),'utf8').split('\n').filter(Boolean)){const t=JSON.parse(l);if(typeof t.net!='number')continue;
  evs.push({bot:'RISK',ts:t.closed,text:ASC(`${t.partial?'Polowa ':'Zamknalem '}${TK(t.token)}${t.partial?' zamknieta':''} ${t.net>=0?'+':'-'}$${Math.abs(t.net).toFixed(2)}`),key:'RISK|close|'+t.order_id});}}catch{}
 evs.sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts));const out={};
 for(const b of BOTS7){const seen=new Set(),list=[];for(const e of evs){if(e.bot!==b||seen.has(e.key))continue;seen.add(e.key);list.push({ts:e.ts,text:e.text});if(list.length>=10)break;}out[b]=list;}return out;}
function build(){const b0=build0();if(b0&&!b0.botEvents)b0.botEvents=botEvents();if(b0&&!b0.portfolio)b0.portfolio=portfolio(b0.positions);if(b0&&newsCache&&!b0.news)b0.news=newsCache;return b0;}
function build0(){const f=path.join(DESK,'office-feed.json');const own=readJSON(f);
 if(own&&Array.isArray(own.positions)){return {...own,source:'office-feed.json'};}
 const b=readJSON(path.join(DESK,'board.json'));if(!b)return null;const positions=[];
 const plist=Array.isArray(b.positions)?b.positions:(b.position?[b.position]:[]); // up to 3 positions (Złotr 23:20)
 for(const p of plist){if(!p||!p.token)continue;const hb=p.latest_heartbeat||{};positions.push({id:p.board_id||p.order_id,bot:'RISK',symbol:SYM(p.token,p.chain,p.address),chain:p.chain,side:'LONG',size:p.ticket_usd??null,
   entry:p.entry_priceUSD??null,price:hb.priceUSD??null,refPrice:p.reference_priceUSD??null,mode:(b.shadow||p.virtual)?'SHADOW':'REAL',openedAt:p.ts,status:p.risk_status||''});}
 for(const r of (b.runners||[])){const hb=r.latest_heartbeat||{};positions.push({id:'runner-'+String(r.order_id).replace(/[^A-Za-z0-9_-]/g,''),bot:'RISK',symbol:SYM(r.token,r.chain,r.address),chain:r.chain,side:'LONG',
   size:r.ticket_usd??null,entry:r.entry_priceUSD??null,price:hb.priceUSD??r.half_close_price??null,mode:(b.shadow||r.virtual)?'SHADOW':'REAL',openedAt:r.runner_since||r.ts,
   status:'RUNNER ½ (połowa zamknięta '+(r.half_close_price??'')+'), '+(r.risk_status||'')});}
 const since=Date.now()-3*3600e3,acts=[];
 for(const r of ROLE_FILES){let lines=[];try{lines=fs.readFileSync(path.join(DESK,'logs',r+'.log'),'utf8').trim().split('\n').slice(-60);}catch{}
  for(const l of lines){let e;try{e=JSON.parse(l);}catch{continue;}if(!e||SKIP.has(e.type)||Date.parse(e.ts)<since)continue;acts.push({ts:e.ts,bot:String(e.role||r).toUpperCase(),text:text(e),kind:e.type});}}
 acts.sort((a,c)=>Date.parse(a.ts)-Date.parse(c.ts));
 return {updatedAt:b.updatedAt||new Date().toISOString(),positions,activity:acts.slice(-25),top10:b.top10,top10_cycle_ts:b.top10_cycle_ts,top10_rule:b.top10_rule,source:'board.json+logs'};}
const state={};
async function push(t,body,hash){const s=state[t.name]||(state[t.name]={hash:null,at:0});
 if(s.hash===hash&&Date.now()-s.at<HEARTBEAT)return;let tok;try{tok=fs.readFileSync(t.tokenFile,'utf8').trim();}catch{return log(`${t.name}: brak pliku tokenu`);}
 try{const r=await fetch(t.url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tok},body,signal:AbortSignal.timeout(t.timeout)});
  const txt=(await r.text()).slice(0,200).replace(tok,'***');
  if(r.ok){s.hash=hash;s.at=Date.now();log(`${t.name}: OK ${r.status} ${txt}`);}else log(`${t.name}: HTTP ${r.status} ${txt.replace(/\s+/g,' ')}`);}
 catch(e){log(`${t.name}: błąd ${e.name=='TimeoutError'?'timeout (cold start?)':e.message}`);}}
async function cycle(){await refreshNews();const f=build();if(!f)return log('brak danych (board.json / office-feed.json)');const {source,...payload}=f;const body=JSON.stringify(payload);
 const hash=crypto.createHash('sha1').update(JSON.stringify({...payload,updatedAt:0,portfolio:payload.portfolio&&{...payload.portfolio,updatedAt:0}})).digest('hex');if(DRY){console.log(process.argv.includes("--portfolio")?JSON.stringify(payload.portfolio,null,1):process.argv.includes("--news")?JSON.stringify(payload.news,null,1):process.argv.includes("--events")?JSON.stringify(payload.botEvents,null,1):JSON.stringify(payload,null,1).slice(0,3000));return;}
 await Promise.all(TARGETS.map(t=>push(t,body,hash)));}
(async()=>{log(`start (źródło: ${fs.existsSync(path.join(DESK,'office-feed.json'))?'office-feed.json':'board.json+logs'}), pid ${process.pid}`);
 if(ONCE||DRY){await cycle();return;}for(;;){try{await cycle();}catch(e){log('cycle error '+e.message);}await new Promise(r=>setTimeout(r,EVERY));}})();
