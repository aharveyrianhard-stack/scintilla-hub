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
     of those medians), B the middle-half band (centre = the median of the medians).

   CP1 (6 Oct) · FIXES PROPOSED INSIDE THE FIELD, each a named switch, OFF until Alan says (way C only; A and B carry no
   weights). With every switch off this file answers exactly as C5 / C6b left it.
     growthCredit   A faster grower may sit above the peer median in proportion to its growth: the PEG row is the P/E
                    with the growth credit already in it (peers' median PEG × the company's own growth × its EPS), so
                    its prior is multiplied by the company's forward EPS growth ÷ the peers' median forward EPS growth,
                    never below 1 and never above GROWTH_CREDIT_MAX (3). A company growing no faster than its peers is
                    untouched.
     reitYardstick  A property trust is priced on funds from operations and EV/EBITDA, not on earnings after property
                    depreciation (Nareit's FFO white paper; Damodaran): class "reit" gets its own prior (REIT_PRIOR) and
                    a seventh row, P/FFO, built from the figures the comps reader already holds (cohort.mjs: FFO
                    approximated as net income + depreciation and amortisation).
     marginGate     A sales multiple treats a dollar of sales as worth the same in every company. When the company's
                    operating margin is more than MARGIN_GATE (2) times the peers' median, or under half of it, EV/sales
                    and P/S (the same reading twice) leave the price: weight 0, the row still drawn, the reason on it.
                    A loss-making company keeps them (nothing else prices it).

   FD1 (7 Oct) · ONE MORE SWITCH, CP1's decision 2 as approved, OFF by default and not one of CP1's twelve:
     growthForward  The growth PEG rests on is measured FROM ONE FORECAST YEAR TO THE NEXT: the compound rate from the
                    consensus EPS of the first forecast fiscal year to the consensus of the furthest one inside
                    PEG_YEARS_MAX — never from the trailing REPORTED EPS, which a single write-off bends (AbbVie's and
                    Pfizer's reported earnings carried write-offs, so measured from them their "growth" read as fast as
                    Lilly's and the credit could not tell them apart). It is the rule a foreign filer already gets here
                    (consensusOnly), now for every company: the PEG row's multiples, the company's own growth and
                    therefore the growth credit's ratio. What it cannot see: the fiscal year in progress, which is its
                    starting point — a company whose year has just turned (Micron, 4 Sep) shows only the years after.
     growthFromLastYear  (with growthForward) the starting point is the fiscal year JUST REPORTED, on the analysts' own
                    basis (its consensus row, when the year ended within LAST_YEAR_MAX and the caller's estimates carry
                    it), so the year in progress counts and no write-off enters. Without that row the rule is
                    growthForward's. A proposal beside the approved rule: measured, not switched on. */
import { median, quantile } from "../../20260927/comps-r3/r3.mjs";
import { repriceRow, priceAt } from "../../20260929/comps-live/ladder.mjs";
import { rangeOfMedians, middleHalfBand, upsideTo } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { latestDecisions, selectionOf, isOff } from "../../20260930/comps-tab/comps-tab.mjs";
import { ROWS, TABLE } from "../../20261001/comps-template/cohort.mjs";
import { SECTOR_PRIOR, sectorClass } from "../../20261001/comps-template/template.mjs";
export { SECTOR_PRIOR, sectorClass };
export { median, quantile, upsideTo, selectionOf, isOff, ROWS, TABLE };

export const OUTLIER_K = 3, OUTLIER_MIN_N = 5, MAD_SCALE = 1.4826, PEG_YEARS_MAX = 3.5, PEER_SIGMA = 0.5;
/* CP1 · the field's switches (see the header). OFF = C5 / C6b exactly. */
export const CP1_FIELD_OFF = Object.freeze({ growthCredit: false, reitYardstick: false, marginGate: false });
export const CP1_FIELD_ON = Object.freeze({ growthCredit: true, reitYardstick: true, marginGate: true });
/* FD1 · CP1's field switches plus forward-to-forward growth (the header). CP1_FIELD_ON stays CP1's own three. */
export const FD1_FIELD_ON = Object.freeze({ ...CP1_FIELD_ON, growthForward: true });
export const FD1_FIELD_LAST = Object.freeze({ ...FD1_FIELD_ON, growthFromLastYear: true });
export const LAST_YEAR_MAX = 1.1;   // years: "the fiscal year just reported" ended no longer ago than this
export const GROWTH_CREDIT_MAX = 3, MARGIN_GATE = 2, SALES_ROWS = ["ev_sales", "ps"];
export const REIT_PRIOR = { pe_ttm: 0.2, pe_fwd: 0.3, ev_ebitda: 1.5, ev_sales: 0.6, ps: 0.5, peg: 0.3, p_ffo: 1.6 };
export const isReit = (snap) => /reit|real estate/i.test([snap.sector, snap.industry].filter(Boolean).join(" "));
/** The valuation rows: C5's six, and P/FFO when the reit yardstick added it. */
export const isValuation = (key) => ROWS.includes(key) || key === "p_ffo";
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
    const base = offPeers.length || excluded.length ? (r.key === "p_ffo" ? ffoRow(snap, keep.map((p) => p.ticker)) : repriceRow(r, keep, snap)) : { ...r };
    return { ...base, dropped: offPeers, outliers: { ...fl, flagged: fl.out, excluded, kept: keptHere } };
  });
  return { rows, sel, kept };
}

