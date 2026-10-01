/* Headless read of the LIVE Hub (scintillahub.ai): dumps the board rows and the trend/momentum store the board paints
   from, and takes the BEFORE screenshots (v1 default, and the ?board=v2 switch) at a given width. Read-only: every
   non-GET request is answered locally and never sent. */
import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const SP="/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/e77be5db-5287-49a2-8460-98ce31b037ac/scratchpad";
const width=+process.argv[2]||1680, mobile=width<500, height=mobile?844:1050;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({headless:true,args:["--disable-gpu","--hide-scrollbars","--mute-audio"]});
const ctx=await b.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:"block",isMobile:mobile,hasTouch:mobile});
const writes=[];
await ctx.route("**/*",async(route)=>{const m=route.request().method();if(m!=="GET"&&m!=="HEAD"&&m!=="OPTIONS"){writes.push(m+" "+route.request().url().slice(0,80));return route.fulfill({status:201,headers:{"access-control-allow-origin":"*","content-type":"application/json"},body:"[]"});}return route.continue();});
const page=await ctx.newPage();
for(const [tag,url] of [["v1","https://scintillahub.ai/?board=v1"],["v2","https://scintillahub.ai/?board=v2"]]){
  await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000}); await sleep(12000);
  await page.screenshot({path:`${SP}/shots/live-${tag}-${width}.png`});
  const d=await page.evaluate(()=>{
    const rows=(S.rows||[]).map(r=>({t:r.t,name:r.name,price:r.price,c:r.c,g:r.g,rsi:r.rsi,mc:r.mc,fpe:r.fpe,rv:r.rv}));
    const all=(typeof ALLROWS!=="undefined"&&ALLROWS||[]).map(r=>({t:r.t,name:r.name,price:r.price,c:r.c,g:r.g,rsi:r.rsi,mc:r.mc,fpe:r.fpe,rv:r.rv}));
    const tm=window.SCIN_TM||{};
    const cols=(typeof BOARD_COLS!=="undefined")?BOARD_COLS.map(c=>c[0]):null;
    const hdr=document.querySelector(".ch.hdr"); const cells=hdr?[...hdr.children].map(e=>({txt:e.textContent.trim(),w:e.getBoundingClientRect().width})):null;
    const row=document.querySelector(".sc-board__row"); const rc=row?[...row.children].map(e=>({cls:e.className,txt:e.textContent.trim().slice(0,20),w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})):null;
    const rowRect=row?row.getBoundingClientRect():null; const board=document.getElementById("boardScroll"); 
    return {coh:S.coh,rows,all,tm,cols,cells,rc,rowRect:rowRect&&{w:rowRect.width,h:rowRect.height},boardW:board&&board.clientWidth,nrows:document.querySelectorAll(".sc-board__row").length,
      readSample:[...document.querySelectorAll(".sc-board__row .gwx-read")].slice(0,40).map(e=>({t:e.parentElement.dataset.t,txt:e.textContent,icon:e.dataset.icon,div:e.dataset.div,col:e.style.color,w:e.getBoundingClientRect().width}))};
  });
  fs.writeFileSync(`${SP}/live-${tag}-${width}.json`,JSON.stringify(d,null,1));
  console.log(tag,width,"coh",d.coh,"rows",d.rows.length,"all",d.all.length,"tm",Object.keys(d.tm).length,"boardW",d.boardW,"rowH",d.rowRect&&d.rowRect.h);
  console.log("cols",JSON.stringify(d.cells)); console.log("rowcells",JSON.stringify(d.rc));
}
console.log("blocked writes",writes.length,writes.slice(0,5));
await b.close();
