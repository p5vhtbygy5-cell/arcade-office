const {io}=require('socket.io-client');const U='http://localhost:3000';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const a=io(U),b=io(U);const got={a:[],b:[]};let ok=true;const chk=(c,m)=>{console.log((c?'PASS':'FAIL')+' '+m);ok=ok&&c;};
const ST=require('./public/v2/sieve-timing.js');
const sumD=a=>a.reduce((x,y)=>x+y,0);
const near=(x,y,e=1e-4)=>Math.abs(x-y)<=e;
{
  const items=[]; for(let i=0;i<179;i++) items.push({handoff:i===10||i===40||i===80||i===120||i===160});
  const p=ST.computeDwells(items,142);
  const budget=0.92*142000;
  chk(p.dwells.length===179&&p.skipped===0&&near(p.handMs,4000)&&near(p.rejMs,(budget-20000)/174)&&sumD(p.dwells)<=budget+1e-4,'dwell: 179 tokenów, 5 handoff, 142s — handoff 4s, reszta dla odrzutów');
  const small=[]; for(let i=0;i<22;i++) small.push({handoff:i<2});
  const q=ST.computeDwells(small,10);
  chk(q.handMs===4000&&q.skipped===17&&q.dwells.filter(d=>d===350).length===3&&sumD(q.dwells)<=q.budget+1e-6,'dwell: podłoga 0.35s, nadmiar odrzutów skip-ahead, suma mieści się w 0.92×interwał');
  const h=ST.computeDwells(Array.from({length:6},()=>({handoff:true})),20);
  chk(h.handMs>=2500&&h.handMs<=6000&&near(h.handMs,0.92*20000/6)&&near(sumD(h.dwells),h.budget),'dwell: handoff schodzi z 4s w zakres 2.5–6s, gdy 4s nie mieści się w budżecie');
  const t=ST.computeDwells(Array.from({length:5},()=>({handoff:true})),10);
  chk(t.handMs<2500&&near(sumD(t.dwells),t.budget),'dwell: handoff poniżej 2.5s tylko gdy inaczej paczka przekroczyłaby budżet');
  chk(ST.isHandoff({handoff:true})&&!ST.isHandoff({handoff:false,stage:'soft_pass'}),'dwell: PASS to handoff=true, samo soft_pass nie');
}
for(const [n,s] of [['a',a],['b',b]]){s.onAny((e,d)=>got[n].push([e,d]));}
a.emit('join',{name:'Alicja',color:'#00f0ff',sprite:1});await wait(200);b.emit('join',{name:'Bartek',color:'#39ff14',sprite:2});await wait(300);
chk(got.a.some(([e,d])=>e=='playerJoined'&&d.name=='Bartek'),'A widzi dołączenie B');
const M0=require('./public/map.js');const init=got.a.find(([e])=>e=='init')[1];const bots=Object.values(init.players).filter(p=>p.bot);
chk(bots.length==7&&['CHIEF','SIZE','SCAN','BOOK','RISK','VET','FILLS'].every(n=>bots.some(b=>b.name==n)),'init zawiera 7 botów NPC oznaczonych bot:true');
chk(M0.zoneAt(18*16,2*16+8)=='board','Strefa Tablica Pozycji (board) w Open Space');{const bl=await fetch(U+'/api/bots').then(r=>r.json());const hz=b=>M0.zoneAt(b.home[0]*16+8,b.home[1]*16+8);chk(bl.length==7&&hz(bl.find(b=>b.name=='CHIEF'))=='chief'&&bl.filter(b=>hz(b)=='open').length==6,'Biurka: CHIEF w gabinecie, 6 botów w Open Space (/api/bots)');}
const M=require('./public/map.js');chk(M.zoneAt(22*16,6*16)=='open'&&M.zoneAt(5*16,14*16)=='chief'&&M.zoneAt(31*16,14*16)=='bathroom'&&M.zoneAt(15*16,14*16)=='social'&&M.ZONES.length==6&&!M.ZONES.some(z=>['trading','meeting','lounge','moon','bots'].includes(z.id)),'Nowe strefy (Open Space, Gabinet CHIEF, Łazienka, Social, Tablica, Top 10) rozpoznawane');
const sx=M.SPAWN.x,sy=M.SPAWN.y;
a.emit('move',{x:sx+4,y:sy,dir:'right'});await wait(200);
chk(got.b.some(([e,d])=>e=='playerMoved'&&d.id==a.id&&d.x==sx+4),'B dostaje ruch A');
a.emit('move',{x:900,y:300});await wait(200);chk(got.a.some(([e])=>e=='correct'),'Serwer odrzuca teleport');
a.emit('chat',{text:'gm 🚀',scope:'global'});await wait(200);chk(got.b.some(([e,d])=>e=='chat'&&d.text=='gm 🚀'&&d.scope=='global'),'Czat globalny dociera do B');
function walkable(x,y){return y>=0&&x>=0&&y<M.H&&x<M.W&&M.solid[y][x]===0&&!M.blocked(x*16+8,y*16+8);}
function pathTo(from,to){const k=(x,y)=>y*M.W+x,prev=new Map([[k(...from),null]]),q=[from];
 while(q.length){const [x,y]=q.shift();if(x==to[0]&&y==to[1])break;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(walkable(nx,ny)&&!prev.has(k(nx,ny))){prev.set(k(nx,ny),[x,y]);q.push([nx,ny]);}}}
 if(!prev.has(k(...to)))return null;const out=[];let c=to;while(c){out.unshift(c);c=prev.get(k(...c));}return out;}
