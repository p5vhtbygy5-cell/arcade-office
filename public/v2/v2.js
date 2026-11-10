/* Arcade Office /v2 dashboard. Reads the same public feed as the live board. */
(function(){
const TZ='Europe/Warsaw';
const POS_LIMIT=10;
const STEP_ROMAN=['0','I','II','III','IV','V','VI'];
const STAGE_NAME=['0','I','II','III','IV'];
const SEATS=['SCAN','VET','BOOK','SIZE','FILLS','RISK'];
const COLS=['SYMBOL','PNL%','1H','6H','24H','MCAP','PASS','ST'];
const COLK=['sym','pnl','h1','h6','h24','mcap','pass','st'];
const $=id=>document.getElementById(id);
const TIMING=window.SIEVE_TIMING||{computeDwells:()=>({dwells:[],budget:0}),isHandoff:it=>!!(it&&it.handoff===true)};
const fixtureOn=/\b(demo|fixture)=1\b/.test(location.search);
const badgeOn=fixtureOn||/\bbadge=fixture\b/.test(location.search);

let me=null, players={}, positions={}, portfolio=null, ticker=null, scan=null;
let botEvents={}, feedAt=0, posEvents=[], chatHist=[], joined=false, myName='';
let fixture=false, lastPosSig='', lastPortSig='', lastPipeSig='', lastChatSig='', lastEvSig='', lastTickSig='';
let statsReady=false;
let sieveBatch=null, sievePlan=null, sieveFrame=null, sieveIdx=0, sieveTimer=null, sievePending=null, sieveHold=false;

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function num(v){const n=+v;return Number.isFinite(n)?n:null;}
function warsawParts(date){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date||new Date());
  const g=t=>+p.find(x=>x.type===t).value;
  return {h:g('hour'),m:g('minute'),s:g('second')};
}
function warsawDayKey(ts){
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts));
}
function fmtPct(v){
  if(v==null||!Number.isFinite(+v)) return '—';
  const n=+v, s=n>0?'+':n<0?'−':'', a=Math.abs(n);
  return s+(a>=100?a.toFixed(0):a>=10?a.toFixed(1):a.toFixed(2))+'%';
}
function fmtMoney(v, sign){
  if(v==null||!Number.isFinite(+v)) return '—';
  const n=+v, s=n<0?'−':(sign&&n>0?'+':'');
  return s+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:n>=100?0:2,maximumFractionDigits:n>=100?0:2});
}
function fmtK(v){
  if(v==null||!Number.isFinite(+v)||+v<=0) return '—';
  const n=+v;
  if(n>=1e12) return '$'+(n/1e12).toFixed(1)+'T';
  if(n>=1e9) return '$'+(n/1e9).toFixed(1)+'B';
  if(n>=1e6) return '$'+(n/1e6).toFixed(1)+'M';
  if(n>=1e3) return '$'+(n/1e3).toFixed(1)+'K';
  return '$'+Math.round(n);
}
function fmtPx(v){
  if(v==null||!Number.isFinite(+v)) return '—';
  const a=Math.abs(+v);
  if(a>=1000) return '$'+Math.round(a).toLocaleString('en-US');
  if(a>=1) return '$'+a.toFixed(2);
  if(a>=0.01) return '$'+a.toFixed(4);
  return '$'+a.toPrecision(3);
}
function pnlOf(p){
  const b=p.pnlBase!=null?p.pnlBase:p.entry;
  if(!b||p.price==null||!Number.isFinite(+p.price)) return NaN;
  return (p.price-b)/b*100*(p.side==='SHORT'?-1:1);
}
function showName(p){return (p&&(p.displaySymbol||p.symbol))||'';}
function initials(name){
  const s=String(name||'').replace(/[^\p{L}\p{N}]+/gu,'');
  return (s.slice(0,2)||'–').toUpperCase();
}
function stageFromPeak(pct){
  const n=+pct;
  if(!Number.isFinite(n)||n<=10) return 0;
  if(n<=25) return 1;
  if(n<=50) return 2;
  if(n<=100) return 3;
  return 4;
}
function stDisplay(p){
  const s=p&&p.steps;
  if(s&&typeof s==='object'){
    if(s.runner) return {txt:'T', kind:'trail'};
    const done=Math.max(0, Math.min(6, s.done|0));
    return {txt:STEP_ROMAN[done]||'0', kind:done?'step':'zero'};
  }
  const peak=p&&(p.peakPct!=null?+p.peakPct:(p.peak!=null?+p.peak:null));
  const st=stageFromPeak(peak);
  return {txt:STAGE_NAME[st]||'0', kind:'peak'};
}
function h24Of(p){
  const v=p.change24h!=null?p.change24h:p.h24;
  return num(v);
}

function fit(){
  const board=$('board');
  if(!board) return;
  if(innerWidth<=900){board.style.transform='';return;}
  const bw=board.offsetWidth||1920, bh=board.offsetHeight||1080;
  const s=Math.min(innerWidth/bw, innerHeight/bh);
  const x=(innerWidth-bw*s)/2, y=(innerHeight-bh*s)/2;
  board.style.transform='translate('+x+'px,'+y+'px) scale('+s+')';
}
fit();
addEventListener('resize', fit);

