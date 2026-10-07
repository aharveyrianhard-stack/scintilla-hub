/* Scintilla · K2 · the comps framework for ONE company · the arithmetic, stated once.
   Pure functions: no fetch, no clock, no DOM. The page and the tests import this same file.
   The number helpers (num, median, money, dates, the fit rules) are the K1 workshop's own,
   imported from ../../20260925/knockout/field.mjs, so a number means the same thing on both pages.

   Definitions:
   · PEERS are the other companies of the cohort: the company itself, funds, and any name the
     operator knocks out take no part. A peer with no value on a row (a loss-maker has no P/E)
     sits that row out, and the row says how many peers it rests on.
   · the PEER RANGE of a row is the lowest and highest peer value; the MIDDLE HALF is the 25th to
     the 75th percentile (straight-line between the two nearest peers); the TICK is the median.
   · TTM (trailing twelve months) = the sum of the newest four quarters, when the four are
     consecutive (each 80–100 days after the one before). The year before is the four quarters
     before those. With fewer quarters the last two fiscal years stand in, and the row says so.
   · CapEx is stored as a negative cash flow; here it is always the size of the spend (positive).
   · EV (enterprise value) = shares × price + net debt. Shares = market value ÷ the price on the
     same fundamentals row, so both are measured on one day.
   · the IMPLIED VALUE of a valuation row is the price per share the company would carry at a
     given peer multiple: P/E × EPS; for EV rows (m × sales or EBITDA − net debt) ÷ shares; for PEG
     m × EPS growth × forward EPS. A negative implied value is shown as zero: the equity would be
     worth nothing at that multiple.
   · NM (not meaningful): a peer multiple above the row's cap (P/E 100x, EV/sales 50x, EV/EBITDA 100x,
     PEG 10x) is a company with almost no earnings or sales yet, not a price anyone pays for a business;
     it sits the row out and the row names it. The operator can switch the rule off.
   · the FAIR-VALUE BAND is the stretch of price where the most valuation bars overlap. When all
     overlap it is their intersection; when they split, the stretch covered by the most bars,
     and the page says how many of how many agree. */

import { num, median, money, dateWord } from "../../20260925/knockout/field.mjs";

/* ---- the components ------------------------------------------------------------------------
   group: where the row sits on the field. better: which side of the peer median is favourable
   (null = describes, does not judge). implied: the row prices the company (valuation rows only). */
