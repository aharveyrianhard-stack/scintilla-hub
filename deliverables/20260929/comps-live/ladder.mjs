/* Scintilla · comps on the live company view (C1, 29 Sep) · THE STEP-BY-STEP.
   Pure functions: no DOM, no fetch, no clock. One snapshot in (the shape snapshot-live.mjs writes, the same
   shape the 28 Sep round-3 snapshots carry), the ladder out — seven numbered steps, every one a number Alan can
   check with his eyes, plus the way-B band computed with and without the outliers, and the compare set for two
   or three companies on one % axis. The page and the tests import this same file.

   The steps (the brief, 29 Sep):
     1 the peer set (names, the cohort, exclusions);
     2 each peer's multiple per metric, with source and date;
     3 the percentiles per metric (lowest, 25th, median, 75th, highest);
     4 this company's own denominator per metric and the arithmetic: multiple × own value = implied price;
     5 the six implied medians → way B: the middle-half band and its centre;
     6 upside = band edge ÷ today's price − 1, for the 25th, the centre and the 75th, in % and $;
     7 one plain sentence: the tranche reading.
   Way B (the coordinator's decision, 29 Sep) is middleHalfBand from the approved round-3 module: left edge = the
   median of the metrics' 25th-percentile prices, right edge = the median of their 75th, centre = the median of the
   medians. Nothing here changes that arithmetic; this file only lays it out step by step and reprices rows when
   an outlier is set aside. */

import { middleHalfBand, upsideTo, median } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { peerBand } from "../../20260927/comps-r3/r3.mjs";

export const ROW_KEYS = ["pe_ttm", "pe_fwd", "ev_sales", "ev_ebitda", "ps", "peg"];
export const SHORT = { pe_ttm: "P/E", pe_fwd: "P/E fwd", ev_sales: "EV/S", ev_ebitda: "EV/EBITDA", ps: "P/S", peg: "PEG" };
export const MARKS = ["min", "q1", "median", "q3", "max"];
export const MARK_WORDS = { min: "LOWEST PEER", q1: "25TH", median: "MEDIAN", q3: "75TH", max: "HIGHEST PEER" };
const isNum = (v) => v != null && Number.isFinite(v);

/* ---- step 4: the arithmetic ------------------------------------------------------------------------ */

/** The denominator a row's multiple is applied to, for this company: the word, the figure, its date, the formula.
    A missing figure is a named blank (value null, and `why`). */
