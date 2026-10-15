// Krypto Biuro – Game Boy style client. All art is procedural.
const {T,W,H,ZONES,FLOOR,furniture,zoneAt,blocked,wallFace,solid}=MAP;
const C=['#0f380f','#306230','#8bac0f','#9bbc0f'];
const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b']; // server-side ids of "stroje"
const ZN=Object.fromEntries(ZONES.map(z=>[z.id,z.name]));ZN.korytarz='Korytarz';
const MAPH=H*T;let color=COLORS[0],sprite=0,scope='global',me=null,players={};
const cv=document.getElementById('c');let ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
function fit(){const s=Math.max(1,Math.floor(Math.min((innerWidth-340)/cv.width,(innerHeight-30)/cv.height)));cv.style.width=cv.width*s+'px';cv.style.height=cv.height*s+'px';}
addEventListener('resize',fit);fit();
const R=(x,y,w,h,c)=>{ctx.fillStyle=C[c];ctx.fillRect(x|0,y|0,w,h);};
const box=(x,y,w,h,f)=>{R(x,y,w,h,0);R(x+1,y+1,w-2,h-2,f);};
// ---- tiny 3x5 pixel font ----
const G={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
 0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110',
 '.':'000000000000010',',':'000000000010100',':':'000010000010000','%':'101001010100101','+':'000010111010000','-':'000000111000000','/':'001001010100100','!':'010010010000010','?':'110001010000010','$':'011110010011110','(':'010100100100010',')':'010001001001010','▲':'000010111000000','▼':'000111010000000','*':'000101010101000','#':'101111101111101','"':'101101000000000','@':'010101111100011','_':'000000000000111',' ':'000000000000000'};
const DIA={Ą:'A',Ć:'C',Ę:'E',Ł:'L',Ń:'N',Ó:'O',Ś:'S',Ź:'Z',Ż:'Z'};
function tw(s){return String(s).length*4-1;}
function tt(s,x,y,c=0){s=String(s).toUpperCase();ctx.fillStyle=C[c];for(let k=0;k<s.length;k++){const g=G[DIA[s[k]]||s[k]]||G['?'];for(let i=0;i<15;i++)if(g[i]=='1')ctx.fillRect(x+k*4+i%3,y+(i/3|0),1,1);}}
function tag(s,cx,y,inv){const w=tw(s)+4;R(cx-w/2,y,w,9,0);R(cx-w/2+1,y+1,w-2,7,inv?0:3);tt(s,(cx-w/2+2)|0,y+2,inv?3:0);}
// ---- 16x16 sprites: '.'=transparent, 0-3 shades, C=cap, S=shirt ----
const pad=a=>a.map(r=>r.padEnd(16,'.'));
const TR={down:pad(["....00000000....","...0CCCCCCCC0...","..0CCCC33CCCC0..","..000000000000..","..033333333330..","..033033330330..","..033333333330..","...0333003330...","..0SSS0000SSS0..",".03SSSSSSSSSS30.",".03SSSSSSSSSS30.","..00SSSSSSSS00..","...0111111110...","...0110000110...","...0000..0000...","................"]),
 up:pad(["....00000000....","...0CCCCCCCC0...","..0CCCCCCCCCC0..","..0CCCCCCCCCC0..","..000000000000..","..011111111110..","..011111111110..","...0111111110...","..0SSS0000SSS0..",".03SSSSSSSSSS30.",".03SSSSSSSSSS30.","..00SSSSSSSS00..","...0111111110...","...0110000110...","...0000..0000...","................"]),
 left:pad(["....0000000.....","...0CCCCCCC0....","..0CCCCCCCCC0...",".00000000CCC0...","..03333331110...","..03033331110...","..03333331110...","...033333310....","...0SSSS0000....","...0SS3SSSS0....","...0SS3SSSS0....","...0SSSSSSS0....","....0111110.....","....0110110.....","....000.000.....","................"])};
TR.right=TR.left.map(r=>[...r].reverse().join(''));
const LEGS={down:[["...0110000110...","...0000..0000..."],["...011000.0110..","...0000...000..."]],up:[["...0110000110...","...0000..0000..."],["...0110.000110..","...000...0000..."]],
 left:[["....0110110.....","....000.000....."],["...0110..0110...","...000....000..."]]};LEGS.right=LEGS.left.map(f=>f.map(r=>[...r].reverse().join('')));
