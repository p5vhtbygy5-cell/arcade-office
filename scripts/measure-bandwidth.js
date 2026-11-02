// Rough bytes/min estimate for REST bootstrap + one minute of socket scan payloads.
const http=require('http'),{io}=require('socket.io-client');
const host=process.env.HOST||'localhost', port=+process.env.PORT||3999;
const base='http://'+host+':'+port;

function get(path, headers){
  return new Promise((resolve,reject)=>{
    const req=http.request(base+path,{headers:headers||{}},res=>{
      const chunks=[]; res.on('data',c=>chunks.push(c)); res.on('end',()=>resolve({status:res.statusCode,bytes:Buffer.concat(chunks).length,etag:res.headers.etag}));
    });
    req.on('error',reject); req.end();
  });
}

(async()=>{
  const paths=['/api/feed','/api/portfolio','/api/ticker','/api/scan','/api/top10'];
  let boot=0, boot304=0;
  for(const p of paths){
    const a=await get(p,{Accept:'application/json','Accept-Encoding':'identity'});
    boot+=a.bytes;
    const b=await get(p,{Accept:'application/json','Accept-Encoding':'identity','If-None-Match':a.etag||'"x"'});
    boot304+=b.bytes;
  }
  let scanBytes=0, n=0;
  await new Promise((resolve,reject)=>{
    const s=io(base,{transports:['websocket']});
    s.on('connect',()=>{});
    s.on('scan',d=>{scanBytes+=JSON.stringify(d).length; n++; if(n>=60) {s.close(); resolve();}});
    setTimeout(()=>{s.close(); resolve();},65000);
  });
  console.log(JSON.stringify({bootstrapBytes:boot, bootstrap304Bytes:boot304, scanEventsPerMin:n, scanBytesPerMin:scanBytes, scanAvgBytes:n?Math.round(scanBytes/n):0},null,2));
})().catch(e=>{console.error(e); process.exit(1);});
