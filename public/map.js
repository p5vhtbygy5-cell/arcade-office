// Shared map definition (server + client). 16x16 tiles, Game Boy style interior.
(function(root){
const T=16, W=40, H=28;
// order matters: first match wins (board area overlays open space)
const ZONES=[
 {id:'top10',name:'Top 10 Krypto',x:22,y:25,w:13,h:2},
 {id:'board',name:'Tablica Pozycji',x:6,y:2,w:16,h:6},
 {id:'open',name:'Open Space',x:1,y:2,w:27,h:18},
 {id:'chief',name:'Gabinet CHIEF',x:29,y:2,w:10,h:11},
 {id:'bathroom',name:'Łazienka',x:29,y:14,w:10,h:6},
 {id:'social',name:'Social',x:1,y:21,w:38,h:6},
];
const FLOOR={open:'wood',board:'wood',chief:'carpet',bathroom:'tile',social:'mat',top10:'mat'};
const solid=[];for(let y=0;y<H;y++)solid.push(new Array(W).fill(0));
const wallFace=[];for(let y=0;y<H;y++)wallFace.push(new Array(W).fill(0)); // walls drawn as Pokémon-like wall faces
function wall(x,y,face){solid[y][x]=1;if(face)wallFace[y][x]=1;}
for(let x=0;x<W;x++){wall(x,0,1);wall(x,1,1);wall(x,H-1);}
for(let y=0;y<H;y++){wall(0,y);wall(W-1,y);}
for(let y=2;y<20;y++) if(y!==8&&y!==17) wall(28,y);            // open space | chief/bathroom, doors y=8 (chief), y=17 (bathroom)
for(let x=29;x<W-1;x++) wall(x,13,1);                            // chief | bathroom (wall face for mirror)
for(let x=1;x<W-1;x++) if(![6,7,20,21].includes(x)) wall(x,20,1); // upper | social, doors
const furniture=[];
function add(type,x,y,w=1,h=1,extra={}){furniture.push({type,x,y,w,h,...extra});for(let j=0;j<h;j++)for(let i=0;i<w;i++)solid[y+j][x+i]=1;}
// --- Tablica Pozycji: big wall board in open space ---
add('scoreboard',7,1,14,4);
// --- bot desks in open space: desk 3x2 + role equipment tile to the right ---
const ROLE_ITEM={SIZE:'scales',SCAN:'radar',BOOK:'cabinet',RISK:'alarm',VET:'stampdesk',FILLS:'printer'};
const BOT_DESKS=[];
['SIZE','SCAN','BOOK','RISK','VET','FILLS'].forEach((n,i)=>{const x=2+(i%3)*8,y=i<3?10:16;
 add('botdesk',x,y,3,2,{label:n});add(ROLE_ITEM[n],x+3,y,1,1,{label:n});BOT_DESKS.push({name:n,x:(x+1.5)*T,y:(y-0.5)*T});});
add('plant',1,2);add('plant',27,2);add('plant',1,19);add('plant',27,19);add('watercooler',24,2);add('copier',3,2,2,1);
// --- Gabinet CHIEF ---
add('bookshelf',29,2,3,1);add('bookshelf',32,2,2,1);add('bigdesk',31,6,5,2,{label:'CHIEF'});add('plant',38,2);add('chair2',37,9);add('globe',29,11);
BOT_DESKS.unshift({name:'CHIEF',x:33.5*T,y:5.5*T});
// --- Łazienka ---
add('stall',35,14,4,3);add('sink',30,14);add('sink',32,14);add('towel',38,19);
// --- Social ---
add('sofa',2,22,4,1);add('sofa',2,25,4,1);add('table',3,23,2,2);add('tv',10,21,3,1);add('console',11,22);
add('sofa',9,25,5,1);add('top10board',23,21,11,4);add('coffee',35,21);add('fridge',36,21,1,2);add('plant',38,21);add('plant',22,21);
add('arcadebox',17,21);add('bigplant',37,25);
function zoneAt(px,py){const tx=px/T,ty=py/T;for(const z of ZONES)if(tx>=z.x&&tx<z.x+z.w&&ty>=z.y&&ty<z.y+z.h)return z.id;return 'korytarz';}
function blocked(px,py){const r=5;for(const [dx,dy] of [[-r,-r+3],[r,-r+3],[-r,r],[r,r]]){const tx=Math.floor((px+dx)/T),ty=Math.floor((py+dy)/T);if(tx<0||ty<0||tx>=W||ty>=H||solid[ty][tx])return true;}return false;}
const api={BOT_DESKS,T,W,H,ZONES,FLOOR,solid,wallFace,furniture,zoneAt,blocked,SPAWN:{x:14*T+8,y:13*T+8}};
if(typeof module!=='undefined')module.exports=api;else root.MAP=api;
})(this);