function paintClock(now){
  const {h,m,s}=warsawParts(now);
  const hr=(h%12)+m/60+s/3600, min=m+s/60, sec=s;
  const set=(id,deg)=>{const el=$(id); if(el) el.setAttribute('transform','rotate('+deg+' 50 50)');};
  set('aoHr', hr*30); set('aoMin', min*6); set('aoSec', sec*6);
  try{$('digitalClock').textContent=new Date(now).toLocaleTimeString('pl-PL',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  catch(e){$('digitalClock').textContent=new Date(now).toLocaleTimeString();}
  if(feedAt){
    const secAgo=Math.max(0,Math.round((Date.now()-feedAt)/1000));
    $('feedAge').textContent='feed '+secAgo+'s';
    $('feedAge').style.color=secAgo>120?'#c07070':'#5a9a6a';
  }
}
(function buildClockNums(){
  const g=document.querySelector('.clockNums'); if(!g) return;
  const labels=['12','1','2','3','4','5','6','7','8','9','10','11'];
  g.innerHTML=labels.map((lab,i)=>{
    const a=(i/12)*Math.PI*2-Math.PI/2, r=32;
    const x=(50+Math.cos(a)*r).toFixed(1), y=(50+Math.sin(a)*r+2.4).toFixed(1);
    return '<text x="'+x+'" y="'+y+'">'+lab+'</text>';
  }).join('');
})();

/* Brass manometers.
   Needle sweep is ±110° from straight up (asset rest pose = 0°).
   Missing values stay at rest (0°, no jitter) and read "—".
   Scale for count/$/% auto-range (POZYCJE fixed 0..10, WIN % fixed 0..100):
   half-span / max is the smallest nice number in {1, 2, 2.5, 4, 5, 8}×10^k
   that is at least max(10, |value|/0.8), so the needle sits at most at 80%.
   TRANSAKCJE is today's OPEN+CLOSE count (Europe/Warsaw), same count the
   previous dial showed — not portfolio.trades (that stays on PORTFEL → TRADES).
   PNL DNIA sums today's CLOSE net ($). WIN % / ROI / PROWIZJE come from portfolio. */
const MANO_V='?v=7';
const MANO_ARC=110;
const GAUGE_DEF=[
  {id:'pos', label:'POZYCJE', signed:false},
  {id:'pnl', label:'PNL DNIA', signed:true},
  {id:'win', label:'WIN %', signed:false},
  {id:'roi', label:'ROI', signed:true},
  {id:'tx', label:'TRANSAKCJE', signed:false},
  {id:'fees', label:'PROWIZJE', signed:false}
];
const TRAINS={
  endL:[
    {s:52,x:-10,y:2,spin:'cw-xslow',plane:'far'},
    {s:40,x:24,y:18,spin:'ccw-slow',plane:'far'},
    {s:32,x:0,y:78,spin:'cw-slow',plane:'far'},
    {s:26,x:36,y:70,spin:'ccw-xslow',plane:'far'},
    {s:42,x:10,y:-4,spin:'ccw-slow',plane:'mid'},
    {s:32,x:-4,y:46,spin:'cw',plane:'mid'},
    {s:36,x:22,y:44,spin:'cw',plane:'front'},
    {s:26,x:2,y:68,spin:'ccw-fast',plane:'front'},
    {s:20,x:34,y:82,spin:'cw-fast',plane:'front'}
  ],
  mid:[
    {s:44,x:-8,y:4,spin:'ccw-xslow',plane:'far'},
    {s:34,x:24,y:28,spin:'cw-slow',plane:'far'},
    {s:26,x:-2,y:78,spin:'ccw-slow',plane:'far'},
    {s:22,x:30,y:72,spin:'cw-xslow',plane:'far'},
    {s:36,x:8,y:16,spin:'cw',plane:'mid'},
    {s:30,x:-4,y:50,spin:'ccw-fast',plane:'front'},
    {s:24,x:26,y:58,spin:'cw-fast',plane:'front'},
    {s:26,x:12,y:84,spin:'ccw',plane:'front'}
  ],
  midB:[
    {s:46,x:-4,y:0,spin:'cw-xslow',plane:'far'},
    {s:32,x:28,y:24,spin:'ccw-slow',plane:'far'},
    {s:30,x:-8,y:64,spin:'cw-slow',plane:'far'},
    {s:22,x:32,y:78,spin:'ccw-xslow',plane:'far'},
    {s:38,x:12,y:20,spin:'ccw',plane:'mid'},
    {s:30,x:0,y:50,spin:'cw',plane:'front'},
    {s:22,x:28,y:64,spin:'ccw-fast',plane:'front'},
    {s:24,x:6,y:86,spin:'cw-fast',plane:'front'}
  ],
  endR:[
    {s:52,x:22,y:2,spin:'ccw-xslow',plane:'far'},
    {s:40,x:-6,y:20,spin:'cw-slow',plane:'far'},
    {s:32,x:30,y:78,spin:'ccw-slow',plane:'far'},
    {s:26,x:0,y:70,spin:'cw-xslow',plane:'far'},
    {s:42,x:10,y:-4,spin:'cw-slow',plane:'mid'},
    {s:32,x:30,y:46,spin:'ccw',plane:'mid'},
    {s:36,x:2,y:42,spin:'ccw',plane:'front'},
    {s:26,x:32,y:68,spin:'cw-fast',plane:'front'},
    {s:20,x:6,y:84,spin:'ccw-fast',plane:'front'}
  ],
  mini:[
    {s:26,x:-2,y:0,spin:'cw-slow',plane:'far'},
    {s:22,x:10,y:12,spin:'ccw',plane:'front'},
    {s:16,x:0,y:26,spin:'cw-fast',plane:'front'},
    {s:18,x:14,y:28,spin:'ccw-fast',plane:'mid'}
  ]
};
const needleState=new Map();
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let needleLoopOn=false;

function needleSpan(abs){
  const need=Math.max(10, Math.abs(+abs||0)/0.8);
  const pow=Math.pow(10, Math.floor(Math.log10(need)));
  const mant=need/pow;
  const nice=mant<=1?1:mant<=2?2:mant<=2.5?2.5:mant<=4?4:mant<=5?5:mant<=8?8:10;
  return nice*pow;
}
function manoAsset(name, hi){
  return '/v2/assets/manometer/'+name+(hi?'@2x':'')+'.webp'+MANO_V;
}
function partImg(name, cls){
  return '<img class="'+cls+'" alt="" draggable="false" decoding="async" src="'+manoAsset(name)+'" srcset="'+manoAsset(name)+' 1x, '+manoAsset(name,true)+' 2x">';
}
function gearImg(plane, px, spin, phase){
  const bucket=px>=46?'lg':px>=32?'md':'sm';
  const name=(plane==='far'?'gear-far-':'gear-front-')+bucket;
  const src=manoAsset(name+'-96');
  const src2=manoAsset(name);
  return '<img class="mg '+plane+' mg-'+spin+'" alt="" draggable="false" decoding="async" src="'+src+'" srcset="'+src+' 1x, '+src2+' 2x" style="animation-delay:-'+phase.toFixed(2)+'s">';
}
function trainBox(variant){
  if(variant==='endL'||variant==='endR') return {w:72,h:130};
  if(variant==='mini') return {w:34,h:48};
  return {w:58,h:130};
}
function gearsHTML(key, variant){
  const box=trainBox(variant);
  return (TRAINS[variant]||TRAINS.mid).map((it,i)=>{
    const left=(it.x/box.w*100).toFixed(2);
    const top=(it.y/box.h*100).toFixed(2);
    const w=(it.s/box.w*100).toFixed(2);
    const h=(it.s/box.h*100).toFixed(2);
    const phase=((i+1)*0.73+(key.length%5)*0.4)%9;
    return gearImg(it.plane, it.s, it.spin, phase).replace('style="','style="left:'+left+'%;top:'+top+'%;width:'+w+'%;height:'+h+'%;');
  }).join('');
}
function trainHTML(key, variant){
  const end=variant==='endL'||variant==='endR';
  return '<div class="train'+(end?' end':'')+'" aria-hidden="true">'+gearsHTML(key,variant)+'</div>';
}
function tickText(val, signed){
  let n=Math.round(val);
  if(!n) n=0;
  const neg=n<0, a=Math.abs(n);
  let body;
  if(a>=1000){
    const k=a/1000;
    body=(a%1000?k.toFixed(1):k.toFixed(0))+'k';
  }else body=String(a);
  return (neg?'−':(signed&&n>0?'+':''))+body;
}
function ticksInner(min, max, signed){
  const majors=5, C=128, k=256/208;
  let out='';
  for(let i=0;i<=majors;i++){
    const t=i/majors;
    const ang=(-MANO_ARC+t*(2*MANO_ARC))*Math.PI/180;
    const x=r=> (C+r*Math.sin(ang)).toFixed(2);
    const y=r=> (C-r*Math.cos(ang)).toFixed(2);
    out+='<line x1="'+x(70*k)+'" y1="'+y(70*k)+'" x2="'+x(82*k)+'" y2="'+y(82*k)+'" stroke="#e8dcc4" stroke-width="2.2" stroke-linecap="round"/>';
    if(i<majors){
      for(let j=1;j<4;j++){
        const t2=(i+j/4)/majors;
        const ang2=(-MANO_ARC+t2*(2*MANO_ARC))*Math.PI/180;
        const mx=r=>(C+r*Math.sin(ang2)).toFixed(2);
        const my=r=>(C-r*Math.cos(ang2)).toFixed(2);
        out+='<line x1="'+mx(74*k)+'" y1="'+my(74*k)+'" x2="'+mx(82*k)+'" y2="'+my(82*k)+'" stroke="#8a7a62" stroke-width="1.2" stroke-linecap="round"/>';
      }
    }
    const val=min+t*(max-min);
    out+='<text x="'+x(54*k)+'" y="'+(parseFloat(y(54*k))+4).toFixed(2)+'" text-anchor="middle" fill="#c8b898" font-size="13" font-family="Barlow Condensed,sans-serif" font-weight="700">'+tickText(val,signed)+'</text>';
  }
  return out;
}
function satImg(kind, place, spin, phase){
  const px=place==='L'||place==='R'?36:place==='L2'||place==='R2'?22:28;
  const plane=kind==='far'?'far':'front';
  return gearImg(plane, px, spin, phase).replace('class="mg ','class="sat '+place+' ');
}
function plaqueFrame(id){
  const g='mf'+id;
  const riv=(x,y)=>'<circle cx="'+x+'" cy="'+y+'" r="2.55" fill="#3a2014" stroke="#1a0e08" stroke-width=".55"/>'+
    '<circle cx="'+x+'" cy="'+y+'" r="1.85" fill="#6a3e28"/>'+
    '<circle cx="'+x+'" cy="'+y+'" r="1.15" fill="#a87850"/>'+
    '<circle cx="'+(x-.4)+'" cy="'+(y-.4)+'" r=".5" fill="#e0b888"/>';
  return '<svg class="frame-svg" viewBox="0 0 200 72" preserveAspectRatio="none" aria-hidden="true">'+
    '<defs>'+
      '<linearGradient id="'+g+'Bevel" x1="0" y1="0" x2="1" y2="1">'+
        '<stop offset="0%" stop-color="#9a6848"/>'+
        '<stop offset="32%" stop-color="#5a3220"/>'+
        '<stop offset="68%" stop-color="#2e1810"/>'+
        '<stop offset="100%" stop-color="#1a0e08"/>'+
      '</linearGradient>'+
      '<linearGradient id="'+g+'Face" x1="0" y1="0" x2="0" y2="1">'+
        '<stop offset="0%" stop-color="var(--mano-face-0)"/>'+
        '<stop offset="48%" stop-color="var(--mano-face-1)"/>'+
        '<stop offset="100%" stop-color="var(--mano-face-2)"/>'+
      '</linearGradient>'+
      '<linearGradient id="'+g+'Gloss" x1="0" y1="0" x2="1" y2="1">'+
        '<stop offset="0%" stop-color="rgba(255,220,170,.10)"/>'+
        '<stop offset="35%" stop-color="rgba(255,200,140,.03)"/>'+
        '<stop offset="100%" stop-color="rgba(0,0,0,0)"/>'+
      '</linearGradient>'+
    '</defs>'+
    '<polygon points="6,0 194,0 200,6 200,66 194,72 6,72 0,66 0,6" fill="#100905"/>'+
    '<polygon points="6.8,.8 193.2,.8 199.2,6.8 199.2,65.2 193.2,71.2 6.8,71.2 .8,65.2 .8,6.8" fill="url(#'+g+'Bevel)"/>'+
    '<polygon points="9.5,3.5 190.5,3.5 196.5,9.5 196.5,62.5 190.5,68.5 9.5,68.5 3.5,62.5 3.5,9.5" fill="#1a100a" stroke="#683E2C" stroke-width=".7"/>'+
    '<polygon points="11.5,5.5 188.5,5.5 194.5,11.5 194.5,60.5 188.5,66.5 11.5,66.5 5.5,60.5 5.5,11.5" fill="url(#'+g+'Face)"/>'+
    '<polygon points="11.5,5.5 188.5,5.5 194.5,11.5 194.5,60.5 188.5,66.5 11.5,66.5 5.5,60.5 5.5,11.5" fill="url(#'+g+'Gloss)"/>'+
    '<polyline points="12,6 188,6 194,12" fill="none" stroke="#c49068" stroke-width=".9" opacity=".55"/>'+
    '<polyline points="6.5,12 6.5,60" fill="none" stroke="#b08058" stroke-width=".7" opacity=".4"/>'+
    '<polyline points="12,66 188,66 194,60" fill="none" stroke="#1a0e08" stroke-width="1.1" opacity=".7"/>'+
    riv(10.5,10.5)+riv(189.5,10.5)+riv(10.5,61.5)+riv(189.5,61.5)+
  '</svg>';
}
function unitHTML(g){
  const signed=g.signed?1:0;
  const sc=g.id==='win'?{min:0,max:100}:g.id==='pos'?{min:0,max:POS_LIMIT}:g.signed?{min:-10,max:10}:{min:0,max:10};
  return '<div class="mano" data-id="'+g.id+'" data-signed="'+signed+'" role="img" aria-label="'+g.label+' —">'+
    satImg('far','Lf','ccw-xslow',1.1)+satImg('far','Rf','cw-xslow',2.4)+
    '<div class="dial">'+
      partImg('gauge-face','layer face')+
      '<svg class="layer ticks" viewBox="0 0 256 256" aria-hidden="true">'+ticksInner(sc.min,sc.max,g.signed)+'</svg>'+
      partImg('gauge-bezel','layer bezel')+
      partImg('gauge-needle','layer needle')+
      '<div class="layer face-val val">—</div>'+
    '</div>'+
    satImg('front','L','cw-fast',0.4)+satImg('front','R','ccw-fast',1.7)+
    satImg('front','L2','ccw',2.2)+satImg('front','R2','cw',0.9)+
    '<div class="mano-plaque">'+plaqueFrame(g.id)+
      '<div class="txt"><div class="lbl">'+g.label+'</div><div class="val">—</div></div></div></div>';
}
function mountGauges(){
  const root=$('gauges'); if(!root) return;
  const variants=['mid','midB','mid','midB','mid'];
  let html=trainHTML('T0','endL');
  GAUGE_DEF.forEach((g,i)=>{
    let mini='';
    if(i%3!==2) mini+= '<div class="mini-train mt-br" aria-hidden="true">'+gearsHTML('m'+i+'r','mini')+'</div>';
    if(i%3===0) mini+= '<div class="mini-train mt-bl" aria-hidden="true">'+gearsHTML('m'+i+'l','mini')+'</div>';
    html+='<div class="mano-cell">'+unitHTML(g)+mini+'</div>';
    if(i<GAUGE_DEF.length-1) html+=trainHTML('T'+(i+1), variants[i]);
  });
  html+=trainHTML('T6','endR');
  root.innerHTML=html;
  root.querySelectorAll('.needle').forEach(el=>{
    needleState.set(el,{goal:0,base:0,off:0,target:0,next:performance.now()+180+Math.random()*700,live:false});
  });
  ensureNeedleLoop();
}
function setMano(id, text, tone, min, max, value){
  const el=document.querySelector('#gauges .mano[data-id="'+id+'"]'); if(!el) return;
  const live=value!=null&&Number.isFinite(+value);
  const sig=text+'|'+tone+'|'+min+'|'+max+'|'+(live?1:0);
  if(el.dataset.sig!==sig){
    el.dataset.sig=sig;
    el.querySelectorAll('.val').forEach(n=>{
      n.textContent=text;
      n.classList.remove('pos','neg');
      if(tone) n.classList.add(tone);
    });
    const lbl=el.querySelector('.lbl');
    el.setAttribute('aria-label',(lbl?lbl.textContent:id)+' '+text);
    const sk=min+'|'+max;
    if(el.dataset.scale!==sk){
      el.dataset.scale=sk;
      const svg=el.querySelector('.ticks');
      if(svg) svg.innerHTML=ticksInner(min,max,el.dataset.signed==='1');
    }
  }
  const st=needleState.get(el.querySelector('.needle'));
  if(!st) return;
  if(live){
    const t=Math.max(0, Math.min(1, (+value-min)/((max-min)||1)));
    st.goal=-MANO_ARC+t*(2*MANO_ARC);
    st.live=true;
  }else{
    st.goal=0;
    st.live=false;
  }
}
function stepNeedles(now){
  const reduce=reduceMotion.matches;
  needleState.forEach(s=>{
    const el=s.el;
    if(!el) return;
    if(reduce){
      s.base=s.goal; s.off=0; s.target=0; s.holdUntil=0;
    }else{
      s.base+=(s.goal-s.base)*0.12;
      if(!s.live){ s.target=0; s.holdUntil=0; }
      else if(now>=s.next){
        // Irregular analog flick: mostly ±0.45..1.2°, sometimes ±1.35..2°, then settle.
        // Not a fixed-amplitude sine — new random sign, size, and gap each time.
        const strong=Math.random()<0.18;
        const amp=strong?(1.35+Math.random()*0.65):(0.45+Math.random()*0.75);
        s.target=(Math.random()*2-1)*amp;
        s.holdUntil=now+(strong?110:55)+Math.random()*80;
        s.next=now+140+Math.random()*760;
      }
      if(s.holdUntil && now<s.holdUntil) s.off+=(s.target-s.off)*0.42;
      else{ s.target*=0.86; s.off+=(s.target-s.off)*0.22; }
    }
    el.style.transform='rotate('+((s.base+s.off).toFixed(3))+'deg)';
  });
}
function needleFrame(now){
  needleLoopOn=true;
  stepNeedles(now);
  if(document.hidden){needleLoopOn=false;return;}
  requestAnimationFrame(needleFrame);
}
function ensureNeedleLoop(){ if(!needleLoopOn && !document.hidden) requestAnimationFrame(needleFrame); }
document.addEventListener('visibilitychange', ensureNeedleLoop);
reduceMotion.addEventListener&&reduceMotion.addEventListener('change', ()=>stepNeedles(performance.now()));
mountGauges();
needleState.forEach((s,el)=>{s.el=el;});

function dayStats(evs){
  const day=warsawDayKey(Date.now());
  let pnl=0, hasPnl=false, trades=0;
  for(const e of evs||[]){
    if(!e||!e.ts) continue;
    if(warsawDayKey(e.ts)!==day) continue;
    if(e.action==='OPEN'||e.action==='CLOSE') trades++;
    if(e.action==='CLOSE' && e.net!=null && Number.isFinite(+e.net)){pnl+=+e.net; hasPnl=true;}
  }
  return {pnl:hasPnl?pnl:null, trades};
}

function passHtml(pass){
  const n=(pass&&pass.n)|0, w=(pass&&pass.wins)|0, l=(pass&&pass.losses)|0;
  if(!n) return '<span class="pw">0</span>';
  return '<span class="pw">'+n+'</span><span>(</span><span class="pg">'+w+'</span><span>,</span><span class="pr">'+l+'</span><span>)</span>';
}
function cellClass(kind, val, extra){
  if(kind==='st'&&(extra==='trail'||val==='T')) return 'pl-gold';
  if(kind==='sym'||kind==='mcap'||kind==='pass'||kind==='st') return 'pl-ivory';
  if(kind==='pnl'||kind==='h1'||kind==='h6'||kind==='h24'){
    if(val==null||!Number.isFinite(+val)) return 'pl-ivory';
    if(+val>0) return 'pl-pos';
    if(+val<0) return 'pl-neg';
    return 'pl-ivory';
  }
  return 'pl-ivory';
}
function renderPosHead(){
  $('posHead').innerHTML=COLS.map((c,i)=>'<div class="pl-cell pl-ivory c-'+COLK[i]+'">'+c+'</div>').join('');
}
renderPosHead();

function rankedPositions(){
  return Object.values(positions).sort((a,b)=>(b.openedAt||0)-(a.openedAt||0)||String(a.id).localeCompare(String(b.id))).slice(0,POS_LIMIT);
}
function renderPositions(){
  const rows=rankedPositions();
  const sig=rows.map(p=>[p.id,showName(p),pnlOf(p),p.h1,p.h6,h24Of(p),p.mcap,p.pass&&p.pass.n,stDisplay(p).txt,stDisplay(p).kind].join(',')).join('|');
  if(sig===lastPosSig) return;
  lastPosSig=sig;
  const empty=$('posEmpty');
  if(empty) empty.style.display=rows.length?'none':'block';
  const note=$('posNote');
  if(note) note.textContent=rows.length?rows.length+' / '+POS_LIMIT:'brak';
  const html=[];
  for(let i=0;i<POS_LIMIT;i++){
    const p=rows[i];
    if(!p){
      if(innerWidth<=900) continue;
      html.push('<div class="pl-row">'+COLK.map(k=>'<div class="pl-cell pl-empty c-'+k+'"></div>').join('')+'</div>');
      continue;
    }
    const pnl=pnlOf(p), h1=num(p.h1), h6=num(p.h6!=null?p.h6:p.change6h), h24=h24Of(p);
    const st=stDisplay(p);
    const cells=[
      {k:'sym', t:showName(p), v:null},
      {k:'pnl', t:fmtPct(Number.isFinite(pnl)?pnl:null), v:Number.isFinite(pnl)?pnl:null},
      {k:'h1', t:fmtPct(h1), v:h1},
      {k:'h6', t:fmtPct(h6), v:h6},
      {k:'h24', t:fmtPct(h24), v:h24},
      {k:'mcap', t:fmtK(p.mcap), v:null},
      {k:'pass', html:passHtml(p.pass), v:null},
      {k:'st', t:st.txt, v:st.txt, extra:st.kind}
    ];
    html.push('<div class="pl-row">'+cells.map(c=>{
      const cls='pl-cell '+cellClass(c.k,c.v,c.extra)+' c-'+c.k;
      if(c.html) return '<div class="'+cls+' pl-pass">'+c.html+'</div>';
      return '<div class="'+cls+'">'+esc(c.t)+'</div>';
    }).join('')+'</div>');
  }
  $('posBody').innerHTML=html.join('');
}

function grabTok(text, re){
  const m=re.exec(String(text||''));
  return m?m[1].replace(/[.,;:)]+$/,'').slice(0,32):null;
}
function lastActivity(bot){
  const acts=(chatHist||[]).filter(a=>String(a.bot||'').toUpperCase()===bot);
  const evs=(botEvents[bot]||[]).map(x=>({bot,text:x.text,ts:x.ts,kind:''}));
  return acts.concat(evs).sort((a,b)=>(Date.parse(b.ts)||0)-(Date.parse(a.ts)||0));
}
function parseCount(text, re){
  const m=re.exec(String(text||''));
  return m&&Number.isFinite(+m[1])?+m[1]:null;
}
function reasonOf(text){
  const t=String(text||'');
  const dash=t.split(/\s[-–—]\s/);
  if(dash.length>1) return dash[dash.length-1].replace(/[.]/g,'').slice(0,18);
  return '';
}
function tokenImage(sym){
  const up=String(sym||'').toUpperCase();
  for(const p of Object.values(positions)){
    if([p.symbol,p.displaySymbol].some(s=>String(s||'').toUpperCase()===up)) return p.image||null;
  }
  const toks=(scan&&scan.tokens)||[];
  for(const t of toks){
    if([t.symbol,t.displaySymbol,t.name].some(s=>String(s||'').toUpperCase()===up)) return t.image||null;
  }
  return null;
}
function currentScanTok(){
  if(!scan||!scan.tokens||!scan.tokens.length) return null;
  const i=Math.max(0, scan.index|0)%scan.tokens.length;
  return scan.tokens[i];
}
function seatState(bot){
  const lines=lastActivity(bot);
  let token=null, count=null, tag=null, image=null;
  const pick=re=>{for(const a of lines){const t=grabTok(a.text,re); if(t) return t;} return null;};
  if(bot==='SCAN' && sieveFrame) return sieveFrame;
  if(bot==='SCAN'){
    const tok=currentScanTok();
    token=tok?(tok.displaySymbol||tok.symbol):pick(/Skan(?:uję|uje|):\s*(\S+)/i)||pick(/token(?:ow|ów)?\b.*?(\p{L}[\p{L}\p{N}_-]{1,20})/u);
    if(tok){image=tok.image||null; tag=tok.reason||null;}
    for(const a of lines){
      const n=parseCount(a.text,/Skan:?\s*(\d+)/i)||parseCount(a.text,/Przeskanowa[lłeę]m\s+(\d+)/i);
      if(n!=null){count=n; break;}
    }
    if(count==null&&scan&&scan.total) count=scan.total;
  }else if(bot==='VET'){
    token=pick(/Przepuszczam\s+(\S+)/i)||pick(/Odrzuci[łl]em\s+(\S+)/i)||pick(/Odrzucam\s+(\S+)/i);
    for(const a of lines){
      const n=parseCount(a.text,/Weryfikacja:\s*(\d+)/i)||parseCount(a.text,/przesz[lł]o sito.*?(\d+)/i)||parseCount(a.text,/,\s*(\d+)\s+przesz/);
      if(n!=null){count=n; break;}
      const why=reasonOf(a.text); if(!tag&&/Odrzuc/i.test(a.text)&&why) tag=why;
    }
    if(count==null&&scan&&scan.tokens){
      const bad=/reject|missing|not_enriched|cheap|chp/i;
      count=scan.tokens.filter(t=>t.stage&&!bad.test(String(t.stage))).length||null;
    }
    if(!tag&&scan&&scan.tokens){
      const rej=scan.tokens.find(t=>/reject/i.test(String(t.stage||''))&&t.reason);
      if(rej) tag=rej.reason;
    }
  }else if(bot==='BOOK'){
    token=pick(/wyb[oó]r:\s*(\S+)/i)||pick(/Wybieram\s+(\S+)/i)||pick(/Wystawi[łl]em\s+(\S+)/i);
    for(const a of lines){const n=parseCount(a.text,/Przekaza[łl]em\s+(\d+)/i)||parseCount(a.text,/Przekazuj[ęe]\s+(\d+)/i); if(n!=null){count=n;break;}}
    if(count==null&&scan&&scan.tokens) count=scan.tokens.filter(t=>/picked|hard_pass|soft_pass/i.test(String(t.stage||''))).length||null;
    for(const a of lines){const why=reasonOf(a.text); if(why){tag=why;break;}}
  }else if(bot==='SIZE'){
    token=pick(/bilet[^\n]{0,24}?([A-Z][A-Z0-9]{1,15})/i)||pick(/([A-Z][A-Z0-9]{1,15})\s+bilet/i)||pick(/SIZE[:\s]+([A-Z0-9]{2,16})/i);
    for(const a of lines){
      const n=parseCount(a.text,/Przekaza[łl]em\s+(\d+)/i)||parseCount(a.text,/Przekazuj[ęe]\s+(\d+)/i);
      if(n!=null){count=n;break;}
    }
    for(const a of lines){const why=reasonOf(a.text); if(why){tag=why;break;}}
  }else if(bot==='FILLS'){
    token=pick(/Wypelnione:?\s*(\S+)/i)||pick(/Wypełnione:?\s*(\S+)/i)||pick(/wypełnione:?\s*(\S+)/i);
    for(const a of lines){
      const n=parseCount(a.text,/Przekaza[łl]em\s+(\d+)/i)||parseCount(a.text,/Przekazuj[ęe]\s+(\d+)/i);
      if(n!=null){count=n;break;}
    }
    if(count==null&&scan&&scan.tokens) count=scan.tokens.filter(t=>/filled|held_skip/i.test(String(t.stage||''))).length||null;
    for(const a of lines){const why=reasonOf(a.text); if(why){tag=why;break;}}
  }else if(bot==='RISK'){
    token=pick(/Pilnuje\s+([^:]{1,40}?)(?::|$)/i)||pick(/Zamykam\s+(\S+)/i);
    if(!token){
      const open=rankedPositions()[0];
      token=open?showName(open):null;
      if(open) image=open.image||null;
    }
    count=Object.keys(positions).length||null;
    for(const a of lines){const why=reasonOf(a.text); if(why){tag=why;break;}}
  }
  if(token) token=String(token).replace(/[<>]/g,'').slice(0,24);
  if(!image&&token) image=tokenImage(token);
  if(!tag&&token&&scan&&Array.isArray(scan.tokens)){
    const hit=scan.tokens.find(x=>[x.symbol,x.displaySymbol].some(s=>String(s||'').toUpperCase()===String(token).toUpperCase()));
    if(hit&&hit.reason) tag=hit.reason;
  }
  return {
    token:token||null,
    count:count==null?null:count,
    tag:(tag&&String(tag).replace(/[<>]/g,'').slice(0,18))||null,
    image:image||null
  };
}
function stationHtml(bot, st){
  const tok=st.token||'–';
  const ini=st.token?esc(initials(st.token)):'–';
  const scanPlate=bot==='SCAN';
  const thumb=st.image
    ? '<div class="thumb"><img alt="" src="'+esc(st.image)+'" onerror="'+(scanPlate?'this.parentNode.classList.add(\'ph\');this.remove()':'this.parentNode.textContent=\''+ini+'\'')+'"></div>'
    : (scanPlate&&st.usePlaceholder?'<div class="thumb ph"></div>':'<div class="thumb">'+ini+'</div>');
  const count=st.count==null?'–':String(st.count|0);
  const dlen=count.length>=4?' d4':count.length===3?' d3':'';
  const tag=st.tag||'–';
  const n=[...String(tok)].length;
  const tcls=n>=14?' xs':n>=10?' xlong':n>=7?' long':'';
  const stamp=st.pass?'<span class="stamp" aria-hidden="true"><span class="ring"></span><span class="lab">PASS</span></span>':'';
  const tagLen=[...String(tag)].length;
  return '<div class="frame" aria-hidden="true"></div>'+
    '<div class="inner" aria-hidden="true"></div>'+
    '<div class="lamp" aria-hidden="true"></div>'+
    '<div class="body">'+
      '<div class="botname">'+esc(bot)+'</div>'+
      '<div class="tok">'+thumb+stamp+
        '<span class="tname'+tcls+'">'+esc(tok)+'</span></div>'+
      '<div class="nixie"><div class="shell" aria-hidden="true"></div><div class="digit'+dlen+'">'+esc(count)+'</div></div>'+
      '<div class="tag'+(st.tag?'':' empty')+(st.pass?' passc':'')+'"><span class="txt'+(tagLen>14?' sm':'')+'">'+esc(tag)+'</span></div>'+
    '</div>';
}
function renderPipeline(){
  const states={};
  for(const b of SEATS) states[b]=seatState(b);
  const sig=JSON.stringify(states);
  if(sig===lastPipeSig) return;
  lastPipeSig=sig;
  document.querySelectorAll('.station').forEach(el=>{
    const bot=el.getAttribute('data-seat');
    const st=states[bot]||{};
    const part=JSON.stringify(st);
    if(el.dataset.sig===part) return;
    el.dataset.sig=part;
    el.innerHTML=stationHtml(bot, st);
    if(st.pass){
      const key=String(st.token)+'|'+String(st.count);
      if(el.dataset.passKey!==key){
        el.classList.remove('pass');
        void el.offsetWidth;
        el.classList.add('pass');
        el.dataset.passKey=key;
      }else if(!el.classList.contains('pass')) el.classList.add('pass');
    }else{
      el.classList.remove('pass');
      delete el.dataset.passKey;
    }
    if(bot==='SCAN'&&sieveFrame){
      const tok=el.querySelector('.tok');
      if(tok){tok.classList.add('swap'); setTimeout(()=>tok.classList.remove('swap'), 180);}
    }
  });
}

function clearSieveTimer(){ if(sieveTimer){ clearTimeout(sieveTimer); sieveTimer=null; } }
function sieveTag(it, pass){
  if(pass) return 'PASS → VET';
  let r=String((it&&(it.reason||it.stage))||'–').replace(/[<>]/g,'');
  const chars=[...r];
  if(chars.length>18) r=chars.slice(0,17).join('')+'…';
  return r||'–';
}
function sieveCountAt(items, i){
  const pass=TIMING.isHandoff(items[i]);
  const upto=pass?i+1:i;
  let n=0;
  for(let k=0;k<upto;k++) if(TIMING.isHandoff(items[k])) n++;
  return n;
}
function showSieve(i, opts){
  if(!sieveBatch||!sieveBatch.items||!sieveBatch.items[i]) return;
  const it=sieveBatch.items[i];
  const pass=TIMING.isHandoff(it);
  sieveIdx=i;
  const name=it.symbol||'–';
  sieveFrame={
    token:name,
    count:sieveCountAt(sieveBatch.items, i),
    tag:sieveTag(it, pass),
    image:it.image||null,
    pass:pass,
    usePlaceholder:!it.image
  };
  lastPipeSig='';
  renderPipeline();
  if(opts&&opts.sound&&pass) sfxPlay('scan_pass');
}
function cycleHasZone(ts){
  return /(?:z|[+-]\d{2}(?::?\d{2})?)$/i.test(String(ts||'').trim());
}
function warsawOffsetMs(utcMs){
  try{
    const fmt=new Intl.DateTimeFormat('en-US',{timeZone:TZ,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const g={};
    for(const p of fmt.formatToParts(new Date(utcMs))) if(p.type!=='literal') g[p.type]=p.value;
    const hour=+g.hour;
    const asUTC=Date.UTC(+g.year,+g.month-1,+g.day,hour===24?0:hour,+g.minute,+g.second);
    return asUTC-utcMs+(hour===24?86400000:0);
  }catch(e){ return 3600000; }
}
function warsawSuffix(ts){
  const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(ts||'').trim());
  if(!m) return '+01:00';
  const wall=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));
  const off=warsawOffsetMs(wall-warsawOffsetMs(wall));
  if(!Number.isFinite(off)) return '+01:00';
  const sign=off>=0?'+':'-';
  const mins=Math.abs(Math.round(off/60000));
  return sign+String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
}
// cycleTs is the SCAN cycle start. The sieve is published batch_s later, so playback
// starts there. A zoneless stamp is desk-local Europe/Warsaw (CET/CEST).
function sieveOriginMs(sv){
  if(!sv) return NaN;
  const raw=String(sv.cycleTs==null?'':sv.cycleTs).trim();
  let t0=Date.parse(raw);
  if(raw&&!cycleHasZone(raw)) t0=Date.parse(raw+warsawSuffix(raw));
  const batch=Number(sv.batch_s);
  return Number.isFinite(t0)?t0+(batch>0?batch:0)*1000:NaN;
}
function sieveEndMs(){
  if(!sieveBatch) return null;
  const origin=sieveOriginMs(sieveBatch);
  const iv=(Number(sieveBatch.interval_s)>0?Number(sieveBatch.interval_s):120)*1000;
  return Number.isFinite(origin)?origin+iv:null;
}
function scheduleSieve(ms){
  clearSieveTimer();
  if(sieveHold) return;
  sieveTimer=setTimeout(advanceSieve, Math.max(0, Math.round(ms)||0));
}
function advanceSieve(){
  sieveTimer=null;
  if(sieveHold) return;
  if(sievePending){
    const next=sievePending; sievePending=null;
    startSieve(next);
    return;
  }
  if(!sieveBatch||!sievePlan) return;
  const items=sieveBatch.items, dwells=sievePlan.dwells||[];
  const end=sieveEndMs();
  let j=sieveIdx+1;
  while(j<items.length){
    const d=dwells[j]||0;
    if(d<=0){ j++; continue; }
    if(!TIMING.isHandoff(items[j]) && end!=null && Date.now()+d>end+50){ j++; continue; }
    break;
  }
  if(j>=items.length) return;
  showSieve(j, {sound:true});
  scheduleSieve(dwells[j]||0);
}
function holdIndex(items, hold){
  if(typeof hold==='number'&&Number.isFinite(hold)) return Math.max(0, Math.min(items.length-1, hold|0));
  if(hold==='pass'){
    const i=items.findIndex(it=>TIMING.isHandoff(it));
    return i<0?0:i;
  }
  const i=items.findIndex(it=>!TIMING.isHandoff(it));
  return i<0?0:i;
}
function startSieve(sv){
  clearSieveTimer();
  sievePending=null;
  sieveBatch=sv;
  sievePlan=TIMING.computeDwells(sv.items, sv.interval_s||120);
  const items=sv.items, dwells=sievePlan.dwells||[];
  const hold=window.__SIEVE_HOLD;
  if(hold){
    sieveHold=true;
    showSieve(holdIndex(items, hold), {sound:false});
    return;
  }
  sieveHold=false;
  let elapsed=0;
  const t0=sieveOriginMs(sv);
  if(Number.isFinite(t0)) elapsed=Math.max(0, Date.now()-t0);
  let i=0, acc=0;
  while(i<items.length-1 && acc+(dwells[i]||0)<=elapsed){ acc+=(dwells[i]||0); i++; }
  while(i<items.length-1 && !(dwells[i]>0)) i++;
  let into=Math.max(0, elapsed-acc);
  let dwell=dwells[i]||0;
  const finished=elapsed>0 && acc+dwell<=elapsed;
  if(finished){
    i=0; acc=0; into=0;
    while(i<items.length-1 && !(dwells[i]>0)) i++;
    dwell=dwells[i]||0;
  }
  const fresh=!finished && i===0 && into<400;
  showSieve(i, {sound:fresh});
  if(dwell>into) scheduleSieve(dwell-into);
}
function stopSieve(){
  clearSieveTimer();
  sieveBatch=null; sievePlan=null; sieveFrame=null; sievePending=null; sieveHold=false; sieveIdx=0;
  lastPipeSig='';
  document.querySelectorAll('.station').forEach(el=>{ delete el.dataset.sig; delete el.dataset.passKey; el.classList.remove('pass'); });
}
function noteSieve(sv){
  if(!sv||typeof sv!=='object'||!Array.isArray(sv.items)||!sv.items.length){
    if(sieveBatch) stopSieve();
    return;
  }
  const id=String(sv.batch_id||sv.cycleTs||'');
  const cur=sieveBatch?String(sieveBatch.batch_id||sieveBatch.cycleTs||''):'';
  if(sieveBatch&&id&&id===cur) return;
  startSieve(sv);
}
function holdSieve(which){
  if(!sieveBatch) return null;
  sieveHold=true;
  clearSieveTimer();
  const i=holdIndex(sieveBatch.items, which);
  showSieve(i, {sound:false});
  return sieveFrame;
}

