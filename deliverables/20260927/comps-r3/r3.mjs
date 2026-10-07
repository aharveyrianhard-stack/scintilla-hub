/* Scintilla · K3 · the full football field for ONE company: every round-1 table column as a row,
   the outliers named, and every bar end explained. Pure functions: no fetch, no clock, no DOM.
   The page and the tests import this same file.

   Builds on the round-2 arithmetic (../comps-single/comps.mjs: TTM flows, EV, implied prices, the
   overlap band) and the round-1 helpers (../../20260925/knockout/field.mjs: num, median, money, dates).
   Nothing there is changed; this file adds rows, the outlier rule and the labels.

   Definitions that are new here:
   · OUTLIER (Tukey's rule, a choice, not a fact): a peer value more than 1.5 × the middle half
     (the 75th percentile minus the 25th) beyond the nearer edge of that middle half. With fewer
     than four peers nobody is called an outlier: the middle half is too thin to measure.
   · WHO SETS THE ENDS: the peer with the lowest value sets the low end, the highest sets the high
     end. WHO SETS THE MEDIAN: the middle peer when the count is odd; the two middle peers, whose
     average is the median, when it is even.
   · BAND WITHOUT THEM: the same band (low, middle half, median, high) recomputed on the peers that
     are not outliers.
   · PRICE-TARGET BAND: analysts' lowest, median, average and highest targets for the company
     (price_target_consensus), or only the average when that is all the Hub holds
     (analyst_estimates.price_target_avg). It is drawn on the same $ axis as the comps bars and
     never enters the comps fair value: the analysts' opinion and the peers' multiples are two
     different measures and stay two different bars.
   · SIZE rows are drawn on a log axis when the cohort spans more than 50× between its smallest and
     largest: each tick is then ten times the one before, and the axis title says so. */

import { num, median, money, dateWord } from "../../20260925/knockout/field.mjs";
import {
  COMPONENTS as K2, buildInputs as k2Inputs, components as k2Components, impliedPrice, peerBand, quantile,
  overlapBand, growthPct, isNM, NM_CAP, quarterRun, flow,
} from "../comps-single/comps.mjs";

/* ---- the rows, grouped as the brief asks --------------------------------------------------------
   Every column of the round-1 table (deliverables/20260925/knockout) is here, plus the round-2 rows:
   round-1 · Size (cap class) · P/E trailing · P/E adjusted · P/E on the FY estimate · EPS growth next FY ·
   Revenue TTM · Revenue growth next FY · Analyst target over price · Market value · Net debt last FY ·
   Geiger · Usual day · Reports (days to the next report).
   better: which side of the peer median is favourable (null = describes, does not judge).
   axis: the words at the two ends of the row's axis, left then right. */
