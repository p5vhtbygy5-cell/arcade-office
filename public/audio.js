// Procedural board audio. Nothing is fetched; every effect is an oscillator.
// The context stays suspended until a click, which is what browsers allow.
(function(root){
function create(){
  let ctx=null, master=null, noise=null, muted=true, unlocked=false;
  const q=[];
  let playing=false;
  function ac(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return null;
      ctx=new AC();
      master=ctx.createGain();
      master.gain.value=0.9;
      const comp=ctx.createDynamicsCompressor();
      comp.threshold.value=-14; comp.knee.value=12; comp.ratio.value=4; comp.attack.value=0.003; comp.release.value=0.2;
      master.connect(comp); comp.connect(ctx.destination);
    }
    return ctx;
  }
  function noiseBuf(){
    if(noise||!ctx) return noise;
    noise=ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d=noise.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return noise;
  }
  function audible(){return ctx&&ctx.state==='running'&&unlocked&&!muted;}
  function tone(freq, t, dur, type, gain){
    if(!audible()||!(freq>0)) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t+dur+0.02);
  }
  function sweep(f0, f1, t, dur, gain, type){
    if(!audible()) return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type||'sawtooth';
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t+dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t+dur+0.02);
  }
  function burst(t, dur, freq, gain){
    if(!audible()) return;
    const src=ctx.createBufferSource();
    src.buffer=noiseBuf();
    const f=ctx.createBiquadFilter();
    f.type='bandpass'; f.frequency.value=freq; f.Q.value=0.8;
    const g=ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t+dur+0.02);
  }
  function pump(){
    if(playing||!q.length) return;
    if(!audible()){q.length=0; return;}
    playing=true;
    const job=q.shift();
    try{job.fn();}catch(e){}
    setTimeout(()=>{playing=false; pump();}, job.ms);
  }
  function enqueue(fn, ms, pri){
    if(!audible()) return;
    const job={fn, ms};
    if(pri) q.unshift(job); else q.push(job);
    while(q.length>6) q.pop();
    pump();
  }
  function stage(level){
    const lv=level|0;
    const ms=[0, 200, 380, 640, 1100][lv]||400;
    enqueue(()=>{
      const t=ctx.currentTime;
      if(lv<=1){tone(440, t, 0.12, 'sine', 0.07); return;}
      if(lv===2){tone(523, t, 0.12, 'triangle', 0.11); tone(784, t+0.12, 0.16, 'triangle', 0.12); return;}
      if(lv===3){
        tone(392, t, 0.1, 'square', 0.06);
        tone(523, t+0.1, 0.12, 'triangle', 0.14);
        tone(659, t+0.22, 0.14, 'triangle', 0.15);
        tone(880, t+0.36, 0.2, 'sine', 0.16);
        burst(t+0.05, 0.08, 900, 0.05);
        return;
      }
      [523,659,784].forEach(f=>tone(f, t, 0.42, 'triangle', 0.16));
      tone(1046, t+0.08, 0.36, 'sine', 0.18);
      sweep(180, 1600, t, 0.4, 0.12, 'sawtooth');
      burst(t, 0.22, 500, 0.1);
      tone(1568, t+0.32, 0.28, 'sine', 0.16);
    }, ms, lv>=4);
  }
  function fanfare(t, g, big){
    const notes=big?[392,523,659,784,1046,1318]:[523,659,784,1046];
    notes.forEach((f,i)=>tone(f, t+i*0.11, 0.24, i%2?'triangle':'sine', g));
    if(big){sweep(160, 980, t, 0.45, g*0.55, 'sawtooth'); burst(t, 0.18, 240, g*0.4); tone(1568, t+0.55, 0.32, 'sine', g*0.7);}
  }
  function close(stageN){
    const st=stageN==null?0:stageN|0;
    const pri=st>=3||st<0;
    const ms=st<0?800:[280,460,720,1000,1400][st]||400;
    enqueue(()=>{
      const t=ctx.currentTime;
      if(st<0){
        sweep(340, 70, t, 0.55, 0.16, 'sawtooth');
        tone(300, t, 0.4, 'triangle', 0.07);
        tone(226, t+0.02, 0.48, 'sine', 0.08);
        return;
      }
      const g=[0.1,0.13,0.18,0.26,0.38][st]||0.12;
      if(st===0){tone(880, t, 0.08, 'sine', g); tone(1320, t+0.08, 0.14, 'sine', g); return;}
      if(st===1){tone(659, t, 0.1, 'triangle', g); tone(880, t+0.1, 0.12, 'triangle', g); tone(1174, t+0.22, 0.18, 'sine', g); return;}
      if(st===2){tone(523, t, 0.12, 'triangle', g); tone(659, t+0.12, 0.12, 'triangle', g); tone(784, t+0.24, 0.16, 'triangle', g); tone(1046, t+0.4, 0.22, 'sine', g); return;}
      fanfare(t, g, st>=4);
    }, ms, pri);
  }
  function sell(){
    enqueue(()=>{
      const t=ctx.currentTime;
      tone(740, t, 0.07, 'sine', 0.08);
      tone(988, t+0.07, 0.1, 'sine', 0.09);
    }, 220, false);
  }
  function clack(){if(!audible()) return; burst(ctx.currentTime, 0.018, 1600, 0.045);}
  async function unlock(){
    const a=ac(); if(!a) return false;
    if(a.state!=='running'){try{await a.resume();}catch(e){}}
    noiseBuf();
    unlocked=a.state==='running';
    return unlocked;
  }
  function setMuted(v){muted=!!v; try{localStorage.setItem('ao.audio', muted?'off':'on');}catch(e){}}
  function isMuted(){return muted||!unlocked;}
  function savedOn(){try{return localStorage.getItem('ao.audio')==='on';}catch(e){return false;}}
  return {stage, close, sell, clack, unlock, setMuted, isMuted, savedOn, get unlocked(){return unlocked;}, get muted(){return muted;}};
}
root.AUDIO={create};
})(window);
