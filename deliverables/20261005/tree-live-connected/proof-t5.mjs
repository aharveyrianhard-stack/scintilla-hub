/* T5 (2 Oct) · the headless walk for the tree's CLEAN | DETAILED toggle, the marks, the order, the coil, the 3D chip and
   the names of things — at 1680 and 1400 (device scale 2, Alan's Retina) and 390 (phone, scale 1). Runs proof.mjs per
   run (headless Chrome, SwiftShader, never a window) and writes shots/t5-*.png and shots/t5-proof.json.
   node proof-t5.mjs <base url, e.g. http://127.0.0.1:8765> */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:8765";
const url = (q) => `${base}/deliverables/20260929/tree-map/index.html?${q}`;
const run = (w, h, mobile, dpr, q, steps) => JSON.parse(execFileSync("node", ["proof.mjs", url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr) }, maxBuffer: 64 << 20 }).toString());
const desktop = (tag) => [
  { state: true }, { labels: true }, { shot: `shots/t5-${tag}-clean.png` },
  { eval: "document.getElementById('legend').open = true" }, { wait: 300 }, { shot: `shots/t5-${tag}-clean-key.png` }, { eval: "document.getElementById('legend').open = false" },
  { hover: "SEC_TECH" }, { hover: "COHORT_AI_HARDWARE" }, { unhover: true },
  { clickSel: ".lb[data-id='SEC_TECH'] .lb3d" }, { state: true }, { labels: true }, { shot: `shots/t5-${tag}-area-tech.png` }, { crumbs: true }, { back: true },
  { eval: "__mm.setDetail('detailed')" }, { wait: 1200 }, { state: true }, { order: "US_SECTORS" }, { order: "SEC_TECH" }, { labels: true }, { shot: `shots/t5-${tag}-detailed.png` },
  { wheel: [700, 330, 7] }, { wait: 300 }, { labels: true }, { shot: `shots/t5-${tag}-detailed-zoom.png` },
  { eval: "__mm.setDetail('clean')" }, { wait: 1200 }, { eval: "__mm.frameWhole && 0" },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 1800 }, { state: true }, { labels: true }, { crumbs: true }, { shot: `shots/t5-${tag}-coil-tech.png` },
  { click: "NVDA" }, { hover: "NVDA" }, { crumbs: true }, { shot: `shots/t5-${tag}-coil-tech-picked.png` }, { unhover: true }, { eval: "__mm.closeArea()" }, { wait: 1000 },
  { eval: "__mm.openCoil('NOCOHORT_SEC_HLTH')" }, { wait: 1800 }, { state: true }, { shot: `shots/t5-${tag}-coil-hlth.png` }, { eval: "__mm.closeArea()" }, { wait: 1000 },
  { eval: "__mm.setOrder('size')" }, { wait: 1200 }, { state: true }, { order: "US_SECTORS" }, { shot: `shots/t5-${tag}-by-size.png` }, { eval: "__mm.setOrder('geiger')" }, { wait: 1200 },
  { find: "MSFT" }, { wait: 400 }, { shot: `shots/t5-${tag}-msft.png` }, { key: "Escape" },
  { view: "outline" }, { order: "US_SECTORS" }, { shot: `shots/t5-${tag}-outline.png` },
  { view: "3d" }, { state: true }, { shot: `shots/t5-${tag}-3d-whole.png` },
];
const phone = [
  { state: true }, { order: "US_SECTORS" }, { shot: "shots/t5-390-outline.png" },
  { view: "canvas" }, { state: true }, { labels: true }, { shot: "shots/t5-390-clean.png" },
  { eval: "__mm.openCoil('NOCOHORT_SEC_HLTH')" }, { wait: 1800 }, { state: true }, { shot: "shots/t5-390-coil-hlth.png" }, { eval: "__mm.closeArea()" }, { wait: 800 },
  { find: "MSFT" }, { wait: 400 }, { shot: "shots/t5-390-msft.png", full: true },
];
const out = [];
out.push(run(1680, 1000, false, 2, "detail=clean&order=geiger", desktop("1680")));
out.push(run(1400, 900, false, 2, "detail=clean&order=geiger", desktop("1400")));
out.push(run(390, 844, true, 1, "detail=clean&order=geiger", phone));
writeFileSync("shots/t5-proof.json", JSON.stringify(out, null, 1));
for (const r of out) console.log(r.width, "@", r.dpr, "errors", r.page_errors.length, "steps", r.log.length);
