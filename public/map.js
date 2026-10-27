// Shared map definition (server + client). 16x16 logical tiles; compact office (desks close together, boards live outside the office view).
(function(root){
const T=16, W=38, H=18;
// order matters: first match wins (the strips in front of the wall screens overlay Open Space)
const ZONES=[
 {id:'top10',name:'Skaner (Top Desk)',x:1,y:2,w:11,h:1},
 {id:'board',name:'Tablica Pozycji',x:12,y:2,w:12,h:1},
 {id:'open',name:'Open Space',x:1,y:2,w:36,h:9},
 {id:'chief',name:'Gabinet CHIEF',x:1,y:12,w:10,h:5},
 {id:'bathroom',name:'Łazienka',x:29,y:12,w:8,h:5},
 {id:'social',name:'Socjal',x:12,y:12,w:16,h:5},
];
const FLOOR={open:'deck',board:'deck',top10:'deck',chief:'carpet',bathroom:'tile',social:'mat'};
const solid=[];for(let y=0;y<H;y++)solid.push(new Array(W).fill(0));
const wallFace=[];for(let y=0;y<H;y++)wallFace.push(new Array(W).fill(0));
function wall(x,y,face){solid[y][x]=1;if(face)wallFace[y][x]=1;}
for(let x=0;x<W;x++){wall(x,0,1);wall(x,1,1);wall(x,H-1);}
for(let y=0;y<H;y++){wall(0,y);wall(W-1,y);}
// Open Space (top) | bottom strip: Gabinet CHIEF (left) · Socjal (middle) · Łazienka (right)
const DOORS=[[9,11],[17,11],[18,11],[32,11]]; // CHIEF, Socjal x2, WC
for(let x=1;x<W-1;x++) if(!DOORS.some(([dx])=>dx==x)) wall(x,11,1);
for(let y=12;y<H-1;y++){wall(11,y);wall(28,y);}
const furniture=[];
function add(type,x,y,w=1,h=1,extra={}){furniture.push({type,x,y,w,h,...extra});for(let j=0;j<h;j++)for(let i=0;i<w;i++)solid[y+j][x+i]=1;}
// --- top wall: mini screens mirroring the big boards + a window onto Warsaw ---
add('wallscreen',1,0,11,2,{label:'SKANER',screen:'scan'});add('wallscreen',12,0,12,2,{label:'POZYCJE',screen:'pos'});add('wallscreen',24,0,7,2,{label:'PORTFEL',screen:'port'});add('window',31,0,6,2);
// --- bot desks in a tight 3x2 cluster: desk 3x2 + role equipment tile to the right ---
const ROLE_ITEM={SIZE:'scales',SCAN:'radar',BOOK:'cabinet',RISK:'alarm',VET:'stampdesk',FILLS:'printer'};
const BOT_DESKS=[];
['SIZE','SCAN','BOOK','RISK','VET','FILLS'].forEach((n,i)=>{const x=5+(i%3)*6,y=i<3?5:8;
 add('botdesk',x,y,3,2,{label:n});add(ROLE_ITEM[n],x+3,y,1,1,{label:n});BOT_DESKS.push({name:n,x:(x+1.5)*T,y:(y-0.5)*T});});
add('watercooler',1,4);add('copier',1,8,2,1);add('plant',1,10);add('plant',21,10);add('plant',31,10);
add('holotable',25,6,3,2);add('supercomputer',32,4,5,3);add('boiler',35,9,2,2); // supercomputer printer faces tile 34,7
// --- Gabinet CHIEF (bottom-left) ---
add('goldcabinet',1,12,2,1);add('bigdesk',3,13,5,2,{label:'CHIEF'});add('decanter',10,12);add('tickerclock',10,14);add('globe',10,16);add('chair2',8,16);add('plant',1,14);
add('skull',1,15,2,2); // Skull of Satoshi – centrepiece of the CHIEF office
BOT_DESKS.unshift({name:'CHIEF',x:5.5*T,y:12.5*T});
// --- Socjal (bottom-middle) ---
add('fridge',12,12,1,2);add('coffee',14,12);add('tv',20,12,3,1);add('console',21,13);add('sofa',19,15,5,1);add('arcadebox',25,12);add('table',25,15,2,1);
add('plant',27,12);add('bigplant',27,16);add('plant',12,16);
// --- Łazienka (bottom-right) ---
add('stall',33,12,4,3);add('sink',29,12);add('sink',31,12);add('towel',29,16);
function zoneAt(px,py){const tx=px/T,ty=py/T;for(const z of ZONES)if(tx>=z.x&&tx<z.x+z.w&&ty>=z.y&&ty<z.y+z.h)return z.id;return 'korytarz';}
function blocked(px,py){const r=5;for(const [dx,dy] of [[-r,-r+3],[r,-r+3],[-r,r],[r,r]]){const tx=Math.floor((px+dx)/T),ty=Math.floor((py+dy)/T);if(tx<0||ty<0||tx>=W||ty>=H||solid[ty][tx])return true;}return false;}
const api={BOT_DESKS,DOORS,T,W,H,ZONES,FLOOR,solid,wallFace,furniture,zoneAt,blocked,SPAWN:{x:23*T+8,y:9*T+8}};
if(typeof module!=='undefined')module.exports=api;else root.MAP=api;
})(this);
