/* C5b · before → after on the SAME inputs. The code before is the branch at 96e058e (C5's return, unpacked by
     git archive 96e058e deliverables | tar -x -C <dir>), the code after is this branch; both read the Hub's tables rebuilt
   from FMP's facts (fmp-rows.mjs), so the only difference is the currency rule. Prints and writes check-<date>.json:
   (1) every non-USD reporter (and the USD controls): P/E, P/E forward, EV/EBITDA, EV/sales, P/S before → after → FMP's own;
   (2) the nine C5 sets (members as C5 returned them): outliers and the price, way C, before → after.
     node deliverables/20261003/comps-c5b/check.mjs <dir of the 96e058e archive> */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath, pathToFileURL } from "node:url"; import path from "node:path";
import { tablesFrom, pgFrom, quotesFrom, fmpOutside, fmpAtUsListing } from "./fmp-rows.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), OLD = process.argv[2];
if (!OLD) { console.error("usage: node check.mjs <dir of the 96e058e archive>"); process.exit(2); }
const TODAY = "2026-10-03", NINE = ["AMZN", "NVDA", "MU", "TSM", "META", "JPM", "XOM", "COST", "LLY"], KEYS = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps"];
const facts = JSON.parse(readFileSync(path.join(HERE, "fmp-facts-2026-10-03.json"), "utf8"));
const reported = JSON.parse(readFileSync(path.join(HERE, "reporting-currency-fmp-2026-10-03.json"), "utf8"));
const standin = JSON.parse(readFileSync(path.join(HERE, "../../20261001/comps-template/fx-standin-ecb-2026-10-01.json"), "utf8"));
const code = async (root) => ({ cohort: await import(pathToFileURL(path.join(root, "deliverables/20261001/comps-template/cohort.mjs"))), field: await import(pathToFileURL(path.join(root, "deliverables/20261003/comps-c5/field.mjs"))) });
const before = await code(OLD), after = await code(path.resolve(HERE, "../../.."));
/* the database as C5's run met it: PDD with no filer_currency row and read as a US filer (its note said "US filer (default)");
   TSM and ASML with no price on their fundamentals row (C5 took their share count from the profile) */
const tables = tablesFrom(facts, { noFilerRow: ["PDD"], noFundPrice: ["TSM", "ASML"] }), pg = pgFrom(tables), quotes = quotesFrom(facts);
const run = async (C, ticker, members, withReported) => {
  const ctx = await C.cohort.readCohort({ ticker, today: TODAY, pg, quotes, fxStandin: withReported ? { ...standin, reported: reported.reported } : standin, membersAsked: members, labelAsked: "c5b" });
  const snap = C.cohort.snapshotFromCohort(ctx, ticker); Object.defineProperty(snap, "_ctx", { value: ctx, enumerable: false }); return snap;
};
const pick = (tbl) => Object.fromEntries(KEYS.map((k) => [k, tbl[k] ?? null]));
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

