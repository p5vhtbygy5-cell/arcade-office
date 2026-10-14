const {io}=require('socket.io-client');const U='http://localhost:3000';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const a=io(U),b=io(U);const got={a:[],b:[]};let ok=true;const chk=(c,m)=>{console.log((c?'PASS':'FAIL')+' '+m);ok=ok&&c;};
for(const [n,s] of [['a',a],['b',b]]){s.onAny((e,d)=>got[n].push([e,d]));}
a.emit('join',{name:'Alicja',color:'#00f0ff',sprite:1});await wait(200);b.emit('join',{name:'Bartek',color:'#39ff14',sprite:2});await wait(300);
chk(got.a.some(([e,d])=>e=='playerJoined'&&d.name=='Bartek'),'A widzi dołączenie B');
a.emit('move',{x:250,y:300,dir:'right'});await wait(200);
chk(got.b.some(([e,d])=>e=='playerMoved'&&d.id==a.id&&d.x==250),'B dostaje ruch A');
a.emit('move',{x:900,y:300});await wait(200);chk(got.a.some(([e])=>e=='correct'),'Serwer odrzuca teleport');
a.emit('chat',{text:'gm 🚀',scope:'global'});await wait(200);chk(got.b.some(([e,d])=>e=='chat'&&d.text=='gm 🚀'&&d.scope=='global'),'Czat globalny dociera do B');
for(let y=300;y>=250;y-=10){a.emit('move',{x:240,y,dir:'up'});await wait(30);}await wait(100);
a.emit('chat',{text:'tajne',scope:'zone'});await wait(200);
chk(got.a.some(([e,d])=>e=='chat'&&d.text=='tajne'&&d.zone=='trading'),'A dostaje własną wiadomość strefową (trading)');
chk(!got.b.some(([e,d])=>e=='chat'&&d.text=='tajne'),'B (inna strefa) NIE dostaje wiadomości strefowej');
b.disconnect();await wait(200);chk(got.a.some(([e])=>e=='playerLeft'),'A widzi wyjście B');a.disconnect();process.exit(ok?0:1);})();