export const GROUPS = [
  { key: "VAL", label: "valuation — what the market pays" },
  { key: "GROW", label: "growth" },
  { key: "MARGIN", label: "margins — what is kept" },
  { key: "CAPEX", label: "CapEx — how much is invested, and whether it is paying" },
  { key: "BAL", label: "balance sheet" },
];
export const COMPONENTS = [
  { key: "pe_ttm",     group: "VAL",    label: "P/E, trailing",               fmt: "x",   better: "low",  implied: true,  basis: "price ÷ EPS over the last twelve months" },
  { key: "pe_fwd",     group: "VAL",    label: "P/E, forward",                fmt: "x",   better: "low",  implied: true,  basis: "price ÷ analysts' EPS for the next four quarters (the dashboard's forward P/E)" },
  { key: "ev_sales",   group: "VAL",    label: "EV / sales",                  fmt: "x",   better: "low",  implied: true,  basis: "enterprise value ÷ revenue, TTM" },
  { key: "ev_ebitda",  group: "VAL",    label: "EV / EBITDA",                 fmt: "x",   better: "low",  implied: true,  basis: "enterprise value ÷ EBITDA, TTM" },
  { key: "peg",        group: "VAL",    label: "PEG",                         fmt: "x2",  better: "low",  implied: true,  basis: "forward P/E ÷ EPS growth into the following year, in %" },
  { key: "rev_g_ttm",  group: "GROW",   label: "Revenue growth, TTM",         fmt: "pct", better: "high", basis: "revenue TTM over the twelve months before" },
  { key: "rev_g_fy",   group: "GROW",   label: "Revenue growth, next FY est", fmt: "pct", better: "high", basis: "analysts' revenue, next fiscal year over this one" },
  { key: "eps_g_fy",   group: "GROW",   label: "EPS growth, next FY est",     fmt: "pct", better: "high", basis: "analysts' EPS, next fiscal year over this one" },
  { key: "gm",         group: "MARGIN", label: "Gross margin, TTM",           fmt: "pct", better: "high", basis: "gross profit ÷ revenue" },
  { key: "om",         group: "MARGIN", label: "Operating margin, TTM",       fmt: "pct", better: "high", basis: "operating income ÷ revenue" },
  { key: "fcfm",       group: "MARGIN", label: "FCF margin, TTM",             fmt: "pct", better: "high", basis: "free cash flow ÷ revenue" },
  { key: "capex",      group: "CAPEX",  label: "CapEx, TTM",                  fmt: "money", better: null, basis: "cash spent on plant and equipment, last twelve months" },
  { key: "capex_rev",  group: "CAPEX",  label: "CapEx / revenue",             fmt: "pct", better: null,   basis: "how much of each sales dollar goes back into the business" },
  { key: "capex_g",    group: "CAPEX",  label: "CapEx growth, TTM",           fmt: "pct", better: null,   basis: "CapEx TTM over the twelve months before" },
  { key: "results",    group: "CAPEX",  label: "Revenue growth − CapEx growth", fmt: "pp", better: "high", basis: "above zero: sales are growing faster than the spending — the investment is paying" },
  { key: "rev_per_capex", group: "CAPEX", label: "New revenue per CapEx dollar", fmt: "usd2", better: "high", basis: "revenue added this year ÷ CapEx spent the year before" },
  { key: "nd_ebitda",  group: "BAL",    label: "Net debt / EBITDA",           fmt: "x",   better: "low",  basis: "years of EBITDA to pay the net debt; below zero is net cash" },
];
export const component = (key) => COMPONENTS.find((c) => c.key === key);
export const NM_CAP = { pe_ttm: 100, pe_fwd: 100, ev_sales: 50, ev_ebitda: 100, peg: 10 };
export const isNM = (key, v) => NM_CAP[key] != null && num(v) != null && v > NM_CAP[key];
export const VALUATION = COMPONENTS.filter((c) => c.implied).map((c) => c.key);

/* The eight numbers of card v2, always in this order so cards compare slot by slot. */
export const CARD_KEYS = ["pe_fwd", "ev_ebitda", "rev_g_ttm", "om", "fcfm", "capex_rev", "results", "nd_ebitda"];

/* ---- percentiles and bands -------------------------------------------------------------------- */

