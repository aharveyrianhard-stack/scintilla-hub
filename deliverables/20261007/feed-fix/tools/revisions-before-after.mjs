/* FD1 · THE REVISION LINE OF EVERY CARD, joined on the date (as CP1's card tool did) and on the fiscal year
   (lib/fiscal-year.mjs). Read-only: the Hub's public tables through its public read key (`.anon` in the working folder).
     node revisions-before-after.mjs <out.json> [<fixture.json>]
   The fixture holds the stored copies for the four companies whose key moved and two whose key did not. */
import { writeFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { revisionOf, revisionOnExactDate, copiesOfFiscalYear, fiscalYearOf } = await import(WT + "/lib/fiscal-year.mjs");
const { pg, todayUTC } = await import("./fixed-feed.mjs");
const OUT = process.argv[2] || "revisions-26.json", FIXTURE = process.argv[3] || null, TODAY = todayUTC();
const CARDS = "MU SNDK WDC STX AVGO NVDA LRCX AMAT VST CEG GOOGL AMZN ORCL EQIX DLR IRM LLY JPM BAC NBIS IREN CRWV BE CRDO COHR AME".split(" "), EXTRA = ["COST", "CSCO", "LITE"];
const inq = (a) => "in.(" + a.map((s) => encodeURIComponent('"' + s + '"')).join(",") + ")";
const page = async (q) => { const all = []; for (let off = 0; off < 100000; off += 1000) { const r = await pg(q + `&limit=1000&offset=${off}`); all.push(...r); if (r.length < 1000) break; } return all; };
const names = [...CARDS, ...EXTRA];
const daily = await page(`analyst_estimates_daily?select=ticker,fiscal_date,as_of_date,eps_avg,revenue_avg,analysts_eps&period=eq.annual&ticker=${inq(names)}&fiscal_date=gte.2026-06-01&order=ticker.asc,as_of_date.asc,fiscal_date.asc`);
const cur = await page(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=${inq(names)}&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const slim = (x) => (x ? { from: x.from, to: x.to, days: x.days, then: x.then, now: x.now, pct: r1(x.pct), copies: x.copies, keys: x.keys, key_moved: x.key_moved } : null);
const out = { taken: new Date().toISOString(), today: TODAY, copies_on_file: [...new Set(daily.map((r) => r.as_of_date))].sort(), names: {} };
for (const t of names) {
  const rows = daily.filter((r) => r.ticker === t), fy = cur.filter((r) => r.ticker === t).slice(0, 2), o = { in_cards: CARDS.includes(t), years: {} };
  fy.forEach((f, i) => { const k = "fy" + (i + 1);
    o.years[k] = { fiscal_date: f.fiscal_date, fiscal_year: fiscalYearOf(f.fiscal_date), keys: copiesOfFiscalYear(rows, f.fiscal_date).keys,
      eps: { on_the_date: slim(revisionOnExactDate(rows, f.fiscal_date, "eps_avg")), on_the_fiscal_year: slim(revisionOf(rows, f.fiscal_date, "eps_avg")) },
      revenue: { on_the_date: slim(revisionOnExactDate(rows, f.fiscal_date, "revenue_avg")), on_the_fiscal_year: slim(revisionOf(rows, f.fiscal_date, "revenue_avg")) } }; });
  o.key_moved = Object.values(o.years).some((y) => y.keys.length > 1);
  out.names[t] = o;
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
if (FIXTURE) { const keep = ["MU", "COST", "CSCO", "LITE", "NVDA", "GOOGL"]; writeFileSync(FIXTURE, JSON.stringify({ what: "FD1 · analyst_estimates_daily (annual) as stored on 7 Oct 2026 for four companies whose fiscal-date key moved and two whose key did not, and each one's two forecast years", taken: out.taken, today: TODAY, copies_on_file: out.copies_on_file, rows: Object.fromEntries(keep.map((t) => [t, daily.filter((r) => r.ticker === t).map(({ ticker, ...r }) => r)])), forecast_years: Object.fromEntries(keep.map((t) => [t, cur.filter((r) => r.ticker === t).slice(0, 2).map((r) => r.fiscal_date)])) })); }
const f = (x) => (x ? `${x.pct >= 0 ? "+" : ""}${x.pct}% since ${x.from} (${x.copies} copies)` : "—");
for (const t of names) { const y = out.names[t].years.fy1; if (!y) { console.log(t.padEnd(6), "no forecast year"); continue; } const a = y.eps.on_the_date, b = y.eps.on_the_fiscal_year, y2 = out.names[t].years.fy2; console.log(t.padEnd(6), "FY1", y.fiscal_date, "· on the date:", f(a), "· on the fiscal year:", f(b), out.names[t].key_moved ? "· KEY MOVED " + y.keys.join(" → ") : "", y2 ? "| FY2 " + f(y2.eps.on_the_date) + " → " + f(y2.eps.on_the_fiscal_year) : ""); }
console.log("DONE →", OUT, FIXTURE ? "and " + FIXTURE : "");
