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
   ACROSS COLUMNS (C6 as first built; see C6b below for what votes now): a peer's score = how many columns flag it (and how far: the sum of its flagged distances). A peer
     flagged in 3 or more columns, or in at least 40% of the columns that judged it (and at least 2, so one flag never
     decides), is an OUTLIER: greyed with its flags visible, left out of the medians and the implied price, never
     deleted. One flag only = a marked cell, still counted. One click keeps an outlier in (a comps_decisions row, off =
     false, reason "keep", measure ALL — like any edit).
   C6b (5 Oct, the coordinator's mechanics fix on C6's finding that growth and capex did the catching): an outlier is a
     peer whose PRICE is strange relative to the group, not a peer that grows fast.
     1 Only the valuation multiples VOTE (P/E, EV/EBITDA, EV/sales, P/S, PEG). Growth, margin, capex and leverage cells
       are still marked when far out (information) and never count toward the verdict.
     2 The verdict: flagged on 3 or more of the votes, or on at least 50% of the votes the peer has (and at least 2).
     3 Correlated columns count once: trailing and forward P/E are ONE vote (flagged when either is).
     4 A wrong-business peer set is a different problem: when fewer than half the peers share the company's business
       (C5's own lines: at least SIM_MIN of revenue in a line shared exactly, not just the same family) the set is
       named "mostly different business" and the rule does not cut the peers that DO share it — fix the peers, not
       the outliers.
     C6's rule as first built (all sixteen columns each a vote, 40%) stays reproducible as C6_RULE, for the report.
   One pass: the flags are measured on the whole group once; the group is not re-measured after the outliers leave
     (median and MAD hold up to half the peers being wild, and a second pass would keep peeling a tight pack). */
import { latestDecisions, selectionOf } from "../../20260930/comps-tab/comps-tab.mjs";
import { ROWS, TABLE, SHORT } from "../../20261001/comps-template/cohort.mjs";
import { conclusion, pegRow, median } from "../../20261003/comps-c5/field.mjs";
import { SIM_MIN } from "../../20261003/comps-c5/lines.mjs";

export const CUT = 3.5, MIN_N = 5, MIN_FLAGS = 3, SHARE = 0.5, SHARE_MIN_FLAGS = 2, MAD_SCALE = 1.4826, MEANAD_SCALE = 1.2533;
export const COLUMNS = TABLE.map((c) => ({ key: c.key, label: c.label, short: SHORT[c.key] || c.label, fmt: c.fmt, log: ROWS.includes(c.key) }));
/* C6b · the votes: the valuation multiples only, trailing and forward P/E as one */
export const VOTES = [{ key: "pe", short: "P/E", cols: ["pe_ttm", "pe_fwd"] }, ...ROWS.filter((k) => k !== "pe_ttm" && k !== "pe_fwd").map((k) => ({ key: k, short: SHORT[k] || k, cols: [k] }))];
export const C6_RULE = { votes: COLUMNS.map((c) => ({ key: c.key, short: c.short, cols: [c.key] })), share: 0.4, noun: "columns", lead: "far from the group in" };
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

/** Alan's idea, C6b's votes: per peer, on how many VOTES it is flagged and how far. cols: from columnsOf (or any
    { key: { key, short, judged, cells } }); votes: [{ key, short, cols: [column keys] }] — a vote is flagged when any
    of its columns flags the peer, and the peer HAS the vote when any of its columns judged it. Columns that belong to
    no vote are information only (`info`).
    Returns { T: { have, flags: [{key (the farthest column), vote, short, d, side, v}], n, far, share, outlier, words, marks, info } }. */
export function scorePeers(cols, peers, { votes = VOTES, minFlags = MIN_FLAGS, share = SHARE, shareMinFlags = SHARE_MIN_FLAGS, noun = "multiples", lead = "priced far from the group on" } = {}) {
  const out = {}, voting = new Set(votes.flatMap((v) => v.cols));
  const cell = (k, t) => (cols[k] && cols[k].judged && cols[k].cells[t]) || null;
  const mark = (k, t) => ({ key: k, short: cols[k].short, d: cols[k].cells[t].d, side: cols[k].cells[t].side, v: cols[k].cells[t].v });
  for (const t of peers) {
    let have = 0; const flags = [];
    for (const v of votes) {
      const on = v.cols.filter((k) => cell(k, t)); if (!on.length) continue; have++;
      const far = on.filter((k) => cols[k].cells[t].flag).map((k) => mark(k, t)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      if (far.length) flags.push({ ...far[0], vote: v.key, voteShort: v.short, cols: far.map((f) => f.key) });
    }
    flags.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const info = Object.keys(cols).filter((k) => !voting.has(k) && cell(k, t) && cols[k].cells[t].flag).map((k) => mark(k, t)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const n = flags.length, sh = have ? n / have : 0, marks = flags.reduce((x, f) => x + f.cols.length, 0) + info.length;
    const outlier = n >= minFlags || (n >= shareMinFlags && sh >= share);
    out[t] = { have, flags, info, marks, n, far: flags.reduce((x, f) => x + Math.abs(f.d), 0), share: sh, outlier, words: n ? `${lead} ${n} of ${have} ${noun}` : "" };
  }
  return out;
}

/** C6b 4 · does the peer set share the company's business? set: C5's buildSet result (kept rows carry `exact`, the
    share of revenue in a line shared exactly with the company). A peer SHARES when exact >= SIM_MIN, C5's own
    membership bar. Returns { n, same: [tickers], line, mostlyDifferent } or null when the set carries no lines. */
export function businessOf(set, peers) {
  if (!set || !Array.isArray(set.kept)) return null;
  const rows = peers.map((t) => set.kept.find((r) => r.ticker === t)).filter((r) => r && Number.isFinite(r.exact));
  if (!rows.length) return null;
  const same = rows.filter((r) => r.exact >= SIM_MIN).map((r) => r.ticker), lines = (set.own_lines && set.own_lines.lines) || {};
  const line = Object.entries(lines).sort((a, b) => b[1] - a[1]).map(([l]) => l)[0] || set.own_industry || null;
  return { n: rows.length, same, line, mostlyDifferent: same.length < rows.length / 2 };
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
export function conclusion6(snap, decisions, estimates, today, way = "C", { only = null, set = null, rule = {} } = {}) {
  const T = snap.ticker, dec = decisions || [], sel = selectionOf(dec, T), kept = keptPeers(dec, T);
  const rows = estimates ? snap.rows.map((r) => (r.key === "peg" ? pegRow(snap, estimates, today) : r)) : snap.rows;
  const peers = snap.members.filter((t) => t !== T && !(snap.excluded || []).some((e) => e.ticker === t) && !sel.peers.has(t));
  const allCols = columnsOf(rows, snap.table, peers, { cellsOff: sel.cells }), cols = only ? Object.fromEntries(Object.entries(allCols).filter(([k]) => only.includes(k))) : allCols, score = scorePeers(cols, peers, rule);   /* only: a what-if on fewer columns; rule: C6_RULE reproduces C6 as first built (the report), never the tab */
  const business = businessOf(set, peers), safe = new Set(business && business.mostlyDifferent ? business.same : []);   /* C6b 4 */
  const flagged = peers.filter((t) => score[t].outlier).sort((a, b) => score[b].n - score[a].n || score[b].far - score[a].far);
  const out = flagged.filter((t) => !kept.has(t) && !safe.has(t)), keptIn = flagged.filter((t) => kept.has(t)), notCut = flagged.filter((t) => !kept.has(t) && safe.has(t));
  const ruleRows = out.map((t) => ({ company: T, peer: t, measure: "ALL", off: true, reason: "outlier: " + score[t].words, set_by: "rule", set_at: RULE_AT }));
  const opts = { k: Infinity };
  const withAll = conclusion(snap, dec, estimates, today, way, opts);
  const C = out.length ? conclusion(snap, [...dec, ...ruleRows], estimates, today, way, opts) : withAll;
  const ruleOff = new Set(out);
  return { ...C, sel: { ...C.sel, list: C.sel.list.filter((d) => d.set_by !== "rule"), userPeers: sel.peers }, off: sel.list.length,
    c6: { cols, score, peers, outliers: out, kept: keptIn, notCut, business, ruleOff, flaggedCells: peers.reduce((s, t) => s + score[t].marks, 0), withOutliers: withAll, centre: { with: withAll.band ? withAll.band.mid : null, without: C.band ? C.band.mid : null } } };
}
export const isFlagged = (c6, peer, key) => !!(c6 && c6.cols[key] && c6.cols[key].cells[peer] && c6.cols[key].cells[peer].flag);
const VOTING = new Set(VOTES.flatMap((v) => v.cols));
/** Does this column count toward the verdict (a multiple), or is its mark information only? */
export const isVote = (key) => VOTING.has(key);
