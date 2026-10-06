/* T7 (2 Oct, evening) · the headless walk for the podium STANDING UP (PODIUM 3D | FROM ABOVE) and the Hub's lists as podiums
   (★ FAVORITES, ♥ LIKED) — at 1680 wide, device scale 2 (Alan's Retina), and 390 (phone, scale 1). Runs proof.mjs per run
   (headless Chrome, SwiftShader, never a window) and writes shots/t7-*.png and shots/t7-proof.json.
   The Hub's list mirrors are planted in the test browser before the page loads, under the exact keys the Hub writes
   ("sc_lists" → {favorites, radar}; "sc_fav" → the LIKED tickers): 30 real served tickers as FAVORITES, 60 as LIKED.
   node proof-t7.mjs <base url, e.g. http://127.0.0.1:8765> */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:8765";
const url = (q) => `${base}/deliverables/20260929/tree-map/index.html?${q}`;
const T = JSON.parse(readFileSync("tree.json", "utf8"));
const served = T.nodes.filter((n) => n.kind === "name" && n.served && n.ticker).map((n) => n.ticker);
const FAVS = served.slice(0, 30), LIKED = served.slice(0, 60); // the first 30 / 60 served names in the tree's own order: real tickers, deterministic
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: FAVS, radar: [] }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(LIKED))}); } catch (e) {}`;
const run = (w, h, mobile, dpr, q, steps, init = INIT) => JSON.parse(execFileSync("node", ["proof.mjs", url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: init }, maxBuffer: 64 << 20 }).toString());
// the podium on the screen: every place (rank, reading, radius, height; standing: the ramp and the tip), the three orders, the bars' rectangles and how many pairs touch
const PODIUM = `(()=>{const P=__mm.coilPlaces();const R=P.filter(p=>p.v!=null);const B=__mm.boxes();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const b of B){x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+b.w);y1=Math.max(y1,b.y+b.h)}const ov=[];for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++){const a=B[i],b=B[j];if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)ov.push([a.id,b.id])}const ws=B.map(x=>x.w).sort((p,q)=>p-q),hs=B.map(x=>x.h).sort((p,q)=>p-q);const stand=R.length&&R[0].ramp!=null;return {mode:__mm.podiumMode(),n:P.length,read:R.length,first:R[0],last:R[R.length-1],rMono:R.every((p,i)=>!i||p.r>=R[i-1].r),yMono:R.every((p,i)=>!i||p.y<=R[i-1].y),vMono:R.every((p,i)=>!i||p.v<=R[i-1].v),rampMono:stand?R.every((p,i)=>!i||p.ramp<R[i-1].ramp):null,tipMono:stand?R.every((p,i)=>!i||p.tip<=R[i-1].tip):null,rampTop:stand?R[0].ramp:null,rampBottom:stand?P[P.length-1].ramp:null,bars:B.length,minW:ws[0],maxW:ws[ws.length-1],minH:hs[0],maxH:hs[hs.length-1],overlaps:ov.length,sample:ov.slice(0,8),screen:[Math.round(x0),Math.round(y0),Math.round(x1),Math.round(y1)],screen_h:Math.round(y1-y0),canvas:[Math.round(document.getElementById("graph").getBoundingClientRect().width),Math.round(document.getElementById("graph").getBoundingClientRect().height)],labels:__mm.labelsShown,count:__mm.clusterCount,bar:document.getElementById("areabar").innerText.replace(/\\s+/g," "),seg:[...document.querySelectorAll("#podium-seg button")].map(b=>[b.textContent,b.classList.contains("on")]),focused:__mm.canvasFocused(),card:(document.querySelector("#card .wait")||{}).innerText||""}})()`;
const LISTS = `({lists:__mm.lists(),rows:[...document.querySelectorAll("#outline .row.list")].map(r=>r.innerText.replace(/\\s+/g," ").trim()),chips:[...document.querySelectorAll("#listbar button")].map(b=>[b.textContent,getComputedStyle(b).display!=="none"]),cardTitle:(document.querySelector("#card h2")||{}).textContent||"",cardNote:(document.querySelector("#card .wait")||{}).innerText||""})`;
const desktop = [
  { state: true }, { probe: LISTS },
  // the Technology podium: PODIUM 3D opens by default
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2200 }, { state: true }, { probe: PODIUM }, { labels: true }, { crumbs: true }, { shot: "shots/t7-1680-podium3d-tech.png" },
  { shot: "shots/t7-1680-podium3d-tech-zoom.png", clip: [470, 150, 520, 330, 2] },
  { hover: "NVDA" }, { shot: "shots/t7-1680-podium3d-tech-hover.png" }, { unhover: true },
  // FROM ABOVE: T6's picture with the new spacing
  { eval: "__mm.setPodium('above')" }, { wait: 2000 }, { state: true }, { probe: PODIUM }, { labels: true }, { shot: "shots/t7-1680-above-tech.png" },
  { eval: "__mm.setPodium('3d')" }, { wait: 2000 }, { probe: PODIUM },
  // a click on a column = that name's card, on the tree
  { click: "NVDA" }, { state: true }, { shot: "shots/t7-1680-podium3d-click-nvda.png" },
  // the Hub's lists as podiums (planted: 30 FAVORITES, 60 LIKED)
  { eval: "__mm.setDetail('clean')" }, { wait: 1200 },
  { eval: "__mm.openList('LIST_FAVORITES')" }, { wait: 2400 }, { state: true }, { probe: PODIUM }, { probe: LISTS }, { crumbs: true }, { shot: "shots/t7-1680-podium3d-favorites.png" },
  { key: "Escape" }, { state: true },
  { eval: "__mm.openList('LIST_LIKED')" }, { wait: 2400 }, { state: true }, { probe: PODIUM }, { shot: "shots/t7-1680-podium3d-liked.png" },
  { key: "Escape" }, { state: true }, { probe: LISTS },
  // the outline rows too
  { view: "outline" }, { probe: LISTS }, { shot: "shots/t7-1680-outline-lists.png" },
];
const emptyRun = [ // nothing planted: the two entries exist and say so in one line, never a blank
  { state: true }, { probe: LISTS }, { eval: "__mm.openList('LIST_FAVORITES')" }, { wait: 800 }, { state: true }, { probe: LISTS }, { shot: "shots/t7-1680-lists-empty.png" },
];
const phone = [
  { state: true }, { view: "canvas" }, { state: true }, { probe: LISTS },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2200 }, { state: true }, { probe: PODIUM }, { shot: "shots/t7-390-podium3d-tech.png" }, { eval: "__mm.closeArea()" }, { wait: 800 },
  { eval: "__mm.openList('LIST_FAVORITES')" }, { wait: 2200 }, { state: true }, { probe: PODIUM }, { shot: "shots/t7-390-podium3d-favorites.png" },
];
const out = [];
out.push(run(1680, 1000, false, 2, "detail=clean&order=geiger", desktop));
out.push(run(1680, 1000, false, 2, "detail=clean&order=geiger", emptyRun, "void 0"));
out.push(run(390, 844, true, 1, "detail=clean&order=geiger", phone));
writeFileSync("shots/t7-proof.json", JSON.stringify(out, null, 1));
for (const r of out) console.log(r.width, "@", r.dpr, "errors", r.page_errors.length, "steps", r.log.length);
for (const r of out) for (const x of r.log) if (x.probe && x.value && "overlaps" in x.value) console.log(r.width, x.value.mode, x.value.count && x.value.count.list ? "list" : "tech", "bars", x.value.bars, "overlaps", x.value.overlaps, "labels", x.value.labels, "ramp", x.value.rampMono, "tip", x.value.tipMono);
