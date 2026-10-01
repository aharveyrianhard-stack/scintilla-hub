/* Scintilla · comps template (C3, 1 Oct) · pure: the conclusion (four ways on one company), the weights (equal, and a
   justified reliability weighting), the row summaries, the cohort table. No DOM, no fetch. */
import { rangeOfMedians, middleHalfBand, weightedBlend, upsideTo, median } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { selectionOf, applySelection } from "../../20260930/comps-tab/comps-tab.mjs";
import { ROWS, SHORT } from "./cohort.mjs";
export { ROWS, SHORT, upsideTo, median, selectionOf, applySelection };

export const WAYS = ["A", "B", "CE", "CW"];
export const WAY_WORDS = {
  A: { short: "A", name: "range of the medians", plain: "from the lowest of the six implied medians to the highest; the centre is their middle" },
  B: { short: "B", name: "middle-half band", plain: "the middle of the six 25ths to the middle of the six 75ths; the centre is the middle of the six medians" },
  CE: { short: "C equal", name: "equal-weight blend", plain: "each priced row counts the same: the average of the rows' 25ths, medians and 75ths" },
  CW: { short: "C weighted", name: "reliability-weighted blend", plain: "each row weighted by how reliable it is in this cohort: a sector prior × coverage × tightness × pricing fit (see the note)" },
};

/* ---- weights --------------------------------------------------------------------------------------- */
/** Equal weight over the rows that price the company. */
export function equalWeights(rows) { const ok = rows.filter((r) => r.ok && r.ends && r.ends.median && r.ends.median.price != null); const w = {}; for (const r of ok) w[r.key] = 1 / ok.length; return w; }

/** The sector prior: which multiples practitioners lean on where (Damodaran's relative-valuation notes; Koller et al.,
    McKinsey "Valuation": forward EV/EBITA for most operating companies; Liu–Nissim–Thomas 2002: forward earnings first,
    then trailing earnings, then cash-flow / book, then sales). Multipliers around 1; stated on the page. */
export const SECTOR_PRIOR = {
  default: { pe_ttm: 1.0, pe_fwd: 1.2, ev_ebitda: 1.2, ev_sales: 0.8, ps: 0.7, peg: 0.8 },
  "capital-intensive": { pe_ttm: 0.9, pe_fwd: 1.2, ev_ebitda: 1.5, ev_sales: 0.8, ps: 0.6, peg: 0.8 },      // semis, hardware, industrials, energy, materials, utilities, telecom
  "software-services": { pe_ttm: 0.8, pe_fwd: 1.2, ev_ebitda: 1.0, ev_sales: 1.2, ps: 1.1, peg: 1.0 },      // software, internet, media
  "consumer": { pe_ttm: 1.1, pe_fwd: 1.3, ev_ebitda: 1.2, ev_sales: 0.7, ps: 0.7, peg: 0.9 },               // consumer, retail, healthcare
  "financial": { pe_ttm: 1.3, pe_fwd: 1.4, ev_ebitda: 0.3, ev_sales: 0.3, ps: 0.6, peg: 0.9 },              // EV multiples mean little for a bank
};
export function sectorClass(sector, industry, cohort) {
  const s = [sector, industry, cohort].filter(Boolean).join(" ").toLowerCase();
  if (/semicon|hardware|industrial|energy|material|utilit|telecom|chemical|auto|aerospace|powertrain|metal|mining|oil|gas|equipment/.test(s)) return "capital-intensive";
  if (/software|internet|media|interactive|saas|cloud|communication services/.test(s)) return "software-services";
  if (/consumer|retail|health|pharma|biotech|food|beverage|apparel|restaurant/.test(s)) return "consumer";
  if (/bank|financ|insur|capital markets|asset manag/.test(s)) return "financial";
  return "default";
}

/** The reliability of each valuation row IN THIS COHORT, from the rows themselves:
    coverage  = share of the peers that carry a meaningful value on the row (0..1);
    tightness = 1 ÷ (1 + the middle half's width over the median) — a wide, loose row earns less;
    fit       = 1 ÷ (1 + the median pricing error): each peer priced at the peer median is off by |median ÷ own − 1|,
                the Liu–Nissim–Thomas pricing error; a row that prices its own cohort well earns more.
    weight ∝ prior × coverage × tightness × fit over the rows that price the company; normalised to one. */
export function reliability(rows, peerCount, cls = "default") {
  const prior = SECTOR_PRIOR[cls] || SECTOR_PRIOR.default;
  const out = {};
  for (const r of rows) {
    const vals = (r.peers || []).map((p) => p.multiple).filter((v) => v != null && v > 0);
    const med = vals.length ? median(vals) : null;
    const coverage = peerCount > 0 ? vals.length / peerCount : 0;
    const tight = r.band && r.band.n >= 2 && med > 0 ? 1 / (1 + (r.band.q3 - r.band.q1) / med) : 0;
    const errs = med > 0 ? vals.map((v) => Math.abs(med / v - 1)) : [];
    const fit = errs.length ? 1 / (1 + median(errs)) : 0;
    const priced = r.ok && r.ends && r.ends.median && r.ends.median.price != null;
    const score = priced ? (prior[r.key] || 1) * coverage * tight * fit : 0;
    out[r.key] = { prior: prior[r.key] || 1, coverage, tightness: tight, fit, median_error: errs.length ? median(errs) : null, score, priced };
  }
  const sum = Object.values(out).reduce((s, x) => s + x.score, 0);
  const weights = {};
  for (const [k, x] of Object.entries(out)) weights[k] = sum > 0 ? x.score / sum : 0;
  return { cls, prior, parts: out, weights };
}

