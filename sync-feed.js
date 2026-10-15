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
function build(){const b0=build0();if(b0&&!b0.portfolio)b0.portfolio=portfolio(b0.positions);return b0;}
function build0(){const f=path.join(DESK,'office-feed.json');const own=readJSON(f);
 if(own&&Array.isArray(own.positions)){return {...own,source:'office-feed.json'};}
 const b=readJSON(path.join(DESK,'board.json'));if(!b)return null;const positions=[];const p=b.position;
 if(p&&p.token){const hb=p.latest_heartbeat||{};positions.push({id:p.board_id||p.order_id,bot:'RISK',symbol:p.token,chain:p.chain,side:'LONG',size:p.ticket_usd??null,
   entry:p.entry_priceUSD??null,price:hb.priceUSD??null,refPrice:p.reference_priceUSD??null,mode:(b.shadow||p.virtual)?'SHADOW':'REAL',openedAt:p.ts,status:p.risk_status||''});}
 for(const r of (b.runners||[])){const hb=r.latest_heartbeat||{};positions.push({id:'runner-'+String(r.order_id).replace(/[^A-Za-z0-9_-]/g,''),bot:'RISK',symbol:r.token,chain:r.chain,side:'LONG',
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
async function cycle(){const f=build();if(!f)return log('brak danych (board.json / office-feed.json)');const {source,...payload}=f;const body=JSON.stringify(payload);
 const hash=crypto.createHash('sha1').update(JSON.stringify({...payload,updatedAt:0,portfolio:payload.portfolio&&{...payload.portfolio,updatedAt:0}})).digest('hex');if(DRY){console.log(process.argv.includes("--portfolio")?JSON.stringify(payload.portfolio,null,1):JSON.stringify(payload,null,1).slice(0,3000));return;}
 await Promise.all(TARGETS.map(t=>push(t,body,hash)));}
(async()=>{log(`start (źródło: ${fs.existsSync(path.join(DESK,'office-feed.json'))?'office-feed.json':'board.json+logs'}), pid ${process.pid}`);
 if(ONCE||DRY){await cycle();return;}for(;;){try{await cycle();}catch(e){log('cycle error '+e.message);}await new Promise(r=>setTimeout(r,EVERY));}})();
