// Shared map definition (used by server and client)
(function(root){
const T=24, W=40, H=37;
const ZONES=[
 {id:'trading',name:'Parkiet Tradingowy',x:1,y:1,w:18,h:11,color:'#ff2bd6'},
 {id:'meeting',name:'Sala Spotkań',x:21,y:1,w:18,h:11,color:'#00f0ff'},
 {id:'lounge',name:'Chillout / Lounge',x:1,y:13,w:18,h:11,color:'#39ff14'},
 {id:'board',name:'Tablica Pozycji',x:21,y:13,w:18,h:11,color:'#ffe600'},
 {id:'chief',name:'Gabinet CHIEF',x:1,y:27,w:12,h:9,color:'#ff3b3b'},
 {id:'bots',name:'Workspace Botów',x:14,y:27,w:25,h:9,color:'#b026ff'},
];
// solid grid: walls around zones with door gaps, plus furniture
const solid=[];for(let y=0;y<H;y++){solid.push(new Array(W).fill(0));}
for(let x=0;x<W;x++){solid[0][x]=1;solid[H-1][x]=1;}
for(let y=0;y<H;y++){solid[y][0]=1;solid[y][W-1]=1;}
for(let y=0;y<25;y++){ if(![5,6,18,19].includes(y)) solid[y][20]=1; }
for(let x=0;x<W;x++){ if(![9,10,30,31].includes(x)) solid[12][x]=1; }
// new lower wing: row 24 wall (doors to corridor), row 25 corridor, row 26 wall (office doors)
for(let x=0;x<W;x++){ if(![9,10,30,31].includes(x)) solid[24][x]=1; if(![6,7,25,26].includes(x)) solid[26][x]=1; }
for(let y=26;y<H;y++) solid[y][13]=1;
const furniture=[];
function add(type,x,y,w=1,h=1){furniture.push({type,x,y,w,h});for(let j=0;j<h;j++)for(let i=0;i<w;i++)solid[y+j][x+i]=1;}
for(let i=0;i<5;i++) add('arcade',2+i*3,2);           // arcade cabinets
add('ticker',3,6,12,1);                                 // price board desk
for(let i=0;i<4;i++) add('desk',3+i*4,9,2,1);
add('table',25,4,10,3);                                 // meeting table
add('screen',26,1,8,1);
add('sofa',3,15,6,1); add('sofa',3,21,6,1); add('plant',16,14); add('plant',16,22); add('jukebox',12,15,2,1);
add('bigdesk',4,31,6,2); add('plant',2,28); add('plant',11,28); add('safe',11,34);
const BOT_DESKS=[];['SIZE','SCAN','BOOK','RISK','VET','FILLS'].forEach((n,i)=>{const x=16+(i%3)*8,y=29+Math.floor(i/3)*4;add('botdesk',x,y,3,1);furniture[furniture.length-1].label=n;BOT_DESKS.push({name:n,x:(x+1.5)*T,y:(y-0.4)*T});});
BOT_DESKS.unshift({name:'CHIEF',x:7*T,y:30.4*T});
add('scoreboard',22,14,16,5); add('bench',24,20,4,1); add('bench',32,20,4,1); add('plant',37,22); add('plant',22,22);
function zoneAt(px,py){const tx=px/T,ty=py/T;for(const z of ZONES)if(tx>=z.x&&tx<z.x+z.w&&ty>=z.y&&ty<z.y+z.h)return z.id;return 'korytarz';}
function blocked(px,py){const r=8;for(const [dx,dy] of [[-r,-r],[r,-r],[-r,r],[r,r]]){const tx=Math.floor((px+dx)/T),ty=Math.floor((py+dy)/T);if(tx<0||ty<0||tx>=W||ty>=H||solid[ty][tx])return true;}return false;}
const api={BOT_DESKS,T,W,H,ZONES,solid,furniture,zoneAt,blocked,SPAWN:{x:10*T,y:12.5*T}};
if(typeof module!=='undefined')module.exports=api;else root.MAP=api;
})(this);