export function denominator(key, snap) {
  const row = (snap.rows || []).find((r) => r.key === key) || {};
  const f = row.figure || {};
  const d = snap.dates || {};
  const blank = (word, formula, why) => ({ key, word, value: null, fmt: "usd2", date: null, formula, why });
  if (key === "pe_ttm") return isNum(snap.eps_ttm) && snap.eps_ttm > 0
    ? { key, word: "EPS, last twelve months", value: snap.eps_ttm, fmt: "usd2", date: snap.eps_date || d.eps || null, source: "fundamentals.eps_ttm (FMP)", formula: "multiple × EPS" }
    : blank("EPS, last twelve months", "multiple × EPS", isNum(snap.eps_ttm) ? "trailing EPS is not positive" : "no trailing EPS on file");
  if (key === "pe_fwd") return isNum(snap.eps_fy1) && snap.eps_fy1 > 0
    ? { key, word: "EPS estimate, FY" + (snap.fy1_date ? String(snap.fy1_date).slice(0, 4) : "?"), value: snap.eps_fy1, fmt: "usd2", date: snap.fy1_date || null, source: "analyst_estimates.est_eps_avg (FMP)", formula: "multiple × EPS estimate" }
    : blank("EPS estimate, current fiscal year", "multiple × EPS estimate", isNum(snap.eps_fy1) ? "estimated EPS is not positive" : "no EPS estimate on file");
  if (key === "ev_sales") return isNum(snap.revenue_ttm) && snap.revenue_ttm > 0 && isNum(snap.net_debt) && snap.shares > 0
    ? { key, word: "revenue, TTM", value: snap.revenue_ttm, fmt: "money", date: d.revenue_to || null, source: "fundamentals_history (FMP), four quarters added", formula: "(multiple × revenue − net debt) ÷ shares", net_debt: snap.net_debt, net_debt_date: snap.net_debt_date || null, shares: snap.shares }
    : blank("revenue, TTM", "(multiple × revenue − net debt) ÷ shares", !isNum(snap.revenue_ttm) ? "no revenue on file" : !isNum(snap.net_debt) ? "no net debt on file" : "no share count");
  if (key === "ev_ebitda") return isNum(snap.ebitda_ttm) && snap.ebitda_ttm > 0 && isNum(snap.net_debt) && snap.shares > 0
    ? { key, word: "EBITDA, TTM", value: snap.ebitda_ttm, fmt: "money", date: d.ebitda_to || null, source: "fundamentals_history (FMP), four quarters added", formula: "(multiple × EBITDA − net debt) ÷ shares", net_debt: snap.net_debt, net_debt_date: snap.net_debt_date || null, shares: snap.shares }
    : blank("EBITDA, TTM", "(multiple × EBITDA − net debt) ÷ shares", !isNum(snap.ebitda_ttm) ? "no EBITDA history on file" : snap.ebitda_ttm <= 0 ? "EBITDA is not positive" : !isNum(snap.net_debt) ? "no net debt on file" : "no share count");
  if (key === "ps") return isNum(snap.revenue_ttm) && snap.revenue_ttm > 0 && snap.shares > 0
    ? { key, word: "revenue, TTM", value: snap.revenue_ttm, fmt: "money", date: d.revenue_to || null, source: "fundamentals_history (FMP), four quarters added", formula: "multiple × revenue ÷ shares", shares: snap.shares }
    : blank("revenue, TTM", "multiple × revenue ÷ shares", !isNum(snap.revenue_ttm) ? "no revenue on file" : "no share count");
  if (key === "peg") return isNum(f.value) && f.value > 0
    ? { key, word: "EPS growth next FY (%) × EPS estimate", value: f.value, fmt: "usd2", date: snap.fy1_date || null, source: "analyst_estimates (FMP): this year's and next year's EPS", formula: "PEG × growth % × EPS estimate", growth: f.growth ?? null, eps: snap.eps_fy1 ?? null }
    : blank("EPS growth next FY (%) × EPS estimate", "PEG × growth % × EPS estimate", "no positive EPS growth is expected, so PEG cannot price it");
  return blank(key, "", "unknown row");
}

/** The price per share a multiple implies for this company on a row — the same formulas as the live comps page
    (deliverables/20260927/comps-single/comps.mjs · impliedPrice), on the snapshot's own figures. A negative implied
    value is shown as zero, as there. null when the row cannot price the company. */
export function priceAt(key, m, snap) {
  if (!isNum(m)) return null;
  const D = denominator(key, snap);
  if (D.value == null) return null;
  let p;
  if (key === "pe_ttm" || key === "pe_fwd" || key === "peg") p = m * D.value;
  else if (key === "ev_sales" || key === "ev_ebitda") p = (m * D.value - D.net_debt) / D.shares;
  else if (key === "ps") p = m * D.value / D.shares;
  else return null;
  return Number.isFinite(p) ? Math.max(0, p) : null;
}

/* ---- the seven steps --------------------------------------------------------------------------------- */

/** Step 1 — the peer set. */
export function stepPeers(snap) {
  const T = snap.ticker;
  const names = snap.names || {};
  const members = (snap.members || []).filter((t) => t !== T);
  const excluded = [...(snap.excluded || [])];
  const peers = members.filter((t) => !excluded.some((e) => e.ticker === t));
  return {
    n: 1, title: "The peer set",
    cohort: snap.cohort, cohort_options: snap.cohort_options || [snap.cohort].filter(Boolean),
    subject: { ticker: T, name: names[T] || snap.name || T },
    peers: peers.map((t) => ({ ticker: t, name: names[t] || t })),
    excluded: excluded.map((e) => ({ ...e, name: names[e.ticker] || e.ticker })),
    rule: `the peers are the other names tagged ${snap.cohort || "?"} in ticker_cohorts; ${T} itself and any fund take no part`,
  };
}

/** Step 2 — every peer's multiple on every row, with the peers a row sets aside named (not meaningful above the
    row's cap; missing when the figure is absent or not positive). */
