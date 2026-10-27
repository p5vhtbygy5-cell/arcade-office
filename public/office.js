// The office, drawn as vectors in map pixels and scaled up to the panel.
// Bots, players and bubbles stay in sync with the server the way they always have.
(function(root){
const {T,W,H,ZONES,furniture,zoneAt,solid,wallFace,DOORS}=MAP;
const ROLE={CHIEF:'#ff5a6a',SIZE:'#ffe14d',SCAN:'#3ee0ff',BOOK:'#3dff9a',RISK:'#ff8a3d',VET:'#c58cff',FILLS:'#ff5ad8'};
const UI=()=>root.AO_UI||'sans-serif';
function rr(ctx,x,y,w,h,r){
  const rad=Math.max(0, Math.min(r, w/2, h/2));
  ctx.beginPath();
  ctx.moveTo(x+rad,y);
  ctx.arcTo(x+w,y,x+w,y+h,rad);
  ctx.arcTo(x+w,y+h,x,y+h,rad);
  ctx.arcTo(x,y+h,x,y,rad);
  ctx.arcTo(x,y,x+w,y,rad);
  ctx.closePath();
}
function text(ctx,s,x,y,size,color,align){
  ctx.font='700 '+size+'px '+UI();
  ctx.fillStyle=color;
  ctx.textAlign=align||'left';
  ctx.textBaseline='middle';
  ctx.fillText(s,x,y);
}
const occ=new Set();
for(const f of furniture) for(let j=0;j<f.h;j++) for(let i=0;i<f.w;i++) occ.add((f.x+i)+','+(f.y+j));
const SKY=[[0,[10,14,36],[18,24,58]],[5,[10,14,36],[18,24,58]],[6.3,[70,48,110],[230,130,90]],[7.5,[90,160,220],[190,220,240]],[16.2,[90,160,220],[190,220,240]],[17.4,[90,70,130],[240,140,70]],[18.6,[10,14,36],[28,24,64]],[24,[10,14,36],[18,24,58]]];
const mix=(a,b,f)=>a.map((v,i)=>Math.round(v+(b[i]-v)*f));
const rgb=a=>'rgb('+a.join(',')+')';
function warsawHour(){
  try{
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const v=k=>+p.find(x=>x.type===k).value;
    return v('hour')+v('minute')/60;
  }catch(e){return 12;}
}
function skyAt(h){
  for(let i=0;i<SKY.length-1;i++){
    const [a,ta,ba]=SKY[i],[b,tb,bb]=SKY[i+1];
    if(h>=a&&h<=b){const f=(h-a)/(b-a||1), s=f*f*(3-2*f); return [mix(ta,tb,s), mix(ba,bb,s)];}
  }
  return [SKY[0][1], SKY[0][2]];
}
let skyCache={at:0, h:12, top:[20,40,80], bot:[40,70,120], night:0};
function sky(){
  const now=Date.now();
  if(now-skyCache.at<8000) return skyCache;
  const h=warsawHour();
  const [top,bot]=skyAt(h);
  const night=h<5.5||h>18.6?1:h<7.2?Math.max(0,(7.2-h)/1.7):h>16.8?Math.min(1,(h-16.8)/1.8):0;
  return skyCache={at:now,h,top,bot,night};
}
function drawPerson(ctx,p,t){
  const walking=p.act==='walk'||p.moving||(p.lastMove&&t-p.lastMove<280);
  const bob=walking?Math.sin(t/140)*1.1:Math.sin(t/500+(p.name||'').length)*0.4;
  const step=walking?Math.sin(t/110)*2.2:0;
  ctx.save();
  ctx.translate(p.rx, p.ry+bob);
  if(p.dir==='left') ctx.scale(-1,1);
  ctx.fillStyle='rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0,2,7,2.6,0,0,7); ctx.fill();
  ctx.fillStyle='#0d121c';
  ctx.fillRect(-5,-1+step,3,6); ctx.fillRect(2,-1-step,3,6);
  const shirt=p.color||'#3ee0ff';
  ctx.fillStyle=shirt;
  rr(ctx,-7,-16,14,14,4); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.28)';
  ctx.fillRect(-5,-14,8,2);
  ctx.fillStyle='#f0d2b4';
  rr(ctx,-6,-27,12,12,4); ctx.fill();
  ctx.fillStyle='#101820';
  rr(ctx,-4.5,-24,9,4.2,1.5); ctx.fill();
  ctx.fillStyle='#e8fbff';
  ctx.fillRect(-3,-23,1.6,2); ctx.fillRect(1.2,-23,1.6,2);
  const sp=p.sprite|0;
  ctx.fillStyle='#1b2436';
  if(sp===1){ctx.fillRect(-6,-30,3,4); ctx.fillRect(-1,-32,3,5); ctx.fillRect(3,-30,3,4);}
  else if(sp===2){ctx.fillStyle=shirt; rr(ctx,-7,-31,14,5,2); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillRect(-2,-33,4,3);}
  else if(sp===3){ctx.fillStyle='#f0d2b4'; ctx.beginPath(); ctx.arc(-7,-22,2.4,0,7); ctx.arc(7,-22,2.4,0,7); ctx.fill();}
  else {ctx.fillRect(-6,-30,12,4);}
  if(p.carry){
    ctx.fillStyle='#f4ecd8';
    rr(ctx,6,-12,7,8,1); ctx.fill();
    ctx.fillStyle='#243048';
    ctx.fillRect(7,-9,5,1); ctx.fillRect(7,-6,4,1);
  }
  ctx.restore();
}
function drawBot(ctx,p,t){
  const col=ROLE[p.name]||'#9ab';
  const walking=p.act==='walk';
  const bob=walking?Math.sin(t/130)*1.2:Math.sin(t/420+p.name.length)*0.5;
  const step=walking?Math.sin(t/100)*2.4:0;
  ctx.save();
  ctx.translate(p.rx, p.ry+bob);
  if(p.dir==='left') ctx.scale(-1,1);
  ctx.fillStyle='rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(0,2,8,2.8,0,0,7); ctx.fill();
  ctx.fillStyle='#0c1018';
  ctx.fillRect(-5,-2+step,3.2,7); ctx.fillRect(2,-2-step,3.2,7);
  ctx.fillStyle=col;
  rr(ctx,-8,-18,16,16,4); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.3)';
  ctx.fillRect(-6,-16,12,2);
  ctx.fillStyle='#d5e2f4';
  rr(ctx,-7,-30,14,13,4); ctx.fill();
  const blink=(t/160|0)%18===0;
  ctx.fillStyle='#0e141e';
  rr(ctx,-5,-26,10,4.5,1.4); ctx.fill();
  if(!blink){ctx.fillStyle=col; ctx.fillRect(-3.2,-25,2,2.4); ctx.fillRect(1.2,-25,2,2.4);}
  ctx.fillStyle=col;
  if(p.name==='CHIEF'){ctx.beginPath(); ctx.moveTo(-6,-30); ctx.lineTo(-4,-36); ctx.lineTo(-1,-31); ctx.lineTo(1,-37); ctx.lineTo(4,-31); ctx.lineTo(6,-36); ctx.lineTo(7,-30); ctx.fill();}
  else if(p.name==='SCAN'){ctx.fillRect(0,-38,1.4,8); ctx.beginPath(); ctx.arc(0.7,-39,2.4,0,7); ctx.fill(); if((t/200|0)%2){ctx.fillStyle='#fff'; ctx.fillRect(-0.2,-40,1.2,1.2);}}
  else if(p.name==='RISK'){ctx.fillStyle=(t/280|0)%2?col:'#fff'; rr(ctx,-3,-38,6,8,2); ctx.fill();}
  else if(p.name==='VET'){ctx.strokeStyle=col; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(4,-24,3.2,0,7); ctx.stroke();}
  else if(p.name==='FILLS'){ctx.fillRect(-4,-36,1.3,6); ctx.fillRect(3,-36,1.3,6); ctx.beginPath(); ctx.arc(-3.4,-37,1.6,0,7); ctx.arc(3.6,-37,1.6,0,7); ctx.fill();}
  else if(p.name==='SIZE'){ctx.strokeStyle=col; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(0,-34,3.5,0,7); ctx.stroke(); ctx.fillRect(-0.4,-34,4,1);}
  else if(p.name==='BOOK'){ctx.fillStyle='#123'; rr(ctx,-5,-34,10,4,1); ctx.fill(); ctx.fillStyle=col; ctx.fillRect(-4,-33,8,2);}
  if(p.carry){ctx.fillStyle='#f6edd8'; rr(ctx,7,-14,8,9,1); ctx.fill(); ctx.fillStyle='#243'; ctx.fillRect(8,-11,6,1); ctx.fillRect(8,-8,4,1);}
  ctx.restore();
}
function monitors(ctx,label,X,Y,w,t,col){
  const n=label==='SIZE'||label==='SCAN'?3:label==='BOOK'?0:2;
  if(label==='BOOK'){
    for(let i=0;i<4;i++){ctx.fillStyle=i%2?'#2a4470':'#1a3058'; rr(ctx,X+4+i*10,Y+4,8,14,1); ctx.fill(); ctx.fillStyle=col; ctx.fillRect(X+5+i*10,Y+6,6,2);}
    return;
  }
  for(let i=0;i<n;i++){
    const mw=n===3?12:16, mx=X+6+i*(mw+4);
    ctx.fillStyle='#070b12';
    rr(ctx,mx,Y+3,mw,12,2); ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=col;
    for(let k=0;k<5;k++){
      const bh=2+Math.abs(Math.sin(k+t/700+i))*6;
      ctx.globalAlpha=.35+( (t/400|0)%5===k? .65:0);
      ctx.fillRect(mx+2+k*2, Y+13-bh, 1.4, bh);
    }
    ctx.globalAlpha=1;
  }
}
function drawDesk(ctx,f,t){
  const X=f.x*T,Y=f.y*T,w=f.w*T,h=f.h*T,col=ROLE[f.label]||'#3ee0ff';
  ctx.fillStyle='rgba(0,0,0,.28)';
  rr(ctx,X-3,Y-2,w+10,h+8,5); ctx.fill();
  ctx.strokeStyle=col; ctx.globalAlpha=.45; ctx.lineWidth=1; ctx.stroke(); ctx.globalAlpha=1;
  ctx.fillStyle='#1a3158';
  rr(ctx,X,Y,w,h-3,3); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.08)';
  ctx.fillRect(X+2,Y+2,w-4,2);
  ctx.fillStyle='#101c33';
  ctx.fillRect(X,Y+h-7,w,7);
  monitors(ctx,f.label,X,Y,w,t,col);
  ctx.font='700 7px '+UI();
  const tw=ctx.measureText(f.label).width, pw=tw+8, px=X+(w-pw)/2, py=Y+h-15;
  ctx.fillStyle='#070b14';
  rr(ctx,px,py,pw,10,2); ctx.fill();
  ctx.strokeStyle=col; ctx.stroke();
  text(ctx,f.label,X+w/2,py+5,7,col,'center');
}
function drawF(ctx,f,t,hud){
  const X=f.x*T,Y=f.y*T,w=f.w*T,h=f.h*T;
  switch(f.type){
  case 'wallscreen':{
    ctx.fillStyle='#05070d'; ctx.fillRect(X+1,Y+1,w-2,h-2);
    ctx.strokeStyle='#3ee0ff'; ctx.lineWidth=1.5; ctx.strokeRect(X+2.5,Y+2.5,w-5,h-5);
    text(ctx,f.label,X+6,Y+8,7,'#ffc14d','left');
    const v=f.screen==='scan'?(hud.scan||'—'):f.screen==='pos'?(hud.pos||'0'):(hud.bank||'—');
    text(ctx,String(v).slice(0,18),X+6,Y+20,10,'#e8f6ff','left');
    break;}
  case 'window':{
    const s=sky();
    const g=ctx.createLinearGradient(0,Y,0,Y+h);
    g.addColorStop(0,rgb(s.top)); g.addColorStop(1,rgb(s.bot));
    ctx.fillStyle=g; ctx.fillRect(X+2,Y+2,w-4,h-4);
    if(s.night>0.4){ctx.fillStyle='rgba(255,255,240,.9)'; ctx.beginPath(); ctx.arc(X+w*0.72,Y+8,3.2,0,7); ctx.fill();}
    else {ctx.fillStyle='#ffe08a'; ctx.beginPath(); ctx.arc(X+w*0.3,Y+h*0.45,4,0,7); ctx.fill();}
    ctx.strokeStyle='#9fb4d4'; ctx.lineWidth=1.4;
    ctx.strokeRect(X+2,Y+2,w-4,h-4);
    ctx.beginPath(); ctx.moveTo(X+w/2,Y+2); ctx.lineTo(X+w/2,Y+h-2); ctx.moveTo(X+2,Y+h/2); ctx.lineTo(X+w-2,Y+h/2); ctx.stroke();
    text(ctx,'WARSZAWA',X+w/2,Y+h-7,6,'rgba(255,255,255,.8)','center');
    break;}
  case 'botdesk': drawDesk(ctx,f,t); break;
  case 'scales':{
    ctx.strokeStyle='#d5e2f4'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(X+8,Y+4); ctx.lineTo(X+8,Y+13); ctx.moveTo(X+2,Y+5); ctx.lineTo(X+14,Y+5); ctx.stroke();
    const tilt=Math.sin(t/700)*2;
    ctx.fillStyle='#ffc14d'; ctx.fillRect(X+1,Y+6+tilt,5,3); ctx.fillRect(X+10,Y+6-tilt,5,3);
    ctx.fillStyle='#1a3158'; ctx.fillRect(X+4,Y+13,8,3); break;}
  case 'radar':{
    ctx.fillStyle='#071018'; ctx.beginPath(); ctx.arc(X+8,Y+9,7,0,7); ctx.fill();
    ctx.strokeStyle='#3ee0ff'; ctx.stroke();
    ctx.save(); ctx.translate(X+8,Y+9); ctx.rotate(t/500);
    ctx.fillStyle='rgba(62,224,255,.45)'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,6,-0.4,0.4); ctx.fill();
    ctx.restore(); break;}
  case 'cabinet':{
    ctx.fillStyle='#14243f'; rr(ctx,X+1,Y-8,14,24,2); ctx.fill();
    ctx.fillStyle='#3ee0ff'; for(let i=0;i<3;i++) ctx.fillRect(X+3,Y-4+i*6,10,1);
    break;}
  case 'alarm':{
    const on=(t/260|0)%2;
    ctx.fillStyle=on?'#ff5a6a':'#8a3040';
    ctx.beginPath(); ctx.moveTo(X+8,Y); ctx.lineTo(X+14,Y+12); ctx.lineTo(X+2,Y+12); ctx.fill();
    ctx.fillStyle='#fff'; ctx.fillRect(X+7.4,Y+5,1.2,4);
    ctx.fillStyle='#ffc14d'; ctx.fillRect(X+6,Y+13,4,2); break;}
  case 'stampdesk':{
    ctx.fillStyle='#f4ecd8'; rr(ctx,X+1,Y+4,9,10,1); ctx.fill();
    ctx.fillStyle='#c58cff'; rr(ctx,X+8,Y+1+((t/500|0)%3===0?1:0),6,8,1); ctx.fill(); break;}
  case 'printer':{
    ctx.fillStyle='#1a3158'; rr(ctx,X+1,Y+5,14,9,2); ctx.fill();
    ctx.fillStyle='#f4ecd8'; ctx.fillRect(X+3,Y+2,10,4);
    ctx.fillStyle='#3ee0ff'; ctx.fillRect(X+4,Y+8,8,1); break;}
  case 'watercooler':{
    ctx.fillStyle='#16304a'; rr(ctx,X+3,Y+6,10,10,2); ctx.fill();
    ctx.fillStyle='rgba(120,200,255,.45)'; rr(ctx,X+5,Y,6,8,2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)';
    const ph=(t/140|0)%10; ctx.beginPath(); ctx.arc(X+7,Y-2-ph,1.4,0,7); ctx.fill(); break;}
  case 'copier':{
    ctx.fillStyle='#1a3158'; rr(ctx,X,Y+2,w,12,2); ctx.fill();
    ctx.fillStyle='#3ee0ff'; ctx.fillRect(X+3,Y+5,w-6,2); break;}
  case 'plant': case 'bigplant':{
    const s=f.type==='bigplant'?1.25:1;
    ctx.save(); ctx.translate(X+8,Y+12); ctx.scale(s,s);
    ctx.fillStyle='#1a3158'; rr(ctx,-4,-2,8,6,1); ctx.fill();
    ctx.fillStyle='#1d8a56'; ctx.beginPath(); ctx.arc(0,-6,5,0,7); ctx.fill();
    ctx.fillStyle='#3dff9a'; ctx.beginPath(); ctx.arc(-2,-8,2.2,0,7); ctx.fill();
    ctx.restore(); break;}
  case 'holotable':{
    ctx.fillStyle='#12243f'; rr(ctx,X,Y+4,w,h-4,6); ctx.fill();
    ctx.strokeStyle='#3ee0ff'; ctx.globalAlpha=.7; ctx.stroke(); ctx.globalAlpha=1;
    ctx.save(); ctx.translate(X+w/2,Y+h/2); ctx.rotate(t/1200);
    ctx.strokeStyle='#ff5ad8'; ctx.beginPath(); ctx.ellipse(0,0,10,4,0,0,7); ctx.stroke();
    ctx.restore();
    ctx.fillStyle='#ffc14d'; ctx.beginPath(); ctx.arc(X+w/2,Y+h/2,2,0,7); ctx.fill(); break;}
  case 'supercomputer':{
    ctx.fillStyle='#121c30'; rr(ctx,X,Y-6,w,h+6,3); ctx.fill();
    ctx.strokeStyle='#3ee0ff'; ctx.stroke();
    for(let i=0;i<10;i++){ctx.fillStyle=((t/120+i)%5)<1?'#ff5a6a':((t/90+i)%4)<1?'#ffc14d':'#3dff9a'; ctx.globalAlpha=.85; ctx.fillRect(X+4+(i%5)*14,Y+(i<5?2:10),3,3);} 
    ctx.globalAlpha=1;
    text(ctx,'CORE',X+w/2,Y+h-4,7,'#9fb4d4','center');
    const px=X+w/2-8;
    ctx.fillStyle='#070b12'; ctx.fillRect(px,Y+h-2,22,5);
    break;}
  case 'boiler':{
    ctx.fillStyle='#1a2744'; rr(ctx,X+2,Y,w-4,h,4); ctx.fill();
    ctx.strokeStyle='#8ea3c4'; ctx.stroke();
    for(let k=0;k<3;k++){const ph=(t/900+k/3)%1; ctx.fillStyle='rgba(200,220,240,'+(0.35*(1-ph))+')'; ctx.beginPath(); ctx.arc(X+w/2+Math.sin(ph*6+k)*3, Y-ph*16, 2+ph*3, 0, 7); ctx.fill();}
    break;}
  case 'goldcabinet':{
    ctx.fillStyle='#1a2744'; ctx.fillRect(X,Y-10,w,h+10);
    ctx.strokeStyle='#ffc14d'; ctx.strokeRect(X+1,Y-9,w-2,h+8);
    for(let i=0;i<3;i++){ctx.fillStyle='#ffc14d'; ctx.fillRect(X+4,Y-4+i*4,w-8,1.4);} break;}
  case 'bigdesk':{
    ctx.fillStyle='#3a2418'; rr(ctx,X,Y,w,h,3); ctx.fill();
    ctx.strokeStyle='#ffc14d'; ctx.stroke();
    ctx.fillStyle='#101820'; rr(ctx,X+w/2-16,Y-8,32,12,2); ctx.fill();
    ctx.strokeStyle='#ffc14d'; ctx.stroke();
    text(ctx,'CHIEF',X+w/2,Y+h-6,8,'#ffc14d','center'); break;}
  case 'decanter':{
    ctx.fillStyle='rgba(255,80,110,.75)'; rr(ctx,X+4,Y+2,6,10,2); ctx.fill();
    ctx.fillStyle='#d5e2f4'; ctx.fillRect(X+6,Y-2,2,4); break;}
  case 'tickerclock':{
    ctx.fillStyle='#070b12'; rr(ctx,X+1,Y+2,14,12,2); ctx.fill();
    ctx.strokeStyle='#3ee0ff'; ctx.stroke();
    const hh=String(Math.floor(sky().h)).padStart(2,'0');
    text(ctx,hh,X+8,Y+8,7,'#3ee0ff','center'); break;}
  case 'globe':{
    ctx.fillStyle='#16324e'; ctx.beginPath(); ctx.arc(X+8,Y+7,6,0,7); ctx.fill();
    ctx.strokeStyle='#3ee0ff'; ctx.stroke();
    ctx.strokeStyle='#ffc14d'; ctx.beginPath(); ctx.arc(X+8,Y+14,5,Math.PI,0); ctx.stroke(); break;}
  case 'chair2':{
    ctx.fillStyle='#ff5a6a'; rr(ctx,X+3,Y+2,10,10,2); ctx.fill(); break;}
  case 'skull':{
    ctx.fillStyle='#101820'; rr(ctx,X,Y+8,w,h-6,3); ctx.fill();
    ctx.fillStyle='#c9d4c2';
    rr(ctx,X+6,Y-16,20,22,8); ctx.fill();
    ctx.fillStyle='#101820';
    ctx.fillRect(X+10,Y-8,4,5); ctx.fillRect(X+18,Y-8,4,5);
    const fl=0.45+0.55*(0.5-0.5*Math.cos(t/900));
    ctx.fillStyle='rgba(255,40,40,'+fl+')';
    ctx.fillRect(X+11,Y-7,2,2); ctx.fillRect(X+19,Y-7,2,2);
    ctx.fillStyle='#6d6458';
    ctx.fillRect(X+8,Y-28,3,12); ctx.fillRect(X+14,Y-34,3,16); ctx.fillRect(X+20,Y-26,3,10);
    text(ctx,'SKULL OF SATOSHI',X+w/2,Y+h-2,5,'#ffc14d','center'); break;}
  case 'fridge':{
    ctx.fillStyle='#d5e2f4'; rr(ctx,X,Y,w,h,2); ctx.fill();
    ctx.fillStyle='#1a3158'; ctx.fillRect(X+w-4,Y+4,2,6); break;}
  case 'coffee':{
    ctx.fillStyle='#2a1c16'; rr(ctx,X+2,Y,12,16,2); ctx.fill();
    text(ctx,'KAWA',X+8,Y+8,5,'#ffc14d','center');
    if((t/400|0)%2){ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(X+7,Y-3,1,3);} break;}
  case 'tv':{
    ctx.fillStyle='#070b12'; rr(ctx,X,Y,w,h+6,2); ctx.fill();
    ctx.fillStyle='#123'; ctx.fillRect(X+3,Y+3,w-6,h);
    text(ctx,(hud.headline||'ARCADE').slice(0,16),X+w/2,Y+h/2+2,6,'#3ee0ff','center'); break;}
  case 'console':{
    ctx.fillStyle='#1a3158'; rr(ctx,X+2,Y+4,12,8,2); ctx.fill();
    ctx.fillStyle='#ff5ad8'; ctx.fillRect(X+4,Y+7,3,3); break;}
  case 'sofa':{
    ctx.fillStyle='#24386a'; rr(ctx,X,Y,w,h,4); ctx.fill();
    ctx.fillStyle='#3ee0ff'; ctx.globalAlpha=.35; ctx.fillRect(X+4,Y+3,w-8,4); ctx.globalAlpha=1; break;}
  case 'arcadebox':{
    ctx.fillStyle='#241028'; rr(ctx,X+2,Y-6,12,22,2); ctx.fill();
    ctx.fillStyle=(t/300|0)%2?'#ff5ad8':'#3ee0ff'; ctx.fillRect(X+4,Y-3,8,8); break;}
  case 'table':{
    ctx.fillStyle='#1a3158'; rr(ctx,X,Y,w,h,3); ctx.fill(); break;}
  case 'stall':{
    ctx.fillStyle='#163044'; ctx.fillRect(X,Y,w,h);
    ctx.strokeStyle='#9fb4d4';
    for(let i=1;i<4;i++){ctx.beginPath(); ctx.moveTo(X+i*16,Y); ctx.lineTo(X+i*16,Y+h); ctx.stroke();}
    text(ctx,'WC',X+w-14,Y+10,8,'#d5e2f4','left'); break;}
  case 'sink':{
    ctx.fillStyle='#d5e2f4'; rr(ctx,X+2,Y+4,12,8,3); ctx.fill();
    ctx.fillStyle='#1a3158'; ctx.fillRect(X+7,Y,2,5); break;}
  case 'towel':{
    ctx.fillStyle='#9fb4d4'; ctx.fillRect(X+4,Y+2,8,12); break;}
  default: break;
  }
}
function drawWorld(ctx,t,state){
  const hud=state.hud||{};
  ctx.fillStyle='#10192e';
  ctx.fillRect(0,0,W*T,H*T);
  ctx.strokeStyle='rgba(130,170,255,.12)';
  ctx.lineWidth=1;
  for(let x=0;x<=W;x++){ctx.beginPath(); ctx.moveTo(x*T+0.5,0); ctx.lineTo(x*T+0.5,H*T); ctx.stroke();}
  for(let y=0;y<=H;y++){ctx.beginPath(); ctx.moveTo(0,y*T+0.5); ctx.lineTo(W*T,y*T+0.5); ctx.stroke();}
  for(const z of ZONES){
    if(z.id==='chief') ctx.fillStyle='rgba(120,40,40,.28)';
    else if(z.id==='bathroom') ctx.fillStyle='rgba(180,200,220,.08)';
    else if(z.id==='social') ctx.fillStyle='rgba(40,80,90,.18)';
    else continue;
    ctx.fillRect(z.x*T,z.y*T,z.w*T,z.h*T);
  }
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    if(!solid[y][x]||occ.has(x+','+y)) continue;
    const X=x*T,Y=y*T;
    ctx.fillStyle=wallFace[y][x]?'#24324c':'#1a2438';
    ctx.fillRect(X,Y,T,T);
    if(wallFace[y][x]){ctx.fillStyle='#3ee0ff'; ctx.globalAlpha=.55; ctx.fillRect(X,Y,T,2); ctx.globalAlpha=1;}
    else {ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(X,Y+T-3,T,3);}
  }
  for(const [x,y] of DOORS){
    ctx.fillStyle='#0e1830'; ctx.fillRect(x*T,y*T,T,T);
    ctx.fillStyle='#ffc14d'; ctx.fillRect(x*T+2,y*T+T-2,T-4,2);
  }
  const s=sky();
  if(s.night>0){ctx.fillStyle='rgba(8,12,30,'+(0.18*s.night).toFixed(3)+')'; ctx.fillRect(0,0,W*T,H*T);}
  const pile=state.printerPile|0;
  const items=[];
  for(const f of furniture) items.push({y:(f.y+f.h)*T, f});
  const players=state.players||{};
  for(const p of Object.values(players)){
    if(p.rx==null){p.rx=p.x; p.ry=p.y;}
    items.push({y:(p.ry||0)+8, p});
  }
  items.sort((a,b)=>a.y-b.y);
  for(const it of items){
    if(it.f){
      drawF(ctx,it.f,t,hud);
      if(it.f.type==='supercomputer'){
        const X=it.f.x*T+it.f.w*T/2-8, Y=it.f.y*T+it.f.h*T;
        for(let k=0;k<pile;k++){ctx.fillStyle=k%2?'#f4ecd8':'#d9d0bc'; ctx.fillRect(X+(k%3)-1, Y+2+k*2, 16, 2);}
      }
    }else if(it.p.bot) drawBot(ctx,it.p,t);
    else drawPerson(ctx,it.p,t);
  }
  const mouse=state.mouse;
  for(const p of Object.values(players)){
    const tagY=(p.ry||0)-30;
    const label=p.name+(p.bot?'':'');
    ctx.font='700 8px '+UI();
    const tw=ctx.measureText(label).width+8;
    ctx.fillStyle='rgba(6,10,18,.82)';
    rr(ctx,(p.rx||0)-tw/2, tagY-6, tw, 12, 3); ctx.fill();
    text(ctx,label,p.rx||0, tagY, 8, p.bot?(ROLE[p.name]||'#fff'):'#e8f6ff','center');
    if(p.bot&&p.status&&mouse&&Math.abs(mouse.x-p.rx)<18&&Math.abs(mouse.y-p.ry)<22){
      ctx.font='600 7px '+UI();
      const sw=Math.min(220, ctx.measureText(p.status).width+10);
      ctx.fillStyle='rgba(6,10,18,.9)';
      rr(ctx,p.rx-sw/2, tagY+10, sw, 12, 3); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(p.rx-sw/2, tagY+10, sw, 12); ctx.clip();
      text(ctx,p.status,p.rx, tagY+16, 7, '#ffc14d','center');
      ctx.restore();
    }
    const b=state.bubbles&&state.bubbles[p.id];
    if(!b||Date.now()>b.until) continue;
    drawBubble(ctx, b.text, p.rx, (p.ry||0)-42);
  }
}
function drawBubble(ctx, raw, cx, top){
  const maxW=168;
  ctx.font='600 8px '+UI();
  const words=String(raw||'').split(/\s+/);
  const lines=[]; let cur='';
  const push=s=>{if(s) lines.push(s);};
  for(const word of words){
    if(!word) continue;
    const trial=cur?cur+' '+word:word;
    if(ctx.measureText(trial).width<=maxW){cur=trial; continue;}
    push(cur); cur='';
    if(ctx.measureText(word).width<=maxW){cur=word; continue;}
    let buf='';
    for(const ch of [...word]){
      if(ctx.measureText(buf+ch).width>maxW){push(buf); buf=ch;} else buf+=ch;
    }
    cur=buf;
  }
  push(cur);
  const show=lines.slice(0,2);
  if(lines.length>2) show[1]=show[1].slice(0, Math.max(0, show[1].length-1))+'…';
  const w=Math.max(24, ...show.map(s=>ctx.measureText(s).width))+12;
  const h=show.length*11+8;
  let x=cx-w/2; x=Math.max(4, Math.min(W*T-w-4, x));
  const y=Math.max(4, top-h);
  ctx.fillStyle='rgba(8,12,22,.92)';
  rr(ctx,x,y,w,h,4); ctx.fill();
  ctx.strokeStyle='#3ee0ff'; ctx.lineWidth=1; ctx.stroke();
  show.forEach((s,i)=>text(ctx,s,x+6,y+8+i*11,8,'#e8f6ff','left'));
}
function create(canvas){
  let ox=0, oy=0, sc=1, mouse=null;
  function resize(w,h){
    w=Math.max(2,w|0); h=Math.max(2,h|0);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w; canvas.height=h;}
    const mapW=W*T, mapH=H*T;
    sc=Math.min(w/mapW, h/mapH);
    ox=(w-mapW*sc)/2; oy=(h-mapH*sc)/2;
  }
  function frame(t, state){
    const ctx=canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#070b14';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(sc,0,0,sc,ox,oy);
    ctx.imageSmoothingEnabled=true;
    const st=state||{};
    st.mouse=mouse;
    drawWorld(ctx, t, st);
  }
  canvas.addEventListener('mousemove', e=>{
    const r=canvas.getBoundingClientRect();
    if(!r.width) return;
    const mx=(e.clientX-r.left)/r.width*canvas.width;
    const my=(e.clientY-r.top)/r.height*canvas.height;
    mouse={x:(mx-ox)/sc, y:(my-oy)/sc};
  });
  canvas.addEventListener('mouseleave', ()=>{mouse=null;});
  return {resize, frame, canvas};
}
root.OFFICE={create, drawPerson};
})(window);
