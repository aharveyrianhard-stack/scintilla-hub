/* LEADERS · 1 · CONCENTRATION — how much of the S&P 500's price return each year came from its top 1 / 5 / 10 / 20 contributors.
   node research/statistics/leaders-concentration.mjs --fmp <dir> [--out <file>]

   Two regimes, never mixed in one number:
   · MEASURED (2020 → 2026 to date): the S&P 500 weights are SPY's own quarterly holdings (SEC N-PORT filings via FMP,
     30 Sep 2019 → 30 Jun 2026, every quarter). A company's contribution in a quarter = its weight at the start of the
     quarter × its price return over the quarter. Quarters are chained exactly: a quarter's points count in proportion to
     where the index stood when the quarter began, so the contributions of a year add up to the year's index return.
     Share classes of one company (Alphabet A + C, Fox, News Corp) are one company (same 6-character CUSIP issuer).
     2026 runs to the last close in the cache (25 Sep 2026): Q3 uses the 30 Jun weights.
   · ESTIMATED (2004 → 2019): no holdings file exists before Sep 2019. Weight = FMP full market cap at the start of the
     year ÷ the index's estimated total value. The total = index level × a scale factor measured from the real holdings
     (median over the top 50 companies of cap ÷ (weight × level)); the factor drifts, so the estimate is checked against
     the measured years (the "backtest" block in the output). Only 113 of today's large companies have cap histories
     here (a survivor list), and they count only while they were S&P members (FMP's add/remove list). Caps before
     Nov 2006 are the first FMP cap scaled back by price (share counts held fixed).
   Returns are price only, from the chart API's split-adjusted daily closes; the index return is ^GSPC (price). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadBars, listCachedSymbols, idxOnOrBefore, closeOn, median, r2, r4, BAR_ROOT, dstr, setPatchDir } from "./leaders-lib.mjs";

const RENAME = { FB: "META", ANTM: "ELV", BBT: "TFC", BK: "BNY", RE: "EG", PKI: "RVTY", ABC: "COR", FISV: "FI", MMC: "MRSH", WLTW: "WTW", COG: "CTRA", FLT: "CPAY", HCP: "DOC", PEAK: "DOC", GPS: "GAP", "BRK.B": "BRK-B", "BF.B": "BF-B" };
const TOPS = [1, 5, 10, 20];

export function loadIndex(fmpDir) {
  const j = JSON.parse(fs.readFileSync(path.join(BAR_ROOT, "daily-bars-rsi/fmp-indexes.json"), "utf8"))["^GSPC"];
  return { dates: j.map((r) => r[0]), c: j.map((r) => +r[4]) };
}

/** One SPY holdings snapshot → company rows keyed by issuer (6-char CUSIP). Weights re-based to the stock sleeve = 100. */
export function companiesOf(rows) {
  const eq = rows.filter((r) => r.assetCat === "EC" && r.payoffProfile === "Long" && r.cusip && r.cusip.length >= 6 && r.balance > 0 && r.valUsd > 0);
  const tot = eq.reduce((s, r) => s + r.valUsd, 0), by = new Map();
  for (const r of eq) {
    const iss = r.cusip.slice(0, 6), sym = RENAME[r.symbol] ?? r.symbol ?? r.name;
    const cur = by.get(iss) ?? { issuer: iss, name: r.name, lines: [], w: 0 };
    cur.lines.push({ cusip: r.cusip, sym, bal: r.balance, val: r.valUsd, p: r.valUsd / r.balance });
    cur.w += 100 * r.valUsd / tot; by.set(iss, cur);
  }
  for (const c of by.values()) { c.lines.sort((a, b) => b.val - a.val); c.sym = c.lines[0].sym; }
  return by;
}

/** Split-aware price ratio for one line between two snapshots when no cached closes exist. fundRatio = median balance ratio. */
export function holdingsReturn(a, b, fundRatio) {
  const k = (b.bal / a.bal) / fundRatio;
  const SPLITS = [2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 40, 50, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 10, 1 / 20, 3 / 2, 2 / 3, 5 / 4, 4 / 5];
  let s = 1;
  if (k > 1.3 || k < 0.77) { const best = SPLITS.map((x) => [x, Math.abs(Math.log(k / x))]).sort((p, q) => p[1] - q[1])[0]; if (best[1] < 0.12) s = best[0]; }
  return { r: (b.p * s) / a.p - 1, split: s };
}