let goal=null;for(let y=0;y<M.H&&!goal;y++)for(let x=0;x<M.W;x++)if(M.zoneAt(x*16+8,y*16+8)=='board'&&walkable(x,y)){goal=[x,y];break;}
const pth=pathTo([Math.floor(sx/16),Math.floor(sy/16)],goal);
let cx=sx+4,cy=sy;
for(const [tx,ty] of pth){const X=tx*16+8,Y=ty*16+8;while(Math.hypot(X-cx,Y-cy)>0.5){const d=Math.hypot(X-cx,Y-cy),step=Math.min(8,d);cx+=(X-cx)/d*step;cy+=(Y-cy)/d*step;a.emit('move',{x:Math.round(cx*10)/10,y:Math.round(cy*10)/10,dir:'up'});await wait(12);}}
await wait(100);
a.emit('chat',{text:'tajne',scope:'zone'});await wait(200);
chk(got.a.some(([e,d])=>e=='chat'&&d.text=='tajne'&&d.zone=='board'),'A dostaje własną wiadomość strefową (Tablica Pozycji)');
chk(!got.b.some(([e,d])=>e=='chat'&&d.text=='tajne'),'B (inna strefa) NIE dostaje wiadomości strefowej');
await wait(13000);chk(got.a.some(([e,d])=>e=='bubble'&&String(d.id).startsWith('bot-')&&d.text),'Boty wysyłają dymki statusu');
// ---- API Tablicy Pozycji ----
const TOK=process.env.BOT_API_TOKEN||require('fs').readFileSync(__dirname+'/.bot-token','utf8').trim();
const api=(m,u,body,tok=TOK)=>fetch(U+u,{method:m,headers:{'content-type':'application/json',...(tok?{authorization:'Bearer '+tok}:{})},body:body?JSON.stringify(body):undefined}).then(async r=>({s:r.status,j:await r.json().catch(()=>null)}));
let r=await api('POST','/api/positions',{bot:'SCAN',symbol:'TESTX',side:'LONG',size:1,entry:100},null);chk(r.s==401,'POST bez tokenu -> 401');
r=await api('POST','/api/positions',{bot:'SCAN',symbol:'TESTX',side:'LONG',size:1,entry:100},'zly');chk(r.s==401,'POST ze złym tokenem -> 401');
r=await api('POST','/api/positions',{bot:'NIKT',symbol:'x',side:'UP',size:-1,entry:'abc'});chk(r.s==400&&r.j.details.length>=4,'Walidacja danych -> 400');
const n0=got.b.length;r=await api('POST','/api/positions',{id:'test-1',bot:'SCAN',symbol:'TESTX',side:'LONG',size:2,entry:100,price:110,note:'test'});
chk(r.s==201&&r.j.id=='test-1'&&r.j.side=='LONG','Otwarcie pozycji -> 201');await wait(200);
chk(got.b.slice(n0).some(([e,d])=>e=='position'&&d.id=='test-1'),'Broadcast otwarcia przez Socket.IO');
chk(got.b.slice(n0).some(([e,d])=>e=='bubble'&&d.id=='bot-SCAN'&&/Otwieram/.test(d.text))&&got.b.slice(n0).some(([e,d])=>e=='chat'&&d.system&&/SCAN/.test(d.text)),'Bot SCAN: dymek + wiadomość systemowa');
r=await api('GET','/api/positions',null,null);chk(r.s==200&&r.j.some(p=>p.id=='test-1'),'GET /api/positions (publiczny)');
r=await api('PATCH','/api/positions/test-1',{price:120});chk(r.s==200&&r.j.price==120,'PATCH aktualizuje cenę');
r=await api('PATCH','/api/positions/test-1',{price:120},null);chk(r.s==401,'PATCH bez tokenu -> 401');
chk(JSON.parse(require('fs').readFileSync(__dirname+'/positions.json','utf8')+'')['test-1']||(await wait(400),JSON.parse(require('fs').readFileSync(__dirname+'/positions.json','utf8'))['test-1']),'Zapis do positions.json');
const n1=got.b.length;r=await api('POST','/api/positions/test-1/close');chk(r.s==200&&r.j.closed&&Math.abs(r.j.pnlPct-20)<1e-9,'Zamknięcie (POST /close), PnL +20%');await wait(200);
chk(got.b.slice(n1).some(([e,d])=>e=='positionClosed'&&d=='test-1'),'Broadcast zamknięcia');
await api('POST','/api/positions',{id:'test-2',bot:'RISK',symbol:'TESTY',side:'SHORT',size:1,entry:50,price:45});r=await api('DELETE','/api/positions/test-2');chk(r.s==200&&Math.abs(r.j.pnlPct-10)<1e-9,'DELETE zamyka SHORT, PnL +10%');
r=await api('DELETE','/api/positions/test-2');chk(r.s==404,'Ponowne zamknięcie -> 404');
// ---- Top 10 (osobny serwer w trybie mock, bez sieci) ----
const {spawn}=require('child_process');const os=require('os');
const srv=spawn(process.execPath,[__dirname+'/server.js'],{env:{...process.env,PORT:'3999',TOP10_MOCK:'1',BOT_FAST:'1',DESK_BOARD_FILE:'/nonexistent/board.json',LIVE_PRICES:'0',BOT_API_TOKEN:'t',POSITIONS_FILE:os.tmpdir()+'/pos-test-'+process.pid+'.json'},stdio:'ignore'});
try{let t10=null;for(let i=0;i<30&&!t10;i++){await wait(150);t10=await fetch('http://localhost:3999/api/top10').then(r=>r.json()).catch(()=>null);}
 chk(t10&&Array.isArray(t10.items)&&t10.items.length==10&&t10.updatedAt&&t10.source=='mock','GET /api/top10: 10 pozycji, updatedAt, source');
 chk(t10&&t10.items.every((c,i)=>c.rank==i+1&&typeof c.symbol=='string'&&typeof c.name=='string'&&c.price>0&&typeof c.change24h=='number'&&c.marketCap>0),'Kształt pozycji Top10 (rank, symbol, name, price, change24h, marketCap)');
 const c=io('http://localhost:3999');const ev=await new Promise(r=>{c.on('top10',r);setTimeout(()=>r(null),2000);});c.disconnect();
 chk(ev&&ev.items.length==10,'Socket.IO wysyła top10 po połączeniu');
 // ---- zachowanie botów (tryb BOT_FAST) ----
 const M2=require('./public/map.js');const bc=io('http://localhost:3999');const mv=[],bub=[];bc.on('playerMoved',d=>{if(String(d.id).startsWith('bot-'))mv.push(d);});bc.on('bubble',d=>bub.push(d));await new Promise(r=>bc.on('connect',r));
 const lst=()=>fetch('http://localhost:3999/api/bots').then(r=>r.json());
 const tok={'content-type':'application/json',authorization:'Bearer t'};
 await fetch('http://localhost:3999/api/positions',{method:'POST',headers:tok,body:JSON.stringify({id:'tb1',bot:'SCAN',symbol:'TESTB',side:'LONG',size:1,entry:10})});
 let scanAtBoard=false,maxAway=0,left=new Set();for(let i=0;i<60;i++){await wait(250);const l=await lst();const aw=l.filter(b=>!b.atDesk);maxAway=Math.max(maxAway,aw.length);aw.forEach(b=>left.add(b.name));if(l.find(b=>b.name=='SCAN').zone=='board')scanAtBoard=true;}
 chk(scanAtBoard,'Zdarzenie API: SCAN idzie do Tablicy Pozycji');
 chk(bub.some(d=>d.id=='bot-RISK'&&/ekspozycj/i.test(d.text)),'RISK reaguje na otwarcie pozycji');
 chk(mv.length>20,'Boty chodzą (zdarzenia ruchu: '+mv.length+')');
 chk(mv.every(d=>M2.solid[Math.floor(d.y/16)][Math.floor(d.x/16)]===0),'Boty poruszają się tylko po wolnych kafelkach');
 const byBot={};let jump=0;for(const d of mv){const pr=byBot[d.id];if(pr&&Math.hypot(d.x-pr.x,d.y-pr.y)>40)jump++;byBot[d.id]=d;}chk(jump==0,'Płynny ruch (brak teleportów)');
 chk(maxAway<=4,'Ograniczona liczba botów poza biurkiem (max '+maxAway+')');
 let allHome=false;for(let i=0;i<120&&!allHome;i++){await wait(250);const l=await lst();allHome=[...left].every(n=>{const b=l.find(x=>x.name==n);return b.atDesk||(b.tile[0]==b.home[0]&&b.tile[1]==b.home[1]);});}
 chk(left.size>0&&allHome,'Boty wracają do biurek ('+[...left].join(',')+')');
 const fin=await lst();chk(fin.length==7&&fin.every(b=>b.status&&M2.solid[b.tile[1]][b.tile[0]]===0),'Nadal 7 botów, każdy ze statusem');
 bc.disconnect();
 // ---- /api/feed ----
 const F='http://localhost:3999/api/feed',fp=(b,h=tok)=>fetch(F,{method:'POST',headers:h,body:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json()}));
 const fc=io('http://localhost:3999');const fev=[];fc.onAny((e,d)=>fev.push([e,d]));await new Promise(r=>fc.on('connect',r));
 const P1={id:'T-1',bot:'RISK',symbol:'TFEED',chain:'solana',side:'LONG',size:200,entry:null,price:0.002,refPrice:0.001,mode:'SHADOW',openedAt:'2026-10-15T16:10:33+02:00',status:'OPEN (shadow)'};
 let fr=await fp({positions:[P1],activity:[]},{'content-type':'application/json'});chk(fr.s==401,'POST /api/feed bez tokenu -> 401');
 fr=await fp({positions:[{id:'x',bot:'NOPE',symbol:''}]});chk(fr.s==400&&fr.j.details.length,'POST /api/feed walidacja -> 400');
 const A=[{ts:'2026-10-15T19:00:00+02:00',bot:'SCAN',text:'Skan: 200 tokenów',kind:'scan.batch'},{ts:'2026-10-15T19:01:00+02:00',bot:'VET',text:'Odrzucam X',kind:'soft.reject'}];
 fr=await fp({updatedAt:'2026-10-15T19:40:00+02:00',positions:[P1],activity:A});chk(fr.s==200&&fr.j.opened.length==1&&fr.j.activity==2,'Feed: otwiera pozycję SHADOW i przyjmuje aktywność');
 let fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());const fpz=fl.find(p=>p.feedId=='T-1');
 chk(fpz&&fpz.mode=='SHADOW'&&fpz.entry===null&&fpz.pnlBase==0.001&&fpz.desk,'Pozycja z feedu: mode SHADOW, entry null, PnL liczony od refPrice');
 fr=await fp({positions:[{...P1,price:0.003}],activity:A});chk(fr.s==200&&fr.j.updated.length==1&&fr.j.opened.length==0&&fr.j.activity==0,'Feed: aktualizacja ceny + deduplikacja aktywności');
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());chk(fl.find(p=>p.feedId=='T-1').price==0.003,'Cena zaktualizowana');
 await wait(5500);chk(fev.some(([e,d])=>e=='chat'&&d.system&&/SCAN: Skan: 200/.test(d.text))&&fev.some(([e,d])=>e=='bubble'&&d.id=='bot-VET'&&d.text=='Odrzucam X'),'Aktywność -> czat + dymki botów');
 fr=await fp({positions:[],activity:[...A,{ts:'2026-10-15T19:05:00+02:00',bot:'BOOK',text:'Wybieram Y',kind:'pick'}]});
 chk(fr.s==200&&fr.j.closed.length==1&&fr.j.activity==1,'Feed: brakująca pozycja zamknięta, nowa aktywność');await wait(300);
 chk(fev.some(([e,d])=>e=='positionClosed'&&d=='feed-T-1')&&fev.some(([e,d])=>e=='bubble'&&d.id=='bot-RISK'&&/Zamykam TFEED/.test(d.text)),'Zamknięcie ogłoszone');
 const gf=await fetch(F).then(r=>r.json());chk(gf.lastFeedAt&&gf.activity.length==3&&gf.positions.length==0,'GET /api/feed');
 fr=await fp({positions:[],activity:[],top10:[{ticker:'AAA',chain:'solana',priceUSD:1,marketCap:10,liquidity:5,change_1h:1.5,stage:'soft_pass',reason:'soft pass'},{ticker:'BBB',chain:'solana',priceUSD:1,marketCap:10,liquidity:5,change_1h:-1,stage:'cheap_reject',reason:'cheap'}],top10_rule:'test',top10_cycle_ts:'2026-10-27T12:00:00Z'});
 const sc=await fetch('http://localhost:3999/api/scan').then(r=>r.json());
 chk(sc.total===1&&sc.tokens&&sc.tokens[0].symbol==='AAA'&&!sc.tokens.some(t=>String(t.symbol).toUpperCase()==='BBB'),'Skan: cheap_reject (CHP-) nie wchodzi na tablicę');
 const sieve={batch_id:'20261109T232157',cycleTs:'2026-11-09T23:21:57+01:00',interval_s:142,gap_s:20,batch_s:121.7,total:3,total_uncapped:3,handoff_n:1,preview:false,cap:200,items:[
   {symbol:'forg',address:'MintForg',chain:'solana',image:'https://img.example/forg.png',mcap_usd:143943,marketCap:143943,stage:'cheap_reject',reason:'holders=45, top_10=1.00',handoff:false},
   {symbol:'MILES',address:'MintMiles',chain:'solana',image:'javascript:alert(1)',stage:'soft_pass',reason:'handoff',handoff:true},
   {symbol:'<>',stage:'nope',reason:'x',handoff:false},
   {symbol:'SKIPSTAGE',stage:'handoff',reason:'stage handoff',handoff:false}
 ]};
 const nScan=fev.length;
 fr=await fp({positions:[],activity:[],scan_sieve:sieve});
 chk(fr.s===200,'Feed ze scan_sieve -> 200');
 await wait(400);
 let sc2=await fetch('http://localhost:3999/api/scan').then(r=>r.json());
 const sv=sc2.scan_sieve;
 chk(!!sv&&sv.batch_id==='20261109T232157'&&sv.interval_s===142&&sv.cap===200&&sv.handoff_n===1&&sv.items.length===3,'GET /api/scan niesie scan_sieve (cap, interval, batch)');
 chk(sv&&sv.items[0].symbol==='forg'&&sv.items[0].stage==='cheap_reject'&&sv.items[0].handoff===false&&sv.items[0].image==='https://img.example/forg.png','Sito trzyma cheap_reject i obraz https');
 chk(sv&&sv.items[1].symbol==='MILES'&&sv.items[1].handoff===true&&sv.items[1].image==null,'handoff=true zostaje, obraz nie-http odpada');
 chk(sv&&sv.items[2].symbol==='SKIPSTAGE'&&sv.items[2].handoff===true,'stage handoff liczy się jako przekazanie; pusty symbol odpada');
 chk(sc2.total===1&&sc2.tokens[0].symbol==='AAA'&&!sc2.tokens.some(t=>t.symbol==='forg'),'Ranking top-12 bez zmian, gdy sito jest obok');
 chk(fev.slice(nScan).some(([e,d])=>e==='scan'&&d.scan_sieve&&d.scan_sieve.batch_id==='20261109T232157'),'Socket scan niesie scan_sieve');
 fr=await fp({positions:[],activity:[]});
 sc2=await fetch('http://localhost:3999/api/scan').then(r=>r.json());
 chk(sc2.scan_sieve&&sc2.scan_sieve.batch_id==='20261109T232157','Feed bez pola scan_sieve zostawia poprzednie sito');
 fr=await fp({positions:[],activity:[],scan_sieve:null});
 sc2=await fetch('http://localhost:3999/api/scan').then(r=>r.json());
 chk(sc2.scan_sieve==null&&sc2.total===1,'scan_sieve:null czyści sito, top-12 zostaje');
 // Playback: sieve arrives batch_s after cycleTs, zoneless stamp is Europe/Warsaw.
 {
  const puppeteer=require('puppeteer-core');
  const br=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  try{
   const pg=await br.newPage();
   pg.on('pageerror',e=>console.log('sieve page',e.message));
   await pg.setViewport({width:1920,height:1080,deviceScaleFactor:1});
   await pg.goto('http://127.0.0.1:3999/v2',{waitUntil:'domcontentloaded',timeout:30000});
   await pg.waitForFunction(()=>window.AO2&&typeof window.AO2.sieveOriginMs==='function',{timeout:10000});
   await pg.waitForFunction(()=>{const el=document.getElementById('feedAge'); return !!(el&&el.textContent&&!/—/.test(el.textContent));},{timeout:10000});
   const origins=await pg.evaluate(()=>({
    winter:window.AO2.sieveOriginMs({cycleTs:'2026-11-10T08:50:47',batch_s:118}),
    summer:window.AO2.sieveOriginMs({cycleTs:'2026-07-10T08:50:47',batch_s:10}),
    zoned:window.AO2.sieveOriginMs({cycleTs:'2026-11-09T23:21:57+01:00',batch_s:121.7}),
    zulu:window.AO2.sieveOriginMs({cycleTs:'2026-11-10T07:50:47Z',batch_s:118})
   }));
   const winter=Date.parse('2026-11-10T08:50:47+01:00')+118000;
   chk(origins.winter===winter,'sieveOrigin: cycleTs bez strefy (listopad) to Europe/Warsaw +01:00 + batch_s');
   chk(origins.summer===Date.parse('2026-07-10T08:50:47+02:00')+10000,'sieveOrigin: cycleTs bez strefy (lipiec, CEST) to +02:00 + batch_s');
   chk(origins.zoned===Date.parse('2026-11-09T23:21:57+01:00')+121.7*1000,'sieveOrigin: cycleTs ze strefą zostaje, batch_s jest dodany');
   chk(origins.zulu===winter,'sieveOrigin: znacznik Z nie jest przesuwany na Warszawę');
   const wall=ms=>{
    const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const g={}; for(const p of fmt.formatToParts(new Date(ms))) if(p.type!=='literal') g[p.type]=p.value;
    const hh=String((+g.hour)%24).padStart(2,'0');
    return g.year+'-'+g.month+'-'+g.day+'T'+hh+':'+g.minute+':'+g.second;
   };
   const readScan=()=>pg.evaluate(()=>{
    const el=document.querySelector('[data-seat="SCAN"]');
    if(!el) return {token:'',pass:false,tag:''};
    const name=el.querySelector('.tname'), tag=el.querySelector('.tag .txt');
    return {token:name?name.textContent:'', pass:el.classList.contains('pass')&&!!el.querySelector('.stamp .lab'), tag:tag?tag.textContent:''};
   });
   const untilScan=(pred,ms)=>new Promise(async r=>{
    const end=Date.now()+ms; let v=await readScan();
    while(!pred(v)&&Date.now()<end){ await wait(40); v=await readScan(); }
    r(v);
   });
   const batch_s=118, interval_s=24;
   const items=[
    {symbol:'A0',stage:'cheap_reject',reason:'cheap',handoff:false},
    {symbol:'A1',stage:'cheap_reject',reason:'holders',handoff:false},
    {symbol:'MILES',stage:'soft_pass',reason:'handoff',handoff:true},
    {symbol:'SOL',stage:'cheap_reject',reason:'cheap',handoff:false}
   ];
   const t0=Date.now();
   let posted=await fp({positions:[],activity:[],scan_sieve:{batch_id:'play-'+t0,cycleTs:wall(t0-batch_s*1000),interval_s,batch_s,total:4,handoff_n:1,items}});
   chk(posted.s===200,'playback: feed ze sitem opublikowanym przy cycleTs+batch_s');
   const first=await untilScan(v=>v.token==='A0'||v.token==='SOL'||v.token==='MILES',4000);
   chk(first.token==='A0'&&!first.pass,'batch odebrany przy cycleTs+batch_s startuje od A0, nie od SOL (jest '+(first.token||'—')+')');
   const passed=await untilScan(v=>v.pass&&v.token==='MILES',16000);
   chk(passed.pass&&passed.token==='MILES','batch dochodzi do pieczątki PASS na MILES (jest '+(passed.token||'—')+(passed.pass?' PASS':'')+')');
   const lateIv=20;
   const now2=Date.now();
   const lateTs=new Date(now2-(lateIv+30+batch_s)*1000).toISOString();
   posted=await fp({positions:[],activity:[],scan_sieve:{batch_id:'late-'+now2,cycleTs:lateTs,interval_s:lateIv,batch_s,total:4,handoff_n:1,items:[
    {symbol:'B0',stage:'cheap_reject',reason:'cheap',handoff:false},
    {symbol:'B1',stage:'cheap_reject',reason:'cheap',handoff:false},
    {symbol:'B2',stage:'soft_pass',reason:'handoff',handoff:true},
    {symbol:'SOL',stage:'cheap_reject',reason:'cheap',handoff:false}
   ]}});
   chk(posted.s===200,'playback: nowy batch_id zastępuje trwające sito');
   const restarted=await untilScan(v=>v.token==='B0'||v.token==='SOL',3000);
   chk(restarted.token==='B0'&&!restarted.pass,'po oknie nowy batch wraca na B0 zamiast zamarzać na SOL (jest '+(restarted.token||'—')+')');
   const moved=await untilScan(v=>v.pass&&v.token==='B2',8000);
   chk(moved.pass&&moved.token==='B2','po restarcie sito leci do PASS, nie stoi na pierwszej klatce (jest '+(moved.token||'—')+(moved.pass?' PASS':'')+')');
  }finally{ await br.close(); }
 }
 fr=await fp({positions:[{id:'U-1',bot:'RISK',symbol:'Łódź',chain:'solana',side:'LONG',size:10,entry:1,price:1.1,mode:'SHADOW'}],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 chk(fl.some(p=>p.symbol==='Łódź'),'Symbol z polskimi znakami zostaje na tablicy');
 const row=(id,extra)=>({bot:'RISK',side:'LONG',mode:'SHADOW',size:10,entry:1,price:1,...extra,id});
 const sample={positions:[
   row('inu-1',{symbol:'INUWEEN',displaySymbol:'Inuween',address:'MintInu+xx/yy',peakPct:-4.5,price:0.9,chain:'solana'}),
   row('wif-1',{symbol:'WIF',displaySymbol:'███WIF',address:'AbC123!!!',peakPct:12,price:1.1,chain:'solana'}),
   row('emo-1',{symbol:'MOON',displaySymbol:'🚀MOON',bot:'FILLS',price:2,entry:2,size:5}),
   row('drop-1',{symbol:'<>\u0000\u202e',displaySymbol:''}),
   row('fix-1',{symbol:'',displaySymbol:'Żółć',bot:'VET',size:3}),
   row('old-1',{symbol:'OLDFEED',bot:'BOOK',price:1.2,size:4}),
   row('mem-1',{symbol:'MEM',displaySymbol:'Pamięć',peakPct:120,price:1,size:8})
 ],activity:[{ts:'2026-10-27T18:44:00+02:00',bot:'VET',text:'Widzę Inuween oraz ███WIF \u0001🚀 żółć \u202e',kind:'note'}],
  botEvents:{RISK:[{ts:'2026-10-27T18:44:00+02:00',text:'Pilnuje ███WIF i Inuween 🚀'}]}};
 fr=await fp(sample);chk(fr.s==200&&fr.j.opened.length>=6,'Feed z nowymi polami (unicode, ujemny szczyt) przechodzi');
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const by=id=>fl.find(p=>p.feedId===id);
 const inu=by('inu-1'),wif=by('wif-1'),emo=by('emo-1'),fix=by('fix-1'),old=by('old-1'),mem=by('mem-1');
 chk(inu&&inu.symbol==='INUWEEN'&&inu.displaySymbol==='Inuween'&&inu.address==='MintInuxxyy'&&inu.peak===-4.5,'Inuween: displaySymbol, oczyszczony mint, ujemny peakPct nie jest zerem');
 chk(wif&&wif.displaySymbol==='███WIF'&&wif.symbol==='WIF'&&wif.address==='AbC123'&&wif.peak===12,'███WIF: nazwa Unicode i adres bez znaków spoza alfabetu');
 chk(emo&&emo.displaySymbol==='🚀MOON'&&emo.address==null,'Nazwa z emoji zostaje, brak adresu zostaje null');
 chk(!by('drop-1'),'Pusty symbol po filtrze pomija wiersz i nie odrzuca feedu');
 chk(fix&&fix.symbol==='Żółć'&&fix.displaySymbol==='Żółć','Pusty symbol jest naprawiany z displaySymbol');
 chk(old&&old.displaySymbol==null&&old.address==null&&old.peakPct==null&&old.symbol==='OLDFEED','Stary wiersz bez nowych pól dalej działa');
 chk(mem&&mem.peak===120,'Szczyt 120 z feedu siedzi w pamięci');
 fr=await fp({positions:[row('bad',{bot:'NOPE',symbol:''}),row('keep',{symbol:'KEEP'})]});
 chk(fr.s==400&&!((await fetch('http://localhost:3999/api/positions').then(r=>r.json())).some(p=>p.feedId==='keep')),'Pusty symbol i zły bot nadal dają 400, stan się nie zmienia');
 const nFx=fev.length;
 fr=await fp({positions:[row('inu-1',{symbol:'INUWEEN',displaySymbol:'Inuween',address:'MintInu+xx/yy',peakPct:-4.5,price:0.9}),row('wif-1',{symbol:'WIF',displaySymbol:'███WIF',address:'AbC123',peakPct:10,price:1.1}),row('emo-1',{symbol:'MOON',displaySymbol:'🚀MOON',bot:'FILLS',entry:2,price:2,size:5}),row('fix-1',{symbol:'',displaySymbol:'Żółć',bot:'VET',size:3}),row('old-1',{symbol:'OLDFEED',bot:'BOOK',price:1.2,size:4})],
  closeReasons:{'mem-1':{address:null,peak:69.38,pct:15,net:3,reason:'trail'}},
  posEvents:[
   {ts:'2026-10-27T18:50:00Z',action:'CLOSE',token:'PEAKY',displaySymbol:'Szczyt',address:'Mint+Peak/99',peak:69.38,pct:40,net:12.5,usd:100,price:1.4,chain:'solana',reason:'risk'},
   {ts:'2026-10-27T18:50:01Z',action:'SELL',token:'WIF',displaySymbol:'███WIF',address:'AbC123!!!',peak:12,pct:4,net:1,frac:'1/4',usd:50,price:1.1,chain:'solana'},
   {ts:'2026-10-27T18:50:02Z',action:'CLOSE',token:'LOSSY',displaySymbol:'Strata',peak:69.38,pct:-8,net:-2,usd:40,price:0.9,chain:'solana'}
  ]});
 chk(fr.s==200&&fr.j.closed.includes('feed-mem-1'),'Zamknięcie MEM z closeReasons.peak');
 await wait(400);
 const fx=fev.slice(nFx).filter(([e])=>e==='deskFx').map(([,d])=>d);
 const closeOf=t=>fx.find(e=>e.kind==='close'&&e.token===t);
 chk(closeOf('Szczyt')&&closeOf('Szczyt').stage===3&&closeOf('Szczyt').peak===69.38,'CLOSE posEvent peak 69.38 to etap III');
 chk(closeOf('Strata')&&closeOf('Strata').stage===-1&&closeOf('Strata').peak===69.38,'Strata (pct<0) zostaje dźwiękiem straty, szczyt 69.38 zostaje');
 chk(closeOf('Pamięć')&&closeOf('Pamięć').stage===4&&closeOf('Pamięć').peak===120,'Wyższy szczyt z pamięci wygrywa z peak 69.38 z closeReasons');
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 chk(fl.find(p=>p.feedId==='wif-1').peak===12,'Niższy kolejny peakPct nie ścina zapamiętanego szczytu');
 const gf2=await fetch(F).then(r=>r.json());
 const evC=gf2.posEvents.find(e=>e.action==='CLOSE'&&e.token==='PEAKY');
 const evS=gf2.posEvents.find(e=>e.action==='SELL'&&e.displaySymbol==='███WIF');
 chk(evC&&evC.peak===69.38&&evC.address==='MintPeak99'&&evC.displaySymbol==='Szczyt','posEvents CLOSE niesie address i peak');
 chk(evS&&evS.peak===12&&evS.address==='AbC123','posEvents SELL niesie address i peak');
 chk(gf2.activity.some(a=>a.text.includes('Inuween')&&a.text.includes('███WIF')&&a.text.includes('🚀')&&a.text.includes('żółć')&&!a.text.includes('\u0001')&&!a.text.includes('\u202e')),'Aktywność trzyma Unicode, bez sterujących i bidi');
 const bev=await fetch('http://localhost:3999/api/bot-events').then(r=>r.json());
 chk(bev.RISK&&bev.RISK.some(x=>x.text.includes('███WIF')&&x.text.includes('🚀')&&x.text.includes('Inuween')),'botEvents trzymają Unicode');
 const live={positions:[
   {id:'2026-10-27T0101230100',bot:'RISK',symbol:'PRESIDENT',displaySymbol:'PRESIDENT',address:'MintPres+1',peakPct:1.2,side:'LONG',mode:'SHADOW',size:40,entry:0.00024,price:0.00015,chain:'solana',openedAt:'2026-10-27T01:01:23+01:00'},
   {id:'2026-10-27T1147570100',bot:'RISK',symbol:'INUWEEN',displaySymbol:'Inuween',address:'MintInu/2',peakPct:-3.5,side:'LONG',mode:'SHADOW',size:40,entry:0.006,price:0.0045,chain:'solana'},
   {id:'2026-10-27T1329020100',bot:'RISK',symbol:'NOTHING',displaySymbol:'Nothing',side:'LONG',mode:'SHADOW',size:40,entry:0.0014,price:0.0009,chain:'solana'}
 ],activity:[],portfolio:{start:500,bank:459.17,realizedPnl:-40.83,roiPct:-8.17,trades:20,wins:15,losses:5,open_full:5,open_tiers:[0,0,0,0],tiers:[0,0,0],partial:1,closes:19,mode:'SHADOW',best:{token:'███',displaySymbol:'███WIF',net:16.61,pct:41.52},worst:{token:'ELON2028',net:-34.66,pct:-86.66},series:[{ts:'2026-10-26T12:00:00Z',bank:500},{ts:'2026-10-27T12:00:00Z',bank:459.17}]},
  posEvents:[{ts:'2026-10-27T12:00:00Z',action:'CLOSE',token:'███',displaySymbol:'███WIF',peak:41.52,pct:41.52,net:16.61,chain:'solana'}]};
 fr=await fp(live);chk(fr.s===200,'Payload jak z desku (PRESIDENT, Inuween, Nothing) -> 200');
 const api=await fetch(F).then(r=>r.json());
 const names=api.positions.map(p=>p.displaySymbol||p.symbol);
 chk(api.positions.length===3&&names.includes('Inuween')&&names.includes('PRESIDENT')&&names.includes('Nothing'),'GET /api/feed trzyma otwarte pozycje desku');
 let pf=await fetch('http://localhost:3999/api/portfolio').then(r=>r.json());
 chk(pf.trades===20&&pf.openFull===5&&pf.best&&pf.best.displaySymbol==='███WIF'&&pf.best.token==='███'&&pf.closeStages==null,'TRADES zostaje 20, a nie openFull 5; NAJL ma ███WIF; puste etapy nie wchodzą');
 fr=await fp({positions:live.positions,activity:[],portfolio:Object.assign({},live.portfolio,{wins:1,trades:1,losses:0}),posEvents:live.posEvents});
 pf=await fetch('http://localhost:3999/api/portfolio').then(r=>r.json());
 chk(fr.s===200&&pf.closeStages&&pf.closeStages[2]===1&&pf.closeStages.reduce((a,b)=>a+b,0)===pf.wins,'Peak 41.52 liczy się jako etap II, suma = wins');
 fr=await fp({positions:[row('s1',{symbol:'STEPY',steps:{done:3,total:6,last:100,next:150,runner:false,peak:101.2,extra:'drop'}})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const s1=fl.find(p=>p.feedId==='s1');
 chk(fr.s===200&&s1&&s1.steps&&s1.steps.done===3&&s1.steps.total===6&&s1.steps.last===100&&s1.steps.next===150&&s1.steps.runner===false&&s1.steps.peak===101.2&&s1.steps.extra===undefined,'steps: poprawny obiekt przechodzi, extra znika');
 fr=await fp({positions:[row('s2',{symbol:'TRAILT',steps:{done:6,total:6,last:300,next:null,runner:true,peak:310}})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const s2=fl.find(p=>p.feedId==='s2');
 chk(fr.s===200&&s2&&s2.steps&&s2.steps.runner===true&&s2.steps.done===6&&s2.steps.next===null,'steps.runner true (faza trail)');
 fr=await fp({positions:[row('s3',{symbol:'OLDST'})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const s3=fl.find(p=>p.feedId==='s3');
 chk(fr.s===200&&s3&&s3.steps==null,'stary feed bez steps: pole puste, fallback na szczyt');
 fr=await fp({positions:[row('s4',{symbol:'BADST',steps:'nope'})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const s4=fl.find(p=>p.feedId==='s4');
 chk(fr.s===200&&s4&&s4.steps==null,'steps jako string jest odrzucany, feed 200');
 fr=await fp({positions:[row('s5',{symbol:'CLAMP',steps:{done:-2,total:99,runner:'yes',last:'50',peak:NaN}})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const s5=fl.find(p=>p.feedId==='s5');
 chk(fr.s===200&&s5&&s5.steps&&s5.steps.done===0&&s5.steps.total===6&&s5.steps.runner===false&&s5.steps.last===null&&s5.steps.peak==null,'steps: typy i zakresy sanitizowane');
 fr=await fp({positions:[row('s6',{symbol:'ARR',steps:[]})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const s6=fl.find(p=>p.feedId==='s6');
 chk(fr.s===200&&s6&&s6.steps==null,'steps jako tablica jest odrzucany');
 const gf3=await fetch(F).then(r=>r.json());
 chk(gf3.positions.some(p=>p.feedId==='s6'&&p.steps==null),'GET /api/feed nie zgłasza fałszywego steps');
 fr=await fp({positions:[row('h24',{symbol:'DAY24',h24:12.5,change24h:null,h1:1,h6:2})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const d24=fl.find(p=>p.feedId==='h24');
 chk(fr.s===200&&d24&&d24.h24===12.5&&d24.change24h===12.5,'h24 z feedu jest opcjonalne i kopiuje się na change24h');
 fr=await fp({positions:[row('img1',{symbol:'PIC',image:'https://img.example/a.png'})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const img1=fl.find(p=>p.feedId==='img1');
 chk(fr.s===200&&img1&&img1.image==='https://img.example/a.png','positions[].image https przechodzi');
 fr=await fp({positions:[row('img2',{symbol:'BADIMG',image:'javascript:alert(1)'})],activity:[]});
 fl=await fetch('http://localhost:3999/api/positions').then(r=>r.json());
 const img2=fl.find(p=>p.feedId==='img2');
 chk(fr.s===200&&img2&&img2.image==null,'image nie-http jest odrzucany');
 fr=await fp({positions:[row('fee1',{symbol:'FEEY'})],activity:[],portfolio:{start:1000,bank:1100,trades:2,wins:2,losses:0,fees:12.5}});
 pf=await fetch('http://localhost:3999/api/portfolio').then(r=>r.json());
 chk(fr.s===200&&pf.fees===12.5,'portfolio.fees opcjonalne przechodzi');
 const v2=await fetch('http://localhost:3999/v2').then(async r=>({s:r.status,t:await r.text()}));
 chk(v2.s===200&&/ARCADE OFFICE/.test(v2.t)&&/v2\.js\?v=12/.test(v2.t)&&/sieve-timing\.js\?v=12/.test(v2.t)&&/v2\.css\?v=12/.test(v2.t),'GET /v2 serwuje nową tablicę (cache v=12)');
 const home=await fetch('http://localhost:3999/').then(async r=>({s:r.status,t:await r.text()}));
 chk(home.s===200&&/game\.js/.test(home.t)&&!/v2\.js/.test(home.t),'GET / nadal serwuje starą tablicę');
 fc.disconnect();
 const createScan=require('./scan.js');
 const origFetch=global.fetch; let calls=[];
 global.fetch=async url=>{calls.push(String(url)); const u=String(url);
  const json=async()=>u.includes('dexscreener')?[{baseToken:{address:'MintLook123',name:'Look'},priceUsd:'1.25',priceChange:{m5:1.5,h1:2,h6:3,h24:4},volume:{h1:900},fdv:1000,marketCap:800,liquidity:{usd:50},txns:{h1:{buys:7,sells:2}},pairCreatedAt:1700000000000,pairAddress:'PAIRLOOK',info:{imageUrl:'https://img.example/a.png'}}]
   :u.includes('ohlcv')?{data:{attributes:{ohlcv_list:[[1700000000,1,1,1,1.2,3]]}}}:{data:{attributes:{holders:{count:42,distribution_percentage:{top_10:'11'}}}}};
  return {ok:true,status:200,json};};
 try{const scn=createScan({io:{emit(){}},extra:()=>({}),onEnrich(){}});
  scn.watch([{address:'MintLook123',symbol:'LOOK',displaySymbol:'Look★',chain:'solana'}]);
  chk(scn.snapshot().total===0,'Adres pozycji nie wchodzi do rotacji skanu');
  await scn.tick(); await scn.tick(); await scn.tick();
  const v=scn.lookup('MintLook123');
  chk(!!(v&&v.change5m===1.5&&v.change6h===3&&v.change24h===4&&v.volume1h===900&&v.fdv===1000&&v.buys1h===7&&v.sells1h===2&&v.pairCreatedAt===1700000000000&&v.holders===42&&v.chart&&v.chart.length===1),'DexScreener i GeckoTerminal biorą mint pozycji');
  chk(calls.some(u=>u.includes('dexscreener.com')&&u.includes('MintLook123'))&&calls.some(u=>u.includes('geckoterminal.com')&&u.includes('MintLook123')),'Zapytania idą na adres z watch()');
 }catch(e){chk(false,'Lookup mintu: '+e.message);}finally{global.fetch=origFetch;}
}finally{srv.kill();}
chk(require('./public/map.js').zoneAt(4*16,2*16+8)=='top10','Strefa Top 10 Krypto przy tablicy');
b.disconnect();await wait(200);chk(got.a.some(([e])=>e=='playerLeft'),'A widzi wyjście B');a.disconnect();process.exit(ok?0:1);})();