export const GROUPS = [
  { key: "SIZE",  label: "Size — how big the company is, and where it sits among the peers" },
  { key: "VAL",   label: "Valuation — what the market pays for a dollar of earnings, sales or EBITDA" },
  { key: "GROW",  label: "Growth" },
  { key: "PROF",  label: "Profitability — what is kept of each sales dollar" },
  { key: "CAPEX", label: "CapEx and results — how much is invested, and whether the sales keep up" },
  { key: "BAL",   label: "Balance sheet" },
  { key: "AN",    label: "Analysts" },
  { key: "TIME",  label: "Timing — round-1 columns that describe the tape, not the business" },
];
export const ROWS = [
  { key: "mcap",      group: "SIZE",  label: "Market value",                    fmt: "money", better: null,   log: true,  axis: ["smaller", "bigger"],   basis: "shares × today's price (shares = market value ÷ price on the fundamentals row)" },
  { key: "rev_ttm",   group: "SIZE",  label: "Revenue, TTM",                    fmt: "money", better: null,   log: true,  axis: ["smaller", "bigger"],   basis: "the newest four quarters' revenue, or the last fiscal year when four are not on file" },
  { key: "ev",        group: "SIZE",  label: "Enterprise value",                fmt: "money", better: null,   log: true,  axis: ["smaller", "bigger"],   basis: "market value + net debt" },
  { key: "net_debt",  group: "SIZE",  label: "Net debt, newest balance",        fmt: "money", better: "low",              axis: ["net cash", "more debt"], basis: "debt − cash at the newest balance date; below zero is net cash" },
  { key: "pe_ttm",    group: "VAL",   label: "P/E, trailing",                   fmt: "x",     better: "low",  implied: true, axis: ["cheaper", "dearer"], basis: "price ÷ EPS over the last twelve months" },
  { key: "pe_adj",    group: "VAL",   label: "P/E, adjusted",                   fmt: "x",     better: "low",              axis: ["cheaper", "dearer"], basis: "the Hub's adjusted P/E on the fundamentals row (adjusted_pe, as stored)" },
  { key: "pe_fwd",    group: "VAL",   label: "P/E, forward",                    fmt: "x",     better: "low",  implied: true, axis: ["cheaper", "dearer"], basis: "price ÷ analysts' EPS for the next four quarters (the dashboard's forward P/E)" },
  { key: "ev_sales",  group: "VAL",   label: "EV / sales",                      fmt: "x",     better: "low",  implied: true, axis: ["cheaper", "dearer"], basis: "enterprise value ÷ revenue, TTM" },
  { key: "ev_ebitda", group: "VAL",   label: "EV / EBITDA",                     fmt: "x",     better: "low",  implied: true, axis: ["cheaper", "dearer"], basis: "enterprise value ÷ EBITDA, TTM" },
  { key: "peg",       group: "VAL",   label: "PEG",                             fmt: "x2",    better: "low",  implied: true, axis: ["cheaper", "dearer"], basis: "forward P/E ÷ EPS growth into the following year, in %" },
  { key: "rev_g_ttm", group: "GROW",  label: "Revenue growth, TTM",             fmt: "pct",   better: "high",             axis: ["slower", "faster"], basis: "revenue TTM over the twelve months before" },
  { key: "rev_g_fy",  group: "GROW",  label: "Revenue growth, next FY est",     fmt: "pct",   better: "high",             axis: ["slower", "faster"], basis: "analysts' revenue, next fiscal year over this one" },
  { key: "eps_g_fy",  group: "GROW",  label: "EPS growth, next FY est",         fmt: "pct",   better: "high",             axis: ["slower", "faster"], basis: "analysts' EPS, next fiscal year over this one" },
  { key: "gm",        group: "PROF",  label: "Gross margin, TTM",               fmt: "pct",   better: "high",             axis: ["keeps less", "keeps more"], basis: "gross profit ÷ revenue" },
  { key: "om",        group: "PROF",  label: "Operating margin, TTM",           fmt: "pct",   better: "high",             axis: ["keeps less", "keeps more"], basis: "operating income ÷ revenue" },
  { key: "fcfm",      group: "PROF",  label: "FCF margin, TTM",                 fmt: "pct",   better: "high",             axis: ["keeps less", "keeps more"], basis: "free cash flow ÷ revenue" },
  { key: "capex",     group: "CAPEX", label: "CapEx, TTM",                      fmt: "money", better: null,   log: true,  axis: ["spends less", "spends more"], basis: "cash spent on plant and equipment, last twelve months" },
  { key: "capex_rev", group: "CAPEX", label: "CapEx / revenue",                 fmt: "pct",   better: null,               axis: ["lighter", "heavier"], basis: "how much of each sales dollar goes back into the business" },
  { key: "capex_g",   group: "CAPEX", label: "CapEx growth, TTM",               fmt: "pct",   better: null,               axis: ["slower", "faster"], basis: "CapEx TTM over the twelve months before" },
  { key: "results",   group: "CAPEX", label: "Revenue growth − CapEx growth",   fmt: "pp",    better: "high",             axis: ["spending ahead of sales", "sales ahead of spending"], basis: "above zero: sales are growing faster than the spending" },
  { key: "rev_per_capex", group: "CAPEX", label: "New revenue per CapEx dollar", fmt: "usd2", better: "high",            axis: ["less", "more"], basis: "revenue added this year ÷ CapEx spent the year before" },
  { key: "nd_ebitda", group: "BAL",   label: "Net debt / EBITDA",               fmt: "x",     better: "low",              axis: ["lighter", "more indebted"], basis: "years of EBITDA to pay the net debt; below zero is net cash" },
  { key: "target_upside", group: "AN", label: "Analyst target over price",      fmt: "pct",   better: "high",             axis: ["less room", "more room"], basis: "analysts' average price target ÷ today's price − 1" },
  { key: "geiger",    group: "TIME",  label: "Geiger (board source)",           fmt: "signed", better: null,              axis: ["colder", "hotter"], basis: "composite_staged, daily, as the board reads it" },
  { key: "usual",     group: "TIME",  label: "Usual day, 60 sessions",          fmt: "pct1",  better: null,               axis: ["calmer", "wilder"], basis: "the typical daily move over the last 60 sessions (ticker_heartbeat_daily)" },
  { key: "report_days", group: "TIME", label: "Days to the next report",        fmt: "days",  better: null,               axis: ["sooner", "later"], basis: "calendar days from today to the next earnings date on file" },
];
export const row = (key) => ROWS.find((r) => r.key === key);
export const VALUATION = ROWS.filter((r) => r.implied).map((r) => r.key);
export const OUTLIER_K = 1.5;
export const LOG_SPAN = 50;