export function run(fmpDir) {
  setPatchDir(path.join(fmpDir, "bars-patch"));
  const IDX = loadIndex(fmpDir), idxOn = (d) => IDX.c[idxOnOrBefore(IDX.dates, d)];
  const cached = new Set(listCachedSymbols()), barCache = new Map();
  const S = (sym) => { if (!cached.has(sym)) return null; if (!barCache.has(sym)) { const L = loadBars(sym); barCache.set(sym, L ? { dates: L.bars.map((b) => dstr(b.t)), c: L.bars.map((b) => +b.c) } : null); } return barCache.get(sym); };
  const priceRet = (sym, d0, d1) => { const s = S(sym); if (!s) return null; const i0 = idxOnOrBefore(s.dates, d0), i1 = idxOnOrBefore(s.dates, d1); if (i0 < 0 || i1 <= i0) return null; if (s.dates[i0] < addDays(d0, -6)) return null; return s.c[i1] / s.c[i0] - 1; };

  /* ---------- measured regime ---------- */
  const hdir = path.join(fmpDir, "spy-holdings"), snaps = fs.readdirSync(hdir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ date: f.slice(0, 10), co: companiesOf(JSON.parse(fs.readFileSync(path.join(hdir, f), "utf8"))) }));
  const quotes = new Map(JSON.parse(fs.readFileSync(path.join(fmpDir, "quotes-20260928.json"), "utf8")).map((q) => [q.symbol, q]));
  const lastBarDate = S("SPY").dates.at(-1);
  const quarters = [], diag = [], disagree = [];
  for (let qi = 0; qi < snaps.length; qi++) {
    const A = snaps[qi], B = snaps[qi + 1] ?? null, d0 = A.date, d1 = B ? B.date : lastBarDate;
    const fundRatio = B ? median([...A.co.values()].flatMap((c) => c.lines.map((l) => { const bl = [...(B.co.get(c.issuer)?.lines ?? [])].find((x) => x.cusip === l.cusip); return bl ? bl.bal / l.bal : null; }))) : 1;
    const L0 = idxOn(d0), L1 = idxOn(d1), R = L1 / L0 - 1;
    const rows = []; let wKnown = 0, sumWR = 0, bySource = { cache: 0, holdings: 0, quote: 0, none: 0 };
    for (const c of A.co.values()) {
      let r = priceRet(c.sym, d0, d1), src = "cache";
      const bc = B ? B.co.get(c.issuer) : null, al = c.lines[0], bl = bc?.lines.find((x) => x.cusip === al.cusip), hr = bl ? holdingsReturn(al, bl, fundRatio) : null;
      // the fund's own prices overrule the cache when they disagree and no split is involved (catches reused tickers)
      // diagnostic only: the cache is split- AND spin-off-adjusted (MMM/Solventum, GE/Vernova, IBM/Kyndryl), the fund's prices are not
      if (r != null && hr && hr.split === 1 && Math.abs(r - hr.r) > 0.03) disagree.push({ sym: c.sym, from: d0, cache: r2(100 * r), holdings: r2(100 * hr.r) });
      if (r == null && hr) { r = hr.r; src = "holdings"; }
      if (r == null && !B) { const q = quotes.get(c.sym); if (q?.previousClose > 0) { r = q.previousClose / c.lines[0].p - 1; if (Math.abs(Math.log(1 + r)) > 1.2) r = null; else src = "quote"; } }
      if (r == null) src = "none";
      bySource[src] += c.w;
      rows.push({ issuer: c.issuer, sym: c.sym, name: c.name, w: c.w, r });
      if (r != null) { wKnown += c.w; sumWR += c.w / 100 * r; }
    }
    quarters.push({ d0, d1, L0, L1, R, rows, wKnown: r2(wKnown), sumWR, bySource });
    diag.push({ from: d0, to: d1, index: r2(100 * R), companies: r2(100 * sumWR), gap: r2(100 * (R - sumWR)), weightPriced: r2(wKnown), source: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, r2(v)])) });
  }
  const measuredYears = [];
  for (let Y = 2020; Y <= 2026; Y++) {
    const qs = quarters.filter((q) => q.d0 >= `${Y - 1}-12-31` && q.d0 < `${Y}-12-31`);
    if (!qs.length) continue;
    const LY0 = qs[0].L0, contrib = new Map();
    for (const q of qs) for (const row of q.rows) if (row.r != null) { const cur = contrib.get(row.issuer) ?? { sym: row.sym, name: row.name, c: 0, wStart: null }; cur.c += (q.L0 / LY0) * (row.w / 100) * row.r; cur.sym = row.sym; if (q === qs[0]) cur.wStart = row.w; contrib.set(row.issuer, cur); }
    const indexR = qs.at(-1).L1 / LY0 - 1;
    measuredYears.push(yearBlock(Y, qs[0].d0, qs.at(-1).d1, indexR, [...contrib.values()], "measured", qs.at(-1).d1 < `${Y}-12-31`));
  }

  /* ---------- scale factor (index value ÷ level) from the real holdings ---------- */
  const capDir = path.join(fmpDir, "caps"), caps = new Map();
  for (const f of fs.readdirSync(capDir)) if (f.endsWith(".json")) { const j = JSON.parse(fs.readFileSync(path.join(capDir, f), "utf8")); caps.set(f.slice(0, -5), { dates: j.map((r) => r.date), v: j.map((r) => +r.marketCap) }); }
  const capOn = (sym, d) => { const c = caps.get(sym); if (!c) return null; const i = idxOnOrBefore(c.dates, d); if (i >= 0 && c.dates[i] >= addDays(d, -10)) return c.v[i];
    if (i < 0) { const s = S(sym); if (!s) return null; const p0 = closeOn(s, d), p1 = closeOn(s, c.dates[0]); return p0 && p1 ? c.v[0] * p0 / p1 : null; } return null; };
  const scale = snaps.map((sn) => { const L = idxOn(sn.date), top = [...sn.co.values()].sort((a, b) => b.w - a.w).slice(0, 50);
    const ks = top.map((c) => { const cap = capOn(c.sym, sn.date); return cap ? cap / (c.w / 100 * L) : null; }).filter((x) => x != null);
    return { date: sn.date, k: median(ks), n: ks.length }; });
  const kEarliest = scale[0].k;

  /* ---------- S&P membership (FMP add/remove list) ---------- */
  const changes = JSON.parse(fs.readFileSync(path.join(fmpDir, "sp500-changes.json"), "utf8"));
  // FMP's list reuses tickers (C was Chrysler before Citigroup, CVX's "removal" is Cleveland Electric), so a removal only
  // counts when the removed company's first word matches the company that was added under that ticker. T is held as a
  // member throughout (SBC, a member, took the AT&T name and ticker in Nov 2005).
  const events = new Map(), push = (k, v) => (events.get(k) ?? events.set(k, []).get(k)).push(v);
  for (const e of changes) { if (e.symbol) push(e.symbol, { d: e.date, add: true, who: e.addedSecurity }); if (e.removedTicker) push(e.removedTicker, { d: e.date, add: false, who: e.removedSecurity }); }
  const first = (x) => String(x ?? "").toLowerCase().split(/[\s.,]+/)[0];
  const ALWAYS = new Set(["T"]);
  const ALIAS = { META: ["FB"], GOOGL: ["GOOG"], ELV: ["ANTM", "WLP"], LIN: ["PX"], RTX: ["UTX"], SPGI: ["MHFI", "MHP"], BKNG: ["PCLN"], MDLZ: ["KFT"], BNY: ["BK"], "BRK-B": ["BRK.B"] };
  const member1 = (sym, d) => {
    if (ALWAYS.has(sym)) return true;
    const ev = (events.get(sym) ?? []).filter((e) => e.d <= d).sort((a, b) => a.d < b.d ? -1 : 1);
    const adds = ev.filter((e) => e.add); if (!adds.length) return false;
    const last = adds.at(-1);
    return !ev.some((e) => !e.add && e.d > last.d && first(e.who) === first(last.who));
  };
  const member = (sym, d) => [sym, ...(ALIAS[sym] ?? [])].some((s) => member1(s, d));

  /* ---------- estimated regime ---------- */
  const capRatioUsed = [], notMember = [];
  const estimate = (Y, k) => {
    const d0 = IDX.dates[idxOnOrBefore(IDX.dates, `${Y - 1}-12-31`)], d1 = IDX.dates[idxOnOrBefore(IDX.dates, `${Y}-12-31`)], L0 = idxOn(d0);
    const rows = [];
    for (const sym of caps.keys()) { if (!member(sym, d0)) { notMember.push(`${Y}:${sym}`); continue; } const cap = capOn(sym, d0); let r = priceRet(sym, d0, d1); if (r == null) { const c1 = capOn(sym, d1); if (cap && c1) { r = c1 / cap - 1; capRatioUsed.push(`${Y}:${sym}`); } } if (cap == null || r == null) continue; const w = 100 * cap / (k * L0); rows.push({ sym, name: sym, c: (w / 100) * r, wStart: w }); }
    const blk = yearBlock(Y, d0, d1, idxOn(d1) / L0 - 1, rows, "estimated", false); blk.allWeights = rows.map((r) => [r.sym, r4(r.wStart)]); return blk;
  };
  const estimatedYears = []; for (let Y = 2004; Y <= 2019; Y++) estimatedYears.push(estimate(Y, kEarliest));
  // backtest: the estimate method on the measured years, against the measured answer
  const backtest = measuredYears.filter((m) => !m.partial).map((m) => { const e = estimate(m.year, kEarliest); return { year: m.year, measured: m.tops, estimated: e.tops, topNames: { measured: m.top20.slice(0, 5).map((x) => x.sym), estimated: e.top20.slice(0, 5).map((x) => x.sym) } }; });

  return { generated: new Date().toISOString(), kind: "Leaders 1 — concentration of the S&P 500's yearly price return in its top contributors", tops: TOPS,
    years: [...estimatedYears, ...measuredYears], quarterCheck: diag, cacheOverruled: disagree, capRatioUsed: [...new Set(capRatioUsed)], notMemberSkipped: notMember, scale, kUsed: kEarliest, backtest,
    sources: { holdings: snaps.map((s) => s.date), capSymbols: [...caps.keys()], index: "^GSPC daily closes (FMP, cached)", bars: "chart API split-adjusted daily closes (cache)", lastBar: lastBarDate } };
}

