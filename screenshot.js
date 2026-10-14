const p=require('puppeteer-core');const {io}=require('socket.io-client');const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const bots=[['Satoshi','#ffe600',0,200,200,'HODL! 💎'],['Vitalik','#00f0ff',2,700,150,'Spotkanie o 18:00'],['DogeLord','#ff6b00',3,250,430,''],['MoonBoi','#b026ff',1,620,420,'wen lambo? 🚀']];
 const ss=[];for(const [n,c,s,x,y,t] of bots){const k=io('http://localhost:3000');k.emit('join',{name:n,color:c,sprite:s});ss.push([k,x,y,t]);}
 const br=await p.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const pg=await br.newPage();await pg.setViewport({width:1300,height:920});
 await pg.goto('http://localhost:3000');await pg.type('#nick','Złotr');await pg.click('#go');await wait(500);
 for(const [k,x,y] of ss){const sp={x:240,y:300};k.emit('move',{x:x,y:y});} // may be rejected; walk instead
 for(const [k,x,y] of ss){let cx=240,cy=300;const path=[[240,y<300?250:350]];// go through door then to target
  const steps=[];const go=(tx,ty)=>{while(Math.abs(cx-tx)>1||Math.abs(cy-ty)>1){cx+=Math.sign(tx-cx)*Math.min(20,Math.abs(tx-cx));cy+=Math.sign(ty-cy)*Math.min(20,Math.abs(ty-cy));steps.push([cx,cy]);}};
  go(240,y<300?260:340);if(x>480){go(240,y<300?140:450);go(x,y<300?140:450);}go(x,y);
  for(const [sx,sy] of steps){k.emit('move',{x:sx,y:sy});await wait(15);}}
 await pg.keyboard.down('ArrowDown');await wait(1050);await pg.keyboard.up('ArrowDown');await pg.keyboard.down('ArrowRight');await wait(2700);await pg.keyboard.up('ArrowRight');
 for(const [k,,,t] of ss)if(t)k.emit('chat',{text:t,scope:'global'});await wait(4500);
 await pg.screenshot({path:'screenshot.png'});await br.close();process.exit(0);})();
