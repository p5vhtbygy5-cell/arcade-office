const express=require('express'),http=require('http'),{Server}=require('socket.io'),path=require('path');
const MAP=require('./public/map.js');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.json({limit:'20kb'}));
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(q,r)=>r.json({ok:true,players:Object.values(players).filter(p=>!p.bot).length,bots:Object.values(players).filter(p=>p.bot).length}));
const players={};const COLORS=['#ff2bd6','#00f0ff','#39ff14','#ffe600','#ff6b00','#b026ff','#ffffff','#ff3b3b'];
const clean=(s,n)=>String(s||'').replace(/[<>]/g,'').trim().slice(0,n);
// ---- NPC bots (server-side, static at desks) ----
const BOT_CFG={CHIEF:{color:'#ff3b3b',lines:['Koordynuję zespół...','Odprawa o 9:00!','Kto ma update?','Decyzja zapadła.','Trzymamy plan.']},
 SIZE:{color:'#ffe600',lines:['Liczę wielkość pozycji...','Max 2% kapitału!','Kelly mówi: mniej.','Skaluję wejście...']},
 SCAN:{color:'#00f0ff',lines:['Skanuję rynek...','Nowy sygnał na SOL!','Wolumen rośnie 📈','Szukam setupów...']},
 BOOK:{color:'#39ff14',lines:['Księguję transakcje...','Saldo się zgadza.','Aktualizuję dziennik.','PnL zapisany ✔']},
 RISK:{color:'#ff6b00',lines:['Sprawdzam ryzyko...','Stop-loss ustawiony.','Ekspozycja OK.','Uwaga na dźwignię!']},
 VET:{color:'#b026ff',lines:['Weryfikuję projekt...','Audyt kontraktu...','To wygląda na scam 🚩','Zespół zweryfikowany.']},
 FILLS:{color:'#ff2bd6',lines:['Realizuję zlecenia...','Fill po 68 012 $','Slippage minimalny.','Zlecenie wypełnione ✔']}};
for(const b of MAP.BOT_DESKS){const c=BOT_CFG[b.name];players['bot-'+b.name]={id:'bot-'+b.name,name:b.name,color:c.color,sprite:0,bot:true,x:b.x,y:b.y,dir:'down',zone:MAP.zoneAt(b.x,b.y)};}
// ---- Tablica Pozycji: API dla botów ----
const fs=require('fs'),crypto=require('crypto');
const POS_FILE=process.env.POSITIONS_FILE||path.join(__dirname,'positions.json'),TOKEN_FILE=path.join(__dirname,'.bot-token');
let BOT_TOKEN=process.env.BOT_API_TOKEN;
if(!BOT_TOKEN){try{BOT_TOKEN=fs.readFileSync(TOKEN_FILE,'utf8').trim();}catch{}
  if(!BOT_TOKEN){BOT_TOKEN=crypto.randomBytes(24).toString('hex');fs.writeFileSync(TOKEN_FILE,BOT_TOKEN+'\n',{mode:0o600});}
  console.log('BOT_API_TOKEN nie ustawiony - token zapisany w pliku '+TOKEN_FILE);}
let positions={};try{positions=JSON.parse(fs.readFileSync(POS_FILE,'utf8'))||{};}catch{}
const save=()=>{try{fs.writeFileSync(POS_FILE+'.tmp',JSON.stringify(positions,null,1));fs.renameSync(POS_FILE+'.tmp',POS_FILE);}catch(e){console.error('Zapis positions.json nieudany:',e.message);}};
const BOT_NAMES=Object.keys(BOT_CFG);
const bots=require('./bots.js')({io,players,MAP,BOT_CFG});
app.get('/api/bots',(q,r)=>r.json(bots.list()));
function auth(q,r,n){const h=q.get('authorization')||'';const t=h.startsWith('Bearer ')?h.slice(7):'';
  const a=Buffer.from(t),b=Buffer.from(BOT_TOKEN);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return r.status(401).json({error:'Brak autoryzacji'});n();}
