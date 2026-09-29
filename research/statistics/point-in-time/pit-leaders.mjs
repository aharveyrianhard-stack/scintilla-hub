/* N9 · LEADERS 1 again, on the point-in-time universe: how much of each year's S&P 500 price return came from its
   top 1 / 5 / 10 / 20 contributors, 2004 → 2026 to date.
   node research/statistics/point-in-time/pit-leaders.mjs [--out <file>]
   Every company that was a member on a given day counts that day, with its full market cap (month-end FMP cap carried
   by price; Massive price × dated shares where FMP has none). Daily attribution: a company's part of day t is its
   weight at the close of t−1 times its return on t, scaled by how far the index had already moved in the year — the
   parts add exactly to the synthetic cap-weighted index. That index is checked against ^GSPC every year (the real
   index weights by free float; this uses full caps, so the two differ a little). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadPit, capOn, atOrBefore, dayRet } from "./pit-data.mjs";
import { yearBlock } from "../leaders-concentration.mjs";
import { BAR_ROOT } from "../leaders-lib.mjs";

/** Second share classes counted with their company (SPY's holdings group them by issuer the same way). */
export const CLASS_OF = { GOOG: "GOOGL", NWS: "NWSA", FOX: "FOXA", UA: "UAA", DISCK: "DISCA", DISCB: "DISCA", CMCSK: "CMCSA", LBTYK: "LBTYA", LBTYB: "LBTYA", VIA: "VIAB", "BF.A": "BF.B", "LEN.B": "LEN" };

export function sessionsOf(P) { return P.series("AAPL").dates; }

/** Year Y's attribution over members of `index`. Returns the leaders-concentration yearBlock plus coverage. */
export function yearAttribution(P, Y, { index = "SP500", sessions }) {
  const days = sessions.filter((d) => d > `${Y - 1}-12-31` && d <= `${Y}-12-31`);
  const d0 = sessions[atOrBefore(sessions, `${Y - 1}-12-31`)];
  const contrib = new Map(); let V = 1, capSeen = 0, capDays = 0, prev = d0, missingW = 0;
  const wStart = new Map();
  for (const d of days) {
    const mem = P.members(index, d); let tot = 0; const w = [];
    for (const s of mem) {
      const c0 = capOn(P, s, prev); const S = P.series(s);
      if (c0 == null || !S) { missingW++; continue; }
      const i1 = atOrBefore(S.dates, d), i0 = atOrBefore(S.dates, prev);
      if (i1 < 0 || i0 < 0 || S.dates[i1] !== d || i0 === i1) { w.push([s, c0, 0]); tot += c0; continue; } // no bar that day: holds still
      w.push([s, c0, dayRet(S, i0, i1)]); tot += c0;
    }
    capDays += mem.length; capSeen += w.length;
    let R = 0;
    for (const [s, c0, r] of w) { const part = V * (c0 / tot) * r; R += (c0 / tot) * r; contrib.set(s, (contrib.get(s) ?? 0) + part); if (d === days[0]) wStart.set(s, 100 * c0 / tot); }
    V *= 1 + R; prev = d;
  }
  const merged = new Map();
  for (const [sym, c] of contrib) { const k = CLASS_OF[sym] ?? sym, m = merged.get(k) ?? { sym: k, name: k, c: 0, wStart: 0 }; m.c += c; m.wStart += wStart.get(sym) ?? 0; merged.set(k, m); }
  const rows = [...merged.values()];
  const blk = yearBlock(Y, d0, days.at(-1), V - 1, rows, "point-in-time", days.at(-1) < `${Y}-12-31` && Y === 2026);
  blk.coverage = { memberDaysPriced: Math.round(1000 * capSeen / capDays) / 10, companies: rows.length };
  return blk;
}

export function run() {
  const P = loadPit(), sessions = sessionsOf(P).filter((d) => d >= "2003-01-02");
  const gspc = JSON.parse(fs.readFileSync(path.join(BAR_ROOT, "daily-bars-rsi/fmp-indexes.json"), "utf8"))["^GSPC"];
  const G = { dates: gspc.map((r) => r[0]), c: gspc.map((r) => +r[4]) };
  const gRet = (Y, to) => G.c[atOrBefore(G.dates, to)] / G.c[atOrBefore(G.dates, `${Y - 1}-12-31`)] - 1;
  const years = [];
  for (let Y = 2004; Y <= 2026; Y++) { const b = yearAttribution(P, Y, { sessions }); b.gspc = Math.round(10000 * gRet(Y, b.to)) / 100; years.push(b); }
  return { generated: new Date().toISOString(), kind: "Leaders 1 on the point-in-time S&P 500 (every member of the day, full caps)", years, manifest: P.manifest, guardFlags: P.flags };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf("--out"), OUT = i > 0 ? process.argv[i + 1] : "pit-concentration.json";
  const t0 = Date.now(), out = run(); fs.writeFileSync(OUT, JSON.stringify(out));
  for (const y of out.years) console.log(y.year, "synthetic", y.index, "gspc", y.gspc, "top1/5/10/20", Object.values(y.tops).join(" / "), "share10", y.share[10], "priced", y.coverage.memberDaysPriced, y.top20.slice(0, 5).map((x) => `${x.sym} ${x.contrib}`).join(", "));
  console.log("secs", ((Date.now() - t0) / 1000).toFixed(1));
}
