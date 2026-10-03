/* Scintilla · comps C5 (3 Oct) · the field: outliers caught by the system, PEG from forward growth, the measure
   weights, and THE PRICE FROM THE WHOLE FIELD. Pure: no DOM, no fetch.

   OUTLIERS (Alan: "who is this 344× P/E outlier? … the system should catch anomalies like those multiples"):
     per measure, on the LOG of the peers' multiples: median m and MAD (median absolute deviation, × 1.4826 so it reads
     as a standard deviation); a peer is an outlier when |log(multiple) − m| > K · 1.4826 · MAD, K = 3, and only when
     the measure carries at least 5 peers (fewer cannot define a pack). A flagged peer is a CANDIDATE FOR ELIMINATION:
     out of that measure's centre by default, drawn hollow at the edge, one click keeps it (a comps_decisions row with
     off = false and reason "keep", like any edit). The visuals' scales are computed without the excluded outliers.
   PEG: forward P/E ÷ forward EPS growth, the growth being the compound annual rate from trailing EPS to the FMP
     consensus EPS three fiscal years out (the furthest year on file inside three and a half years; the same
     analyst_estimates rows the ESTIMATES tab draws). Not computable → "—", never a sentence.
   MEASURE WEIGHTS (the six valuation rows): each row's weight ∝ sector prior × coverage × fit, the prior being C3's
     practitioner table (Damodaran; Koller et al.; Liu–Nissim–Thomas: forward earnings first, EV multiples little for a
     bank), coverage and fit measured here, where coverage = the share of the peers
     carrying the multiple and fit = 1 ÷ (1 + the median pricing error of the row in this set: each peer priced at the
     peers' median multiple is off by |median ÷ own − 1|, Liu–Nissim–Thomas 2002). Measured in the set, not assumed;
     equal weights when nothing can be measured. Shown as a visible row of numbers.
   PEER WEIGHTS (the ten fundamental rows): a peer whose growth, margins, balance sheet and capex sit near the company's
     counts more: weight = exp(−½ (d ÷ 0.5)²), d = the root-mean-square gap in percentile rank across the fundamental
     rows both carry (equal weight per row: nothing better is measured yet). Shown as a row of numbers too.
   THE PRICE (way C): every peer's implied price on every valid measure is one point, weighted by measure weight ×
     peer weight; the CENTRE is the weighted median of all those points, LOW and HIGH the weighted 25th and 75th.
     The midpoint of low and high is stated beside the centre, so the two are never confused (Alan: "417 is not the
     center of 319 and 823"). Ways A and B stay as alternatives: A the range of the measure medians (centre = the median
     of those medians), B the middle-half band (centre = the median of the medians). */
import { median, quantile } from "../../20260927/comps-r3/r3.mjs";
import { repriceRow, priceAt } from "../../20260929/comps-live/ladder.mjs";
import { rangeOfMedians, middleHalfBand, upsideTo } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { latestDecisions, selectionOf, isOff } from "../../20260930/comps-tab/comps-tab.mjs";
import { ROWS, TABLE } from "../../20261001/comps-template/cohort.mjs";
import { SECTOR_PRIOR, sectorClass } from "../../20261001/comps-template/template.mjs";
export { SECTOR_PRIOR, sectorClass };
export { median, quantile, upsideTo, selectionOf, isOff, ROWS, TABLE };

export const OUTLIER_K = 3, OUTLIER_MIN_N = 5, MAD_SCALE = 1.4826, PEG_YEARS_MAX = 3.5, PEER_SIGMA = 0.5;
export const FUND_KEYS = TABLE.filter((c) => !ROWS.includes(c.key)).map((c) => c.key);