const CAP=['1','0','2','1','0','2','1','0'],SHIRT=['2','1','1','0','2','0','2','1'];
function drawTrainer(g,x,y,dir,variant,sp,frame){const m=TR[dir]||TR.down;const legs=LEGS[dir]||LEGS.down;const cap=sp==1?'0':CAP[variant],sh=SHIRT[variant];const bob=frame?1:0;
 for(let j=0;j<16;j++){const row=j>=13&&j<=14?legs[frame?1:0][j-13]:m[j];for(let i=0;i<16;i++){let c=row[i];if(c=='.')continue;if(c=='C')c=cap;if(c=='S')c=sh;
  if(sp==2&&j==2&&c!='0')c='3';g.fillStyle=C[+c];g.fillRect(x+i,y+j+(j<13?bob*0:0),1,1);}}
 g.fillStyle=C[0];if(sp==1){g.fillRect(x+4,y-1,2,1);g.fillRect(x+8,y-2,2,2);g.fillRect(x+11,y-1,2,1);} // spiky hair
 if(sp==3){g.fillRect(x+3,y-2,3,3);g.fillRect(x+10,y-2,3,3);g.fillStyle=C[2];g.fillRect(x+4,y-1,1,1);g.fillRect(x+11,y-1,1,1);} // ears
 if(sp==2){g.fillStyle=C[0];g.fillRect(x+7,y-2,2,2);} // beanie pompom
}
// robots (8x8 grid at 2px)
const BOTSHAPE={CHIEF:'crown',SIZE:'square',SCAN:'dish',BOOK:'visor',RISK:'siren',VET:'mono',FILLS:'twin'};
function drawBot(x,y,p,t){const s=2,bob=Math.round(Math.sin(t/400+p.name.length));y+=bob;const px=(i,j,w,h,c)=>{ctx.fillStyle=C[c];ctx.fillRect(x+i*s,y+j*s,w*s,h*s);};const sh=BOTSHAPE[p.name]||'square';
 px(1,6,6,3,0);px(1.5,6.5,5,2,1);px(2,7,4,1,0);px(2+((t/200|0)%4),7,1,0.5,3); // body + blinking chest LED
 px(0,6,1,2,0);px(7,6,1,2,0);
 px(0.5,1.5,7,5,0);px(1,2,6,4,2);px(1,2,6,1,3); // head
 const blink=(t/150|0)%20==0;const ec=blink?2:0;
 if(sh=='visor'||sh=='mono'){px(1,3,6,1,0);if(sh=='mono')px(3,3,2,1,blink?0:3);else px(2+((t/300|0)%4),3,1,1,3);}else{px(2,3,1,1,ec);px(5,3,1,1,ec);}
 px(3,5,2,0.5,0);
 if(sh=='crown'){px(1,0.5,6,1,0);px(1,-0.5,1,1,0);px(3,-0.5,2,1,0);px(6,-0.5,1,1,0);px(1.5,1,5,0.5,3);}
 if(sh=='square'){px(3.5,0,1,1.5,0);px(3,-1,2,1,1);}
 if(sh=='dish'){px(4,0.5,0.5,1,0);px(3,-0.5,3,1,0);px(5,-1.5,1,1,(t/300|0)%2?0:3);}
 if(sh=='siren'){px(3,0,2,1.5,0);px(3.5,0.5,1,1,(t/250|0)%2?3:1);}
 if(sh=='mono'){px(0,1,0.5,2,0);px(7.5,1,0.5,2,0);}
 if(sh=='twin'){px(1.5,0,0.5,1.5,0);px(6,0,0.5,1.5,0);px(1,-0.5,1,1,0);px(6,-0.5,1,1,0);}}
// ---- login UI ----
const cd=document.getElementById('colors'),sd=document.getElementById('sprites');
function preview(v,sp,sel){const c=document.createElement('canvas');c.width=20;c.height=22;c.style.width='40px';c.style.height='44px';const g=c.getContext('2d');g.fillStyle=C[3];g.fillRect(0,0,20,22);drawTrainer(g,2,4,'down',v,sp,0);if(sel)c.className='on';return c;}
function renderPicks(){cd.innerHTML='';sd.innerHTML='';COLORS.forEach((col,i)=>{const c=preview(i,sprite,col==color);c.onclick=()=>{color=col;renderPicks();};cd.appendChild(c);});
 [0,1,2,3].forEach(i=>{const c=preview(COLORS.indexOf(color),i,i==sprite);c.onclick=()=>{sprite=i;renderPicks();};sd.appendChild(c);});}
