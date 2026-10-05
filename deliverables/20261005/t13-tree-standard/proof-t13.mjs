#!/usr/bin/env node
/* T13 (5 Oct 2026) · the pictures and the numbers behind T13-TREE.html, headless (the T9 harness: proof.mjs — headless Chrome, never a
   window; MM_GL=metal asks for the Mac's GPU through ANGLE for the fps runs, still headless). At 1920 × 1080 (scale 1) and 1680 × 1050
   (scale 2): home · one sector open (TECHNOLOGY at the INDUSTRY level) · one cohort as the 3D bow tie with its sphere (AI ACCELERATORS)
   · the walk (three steps down) · ★ FAVORITES as a bow tie; fps on the canvas (a 2 s pan + zoom) and in the podium (a 4 s turn).
   Alan's real lists are planted in the Hub mirror. Writes shots/t13-*.png and shots/t13-proof.json.   node proof-t13.mjs [base] [page] */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../..");
const base = process.argv[2] || "http://127.0.0.1:8767", page = process.argv[3] || "/deliverables/20260929/tree-map/index.html";
mkdirSync(join(HERE, "shots"), { recursive: true });
const U = JSON.parse(readFileSync(join(ROOT, "deliverables/20261002/served-set-v2/data/universe-and-lists.json"), "utf8"));
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: U.favorites, radar: U.radar }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(U.liked))}); } catch (e) {}`;
const run = (w, h, dpr, steps, env = {}) => JSON.parse(execFileSync("node", [join(ROOT, "deliverables/20260929/tree-map/proof.mjs"), `${base}${page}`, String(w), String(h), "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT, ...env }, maxBuffer: 256 << 20 }).toString());
const shot = (n) => ({ shot: join(HERE, "shots", `t13-${n}.png`) });
const FACTS = `({ pose: __mm.pose(), level: __mm.level ? __mm.level() : null, pitch: __mm.pitchPx ? __mm.pitchPx() : null, printed: __mm.tickersPrinted ? __mm.tickersPrinted() : null, overlaps: __mm.overlaps ? __mm.overlaps() : null, crumbs: __mm.crumbs ? __mm.crumbs() : null, cluster: __mm.cluster, count: __mm.clusterCount, lpx: __mm.labelPx ? __mm.labelPx() : null })`;
const COIL = `(() => { const c = __mm.coilApi && __mm.coilApi(); if (!c) return null; return { sets: c.sets(), capScale: c.capScale(), spheres: c.spherePx(), labels: c.labelCheck(), elevation: c.elevation(), fill: c.fill(), walking: c.walking(), walkAt: c.walkAt(), walkParams: c.walkParams(), pose: c.pose(), mode: c.mode(), boxes: c.boxes(), capMode: c.capMode() }; })()`;
const steps = (w) => [
  { state: true }, { probe: FACTS }, { black: true }, shot(`home-${w}`),
  { eval: "__mm.find('NVDA')" }, { wait: 1200 }, { probe: FACTS }, shot(`find-nvda-${w}`),
  { eval: "__mm.release(); __mm.cv.home(0)" }, { wait: 400 },
  { eval: "__mm.openBlock('SEC_TECH')" }, { wait: 1400 }, { probe: FACTS }, { black: true }, shot(`sector-open-technology-${w}`),
  { eval: "__mm.zoomTo(2.8, 0)" }, { wait: 900 }, { probe: FACTS }, shot(`cohort-level-${w}`),
  { eval: "__mm.zoomTo(4.5, 0)" }, { wait: 900 }, { probe: FACTS }, shot(`instrument-level-${w}`),
  { eval: "__mm.zoomTo(0.6, 0)" }, { wait: 900 }, { probe: FACTS }, shot(`zoomed-out-${w}`),
  { eval: "__mm.cv.home(0)" }, { wait: 500 },
  { probe: "__mm.measureFps(2000)" },
  { eval: "__mm.openCoil('COHORT_AI_ACCELERATORS')" }, { wait: 3200 }, { state: true }, { probe: FACTS }, { probe: COIL }, { black: true }, shot(`cohort-bowtie-ai-accelerators-${w}`),
  { eval: "__mm.setWalk(true)" }, { wait: 1400 }, { probe: FACTS }, { probe: COIL }, shot(`walk-step1-${w}`),
  { key: "ArrowDown" }, { key: "ArrowDown" }, { key: "ArrowDown" }, { wait: 900 }, { probe: FACTS }, { probe: COIL }, shot(`walk-step4-${w}`),
  { eval: "__mm.coilApi().walkTo(__mm.coilApi().walkOrder().filter((s) => s.side > 0).length + 2)" }, { wait: 1000 }, { probe: COIL }, shot(`walk-red-half-${w}`),
  { key: "Escape" }, { wait: 1200 }, { probe: COIL },
  { eval: "__mm.select('NVDA')" }, { wait: 600 }, shot(`podium-card-${w}`),
  { probe: "__mm.measureFps(4000)" },
  { key: "Escape" }, { wait: 1000 }, { state: true },
  { eval: "__mm.openList('LIST_FAVORITES')" }, { wait: 3200 }, { probe: FACTS }, { probe: COIL }, shot(`favorites-bowtie-${w}`),
  { key: "Escape" }, { wait: 800 },
  { eval: "__mm.setView('outline')" }, { wait: 1000 }, shot(`outline-${w}`),
];
const out = {};
for (const [w, h, dpr] of [[1920, 1080, 1], [1680, 1050, 2]]) {
  const o = run(w, h, dpr, steps(w), { MM_GL: process.env.MM_GL || "metal" });
  out[`${w}x${h}@${dpr}`] = { renderer: o.renderer, errors: o.page_errors, log: o.log };
  console.log(`${w}x${h}@${dpr}`, "renderer", o.renderer, "errors", JSON.stringify(o.page_errors).slice(0, 600));
  for (const x of o.log) { if (x.shot) console.log("  SHOT", x.shot.split("/").pop()); if (x.black) console.log("  BLACK", x.black === true ? "" : x.black, JSON.stringify(x.value)); if (x.probe && x.probe.startsWith("__mm.measureFps")) console.log("  FPS", JSON.stringify(x.value)); if (x.probe && x.probe.startsWith("({ pose")) console.log("  FACTS", JSON.stringify(x.value).slice(0, 300)); if (x.probe && x.probe.startsWith("(() => { const c")) console.log("  COIL", JSON.stringify(x.value).slice(0, 500)); }
}
writeFileSync(join(HERE, "shots", "t13-proof.json"), JSON.stringify(out, null, 1));
