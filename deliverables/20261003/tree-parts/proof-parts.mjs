#!/usr/bin/env node
/* T12 (3 Oct) · the measuring pass behind the parts gallery: one headless run at 1920 × 1080 (the Apple TV, scale 1) of the live tree
   page (release @9d2b1ca) with Alan's real lists planted in the Hub mirror (favorites 57, radar 17, liked 141 — the 2 Oct read,
   deliverables/20261002/served-set-v2/data/universe-and-lists.json). Runs the T9 harness (proof.mjs: headless Chrome, SwiftShader,
   never a window; the chart API read live with the cross-origin check relaxed in that throwaway browser). For every part it logs the
   real pixel sizes (boxes, labels, HUD, panels) and photographs every mode. Writes shots/parts-*.png and shots/parts-proof.json.
   node proof-parts.mjs [base url] [page path] */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../..");
const base = process.argv[2] || "http://127.0.0.1:8767", page = process.argv[3] || "/deliverables/20260929/tree-map/index.html";
const url = (q) => `${base}${page}?${q}`;
const U = JSON.parse(readFileSync(join(ROOT, "deliverables/20261002/served-set-v2/data/universe-and-lists.json"), "utf8"));
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: U.favorites, radar: U.radar }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(U.liked))}); localStorage.removeItem("tree.detail"); localStorage.removeItem("tree.order"); } catch (e) {}`;
const shot = (n) => ({ shot: join(HERE, "shots", `parts-${n}.png`) });
const run = (w, h, mobile, dpr, q, steps) => JSON.parse(execFileSync("node", [join(ROOT, "deliverables/20260929/tree-map/proof.mjs"), url(q), String(w), String(h), mobile ? "1" : "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT }, maxBuffer: 256 << 20 }).toString());
const cx = 960, cy = 560;
const RECT = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), display: cs.display, font: cs.fontSize, ls: cs.letterSpacing, color: cs.color, bg: cs.backgroundColor, text: (e.innerText || "").slice(0, 400) }; })()`;
const LABELS = `[...document.querySelectorAll('#labels .lb')].filter((e) => e.style.display !== 'none' && e.style.display !== '').map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { c: e.className, t: e.textContent.slice(0, 40), fs: cs.fontSize, fw: cs.fontWeight, ls: cs.letterSpacing, col: cs.color, x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })`;
const BOXES = `__mm.boxes ? __mm.boxes() : null`;
const FACTS = `({ sizes: __mm.sizes ? __mm.sizes() : null, counts: __mm.counts, stamp: document.getElementById('stamp').textContent, labelsShown: __mm.labelsShown, hidden: __mm.hidden ? __mm.hidden().length : null, shown: __mm.shownKinds ? __mm.shownKinds() : null, folds: __mm.folds ? __mm.folds() : null, pose: __mm.pose ? __mm.pose() : null, home: __mm.homeView ? __mm.homeView() : null, detail: __mm.detail, order: __mm.order, lists: __mm.lists ? __mm.lists() : null, bottomGap: __mm.bottomGap ? __mm.bottomGap() : null, sectorRows: __mm.sectorRows })`;
const RECTS = `({ header: ${RECT("header")}, h1: ${RECT("header h1")}, stamp: ${RECT("#stamp")}, q: ${RECT("#q")}, outlineBtn: ${RECT("#v-outline")}, canvasBtn: ${RECT("#v-canvas")}, detailSeg: ${RECT("#detail-seg")}, orderSeg: ${RECT("#order-seg")}, reset: ${RECT("#reset")}, graph: ${RECT("#graph")}, legend: ${RECT("#legend")}, legendSummary: ${RECT("#legend summary")}, hint: ${RECT("#hint")}, listbar: ${RECT("#listbar")}, listbarBtn: ${RECT("#listbar button")}, crumbs: ${RECT("#crumbs")}, scnav: ${RECT("#scnav, .scnav, [data-scnav]")}, scnavBack: ${RECT("[data-scnav] button, .scnav button")}, card: ${RECT("#card")}, areabar: ${RECT("#areabar")}, areabarBtn: ${RECT("#areabar button")}, walkhud: ${RECT("#walkhud")}, hudB: ${RECT("#walkhud b")}, hudV: ${RECT("#walkhud .v")}, hudRank: ${RECT("#walkhud .rank")}, hudBtn: ${RECT("#walkhud button")}, tip: ${RECT("#tip")} })`;
const CARD = `({ html: (document.getElementById('card') || {}).innerHTML || '', h2: ${RECT("#card h2")}, big: ${RECT("#card .big")}, kv: ${RECT("#card .kv")}, gb: ${RECT("#card .gb")}, table: ${RECT("#card table")}, td: ${RECT("#card td")}, row1: (document.querySelector('#card table tr') || {}).outerHTML || '' })`;
const OUTLINE = `({ rows: document.querySelectorAll('#outline .row').length, first: [...document.querySelectorAll('#outline .row')].slice(0, 6).map((e) => e.outerHTML), row: ${RECT("#outline .row")}, rowN: ${RECT("#outline .row.n")}, lab: ${RECT("#outline .row.n .lab")}, bar: ${RECT("#outline .row.n .gb")}, val: ${RECT("#outline .row.n .val")}, mylists: ${RECT("#mylists")}, counts: ${RECT("#counts")}, note: ${RECT("#outline .note")} })`;
const steps = [
  { state: true }, { probe: FACTS }, { probe: RECTS }, { probe: BOXES }, { probe: LABELS }, { black: true }, shot("01-clean-home"),
  { eval: "document.getElementById('legend').open = true" }, { wait: 700 }, { probe: RECT("#legend") }, shot("02-key-open"), { eval: "document.getElementById('legend').open = false" }, { wait: 500 },
  { find: "NVDA" }, { wait: 900 }, { probe: CARD }, { probe: RECTS }, { probe: BOXES }, { probe: LABELS }, shot("03-card-nvda"), { hover: "NVDA" }, { probe: RECT("#tip") }, shot("04-tip-nvda"), { unhover: true },
  { clickSel: "#reset" }, { wait: 1200 }, { probe: FACTS }, shot("05-whole-map-after-reset"),
  { wheel: [cx, cy, 1] }, { wait: 800 }, { probe: BOXES }, { probe: LABELS }, { probe: FACTS }, shot("06-zoom-1-notch"),
  { wheel: [cx, cy, 1] }, { wait: 800 }, { probe: BOXES }, { probe: LABELS }, { probe: FACTS }, shot("07-zoom-2-notches"),
  { wheel: [cx, cy, 2] }, { wait: 800 }, { probe: BOXES }, { probe: LABELS }, { probe: FACTS }, shot("08-zoom-4-notches"),
  { wheel: [cx, cy, 3] }, { wait: 800 }, { probe: BOXES }, { probe: LABELS }, { probe: FACTS }, shot("09-zoom-7-notches"),
  { pan: [400, 250] }, { wait: 600 }, shot("10-panned"),
  { clickSel: "#reset" }, { wait: 1200 },
  { eval: "__mm.setDetail('detailed')" }, { wait: 1800 }, { state: true }, { probe: FACTS }, { probe: BOXES }, { probe: LABELS }, { black: true }, shot("11-detailed-home"),
  { eval: "__mm.setOrder('size')" }, { wait: 1600 }, { probe: FACTS }, shot("12-detailed-by-size"), { eval: "__mm.setOrder('geiger')" }, { wait: 1200 },
  { eval: "__mm.setDetail('clean')" }, { wait: 1600 }, { eval: "__mm.setOrder('size')" }, { wait: 1600 }, shot("13-clean-by-size"), { eval: "__mm.setOrder('geiger')" }, { wait: 1200 },
  { view: "outline" }, { wait: 1200 }, { state: true }, { probe: OUTLINE }, { probe: RECTS }, shot("14-outline"),
  { eval: "__mm.toggle('US'); __mm.toggle('US_SECTORS'); __mm.toggle('SEC_TECH'); __mm.toggle('SMH'); __mm.toggle('COHORT_AI_ACCELERATORS')" }, { wait: 700 }, { find: "AI ACCELERATORS" }, { wait: 900 }, { probe: OUTLINE }, { probe: CARD }, shot("15-outline-cohort-open"),
];
const stepsB = [
  { state: true },
  { eval: "__mm.openArea('SEC_TECH')" }, { wait: 2600 }, { state: true }, { probe: FACTS }, { probe: RECTS }, { probe: BOXES }, { probe: LABELS }, { black: true }, shot("16-open-3d-technology"),
  { clickSel: "#areabar [data-go='back']" }, { wait: 1500 },
  { eval: "__mm.openArea('COHORT_AI_ACCELERATORS')" }, { wait: 2400 }, { state: true }, { probe: BOXES }, { probe: LABELS }, shot("17-open-3d-cohort-ai-accelerators"),
  { clickSel: "#areabar [data-go='back']" }, { wait: 1500 },
  { eval: "__mm.openCoil('SEC_TECH')" }, { wait: 2800 }, { state: true }, { probe: FACTS }, { probe: RECTS }, { probe: LABELS }, { probe: "({ params: __mm.podiumParams ? __mm.podiumParams() : null, pitch: __mm.pitchRule ? __mm.pitchRule() : null, places: __mm.coilPlaces ? __mm.coilPlaces().slice(0, 12) : null, count: __mm.clusterCount, gaps: __mm.stepGaps ? __mm.stepGaps().slice(0, 10) : null })" }, { black: true }, shot("18-podium-3d-technology"),
  { clickSel: "#areabar [data-go='above']" }, { wait: 1800 }, { probe: FACTS }, shot("19-podium-from-above"), { clickSel: "#areabar [data-go='3d']" }, { wait: 1800 },
  { clickSel: "#areabar [data-go='walk']" }, { wait: 1600 }, { probe: RECTS }, { probe: "({ hud: (document.getElementById('walkhud') || {}).innerHTML || '', pose: __mm.pose ? __mm.pose() : null, at: __mm.walkAt })" }, shot("20-walk-hud-step1"), { key: "ArrowDown" }, { key: "ArrowDown" }, { key: "ArrowDown" }, { wait: 900 }, { probe: RECTS }, shot("21-walk-step4"),
  { key: "Escape" }, { wait: 1200 },
  { clickSel: "#areabar [data-go='list']" }, { wait: 1000 }, { probe: CARD }, shot("22-podium-list-on-card"),
  { key: "Escape" }, { wait: 1200 },
  { eval: "__mm.openCoil('COHORT_AI_ACCELERATORS')" }, { wait: 2600 }, { state: true }, { probe: "({ params: __mm.podiumParams ? __mm.podiumParams() : null, pitch: __mm.pitchRule ? __mm.pitchRule() : null, places: __mm.coilPlaces ? __mm.coilPlaces() : null, count: __mm.clusterCount })" }, { probe: LABELS }, { black: true }, shot("23-podium-cohort-ai-accelerators"),
  { key: "Escape" }, { wait: 1200 },
  { clickSel: "#listbar [data-list='LIST_FAVORITES']" }, { wait: 2800 }, { state: true }, { probe: RECTS }, { probe: "({ listbar: (document.getElementById('listbar') || {}).innerHTML || '', count: __mm.clusterCount })" }, shot("24-my-lists-favorites-podium"),
  { eval: "__mm.select('MU')" }, { wait: 900 }, { probe: CARD }, shot("25-podium-step-card"),
  { eval: "__mm.showOnTree('MU')" }, { wait: 2400 }, { state: true }, shot("26-show-on-the-tree"),
  { key: "Escape" }, { wait: 900 },
  { clickSel: "#listbar [data-list='LIST_RADAR']" }, { wait: 2600 }, { state: true }, shot("27-my-lists-radar-podium"), { key: "Escape" }, { wait: 900 },
  { view: "3d" }, { wait: 2200 }, { state: true }, { probe: FACTS }, { black: true }, shot("28-whole-map-3d"),
  { eval: "__mm.setFlat(true)" }, { wait: 1400 }, { probe: FACTS }, shot("29-flat-2d"),
  { view: "canvas" }, { wait: 1800 }, { clickSel: "#reset" }, { wait: 1200 }, { state: true }, { probe: FACTS }, shot("30-whole-map"),
];
const outs = [];
for (const [name, st] of [["A", steps], ["B", stepsB]]) {
  try { const o = run(1920, 1080, false, 1, "", st); outs.push(o); writeFileSync(join(HERE, "shots", `parts-proof-${name}.json`), JSON.stringify(o, null, 1)); }
  catch (e) { console.error("HARNESS FAILED in run", name, ":", (e.stderr || "").toString().slice(-3000)); }
}
const out = { renderer: outs[0] && outs[0].renderer, page_errors: outs.flatMap((o) => o.page_errors || []), log: outs.flatMap((o) => o.log || []) };
writeFileSync(join(HERE, "shots", "parts-proof.json"), JSON.stringify(out, null, 1));
console.log("renderer", out.renderer, "errors", JSON.stringify(out.page_errors).slice(0, 800));
for (const x of out.log) { if (x.shot) console.log("SHOT", x.shot.split("/").pop(), "view", x.state && x.state.view, "area", x.state && x.state.area, "detail", x.state && x.state.detail, "labels", x.state && x.state.labels); if (x.clickSel) console.log("CLICK", x.clickSel, "found", x.found); if (x.black) console.log("BLACK", JSON.stringify(x.black).slice(0, 200)); }