renderPicks();
const nick=document.getElementById('nick');nick.value=localStorage.nick||'';
document.getElementById('go').onclick=join;nick.onkeydown=e=>{if(e.key=='Enter')join();};
const socket=io({autoConnect:false});
function join(){const n=nick.value.trim();if(!n){nick.focus();return;}localStorage.nick=n;document.getElementById('login').remove();socket.connect();socket.emit('join',{name:n,color,sprite});}
// ---- dialog box (bottom, GB style) ----
const dq=[];let dcur=null;
function say(who,text,id){dq.push({who,text:String(text),id,start:0});if(dq.length>4)dq.splice(0,dq.length-4);}
const marks={};
socket.on('init',d=>{me=d.you;players=d.players;for(const p of Object.values(players)){p.rx=p.x;p.ry=p.y;}updOnline();});
socket.on('playerJoined',p=>{p.rx=p.x;p.ry=p.y;players[p.id]=p;updOnline();});
socket.on('playerMoved',d=>{const p=players[d.id];if(p){Object.assign(p,d);p.lastMove=performance.now();}});
socket.on('playerLeft',id=>{delete players[id];updOnline();});
socket.on('correct',d=>{const p=players[me];if(p){p.x=p.rx=d.x;p.y=p.ry=d.y;}});
socket.on('chat',m=>{const log=document.getElementById('log');const el=document.createElement('div');
 if(m.system){el.className='sys';el.textContent='» '+m.text;}else{const t=document.createElement('span');t.className='tag';t.textContent=m.scope=='zone'?'['+(ZN[m.zone]||m.zone)+'] ':'[GLOBAL] ';
  const n=document.createElement('b');n.textContent=m.name;el.append(t,n,document.createTextNode(': '+m.text));say(m.name,m.text,m.id);marks[m.id]=Date.now()+4000;}
 log.appendChild(el);log.scrollTop=1e9;});
socket.on('bubble',d=>{const p=players[d.id];say(p?p.name:'BOT',d.text,d.id);marks[d.id]=Date.now()+4000;});
function updOnline(){const ps=Object.values(players);document.getElementById('online').textContent='Online: '+ps.filter(p=>!p.bot).length+' + '+ps.filter(p=>p.bot).length+' boty';
 const pl=document.getElementById('plist');pl.innerHTML='';ps.sort((a,b)=>(a.bot-b.bot)||a.name.localeCompare(b.name)).forEach(p=>{const d=document.createElement('div');d.textContent=(p.bot?'■ ':'● ')+p.name+(p.id==me?' (ty)':'');if(p.bot){const t=document.createElement('span');t.className='b';t.textContent=' [BOT]';d.appendChild(t);}pl.appendChild(d);});}
