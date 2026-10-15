#!/usr/bin/env node
// Pushes the desk state to the office every 60 s. Contract: /workspace/desk/OFFICE_FEED.md
// Source: /workspace/desk/office-feed.json if present (written by CHIEF), otherwise derived from board.json + logs/*.log.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const DESK=process.env.DESK_DIR||'/workspace/desk',LOG=path.join(__dirname,'sync.log');
const TARGETS=[{name:'render',url:process.env.FEED_URL||'https://arcade-office.onrender.com/api/feed',tokenFile:'/home/box/.arcade-bot-token',timeout:90000},
 {name:'local',url:'http://localhost:3000/api/feed',tokenFile:path.join(__dirname,'.bot-token'),timeout:10000}];
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
function build(){const f=path.join(DESK,'office-feed.json');const own=readJSON(f);
 if(own&&Array.isArray(own.positions)){return {...own,source:'office-feed.json'};}
 const b=readJSON(path.join(DESK,'board.json'));if(!b)return null;const positions=[];const p=b.position;
 if(p&&p.token){const hb=p.latest_heartbeat||{};positions.push({id:p.board_id||p.order_id,bot:'RISK',symbol:p.token,chain:p.chain,side:'LONG',size:p.ticket_usd??null,
   entry:p.entry_priceUSD??null,price:hb.priceUSD??null,refPrice:p.reference_priceUSD??null,mode:(b.shadow||p.virtual)?'SHADOW':'REAL',openedAt:p.ts,status:p.risk_status||''});}
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
 const hash=crypto.createHash('sha1').update(JSON.stringify({...payload,updatedAt:0})).digest('hex');if(DRY){console.log(JSON.stringify(payload,null,1).slice(0,3000));return;}
 await Promise.all(TARGETS.map(t=>push(t,body,hash)));}
(async()=>{log(`start (źródło: ${fs.existsSync(path.join(DESK,'office-feed.json'))?'office-feed.json':'board.json+logs'}), pid ${process.pid}`);
 if(ONCE||DRY){await cycle();return;}for(;;){try{await cycle();}catch(e){log('cycle error '+e.message);}await new Promise(r=>setTimeout(r,EVERY));}})();
