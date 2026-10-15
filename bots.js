// Server-driven NPC bot behaviour: state machine + A* on the tile grid.
module.exports=function createBots({io,players,MAP,BOT_CFG}){
const FAST=process.env.BOT_FAST==='1',SP=FAST?4:1;
const T=MAP.T,ms=v=>v/SP,rnd=a=>a[Math.random()*a.length|0],chance=p=>Math.random()<p;
const walk=(x,y)=>y>=0&&x>=0&&y<MAP.H&&x<MAP.W&&MAP.solid[y][x]===0;
function astar(s,g,avoid){if(!walk(...g))return null;const K=(x,y)=>y*MAP.W+x,open=[[...s,0,Math.abs(s[0]-g[0])+Math.abs(s[1]-g[1])]],gs=new Map([[K(...s),0]]),prev=new Map(),closed=new Set();
 while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(open[i][3]<open[bi][3])bi=i;const [x,y,gc]=open.splice(bi,1)[0];const k=K(x,y);if(closed.has(k))continue;closed.add(k);
  if(x==g[0]&&y==g[1]){const out=[];let c=k;while(c!==undefined){out.unshift([c%MAP.W,c/MAP.W|0]);c=prev.get(c);}out.shift();return out;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nk=K(nx,ny);if(!walk(nx,ny)||closed.has(nk)||(avoid&&avoid.has(nk)&&!(nx==g[0]&&ny==g[1])))continue;
   const ng=gc+1;if(ng<(gs.get(nk)??1e9)){gs.set(nk,ng);prev.set(nk,k);open.push([nx,ny,ng,ng+Math.abs(nx-g[0])+Math.abs(ny-g[1])]);}}}return null;}
const deskOf=n=>MAP.furniture.find(f=>f.type=='botdesk'&&f.label==n);
const deskFront=n=>{const d=deskOf(n);return [d.x+1,d.y+2];};
const SPOT={board:()=>[14+(Math.random()*12|0),6],top10:()=>[2+(Math.random()*11|0),6],cabinet:()=>[32,10],chief:()=>[5+(Math.random()*3|0),24],
 printer:()=>[36,12],coffee:()=>[16,22],fridge:()=>[13,23],wc:()=>[36,24],walk:()=>rnd([[13,13],[8,13],[22,13],[26,13],[10,18],[30,18],[34,13],[32,7]])};
const CHATS=[[[14,25],[16,25]],[[16,13],[18,13]],[[30,8],[32,8]],[[4,18],[6,18]]];
const LINES={
 CHIEF:{chat:['Jak wyniki?','Trzymamy dyscyplinę.','Dobra robota.','Plan na dziś aktualny.'],report:['Dzięki, notuję.','OK, działaj dalej.','Pilnuj limitów.'],walk:['Jak idzie, zespole?','Obchód biura...']},
 SIZE:{chat:['Max 2% na pozycję.','Kelly mówi: mniej.','Przeliczyłem wielkości.'],report:['Wielkości przeliczone.','Ekspozycja w normie.'],board:['Przeliczam wielkości...','Sizing się zgadza.']},
 SCAN:{chat:['Wolumen rośnie!','Mam nowy sygnał.','Rynek się budzi.'],report:['3 nowe setupy.','Skan zakończony.'],board:['Sygnały zgodne z tablicą.','Sprawdzam pozycje...'],top10:['Top 10 bez zmian.','BTC dalej lider.']},
 BOOK:{chat:['Wszystko zaksięgowane.','Saldo się zgadza.','PnL zapisany.'],report:['Księgi aktualne.','Raport dzienny gotowy.'],file:['Zarchiwizowane.','Segregator pełny!'],recv:['Przyjąłem, księguję.','Dzięki, wpisuję.']},
 RISK:{chat:['Uwaga na dźwignię.','Stop-lossy ustawione?','Ryzyko pod kontrolą.'],report:['Ekspozycja OK.','Limity zachowane.'],inspect:['Limity OK.','Za duża dźwignia!','Stop-loss jest. OK.','Wszystko w normie.']},
 VET:{chat:['Ten projekt to scam.','Audyt czysty.','Sprawdzam zespół.'],report:['Projekt zweryfikowany.','Dwie czerwone flagi.'],inspect:['Checklista OK ✔','Brakuje podpisu.','Zweryfikowane.']},
 FILLS:{chat:['Fill bez slippage.','Zlecenia poszły.','Egzekucja OK.'],report:['Wszystkie fille gotowe.','Zero odrzuceń.'],ticket:['Nowe fille do zaksięgowania!','Bilety z egzekucji!']}};