/* ---- PEG from forward growth --------------------------------------------------------------------- */
/** Forward EPS growth, % a year: compound from trailing EPS to the consensus EPS three fiscal years out.
    e: { eps_ttm, est: [{fiscal_date, eps}] } · today: ISO. Returns { pct, from, to, years, basis } or null.
    consensusOnly: from the first forecast year's consensus instead of trailing EPS (a foreign filer; FD1 growthForward).
    fromLast: with consensusOnly, from the consensus of the fiscal year just reported when e.est carries it (FD1). */
export function pegGrowth(e, today, { consensusOnly = false, fromLast = false } = {}) {
  if (!e) return null;
  const t0 = Date.parse(today + "T00:00:00Z"), all = (e.est || []).filter((x) => x && x.eps != null && x.fiscal_date), est = all.filter((x) => x.fiscal_date >= today).sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date));
  const years = (d) => (Date.parse(d + "T00:00:00Z") - t0) / (365.25 * 86400e3);
  const far = est.filter((x) => years(x.fiscal_date) <= PEG_YEARS_MAX && x.eps > 0).pop();
  if (!far) return null;
  let base = null;
  const last = consensusOnly && fromLast ? all.filter((x) => x.fiscal_date < today && years(x.fiscal_date) >= -LAST_YEAR_MAX && x.eps > 0).sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date)).pop() : null;
  if (e.eps_ttm > 0 && !consensusOnly) base = { eps: e.eps_ttm, years: 0, word: "trailing EPS" };
  else if (last) base = { eps: last.eps, years: years(last.fiscal_date), word: "FY" + last.fiscal_date.slice(0, 4) + " consensus (the year just reported)" };
  else if (est[0] && est[0] !== far && est[0].eps > 0) base = { eps: est[0].eps, years: years(est[0].fiscal_date), word: "FY" + est[0].fiscal_date.slice(0, 4) + " consensus" };
  if (!base) return null;
  const span = years(far.fiscal_date) - base.years; if (!(span >= 0.75)) return null;
  const pct = (Math.pow(far.eps / base.eps, 1 / span) - 1) * 100;
  return { pct, from: base.eps, to: far.eps, years: span, to_date: far.fiscal_date, basis: `${base.word} $${base.eps.toFixed(2)} → FY${far.fiscal_date.slice(0, 4)} consensus $${far.eps.toFixed(2)}, ${span.toFixed(1)} years` };
}
/** The PEG row rebuilt from forward growth. estimates: { T: { eps_ttm, est } }; the company's EPS estimate for the price comes from the snapshot.
    forward (FD1 growthForward): every company's growth from consensus to consensus, as a foreign filer's already is. */
