/* Scintilla · COMPS tab (C2, 30 Sep) · pure functions: the operator's selection, the flags, the three ways, the cohort table.
   No DOM, no fetch, no clock. The tab (tab.mjs) and the tests import this file.

   THE DECISION (stored the way the Hub stores lists: one dated row per decision, latest per key wins, "put back" is a new
   row that turns the peer or the cell back on — history is never erased):
     { company, peer, measure ('ALL' or one of the six keys), off: true|false, reason, set_by, set_at }
   THE SELECTION: the peers and cells that are off for one company, read from the latest decisions.
   THE FLAGS (a proposal on the page, never a removal):
     NOT MEANINGFUL — the peer has no number on that measure (negative or undefined multiple);
     FAR FROM THE PACK — more than 3 typical gaps from the peer median on that measure, the typical gap being the median
       distance of the peers from their median (both numbers printed);
     DIFFERENT BUSINESS — the operator's own toggle with a reason. */

import { repriceRow, priceAt } from "../../20260929/comps-live/ladder.mjs";
import { combined, middleHalfBand, rangeOfMedians, weightedBlend, upsideTo, median, DEFAULT_WEIGHTS } from "../../20260928/comps-r3-labels/labels-r3.mjs";
import { ROWS, SHORT } from "./cohort.mjs";

export { ROWS, SHORT, DEFAULT_WEIGHTS, upsideTo, median };
export const MEASURES = ["ALL", ...ROWS];
export const FAR_K = 3;
export const FLAG_WORDS = { nm: "NOT MEANINGFUL", far: "FAR FROM THE PACK", op: "DIFFERENT BUSINESS" };

/* ---- decisions → selection ---------------------------------------------------------------------- */

/** The latest decision per (peer, measure) for one company. rows: decision rows in any order. */
export function latestDecisions(rows, company) {
  const C = String(company).toUpperCase(), m = new Map();
  for (const r of rows || []) {
    if (String(r.company).toUpperCase() !== C) continue;
    const k = String(r.peer).toUpperCase() + "|" + (r.measure || "ALL");
    const cur = m.get(k);
    if (!cur || String(r.set_at) > String(cur.set_at) || (String(r.set_at) === String(cur.set_at) && (r.id || 0) > (cur.id || 0))) m.set(k, r);
  }
  return [...m.values()];
}

/** What is off: { peers: Set, cells: Set("PEER|measure"), list: [{peer, measure, reason, set_at}] }. */
export function selectionOf(rows, company) {
  const latest = latestDecisions(rows, company).filter((r) => r.off === true || r.off === "true");
  const peers = new Set(), cells = new Set();
  for (const r of latest) { const P = String(r.peer).toUpperCase(); if (!r.measure || r.measure === "ALL") peers.add(P); else cells.add(P + "|" + r.measure); }
  return { peers, cells, list: latest.map((r) => ({ peer: String(r.peer).toUpperCase(), measure: r.measure || "ALL", reason: r.reason || "", set_at: r.set_at || null, set_by: r.set_by || null })) };
}
export const isOff = (sel, peer, measure) => sel.peers.has(peer) || sel.cells.has(peer + "|" + measure);

/** A new decision row (pure; the caller stores it). */
export function decisionRow({ company, peer, measure = "ALL", off, reason = "", set_by = "alan", set_at }) {
  if (!MEASURES.includes(measure)) throw new Error("unknown measure " + measure);
  return { company: String(company).toUpperCase(), peer: String(peer).toUpperCase(), measure, off: !!off, reason: String(reason || ""), set_by, set_at: set_at || new Date().toISOString() };
}

/* ---- the selection applied: the same arithmetic on fewer peers -------------------------------------- */

/** ALL PEERS rows are the snapshot's; YOUR SELECTION rows drop the off peers and cells and reprice. */
export function applySelection(snap, sel) {
  return snap.rows.map((r) => {
    const keep = (r.peers || []).filter((p) => !isOff(sel, p.ticker, r.key));
    const dropped = (r.peers || []).filter((p) => isOff(sel, p.ticker, r.key)).map((p) => p.ticker);
    if (!dropped.length) return { ...r, dropped: [] };
    return { ...repriceRow(r, keep, snap), dropped };
  });
}

/* ---- the flags ------------------------------------------------------------------------------------- */