const SFX_GAIN={scan_pass:0.600, vet_pass:0.636, book_pass:0.672, size_pass:0.708, fills_pass:0.744, risk_profit:0.900, risk_loss:0.900};
const SFX_FILES=Object.keys(SFX_GAIN);
const SPEAKER_KEY='ao.v2.speaker';
let speakerOn=false, sfxCtx=null, sfxUnlocked=false;
const sfxBuf={}, sfxRecent={}, sfxLog=[];
try{ speakerOn=localStorage.getItem(SPEAKER_KEY)==='on'; }catch(e){}
function sfxUrl(name, ext){ return '/v2/assets/sounds/'+name+'.'+ext; }
async function sfxLoad(name){
  if(sfxBuf[name]) return sfxBuf[name];
  if(!sfxCtx) return null;
  const load=async ext=>{
    const res=await fetch(sfxUrl(name, ext));
    if(!res.ok) throw new Error(ext);
    const ab=await res.arrayBuffer();
    return sfxCtx.decodeAudioData(ab.slice(0));
  };
  try{ sfxBuf[name]=await load('mp3'); }
  catch(e){ sfxBuf[name]=await load('ogg'); }
  return sfxBuf[name];
}
function sfxPreload(){ SFX_FILES.forEach(n=>{ sfxLoad(n).catch(()=>{}); }); }
async function sfxUnlock(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return false;
  if(!sfxCtx) sfxCtx=new AC();
  if(sfxCtx.state!=='running'){ try{ await sfxCtx.resume(); }catch(e){} }
  sfxUnlocked=sfxCtx.state==='running';
  if(sfxUnlocked) sfxPreload();
  return sfxUnlocked;
}
function sfxPlay(name){
  if(!speakerOn||!sfxUnlocked||!sfxCtx||sfxCtx.state!=='running') return false;
  if(!SFX_GAIN[name]) return false;
  const now=performance.now();
  const recent=(sfxRecent[name]||[]).filter(t=>now-t<1000);
  if(recent.length>=3){ sfxRecent[name]=recent; return false; }
  recent.push(now); sfxRecent[name]=recent;
  sfxLog.push({id:name, t:Date.now()});
  if(sfxLog.length>40) sfxLog.shift();
  sfxLoad(name).then(buf=>{
    if(!buf||!speakerOn||!sfxCtx) return;
    const src=sfxCtx.createBufferSource();
    const g=sfxCtx.createGain();
    g.gain.value=SFX_GAIN[name];
    src.buffer=buf; src.connect(g); g.connect(sfxCtx.destination);
    src.start();
  }).catch(()=>{});
  return true;
}
const SPK_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M16 9.5l4 5M20 9.5l-4 5"/></svg>';
const SPK_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h3l4 3V7L7 10H4z"/><path d="M16 9a3.2 3.2 0 010 6"/><path d="M18.2 7a6 6 0 010 10"/></svg>';
function paintAudio(){
  const btn=$('audioBtn'); if(!btn) return;
  btn.classList.toggle('on', speakerOn);
  btn.classList.toggle('live', speakerOn&&sfxUnlocked);
  btn.setAttribute('aria-pressed', speakerOn?'true':'false');
  btn.setAttribute('aria-label', speakerOn?(sfxUnlocked?'Dźwięk włączony':'Dźwięk włączony, kliknij aby odblokować'):'Dźwięk wyłączony');
  btn.innerHTML=speakerOn?SPK_ON:SPK_OFF;
}
function maybeSizeSound(m){
  if(!m||!m.system) return;
  const bot=String(m.bot||'').toUpperCase();
  if(bot!=='SIZE') return;
  const kind=String(m.kind||'');
  const text=String(m.text||'');
  if(kind==='handoff'||/Przekazuj[ęe]|Przekaza[łl]em|Przekazuje/i.test(text)) sfxPlay('size_pass');
}

