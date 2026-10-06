/* Scintilla · comps C6 (5 Oct) · outliers across the columns. Pure: no DOM, no fetch.

   Alan (5 Oct): "What method do you think of capturing things that are far, very far away from medians? And if that
   happens across multiple columns of the comps table, then the ticker responsible becomes more and more of a candidate
   of an outlier."

   PER COLUMN (all sixteen of the comps table): the peers' values, the six multiples on a LOG scale (a 300× P/E is ten
     times a 30×, not 270 further), the ten fundamentals as they are (they can be negative). The column's centre is the
     median, its typical spread the median absolute deviation (MAD × 1.4826, so it reads like a standard deviation;
     when half the peers sit on one value and MAD is zero, the mean absolute deviation × 1.2533 stands in). A peer's
     DISTANCE is (value − median) ÷ spread. A cell is FLAGGED beyond 3.5 — the modified z-score cut of Iglewicz &
     Hoaglin (1993), the one the NIST e-Handbook (1.3.5.17) recommends. A column with fewer than 5 peers cannot define a
     pack and judges no one.
   ACROSS COLUMNS: a peer's score = how many columns flag it (and how far: the sum of its flagged distances). A peer
     flagged in 3 or more columns, or in at least 40% of the columns that judged it (and at least 2, so one flag never
     decides), is an OUTLIER: greyed with its flags visible, left out of the medians and the implied price, never
     deleted. One flag only = a marked cell, still counted. One click keeps an outlier in (a comps_decisions row, off =
     false, reason "keep", measure ALL — like any edit).
   One pass: the flags are measured on the whole group once; the group is not re-measured after the outliers leave
     (median and MAD hold up to half the peers being wild, and a second pass would keep peeling a tight pack). */
import { latestDecisions, selectionOf } from "../../20260930/comps-tab/comps-tab.mjs";
import { ROWS, TABLE, SHORT } from "../../20261001/comps-template/cohort.mjs";
import { conclusion, pegRow, median } from "../../20261003/comps-c5/field.mjs";

export const CUT = 3.5, MIN_N = 5, MIN_FLAGS = 3, SHARE = 0.4, SHARE_MIN_FLAGS = 2, MAD_SCALE = 1.4826, MEANAD_SCALE = 1.2533;
export const COLUMNS = TABLE.map((c) => ({ key: c.key, label: c.label, short: SHORT[c.key] || c.label, fmt: c.fmt, log: ROWS.includes(c.key) }));
const RULE_AT = "9999-12-31T00:00:00.000Z";

/** One column. cells: [{ticker, v}] · log: put the values on a log scale (multiples; non-positive values carry no data).
    Returns { n, judged, median, spread, basis, cells: { T: { v, d, flag, side } } } — d in units of the column's spread. */
export function columnDistances(cells, { log = false, cut = CUT, minN = MIN_N } = {}) {
  const have = (cells || []).filter((c) => c.v != null && Number.isFinite(c.v) && (!log || c.v > 0));
  const out = { n: have.length, judged: false, median: null, spread: null, basis: null, cells: {} };
  if (!have.length) return out;
  const xs = have.map((c) => (log ? Math.log(c.v) : c.v)), m = median(xs), dev = xs.map((x) => Math.abs(x - m));
  out.median = log ? Math.exp(m) : m;
  let spread = median(dev) * MAD_SCALE, basis = "MAD";
  if (!(spread > 0)) { spread = (dev.reduce((s, x) => s + x, 0) / dev.length) * MEANAD_SCALE; basis = "mean absolute deviation"; }
  const judged = have.length >= minN && spread > 0;
  out.judged = judged; out.spread = spread > 0 ? spread : null; out.basis = spread > 0 ? basis : null;
  have.forEach((c, i) => { const d = judged ? (xs[i] - m) / spread : null; out.cells[c.ticker] = { v: c.v, d, flag: judged && Math.abs(d) > cut, side: d == null ? null : d > 0 ? "high" : "low" }; });
  return out;
}

/** The sixteen columns of one set. rows: the valuation rows (PEG already rebuilt), table: snap.table, peers: the tickers
    judged, cellsOff: Set("PEER|measure") the operator turned off. Returns { key: columnDistances(...) }. */
