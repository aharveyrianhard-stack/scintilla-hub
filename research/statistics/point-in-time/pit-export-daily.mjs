/* N9 · one file per member for the Python studies: repaired daily closes, the full market cap on each day (month-end
   cap carried by price), and whether the name was an S&P 500 member that day. → <PIT_ROOT>/daily/<SYM>.json */
import fs from "node:fs"; import path from "node:path";
import { loadPit, capOn, repairedBars } from "./pit-data.mjs";
import { everMembers, isMember } from "./pit-core.mjs";
import { PIT_ROOT } from "./build-universe.mjs";
const P = loadPit(), OUT = path.join(PIT_ROOT, "daily"); fs.mkdirSync(OUT, { recursive: true });
const IV = P.M.membership.SP500.intervals; let n = 0;
for (const sym of everMembers(IV, "2003-01-02")) {
  const S = P.series(sym); if (!S) continue;
  const b = repairedBars(S), mine = IV.filter((iv) => iv.sym === sym);
  const rows = b.map((x, i) => { const d = S.dates[i]; const cap = capOn(P, sym, d); const m = mine.some((iv) => (iv.from == null || iv.from <= d) && (iv.to == null || iv.to >= d)); return [d, +x.c.toPrecision(7), cap == null ? null : Math.round(cap / 1e6), m ? 1 : 0]; });
  fs.writeFileSync(path.join(OUT, sym + ".json"), JSON.stringify({ symbol: sym, cols: ["date", "c", "cap_m", "member"], rows })); n++;
}
console.log("exported", n);
