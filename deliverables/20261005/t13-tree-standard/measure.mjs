#!/usr/bin/env node
/* T13 (5 Oct 2026) · the one ruler for before and after: T12's measuring pass (proof-parts.mjs) cut down to the numbers the
   brief asks for — how many of the 613 tickers print at the home view, the black share of the canvas, the box sizes against
   the pitch — at 1920 × 1080 (scale 1) and 1680 × 1050 (scale 2), with Alan's real lists planted in the Hub mirror. Runs the
   T9 harness (deliverables/20260929/tree-map/proof.mjs: headless Chrome, SwiftShader, never a window; the chart API read live
   with the cross-origin check relaxed in that throwaway browser). Writes shots/<tag>-*.png and shots/<tag>-measure.json.
   node measure.mjs <tag> [page path] [base url] */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../..");
const tag = process.argv[2] || "after", page = process.argv[3] || "/deliverables/20260929/tree-map/index.html", base = process.argv[4] || "http://127.0.0.1:8767";
mkdirSync(join(HERE, "shots"), { recursive: true });
const U = JSON.parse(readFileSync(join(ROOT, "deliverables/20261002/served-set-v2/data/universe-and-lists.json"), "utf8"));
const INIT = `try { localStorage.setItem("sc_lists", ${JSON.stringify(JSON.stringify({ favorites: U.favorites, radar: U.radar }))}); localStorage.setItem("sc_fav", ${JSON.stringify(JSON.stringify(U.liked))}); localStorage.removeItem("tree.detail"); localStorage.removeItem("tree.order"); } catch (e) {}`;
const run = (w, h, dpr, q, steps) => JSON.parse(execFileSync("node", [join(ROOT, "deliverables/20260929/tree-map/proof.mjs"), `${base}${page}${q ? "?" + q : ""}`, String(w), String(h), "0", JSON.stringify(steps)], { env: { ...process.env, PROOF_DPR: String(dpr), PROOF_INIT: INIT }, maxBuffer: 256 << 20 }).toString());
const LABELS = `[...document.querySelectorAll('#labels .lb')].filter((e) => e.style.display !== 'none' && e.style.display !== '').map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { c: e.className, t: e.textContent.slice(0, 40), fs: cs.fontSize, x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })`;
const FACTS = `({ sizes: __mm.sizes ? __mm.sizes() : null, counts: __mm.counts, stamp: document.getElementById('stamp').textContent, labelsShown: __mm.labelsShown, detail: __mm.detail, pose: __mm.pose ? __mm.pose() : null, pitch: __mm.pitchPx ? __mm.pitchPx() : null, boxes: __mm.boxes ? __mm.boxes() : null, tickers: __mm.tickersPrinted ? __mm.tickersPrinted() : null, fps: __mm.fpsNow ? __mm.fpsNow() : null })`;
const shot = (n) => ({ shot: join(HERE, "shots", `${tag}-${n}.png`) });
const home = (w) => [{ state: true }, { probe: FACTS }, { probe: LABELS }, { black: true }, shot(`home-${w}`)];
const out = {};
for (const [w, h, dpr] of [[1920, 1080, 1], [1680, 1050, 2]]) {
  const o = run(w, h, dpr, "", home(w));
  const facts = o.log.find((x) => x.probe && x.probe.startsWith("({ sizes")), labels = o.log.find((x) => x.probe && x.probe.startsWith("[...document")), black = o.log.find((x) => x.black);
  const F = facts.value, L = labels.value, boxes = F.boxes || [];
  const onbox = L.filter((l) => /\bonbox\b/.test(l.c) && /\bn\b|\bf\b/.test(l.c));
  const tickerBoxes = boxes.filter((b) => b.kind === "name" || b.kind === "fund");
  const printed = F.tickers != null ? F.tickers : onbox.length;
  out[`${w}x${h}@${dpr}`] = { renderer: o.renderer, errors: o.page_errors, stamp: F.stamp, canvas: F.sizes, boxes: tickerBoxes.length, names: boxes.filter((b) => b.kind === "name").length, funds: boxes.filter((b) => b.kind === "fund").length, tickers_printed: printed, labels_shown: F.labelsShown, box_px: tickerBoxes[0] ? { w: tickerBoxes[0].w, h: tickerBoxes[0].h } : null, pitch: F.pitch, black_share: black.value.black_share, fps: F.fps, pose: F.pose };
  console.log(`${w}x${h}@${dpr}`, JSON.stringify(out[`${w}x${h}@${dpr}`]));
}
writeFileSync(join(HERE, "shots", `${tag}-measure.json`), JSON.stringify(out, null, 1));