function renderGauges(){
  const open=Object.keys(positions).length;
  setMano('pos', open+' / '+POS_LIMIT, '', 0, POS_LIMIT, open);
  const ds=dayStats(posEvents);
  if(!statsReady){
    setMano('pnl','—','',-10,10,null);
    setMano('tx','—','',0,10,null);
  }else{
    const pnl=ds.pnl;
    const ps=pnl==null?10:needleSpan(pnl);
    setMano('pnl', pnl==null?'—':fmtMoney(pnl,true), pnl==null?'':(pnl>0?'pos':pnl<0?'neg':''), -ps, ps, pnl);
    const txMax=needleSpan(ds.trades);
    setMano('tx', String(ds.trades), '', 0, txMax, ds.trades);
  }
  const pf=portfolio;
  const win=pf&&Number.isFinite(+pf.winRate)?+pf.winRate:null;
  setMano('win', win==null?'—':Math.round(win)+'%', '', 0, 100, win);
  const roi=pf&&Number.isFinite(+pf.roiPct)?+pf.roiPct:null;
  const rs=roi==null?10:needleSpan(roi);
  setMano('roi', roi==null?'—':fmtPct(roi), roi==null?'':(roi>0?'pos':roi<0?'neg':''), -rs, rs, roi);
  const feeRaw=pf&&(pf.fees!=null?pf.fees:pf.feesUsd);
  const fees=feeRaw!=null&&Number.isFinite(+feeRaw)?+feeRaw:null;
  const fs=fees==null?10:needleSpan(fees);
  setMano('fees', fees==null?'—':fmtMoney(fees,false), '', 0, fs, fees);
}

