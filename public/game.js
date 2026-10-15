// Krypto Biuro – 16-bit arcade client, 1960s x steampunk (brass, copper, walnut, cream, teal oxide). All art is procedural.
const {T,W,H,ZONES,FLOOR,furniture,zoneAt,blocked,wallFace,solid}=MAP;
const C=['#1e120c','#8a4b2a','#d4a24c','#f3e6c8']; // walnut ink, copper, brass, cream
// semantic accents: nixie amber, copper-red (loss/short), teal oxide (gain/long), brass highlight
const NEON={amber:'#ff9a3c',mag:'#d9573b',cyan:'#4fb0b4',hi:'#f0cf7a'};
const WAL=['#5a3520','#3e2414','#734628']; // walnut light/dark/hi
const col=c=>typeof c=='string'?c:C[c];
const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b']; // server-side ids of "stroje"
const ZN=Object.fromEntries(ZONES.map(z=>[z.id,z.name]));ZN.korytarz='Korytarz';
const MAPH=H*T;let color=COLORS[0],sprite=0,scope='global',me=null,players={};
const cv=document.getElementById('c');let ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;
function fit(){const s=Math.max(1,Math.floor(Math.min((innerWidth-340)/cv.width,(innerHeight-30)/cv.height)));cv.style.width=cv.width*s+'px';cv.style.height=cv.height*s+'px';}
addEventListener('resize',fit);fit();
const R=(x,y,w,h,c)=>{ctx.fillStyle=col(c);ctx.fillRect(x|0,y|0,w,h);};
// beveled 3D box: dark outline, light top-left bevel, dark bottom-right bevel
const box=(x,y,w,h,f)=>{R(x,y,w,h,0);R(x+1,y+1,w-2,h-2,f);if(w>4&&h>4){ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect((x+1)|0,(y+1)|0,w-2,1);ctx.fillRect((x+1)|0,(y+1)|0,1,h-2);ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect((x+1)|0,(y+h-2)|0,w-2,1);ctx.fillRect((x+w-2)|0,(y+1)|0,1,h-2);}};
// soft drop shadow (light from top-left)
const shade=(x,y,w,h)=>{ctx.fillStyle='rgba(20,8,2,.38)';ctx.fillRect((x+3)|0,(y+3)|0,w,h);};
// ---- tiny 3x5 pixel font ----
const G={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
 0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110',
 '.':'000000000000010',',':'000000000010100',':':'000010000010000','%':'101001010100101','+':'000010111010000','-':'000000111000000','/':'001001010100100','!':'010010010000010','?':'110001010000010','$':'011110010011110','(':'010100100100010',')':'010001001001010','▲':'000010111000000','▼':'000111010000000','*':'000101010101000','#':'101111101111101','"':'101101000000000','@':'010101111100011','_':'000000000000111',' ':'000000000000000'};
