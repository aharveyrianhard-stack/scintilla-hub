#!/usr/bin/env node
/* T14 (5 Oct 2026, night) · the pictures and the numbers behind the connected tree, headless (proof.mjs: headless Chrome, never a
   window, the chart API read live with the cross-origin check relaxed in that throwaway browser). At 1680 × 1050 (scale 2, Alan's
   MacBook): the market top level (the ring of indexes over the sectors, the outline on the left) · TECHNOLOGY opened · NVDA with
   its connections (hovered, so the lines and their labels are lit) · a cross-sector cohort link (AI HARDWARE ↔ AI POWER, lit).
   Writes shots/t14-*.png and shots/t14-proof.json.                       node proof-t14.mjs [base] [page] */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../..");
const base = process.argv[2] || "http://127.0.0.1:8767", page = process.argv[3] || "/deliverables/20261005/tree-connected-preview/index.html";
mkdirSync(join(HERE, "shots"), { recursive: true });
const U = JSON.parse(readFileSync(join(ROOT, "deliverables/20261002/served-set-v2/data/universe-and-lists.json"), "utf8"));
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: U.favorites, radar: U.radar }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(U.liked))}); } catch (e) {}`;
const run = (w, h, dpr, steps) => JSON.parse(execFileSync("node", [join(HERE, "proof.mjs"), `${base}${page}`, String(w), String(h), "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT }, maxBuffer: 256 << 20 }).toString());
const shot = (n) => ({ shot: join(HERE, "shots", `t14-${n}.png`) });
const FACTS = `({ pose: __mm.pose(), level: __mm.level(), printed: __mm.tickersPrinted(), overlaps: __mm.overlaps(), pitch: __mm.pitchPx(), links: __mm.links(), nav: __mm.nav(), crumbs: __mm.crumbs(), connErr: __mm.connErr, selected: __mm.selected })`;
const HOT = `[...document.querySelectorAll('.links .ln.hot')].length`;
const LABELS = `[...document.querySelectorAll('.links .lb.hot')].map((t) => t.textContent)`;
const steps = (w) => [
  { state: true }, { probe: FACTS }, { black: true }, shot(`market-top-${w}`),
  { hover: "SPY" }, { probe: HOT }, { probe: LABELS }, shot(`market-top-spy-hover-${w}`), { unhover: true }, { eval: "document.getElementById('tip').style.display='none'" },
  { eval: "__mm.openBlock('SEC_TECH')" }, { wait: 1400 }, { probe: FACTS }, shot(`technology-open-${w}`),
  { eval: "__mm.find('NVDA')" }, { wait: 1600 }, { probe: FACTS }, { hover: "NVDA" }, { probe: HOT }, { probe: LABELS }, { probe: "document.querySelector('#card').innerText" }, shot(`nvda-connections-${w}`), { unhover: true }, { eval: "document.getElementById('tip').style.display='none'" },
  { key: "Escape" }, { wait: 400 }, { eval: "__mm.cv.home(0)" }, { wait: 600 },
  { eval: "__mm.setLinksMode('all')" }, { wait: 300 }, { probe: FACTS }, { eval: "__mm.hotLink('COHORT_AI_HARDWARE','COHORT_AI_POWER')" }, { wait: 300 }, { probe: HOT }, { probe: LABELS }, shot(`cross-sector-link-${w}`),
  { eval: "__mm.cv.frameCohort('COHORT_AI_HARDWARE', 0)" }, { wait: 900 }, { eval: "__mm.hotLink('COHORT_AI_HARDWARE','COHORT_AI_POWER')" }, { wait: 300 }, { probe: FACTS }, { probe: HOT }, shot(`cohort-level-links-${w}`),
  { eval: "__mm.setLinksMode('top'); __mm.cv.home(0); __mm.setNav(false)" }, { wait: 700 }, { probe: FACTS }, shot(`market-top-no-outline-${w}`),
];
const out = {};
for (const [w, h, dpr] of [[1680, 1050, 2]]) {
  const o = run(w, h, dpr, steps(w));
  out[`${w}x${h}@${dpr}`] = { renderer: o.renderer, errors: o.page_errors, log: o.log };
  console.log(`${w}x${h}@${dpr}`, "renderer", o.renderer, "errors", JSON.stringify(o.page_errors).slice(0, 800));
  for (const x of o.log) { if (x.shot) console.log("  SHOT", x.shot.split("/").pop()); if (x.black) console.log("  BLACK", JSON.stringify(x.value)); if (x.hover) console.log("  HOVER", x.hover, String(x.tip).replace(/\n/g, " | ").slice(0, 160)); if (x.probe && x.probe.startsWith("({ pose")) console.log("  FACTS", JSON.stringify(x.value).slice(0, 420)); if (x.probe && (x.probe.startsWith("[...document") || x.probe.startsWith("document"))) console.log("  PROBE", JSON.stringify(x.value).slice(0, 300)); }
}
writeFileSync(join(HERE, "shots", "t14-proof.json"), JSON.stringify(out, null, 1));
