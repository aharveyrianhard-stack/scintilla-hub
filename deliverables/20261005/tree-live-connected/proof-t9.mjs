/* T9 (2 Oct, late night) · the headless walk for the podium you can turn freely and walk down — at 1920 × 1080 (scale 1),
   1680 × 1000 (scale 2) and 390 (phone). Runs proof.mjs per run (headless Chrome, SwiftShader, never a window) and writes
   shots/t9-<tag>-*.png and shots/t9-<tag>-proof.json. "before" runs the same measurements against T8's page (the steps that
   need T9's hooks are skipped there).   node proof-t9.mjs <base url> <tag: before|after>
   The Hub's list mirrors are planted as in T8: 30 served tickers as FAVORITES, 60 as LIKED (plant 60), 30 as RADAR (plant 30). */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:8767", tag = process.argv[3] || "after", before = tag === "before";
const url = (q) => `${base}/deliverables/20260929/tree-map/index.html?${q}`;
const T = JSON.parse(readFileSync("tree.json", "utf8"));
const served = T.nodes.filter((n) => n.kind === "name" && n.served && n.ticker).map((n) => n.ticker);
const FAVS = served.slice(0, 30), LIKED = served.slice(0, 60), RADAR = served.slice(100, 130);
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: FAVS, radar: RADAR }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(LIKED))}); } catch (e) {}`;
const run = (w, h, mobile, dpr, q, steps) => JSON.parse(execFileSync("node", ["proof.mjs", url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT }, maxBuffer: 64 << 20 }).toString());
// overlaps on the screen: label on label, label on another thing's box (T8's rule), box on box
const SIZES = `(()=>{const B=__mm.boxes?__mm.boxes():[];const L=__mm.labelsNow?__mm.labelsNow():[];const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;let ll=0,lb=0;for(let i=0;i<L.length;i++){for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))ll++;for(const b of B)if(b.id!==L[i].id&&hit(L[i],b))lb++}let bb=0;for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++)if(hit(B[i],B[j]))bb++;return {boxes:B.length,labels:L.length,label_on_label:ll,label_on_other_box:lb,box_on_box:bb,area:__mm.cluster||null}})()`;
// the staircase: the pitch rule above / below zero (T9's hook; T8: from the places, rounded), the gaps, the order
const PITCH = `(()=>{const P=__mm.coilPlaces();const R=P.filter(p=>p.v!=null);const G=__mm.stepGaps?__mm.stepGaps():null;const L=__mm.labelsNow?__mm.labelsNow():[];const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;let ll=0;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++)if(hit(L[i],L[j]))ll++;
return {mode:__mm.podiumMode(),n:P.length,read:R.length,rule:__mm.pitchRule?__mm.pitchRule():null,gap_world:G?{min:Math.min(...G),max:Math.max(...G),n:G.length,touching:G.filter(g=>g<=0.5).length}:null,vMono:R.every((p,i)=>!i||p.v<=R[i-1].v),treadMono:P.every((p,i)=>!i||p.tread<=P[i-1].tread+1e-6),first:R[0],last:R[R.length-1],lastAny:P[P.length-1],labels:__mm.labelsShown,label_on_label:ll,params:__mm.podiumParams(),count:__mm.clusterCount,limits:__mm.orbitLimits?__mm.orbitLimits():null,elevation:__mm.elevation?__mm.elevation():null,bar:document.getElementById("areabar").innerText.replace(/\\s+/g," ")}})()`;
const WALKST = `(()=>{const h=document.getElementById("walkhud");return {walking:__mm.walking?__mm.walking():null,at:__mm.walkAt==null?null:__mm.walkAt,hud:h?h.style.display:null,hudText:h?h.innerText.replace(/\\s+/g," ").trim():null,hudFont:h&&h.querySelector("b")?parseFloat(getComputedStyle(h.querySelector("b")).fontSize):null,elevation:__mm.elevation?__mm.elevation():null,pose:__mm.pose(),bar:document.getElementById("areabar").innerText.replace(/\\s+/g," "),limits:__mm.orbitLimits?__mm.orbitLimits():null,area:__mm.cluster||null}})()`;
const t9 = (steps) => (before ? [] : steps); // T9-only steps
const desktop = (t, cx, cy) => [
  { state: true }, { probe: SIZES }, { black: `${t}-clean` }, { shot: `shots/t9-${tag}-${t}-clean.png` },
  // Technology opened (OPEN 3D): black share, overlaps; T9: a RESET VIEW after a drag
  { eval: "__mm.openArea('SEC_TECH')" }, { wait: 2200 }, { probe: SIZES }, { black: `${t}-area-tech` }, { shot: `shots/t9-${tag}-${t}-area-tech.png` },
  ...t9([{ drag: [cx, cy, cx + 260, cy + 200] }, { probe: WALKST }, { dblclick: [cx, cy - 300] }]), { key: "Escape" }, { wait: 800 },
  // the Technology podium: the pitch rule, the orbit, a drag to the side and below the rim, pictures, reset
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2400 }, { state: true }, { probe: PITCH }, { probe: SIZES }, { black: `${t}-podium-tech` }, { shot: `shots/t9-${tag}-${t}-podium-tech.png` },
  ...t9([
    { drag: [cx, cy, cx, cy - 420] }, { probe: PITCH }, // drag up = the camera goes down toward the side
    { eval: "__mm.orbitTo(6, 28)" }, { wait: 900 }, { probe: PITCH }, { probe: SIZES }, { shot: `shots/t9-${tag}-${t}-podium-side.png` },
    { eval: "__mm.orbitTo(-16, 28)" }, { wait: 900 }, { probe: PITCH }, { shot: `shots/t9-${tag}-${t}-podium-below.png` },
    { dblclick: [cx, cy] }, { probe: PITCH },
    // the walk: WALK on, ↓ one step at a time (frames at step 1, 10 and the last), ↑ one back, the wheel, Esc leaves — the podium stays
    { eval: "__mm.walk(true)" }, { wait: 1200 }, { probe: WALKST }, { shot: `shots/t9-${tag}-${t}-walk-01.png` },
    { key: "ArrowDown" }, { wait: 300 }, { probe: WALKST }, { key: "j" }, { wait: 300 }, { probe: WALKST },
    ...Array.from({ length: 7 }, () => [{ key: "ArrowDown" }, { wait: 120 }]).flat(), { wait: 700 }, { probe: WALKST }, { shot: `shots/t9-${tag}-${t}-walk-10.png` },
    { key: "ArrowUp" }, { wait: 500 }, { probe: WALKST },
    { wheel: [cx, cy, 1] }, { wait: 500 }, { probe: WALKST }, // wheel up = a step up
    { key: "End" }, { wait: 1000 }, { probe: WALKST }, { shot: `shots/t9-${tag}-${t}-walk-last.png` },
    { key: "Escape" }, { wait: 1000 }, { probe: WALKST }, { probe: PITCH },
  ]),
  { key: "Escape" }, { wait: 800 },
  // Financials, ♥ LIKED (60), ◎ RADAR (30): the pitch rule and the pictures
  { eval: "__mm.openCoil('SEC_FIN')" }, { wait: 2400 }, { probe: PITCH }, { shot: `shots/t9-${tag}-${t}-podium-fin.png` }, { key: "Escape" }, { wait: 600 },
  { eval: "__mm.openList('LIST_LIKED')" }, { wait: 2400 }, { probe: PITCH }, { shot: `shots/t9-${tag}-${t}-podium-liked.png` }, ...t9([{ eval: "__mm.orbitTo(4, 28)" }, { wait: 900 }, { shot: `shots/t9-${tag}-${t}-podium-liked-side.png` }]), { key: "Escape" }, { wait: 600 },
  { eval: "__mm.openList('LIST_RADAR')" }, { wait: 2400 }, { probe: PITCH }, { shot: `shots/t9-${tag}-${t}-podium-radar.png` }, { key: "Escape" }, { wait: 600 },
];
const phone = [
  { state: true }, { view: "canvas" }, { wait: 800 }, { probe: SIZES },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2400 }, { probe: PITCH }, { shot: `shots/t9-${tag}-390-podium-tech.png` },
  ...t9([{ eval: "__mm.walk(true)" }, { wait: 1200 }, { probe: WALKST }, { shot: `shots/t9-${tag}-390-walk-01.png` }, { clickSel: "#walkhud [data-walk='1']" }, { probe: WALKST }, { clickSel: "#walkhud [data-walk='1']" }, { probe: WALKST }, { shot: `shots/t9-${tag}-390-walk-03.png` }, { clickSel: "#walkhud [data-walk='-1']" }, { probe: WALKST }, { key: "Escape" }, { wait: 900 }, { probe: WALKST }]),
  { key: "Escape" }, { wait: 600 },
];
const out = [];
out.push(run(1920, 1080, false, 1, "detail=clean&order=geiger", desktop("1920", 760, 560)));
out.push(run(1680, 1000, false, 2, "detail=clean&order=geiger", desktop("1680", 660, 520)));
out.push(run(390, 844, true, 1, "detail=clean&order=geiger", phone));
writeFileSync(`shots/t9-${tag}-proof.json`, JSON.stringify(out, null, 1));
for (const r of out) console.log(r.width, "@", r.dpr, "errors", JSON.stringify(r.page_errors).slice(0, 400), "steps", r.log.length);
for (const r of out) for (const x of r.log) {
  if (x.black) console.log(r.width, "BLACK", x.black, x.value && x.value.black_share);
  if (x.probe && x.value && "box_on_box" in x.value) console.log(r.width, "OVERLAPS", x.value.area || "whole", "lab/lab", x.value.label_on_label, "lab/box", x.value.label_on_other_box, "box/box", x.value.box_on_box, "labels", x.value.labels);
  if (x.probe && x.value && "rule" in x.value) console.log(r.width, "PITCH", x.value.bar.slice(0, 24), x.value.mode, "n", x.value.n, "H", x.value.params.H, "rule", JSON.stringify(x.value.rule && { above: x.value.rule.above.per_unit, below: x.value.rule.below.per_unit, cross: x.value.rule.crossing && x.value.rule.crossing.per_unit, none: x.value.rule.no_reading }), "gap", JSON.stringify(x.value.gap_world), "treadMono", x.value.treadMono, "lab/lab", x.value.label_on_label, "el", JSON.stringify(x.value.elevation), "limits", JSON.stringify(x.value.limits));
  if (x.probe && x.value && "walking" in x.value) console.log(r.width, "WALK", x.value.walking, "at", x.value.at, "hud", x.value.hud, JSON.stringify(x.value.hudText), "font", x.value.hudFont, "el", JSON.stringify(x.value.elevation), "bar", JSON.stringify(x.value.bar));
  if (x.drag) console.log(r.width, "DRAG", JSON.stringify(x.drag), "el", JSON.stringify(x.elevation));
  if (x.dblclick) console.log(r.width, "DBLCLICK", "pose", JSON.stringify(x.pose.p), "home", JSON.stringify(x.home && x.home.p), "el", JSON.stringify(x.elevation));
}