const DIA={Ą:'A',Ć:'C',Ę:'E',Ł:'L',Ń:'N',Ó:'O',Ś:'S',Ź:'Z',Ż:'Z'};
function tw(s){return String(s).length*4-1;}
function tt(s,x,y,c=0){s=String(s).toUpperCase();ctx.fillStyle=col(c);for(let k=0;k<s.length;k++){const g=G[DIA[s[k]]||s[k]]||G['?'];for(let i=0;i<15;i++)if(g[i]=='1')ctx.fillRect(x+k*4+i%3,y+(i/3|0),1,1);}}
function tag(s,cx,y,inv){const w=tw(s)+4;ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect((cx-w/2+1)|0,y+1,w,9);R(cx-w/2,y,w,9,inv?C[2]:0);R(cx-w/2+1,y+1,w-2,7,inv?0:3);tt(s,(cx-w/2+2)|0,y+2,inv?NEON.amber:0);}
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
  if(sp==2&&j==2&&c!='0')c='3';g.fillStyle=C[+c];if(c=='2'&&variant!=null)g.fillStyle=['#b5523a','#4fb0b4','#d4a24c','#8a5a9a','#c8742e','#3f7f9a','#f3e6c8','#9a3a2a'][variant]||C[2];g.fillRect(x+i,y+j+(j<13?bob*0:0),1,1);}}
 g.fillStyle=C[0];if(sp==1){g.fillRect(x+4,y-1,2,1);g.fillRect(x+8,y-2,2,2);g.fillRect(x+11,y-1,2,1);} // spiky hair
 if(sp==3){g.fillRect(x+3,y-2,3,3);g.fillRect(x+10,y-2,3,3);g.fillStyle=C[2];g.fillRect(x+4,y-1,1,1);g.fillRect(x+11,y-1,1,1);} // ears
 if(sp==2){g.fillStyle=C[0];g.fillRect(x+7,y-2,2,2);} // beanie pompom
}
// robots (8x8 grid at 2px)
const BOTSHAPE={CHIEF:'crown',SIZE:'square',SCAN:'dish',BOOK:'visor',RISK:'siren',VET:'mono',FILLS:'twin'};
function drawBot(x,y,p,t){const s=2,dir=p.dir||'down',walking=p.act=='walk'&&(performance.now()-(p.lastMove||0)<250),typing=p.act=='typing'||p.act=='filing';
 const bob=walking?((t/160|0)%2):Math.round(Math.sin(t/400+p.name.length));y+=bob;const px=(i,j,w,h,c)=>{ctx.fillStyle=C[c];ctx.fillRect(x+i*s,y+j*s,w*s,h*s);};const sh=BOTSHAPE[p.name]||'square';
 // legs (walk cycle)
 if(walking){const f=(t/160|0)%2;px(2,9,1,f?1:0.5,0);px(5,9,1,f?0.5:1,0);}else{px(2,9,1,0.5,0);px(5,9,1,0.5,0);}
 px(1,6,6,3,0);px(1.5,6.5,5,2,1);
 if(dir!='up'){px(2,7,4,1,0);px(2+((t/200|0)%4),7,1,0.5,3);}
 // arms: typing (alternating hands forward) or swinging
 if(typing){const f=(t/120|0)%2;px(0,6,1,1,0);px(7,6,1,1,0);px(0.5,7+f*0.5,1,1,0);px(6.5,7.5-f*0.5,1,1,0);}
 else if(dir=='left'||dir=='right'){px(dir=='left'?5:2,6.5,1,2,0);}else{const f=walking&&(t/160|0)%2;px(0,6+(f?0.5:0),1,2,0);px(7,6+(f?0:0.5),1,2,0);}
 px(0.5,1.5,7,5,0);px(1,2,6,4,2);px(1,2,6,1,3); // head
 const blink=(t/150|0)%20==0;const ec=blink?2:0;
 if(dir=='up'){px(2,3,4,2,1);}
 else if(dir=='left'||dir=='right'){const ex=dir=='left'?1.5:5.5;if(sh=='visor'||sh=='mono'){px(dir=='left'?1:3,3,4,1,0);px(ex,3,1,1,3);}else px(ex,3,1,1,ec);px(dir=='left'?1.5:5.5,5,1,0.5,0);}
 else{if(sh=='visor'||sh=='mono'){px(1,3,6,1,0);if(sh=='mono')px(3,3,2,1,blink?0:3);else px(2+((t/300|0)%4),3,1,1,3);}else{px(2,3,1,1,ec);px(5,3,1,1,ec);}px(3,5,2,0.5,0);}
 if(sh=='crown'){px(1,0.5,6,1,0);px(1,-0.5,1,1,0);px(3,-0.5,2,1,0);px(6,-0.5,1,1,0);px(1.5,1,5,0.5,3);}
 if(sh=='square'){px(3.5,0,1,1.5,0);px(3,-1,2,1,1);}
 if(sh=='dish'){px(4,0.5,0.5,1,0);px(3,-0.5,3,1,0);px(5,-1.5,1,1,(t/300|0)%2?0:3);}
 if(sh=='siren'){px(3,0,2,1.5,0);px(3.5,0.5,1,1,(t/250|0)%2?3:1);}
 if(sh=='mono'){px(0,1,0.5,2,0);px(7.5,1,0.5,2,0);}
 if(sh=='twin'){px(1.5,0,0.5,1.5,0);px(6,0,0.5,1.5,0);px(1,-0.5,1,1,0);px(6,-0.5,1,1,0);}
 // carried item
 const cx=dir=='left'?-3:13,cy=y+12;
 if(p.carry=='ticket'){box(x+cx,cy,6,7,3);R(x+cx+1,cy+2,4,1,1);R(x+cx+1,cy+4,3,1,1);}
 if(p.carry=='clip'){box(x+cx,cy-1,6,8,1);R(x+cx+1,cy+1,4,5,3);R(x+cx+2,cy-1,2,1,0);}
 if(p.carry=='coffee'){box(x+cx,cy+1,5,6,3);R(x+cx+5,cy+3,1,2,0);if((t/300|0)%2)R(x+cx+2,cy-2,1,2,1);}}
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
socket.on('botState',d=>{const p=players[d.id];if(p){p.status=d.status;p.act=d.act;p.carry=d.carry;if(p.act=='walk')p.lastMove=performance.now();updOnline();}});
socket.on('playerLeft',id=>{delete players[id];updOnline();});
socket.on('correct',d=>{const p=players[me];if(p){p.x=p.rx=d.x;p.y=p.ry=d.y;}});
socket.on('chat',m=>{const log=document.getElementById('log');const el=document.createElement('div');
 if(m.system){el.className='sys';el.textContent='» '+m.text;}else{const t=document.createElement('span');t.className='tag';t.textContent=m.scope=='zone'?'['+(ZN[m.zone]||m.zone)+'] ':'[GLOBAL] ';
  const n=document.createElement('b');n.textContent=m.name;el.append(t,n,document.createTextNode(': '+m.text));say(m.name,m.text,m.id);marks[m.id]=Date.now()+4000;}
 log.appendChild(el);log.scrollTop=1e9;});