/* ---- inputs: round 2's, plus the round-1 columns ------------------------------------------------- */

/** src: round 2's source object, plus adjusted_pe on fundamentals, target (price_target_consensus row),
    geiger (composite_staged row), heartbeat (ticker_heartbeat_daily row) and next_report. */
export function buildInputs(src, todayISO) {
  const inp = k2Inputs(src, todayISO);
  const f = src.fundamentals || {};
  inp.adjusted_pe = num(f.adjusted_pe);
  inp.trailing_pe_on_file = num(f.trailing_pe);
  inp.target = targetOf(src, todayISO);
  inp.geiger = num(src.geiger && src.geiger.composite);
  inp.geiger_date = src.geiger && src.geiger.updated_ts != null ? src.geiger.updated_ts : null;
  inp.usual = num(src.heartbeat && src.heartbeat.usual_day_60);
  inp.usual_date = src.heartbeat ? src.heartbeat.date || null : null;
  inp.report_days = inp.next_report && inp.next_report.date ? calendarDays(todayISO, inp.next_report.date) : null;
  return inp;
}
export const calendarDays = (fromISO, toISO) => Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86400e3);

/** The analysts' target band for one company. */
export function targetOf(src, todayISO) {
  const c = src.target || null;
  if (c && (num(c.target_avg) != null || num(c.target_median) != null)) {
    return { low: num(c.target_low), avg: num(c.target_avg), median: num(c.target_median), high: num(c.target_high), n: num(c.num_analysts), date: c.updated_ts != null ? c.updated_ts : null, from: "price_target_consensus" };
  }
  const fy = (src.estimates || []).filter((e) => (e.period || "annual") === "annual" && e.fiscal_date >= todayISO).sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date))[0];
  const avg = num(fy && fy.price_target_avg);
  if (avg != null) return { low: null, avg, median: null, high: null, n: null, date: fy.updated_ts != null ? fy.updated_ts : null, from: "analyst_estimates.price_target_avg" };
  return { low: null, avg: null, median: null, high: null, n: null, date: null, from: null };
}

/* ---- every row's value for one company ---------------------------------------------------------- */

export function components(inp) {
  const k = k2Components(inp);
  const v = { ...k.v }, why = { ...k.why };
  const set = (key, val, reason) => { v[key] = val == null || !isFinite(val) ? null : val; if (v[key] == null) why[key] = reason; };
  set("mcap", inp.mcap, "no market value on file");
  set("rev_ttm", inp.rev.now ?? inp.revenue_ttm_on_file, "no revenue on file");
  set("ev", k.ev, "no net debt or market value on file");
  set("net_debt", inp.net_debt, "no balance sheet on file");
  set("pe_adj", inp.adjusted_pe > 0 ? inp.adjusted_pe : null, inp.adjusted_pe == null ? "no adjusted P/E on file" : "adjusted P/E is not positive");
  const t = inp.target || {};
  set("target_upside", (t.avg > 0 && inp.price > 0) ? (t.avg / inp.price - 1) * 100 : null, t.avg == null ? "no analyst target on file" : "no price");
  set("geiger", inp.geiger, "no Geiger row on file");
  set("usual", inp.usual, "no heartbeat row on file");
  set("report_days", inp.report_days, "no next report date on file");
  return { v, why, ev: k.ev };
}

/* ---- who sets what, and the outliers ------------------------------------------------------------- */