export function quantile(values, q) {
  const s = values.map(num).filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Peer band: range, middle half, median, and how many peers it rests on. */
export function peerBand(values) {
  const v = values.map(num).filter((x) => x != null);
  if (!v.length) return { n: 0, min: null, q1: null, median: null, q3: null, max: null };
  return { n: v.length, min: Math.min(...v), q1: quantile(v, 0.25), median: median(v), q3: quantile(v, 0.75), max: Math.max(...v) };
}

/* ---- flows: TTM and the year before ------------------------------------------------------------ */

const DAY = 86400e3;
const days = (a, b) => (Date.parse(a) - Date.parse(b)) / DAY;
const isQ = (r) => r && /^Q[1-4]$/.test(String(r.period));

/** Newest-first run of consecutive quarters (each 80–100 days after the one before). */
export function quarterRun(rows) {
  const q = (rows || []).filter(isQ).filter((r) => r.fiscal_date).sort((a, b) => String(b.fiscal_date).localeCompare(String(a.fiscal_date)));
  const run = q.length ? [q[0]] : [];
  for (let i = 1; i < q.length; i++) {
    const gap = days(q[i - 1].fiscal_date, q[i].fiscal_date);
    if (gap < 80 || gap > 100) break;
    run.push(q[i]);
  }
  return run;
}

/** One flow (revenue, capex…): {now, prior, basis, to}. key: the column; abs: take the size (CapEx). */
export function flow(qRows, fyRows, key, { abs = false } = {}) {
  const f = (v) => { const n = num(v); return n == null ? null : abs ? Math.abs(n) : n; };
  const sum = (rows) => rows.some((r) => f(r[key]) == null) ? null : rows.reduce((s, r) => s + f(r[key]), 0);
  const run = quarterRun(qRows);
  if (run.length >= 4) {
    const now = sum(run.slice(0, 4));
    const prior = run.length >= 8 ? sum(run.slice(4, 8)) : null;
    if (now != null) return { now, prior, basis: "TTM", to: run[0].fiscal_date, from: run[3].fiscal_date };
  }
  const fy = (fyRows || []).filter((r) => r && r.fiscal_date && f(r[key]) != null)
    .sort((a, b) => String(b.fiscal_date).localeCompare(String(a.fiscal_date)));
  if (fy.length) return { now: f(fy[0][key]), prior: fy[1] ? f(fy[1][key]) : null, basis: "FY", to: fy[0].fiscal_date, from: fy[0].fiscal_date };
  return { now: null, prior: null, basis: null, to: null, from: null };
}

export const growthPct = (now, prior) => { const a = num(now), b = num(prior); return (a == null || b == null || b <= 0) ? null : (a / b - 1) * 100; };

/* ---- one company's inputs from the raw Hub reads ------------------------------------------------ */

/** src: {ticker, profile, fundamentals, quote, estimates[], incQ[], incFY[], cfQ[], cfFY[], balance[]}.
    Every number keeps its own date. */
export function buildInputs(src, todayISO) {
  const f = src.fundamentals || {}, p = src.profile || {}, q = src.quote || {};
  const price = num(q.price) ?? num(f.price);
  const fPrice = num(f.price);
  const shares = (num(f.market_cap) != null && fPrice > 0) ? f.market_cap / fPrice : (num(src.shares) ?? null);
  const bal = [...(src.balance || [])].filter((b) => num(b.net_debt) != null || (num(b.total_debt) != null && num(b.cash_and_equiv) != null))
    .sort((a, b) => String(b.fiscal_date).localeCompare(String(a.fiscal_date)))[0] || null;
  const netDebt = bal ? (num(bal.net_debt) ?? (num(bal.total_debt) - num(bal.cash_and_equiv))) : null;
  const est = (src.estimates || []).filter((e) => (e.period || "annual") === "annual" && e.fiscal_date >= todayISO)
    .sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date));
  const [fy1, fy2] = est;
  /* CP3 (7 Oct) — ONE FORWARD BASIS. When the reader hands `src.forward` (lib/forward-basis.mjs: the dashboard's rule),
     the forward EPS is the NEXT FOUR QUARTERS' consensus in dollars, and "the year after" is the four quarters after
     those — so P/E forward, PEG, EPS growth and the implied prices all rest on the multiple the dashboard prints.
     The fiscal-year estimate this reader used before is kept beside it (eps_fy1_annual) for the before → after.
     A forward multiple under 2.5× is a wrong-basis estimate (the dashboard's guard): the EPS is withheld. */
  const fw = src.forward && src.forward.basis ? src.forward : null;
  let fwEps = fw ? fw.eps_usd : null, fwWhy = fw && fw.withheld && fw.eps_usd == null ? fw.why : null;
  if (fw && fwEps > 0 && price > 0 && price / fwEps < 2.5) { fwEps = null; fwWhy = "under 2.5×: the estimate is on the wrong basis"; }
  const rev = flow(src.incQ, src.incFY, "revenue");
  const gp = flow(src.incQ, src.incFY, "gross_profit");
  const oi = flow(src.incQ, src.incFY, "operating_income");
  const ebitda = flow(src.incQ, src.incFY, "ebitda");
  const capex = flow(src.cfQ, src.cfFY, "capex", { abs: true });
  const ocf = flow(src.cfQ, src.cfFY, "operating_cf");
  let fcf = flow(src.cfQ, src.cfFY, "free_cf");
  if (fcf.now == null && ocf.now != null && capex.now != null) fcf = { ...ocf, now: ocf.now - capex.now, prior: null, derived: true };
  const capexFY = (src.cfFY || []).filter((r) => num(r.capex) != null).map((r) => ({
    fiscal_date: r.fiscal_date, year: String(r.fiscal_year ?? String(r.fiscal_date).slice(0, 4)), capex: Math.abs(num(r.capex)),
    revenue: num(((src.incFY || []).find((i) => i.fiscal_date === r.fiscal_date || (i.fiscal_year != null && i.fiscal_year === r.fiscal_year)) || {}).revenue),
  })).sort((a, b) => String(a.fiscal_date).localeCompare(String(b.fiscal_date))).slice(-5);
  return {
    ticker: src.ticker, name: p.name || src.name || null, industry: p.industry || null, is_etf: !!p.is_etf,
    tags: src.tags || [],
    price, price_date: src.price_date || (q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : f.date || null),
    shares, mcap: shares != null && price != null ? shares * price : num(f.market_cap), mcap_on_file: num(f.market_cap),
    net_debt: netDebt, net_debt_date: bal ? bal.fiscal_date : null,
    eps_ttm: num(f.eps_ttm), fund_date: f.date || null,
    eps_fy1: fw ? fwEps : num(fy1?.est_eps_avg), eps_fy2: fw ? (fwEps == null ? null : fw.eps_following_usd) : num(fy2?.est_eps_avg),
    rev_fy1: fw ? fw.revenue_usd : num(fy1?.est_revenue_avg), rev_fy2: fw ? fw.revenue_following_usd : num(fy2?.est_revenue_avg),
    fy1_date: fw ? fw.through : fy1?.fiscal_date || null, fy2_date: fw ? fw.following_through : fy2?.fiscal_date || null,
    fwd_basis: fw ? { basis: fw.basis, label: fw.label, growth_basis: fw.growth_basis, growth_from: fw.growth_from, flags: fw.flags || [], rate: fw.rate || null, why: fwWhy } : null,
    eps_fy1_annual: num(fy1?.est_eps_avg), eps_fy2_annual: num(fy2?.est_eps_avg), fy1_annual_date: fy1?.fiscal_date || null,
    rev, gp, oi, ebitda, capex, ocf, fcf, capexFY,
    revenue_ttm_on_file: num(f.revenue_ttm),
    next_report: src.next_report || null,
  };
}