socket.on('bubble',d=>{const p=players[d.id];say(p?p.name:'BOT',d.text,d.id);marks[d.id]=Date.now()+4000;});
function updOnline(){const ps=Object.values(players);document.getElementById('online').textContent='Online: '+ps.filter(p=>!p.bot).length+' + '+ps.filter(p=>p.bot).length+' boty';
 const pl=document.getElementById('plist');pl.innerHTML='';ps.sort((a,b)=>(a.bot-b.bot)||a.name.localeCompare(b.name)).forEach(p=>{const d=document.createElement('div');d.textContent=(p.bot?'■ ':'● ')+p.name+(p.id==me?' (ty)':'');if(p.bot){const t=document.createElement('span');t.className='b';t.textContent=' [BOT]'+(p.status?' – '+p.status.replace(p.name+': ',''):'');d.appendChild(t);}pl.appendChild(d);});}
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
const FL={wood:['#8a5a34','#5e3a20','#a8734a'],carpet:['#8c3a22','#5e2414','#d08a3a'],tile:['#e8dcc0','#2f6f78','#c9962e'],mat:['#2f6f78','#24555c','#d4a24c']};
function floorTile(kind,x,y){const X=x*T,Y=y*T,f=FL[kind]||FL.wood;
 if(kind=='wood'){R(X,Y,T,T,f[0]);ctx.fillStyle=f[1];for(let i=0;i<T;i++){const a=(i+((x+y)%2)*8)%16;ctx.fillRect(X+i,Y+((a<8?a:15-a)*2)%16,1,1);ctx.fillRect(X+i,Y+((a<8?a:15-a)*2+8)%16,1,1);}ctx.fillStyle=f[2];for(let i=0;i<T;i+=4)ctx.fillRect(X+i+((y%2)*2),Y+((i*2+x*4)%16),2,1);}
 else if(kind=='carpet'){R(X,Y,T,T,f[0]);ctx.fillStyle=f[1];for(let j=0;j<T;j+=2)for(let i=(j/2)%2*2;i<T;i+=4)ctx.fillRect(X+i,Y+j,1,1);ctx.fillStyle=f[2];if((x+y)%2==0){ctx.fillRect(X+5,Y+4,6,1);ctx.fillRect(X+4,Y+5,1,6);ctx.fillRect(X+11,Y+5,1,6);ctx.fillRect(X+5,Y+11,6,1);ctx.fillRect(X+7,Y+7,2,2);}}
 else if(kind=='tile'){R(X,Y,T,T,f[0]);R(X,Y,T,1,f[1]);R(X,Y,1,T,f[1]);R(X+8,Y,1,T,f[1]);R(X,Y+8,T,1,f[1]);R(X+7,Y+7,3,3,f[2]);R(X,Y,2,2,f[2]);if((x+y)%2){R(X+2,Y+2,4,4,f[1]);R(X+10,Y+10,4,4,f[1]);}}
 else if(kind=='mat'){R(X,Y,T,T,f[0]);ctx.fillStyle=f[2];for(let j=0;j<T;j+=2)for(let i=(j%4);i<T;i+=4)ctx.fillRect(X+i,Y+j,1,1);}
 else {R(X,Y,T,T,f[0]);}}
let mapCache=null;
function buildMap(){const c=document.createElement('canvas');c.width=W*T;c.height=MAPH;const o=ctx;window.ctx2=c.getContext('2d');
 const save=ctx;ctxSwap(c.getContext('2d'));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const z=zoneAt(x*T+8,y*T+8);floorTile(FLOOR[z]||'wood',x,y);}
 // door mats
 for(const [x,y] of MAP.DOORS){R(x*T+2,y*T+2,12,12,1);R(x*T+4,y*T+4,8,8,2);}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!solid[y][x]||furniture.some(f=>x>=f.x&&x<f.x+f.w&&y>=f.y&&y<f.y+f.h))continue;const X=x*T,Y=y*T;
  if(wallFace[y][x]){const top=y==0||(!wallFace[y-1][x]);if(top){R(X,Y,T,T,'#2f5f64');R(X,Y,T,3,0);ctx.fillStyle='#e0c890';for(let k=0;k<2;k++){ctx.fillRect(X+3+k*8,Y+5,2,2);ctx.fillRect(X+2+k*8,Y+6,4,1);}R(X,Y+9,T,3,C[1]);R(X,Y+9,T,1,'#c87a4a');R(X+((x%2)?4:12),Y+9,1,3,NEON.hi);R(X,Y+13,T,1,C[2]);if(x%7==3){R(X+3,Y+3,10,9,C[2]);R(X+4,Y+4,8,7,C[3]);R(X+7,Y+5,1,4,0);R(X+8,Y+7,3,1,NEON.mag);}}else{R(X,Y,T,T,WAL[0]);R(X,Y,T,1,WAL[2]);R(X,Y+T-3,T,3,0);R(X+((x%2)?0:8),Y,1,T-3,WAL[1]);R(X+2,Y+3,4,6,WAL[1]);R(X+10,Y+3,4,6,WAL[1]);R(X,Y+10,T,2,C[1]);R(X,Y+10,T,1,'#c87a4a');if(x%2)R(X+7,Y+10,2,2,NEON.hi);}}
  else{R(X,Y,T,T,0);R(X+2,Y+2,T-4,T-4,WAL[0]);R(X+2,Y+2,T-4,1,WAL[2]);R(X+3,Y+3,T-6,T-6,WAL[1]);R(X+7,Y+1,2,T-2,C[1]);R(X+7,Y+1,1,T-2,'#c87a4a');}}
  // ambient occlusion: darken floor just below walls / right of walls (fake depth)
  for(let y=1;y<H;y++)for(let x=0;x<W;x++){if(solid[y][x])continue;const X=x*T,Y=y*T;ctx.fillStyle='rgba(20,8,2,.45)';if(solid[y-1][x]&&!furniture.some(f=>x>=f.x&&x<f.x+f.w&&y-1>=f.y&&y-1<f.y+f.h))ctx.fillRect(X,Y,T,4);if(x>0&&solid[y][x-1]&&!furniture.some(f=>x-1>=f.x&&x-1<f.x+f.w&&y>=f.y&&y<f.y+f.h))ctx.fillRect(X,Y,3,T);}
 // windows on top wall of open space
 for(const wx of [])for(const yy of [0]){const X=wx*T+2,Y=4;box(X,Y,28,24,3);R(X+13,Y,2,24,0);R(X,Y+11,28,2,0);R(X+3,Y+3,4,2,2);R(X+17,Y+3,4,2,2);}
 // mirrors above sinks
 for(const f of furniture.filter(f=>f.type=='sink')){const X=f.x*T+2,Y=20*T+1;box(X,Y,12,13,3);R(X+3,Y+3,2,5,2);}
 // CHIEF door plaque
 box(8*T-4,20*T+3,24,9,3);tt('CHIEF',8*T-2,20*T+5);box(34*T+2,20*T+3,18,9,3);tt('WC',34*T+7,20*T+5);
 ctxSwap(save);mapCache=c;}