/** vals: [{ticker, value}] — nulls are dropped. Returns the sorted peers and who sets the ends and the median. */
export function whoSets(vals) {
  const s = vals.filter((x) => num(x.value) != null).sort((a, b) => a.value - b.value);
  if (!s.length) return { n: 0, low: null, high: null, median: [] };
  const n = s.length, mid = (n - 1) / 2;
  const med = n % 2 ? [s[mid].ticker] : [s[Math.floor(mid)].ticker, s[Math.ceil(mid)].ticker];
  return { n, low: s[0].ticker, high: s[n - 1].ticker, median: med, sorted: s };
}

/** Tukey's fences on the peer values. out: the outliers with their side; kept: the rest; bands for both. */
export function outliers(vals, k = OUTLIER_K) {
  const s = vals.filter((x) => num(x.value) != null);
  const all = peerBand(s.map((x) => x.value));
  if (s.length < 4) return { rule: `fewer than four peers, so nobody is called an outlier`, fence: null, out: [], kept: s, all, kept_band: all, k };
  const iqr = all.q3 - all.q1;
  const fence = { lo: all.q1 - k * iqr, hi: all.q3 + k * iqr };
  const out = s.filter((x) => x.value < fence.lo || x.value > fence.hi).map((x) => ({ ...x, side: x.value < fence.lo ? "low" : "high" }));
  const kept = s.filter((x) => !out.some((o) => o.ticker === x.ticker));
  return { rule: `beyond ${k}× the middle half from its edge (Tukey)`, fence, out, kept, all, kept_band: peerBand(kept.map((x) => x.value)), k };
}

/* ---- one row of the field ---------------------------------------------------------------------- */

/** peers: [{ticker, value}] of the peers still in. Returns the row with both bands and the words. */
export function rowRead(key, value, peers, { outOut = false, nm = true } = {}) {
  const r = row(key);
  const raw = peers.map((p) => ({ ticker: p.ticker, value: num(p.value) }));
  const nmList = nm ? raw.filter((x) => isNM(key, x.value)) : [];
  const usable = raw.filter((x) => x.value != null && !nmList.includes(x));
  const o = outliers(usable);
  const used = outOut ? o.kept : usable;
  const band = outOut ? o.kept_band : o.all;
  const sets = whoSets(used);
  return {
    key, group: r.group, label: r.label, fmt: r.fmt, better: r.better, basis: r.basis, axis: r.axis, log: !!r.log,
    value, band, n: band.n, peers: used, sets,
    outliers: o, outOut,
    missing: raw.filter((x) => x.value == null).map((x) => x.ticker),
    nm: nmList.map((x) => ({ ticker: x.ticker, value: x.value })), own_nm: nm && isNM(key, value),
    verdict: verdict(r, value, band.median),
    position: positionIn(used.map((x) => x.value), value),
  };
}

/** Where a value sits among the peers: rank from the top, the share of the peer range it is along, the neighbours. */
export function positionIn(values, own) {
  const v = values.map(num).filter((x) => x != null).sort((a, b) => a - b);
  const x = num(own);
  if (x == null || !v.length) return null;
  const above = v.filter((y) => y > x).length, below = v.filter((y) => y < x).length;
  const lo = v[0], hi = v[v.length - 1];
  const along = hi > lo ? (x - lo) / (hi - lo) : 0.5;
  return { rank: above + 1, of: v.length + 1, above, below, along, where: x < lo ? "below the peer range" : x > hi ? "above the peer range" : "inside the peer range" };
}

/** Favourable or not, against the peer median, in words for this row's group. */
export function verdict(r, value, med) {
  if (num(value) == null || num(med) == null) return { side: null, word: "no comparison" };
  if (value === med) return { side: 0, word: "at the peer median" };
  const above = value > med;
  const words = {
    SIZE: above ? "bigger than the median peer" : "smaller than the median peer",
    VAL: above ? "dearer than the peers" : "cheaper than the peers",
    GROW: above ? "faster than the peers" : "slower than the peers",
    PROF: above ? "keeps more than the peers" : "keeps less than the peers",
    CAPEX: above ? "above the peer median" : "below the peer median",
    BAL: above ? "more indebted than the peers" : "lighter than the peers",
    AN: above ? "more room to the target than the peers" : "less room to the target than the peers",
    TIME: above ? "above the peer median" : "below the peer median",
  };
  if (r.key === "results") words.CAPEX = above ? "better results than the peers" : "weaker results than the peers";
  if (r.key === "net_debt") words.SIZE = above ? "more net debt than the median peer" : "less net debt than the median peer";
  const good = r.better ? (r.better === "high") === above : null;
  return { side: good == null ? 0 : good ? 1 : -1, word: words[r.group] };
}