/* ---- the components for one company -------------------------------------------------------------- */

const ratio = (a, b) => { const x = num(a), y = num(b); return (x == null || y == null || y === 0) ? null : x / y; };
const posRatio = (a, b) => { const x = num(a), y = num(b); return (x == null || y == null || y <= 0 || x <= 0) ? null : x / y; };

/** Every component value (or null) with the reason a value is missing. */
export function components(inp) {
  const v = {}, why = {};
  const set = (k, val, reason) => { v[k] = val == null || !isFinite(val) ? null : val; if (v[k] == null) why[k] = reason; };
  const revNow = inp.rev.now ?? inp.revenue_ttm_on_file;
  const ev = (inp.mcap != null && inp.net_debt != null) ? inp.mcap + inp.net_debt : null;
  set("pe_ttm", posRatio(inp.price, inp.eps_ttm), inp.eps_ttm == null ? "no trailing EPS on file" : "trailing EPS is not positive");
  set("pe_fwd", posRatio(inp.price, inp.eps_fy1), inp.eps_fy1 == null ? "no EPS estimate on file" : "estimated EPS is not positive");
  set("ev_sales", ev == null ? null : posRatio(ev, revNow), ev == null ? "no net debt or market value on file" : "no revenue on file");
  set("ev_ebitda", ev == null ? null : posRatio(ev, inp.ebitda.now), inp.ebitda.now == null ? "no EBITDA history on file" : inp.ebitda.now <= 0 ? "EBITDA is not positive" : "no net debt on file");
  const epsG = growthPct(inp.eps_fy2, inp.eps_fy1);
  set("eps_g_fy", epsG, inp.eps_fy1 == null || inp.eps_fy2 == null ? "two EPS estimates are needed" : "this year's EPS estimate is not positive");
  const pf = v.pe_fwd;
  set("peg", (pf != null && epsG != null && epsG > 0) ? pf / epsG : null, pf == null ? "no forward P/E" : "EPS is not expected to grow, so PEG means nothing");
  set("rev_g_fy", growthPct(inp.rev_fy2, inp.rev_fy1), "two revenue estimates are needed");
  set("rev_g_ttm", growthPct(inp.rev.now, inp.rev.prior), inp.rev.now == null ? "no revenue history on file" : "no year-before revenue to compare");
  set("gm", inp.gp.now != null && revNow > 0 ? inp.gp.now / revNow * 100 : null, "no gross profit history on file");
  set("om", inp.oi.now != null && revNow > 0 ? inp.oi.now / revNow * 100 : null, "no operating income history on file");
  set("fcfm", inp.fcf.now != null && revNow > 0 ? inp.fcf.now / revNow * 100 : null, "no cash-flow history on file");
  set("capex", inp.capex.now, "no cash-flow history on file");
  set("capex_rev", inp.capex.now != null && revNow > 0 ? inp.capex.now / revNow * 100 : null, inp.capex.now == null ? "no cash-flow history on file" : "no revenue on file");
  set("capex_g", growthPct(inp.capex.now, inp.capex.prior), inp.capex.now == null ? "no cash-flow history on file" : "no year-before CapEx to compare");
  set("results", (v.rev_g_ttm != null && v.capex_g != null) ? v.rev_g_ttm - v.capex_g : null, "needs both revenue growth and CapEx growth");
  set("rev_per_capex", (inp.rev.now != null && inp.rev.prior != null && inp.capex.prior > 0) ? (inp.rev.now - inp.rev.prior) / inp.capex.prior : null, "needs two years of revenue and the year-before CapEx");
  const eb = num(inp.ebitda.now);
  set("nd_ebitda", (inp.net_debt != null && eb != null && eb > 0) ? inp.net_debt / eb : null, eb == null ? "no EBITDA history on file" : eb <= 0 ? "EBITDA is not positive" : "no net debt on file");
  return { v, why, ev };
}