const tg=document.getElementById('tg'),tz=document.getElementById('tz');
tg.onclick=()=>{scope='global';tg.className='on';tz.className='';};tz.onclick=()=>{scope='zone';tz.className='on';tg.className='';};
const msg=document.getElementById('msg');
document.getElementById('form').onsubmit=e=>{e.preventDefault();if(msg.value.trim())socket.emit('chat',{text:msg.value,scope});msg.value='';msg.blur();};
// ---- input / movement ----
const keys={};addEventListener('keydown',e=>{if(document.activeElement==msg){if(e.key=='Escape')msg.blur();return;}
 if(e.key=='Enter'&&me){msg.focus();e.preventDefault();return;}keys[e.key.toLowerCase()]=1;if(e.key.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
let lastSend=0;
function update(dt){const p=players[me];if(!p)return;const sp=72*dt;let dx=0,dy=0;
 if(keys.arrowleft||keys.a)dx-=1;if(keys.arrowright||keys.d)dx+=1;if(keys.arrowup||keys.w)dy-=1;if(keys.arrowdown||keys.s)dy+=1;
 p.moving=!!(dx||dy);if(!p.moving)return;if(dx&&dy){dx*=.707;dy*=.707;}
 p.dir=dx<0?'left':dx>0?'right':dy<0?'up':'down';
 if(!blocked(p.x+dx*sp,p.y))p.x+=dx*sp;if(!blocked(p.x,p.y+dy*sp))p.y+=dy*sp;p.rx=p.x;p.ry=p.y;
 const now=performance.now();if(now-lastSend>50){lastSend=now;socket.emit('move',{x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,dir:p.dir});}}
// ---- map rendering ----
function floorTile(kind,x,y){const X=x*T,Y=y*T;
 if(kind=='wood'){R(X,Y,T,T,3);R(X,Y+7,T,1,2);R(X,Y+15,T,1,2);R(X+((y%2)?4:12),Y,1,7,2);R(X+((y%2)?12:4),Y+8,1,7,2);}
 else if(kind=='carpet'){R(X,Y,T,T,2);ctx.fillStyle=C[1];for(let j=0;j<T;j+=2)for(let i=(j/2)%2*2;i<T;i+=4)ctx.fillRect(X+i,Y+j,1,1);}
 else if(kind=='tile'){R(X,Y,T,T,3);R(X,Y,T,1,2);R(X,Y,1,T,2);R(X+8,Y,1,T,2);R(X,Y+8,T,1,2);}
 else if(kind=='mat'){R(X,Y,T,T,3);ctx.fillStyle=C[2];for(let j=0;j<T;j+=2)for(let i=(j%4);i<T;i+=4)ctx.fillRect(X+i,Y+j,1,1);}
 else {R(X,Y,T,T,3);}}
let mapCache=null;
function buildMap(){const c=document.createElement('canvas');c.width=W*T;c.height=MAPH;const o=ctx;window.ctx2=c.getContext('2d');
 const save=ctx;ctxSwap(c.getContext('2d'));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const z=zoneAt(x*T+8,y*T+8);floorTile(FLOOR[z]||'wood',x,y);}
 // door mats
 for(const [x,y] of [[28,8],[28,17],[6,20],[7,20],[20,20],[21,20]]){R(x*T+2,y*T+2,12,12,1);R(x*T+4,y*T+4,8,8,2);}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!solid[y][x]||furniture.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h))continue;const X=x*T,Y=y*T;
  if(wallFace[y][x]){const top=y==0||(!wallFace[y-1][x]);if(top){R(X,Y,T,T,1);R(X,Y,T,3,0);R(X,Y+5,T,1,2);}else{R(X,Y,T,T,2);R(X,Y+T-3,T,3,0);R(X+((x%2)?0:8),Y,1,T-3,1);}}
  else{R(X,Y,T,T,0);R(X+3,Y+3,T-6,T-6,1);}}
 // windows on top wall of open space
 for(const wx of [22,25])for(const yy of [0]){const X=wx*T+2,Y=4;box(X,Y,28,24,3);R(X+13,Y,2,24,0);R(X,Y+11,28,2,0);R(X+3,Y+3,4,2,2);R(X+17,Y+3,4,2,2);}
 // mirrors above sinks
 for(const f of furniture.filter(f=>f.type=='sink')){const X=f.x*T+2,Y=13*T+1;box(X,Y,12,13,3);R(X+3,Y+3,2,5,2);}
 // CHIEF door plaque
 box(27*T+3,7*T+3,24,9,3);tt('CHIEF',27*T+5,7*T+5);box(27*T+6,16*T+3,18,9,3);tt('WC',27*T+11,16*T+5);
 ctxSwap(save);mapCache=c;}
