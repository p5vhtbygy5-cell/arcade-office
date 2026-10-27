// Scan board data: one rotating token per cycle, enriched from public market APIs.
// DexScreener supplies price, changes, volume, txns, FDV, age, image, pool address.
// GeckoTerminal supplies the 1h OHLCV chart and holder counts. GeckoTerminal is
// capped at 8 requests/minute (their public guidance is about 10).
module.exports=function createScan({io,extra,onEnrich}){
const ROTATE=10000;
const GT_MAX=8, GT_WIN=60000;
const NET={
  solana:['solana','solana'], eth:['ethereum','eth'], ethereum:['ethereum','eth'],
  bsc:['bsc','bsc'], bnb:['bsc','bsc'], base:['base','base'], arbitrum:['arbitrum','arbitrum'],
  polygon:['polygon','polygon_pos'], matic:['polygon','polygon_pos'], avalanche:['avalanche','avax'],
  avax:['avalanche','avax'], sui:['sui','sui'], ton:['ton','ton'], tron:['tron','tron']
};
const num=v=>{const n=typeof v==='number'?v:+v;return Number.isFinite(n)?n:null;};
const nets=chain=>{const k=String(chain||'solana').toLowerCase();return NET[k]||[k,k];};
function notCheap(it){const s=String(it&&it.stage||'').toLowerCase();return s!=='cheap_reject'&&s!=='chp-'&&s!=='chp';}

let items=[], extras=[], extraSig='', prev=null, rule='', cycleMs=0, cycleTs=null, rev=0, lastSig='';
const dex=new Map();   // address -> {at, fail, data}
const ohlcv=new Map(); // pair -> {at, fail, rows}
const info=new Map();  // address -> {at, fail, data}
const gtTimes=[];
let gtPause=0, busy=false, lastKey='', dexAt=0, dexErr=null;

function indexNow(now){
  if(!items.length) return 0;
  const start=Number.isFinite(cycleMs)?cycleMs:now;
  return Math.floor(Math.max(0, now-start)/ROTATE)%items.length;
}
function setFromTop(top){
  if(!top||!Array.isArray(top.items)) return;
  const next=top.items.filter(notCheap).slice(0,12);
  // Restart the 10s loop only when the batch (or a stage in it) changes, not on a price refresh.
  const stamp=top.cycleTs||top.updatedAt||'';
  const sig=next.map(t=>(t.address||'')+'|'+t.symbol+'|'+t.stage).join(';')+'#'+stamp;
  if(sig!==lastSig){
    lastSig=sig; rev++;
    cycleMs=typeof top.updatedAt==='number'&&Number.isFinite(top.updatedAt)?top.updatedAt:Date.now();
    cycleTs=top.cycleTs||null;
  }
  items=next; prev=top.prev||null; rule=top.rule||rule;
  maybeEmit(Date.now());
}
function view(it){
  const addr=it.address||null;
  const d=addr&&dex.get(addr);
  const data=d&&d.data;
  const pair=data&&data.pair;
  const c=pair&&ohlcv.get(pair);
  const inf=addr&&info.get(addr);
  const idata=inf&&inf.data;
  const tx=data&&data.tx||{};
  const side=(k,field)=>tx[k]&&num(tx[k][field]);
  return {
    symbol:it.symbol, name:it.name||null, chain:it.chain||null, address:addr, rank:it.rank||null,
    stage:it.stage||null, reason:it.reason||'',
    price:data&&num(data.price)!=null?num(data.price):num(it.price),
    marketCap:data&&num(data.marketCap)!=null?num(data.marketCap):num(it.marketCap),
    fdv:data&&num(data.fdv)!=null?num(data.fdv):num(it.fdv),
    liquidity:data&&num(data.liquidity)!=null?num(data.liquidity):num(it.liquidity),
    change5m:data&&num(data.m5)!=null?num(data.m5):num(it.change5m),
    change1h:data&&num(data.h1)!=null?num(data.h1):num(it.change1h),
    change6h:data&&num(data.h6)!=null?num(data.h6):num(it.change6h),
    change24h:data&&num(data.h24)!=null?num(data.h24):num(it.change24h),
    volume5m:data&&num(data.v5), volume1h:data&&num(data.v1), volume6h:data&&num(data.v6), volume24h:data&&num(data.v24),
    buys5m:side('m5','buys'), sells5m:side('m5','sells'),
    buys1h:side('h1','buys'), sells1h:side('h1','sells'),
    buys6h:side('h6','buys'), sells6h:side('h6','sells'),
    buys24h:side('h24','buys'), sells24h:side('h24','sells'),
    pairCreatedAt:data&&num(data.created), dexId:data&&data.dex||null, pairUrl:data&&data.url||null,
    image:(idata&&idata.nsfw)?null:(data&&data.image)||(idata&&idata.image)||null,
    baseName:data&&data.baseName||null,
    chart:c&&c.rows||null,
    holders:idata&&num(idata.holders)!=null?num(idata.holders):num(it.holders),
    holdersTop10:idata&&idata.top10!=null?idata.top10:null,
    gtScore:idata&&num(idata.gtScore),
    mintAuthority:idata?idata.mint:null,
    freezeAuthority:idata?idata.freeze:null,
    honeypot:idata?idata.honeypot:null,
    sources:{feed:true, dex:!!data, chart:!!(c&&c.rows), info:!!idata},
    pending:!!(addr&&!d)
  };
}
function snapshot(now){
  now=now||Date.now();
  const n=items.length, idx=indexNow(now);
  const start=Number.isFinite(cycleMs)?cycleMs:now;
  const into=n?((now-start)%ROTATE+ROTATE)%ROTATE:0;
  const base={
    serverNow:now, rotateMs:ROTATE, cycleMs:start, cycleTs, rule, rev,
    index:idx, total:n, showMs:n?ROTATE-into:0,
    tokens:items.map(view),
    prev:prev&&Array.isArray(prev.items)?{updatedAt:prev.updatedAt||null, items:prev.items.filter(notCheap).slice(0,12).map(it=>({symbol:it.symbol,chain:it.chain,stage:it.stage,reason:it.reason,price:num(it.price),marketCap:num(it.marketCap),liquidity:num(it.liquidity),change1h:num(it.change1h),address:it.address||null}))}:null,
    dexError:dexErr, geckoPause:gtPause>now
  };
  try{Object.assign(base, extra?extra():null);}catch{}
  return base;
}
function watch(list){
  const next=[], seen=new Set();
  for(const x of (Array.isArray(list)?list:[])){
    const address=x&&x.address; if(!address||seen.has(address)) continue;
    seen.add(address);
    next.push({address, chain:x.chain||'solana', symbol:x.symbol||address.slice(0,8), displaySymbol:x.displaySymbol||null});
  }
  const sig=next.map(x=>x.address).join(',');
  if(sig===extraSig) return;
  extraSig=sig; extras=next;
}
function tracked(){
  const seen=new Set(items.map(i=>i.address).filter(Boolean));
  return items.concat(extras.filter(x=>x.address&&!seen.has(x.address)));
}
function lookup(address){
  if(!address) return null;
  const it=tracked().find(x=>x.address===address);
  if(!it&&!dex.has(address)&&!info.has(address)) return null;
  const v=view(it||{address, chain:'solana', symbol:''});
  return (v.sources&&(v.sources.dex||v.sources.chart||v.sources.info))?v:null;
}
function maybeEmit(now){
  const idx=indexNow(now);
  const key=(cycleMs||0)+'|'+idx+'|'+rev+'|'+extraSig;
  if(key===lastKey) return;
  lastKey=key;
  try{io.emit('scan', snapshot(now));}catch(e){console.log('scan emit', e.message);}
  try{if(onEnrich) onEnrich();}catch(e){console.log('scan enrich', e.message);}
}

async function getJSON(url, headers){
  const r=await fetch(url,{headers:Object.assign({accept:'application/json','user-agent':'arcade-office/1.0'}, headers||{}), signal:AbortSignal.timeout(8000)});
  if(r.status===429){const e=new Error('429');e.status=429;throw e;}
  if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e;}
  return r.json();
}
function gtBudget(now){
  while(gtTimes.length&&now-gtTimes[0]>GT_WIN) gtTimes.shift();
  return gtTimes.length<GT_MAX && now>=gtPause;
}
function markGt(now){gtTimes.push(now);}