const num=v=>typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?Number(v):NaN);
const pos=v=>{const x=num(v);return isFinite(x)&&x>0&&x<1e12?x:null;};
function botSay(bot,text){io.emit('bubble',{id:'bot-'+bot,text});io.emit('chat',{system:true,text:`🤖 ${bot}: ${text}`,scope:'global',ts:Date.now()});}
app.get('/api/positions',(q,r)=>r.json(allPositions()));
app.post('/api/positions',auth,(q,r)=>{const b=q.body||{};const e=[];
  const bot=String(b.bot||'').toUpperCase();if(!BOT_NAMES.includes(bot))e.push('bot: jeden z '+BOT_NAMES.join(','));
  const symbol=String(b.symbol||'').toUpperCase();if(!/^[A-Z0-9]{2,20}$/.test(symbol))e.push('symbol: 2-20 znaków A-Z0-9');
  const side=String(b.side||'').toUpperCase();if(!['LONG','SHORT'].includes(side))e.push('side: LONG lub SHORT');
  const size=pos(b.size),entry=pos(b.entry);if(size==null)e.push('size: liczba > 0');if(entry==null)e.push('entry: liczba > 0');
  const price=b.price==null?null:pos(b.price);if(b.price!=null&&price==null)e.push('price: liczba > 0');
  if(b.id!=null&&!/^[A-Za-z0-9_-]{1,40}$/.test(String(b.id)))e.push('id: 1-40 znaków A-Za-z0-9_-');
  if(e.length)return r.status(400).json({error:'Błędne dane',details:e});
  const id=b.id!=null?String(b.id):crypto.randomBytes(6).toString('hex');const old=positions[id];
  const p={id,bot,symbol,side,size,entry,price:price??old?.price??null,priceSource:price!=null?'bot':(old?.priceSource||null),note:b.note?String(b.note).replace(/[<>]/g,'').slice(0,140):(old?.note||''),openedAt:old?.openedAt||Date.now(),updatedAt:Date.now()};
  positions[id]=p;save();io.emit('position',p);
  if(!old){botSay(bot,`Otwieram ${side} ${symbol} @ ${entry}`);bots.onPosition('open',p);}r.status(old?200:201).json(p);});
app.patch('/api/positions/:id',auth,(q,r)=>{const p=positions[q.params.id];if(!p)return r.status(404).json({error:'Nie znaleziono pozycji'});const b=q.body||{};const e=[];
  if(b.price!=null&&pos(b.price)==null)e.push('price: liczba > 0');if(b.size!=null&&pos(b.size)==null)e.push('size: liczba > 0');
  if(b.price==null&&b.size==null&&b.note==null)e.push('podaj price, size lub note');if(e.length)return r.status(400).json({error:'Błędne dane',details:e});
  if(b.price!=null){p.price=pos(b.price);p.priceSource='bot';}if(b.size!=null)p.size=pos(b.size);if(b.note!=null)p.note=String(b.note).replace(/[<>]/g,'').slice(0,140);
  p.updatedAt=Date.now();save();io.emit('position',p);r.json(p);});
function close(q,r){const p=positions[q.params.id];if(!p)return r.status(404).json({error:'Nie znaleziono pozycji'});delete positions[p.id];save();io.emit('positionClosed',p.id);
  const c=p.price??p.entry,pl=(c-p.entry)/p.entry*100*(p.side==='LONG'?1:-1);botSay(p.bot,`Zamykam ${p.side} ${p.symbol} (${pl>=0?'+':''}${pl.toFixed(2)}%)`);bots.onPosition('close',p);r.json({closed:true,position:p,pnlPct:+pl.toFixed(4)});}
app.delete('/api/positions/:id',auth,close);app.post('/api/positions/:id/close',auth,close);
// live prices from Binance public ticker (every 30s); falls back to bot price
async function refreshPrices(){const ps=Object.values(positions);if(!ps.length||process.env.LIVE_PRICES==='0')return;
  try{const res=await fetch('https://api.binance.com/api/v3/ticker/price',{signal:AbortSignal.timeout(8000)});if(!res.ok)return;const m={};for(const t of await res.json())m[t.symbol]=+t.price;
    for(const p of ps){const v=m[p.symbol]??m[p.symbol+'USDT'];if(v&&p.priceSource!=='bot-locked'){if(p.price!==v){p.price=v;p.priceSource='live';io.emit('position',p);}}}save();}catch{}}