const B={};
for(const d of MAP.BOT_DESKS){const p=players['bot-'+d.name];const home=[Math.floor(d.x/T),Math.floor(d.y/T)];
 Object.assign(p,{x:home[0]*T+8,y:home[1]*T+8,dir:d.name=='CHIEF'?'down':'down',status:d.name+': pracuje przy biurku',act:'typing',carry:null});
 B[d.name]={name:d.name,p,home,plan:[],path:[],step:null,waitUntil:0,blockedSince:0,idleSince:Date.now()-Math.random()*20000,event:false};}
const tileOf=b=>[Math.floor(b.p.x/T),Math.floor(b.p.y/T)];
const atHome=b=>{const [x,y]=tileOf(b);return x==b.home[0]&&y==b.home[1]&&!b.path.length;};
const away=()=>Object.values(B).filter(b=>b.plan.length||b.step||!atHome(b)).length;
function setState(b,o){let ch=false;for(const k in o)if(b.p[k]!==o[k]){b.p[k]=o[k];ch=true;}if(ch)io.emit('botState',{id:b.p.id,status:b.p.status,act:b.p.act,carry:b.p.carry});}
function say(b,text){io.emit('bubble',{id:b.p.id,text});}
function emitMove(b){b.p.zone=MAP.zoneAt(b.p.x,b.p.y);io.emit('playerMoved',{id:b.p.id,x:Math.round(b.p.x*10)/10,y:Math.round(b.p.y*10)/10,dir:b.p.dir,zone:b.p.zone});}
// plan helpers
const go=(spot,status,o={})=>({go:spot,status,...o}),wait=(t,o={})=>({wait:t,...o}),home=()=>({go:'home'});
function start(b,plan){b.plan=plan.concat([home()]);b.step=null;b.idleSince=Date.now();}
function errand(b){const n=b.name,L=LINES[n],others=Object.keys(B).filter(k=>k!=n&&k!='CHIEF');const r=Math.random();
 if(n=='CHIEF'){if(r<.6)return start(b,[go(SPOT.walk(),'CHIEF: obchód Open Space'),wait(3000,{face:'down',say:rnd(L.walk)}),go(SPOT.walk(),'CHIEF: obchód Open Space'),wait(2000,{face:'up'})]);
  return start(b,[go(SPOT.coffee(),'CHIEF: przerwa na kawę'),wait(4000,{face:'up',act:'coffee',carry:'coffee'})]);}
 if(r<.12)return start(b,[go(SPOT.coffee(),n+': przerwa na kawę'),wait(3500,{face:'up',act:'coffee'}),wait(1500,{carry:'coffee',say:'Kawa ☕'})]);
 if(r<.20)return start(b,[go(SPOT.wc(),n+': wyszedł do łazienki'),wait(5000,{face:'up',act:'wc'})]);
 if(r<.32)return start(b,[go(SPOT.chief(),n+': raportuje do CHIEF'),wait(2500,{face:'up',say:rnd(L.report)}),wait(2500,{sayOther:['CHIEF',rnd(LINES.CHIEF.report)]})]);
 if(r<.42){const partner=Object.values(B).find(o=>o!=b&&o.name!='CHIEF'&&!o.plan.length&&!o.step&&atHome(o)&&Date.now()-o.idleSince>ms(8000));if(partner&&away()<2)return chat(b,partner);}
 switch(n){
  case 'SCAN':return chance(.5)?start(b,[go(SPOT.board(),'SCAN: sprawdza Tablicę Pozycji'),wait(3000,{face:'up',say:rnd(L.board)})]):start(b,[go(SPOT.top10(),'SCAN: sprawdza Top 10 Krypto'),wait(3000,{face:'up',say:rnd(L.top10)})]);
  case 'SIZE':return start(b,[go(SPOT.board(),'SIZE: przelicza wielkości przy tablicy'),wait(3500,{face:'up',say:rnd(L.board)})]);
  case 'RISK':{const [a,c]=[rnd(others),rnd(others)];return start(b,[go(deskFront(a),'RISK: sprawdza biurko '+a),wait(2500,{face:'up',say:rnd(L.inspect)}),...(c!=a?[go(deskFront(c),'RISK: sprawdza biurko '+c),wait(2500,{face:'up',say:rnd(L.inspect)})]:[])]);}
  case 'VET':{const a=rnd(others);return start(b,[go(deskFront(a),'VET: weryfikuje biurko '+a,{carry:'clip'}),wait(3000,{face:'up',say:rnd(L.inspect),carry:'clip'})]);}
  case 'FILLS':return start(b,[go(deskFront('BOOK'),'FILLS: niesie bilety do BOOK',{carry:'ticket'}),wait(2000,{face:'up',say:rnd(L.ticket),carry:'ticket'}),wait(2000,{carry:null,sayOther:['BOOK',rnd(LINES.BOOK.recv)]})]);
  case 'BOOK':return start(b,[go(SPOT.cabinet(),'BOOK: odkłada dokumenty do szafy',{carry:'ticket'}),wait(3500,{face:'left',act:'filing',carry:null,say:rnd(L.file)})]);}}
