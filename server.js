const express=require('express'),http=require('http'),{Server}=require('socket.io'),path=require('path');
const MAP=require('./public/map.js');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(q,r)=>r.json({ok:true,players:Object.keys(players).length}));
const players={};const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b'];
const clean=(s,n)=>String(s||'').replace(/[<>]/g,'').trim().slice(0,n);
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
