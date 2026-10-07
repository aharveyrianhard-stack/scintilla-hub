// SCINTILLA · THE COMPS ARTIFACT READER (CP4, 7 Oct 2026) — pure: no network, no DOM, no clock.
//
// One engine (deliverables/20261007/comps-engine/tools/engine.mjs) writes one artifact: comps.json (every name's summary) and
// names/<TICKER>.json (one name in full). Every screen that prints a comps reading — the Hub's COMPS tab, the decision cards,
// the knockout, the allocation tool — reads those files through the functions below and computes nothing of its own.
// The allocation tool carries a byte-identical copy of this file inline (tests/cp4-one-engine.test.mjs pins the two).
export const ARTIFACT_VERSION = "comps-engine-1";
export const ARTIFACT_PATH = "/deliverables/20261007/comps-engine/data/comps.json";
export const NAME_PATH = (t) => `/deliverables/20261007/comps-engine/data/names/${String(t).toUpperCase()}.json`;
export const YARDSTICK_ORDER = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg", "p_ffo"];
export const YARDSTICK_WORDS = { pe_ttm: "trailing P/E", pe_fwd: "forward P/E", ev_ebitda: "EV/EBITDA", ev_sales: "EV/sales", ps: "P/S", peg: "PEG", p_ffo: "P/FFO" };
const fin = (v) => v != null && Number.isFinite(Number(v));
/** The summary row of one name from comps.json, or null. */
export function summaryOf(index, ticker) { const n = index && index.names && index.names[String(ticker).toUpperCase()]; return n && n.ok ? n : null; }
/** The forward P/E on a price: the engine's earnings, today's price. Returns { pe, text, basis }. */
export function forwardOn(reading, price) {
  const f = reading && reading.forward; if (!f) return null; const eps = f.eps_usd, conv = !!(f.rate), p = fin(price) && price > 0 ? Number(price) : reading.price;
  const pe = fin(eps) && eps > 0 && p > 0 ? p / eps : null;
  return { pe, text: pe == null ? (f.text || "—") : (conv ? "≈" : "") + pe.toFixed(1) + "×", basis: f.label || f.basis || null, on_live_price: fin(price) && price > 0 && price !== reading.price };
}
/** The upside to the centre on a price (the range is in dollars per share and does not move with the price). */
export function upsideOn(reading, price) {
  const b = reading && reading.blend; if (!b || !fin(b.centre)) return null; const p = fin(price) && price > 0 ? Number(price) : reading.price;
  return { low: b.low, centre: b.centre, high: b.high, upside_pct: p > 0 ? (b.centre / p - 1) * 100 : null, upside_before_debt_pct: p > 0 && fin(b.centre_before_debt) ? (b.centre_before_debt / p - 1) * 100 : null, thin: !!b.thin, fragile: !!b.fragile, no_peer_set: !!b.no_peer_set, priced_on: b.priced_on };
}
/** Today's Geiger placed in the name's own year: the artifact carries the percentiles 0, 2, 4 … 100 of the last 250 evenings. */
export function geigerPercentile(geiger, value) {
  const q = geiger && geiger.year && geiger.year.q; if (!q || !fin(value)) return null; const v = Number(value), step = 100 / (q.length - 1);
  if (v <= q[0]) return 0; if (v >= q[q.length - 1]) return 100;
  for (let i = 1; i < q.length; i++) if (v <= q[i]) return Math.round(((i - 1) + (v - q[i - 1]) / ((q[i] - q[i - 1]) || 1)) * step);
  return 100;
}
/** The yardstick rows in Alan's order, each with its weight in percent. */
export function yardstickRows(reading) {
  const y = (reading && reading.yardsticks) || {};
  return YARDSTICK_ORDER.filter((k) => y[k]).map((k) => ({ key: k, word: YARDSTICK_WORDS[k], ...y[k], weight_pct: fin(y[k].weight) ? Math.round(y[k].weight * 100) : 0 }));
}
/** The football field as inline SVG: one bar per yardstick (its implied price at the peers' median), the blend's band, the price. */
export function footballFieldSVG(reading, price, { width = 420, height = null } = {}) {
  const rows = yardstickRows(reading).filter((r) => fin(r.implied) && r.implied > 0), b = reading && reading.blend; if (!rows.length || !b || !fin(b.centre)) return "";
  const p = fin(price) && price > 0 ? Number(price) : reading.price, H = height || 18 * rows.length + 30, L = 120, R = width - 44;
  const vals = [...rows.map((r) => r.implied), b.low, b.high, p].filter((v) => fin(v) && v > 0), lo = Math.min(...vals) * 0.9, hi = Math.max(...vals) * 1.05, x = (v) => L + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (R - L);
  const bars = rows.map((r, i) => { const y = 10 + i * 18, far = r.consistency && r.consistency.far; return `<text x="${L - 6}" y="${y + 9}" text-anchor="end" font-size="11" fill="#9a9aa6">${r.word} ${r.weight_pct}%</text><line x1="${x(Math.min(p, r.implied))}" x2="${x(Math.max(p, r.implied))}" y1="${y + 5}" y2="${y + 5}" stroke="${r.implied >= p ? "#3c9a5f" : "#b04a4a"}" stroke-width="${Math.max(2, Math.round(10 * (r.weight || 0)) + 2)}" stroke-dasharray="${far ? "3 3" : "none"}" opacity="${(r.weight || 0) > 0 ? 1 : 0.35}"/><text x="${x(r.implied) + (r.implied >= p ? 4 : -4)}" y="${y + 9}" text-anchor="${r.implied >= p ? "start" : "end"}" font-size="11" fill="#c8c8d0">${Math.round(r.implied)}</text>`; }).join("");
  const band = `<rect x="${x(b.low)}" y="4" width="${Math.max(1, x(b.high) - x(b.low))}" height="${H - 8}" fill="#8a8a96" opacity="0.12"/><line x1="${x(b.centre)}" x2="${x(b.centre)}" y1="4" y2="${H - 4}" stroke="#c8c8d0" stroke-width="1.5"/><text x="${x(b.centre)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#c8c8d0">centre ${Math.round(b.centre)}</text>`;
  const px = `<line x1="${x(p)}" x2="${x(p)}" y1="4" y2="${H - 4}" stroke="#e0e0e6" stroke-width="1" stroke-dasharray="2 2"/><text x="${x(p)}" y="${H - 16}" text-anchor="middle" font-size="11" fill="#e0e0e6">price ${Math.round(p)}</text>`;
  return `<svg viewBox="0 0 ${width} ${H}" width="100%" style="max-width:${width}px;display:block" role="img" aria-label="football field">${band}${bars}${px}</svg>`;
}
/** The four sources' dots for one peer: ● for a vote, ○ for none, in the order FMP · Massive · industry · fund. */
export const voteDots = (v) => (v ? [v.fmp, v.massive, v.industry, v.fund].map((x) => (x ? "●" : "○")).join("") : "○○○○");
/** A reading's flags, in words, with the internal set words made plain. */
export const flagWords = (reading) => ((reading && reading.flags) || []).map((f) => String(f).replace(/^THIN:/, "thin:").replace(/^FRAGILE:/, "fragile:"));
