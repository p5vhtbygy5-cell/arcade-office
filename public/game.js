// Krypto Biuro – 16-bit arcade client, 1960s x steampunk (brass, copper, walnut, cream, teal oxide). All art is procedural.
const {T,W,H,ZONES,FLOOR,furniture,zoneAt,blocked,wallFace,solid}=MAP;
const C=['#1e120c','#8a4b2a','#d4a24c','#f3e6c8']; // walnut ink, copper, brass, cream
// semantic accents: nixie amber, copper-red (loss/short), teal oxide (gain/long), brass highlight
const NEON={amber:'#ff9a3c',mag:'#d9573b',cyan:'#4fb0b4',hi:'#f0cf7a'};
const WAL=['#5a3520','#3e2414','#734628']; // walnut light/dark/hi
const AU='#c9a24a'; // restrained gold (CHIEF office)
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
// ---- chat speech bubbles: cream paper + brass edge, ~5 s, max ~60 chars in 2 lines, newest replaces old, follows the character ----
const bubbles={};
function speak(id,text){if(!id)return;let s=ascii(text);if(!s)s='...';if(s.length>60)s=s.slice(0,59)+'.';const L=[];let cur='';
 for(const w of s.split(' ')){if((cur+' '+w).trim().length>30&&cur){L.push(cur);cur=w;}else cur=(cur+' '+w).trim();}if(cur)L.push(cur);
 bubbles[id]={lines:L.slice(0,2).map(l=>l.slice(0,30)),until:Date.now()+5000};}
function drawBubble(p,cx,top){const b=bubbles[p.id];if(!b)return;if(Date.now()>b.until){delete bubbles[p.id];return;}
 const w=Math.max(...b.lines.map(tw))+8,h=b.lines.length*7+5;let x=Math.round(cx-w/2);x=Math.max(2,Math.min(W*T-w-2,x));const y=Math.max(14,top-h-5);
 ctx.fillStyle='rgba(20,8,2,.4)';ctx.fillRect(x+2,y+2,w,h);R(x,y,w,h,C[2]);R(x+1,y+1,w-2,h-2,C[3]);R(x+1,y+1,w-2,1,'#fff8e4');R(x+1,y+h-2,w-2,1,'#e0cfa8');
 const tx=Math.max(x+4,Math.min(x+w-6,cx));R(tx-2,y+h,5,1,C[2]);R(tx-1,y+h,3,1,C[3]);R(tx-1,y+h+1,3,1,C[2]);R(tx,y+h+1,1,1,C[3]);R(tx,y+h+2,1,1,C[2]);
 b.lines.forEach((l,i)=>tt(l,x+4,y+3+i*7,0));}
socket.on('init',d=>{me=d.you;players=d.players;for(const p of Object.values(players)){p.rx=p.x;p.ry=p.y;}updOnline();});
socket.on('playerJoined',p=>{p.rx=p.x;p.ry=p.y;players[p.id]=p;updOnline();});
socket.on('playerMoved',d=>{const p=players[d.id];if(p){Object.assign(p,d);p.lastMove=performance.now();}});
socket.on('botState',d=>{const p=players[d.id];if(p){p.status=d.status;p.act=d.act;p.carry=d.carry;if(p.act=='walk')p.lastMove=performance.now();updOnline();}});
socket.on('playerLeft',id=>{delete players[id];updOnline();});
socket.on('correct',d=>{const p=players[me];if(p){p.x=p.rx=d.x;p.y=p.ry=d.y;}});
socket.on('chat',m=>{const log=document.getElementById('log');const el=document.createElement('div');
 if(m.system){el.className='sys';el.textContent='» '+m.text;}else{const t=document.createElement('span');t.className='tag';t.textContent=m.scope=='zone'?'['+(ZN[m.zone]||m.zone)+'] ':'[GLOBAL] ';
  const n=document.createElement('b');n.textContent=m.name;el.append(t,n,document.createTextNode(': '+m.text));say(m.name,m.text,m.id);marks[m.id]=Date.now()+4000;speak(m.id,m.text);}
 log.appendChild(el);log.scrollTop=1e9;});
socket.on('bubble',d=>{const p=players[d.id];say(p?p.name:'BOT',d.text,d.id);marks[d.id]=Date.now()+4000;speak(d.id,d.text);});
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
 // Persian/Turkish rugs under the bot desks (static layer)
 for(const f of furniture.filter(f=>f.type=='botdesk'))rug((f.x-1)*T+4,(f.y-1)*T+6,(f.w+3)*T-8,(f.h+2)*T-6);
 chiefDecor();
 ctxSwap(save);mapCache=c;}