/* ---- the four ways on one company ---------------------------------------------------------------------- */
/** rows: the valuation rows (ALL PEERS or YOUR SELECTION); price: today. Returns the four ways, each {lo, mid, hi, upside}. */
export function fourWays(rows, price, { peerCount = null, cls = "default" } = {}) {
  const rel = reliability(rows, peerCount == null ? Math.max(...rows.map((r) => Object.keys(r.values || {}).length), 0) : peerCount, cls);
  const eq = equalWeights(rows);
  const list = [
    { ...rangeOfMedians(rows), way: "A" }, { ...middleHalfBand(rows), way: "B" },
    { ...weightedBlend(rows, eq), way: "CE", weights: eq }, { ...weightedBlend(rows, rel.weights), way: "CW", weights: rel.weights, reliability: rel },
  ];
  for (const w of list) { w.short = WAY_WORDS[w.way].short; w.name = WAY_WORDS[w.way].name; w.plain = WAY_WORDS[w.way].plain; if (w.ok) w.upside = { lo: upsideTo(price, w.lo), mid: upsideTo(price, w.mid), hi: upsideTo(price, w.hi) }; }
  return list;
}
export const wayOf = (list, way) => list.find((w) => w.way === way) || null;

/** One line on how far the ways disagree for this company: the spread of the four centres as a share of today's price. */
export function disagreement(list, price) {
  const ok = list.filter((w) => w.ok);
  if (ok.length < 2 || !(price > 0)) return { ok: false, words: "only one way can be computed" };
  const mids = ok.map((w) => w.mid), lo = Math.min(...mids), hi = Math.max(...mids), spread = (hi - lo) / price * 100;
  const loW = ok.find((w) => w.mid === lo).short, hiW = ok.find((w) => w.mid === hi).short;
  const word = spread < 5 ? "they agree" : spread < 15 ? "they broadly agree" : spread < 30 ? "they disagree" : "they disagree a lot";
  return { ok: true, lo, hi, spread, loWay: loW, hiWay: hiW, words: `${word}: the four centres sit between $${Math.round(lo).toLocaleString("en-US")} (${loW}) and $${Math.round(hi).toLocaleString("en-US")} (${hiW}), ${spread.toFixed(spread >= 10 ? 0 : 1)}% of today's price apart` };
}

/** The conclusion card's numbers for one company and one way, on the selection in force. */
export function conclusion(snap, decisions, way = "B") {
  const sel = selectionOf(decisions || [], snap.ticker);
  const rows = applySelection(snap, sel), peerCount = snap.members.filter((t) => t !== snap.ticker && !(snap.excluded || []).some((e) => e.ticker === t)).length;
  const cls = sectorClass(snap.sector, snap.industry, snap.cohort);
  const ways = fourWays(rows, snap.price, { peerCount, cls }), waysAll = fourWays(snap.rows, snap.price, { peerCount, cls });
  const w = wayOf(ways, way);
  return { ticker: snap.ticker, price: snap.price, way, band: w && w.ok ? { lo: w.lo, mid: w.mid, hi: w.hi } : null, upside: w && w.ok ? w.upside : null, reason: w && !w.ok ? w.reason : null,
    ways, waysAll, disagreement: disagreement(ways, snap.price), off: sel.list.length, rows, sel, cls, reliability: wayOf(ways, "CW").reliability };
}

/** The six rows, summarised for the card: the company against the median, one upside number; the 25th/75th in the detail. */
export function rowSummaries(rows, ticker) {
  return rows.map((r) => ({ key: r.key, label: r.label, short: SHORT[r.key], n: r.n, ok: r.ok, reason: r.reason || null, own: r.own ? r.own.multiple : null, own_why: r.own_why || null, median: r.band ? r.band.median : null, min: r.band ? r.band.min : null, max: r.band ? r.band.max : null,
    upside: r.ok && r.own && r.own.price > 0 && r.ends && r.ends.median && r.ends.median.price != null ? (r.ends.median.price / r.own.price - 1) * 100 : null,
    detail: r.ok && r.ends ? { q1: r.ends.q1, median: r.ends.median, q3: r.ends.q3, up: { q1: upsideTo(r.own.price, r.ends.q1.price), median: upsideTo(r.own.price, r.ends.median.price), q3: upsideTo(r.own.price, r.ends.q3.price) } } : null, dropped: r.dropped || [] }));
}

/* ---- the cohort table on the chosen way ------------------------------------------------------------ */
export function cohortTable(snapshots, decisions, way = "B") {
  const rows = snapshots.map((s) => {
    const c = conclusion(s, decisions, way), all = wayOf(c.waysAll, way), mine = wayOf(c.ways, way);
    const up = (w) => w && w.ok ? { lo: w.upside.lo.pct, mid: w.upside.mid.pct, hi: w.upside.hi.pct, loUsd: w.lo, midUsd: w.mid, hiUsd: w.hi } : null;
    return { ticker: s.ticker, name: s.name, price: s.price, geiger: s.geiger ?? null, all: up(all), sel: up(mine), off: c.off, rows_priced: s.rows.filter((r) => r.ok).length, fx: s.fx && s.fx.currency && s.fx.currency !== "USD" ? (s.fx.converted ? s.fx.currency + " → USD" : s.fx.currency + " · not converted") : null };
  });
  return { way, rows };
}
export function sortCohort(rows, key, dir = -1) {
  const get = (r) => { const [a, b] = key.split("."); const v = b ? (r[a] ? r[a][b] : null) : r[a]; return v == null ? null : v; };
  return rows.slice().sort((x, y) => { const a = get(x), b = get(y); if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; if (typeof a === "string") return dir * a.localeCompare(b); return dir * (a - b); });
}