function toneClass(v){return v==null||!Number.isFinite(+v)?'':(+v>0?'pos':+v<0?'neg':'');}
function renderPort(){
  const pf=portfolio;
  const sig=pf?JSON.stringify([pf.bank,pf.roiPct,pf.winRate,pf.trades,pf.fees,pf.series&&pf.series.length,pf.mode]):'empty';
  if(sig===lastPortSig) {return;}
  lastPortSig=sig;
  $('portBank').textContent=pf&&pf.bank!=null?fmtMoney(pf.bank,false):'—';
  const roi=$('portRoi'); roi.textContent=fmtPct(pf&&pf.roiPct); roi.className=toneClass(pf&&pf.roiPct);
  const win=$('portWin'); win.textContent=pf&&pf.winRate!=null?Math.round(pf.winRate)+'%':'—'; win.className=toneClass(pf&&pf.winRate);
  $('portTrades').textContent=pf&&pf.trades!=null?String(pf.trades):'—';
  const fees=pf&&(pf.fees!=null?pf.fees:pf.feesUsd);
  $('portFees').textContent=fees==null?'—':fmtMoney(fees,false);
  $('portNote').textContent=pf&&pf.mode?pf.mode:'';
  drawBank($('portChart'), pf);
}
function drawBank(cv, pf){
  if(!cv) return;
  const dpr=Math.min(2, devicePixelRatio||1);
  const w=cv.clientWidth||520, h=cv.clientHeight||160;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);}
  const g=cv.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);
  g.fillStyle='#0c0906'; g.fillRect(0,0,w,h);
  const series=(pf&&Array.isArray(pf.series)?pf.series:[]).filter(x=>x&&x.ts&&x.bank!=null);
  if(series.length<2){
    g.fillStyle='#6a5e4a'; g.font='13px Chakra Petch,sans-serif';
    g.fillText(pf&&pf.bank!=null?'za mało punktów':'brak historii', 12, h/2);
    return;
  }
  const xs=series.map(x=>x.ts), ys=series.map(x=>+x.bank);
  const minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs)||minX+1;
  const minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
  const pad=8, spanY=(maxY-minY)||1;
  const X=t=>pad+(t-minX)/(maxX-minX||1)*(w-pad*2);
  const Y=v=>h-pad-(v-minY)/spanY*(h-pad*2);
  g.beginPath();
  series.forEach((p,i)=>{const x=X(p.ts), y=Y(p.bank); if(i) g.lineTo(x,y); else g.moveTo(x,y);});
  const last=ys[ys.length-1], first=ys[0];
  g.strokeStyle=last>=first?'#5a9a6a':'#9a3a3a';
  g.lineWidth=2; g.stroke();
  g.lineTo(X(xs[xs.length-1]), h-pad); g.lineTo(X(xs[0]), h-pad); g.closePath();
  g.fillStyle=last>=first?'rgba(90,154,106,.18)':'rgba(154,58,58,.18)';
  g.fill();
}