function ctxSwap(g){ctx=g;}
function drawStatic(t){for(const f of furniture)drawF(f,t);}
function drawF(f,t){const X=f.x*T,Y=f.y*T,w=f.w*T,h=f.h*T;
 if(!/board$/.test(f.type))shade(X+1,Y+h-5,w-2,6);
 switch(f.type){
 case 'scoreboard':drawScoreboard(X,Y,w,h,t);break;
 case 'top10board':drawTop10(X,Y,w,h,t);break;
 case 'historyboard':drawHistory(X,Y,w,h,t);break;
 case 'botdesk':{box(X,Y+2,w,h-4,WAL[2]);R(X+1,Y+3,w-2,3,'#9a6238');R(X+1,Y+h-9,w-2,1,C[2]);R(X+1,Y+h-8,w-2,5,WAL[1]);R(X+w/2-3,Y+h-6,6,1,C[2]);R(X+3,Y+h-3,1,3,C[2]);R(X+5,Y+h-3,1,3,C[2]);R(X+w-6,Y+h-3,1,3,C[2]);R(X+w-4,Y+h-3,1,3,C[2]);
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
 case 'watercooler':box(X+4,Y-2,8,8,C[1]);R(X+5,Y,6,1,'#c87a4a');box(X+2,Y+6,12,10,C[2]);R(X+5,Y+8,6,4,C[3]);R(X+7,Y+9,2,2,NEON.mag);R(X+8,Y+10,2,1,0);R(X+12,Y+3,3,1,C[1]);
  {const ph=(t/90|0)%12;ctx.fillStyle='rgba(243,230,200,.7)';ctx.fillRect(X+6+Math.sin(t/300)*2,Y-4-ph,3,2);ctx.fillRect(X+8-Math.sin(t/250)*2,Y-8-((ph+6)%12),2,2);}break;
 case 'copier':box(X,Y+2,w,14,2);R(X+2,Y+4,w-4,3,0);R(X+4,Y+9,8,2,3);R(X+w-8,Y+9,4,3,1);break;
 case 'bookshelf':box(X,Y-6,w,22,1);for(let r=0;r<3;r++){R(X+2,Y-4+r*7,w-4,6,0);for(let i=X+3;i<X+w-3;i+=3)R(i,Y-3+r*7,2,5,(i/3+r)%3?2:3);}break;
 case 'bigdesk':box(X,Y,w,h,WAL[2]);R(X+1,Y+1,w-2,4,'#9a6238');R(X+1,Y+h-10,w-2,1,C[2]);R(X+1,Y+h-9,w-2,8,WAL[1]);R(X+4,Y+h-6,6,1,0);R(X+w-10,Y+h-6,6,1,0);
  // phone
  box(X+4,Y+4,10,6,1);R(X+3,Y+3,12,2,0);R(X+6,Y+6,1,1,3);R(X+8,Y+6,1,1,3);R(X+10,Y+6,1,1,3);
  // monitor
  box(X+w/2-9,Y-6,18,12,0);R(X+w/2-7,Y-4,14,7,(t/800|0)%2?2:3);R(X+w/2-2,Y+6,4,2,0);
  // papers
  R(X+w-16,Y+4,9,6,3);R(X+w-15,Y+5,7,1,1);R(X+w-15,Y+7,5,1,1);
  // nameplate
  {const pw=tw('CHIEF')+8;box(X+w/2-pw/2,Y+h-12,pw,9,3);tt('CHIEF',X+w/2-pw/2+4,Y+h-10);}break;
 case 'chair2':box(X+2,Y+2,12,12,'#c8742e');R(X+4,Y+4,8,4,'#e09a52');R(X+3,Y+13,1,3,C[2]);R(X+12,Y+13,1,3,C[2]);break;
 case 'globe':R(X+7,Y+10,2,4,0);box(X+4,Y+13,8,3,1);ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+8,Y+6,6,0,7);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(X+8,Y+6,5,0,7);ctx.fill();R(X+5,Y+3,3,3,1);R(X+9,Y+7,3,2,1);break;
 case 'stall':box(X,Y,w,h,2);R(X+1,Y+1,w-2,2,1);for(let i=1;i<4;i++)R(X+i*16,Y,1,h,0);
  // toilet visible in first open stall
  box(X+3,Y+8,10,12,3);box(X+4,Y+4,8,5,3);R(X+6,Y+12,4,5,1);box(X+19,Y+18,10,28,1);R(X+26,Y+31,2,2,3);box(X+35,Y+18,10,28,1);R(X+42,Y+31,2,2,3);
  tt('WC',X+w-12,Y+4,3);break;
 case 'sink':box(X+1,Y+4,14,10,3);R(X+3,Y+7,10,4,2);R(X+7,Y+2,2,4,0);R(X+6,Y+2,4,1,0);break;
 case 'towel':R(X+2,Y+2,12,2,0);box(X+3,Y+3,10,12,3);R(X+4,Y+8,8,1,2);R(X+4,Y+11,8,1,2);break;
 case 'sofa':box(X,Y-2,w,h+2,'#2f6f78');R(X+2,Y,w-4,6,'#4fb0b4');for(let i=X+2+16;i<X+w-2;i+=16)R(i,Y,1,6,'#24555c');R(X+1,Y+h-4,w-2,3,0);box(X-1,Y-2,4,h+1,0);box(X+w-3,Y-2,4,h+1,0);break;
 case 'table':box(X,Y,w,h,WAL[2]);R(X+1,Y+1,w-2,3,'#9a6238');R(X+3,Y+h-2,2,2,0);R(X+w-5,Y+h-2,2,2,0);box(X+5,Y+6,6,6,3);R(X+7,Y+7,2,2,1);break;
 case 'tv':box(X,Y-4,w,18,0);R(X+3,Y-1,w-6,10,(t/600|0)%2?2:3);
  {const bx=X+6+((t/40)%(w-16));R(bx,Y+3,3,3,0);R(X+5,Y+1,8,1,1);R(X+w-14,Y+6,8,1,1);}R(X+w/2-4,Y+14,8,2,0);break;
 case 'console':box(X+2,Y+6,12,6,1);R(X+4,Y+8,3,2,3);R(X+10,Y+8,2,2,0);R(X+7,Y+2,1,4,0);break;
 case 'coffee':box(X+1,Y-4,14,20,1);box(X+3,Y-2,10,6,3);tt('KAWA',X+1,Y-1);R(X+6,Y+7,4,3,0);box(X+5,Y+11,6,4,3);if((t/400|0)%2)R(X+7,Y+9,1,2,3);break;
 case 'fridge':box(X,Y-6,w,h+6,3);R(X+1,Y+6,w-2,1,0);R(X+12,Y-2,2,5,0);R(X+12,Y+9,2,8,0);R(X+3,Y-3,6,2,2);break;
 case 'arcadebox':box(X+1,Y-8,14,24,1);box(X+3,Y-6,10,8,0);R(X+4,Y-5,8,6,(t/300|0)%2?2:3);R(X+6,Y+5,2,2,0);R(X+10,Y+5,2,2,3);break;}}