export function pegRow(snap, estimates, today, { forward = false, fromLast = false } = {}) {
  const T = snap.ticker, old = snap.rows.find((r) => r.key === "peg"), fwd = snap.rows.find((r) => r.key === "pe_fwd");
  const growth = {}, values = {}, peers = [];
  /* a foreign filer's consensus rows are in its own currency while trailing EPS is converted: growth from consensus to consensus */
  const foreign = (t) => { const fx = t === T ? snap.fx : snap.fx_peers && snap.fx_peers[t]; return !!(fx && fx.currency && fx.currency !== "USD"); };
  for (const t of snap.members.filter((x) => x !== T)) {
    const g = pegGrowth(estimates[t], today, { consensusOnly: forward || foreign(t), fromLast: forward && fromLast }), pf = fwd && fwd.values && fwd.values[t] ? fwd.values[t].multiple : null;
    growth[t] = g;
    const m = g && g.pct > 0 && pf != null && pf > 0 ? pf / g.pct : null;
    values[t] = { multiple: m, why: m != null ? null : pf == null ? "no forward P/E" : !g ? "no forward EPS path" : "EPS is not expected to grow" };
    if (m != null) peers.push({ ticker: t, multiple: m });
  }
  const gOwn = pegGrowth(estimates[T], today, { consensusOnly: forward || foreign(T), fromLast: forward && fromLast }), pfOwn = fwd && fwd.own ? fwd.own.multiple : null, mOwn = gOwn && gOwn.pct > 0 && pfOwn > 0 ? pfOwn / gOwn.pct : null;
  const epsFy1 = snap.eps_fy1, price = (m) => m != null && gOwn && gOwn.pct > 0 && epsFy1 > 0 ? m * gOwn.pct * epsFy1 : null;
  const sorted = peers.slice().sort((a, b) => a.multiple - b.multiple), vals = sorted.map((p) => p.multiple);
  const band = { n: vals.length, min: vals.length ? vals[0] : null, q1: vals.length ? quantile(vals, 0.25) : null, median: vals.length ? median(vals) : null, q3: vals.length ? quantile(vals, 0.75) : null, max: vals.length ? vals[vals.length - 1] : null };
  const at = (m, who = []) => ({ multiple: m, who, price: price(m) });
  const ends = { min: at(band.min, sorted.length ? [sorted[0].ticker] : []), q1: at(band.q1), median: at(band.median), q3: at(band.q3), max: at(band.max, sorted.length ? [sorted[sorted.length - 1].ticker] : []) };
  const ok = band.n >= 2 && ends.median.price != null;
  return { ...(old || { key: "peg", label: "PEG", fmt: "x2" }), key: "peg", basis: forward ? (fromLast ? "forward P/E ÷ forward EPS growth (% a year, from the year just reported on the analysts' basis to the furthest forecast year within three and a half years)" : "forward P/E ÷ forward EPS growth (% a year, from the first forecast year to the furthest within three and a half years)") : "forward P/E ÷ forward EPS growth (% a year, three years out)", growth_from: forward ? (fromLast ? "last year" : "forecast") : "trailing", own: { multiple: mOwn, price: snap.price }, own_why: mOwn != null ? null : null,
    figure: { word: "EPS growth × EPS estimate", value: gOwn && epsFy1 != null ? gOwn.pct * epsFy1 : null, fmt: "usd2", formula: "PEG × growth % × EPS", growth: gOwn ? gOwn.pct : null, growth_basis: gOwn ? gOwn.basis : null },
    n: band.n, band, ends, peers: sorted, nm: [], missing: Object.keys(values).filter((t) => values[t].multiple == null), values, growth, upside: ok && snap.price > 0 ? (ends.median.price / snap.price - 1) * 100 : null,
    ok, reason: ok ? null : band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} carr${band.n === 1 ? "ies" : "y"} this multiple` : null, computable: mOwn != null };
}

/* ---- weights ------------------------------------------------------------------------------------------- */
/** The six measure weights, measured in the set. rows: after applyField. Returns { weights, parts, basis } */
export function measureWeights(rows, peerCount, cls = "default", adj = null) {
  /* CP1 — adj: { table: another prior table (the reit yardstick), credit: { key: multiplier } (the growth credit), off: { key: reason } (the margin gate) } */
  const prior = (adj && adj.table) || SECTOR_PRIOR[cls] || SECTOR_PRIOR.default, parts = {}; let sum = 0;
  for (const r of rows.filter((x) => isValuation(x.key))) {
    const vals = (r.peers || []).map((p) => p.multiple).filter((v) => v != null && v > 0), med = vals.length ? median(vals) : null;
    const coverage = peerCount > 0 ? vals.length / peerCount : 0, errs = med > 0 ? vals.map((v) => Math.abs(med / v - 1)) : [], fit = errs.length ? 1 / (1 + median(errs)) : 0;
    const credit = adj && adj.credit && adj.credit[r.key] > 0 ? adj.credit[r.key] : 1, off = (adj && adj.off && adj.off[r.key]) || null, pr = (prior[r.key] ?? 1) * credit;
    const priced = r.ok && r.ends && r.ends.median && r.ends.median.price != null, score = priced && vals.length >= 2 && !off ? pr * coverage * fit : 0;
    parts[r.key] = { prior: pr, coverage, fit, median_error: errs.length ? median(errs) : null, score, priced, n: vals.length, ...(credit !== 1 ? { credit, prior_before: prior[r.key] ?? 1 } : {}), ...(off ? { off } : {}) }; sum += score;
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
  for (const r of rows.filter((x) => isValuation(x.key) && x.ok && (mw.weights[x.key] || 0) > 0)) {
    const peers = (r.peers || []).filter((p) => p.multiple != null && p.multiple > 0), pwSum = peers.reduce((s, p) => s + (pw.weights[p.ticker] ?? 1), 0);
    if (!peers.length || !(pwSum > 0)) continue;
    const rp = [];
    for (const p of peers) { const price = r.key === "peg" || r.key === "p_ffo" ? (r.ends && r.ends.median && r.ends.median.multiple ? (r.ends.median.price / r.ends.median.multiple) * p.multiple : null) : priceAt(r.key, p.multiple, snap); if (price == null || !(price > 0)) continue; const w = mw.weights[r.key] * (pw.weights[p.ticker] ?? 1) / pwSum; pts.push({ key: r.key, ticker: p.ticker, multiple: p.multiple, price, w }); rp.push({ price, w }); }
    if (rp.length) rowMid[r.key] = wquantile(rp, 0.5);
  }
  if (!pts.length) return { ok: false, way: "C", reason: "no measure can be priced" };
  const lo = wquantile(pts, 0.25), mid = wquantile(pts, 0.5), hi = wquantile(pts, 0.75);
  return { ok: true, way: "C", name: "the whole field", lo, mid, hi, midpoint: (lo + hi) / 2, points: pts, n: pts.length, rowMid, weights: mw.weights, peerWeights: pw.weights, rule: "every peer's implied price on every priced measure, weighted by measure × peer; centre = the weighted median of all of them, low and high the weighted 25th and 75th" };
}
/** Weighted quantile of [{price, w}]: each point sits at the middle of its weight on the cumulative scale
    ((cum − w/2) ÷ W) and the quantile interpolates between neighbours — two equal points give their midpoint. */
export function wquantile(pts, q) {
  const s = pts.filter((p) => p.price != null && p.w > 0).sort((a, b) => a.price - b.price), W = s.reduce((a, p) => a + p.w, 0);
  if (!s.length) return null; if (s.length === 1) return s[0].price;
  let cum = 0; const pos = s.map((p) => { cum += p.w; return (cum - p.w / 2) / W; });
  if (q <= pos[0]) return s[0].price; if (q >= pos[pos.length - 1]) return s[s.length - 1].price;
  for (let i = 1; i < s.length; i++) if (q <= pos[i]) { const f = (q - pos[i - 1]) / (pos[i] - pos[i - 1]); return s[i - 1].price + (s[i].price - s[i - 1].price) * f; }
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
export function conclusion(snap, decisions, estimates, today, way = "C", opts = {}) {
  const fx = opts.fx || CP1_FIELD_OFF, reit = !!(fx.reitYardstick && isReit(snap));
  let rows0 = estimates ? snap.rows.map((r) => (r.key === "peg" ? pegRow(snap, estimates, today, { forward: !!fx.growthForward, fromLast: !!fx.growthFromLastYear }) : r)) : snap.rows;
  if (reit) rows0 = [...rows0.filter((r) => r.key !== "p_ffo"), ffoRow(snap)];   /* CP1 reitYardstick: the seventh row */
  const snap2 = rows0 === snap.rows ? snap : { ...snap, rows: rows0 };
  const F = applyField(snap2, decisions, opts);   /* C6 passes k = Infinity: no cell leaves a centre on one flag */
  const peersOn = snap.members.filter((t) => t !== snap.ticker && !(snap.excluded || []).some((e) => e.ticker === t) && !F.sel.peers.has(t));
  const cls = reit ? "reit" : sectorClass(snap.sector, snap.industry, snap.cohort), cp1 = fieldAdjust(snap2, F.rows, peersOn, fx, reit);
  const mw = measureWeights(F.rows, peersOn.length, cls, cp1.adj), pw = peerWeights(snap, peersOn);
  const W = ways(F.rows, snap2, mw, pw), w = wayOf(W, way);
  const outliers = F.rows.filter((r) => ROWS.includes(r.key)).flatMap((r) => r.outliers.flagged.map((o) => ({ ...o, key: r.key, excluded: r.outliers.excluded.includes(o.ticker), kept: r.outliers.kept.includes(o.ticker) })));
  return { ticker: snap.ticker, price: snap.price, way, band: w && w.ok ? { lo: w.lo, mid: w.mid, hi: w.hi, midpoint: w.midpoint } : null, upside: w && w.ok ? w.upside : null, reason: w && !w.ok ? w.reason : null,
    ways: W, rows: F.rows, sel: F.sel, kept: F.kept, peersOn, off: F.sel.list.length, measureWeights: mw, peerWeights: pw, outliers, snap: snap2, cp1: { fx, reit, growth: cp1.growth, margin: cp1.margin } };
}

/* ---- CP1 · the three field fixes ------------------------------------------------------------------- */
/** P/FFO for a property trust, from the figures the comps reader already holds (snap.table: ffo_ps, p_ffo).
    only: the peers to count (the operator's selection and the outlier rule), or null for every peer. */
export function ffoRow(snap, only = null) {
  const T = snap.ticker, own = (snap.table && snap.table.company) || {}, tp = (snap.table && snap.table.peers) || {};
  const all = snap.members.filter((t) => t !== T && tp[t]).map((t) => ({ ticker: t, multiple: tp[t].p_ffo > 0 ? tp[t].p_ffo : null }));
  const sorted = all.filter((x) => x.multiple != null && (!only || only.includes(x.ticker))).sort((a, b) => a.multiple - b.multiple), vals = sorted.map((p) => p.multiple);
  const band = { n: vals.length, min: vals.length ? vals[0] : null, q1: vals.length ? quantile(vals, 0.25) : null, median: vals.length ? median(vals) : null, q3: vals.length ? quantile(vals, 0.75) : null, max: vals.length ? vals[vals.length - 1] : null };
  const price = (m) => (m != null && own.ffo_ps > 0 ? m * own.ffo_ps : null), at = (m, who = []) => ({ multiple: m, who, price: price(m) });
  const ends = { min: at(band.min, sorted.length ? [sorted[0].ticker] : []), q1: at(band.q1), median: at(band.median), q3: at(band.q3), max: at(band.max, sorted.length ? [sorted[sorted.length - 1].ticker] : []) };
  const ok = band.n >= 2 && ends.median.price != null;
  return { key: "p_ffo", label: "P/FFO", fmt: "x", basis: "price ÷ funds from operations per share, TTM — FFO approximated as net income + depreciation and amortisation from the statements on file", own: { multiple: own.p_ffo > 0 ? own.p_ffo : null, price: snap.price },
    figure: { word: "FFO per share (approx.)", value: own.ffo_ps ?? null, fmt: "usd2", formula: "multiple × FFO per share" }, n: band.n, band, ends, peers: sorted, nm: [], missing: all.filter((x) => x.multiple == null).map((x) => x.ticker),
    values: Object.fromEntries(all.map((x) => [x.ticker, { multiple: x.multiple, why: x.multiple == null ? "no positive FFO on file" : null }])), outliers: { rule: null, fence: null, out: [] },
    upside: ok && snap.price > 0 ? (ends.median.price / snap.price - 1) * 100 : null, ok, reason: ok ? null : band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} carr${band.n === 1 ? "ies" : "y"} this multiple` : `${T} has no positive FFO on file`, computable: own.p_ffo > 0 };
}
/** The adjustment measureWeights takes: the reit table, the growth credit on PEG, the margin gate on the sales rows.
    Returns { adj, growth: { own, peers, ratio, credit } | null, margin: { own, peers, ratio, off } | null }. */