/* ---- outliers ------------------------------------------------------------------------------------- */
/** The outliers of one row. Returns { key, n, median, mad, fence: {lo, hi} (multiples), out: [{ticker, multiple, side, z}] }. */
export function outlierFlags(row, { k = OUTLIER_K, minN = OUTLIER_MIN_N } = {}) {
  const peers = (row.peers || []).filter((p) => p.multiple != null && p.multiple > 0);
  if (peers.length < minN) return { key: row.key, n: peers.length, median: null, mad: null, fence: null, out: [], why: `fewer than ${minN} peers` };
  const logs = peers.map((p) => Math.log(p.multiple)), m = median(logs), mad = median(logs.map((v) => Math.abs(v - m))) * MAD_SCALE;
  if (!(mad > 0)) return { key: row.key, n: peers.length, median: Math.exp(m), mad: 0, fence: null, out: [] };
  const lo = Math.exp(m - k * mad), hi = Math.exp(m + k * mad);
  const out = peers.filter((p) => p.multiple < lo || p.multiple > hi).map((p) => ({ ticker: p.ticker, multiple: p.multiple, side: p.multiple > hi ? "high" : "low", z: (Math.log(p.multiple) - m) / mad }));
  return { key: row.key, n: peers.length, median: Math.exp(m), mad, fence: { lo, hi }, out };
}
export const outliersOf = (rows, opts) => Object.fromEntries(rows.map((r) => [r.key, outlierFlags(r, opts)]));

/** The cells the operator KEPT (an off = false decision whose reason starts with "keep"): Set("PEER|measure"). */
export function keptCells(decisions, company) {
  const s = new Set();
  for (const r of latestDecisions(decisions || [], company)) if ((r.off === false || r.off === "false") && /^keep/i.test(String(r.reason || "")) && r.measure && r.measure !== "ALL") s.add(String(r.peer).toUpperCase() + "|" + r.measure);
  return s;
}
export const isKept = (kept, peer, measure) => kept.has(peer + "|" + measure);

/** The rows with the operator's selection AND the outliers applied (outliers excluded unless kept). Each row carries
    `outliers` ({ flagged: [...], excluded: [...], kept: [...] }) and `dropped`. */
export function applyField(snap, decisions, { k = OUTLIER_K, minN = OUTLIER_MIN_N } = {}) {
  const sel = selectionOf(decisions || [], snap.ticker), kept = keptCells(decisions || [], snap.ticker);
  const rows = snap.rows.map((r) => {
    const afterSel = (r.peers || []).filter((p) => !isOff(sel, p.ticker, r.key)), offPeers = (r.peers || []).filter((p) => isOff(sel, p.ticker, r.key)).map((p) => p.ticker);
    const fl = outlierFlags({ ...r, peers: afterSel }, { k, minN });
    const excluded = fl.out.filter((o) => !isKept(kept, o.ticker, r.key)).map((o) => o.ticker), keptHere = fl.out.filter((o) => isKept(kept, o.ticker, r.key)).map((o) => o.ticker);
    const keep = afterSel.filter((p) => !excluded.includes(p.ticker));
    const base = offPeers.length || excluded.length ? repriceRow(r, keep, snap) : { ...r };
    return { ...base, dropped: offPeers, outliers: { ...fl, flagged: fl.out, excluded, kept: keptHere } };
  });
  return { rows, sel, kept };
}

/* ---- PEG from forward growth --------------------------------------------------------------------- */
/** Forward EPS growth, % a year: compound from trailing EPS to the consensus EPS three fiscal years out.
    e: { eps_ttm, est: [{fiscal_date, eps}] } · today: ISO. Returns { pct, from, to, years, basis } or null. */