/** Per row: the median, the typical gap (median |peer − median|), the threshold (k × typical), and per peer: the
    distance in gaps and whether it is far. A peer with no number is NOT MEANINGFUL, with the row's reason. */
export function flagRow(r, k = FAR_K) {
  const vals = (r.peers || []).map((p) => p.multiple).filter((v) => v != null && Number.isFinite(v));
  const med = median(vals);
  const gaps = vals.map((v) => Math.abs(v - med));
  const typical = gaps.length ? median(gaps) : null;
  const threshold = typical != null ? k * typical : null;
  const cells = {};
  for (const [t, v] of Object.entries(r.values || {})) {
    if (v.multiple == null) cells[t] = { flag: "nm", why: v.why || "no number on this measure", gaps: null };
    else {
      const g = typical > 0 ? Math.abs(v.multiple - med) / typical : (v.multiple === med ? 0 : Infinity);
      cells[t] = { flag: typical != null && typical > 0 ? (Math.abs(v.multiple - med) > threshold ? "far" : null) : (vals.length > 1 && v.multiple !== med ? "far" : null), gaps: g, side: v.multiple > med ? "high" : v.multiple < med ? "low" : "at" };
    }
  }
  return { key: r.key, median: med, typical, k, threshold, n: vals.length, cells };
}
export function flags(snap, k = FAR_K) { return Object.fromEntries(snap.rows.map((r) => [r.key, flagRow(r, k)])); }

/* ---- the three ways ---------------------------------------------------------------------------------- */

export const WAY_WORDS = {
  A: { name: "Range of the medians", plain: "the six implied medians on one line: from the lowest to the highest; the centre is the middle of the six" },
  B: { name: "Middle-half band", plain: "the middle of the six 25th-percentile prices to the middle of the six 75ths; the centre is the middle of the six medians" },
  C: { name: "Weighted blend", plain: "one weighted number per mark: P/E 30% · EV/EBITDA 30% · EV/S 15% · P/S 10% · P/E fwd 10% · PEG 5% (the weights are a proposal)" },
};
/** A, B and C on a set of rows, each with the upside from today's price. */
export function ways(rows, price) {
  const W = combined(rows, price);
  for (const w of W) { w.plain = WAY_WORDS[w.way].plain; if (w.ok) w.upsidePct = { lo: w.upside.lo && w.upside.lo.pct, mid: w.upside.mid && w.upside.mid.pct, hi: w.upside.hi && w.upside.hi.pct }; }
  return W;
}
export const wayOf = (W, letter) => W.find((w) => w.way === letter) || null;

/* ---- the cohort table ------------------------------------------------------------------------------- */

/** Every company of the cohort: price, Geiger, and the chosen way's low / centre / high upside for ALL PEERS and for
    that company's own saved selection. snapshots: [snapshot per member]; decisions: all rows; way: 'A' | 'B' | 'C'. */
export function cohortTable(snapshots, decisions, way = "B") {
  const rows = snapshots.map((s) => {
    const sel = selectionOf(decisions, s.ticker);
    const all = wayOf(ways(s.rows, s.price), way), mine = wayOf(ways(applySelection(s, sel), s.price), way);
    const up = (w) => w && w.ok ? { lo: w.upside.lo.pct, mid: w.upside.mid.pct, hi: w.upside.hi.pct, loUsd: w.lo, midUsd: w.mid, hiUsd: w.hi } : null;
    return { ticker: s.ticker, name: s.name, price: s.price, price_from: s.price_from || null, geiger: s.geiger ?? null, geiger_at: s.geiger_at || null,
      all: up(all), sel: up(mine), off: sel.list.length, rows_priced: s.rows.filter((r) => r.ok).length, is_etf: false };
  });
  return { way, rows, sortable: ["ticker", "price", "all.lo", "all.mid", "all.hi", "sel.lo", "sel.mid", "sel.hi", "geiger", "off"] };
}
export function sortCohort(rows, key, dir = -1) {
  const get = (r) => { const [a, b] = key.split("."); const v = b ? (r[a] ? r[a][b] : null) : r[a]; return v == null ? null : v; };
  return rows.slice().sort((x, y) => { const a = get(x), b = get(y); if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; if (typeof a === "string") return dir * a.localeCompare(b); return dir * (a - b); });
}
export { applySelection as select, priceAt, middleHalfBand, rangeOfMedians, weightedBlend };