function chiefDecor(){// big Persian rug with gold border
 rug(1*T+6,21*T+10,10*T-6,5*T-4);R(1*T+5,21*T+9,10*T-4,1,AU);R(1*T+5,26*T+6,10*T-4,1,AU);
 // dark panelling with gold trim on the room's wall (row 20 and side wall x=12)
 for(let x=1;x<10;x++){const X=x*T,Y=20*T;R(X,Y+3,T,10,'#3a1e0e');R(X,Y+3,T,1,AU);R(X,Y+12,T,1,AU);R(X+2,Y+5,5,5,'#2e180a');R(X+9,Y+5,5,5,'#2e180a');}
 for(let y=21;y<27;y++){R(12*T+2,y*T,1,T,AU);R(12*T+13,y*T,1,T,AU);}
 // gold sconces
 for(const x of [1,4]){const X=x*T+5,Y=20*T+4;R(X+2,Y+4,2,5,AU);R(X,Y+8,6,2,AU);R(X+1,Y,4,4,'#ffd890');R(X+2,Y-1,2,1,'#fff2c0');ctx.fillStyle='rgba(255,210,120,.18)';ctx.fillRect(X-4,Y-3,14,14);}
 // framed oil portrait
 {const X=2*T+4,Y=20*T-6;R(X,Y,22,18,AU);R(X+1,Y+1,20,16,'#8a6a2a');R(X+2,Y+2,18,14,'#2a1a2e');ctx.fillStyle='#c9a080';ctx.fillRect(X+8,Y+4,6,6);R(X+6,Y+10,10,6,'#1a1020');R(X+10,Y+11,2,3,'#e0d0b0');R(X+8,Y+3,6,2,'#3a2a20');}
 // vault door with gold dial
 {const X=5*T+2,Y=20*T-6;R(X,Y,28,19,'#4a4038');R(X+1,Y+1,26,17,'#6a5e52');R(X+2,Y+2,24,15,'#585048');for(const [rx,ry] of [[3,3],[23,3],[3,14],[23,14]])R(X+rx,Y+ry,2,2,AU);
  ctx.fillStyle=AU;ctx.beginPath();ctx.arc(X+14,Y+9,5,0,7);ctx.fill();ctx.fillStyle='#3a2a18';ctx.beginPath();ctx.arc(X+14,Y+9,2,0,7);ctx.fill();R(X+14,Y+4,1,2,'#f4dc90');R(X+21,Y+8,4,2,AU);}
 box(8*T-4,20*T+3,24,9,AU);tt('CHIEF',8*T-2,20*T+5,0);}
function rug(X,Y,w,h){const RED='#9e2a22',IND='#2e3a7a',GOLD='#d4a24c',CR='#f3e6c8',DK='#5a1610';
 ctx.fillStyle='rgba(20,8,2,.35)';ctx.fillRect(X+2,Y+2,w,h);
 for(let i=X+1;i<X+w-1;i+=2){R(i,Y-3,1,3,CR);R(i,Y+h,1,3,CR);} // fringes
 R(X,Y,w,h,DK);R(X+1,Y+1,w-2,h-2,GOLD);R(X+2,Y+2,w-4,h-4,IND);
 for(let i=X+3;i<X+w-4;i+=4){R(i,Y+3,2,2,GOLD);R(i+1,Y+h-5,2,2,GOLD);} for(let j=Y+3;j<Y+h-4;j+=4){R(X+3,j,2,2,RED);R(X+w-5,j+1,2,2,RED);}
 R(X+6,Y+6,w-12,h-12,GOLD);R(X+7,Y+7,w-14,h-14,RED);
 for(let j=Y+9;j<Y+h-9;j+=4)for(let i=X+9+((j/4|0)%2)*2;i<X+w-9;i+=4)R(i,j,1,1,DK);
 const cx=X+w/2|0,cy=Y+h/2|0;for(let k=0;k<6;k++){R(cx-k,cy-6+k,2*k+1,1,IND);R(cx-k,cy+6-k,2*k+1,1,IND);}R(cx-1,cy-1,3,3,GOLD);
 for(const [qx,qy] of [[X+9,Y+9],[X+w-12,Y+9],[X+9,Y+h-12],[X+w-12,Y+h-12]]){R(qx,qy,3,3,IND);R(qx+1,qy+1,1,1,CR);}}