function formatAct(a){
  const raw=String(a.text||'');
  const tm=/^\d\d:\d\d /.test(raw)?raw.slice(0,6):'', bt=tm?raw.slice(6):raw;
  const time=tm||(a.ts?new Date(a.ts).toLocaleTimeString('pl-PL',{timeZone:TZ,hour:'2-digit',minute:'2-digit'})+' ':'');
  return {bot:a.bot, time, text:bt, ts:a.ts};
}
function tsOf(v){
  const n=typeof v==='number'?v:Date.parse(v);
  return Number.isFinite(n)?n:0;
}
function chatLines(){
  const extra=[];
  for(const bot of Object.keys(botEvents||{})){
    for(const ev of botEvents[bot]||[]) extra.push({ts:ev.ts, bot, text:ev.text, kind:'botEvent'});
  }
  const all=chatHist.concat(extra).sort((a,b)=>tsOf(a.ts)-tsOf(b.ts));
  const seen=new Set(), out=[];
  for(const a of all){
    const k=(a.bot||'')+'|'+(String(a.text||'').replace(/^\d\d:\d\d /,''));
    if(seen.has(k)) continue; seen.add(k); out.push(a);
  }
  return out.slice(-80);
}
function renderChat(){
  const lines=chatLines();
  const sig=lines.map(a=>(a.bot||'')+'|'+(a.text||'')+'|'+(a.ts||'')).join('\n');
  if(sig===lastChatSig) return;
  lastChatSig=sig;
  const el=$('log');
  const follow=el.scrollHeight-el.scrollTop-el.clientHeight<=8;
  const keep=el.scrollTop;
  el.innerHTML=lines.map(a=>{
    const f=formatAct(a);
    return '<div class="sys"><span class="tag">'+esc(f.time)+'</span><b>'+esc(a.bot||a.name||'')+'</b>: '+esc(f.text)+'</div>';
  }).join('')||'<div class="sys">brak wpisów</div>';
  el.scrollTop=follow?el.scrollHeight:keep;
}
function renderEvents(){
  const evs=posEvents.slice(0,50);
  const sig=evs.map(e=>e.ts+'|'+e.action+'|'+e.token+'|'+e.net).join('|');
  if(sig===lastEvSig) return;
  lastEvSig=sig;
  const el=$('plist');
  const atTop=el.scrollTop<=8;
  const keep=el.scrollTop, prevH=el.scrollHeight;
  if(!evs.length){el.innerHTML='<div class="b">brak zdarzeń pozycji</div>'; return;}
  const sg=v=>(v>=0?'+':'')+v;
  el.innerHTML=evs.map(e=>{
    const tm=new Date(e.ts).toLocaleTimeString('pl-PL',{timeZone:TZ,hour:'2-digit',minute:'2-digit'});
    const nm=e.displaySymbol||e.token;
    let t, cls='ev-o';
    if(e.action==='OPEN'){
      t=tm+' OPEN '+nm+' '+(e.chain||'')+' '+(e.usd!=null?'$'+Number(e.usd).toFixed(0):'')+(e.price!=null?' @'+e.price:'');
      cls='ev-o';
    }else{
      t=(tm+' '+(e.action==='SELL'?'SELL '+(e.frac||'1/4'):'CLOSE')+' '+nm+' '+(e.chain||'')+' '+(e.usd!=null?'$'+Number(e.usd).toFixed(0):'')+(e.price!=null?' @'+e.price:'')+' '+(e.reason||'')+' '+(e.pct!=null?sg((+e.pct).toFixed(1))+'%':'')+' '+(e.net!=null?(e.net>=0?'+$':'-$')+Math.abs(e.net).toFixed(2):'')).replace(/\s+/g,' ').trim();
      cls=e.action==='OPEN'?'ev-o':(e.net==null?'ev-o':e.net>=0?'ev-p':'ev-l');
    }
    return '<div class="'+cls+'">'+esc(t)+'</div>';
  }).join('');
  el.scrollTop=atTop?0:keep+Math.max(0,el.scrollHeight-prevH);
}

