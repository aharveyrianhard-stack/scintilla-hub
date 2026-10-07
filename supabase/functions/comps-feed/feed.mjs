// SCINTILLA · comps-feed v6 (FD1, 7 Oct 2026) — the pure part: no network, no key, no clock.
// Shared by ./index.ts (the edge function) and deliverables/20261007/feed-fix/tools/feed-dry-run.mjs (the rehearsal),
// tested by tests/fd1-comps-feed.test.mjs.
//
// WHAT THE FEED IS. One CSV line per symbol for the allocation tool's value layer (THE KNOCKOUT, COMPARABLES, the
// implied values) and the Station's allocation template. The header is unchanged, so no page changes:
//   sym,mktcap,pe,fwd_pe,ps,pb,gross_m,net_m,de,div_yld,rev_growth,updated
//
// WHAT WAS WRONG (v5, 20 Jul 2026 — measured live on 7 Oct, the rows are in tests/fixtures/fd1-comps-feed-20261007.json):
//   1. GROWTH was the newest fundamentals_history row over the one before it, whatever their period. That table holds
//      quarters AND fiscal years. At a year-end the Q4 row and the FY row carry the same date and the database returns
//      them in no fixed order, so Micron read 54.2bn ÷ 133.2bn − 1 = −59% (or, the other way round, +146%); any other
//      week it was one quarter over the quarter before. It was never a year over a year.
//   2. FORWARD P/E read analyst_estimates without asking for annual rows (the table also holds quarters: a quarter's EPS
//      made Micron 27.8× instead of 6.1×), oldest row first, and the API serves 1,000 rows a request. A 60-name batch
//      holds about 6,900 estimate rows, so only rows from the 1990s arrived, no future year was ever seen, and …
//   3. … A BLANK WAS PRINTED AS 0: n('') ran Number(''), which is 0. Every name's forward P/E read 0.
//   4. P/S, MARGINS and the DIVIDEND came from the newest ratios_history row, again whatever its period: a single
//      quarter's sales under a full market value (WDC 49.6×, NVDA 49.4×) and a single quarter's margin (GOOGL 94%).
//   5. A company reporting in another currency was divided as if it reported in dollars (TSM: P/E 1.1).
//
// THE RULES NOW (each is the comps tab's own definition — deliverables/20260927/comps-single/comps.mjs — so a number
// means the same thing on the Hub's COMPS tab, on a decision card and in the knockout):
//   · A FLOW (sales, gross profit, net income) is TWELVE MONTHS: the newest four consecutive quarters, each 80–100 days
//     after the one before; when four are not on file, the last fiscal year. Never one quarter against a year.
//   · rev_growth  = those twelve months over the twelve months before (eight consecutive quarters), else the last
//                   fiscal year over the one before. A fraction: 2.56 = +256%.
//   · A RESTATED YEAR: when the four quarters on file for a fiscal year do not add up to that year's own row (more
//     than 2% apart), the year was restated after the quarters were filed — Western Digital's FY2025 row is the
//     drives business alone, 9.5bn, while its December 2024 quarter still carries SanDisk, so the quarters add to
//     11.4bn. Those quarters are not like for like, so they are not summed: the fiscal-year rows are used instead.
//   · fwd_pe      = price ÷ the consensus EPS of the nearest FISCAL YEAR ending today or later (annual rows only).
//   · ps          = market value ÷ sales of those twelve months (both from the same statement currency).
//   · gross_m, net_m = gross profit, net income ÷ sales, the same twelve months.
//   · pb, de      = the newest balance on file (a balance is a moment, so the newest row of either kind is right).
//   · div_yld     = the last fiscal year's (the only row that holds a year of dividends).
//   · ONE CURRENCY PER MULTIPLE (C5b): a company reporting outside dollars has its EPS and market value put in dollars
//     at the newest stored rate; when no rate is on file the multiple is WITHHELD — blank, never mixed.
//   · A MISSING FIGURE IS BLANK, NEVER 0. The pages already read a blank as "not held".
//   · Every read names its period, carries a total order and is paged, so the answer does not depend on how many
//     names are asked for or on the order the database happens to return ties in.

export const VERSION = "comps-feed-v6";
export const HEAD = "sym,mktcap,pe,fwd_pe,ps,pb,gross_m,net_m,de,div_yld,rev_growth,updated";
export const MAX_SYMS = 60;          // as v5: the pages ask in batches of 60
export const PAGE = 1000;            // PostgREST serves at most 1,000 rows a request: every read here is paged
export const HISTORY_DAYS = 1100;    // three years of statements: eight quarters and two fiscal years with room
export const Q_GAP = [80, 100];      // consecutive quarters, in days (the comps tab's rule)