/* ---- the $ football field: implied price per share, every end explained ------------------------- */

/** The company's own figure that a multiple is applied to on this row, in words and numbers. */
export function ownFigure(key, inp) {
  const revNow = inp.rev?.now ?? inp.revenue_ttm_on_file;
  if (key === "pe_ttm") return { word: "EPS, last twelve months", value: inp.eps_ttm, fmt: "usd2", formula: "multiple × EPS" };
  if (key === "pe_fwd") return { word: inp.fwd_basis ? "EPS estimate, " + inp.fwd_basis.label : "EPS estimate, FY" + (inp.fy1_date ? String(inp.fy1_date).slice(0, 4) : "?"), value: inp.eps_fy1, fmt: "usd2", formula: "multiple × EPS" };   /* CP3: the one forward basis names itself */
  if (key === "ev_sales") return { word: "revenue TTM", value: revNow, fmt: "money", formula: "(multiple × revenue − net debt) ÷ shares" };
  if (key === "ev_ebitda") return { word: "EBITDA TTM", value: inp.ebitda?.now, fmt: "money", formula: "(multiple × EBITDA − net debt) ÷ shares" };
  if (key === "peg") { const g = growthPct(inp.eps_fy2, inp.eps_fy1); return { word: inp.fwd_basis ? "EPS growth into the following year × EPS estimate" : "EPS growth next FY × EPS estimate", value: g != null && inp.eps_fy1 != null ? g * inp.eps_fy1 : null, fmt: "usd2", formula: "PEG × growth % × EPS", growth: g }; }
  return null;
}

/** One valuation bar with each end explained: the multiple, whose it is, and the price it implies. */
export function priceBar(key, rd, inp) {
  const b = rd.band, sets = rd.sets;
  const at = (m, who) => ({ m, who, price: impliedPrice(key, m, inp) });
  const ends = { min: at(b.min, sets.low ? [sets.low] : []), q1: at(b.q1, []), median: at(b.median, sets.median || []), q3: at(b.q3, []), max: at(b.max, sets.high ? [sets.high] : []) };
  const ok = b.n >= 2 && ends.min.price != null && ends.max.price != null && ends.median.price != null;
  const reason = ok ? null : b.n < 2 ? `only ${b.n} peer${b.n === 1 ? "" : "s"} carr${b.n === 1 ? "ies" : "y"} this multiple — a range needs two` : `${inp.ticker} cannot be priced on this row: ${rd.why || rd.verdict.word === "no comparison" && rd.value == null ? (rd.why || "its own figure is missing or not positive") : "its own figure is missing or not positive"}`;
  return { key, label: rd.label, n: b.n, band: b, ends, ok, reason, own: rd.value, figure: ownFigure(key, inp),
    upside: ends.median.price != null && inp.price > 0 ? (ends.median.price / inp.price - 1) * 100 : null,
    outliers: rd.outliers, outOut: rd.outOut };
}

