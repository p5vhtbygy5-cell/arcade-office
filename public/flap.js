// Split-flap board. Tiles flicker, then each row locks from the top.
// Progress is computed from timestamps, so a slow frame shows the right row.
(function(root){
const DEFAULT='#f4ecd8';
const CHARSET='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%+-';
const seg=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter(undefined,{granularity:'grapheme'}):null;
function graphs(s){
  s=String(s??'');
  if(!s) return [];
  if(seg) return [...seg.segment(s)].map(x=>x.segment);
  return [...s];
}
const cache=new Map();
function font(){return (root.AO_FLAP||'sans-serif');}
function glyphOf(ch, w, h, color){
  const key=w+'|'+h+'|'+color+'|'+ch;
  const hit=cache.get(key);
  if(hit) return hit;
  const S=2, c=document.createElement('canvas');
  c.width=Math.max(1,w*S); c.height=Math.max(1,h*S);
  const g=c.getContext('2d');
  g.scale(S,S);
  let fs=Math.max(8, Math.floor(h*0.74));
  g.font='700 '+fs+'px '+font();
  g.textAlign='center'; g.textBaseline='middle';
  const mw=g.measureText(ch).width;
  if(mw>w*0.9&&mw>0){fs=Math.max(8, Math.floor(fs*(w*0.9)/mw)); g.font='700 '+fs+'px '+font();}
  g.fillStyle=color;
  g.fillText(ch, w/2, h*0.52);
  cache.set(key, c);
  if(cache.size>1000) cache.clear();
  return c;
}
function blank(){return {target:' ', color:DEFAULT, shown:' ', flipFrom:' ', flipTo:' ', flipStart:0, flipDur:160, flicker:false, nextFlick:0, settleAt:0};}

function create(canvas, opts){
  opts=opts||{};
  const rowDelay=opts.rowDelay!=null?opts.rowDelay:3000;
  const startDelay=opts.startDelay||0;
  const flickerMs=opts.flicker||520;
  const maxCell=opts.maxCell||110;
  const onRow=opts.onRow||null;
  let desired=[];
  let pending=null;
  let grid=null;
  let lastW=0, lastH=0;

  function layout(w, h, rows){
    const texts=rows.map(r=>graphs(r.text||''));
    const natural=Math.max(1, ...texts.map(t=>t.length), 1);
    const gap=Math.max(2, Math.round(Math.min(w, h)*0.008));
    let cols=natural;
    let cellW=Math.floor((w-gap*(cols-1))/cols);
    if(cellW>maxCell){
      cols=Math.max(natural, Math.floor((w+gap)/(maxCell+gap)));
      cellW=Math.floor((w-gap*(cols-1))/cols);
    }
    const rowsN=Math.max(1, rows.length);
    let cellH=Math.floor(cellW*1.18);
    const maxH=Math.floor((h-gap*(rowsN-1))/rowsN);
    if(cellH>maxH) cellH=Math.max(8, maxH);
    cellW=Math.max(6, Math.min(cellW, Math.floor(cellH/1.05)));
    const gridW=cols*cellW+gap*(cols-1);
    const gridH=rowsN*cellH+gap*(rowsN-1);
    return {cols, rowsN, cellW, cellH, gap, texts,
      ox:Math.max(0, Math.floor((w-gridW)/2)),
      oy:Math.max(0, Math.floor((h-gridH)/2))};
  }
  function ensure(cols, rowsN){
    if(grid&&grid.cols===cols&&grid.rows.length===rowsN) return;
    const rows=[];
    for(let r=0;r<rowsN;r++){
      const tiles=[];
      for(let c=0;c<cols;c++) tiles.push(blank());
      rows.push({tiles, settled:true, settleAt:0});
    }
    grid={cols, rows};
  }
  function writeTargets(L, now, mode){
    ensure(L.cols, L.rowsN);
    for(let r=0;r<L.rowsN;r++){
      const src=desired[r]||{text:'', colors:null};
      const text=L.texts[r]||[];
      const colors=src.colors||null;
      for(let c=0;c<L.cols;c++){
        const ch=text[c]||' ';
        const color=(colors&&colors[c])||DEFAULT;
        const tile=grid.rows[r].tiles[c];
        const changed=tile.target!==ch||tile.color!==color;
        tile.target=ch; tile.color=color;
        if(mode==='patch'&&changed&&!tile.flicker){
          tile.flipFrom=tile.shown||' ';
          tile.flipTo=ch;
          tile.flipStart=now;
          tile.flipDur=150;
        }
      }
    }
    if(mode==='cascade'){
      const end=now+flickerMs;
      grid.rows.forEach((row,i)=>{
        row.settled=false;
        row.settleAt=end+startDelay+i*rowDelay;
        row.tiles.forEach(t=>{t.flicker=true; t.nextFlick=now; t.settleAt=row.settleAt;});
      });
    }
  }
  function setRows(rows, mode){
    desired=(rows&&rows.length?rows:[{text:''}]).map(r=>typeof r==='string'?{text:r}:{text:r.text||'', colors:r.colors||null});
    pending=mode||'patch';
  }
  function resize(w, h){
    w=Math.max(2, w|0); h=Math.max(2, h|0);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w; canvas.height=h;}
  }
  function drawGlyph(ctx, ch, color, x, y, w, h){
    if(!ch||ch===' ') return;
    const img=glyphOf(ch, w, h, color||DEFAULT);
    ctx.drawImage(img, x, y, w, h);
  }
  function clipDraw(ctx, x, y, w, h, fn){
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore();
  }
  function housing(ctx, x, y, w, h){
    ctx.fillStyle='#070605';
    ctx.fillRect(x-1, y-1, w+2, h+2);
    ctx.fillStyle='#1a1612';
    ctx.fillRect(x, y, w, h/2);
    ctx.fillStyle='#100e0c';
    ctx.fillRect(x, y+h/2, w, h/2);
    ctx.fillStyle='rgba(255,244,220,.16)';
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle='rgba(0,0,0,.75)';
    ctx.fillRect(x, y+h/2-1, w, 2);
  }
  function flap(ctx, ch, color, x, y, w, h, scaleY, which){
    if(scaleY<=0.02) return;
    const seam=y+h/2;
    ctx.save();
    ctx.translate(0, seam);
    ctx.scale(1, scaleY);
    ctx.translate(0, -seam);
    if(which==='bottom') clipDraw(ctx, x, seam, w, h/2, ()=>drawGlyph(ctx, ch, color, x, y, w, h));
    else clipDraw(ctx, x, y, w, h/2, ()=>drawGlyph(ctx, ch, color, x, y, w, h));
    ctx.fillStyle='rgba(0,0,0,'+(0.5*(1-scaleY)).toFixed(3)+')';
    ctx.fillRect(x, which==='bottom'?seam:y, w, h/2);
    ctx.restore();
  }
  function drawTile(ctx, tile, x, y, w, h, now){
    housing(ctx, x, y, w, h);
    let p=1, from=tile.shown, to=tile.shown;
    if(tile.flipStart){
      p=Math.min(1, (now-tile.flipStart)/tile.flipDur);
      from=tile.flipFrom; to=tile.flipTo;
      if(p>=1){tile.shown=tile.flipTo; tile.flipStart=0; from=to=tile.shown;}
    }
    if(p>=1){
      drawGlyph(ctx, tile.shown, tile.color, x, y, w, h);
    }else if(p<0.5){
      const k=1-p*2;
      clipDraw(ctx, x, y, w, h/2, ()=>drawGlyph(ctx, from, tile.color, x, y, w, h));
      clipDraw(ctx, x, y+h/2, w, h/2, ()=>drawGlyph(ctx, to, tile.color, x, y, w, h));
      flap(ctx, from, tile.color, x, y, w, h, k, 'bottom');
    }else{
      const k=(p-0.5)*2;
      clipDraw(ctx, x, y+h/2, w, h/2, ()=>drawGlyph(ctx, to, tile.color, x, y, w, h));
      flap(ctx, to, tile.color, x, y, w, h, k, 'top');
    }
    ctx.fillStyle='rgba(0,0,0,.72)';
    ctx.fillRect(x, y+h/2-1, w, 2);
  }
  function frame(now){
    const w=canvas.width, h=canvas.height;
    if(w<4||h<4) return;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled=true;
    const rows=desired.length?desired:[{text:''}];
    const L=layout(w, h, rows);
    if(pending||!grid||grid.cols!==L.cols||grid.rows.length!==L.rowsN||w!==lastW||h!==lastH){
      const mode=pending||(grid?'patch':'cascade');
      lastW=w; lastH=h;
      writeTargets(L, now, mode);
      pending=null;
    }
    for(let r=0;r<L.rowsN;r++){
      const row=grid.rows[r];
      if(!row.settled&&now>=row.settleAt){row.settled=true; if(onRow) onRow(r);}
      for(let c=0;c<L.cols;c++){
        const tile=row.tiles[c];
        if(tile.flicker&&now<tile.settleAt){
          if(now>=tile.nextFlick){
            tile.flipFrom=tile.shown;
            tile.shown=CHARSET[(Math.random()*CHARSET.length)|0];
            tile.flipTo=tile.shown;
            tile.flipStart=now;
            tile.flipDur=76;
            tile.nextFlick=now+76;
          }
        }else if(tile.flicker){
          tile.flicker=false;
          tile.flipFrom=tile.shown;
          tile.flipTo=tile.target;
          tile.flipStart=now;
          tile.flipDur=170;
        }
        const x=L.ox+c*(L.cellW+L.gap), y=L.oy+r*(L.cellH+L.gap);
        drawTile(ctx, tile, x, y, L.cellW, L.cellH, now);
      }
    }
  }
  return {setRows, resize, frame, canvas};
}
function clearCache(){cache.clear();}
root.FLAP={create, graphs, clearCache};
})(window);