/* The served companies whose statements are not in dollars, from the C5b sweep (FMP income-statement reportedCurrency
   for all 455 served companies, 3 Oct 2026: deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json).
   public.filer_currency is read first and outranks this list; the list covers the five it does not carry yet. */
export const REPORTS_IN = Object.freeze({ ASML: "EUR", BABA: "CNY", BIDU: "CNY", CCJ: "CAD", EH: "CNY", EVTL: "GBP", GDS: "CNY", JD: "CNY",
  LI: "CNY", NIO: "CNY", NOK: "EUR", PDD: "CNY", SPOT: "EUR", TECK: "CAD", TSM: "TWD", XPEV: "CNY" });

export const num = (x) => { if (x == null || x === "") return null; const n = Number(x); return Number.isFinite(n) ? n : null; };
/** A CSV cell: a figure, or nothing. v5 printed a missing figure as 0. */
export const cell = (x) => { const n = num(x); return n == null ? "" : String(n); };
const DAY = 86400e3;
const iso = (d) => String(d).slice(0, 10);
const daysBetween = (a, b) => (Date.parse(iso(a) + "T00:00:00Z") - Date.parse(iso(b) + "T00:00:00Z")) / DAY;
export const daysBefore = (today, n) => new Date(Date.parse(today + "T00:00:00Z") - n * DAY).toISOString().slice(0, 10);
const isQ = (r) => r && /^Q[1-4]$/.test(String(r.period));
const isFY = (r) => r && String(r.period) === "FY";
const newestFirst = (a, b) => iso(b.fiscal_date).localeCompare(iso(a.fiscal_date));

/** The symbols of one request: trimmed, upper case, no repeats, at most MAX_SYMS, nothing that is not a ticker. */
export function parseSyms(raw) {
  const out = [];
  for (const s of String(raw || "").split(",")) { const t = s.trim().toUpperCase(); if (t && /^[A-Z0-9.\-^=]{1,15}$/.test(t) && !out.includes(t)) out.push(t); if (out.length >= MAX_SYMS) break; }
  return out;
}

/** The reads, as PostgREST paths (without limit / offset: the caller pages them). Each names its period and its order. */
export function queries(syms, today) {
  const inq = "in.(" + syms.map((s) => encodeURIComponent('"' + s + '"')).join(",") + ")";
  const since = daysBefore(today, HISTORY_DAYS);
  return {
    fundamentals: `fundamentals?select=ticker,price,market_cap,trailing_pe,eps_ttm,revenue_ttm,updated_ts&ticker=${inq}&order=ticker.asc`,
    history: `fundamentals_history?select=ticker,period,fiscal_year,fiscal_date,revenue,gross_profit,net_income&ticker=${inq}&fiscal_date=gte.${since}&order=ticker.asc,fiscal_date.desc,period.asc`,
    ratios: `ratios_history?select=ticker,period,fiscal_date,pe,pb,debt_to_equity,dividend_yield&ticker=${inq}&fiscal_date=gte.${since}&order=ticker.asc,fiscal_date.desc,period.asc`,
    estimates: `analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg&period=eq.annual&ticker=${inq}&fiscal_date=gte.${today}&order=ticker.asc,fiscal_date.asc`,
    filers: `filer_currency?select=ticker,reported_currency&ticker=${inq}&order=ticker.asc`,
    fx: `fx_rates?select=pair,date,rate&date=gte.${daysBefore(today, 30)}&date=lte.${today}&order=pair.asc,date.desc`,
  };
}

/** Newest-first run of consecutive quarters (each Q_GAP days after the one before) — comps.mjs quarterRun, the same rule. */
export function quarterRun(rows) {
  const q = (rows || []).filter(isQ).filter((r) => r.fiscal_date).sort(newestFirst);
  const run = q.length ? [q[0]] : [];
  for (let i = 1; i < q.length; i++) { const gap = daysBetween(q[i - 1].fiscal_date, q[i].fiscal_date); if (gap < Q_GAP[0] || gap > Q_GAP[1]) break; run.push(q[i]); }
  return run;
}

export const RECONCILE_TOL = 0.02;   // the four quarters of a fiscal year against the year's own row
/** The fiscal years whose four quarters on file do NOT add up to the year's own row for `key` — restated years.
    Only a year with its FY row and all four quarters on file can be judged; any other year is taken as filed. */
export function restatedYears(rows, key = "revenue", tol = RECONCILE_TOL) {
  const out = new Set(), years = new Map();
  for (const r of rows || []) { const y = num(r.fiscal_year); if (y == null) continue; if (!years.has(y)) years.set(y, { fy: null, q: [] }); const g = years.get(y); if (isFY(r)) g.fy = num(r[key]); else if (isQ(r)) g.q.push(num(r[key])); }
  for (const [y, g] of years) { if (g.fy == null || g.q.length !== 4 || g.q.some((v) => v == null)) continue; const sum = g.q.reduce((a, b) => a + b, 0); if (Math.abs(sum - g.fy) > tol * Math.abs(g.fy)) out.add(y); }
  return out;
}