function ctxSwap(g){ctx=g;}
function drawStatic(t){for(const f of furniture)drawF(f,t);}
function drawF(f,t){const X=f.x*T,Y=f.y*T,w=f.w*T,h=f.h*T;
 if(!/board$/.test(f.type))shade(X+1,Y+h-5,w-2,6);
 switch(f.type){
 case 'scoreboard':drawScoreboard(X,Y+SCR_DY,w,h,t);break;
 case 'top10board':drawTop10(X,Y+SCR_DY,w,h,t);break;
 case 'historyboard':drawHistory(X,Y+SCR_DY,w,h,t);break;
 case 'botdesk':{box(X,Y+2,w,h-4,WAL[2]);R(X+1,Y+3,w-2,3,'#9a6238');R(X+1,Y+h-9,w-2,1,C[2]);R(X+1,Y+h-8,w-2,5,WAL[1]);R(X+w/2-3,Y+h-6,6,1,C[2]);R(X+3,Y+h-3,1,3,C[2]);R(X+5,Y+h-3,1,3,C[2]);R(X+w-6,Y+h-3,1,3,C[2]);R(X+w-4,Y+h-3,1,3,C[2]);
  const L=f.label;deskDecor(L,X,Y,w,t);
  // nameplate standing on the desk front edge
  const pw=tw(L)+6;box(X+w/2-pw/2,Y+h-17,pw,9,3);tt(L,X+w/2-pw/2+3,Y+h-15);break;}
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
 case 'bigdesk':box(X,Y,w,h,'#4a2614');R(X+1,Y+1,w-2,1,AU);R(X+3,Y+3,w-6,8,'#5e1a1a');R(X+3,Y+3,w-6,1,'#7a2a26');R(X+3,Y+10,w-6,1,AU);R(X+1,Y+h-10,w-2,1,AU);R(X+1,Y+h-9,w-2,8,'#32180c');
  for(const dx of [6,w/2-4,w-14])R(X+dx,Y+h-6,8,2,AU);R(X+2,Y+h-2,2,2,AU);R(X+w-4,Y+h-2,2,2,AU);
  // phone (black bakelite, gold dial)
  box(X+5,Y+4,10,6,0);R(X+4,Y+3,12,2,'#2a1a10');R(X+9,Y+6,2,2,AU);
  // gold-framed brass terminal with three nixie screens
  box(X+w/2-20,Y-9,40,14,AU);R(X+w/2-19,Y-8,38,1,'#f0d890');for(let i=0;i<3;i++){const sx=X+w/2-17+i*12;R(sx,Y-6,10,8,'#140a05');tt(String(((t/1000|0)+i*7)%100).padStart(2,'0'),sx+2,Y-4,'#ff9a3c');}
  R(X+w/2-2,Y+5,4,2,AU);
  // papers
  R(X+w-17,Y+4,9,6,3);R(X+w-16,Y+5,7,1,1);R(X+w-16,Y+7,5,1,1);R(X+w-6,Y+4,2,6,AU);
  // nameplate
  {const pw=tw('CHIEF')+8;box(X+w/2-pw/2,Y+h-12,pw,9,AU);tt('CHIEF',X+w/2-pw/2+4,Y+h-10);}break;
 case 'chair2':box(X+2,Y+2,12,12,'#c8742e');R(X+4,Y+4,8,4,'#e09a52');R(X+3,Y+13,1,3,C[2]);R(X+12,Y+13,1,3,C[2]);break;
 case 'goldcabinet':{box(X,Y-14,w,30,'#3a1e0e');R(X+1,Y-13,w-2,1,AU);R(X+2,Y-12,w-4,22,'rgba(200,220,230,.18)');
  for(let r=0;r<3;r++){R(X+2,Y-4+r*7,w-4,1,AU);}for(let i=0;i<3;i++)for(let k=0;k<2-(i>1?1:0);k++){R(X+4+i*8,Y-7-k*2,6,2,'#d8b048');R(X+4+i*8,Y-7-k*2,6,1,'#f4dc90');}
  for(let i=0;i<3;i++){R(X+4+i*8,Y+0,6,3,'#c9b98a');R(X+6+i*8,Y+0,2,3,'#7a5a3a');}for(let i=0;i<2;i++){R(X+6+i*12,Y+6,8,3,'#d8b048');R(X+7+i*12,Y+5,6,1,'#f4dc90');}
  R(X+2,Y-12,1,22,'rgba(255,255,255,.35)');R(X+w/2,Y-12,1,22,'#3a1e0e');break;}
 case 'decanter':box(X,Y+3,16,13,'#3a1e0e');R(X+1,Y+4,14,1,AU);R(X+3,Y-3,4,8,'rgba(150,40,30,.85)');R(X+4,Y-6,2,3,'rgba(220,230,235,.6)');R(X+3,Y-3,4,1,'rgba(255,255,255,.5)');R(X+9,Y+1,3,4,'rgba(220,230,235,.5)');R(X+12,Y+1,3,4,'rgba(220,230,235,.5)');box(X+2,Y+9,12,5,'#5e3a20');R(X+6,Y+10,4,1,AU);break;
 case 'tickerclock':{R(X+7,Y+8,2,8,AU);box(X+3,Y+13,10,3,'#3a1e0e');ctx.fillStyle=AU;ctx.beginPath();ctx.arc(X+8,Y+5,7,0,7);ctx.fill();ctx.fillStyle='rgba(220,230,235,.35)';ctx.beginPath();ctx.arc(X+8,Y+5,5.5,0,7);ctx.fill();
  R(X+5,Y+1,6,4,'#140a05');tt(String(new Date().getSeconds()%10),X+7,Y+1,'#ff9a3c');const tp=(t/300|0)%2;R(X+4,Y+7+tp,8,1,C[3]);R(X+4,Y+9,8,1,C[3]);break;}
 case 'boiler':{const cx=X+w/2;box(X+4,Y-14,w-8,h+12,C[1]);R(X+5,Y-13,2,h+10,'#c87a4a');for(let j=Y-10;j<Y+h-4;j+=7){R(X+4,j,w-8,1,'#5a2a14');for(let i=X+6;i<X+w-6;i+=5)R(i,j+2,1,1,NEON.hi);}
  ctx.fillStyle=C[1];ctx.beginPath();ctx.arc(cx,Y-14,w/2-4,Math.PI,0);ctx.fill();gauge(cx-6,Y-4,5,0.5+0.45*Math.sin(t/600));gauge(cx+7,Y+6,4,0.5+0.4*Math.sin(t/430+2));
  gear(X+4,Y+h-6,6,8,t/400,C[2]);gear(X+w-4,Y+h-10,5,7,-t/330,'#c8742e');R(cx-1,Y-24,3,6,C[2]);R(cx-3,Y-25,7,2,NEON.mag);steam(cx,Y-26,t,.3);if(Math.sin(t/900)>0.3)steam(X+w-4,Y-6,t,.7);
  box(X+6,Y+h-2,w-12,6,'#2a1a10');tt('KOCIOL',cx-11,Y+h-1,C[2]);break;}
 case 'globe':R(X+7,Y+10,2,4,AU);box(X+4,Y+13,8,3,AU);ctx.fillStyle=AU;ctx.beginPath();ctx.arc(X+8,Y+6,7,0,7);ctx.fill();ctx.fillStyle=C[0];ctx.beginPath();ctx.arc(X+8,Y+6,6,0,7);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(X+8,Y+6,5,0,7);ctx.fill();R(X+5,Y+3,3,3,1);R(X+9,Y+7,3,2,1);break;
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
 case 'supercomputer':drawSuper(X,Y,w,h,t);break;
 case 'skull':drawSkull(X,Y,w,h,t);break;
 case 'arcadebox':box(X+1,Y-8,14,24,1);box(X+3,Y-6,10,8,0);R(X+4,Y-5,8,6,(t/300|0)%2?2:3);R(X+6,Y+5,2,2,0);R(X+10,Y+5,2,2,3);break;}}