export function columnsOf(rows, table, peers, { cellsOff = new Set(), cut = CUT, minN = MIN_N } = {}) {
  const cols = {};
  for (const c of COLUMNS) {
    const row = c.log ? (rows || []).find((r) => r.key === c.key) : null;
    const cells = peers.map((t) => ({ ticker: t, v: cellsOff.has(t + "|" + c.key) ? null : c.log ? (row && row.values && row.values[t] ? row.values[t].multiple : null) : table && table.peers && table.peers[t] ? table.peers[t][c.key] : null }));
    cols[c.key] = { ...c, ...columnDistances(cells, { log: c.log, cut, minN }) };
  }
  return cols;
}

/** Alan's idea: per peer, how many columns flag it and how far. cols: from columnsOf.
    Returns { T: { have, flags: [{key, short, d, side, v}], n, far, share, outlier, words } }. */
export function scorePeers(cols, peers, { minFlags = MIN_FLAGS, share = SHARE, shareMinFlags = SHARE_MIN_FLAGS } = {}) {
  const out = {};
  for (const t of peers) {
    const judged = Object.values(cols).filter((c) => c.judged && c.cells[t]);
    const flags = judged.filter((c) => c.cells[t].flag).map((c) => ({ key: c.key, short: c.short, d: c.cells[t].d, side: c.cells[t].side, v: c.cells[t].v })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const n = flags.length, have = judged.length, sh = have ? n / have : 0;
    const outlier = n >= minFlags || (n >= shareMinFlags && sh >= share);
    out[t] = { have, flags, n, far: flags.reduce((s, f) => s + Math.abs(f.d), 0), share: sh, outlier, words: n ? `far from the group in ${n} of ${have} columns` : "" };
  }
  return out;
}

/** The peers the operator KEPT against the rule: latest decision on PEER|ALL is off = false with a reason starting "keep". */
export function keptPeers(decisions, company) {
  const s = new Set();
  for (const r of latestDecisions(decisions || [], company)) if ((r.off === false || r.off === "false") && /^keep/i.test(String(r.reason || "")) && (!r.measure || r.measure === "ALL")) s.add(String(r.peer).toUpperCase());
  return s;
}

/** Everything the page draws, C6: C5's conclusion with the outlier PEERS left out (and no cell dropped on one flag),
    plus `c6`: { cols, score, outliers: [tickers out], kept: [outliers kept in], withOutliers: the same conclusion with
    every peer in }. The band/ways/rows of the result are WITHOUT the outliers. */
export function conclusion6(snap, decisions, estimates, today, way = "C", { only = null } = {}) {
  const T = snap.ticker, dec = decisions || [], sel = selectionOf(dec, T), kept = keptPeers(dec, T);
  const rows = estimates ? snap.rows.map((r) => (r.key === "peg" ? pegRow(snap, estimates, today) : r)) : snap.rows;
  const peers = snap.members.filter((t) => t !== T && !(snap.excluded || []).some((e) => e.ticker === t) && !sel.peers.has(t));
  const allCols = columnsOf(rows, snap.table, peers, { cellsOff: sel.cells }), cols = only ? Object.fromEntries(Object.entries(allCols).filter(([k]) => only.includes(k))) : allCols, score = scorePeers(cols, peers);   /* only: a what-if on fewer columns (the report's alternative), never the tab */
  const flagged = peers.filter((t) => score[t].outlier).sort((a, b) => score[b].n - score[a].n || score[b].far - score[a].far);
  const out = flagged.filter((t) => !kept.has(t)), keptIn = flagged.filter((t) => kept.has(t));
  const rule = out.map((t) => ({ company: T, peer: t, measure: "ALL", off: true, reason: "outlier: " + score[t].words, set_by: "rule", set_at: RULE_AT }));
  const opts = { k: Infinity };
  const withAll = conclusion(snap, dec, estimates, today, way, opts);
  const C = out.length ? conclusion(snap, [...dec, ...rule], estimates, today, way, opts) : withAll;
  const ruleOff = new Set(out);
  return { ...C, sel: { ...C.sel, list: C.sel.list.filter((d) => d.set_by !== "rule"), userPeers: sel.peers }, off: sel.list.length,
    c6: { cols, score, peers, outliers: out, kept: keptIn, ruleOff, flaggedCells: peers.reduce((s, t) => s + score[t].n, 0), withOutliers: withAll, centre: { with: withAll.band ? withAll.band.mid : null, without: C.band ? C.band.mid : null } } };
}
export const isFlagged = (c6, peer, key) => !!(c6 && c6.cols[key] && c6.cols[key].cells[peer] && c6.cols[key].cells[peer].flag);