function deskDecor(L,X,Y,w,t){const own=players['bot-'+L];if(own&&own.act=='typing'){R(X+2,Y-12,w-4,1,(t/90|0)%3?0:1);R(X+5,Y+6,((t/70|0)%10)+2,1,0);}
 deskDecor2(L,X,Y,w,t);}
function deskDecor2(L,X,Y,w,t){const mon=(mx,my,mw,mh,anim)=>{box(mx,my,mw,mh,C[2]);R(mx+1,my+1,mw-2,mh-3,'#2a1a10');R(mx+2,my+2,mw-4,mh-5,anim?'#ffb050':'#c8742e');R(mx+2,my+2,1,1,'#2a1a10');R(mx+mw-3,my+2,1,1,'#2a1a10');R(mx+mw/2-1,my+mh,2,2,C[1]);R(mx-1,my+1,1,3,'#ff9a3c');R(mx+mw,my+1,1,3,'#ff9a3c');};
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
function pnl(p){const b=p.desk?p.pnlBase:p.entry;if(!b)return NaN;const c=p.price??b;return (c-b)/b*100*(p.side=='LONG'?1:-1);}
const pctS=v=>isFinite(v)?(v>=0?'+':'')+v.toFixed(2):'-';
const rivets=(X,Y,w,h)=>{for(let i=X;i<X+w;i+=12){R(i,Y-1,2,2,NEON.hi);R(i,Y+h-1,2,2,NEON.hi);}};
function frame(X,Y,w,h){box(X-3,Y-3,w+6,h+6,C[2]);R(X-2,Y-2,w+4,1,NEON.hi);box(X,Y,w,h,0);R(X+1,Y+1,w-2,h-2,'#2a1a10');R(X+2,Y+2,w-4,h-4,'#140a05');rivets(X-1,Y-2,w+2,h+4);}
// nixie/valve display helpers
const NX=NEON.amber,NXD='#7a3a12';
function valves(X,Y,w,t){for(let i=X+10;i<X+w-8;i+=28){R(i,Y-6,6,5,C[1]);R(i+1,Y-6,4,4,(t/700+i)%3<2?'#ffb050':'#c8742e');R(i+2,Y-5,1,2,'#fff2c0');}}
function screenHead(X,Y,w,ttl,right,t){valves(X,Y,w,t);R(X+3,Y+3,tw(ttl)+4,7,C[2]);tt(ttl,X+5,Y+4,0);if(right)tt(right,X+w-tw(right)-4,Y+4,C[3]);}
const usd=v=>v==null?'-':(v<0?'-':'')+'$'+Math.abs(v).toFixed(2),sg=v=>v==null?'-':(v>=0?'+':'')+v.toFixed(2);
function drawScoreboard(X,Y,w,h,t){frame(X,Y,w,h);screenHead(X,Y,w,'TABLICA POZYCJI',hhmm(Date.now()),t);
 const cols=[4,48,78,112,146,172];['SYMBOL','KIER','CENA','AKT','PNL%','BOT'].forEach((c,i)=>tt(c,X+cols[i],Y+13,C[3]));R(X+3,Y+19,w-6,1,C[1]);
 const ps=Object.values(positions);if(!ps.length){if((t/600|0)%2)tt('BRAK OTWARTYCH POZYCJI',X+w/2-tw('BRAK OTWARTYCH POZYCJI')/2,Y+40,NX);return;}
 const n=7;ps.sort((a,b)=>b.openedAt-a.openedAt).slice(0,n).forEach((p,i)=>{const yy=Y+22+i*7,pl=pnl(p);
  [(p.mode=='SHADOW'?'P:':'')+p.symbol.slice(0,9),(p.side=='LONG'?'▲':'▼')+p.side,p.entry!=null?fmtP(p.entry):(p.ref!=null?'~'+fmtP(p.ref):'-'),p.price!=null?fmtP(p.price):'-',pctS(pl),String(p.bot).slice(0,5)]
   .forEach((v,j)=>tt(String(v).slice(0,j==0?11:8),X+cols[j],yy,j==1&&p.side=='SHORT'||j==4&&pl<0?NEON.mag:j==1||j==4?NEON.cyan:NX));});
 if(ps.some(p=>p.mode=='SHADOW'))tt('P: = PAPIER',X+4,Y+h-7,C[1]);if(ps.length>n)tt('+'+(ps.length-n)+' WIECEJ',X+w-48,Y+h-7,C[1]);}
let top10={items:[]};
const fmtCap=v=>!isFinite(v)||v<=0?'-':v>=1e12?'$'+(v/1e12).toFixed(2)+'T':v>=1e9?'$'+(v/1e9).toFixed(1)+'B':'$'+(v/1e6).toFixed(0)+'M';
const fmtUsd=v=>'$'+(v>=1000?Math.round(v).toLocaleString('en-US'):v>=1?v.toFixed(2):v.toPrecision(3));
const hhmm=ts=>ts?new Date(ts).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}):'--:--';
const fmtK=v=>!isFinite(v)||v==null?'-':v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+(v/1e3).toFixed(0)+'K';
const STG={order:'ORDER',order_blocked:'BLOCK',soft_pass:'SOFT+',soft_reject:'SOFT-',soft_missing:'SOFT?',hard_reject:'HARD-',not_enriched:'HARD~',cheap_reject:'CHEAP-'};
// Screen 1: Top 10 desk (compact, left) + ostatnie pozycje (right)
function drawTop10(X,Y,w,h,t){frame(X,Y,w,h);const desk=top10.source=='desk';screenHead(X,Y,w,desk?'TOP 10 DESK':'TOP 10 KRYPTO',hhmm(top10.updatedAt),t);
 const L=112;R(X+L,Y+12,1,h-15,C[1]);
 const cols=desk?[3,13,41,59,83]:[3,13,41,67,0];tt(desk?'# SYM 1H MC ETAP':'# SYM 24H CENA',X+w/2-40,Y+4,C[1]);R(X+3,Y+11,L-5,1,C[1]);
 if(!top10.items.length){if((t/600|0)%2)tt('BRAK DANYCH',X+20,Y+40,NX);}
 else top10.items.slice(0,10).forEach((c,i)=>{const yy=Y+14+i*6,ch=desk?c.change1h:c.change24h,up=(ch||0)>=0;
  const v=desk?[String(c.rank),c.symbol.slice(0,6),ch==null?'-':(up?'+':'')+ch.toFixed(0)+'%',fmtK(c.marketCap),(STG[c.stage]||String(c.stage||'')).slice(0,6)]:[String(c.rank||i+1),c.symbol.slice(0,6),(up?'+':'-')+Math.abs(ch||0).toFixed(1)+'%',fmtUsd(c.price)];
  v.forEach((s,j)=>tt(s,X+cols[j],yy,j==2?(up?NEON.cyan:NEON.mag):NX));});
 const rx=X+L+4;tt('OSTATNIE',rx,Y+13,C[3]);R(rx,Y+19,w-L-7,1,C[1]);const rc=(portfolio&&portfolio.recent)||[];
 if(!rc.length){tt('BRAK',rx,Y+24,NX);tt('HISTORII',rx,Y+31,NX);return;}
 rc.slice(0,4).forEach((r,i)=>{const yy=Y+22+i*13;tt(r.token.replace(/ .*/,'').slice(0,9),rx,yy,NX);
  const s=r.kind=='close'?(r.partial?'1/2 ':'ZAM ')+(r.net>=0?'+':'-')+'$'+Math.abs(r.net).toFixed(0):(r.runner?'RUNNER':'OTW')+(r.size!=null?' $'+Math.round(r.size):'');
  tt(s,rx,yy+6,r.kind=='close'?(r.net>=0?NEON.cyan:NEON.mag):C[3]);if(r.mode=='SHADOW')tt('P',X+w-8,yy,C[1]);});}