function chat(a,b){const [sa,sb]=rnd(CHATS);const c={arrived:new Set(),lines:[]};for(let i=0;i<4;i++){const w=i%2?b:a;c.lines.push([w,rnd(LINES[w.name].chat)]);}
 const stA=`${a.name}: rozmawia z ${b.name}`,stB=`${b.name}: rozmawia z ${a.name}`;
 start(a,[go(sa,stA),{sync:c,face:'right',status:stA},wait(4*2500+500,{face:'right',dialog:c})]);start(b,[go(sb,stB),{sync:c,face:'left',status:stB},wait(4*2500+500,{face:'left'})]);}
function onPosition(kind,pos){const b=B[pos.bot];if(!b)return;const txt=kind=='open'?`Na tablicy: ${pos.side} ${pos.symbol}!`:`Zamknięte: ${pos.symbol}.`;
 b.event=true;start(b,[go(SPOT.board(),`${b.name}: ogłasza ${kind=='open'?'otwarcie':'zamknięcie'} ${pos.symbol}`),wait(3000,{face:'up',say:txt})]);
 const r=B.RISK;if(r&&r!==b){say(r,kind=='open'?`Sprawdzam ekspozycję: ${pos.symbol}`:`Ryzyko ${pos.symbol} zdjęte.`);
  if(!r.plan.length&&away()<3){r.event=true;start(r,[go(SPOT.board(),`RISK: sprawdza ryzyko ${pos.symbol}`),wait(2500,{face:'up',say:'Limity OK po zmianie.'})]);}}}
// tick
const occ=b=>Object.values(B).filter(o=>o!==b).flatMap(o=>{const t=[tileOf(o)];if(o.path[0])t.push(o.path[0]);return t;});
function tick(dt){const now=Date.now();for(const b of Object.values(B)){
 if(!b.step&&b.plan.length){b.step=b.plan.shift();const s=b.step;
  if(s.go){const tgt=s.go=='home'?b.home:s.go;b.path=astar(tileOf(b),tgt)||[];b.target=tgt;setState(b,{status:s.go=='home'?b.name+': wraca do biurka':s.status,act:'walk',carry:s.carry??(s.go=='home'?(b.p.carry=='coffee'?'coffee':null):b.p.carry)});}
  else if(s.wait!=null){b.waitUntil=now+ms(s.wait);if(s.face)b.p.dir=s.face;emitMove(b);setState(b,{act:s.act||'idle',carry:s.carry!==undefined?s.carry:b.p.carry,...(s.status?{status:s.status}:{})});
   if(s.fn)s.fn();if(s.say)say(b,s.say);if(s.sayOther&&B[s.sayOther[0]])say(B[s.sayOther[0]],s.sayOther[1]);
   if(s.dialog)s.dialog.lines.forEach(([w,l],i)=>setTimeout(()=>say(w,l),ms(i*2500)));}
  else if(s.sync){s.sync.arrived.add(b.name);b.syncStart=now;if(s.face)b.p.dir=s.face;emitMove(b);setState(b,{act:'idle'});}}
 const s=b.step;if(!s)continue;
 if(s.go){if(!b.path.length){b.step=null;if(s.go=='home'){b.p.dir='down';emitMove(b);b.event=false;b.idleSince=now;setState(b,{status:b.name+': pracuje przy biurku',act:'typing',carry:null});}continue;}
  const [nx,ny]=b.path[0],tx=nx*T+8,ty=ny*T+8;const [cx,cy]=tileOf(b);
  if((nx!=cx||ny!=cy)&&occ(b).some(([ox,oy])=>ox==nx&&oy==ny)){if(!b.blockedSince)b.blockedSince=now;const w=now-b.blockedSince;
   if(w>ms(1200)&&!b.repathed){b.repathed=true;const av=new Set(occ(b).map(([x,y])=>y*MAP.W+x));const np=astar([cx,cy],b.target,av);if(np&&np.length)b.path=np;continue;}
   if(w<ms(4000))continue;}
  b.repathed=false;
  b.blockedSince=0;const v=48*SP*dt;const dx=tx-b.p.x,dy=ty-b.p.y,d=Math.hypot(dx,dy);
  b.p.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
  if(d<=v){b.p.x=tx;b.p.y=ty;b.path.shift();}else{b.p.x+=dx/d*v;b.p.y+=dy/d*v;}emitMove(b);}
 else if(s.wait!=null){if(now>=b.waitUntil)b.step=null;}
 else if(s.sync){if(s.sync.arrived.size>=2||now-b.syncStart>ms(20000))b.step=null;}}}
