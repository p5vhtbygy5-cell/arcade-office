// SCAN sieve dwells. Nominal 4s per handoff (clamp 2.5–6s). Rejects share the
// rest of 0.92×interval. Reject dwell has a 0.35s floor; if that would overrun
// the budget, extra rejects are skipped (dwell 0) so the batch still fits.
(function(root, factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.SIEVE_TIMING=factory();
})(typeof self!=='undefined'?self:this, function(){
  const HANDOFF_TARGET=4000, HANDOFF_MIN=2500, HANDOFF_MAX=6000, REJECT_MIN=350, BUDGET=0.92;
  function isHandoff(it){
    if(!it||typeof it!=='object') return false;
    if(it.handoff===true||it.handoff===1) return true;
    if(typeof it.handoff==='string'&&it.handoff.toLowerCase()==='true') return true;
    return false;
  }
  function pickEven(idxs, k){
    if(k<=0) return [];
    if(k>=idxs.length) return idxs.slice();
    const used=new Set(), out=[];
    for(let i=0;i<k;i++){
      let pos=k===1?Math.floor((idxs.length-1)/2):Math.round(i*(idxs.length-1)/(k-1));
      while(used.has(pos)&&pos<idxs.length-1) pos++;
      if(used.has(pos)){
        for(let j=0;j<idxs.length;j++) if(!used.has(j)){pos=j;break;}
      }
      used.add(pos);
      out.push(idxs[pos]);
    }
    return out;
  }
  function computeDwells(items, intervalS){
    const list=Array.isArray(items)?items:[];
    const n=list.length;
    const interval=Number(intervalS);
    const intervalMs=(Number.isFinite(interval)&&interval>0?interval:120)*1000;
    const budget=BUDGET*intervalMs;
    const dwells=new Array(n).fill(0);
    const handIdx=[], rejIdx=[];
    for(let i=0;i<n;i++) (isHandoff(list[i])?handIdx:rejIdx).push(i);
    let handMs=0;
    if(handIdx.length){
      handMs=Math.min(HANDOFF_MAX, HANDOFF_TARGET);
      if(handIdx.length*handMs>budget) handMs=budget/handIdx.length;
      if(handMs<HANDOFF_MIN&&handIdx.length*HANDOFF_MIN<=budget) handMs=HANDOFF_MIN;
      if(handMs>HANDOFF_MAX) handMs=HANDOFF_MAX;
    }
    const handTotal=handIdx.length*handMs;
    let rejMs=0, skipped=0;
    if(rejIdx.length){
      const raw=(budget-handTotal)/rejIdx.length;
      if(raw>=REJECT_MIN){
        rejMs=raw;
        for(const i of rejIdx) dwells[i]=rejMs;
      }else{
        rejMs=REJECT_MIN;
        const afford=Math.max(0, Math.floor((budget-handTotal)/REJECT_MIN));
        const keep=new Set(pickEven(rejIdx, afford));
        for(const i of rejIdx){
          if(keep.has(i)) dwells[i]=REJECT_MIN;
          else{dwells[i]=0; skipped++;}
        }
      }
    }
    for(const i of handIdx) dwells[i]=handMs;
    return {dwells, handMs, rejMs, budget, handTotal, skipped, intervalMs};
  }
  return {computeDwells, isHandoff, HANDOFF_TARGET, HANDOFF_MIN, HANDOFF_MAX, REJECT_MIN, BUDGET};
});