function ctxSwap(g){ctx=g;}
function drawStatic(t){for(const f of furniture)drawF(f,t);}
function drawF(f,t){const X=f.x*T,Y=f.y*T,w=f.w*T,h=f.h*T;
 switch(f.type){
 case 'scoreboard':drawScoreboard(X,Y,w,h,t);break;
 case 'botdesk':{box(X,Y+2,w,h-4,2);R(X+1,Y+3,w-2,3,3);R(X+1,Y+h-8,w-2,5,1);R(X+3,Y+h-3,3,3,0);R(X+w-6,Y+h-3,3,3,0);
  const L=f.label;deskDecor(L,X,Y,w,t);
  // plaque on floor below
  const pw=tw(L)+6;box(X+w/2-pw/2,Y+h+1,pw,9,3);tt(L,X+w/2-pw/2+3,Y+h+3);break;}
 case 'scales':R(X+7,Y+3,2,11,0);R(X+2,Y+3,12,1,0);const tl=Math.sin(t/700)>0?1:0;box(X,Y+5+tl,6,3,2);box(X+10,Y+6-tl,6,3,2);box(X+4,Y+13,8,3,1);break;
 case 'radar':box(X+6,Y+8,4,8,1);ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+8,Y+7,7,Math.PI*0.9,Math.PI*2.1);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(X+8,Y+7,5,Math.PI,Math.PI*2);ctx.fill();
  const a=t/500;R(X+8+Math.cos(a)*4,Y+5+Math.sin(a)*1.5,2,2,0);break;
 case 'cabinet':box(X+1,Y-6,14,22,2);for(let i=0;i<3;i++){box(X+3,Y-4+i*7,10,6,3);R(X+6,Y-2+i*7,4,1,0);}break;
 case 'alarm':R(X+7,Y+4,2,12,0);box(X+4,Y-4,8,9,(t/300|0)%2?3:1);R(X+5,Y-5,6,1,0);if((t/300|0)%2){R(X+1,Y-1,2,1,0);R(X+13,Y-1,2,1,0);R(X+2,Y-4,1,1,0);R(X+13,Y-4,1,1,0);}
  ctx.fillStyle=C[0];ctx.beginPath();ctx.moveTo(X+2,Y+15);ctx.lineTo(X+8,Y+7);ctx.lineTo(X+14,Y+15);ctx.fill();R(X+7,Y+10,2,3,3);R(X+7,Y+14,2,1,3);break;
 case 'stampdesk':box(X,Y+4,16,12,2);box(X+2,Y+1,7,9,3);R(X+3,Y+3,5,1,1);R(X+3,Y+5,4,1,1);R(X+3,Y+7,5,1,1);const sy=(t/500|0)%3==0?2:0;box(X+10,Y-1+sy,4,6,1);box(X+9,Y+5+sy,6,3,0);break;
 case 'printer':box(X+1,Y+5,14,11,2);R(X+3,Y+7,10,2,0);const pl=4+((t/150|0)%8);box(X+4,Y+7-pl,8,pl,3);for(let i=2;i<pl;i+=2)R(X+5,Y+7-pl+i,5,1,1);R(X+11,Y+12,2,2,1);break;
 case 'plant':case 'bigplant':box(X+4,Y+9,8,7,1);R(X+5,Y+10,6,1,2);ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+8,Y+6,6,0,7);ctx.fill();ctx.fillStyle=C[2];ctx.beginPath();ctx.arc(X+8,Y+6,4.5,0,7);ctx.fill();R(X+5,Y+4,2,2,3);R(X+9,Y+7,2,2,1);break;
 case 'watercooler':box(X+3,Y,10,6,3);R(X+5,Y+2,2,2,2);box(X+2,Y+6,12,10,2);R(X+7,Y+9,2,2,0);break;
 case 'copier':box(X,Y+2,w,14,2);R(X+2,Y+4,w-4,3,0);R(X+4,Y+9,8,2,3);R(X+w-8,Y+9,4,3,1);break;
 case 'bookshelf':box(X,Y-6,w,22,1);for(let r=0;r<3;r++){R(X+2,Y-4+r*7,w-4,6,0);for(let i=X+3;i<X+w-3;i+=3)R(i,Y-3+r*7,2,5,(i/3+r)%3?2:3);}break;
 case 'bigdesk':box(X,Y,w,h,2);R(X+1,Y+1,w-2,4,3);R(X+1,Y+h-9,w-2,8,1);R(X+4,Y+h-6,6,1,0);R(X+w-10,Y+h-6,6,1,0);
  // phone
  box(X+4,Y+4,10,6,1);R(X+3,Y+3,12,2,0);R(X+6,Y+6,1,1,3);R(X+8,Y+6,1,1,3);R(X+10,Y+6,1,1,3);
  // monitor
  box(X+w/2-9,Y-6,18,12,0);R(X+w/2-7,Y-4,14,7,(t/800|0)%2?2:3);R(X+w/2-2,Y+6,4,2,0);
  // papers
  R(X+w-16,Y+4,9,6,3);R(X+w-15,Y+5,7,1,1);R(X+w-15,Y+7,5,1,1);
  // nameplate
  {const pw=tw('CHIEF')+8;box(X+w/2-pw/2,Y+h-12,pw,9,3);tt('CHIEF',X+w/2-pw/2+4,Y+h-10);}break;
 case 'chair2':box(X+2,Y+2,12,12,1);R(X+4,Y+4,8,4,2);break;
 case 'globe':R(X+7,Y+10,2,4,0);box(X+4,Y+13,8,3,1);ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+8,Y+6,6,0,7);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(X+8,Y+6,5,0,7);ctx.fill();R(X+5,Y+3,3,3,1);R(X+9,Y+7,3,2,1);break;
 case 'stall':box(X,Y,w,h,2);R(X+1,Y+1,w-2,2,1);for(let i=1;i<4;i++)R(X+i*16,Y,1,h,0);
  // toilet visible in first open stall
  box(X+3,Y+8,10,12,3);box(X+4,Y+4,8,5,3);R(X+6,Y+12,4,5,1);box(X+19,Y+18,10,28,1);R(X+26,Y+31,2,2,3);box(X+35,Y+18,10,28,1);R(X+42,Y+31,2,2,3);
  tt('WC',X+w-12,Y+4,3);break;
 case 'sink':box(X+1,Y+4,14,10,3);R(X+3,Y+7,10,4,2);R(X+7,Y+2,2,4,0);R(X+6,Y+2,4,1,0);break;
 case 'towel':R(X+2,Y+2,12,2,0);box(X+3,Y+3,10,12,3);R(X+4,Y+8,8,1,2);R(X+4,Y+11,8,1,2);break;
 case 'sofa':box(X,Y-2,w,h+2,1);R(X+2,Y,w-4,6,2);for(let i=X+2+16;i<X+w-2;i+=16)R(i,Y,1,6,1);R(X+1,Y+h-4,w-2,3,0);box(X-1,Y-2,4,h+1,0);box(X+w-3,Y-2,4,h+1,0);break;
 case 'table':box(X,Y,w,h,2);R(X+1,Y+1,w-2,3,3);R(X+3,Y+h-2,2,2,0);R(X+w-5,Y+h-2,2,2,0);box(X+5,Y+6,6,6,3);R(X+7,Y+7,2,2,1);break;
 case 'tv':box(X,Y-4,w,18,0);R(X+3,Y-1,w-6,10,(t/600|0)%2?2:3);
  {const bx=X+6+((t/40)%(w-16));R(bx,Y+3,3,3,0);R(X+5,Y+1,8,1,1);R(X+w-14,Y+6,8,1,1);}R(X+w/2-4,Y+14,8,2,0);break;
 case 'console':box(X+2,Y+6,12,6,1);R(X+4,Y+8,3,2,3);R(X+10,Y+8,2,2,0);R(X+7,Y+2,1,4,0);break;
 case 'coffee':box(X+1,Y-4,14,20,1);box(X+3,Y-2,10,6,3);tt('KAWA',X+1,Y-1);R(X+6,Y+7,4,3,0);box(X+5,Y+11,6,4,3);if((t/400|0)%2)R(X+7,Y+9,1,2,3);break;
 case 'fridge':box(X,Y-6,w,h+6,3);R(X+1,Y+6,w-2,1,0);R(X+12,Y-2,2,5,0);R(X+12,Y+9,2,8,0);R(X+3,Y-3,6,2,2);break;
 case 'arcadebox':box(X+1,Y-8,14,24,1);box(X+3,Y-6,10,8,0);R(X+4,Y-5,8,6,(t/300|0)%2?2:3);R(X+6,Y+5,2,2,0);R(X+10,Y+5,2,2,3);break;}}
