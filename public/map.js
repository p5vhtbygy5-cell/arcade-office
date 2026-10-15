// Shared map definition (server + client). 16x16 tiles, Game Boy style interior.
(function(root){
const T=16, W=40, H=28;
// order matters: first match wins (board area overlays open space)
const ZONES=[
 {id:'top10',name:'Top 10 Krypto',x:1,y:2,w:13,h:6},
 {id:'board',name:'Tablica Pozycji',x:14,y:2,w:12,h:6},
 {id:'open',name:'Open Space',x:1,y:2,w:38,h:18},
 {id:'chief',name:'Gabinet CHIEF',x:1,y:21,w:11,h:6},
 {id:'bathroom',name:'Łazienka',x:29,y:21,w:10,h:6},
 {id:'social',name:'Socjal',x:13,y:21,w:15,h:6},
];
const FLOOR={open:'wood',board:'wood',chief:'carpet',bathroom:'tile',social:'mat',top10:'wood'};
const solid=[];for(let y=0;y<H;y++)solid.push(new Array(W).fill(0));
const wallFace=[];for(let y=0;y<H;y++)wallFace.push(new Array(W).fill(0)); // walls drawn as Pokémon-like wall faces
function wall(x,y,face){solid[y][x]=1;if(face)wallFace[y][x]=1;}
for(let x=0;x<W;x++){wall(x,0,1);wall(x,1,1);wall(x,H-1);}
for(let y=0;y<H;y++){wall(0,y);wall(W-1,y);}
// Open Space (full width, top) | bottom strip: Gabinet CHIEF (left) · Socjal (middle) · Łazienka (right)
const DOORS=[[10,20],[14,20],[15,20],[33,20]]; // CHIEF, Socjal x2, WC
for(let x=1;x<W-1;x++) if(!DOORS.some(([dx])=>dx==x)) wall(x,20,1);
for(let y=21;y<H-1;y++){wall(12,y);wall(28,y);}                 // CHIEF | Socjal | Łazienka
const furniture=[];
function add(type,x,y,w=1,h=1,extra={}){furniture.push({type,x,y,w,h,...extra});for(let j=0;j<h;j++)for(let i=0;i<w;i++)solid[y+j][x+i]=1;}
// --- three big brass screens on the top wall: Top 10 desk + ostatnie pozycje | Tablica Pozycji | Historia portfela ---
add('top10board',1,1,12,5);add('scoreboard',14,1,12,5);add('historyboard',27,1,12,5);
// --- bot desks spread across Open Space: desk 3x2 + role equipment tile to the right ---
const ROLE_ITEM={SIZE:'scales',SCAN:'radar',BOOK:'cabinet',RISK:'alarm',VET:'stampdesk',FILLS:'printer'};
const BOT_DESKS=[];
['SIZE','SCAN','BOOK','RISK','VET','FILLS'].forEach((n,i)=>{const x=4+(i%3)*12,y=i<3?10:16;
 add('botdesk',x,y,3,2,{label:n});add(ROLE_ITEM[n],x+3,y,1,1,{label:n});BOT_DESKS.push({name:n,x:(x+1.5)*T,y:(y-0.5)*T});});
add('plant',1,19);add('plant',38,19);add('plant',20,19);add('plant',38,8);add('plant',1,8);
add('copier',1,13,2,1);add('watercooler',38,13);
// steampunk machinery + the Skull of Satoshi statue (lounge corner, right side of Open Space)
add('steamengine',1,15,2,2);add('clockwork',35,10,3,2);add('boiler',34,16,2,2);
// --- Gabinet CHIEF (bottom-left) ---
add('goldcabinet',1,21,2,1);add('bigdesk',4,22,5,2,{label:'CHIEF'});add('decanter',11,21);add('tickerclock',11,23);add('chair2',1,24);add('globe',11,25);add('plant',1,26);
add('skull',8,24,2,2); // Skull of Satoshi – centrepiece of the CHIEF office
BOT_DESKS.unshift({name:'CHIEF',x:6.5*T,y:21.5*T});
// --- Socjal (bottom-middle) ---
add('fridge',13,21,1,2);add('coffee',16,21);add('plant',13,26);
// Socjal lounge (decoration where the Top 10 board used to be)
add('tv',19,21,3,1);add('console',20,22);add('sofa',18,24,5,1);add('arcadebox',25,21);add('table',24,24,2,1);add('plant',27,21);add('bigplant',27,26);
// --- Łazienka (bottom-right) ---
add('stall',35,21,4,3);add('sink',30,21);add('sink',32,21);add('towel',29,26);
function zoneAt(px,py){const tx=px/T,ty=py/T;for(const z of ZONES)if(tx>=z.x&&tx<z.x+z.w&&ty>=z.y&&ty<z.y+z.h)return z.id;return 'korytarz';}
function blocked(px,py){const r=5;for(const [dx,dy] of [[-r,-r+3],[r,-r+3],[-r,r],[r,r]]){const tx=Math.floor((px+dx)/T),ty=Math.floor((py+dy)/T);if(tx<0||ty<0||tx>=W||ty>=H||solid[ty][tx])return true;}return false;}
const api={BOT_DESKS,DOORS,T,W,H,ZONES,FLOOR,solid,wallFace,furniture,zoneAt,blocked,SPAWN:{x:14*T+8,y:13*T+8}};
if(typeof module!=='undefined')module.exports=api;else root.MAP=api;
})(this);