/** Twelve months of one flow and the twelve before: { now, prior, basis: "TTM" | "FY" | null, to }. The comps tab's flow(),
    with one guard: a quarter of a restated year (restatedYears) is never summed — the fiscal-year rows stand in. */
export function flow(rows, key) {
  const sum = (rs) => (rs.some((r) => num(r[key]) == null) ? null : rs.reduce((s, r) => s + num(r[key]), 0));
  const bad = restatedYears(rows, "revenue"), clean = (rs) => !rs.some((r) => bad.has(num(r.fiscal_year)));
  const fy = (rows || []).filter(isFY).filter((r) => r.fiscal_date && num(r[key]) != null).sort(newestFirst);
  const fyFlow = () => (fy.length ? { now: num(fy[0][key]), prior: fy[1] ? num(fy[1][key]) : null, basis: "FY", to: iso(fy[0].fiscal_date) } : { now: null, prior: null, basis: null, to: null });
  const run = quarterRun(rows);
  if (run.length >= 4 && clean(run.slice(0, 4))) {
    const now = sum(run.slice(0, 4));
    if (now != null) {
      const prior = run.length >= 8 && clean(run.slice(4, 8)) ? sum(run.slice(4, 8)) : null;
      return { now, prior, basis: "TTM", to: iso(run[0].fiscal_date), prior_restated: run.length >= 8 && !clean(run.slice(4, 8)) };
    }
  }
  return fyFlow();
}

/** Revenue growth, a fraction: twelve months over the twelve before; else the last fiscal year over the one before. */
export function revenueGrowth(rows) {
  const f = flow(rows, "revenue");
  if (f.now != null && f.prior > 0) return { value: f.now / f.prior - 1, basis: f.basis === "TTM" ? "twelve months over the twelve before" : "last fiscal year over the one before", to: f.to };
  const fy = (rows || []).filter(isFY).filter((r) => r.fiscal_date && num(r.revenue) != null).sort(newestFirst);
  if (fy.length >= 2 && num(fy[1].revenue) > 0) return { value: num(fy[0].revenue) / num(fy[1].revenue) - 1, basis: "last fiscal year over the one before" + (f.prior_restated ? " (the year before was restated: its quarters are not like for like)" : ""), to: iso(fy[0].fiscal_date) };
  return { value: null, basis: null, to: null };
}

/** The consensus EPS of the nearest fiscal YEAR ending today or later — the comps tab's FY1 (comps.mjs buildInputs:
    annual rows, fiscal_date >= today, the first). Quarterly rows never enter; a year with no EPS on file answers null. */
export function forwardYear(estimates, today) {
  const e = (estimates || []).filter((r) => r && (r.period == null || r.period === "annual") && r.fiscal_date && iso(r.fiscal_date) >= today)
    .sort((a, b) => iso(a.fiscal_date).localeCompare(iso(b.fiscal_date)));
  return e.length ? { eps: num(e[0].est_eps_avg), fiscal_date: iso(e[0].fiscal_date) } : null;
}

/** A margin over the very twelve months of its sales: flow ÷ sales when both rest on the same months, else on the last
    fiscal year both carry. Never a quarter's profit over a year's sales. */
export function margin(rows, key) {
  const rev = flow(rows, "revenue"), top = flow(rows, key);
  if (top.now != null && rev.now > 0 && top.basis === rev.basis && top.to === rev.to) return top.now / rev.now;
  const fy = (rows || []).filter(isFY).filter((r) => r.fiscal_date && num(r[key]) != null && num(r.revenue) > 0).sort(newestFirst)[0];
  return fy ? num(fy[key]) / num(fy.revenue) : null;
}

/** The newest stored rate to dollars for a currency, on or before today: { rate, date } or null. rates: fx_rates rows. */
export function rateToUsd(ccy, rates, today) {
  if (!ccy || ccy === "USD") return { rate: 1, date: null };
  let best = null;
  for (const r of rates || []) { if (r.pair !== ccy + "USD" || !(num(r.rate) > 0) || iso(r.date) > today) continue; if (!best || iso(r.date) > best.date) best = { rate: num(r.rate), date: iso(r.date) }; }
  return best;
}