export function stepMultiples(snap) {
  const rows = (snap.rows || []).filter((r) => ROW_KEYS.includes(r.key));
  const peers = stepPeers(snap).peers.map((p) => p.ticker);
  const dates = snap.peer_dates || {};
  const table = peers.map((t) => {
    const cells = {};
    for (const r of rows) {
      const inRow = (r.peers || []).find((x) => x.ticker === t);
      const nm = (r.nm || []).find((x) => x.ticker === t);
      cells[r.key] = inRow ? { multiple: inRow.multiple, state: "in" }
        : nm ? { multiple: nm.value, state: "nm", why: `above the ${capOf(r.key)} cap: not meaningful` }
        : (r.missing || []).includes(t) ? { multiple: null, state: "missing", why: missingWhy(r.key) }
        : { multiple: null, state: "absent", why: "not on this row" };
    }
    return { ticker: t, name: (snap.names || {})[t] || t, cells, dates: dates[t] || null };
  });
  return {
    n: 2, title: "Each peer's multiple, per metric",
    rows: rows.map((r) => ({ key: r.key, label: r.label, basis: r.basis, n: r.n, nm: r.nm || [], missing: r.missing || [] })),
    table,
    source: "FMP, through the Hub's tables: fundamentals (EPS TTM, market value, the price on that row → shares), analyst_estimates (this year's and next year's EPS), fundamentals_history (revenue and EBITDA by quarter → TTM), balance_history (net debt at the newest balance) · today's price from the chart API",
    taken: snap.taken || null, today: snap.today || null,
  };
}
const CAP = { pe_ttm: "100x", pe_fwd: "100x", ev_sales: "50x", ev_ebitda: "100x", ps: "50x", peg: "10x" };
const capOf = (k) => CAP[k] || "?";
const missingWhy = (k) => k === "pe_ttm" ? "no positive trailing EPS" : k === "pe_fwd" ? "no positive EPS estimate (forward P/E blank)" : k === "ev_sales" || k === "ps" ? "no revenue, net debt or share count" : k === "ev_ebitda" ? "no positive EBITDA or no net debt" : k === "peg" ? "no positive EPS growth expected" : "missing";

/** Step 3 — the percentiles of every row, with who sets the ends and the median. */
export function stepPercentiles(snap) {
  const rows = (snap.rows || []).filter((r) => ROW_KEYS.includes(r.key));
  return {
    n: 3, title: "The percentiles, per metric",
    rows: rows.map((r) => ({
      key: r.key, label: r.label, n: r.n, band: r.band,
      who: { min: (r.ends?.min?.who) || [], median: (r.ends?.median?.who) || [], max: (r.ends?.max?.who) || [] },
      sorted: (r.peers || []).map((p) => ({ ticker: p.ticker, multiple: p.multiple })),
      own: r.own ? r.own.multiple : null,
    })),
    rule: "lowest and highest are the ends; the 25th, the median and the 75th are read along the sorted peers, straight-line between the two nearest (the same percentile arithmetic as the live comps page, peerBand)",
  };
}

/** Step 4 — the company's own denominator per row and the five lines of arithmetic. */
export function stepArithmetic(snap) {
  const rows = (snap.rows || []).filter((r) => ROW_KEYS.includes(r.key));
  return {
    n: 4, title: `${snap.ticker}'s own figure, and the arithmetic`,
    price: snap.price, price_date: snap.price_date || null, shares: snap.shares ?? null, net_debt: snap.net_debt ?? null, net_debt_date: snap.net_debt_date || null,
    rows: rows.map((r) => {
      const D = denominator(r.key, snap);
      const lines = MARKS.map((k) => ({ mark: k, word: MARK_WORDS[k], multiple: r.band ? r.band[k] : null, price: priceAt(r.key, r.band ? r.band[k] : null, snap), stated: r.ends && r.ends[k] ? r.ends[k].price : null }));
      return { key: r.key, label: r.label, denominator: D, lines, ok: D.value != null && lines.every((l) => l.multiple == null || l.price != null) };
    }),
  };
}