function deskDecor(L,X,Y,w,t){const mon=(mx,my,mw,mh,anim)=>{box(mx,my,mw,mh,0);R(mx+1,my+1,mw-2,mh-3,anim?2:3);R(mx+mw/2-1,my+mh,2,2,0);};
 switch(L){
 case 'SIZE':for(let i=0;i<3;i++){mon(X+3+i*14,Y-9,12,10,(t/700|0)%3==i);R(X+5+i*14,Y-6,6,1,1);R(X+5+i*14,Y-4,4,1,1);}box(X+34,Y+4,9,10,1);R(X+36,Y+5,5,2,3);for(let j=0;j<2;j++)for(let i=0;i<2;i++)R(X+36+i*3,Y+8+j*3,2,2,3);break;
 case 'SCAN':for(let i=0;i<3;i++){mon(X+2+i*15,Y-10,14,11,0);ctx.fillStyle=C[0];for(let k=0;k<10;k++)ctx.fillRect(X+4+i*15+k,Y-3-Math.round(Math.abs(Math.sin(k/2+t/500+i))*4),1,1);}R(X+6,Y+5,6,3,0);break;
 case 'BOOK':for(let i=0;i<4;i++)box(X+3+i*5,Y-6,5,12,i%2?1:2);box(X+26,Y+2,14,8,3);R(X+33,Y+2,1,8,0);for(let k=0;k<3;k++){R(X+28,Y+4+k*2,4,1,1);R(X+35,Y+4+k*2,4,1,1);}break;
 case 'RISK':mon(X+4,Y-9,14,10,0);ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+11,Y-2,5,Math.PI,0);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(X+11,Y-2,4,Math.PI,0);ctx.fill();
  {const a=Math.PI+Math.PI*(0.5+0.4*Math.sin(t/600));R(X+11+Math.cos(a)*3,Y-2+Math.sin(a)*3,1,1,0);}
  // shield
  box(X+26,Y-6,12,9,2);R(X+28,Y+3,8,2,0);R(X+30,Y+5,4,2,0);R(X+31,Y-4,2,6,0);R(X+29,Y-2,6,2,0);break;
 case 'VET':box(X+4,Y-4,11,14,1);box(X+5,Y-2,9,11,3);R(X+7,Y-4,5,2,0);for(let k=0;k<3;k++){R(X+7,Y+k*3,1,1,0);R(X+9,Y+k*3,4,1,1);}
  {const mx=X+26+Math.round(Math.sin(t/800)*4);ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(mx,Y,5,0,7);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(mx,Y,3.5,0,7);ctx.fill();R(mx+3,Y+3,2,2,0);R(mx+5,Y+5,2,2,0);}break;
 case 'FILLS':mon(X+4,Y-10,20,11,0);tt((t/600|0)%2?'>BUY':'>OK',X+6,Y-7);box(X+6,Y+3,16,5,1);for(let i=0;i<6;i++)R(X+8+i*2,Y+4,1,1,3);
  // bell
  ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+36,Y+6,5,Math.PI,0);ctx.fill();R(X+30,Y+6,12,2,0);R(X+35,Y-1,2,2,0);ctx.fillStyle=C[3];ctx.fillRect(X+33,Y+3,2,1);break;}}