// ---- steampunk mechanics ----
function gear(cx,cy,r,teeth,ang,col,hub){ctx.fillStyle=col||C[2];ctx.beginPath();const n=teeth*2;for(let k=0;k<=n*2;k++){const a=ang+k*Math.PI/n,rr=(k%4<2)?r:r*0.78;const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.fill();
 ctx.fillStyle=hub||C[1];ctx.beginPath();ctx.arc(cx,cy,r*0.45,0,7);ctx.fill();ctx.fillStyle='#2a1a10';ctx.beginPath();ctx.arc(cx,cy,Math.max(1,r*0.16),0,7);ctx.fill();}
function gauge(cx,cy,r,v){ctx.fillStyle=C[2];ctx.beginPath();ctx.arc(cx,cy,r+1,0,7);ctx.fill();ctx.fillStyle=C[3];ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();
 R(cx-r+1,cy,1,1,NEON.mag);ctx.strokeStyle='#2a1a10';ctx.lineWidth=1;const a=Math.PI*(0.8+1.4*v);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*(r-1),cy+Math.sin(a)*(r-1));ctx.stroke();R(cx,cy,1,1,0);}
function steam(x,y,t,seed){for(let k=0;k<3;k++){const ph=((t/1400+k/3+seed)%1);const a=1-ph;if(a<=0)continue;ctx.fillStyle='rgba(243,230,200,'+(a*0.65).toFixed(2)+')';const s=2+ph*5|0;ctx.fillRect(x+Math.sin(ph*6+seed*9)*3-s/2|0,y-ph*22|0,s,s);}}
// animated wall machinery overlay (side walls + wall between Open Space and the bottom rooms)
// ---- steam supercomputer (5x3 tiles) ----
let printerPile=0;socket.on('printer',d=>{if(d&&isFinite(d.pile))printerPile=Math.max(0,Math.min(8,d.pile|0));});
function reel(cx,cy,r,a){ctx.fillStyle='#2a1a10';ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.fillStyle='#c9c2b0';ctx.beginPath();ctx.arc(cx,cy,r-1,0,7);ctx.fill();ctx.fillStyle='#5a3a24';ctx.beginPath();ctx.arc(cx,cy,r*0.62,0,7);ctx.fill();
 ctx.strokeStyle='#2a1a10';ctx.lineWidth=1;for(let k=0;k<3;k++){const q=a+k*2.094;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(q)*(r-1),cy+Math.sin(q)*(r-1));ctx.stroke();}R(cx-1,cy-1,2,2,C[2]);}
const SCR_DY=9; // wall screens drawn 9px lower to make room for the two ticker strips
function drawSuper(X,Y,w,h,t){const top=Y-22,H=h+22;
 // pipes + boiler (right)
 box(X+w-16,top+6,14,H-10,C[1]);R(X+w-15,top+7,2,H-12,'#c87a4a');for(let j=top+10;j<Y+h-6;j+=6)R(X+w-16,j,14,1,'#5a2a14');gauge(X+w-9,top+16,4,0.5+0.4*Math.sin(t/520));
 R(X+w-13,top-2,3,9,C[2]);R(X+w-14,top-3,5,2,NEON.mag);steam(X+w-11,top-4,t,.2);R(X-2,top+20,4,3,C[1]);R(X-3,top+19,2,5,C[2]);if(((t/3100)%1)<0.5)steam(X-2,top+18,t,.8);
 // cabinet bank
 for(let i=0;i<3;i++){const cx=X+i*21,cw=20;box(cx,top,cw,H-8,'#4a2c18');R(cx+1,top+1,cw-2,1,C[2]);R(cx+1,top+H-10,cw-2,1,C[2]);
  // tape reels spinning (speed varies)
  const sp=t/(260+i*90)*((Math.sin(t/2000+i)>-.3)?1:0.2);box(cx+2,top+3,cw-4,15,'#2a1a10');reel(cx+6,top+10,5,sp);reel(cx+14,top+10,5,-sp*1.3);R(cx+6,top+15,8,1,'#5a3a24');
  // valve lights
  for(let k=0;k<4;k++){const on=((t/(170+k*53+i*31))|0)%3!=0;R(cx+3+k*4,top+21,3,4,'#2a1a10');R(cx+4+k*4,top+21,1,3,on?'#ffb050':'#5a2a10');}
  // nixie digits
  R(cx+2,top+27,cw-4,8,'#140a05');tt(String(((t/90|0)*(i+3))%1000).padStart(3,'0'),cx+4,top+28,NEON.amber);
  // vents
  for(let k=0;k<3;k++)R(cx+3,top+38+k*3,cw-6,1,'#2a1a10');}
 // gears on the front
 gear(X+20,top+H-12,6,8,t/500,C[2]);gear(X+41,top+H-12,6,8,-t/500,'#c8742e');
 // name plate
 box(X+4,top-9,58,9,C[2]);tt('SUPERKOMPUTER',X+7,top-7,0);
 // printer slot (front, centre) + paper pile
 const px=X+26,py=Y+h-14;box(px-4,py,22,8,C[1]);R(px-2,py+3,18,2,'#140a05');
 const feeding=((t/400)|0)%10<3&&printerPile<8;const feed=feeding?((t/60)|0)%6:0;R(px+1,py+4,12,2+feed,C[3]);for(let k=1;k<feed;k+=2)R(px+3,py+4+k,8,1,'#b5a888');
 for(let k=0;k<printerPile;k++){const oy=Y+h+4-k*2,ox=px+((k*7)%5)-2;R(ox,oy,16,2,k%2?'#efe2c4':C[3]);R(ox,oy+1,16,1,'#c9b98a');}
 if(printerPile>=6)tt('PELNE',px-1,Y+h-20,NEON.mag);}
