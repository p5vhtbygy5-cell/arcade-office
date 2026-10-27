// Arcade Office client. The office is a canvas; the boards are split-flap displays.
const {zoneAt,blocked,ZONES}=MAP;
const ZN=Object.fromEntries(ZONES.map(z=>[z.id,z.name])); ZN.korytarz='Korytarz';
const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b'];
const INK='#f4ecd8', DIM='#8d8376', GOOD='#7dffb0', BAD='#ff5d6c', CYAN='#7ee7ff', AMBER='#ffc14d';
const STAGE_NAME=['0','I','II','III','IV'];
const STAGE_COL={'STAGE 0':'#b8ffb8','0':'#b8ffb8','I':'#7dff7d','II':'#3dff7a','III':'#1fb855','IV':'#0d7a35'};
const graphs=FLAP.graphs;
const $=id=>document.getElementById(id);
const stage=$('stage'), audioBtn=$('audioBtn'), clock=$('clock'), feedAge=$('feedAge');
const audio=AUDIO.create();
const office=OFFICE.create($('office'));
const nameFlap=FLAP.create($('nameFlap'),{rowDelay:0,startDelay:0,maxCell:150,onRow:()=>audio.clack()});
const priceFlap=FLAP.create($('priceFlap'),{rowDelay:0,startDelay:3000,maxCell:96,onRow:()=>audio.clack()});
const statFlap=FLAP.create($('statFlap'),{rowDelay:0,startDelay:6000,maxCell:54,onRow:r=>{if(r===0)audio.clack();}});
const posFlap=FLAP.create($('posFlap'),{rowDelay:3000,startDelay:400,maxCell:72,onRow:()=>audio.clack()});
const portFlap=FLAP.create($('portFlap'),{rowDelay:3000,startDelay:400,maxCell:64,onRow:()=>audio.clack()});
let me=null, players={}, positions={}, portfolio=null, ticker=null, top10={items:[]}, scan=null;
let printerPile=0, scope='global', joined=false, myName='', myColor=COLORS[0], mySprite=0;
let feedAt=0, shownId='', shownData='', posSig='', portSig='', queueSig='';
const bubbles={}, riskBadge={}, fxParts=[];
let shake={until:0,mag:0,dur:1}, toastUntil=0, lastErr='';
const fxc=$('fxc'), fxg=fxc.getContext('2d');
function fit(){
  const s=Math.min(innerWidth/3840, innerHeight/2160);
  const x=(innerWidth-3840*s)/2, y=(innerHeight-2160*s)/2;
  stage.style.transform='translate('+x+'px,'+y+'px) scale('+s+')';
}
addEventListener('resize', fit); fit();
function num(v){const n=+v; return Number.isFinite(n)?n:null;}
function fmtPct(v){
  if(v==null||!Number.isFinite(+v)) return '—';
  const n=+v, s=n>0?'+':n<0?'−':'', a=Math.abs(n);
  return s+(a>=100?a.toFixed(0):a>=10?a.toFixed(1):a.toFixed(2))+'%';
}
function fmtPx(v){
  if(v==null||!Number.isFinite(+v)) return '—';
  const a=Math.abs(+v);
  if(a>=1000) return '$'+Math.round(a).toLocaleString('en-US');
  if(a>=1) return '$'+a.toFixed(2);
  if(a>=0.01) return '$'+a.toFixed(4);
  return '$'+a.toPrecision(3);
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
function fmtN(v){return v==null||!Number.isFinite(+v)?'—':Math.round(+v).toLocaleString('en-US');}
function fmtAge(ms){
  if(ms==null||!Number.isFinite(+ms)) return '—';
  const s=Math.max(0,(Date.now()-ms)/1000);
  if(s<90) return Math.round(s)+'S';
  if(s<3600) return Math.round(s/60)+'M';
  if(s<86400) return (s/3600).toFixed(s<10*3600?1:0)+'H';
  return (s/86400).toFixed(1)+'D';
}
function pnlOf(p){
  const b=p.pnlBase!=null?p.pnlBase:p.entry;
  if(!b||p.price==null||!Number.isFinite(+p.price)) return NaN;
  return (p.price-b)/b*100*(p.side==='SHORT'?-1:1);
}
function spanRow(parts){
  let text=''; const colors=[];
  for(const p of parts){for(const g of graphs(p.t)){text+=g; colors.push(p.c||null);}}
  return {text, colors};
}
function cell(s,w,c){
  const g=graphs(String(s));
  const cut=g.length>w?g.slice(0,w):g;
  return {t:cut.join('')+' '.repeat(Math.max(0,w-cut.length)), c};
}
function tone(v){return v==null||!Number.isFinite(+v)?DIM:+v>0?GOOD:+v<0?BAD:INK;}
const STG={order:'ORDER',order_blocked:'BLOK',soft_pass:'VET+',soft_reject:'VET-',soft_missing:'VET?',hard_reject:'HARD-',hard_pass:'HARD+',not_enriched:'SUROWE',cheap_reject:'CHP-',cooldown:'COOL',cooldown_skip:'COOL',repeat_skip:'POWT',held_skip:'HELD',filled:'KUPIONY',picked:'WYBOR',dodge_max_pain:'BOL'};
function stageLabel(s){return STG[s]||String(s||'—').slice(0,8).toUpperCase();}
function pipeState(stage){
  const s=String(stage||'');
  const fail=/reject|cooldown|repeat|dodge|missing/.test(s);
  let n=1;
  if(/soft_reject|hard_reject|soft_missing|cooldown|repeat_skip|dodge/.test(s)) n=2;
  if(/soft_pass|hard_pass/.test(s)) n=3;
  if(/picked|order_blocked/.test(s)) n=4;
  if(s==='order') n=5;
  if(s==='filled'||s==='held_skip') n=6;
  return {n, fail, held:s==='held_skip'};
}
function auraOf(stage){
  const s=String(stage||'');
  if(s==='filled'||s==='held_skip') return 4;
  if(s==='order'||s==='picked'||s==='order_blocked') return 3;
  if(s==='soft_pass'||s==='hard_pass') return 2;
  return 1;
}
function heldSet(){const s=new Set(); for(const p of Object.values(positions)) if(p.symbol) s.add(String(p.symbol).toUpperCase()); return s;}
function rotNow(){
  if(!scan||!scan.total) return {i:0,p:0,left:0};
  const skew=(scan.serverNow||Date.now())-Date.now();
  const t=Date.now()+skew, rot=scan.rotateMs||10000, start=scan.cycleMs||t;
  const into=((t-start)%rot+rot)%rot;
  return {i:Math.floor(Math.max(0,t-start)/rot)%scan.total, p:into/rot, left:rot-into};
}
function currentToken(){
  if(!scan||!scan.tokens||!scan.tokens.length) return null;
  return scan.tokens[rotNow().i]||null;
}
function layoutDisplays(){
  for(const [cv,disp] of [['nameFlap',nameFlap],['priceFlap',priceFlap],['statFlap',statFlap],['posFlap',posFlap],['portFlap',portFlap]]){
    const el=$(cv), w=el.clientWidth|0, h=el.clientHeight|0;
    if(w>4&&h>4) disp.resize(w,h);
  }
  for(const id of ['chart','portChart','office']){
    const el=$(id), w=el.clientWidth|0, h=el.clientHeight|0;
    if(id==='office'){if(w>4&&h>4) office.resize(w,h);}
    else if(w>4&&h>4&&(el.width!==w||el.height!==h)){el.width=w; el.height=h;}
  }
}
function paintScan(tok, cascade){
  const mode=cascade?'cascade':'patch';
  const scanEl=$('scan');
  if(!tok){
    nameFlap.setRows([spanRow([{t:'BRAK SKANU', c:AMBER}])], mode);
    priceFlap.setRows([spanRow([{t:'—', c:DIM}])], 'patch');
    statFlap.setRows([spanRow([{t:'CZEKAM NA DESK', c:DIM}])], 'patch');
    $('pipe').innerHTML=''; $('queue').innerHTML=''; queueSig='';
    $('scanReason').textContent='';
    $('logo').style.display='none';
    scanEl.className='panel aura-1';
    drawChart($('chart'), null, true);
    return;
  }
  const dup=scan.tokens.filter(t=>t.symbol===tok.symbol).length>1;
  const suffix=dup&&tok.address?(' ·'+String(tok.address).slice(-4)):'';
  nameFlap.setRows([spanRow([{t:tok.symbol+(suffix?suffix:''), c:INK}])], mode);
  const ch=tok.change1h;
  priceFlap.setRows([spanRow([{t:fmtPx(tok.price)+'   ', c:INK},{t:fmtPct(ch), c:tone(ch)}])], mode);
  const pct=(lab,v)=>[{t:lab+' ', c:DIM},{t:fmtPct(v)+'   ', c:tone(v)}];
  statFlap.setRows([
    spanRow([].concat(pct('5M',tok.change5m), pct('1H',tok.change1h))),
    spanRow([].concat(pct('6H',tok.change6h), pct('24H',tok.change24h))),
    spanRow([{t:'LIQ ',c:DIM},{t:fmtK(tok.liquidity)+'  ',c:INK},{t:'VOL ',c:DIM},{t:fmtK(tok.volume1h)+'  ',c:INK},{t:'MC ',c:DIM},{t:fmtK(tok.marketCap),c:INK}]),
    spanRow([{t:'FDV ',c:DIM},{t:fmtK(tok.fdv)+'  ',c:INK},{t:'WIEK ',c:DIM},{t:fmtAge(tok.pairCreatedAt)+'  ',c:INK},{t:'HOLD ',c:DIM},{t:fmtN(tok.holders),c:INK},{t:'  K/S ',c:DIM},{t:tok.buys1h==null?'—':fmtN(tok.buys1h)+'/'+fmtN(tok.sells1h),c:INK}])
  ], mode);
  const steps=['SCAN','VET','BOOK','SIZE','FILLS','RISK'], st=pipeState(tok.stage), pipe=$('pipe');
  pipe.innerHTML='';
  steps.forEach((name,i)=>{const d=document.createElement('i'); d.textContent=name; if(i<st.n) d.className=st.fail&&i===st.n-1?'fail':'on'; pipe.appendChild(d);});
  const held=heldSet();
  const sig=(scan.tokens||[]).map(t=>(t.address||t.symbol)+t.stage).join(',')+'|'+[...held].sort().join(',');
  const q=$('queue');
  if(sig!==queueSig){
    queueSig=sig; q.innerHTML='';
    (scan.tokens||[]).forEach(t=>{const b=document.createElement('b'); b.textContent=t.symbol; b.dataset.k=(t.address||t.symbol); if(held.has(String(t.symbol).toUpperCase())) b.classList.add('held'); q.appendChild(b);});
  }
  const idx=rotNow().i;
  [...q.children].forEach((b,i)=>b.classList.toggle('now', i===idx));
  $('scanReason').textContent=[tok.baseName, tok.reason, tok.dexId, tok.mintAuthority?('mint '+tok.mintAuthority):'', tok.freezeAuthority?('freeze '+tok.freezeAuthority):'', tok.honeypot&&tok.honeypot!=='unknown'?('honeypot '+tok.honeypot):''].filter(Boolean).join(' · ');
  const src=[];
  src.push('feed'); if(tok.sources&&tok.sources.dex) src.push('DexScreener'); if(tok.sources&&tok.sources.chart) src.push('wykres GT'); if(tok.sources&&tok.sources.info) src.push('holderzy GT');
  $('scanSrc').textContent=src.join(' · ');
  const logo=$('logo');
  const img=tok.image||'';
  if(logo.dataset.src!==img){logo.dataset.src=img; if(img){logo.src=img; logo.style.display='block';} else logo.style.display='none';}
  scanEl.className='panel aura-'+auraOf(tok.stage);
  drawChart($('chart'), tok.chart, (tok.change1h||0)>=0);
}
function syncScan(force){
  const tok=currentToken();
  const id=tok?(scan&&scan.cycleMs)+'#'+rotNow().i+'#'+(tok.address||tok.symbol):'empty';
  const data=tok?JSON.stringify([tok.price,tok.change5m,tok.change1h,tok.change6h,tok.change24h,tok.liquidity,tok.volume1h,tok.marketCap,tok.fdv,tok.holders,tok.buys1h,tok.sells1h,tok.stage,tok.chart&&tok.chart.length,tok.image,tok.reason]):'';
  if(!force&&id===shownId&&data===shownData){
    const q=$('queue'); if(q.children.length){const i=rotNow().i; [...q.children].forEach((b,n)=>b.classList.toggle('now', n===i));}
    return;
  }
  const cascade=!!force||id!==shownId;
  shownId=id; shownData=data;
  paintScan(tok, cascade);
}
function posLine(p){
  const pl=pnlOf(p), h6=p.h6!=null?p.h6:p.change6h;
  const tier=(p.tiers>=1&&p.tiers<=3)?(4-p.tiers)+'/4 ':'';
  const sym=tier+p.symbol;
  const st=riskBadge[String(p.symbol||'').toUpperCase()];
  const parts=[
    cell(sym,12,INK), cell(p.side==='SHORT'?'▼S':'▲L',4,p.side==='SHORT'?BAD:GOOD),
    cell(fmtPct(pl),8,tone(Number.isFinite(pl)?pl:null)),
    cell(fmtPct(p.h1),7,tone(num(p.h1))), cell(fmtPct(h6),7,tone(num(h6))),
    cell(fmtK(p.mcap),8,INK)
  ];
  const pass=p.pass||{}; const n=pass.n|0;
  if(!n) parts.push(cell('0',10,INK));
  else {
    const body=[{t:String(n),c:'#fff'},{t:'(',c:'#fff'},{t:String(pass.wins|0),c:GOOD},{t:',',c:'#fff'},{t:String(pass.losses|0),c:BAD},{t:')',c:'#fff'}];
    const len=body.reduce((a,x)=>a+graphs(x.t).length,0);
    if(len<10) body.push({t:' '.repeat(10-len),c:null});
    parts.push(...body);
  }
  parts.push(cell(st==null?'':STAGE_NAME[st]||'',4,st==null?DIM:STAGE_COL[STAGE_NAME[st]]||GOOD));
  return spanRow(parts);
}
function syncPos(force){
  const list=Object.values(positions).sort((a,b)=>(b.openedAt||0)-(a.openedAt||0));
  const show=list.slice(0,8);
  const sig=show.map(p=>[p.id,p.symbol,p.price,p.h1,p.h6,p.mcap,p.tiers,p.side,riskBadge[String(p.symbol||'').toUpperCase()]].join(':')).join('|')+'#'+list.length;
  if(!force&&sig===posSig) return;
  const prevIds=posSig?posSig.split('|').map(s=>s.split(':')[0]).join(','):null;
  const cascade=!!force||prevIds!==show.map(p=>p.id).join(',');
  posSig=sig;
  const head=spanRow(['SYMBOL','KIER','PNL%','1H','6H','MCAP','PASS','ST'].map((s,i)=>cell(s,[12,4,8,7,7,8,10,4][i],DIM)));
  const rows=[head];
  if(!show.length) rows.push(spanRow([{t:'BRAK OTWARTYCH POZYCJI', c:AMBER}]));
  else show.forEach(p=>rows.push(posLine(p)));
  posFlap.setRows(rows, cascade?'cascade':'patch');
  $('posNote').textContent=(list.length>show.length?'+'+(list.length-show.length)+' więcej · ':'')+'PASS = N(wygrane, przegrane) · ST = szczyt PnL';
  renderTable();
}
function money(v){return v==null?'—':(v<0?'−':'+')+'$'+Math.abs(v).toFixed(2);}
function syncPort(force){
  const pf=portfolio;
  const sig=pf?JSON.stringify([pf.bank,pf.realizedPnl,pf.roiPct,pf.trades,pf.wins,pf.losses,pf.openFull,pf.openTiers,pf.best&&pf.best.net,pf.worst&&pf.worst.net,pf.series&&pf.series.length]):'empty';
  if(!force&&sig===portSig) return;
  const cascade=!!force||portSig==='';
  portSig=sig;
  if(!pf||!pf.trades){
    portFlap.setRows([spanRow([{t:'BRAK HISTORII', c:AMBER}]), spanRow([{t:'BANK '+(pf&&pf.bank!=null?money(pf.bank).replace('+','') : '—'), c:INK}])], cascade?'cascade':'patch');
  }else{
    const all=pf.trades|0, wins=pf.wins|0, losses=pf.losses!=null?pf.losses|0:Math.max(0,all-wins);
    const ot=Array.isArray(pf.openTiers)?pf.openTiers:null;
    const trades=[{t:'TRADES ',c:DIM}];
    if(ot){
      const cols=['#7dff7d','#3dff7a','#1fb855','#0d7a35'];
      trades.push({t:String(pf.openFull??0),c:INK},{t:' (',c:GOOD});
      ot.forEach((n,i)=>{if(i) trades.push({t:',',c:GOOD}); trades.push({t:String(n||0),c:cols[i]||INK});});
      trades.push({t:')',c:GOOD});
    }else trades.push({t:String(all),c:INK});
    portFlap.setRows([
      spanRow([{t:'BANK ',c:DIM},{t:(pf.bank==null?'—':'$'+pf.bank.toFixed(2)),c:INK}]),
      spanRow([{t:'PNL ',c:DIM},{t:money(pf.realizedPnl),c:tone(pf.realizedPnl)}]),
      spanRow([{t:'ROI ',c:DIM},{t:pf.roiPct==null?'—':fmtPct(pf.roiPct),c:tone(pf.roiPct)}]),
      spanRow([{t:'WIN ',c:DIM},{t:'(',c:INK},{t:String(all),c:INK},{t:', ',c:INK},{t:String(wins),c:GOOD},{t:', ',c:INK},{t:String(losses),c:BAD},{t:') ',c:INK},{t:pf.winRate==null?'—':pf.winRate.toFixed(0)+'%',c:INK}]),
      spanRow(trades),
      spanRow([{t:'MAX DD ',c:DIM},{t:pf.maxDrawdownPct==null?'—':'−'+Math.abs(pf.maxDrawdownPct).toFixed(1)+'%',c:BAD}]),
      spanRow([{t:'NAJL ',c:DIM},{t:pf.best?((pf.best.token||'')+' '+money(pf.best.net)):'—',c:GOOD}]),
      spanRow([{t:'NAJG ',c:DIM},{t:pf.worst?((pf.worst.token||'')+' '+money(pf.worst.net)):'—',c:BAD}])
    ], cascade?'cascade':'patch');
  }
  $('portNote').textContent=pf&&pf.mode?pf.mode+' · od $'+(pf.start||1000):'';
  drawBank($('portChart'), pf);
}
function drawChart(cv, rows, up){
  const w=cv.width, h=cv.height; if(w<10||h<10) return;
  const g=cv.getContext('2d');
  g.clearRect(0,0,w,h);
  g.fillStyle='#070b12'; g.fillRect(0,0,w,h);
  g.font='600 '+Math.max(18, Math.floor(h*0.07))+'px '+ (window.AO_UI||'sans-serif');
  if(!rows||rows.length<2){
    g.fillStyle='#8d8376'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(!rows?'POBIERAM WYKRES 1H':'BRAK WYKRESU 1H', w/2, h/2);
    return;
  }
  const cs=rows.map(r=>r.c).filter(v=>v!=null);
  let lo=Math.min(...cs), hi=Math.max(...cs);
  if(!(hi>lo)){lo*=0.98; hi=lo*1.02+1e-9;}
  const pad=(hi-lo)*0.14; lo-=pad; hi+=pad;
  const L=8,R=12,T=28,B=26;
  const X=i=>L+(i/(rows.length-1))*(w-L-R);
  const Y=v=>T+(1-(v-lo)/(hi-lo))*(h-T-B);
  g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1;
  for(let i=1;i<4;i++){const y=T+(h-T-B)*i/4; g.beginPath(); g.moveTo(L,y); g.lineTo(w-R,y); g.stroke();}
  const vmax=Math.max(...rows.map(r=>r.v||0),1);
  g.fillStyle='rgba(126,231,255,.18)';
  rows.forEach((r,i)=>{const bh=((r.v||0)/vmax)*(h-T-B)*0.22; g.fillRect(X(i)-1.5, h-B-bh, 3, bh);});
  const col=up?GOOD:BAD;
  const grad=g.createLinearGradient(0,T,0,h);
  grad.addColorStop(0, up?'rgba(61,255,154,.38)':'rgba(255,93,108,.38)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  g.beginPath(); rows.forEach((r,i)=>{const x=X(i),y=Y(r.c); i?g.lineTo(x,y):g.moveTo(x,y);});
  g.lineTo(X(rows.length-1),h-B); g.lineTo(X(0),h-B); g.closePath(); g.fillStyle=grad; g.fill();
  g.beginPath(); rows.forEach((r,i)=>{const x=X(i),y=Y(r.c); i?g.lineTo(x,y):g.moveTo(x,y);});
  g.strokeStyle=col; g.lineWidth=3; g.stroke();
  const last=rows[rows.length-1];
  g.fillStyle=col; g.beginPath(); g.arc(X(rows.length-1), Y(last.c), 5, 0, 7); g.fill();
  g.fillStyle=col; g.textAlign='left'; g.textBaseline='top'; g.fillText('1H  '+fmtPx(last.c), 12, 8);
}
function drawBank(cv, pf){
  const w=cv.width, h=cv.height; if(w<10||h<10) return;
  const g=cv.getContext('2d'); g.clearRect(0,0,w,h); g.fillStyle='#070b12'; g.fillRect(0,0,w,h);
  const s=pf&&pf.series?pf.series.slice():[];
  if(pf&&pf.bank!=null&&s.length&&Math.abs(s[s.length-1].bank-pf.bank)>0.005) s.push({ts:pf.receivedAt||Date.now(), bank:pf.bank});
  g.font='600 '+Math.max(16, Math.floor(h*0.08))+'px '+(window.AO_UI||'sans-serif');
  if(s.length<2){g.fillStyle='#8d8376'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('BRAK KRZYWEJ', w/2, h/2); return;}
  const vals=s.map(p=>p.bank);
  let lo=Math.min(...vals), hi=Math.max(...vals); const pad=Math.max(1,(hi-lo)*0.15); lo-=pad; hi+=pad;
  const L=8,R=8,T=16,B=16;
  const t0=s[0].ts, t1=Math.max(s[s.length-1].ts, t0+1);
  const X=ts=>L+(ts-t0)/(t1-t0)*(w-L-R);
  const Y=v=>T+(1-(v-lo)/(hi-lo))*(h-T-B);
  if(pf.start!=null){g.strokeStyle='rgba(255,255,255,.2)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(L,Y(pf.start)); g.lineTo(w-R,Y(pf.start)); g.stroke(); g.setLineDash([]);}
  const up=(s[s.length-1].bank>=(pf.start||s[0].bank));
  g.beginPath(); s.forEach((p,i)=>{const x=X(p.ts),y=Y(p.bank); i?g.lineTo(x,y):g.moveTo(x,y);});
  g.strokeStyle=up?GOOD:BAD; g.lineWidth=3; g.stroke();
  g.fillStyle=up?GOOD:BAD; g.beginPath(); g.arc(X(s[s.length-1].ts), Y(s[s.length-1].bank), 4, 0, 7); g.fill();
}
function centerOf(el){
  const r=el.getBoundingClientRect(), s=stage.getBoundingClientRect(), sc=s.width/3840||1;
  return [(r.left-s.left+r.width/2)/sc, (r.top-s.top+r.height/2)/sc];
}
function burst(x,y,color,n,speed,life,grav){
  const now=performance.now();
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=speed*(0.35+Math.random());
    fxParts.push({kind:'dot',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-speed*0.25,grav:grav||0,born:now,life,color,size:4+Math.random()*8});
  }
}
function ring(x,y,color,maxR,life){fxParts.push({kind:'ring',x,y,color,maxR,born:performance.now(),life});}
function flash(color, a, life){fxParts.push({kind:'flash',color,a,born:performance.now(),life});}
function cards(x,y,n,life){
  const now=performance.now();
  for(let i=0;i<n;i++){
    const a=-Math.PI/2+(Math.random()-0.5)*1.4, sp=300+Math.random()*700;
    fxParts.push({kind:'card',x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,grav:900,rot:Math.random()*6,vr:(Math.random()-0.5)*8,w:18+Math.random()*22,h:26+Math.random()*18,color:Math.random()<.5?'#f4ecd8':'#ffc14d',born:now,life});
  }
}
function showToast(text, color, ms){
  const el=$('toast'); el.textContent=text; el.style.color=color||'#fff'; el.style.opacity='1'; toastUntil=performance.now()+(ms||2000);
}
function onFx(ev){
  ev=ev||{};
  const scanC=centerOf($('scan')), posC=centerOf($('pos'));
  if(ev.kind==='stage'){
    const lv=ev.level|0;
    audio.stage(lv);
    const name=['','SKAN','VET','BOOK','KUPNO'][lv]||'ETAP';
    showToast(name+(ev.token?'  ·  '+ev.token:''), lv>=4?'#ff5ad8':lv===3?'#ffc14d':'#3ee0ff', lv>=4?2600:1800);
    if(lv<=1) ring(scanC[0], scanC[1], '#3ee0ff', 220, 0.7);
    else if(lv===2){ring(scanC[0],scanC[1],'#c58cff',260,0.8); ring(scanC[0],scanC[1],'#3ee0ff',420,1.1); burst(scanC[0],scanC[1],'#c58cff',28,420,1.1,200);}
    else if(lv===3){burst(scanC[0],scanC[1],'#ffc14d',48,560,1.3,280); ring(scanC[0],scanC[1],'#ffc14d',480,1.2); addShake(8,500);}
    else {flash('rgba(255,61,138,.28)',1,0.45); burst(scanC[0],scanC[1],'#ff5ad8',70,780,1.6,320); burst(scanC[0],scanC[1],'#ffc14d',40,640,1.4,280); cards(scanC[0],scanC[1],18,1.8); ring(scanC[0],scanC[1],'#fff',640,1.3); addShake(16,700);}
  }else if(ev.kind==='close'){
    const st=ev.stage==null?0:ev.stage|0;
    audio.close(st);
    const win=st>=0;
    const lab=win?'STAGE '+STAGE_NAME[st]:'STRATA';
    showToast((win?'ZAMKNIĘCIE':'STRATA')+'  ·  '+(ev.token||'')+'  ·  '+lab+(ev.pct!=null?'  ·  '+fmtPct(ev.pct):''), win?'#ffc14d':'#ff5d6c', 3200);
    const mag=[10,16,24,36,52][Math.max(0,st)]||12;
    if(!win){flash('rgba(255,50,70,.35)',1,0.5); burst(posC[0],posC[1],'#ff5d6c',40,300,1.2,-40); addShake(8,500);}
    else if(st<=1){burst(posC[0],posC[1],GOOD,18,280,0.9,200); ring(posC[0],posC[1],GOOD,200,0.7);}
    else if(st===2){burst(posC[0],posC[1],'#ffc14d',36,480,1.2,240); ring(posC[0],posC[1],'#ffc14d',360,1);}
    else {flash(st>=4?'rgba(255,220,120,.4)':'rgba(255,193,77,.28)',1,0.4); burst(posC[0],posC[1],'#ffc14d',60,640,1.5,300); cards(posC[0],posC[1],st>=4?26:12,1.7); ring(posC[0],posC[1],'#fff',520,1.2); addShake(st>=4?18:12,700);}
    void mag;
  }else if(ev.kind==='sell'){
    audio.sell();
    showToast('SPRZEDAŻ '+(ev.frac||'')+'  ·  '+(ev.token||''), CYAN, 1800);
    burst(posC[0], posC[1], CYAN, 16, 260, 0.8, 180);
  }else if(ev.kind==='risk'){
    if(ev.token) riskBadge[String(ev.token).toUpperCase()]=ev.stage;
    posSig='';
  }
  if(!audio.isMuted()) audioBtn.classList.add('hit');
  setTimeout(()=>audioBtn.classList.remove('hit'), 360);
}
function addShake(mag, ms){shake={until:performance.now()+ms, mag, dur:ms};}
function drawFx(now){
  fxg.clearRect(0,0,3840,2160);
  for(let i=fxParts.length-1;i>=0;i--){
    const p=fxParts[i], age=(now-p.born)/1000;
    if(age>p.life){fxParts.splice(i,1); continue;}
    const k=1-age/p.life;
    fxg.save();
    if(p.kind==='dot'||p.kind==='card'){
      const x=p.x+p.vx*age, y=p.y+p.vy*age+0.5*(p.grav||0)*age*age;
      fxg.globalAlpha=Math.max(0,k);
      if(p.kind==='card'){
        fxg.translate(x,y); fxg.rotate(p.rot+p.vr*age);
        fxg.fillStyle='#1a1612'; fxg.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        fxg.fillStyle=p.color; fxg.fillRect(-p.w/2+2,-p.h/2+2,p.w-4,3);
      }else{fxg.fillStyle=p.color; fxg.beginPath(); fxg.arc(x,y,p.size*k+1,0,7); fxg.fill();}
    }else if(p.kind==='ring'){
      fxg.globalAlpha=Math.max(0,k);
      fxg.strokeStyle=p.color; fxg.lineWidth=4;
      fxg.beginPath(); fxg.arc(p.x,p.y,p.maxR*(age/p.life),0,7); fxg.stroke();
    }else if(p.kind==='flash'){
      fxg.globalAlpha=p.a*k; fxg.fillStyle=p.color; fxg.fillRect(0,0,3840,2160);
    }
    fxg.restore();
  }
  const el=$('toast');
  if(toastUntil){
    const left=toastUntil-now;
    el.style.opacity=left>400?'1':String(Math.max(0,left/400));
    if(left<=0) toastUntil=0;
  }
  let tr='';
  if(now<shake.until){const k=(shake.until-now)/shake.dur, m=shake.mag*k*k; tr='translate('+(Math.sin(now/17)*m)+'px,'+(Math.cos(now/13)*m)+'px)';}
  $('scan').style.transform=tr; $('pos').style.transform=tr;
}
// ---- chat, same public rules as before (held tokens, stage colours, CHIEF already scrubbed) ----
const BOT_COL={SCAN:'#ffe14d',VET:'#4de1ff',BOOK:'#c58cff',SIZE:'#ff8ad8',FILLS:'#ffb347',FILL:'#ffb347',RISK:'#7fb2ff',CHIEF:'#f5ecc8',SOCIAL:'#b8a890'}, BOT_COL_DEF='#b8a890';
const TCH='[\\p{L}\\p{N}\\p{So}\\p{Sk}$._\\-]';
const TOK_RE=new RegExp('^((?:Pilnuje|Zamykam|Otwieram|Kupuj[eę]|Trzymam|Sprzedaj[eę](?:\\s+\\d\\/\\d)?|Sprzedałem(?:\\s+\\d\\/\\d)?|Zamknąłem|Otworzyłem)\\s+)('+TCH+'{1,40})','u');
const TOK_WORD=new RegExp('('+TCH+'{2,40})','gu');
const TOK_STOP=new Set(['DO','NA','ZA','PO','OD','WE','W','Z','I','A','THE','TO','OF','AND','OR','BY','OK','SITO','TOKENOW','TOKEN','PRZEZ','MIN','MAX','BANKU','TABLICE','PONIZEJ','POWYZEJ','JEDYNY','KANDYDAT','BEZ','WYBORU','SEDZIEGO','PRZESZLO','FRESH','STAGE','SUPERPOSITION','RECHECK','PONOWNIE','S','HTTP','USD']);
const VERB_TOK=new RegExp('^((?:Przepuszczam|Odrzucilem|Odrzuciłem|Przekazalem|Przekazałem|Biore|Biorę|Ponownie sprawdzilem|Ponownie sprawdziłem|Wystawilem|Wystawiłem|Wypelnione:|Wypełnione:|Pilnuje|Zamykam|Otwieram|Kupuj[eę]|Trzymam|Sprzedaj[eę](?:\\s+\\d\\/\\d)?|Sprzedałem(?:\\s+\\d\\/\\d)?|Zamknąłem|Otworzyłem|Zamknalem|Polowa|Połowa)\\s+)('+TCH+'{1,40})','u');
const KNOWN=new Set();
const HELD_ST=v=>({color:v>0?'#3dff7a':v<0?'#ff4d4d':'#3dff7a',textDecoration:'underline'});
const NAME_RE=/^((?:Wypelnione:|Wypełnione:|SEDZIA wybor:|SEDZIA rynek|wybor:)\s+)([^:(]{1,40}?)(?=\s*(?:\(|:|$))/;
function tokEl(tok,open,v){const up=tok.toUpperCase();KNOWN.add(up);return open.has(up)?spEl(tok,null,HELD_ST(v)):spEl(tok,'#ffffff',{textDecoration:'underline'});}
function openSyms(){return heldSet();}
function spEl(s,c,extra){const e=document.createElement('span');e.textContent=s;if(c)e.style.color=c;if(extra)Object.assign(e.style,extra);return e;}
function appendTokBody(el,body,open){
  const pil=/^(Pilnuje\s+)([^:]{1,40}?)(:\s*)(FRESH|STAGE\s*0|Stage\s+(?:IV|III|II|I))?(.*)$/i.exec(body);
  if(pil){el.append(pil[1]);const tok=pil[2],sep=pil[3]||'',lab=pil[4]||'',tail=pil[5]||'';
    const rest=sep+lab+tail;const pm=/([+\-−])\s?(\d+(?:[.,]\d+)?)\s?%/.exec(rest);const v=pm?(pm[1]==='+'?1:-1)*parseFloat(pm[2].replace(',','.')):0;
    el.append(tokEl(tok,open,v)); if(sep)el.append(sep);
    if(/^FRESH$/i.test(lab)) el.append(spEl(lab,'#ffffff',{textDecoration:'underline'}));
    else if(lab){const sm=/^(STAGE\s*0)$/i.exec(lab)||/^Stage\s+(IV|III|II|I)$/i.exec(lab);const key=sm?(sm[1]?sm[1].toUpperCase():'STAGE 0'):null;const col=key&&(STAGE_COL[key]||STAGE_COL[key.replace(/^STAGE\s*/i,'')]);el.append(col?spEl(lab,col):document.createTextNode(lab));}
    if(tail) appendTokTail(el,tail,open); return;}
  const k=NAME_RE.exec(body)||VERB_TOK.exec(body)||TOK_RE.exec(body);
  if(k){el.append(k[1]);const tok=k[2],up=tok.toUpperCase();const rest=body.slice(k[0].length);const pm=/([+\-−])\s?(\d+(?:[.,]\d+)?)\s?%/.exec(rest);const v=pm?(pm[1]==='+'?1:-1)*parseFloat(pm[2].replace(',','.')):0;
    if(/^\d+$/.test(tok)||TOK_STOP.has(up)) el.append(tok); else el.append(tokEl(tok,open,v));
    appendTokTail(el,rest,open); return;}
  appendTokTail(el,body,open);
}
function appendTokTail(el,text,open){
  let last=0,m; TOK_WORD.lastIndex=0;
  while((m=TOK_WORD.exec(text))){
    if(m.index>last) el.append(text.slice(last,m.index));
    const tok=m[1], up=tok.toUpperCase();
    if(/^(STAGE|FRESH|IV|III|II|I)$/i.test(tok)){
      if(/^FRESH$/i.test(tok)) el.append(spEl(tok,'#ffffff',{textDecoration:'underline'}));
      else if(STAGE_COL[up]||STAGE_COL[tok]) el.append(spEl(tok,STAGE_COL[up]||STAGE_COL[tok]));
      else el.append(tok);
    }else if(open.has(up)) el.append(spEl(tok,null,HELD_ST(0)));
    else if(KNOWN.has(up)&&!TOK_STOP.has(up)) el.append(spEl(tok,'#ffffff',{textDecoration:'underline'}));
    else el.append(tok);
    last=m.index+tok.length;
  }
  if(last<text.length) el.append(text.slice(last));
}
function sysLine(el,m){
  const r=/^(\d\d:\d\d )?🤖 ([^\s:]+): ([\s\S]*)$/.exec(m.text||'');
  if(!r){el.textContent='» '+(m.text||''); return;}
  const bot=String(m.bot||r[2]).toUpperCase();
  el.append('» ', spEl((r[1]||'')+'🤖 '+r[2], BOT_COL[bot]||BOT_COL_DEF), ': ');
  appendTokBody(el, r[3], openSyms());
}
const seenChat=new Set(); const chatQueue=[]; let histLoaded=false;
function pushChat(m){
  const key=(m.bot||m.name||'')+'|'+(m.text||'');
  if(seenChat.has(key)) return;
  seenChat.add(key);
  const log=$('log'), el=document.createElement('div');
  if(m.system){el.className='sys'; sysLine(el,m);}
  else{
    const t=document.createElement('span'); t.className='tag'; t.textContent=m.scope==='zone'?'['+(ZN[m.zone]||m.zone)+'] ':'[GLOBAL] ';
    const n=document.createElement('b'); n.style.color=m.color||''; n.textContent=m.name||'';
    el.append(t,n,document.createTextNode(': '+(m.text||'')));
    speak(m.id, m.text);
  }
  log.appendChild(el); log.scrollTop=log.scrollHeight;
}
function speak(id, text){
  if(!id) return;
  const s=String(text||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,90);
  bubbles[id]={text:s||'…', until:Date.now()+5000};
}
function formatAct(a){
  const raw=String(a.text||'');
  const tm=/^\d\d:\d\d /.test(raw)?raw.slice(0,6):'', bt=tm?raw.slice(6):raw;
  return {system:true, bot:a.bot, text:tm+'🤖 '+a.bot+': '+bt};
}
const evP=v=>v==null?'?':v>=1?+v.toPrecision(6)+'':String(+v.toPrecision(4));
const evU=v=>v==null?'?':'$'+(Math.round(v*100)/100);
function renderPosEvents(evs){
  const el=$('plist'); el.innerHTML='';
  if(!evs||!evs.length){const d=document.createElement('div'); d.className='b'; d.textContent='brak zdarzeń pozycji'; el.appendChild(d); return;}
  for(const e of evs.slice(0,50)){
    const d=document.createElement('div');
    const tm=new Date(e.ts).toLocaleTimeString('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit'});
    const sg=v=>(v>=0?'+':'')+v; let t;
    if(e.action==='OPEN'){t=tm+' OPEN '+e.token+' '+(e.chain||'?')+' '+evU(e.usd)+' @'+evP(e.price); d.className='ev-o';}
    else{t=(tm+' '+(e.action==='SELL'?'SELL '+(e.frac||'1/4'):'CLOSE')+' '+e.token+' '+(e.chain||'?')+' '+evU(e.usd)+' @'+evP(e.price)+' '+(e.reason||'')+' '+(e.pct!=null?sg((+e.pct).toFixed(1))+'%':'')+' '+(e.net!=null?(e.net>=0?'+$':'-$')+Math.abs(e.net).toFixed(2):'')).replace(/\s+/g,' ').trim(); d.className=e.net==null?'ev-o':e.net>=0?'ev-p':'ev-l';}
    d.textContent=t; el.appendChild(d);
  }
}
function passCell(pass){
  const td=document.createElement('td');
  const n=(pass&&pass.n)|0, w=(pass&&pass.wins)|0, l=(pass&&pass.losses)|0;
  const add=(t,c)=>{const s=document.createElement('span'); s.textContent=t; if(c) s.style.color=c; td.appendChild(s);};
  if(!n){add('0','#fff'); return td;}
  add(String(n),'#fff'); add('(','#fff'); add(String(w),GOOD); add(',', '#fff'); add(String(l),BAD); add(')','#fff');
  return td;
}
function renderTable(){
  const tb=$('btbody'); tb.innerHTML='';
  const ps=Object.values(positions).sort((a,b)=>(b.openedAt||0)-(a.openedAt||0));
  if(!ps.length){const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=10; td.style.textAlign='center'; td.textContent='Brak otwartych pozycji'; tr.appendChild(td); tb.appendChild(tr); return;}
  for(const p of ps){
    const tr=document.createElement('tr'); const pl=pnlOf(p); const h6=p.h6!=null?p.h6:p.change6h;
    const mk=(txt,cls)=>{const td=document.createElement('td'); if(cls) td.className=cls; td.textContent=txt; return td;};
    const sym=document.createElement('td'); sym.textContent=p.symbol+(p.chain?' ('+p.chain+')':''); if(p.note) sym.title=p.note;
    tr.appendChild(sym);
    tr.appendChild(mk((p.side==='LONG'?'▲ ':'▼ ')+p.side));
    tr.appendChild(mk(p.desk?'$'+p.size:String(p.size??'—')));
    tr.appendChild(mk((Number.isFinite(pl)?fmtPct(pl):'—')+(p.desk&&p.entry==null?' vs ref':''), pl>=0?'pos':'neg'));
    tr.appendChild(mk(p.h1==null?'—':fmtPct(p.h1), p.h1>0?'pos':p.h1<0?'neg':''));
    tr.appendChild(mk(h6==null?'—':fmtPct(h6), h6>0?'pos':h6<0?'neg':''));
    tr.appendChild(mk(fmtK(p.mcap)));
    tr.appendChild(passCell(p.pass));
    tr.appendChild(mk(p.desk?(p.status||p.bot||''):(p.bot||'')));
    tr.appendChild(mk(p.openedAt?new Date(p.openedAt).toLocaleString('pl-PL',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'—'));
    tb.appendChild(tr);
  }
}
function renderTop10(){
  const box=$('t10tables'); box.innerHTML='';
  const desk=top10&&top10.source==='desk';
  $('t10title').textContent=desk?'SKAN DESKU':'TOP 10 KRYPTO';
  const table=(title, items, deskMode)=>{
    const h=document.createElement('h3'); h.textContent=title; h.style.letterSpacing='.12em'; box.appendChild(h);
    const tb=document.createElement('table'), hd=document.createElement('thead'), bd=document.createElement('tbody');
    hd.innerHTML=deskMode?'<tr><th>#</th><th>Ticker</th><th>Chain</th><th>MC</th><th>Płynność</th><th>1h</th><th>Etap / powód</th></tr>':'<tr><th>#</th><th>Symbol</th><th>Cena</th><th>24h</th><th>Kapitalizacja</th></tr>';
    items.forEach((c,i)=>{
      const tr=document.createElement('tr');
      const add=(v,cls)=>{const td=document.createElement('td'); td.textContent=v==null?'':String(v); if(cls) td.className=cls; tr.appendChild(td);};
      if(deskMode){
        const up=(c.change1h||0)>=0;
        [c.rank||i+1,c.symbol,c.chain,fmtK(c.marketCap),fmtK(c.liquidity)].forEach(v=>add(v));
        add(c.change1h==null?'—':(up?'▲ ':'▼ ')+Math.abs(c.change1h).toFixed(2)+'%', c.change1h==null?'':up?'pos':'neg');
        add((STG[c.stage]||c.stage||'')+(c.reason?' · '+c.reason:''));
      }else{
        const up=(c.change24h||0)>=0;
        add(c.rank||i+1); add((c.symbol||'')+(c.name?' · '+c.name:'')); add(fmtPx(c.price));
        add((up?'▲ ':'▼ ')+Math.abs(c.change24h||0).toFixed(2)+'%', up?'pos':'neg'); add(fmtK(c.marketCap));
      }
      bd.appendChild(tr);
    });
    tb.append(hd,bd); box.appendChild(tb);
  };
  if(desk){
    table('TERAZ', top10.items||[], true);
    if(top10.prev&&top10.prev.items) table('POPRZEDNI SKAN', top10.prev.items, true);
    $('t10upd').textContent=(top10.rule||'')+(scan&&scan.dexError?' · wykres: '+scan.dexError:'');
  }else{
    table('RYNEK', top10.items||[], false);
    $('t10upd').textContent='aktualizacja: '+(top10.updatedAt?new Date(top10.updatedAt).toLocaleString('pl-PL'):'—')+(top10.source?' ('+top10.source+')':'');
  }
}
function newsParts(){
  const n=ticker&&ticker.news;
  if(!n||!n.items||!n.items.length) return [{text:'BRAK DANYCH    ·    ', color:BAD}];
  const out=[];
  n.items.slice(0,12).forEach(i=>{out.push({text:(i.title||'')+' ', color:'#e8f1ff'}); out.push({text:'('+(i.source||'')+')    ·    ', color:'#8ea3c4'});});
  return out;
}
function cryptoParts(){
  const c=ticker&&ticker.crypto;
  if(!c||!c.items||!c.items.length) return [{text:'BRAK DANYCH    ·    ', color:BAD}];
  const out=[];
  c.items.forEach(i=>{
    const up=(i.change24h||0)>=0;
    out.push({text:(i.symbol||'')+' '+fmtPx(i.price)+' ', color:AMBER});
    out.push({text:(i.change24h==null?'—':fmtPct(i.change24h))+'    ·    ', color:up?GOOD:BAD});
  });
  return out;
}
function setMarquee(id, parts){
  const track=document.querySelector('#'+id+' .track');
  const sig=parts.map(p=>p.text).join('|');
  if(track.dataset.sig===sig) return;
  track.dataset.sig=sig; track.textContent='';
  for(let copy=0; copy<2; copy++){
    const span=document.createElement('span');
    for(const p of parts){const s=document.createElement('span'); s.textContent=p.text; if(p.color) s.style.color=p.color; span.appendChild(s);}
    track.appendChild(span);
  }
}
function tickMarquee(id, speed, t){
  const track=document.querySelector('#'+id+' .track');
  const w=track.scrollWidth/2; if(w<10) return;
  track.style.transform='translateX('+(-((t/1000*speed)%w))+'px)';
}
function paintChrome(now){
  try{
    clock.textContent=new Date().toLocaleTimeString('pl-PL',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit',second:'2-digit'})+'  WAW';
  }catch(e){clock.textContent=new Date().toLocaleTimeString();}
  if(feedAt){const s=Math.max(0,Math.round((Date.now()-feedAt)/1000)); feedAge.textContent='feed '+s+'s'; feedAge.style.color=s>120?BAD:GOOD;}
  const r=rotNow();
  $('rotbar').style.width=(scan&&scan.total? (r.p*100):0)+'%';
  const tok=currentToken();
  $('rotlabel').textContent=scan&&scan.total?( (r.i+1)+' / '+scan.total+'  ·  '+Math.ceil(r.left/1000)+'s'+(tok?'  ·  '+tok.symbol:'')):'brak skanu';
  setMarquee('news', newsParts()); setMarquee('crypto', cryptoParts());
  tickMarquee('news', 90, now); tickMarquee('crypto', 70, now);
}
function updOnline(){
  const ps=Object.values(players);
  $('online').textContent='Online: '+ps.filter(p=>!p.bot).length+' + '+ps.filter(p=>p.bot).length+' boty';
}
function hud(){
  const tok=currentToken();
  const head=ticker&&ticker.news&&ticker.news.items&&ticker.news.items[0]&&ticker.news.items[0].title||'';
  return {scan:tok?tok.symbol:'—', pos:String(Object.keys(positions).length), bank:portfolio&&portfolio.bank!=null?'$'+Math.round(portfolio.bank):'—', headline:head};
}
// ---- socket ----
const socket=io({autoConnect:true});
const keys={};
socket.on('connect', ()=>{socket.emit('join', joined?{name:myName,color:myColor,sprite:mySprite}:{spectate:true});});
socket.on('init', d=>{me=d.you||null; players=d.players||{}; for(const p of Object.values(players)){p.rx=p.x; p.ry=p.y;} updOnline();});
socket.on('playerJoined', p=>{p.rx=p.x; p.ry=p.y; players[p.id]=p; updOnline();});
socket.on('playerMoved', d=>{const p=players[d.id]; if(p){Object.assign(p,d); p.lastMove=performance.now();}});
socket.on('botState', d=>{const p=players[d.id]; if(!p) return; p.status=d.status; p.act=d.act; p.carry=d.carry; if(p.act==='walk') p.lastMove=performance.now();});
socket.on('playerLeft', id=>{delete players[id]; delete bubbles[id]; updOnline();});
socket.on('correct', d=>{const p=players[me]; if(p){p.x=p.rx=d.x; p.y=p.ry=d.y;}});
socket.on('chat', m=>{if(!histLoaded&&m.system) chatQueue.push(m); else pushChat(m);});
socket.on('bubble', d=>{const p=players[d.id]; speak(d.id, d.text);});
socket.on('positions', list=>{positions={}; for(const p of list||[]) positions[p.id]=p; notePeaks(); feedAt=Date.now(); posSig='';});
socket.on('position', p=>{positions[p.id]=p; notePeaks(); feedAt=Date.now(); posSig='';});
socket.on('positionClosed', id=>{delete positions[id]; posSig='';});
socket.on('portfolio', d=>{if(d&&typeof d==='object'&&!d.empty){portfolio=d; portSig=''; feedAt=Date.now();}});
socket.on('ticker', d=>{if(d&&typeof d==='object') ticker=d;});
socket.on('top10', d=>{if(d&&Array.isArray(d.items)){top10=d; renderTop10();}});
socket.on('scan', d=>{if(d&&typeof d==='object'){scan=d; if(d.lastFeedAt) feedAt=d.lastFeedAt; queueSig='';}});
socket.on('deskFx', onFx);
socket.on('posEvents', renderPosEvents);
socket.on('printer', d=>{if(d&&Number.isFinite(+d.pile)) printerPile=+d.pile;});
function notePeaks(){
  for(const p of Object.values(positions)){
    if(p.peak>0){const st=p.peak<=10?0:p.peak<=25?1:p.peak<=50?2:p.peak<=100?3:4; const k=String(p.symbol||'').toUpperCase(); if(riskBadge[k]==null||st>riskBadge[k]) riskBadge[k]=st;}
  }
}
// ---- input ----
addEventListener('keydown', e=>{
  const tag=document.activeElement&&document.activeElement.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'){if(e.key==='Escape') document.activeElement.blur(); return;}
  if(e.key==='Enter'){$('msg').focus(); e.preventDefault(); return;}
  keys[e.key.toLowerCase()]=1;
  if(e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e=>{keys[e.key.toLowerCase()]=0;});
let lastSend=0, lastZone=null;
function update(dt){
  const p=players[me]; if(!p) return;
  const sp=72*dt; let dx=0, dy=0;
  if(keys.arrowleft||keys.a) dx-=1; if(keys.arrowright||keys.d) dx+=1;
  if(keys.arrowup||keys.w) dy-=1; if(keys.arrowdown||keys.s) dy+=1;
  p.moving=!!(dx||dy); if(!p.moving) return;
  if(dx&&dy){dx*=.707; dy*=.707;}
  p.dir=dx<0?'left':dx>0?'right':dy<0?'up':'down';
  if(!blocked(p.x+dx*sp, p.y)) p.x+=dx*sp;
  if(!blocked(p.x, p.y+dy*sp)) p.y+=dy*sp;
  p.rx=p.x; p.ry=p.y;
  const now=performance.now();
  if(now-lastSend>50){lastSend=now; socket.emit('move',{x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,dir:p.dir});}
}
$('form').onsubmit=e=>{
  e.preventDefault();
  const v=$('msg').value.trim(); if(!v) return;
  if(!me){showToast('WEJDŹ, ŻEBY PISAĆ', AMBER, 1400); return;}
  socket.emit('chat',{text:v, scope}); $('msg').value=''; $('msg').blur();
};
$('tg').onclick=()=>{scope='global'; $('tg').className='on'; $('tz').className='';};
$('tz').onclick=()=>{scope='zone'; $('tz').className='on'; $('tg').className='';};
$('tb').onclick=()=>$('board').classList.toggle('show');
$('bclose').onclick=()=>$('board').classList.remove('show');
$('t10b').onclick=()=>{renderTop10(); $('top10').classList.toggle('show');};
$('t10close').onclick=()=>$('top10').classList.remove('show');
function paintAudio(){
  if(!audio.unlocked) audioBtn.textContent='WŁĄCZ DŹWIĘK';
  else audioBtn.textContent=audio.muted?'DŹWIĘK WYŁ':'DŹWIĘK WŁ';
}
audioBtn.onclick=async()=>{
  if(!audio.unlocked){audio.setMuted(false); await audio.unlock(); paintAudio(); return;}
  audio.setMuted(!audio.muted); paintAudio();
};
stage.addEventListener('pointerdown', async ev=>{
  if(ev.target.closest('button,input,a')) return;
  if(audio.savedOn()&&!audio.unlocked){audio.setMuted(false); await audio.unlock(); paintAudio();}
});
function renderPicks(){
  const cd=$('colors'), sd=$('sprites'); cd.innerHTML=''; sd.innerHTML='';
  COLORS.forEach((col,i)=>{
    const c=document.createElement('canvas'); c.width=92; c.height=104;
    const g=c.getContext('2d'); g.fillStyle='#0c1424'; g.fillRect(0,0,92,104);
    g.save(); g.translate(46,98); g.scale(2.5,2.5);
    OFFICE.drawPerson(g,{rx:0,ry:0,color:col,sprite:mySprite,dir:'down',name:''}, performance.now());
    g.restore();
    if(col===myColor) c.className='on';
    c.onclick=()=>{if(!joined){myColor=col; renderPicks();}};
    cd.appendChild(c);
  });
  [0,1,2,3].forEach(i=>{
    const c=document.createElement('canvas'); c.width=92; c.height=104;
    const g=c.getContext('2d'); g.fillStyle='#0c1424'; g.fillRect(0,0,92,104);
    g.save(); g.translate(46,98); g.scale(2.5,2.5);
    OFFICE.drawPerson(g,{rx:0,ry:0,color:myColor,sprite:i,dir:'down',name:''}, performance.now());
    g.restore();
    if(i===mySprite) c.className='on';
    c.onclick=()=>{if(!joined){mySprite=i; renderPicks();}};
    sd.appendChild(c);
  });
}
$('nick').value=localStorage.nick||'';
$('go').onclick=()=>{
  const n=$('nick').value.trim(); if(!n){$('nick').focus(); return;}
  myName=n; localStorage.nick=n; joined=true;
  socket.emit('join',{name:n, color:myColor, sprite:mySprite});
};
renderPicks();
async function loadHistory(){
  try{
    const [feed, port, tick, sc, t10]=await Promise.all([
      fetch('/api/feed').then(r=>r.json()),
      fetch('/api/portfolio').then(r=>r.json()),
      fetch('/api/ticker').then(r=>r.json()),
      fetch('/api/scan').then(r=>r.json()),
      fetch('/api/top10').then(r=>r.json())
    ]);
    if(feed&&feed.activity) feed.activity.forEach(a=>pushChat(formatAct(a)));
    if(feed&&feed.posEvents) renderPosEvents(feed.posEvents);
    if(feed&&feed.lastFeedAt) feedAt=feed.lastFeedAt;
    if(port&&!port.empty) portfolio=port;
    if(tick) ticker=tick;
    if(sc&&sc.tokens) scan=sc;
    if(t10&&Array.isArray(t10.items)){top10=t10; renderTop10();}
  }catch(e){console.log('history', e.message);}
  histLoaded=true;
  chatQueue.splice(0).forEach(pushChat);
}
loadHistory();
if(document.fonts){
  document.fonts.ready.then(()=>FLAP.clearCache());
  document.fonts.addEventListener&&document.fonts.addEventListener('loadingdone', ()=>FLAP.clearCache());
}
function frame(t){
  const dt=Math.min(.05, (t-(frame.prev||t))/1000); frame.prev=t;
  update(dt);
  for(const p of Object.values(players)){
    if(p.rx==null){p.rx=p.x; p.ry=p.y;}
    else if(p.id!==me){p.rx+=(p.x-p.rx)*.35; p.ry+=(p.y-p.ry)*.35;}
  }
  layoutDisplays();
  syncScan(false); syncPos(false); syncPort(false);
  const tokNow=currentToken();
  drawChart($('chart'), tokNow&&tokNow.chart, !tokNow||(tokNow.change1h||0)>=0);
  drawBank($('portChart'), portfolio);
  nameFlap.frame(t); priceFlap.frame(t); statFlap.frame(t); posFlap.frame(t); portFlap.frame(t);
  office.frame(t, {players, me, printerPile, bubbles, hud:hud()});
  drawFx(t); paintChrome(t);
  const p=players[me];
  if(p){
    const z=zoneAt(p.x,p.y);
    $('zone').textContent='Strefa: '+(ZN[z]||z);
    if(z!==lastZone){
      if(z==='board') $('board').classList.add('show'); else if(lastZone==='board') $('board').classList.remove('show');
      if(z==='top10'){$('top10').classList.add('show'); renderTop10();} else if(lastZone==='top10') $('top10').classList.remove('show');
      lastZone=z;
    }
  }
}
function loop(t){
  try{frame(t);}catch(e){if(e.message!==lastErr){console.error(e); lastErr=e.message;}}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.AO={
  demoFx(ev){onFx(Object.assign({ts:Date.now()}, ev||{}));},
  replay(){shownId=''; shownData=''; posSig=''; portSig=''; syncScan(true); syncPos(true); syncPort(true);},
  unlock(){audio.setMuted(false); return audio.unlock().then(paintAudio);},
  scan(){return scan;}, positions(){return positions;}, portfolio(){return portfolio;}
};
