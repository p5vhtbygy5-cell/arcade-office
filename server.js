const express=require('express'),http=require('http'),{Server}=require('socket.io'),path=require('path');
const MAP=require('./public/map.js');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(q,r)=>r.json({ok:true,players:Object.values(players).filter(p=>!p.bot).length,bots:Object.values(players).filter(p=>p.bot).length}));
const players={};const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b'];
const clean=(s,n)=>String(s||'').replace(/[<>]/g,'').trim().slice(0,n);
// ---- NPC bots (server-side, static at desks) ----
const BOT_CFG={CHIEF:{color:'#ff3b3b',lines:['Koordynuję zespół...','Odprawa o 9:00!','Kto ma update?','Decyzja zapadła.','Trzymamy plan.']},
 SIZE:{color:'#ffe600',lines:['Liczę wielkość pozycji...','Max 2% kapitału!','Kelly mówi: mniej.','Skaluję wejście...']},
 SCAN:{color:'#00f0ff',lines:['Skanuję rynek...','Nowy sygnał na SOL!','Wolumen rośnie 📈','Szukam setupów...']},
 BOOK:{color:'#39ff14',lines:['Księguję transakcje...','Saldo się zgadza.','Aktualizuję dziennik.','PnL zapisany ✔']},
 RISK:{color:'#ff6b00',lines:['Sprawdzam ryzyko...','Stop-loss ustawiony.','Ekspozycja OK.','Uwaga na dźwignię!']},
 VET:{color:'#b026ff',lines:['Weryfikuję projekt...','Audyt kontraktu...','To wygląda na scam 🚩','Zespół zweryfikowany.']},
 FILLS:{color:'#ff2bd6',lines:['Realizuję zlecenia...','Fill po 68 012 $','Slippage minimalny.','Zlecenie wypełnione ✔']}};
for(const b of MAP.BOT_DESKS){const c=BOT_CFG[b.name];players['bot-'+b.name]={id:'bot-'+b.name,name:b.name,color:c.color,sprite:0,bot:true,x:b.x,y:b.y,dir:'down',zone:MAP.zoneAt(b.x,b.y)};}
setInterval(()=>{const ids=Object.keys(BOT_CFG);const n=ids[Math.random()*ids.length|0];const l=BOT_CFG[n].lines;io.emit('bubble',{id:'bot-'+n,text:l[Math.random()*l.length|0]});},4000);
io.on('connection',s=>{
  s.on('join',d=>{
    const p={id:s.id,name:clean(d&&d.name,16)||'Anon',color:COLORS.includes(d&&d.color)?d.color:COLORS[0],sprite:Math.max(0,Math.min(3,(d&&d.sprite)|0)),x:MAP.SPAWN.x,y:MAP.SPAWN.y,dir:'down'};
    p.zone=MAP.zoneAt(p.x,p.y);players[s.id]=p;
    s.emit('init',{you:s.id,players});s.broadcast.emit('playerJoined',p);
    io.emit('chat',{system:true,text:`${p.name} wchodzi do biura`,scope:'global',ts:Date.now()});
  });
  s.on('move',d=>{const p=players[s.id];if(!p||!d)return;const x=+d.x,y=+d.y;if(!isFinite(x)||!isFinite(y))return;
    if(Math.hypot(x-p.x,y-p.y)>64||MAP.blocked(x,y))return s.emit('correct',{x:p.x,y:p.y});
    p.x=x;p.y=y;p.dir=['up','down','left','right'].includes(d.dir)?d.dir:p.dir;p.zone=MAP.zoneAt(x,y);
    s.broadcast.emit('playerMoved',{id:p.id,x,y,dir:p.dir,zone:p.zone});});
  s.on('chat',d=>{const p=players[s.id];if(!p)return;const text=clean(d&&d.text,200);if(!text)return;
    const scope=d.scope==='zone'?'zone':'global';const m={id:p.id,name:p.name,color:p.color,text,scope,zone:p.zone,ts:Date.now()};
    if(scope==='global')io.emit('chat',m);else for(const q of Object.values(players))if(q.zone===p.zone)io.to(q.id).emit('chat',m);});
  s.on('disconnect',()=>{const p=players[s.id];if(!p)return;delete players[s.id];io.emit('playerLeft',s.id);
    io.emit('chat',{system:true,text:`${p.name} wychodzi`,scope:'global',ts:Date.now()});});
});
const PORT=process.env.PORT||3000;srv.listen(PORT,()=>console.log('Arcade Office na porcie '+PORT));