const drawDeskTop10=drawTop10;
// Screen 3: Historia portfela (real data from the feed; honest empty state)
let portfolio=null;
function drawHistory(X,Y,w,h,t){frame(X,Y,w,h);const pf=portfolio;screenHead(X,Y,w,'HISTORIA PORTFELA',pf&&pf.mode=='SHADOW'?'PAPIER':'',t);
 const cw=104,cx=X+4,cy=Y+14,ch=h-24;R(cx,cy,cw,ch,'#1e0e06');for(let i=1;i<4;i++)R(cx,cy+i*ch/4|0,cw,1,'#3a1a0a');for(let i=1;i<6;i++)R(cx+i*cw/6|0,cy,1,ch,'#2a1208');
 const sx=cx+cw+5;
 if(!pf||!pf.trades){tt('BRAK HISTORII',cx+10,cy+ch/2-6,NX);tt('TRANSAKCJI',cx+18,cy+ch/2+2,NX);
  tt('BANK',sx,cy,C[3]);tt(pf&&pf.bank!=null?usd(pf.bank):'-',sx,cy+6,NX);tt('START $'+((pf&&pf.start)||1000),sx,cy+16,C[3]);tt('TRADES 0',sx,cy+26,C[3]);return;}
 const s=pf.series.slice();if(pf.bank!=null&&s.length&&Math.abs(s[s.length-1].bank-pf.bank)>0.005)s.push({ts:pf.receivedAt||Date.now(),bank:pf.bank});
 const t0=s[0].ts,t1=Math.max(s[s.length-1].ts,t0+1),vals=s.map(p=>p.bank).concat([pf.start]);let lo=Math.min(...vals),hi=Math.max(...vals);const pad=Math.max(1,(hi-lo)*.15);lo-=pad;hi+=pad;
 const px=ts=>cx+2+(ts-t0)/(t1-t0)*(cw-5),py=v=>cy+ch-2-(v-lo)/(hi-lo)*(ch-4);
 {const y0=py(pf.start)|0;for(let i=cx;i<cx+cw;i+=3)R(i,y0,2,1,C[1]);tt('$'+pf.start,cx+cw-tw('$'+pf.start)-1,y0-6,C[1]);}
 ctx.strokeStyle=NX;ctx.lineWidth=1;ctx.beginPath();s.forEach((p,i)=>{const x=px(p.ts)+.5,y=py(p.bank)+.5;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
 s.forEach(p=>R(px(p.ts)-1,py(p.bank)-1,3,3,'#ffd890'));
 tt(new Date(t0).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'}),cx,cy+ch+2,C[1]);
 const L=[['BANK',usd(pf.bank),NX],['PNL',(pf.realizedPnl>=0?'+':'-')+'$'+Math.abs(pf.realizedPnl).toFixed(2),pf.realizedPnl>=0?NEON.cyan:NEON.mag],['ROI',pf.roiPct==null?'-':sg(pf.roiPct)+'%',(pf.roiPct||0)>=0?NEON.cyan:NEON.mag],
  ['WIN',pf.winRate==null?'-':pf.winRate.toFixed(0)+'%',NX],['TRADES',pf.trades+(pf.partial?' ('+pf.partial+' 1/2)':''),NX],['MAX DD',pf.maxDrawdownPct==null?'-':'-'+pf.maxDrawdownPct.toFixed(1)+'%',NX],
  ['NAJL',pf.best?sg(pf.best.net):'-',NEON.cyan],['NAJG',pf.worst?sg(pf.worst.net):'-',(pf.worst&&pf.worst.net<0)?NEON.mag:NEON.cyan]];
 L.forEach(([k,v,c],i)=>{const yy=cy-1+i*8;tt(k,sx,yy,C[3]);tt(v,X+w-tw(v)-4,yy,c);});}
socket.on('portfolio',d=>{if(d&&typeof d=='object')portfolio=d;});
const t10=document.getElementById('top10');
function renderTop10(){const hd=document.querySelector('#top10 thead tr'),ttl=document.querySelector('#top10 .bh span');
 if(top10.source=='desk'){ttl.textContent='🏆 TOP 10 DESK (ostatni cykl)';hd.innerHTML='<th>#</th><th>Ticker</th><th>Chain</th><th>MC</th><th>Płynność</th><th>1h %</th><th>Etap / powód</th>';
  document.getElementById('t10upd').textContent='cykl: '+new Date(top10.updatedAt).toLocaleString('pl-PL')+' · '+(top10.rule||'');const tb=document.getElementById('t10body');tb.innerHTML='';
  for(const c of top10.items){const tr=document.createElement('tr');const up=(c.change1h||0)>=0;
   [c.rank,c.symbol,c.chain,fmtK(c.marketCap),fmtK(c.liquidity),c.change1h==null?'-':(up?'▲ ':'▼ ')+Math.abs(c.change1h).toFixed(2)+'%',(STG[c.stage]||c.stage)+(c.reason?' · '+c.reason:'')].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i==5&&c.change1h!=null)td.className=up?'pos':'neg';if(i==6)td.style.whiteSpace='normal';tr.appendChild(td);});tb.appendChild(tr);}return;}
 ttl.textContent='🏆 TOP 10 KRYPTO';hd.innerHTML='<th>#</th><th>Symbol / nazwa</th><th>Cena USD</th><th>24h %</th><th>Kapitalizacja</th>';document.getElementById('t10upd').textContent='ostatnia aktualizacja: '+(top10.updatedAt?new Date(top10.updatedAt).toLocaleString('pl-PL'):'—')+(top10.source?' ('+top10.source+')':'')+(top10.error&&top10.items.length?' · błąd odświeżania, pokazuję ostatnie dane':'');
 const tb=document.getElementById('t10body');tb.innerHTML='';if(!top10.items.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center">Brak danych</td></tr>';return;}
 for(const c of top10.items){const tr=document.createElement('tr');const up=(c.change24h||0)>=0;
  [c.rank,c.symbol+' · '+c.name,fmtUsd(c.price),(up?'▲ ':'▼ ')+Math.abs(c.change24h||0).toFixed(2)+'%',fmtCap(c.marketCap)].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i==3)td.className=up?'pos':'neg';tr.appendChild(td);});tb.appendChild(tr);}}
