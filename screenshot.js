// Headless screenshot with simulated players walking (BFS on the tile grid)
const p=require('puppeteer-core');const {io}=require('socket.io-client');const M=require('./public/map.js');const wait=ms=>new Promise(r=>setTimeout(r,ms));
const U='http://localhost:3000';
function path(from,to){const k=(x,y)=>y*M.W+x,prev=new Map([[k(...from),null]]),q=[from];while(q.length){const [x,y]=q.shift();if(x==to[0]&&y==to[1])break;
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(M.solid[ny]?.[nx]===0&&!prev.has(k(nx,ny))&&!M.blocked(nx*16+8,ny*16+8)){prev.set(k(nx,ny),[x,y]);q.push([nx,ny]);}}}
 const out=[];let c=to;while(c){out.unshift(c);c=prev.get(k(...c));}return out;}
(async()=>{const bots=[['Satoshi','#ffe600',0,[15,23],'HODL!'],['Vitalik','#00f0ff',2,[12,6],'Co na tablicy?'],['DogeLord','#ff6b00',3,[31,17],''],['MoonBoi','#b026ff',1,[24,13],'wen lambo?']];
 const br=await p.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const pg=await br.newPage();pg.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await pg.setViewport({width:1640,height:1040});await pg.goto(U);await pg.evaluate(()=>document.fonts.ready);await pg.type('#nick','Złotr');await pg.click('#go');await wait(500);
 const ss=[];for(const [n,c,s,to,t] of bots){const k=io(U);k.emit('join',{name:n,color:c,sprite:s});ss.push([k,to,t]);}await wait(300);
 const sx=Math.floor(M.SPAWN.x/16),sy=Math.floor(M.SPAWN.y/16);
 await Promise.all(ss.map(async([k,to])=>{let cx=M.SPAWN.x,cy=M.SPAWN.y;for(const [tx,ty] of path([sx,sy],to)){const X=tx*16+8,Y=ty*16+8;while(cx!=X||cy!=Y){cx+=Math.sign(X-cx)*Math.min(4,Math.abs(X-cx));cy+=Math.sign(Y-cy)*Math.min(4,Math.abs(Y-cy));k.emit('move',{x:cx,y:cy,dir:'down'});await wait(12);}}}));
 await pg.keyboard.down('ArrowDown');await wait(300);await pg.keyboard.up('ArrowDown');
 for(const [k,,t] of ss)if(t)k.emit('chat',{text:t,scope:'global'});await wait(2500);
 await pg.screenshot({path:'screenshot.png'});await br.close();for(const [k] of ss)k.disconnect();process.exit(0);})();