/* ---- implied value per share at a peer multiple -------------------------------------------------- */

/** Price per share the company would carry at multiple m on valuation row key; null when the row cannot price it. */
export function impliedPrice(key, m, inp) {
  const M = num(m);
  if (M == null) return null;
  const nd = num(inp.net_debt), sh = num(inp.shares);
  const revNow = inp.rev?.now ?? inp.revenue_ttm_on_file;
  let p = null;
  if (key === "pe_ttm") p = inp.eps_ttm > 0 ? M * inp.eps_ttm : null;
  else if (key === "pe_fwd") p = inp.eps_fy1 > 0 ? M * inp.eps_fy1 : null;
  else if (key === "ev_sales") p = (revNow > 0 && nd != null && sh > 0) ? (M * revNow - nd) / sh : null;
  else if (key === "ev_ebitda") p = (inp.ebitda?.now > 0 && nd != null && sh > 0) ? (M * inp.ebitda.now - nd) / sh : null;
  else if (key === "peg") { const g = growthPct(inp.eps_fy2, inp.eps_fy1); p = (g != null && g > 0 && inp.eps_fy1 > 0) ? M * g * inp.eps_fy1 : null; }
  return p == null || !isFinite(p) ? null : Math.max(0, p);
}

/* ---- the whole comps read for one company ------------------------------------------------------ */

/** subject: buildInputs() of the company; peers: buildInputs() of the others; out: tickers knocked out.
    Returns one row per component, and the valuation field with its overlap band. */