/** One symbol's figures. t: { fundamentals, history[], ratios[], estimates[], filer }. null = not held (a blank cell). */
export function feedRow(sym, t, today, rates = []) {
  const f = t.fundamentals || {}, hist = t.history || [];
  /* the ratio rows newest first; on one date the fiscal-year row before the quarter's, so a tie has one answer */
  const rat = (t.ratios || []).slice().sort((a, b) => newestFirst(a, b) || (isFY(a) ? -1 : isFY(b) ? 1 : String(a.period).localeCompare(String(b.period))));
  const ccy = String((t.filer && t.filer.reported_currency) || REPORTS_IN[sym] || "USD").toUpperCase(), dollars = ccy === "USD";
  const fx = rateToUsd(ccy, rates, today), usd = fx ? fx.rate : null;   // null: a foreign figure with no rate on file
  const nz = (x) => { const n = num(x); return n == null || n === 0 ? null : n; };
  const price = num(f.price), mcap = num(f.market_cap), epsTtm = nz(f.eps_ttm);
  const rev = flow(hist, "revenue"), g = revenueGrowth(hist), revNow = rev.now ?? num(f.revenue_ttm);
  const fy1 = forwardYear(t.estimates, today), ratFY = rat.find(isFY) || null, ratNew = rat[0] || null;
  let pe = null;
  if (dollars) pe = nz(f.trailing_pe) ?? (price != null && epsTtm != null ? price / epsTtm : null) ?? (ratFY ? nz(ratFY.pe) : null);
  else if (usd != null && price != null && epsTtm != null) pe = price / (epsTtm * usd);
  return {
    sym,
    mktcap: mcap == null ? null : dollars ? mcap : usd != null ? mcap * usd : null,
    pe,
    fwd_pe: price > 0 && fy1 && fy1.eps > 0 && usd != null ? price / (fy1.eps * usd) : null,
    ps: mcap > 0 && revNow > 0 ? mcap / revNow : null,   // both in the statement currency: no rate enters
    pb: dollars && ratNew ? nz(ratNew.pb) : null,
    gross_m: margin(hist, "gross_profit"),
    net_m: margin(hist, "net_income"),
    de: ratNew ? num(ratNew.debt_to_equity) : null,
    div_yld: dollars && ratFY ? num(ratFY.dividend_yield) : null,
    rev_growth: g.value,
    updated: num(f.updated_ts) != null ? new Date(num(f.updated_ts) * 1000).toISOString() : null,
    basis: { currency: ccy, rate: fx && !dollars ? fx : null, withheld: !dollars && usd == null, sales: rev.basis ?? (revNow != null ? "fundamentals row" : null), sales_to: rev.to, growth: g.basis, forward_year: fy1 ? fy1.fiscal_date : null, balance: ratNew ? iso(ratNew.fiscal_date) : null },
  };
}

const COLS = ["mktcap", "pe", "fwd_pe", "ps", "pb", "gross_m", "net_m", "de", "div_yld", "rev_growth"];
/** The whole answer. tables: { fundamentals[], history[], ratios[], estimates[], filers[], fx[] } as the reads returned them. */
export function buildFeed(syms, tables, today) {
  const by = (rows) => { const m = new Map(); for (const r of rows || []) { const k = String(r.ticker).toUpperCase(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const F = by(tables.fundamentals), H = by(tables.history), R = by(tables.ratios), E = by(tables.estimates), C = by(tables.filers);
  const rows = syms.map((s) => feedRow(s, { fundamentals: (F.get(s) || [])[0] || null, history: H.get(s) || [], ratios: R.get(s) || [], estimates: E.get(s) || [], filer: (C.get(s) || [])[0] || null }, today, tables.fx || []));
  const csv = [HEAD, ...rows.map((r) => [r.sym, ...COLS.map((k) => cell(r[k])), r.updated || ""].join(","))].join("\n");
  return { csv, rows };
}

/** Page one read to its end. get(path) → rows. The order in `path` is total, so pages never overlap or skip. */
export async function readAll(get, path, { page = PAGE, max = 200 } = {}) {
  const all = [];
  for (let i = 0; i < max; i++) { const rows = await get(`${path}&limit=${page}&offset=${i * page}`); if (!Array.isArray(rows)) throw new Error("read failed: " + path.split("?")[0]); all.push(...rows); if (rows.length < page) return all; }
  throw new Error("read did not end: " + path.split("?")[0]);
}

/** Everything one request needs, read to the end. A table that does not exist (filer_currency, fx_rates) reads as empty. */
export async function readTables(get, syms, today) {
  const q = queries(syms, today), soft = (p) => readAll(get, p).catch(() => []);
  const [fundamentals, history, ratios, estimates, filers, fx] = await Promise.all([readAll(get, q.fundamentals), readAll(get, q.history), readAll(get, q.ratios), readAll(get, q.estimates), soft(q.filers), soft(q.fx)]);
  return { fundamentals, history, ratios, estimates, filers, fx };
}