function newsParts(){
  const n=ticker&&ticker.news;
  if(!n||!n.items||!n.items.length) return [{text:'BRAK DANYCH    ·    ', color:'#ff8a8a'}];
  const out=[];
  n.items.slice(0,12).forEach(i=>{out.push({text:(i.title||'')+' ', color:'#e8f1ff'}); out.push({text:'('+(i.source||'')+')    ·    ', color:'#8ea3c4'});});
  return out;
}
function cryptoParts(){
  const c=ticker&&ticker.crypto;
  if(!c||!c.items||!c.items.length) return [{text:'BRAK DANYCH    ·    ', color:'#ff8a8a'}];
  const out=[];
  c.items.forEach(i=>{
    const up=(i.change24h||0)>=0;
    out.push({text:(i.symbol||'')+' '+fmtPx(i.price)+' ', color:'#e8b84a'});
    out.push({text:(i.change24h==null?'—':fmtPct(i.change24h))+'    ·    ', color:up?'#7dffb0':'#ff8a8a'});
  });
  return out;
}
function renderTicker(){
  const parts=newsParts().concat([{text:'   ★   ', color:'#c9a227'}], cryptoParts());
  const sig=parts.map(p=>p.text).join('|');
  if(sig===lastTickSig) return;
  lastTickSig=sig;
  const track=$('tickTrack');
  track.textContent='';
  for(let copy=0; copy<2; copy++){
    const span=document.createElement('span');
    for(const p of parts){const s=document.createElement('span'); s.textContent=p.text; if(p.color) s.style.color=p.color; span.appendChild(s);}
    track.appendChild(span);
  }
}

function takePositions(list){
  if(!Array.isArray(list)) return;
  positions={};
  for(const p of list) if(p&&p.id) positions[p.id]=p;
  feedAt=Date.now();
  lastPosSig=''; lastPipeSig='';
  renderAll();
}
function renderAll(){
  renderPositions();
  renderPipeline();
  renderGauges();
  renderPort();
  renderChat();
  renderEvents();
  renderTicker();
  updOnline();
}
function updOnline(){
  const ps=Object.values(players);
  $('online').textContent='Online: '+ps.filter(p=>!p.bot).length+' + '+ps.filter(p=>p.bot).length+' boty';
}
function pushChat(m){
  if(!m) return;
  if(m.system&&m.bot){
    chatHist.push({ts:m.ts||Date.now(), bot:m.bot, text:String(m.text||'').replace(/^.*🤖\s+\w+:\s*/,''), kind:m.kind||''});
    maybeSizeSound(m);
  }else if(!m.system){
    chatHist.push({ts:m.ts||Date.now(), bot:m.name||'USER', text:m.text||'', kind:'chat'});
  }else{
    chatHist.push({ts:m.ts||Date.now(), bot:'SYS', text:m.text||'', kind:'sys'});
  }
  while(chatHist.length>80) chatHist.shift();
  lastChatSig='';
  renderChat();
}

const socket=io({autoConnect:true});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){try{socket.io.opts.reconnection=false; socket.disconnect();}catch(e){}}
  else{try{socket.io.opts.reconnection=true; if(!socket.connected) socket.connect();}catch(e){}}
});
socket.on('connect', ()=>socket.emit('join', joined?{name:myName}:{spectate:true}));
socket.on('init', d=>{me=d.you||null; players=d.players||{}; updOnline();});
socket.on('playerJoined', p=>{players[p.id]=p; updOnline();});
socket.on('playerLeft', id=>{delete players[id]; updOnline();});
socket.on('chat', pushChat);
socket.on('positions', takePositions);
socket.on('position', p=>{if(!p||!p.id) return; positions[p.id]=p; feedAt=Date.now(); lastPosSig=''; lastPipeSig=''; renderAll();});
socket.on('positionClosed', id=>{delete positions[id]; lastPosSig=''; lastPipeSig=''; renderAll();});
socket.on('portfolio', d=>{if(d&&typeof d==='object'&&!d.empty){portfolio=d; feedAt=Date.now(); lastPortSig=''; renderPort(); renderGauges();}});
socket.on('ticker', d=>{if(d&&typeof d==='object'){ticker=d; lastTickSig=''; renderTicker();}});
socket.on('scan', d=>{
  if(!d||typeof d!=='object') return;
  scan=d;
  if(d.lastFeedAt) feedAt=d.lastFeedAt;
  if(Object.prototype.hasOwnProperty.call(d,'scan_sieve')) noteSieve(d.scan_sieve);
  lastPipeSig='';
  renderPipeline();
  renderGauges();
});
socket.on('posEvents', evs=>{posEvents=Array.isArray(evs)?evs:[]; statsReady=true; lastEvSig=''; renderEvents(); renderGauges();});
socket.on('deskFx', ev=>{
  if(!ev) return;
  if(ev.kind==='stage'){
    const bot=String(ev.bot||'').toUpperCase();
    const lv=ev.level|0;
    if(lv===2&&bot==='VET') sfxPlay('vet_pass');
    else if(lv===3&&bot==='BOOK') sfxPlay('book_pass');
    else if(lv===4) sfxPlay('fills_pass');
  }else if(ev.kind==='close'){
    const pnl=Number.isFinite(+ev.pct)?+ev.pct:(Number.isFinite(+ev.net)?+ev.net:null);
    sfxPlay(pnl>0?'risk_profit':'risk_loss');
  }
});

$('audioBtn').onclick=async()=>{
  if(speakerOn&&!sfxUnlocked){ await sfxUnlock(); paintAudio(); return; }
  speakerOn=!speakerOn;
  try{ localStorage.setItem(SPEAKER_KEY, speakerOn?'on':'off'); }catch(e){}
  if(speakerOn) await sfxUnlock();
  paintAudio();
};
$('nick').value=localStorage.nick||'';
$('go').onclick=()=>{
  const n=$('nick').value.trim(); if(!n){$('nick').focus(); return;}
  myName=n; localStorage.nick=n; joined=true;
  socket.emit('join',{name:n});
};
$('form').onsubmit=e=>{
  e.preventDefault();
  const v=$('msg').value.trim(); if(!v) return;
  if(!me){$('msg').placeholder='WEJDŹ, ŻEBY PISAĆ'; return;}
  socket.emit('chat',{text:v, scope:'global'}); $('msg').value='';
};
$('posBody').addEventListener('click', e=>{
  const row=e.target.closest('.pl-row'); if(!row) return;
  if(innerWidth<=900) row.classList.toggle('expanded');
});

