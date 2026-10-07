#!/usr/bin/env node
// RM1 — print the soak series of one or more runs as a table (and the growth per hour).
//   node series.mjs <run-dir> [<run-dir> ...] [--from 30]   slope fitted from minute --from onward
import fs from "node:fs";
const dirs = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && all[i - 1] === "--from"));
const FROM = Number((process.argv.indexOf("--from") !== -1 && process.argv[process.argv.indexOf("--from") + 1]) || 0);
const mb = (b) => b / 1048576;
export const COLS = [
  ["min", (s) => s.minute, 0], ["heapMB", (s) => mb(s.heap.used), 1], ["bkstMB", (s) => mb(s.heap.backingStores || 0), 1],
  ["nodes", (s) => s.domCounters.nodes, 0], ["attEl", (s) => s.totals.attachedElements, 0], ["detached", (s) => s.detached.nodes ?? NaN, 0],
  ["docs", (s) => s.domCounters.documents, 0], ["listeners", (s) => s.domCounters.jsEventListeners, 0],
  ["intervals", (s) => s.totals.intervalsActive, 0], ["timeouts", (s) => s.totals.timeoutsPending, 0],
  ["canvases", (s) => s.totals.canvasesLive, 0], ["canvMpx", (s) => s.totals.canvasPixels / 1e6, 1], ["canvDet", (s) => s.totals.canvasesDetached, 0],
  ["frames", (s) => s.totals.frames, 0], ["ws", (s) => s.net.wsOpen, 0], ["req/5m", (s) => s.net.requestsSinceLast, 0],
  ["rssMB", (s) => mb(s.process.rssTotal || 0), 0], ["rendMB", (s) => mb((s.process.rssByType || {}).renderer || 0), 0], ["gpuMB", (s) => mb((s.process.rssByType || {}).GPU || 0), 0],
  ["cpu s", (s) => s.perf.taskSeconds, 0]
];
export const slope = (xs, ys) => {       // least squares, per hour
  const n = xs.length; if (n < 2) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? (num / den) * 60 : NaN;
};
export const read = (dir) => fs.readFileSync(dir + "/samples.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
if (import.meta.url === "file://" + process.argv[1]) for (const dir of dirs) {
  const rows = read(dir);
  console.log("\n== " + dir + " (" + rows.length + " samples) ==");
  console.log(COLS.map(([n]) => n.padStart(9)).join(""));
  for (const s of rows) console.log(COLS.map(([, f, d]) => { const v = f(s); return (Number.isFinite(v) ? v.toFixed(d) : "-").padStart(9); }).join(""));
  const fit = rows.filter((s) => s.minute >= FROM - 0.01);
  if (fit.length >= 3) {
    console.log(COLS.map(([n, f, d]) => n === "min" ? "per hour".padStart(9) : (() => { const v = slope(fit.map((s) => s.minute), fit.map(f)); return (Number.isFinite(v) ? (v >= 0 ? "+" : "") + v.toFixed(d === 0 ? 0 : 1) : "-").padStart(9); })()).join(""), " (fit from minute " + FROM + ")");
  }
}