// ---- oil (kerosene) lamps along the walls: flickering warm flames ----
const LAMPS=[[0,11],[0,17],[39,7],[39,15],[2,20],[13,20],[19,20],[26,20],[30,20],[37,20],[0,23],[39,23]];
function lamp(x,y,t,k,glow){const fl=0.75+0.25*Math.sin(t/83+k*1.7)+0.12*Math.sin(t/37+k);ctx.fillStyle='rgba(255,180,90,'+(0.10+0.10*glow)*fl+')';ctx.beginPath();ctx.arc(x,y-3,10+4*glow,0,7);ctx.fill();
 R(x-1,y+3,3,3,C[2]);R(x-2,y+5,5,1,C[1]);R(x-2,y-6,5,8,'rgba(230,240,245,.35)');R(x-2,y-7,5,1,C[2]);R(x-2,y+2,5,1,C[2]);const fh=3+(fl>0.95?1:0);R(x,y-fh,1,fh,'#ffb050');R(x,y-1,1,1,'#fff2c0');}
// ---- windows on the left wall showing the time of day in Poland (Europe/Warsaw) ----
function warsawHour(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const v=k=>+p.find(x=>x.type==k).value;return v('hour')+v('minute')/60+v('second')/3600;}
const mix=(a,b,f)=>a.map((v,i)=>Math.round(v+(b[i]-v)*f));const rgb=a=>'rgb('+a.join(',')+')';
const SKY=[[0,[12,14,40],[22,24,60]],[5,[12,14,40],[22,24,60]],[6.3,[60,50,110],[230,130,90]],[7.5,[110,170,220],[200,225,240]],[16.2,[110,170,220],[200,225,240]],[17.4,[90,70,130],[240,140,70]],[18.6,[12,14,40],[30,26,70]],[24,[12,14,40],[22,24,60]]];
function skyAt(h){for(let i=0;i<SKY.length-1;i++){const [a,ta,ba]=SKY[i],[b,tb,bb]=SKY[i+1];if(h>=a&&h<=b){const f=(h-a)/(b-a||1),s=f*f*(3-2*f);return [mix(ta,tb,s),mix(ba,bb,s)];}}return [SKY[0][1],SKY[0][2]];}
let dayCache={at:0};
function dayState(){const now=Date.now();if(now-dayCache.at<5000)return dayCache;const h=warsawHour();const [top,bot]=skyAt(h);
 const night=h<5.5||h>18.6?1:h<7.2?Math.max(0,(7.2-h)/1.7):h>16.8?Math.min(1,(h-16.8)/1.8):0;const warm=(h>5.5&&h<8)||(h>16.3&&h<18.8)?1-Math.abs(((h<12?6.8:17.5)-h))/1.3:0;
 return dayCache={at:now,h,top,bot,night,warm:Math.max(0,warm)};}
function drawWindows(t){const d=dayState();for(const wy of [9,14]){const X=2,Y=wy*T,ww=12,wh=30;R(X-1,Y-1,ww+2,wh+2,C[2]);
 const g=ctx.createLinearGradient(0,Y,0,Y+wh);g.addColorStop(0,rgb(d.top));g.addColorStop(1,rgb(d.bot));ctx.fillStyle=g;ctx.fillRect(X,Y,ww,wh);
 if(d.night>0.3){ctx.fillStyle='rgba(255,255,240,'+(d.night*0.9).toFixed(2)+')';for(let k=0;k<6;k++){const sx=X+1+((k*37+wy*13)%10),sy=Y+1+((k*53+wy*7)%22);if(((t/(600+k*170))|0)%5)ctx.fillRect(sx,sy,1,1);}
  if(wy==9){ctx.fillStyle='rgba(245,240,215,'+d.night.toFixed(2)+')';ctx.beginPath();ctx.arc(X+8,Y+7,3,0,7);ctx.fill();ctx.fillStyle=rgb(d.top);ctx.beginPath();ctx.arc(X+9.5,Y+6,2.6,0,7);ctx.fill();}}
 else if(wy==9){const sunY=Y+4+Math.abs(d.h-12)*1.6;ctx.fillStyle=d.warm>0.2?'#ffb060':'#fff0b0';ctx.beginPath();ctx.arc(X+6,Math.min(Y+wh-3,sunY),3,0,7);ctx.fill();}
 if(d.night<0.5){ctx.fillStyle='rgba(255,255,255,.55)';const cx=X+((t/400+wy*5)%(ww+8))-6;ctx.fillRect(cx|0,Y+16,6,2);ctx.fillRect((cx+1)|0,Y+15,3,1);}
 R(X+ww/2-1|0,Y,1,wh,C[2]);R(X,Y+wh/2|0,ww,1,C[2]);R(X,Y,ww,1,'rgba(255,255,255,.3)');R(X-2,Y+wh+1,ww+4,2,'#5e3a20');}}
