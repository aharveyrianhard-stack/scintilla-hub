#!/usr/bin/env node
/* T16 (6 Oct 2026) · the pictures, side by side: the LIVE tree (deliverables/20260929/tree-map) and this design preview, the same
   walk, headless Chrome with software WebGL (SwiftShader) — never a window — at 1680 × 1050 (scale 2, Alan's MacBook), 1440 × 900
   (a Safari window / the side browser) and 390 × 844 (a phone). If WebGL did not render the run stops: no 2D fallback picture.
   Moments: HOME (the whole canvas) · TECHNOLOGY zoomed on the canvas · TECHNOLOGY opened (OPEN 3D) · one cohort coil expanded (AI
   HARDWARE's numbered list) · NVDA's card. Facts read at every moment: the view, page errors, labels printed, label overlaps (any
   two printed labels whose rectangles cross = a failure), the Geiger scale, the coils drawn, the list's rows and place, every "?"
   printed on the page (must be none). Writes shots/t16-<page>-<width>-<moment>.png and shots/t16-proof.json.
   node proof-t16.mjs [base]                                                              (serve the repo root first) */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:8768";
mkdirSync(join(HERE, "shots"), { recursive: true });
const ALL = { live: "/deliverables/20260929/tree-map/index.html", t16: "/deliverables/20261006/tree-design-preview/index.html" };
const PAGES = process.env.ONLY ? { [process.env.ONLY]: ALL[process.env.ONLY] } : ALL; // ONLY=t16 reruns one page
const SIZES = [[1680, 1050, 0], [1440, 900, 0], [390, 844, 1]];
const Q = "?detail=clean&order=geiger";
const run = (page, w, h, mobile, steps) => JSON.parse(execFileSync("node", [join(HERE, "proof.mjs"), `${base}${page}${Q}`, String(w), String(h), String(mobile), JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: "2" }, maxBuffer: 256 << 20 }).toString());
const shot = (tag, w, n) => ({ shot: join(HERE, "shots", `t16-${tag}-${w}-${n}.png`) });
const FACTS = `({ view: __mm.view, labels: __mm.labelsShown, selected: __mm.selected, area: __mm.cluster || null, coils: __mm.coils ? __mm.coils().length : null, scale: __mm.scale ? __mm.scale() : null,
  list: __mm.listOpen ? { open: __mm.listOpen(), rows: (__mm.listRows() || []).length, first: (__mm.listRows() || [])[0] || null, rect: __mm.listRect() } : null,
  overlaps: (() => { const L = __mm.labelsNow ? __mm.labelsNow() : []; const out = []; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) out.push([a.id, b.id]); } return out; })(),
  question_marks: (() => { const out = []; const walk = (el) => { for (const c of el.childNodes) { if (c.nodeType === 3 && /\\?/.test(c.nodeValue) && !c.nodeValue.includes("?detail")) { const p = c.parentElement; if (p && p.closest("#labels, #outline, #card, #legend, #areabar, #tip, .coillist")) out.push(c.nodeValue.trim().slice(0, 60)); } else if (c.nodeType === 1 && getComputedStyle(c).display !== "none") walk(c); } }; walk(document.body); return out; })(),
  marks: (() => { const B = __mm.boxes ? __mm.boxes() : []; const big = B.filter((b) => b.kind !== "cohort").map((b) => b.w); return { boxes: B.length, box_px_max: big.length ? +Math.max(...big).toFixed(1) : null, box_px_min: big.length ? +Math.min(...big).toFixed(1) : null }; })() })`;
const steps = (tag, w) => [
  { state: true }, { probe: FACTS }, shot(tag, w, "home"),
  { eval: "__mm.select('SEC_TECH')" }, { wait: 1400 }, { probe: FACTS }, shot(tag, w, "technology-zoom"),
  { eval: "__mm.openCoilList && __mm.openCoilList('COHORT_AI_HARDWARE')" }, { wait: 700 }, { probe: FACTS }, shot(tag, w, "coil-expanded"),
  { key: "Escape" }, { wait: 500 }, { eval: "__mm.release()" }, { wait: 900 },
  { area: "SEC_TECH" }, { wait: 600 }, { probe: FACTS }, shot(tag, w, "technology-open3d"),
  { key: "Escape" }, { wait: 1200 },
  { eval: "__mm.select('NVDA')" }, { wait: 1400 }, { probe: FACTS }, shot(tag, w, "nvda-card"),
  { probe: `[...document.querySelectorAll('header .ctrl button')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.textContent)` },
];
const OUT = join(HERE, "shots", "t16-proof.json");
const out = process.env.ONLY && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {}; // ONLY= reruns one page and keeps the other page's facts
for (const [tag, page] of Object.entries(PAGES)) for (const [w, h, mobile] of SIZES) {
  const o = run(page, w, h, mobile, steps(tag, w));
  if (!/ANGLE|SwiftShader|Metal|OpenGL|WebGL/i.test(String(o.renderer)) || /unavailable|no canvas/i.test(String(o.renderer))) { console.error(`${tag} ${w}: WebGL did not render (${o.renderer}) — stopping`); process.exit(2); }
  out[`${tag}-${w}`] = { renderer: o.renderer, errors: o.page_errors, log: o.log };
  console.log(`${tag} ${w}×${h} · renderer ${o.renderer.slice(0, 40)} · page errors ${o.page_errors.length}`);
  for (const x of o.log) { if (x.probe === FACTS) { const v = x.value; console.log(`  ${v.view} · labels ${v.labels} · overlaps ${v.overlaps.length} · coils ${v.coils} · list ${v.list ? v.list.open + " " + v.list.rows : "-"} · ? ${v.question_marks.length} · boxes ${v.marks.boxes} (${v.marks.box_px_min}–${v.marks.box_px_max} px) · sel ${v.selected} · area ${v.area}`); if (v.overlaps.length) console.log("   OVERLAPS", JSON.stringify(v.overlaps.slice(0, 6))); if (v.question_marks.length) console.log("   ?", JSON.stringify(v.question_marks.slice(0, 5))); } else if (x.probe) console.log("  buttons", JSON.stringify(x.value)); }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