let last=Date.now();setInterval(()=>{const n=Date.now();tick(Math.min(.3,(n-last)/1000));last=n;},100);
// scheduler
setInterval(()=>{const idle=Object.values(B).filter(b=>!b.plan.length&&!b.step&&atHome(b)&&Date.now()-b.idleSince>ms(15000));
 if(!idle.length||away()>=2||!chance(FAST?.8:.35))return;errand(rnd(idle));},ms(3000));
// desk chatter: thinking bubbles / role lines for bots at desks
// desk chatter: each bot talks about one of its last 10 REAL events (botEvents from the desk feed); with none, a neutral idle line
let events={};const IDLE=['...','Czekam na dane z desku.','Przy biurku.'];
setInterval(()=>{const at=Object.values(B).filter(b=>atHome(b)&&!b.step);if(!at.length)return;const b=rnd(at);const ev=events[b.name]||[];say(b,ev.length&&!chance(.25)?rnd(ev).text:rnd(IDLE));},ms(12000)); // 12 s (halved frequency, 22:13)
// supercomputer printer: paper piles up; every few minutes (random) SCAN collects the printout
let pile=0;const PILE_MAX=8;const emitPile=()=>io.emit('printer',{pile});
setInterval(()=>{if(pile<PILE_MAX&&chance(.5)){pile++;emitPile();}},ms(15000));
function collectPrintout(force){const s=B.SCAN;if(!s||s.plan.length||s.step||!atHome(s)||(!force&&away()>=3))return false;
 start(s,[go(SPOT.printer(),'SCAN: idzie po wydruk do SUPERKOMPUTERA'),wait(3000,{face:'up',say:'Zbieram wydruk...',carry:'ticket',fn:()=>{pile=0;emitPile();}}),wait(800,{carry:'ticket'})]);return true;}
(function sched(first){setTimeout(()=>{if(pile>0&&chance(.6))collectPrintout(first);sched(false);},first?+process.env.PRINTER_FIRST_MS:ms(90000+Math.random()*150000));})(!!process.env.PRINTER_FIRST_MS);
function nudge(n){const b=B[n];if(b&&!b.plan.length&&!b.step&&atHome(b)&&away()<2&&chance(.5))errand(b);}
return {onPosition,nudge,setEvents:e=>{events=e||{};},events:()=>events,printer:()=>pile,collectPrintout,list:()=>Object.values(B).map(b=>({name:b.name,x:b.p.x,y:b.p.y,tile:tileOf(b),home:b.home,atDesk:atHome(b)&&!b.step&&!b.plan.length,status:b.p.status,act:b.p.act,carry:b.p.carry,zone:MAP.zoneAt(b.p.x,b.p.y)})),walk,errandFor:n=>errand(B[n])};};
