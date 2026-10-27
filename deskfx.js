// Stage and close effects for the public board. Sounds and visuals are driven by
// socket event "deskFx"; this module only decides when one should fire.
// Judge/CHIEF lines are reduced to "wybor: TOKEN" before they are stored or shown.
module.exports=function createDeskFx({io}){
let armed=false;
const peaks=new Map();
const seenPos=new Set();
const recent=[];
const STAGE_FLOOR=[0.01,10.01,25.01,50.01,100.01];

function scrub(bot, text){
  const t=String(text||'');
  if(String(bot||'').toUpperCase()!=='CHIEF') return t;
  const pre=/^(\d\d:\d\d\s)/.exec(t);
  const body=pre?t.slice(pre[1].length):t;
  const w=/wyb[oó]r:\s*([^\s,;]+)/i.exec(body);
  if(w) return (pre?pre[1]:'')+'wybor: '+w[1].replace(/[.,)]+$/,'');
  if(/\b(worth_trading|confidence|score)\b/i.test(body)) return (pre?pre[1]:'')+'wybor: —';
  return t;
}
function keyOf(sym){return String(sym||'').trim().toUpperCase();}
function aliasKeys(sym){
  const k=keyOf(sym);
  if(!k) return [];
  const core=k.replace(/^[\p{S}\p{P}\p{Z}]+/gu,'').replace(/[\p{S}\p{P}]+$/gu,'');
  return core&&core!==k?[k,core]:[k];
}
function notePnl(sym, pct){
  const k=keyOf(sym);
  if(!k) return null;
  if(pct==null||!Number.isFinite(+pct)) return peaks.has(k)?peaks.get(k):null;
  const prev=peaks.has(k)?peaks.get(k):null;
  const v=prev==null?+pct:Math.max(prev, +pct);
  peaks.set(k, v);
  return v;
}
// One number shared by every alias (ASCII symbol and display name). A negative
// peak is kept; a later higher print, including from the feed after a restart, wins.
function notePeaks(names, pct){
  const keys=[...new Set((names||[]).map(keyOf).filter(Boolean))];
  if(!keys.length) return null;
  if(pct==null||!Number.isFinite(+pct)){
    const vals=keys.filter(k=>peaks.has(k)).map(k=>peaks.get(k));
    return vals.length?Math.max(...vals):null;
  }
  let best=+pct;
  for(const k of keys) if(peaks.has(k)) best=Math.max(best, peaks.get(k));
  for(const k of keys) peaks.set(k, best);
  return best;
}
function peak(sym){const k=keyOf(sym); return k&&peaks.has(k)?peaks.get(k):null;}
function winStage(pct){
  if(!(pct>0)) return 0;
  if(pct<=10) return 0;
  if(pct<=25) return 1;
  if(pct<=50) return 2;
  if(pct<=100) return 3;
  return 4;
}
function emit(ev){
  if(!armed) return;
  const now=Date.now();
  const k=[ev.kind, ev.level??'', keyOf(ev.token), ev.pct==null?'':Math.round(ev.pct*10)].join('|');
  if(recent.some(r=>r.k===k&&now-r.t<6000)) return;
  recent.push({k, t:now});
  if(recent.length>80) recent.shift();
  io.emit('deskFx', Object.assign({ts:now}, ev));
}
function noteLine(text){
  const m=/Pilnuje\s+([^:]{1,40}?)\s*:\s*(FRESH|STAGE\s*0|Stage\s+IV|Stage\s+III|Stage\s+II|Stage\s+I)\b/i.exec(String(text||''));
  if(!m||/^FRESH$/i.test(m[2])) return;
  let lab=m[2].toUpperCase().replace(/\s+/g,' ').replace(/STAGE\s*/,'STAGE ').trim();
  if(lab==='STAGE0') lab='STAGE 0';
  const table={'STAGE 0':0,'STAGE I':1,'STAGE II':2,'STAGE III':3,'STAGE IV':4};
  const st=table[lab];
  if(st==null) return;
  const sym=m[1].trim(), keys=aliasKeys(sym), floor=STAGE_FLOOR[st];
  const prev=notePeaks(keys, null);
  if(prev==null||floor>prev){
    notePeaks(keys, floor);
    if(armed) io.emit('deskFx', {kind:'risk', token:sym, stage:st, peak:floor, ts:Date.now()});
  }
}
function grab(text, re){
  const m=re.exec(text);
  return m?m[1].replace(/[.,;:)]+$/,'').slice(0,40):null;
}
function pipeline(a){
  const bot=String(a.bot||'').toUpperCase();
  const k=String(a.kind||'');
  const text=String(a.text||'');
  if(bot==='SCAN'&&(k==='scan.batch'||/Przeskanowa[lł]/i.test(text))) return {kind:'stage', level:1, token:null, bot};
  if(bot==='VET'&&(k==='soft.pass'||k==='hard.pass'||/Przepuszczam/i.test(text))){
    const token=grab(text,/Przepuszczam\s+(\S+)/i);
    if(token) return {kind:'stage', level:2, token, bot};
  }
  if((bot==='CHIEF'||bot==='BOOK')&&/wyb[oó]r:|Wybieram/i.test(text)){
    const token=grab(text,/wyb[oó]r:\s*(\S+)/i)||grab(text,/Wybieram\s+(\S+)/i);
    if(token&&token!=='—') return {kind:'stage', level:3, token, bot};
  }
  if(bot==='FILLS'&&(k==='fill'||k==='order.filled'||k==='order.shadow'||/Wype[lł]nione/i.test(text))){
    const token=grab(text,/Wype[lł]nione:?\s*(\S+)/i);
    if(token) return {kind:'stage', level:4, token, bot};
  }
  return null;
}
function onActivity(list){
  for(const a of list||[]){
    noteLine(a.text);
    const ev=pipeline(a);
    if(ev) emit(ev);
  }
}
function onOpen(sym, bot){emit({kind:'stage', level:4, token:sym, bot:bot||'FILLS'});}
function onClose(sym, pct, net, feedPeak, aliases){
  const names=[sym].concat(aliases||[]).filter(Boolean);
  if(feedPeak!=null&&Number.isFinite(+feedPeak)) notePeaks(names, +feedPeak);
  if(pct!=null&&Number.isFinite(+pct)&&pct>0) notePeaks(names, pct);
  const peakNow=notePeaks(names, null);
  const loss=(pct!=null&&pct<0)||(pct==null&&net!=null&&net<0);
  const basis=peakNow==null?(pct>0?pct:0):Math.max(peakNow, pct>0?pct:peakNow);
  const stage=loss?-1:winStage(basis);
  emit({kind:'close', token:sym, pct:pct==null?null:+pct, net:net==null?null:+net, peak:peakNow==null?basis:peakNow, stage});
}
function onSell(e){
  if(e&&e.peak!=null&&Number.isFinite(+e.peak)) notePeaks([e.token, e.displaySymbol], +e.peak);
  emit({kind:'sell', token:(e&&(e.displaySymbol||e.token))||'', pct:e&&e.pct, net:e&&e.net, frac:e&&e.frac||null});
}
function takePos(list){
  const fresh=[];
  for(const e of list||[]){
    const k=e.ts+'|'+e.action+'|'+e.token+'|'+(e.frac||'')+'|'+(e.pct==null?'':e.pct);
    if(seenPos.has(k)) continue;
    seenPos.add(k);
    fresh.push(e);
  }
  if(seenPos.size>5000) seenPos.clear();
  for(const e of fresh){
    if(e.action==='CLOSE') onClose(e.displaySymbol||e.token, e.pct, e.net, e.peak, [e.token, e.displaySymbol]);
    else if(e.action==='SELL') onSell(e);
  }
  return fresh;
}
function closeTokens(list){
  const s=new Set();
  for(const e of list||[]) if(e&&e.action==='CLOSE'&&e.token) s.add(keyOf(e.token));
  return s;
}
return {scrub, notePnl, notePeaks, peak, winStage, onActivity, onOpen, onClose, takePos, closeTokens, arm(){armed=true;}, armed:()=>armed};
};