// ---- positions board ----
function fmtP(v){v=+v;return v>=1000?v.toFixed(0):v>=1?v.toFixed(2):v.toPrecision(3);}
function pnl(p){const c=p.price??p.entry;return (c-p.entry)/p.entry*100*(p.side=='LONG'?1:-1);}
function drawScoreboard(X,Y,w,h,t){box(X-2,Y-2,w+4,h+4,1);box(X,Y,w,h,0);R(X+1,Y+1,w-2,h-2,1);R(X+2,Y+2,w-4,h-4,0);
 const ttl='TABLICA POZYCJI';R(X+w/2-tw(ttl)/2-3,Y+3,tw(ttl)+6,7,3);tt(ttl,X+w/2-tw(ttl)/2,Y+4,0);
 const cols=[5,46,78,114,150,184];['SYMBOL','KIER','CENA','AKT','PNL%','BOT'].forEach((c,i)=>tt(c,X+cols[i],Y+13,2));R(X+4,Y+19,w-8,1,1);
 const ps=Object.values(positions);if(!ps.length){if((t/600|0)%2)tt('BRAK OTWARTYCH POZYCJI',X+w/2-tw('BRAK OTWARTYCH POZYCJI')/2,Y+36,3);return;}
 ps.sort((a,b)=>b.openedAt-a.openedAt).slice(0,6).forEach((p,i)=>{const yy=Y+22+i*7,pl=pnl(p);
  [p.symbol.slice(0,10),(p.side=='LONG'?'▲':'▼')+p.side,fmtP(p.entry),fmtP(p.price??p.entry),(pl>=0?'+':'')+pl.toFixed(2),p.bot].forEach((v,j)=>tt(String(v),X+cols[j],yy,j==1&&p.side=='SHORT'||j==4&&pl<0?2:3));});
 if(ps.length>6)tt('+'+(ps.length-6)+' WIECEJ',X+w-44,Y+h-7,2);}