async function loadJSON(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
async function loadHistory(){
  try{
    const [feed, port, tick, sc, bev, pos]=await Promise.all([
      loadJSON('/api/feed'),
      loadJSON('/api/portfolio'),
      loadJSON('/api/ticker'),
      loadJSON('/api/scan'),
      loadJSON('/api/bot-events'),
      loadJSON('/api/positions')
    ]);
    if(feed&&Array.isArray(feed.activity)) chatHist=feed.activity.slice(-80);
    if(feed&&feed.posEvents) posEvents=feed.posEvents;
    if(feed&&Array.isArray(feed.positions)&&feed.positions.length) takePositions(feed.positions);
    if(feed&&feed.lastFeedAt) feedAt=feed.lastFeedAt;
    if(port&&!port.empty) portfolio=port;
    if(tick) ticker=tick;
    if(sc&&sc.tokens) scan=sc;
    if(sc&&Object.prototype.hasOwnProperty.call(sc,'scan_sieve')) noteSieve(sc.scan_sieve);
    if(bev&&typeof bev==='object') botEvents=bev;
    if((!Object.keys(positions).length)&&Array.isArray(pos)&&pos.length) takePositions(pos);
    statsReady=true;
  }catch(e){console.log('history', e.message);}
  lastChatSig=lastEvSig=lastPipeSig='';
  renderAll();
}

function showFixtureBadge(){
  if(badgeOn) $('fixtureBanner').hidden=false;
}
function applyFixture(){
  if(!fixtureOn) return;
  fixture=true;
  stopSieve();
  statsReady=true;
  showFixtureBadge();
  const now=Date.now();
  feedAt=now-18;
  portfolio={start:1000,bank:45600,realizedPnl:44600,roiPct:4460,trades:14,wins:9,losses:5,winRate:64,maxDrawdownPct:8.2,mode:'SHADOW',
    series:[{ts:now-86400000*4,bank:1200},{ts:now-86400000*3,bank:980},{ts:now-86400000*2,bank:2100},{ts:now-86400000,bank:18000},{ts:now,bank:45600}]};
  const defs=[
    {sym:'CAPY',pnl:55.4,h1:4,h6:12,h24:55,m:85000,pass:{n:3,wins:2,losses:1},steps:{done:2,total:6,runner:false}},
    {sym:'RICO',pnl:-12.3,h1:-9,h6:-2,h24:8,m:210000,pass:{n:2,wins:1,losses:1},steps:{done:3,total:6,runner:false}},
    {sym:'MOVEMBER',pnl:8.1,h1:120,h6:45,h24:-5,m:42000,pass:{n:4,wins:3,losses:1},steps:{done:0,total:6,runner:false}},
    {sym:'5STAR',pnl:-4.2,h1:-1,h6:15,h24:30,m:150000,pass:{n:1,wins:0,losses:1},steps:{done:1,total:6,runner:false}},
    {sym:'CJ',pnl:22.5,h1:5,h6:-8,h24:22,m:12000,pass:{n:3,wins:2,losses:1},peakPct:8},
    {sym:'TURKEY',pnl:-35.1,h1:-15,h6:-20,h24:-50,m:5000,pass:{n:0,wins:0,losses:0},steps:{done:6,total:6,runner:true,peak:12}},
    {sym:'SPHERE',pnl:1.5,h1:0.5,h6:2,h24:1,m:300000,pass:{n:2,wins:1,losses:1},steps:{done:0,total:6,runner:false}}
  ];
  positions={};
  defs.forEach((d,i)=>{
    const entry=0.001*(i+1), price=entry*(1+d.pnl/100);
    positions['fix-'+i]={id:'fix-'+i,symbol:d.sym,displaySymbol:d.sym,side:'LONG',bot:'RISK',size:40,entry,price,pnlBase:entry,
      h1:d.h1,h6:d.h6,h24:d.h24,change24h:d.h24,mcap:d.m,pass:d.pass,steps:d.steps||null,peakPct:d.peakPct,openedAt:now-(i+1)*600000};
  });
  posEvents=[
    {ts:now-3600000,action:'OPEN',token:'PEACE',displaySymbol:'PEACE',chain:'solana',usd:40,price:0.00387},
    {ts:now-3300000,action:'CLOSE',token:'MATED',displaySymbol:'MATED',chain:'solana',usd:40,price:0.003375,pct:-12.4,net:-5.1},
    {ts:now-3000000,action:'OPEN',token:'CAPY',displaySymbol:'CAPY',chain:'solana',usd:40,price:0.015},
    {ts:now-2700000,action:'CLOSE',token:'RICO',displaySymbol:'RICO',chain:'solana',usd:40,price:1.10,pct:-9.2,net:-3.6},
    {ts:now-2400000,action:'CLOSE',token:'PILLS',displaySymbol:'PILLS',chain:'solana',usd:40,price:0.06,pct:18.2,net:7.3},
    {ts:now-2100000,action:'OPEN',token:'WOOD',displaySymbol:'WOOD',chain:'solana',usd:40,price:0.06},
    {ts:now-1800000,action:'CLOSE',token:'MOGMAS',displaySymbol:'MOGMAS',chain:'solana',usd:40,price:2.1,pct:4.1,net:1.6},
    {ts:now-1500000,action:'OPEN',token:'SPHERE',displaySymbol:'SPHERE',chain:'solana',usd:40,price:0.8},
    {ts:now-1200000,action:'CLOSE',token:'STEALTH',displaySymbol:'STEALTH',chain:'solana',usd:40,price:5.0,pct:22,net:8.8},
    {ts:now-900000,action:'OPEN',token:'CJ',displaySymbol:'CJ',chain:'solana',usd:40,price:0.002},
    {ts:now-600000,action:'CLOSE',token:'TURKEY',displaySymbol:'TURKEY',chain:'solana',usd:40,price:0.004,pct:-8,net:-3.2}
  ];
  scan={total:6,index:0,tokens:[
    {symbol:'CAPY',stage:'soft_pass',reason:'mcap',image:null},
    {symbol:'WOOP',stage:'soft_reject',reason:'crowd'},
    {symbol:'RICO',stage:'picked',reason:'chase_5m'},
    {symbol:'MOGMAS',stage:'order',reason:'mcap'},
    {symbol:'SPHERE',stage:'filled',reason:'crowd'},
    {symbol:'STEALTH',stage:'held_skip',reason:'chase_5m'}
  ]};
  chatHist=[
    {ts:now-120000,bot:'VET',text:'11:58 Order placed'},
    {ts:now-110000,bot:'SCAN',text:'11:57 New signal'},
    {ts:now-100000,bot:'BOOK',text:'11:56 Executed'},
    {ts:now-90000,bot:'RISK',text:'11:55 High vol'},
    {ts:now-80000,bot:'FILLS',text:'11:54 Filtro 100%'},
    {ts:now-70000,bot:'VET',text:'11:53 Stop loss'},
    {ts:now-60000,bot:'SCAN',text:'11:52 Trend up'},
    {ts:now-50000,bot:'BOOK',text:'11:51 Partial'},
    {ts:now-40000,bot:'RISK',text:'11:50 Alert'},
    {ts:now-30000,bot:'FILLS',text:'11:49 Pending'},
    {ts:now-20000,bot:'SIZE',text:'11:48 Bilet $40 (2% banku)'},
    {ts:now-10000,bot:'CHIEF',text:'11:47 wybor: CAPY'}
  ];
  botEvents={
    SCAN:[{ts:new Date(now).toISOString(),text:'Przeskanowalem 128 tokenow, 23 przez sito'}],
    VET:[{ts:new Date(now).toISOString(),text:'Weryfikacja: 9/23 przeszlo'},{ts:new Date(now-1e4).toISOString(),text:'Odrzucilem WOOP - crowd'}],
    BOOK:[{ts:new Date(now).toISOString(),text:'Przekazalem 4 do SIZE'},{ts:new Date(now-1e3).toISOString(),text:'Wybieram RICO'}],
    SIZE:[{ts:new Date(now).toISOString(),text:'Przekazalem 3 do FILLS'},{ts:new Date(now-1e3).toISOString(),text:'MOGMAS bilet'}],
    FILLS:[{ts:new Date(now).toISOString(),text:'Przekazalem 3 do RISK'},{ts:new Date(now-1e3).toISOString(),text:'Wypelnione: SPHERE'}],
    RISK:[{ts:new Date(now).toISOString(),text:'Pilnuje STEALTH: Stage II'}]
  };
  ticker={
    news:{items:[{title:'Desk publiczny — dane fixture',source:'arcade-office'}],error:null},
    crypto:{items:[
      {symbol:'BTC',price:39198,change24h:0.05},
      {symbol:'ETH',price:2266,change24h:-0.4},
      {symbol:'USDT',price:0.9991,change24h:-0.01}
    ],error:null}
  };
  lastPosSig=lastPortSig=lastPipeSig=lastChatSig=lastEvSig=lastTickSig='';
  renderAll();
}

loadHistory().then(()=>{
  showFixtureBadge();
  if(fixtureOn) applyFixture();
});
showFixtureBadge();
if(fixtureOn) applyFixture();

paintClock(Date.now());
setInterval(()=>{
  paintClock(Date.now());
  renderGauges();
  if(scan&&scan.tokens&&scan.tokens.length){ /* rotate with server index if present */ renderPipeline(); }
},1000);

paintAudio();
window.AO2={positions:()=>positions, portfolio:()=>portfolio, scan:()=>scan, fixture:()=>fixture, render:renderAll,
  sieve:()=>sieveFrame, dwells:()=>sievePlan, sieveOriginMs, holdSieve, noteSieve, sfxLog:()=>sfxLog.slice(), speaker:()=>speakerOn,
  gauges:()=>Array.from(document.querySelectorAll('#gauges .mano')).map(el=>{
    const n=needleState.get(el.querySelector('.needle'));
    const val=el.querySelector('.mano-plaque .val');
    return {id:el.dataset.id, text:val?val.textContent:'', cls:val?val.className:'', scale:el.dataset.scale||'', goal:n?+n.goal.toFixed(2):null, live:!!(n&&n.live)};
  })
};
})();
