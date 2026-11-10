#!/usr/bin/env node
// VET sieve frames from the real 20261110T113353 batch.
// Viewports: desktop 1440x900 and mobile 390x844, reject (Pepetide) and PASS (X).
const p=require('puppeteer-core');
const {spawn}=require('child_process');
const os=require('os');
const path=require('path');
const fs=require('fs');
const ROOT=path.join(__dirname,'..');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const OUT=process.env.SHOT_DIR||'/opt/cursor/artifacts';
const PORT=process.env.VET_SHOT_PORT||'4017';
const TOKEN='vetshot';
const FIX=require(path.join(ROOT,'test/fixtures/vet/fixture-vet-batch.json'));
const THUMBS=path.join(ROOT,'test/fixtures/vet/thumbs');
const PUB=path.join(ROOT,'public/v2/_vetshot');
fs.mkdirSync(OUT,{recursive:true});
fs.mkdirSync(PUB,{recursive:true});
for(const name of fs.readdirSync(THUMBS)) fs.copyFileSync(path.join(THUMBS,name), path.join(PUB,name));
const srv=spawn(process.execPath,[path.join(ROOT,'server.js')],{
  env:{...process.env,PORT:String(PORT),TOP10_MOCK:'1',LIVE_PRICES:'0',TICKER_OFF:'1',BOT_API_TOKEN:TOKEN,
    POSITIONS_FILE:os.tmpdir()+'/pos-vetshot-'+process.pid+'.json',DESK_BOARD_FILE:'/nonexistent/board.json'},
  stdio:'inherit'
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const U='http://127.0.0.1:'+PORT;
function thumbUrl(image){
  const base=path.basename(String(image||''));
  return base?U+'/v2/_vetshot/'+encodeURIComponent(base):null;
}
async function ready(){
  for(let i=0;i<40;i++){
    try{const r=await fetch(U+'/health'); if(r.ok) return;}catch{}
    await wait(150);
  }
  throw new Error('server not up');
}
(async()=>{
  await ready();
  const now=Date.now();
  const items=FIX.items.map(it=>({...it, image:thumbUrl(it.image)}));
  const body={
    updatedAt:new Date(now).toISOString(),
    positions:[],
    activity:[],
    vet_sieve:{
      batch_id:FIX.batch_id,
      cycleTs:new Date(now-2000).toISOString(),
      interval_s:120,
      batch_s:2,
      total:items.length,
      handoff_n:FIX.handoff_n,
      items
    }
  };
  const post=await fetch(U+'/api/feed',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+TOKEN},body:JSON.stringify(body)});
  if(!post.ok) throw new Error('feed '+post.status+' '+await post.text());
  const br=await p.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  async function shot(name, w, h, mobile, hold){
    const pg=await br.newPage();
    pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await pg.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:!!mobile,hasTouch:!!mobile});
    await pg.goto(U+'/v2',{waitUntil:'networkidle0',timeout:30000});
    await pg.evaluate(()=>document.fonts&&document.fonts.ready);
    await pg.waitForFunction(()=>{
      const el=document.querySelector('[data-seat="VET"] .tname');
      return !!(el&&/FAIR|Pepetide|OnlyCats|DERP404|X|HWAN/.test(el.textContent||''));
    },{timeout:10000});
    await pg.evaluate(hold=>{
      if(hold==='pass') window.AO2.holdSieve('VET','pass');
      else window.AO2.holdSieve('VET', 1);
    }, hold);
    await pg.waitForFunction(hold=>{
      const el=document.querySelector('[data-seat="VET"]');
      const name=el&&el.querySelector('.tname');
      const token=name?name.textContent:'';
      if(hold==='pass') return token==='X'&&el.classList.contains('pass');
      return token==='Pepetide'&&!el.classList.contains('pass');
    },{timeout:4000}, hold);
    await pg.waitForFunction(()=>{
      const img=document.querySelector('[data-seat="VET"] img');
      return !!(img&&img.complete&&img.naturalWidth>0);
    },{timeout:8000});
    await pg.evaluate(()=>{
      const el=document.querySelector('[data-seat="VET"]');
      if(el) el.scrollIntoView({block:'center', inline:'center'});
    });
    await wait(400);
    const dest=path.join(OUT,name);
    await pg.screenshot({path:dest});
    const plate=path.join(OUT,name.replace(/\.png$/, '-plate.png'));
    const station=await pg.$('[data-seat="VET"]');
    if(station) await station.screenshot({path:plate});
    await pg.close();
    console.log('zapisano '+dest);
  }
  try{
    await shot('vet-reject-1440x900.png',1440,900,false,'reject');
    await shot('vet-pass-1440x900.png',1440,900,false,'pass');
    await shot('vet-reject-390x844.png',390,844,true,'reject');
    await shot('vet-pass-390x844.png',390,844,true,'pass');
  }finally{
    await br.close();
    srv.kill();
    fs.rmSync(PUB,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e); try{srv.kill();}catch{} try{fs.rmSync(PUB,{recursive:true,force:true});}catch{} process.exit(1);});