function drawDaylight(){const d=dayState();if(d.night>0){ctx.fillStyle='rgba(20,22,60,'+(0.22*d.night).toFixed(3)+')';ctx.fillRect(0,0,W*T,MAPH);}if(d.warm>0){ctx.fillStyle='rgba(255,140,60,'+(0.07*d.warm).toFixed(3)+')';ctx.fillRect(0,0,W*T,MAPH);}}
function drawWallFx(t){const a=t/900;
 for(let y=8;y<20;y+=4){gear(8,y*T+8,6,8,a*(y%8?1:-1),C[2]);gear(W*T-8,y*T+8,6,8,-a*(y%8?1:-1),C[2]);}
 for(const [x,s] of [[3,0],[17,.3],[24,.6],[31,.15],[36,.8]]){const X=x*T,Y=20*T;R(X,Y+4,T,3,C[1]);R(X,Y+4,T,1,'#c87a4a');R(X+6,Y,4,4,C[2]);R(X+7,Y-1,2,1,NEON.mag);if(((t/2600+s)%1)<0.55)steam(X+8,Y-2,t,s);}
 for(const [x,s] of [[9,0],[22,.5],[27,.2],[34,.7]])gauge(x*T+8,20*T+7,5,0.5+0.45*Math.sin(t/(700+s*400)+s*7));}
function deskDecor(L,X,Y,w,t){const own=players['bot-'+L];if(own&&own.act=='typing'){R(X+2,Y-12,w-4,1,(t/90|0)%3?0:1);R(X+5,Y+6,((t/70|0)%10)+2,1,0);}
 ctx.save();ctx.translate(0,6);deskDecor2(L,X,Y,w,t);ctx.restore();} // equipment sits on the desk's back edge
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
// ---- Skull of Satoshi (Benjamin Von Wong, 2023): e-waste/circuit-board skull with red laser eyes, on a plinth ----
const SKULL=["....aaaaaaaa....","..aabcbbbbcbaa..",".abbbcbbbbbbcba.","abbcbbbbbbcbbbba","abcbbbbbbbbbbcba","abbeeeebbeeeebba","abbeee*bbe*eebba","abbeeeebbeeeebba",".abbbbbaabbbbba.","..abbbbeebbbbba.","..aabbbbbbbbaa..","...abdbdbdbdba..","...adbdbdbdbda..","....aaaaaaaaa..."];
// Reference (Greenpeace/Von Wong 2023): e-waste circuit-board skull, smokestacks rising from the cranium, red laser eyes with bitcoin logos, cables spilling from the neck.
function drawSkull(X,Y,w,h,t){const S=0.7;ctx.save();ctx.translate(X+7,Y+h);ctx.scale(S,S);ctx.translate(-X,-(Y+h));drawSkull0(X,Y,w,h,t);ctx.restore();
 box(X,Y+h+1,66,9,AU);tt('SKULL OF SATOSHI',X+2,Y+h+3,0);} // plaque unscaled for readability
function drawSkull0(X,Y,w,h,t){const px=3,sx=X+w/2-24,sy=Y-30;
 // plinth (walnut + gold) and plaque
 box(X+2,Y+12,w-4,h-12,'#3a1e0e');R(X+3,Y+13,w-6,1,AU);R(X+3,Y+h-4,w-6,1,AU);
 
 // black cable tentacles spilling from the neck over the plinth (gently swaying)
 ctx.strokeStyle='#0c0806';ctx.lineWidth=2;for(let k=0;k<6;k++){const x0=sx+18+k*2.5,y0=sy+40,dir=k<3?-1:1,sp=Math.sin(t/700+k)*2;
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.bezierCurveTo(x0+dir*(6+k*2),y0+6+sp,x0+dir*(10+k*3),y0+10-sp,x0+dir*(8+k*4)+sp,Y+h-2);ctx.stroke();}
 ctx.lineWidth=1;ctx.strokeStyle='#3a3a44';for(let k=0;k<6;k+=2){const x0=sx+18+k*2.5,dir=k<3?-1:1;ctx.beginPath();ctx.moveTo(x0,sy+41);ctx.lineTo(x0+dir*(6+k*2),sy+47);ctx.stroke();}
 // smokestacks on the cranium + animated smoke
 for(const [ox,hh,s] of [[9,16,0],[21,22,.35],[33,13,.7]]){const cx=sx+ox;R(cx-1,sy+4-hh,8,hh,'#1a1210');R(cx,sy+4-hh,6,hh,'#8a7a70');R(cx-1,sy+4-hh,8,2,'#3a2a24');R(cx+1,sy+6-hh,1,hh-4,'#b0a498');R(cx,sy+2-hh+hh/2|0,6,1,'#8a2a20');
  for(let k=0;k<4;k++){const ph=(t/1800+k/4+s)%1;const sz=3+ph*8|0;ctx.fillStyle='rgba(205,198,190,'+(0.8*(1-ph)).toFixed(2)+')';ctx.fillRect(cx+3+Math.sin(ph*5+s*9)*4-sz/2|0,sy+2-hh-ph*26|0,sz,sz);}}
 const pal={a:'#1a1210',b:'#2f5a6e',c:'#c8742e',d:'#c9c2b0',e:'#0a0605'};// eyes: slow smooth cycle (~4.5 s): glow up, fade to dark, repeat
 const fl=Math.pow(0.5-0.5*Math.cos(t/4500*2*Math.PI),1.5);
 SKULL.forEach((row,j)=>{for(let i=0;i<16;i++){const ch=row[i];if(ch=='.')continue;let c=pal[ch];if(ch=='*')c='rgb('+(40+215*fl|0)+','+(10+30*fl|0)+','+(8+22*fl|0)+')';ctx.fillStyle=c;ctx.fillRect(sx+i*px,sy+j*px,px,px);
  if(ch=='b'){const r=(i*7+j*3)%6;if(r==0){ctx.fillStyle='#d4a24c';ctx.fillRect(sx+i*px,sy+j*px,1,1);}else if(r==3){ctx.fillStyle='#1a1a22';ctx.fillRect(sx+i*px+1,sy+j*px+1,2,1);}else if(r==4){ctx.fillStyle='#4f8aa0';ctx.fillRect(sx+i*px,sy+j*px+2,3,1);}}}});
 // red laser eyes (bitcoin glint) + glow + beams
 for(const ex of [sx+5*px,sx+10*px]){ctx.fillStyle='rgba(255,40,30,'+(0.25*fl).toFixed(2)+')';ctx.fillRect(ex-5,sy+5*px-3,13,11);R(ex+1,sy+5*px+1,1,4,'rgba(255,220,200,'+fl.toFixed(2)+')');R(ex,sy+5*px+2,3,1,'rgba(255,220,200,'+fl.toFixed(2)+')');}
 if(fl>0.85){ctx.fillStyle='rgba(255,60,40,.35)';ctx.fillRect(sx+5*px+1,sy+7*px,1,14);ctx.fillRect(sx+10*px+1,sy+7*px,1,14);}}