/** The overlap band with its two edges explained: which row's end sets the left edge and which the right. */
export function fairBand(bars, use = "mid") {
  const lo_k = use === "full" ? "min" : "q1", hi_k = use === "full" ? "max" : "q3";
  const B = bars.filter((f) => f.ok).map((f) => ({ key: f.key, label: f.label, lo: f.ends[lo_k].price, hi: f.ends[hi_k].price, mid: f.ends.median.price, loM: f.ends[lo_k].m, hiM: f.ends[hi_k].m }));
  const band = overlapBand(B);
  if (band.lo == null) return { ...band, use, edge: null, outside: B.map((b) => b.key) };
  const inside = B.filter((b) => band.keys.includes(b.key));
  const setsLo = inside.find((b) => Math.abs(b.lo - band.lo) < 1e-9) || null;
  const setsHi = inside.find((b) => Math.abs(b.hi - band.hi) < 1e-9) || null;
  const endWord = use === "full" ? { lo: "peer-low", hi: "peer-high" } : { lo: "25th-percentile", hi: "75th-percentile" };
  return {
    ...band, use,
    edge: {
      lo: setsLo ? { key: setsLo.key, label: setsLo.label, m: setsLo.loM, word: `${setsLo.label} at its ${endWord.lo} multiple` } : null,
      hi: setsHi ? { key: setsHi.key, label: setsHi.label, m: setsHi.hiM, word: `${setsHi.label} at its ${endWord.hi} multiple` } : null,
      rule: use === "full" ? "left edge = the highest low among the agreeing rows; right edge = the lowest high" : "left edge = the highest 25th-percentile price among the agreeing rows; right edge = the lowest 75th-percentile price",
    },
    outside: B.filter((b) => !band.keys.includes(b.key)).map((b) => ({ key: b.key, label: b.label, where: b.lo > band.hi ? "entirely above the band" : b.hi < band.lo ? "entirely below the band" : "crosses the band but does not cover it" })),
  };
}

/** The analysts' target bar on the $ axis, and where the price and the comps band sit against it. */
export function targetBar(inp, band) {
  const t = inp.target || {};
  if (t.avg == null && t.median == null) return { ok: false, reason: "no analyst target on file", from: t.from };
  const p = num(inp.price);
  const mid = t.median ?? t.avg;
  const lo = t.low ?? mid, hi = t.high ?? mid;
  return {
    ok: true, low: t.low, avg: t.avg, median: t.median, high: t.high, n: t.n, date: t.date, from: t.from, hasRange: t.low != null && t.high != null,
    upside: p > 0 ? { low: t.low != null ? (t.low / p - 1) * 100 : null, mid: (mid / p - 1) * 100, high: t.high != null ? (t.high / p - 1) * 100 : null } : null,
    vsBand: band && band.lo != null ? (hi < band.lo ? "the whole analyst band is below the comps band" : lo > band.hi ? "the whole analyst band is above the comps band" : "the analyst band and the comps band overlap") : null,
  };
}

/* ---- the whole read for one company ------------------------------------------------------------ */

/** subject and peers: buildInputs() rows. out: tickers knocked out. outOut: drop Tukey outliers row by row. */
export function compsRead(subject, peers, { out = new Set(), use = "mid", nm = true, outOut = false } = {}) {
  const me = components(subject);
  const live = peers.filter((p) => p.ticker !== subject.ticker && !p.is_etf && !out.has(p.ticker));
  const pc = live.map((p) => ({ ticker: p.ticker, ...components(p) }));
  const rows = ROWS.map((r) => {
    const rd = rowRead(r.key, me.v[r.key], pc.map((p) => ({ ticker: p.ticker, value: p.v[r.key] })), { outOut, nm });
    rd.why = me.why[r.key] || null;
    return rd;
  });
  const bars = VALUATION.map((k) => priceBar(k, rows.find((x) => x.key === k), subject));
  const band = fairBand(bars, use);
  const target = targetBar(subject, band);
  const size = rows.find((x) => x.key === "mcap");
  return { ticker: subject.ticker, rows, bars, band, target, size, use, nm, outOut, peersIn: live.map((p) => p.ticker), price: subject.price, fair: fairSummary(band, bars, subject.price) };
}

export function fairSummary(band, bars, price) {
  const mids = bars.filter((f) => f.ok).map((f) => f.ends.median.price);
  const point = median(mids);
  const p = num(price);
  let where = null, toMid = null;
  if (band.lo != null && p != null) { where = p < band.lo ? "below" : p > band.hi ? "above" : "inside"; toMid = ((band.lo + band.hi) / 2 / p - 1) * 100; }
  return { point, where, toMid, toPoint: point != null && p > 0 ? (point / p - 1) * 100 : null };
}

/* ---- axes ------------------------------------------------------------------------------------- */

