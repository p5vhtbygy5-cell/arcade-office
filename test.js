const {io}=require('socket.io-client');const U='http://localhost:3000';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const a=io(U),b=io(U);const got={a:[],b:[]};let ok=true;const chk=(c,m)=>{console.log((c?'PASS':'FAIL')+' '+m);ok=ok&&c;};
for(const [n,s] of [['a',a],['b',b]]){s.onAny((e,d)=>got[n].push([e,d]));}
a.emit('join',{name:'Alicja',color:'#00f0ff',sprite:1});await wait(200);b.emit('join',{name:'Bartek',color:'#39ff14',sprite:2});await wait(300);
chk(got.a.some(([e,d])=>e=='playerJoined'&&d.name=='Bartek'),'A widzi dołączenie B');
const M0=require('./public/map.js');const init=got.a.find(([e])=>e=='init')[1];const bots=Object.values(init.players).filter(p=>p.bot);
chk(bots.length==7&&['CHIEF','SIZE','SCAN','BOOK','RISK','VET','FILLS'].every(n=>bots.some(b=>b.name==n)),'init zawiera 7 botów NPC oznaczonych bot:true');
chk(M0.zoneAt(15*16,6*16)=='board','Strefa Tablica Pozycji (board) w Open Space');{const bl=await fetch(U+'/api/bots').then(r=>r.json());const hz=b=>M0.zoneAt(b.home[0]*16+8,b.home[1]*16+8);chk(bl.length==7&&hz(bl.find(b=>b.name=='CHIEF'))=='chief'&&bl.filter(b=>hz(b)=='open').length==6,'Biurka: CHIEF w gabinecie, 6 botów w Open Space (/api/bots)');}
const M=require('./public/map.js');chk(M.zoneAt(14*16,13*16)=='open'&&M.zoneAt(5*16,25*16)=='chief'&&M.zoneAt(31*16,24*16)=='bathroom'&&M.zoneAt(15*16,23*16)=='social'&&M.ZONES.length==6&&!M.ZONES.some(z=>['trading','meeting','lounge','moon','bots'].includes(z.id)),'Nowe strefy (Open Space, Gabinet CHIEF, Łazienka, Social, Tablica, Top 10) rozpoznawane');
a.emit('move',{x:240,y:216,dir:'right'});await wait(200);
chk(got.b.some(([e,d])=>e=='playerMoved'&&d.id==a.id&&d.x==240),'B dostaje ruch A');
a.emit('move',{x:900,y:300});await wait(200);chk(got.a.some(([e])=>e=='correct'),'Serwer odrzuca teleport');
a.emit('chat',{text:'gm 🚀',scope:'global'});await wait(200);chk(got.b.some(([e,d])=>e=='chat'&&d.text=='gm 🚀'&&d.scope=='global'),'Czat globalny dociera do B');
for(let y=216;y>=104;y-=8){a.emit('move',{x:240,y,dir:'up'});await wait(25);}await wait(100);
a.emit('chat',{text:'tajne',scope:'zone'});await wait(200);
chk(got.a.some(([e,d])=>e=='chat'&&d.text=='tajne'&&d.zone=='board'),'A dostaje własną wiadomość strefową (Tablica Pozycji)');
chk(!got.b.some(([e,d])=>e=='chat'&&d.text=='tajne'),'B (inna strefa) NIE dostaje wiadomości strefowej');
await wait(4300);chk(got.a.some(([e,d])=>e=='bubble'&&String(d.id).startsWith('bot-')&&d.text),'Boty wysyłają dymki statusu');
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
 chk(fev.some(([e,d])=>e=='positionClosed'&&d=='feed-T-1')&&fev.some(([e,d])=>e=='bubble'&&d.id=='bot-RISK'&&/Zamykam TFEED \(PAPIER\)/.test(d.text)),'Zamknięcie ogłoszone (PAPIER)');
 const gf=await fetch(F).then(r=>r.json());chk(gf.lastFeedAt&&gf.activity.length==3&&gf.positions.length==0,'GET /api/feed');
 fc.disconnect();}finally{srv.kill();}
chk(require('./public/map.js').zoneAt(20*16,25.5*16)=='top10','Strefa Top 10 Krypto przy tablicy');
b.disconnect();await wait(200);chk(got.a.some(([e])=>e=='playerLeft'),'A widzi wyjście B');a.disconnect();process.exit(ok?0:1);})();
