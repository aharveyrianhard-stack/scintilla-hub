/* N9 · replay the Hub's Geiger (1d / 3d / 1w rungs, Alan's saved weights — sector-rotation lib's geigerHistory, the
   same call stats-3 used) over every S&P 500 member since 2003, from the point-in-time bars (jumps repaired).
   node research/statistics/point-in-time/pit-geiger-replay.mjs  → <PIT_ROOT>/geiger/<SYM>.json (same shape as stats-3) */
import fs from "node:fs"; import path from "node:path";
import { geigerHistory } from "../sector-rotation/lib.mjs";
import { cleanBars } from "../s9-research.mjs";
import { loadPit, repairedBars } from "./pit-data.mjs";
import { everMembers } from "./pit-core.mjs";
import { PIT_ROOT } from "./build-universe.mjs";

const P = loadPit(), OUT = path.join(PIT_ROOT, "geiger"); fs.mkdirSync(OUT, { recursive: true });
const syms = everMembers(P.M.membership.SP500.intervals, "2003-01-02");
let done = 0, empty = 0;
for (const sym of syms) {
  const o = path.join(OUT, sym + ".json"); if (fs.existsSync(o)) { done++; continue; }
  const S = P.series(sym);
  if (!S || S.c.length < 240) { fs.writeFileSync(o, JSON.stringify({ symbol: sym, n: S ? S.c.length : 0, rows: [] })); empty++; continue; }
  const { bars } = cleanBars(repairedBars(S));
  const nextT = bars.map((b, i) => (i + 1 < bars.length ? bars[i + 1].t : bars[i].t + 864e5));
  const g = geigerHistory(bars, nextT), rows = [];
  for (let i = 0; i < bars.length; i++) { const r = g[i]; if (!r) continue; rows.push([new Date(bars[i].t).toISOString().slice(0, 10), +r.g.toFixed(4), +r.tr.toFixed(4), r.mo == null ? null : +r.mo.toFixed(4), +r.d1.toFixed(4), r.d3 == null ? null : +r.d3.toFixed(4), r.w1 == null ? null : +r.w1.toFixed(4), r.full ? 1 : 0]); }
  fs.writeFileSync(o, JSON.stringify({ symbol: sym, n: bars.length, cols: ["date", "g", "tr", "mo", "d1", "d3", "w1", "full"], rows }));
  if (++done % 100 === 0) console.log("replayed", done, "of", syms.length);
}
console.log("DONE", done, "empty", empty, "of", syms.length);