export function pegGrowth(e, today, { consensusOnly = false } = {}) {
  if (!e) return null;
  const t0 = Date.parse(today + "T00:00:00Z"), est = (e.est || []).filter((x) => x && x.eps != null && x.fiscal_date >= today).sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date));
  const years = (d) => (Date.parse(d + "T00:00:00Z") - t0) / (365.25 * 86400e3);
  const far = est.filter((x) => years(x.fiscal_date) <= PEG_YEARS_MAX && x.eps > 0).pop();
  if (!far) return null;
  let base = null;
  if (e.eps_ttm > 0 && !consensusOnly) base = { eps: e.eps_ttm, years: 0, word: "trailing EPS" };
  else if (est[0] && est[0] !== far && est[0].eps > 0) base = { eps: est[0].eps, years: years(est[0].fiscal_date), word: "FY" + est[0].fiscal_date.slice(0, 4) + " consensus" };
  if (!base) return null;
  const span = years(far.fiscal_date) - base.years; if (!(span >= 0.75)) return null;
  const pct = (Math.pow(far.eps / base.eps, 1 / span) - 1) * 100;
  return { pct, from: base.eps, to: far.eps, years: span, to_date: far.fiscal_date, basis: `${base.word} $${base.eps.toFixed(2)} → FY${far.fiscal_date.slice(0, 4)} consensus $${far.eps.toFixed(2)}, ${span.toFixed(1)} years` };
}
/** The PEG row rebuilt from forward growth. estimates: { T: { eps_ttm, est } }; the company's EPS estimate for the price comes from the snapshot. */
export function pegRow(snap, estimates, today) {
  const T = snap.ticker, old = snap.rows.find((r) => r.key === "peg"), fwd = snap.rows.find((r) => r.key === "pe_fwd");
  const growth = {}, values = {}, peers = [];
  /* a foreign filer's consensus rows are in its own currency while trailing EPS is converted: growth from consensus to consensus */
  const foreign = (t) => { const fx = t === T ? snap.fx : snap.fx_peers && snap.fx_peers[t]; return !!(fx && fx.currency && fx.currency !== "USD"); };
  for (const t of snap.members.filter((x) => x !== T)) {
    const g = pegGrowth(estimates[t], today, { consensusOnly: foreign(t) }), pf = fwd && fwd.values && fwd.values[t] ? fwd.values[t].multiple : null;
    growth[t] = g;
    const m = g && g.pct > 0 && pf != null && pf > 0 ? pf / g.pct : null;
    values[t] = { multiple: m, why: m != null ? null : pf == null ? "no forward P/E" : !g ? "no forward EPS path" : "EPS is not expected to grow" };
    if (m != null) peers.push({ ticker: t, multiple: m });
  }
  const gOwn = pegGrowth(estimates[T], today, { consensusOnly: foreign(T) }), pfOwn = fwd && fwd.own ? fwd.own.multiple : null, mOwn = gOwn && gOwn.pct > 0 && pfOwn > 0 ? pfOwn / gOwn.pct : null;
  const epsFy1 = snap.eps_fy1, price = (m) => m != null && gOwn && gOwn.pct > 0 && epsFy1 > 0 ? m * gOwn.pct * epsFy1 : null;
  const sorted = peers.slice().sort((a, b) => a.multiple - b.multiple), vals = sorted.map((p) => p.multiple);
  const band = { n: vals.length, min: vals.length ? vals[0] : null, q1: vals.length ? quantile(vals, 0.25) : null, median: vals.length ? median(vals) : null, q3: vals.length ? quantile(vals, 0.75) : null, max: vals.length ? vals[vals.length - 1] : null };
  const at = (m, who = []) => ({ multiple: m, who, price: price(m) });
  const ends = { min: at(band.min, sorted.length ? [sorted[0].ticker] : []), q1: at(band.q1), median: at(band.median), q3: at(band.q3), max: at(band.max, sorted.length ? [sorted[sorted.length - 1].ticker] : []) };
  const ok = band.n >= 2 && ends.median.price != null;
  return { ...(old || { key: "peg", label: "PEG", fmt: "x2" }), key: "peg", basis: "forward P/E ÷ forward EPS growth (% a year, three years out)", own: { multiple: mOwn, price: snap.price }, own_why: mOwn != null ? null : null,
    figure: { word: "EPS growth × EPS estimate", value: gOwn && epsFy1 != null ? gOwn.pct * epsFy1 : null, fmt: "usd2", formula: "PEG × growth % × EPS", growth: gOwn ? gOwn.pct : null, growth_basis: gOwn ? gOwn.basis : null },
    n: band.n, band, ends, peers: sorted, nm: [], missing: Object.keys(values).filter((t) => values[t].multiple == null), values, growth, upside: ok && snap.price > 0 ? (ends.median.price / snap.price - 1) * 100 : null,
    ok, reason: ok ? null : band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} carr${band.n === 1 ? "ies" : "y"} this multiple` : null, computable: mOwn != null };
}

/* ---- weights ------------------------------------------------------------------------------------------- */
/** The six measure weights, measured in the set. rows: after applyField. Returns { weights, parts, basis } */
export function measureWeights(rows, peerCount, cls = "default") {
  const prior = SECTOR_PRIOR[cls] || SECTOR_PRIOR.default, parts = {}; let sum = 0;
  for (const r of rows.filter((x) => ROWS.includes(x.key))) {
    const vals = (r.peers || []).map((p) => p.multiple).filter((v) => v != null && v > 0), med = vals.length ? median(vals) : null;
    const coverage = peerCount > 0 ? vals.length / peerCount : 0, errs = med > 0 ? vals.map((v) => Math.abs(med / v - 1)) : [], fit = errs.length ? 1 / (1 + median(errs)) : 0;
    const priced = r.ok && r.ends && r.ends.median && r.ends.median.price != null, score = priced && vals.length >= 2 ? (prior[r.key] || 1) * coverage * fit : 0;
    parts[r.key] = { prior: prior[r.key] || 1, coverage, fit, median_error: errs.length ? median(errs) : null, score, priced, n: vals.length }; sum += score;
  }
  const weights = {}; const priced = Object.keys(parts).filter((k) => parts[k].priced);
  for (const k of Object.keys(parts)) weights[k] = sum > 0 ? parts[k].score / sum : priced.length ? (parts[k].priced ? 1 / priced.length : 0) : 0;
  return { weights, parts, cls, basis: sum > 0 ? `sector prior (${cls}) × coverage × fit, measured in this set` : "equal (nothing measurable)" };
}
/** The peer weights from the fundamental rows. snap.table: { company, peers }. peers: the tickers on. */
export function peerWeights(snap, peers, { sigma = PEER_SIGMA } = {}) {
  const T = snap.ticker, own = snap.table.company, cols = FUND_KEYS.filter((k) => own[k] != null && Number.isFinite(own[k]) && peers.filter((t) => snap.table.peers[t] && snap.table.peers[t][k] != null).length >= 2);
  const rank = (k, v) => { const vals = [own[k], ...peers.map((t) => snap.table.peers[t] ? snap.table.peers[t][k] : null).filter((x) => x != null && Number.isFinite(x))].sort((a, b) => a - b); return vals.length > 1 ? vals.filter((x) => x < v).length / (vals.length - 1) : 0.5; };
  const w = {}, d = {};
  for (const t of peers) {
    const p = snap.table.peers[t] || {}, gaps = cols.filter((k) => p[k] != null && Number.isFinite(p[k])).map((k) => rank(k, p[k]) - rank(k, own[k]));
    const rms = gaps.length ? Math.sqrt(gaps.reduce((s, g) => s + g * g, 0) / gaps.length) : null;
    d[t] = rms; w[t] = rms == null ? 1 : Math.exp(-0.5 * Math.pow(rms / sigma, 2));
  }
  const rowWeights = Object.fromEntries(FUND_KEYS.map((k) => [k, cols.includes(k) ? 1 / cols.length : 0]));
  return { weights: w, distance: d, rows: cols, rowWeights, basis: cols.length ? `equal over the ${cols.length} fundamental rows both sides carry` : "no fundamental row to match on" };
}

/* ---- the price from the whole field ------------------------------------------------------------------ */
/** Way C: every peer's implied price on every priced measure is a point (measure weight × peer weight). */
export function fullField(rows, snap, mw, pw) {
  const pts = [], rowMid = {};
  for (const r of rows.filter((x) => ROWS.includes(x.key) && x.ok && (mw.weights[x.key] || 0) > 0)) {
    const peers = (r.peers || []).filter((p) => p.multiple != null && p.multiple > 0), pwSum = peers.reduce((s, p) => s + (pw.weights[p.ticker] ?? 1), 0);
    if (!peers.length || !(pwSum > 0)) continue;
    const rp = [];
    for (const p of peers) { const price = r.key === "peg" ? (r.ends && r.ends.median && r.ends.median.multiple ? (r.ends.median.price / r.ends.median.multiple) * p.multiple : null) : priceAt(r.key, p.multiple, snap); if (price == null || !(price > 0)) continue; const w = mw.weights[r.key] * (pw.weights[p.ticker] ?? 1) / pwSum; pts.push({ key: r.key, ticker: p.ticker, multiple: p.multiple, price, w }); rp.push({ price, w }); }
    if (rp.length) rowMid[r.key] = wquantile(rp, 0.5);
  }
  if (!pts.length) return { ok: false, way: "C", reason: "no measure can be priced" };
  const lo = wquantile(pts, 0.25), mid = wquantile(pts, 0.5), hi = wquantile(pts, 0.75);
  return { ok: true, way: "C", name: "the whole field", lo, mid, hi, midpoint: (lo + hi) / 2, points: pts, n: pts.length, rowMid, weights: mw.weights, peerWeights: pw.weights, rule: "every peer's implied price on every priced measure, weighted by measure × peer; centre = the weighted median of all of them, low and high the weighted 25th and 75th" };
}
/** Weighted quantile of [{price, w}]. */
export function wquantile(pts, q) {
  const s = pts.filter((p) => p.price != null && p.w > 0).sort((a, b) => a.price - b.price), W = s.reduce((a, p) => a + p.w, 0);
  if (!s.length) return null; let acc = 0;
  for (let i = 0; i < s.length; i++) { const prev = acc; acc += s[i].w; if (acc / W >= q) { if (i > 0 && (prev / W) < q) { const f = (q * W - prev) / s[i].w; return s[i - 1].price + (s[i].price - s[i - 1].price) * Math.min(1, Math.max(0, f)); } return s[i].price; } }
  return s[s.length - 1].price;
}
/** The three ways on the field rows, each with its upside from today's price. */
export function ways(rows, snap, mw, pw) {
  const price = snap.price, list = [{ ...rangeOfMedians(rows), way: "A" }, { ...middleHalfBand(rows), way: "B" }, fullField(rows, snap, mw, pw)];
  for (const w of list) if (w.ok) { w.upside = { lo: upsideTo(price, w.lo), mid: upsideTo(price, w.mid), hi: upsideTo(price, w.hi) }; w.midpoint = w.midpoint ?? (w.lo + w.hi) / 2; }
  return list;
}
export const wayOf = (list, way) => list.find((w) => w.way === way) || null;
export const WAY_WORDS = {
  A: { short: "A", name: "range of the medians", centre: "median of the measure medians", plain: "from the lowest of the measures' median prices to the highest; the centre is the median of those medians" },
  B: { short: "B", name: "middle-half band", centre: "median of the measure medians", plain: "the median of the measures' 25th prices to the median of their 75ths; the centre is the median of the medians" },
  C: { short: "C", name: "the whole field", centre: "weighted median of every peer price", plain: "every peer's implied price on every priced measure, weighted by measure (coverage × fit) and by peer (closeness on the fundamentals); the centre is their weighted median, low and high the weighted 25th and 75th" },
};

/** Everything the page draws for one company and one way. estimates: { T: { eps_ttm, est } } (may be empty). */
export function conclusion(snap, decisions, estimates, today, way = "C") {
  const snap2 = estimates ? { ...snap, rows: snap.rows.map((r) => (r.key === "peg" ? pegRow(snap, estimates, today) : r)) } : snap;
  const F = applyField(snap2, decisions);
  const peersOn = snap.members.filter((t) => t !== snap.ticker && !(snap.excluded || []).some((e) => e.ticker === t) && !F.sel.peers.has(t));
  const mw = measureWeights(F.rows, peersOn.length, sectorClass(snap.sector, snap.industry, snap.cohort)), pw = peerWeights(snap, peersOn);
  const W = ways(F.rows, snap2, mw, pw), w = wayOf(W, way);
  const outliers = F.rows.filter((r) => ROWS.includes(r.key)).flatMap((r) => r.outliers.flagged.map((o) => ({ ...o, key: r.key, excluded: r.outliers.excluded.includes(o.ticker), kept: r.outliers.kept.includes(o.ticker) })));
  return { ticker: snap.ticker, price: snap.price, way, band: w && w.ok ? { lo: w.lo, mid: w.mid, hi: w.hi, midpoint: w.midpoint } : null, upside: w && w.ok ? w.upside : null, reason: w && !w.ok ? w.reason : null,
    ways: W, rows: F.rows, sel: F.sel, kept: F.kept, peersOn, off: F.sel.list.length, measureWeights: mw, peerWeights: pw, outliers, snap: snap2 };
}
