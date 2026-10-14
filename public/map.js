// Shared map definition (used by server and client)
(function(root){
const T=24, W=40, H=25;
const ZONES=[
 {id:'trading',name:'Parkiet Tradingowy',x:1,y:1,w:18,h:11,color:'#ff2bd6'},
 {id:'meeting',name:'Sala Spotkań',x:21,y:1,w:18,h:11,color:'#00f0ff'},
 {id:'lounge',name:'Chillout / Lounge',x:1,y:13,w:18,h:11,color:'#39ff14'},
 {id:'moon',name:'Dach "Moon" 🚀',x:21,y:13,w:18,h:11,color:'#ffe600'},
];
// solid grid: walls around zones with door gaps, plus furniture
const solid=[];for(let y=0;y<H;y++){solid.push(new Array(W).fill(0));}
for(let x=0;x<W;x++){solid[0][x]=1;solid[H-1][x]=1;}
for(let y=0;y<H;y++){solid[y][0]=1;solid[y][W-1]=1;}
for(let y=0;y<H;y++){ if(![5,6,18,19].includes(y)) solid[y][20]=1; }
for(let x=0;x<W;x++){ if(![9,10,30,31].includes(x)) solid[12][x]=1; }
const furniture=[];
function add(type,x,y,w=1,h=1){furniture.push({type,x,y,w,h});for(let j=0;j<h;j++)for(let i=0;i<w;i++)solid[y+j][x+i]=1;}
for(let i=0;i<5;i++) add('arcade',2+i*3,2);           // arcade cabinets
add('ticker',3,6,12,1);                                 // price board desk
for(let i=0;i<4;i++) add('desk',3+i*4,9,2,1);
add('table',25,4,10,3);                                 // meeting table
add('screen',26,1,8,1);
add('sofa',3,15,6,1); add('sofa',3,21,6,1); add('plant',16,14); add('plant',16,22); add('jukebox',12,15,2,1);
add('rocket',33,15,2,3); add('telescope',24,16); add('plant',37,22); add('plant',22,22);
function zoneAt(px,py){const tx=px/T,ty=py/T;for(const z of ZONES)if(tx>=z.x&&tx<z.x+z.w&&ty>=z.y&&ty<z.y+z.h)return z.id;return 'korytarz';}
function blocked(px,py){const r=8;for(const [dx,dy] of [[-r,-r],[r,-r],[-r,r],[r,r]]){const tx=Math.floor((px+dx)/T),ty=Math.floor((py+dy)/T);if(tx<0||ty<0||tx>=W||ty>=H||solid[ty][tx])return true;}return false;}
const api={T,W,H,ZONES,solid,furniture,zoneAt,blocked,SPAWN:{x:10*T,y:12.5*T}};
if(typeof module!=='undefined')module.exports=api;else root.MAP=api;
})(this);