socket.on('top10',d=>{if(d&&Array.isArray(d.items)){top10=d;renderTop10();}});
document.getElementById('t10b').onclick=()=>t10.classList.toggle('show');document.getElementById('t10close').onclick=()=>t10.classList.remove('show');
let positions={},lastZone=null;
socket.on('positions',list=>{positions={};for(const p of list)positions[p.id]=p;renderTable();});
socket.on('position',p=>{positions[p.id]=p;renderTable();});
socket.on('positionClosed',id=>{delete positions[id];renderTable();});
const panel=document.getElementById('board');
function renderTable(){const tb=document.getElementById('btbody');tb.innerHTML='';const ps=Object.values(positions).sort((a,b)=>b.openedAt-a.openedAt);
 if(!ps.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center">Brak otwartych pozycji</td></tr>';return;}
 for(const p of ps){const tr=document.createElement('tr');const pl=pnl(p);tr.className=p.side=='LONG'?'long':'short';
  [p.symbol+(p.mode=='SHADOW'?' [PAPIER]':'')+(p.desk&&p.chain?' ('+p.chain+')':''),(p.side=='LONG'?'▲ ':'▼ ')+p.side,p.desk?'$'+p.size:p.size,p.entry!=null?fmtP(p.entry):(p.desk?'brak (ref '+(p.ref!=null?fmtP(p.ref):'-')+')':'-'),(p.price!=null?fmtP(p.price):'-')+(p.priceSource=='live'?' •':'')+(p.desk&&p.priceTs?' @'+new Date(p.priceTs).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}):''),pctS(pl)+'%'+(p.desk&&p.entry==null?' vs ref':''),p.desk?'RISK: '+(p.risk||''):p.bot,new Date(p.openedAt).toLocaleString('pl-PL',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})]
  .forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i==5)td.className=pl>=0?'pos':'neg';if(p.note&&i==0)td.title=p.note;tr.appendChild(td);});tb.appendChild(tr);}}
