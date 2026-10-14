const {T,W,H,ZONES,furniture,zoneAt,blocked}=MAP;
const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b'];
const ZN=Object.fromEntries(ZONES.map(z=>[z.id,z.name]));ZN.korytarz='Korytarz';
let color=COLORS[0],sprite=0,scope='global',me=null,players={},bubbles={};
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
// ---- procedural pixel sprites (8x10 grids) ----
const SPR=[ // . empty, H hair/hat, S skin, B body(color), D dark, E eye
 ['..HHHH..','.HHHHHH.','.SSSSSS.','.SESSES.','.SSSSSS.','..BBBB..','.BBBBBB.','S.BBBB.S','..D..D..','..D..D..'],
 ['...HH...','..HHHH..','.HHHHHH.','.SESSES.','.SSSSSS.','.BBBBBB.','BBBBBBBB','S.BBBB.S','..DD.DD.','..D...D.'],
 ['.DDDDDD.','.DBBBBD.','.DDDDDD.','.DEDDED.','.DDDDDD.','..BBBB..','.BBDDBB.','D.BBBB.D','..D..D..','..D..D..'], // robot
 ['H......H','HH.HH.HH','.SSSSSS.','.SESSES.','.SSSSSS.','..BBBB..','.BBBBBB.','S.BBBB.S','..D..D..','.DD..DD.'], // cat-ish
];
function drawSprite(g,x,y,sp,col,s=3,frame=0){const m=SPR[sp];const pal={H:'#3a1f0f',S:'#ffcc99',B:col,D:'#222',E:'#000'};if(sp==2)pal.D='#8899aa';if(sp==3)pal.H=col;
 for(let j=0;j<m.length;j++)for(let i=0;i<8;i++){let c=m[j][i];if(c=='.')continue;if(frame&&j>=8)c=m[j][(i+(j==8?1:-1)+8)%8]||'.';if(c=='.')continue;g.fillStyle=pal[c];g.fillRect(x+i*s,y+j*s,s,s);}}
// ---- login UI ----
const cd=document.getElementById('colors');COLORS.forEach((c,i)=>{const d=document.createElement('div');d.className='sw'+(i?'':' on');d.style.background=c;d.onclick=()=>{color=c;[...cd.children].forEach(e=>e.classList.remove('on'));d.classList.add('on');renderPicks();};cd.appendChild(d);});
const sd=document.getElementById('sprites');
function renderPicks(){sd.innerHTML='';SPR.forEach((_,i)=>{const c=document.createElement('canvas');c.width=40;c.height=46;c.className=i==sprite?'on':'';const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,40,46);drawSprite(g,8,8,i,color,3);c.onclick=()=>{sprite=i;renderPicks();};sd.appendChild(c);});}
renderPicks();
const nick=document.getElementById('nick');nick.value=localStorage.nick||'';
document.getElementById('go').onclick=join;nick.onkeydown=e=>{if(e.key=='Enter')join();};
const socket=io({autoConnect:false});
function join(){const n=nick.value.trim();if(!n){nick.focus();return;}localStorage.nick=n;document.getElementById('login').remove();socket.connect();socket.emit('join',{name:n,color,sprite});}
socket.on('init',d=>{me=d.you;players=d.players;for(const p of Object.values(players)){p.rx=p.x;p.ry=p.y;}updOnline();});
socket.on('playerJoined',p=>{p.rx=p.x;p.ry=p.y;players[p.id]=p;updOnline();});
socket.on('playerMoved',d=>{const p=players[d.id];if(p)Object.assign(p,d);});
socket.on('playerLeft',id=>{delete players[id];updOnline();});
socket.on('correct',d=>{const p=players[me];if(p){p.x=p.rx=d.x;p.y=p.ry=d.y;}});
socket.on('chat',m=>{const log=document.getElementById('log');const el=document.createElement('div');
 if(m.system){el.className='sys';el.textContent='» '+m.text;}else{const t=document.createElement('span');t.className='tag';t.textContent=m.scope=='zone'?'['+ZN[m.zone]+'] ':'[GLOBAL] ';
  const n=document.createElement('span');n.style.color=m.color;n.textContent=m.name+': ';el.append(t,n,document.createTextNode(m.text));bubbles[m.id]={text:m.text,until:Date.now()+5000};}
 log.appendChild(el);log.scrollTop=1e9;});
