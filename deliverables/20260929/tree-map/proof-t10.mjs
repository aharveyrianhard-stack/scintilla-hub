/* T10 (2 Oct, late night) · the headless walk for the tree's design standard — at 1920 × 1080 (scale 1, the Apple TV),
   1680 × 1050 (scale 2, the MacBook) and 390 (phone). Runs proof.mjs per run (headless Chrome, SwiftShader, never a window)
   and writes shots/t10-<tag>-*.png and shots/t10-<tag>-proof.json. "before" runs the same measurements against T9's page.
   node proof-t10.mjs <base url> <tag: before|after>
   What it measures, per screen: every box on the screen (size in px, the gap to its nearest neighbour, touching pairs), the
   density (boxes per million px² of canvas), the share of the canvas that is empty black, the type sizes; the opened section
   the same; the podium: the pitch above and below zero, the mirror (the red half's spiral against the green's), the labels
   (on the step meshes, no billboard), and the walk. The Hub's list mirrors are planted as in T8 / T9. */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:8771", tag = process.argv[3] || "after", before = tag === "before";
const url = (q) => `${base}/deliverables/20260929/tree-map/index.html?${q}`;
const T = JSON.parse(readFileSync("tree.json", "utf8"));
const served = T.nodes.filter((n) => n.kind === "name" && n.served && n.ticker).map((n) => n.ticker);
const FAVS = served.slice(0, 30), LIKED = served.slice(0, 60), RADAR = served.slice(100, 130);
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: FAVS, radar: RADAR }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(LIKED))}); } catch (e) {}`;
const run = (w, h, mobile, dpr, q, steps) => JSON.parse(execFileSync("node", ["proof.mjs", url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT }, maxBuffer: 64 << 20 }).toString());
// the boxes on the screen: sizes, the gap to the nearest neighbour, touching pairs, density, the canvas's black is measured apart
const DENS = `(()=>{const B=__mm.boxes?__mm.boxes():[];const L=__mm.labelsNow?__mm.labelsNow():[];const g=document.getElementById("graph").getBoundingClientRect();const W=g.width,Hh=g.height;
const q=(a)=>{const s=a.slice().sort((p,r)=>p-r);return s.length?{min:+s[0].toFixed(1),med:+s[s.length>>1].toFixed(1),max:+s[s.length-1].toFixed(1)}:null};
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;const gap=(a,b)=>{const dx=Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w)),dy=Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.h,b.y+b.h));return Math.hypot(dx,dy)};
let bb=0,ll=0,lb=0;const near=[];for(let i=0;i<B.length;i++){let m=1e9;for(let j=0;j<B.length;j++){if(i===j)continue;if(hit(B[i],B[j])){if(j>i)bb++;m=0;continue}m=Math.min(m,gap(B[i],B[j]))}near.push(m)}
for(let i=0;i<L.length;i++){for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))ll++;for(const b of B)if(b.id!==L[i].id&&hit(L[i],b))lb++}
const on=B.filter(b=>b.x+b.w>0&&b.x<W&&b.y+b.h>0&&b.y<Hh);const area=on.reduce((s,b)=>s+Math.max(0,Math.min(b.x+b.w,W)-Math.max(b.x,0))*Math.max(0,Math.min(b.y+b.h,Hh)-Math.max(b.y,0)),0);
const fs=(cls)=>{const d=document.createElement("div");d.className=cls;document.getElementById("labels").appendChild(d);const v=parseFloat(getComputedStyle(d).fontSize),c=getComputedStyle(d).color;d.remove();return [v,c]};
return {canvas:[Math.round(W),Math.round(Hh)],boxes:B.length,on_screen:on.length,box_w:q(B.map(b=>b.w)),box_h:q(B.map(b=>b.h)),nearest_gap:q(near.filter(Number.isFinite)),touching_pairs:bb,touching_boxes:near.filter(m=>m===0).length,density_per_Mpx:+(on.length/(W*Hh/1e6)).toFixed(1),box_area_share:+(area/(W*Hh)).toFixed(4),labels:L.length,label_on_label:ll,label_on_other_box:lb,ticker_labels:L.filter(l=>l.onbox).length,font_ticker:fs("lb n onbox"),font_sector:fs("lb h"),font_top:fs("lb h top"),font_cohort:fs("lb c"),ppu:__mm.ppu?+__mm.ppu().toFixed(4):null,podium:!!(__mm.clusterCount&&__mm.clusterCount.podium),std:__mm.standard?__mm.standard():null,area:__mm.cluster||null,rows:__mm.sectorRows}})()`;
// the staircase: the pitch rule above / below zero, the mirror, the gaps, the label meshes
const PITCH = `(()=>{const P=__mm.coilPlaces();const R=P.filter(p=>p.v!=null);const G=__mm.stepGaps?__mm.stepGaps():null;const L=__mm.labelsNow?__mm.labelsNow():[];
return {mode:__mm.podiumMode(),n:P.length,read:R.length,rule:__mm.pitchRule?__mm.pitchRule():null,mirror:__mm.mirror?__mm.mirror():null,gap_world:G?{min:Math.min(...G),max:Math.max(...G),n:G.length,touching:G.filter(g=>g<=0.5).length}:null,vMono:R.every((p,i)=>!i||p.v<=R[i-1].v),treadMono:P.every((p,i)=>!i||p.tread<=P[i-1].tread+1e-6),first:R[0],last:R[R.length-1],dom_ticker_labels:L.filter(l=>l.attip||l.onbox).length,labels:__mm.labelsShown,step_labels:__mm.stepLabels?__mm.stepLabels():null,params:__mm.podiumParams(),count:__mm.clusterCount,elevation:__mm.elevation?__mm.elevation():null,bar:document.getElementById("areabar").innerText.replace(/\\s+/g," ")}})()`;
const WALKST = `(()=>{const h=document.getElementById("walkhud");return {walking:__mm.walking?__mm.walking():null,at:__mm.walkAt==null?null:__mm.walkAt,hudText:h?h.innerText.replace(/\\s+/g," ").trim():null,elevation:__mm.elevation?__mm.elevation():null,pose:__mm.pose()}})()`;
const t10 = (steps) => (before ? [] : steps);
const desktop = (t, cx, cy) => [
  { state: true }, { probe: DENS }, { black: `${t}-clean` }, { shot: `shots/t10-${tag}-${t}-clean.png` },
  { shot: `shots/t10-${tag}-${t}-clean-crop.png`, clip: [t === "1920" ? 100 : 80, 240, 560, 320, 2] }, // one sector block, close
  { wheel: [cx, cy, 4] }, { probe: DENS }, { shot: `shots/t10-${tag}-${t}-clean-zoom.png` }, // one zoom step in: the tickers print
  { eval: "__mm.frameWhole && __mm.frameWhole()" }, { wait: 600 },
  { eval: "__mm.openArea('SEC_TECH')" }, { wait: 2200 }, { probe: DENS }, { black: `${t}-area-tech` }, { shot: `shots/t10-${tag}-${t}-area-tech.png` },
  ...t10([{ drag: [cx, cy, cx + 240, cy + 40] }, { probe: DENS }, { shot: `shots/t10-${tag}-${t}-area-tech-turned.png` }]),
  { key: "Escape" }, { wait: 800 },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2400 }, { state: true }, { probe: PITCH }, { probe: DENS }, { black: `${t}-podium-tech` }, { shot: `shots/t10-${tag}-${t}-podium-tech.png` },
  { eval: "__mm.orbitTo(22, 28)" }, { wait: 900 }, { probe: PITCH }, { shot: `shots/t10-${tag}-${t}-podium-side.png` },
  { eval: "__mm.orbitTo(22, 118)" }, { wait: 900 }, { probe: PITCH }, { shot: `shots/t10-${tag}-${t}-podium-turned.png` },
  { eval: "__mm.orbitTo(70, 28)" }, { wait: 900 }, { shot: `shots/t10-${tag}-${t}-podium-70.png` },
  ...t10([{ eval: "__mm.zoomStep && __mm.zoomStep(0)" }, { wait: 900 }, { probe: PITCH }, { shot: `shots/t10-${tag}-${t}-podium-step-crop.png`, clip: [cx - 280, cy - 200, 560, 400, 2] }]),
  ...t10([{ eval: "__mm.walk(true)" }, { wait: 1200 }, { probe: WALKST }, { shot: `shots/t10-${tag}-${t}-walk-01.png` }, { key: "End" }, { wait: 1000 }, { probe: WALKST }, { shot: `shots/t10-${tag}-${t}-walk-last.png` }, { key: "Escape" }, { wait: 900 }]),
  { key: "Escape" }, { wait: 800 },
  { eval: "__mm.openCoil('SEC_FIN')" }, { wait: 2400 }, { probe: PITCH }, { shot: `shots/t10-${tag}-${t}-podium-fin.png` }, { eval: "__mm.orbitTo(22, 28)" }, { wait: 900 }, { shot: `shots/t10-${tag}-${t}-podium-fin-side.png` }, { key: "Escape" }, { wait: 600 },
  { eval: "__mm.openList('LIST_LIKED')" }, { wait: 2400 }, { probe: PITCH }, { shot: `shots/t10-${tag}-${t}-podium-liked.png` }, { key: "Escape" }, { wait: 600 },
];
const phone = [
  { state: true }, { view: "canvas" }, { wait: 800 }, { probe: DENS }, { black: "390-clean" }, { shot: `shots/t10-${tag}-390-clean.png` },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2400 }, { probe: PITCH }, { black: "390-podium-tech" }, { shot: `shots/t10-${tag}-390-podium-tech.png` }, { key: "Escape" }, { wait: 600 },
];
const out = [];
out.push(run(1920, 1080, false, 1, "detail=clean&order=geiger", desktop("1920", 760, 560)));
out.push(run(1680, 1050, false, 2, "detail=clean&order=geiger", desktop("1680", 660, 540)));
out.push(run(390, 844, true, 1, "detail=clean&order=geiger", phone));
writeFileSync(`shots/t10-${tag}-proof.json`, JSON.stringify(out, null, 1));
for (const r of out) console.log(r.width, "@", r.dpr, "errors", JSON.stringify(r.page_errors).slice(0, 400), "steps", r.log.length);
for (const r of out) for (const x of r.log) {
  if (x.black) console.log(r.width, "BLACK", x.black, x.value && x.value.black_share);
  if (x.probe && x.value && "touching_pairs" in x.value) console.log(r.width, "DENS", x.value.area || "whole", "boxes", x.value.boxes, "w", JSON.stringify(x.value.box_w), "h", JSON.stringify(x.value.box_h), "gap", JSON.stringify(x.value.nearest_gap), "touching", x.value.touching_pairs, "/", x.value.touching_boxes, "dens", x.value.density_per_Mpx, "boxshare", x.value.box_area_share, "lab/lab", x.value.label_on_label, "lab/box", x.value.label_on_other_box, "tickers", x.value.ticker_labels);
  if (x.probe && x.value && "rule" in x.value) console.log(r.width, "PITCH", x.value.bar.slice(0, 22), "n", x.value.n, "H", x.value.params.H, "rule", JSON.stringify(x.value.rule && { above: x.value.rule.above.per_unit, below: x.value.rule.below.per_unit }), "mirror", JSON.stringify(x.value.mirror), "gap", JSON.stringify(x.value.gap_world), "domTickers", x.value.dom_ticker_labels, "stepLabels", JSON.stringify(x.value.step_labels), "el", JSON.stringify(x.value.elevation));
  if (x.probe && x.value && "walking" in x.value) console.log(r.width, "WALK", x.value.walking, "at", x.value.at, JSON.stringify(x.value.hudText), "el", JSON.stringify(x.value.elevation));
}