/* (1) the currency table */
const foreign = Object.entries(reported.reported).filter(([, c]) => c !== "USD").map(([t]) => t).sort();
const controls = ["AMZN", "MELI", "WMT", "NVDA", "SHOP", "ARM"];
const table = [];
for (const t of [...foreign, ...controls]) {
  const mate = t === "AMZN" ? "MELI" : "AMZN", b = await run(before, t, [t, mate], false), a = await run(after, t, [t, mate], true);
  const ccy = (facts.companies[t].income_q[0] || {}).reportedCurrency || "USD", series = facts.fx[ccy], rate = ccy === "USD" ? 1 : series ? series[series.length - 1][1] : null;
  const fmpRaw = fmpOutside(facts.companies[t]), o = fmpAtUsListing(facts.companies[t], rate);
  const gap = Object.fromEntries(KEYS.map((k) => [k, a.table.company[k] != null && o[k] != null ? a.table.company[k] / o[k] - 1 : null]));
  const c5 = {}; for (const T of NINE) { const F = JSON.parse(readFileSync(path.join(HERE, `../comps-c5/set-${T}-2026-10-03.json`), "utf8")); const v = T === t ? F.snapshot.table.company : F.snapshot.table.peers[t]; if (v && !c5.from) { Object.assign(c5, pick(v)); c5.from = T + " set"; } }
  table.push({ ticker: t, currency: ccy, rate_today: rate, c5_returned: c5.from ? c5 : null, before: pick(b.table.company), after: pick(a.table.company), fmp: o, fmp_home_listing: fmpRaw, gap,
    before_note: b.fx && b.fx.why, after_note: a.fx && a.fx.why, market_value: a.fx && a.fx.market_value || null, eps_basis: a.fx && a.fx.eps_ttm_basis || null, adr: a.fx && a.fx.adr ? a.fx.adr.basis : null,
    shares: { before: b.shares, after: a.shares }, mcap: { before: b.mcap, after: a.mcap, profile: facts.companies[t].profile.marketCap } });
}
/* (2) the nine sets */
const sets = {};
for (const T of NINE) {
  const F = JSON.parse(readFileSync(path.join(HERE, `../comps-c5/set-${T}-2026-10-03.json`), "utf8")), members = F.snapshot.members;
  const out = {};
  for (const [name, C, withRep] of [["before", before, false], ["after", after, true]]) {
    const snap = await run(C, T, members, withRep);
    const est = Object.fromEntries(members.map((m) => [m, { eps_ttm: null, est: tables.analyst_estimates.filter((e) => e.ticker === m && e.fiscal_date >= TODAY).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
    for (const i of snap._ctx.inputs) if (est[i.ticker]) est[i.ticker].eps_ttm = i.eps_ttm ?? null;   // as comps-c5/snapshot.mjs builds it
    const c = C.field.conclusion({ ...snap, sector: F.snapshot.sector, industry: F.snapshot.industry }, [], est, TODAY, "C");
    const w = c.ways.find((x) => x.way === "C");
    out[name] = { price: snap.price, band: w && w.ok ? { lo: w.lo, mid: w.mid, hi: w.hi } : null, upside: w && w.ok ? w.upside : null,
      outliers: c.outliers.map((x) => ({ ticker: x.ticker, key: x.key, multiple: r2(x.multiple), side: x.side })),
      foreign: Object.fromEntries(members.filter((m) => foreign.includes(m)).map((m) => [m, pick(m === T ? snap.table.company : snap.table.peers[m])])) };
  }
  out.c5_returned = { outliers: (() => { const C5 = after.field.conclusion(F.snapshot, [], F.estimates, F.today, "C"); const w = C5.ways.find((x) => x.way === "C"); return { list: C5.outliers.map((x) => ({ ticker: x.ticker, key: x.key, multiple: r2(x.multiple), side: x.side })), band: w && w.ok ? { lo: w.lo, mid: w.mid, hi: w.hi } : null }; })() };
  sets[T] = out;
}
const doc = { today: TODAY, code_before: "96e058e (C5's return)", code_after: "this branch", inputs: "FMP facts of 2026-10-03 (fmp-facts-2026-10-03.json) rebuilt as the Hub's tables (fmp-rows.mjs)", tolerance: 0.10, table, sets };
writeFileSync(path.join(HERE, `check-${TODAY}.json`), JSON.stringify(doc, null, 1));
const X = (v) => (v == null ? "—" : v.toFixed(1));
for (const r of table) console.log(`${r.ticker.padEnd(5)} ${r.currency} k ${r.fmp.k == null ? "—" : r.fmp.k.toFixed(2)} ` + KEYS.map((k) => `${k} ${r.c5_returned ? X(r.c5_returned[k]) + "|" : ""}${X(r.before[k])}→${X(r.after[k])} [${X(r.fmp[k] ?? null)}${r.gap[k] != null ? " " + (r.gap[k] * 100).toFixed(0) + "%" : ""}]`).join("  "));
for (const T of NINE) { const s = sets[T]; console.log(`${T} C5 returned ${X(s.c5_returned.outliers.band && s.c5_returned.outliers.band.mid)} [${s.c5_returned.outliers.list.map((o) => o.ticker + " " + o.key + " " + o.multiple).join(", ")}]`); console.log(`${T} price ${X(s.before.band && s.before.band.mid)} → ${X(s.after.band && s.after.band.mid)} | out before: ${s.before.outliers.map((o) => o.ticker + " " + o.key + " " + o.multiple).join(", ")} | after: ${s.after.outliers.map((o) => o.ticker + " " + o.key + " " + o.multiple).join(", ")}`); }