document.getElementById('tb').onclick=()=>panel.classList.toggle('show');document.getElementById('bclose').onclick=()=>panel.classList.remove('show');
// ---- players ----
function drawPlayer(p,t){p.rx+=(p.x-p.rx)*.3;p.ry+=(p.y-p.ry)*.3;const x=Math.round(p.rx)-8,y=Math.round(p.ry)-12;
 if(p.bot){ctx.fillStyle='rgba(20,8,2,.45)';ctx.fillRect(x+2,y+14,12,3);drawBot(x,y-6,p,t);}else{const moving=p.id==me?p.moving:(performance.now()-(p.lastMove||0)<200);ctx.fillStyle='rgba(20,8,2,.45)';ctx.fillRect(x+2,y+14,12,3);drawTrainer(ctx,x,y,p.dir||'down',Math.max(0,COLORS.indexOf(p.color)),p.sprite|0,moving&&(t/160|0)%2);}
 tag(p.name+(p.bot?' *':''),Math.round(p.rx),y-(p.bot?17:11),p.id==me);
 if(p.bot&&p.status){const m=players[me];const near=(m&&Math.hypot(m.x-p.x,m.y-p.y)<36)||(mouse&&Math.abs(mouse.x-p.rx)<10&&Math.abs(mouse.y-(p.ry-4))<14);if(near)statusTags.push([p.status,Math.round(p.rx),y+20]);}
 if(marks[p.id]>Date.now()){const bx=Math.round(p.rx)+6,by=y-(p.bot?28:22);box(bx,by,9,10,3);R(bx+4,by+2,1,4,0);R(bx+4,by+7,1,1,0);}}
function drawDialog(t){const Y=MAPH,h=cv.height-MAPH;R(0,Y,cv.width,h,0);box(4,Y+4,cv.width-8,h-8,WAL[2]);R(7,Y+7,cv.width-14,h-14,C[2]);R(8,Y+8,cv.width-16,h-16,'#2a1a10');R(8,Y+8,cv.width-16,1,WAL[2]);
 ctx.font='8px "Press Start 2P"';ctx.fillStyle=C[3];
 if(!dcur||(dcur.done&&t-dcur.done>2500&&dq.length)||(dcur.done&&t-dcur.done>6000)){dcur=dq.shift()||null;if(dcur)dcur.start=t;}
 if(!dcur){const p=players[me];ctx.fillText(p?'Strefa: '+ZN[zoneAt(p.x,p.y)]+'. Podejdź do kogoś i pogadaj!':'Witaj w Krypto Biurze!',16,Y+24);return;}
 const full=dcur.who+': '+dcur.text;const n=Math.min(full.length,Math.floor((t-dcur.start)/30));if(n>=full.length&&!dcur.done)dcur.done=t;
 const s=full.slice(0,n);const per=74;ctx.fillText(s.slice(0,per),16,Y+24);if(s.length>per)ctx.fillText(s.slice(per,per*2),16,Y+40);
 if(dcur.done&&(t/400|0)%2){ctx.fillStyle=NEON.amber;ctx.beginPath();ctx.moveTo(cv.width-24,Y+38);ctx.lineTo(cv.width-16,Y+38);ctx.lineTo(cv.width-20,Y+43);ctx.fill();}}
let mouse=null,statusTags=[];
cv.addEventListener('mousemove',e=>{const r=cv.getBoundingClientRect();mouse={x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};});cv.addEventListener('mouseleave',()=>mouse=null);
let last=performance.now();
function loop(t){const dt=Math.min(.05,(t-last)/1000);last=t;update(dt);
 if(!mapCache&&document.fonts)buildMap();ctx.drawImage(mapCache,0,0);
 // draw furniture and players depth-sorted by bottom edge
 const items=furniture.map(f=>({y:(f.y+f.h)*T,f})).concat(Object.values(players).map(p=>({y:p.ry+4,p})));items.sort((a,b)=>a.y-b.y);
 for(const it of items){if(it.f)drawF(it.f,t);else drawPlayer(it.p,t);}
 for(const [st,sx,sy] of statusTags)tag(st,Math.max(tw(st)/2+4,Math.min(cv.width-tw(st)/2-4,sx)),Math.min(sy,MAPH-10),true);statusTags=[];
 drawDialog(t);
 const p=players[me];if(p){const z=zoneAt(p.x,p.y);document.getElementById('zone').textContent='Strefa: '+ZN[z];if(z!=lastZone){if(z=='board')panel.classList.add('show');else if(lastZone=='board')panel.classList.remove('show');if(z=='top10')t10.classList.add('show');else if(lastZone=='top10')t10.classList.remove('show');lastZone=z;}}
 requestAnimationFrame(loop);}
requestAnimationFrame(loop);
