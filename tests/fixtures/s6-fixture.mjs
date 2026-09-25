/* Made-up prices and report dates for the S6 build and page layout. Nothing here is measured.
   Tickers are TEST* / FUND* so no picture of this data can be mistaken for a real name. */
import fs from "node:fs"; import path from "node:path";
function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
export function makeS6Fixture(dir, { names = 12, sessions = 1400, seed = 7 } = {}) {
  const r = rng(seed); const cache = path.join(dir, "cache"); fs.mkdirSync(cache, { recursive: true });
  const targets = Array.from({ length: 8 }, (_, i) => "TEST" + (i + 1)), funds = ["FUNDA", "FUNDB"];
  const others = Array.from({ length: names - 8 }, (_, i) => "TESTX" + (i + 1));
  const all = [...targets, ...funds, ...others];
  const dates = []; let d = Date.UTC(2020, 0, 2);
  while (dates.length < sessions) { const wd = new Date(d).getUTCDay(); if (wd && wd !== 6) dates.push(d); d += 86400e3; }
  const rows = ["ticker,date,report_time,eps_actual,superseded_at"];
  for (const s of all) {
    let c = 50 + r() * 100; const series = dates.map((t) => ({ t, c: +(c *= 1 + (r() - 0.49) * 0.04).toFixed(4) }));
    fs.writeFileSync(path.join(cache, s + ".json"), JSON.stringify({ series, provider: "FIXTURE", price_basis: "MADE_UP" }));
    if (s.startsWith("FUND")) continue;
    const reports = s === "TEST8" ? 5 : 20;                        // one target with too few reports, on purpose
    for (let q = 0; q < reports; q++) {
      const i = 120 + q * 63 + Math.floor(r() * 5);
      if (i >= sessions - 2) break;
      const date = new Date(dates[i]).toISOString().slice(0, 10), rt = ["AMC", "BMO", "AMC", "", "BMO"][q % 5];
      rows.push(`${s},${date},${rt},${(r() * 3).toFixed(2)},`);
    }
    rows.push(`${s},2019-06-01,AMC,1.00,`);                        // before the stored history
    rows.push(`${s},${new Date(dates[900]).toISOString().slice(0, 10)},AMC,,`);                  // no actual: never happened
    rows.push(`${s},${new Date(dates[1000]).toISOString().slice(0, 10)},BMO,1.2,2026-01-01T00:00:00Z`);   // superseded
  }
  fs.writeFileSync(path.join(dir, "universe.json"), JSON.stringify({ count: all.length, universe_sha256: "fixture", symbols: all }));
  fs.writeFileSync(path.join(dir, "earnings.csv"), rows.join("\n") + "\n");
  return { cache, earnings: path.join(dir, "earnings.csv"), targets, funds };
}