/** Step 5 — the six rows' implied 25th / median / 75th prices → way B. Every list that is medianed is shown sorted. */
export function stepBand(snap, rows = snap.rows) {
  const R = (rows || []).filter((r) => ROW_KEYS.includes(r.key));
  const B = middleHalfBand(R);
  const used = R.filter((r) => r.ok && r.ends && r.ends.q1 && r.ends.median && r.ends.q3 && r.ends.q1.price != null && r.ends.median.price != null && r.ends.q3.price != null);
  const sortedBy = (k) => used.map((r) => ({ key: r.key, label: r.label, price: r.ends[k].price })).sort((a, b) => a.price - b.price);
  return {
    n: 5, title: "The six implied medians → way B, the middle-half band",
    used: used.map((r) => ({ key: r.key, label: r.label, q1: r.ends.q1.price, median: r.ends.median.price, q3: r.ends.q3.price })),
    left_out: R.filter((r) => !used.includes(r)).map((r) => ({ key: r.key, label: r.label, why: r.reason || "cannot be priced" })),
    q1s: sortedBy("q1"), medians: sortedBy("median"), q3s: sortedBy("q3"),
    band: B.ok ? { lo: B.lo, mid: B.mid, hi: B.hi, envelope: B.envelope, overlap: B.overlap, n: used.length } : null,
    reason: B.ok ? null : B.reason,
    rule: "low edge = the median of the 25th-percentile prices · centre = the median of the median prices · high edge = the median of the 75th-percentile prices",
  };
}

/** Step 6 — the upside to the low edge, the centre and the high edge. */
export function stepUpside(snap, band) {
  const p = snap.price;
  const u = (x) => upsideTo(p, x);
  return {
    n: 6, title: "The upside from today", price: p, price_date: snap.price_date || null,
    lo: band ? u(band.lo) : null, mid: band ? u(band.mid) : null, hi: band ? u(band.hi) : null,
    rule: "upside = implied price ÷ today's price − 1, and implied price − today's price",
  };
}

/** Step 7 — the tranche reading, one plain sentence. */
export function stepSentence(snap, band, up) {
  const T = snap.ticker;
  if (!band || !up || !up.mid) return { n: 7, title: "The reading", where: null, sentence: `${T} cannot be placed: no valuation row can be priced against its peers.` };
  const p = snap.price;
  const P0 = (v) => "$" + Math.round(v).toLocaleString("en-US");
  const pc = (u) => (u.pct >= 0 ? "+" : "−") + Math.abs(u.pct).toFixed(Math.abs(u.pct) >= 10 ? 0 : 1) + "%";
  let where, read;
  if (p < band.lo) { where = "below"; read = "room on every reading of the peers: the first tranche can be the largest"; }
  else if (p <= band.mid) { where = "low-half"; read = "room on the typical metric: tranches stay normal-sized and go on the technical levels"; }
  else if (p <= band.hi) { where = "high-half"; read = "the comps upside is mostly spent: a further tranche needs a reason the peers do not give"; }
  else { where = "above"; read = "dear against the peers: no new tranche on comps grounds"; }
  const place = where === "below" ? "below the low edge" : where === "low-half" ? "between the low edge and the centre" : where === "high-half" ? "between the centre and the high edge" : "above the high edge";
  return { n: 7, title: "The reading", where, sentence: `${T} at ${P0(p)} sits ${place} of its peers' band, ${P0(band.lo)} to ${P0(band.hi)} with the centre at ${P0(band.mid)} (${pc(up.mid)} to the centre): ${read}.` };
}

/* ---- outliers: the band with and without ---------------------------------------------------------- */

