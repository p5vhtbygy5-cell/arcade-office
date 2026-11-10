#!/usr/bin/env node
// SIZE PASS plate with the entry amount on the tag.
// Viewports: desktop 1440x900 and mobile 390x844.
const p=require('puppeteer-core');
const {spawn}=require('child_process');
const os=require('os');
const path=require('path');
const fs=require('fs');
const ROOT=path.join(__dirname,'..');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const OUT=process.env.SHOT_DIR||'/opt/cursor/artifacts';
const PORT=process.env.SIZE_SHOT_PORT||'4018';
const TOKEN='sizeshot';
const PUB=path.join(ROOT,'public/v2/_sizeshot');
fs.mkdirSync(OUT,{recursive:true});
fs.mkdirSync(PUB,{recursive:true});
fs.copyFileSync(path.join(ROOT,'test/fixtures/size/maya.webp'), path.join(PUB,'maya.webp'));
const srv=spawn(process.execPath,[path.join(ROOT,'server.js')],{
  env:{...process.env,PORT:String(PORT),TOP10_MOCK:'1',LIVE_PRICES:'0',TICKER_OFF:'1',BOT_API_TOKEN:TOKEN,
    POSITIONS_FILE:os.tmpdir()+'/pos-sizeshot-'+process.pid+'.json',DESK_BOARD_FILE:'/nonexistent/board.json'},
  stdio:'inherit'
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const U='http://127.0.0.1:'+PORT;
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
  const body={
    updatedAt:new Date(now).toISOString(),
    positions:[],
    activity:[],
    size_sieve:{
      batch_id:'size-pass-shot',
      cycleTs:new Date(now-2000).toISOString(),
      interval_s:120,
      batch_s:2,
      total:1,
      handoff_n:1,
      items:[{
        symbol:'MAYA',
        chain:'solana',
        stage:'handoff',
        reason:'$40.00 (11.8% free cash)',
        handoff:true,
        ticket_usd:40,
        image:U+'/v2/_sizeshot/maya.webp'
      }]
    }
  };
  const post=await fetch(U+'/api/feed',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+TOKEN},body:JSON.stringify(body)});
  if(!post.ok) throw new Error('feed '+post.status+' '+await post.text());
  const wire=await fetch(U+'/api/sieve?seat=size').then(r=>r.json());
  const item=wire&&wire.items&&wire.items[0];
  if(!item||item.ticket_usd!==40) throw new Error('ticket_usd nie przeszedł cleanSieve: '+JSON.stringify(item));
  const br=await p.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  async function shot(name, w, h, mobile){
    const pg=await br.newPage();
    pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await pg.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:!!mobile,hasTouch:!!mobile});
    await pg.goto(U+'/v2',{waitUntil:'networkidle0',timeout:30000});
    await pg.evaluate(()=>document.fonts&&document.fonts.ready);
    await pg.waitForFunction(()=>{
      const el=document.querySelector('[data-seat="SIZE"] .tname');
      return !!(el&&el.textContent==='MAYA');
    },{timeout:10000});
    await pg.evaluate(()=>window.AO2.holdSieve('SIZE','pass'));
    await pg.waitForFunction(()=>{
      const el=document.querySelector('[data-seat="SIZE"]');
      const tag=el&&el.querySelector('.tag .txt');
      return !!(el&&el.classList.contains('pass')&&tag&&tag.textContent==='PASS → FILLS · $40.00');
    },{timeout:4000});
    await pg.waitForFunction(()=>{
      const img=document.querySelector('[data-seat="SIZE"] img');
      return !!(img&&img.complete&&img.naturalWidth>0);
    },{timeout:8000});
    const fit=await pg.evaluate(()=>{
      const el=document.querySelector('[data-seat="SIZE"] .tag .txt');
      const tag=el.parentElement.getBoundingClientRect();
      const station=document.querySelector('[data-seat="SIZE"]').getBoundingClientRect();
      return {
        text:el.textContent,
        scroll:el.scrollWidth,
        client:el.clientWidth,
        tagW:Math.round(tag.width),
        tagH:Math.round(tag.height),
        stationW:Math.round(station.width),
        stationH:Math.round(station.height)
      };
    });
    console.log(name, JSON.stringify(fit));
    if(fit.text!=='PASS → FILLS · $40.00') throw new Error(name+' zły tag: '+fit.text);
    if(fit.scroll>fit.client+1) throw new Error(name+' tag obcięty '+fit.scroll+'>'+fit.client);
    await pg.evaluate(()=>{
      const el=document.querySelector('[data-seat="SIZE"]');
      if(el) el.scrollIntoView({block:'center', inline:'center'});
    });
    await wait(450);
    const dest=path.join(OUT,name);
    await pg.screenshot({path:dest});
    const plate=path.join(OUT,name.replace(/\.png$/, '-plate.png'));
    const station=await pg.$('[data-seat="SIZE"]');
    if(station) await station.screenshot({path:plate});
    await pg.close();
    console.log('zapisano '+dest);
  }
  try{
    await shot('size-pass-1440x900.png',1440,900,false);
    await shot('size-pass-390x844.png',390,844,true);
  }finally{
    await br.close();
    srv.kill();
    fs.rmSync(PUB,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e); try{srv.kill();}catch{} try{fs.rmSync(PUB,{recursive:true,force:true});}catch{} process.exit(1);});
