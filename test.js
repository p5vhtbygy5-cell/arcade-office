const {io}=require('socket.io-client');const U='http://localhost:3000';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const a=io(U),b=io(U);const got={a:[],b:[]};let ok=true;const chk=(c,m)=>{console.log((c?'PASS':'FAIL')+' '+m);ok=ok&&c;};
for(const [n,s] of [['a',a],['b',b]]){s.onAny((e,d)=>got[n].push([e,d]));}
a.emit('join',{name:'Alicja',color:'#00f0ff',sprite:1});await wait(200);b.emit('join',{name:'Bartek',color:'#39ff14',sprite:2});await wait(300);
chk(got.a.some(([e,d])=>e=='playerJoined'&&d.name=='Bartek'),'A widzi dołączenie B');
const M0=require('./public/map.js');const init=got.a.find(([e])=>e=='init')[1];const bots=Object.values(init.players).filter(p=>p.bot);
chk(bots.length==7&&['CHIEF','SIZE','SCAN','BOOK','RISK','VET','FILLS'].every(n=>bots.some(b=>b.name==n)),'init zawiera 7 botów NPC oznaczonych bot:true');
chk(M0.zoneAt(15*16,6*16)=='board','Strefa Tablica Pozycji (board) w Open Space');chk(bots.find(b=>b.name=='CHIEF').zone=='chief'&&bots.filter(b=>b.zone=='open').length==6,'CHIEF w gabinecie, 6 botów w Open Space');
const M=require('./public/map.js');chk(M.zoneAt(14*16,13*16)=='open'&&M.zoneAt(33*16,5*16)=='chief'&&M.zoneAt(31*16,17*16)=='bathroom'&&M.zoneAt(15*16,23*16)=='social'&&M.ZONES.length==6&&!M.ZONES.some(z=>['trading','meeting','lounge','moon','bots'].includes(z.id)),'Nowe strefy (Open Space, Gabinet CHIEF, Łazienka, Social, Tablica, Top 10) rozpoznawane');
a.emit('move',{x:240,y:216,dir:'right'});await wait(200);
chk(got.b.some(([e,d])=>e=='playerMoved'&&d.id==a.id&&d.x==240),'B dostaje ruch A');
a.emit('move',{x:900,y:300});await wait(200);chk(got.a.some(([e])=>e=='correct'),'Serwer odrzuca teleport');
a.emit('chat',{text:'gm 🚀',scope:'global'});await wait(200);chk(got.b.some(([e,d])=>e=='chat'&&d.text=='gm 🚀'&&d.scope=='global'),'Czat globalny dociera do B');
for(let y=216;y>=104;y-=8){a.emit('move',{x:240,y,dir:'up'});await wait(25);}await wait(100);
a.emit('chat',{text:'tajne',scope:'zone'});await wait(200);
chk(got.a.some(([e,d])=>e=='chat'&&d.text=='tajne'&&d.zone=='board'),'A dostaje własną wiadomość strefową (Tablica Pozycji)');
chk(!got.b.some(([e,d])=>e=='chat'&&d.text=='tajne'),'B (inna strefa) NIE dostaje wiadomości strefowej');
await wait(4300);chk(got.a.some(([e,d])=>e=='bubble'&&String(d.id).startsWith('bot-')&&d.text),'Boty wysyłają dymki statusu');
chk(!got.a.some(([e,d])=>e=='playerMoved'&&String(d.id).startsWith('bot-')),'Boty nie generują zdarzeń ruchu');
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
const srv=spawn(process.execPath,[__dirname+'/server.js'],{env:{...process.env,PORT:'3999',TOP10_MOCK:'1',LIVE_PRICES:'0',BOT_API_TOKEN:'t',POSITIONS_FILE:os.tmpdir()+'/pos-test-'+process.pid+'.json'},stdio:'ignore'});
try{let t10=null;for(let i=0;i<30&&!t10;i++){await wait(150);t10=await fetch('http://localhost:3999/api/top10').then(r=>r.json()).catch(()=>null);}
 chk(t10&&Array.isArray(t10.items)&&t10.items.length==10&&t10.updatedAt&&t10.source=='mock','GET /api/top10: 10 pozycji, updatedAt, source');
 chk(t10&&t10.items.every((c,i)=>c.rank==i+1&&typeof c.symbol=='string'&&typeof c.name=='string'&&c.price>0&&typeof c.change24h=='number'&&c.marketCap>0),'Kształt pozycji Top10 (rank, symbol, name, price, change24h, marketCap)');
 const c=io('http://localhost:3999');const ev=await new Promise(r=>{c.on('top10',r);setTimeout(()=>r(null),2000);});c.disconnect();
 chk(ev&&ev.items.length==10,'Socket.IO wysyła top10 po połączeniu');}finally{srv.kill();}
chk(require('./public/map.js').zoneAt(28*16,25.5*16)=='top10','Strefa Top 10 Krypto przy tablicy');
b.disconnect();await wait(200);chk(got.a.some(([e])=>e=='playerLeft'),'A widzi wyjście B');a.disconnect();process.exit(ok?0:1);})();