/** A row repriced on a peer list: the same percentiles and the same arithmetic, on fewer peers. */
export function repriceRow(row, peers, snap) {
  const band = peerBand(peers.map((p) => p.multiple));
  const ends = {};
  for (const k of MARKS) ends[k] = { multiple: band[k], who: [], price: priceAt(row.key, band[k], snap) };
  const s = peers.slice().sort((a, b) => a.multiple - b.multiple);
  if (s.length) { ends.min.who = [s[0].ticker]; ends.max.who = [s[s.length - 1].ticker]; const n = s.length, m = (n - 1) / 2; ends.median.who = n % 2 ? [s[m].ticker] : [s[Math.floor(m)].ticker, s[Math.ceil(m)].ticker]; }
  const ok = band.n >= 2 && ends.min.price != null && ends.median.price != null && ends.max.price != null;
  return { ...row, band, ends, peers: s, n: band.n, ok, reason: ok ? null : band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} left — a range needs two` : (row.reason || "cannot be priced") };
}

/** Every outlier and every blank on every row, named; way B with them in and with them out. Nothing is dropped
    silently: the "without" band is a second reading, stated next to the first. */
export function outlierReadings(snap) {
  const rows = (snap.rows || []).filter((r) => ROW_KEYS.includes(r.key));
  const out = [], nm = [], missing = [];
  const without = rows.map((r) => {
    const o = (r.outliers && r.outliers.out) || [];
    for (const x of o) out.push({ key: r.key, label: r.label, ticker: x.ticker, multiple: x.multiple, side: x.side, rule: r.outliers.rule, fence: r.outliers.fence });
    for (const x of r.nm || []) nm.push({ key: r.key, label: r.label, ticker: x.ticker, multiple: x.value, why: `above the ${capOf(r.key)} cap` });
    for (const t of r.missing || []) missing.push({ key: r.key, label: r.label, ticker: t, why: missingWhy(r.key) });
    if (!o.length) return r;
    return repriceRow(r, (r.peers || []).filter((p) => !o.some((x) => x.ticker === p.ticker)), snap);
  });
  const withB = stepBand(snap, rows), withoutB = stepBand(snap, without);
  return {
    outliers: out, nm, missing, rows_without: without,
    with: withB.band, without: withoutB.band,
    changed: !!(withB.band && withoutB.band && (Math.abs(withB.band.lo - withoutB.band.lo) > 1e-9 || Math.abs(withB.band.mid - withoutB.band.mid) > 1e-9 || Math.abs(withB.band.hi - withoutB.band.hi) > 1e-9)),
    rule: "an outlier is a peer more than 1.5 × the middle half beyond its edge (Tukey); with fewer than four peers on a row nobody is called one",
  };
}

/* ---- the whole ladder ---------------------------------------------------------------------------- */

export function ladder(snap) {
  const s1 = stepPeers(snap), s2 = stepMultiples(snap), s3 = stepPercentiles(snap), s4 = stepArithmetic(snap), s5 = stepBand(snap);
  const s6 = stepUpside(snap, s5.band), s7 = stepSentence(snap, s5.band, s6);
  const o = outlierReadings(snap);
  const s6w = stepUpside(snap, o.without), s7w = stepSentence(snap, o.without, s6w);
  return { ticker: snap.ticker, name: snap.name || snap.ticker, cohort: snap.cohort, price: snap.price, price_date: snap.price_date || null, taken: snap.taken || null,
    steps: [s1, s2, s3, s4, s5, s6, s7], outliers: o, without: { band: o.without, upside: s6w, sentence: s7w } };
}

/* ---- compare: two or three companies on one axis ------------------------------------------------- */

/** "Upside is upside": each company's way-B band as upside from its own price, so the fields share one % axis
    (today = 0%). lo/mid/hi in percent, and the $ behind them. */
export function compareSet(snaps) {
  const cos = snaps.map((snap) => {
    const L = ladder(snap), B = L.steps[4].band, U = L.steps[5];
    return { ticker: snap.ticker, name: L.name, cohort: snap.cohort, price: snap.price, price_date: snap.price_date || null, band: B, upside: B ? { lo: U.lo, mid: U.mid, hi: U.hi } : null,
      without: L.without.band ? { band: L.without.band, upside: L.without.upside } : null, peers: L.steps[0].peers.length, sentence: L.steps[6].sentence, rows_used: L.steps[4].used.length, outliers: L.outliers.outliers.length };
  });
  const pcts = [0];
  for (const c of cos) if (c.upside) pcts.push(c.upside.lo.pct, c.upside.hi.pct);
  const lo = Math.min(...pcts), hi = Math.max(...pcts);
  const ranked = cos.filter((c) => c.upside).sort((a, b) => b.upside.mid.pct - a.upside.mid.pct).map((c) => c.ticker);
  return { companies: cos, axis: { lo, hi, unit: "% from today" }, ranked, rule: "each band is drawn as upside from that company's own price, so the axis is the same for every company: today is 0%" };
}

export { median, upsideTo, middleHalfBand, peerBand };