export function compsRead(subject, peers, { out = new Set(), use = "mid", nm = true } = {}) {
  const me = components(subject);
  const live = peers.filter((p) => p.ticker !== subject.ticker && !p.is_etf && !out.has(p.ticker));
  const pc = live.map((p) => ({ ticker: p.ticker, ...components(p) }));
  const rows = COMPONENTS.map((c) => {
    const raw = pc.map((p) => ({ ticker: p.ticker, value: p.v[c.key] }));
    const nmList = nm ? raw.filter((x) => isNM(c.key, x.value)) : [];
    const vals = raw.map((x) => nmList.includes(x) ? { ...x, value: null, nm: x.value } : x);
    const b = peerBand(vals.map((x) => x.value));
    const value = me.v[c.key];
    return {
      key: c.key, group: c.group, label: c.label, fmt: c.fmt, better: c.better, basis: c.basis,
      value, why: me.why[c.key] || null, band: b,
      peers: vals, missing: vals.filter((x) => x.value == null && x.nm == null).map((x) => x.ticker),
      nm: nmList.map((x) => ({ ticker: x.ticker, value: x.value })), own_nm: nm && isNM(c.key, value),
      verdict: verdict(c, value, b.median),
    };
  });
  const field = VALUATION.map((k) => valuationBar(k, rows.find((r) => r.key === k), subject)).filter(Boolean);
  const band = overlapBand(field.filter((f) => f.ok).map((f) => ({ key: f.key, lo: use === "full" ? f.at.min : f.at.q1, hi: use === "full" ? f.at.max : f.at.q3, mid: f.at.median })));
  return { ticker: subject.ticker, rows, field, band, use, nm, peersIn: live.map((p) => p.ticker), price: subject.price, fair: fairSummary(band, field, subject.price) };
}

/** One valuation bar: the implied price at the peer low, quartiles, median and high. */
export function valuationBar(key, row, inp) {
  if (!row) return null;
  const b = row.band;
  const at = { min: impliedPrice(key, b.min, inp), q1: impliedPrice(key, b.q1, inp), median: impliedPrice(key, b.median, inp), q3: impliedPrice(key, b.q3, inp), max: impliedPrice(key, b.max, inp) };
  const ok = b.n >= 2 && at.min != null && at.max != null && at.median != null;
  const reason = ok ? null : row.value == null && row.why && at.median == null ? `the company cannot be priced on this row: ${row.why}` : b.n < 2 ? `only ${b.n} peer${b.n === 1 ? "" : "s"} carr${b.n === 1 ? "ies" : "y"} this multiple — a range needs two` : `the company cannot be priced on this row: ${row.why || "its own number is missing"}`;
  return { key, label: row.label, n: b.n, band: b, at, ok, reason, own: row.value, upside: at.median != null && inp.price > 0 ? (at.median / inp.price - 1) * 100 : null };
}

/** The stretch covered by the most bars. bars: [{key, lo, hi, mid}]. */
export function overlapBand(bars) {
  const B = bars.filter((b) => num(b.lo) != null && num(b.hi) != null).map((b) => ({ ...b, lo: Math.min(b.lo, b.hi), hi: Math.max(b.lo, b.hi) }));
  if (!B.length) return { lo: null, hi: null, count: 0, of: 0, keys: [], reason: "no valuation row can price the company" };
  const ends = [...new Set(B.flatMap((b) => [b.lo, b.hi]))].sort((a, b) => a - b);
  const cand = [];
  for (let i = 0; i < ends.length; i++) { cand.push(ends[i]); if (i < ends.length - 1) cand.push((ends[i] + ends[i + 1]) / 2); }
  const cover = (x) => B.filter((b) => b.lo <= x && x <= b.hi);
  const counts = cand.map((x) => cover(x).length);
  const best = Math.max(...counts);
  if (B.length >= 2 && best < 2) return { lo: null, hi: null, count: 1, of: B.length, keys: [], reason: "no two valuation rows overlap" };
  const runs = [];
  for (let i = 0; i < cand.length; i++) {
    if (counts[i] !== best) continue;
    if (runs.length && runs[runs.length - 1].end === i - 1) runs[runs.length - 1].end = i; else runs.push({ start: i, end: i });
  }
  const mids = median(B.map((b) => num(b.mid)).filter((x) => x != null));
  const pick = runs.find((r) => mids != null && cand[r.start] <= mids && mids <= cand[r.end])
    || runs.reduce((w, r) => (cand[r.end] - cand[r.start] > cand[w.end] - cand[w.start] ? r : w), runs[0]);
  const lo = cand[pick.start], hi = cand[pick.end];
  const keys = B.filter((b) => b.lo <= lo && hi <= b.hi).map((b) => b.key);
  return { lo, hi, count: best, of: B.length, keys, runs: runs.length, reason: null };
}