function updOnline(){document.getElementById('online').textContent='Online: '+Object.keys(players).length;}
const tg=document.getElementById('tg'),tz=document.getElementById('tz');
tg.onclick=()=>{scope='global';tg.className='on';tz.className='';};tz.onclick=()=>{scope='zone';tz.className='on';tg.className='';};
const msg=document.getElementById('msg');
document.getElementById('form').onsubmit=e=>{e.preventDefault();if(msg.value.trim())socket.emit('chat',{text:msg.value,scope});msg.value='';msg.blur();};
// ---- input ----
const keys={};addEventListener('keydown',e=>{if(document.activeElement==msg){if(e.key=='Escape')msg.blur();return;}
 if(e.key=='Enter'&&me){msg.focus();e.preventDefault();return;}keys[e.key.toLowerCase()]=1;if(e.key.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
let lastSend=0;
function update(dt){const p=players[me];if(!p)return;const sp=140*dt;let dx=0,dy=0;
 if(keys.arrowleft||keys.a)dx-=1;if(keys.arrowright||keys.d)dx+=1;if(keys.arrowup||keys.w)dy-=1;if(keys.arrowdown||keys.s)dy+=1;
 p.moving=dx||dy;if(!p.moving)return;if(dx&&dy){dx*=.707;dy*=.707;}
 p.dir=dx<0?'left':dx>0?'right':dy<0?'up':'down';
 if(!blocked(p.x+dx*sp,p.y))p.x+=dx*sp;if(!blocked(p.x,p.y+dy*sp))p.y+=dy*sp;p.rx=p.x;p.ry=p.y;p.zone=zoneAt(p.x,p.y);
 const now=performance.now();if(now-lastSend>50){lastSend=now;socket.emit('move',{x:p.x,y:p.y,dir:p.dir});}}
// ---- rendering ----
const prices={BTC:68000,ETH:3400,SOL:150,DOGE:0.15};
function drawMap(t){ctx.fillStyle='#0b0020';ctx.fillRect(0,0,960,600);
 for(const z of ZONES){for(let y=z.y;y<z.y+z.h;y++)for(let x=z.x;x<z.x+z.w;x++){
   if(z.id=='moon'){ctx.fillStyle='#05051a';ctx.fillRect(x*T,y*T,T,T);if((x*7+y*13)%11==0){ctx.fillStyle=(Math.sin(t/300+x)>0)?'#fff':'#88a';ctx.fillRect(x*T+10,y*T+10,2,2);}}
   else{ctx.fillStyle=(x+y)%2?'#1a0838':'#220a48';ctx.fillRect(x*T,y*T,T,T);}}
  ctx.strokeStyle=z.color;ctx.lineWidth=2;ctx.shadowColor=z.color;ctx.shadowBlur=10;ctx.strokeRect(z.x*T+3,z.y*T+3,z.w*T-6,z.h*T-6);ctx.shadowBlur=0;
  ctx.fillStyle=z.color;ctx.font='9px "Press Start 2P"';ctx.fillText(z.name.toUpperCase(),z.x*T+8,(z.y+z.h)*T-8);}
 if(true){ctx.fillStyle='#fffbe0';ctx.shadowColor='#ffe600';ctx.shadowBlur=25;ctx.beginPath();ctx.arc(37*T,15*T,22,0,7);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#d8d0a0';ctx.fillRect(37*T-8,15*T-6,6,6);ctx.fillRect(37*T+6,15*T+4,5,5);}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(MAP.solid[y][x]&&!furniture.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h)){ctx.fillStyle='#2b1060';ctx.fillRect(x*T,y*T,T,T);ctx.fillStyle='#4a20a0';ctx.fillRect(x*T,y*T,T,4);}
 for(const f of furniture){const X=f.x*T,Y=f.y*T,w=f.w*T,h=f.h*T;
  switch(f.type){
  case 'arcade':ctx.fillStyle='#300060';ctx.fillRect(X+2,Y-10,w-4,h+10);ctx.fillStyle=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00'][f.x%5];ctx.fillRect(X+5,Y-6,w-10,10);
   ctx.fillStyle='#000';ctx.fillRect(X+5,Y+6,w-10,6);ctx.fillStyle=Math.sin(t/200+f.x)>0?'#f00':'#ff0';ctx.fillRect(X+8,Y+8,3,3);break;
  case 'ticker':ctx.fillStyle='#000';ctx.fillRect(X,Y,w,h);ctx.strokeStyle='#39ff14';ctx.strokeRect(X,Y,w,h);ctx.save();ctx.beginPath();ctx.rect(X,Y,w,h);ctx.clip();
   ctx.font='8px "Press Start 2P"';let s='';for(const k in prices){const ch=Math.sin(t/4000+k.length)*3;s+=`${k} $${prices[k]*(1+ch/100)>10?Math.round(prices[k]*(1+ch/100)):(prices[k]*(1+ch/100)).toFixed(3)} ${ch>=0?'▲':'▼'}${Math.abs(ch).toFixed(1)}%   `;}
   const off=(t/20)%(s.length*8);ctx.fillStyle='#39ff14';ctx.fillText(s+s,X+4-off,Y+16);ctx.restore();break;
  case 'desk':ctx.fillStyle='#5a3a1a';ctx.fillRect(X,Y+4,w,h-6);ctx.fillStyle='#111';ctx.fillRect(X+8,Y-6,w-16,12);ctx.fillStyle='#00f0ff';
   for(let i=0;i<5;i++)ctx.fillRect(X+10+i*6,Y-2-((i*37+(t/500|0))%5),3,3);break;
  case 'table':ctx.fillStyle='#3a2a6a';ctx.fillRect(X,Y,w,h);ctx.strokeStyle='#00f0ff';ctx.strokeRect(X+2,Y+2,w-4,h-4);break;
  case 'screen':ctx.fillStyle='#001a2a';ctx.fillRect(X,Y+4,w,h-4);ctx.strokeStyle='#00f0ff';ctx.beginPath();for(let i=0;i<w;i+=4){const v=Y+14-Math.sin(i/15+t/800)*5-i/30;i?ctx.lineTo(X+i,v):ctx.moveTo(X,v);}ctx.stroke();break;
  case 'sofa':ctx.fillStyle='#b026ff';ctx.fillRect(X,Y+4,w,h-4);ctx.fillStyle='#7a10c0';ctx.fillRect(X,Y+4,w,6);break;
  case 'plant':ctx.fillStyle='#6a3a1a';ctx.fillRect(X+7,Y+14,10,10);ctx.fillStyle='#39ff14';ctx.fillRect(X+4,Y+2,16,12);ctx.fillRect(X+9,Y-2,6,4);break;
  case 'jukebox':ctx.fillStyle='#ff6b00';ctx.fillRect(X,Y-8,w,h+8);ctx.fillStyle=`hsl(${t/10%360},100%,60%)`;ctx.fillRect(X+6,Y-4,w-12,10);break;
  case 'rocket':ctx.fillStyle='#ddd';ctx.fillRect(X+12,Y+8,24,h-16);ctx.fillStyle='#ff3b3b';ctx.beginPath();ctx.moveTo(X+12,Y+8);ctx.lineTo(X+24,Y-8);ctx.lineTo(X+36,Y+8);ctx.fill();
   ctx.fillRect(X+4,Y+h-24,8,16);ctx.fillRect(X+36,Y+h-24,8,16);ctx.fillStyle='#00f0ff';ctx.fillRect(X+20,Y+20,8,8);ctx.fillStyle=Math.random()>.5?'#ffe600':'#ff6b00';ctx.fillRect(X+16,Y+h-8,16,6+Math.random()*6);break;
  case 'telescope':ctx.fillStyle='#888';ctx.fillRect(X+10,Y+10,4,14);ctx.fillStyle='#ccc';ctx.fillRect(X+4,Y+2,18,7);break;}}}
function drawPlayer(p,t){p.rx+=(p.x-p.rx)*.3;p.ry+=(p.y-p.ry)*.3;const x=Math.round(p.rx)-12,y=Math.round(p.ry)-24;
 ctx.fillStyle='#0006';ctx.fillRect(x+3,y+28,18,4);const moving=Math.abs(p.x-p.rx)+Math.abs(p.y-p.ry)>.5||p.moving;
 drawSprite(ctx,x,y,p.sprite,p.color,3,moving&&(t/150|0)%2);
 ctx.font='7px "Press Start 2P"';const w=ctx.measureText(p.name).width;ctx.fillStyle='#000a';ctx.fillRect(p.rx-w/2-3,y-14,w+6,11);ctx.fillStyle=p.id==me?'#ffe600':p.color;ctx.fillText(p.name,p.rx-w/2,y-5);
 const b=bubbles[p.id];if(b&&b.until>Date.now()){let tx=b.text.length>28?b.text.slice(0,27)+'…':b.text;const bw=ctx.measureText(tx).width+12;const bx=Math.max(2,Math.min(958-bw,p.rx-bw/2)),by=y-36;
  ctx.fillStyle='#fff';ctx.fillRect(bx,by,bw,18);ctx.fillRect(p.rx-3,by+18,6,4);ctx.fillStyle='#000';ctx.fillText(tx,bx+6,by+12);}}
let last=performance.now();
function loop(t){const dt=Math.min(.05,(t-last)/1000);last=t;update(dt);drawMap(t);
 Object.values(players).sort((a,b)=>a.ry-b.ry).forEach(p=>drawPlayer(p,t));
 const p=players[me];if(p)document.getElementById('zone').textContent='Strefa: '+ZN[zoneAt(p.x,p.y)];requestAnimationFrame(loop);}
requestAnimationFrame(loop);
