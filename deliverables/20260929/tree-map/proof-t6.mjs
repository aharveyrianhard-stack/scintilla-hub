/* T6 (2 Oct) · the headless walk for the tree's Geiger boxes in CLEAN, the PODIUM coil, OPEN 3D per section with its top bar
   and Esc, the disagreement-free cards, and the clear bottom band — at 1680 and 1400 (device scale 2, Alan's Retina), a
   short 1680 × 700 window (the bottom band), and 390 (phone, scale 1). Runs proof.mjs per run (headless Chrome,
   SwiftShader, never a window) and writes shots/t6-*.png and shots/t6-proof.json.
   node proof-t6.mjs <base url, e.g. http://127.0.0.1:8765> */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:8765";
const url = (q) => `${base}/deliverables/20260929/tree-map/index.html?${q}`;
const run = (w, h, mobile, dpr, q, steps) => JSON.parse(execFileSync("node", ["proof.mjs", url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr) }, maxBuffer: 64 << 20 }).toString());
// the boxes on the screen: how many, how big, how many pairs overlap, the zoom (px per world unit)
const BOXES = `(()=>{const B=__mm.boxes();const ov=[];for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],b=B[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)ov.push([a.id,b.id])}const a=__mm.screenOf("MARKET"),b=__mm.screenOf("US");const m=__mm.byId.get("MARKET").pos,u=__mm.byId.get("US").pos;const ws=B.map(x=>x.w).sort((p,q)=>p-q),hs=B.map(x=>x.h).sort((p,q)=>p-q);return {boxes:B.length,kinds:B.reduce((o,x)=>(o[x.kind]=(o[x.kind]||0)+1,o),{}),empty:B.filter(x=>x.v==null).length,overlaps:ov.length,sample:ov.slice(0,6),ppu:+(Math.hypot(a[0]-b[0],a[1]-b[1])/m.distanceTo(u)).toFixed(3),minW:ws[0],minH:hs[0],maxW:ws[ws.length-1],labels:__mm.labelsShown,rows:__mm.sectorRows}})()`;
const AREA = `({focused:__mm.canvasFocused(),bar:document.getElementById("areabar").innerText,barShown:getComputedStyle(document.getElementById("areabar")).display!=="none",card:(document.querySelector("#card .wait")||{}).innerText||"",crumbs:__mm.crumbs()})`;
const PODIUM = `(()=>{const P=__mm.coilPlaces();const B=__mm.boxes();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const b of B){x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+b.w);y1=Math.max(y1,b.y+b.h)}const ov=[];for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],b=B[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)ov.push([a.id,b.id])}const rows=document.querySelectorAll("#outline .row").length;return {n:P.length,first:P[0],last:P[P.length-1],rMono:P.every((p,i)=>!i||p.r>=P[i-1].r),yMono:P.every((p,i)=>!i||p.y<=P[i-1].y),vMono:P.every((p,i)=>!i||p.v<=P[i-1].v),bars:B.length,barW:B[0]&&B[0].w,barH:B[0]&&B[0].h,overlaps:ov.length,screen:[Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)],screen_h:Math.round(y1-y0),canvas_h:Math.round(document.getElementById("graph").getBoundingClientRect().height),labels:__mm.labelsShown,count:__mm.clusterCount,bar:document.getElementById("areabar").innerText,focused:__mm.canvasFocused()}})()`;
const CARD = `(()=>{const t=document.getElementById("card").innerText;return {name:(document.querySelector("#card h2")||{}).textContent,hasSIC:/\\bSIC\\b/.test(t),hasIndustry:/INDUSTRY/.test(t),hasDisagree:/the two authorities differ|DISAGREE/.test(t),len:t.length}})()`;
const HEADER = `({headerHas3d:!!document.querySelector(".ctrl #v-3d"),keyHasWhole:!!document.querySelector("#legend #v-3d")&&document.querySelector("#legend #v-3d").textContent.trim()==="WHOLE MAP 3D",chipText:(document.querySelector(".lb .lb3d")||{}).textContent||"",chipPx:(()=>{const c=document.querySelector(".lb .lb3d");if(!c)return null;const r=c.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})(),sections:__mm.sectionsWithChip().length,chips:__mm.chipsDrawn().length})`;
const desktop = (tag) => [
  { state: true }, { labels: true }, { box: true }, { probe: BOXES }, { probe: "__mm.bottomGap()" }, { probe: HEADER }, { shot: `shots/t6-${tag}-clean.png` },
  { shot: `shots/t6-${tag}-clean-zoom.png`, clip: [300, 200, 640, 400, 2] },
  { eval: "document.getElementById('legend').open = true" }, { wait: 900 }, { probe: "__mm.bottomGap()" }, { shot: `shots/t6-${tag}-clean-key.png` }, { eval: "document.getElementById('legend').open = false" }, { wait: 900 },
  { hover: "SEC_TECH" }, { unhover: true },
  { clickSel: ".lb[data-id='SEC_TECH'] .lb3d" }, { state: true }, { probe: AREA }, { crumbs: true }, { shot: `shots/t6-${tag}-area-tech.png` }, { key: "Escape" }, { state: true }, { probe: AREA },
  { clickSel: ".lb[data-id='SEC_FIN']" }, { state: true }, { eval: "__mm.closeArea()" }, { wait: 1000 },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2000 }, { state: true }, { probe: PODIUM }, { labels: true }, { crumbs: true }, { shot: `shots/t6-${tag}-podium-tech.png` },
  { shot: `shots/t6-${tag}-podium-tech-zoom.png`, clip: [500, 230, 480, 300, 2] },
  { hover: "NVDA" }, { shot: `shots/t6-${tag}-podium-tech-hover.png` }, { unhover: true },
  { click: "NVDA" }, { state: true }, { probe: CARD }, { shot: `shots/t6-${tag}-podium-click-nvda.png` },
  { eval: "__mm.setDetail('clean')" }, { wait: 1300 }, { eval: "__mm.openCoil('COHORT_AI_POWER')" }, { wait: 2000 }, { state: true }, { probe: PODIUM }, { shot: `shots/t6-${tag}-podium-aipower.png` }, { eval: "__mm.closeArea()" }, { wait: 1000 },
  { eval: "__mm.setDetail('detailed')" }, { wait: 1300 }, { state: true }, { labels: true }, { shot: `shots/t6-${tag}-detailed.png` }, { eval: "__mm.setDetail('clean')" }, { wait: 1300 },
  { find: "MSFT" }, { wait: 500 }, { probe: CARD }, { shot: `shots/t6-${tag}-msft.png` }, { key: "Escape" },
];
const short = [{ state: true }, { probe: "__mm.bottomGap()" }, { shot: "shots/t6-1680x700-clean.png" }, { eval: "document.getElementById('legend').open = true" }, { wait: 900 }, { probe: "__mm.bottomGap()" }, { shot: "shots/t6-1680x700-clean-key.png" }];
const phone = [
  { state: true }, { view: "canvas" }, { state: true }, { labels: true }, { probe: BOXES }, { probe: HEADER }, { shot: "shots/t6-390-clean.png" },
  { clickSel: ".lb[data-id='SEC_TECH'] .lb3d" }, { state: true }, { probe: AREA }, { shot: "shots/t6-390-area-tech.png" }, { eval: "__mm.closeArea()" }, { wait: 900 },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2000 }, { state: true }, { probe: PODIUM }, { shot: "shots/t6-390-podium-tech.png" }, { eval: "__mm.closeArea()" }, { wait: 800 },
  { find: "MSFT" }, { wait: 500 }, { probe: CARD },
];
const out = [];
out.push(run(1680, 1000, false, 2, "detail=clean&order=geiger", desktop("1680")));
out.push(run(1400, 900, false, 2, "detail=clean&order=geiger", desktop("1400")));
out.push(run(1680, 700, false, 2, "detail=clean&order=geiger", short));
out.push(run(390, 844, true, 1, "detail=clean&order=geiger", phone));
writeFileSync("shots/t6-proof.json", JSON.stringify(out, null, 1));
for (const r of out) console.log(r.width, "@", r.dpr, "errors", r.page_errors.length, "steps", r.log.length);
