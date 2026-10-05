#!/usr/bin/env node
/* T13 · fps, headless through ANGLE Metal (never a window): the canvas (a 2 s pan + zoom at home) and the podium (V3's 4 s turn of
   AI ACCELERATORS with its sphere), at 1920 × 1080 @1 and 1680 × 1050 @2. Writes shots/t13-fps.json.   node fps.mjs */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../..");
const U = JSON.parse(readFileSync(join(ROOT, "deliverables/20261002/served-set-v2/data/universe-and-lists.json"), "utf8"));
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: U.favorites, radar: U.radar }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(U.liked))}); } catch (e) {}`;
const steps = [
  { eval: "window.__f1 = null; __mm.measureFps(2000, \"pan\").then((r) => { window.__f1 = r; })" }, { wait: 2600 }, { probe: "window.__f1" }, { eval: "window.__f0 = null; __mm.measureFps(2000, \"zoom\").then((r) => { window.__f0 = r; })" }, { wait: 2600 }, { probe: "window.__f0" },
  { eval: "__mm.openCoil('COHORT_AI_ACCELERATORS')" }, { wait: 3000 }, { eval: "window.__f2 = null; __mm.measureFps(4000).then((r) => { window.__f2 = r; })" }, { wait: 4800 }, { probe: "window.__f2" },
  { eval: "__mm.closeCoil(); __mm.openList('LIST_LIKED')" }, { wait: 3200 }, { eval: "window.__f3 = null; __mm.measureFps(4000).then((r) => { window.__f3 = r; })" }, { wait: 4800 }, { probe: "window.__f3" },
];
const out = {};
for (const [w, h, dpr] of [[1920, 1080, 1], [1680, 1050, 2]]) {
  const o = JSON.parse(execFileSync("node", [join(ROOT, "deliverables/20260929/tree-map/proof.mjs"), "http://127.0.0.1:8767/deliverables/20260929/tree-map/index.html", String(w), String(h), "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT, MM_GL: "metal" }, maxBuffer: 64 << 20 }).toString());
  const vals = o.log.filter((x) => x.probe).map((x) => x.value);
  out[`${w}x${h}@${dpr}`] = { renderer: o.renderer, errors: o.page_errors, canvas_pan: vals[0], canvas_zoom: vals[1], podium_ai_accelerators_18: vals[2], podium_liked_141: vals[3] };
  console.log(`${w}x${h}@${dpr}`, JSON.stringify(out[`${w}x${h}@${dpr}`]));
}
writeFileSync(join(HERE, "shots", "t13-fps.json"), JSON.stringify(out, null, 1));