let positions={},lastZone=null;
socket.on('positions',list=>{positions={};for(const p of list)positions[p.id]=p;renderTable();});
socket.on('position',p=>{positions[p.id]=p;renderTable();});
socket.on('positionClosed',id=>{delete positions[id];renderTable();});
const panel=document.getElementById('board');
function renderTable(){const tb=document.getElementById('btbody');tb.innerHTML='';const ps=Object.values(positions).sort((a,b)=>b.openedAt-a.openedAt);
 if(!ps.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center">Brak otwartych pozycji</td></tr>';return;}
 for(const p of ps){const tr=document.createElement('tr');const pl=pnl(p);tr.className=p.side=='LONG'?'long':'short';
  [p.symbol,(p.side=='LONG'?'▲ ':'▼ ')+p.side,p.size,fmtP(p.entry),fmtP(p.price??p.entry)+(p.priceSource=='live'?' •':''),(pl>=0?'+':'')+pl.toFixed(2)+'%',p.bot,new Date(p.openedAt).toLocaleString('pl-PL',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})]
  .forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i==5)td.className=pl>=0?'pos':'neg';if(p.note&&i==0)td.title=p.note;tr.appendChild(td);});tb.appendChild(tr);}}
document.getElementById('tb').onclick=()=>panel.classList.toggle('show');document.getElementById('bclose').onclick=()=>panel.classList.remove('show');
// ---- players ----
function drawPlayer(p,t){p.rx+=(p.x-p.rx)*.3;p.ry+=(p.y-p.ry)*.3;const x=Math.round(p.rx)-8,y=Math.round(p.ry)-12;
 if(p.bot){drawBot(x,y-6,p,t);}else{const moving=p.id==me?p.moving:(performance.now()-(p.lastMove||0)<200);R(x+3,y+14,10,2,1);drawTrainer(ctx,x,y,p.dir||'down',Math.max(0,COLORS.indexOf(p.color)),p.sprite|0,moving&&(t/160|0)%2);}
 tag(p.name+(p.bot?' *':''),Math.round(p.rx),y-(p.bot?17:11),p.id==me);
 if(marks[p.id]>Date.now()){const bx=Math.round(p.rx)+6,by=y-(p.bot?28:22);box(bx,by,9,10,3);R(bx+4,by+2,1,4,0);R(bx+4,by+7,1,1,0);}}
function drawDialog(t){const Y=MAPH,h=cv.height-MAPH;R(0,Y,cv.width,h,0);box(4,Y+4,cv.width-8,h-8,3);R(7,Y+7,cv.width-14,h-14,0);R(8,Y+8,cv.width-16,h-16,3);
 ctx.font='8px "Press Start 2P"';ctx.fillStyle=C[0];
 if(!dcur||(dcur.done&&t-dcur.done>2500&&dq.length)||(dcur.done&&t-dcur.done>6000)){dcur=dq.shift()||null;if(dcur)dcur.start=t;}
 if(!dcur){const p=players[me];ctx.fillText(p?'Strefa: '+ZN[zoneAt(p.x,p.y)]+'. Podejdź do kogoś i pogadaj!':'Witaj w Krypto Biurze!',16,Y+24);return;}
 const full=dcur.who+': '+dcur.text;const n=Math.min(full.length,Math.floor((t-dcur.start)/30));if(n>=full.length&&!dcur.done)dcur.done=t;
 const s=full.slice(0,n);const per=74;ctx.fillText(s.slice(0,per),16,Y+24);if(s.length>per)ctx.fillText(s.slice(per,per*2),16,Y+40);
 if(dcur.done&&(t/400|0)%2){ctx.fillStyle=C[0];ctx.beginPath();ctx.moveTo(cv.width-24,Y+38);ctx.lineTo(cv.width-16,Y+38);ctx.lineTo(cv.width-20,Y+43);ctx.fill();}}
let last=performance.now();
function loop(t){const dt=Math.min(.05,(t-last)/1000);last=t;update(dt);
 if(!mapCache&&document.fonts)buildMap();ctx.drawImage(mapCache,0,0);
 // draw furniture and players depth-sorted by bottom edge
 const items=furniture.map(f=>({y:(f.y+f.h)*T,f})).concat(Object.values(players).map(p=>({y:p.ry+4,p})));items.sort((a,b)=>a.y-b.y);
 for(const it of items){if(it.f)drawF(it.f,t);else drawPlayer(it.p,t);}
 drawDialog(t);
 const p=players[me];if(p){const z=zoneAt(p.x,p.y);document.getElementById('zone').textContent='Strefa: '+ZN[z];if(z!=lastZone){if(z=='board')panel.classList.add('show');else if(lastZone=='board')panel.classList.remove('show');lastZone=z;}}
 requestAnimationFrame(loop);}
requestAnimationFrame(loop);
