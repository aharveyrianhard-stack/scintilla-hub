#!/usr/bin/env node
/* T15 (5 Oct 2026, night) · the pictures, side by side: the LIVE tree tab and this copy with the connections, the SAME walk at
   1680 × 1050 (scale 2, Alan's MacBook), headless Chrome with software WebGL (SwiftShader) — never a window. If WebGL did not
   render, the renderer string says so and the run stops with an error (no 2D fallback picture is ever taken).
   Four moments on both pages: home (the whole canvas) · SPY's line to TECHNOLOGY hovered (connected only has a number) ·
   NVDA clicked · AI HARDWARE clicked. The camera pose and the screen place of five nodes are read at every moment on both
   pages: they must match, so "same camera, same layout" is a number, not a claim.
   Writes shots/t15-live-*.png, shots/t15-connected-*.png and shots/t15-proof.json.         node proof-t15.mjs [base] */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:8768";
mkdirSync(join(HERE, "shots"), { recursive: true });
const PAGES = { live: "/deliverables/20260929/tree-map/index.html", connected: "/deliverables/20261005/tree-live-connected/index.html" };
const Q = "?detail=clean&order=geiger";
const run = (page, steps) => JSON.parse(execFileSync("node", [join(HERE, "proof.mjs"), `${base}${page}${Q}`, "1680", "1050", "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: "2" }, maxBuffer: 256 << 20 }).toString());
const shot = (tag, n) => ({ shot: join(HERE, "shots", `t15-${tag}-${n}.png`) });
const WHERE = `({ pose: __mm.pose(), at: Object.fromEntries(["MARKET","SEC_TECH","SEC_UTIL","SPY","NVDA"].map((id) => [id, __mm.screenOf(id).map(Math.round)])), labels: __mm.labelsShown, detail: __mm.detail, selected: __mm.selected })`;
const LINKS = `(window.__mm.ext ? __mm.ext.links() : null)`;
const HIDE_TIP = "document.getElementById('tip').style.display='none'";
const steps = (tag) => [
  { state: true }, { probe: WHERE }, { probe: LINKS }, { black: true }, shot(tag, "home"),
  { probe: `(window.__mm.ext ? __mm.ext.hoverAt("SPY","SEC_TECH") : null)` }, shot(tag, "spy-tech-hover"), { eval: HIDE_TIP },
  { eval: "__mm.select('NVDA')" }, { wait: 1400 }, { probe: WHERE }, { probe: LINKS }, { probe: "(document.getElementById('conn-card')||{}).innerText||null" }, shot(tag, "nvda"),
  { eval: "__mm.select('COHORT_AI_HARDWARE')" }, { wait: 1400 }, { probe: WHERE }, { probe: LINKS }, { probe: "(document.getElementById('conn-card')||{}).innerText||null" }, shot(tag, "ai-hardware"),
  { key: "Escape" }, { wait: 900 }, { eval: "window.__mm.ext && __mm.ext.setOn(false)" }, { wait: 500 }, { probe: LINKS }, shot(tag, "home-connections-off"),
  { probe: `[...document.querySelectorAll('header .ctrl button')].map((b) => b.textContent)` },
];
const out = {};
for (const [tag, page] of Object.entries(PAGES)) {
  const o = run(page, steps(tag));
  if (!/ANGLE|SwiftShader|Metal|OpenGL|WebGL/i.test(String(o.renderer)) || /unavailable|no canvas/i.test(String(o.renderer))) { console.error(`${tag}: WebGL did not render (${o.renderer}) — stopping, no fallback picture`); process.exit(2); }
  out[tag] = { renderer: o.renderer, errors: o.page_errors, log: o.log };
  console.log(tag, "renderer:", o.renderer, "· page errors:", o.page_errors.length);
  for (const x of o.log) { if (x.shot) console.log("  SHOT", x.shot.split("/").pop(), "labels", x.state && x.state.labels); if (x.black) console.log("  BLACK", JSON.stringify(x.value)); if (x.probe) console.log("  PROBE", x.probe.slice(0, 40).replace(/\s+/g, " "), "→", JSON.stringify(x.value).slice(0, 260)); }
}
// same camera, same layout: every WHERE probe on the live page equals the connected page's
const wheres = (t) => out[t].log.filter((x) => x.probe === WHERE).map((x) => x.value);
const L = wheres("live"), Cn = wheres("connected"); const same = L.map((w, i) => JSON.stringify(w.pose) === JSON.stringify(Cn[i].pose) && JSON.stringify(w.at) === JSON.stringify(Cn[i].at));
out.same_camera_same_layout = { moments: same.length, equal: same.every(Boolean), per_moment: same, live: L, connected: Cn };
console.log("same camera, same layout at every moment:", same);
writeFileSync(join(HERE, "shots", "t15-proof.json"), JSON.stringify(out, null, 1));