// ---- positions board ----
function fmtP(v){v=+v;return v>=1000?v.toFixed(0):v>=1?v.toFixed(2):v.toPrecision(3);}
function pnl(p){const b=p.desk?p.pnlBase:p.entry;if(!b)return NaN;const c=p.price??b;return (c-b)/b*100*(p.side=='LONG'?1:-1);}
const pctS=v=>isFinite(v)?(v>=0?'+':'')+v.toFixed(2):'-';
const rivets=(X,Y,w,h)=>{for(let i=X;i<X+w;i+=12){R(i,Y-1,2,2,NEON.hi);R(i,Y+h-1,2,2,NEON.hi);}};
function frame(X,Y,w,h){const t=performance.now();box(X-3,Y-3,w+6,h+6,C[2]);R(X-2,Y-2,w+4,1,NEON.hi);box(X,Y,w,h,0);R(X+1,Y+1,w-2,h-2,'#2a1a10');R(X+2,Y+2,w-4,h-4,'#140a05');rivets(X-1,Y-2,w+2,h+4);
 for(let j=Y+6;j<Y+h-4;j+=8){R(X-3,j,1,1,NEON.hi);R(X+w+2,j,1,1,NEON.hi);}
 gear(X-2,Y+h+2,5,7,t/600,C[2]);gear(X+w+2,Y+h+2,5,7,-t/600,'#c8742e');R(X+8,Y+h+3,w-16,2,C[1]);R(X+8,Y+h+3,w-16,1,'#c87a4a');gauge(X+w-12,Y+h+3,3,0.5+0.4*Math.sin(t/700+X));}