/** Nice tick values between lo and hi (about n of them). */
export function niceTicks(lo, hi, n = 5) {
  if (!(hi > lo)) return [lo];
  const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
  const out = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

/** The scale of one field row: covers every peer (outliers too, so they are seen) and the company.
    log: base-10 when the row allows it and the positive span exceeds LOG_SPAN. Returns {lo, hi, log, x(v), ticks}. */
export function rowScale(values, own, { log = false } = {}) {
  const xs = [...values, own].map(num).filter((x) => x != null);
  if (!xs.length) return null;
  let lo = Math.min(...xs), hi = Math.max(...xs);
  const useLog = log && lo > 0 && hi / lo > LOG_SPAN;
  if (useLog) {
    const L = Math.log10, a = Math.floor(L(lo)), b = Math.ceil(L(hi));
    const ticks = []; for (let e = a; e <= b; e++) ticks.push(Math.pow(10, e));
    return { lo: Math.pow(10, a), hi: Math.pow(10, b), log: true, ticks, x: (v) => num(v) == null || v <= 0 ? null : (L(v) - a) / (b - a) };
  }
  if (lo === hi) { const d = Math.abs(lo) || 1; lo -= d * 0.5; hi += d * 0.5; }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const ticks = niceTicks(lo, hi, 5);
  return { lo, hi, log: false, ticks, x: (v) => num(v) == null ? null : (v - lo) / (hi - lo) };
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
    case "pct1": return Math.abs(n).toFixed(1) + "%";
    case "pp": return (n > 0 ? "+" : sgn) + Math.abs(n).toFixed(0) + " pts";
    case "usd2": return sgn + "$" + Math.abs(n).toFixed(2);
    case "money": return (n < 0 ? "−" : "") + money(Math.abs(n));
    case "price": return sgn + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2, minimumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
    case "signed": return (n > 0 ? "+" : sgn) + Math.abs(n).toFixed(3);
    case "days": return Math.round(n) + " d";
    default: return String(n);
  }
}

/** The one-line explanation of a bar end: "9.9x (AVGO) × EPS FY2027 $158.27 = $1,565". */
export function endWords(bar, which) {
  const e = bar.ends[which], f = bar.figure;
  if (!e || e.price == null) return "—";
  const who = e.who && e.who.length ? " (" + e.who.join(" & ") + ")" : "";
  const m = fmt(row(bar.key).fmt, e.m);
  if (!f) return `${m}${who} → ${fmt("price", e.price)}`;
  if (bar.key === "peg") return `${m}${who} × ${fmt("pct", f.growth)} growth × EPS ${fmt("usd2", f.value / (f.growth || 1))} = ${fmt("price", e.price)}`;
  if (bar.key === "ev_sales" || bar.key === "ev_ebitda") return `${m}${who} × ${f.word} ${fmt("money", f.value)}, less net debt, ÷ shares = ${fmt("price", e.price)}`;
  return `${m}${who} × ${f.word} ${fmt("usd2", f.value)} = ${fmt("price", e.price)}`;
}

/** The outlier line under a row, in words. */
export function outlierWords(rd) {
  const o = rd.outliers, f = rd.fmt;
  const ends = rd.sets.n ? `low end ${rd.sets.low} · high end ${rd.sets.high} · median set by ${rd.sets.median.join(" & ")}` : "no peer carries this row";
  if (!o.out.length) return `${ends} · no outlier by the rule (${o.rule})`;
  const list = o.out.map((x) => `${x.ticker} ${fmt(f, x.value)} (${x.side})`).join(", ");
  const kb = o.kept_band;
  const without = kb.n ? `without ${o.out.length === 1 ? "it" : "them"}: ${fmt(f, kb.min)} – ${fmt(f, kb.max)}, median ${fmt(f, kb.median)}` : "nothing is left without them";
  return `${ends} · outlier${o.out.length === 1 ? "" : "s"}: ${list} · ${without}`;
}

/* ---- the three companies of the brief ---------------------------------------------------------- */
export const DEFAULT_COHORT = { GEV: "AI_POWERTRAIN", VST: "AI_POWERTRAIN", MU: "SEMICONDUCTORS", NVDA: "SEMICONDUCTORS" };
const SIZE_TAGS = ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP"];
export function cohortFor(ticker, tags, asked) {
  if (asked) return String(asked).toUpperCase();
  if (DEFAULT_COHORT[ticker]) return DEFAULT_COHORT[ticker];
  return (tags || []).find((t) => !SIZE_TAGS.includes(t)) || null;
}
export { num, median, money, dateWord, quantile, peerBand, impliedPrice, growthPct, isNM, NM_CAP, quarterRun, flow, K2 };