/** Price against the band, and the median of the implied-at-median prices. */
export function fairSummary(band, field, price) {
  const mids = field.filter((f) => f.ok).map((f) => f.at.median);
  const point = median(mids);
  const p = num(price);
  let where = null, toMid = null;
  if (band.lo != null && p != null) {
    where = p < band.lo ? "below" : p > band.hi ? "above" : "inside";
    toMid = ((band.lo + band.hi) / 2 / p - 1) * 100;
  }
  return { point, where, toMid, toPoint: point != null && p > 0 ? (point / p - 1) * 100 : null };
}

/** Favourable or not, against the peer median, in words. */
export function verdict(c, value, med) {
  if (value == null || med == null) return { side: null, word: "no comparison" };
  if (value === med) return { side: 0, word: "at the peer median" };
  const above = value > med;
  if (!c.better) return { side: 0, word: above ? "above the peer median" : "below the peer median" };
  const good = (c.better === "high") === above;
  const words = {
    VAL: above ? "dearer than the peers" : "cheaper than the peers",
    GROW: above ? "faster than the peers" : "slower than the peers",
    MARGIN: above ? "keeps more than the peers" : "keeps less than the peers",
    CAPEX: above ? "better results than the peers" : "weaker results than the peers",
    BAL: above ? "more indebted than the peers" : "lighter than the peers",
  };
  return { side: good ? 1 : -1, word: words[c.group] || (above ? "above the median" : "below the median") };
}

/* ---- where a value sits on a row --------------------------------------------------------------- */

/** Scale of one field row: covers the peer range AND the company, so the company is drawn even off the range. */
export function rowScale(band, value) {
  const xs = [band.min, band.max, value].map(num).filter((x) => x != null);
  if (!xs.length) return null;
  let lo = Math.min(...xs), hi = Math.max(...xs);
  if (lo === hi) { const d = Math.abs(lo) || 1; lo -= d * 0.5; hi += d * 0.5; }
  const pad = (hi - lo) * 0.04;
  lo -= pad; hi += pad;
  return { lo, hi, x: (v) => num(v) == null ? null : (v - lo) / (hi - lo) };
}

/* ---- words and numbers ------------------------------------------------------------------------- */

export function fmt(kind, v) {
  const n = num(v);
  if (n == null) return "—";
  const sgn = n < 0 ? "−" : "";
  switch (kind) {
    case "x": return sgn + Math.abs(n).toFixed(Math.abs(n) >= 100 ? 0 : 1) + "x";
    case "x2": return sgn + Math.abs(n).toFixed(2) + "x";
    case "pct": return (n > 0 ? "+" : sgn) + Math.abs(n).toFixed(Math.abs(n) >= 10 ? 0 : 1) + "%";
    case "pp": return (n > 0 ? "+" : sgn) + Math.abs(n).toFixed(0) + " pts";
    case "usd2": return sgn + "$" + Math.abs(n).toFixed(2);
    case "money": return money(n);
    case "price": return sgn + "$" + Math.abs(n).toFixed(Math.abs(n) >= 100 ? 0 : 2);
    default: return String(n);
  }
}
export const basisWord = (fl) => !fl || !fl.basis ? "no history" : fl.basis === "TTM" ? "TTM to " + dateWord(fl.to) + " " + String(fl.to).slice(0, 4) : "FY to " + dateWord(fl.to) + " " + String(fl.to).slice(0, 4);

/* ---- the three companies of the brief, and how each finds its peers ----------------------------- */
export const DEFAULT_COHORT = { GEV: "AI_POWERTRAIN", VST: "AI_POWERTRAIN", MU: "SEMICONDUCTORS" };
const SIZE_TAGS = ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP"];
/** The cohort a company is compared inside: the brief's own for GEV / VST / MU, else its first theme tag. */
export function cohortFor(ticker, tags, asked) {
  if (asked) return String(asked).toUpperCase();
  if (DEFAULT_COHORT[ticker]) return DEFAULT_COHORT[ticker];
  return (tags || []).find((t) => !SIZE_TAGS.includes(t)) || null;
}
