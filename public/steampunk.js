// Steampunk chrome: analog clock, SVG gauges, position plaque grid, panel decorations.
(function(root){
const TZ='Europe/Warsaw';
/** Trail stop % — not exposed on the public feed; matches desk default when unknown. */
root.AO_TRAIL_PCT=19;
const POS_LIMIT=10;
const COLS=['SYMBOL','KIER','PNL%','1H','6H','MCAP','PASS','ST'];

function $(id){return document.getElementById(id);}

function warsawParts(date){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(date||new Date());
  const g=t=>+p.find(x=>x.type===t).value;
  return {h:g('hour'),m:g('minute'),s:g('second')};
}
function warsawDayKey(ts){
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts));
}

function paintAnalogClock(svg, now){
  if(!svg) return;
  const {h,m,s}=warsawParts(now);
  const hr=(h%12)+m/60+s/3600, min=m+s/60, sec=s;
  const set=(id,deg)=>{const el=svg.querySelector('#'+id); if(el) el.setAttribute('transform','rotate('+deg+' 50 50)');};
  set('aoHr', hr*30);
  set('aoMin', min*6);
  set('aoSec', sec*6);
}

function paintDigital(el, now){
  if(!el) return;
  try{
    el.textContent=new Date(now).toLocaleTimeString('pl-PL',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }catch(e){
    el.textContent=new Date(now).toLocaleTimeString();
  }
}

function gaugeNeedle(g, min, max, val){
  const v=val==null||!Number.isFinite(+val)?min:(Math.max(min, Math.min(max, +val)));
  const t=(v-min)/(max-min||1);
  const ang=Math.PI*(1+t);
  const cx=60, cy=68, r=34;
  const nx=cx+Math.cos(ang)*r, ny=cy+Math.sin(ang)*r;
  const n=g.querySelector('.ao-needle');
  if(!n) return;
  n.setAttribute('x1', cx); n.setAttribute('y1', cy);
  n.setAttribute('x2', nx.toFixed(2)); n.setAttribute('y2', ny.toFixed(2));
}

function setGauge(id, needleMin, needleMax, needleVal, digital){
  const rootEl=$(id);
  if(!rootEl) return;
  const g=rootEl.querySelector('svg');
  const dig=rootEl.querySelector('.ao-gval');
  if(g) gaugeNeedle(g, needleMin, needleMax, needleVal);
  if(dig) dig.textContent=digital==null?'—':String(digital);
}

function sievePassed(scan){
  if(!scan||!scan.tokens||!scan.total) return {passed:0,total:0,text:'—'};
  const bad=/reject|missing|not_enriched|cheap|chp/i;
  const passed=scan.tokens.filter(t=>t.stage&&!bad.test(String(t.stage))).length;
  const total=scan.total;
  return {passed,total,text:passed+'/'+total};
}

function dayStats(posEvents){
  const day=warsawDayKey(Date.now());
  let pnl=0, hasPnl=false, trades=0;
  for(const e of posEvents||[]){
    if(!e||!e.ts) continue;
    if(warsawDayKey(e.ts)!==day) continue;
    if(e.action==='CLOSE'&&e.net!=null&&Number.isFinite(+e.net)){pnl+=+e.net; hasPnl=true;}
    if(e.action==='OPEN'||e.action==='CLOSE') trades++;
  }
  return {pnl:hasPnl?pnl:null, trades:trades||null};
}

function fmtPct(v){
  if(v==null||!Number.isFinite(+v)) return '—';
  const n=+v, s=n>0?'+':n<0?'−':'';
  const a=Math.abs(n);
  return s+(a>=100?a.toFixed(0):a>=10?a.toFixed(1):a.toFixed(2))+'%';
}
function fmtMoney(v, sign){
  if(v==null||!Number.isFinite(+v)) return '—';
  const n=+v, s=n<0?'−':(sign&&n>0?'+':'');
  return s+'$'+Math.abs(n).toFixed(2);
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
const STAGE_NAME=['0','I','II','III','IV'];

function cellClass(kind, val){
  if(kind==='sym'||kind==='dir'||kind==='mcap'||kind==='pass'||kind==='st') return 'pl-ivory';
  if(kind==='pnl'||kind==='h1'||kind==='h6'){
    if(val==null||!Number.isFinite(+val)) return 'pl-ivory';
    if(+val>0) return 'pl-pos';
    if(+val<0) return 'pl-neg';
    return 'pl-ivory';
  }
  return 'pl-ivory';
}

function passHtml(pass){
  const n=(pass&&pass.n)|0, w=(pass&&pass.wins)|0, l=(pass&&pass.losses)|0;
  if(!n) return '<span class="pw">0</span>';
  return '<span class="pw">'+n+'</span><span>(</span><span class="pg">'+w+'</span><span>,</span><span class="pr">'+l+'</span><span>)</span>';
}

function renderPosPlaques(posSnap, pnlOf, stageOf, showName){
  const head=$('posHead');
  if(head){
    head.innerHTML=COLS.map(c=>'<div class="pl-cell pl-ivory">'+c+'</div>').join('');
  }
  const grid=$('posPlaqueGrid');
  const emptyEl=$('posEmptyMsg');
  if(!grid) return;
  const filled=posSnap&&posSnap.length;
  if(emptyEl) emptyEl.style.display=filled?'none':'block';
  const rows=[];
  for(let i=0;i<POS_LIMIT;i++){
    const p=posSnap&&posSnap[i];
    if(!p){
      rows.push(COLS.map(()=>'<div class="pl-cell pl-empty"></div>').join(''));
      continue;
    }
    const pnl=p.pnl, h1=p.h1, h6=p.h6;
    const dir=p.side==='SHORT'?('▼S'):('▲L');
    const st=p.st, stTxt=st==null?'':(STAGE_NAME[st]||'');
    const cells=[
      {k:'sym', t:(p.tiers>=1&&p.tiers<=3?(4-p.tiers)+'/4 ':'')+(p.name||''), v:null},
      {k:'dir', t:dir, v:null},
      {k:'pnl', t:fmtPct(pnl), v:pnl},
      {k:'h1', t:fmtPct(h1), v:h1},
      {k:'h6', t:fmtPct(h6), v:h6},
      {k:'mcap', t:fmtK(p.mcap), v:null},
      {k:'pass', html:passHtml(p.pass), v:null},
      {k:'st', t:stTxt, v:null}
    ];
    rows.push(cells.map(c=>{
      const cls='pl-cell '+cellClass(c.k,c.v);
      if(c.html) return '<div class="'+cls+' pl-pass">'+c.html+'</div>';
      return '<div class="'+cls+'">'+escapeHtml(c.t)+'</div>';
    }).join(''));
  }
  grid.innerHTML=rows.map(r=>'<div class="pl-row">'+r+'</div>').join('');
  void pnlOf; void stageOf; void showName;
}

function escapeHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateGauges(state){
  state=state||{};
  const feedSec=state.feedAt?Math.max(0,Math.round((Date.now()-state.feedAt)/1000)):null;
  setGauge('gaugeFeed', 0, 120, feedSec, feedSec==null?'—':feedSec+'s');

  const sv=sievePassed(state.scan);
  setGauge('gaugeSieve', 0, Math.max(1,sv.total||6), sv.passed, sv.text);

  const open=state.posCount|0;
  setGauge('gaugePosOpen', 0, POS_LIMIT, open, open+'/'+POS_LIMIT);
  setGauge('gaugeTrail', 0, 100, root.AO_TRAIL_PCT, root.AO_TRAIL_PCT+'%');

  const ds=dayStats(state.posEvents);
  setGauge('gaugeDayPnl', -100, 100, ds.pnl, ds.pnl==null?'—':fmtMoney(ds.pnl,true));
  setGauge('gaugeDayTrades', 0, 40, ds.trades, ds.trades==null?'—':String(ds.trades));
  setGauge('gaugeFees', 0, 10, null, '—');

  const pf=state.portfolio;
  setGauge('gaugeBank', 0, 2000, pf&&pf.bank, pf&&pf.bank!=null?fmtMoney(pf.bank,false):'—');
  const dd=pf&&pf.maxDrawdownPct;
  setGauge('gaugeDD', 0, 100, dd==null?null:Math.abs(dd), dd==null?'—':('−'+Math.abs(dd).toFixed(1)+'%'));
  const wr=pf&&pf.winRate;
  setGauge('gaugeWin', 0, 100, wr, wr==null?'—':(Math.round(wr)+'%'));
}

function tickChrome(_rafMs, state){
  const now=Date.now();
  paintAnalogClock($('analogClock'), now);
  paintDigital($('digitalClock'), now);
  updateGauges(state);
}

root.AO_STEAMPUNK={
  tick: tickChrome,
  renderPosPlaques,
  POS_LIMIT,
  dayStats,
  sievePassed,
  updateGauges
};
})(window);