async function refreshDex(now){
  const todo=tracked().filter(it=>it.address&&(()=>{const d=dex.get(it.address);if(!d)return true;if(d.fail)return now-d.at>120000;return now-d.at>20000;})());
  if(!todo.length) return;
  const by=new Map();
  for(const it of todo){const [dx]=nets(it.chain);if(!by.has(dx))by.set(dx,[]);by.get(dx).push(it);}
  for(const [chain,list] of by){
    for(let i=0;i<list.length;i+=30){
      const chunk=list.slice(i,i+30);
      const url='https://api.dexscreener.com/tokens/v1/'+chain+'/'+chunk.map(it=>it.address).join(',');
      try{
        const j=await getJSON(url);
        const pairs=Array.isArray(j)?j:(j&&j.pairs)||[];
        const best=new Map();
        for(const p of pairs){
          const a=p&&p.baseToken&&p.baseToken.address; if(!a) continue;
          const liq=p.liquidity&&+p.liquidity.usd||0;
          const cur=best.get(a);
          if(!cur||liq>(cur.liquidity&&+cur.liquidity.usd||0)) best.set(a,p);
        }
        for(const it of chunk){
          const p=best.get(it.address);
          if(!p){dex.set(it.address,{at:now,fail:true,data:null});continue;}
          const pc=p.priceChange||{}, vol=p.volume||{};
          dex.set(it.address,{at:now,fail:false,data:{
            price:num(p.priceUsd), marketCap:num(p.marketCap)||num(p.fdv), fdv:num(p.fdv),
            liquidity:p.liquidity&&num(p.liquidity.usd),
            m5:num(pc.m5), h1:num(pc.h1), h6:num(pc.h6), h24:num(pc.h24),
            v5:num(vol.m5), v1:num(vol.h1), v6:num(vol.h6), v24:num(vol.h24),
            tx:p.txns||{}, pair:p.pairAddress||null, dex:p.dexId||null, url:p.url||null,
            image:p.info&&p.info.imageUrl||null, created:num(p.pairCreatedAt),
            baseName:p.baseToken&&p.baseToken.name||null
          }});
        }
        dexErr=null; rev++;
      }catch(e){
        dexErr=e.message;
        if(e.status===429){for(const it of chunk){if(!dex.get(it.address)) dex.set(it.address,{at:now,fail:true,data:null});}}
        console.log('scan dex', e.message);
      }
    }
  }
}
function pickGt(now, idx){
  const order=[];
  if(items.length){order.push(items[idx]); if(items.length>1) order.push(items[(idx+1)%items.length]);}
  for(const it of extras) if(!order.includes(it)) order.push(it);
  for(const it of items) if(!order.includes(it)) order.push(it);
  for(const it of order){
    if(!it||!it.address) continue;
    const d=dex.get(it.address);
    const pair=d&&d.data&&d.data.pair;
    if(pair){
      const c=ohlcv.get(pair);
      if(!c||(c.fail&&now-c.at>120000)||(!c.fail&&now-c.at>50000)) return {kind:'ohlcv', it, pair};
    }
    const inf=info.get(it.address);
    if(!inf||(inf.fail&&now-inf.at>120000)||(!inf.fail&&now-inf.at>600000)) return {kind:'info', it};
  }
  return null;
}
async function runGt(job, now){
  const [dx,gt]=nets(job.it.chain);
  markGt(now);
  if(job.kind==='ohlcv'){
    const url='https://api.geckoterminal.com/api/v2/networks/'+gt+'/pools/'+encodeURIComponent(job.pair)+'/ohlcv/minute?aggregate=1&limit=60&currency=usd';
    try{
      const j=await getJSON(url);
      const list=j&&j.data&&j.data.attributes&&j.data.attributes.ohlcv_list||[];
      const rows=list.slice().reverse().filter(r=>Array.isArray(r)&&r.length>=5).map(r=>({t:r[0]*1000,c:num(r[4]),v:num(r[5])})).filter(r=>r.t&&r.c!=null);
      const had=ohlcv.get(job.pair)&&ohlcv.get(job.pair).rows;
      ohlcv.set(job.pair,{at:now,fail:!rows.length,rows:rows.length?rows:null});
      if(rows.length){rev++; if(!had) console.log('scan chart', job.it.symbol, rows.length);}
    }catch(e){
      if(e.status===429) gtPause=now+60000;
      ohlcv.set(job.pair,{at:now,fail:true,rows:ohlcv.get(job.pair)&&ohlcv.get(job.pair).rows||null});
      console.log('scan ohlcv', e.message);
    }
    return;
  }
  const url='https://api.geckoterminal.com/api/v2/networks/'+gt+'/tokens/'+encodeURIComponent(job.it.address)+'/info';
  try{
    const j=await getJSON(url);
    const a=j&&j.data&&j.data.attributes||{};
    const dist=a.holders&&a.holders.distribution_percentage;
    info.set(job.it.address,{at:now,fail:false,data:{
      holders:a.holders&&num(a.holders.count),
      top10:dist&&dist.top_10!=null?String(dist.top_10):null,
      gtScore:num(a.gt_score),
      mint:a.mint_authority!=null?String(a.mint_authority):null,
      freeze:a.freeze_authority!=null?String(a.freeze_authority):null,
      honeypot:a.is_honeypot!=null?String(a.is_honeypot):null,
      nsfw:!!a.is_nsfw,
      image:a.image_url||null
    }});
    rev++;
  }catch(e){
    if(e.status===429) gtPause=now+60000;
    info.set(job.it.address,{at:now,fail:true,data:info.get(job.it.address)&&info.get(job.it.address).data||null});
    console.log('scan info', e.message);
  }
  void dx;
}
async function tick(){
  const now=Date.now();
  maybeEmit(now);
  if(busy||(!items.length&&!extras.length)) return;
  busy=true;
  try{
    if(now-dexAt>20000){dexAt=now;await refreshDex(now);}
    else if(gtBudget(now)){const job=pickGt(now, indexNow(now)); if(job) await runGt(job, now);}
  }catch(e){console.log('scan tick', e.message);}
  busy=false;
  maybeEmit(Date.now());
}
function start(){setInterval(()=>{tick().catch(e=>console.log('scan', e.message));}, 1000);}
return {setFromTop, snapshot, start, notCheap, watch, lookup, tick};
};