setInterval(refreshPrices,30000);setTimeout(refreshPrices,3000);
// ---- Top 10 Krypto (CoinGecko -> CoinPaprika -> CoinLore fallback, cached) ----
const TOP10_MS=Math.max(120000,+process.env.TOP10_INTERVAL_MS||180000);
let top10={updatedAt:null,source:null,items:[],error:'brak danych'};let top10Backoff=0;
const MOCK10=[['BTC','Bitcoin',68000,1.2,1.34e12],['ETH','Ethereum',3400,-0.8,4.1e11],['USDT','Tether',1,0.01,1.2e11],['BNB','BNB',580,0.5,8.5e10],['SOL','Solana',150,3.1,7e10],['USDC','USD Coin',1,0,3.4e10],['XRP','XRP',0.52,-1.4,2.9e10],['DOGE','Dogecoin',0.15,2.2,2.2e10],['TRX','TRON',0.12,0.3,1.05e10],['ADA','Cardano',0.45,-2.1,1.6e10]]
 .map(([symbol,name,price,change24h,marketCap],i)=>({rank:i+1,symbol,name,price,change24h,marketCap}));
const getJSON=async u=>{const r=await fetch(u,{headers:{accept:'application/json','user-agent':'krypto-biuro/1.0'},signal:AbortSignal.timeout(10000)});if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;throw e;}return r.json();};
const SOURCES=[
 ['CoinGecko',async()=>(await getJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h'))
   .map(c=>({rank:c.market_cap_rank,symbol:String(c.symbol).toUpperCase(),name:c.name,price:c.current_price,change24h:c.price_change_percentage_24h,marketCap:c.market_cap}))],
 ['CoinLore',async()=>(await getJSON('https://api.coinlore.net/api/tickers/?start=0&limit=10')).data
   .map(c=>({rank:+c.rank,symbol:c.symbol,name:c.name,price:+c.price_usd,change24h:+c.percent_change_24h,marketCap:+c.market_cap_usd})),
 ['CoinPaprika',async()=>(await getJSON('https://api.coinpaprika.com/v1/tickers?quotes=USD')).filter(c=>c.rank>0).sort((a,b)=>a.rank-b.rank).slice(0,10)
   .map(c=>({rank:c.rank,symbol:c.symbol,name:c.name,price:c.quotes.USD.price,change24h:c.quotes.USD.percent_change_24h,marketCap:c.quotes.USD.market_cap}))]]];
async function refreshTop10(){if(process.env.TOP10_MOCK==='1'){top10={updatedAt:Date.now(),source:'mock',items:MOCK10};io.emit('top10',top10);return top10;}
  if(Date.now()<top10Backoff)return top10;const errs=[];
  for(const [name,fn] of SOURCES){try{const items=(await fn()).filter(i=>i.symbol&&isFinite(i.price)&&i.price>0).slice(0,10);if(items.length<5)throw new Error('za mało danych');
    top10={updatedAt:Date.now(),source:name,items};if(!deskTop10())io.emit('top10',top10);return top10;}catch(e){errs.push(name+': '+e.message);if(e.status===429&&name==='CoinGecko')console.log('CoinGecko 429 - używam zapasowego źródła');}}
  top10={...top10,error:'Nie udało się pobrać danych ('+errs.join('; ')+')'};top10Backoff=Date.now()+60000;console.log('Top10:',top10.error);io.emit('top10',top10);return top10;}
setInterval(refreshTop10,TOP10_MS);setTimeout(refreshTop10,process.env.TOP10_MOCK==='1'?0:1500);
// ---- Desk feed: /workspace/desk/board.json written by desk main.py (state.json + ledger) ----
const DESK_BOARD=process.env.DESK_BOARD_FILE||'/workspace/desk/board.json';let desk=null,deskMtime=0;
function deskPosition(){const p=desk&&desk.position;if(!p)return null;const hb=p.latest_heartbeat||{};const ref=p.entry_priceUSD??p.reference_priceUSD??null;
  return {id:'desk-'+String(p.order_id).replace(/[^A-Za-z0-9_-]/g,''),desk:true,bot:'RISK',symbol:String(p.token),side:'LONG',size:p.ticket_usd,sizeUsd:p.ticket_usd,
    entry:p.entry_priceUSD,ref:p.reference_priceUSD,refSource:p.reference_source,price:hb.priceUSD??null,priceTs:hb.ts||null,priceSource:'desk-heartbeat',
    pnlBase:ref,movePct:p.move_vs_ref_pct,chain:p.chain,orderId:p.order_id,risk:p.risk_status,
    note:`${p.chain} · order ${p.order_id} · entry ${p.entry_priceUSD??'brak'} · ref ${p.reference_priceUSD??'-'} · ${p.risk_status}`,openedAt:Date.parse(p.ts)||Date.now(),updatedAt:Date.parse(desk.updatedAt)||Date.now()};}
const allPositions=()=>{const d=deskPosition();return d?[d,...Object.values(positions)]:Object.values(positions);};
function deskTop10(){if(!desk||!Array.isArray(desk.top10)||!desk.top10.length)return null;
  return {updatedAt:Date.parse(desk.top10_cycle_ts||desk.updatedAt)||Date.now(),source:'desk',rule:desk.top10_rule,
    items:desk.top10.map((c,i)=>({rank:i+1,symbol:String(c.ticker),name:c.chain,chain:c.chain,price:c.priceUSD,marketCap:c.marketCap,liquidity:c.liquidity,change1h:c.change_1h,change24h:c.change_1h,stage:c.stage,reason:c.reason}))};}
function readDesk(){try{const m=fs.statSync(DESK_BOARD).mtimeMs;if(m===deskMtime)return;deskMtime=m;desk=JSON.parse(fs.readFileSync(DESK_BOARD,'utf8'));
  io.emit('positions',allPositions());const t=deskTop10();if(t)io.emit('top10',t);}catch{}}
readDesk();setInterval(readDesk,15000);
app.get('/api/top10',(q,r)=>r.json(deskTop10()||top10));
app.get('/api/desk',(q,r)=>r.json(desk||{error:'brak board.json'}));
io.on('connection',s=>{
  s.emit('top10',deskTop10()||top10);
  s.emit('positions',allPositions());
  s.on('join',d=>{
    const p={id:s.id,name:clean(d&&d.name,16)||'Anon',color:COLORS.includes(d&&d.color)?d.color:COLORS[0],sprite:Math.max(0,Math.min(3,(d&&d.sprite)|0)),x:MAP.SPAWN.x,y:MAP.SPAWN.y,dir:'down'};
    p.zone=MAP.zoneAt(p.x,p.y);players[s.id]=p;
    s.emit('init',{you:s.id,players});s.broadcast.emit('playerJoined',p);
    io.emit('chat',{system:true,text:`${p.name} wchodzi do biura`,scope:'global',ts:Date.now()});
  });
  s.on('move',d=>{const p=players[s.id];if(!p||!d)return;const x=+d.x,y=+d.y;if(!isFinite(x)||!isFinite(y))return;
    if(Math.hypot(x-p.x,y-p.y)>64||MAP.blocked(x,y))return s.emit('correct',{x:p.x,y:p.y});
    p.x=x;p.y=y;p.dir=['up','down','left','right'].includes(d.dir)?d.dir:p.dir;p.zone=MAP.zoneAt(x,y);
    s.broadcast.emit('playerMoved',{id:p.id,x,y,dir:p.dir,zone:p.zone});});
  s.on('chat',d=>{const p=players[s.id];if(!p)return;const text=clean(d&&d.text,200);if(!text)return;
    const scope=d.scope==='zone'?'zone':'global';const m={id:p.id,name:p.name,color:p.color,text,scope,zone:p.zone,ts:Date.now()};
    if(scope==='global')io.emit('chat',m);else for(const q of Object.values(players))if(q.zone===p.zone)io.to(q.id).emit('chat',m);});
  s.on('disconnect',()=>{const p=players[s.id];if(!p)return;delete players[s.id];io.emit('playerLeft',s.id);
    io.emit('chat',{system:true,text:`${p.name} wychodzi`,scope:'global',ts:Date.now()});});
});
const PORT=process.env.PORT||3000;srv.listen(PORT,()=>console.log('Arcade Office na porcie '+PORT));
