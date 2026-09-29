/* N9 · the pullback playbook's LEADERS basket, point-in-time: each year's 20 largest S&P 500 members by full market
   cap on the last session of the year before (every member that day, not the 113 survivors with cap files), and their
   repaired daily closes. Second share classes are left out (GOOG, as the playbook did). → one JSON the playbook's
   run.mjs reads with --pit-leaders <file>. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadPit, capOn, atOrBefore, repairedBars } from "./pit-data.mjs";
import { CLASS_OF } from "./pit-leaders.mjs";

export function build() {
  const P = loadPit(), sessions = P.series("AAPL").dates, top = {}, capsAt = {};
  for (let y = 2007; y <= 2026; y++) {
    const d0 = sessions[atOrBefore(sessions, `${y - 1}-12-31`)];
    const at = P.members("SP500", d0).filter((s) => !(s in CLASS_OF)).map((s) => [s, capOn(P, s, d0)]).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).slice(0, 20);
    top[y] = at.map(([s]) => s); capsAt[y] = at.map(([s, c]) => [s, Math.round(c / 1e9)]);
  }
  const closes = {};
  for (const s of new Set(Object.values(top).flat())) { const S = P.series(s); if (!S) continue; const b = repairedBars(S); closes[s] = b.map((x, i) => [S.dates[i], x.o, x.h, x.l, x.c, x.v]); }
  return { kind: "point-in-time top 20 by full market cap on the last session of the prior year", top, capsAt, closes };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = build(), f = process.argv[2] ?? "pit-leaders-basket.json"; fs.writeFileSync(f, JSON.stringify(out));
  for (const y of [2007, 2008, 2012, 2020, 2026]) console.log(y, out.capsAt[y].map(([s, c]) => `${s}:${c}`).join(" "));
}