function addDays(d, n) { return new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10); }

/** Rank contributors, sum the top groups, keep the top 20 with their numbers. */
export function yearBlock(year, d0, d1, indexR, rows, regime, partial) {
  const sorted = rows.filter((r) => Number.isFinite(r.c)).sort((a, b) => b.c - a.c);
  const sumTop = (n) => sorted.slice(0, n).reduce((s, r) => s + r.c, 0);
  const tops = Object.fromEntries(TOPS.map((n) => [n, r2(100 * sumTop(n))]));
  const share = Object.fromEntries(TOPS.map((n) => [n, indexR > 0 ? r2(100 * sumTop(n) / indexR) : null]));
  const pos = sorted.filter((r) => r.c > 0), negSum = sorted.filter((r) => r.c < 0).reduce((s, r) => s + r.c, 0);
  return { year, from: d0, to: d1, regime, partial, index: r2(100 * indexR), tops, share, rest: r2(100 * (indexR - sumTop(20))),
    measuredCompanies: sorted.length, sumAll: r2(100 * sorted.reduce((s, r) => s + r.c, 0)), positives: pos.length, negativeSum: r2(100 * negSum),
    top20: sorted.slice(0, 20).map((r) => ({ sym: r.sym, name: r.name, contrib: r2(100 * r.c), wStart: r4(r.wStart) })),
    bottom5: sorted.slice(-5).reverse().map((r) => ({ sym: r.sym, contrib: r2(100 * r.c), wStart: r4(r.wStart) })) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const FMP = opt("--fmp"), OUT = opt("--out") ?? "leaders-concentration.json";
  const t0 = Date.now(), out = run(FMP); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`wrote ${OUT} in ${Date.now() - t0} ms; k used ${out.kUsed?.toFixed(3)}`);
  for (const y of out.years) console.log(y.year, y.regime[0], "idx", y.index, "top1/5/10/20", Object.values(y.tops).join(" / "), "share10", y.share[10], y.top20.slice(0, 3).map((x) => `${x.sym} ${x.contrib}`).join(", "));
  for (const q of out.quarterCheck) console.log("Q", q.from, "idx", q.index, "cos", q.companies, "gap", q.gap, "priced", q.weightPriced, JSON.stringify(q.source));
  console.log("scale", out.scale.map((s) => `${s.date}:${s.k?.toFixed(3)}(${s.n})`).join(" "));
  console.log("overruled", JSON.stringify(out.cacheOverruled)); console.log("capRatio", out.capRatioUsed.length, "notMember", out.notMemberSkipped.filter((x) => x.startsWith("2004:") || x.startsWith("2012:")).join(" "));
  for (const b of out.backtest) console.log("BT", b.year, JSON.stringify(b.measured), JSON.stringify(b.estimated), b.topNames.measured.join(","), "|", b.topNames.estimated.join(","));
}
