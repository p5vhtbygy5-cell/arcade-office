#!/usr/bin/env node
// Screenshots of /v2 at 1920x1080 and 390x844. Starts an isolated server and posts fixture feed.
const p=require('puppeteer-core');
const {spawn}=require('child_process');
const os=require('os');
const path=require('path');
const fs=require('fs');
const ROOT=path.join(__dirname,'..');
const CHROME=process.env.CHROME||'/usr/bin/google-chrome';
const OUT=process.env.SHOT_DIR||'/opt/cursor/artifacts';
const PORT=process.env.V2_SHOT_PORT||'4011';
const TOKEN='v2shot';
fs.mkdirSync(OUT,{recursive:true});
const srv=spawn(process.execPath,[path.join(ROOT,'server.js')],{
  env:{...process.env,PORT:String(PORT),TOP10_MOCK:'1',LIVE_PRICES:'0',BOT_API_TOKEN:TOKEN,
    POSITIONS_FILE:os.tmpdir()+'/pos-v2shot-'+process.pid+'.json',DESK_BOARD_FILE:'/nonexistent/board.json'},
  stdio:'ignore'
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
  const row=(id,extra)=>({bot:'RISK',side:'LONG',mode:'SHADOW',size:40,entry:1,price:1,...extra,id});
  const body={
    updatedAt:new Date(now).toISOString(),
    positions:[
      row('capy',{symbol:'CAPY',price:1.554,h1:4,h6:12,h24:55,mcap:85000,pass:{n:3,wins:2,losses:1},steps:{done:2,total:6,runner:false},openedAt:new Date(now-1*60000).toISOString()}),
      row('rico',{symbol:'RICO',price:0.877,h1:-9,h6:-2,h24:8,mcap:210000,pass:{n:2,wins:1,losses:1},steps:{done:3,total:6,runner:false},openedAt:new Date(now-2*60000).toISOString()}),
      row('mov',{symbol:'MOVEMBER',price:1.081,h1:120,h6:45,h24:-5,mcap:42000,pass:{n:4,wins:3,losses:1},steps:{done:0,total:6,runner:false},openedAt:new Date(now-3*60000).toISOString()}),
      row('5s',{symbol:'5STAR',price:0.958,h1:-1,h6:15,h24:30,mcap:150000,pass:{n:1,wins:0,losses:1},steps:{done:1,total:6,runner:false},openedAt:new Date(now-4*60000).toISOString()}),
      row('cj',{symbol:'CJ',price:1.225,h1:5,h6:-8,h24:22,mcap:12000,pass:{n:3,wins:2,losses:1},peakPct:8,openedAt:new Date(now-5*60000).toISOString()}),
      row('tk',{symbol:'TURKEY',price:0.649,h1:-15,h6:-20,h24:-50,mcap:5000,pass:{n:0,wins:0,losses:0},steps:{done:6,total:6,runner:true,peak:12},openedAt:new Date(now-6*60000).toISOString()}),
      row('sp',{symbol:'SPHERE',price:1.015,h1:0.5,h6:2,h24:1,mcap:300000,pass:{n:2,wins:1,losses:1},steps:{done:0,total:6,runner:false},openedAt:new Date(now-7*60000).toISOString()})
    ],
    activity:[
      {ts:new Date(now-120000).toISOString(),bot:'VET',text:'Order placed',kind:'note'},
      {ts:new Date(now-110000).toISOString(),bot:'SCAN',text:'New signal',kind:'note'},
      {ts:new Date(now-100000).toISOString(),bot:'BOOK',text:'Executed',kind:'note'},
      {ts:new Date(now-90000).toISOString(),bot:'RISK',text:'High vol',kind:'note'},
      {ts:new Date(now-80000).toISOString(),bot:'FILLS',text:'Filtro 100%',kind:'note'},
      {ts:new Date(now-70000).toISOString(),bot:'VET',text:'Stop loss',kind:'note'},
      {ts:new Date(now-60000).toISOString(),bot:'SCAN',text:'Trend up',kind:'note'},
      {ts:new Date(now-50000).toISOString(),bot:'BOOK',text:'Partial',kind:'note'},
      {ts:new Date(now-40000).toISOString(),bot:'RISK',text:'Alert',kind:'note'},
      {ts:new Date(now-30000).toISOString(),bot:'FILLS',text:'Pending',kind:'note'},
      {ts:new Date(now-20000).toISOString(),bot:'SIZE',text:'Bilet $40',kind:'ticket'},
      {ts:new Date(now-10000).toISOString(),bot:'CHIEF',text:'wybor: CAPY',kind:'pick'}
    ],
    news:{items:[
      {title:'Desk publiczny — dane fixture (nie live)',source:'arcade-office',category:'tech',publishedAt:now},
      {title:'Warsaw feed sync OK',source:'local',category:'tech',publishedAt:now-60000}
    ],updatedAt:new Date(now).toISOString(),source:'fixture'},
    botEvents:{
      SCAN:[{ts:new Date(now).toISOString(),text:'Przeskanowalem 128 tokenow, 23 przez sito'}],
      VET:[{ts:new Date(now).toISOString(),text:'Weryfikacja: 9/23 przeszlo'},{ts:new Date(now-1e4).toISOString(),text:'Odrzucilem WOOP - crowd'}],
      BOOK:[{ts:new Date(now).toISOString(),text:'Przekazalem 4 do SIZE'},{ts:new Date(now-1e3).toISOString(),text:'Wybieram RICO'}],
      SIZE:[{ts:new Date(now).toISOString(),text:'Przekazalem 3 do FILLS'},{ts:new Date(now-1e3).toISOString(),text:'MOGMAS bilet'}],
      FILLS:[{ts:new Date(now).toISOString(),text:'Przekazalem 3 do RISK'},{ts:new Date(now-1e3).toISOString(),text:'Wypelnione: SPHERE'}],
      RISK:[{ts:new Date(now).toISOString(),text:'Pilnuje STEALTH: Stage II'}]
    },
    posEvents:[
      {ts:new Date(now-11*60000).toISOString(),action:'OPEN',token:'PEACE',displaySymbol:'PEACE',chain:'solana',usd:40,price:0.00387},
      {ts:new Date(now-10*60000).toISOString(),action:'CLOSE',token:'MATED',displaySymbol:'MATED',chain:'solana',usd:40,price:0.003375,pct:-12.4,net:-5.1},
      {ts:new Date(now-9*60000).toISOString(),action:'OPEN',token:'CAPY',displaySymbol:'CAPY',chain:'solana',usd:40,price:0.015},
      {ts:new Date(now-8*60000).toISOString(),action:'CLOSE',token:'RICO',displaySymbol:'RICO',chain:'solana',usd:40,price:1.10,pct:-9.2,net:-3.6},
      {ts:new Date(now-7*60000).toISOString(),action:'CLOSE',token:'PILLS',displaySymbol:'PILLS',chain:'solana',usd:40,price:0.06,pct:18.2,net:7.3},
      {ts:new Date(now-6*60000).toISOString(),action:'OPEN',token:'WOOD',displaySymbol:'WOOD',chain:'solana',usd:40,price:0.06},
      {ts:new Date(now-5*60000).toISOString(),action:'CLOSE',token:'MOGMAS',displaySymbol:'MOGMAS',chain:'solana',usd:40,price:2.1,pct:4.1,net:1.6},
      {ts:new Date(now-4*60000).toISOString(),action:'OPEN',token:'SPHERE',displaySymbol:'SPHERE',chain:'solana',usd:40,price:0.8},
      {ts:new Date(now-3*60000).toISOString(),action:'CLOSE',token:'STEALTH',displaySymbol:'STEALTH',chain:'solana',usd:40,price:5.0,pct:22,net:8.8},
      {ts:new Date(now-2*60000).toISOString(),action:'OPEN',token:'CJ',displaySymbol:'CJ',chain:'solana',usd:40,price:0.002},
      {ts:new Date(now-1*60000).toISOString(),action:'CLOSE',token:'TURKEY',displaySymbol:'TURKEY',chain:'solana',usd:40,price:0.004,pct:-8,net:-3.2}
    ],
    portfolio:{start:1000,bank:45600,realizedPnl:44600,roiPct:4460,trades:14,wins:9,losses:5,winRate:64,maxDrawdownPct:8.2,mode:'SHADOW',
      series:[{ts:new Date(now-86400000*4).toISOString(),bank:1200},{ts:new Date(now-86400000*3).toISOString(),bank:980},{ts:new Date(now-86400000*2).toISOString(),bank:2100},{ts:new Date(now-86400000).toISOString(),bank:18000},{ts:new Date(now).toISOString(),bank:45600}]},
    top10:[
      {ticker:'CAPY',chain:'solana',priceUSD:1,marketCap:85e3,stage:'soft_pass',reason:'mcap'},
      {ticker:'WOOP',chain:'solana',priceUSD:1,marketCap:10,stage:'soft_reject',reason:'crowd'},
      {ticker:'RICO',chain:'solana',priceUSD:1,marketCap:10,stage:'picked',reason:'chase_5m'},
      {ticker:'MOGMAS',chain:'solana',priceUSD:1,marketCap:10,stage:'order',reason:'mcap'},
      {ticker:'SPHERE',chain:'solana',priceUSD:1,marketCap:10,stage:'filled',reason:'crowd'},
      {ticker:'STEALTH',chain:'solana',priceUSD:1,marketCap:10,stage:'held_skip',reason:'chase_5m'}
    ],
    top10_rule:'fixture', top10_cycle_ts:new Date(now).toISOString()
  };
  const post=await fetch(U+'/api/feed',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+TOKEN},body:JSON.stringify(body)});
  if(!post.ok) throw new Error('feed '+post.status+' '+await post.text());
  const br=await p.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
  async function shot(name, w, h, mobile){
    const pg=await br.newPage();
    pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await pg.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:!!mobile,hasTouch:!!mobile});
    await pg.goto(U+'/v2?badge=fixture',{waitUntil:'networkidle0',timeout:30000});
    await pg.evaluate(()=>document.fonts&&document.fonts.ready);
    await wait(1800);
    const dest=path.join(OUT,name);
    await pg.screenshot({path:dest,fullPage:!!mobile});
    await pg.close();
    console.log('zapisano '+dest);
  }
  try{
    await shot('v2-1920x1080.png',1920,1080,false);
    await shot('v2-390x844.png',390,844,true);
    // also a copy next to the old screenshot.js output for the repo report
    const local=path.join(ROOT,'screenshots');
    fs.mkdirSync(local,{recursive:true});
    fs.copyFileSync(path.join(OUT,'v2-1920x1080.png'), path.join(local,'v2-1920x1080.png'));
    fs.copyFileSync(path.join(OUT,'v2-390x844.png'), path.join(local,'v2-390x844.png'));
  }finally{
    await br.close();
    srv.kill();
  }
})().catch(e=>{console.error(e); try{srv.kill();}catch{} process.exit(1);});
