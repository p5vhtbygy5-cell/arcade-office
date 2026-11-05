/* Arcade Office /v2 dashboard. Reads the same public feed as the live board. */
(function(){
const TZ='Europe/Warsaw';
const POS_LIMIT=10;
const TRAIL_PCT=19;
const STEP_ROMAN=['0','I','II','III','IV','V','VI'];
const STAGE_NAME=['0','I','II','III','IV'];
const SEATS=['SCAN','VET','BOOK','SIZE','FILLS','RISK'];
const COLS=['SYMBOL','PNL%','1H','6H','24H','MCAP','PASS','ST'];
const COLK=['sym','pnl','h1','h6','h24','mcap','pass','st'];
const $=id=>document.getElementById(id);
const audio=window.AUDIO?AUDIO.create():null;
const fixtureOn=/\b(demo|fixture)=1\b/.test(location.search);
const badgeOn=fixtureOn||/\bbadge=fixture\b/.test(location.search);

let me=null, players={}, positions={}, portfolio=null, ticker=null, scan=null;
let botEvents={}, feedAt=0, posEvents=[], chatHist=[], joined=false, myName='';
let fixture=false, lastPosSig='', lastPortSig='', lastPipeSig='', lastChatSig='', lastEvSig='', lastTickSig='';

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
  const s=Math.min(innerWidth/1920, innerHeight/1080);
  const x=(innerWidth-1920*s)/2, y=(innerHeight-1080*s)/2;
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

function gaugeSvg(bipolar){
  const ticks=[];
  for(let i=0;i<=10;i++){
    const t=i/10, ang=Math.PI*(1+t);
    const x1=50+Math.cos(ang)*34, y1=62+Math.sin(ang)*34;
    const x2=50+Math.cos(ang)*(i%5===0?28:30.5), y2=62+Math.sin(ang)*(i%5===0?28:30.5);
    ticks.push('<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#5a4030" stroke-width="'+(i%5===0?1.4:0.8)+'"/>');
  }
  const zones=bipolar
    ? '<path d="M16 62 A34 34 0 0 1 50 28" fill="none" stroke="#9a3a3a" stroke-width="5" stroke-linecap="butt"/>'+
      '<path d="M50 28 A34 34 0 0 1 84 62" fill="none" stroke="#3a7a48" stroke-width="5" stroke-linecap="butt"/>'+
      '<text x="18" y="74" fill="#8a3030" font-size="7" font-family="Barlow Condensed,sans-serif" font-weight="700">−100</text>'+
      '<text x="47" y="22" fill="#3a2818" font-size="7" font-family="Barlow Condensed,sans-serif" font-weight="700">0</text>'+
      '<text x="70" y="74" fill="#2d6a3a" font-size="7" font-family="Barlow Condensed,sans-serif" font-weight="700">+100</text>'
    : '';
  return '<svg viewBox="0 0 100 78" aria-hidden="true">'+zones+ticks.join('')+
    '<line class="ao-needle" x1="50" y1="62" x2="50" y2="32"/>'+
    '<circle cx="50" cy="62" r="3.4" fill="#3a2410" stroke="#c9a227" stroke-width="1"/>'+
    '</svg>';
}
function mountGauges(){
  document.querySelectorAll('.ao-gauge').forEach(el=>{
    const bipolar=el.classList.contains('bipolar');
    el.innerHTML='<div class="g-face">'+gaugeSvg(bipolar)+'</div><div class="ao-plate"><div class="ao-gname"></div><div class="ao-gval">—</div></div>';
  });
}
mountGauges();
function setNeedle(el, min, max, val){
  const n=el.querySelector('.ao-needle'); if(!n) return;
  const v=val==null||!Number.isFinite(+val)?min:Math.max(min, Math.min(max, +val));
  const t=(v-min)/(max-min||1);
  const ang=Math.PI*(1+t);
  n.setAttribute('x1',50); n.setAttribute('y1',62);
  n.setAttribute('x2',(50+Math.cos(ang)*30).toFixed(2));
  n.setAttribute('y2',(62+Math.sin(ang)*30).toFixed(2));
}
function setGauge(id, name, digital, min, max, needle){
  const el=$(id); if(!el) return;
  const nm=el.querySelector('.ao-gname'), dv=el.querySelector('.ao-gval');
  if(nm) nm.textContent=name;
  if(dv){
    const t=digital==null?'—':String(digital);
    dv.textContent=t;
    dv.classList.remove('pos','neg');
    if(t.charAt(0)==='+') dv.classList.add('pos');
    else if(t.charAt(0)==='−'||t.charAt(0)==='-') dv.classList.add('neg');
  }
  setNeedle(el, min, max, needle);
}

function dayStats(evs){
  const day=warsawDayKey(Date.now());
  let pnl=0, hasPnl=false, trades=0, wins=0, losses=0;
  for(const e of evs||[]){
    if(!e||!e.ts) continue;
    if(warsawDayKey(e.ts)!==day) continue;
    if(e.action==='OPEN'||e.action==='CLOSE') trades++;
    if(e.action==='CLOSE'){
      const net=e.net!=null?+e.net:(e.pct!=null?+e.pct:null);
      if(net!=null&&Number.isFinite(net)){
        if(e.net!=null){pnl+=+e.net; hasPnl=true;}
        if(net>0) wins++; else if(net<0) losses++;
      }
    }
  }
  const decided=wins+losses;
  const balance=decided?((wins-losses)/decided)*100:0;
  return {pnl:hasPnl?pnl:null, trades:trades||null, wins, losses, balance:decided?balance:null};
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
  const thumb=st.image
    ? '<span class="thumb"><img alt="" src="'+esc(st.image)+'" onerror="this.parentNode.textContent=\''+ini+'\'"></span>'
    : '<span class="ini">'+ini+'</span>';
  const count=st.count==null?'–':String(st.count|0);
  const dlen=count.length>=4?' d4':count.length===3?' d3':'';
  const tag=st.tag||'–';
  return '<div class="plaque">'+bot+'</div>'+
    '<div class="station-mid">'+
      '<div class="bot" role="img" aria-label="'+bot+'"></div>'+
      '<div class="token-row"><div class="coin"><span class="ring"></span>'+thumb+'</div>'+
      '<span class="tick">'+esc(tok)+'</span></div>'+
      '<div class="nixie"><div class="shell"></div><div class="digit'+dlen+'">'+esc(count)+'</div></div>'+
    '</div>'+
    '<div class="tag'+(st.tag?'':' empty')+'">'+esc(tag)+'</div>';
}
function renderPipeline(){
  const states={};
  for(const b of SEATS) states[b]=seatState(b);
  const sig=JSON.stringify(states);
  if(sig===lastPipeSig) return;
  lastPipeSig=sig;
  document.querySelectorAll('.station').forEach(el=>{
    const bot=el.getAttribute('data-seat');
    el.innerHTML=stationHtml(bot, states[bot]||{});
  });
}

function renderGauges(){
  const open=Object.keys(positions).length;
  setGauge('gaugePosOpen','POZYCJE', open+'/'+POS_LIMIT, 0, POS_LIMIT, open);
  setGauge('gaugeTrail','TRAIL', TRAIL_PCT+'%', 0, 100, TRAIL_PCT);
  const ds=dayStats(posEvents);
  setGauge('gaugeDayPnl','PNL DNIA', ds.pnl==null?'—':fmtMoney(ds.pnl,true), -100, 100, ds.pnl);
  // Needle: day's win/loss count balance mapped to −100…+100.
  // Digital: same trade count the current board uses (today's OPEN+CLOSE).
  setGauge('gaugeDayTrades','TRANSAKCJE', ds.trades==null?'—':String(ds.trades), -100, 100, ds.balance==null?0:ds.balance);
  const fees=portfolio&&(portfolio.fees!=null?portfolio.fees:portfolio.feesUsd);
  setGauge('gaugeFees','PROWIZJE', fees==null?'—':fmtMoney(fees,false), 0, Math.max(10, fees||0), fees);
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
function chatLines(){
  const extra=[];
  for(const bot of Object.keys(botEvents||{})){
    for(const ev of botEvents[bot]||[]) extra.push({ts:ev.ts, bot, text:ev.text, kind:'botEvent'});
  }
  const all=chatHist.concat(extra).sort((a,b)=>(Date.parse(a.ts)||0)-(Date.parse(b.ts)||0));
  const seen=new Set(), out=[];
  for(const a of all){
    const k=(a.bot||'')+'|'+(String(a.text||'').replace(/^\d\d:\d\d /,''));
    if(seen.has(k)) continue; seen.add(k); out.push(a);
  }
  return out.slice(-18);
}
function renderChat(){
  const lines=chatLines();
  const sig=lines.map(a=>(a.bot||'')+'|'+(a.text||'')+'|'+(a.ts||'')).join('\n');
  if(sig===lastChatSig) return;
  lastChatSig=sig;
  const el=$('log');
  el.innerHTML=lines.map(a=>{
    const f=formatAct(a);
    return '<div class="sys"><span class="tag">'+esc(f.time)+'</span><b>'+esc(a.bot||a.name||'')+'</b>: '+esc(f.text)+'</div>';
  }).join('')||'<div class="sys">brak wpisów</div>';
  el.scrollTop=el.scrollHeight;
}
function renderEvents(){
  const evs=posEvents.slice(0,14);
  const sig=evs.map(e=>e.ts+'|'+e.action+'|'+e.token+'|'+e.net).join('|');
  if(sig===lastEvSig) return;
  lastEvSig=sig;
  const el=$('plist');
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
socket.on('scan', d=>{if(d&&typeof d==='object'){scan=d; if(d.lastFeedAt) feedAt=d.lastFeedAt; lastPipeSig=''; renderPipeline(); renderGauges();}});
socket.on('posEvents', evs=>{posEvents=Array.isArray(evs)?evs:[]; lastEvSig=''; renderEvents(); renderGauges();});
socket.on('deskFx', ev=>{
  if(!audio||!ev) return;
  if(ev.kind==='stage') audio.stage(ev.level);
  else if(ev.kind==='close') audio.close(ev.stage);
  else if(ev.kind==='sell') audio.sell();
});

function paintAudio(){
  if(!audio) return;
  if(!audio.unlocked) $('audioBtn').textContent='WŁĄCZ DŹWIĘK';
  else $('audioBtn').textContent=audio.muted?'DŹWIĘK WYŁ':'DŹWIĘK WŁ';
}
$('audioBtn').onclick=async()=>{
  if(!audio) return;
  if(!audio.unlocked){audio.setMuted(false); await audio.unlock(); paintAudio(); return;}
  audio.setMuted(!audio.muted); paintAudio();
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
    if(bev&&typeof bev==='object') botEvents=bev;
    if((!Object.keys(positions).length)&&Array.isArray(pos)&&pos.length) takePositions(pos);
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

window.AO2={positions:()=>positions, portfolio:()=>portfolio, scan:()=>scan, fixture:()=>fixture, render:renderAll};
})();