export function fieldAdjust(snap, rows, peersOn, fx = CP1_FIELD_OFF, reit = false) {
  const adj = { table: reit ? REIT_PRIOR : null, credit: {}, off: {} }; let growth = null, margin = null;
  if (fx.growthCredit) {
    /* FD1 growthForward: measured from forecast years a peer's EPS can be expected to SHRINK (Pfizer, Bristol), which
       measured from a depressed trailing figure it never did. A shrinking peer has no PEG, but it is still a peer: it
       counts in the median the company's growth is compared with. When that median is zero or below, a growing company
       takes the full credit. With growthForward off the rule is CP1's, to the letter: growers only. */
    const fwdG = !!fx.growthForward, peg = rows.find((r) => r.key === "peg"), own = peg && peg.figure ? peg.figure.growth : null;
    const gs = peg && peg.growth ? peersOn.map((t) => peg.growth[t] && peg.growth[t].pct).filter((v) => v != null && Number.isFinite(v) && (fwdG || v > 0)) : [], med = gs.length >= 3 ? median(gs) : null;
    if (own > 0 && med != null && (med > 0 || fwdG)) { const ratio = med > 0 ? own / med : Infinity, credit = Math.min(GROWTH_CREDIT_MAX, Math.max(1, ratio)); growth = { own, peers: med, n: gs.length, ratio: Number.isFinite(ratio) ? ratio : null, credit, from: fwdG ? (fx.growthFromLastYear ? "last year" : "forecast") : "trailing" }; if (credit > 1) adj.credit.peg = credit; }
    else growth = { own: own ?? null, peers: med, n: gs.length, ratio: null, credit: 1, why: !(own > 0) ? "the company's forward EPS growth is not positive or not on file" : "fewer than three peers carry forward EPS growth" };
  }
  if (fx.marginGate) {
    const own = snap.table && snap.table.company ? snap.table.company.om : null, ms = peersOn.map((t) => snap.table.peers[t] && snap.table.peers[t].om).filter((v) => v != null && Number.isFinite(v)), med = ms.length >= 3 ? median(ms) : null;
    if (own != null && own > 0 && med != null) {
      const ratio = med > 0 ? own / med : Infinity, apart = ratio > MARGIN_GATE || ratio < 1 / MARGIN_GATE;
      margin = { own, peers: med, n: ms.length, ratio: Number.isFinite(ratio) ? ratio : null, off: apart };
      if (apart) for (const k of SALES_ROWS) adj.off[k] = `operating margin ${own.toFixed(0)}% against the peers' ${med.toFixed(0)}%: more than ${MARGIN_GATE}× apart, so a dollar of sales is not worth the same`;
    } else margin = { own: own ?? null, peers: med, n: ms.length, ratio: null, off: false, why: own == null ? "no operating margin on file" : !(own > 0) ? "the company runs at a loss: the sales rows stay (nothing else prices it)" : "fewer than three peers carry an operating margin" };
  }
  return { adj: adj.table || Object.keys(adj.credit).length || Object.keys(adj.off).length ? adj : null, growth, margin };
}
