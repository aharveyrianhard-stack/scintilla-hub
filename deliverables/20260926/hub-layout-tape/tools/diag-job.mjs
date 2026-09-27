/* D1 — builds the diagnosis capture job for one width. node diag-job.mjs 1680 outdir > job.json */
const [W, OUT] = process.argv.slice(2); const w = +W; const mobile = w < 700; const h = mobile ? 844 : (w >= 1600 ? 1050 : 900);
const HELP = `window.__R=(e)=>{if(!e)return null;const b=e.getBoundingClientRect();const cs=getComputedStyle(e);return {x:Math.round(b.left+scrollX),y:Math.round(b.top+scrollY),w:Math.round(b.width),h:Math.round(b.height),fs:cs.fontSize,color:cs.color,deco:cs.textDecorationLine,align:cs.textAlign,text:(e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,90)}};
window.__Q=(s)=>__R(document.querySelector(s));
window.__T=(root,txt)=>{const r=document.querySelector(root);if(!r)return null;const e=[...r.querySelectorAll('*')].find(x=>!x.children.length&&(x.innerText||'').trim()===txt);return __R(e)};
window.__untuck=()=>{document.body.classList.remove('tuck','btuck');};true`;
const A = `(()=>{__untuck();return {ident:__Q('#coIdentBar'),identTk:__Q('#coIdentBar .sc-ctkbig'),identStat:__Q('#coIdentBar .sc-clive'),headStat:__Q('.sc-head__live'),
 macroNext:__Q('#macroNext'),scint:__Q('#scintStrip'),mtabs:__Q('#mtabs'),mtabAlloc:__Q('.sc-mtab[data-sec=ALLOCATION]'),mtabStation:__Q('.sc-mtab[data-sec=STATION]'),mtabNews:__Q('.sc-mtab[data-sec=NEWS]'),
 cohtabs:__Q('.sc-ihead.cohtabs'),cohGeiger:__Q('#cohGeiger'),gwx:__Q('.gwx'),board:__Q('#boardPanel'),right:__Q('#leftPanel'),hdr:__Q('.ch.hdr'),usualHdr:__T('.ch.hdr','USUAL DAY'),geigerHdr:__T('.ch.hdr','GEIGER ▼'),
 bands:__Q('#bands'),cohtab:__Q('.sc-ihead.cohtabs .sc-coh'),colhdrFs:getComputedStyle(document.querySelector('.ch.hdr')||document.body).fontSize,
 bandsText:(document.querySelector('#bands')||{}).innerText?.replace(/\\s+/g,' ').slice(0,300)}})()`;
const B = `(()=>{__untuck();const sel=document.querySelector('.sc-board__row.sel');return {identTk:__Q('#coIdentBar .sc-ctkbig'),identStat:__Q('#coIdentBar .sc-clive'),headStat:__Q('.sc-head__live'),ident:__Q('#coIdentBar'),
 src:__Q('.sc-cofr__src'),cofrBar:__Q('.sc-cofr__bar'),frame:__Q('#coChartFrame'),ptabs:__Q('#leftPanel .sc-ihead'),ptab:__Q('#leftPanel .sc-it'),auto:__Q('#scAutoBox'),rot:__Q('#scRotSel'),exp:__Q('#coExpBtn'),selRow:__R(sel),right:__Q('#leftPanel'),board:__Q('#boardPanel'),
 usualHdr:__T('.ch.hdr','USUAL DAY'),geigerHdr:__T('.ch.hdr','GEIGER ▼'),scint:__Q('#scintStrip'),macroNext:__Q('#macroNext')}})()`;
const clickMeta = `(()=>{const r=[...document.querySelectorAll('#boardScroll [data-t]')].find(e=>e.dataset.t==='META')||document.querySelector('#boardScroll .sc-board__row');r.scrollIntoView({block:'center'});r.click();window.scrollTo(0,0);return 'row '+r.dataset.t})()`;
const tab = (t) => `(()=>{const b=[...document.querySelectorAll('#leftPanel [data-act=cotab]')].find(e=>e.innerText.trim()===${JSON.stringify(t)});if(!b)return 'no tab ${t}';b.click();return 'tab ${t}'})()`;
const steps = [{ until: "document.querySelectorAll('#boardScroll [data-t]').length>10", tries: 80 }, { wait: 2500 }, { eval: HELP }, { eval: "__untuck()" }, { wait: 900 }, { eval: A, as: "board" }, { shot: `${OUT}/live-${w}-board.png`, full: mobile },
  { eval: clickMeta, as: "click" }, { until: "document.querySelector('#coChartFrame')", tries: 40 }, { wait: 6000 }, { eval: "__untuck()" }, { wait: 900 }, { eval: B, as: "meta" }, { shot: `${OUT}/live-${w}-meta.png`, full: mobile }];
if (w >= 1600) {
  steps.push({ click: "#coExpBtn" }, { wait: 6000 }, { eval: B, as: "expanded" }, { shot: `${OUT}/live-${w}-expanded.png` },
    { eval: tab("GEIGER") }, { wait: 5000 }, { eval: `(()=>({panel:__Q('#leftPanel'),first:__Q('#leftPanel .sc-rc > *')}))()`, as: "geiger" }, { shot: `${OUT}/live-${w}-geiger.png` },
    { eval: tab("FUNDAMENTALS") }, { wait: 8000 }, { shot: `${OUT}/live-${w}-fundamentals.png` },
    { eval: tab("ESTIMATES") }, { wait: 5000 }, { shot: `${OUT}/live-${w}-estimates.png` },
    { click: "#coExpBtn" }, { wait: 1500 }, { click: "#leftPanel [data-act=unpin]" }, { wait: 2500 },
    { eval: `(()=>{const b=document.querySelector('#boardPanel [data-act=secfs]');if(!b)return 'no board fs';b.click();return 'board fs'})()` }, { wait: 3500 },
    { eval: `(()=>{const cells=[...document.querySelectorAll('.ch.hdr > *')].map(e=>{const b=e.getBoundingClientRect();return {t:(e.innerText||'').trim(),x:Math.round(b.left),w:Math.round(b.width)}});return {cells,board:__Q('#boardPanel')}})()`, as: "fullscreen" },
    { shot: `${OUT}/live-${w}-board-fullscreen.png` });
} else {
  steps.push({ eval: `(()=>{const cells=[...document.querySelectorAll('.ch.hdr > *')].map(e=>{const b=e.getBoundingClientRect();return {t:(e.innerText||'').trim(),x:Math.round(b.left),w:Math.round(b.width)}});return {cells}})()`, as: "cols" });
}
console.log(JSON.stringify({ url: "https://scintillahub.ai/", width: w, height: h, mobile, timeout: 200, steps }));
