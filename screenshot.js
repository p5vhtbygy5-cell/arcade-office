// One frame of the public board (server must already be running).
const p=require('puppeteer-core');
const U=process.env.SHOT_URL||'http://localhost:3000';
(async()=>{
  const br=await p.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  const pg=await br.newPage();
  pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await pg.setViewport({width:1920,height:1080,deviceScaleFactor:1});
  await pg.goto(U,{waitUntil:'domcontentloaded',timeout:30000});
  await pg.evaluate(()=>document.fonts&&document.fonts.ready);
  await new Promise(r=>setTimeout(r,4000));
  await pg.screenshot({path:process.env.SHOT_OUT||'screenshot.png'});
  await br.close();
  console.log('zapisano screenshot.png');
})().catch(e=>{console.error(e); process.exit(1);});