// nixie/valve display helpers
const NX=NEON.amber,NXD='#7a3a12';
function valves(X,Y,w,t){Y+=86;for(let i=X+10;i<X+w-8;i+=28){R(i,Y-6,6,5,C[1]);R(i+1,Y-6,4,4,(t/700+i)%3<2?'#ffb050':'#c8742e');R(i+2,Y-5,1,2,'#fff2c0');}}
// ---- top-wall ticker (marquee): news <-> top 10 crypto ----
let ticker=null;socket.on('ticker',d=>{if(d&&typeof d=='object')ticker=d;});
const ascii=s=>String(s).replace(/ł/g,'l').replace(/Ł/g,'L').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[‘’`]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^A-Za-z0-9 .,:;%+\-\/!?$()#"'@_*]/g,' ').replace(/'/g,'').replace(/;/g,',').replace(/\s+/g,' ').trim();
// two separate strip monitors: WIADOMOSCI SWIAT (top) and TOP 10 KRYPTO (below), each scrolling on its own with its own 'brak danych'
function newsSegs(){const n=ticker&&ticker.news,s=[];if(n&&n.items&&n.items.length)n.items.slice(0,10).forEach(i=>{s.push([ascii(i.title),C[3]]);s.push([' ('+ascii(i.source)+')   *   ',C[1]]);});else s.push(['BRAK DANYCH (WORLDMONITOR)        ',NEON.mag]);return s;}
function cryptoSegs(){const c=ticker&&ticker.crypto,s=[];if(c&&c.items&&c.items.length)c.items.forEach(i=>{const up=(i.change24h||0)>=0;s.push([i.symbol+' '+fmtUsd(i.price)+' ',NEON.amber]);s.push([(i.change24h==null?'-':(up?'+':'-')+Math.abs(i.change24h).toFixed(2)+'%')+'   *   ',up?NEON.cyan:NEON.mag]);});else s.push(['BRAK DANYCH (COINGECKO)        ',NEON.mag]);return s;}
function drawStrip(Y,label,segs,speed,t,dir){const X=18,w=W*T-36,h=10;R(X-2,Y-1,w+4,h+2,C[2]);R(X-1,Y,w+2,1,NEON.hi);R(X,Y+1,w,h-2,'#140a05');for(let i=X;i<X+w;i+=24){R(i,Y-1,1,1,'#7a5a20');R(i,Y+h,1,1,NEON.hi);}
 gear(X-4,Y+5,5,7,dir*t/500,C[2]);gear(X+w+4,Y+5,5,7,-dir*t/500,'#c8742e');const lw=tw(label)+6;R(X,Y+1,lw,h-2,C[2]);tt(label,X+3,Y+2,0);R(X+lw,Y+1,1,h-2,C[1]);
 const x0=X+lw+2,ww=w-lw-2,tot=segs.reduce((a,[s])=>a+tw(s)+1,0)||1;let off=x0-((t/1000*speed)%tot);ctx.save();ctx.beginPath();ctx.rect(x0,Y+1,ww,h-2);ctx.clip();
 for(let pass=0;pass<Math.ceil(ww/tot)+1;pass++){let x=off+pass*tot;for(const [s,c] of segs){const sw=tw(s)+1;if(x+sw>x0&&x<x0+ww)tt(s,x|0,Y+2,c);x+=sw;}}ctx.restore();}
function drawTicker(t){drawStrip(1,'WIADOMOSCI SWIAT',newsSegs(),26,t,1);drawStrip(12,'TOP 10 KRYPTO',cryptoSegs(),20,t,-1);}
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
 bubbleQ.push([p,Math.round(p.rx),y-(p.bot?17:11)]);if(!bubbles[p.id]&&marks[p.id]>Date.now()){const bx=Math.round(p.rx)+6,by=y-(p.bot?28:22);box(bx,by,9,10,3);R(bx+4,by+2,1,4,0);R(bx+4,by+7,1,1,0);}}
function drawDialog(t){const Y=MAPH,h=cv.height-MAPH;R(0,Y,cv.width,h,0);box(4,Y+4,cv.width-8,h-8,WAL[2]);R(7,Y+7,cv.width-14,h-14,C[2]);R(8,Y+8,cv.width-16,h-16,'#2a1a10');R(8,Y+8,cv.width-16,1,WAL[2]);
 ctx.font='8px "Press Start 2P"';ctx.fillStyle=C[3];
 if(!dcur||(dcur.done&&t-dcur.done>2500&&dq.length)||(dcur.done&&t-dcur.done>6000)){dcur=dq.shift()||null;if(dcur)dcur.start=t;}
 if(!dcur){const p=players[me];ctx.fillText(p?'Strefa: '+ZN[zoneAt(p.x,p.y)]+'. Podejdź do kogoś i pogadaj!':'Witaj w Krypto Biurze!',16,Y+24);return;}
 const full=dcur.who+': '+dcur.text;const n=Math.min(full.length,Math.floor((t-dcur.start)/30));if(n>=full.length&&!dcur.done)dcur.done=t;
 const s=full.slice(0,n);const per=74;ctx.fillText(s.slice(0,per),16,Y+24);if(s.length>per)ctx.fillText(s.slice(per,per*2),16,Y+40);
 if(dcur.done&&(t/400|0)%2){ctx.fillStyle=NEON.amber;ctx.beginPath();ctx.moveTo(cv.width-24,Y+38);ctx.lineTo(cv.width-16,Y+38);ctx.lineTo(cv.width-20,Y+43);ctx.fill();}}
let mouse=null,statusTags=[],bubbleQ=[];
cv.addEventListener('mousemove',e=>{const r=cv.getBoundingClientRect();mouse={x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};});cv.addEventListener('mouseleave',()=>mouse=null);
let last=performance.now();
function loop(t){const dt=Math.min(.05,(t-last)/1000);last=t;update(dt);
 if(!mapCache&&document.fonts)buildMap();ctx.drawImage(mapCache,0,0);
 // draw furniture and players depth-sorted by bottom edge
 const items=furniture.map(f=>({y:(f.y+f.h)*T,f})).concat(Object.values(players).map(p=>({y:p.ry+4,p})));items.sort((a,b)=>a.y-b.y);
 for(const it of items){if(it.f)drawF(it.f,t);else drawPlayer(it.p,t);}
 for(const [st,sx,sy] of statusTags)tag(st,Math.max(tw(st)/2+4,Math.min(cv.width-tw(st)/2-4,sx)),Math.min(sy,MAPH-10),true);statusTags=[];
 drawWallFx(t);drawWindows(t);drawDaylight();{const gl=dayState().night;LAMPS.forEach(([x,y],k)=>lamp(x*T+8,y*T+8,t,k,gl));}
 for(const [bp,bx,by] of bubbleQ)drawBubble(bp,bx,by);bubbleQ=[];
 drawTicker(t);drawDialog(t);
 const p=players[me];if(p){const z=zoneAt(p.x,p.y);document.getElementById('zone').textContent='Strefa: '+ZN[z];if(z!=lastZone){if(z=='board')panel.classList.add('show');else if(lastZone=='board')panel.classList.remove('show');if(z=='top10')t10.classList.add('show');else if(lastZone=='top10')t10.classList.remove('show');lastZone=z;}}
 requestAnimationFrame(loop);}
requestAnimationFrame(loop);
