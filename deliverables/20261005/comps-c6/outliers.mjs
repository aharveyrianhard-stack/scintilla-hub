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
     (median and MAD hold up to half the peers being wild, and a second pass would keep peeling a tight pack).

   CP1 (6 Oct) · A TIGHTER RULE WHERE ONE PEER OR ONE MULTIPLE DOMINATES, proposed inside this rule; each part a named
   switch, OFF until Alan says (with every switch off this file answers exactly as C6b left it).
     cellRule     ONE MULTIPLE. A single cell beyond the cut leaves THAT measure's centre and field; the peer stays
                  everywhere else. (C5's cell rule, which C6 had switched off; its cut is now this rule's 3.5.)
     consistency  ONE PEER, far on nearly everything. A peer beyond CUT2 (2.5 spreads — the moderately conservative cut
                  of Leys, Ley, Klein, Bernard & Licata 2013) on the SAME side on at least CONSIST_MIN (4) of the five
                  votes, or on three-quarters of the votes it has (at least 3), is an outlier even when no single multiple
                  reaches 3.5.
     influence    ONE PEER, moving the answer. After the rule above each peer is left out in turn (the jackknife's
                  leave-one-out). When EXACTLY ONE peer's removal moves the centre by more than INFLUENCE (10%) AND that
                  peer is itself marked on a price multiple (a flag at 3.5, or beyond 2.5 on two votes on one side), it
                  dominates and is left out: influential and unusual, both. A peer that only happens to sit at the pivot
                  of the field (normal multiples) is never cut. How many peers move the centre that much is reported as
                  the centre's FRAGILITY — information, never a cut. Only while INFLUENCE_MIN_N peers stay.
     priceOnBusiness  THE COMPLETION OF C6b 4 ("fix the peers, not the outliers"), for the lines Alan named the comps of.
                  On a line listed in PRICE_ON_LINES (memory & storage, data-centre reit), when fewer than half the peers
                  share the company's business and at least PRICE_ON_BUSINESS_MIN (2) do, the price comes from the peers
                  that share it; the others stay on the page, greyed "different business: shown, not priced", and the
                  whole-set reading is kept beside the price. (Not in the coordinator's six: without it the memory and
                  storage peers are added to Micron's set and outvoted by nine chip makers — measured, CP1 report. Not
                  applied to every line: on Nvidia's three "data-center chips" peers it reads +195% — also measured.)
     selfOutlier  THE COMPANY ITSELF (Alan, 6 Oct: "what about when it's a fast grower — the company we're actually
                  tracking?"). The company is measured against its peers exactly as a peer is: when it is itself far from
                  the group on 3 or more votes, or on half the votes it has (at least 2), the set cannot price it. The
                  band is then withheld — "no peer set — valued on growth (PEG) and estimates" — and the peers' reading is
                  kept beside it as information.
   Neighbours tested together (tests/comps-cp1.test.mjs): C6b 4 (a mostly-different-business set never loses the peers that
   share the business), the operator's KEEP click (always wins), the fast-grower protection (growth never votes), the
   five-peer floor per column. */
import { latestDecisions, selectionOf } from "../../20260930/comps-tab/comps-tab.mjs";
import { ROWS, TABLE, SHORT } from "../../20261001/comps-template/cohort.mjs";
import { conclusion, pegRow, median, CP1_FIELD_ON, CP1_FIELD_OFF, FD1_FIELD_ON, FD1_FIELD_LAST, PEG_GROWTH_CAP } from "../../20261003/comps-c5/field.mjs";
import { SIM_MIN, CP1_LINES_ON, CP1_LINES_OFF } from "../../20261003/comps-c5/lines.mjs";

export const CUT = 3.5, MIN_N = 5, MIN_FLAGS = 3, SHARE = 0.5, SHARE_MIN_FLAGS = 2, MAD_SCALE = 1.4826, MEANAD_SCALE = 1.2533;
/* CP1 · the switches (see the header). OFF = C6b exactly. */
export const CP1_OUT_OFF = Object.freeze({ cellRule: false, consistency: false, influence: false, selfOutlier: false, priceOnBusiness: false });
export const CP1_OUT_ON = Object.freeze({ cellRule: true, consistency: true, influence: true, selfOutlier: true, priceOnBusiness: true });
export const CUT2 = 2.5, CONSIST_MIN = 4, CONSIST_SHARE = 0.75, CONSIST_SHARE_MIN = 3, INFLUENCE = 0.10, INFLUENCE_MIN_N = 6, PRICE_ON_BUSINESS_MIN = 2;
export const PRICE_ON_LINES = ["memory & storage", "data-centre reit"];
export const EVERY_LINE_MIN = 4;   // CP3 priceOnEveryLine: a line prices its own when the set holds at least this many same-business peers — four, so the rule never trades a sound centre for a thin one (measured 7 Oct: at three, 50 of 451 companies came out thin; at four, see the page)
export const NO_PEER_SET = "no peer set — valued on growth (PEG) and estimates";
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
export function scorePeers(cols, peers, { votes = VOTES, minFlags = MIN_FLAGS, share = SHARE, shareMinFlags = SHARE_MIN_FLAGS, noun = "multiples", lead = "priced far from the group on", consistency = false } = {}) {
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
    /* CP1 consistency: per vote the farthest column's distance; how many votes sit beyond CUT2 on one side */
    let hi = 0, lo = 0;
    if (consistency) for (const v of votes) { const ds = v.cols.filter((k) => cell(k, t)).map((k) => cols[k].cells[t].d); if (!ds.length) continue; const far = ds.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)); if (far > CUT2) hi++; else if (far < -CUT2) lo++; }
    const side = Math.max(hi, lo), consistent = consistency && (side >= CONSIST_MIN || (side >= CONSIST_SHARE_MIN && have > 0 && side / have >= CONSIST_SHARE));
    const byRule = n >= minFlags || (n >= shareMinFlags && sh >= share), outlier = byRule || consistent;
    out[t] = { have, flags, info, marks, n, far: flags.reduce((x, f) => x + Math.abs(f.d), 0), share: sh, outlier, consistent: consistent && !byRule, side, sideWord: hi >= lo ? "above" : "below",
      words: byRule || !consistent ? (n ? `${lead} ${n} of ${have} ${noun}` : "") : `${hi >= lo ? "above" : "below"} the group by more than ${CUT2} spreads on ${side} of ${have} ${noun} (never past ${CUT} on three)` };
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
  /* CP3: a set with STATED same-business peers (lines.mjs CP3_STATED) answers from the statement, not from the line vectors */
  if (set.stated) { const same = rows.filter((r) => r.stated).map((r) => r.ticker); return { n: rows.length, same, line: set.stated.line, mostlyDifferent: same.length < rows.length / 2, stated: true }; }
  const same = rows.filter((r) => r.exact >= SIM_MIN).map((r) => r.ticker), lines = (set.own_lines && set.own_lines.lines) || {};
  const line = Object.entries(lines).sort((a, b) => b[1] - a[1]).map(([l]) => l)[0] || set.own_industry || null;
  return { n: rows.length, same, line, mostlyDifferent: same.length < rows.length / 2 };
}

/** CP3 (7 Oct) · THE SET, CHECKED — every set, automatically. Alan: "fix the methodology that picked the wrong peers, so we
    don't have to maintain peer sets by hand — but always check them." Two readings, each a flag in words when it trips:
      BUSINESS  fewer than half of the peers the four sources and the line method KEPT share the company's business line
                (the test that would have caught Micron among chip designers and Vistra among regulated utilities);
      SIZE      among the peers that PRICE the company, the middle one is less than a tenth or more than ten times its
                size (SIZE_OFF), or the largest is more than a hundred times the smallest (SIZE_SPREAD).
    set: buildSet()'s answer (kept rows carry `ratio` = peer market value ÷ the company's, and `same_business` / `stated` /
    `exact`); priced: the tickers that set the price. Returns { business: { same, of, mostly_different }, size: { n, min,
    median, max, spread }, flags: [words] }. Pure: it reads the set, it changes nothing — a flagged set is still priced. */
export const SIZE_OFF = 10, SIZE_SPREAD = 100;
export function setCheck(set, priced = null) {
  if (!set || !Array.isArray(set.kept)) return null;
  const kept = set.kept.filter((r) => !r.reference || r.has_figures), isSame = (r) => (set.stated ? !!r.stated : r.same_business != null ? !!r.same_business : r.exact >= SIM_MIN);
  const same = kept.filter(isSame).length, flags = [];
  const business = { same, of: kept.length, mostly_different: kept.length > 0 && same < kept.length / 2 };
  if (business.mostly_different) flags.push(`set check: only ${same} of its ${kept.length} peers share its business`);
  const pr = (priced && priced.length ? kept.filter((r) => priced.includes(r.ticker)) : kept).map((r) => Number(r.ratio)).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const med = pr.length ? (pr.length % 2 ? pr[(pr.length - 1) / 2] : (pr[pr.length / 2 - 1] + pr[pr.length / 2]) / 2) : null;
  const size = { n: pr.length, min: pr.length ? pr[0] : null, median: med, max: pr.length ? pr[pr.length - 1] : null, spread: pr.length > 1 ? pr[pr.length - 1] / pr[0] : null };
  const times = (x) => (x >= 1 ? (x >= 10 ? Math.round(x) : x.toFixed(1)) + " times its size" : "1/" + (1 / x >= 10 ? Math.round(1 / x) : (1 / x).toFixed(1)) + " of its size");
  if (med != null && (med < 1 / SIZE_OFF || med > SIZE_OFF)) flags.push(`set check: the peers that price it are far from its size — the middle one is ${times(med)}`);
  else if (size.spread != null && size.spread > SIZE_SPREAD) flags.push(`set check: the peers that price it run from ${times(size.min)} to ${times(size.max)}`);
  return { business, size, flags };
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
export function conclusion6(snap, decisions, estimates, today, way = "C", { only = null, set = null, rule = {}, fx = null } = {}) {
  const T = snap.ticker, dec = decisions || [], sel = selectionOf(dec, T), kept = keptPeers(dec, T), X = fx || CP1_OUT_OFF;
  /* CP4 adjacentBlend (7 Oct 13:20): when the set holds at least EVERY_LINE_MIN same-business peers, they set the price and the
     adjacent peers BLEND IN at ADJACENT_WEIGHT through the closeness weights (field.mjs peerWeightsCP4) instead of being turned
     off; with fewer, the whole set prices it on closeness alone. Nothing is marked "shown, not priced". */
  if (X.adjacentBlend) {
    const inner = { ...X, adjacentBlend: false, priceOnBusiness: false }, whole = conclusion6(snap, dec, estimates, today, way, { only, set, rule, fx: inner }), b = whole.c6.business;
    const enough = b && b.same.length >= EVERY_LINE_MIN && b.same.length < b.n;
    return { ...whole, c6: { ...whole.c6, pricedOn: enough ? "blend" : "set", business: b, businessPeers: b ? b.same : [], adjacentPeers: b ? whole.c6.peers.filter((t) => !b.same.includes(t)) : [], notPriced: [] } };
  }
  if (X.priceOnBusiness) {   /* CP1: a mostly-different-business set is priced on the peers that share the business */
    const inner = { ...X, priceOnBusiness: false }, whole = conclusion6(snap, dec, estimates, today, way, { only, set, rule, fx: inner }), b = whole.c6.business;
    /* CP1: the two lines Alan named, when the set is mostly another business. CP3: a STATED set always; and with
       priceOnEveryLine, any line whose set holds at least EVERY_LINE_MIN same-business peers beside others. */
    const cp1 = b && b.mostlyDifferent && b.same.length >= PRICE_ON_BUSINESS_MIN && PRICE_ON_LINES.includes(b.line);
    const stated = b && b.stated && b.same.length >= PRICE_ON_BUSINESS_MIN, everyLine = b && !!X.priceOnEveryLine && !b.stated && b.same.length >= EVERY_LINE_MIN && b.same.length < b.n;
    if (!(cp1 || stated || everyLine)) return { ...whole, c6: { ...whole.c6, pricedOn: "set" } };
    const others = whole.c6.peers.filter((t) => !b.same.includes(t) && !kept.has(t));
    const C2 = conclusion6(snap, [...dec, ...others.map((t) => ({ company: T, peer: t, measure: "ALL", off: true, reason: "different business: shown, not priced", set_by: "rule-business", set_at: RULE_AT }))], estimates, today, way, { only, set, rule, fx: inner });
    return { ...C2, sel: { ...C2.sel, userPeers: sel.peers }, off: sel.list.length, c6: { ...C2.c6, pricedOn: "business", business: b, businessPeers: b.same, notPriced: others, wholeSet: { band: whole.band, upside: whole.upside, bandFromPeers: whole.c6.bandFromPeers, noPeerSet: whole.c6.noPeerSet, self: whole.c6.self, outliers: whole.c6.outliers, fragile: whole.c6.fragile || null } } };
  }
  if (X.consistency) rule = { ...rule, consistency: true };
  const rows = estimates ? snap.rows.map((r) => (r.key === "peg" ? pegRow(snap, estimates, today, { forward: !!X.growthForward, fromLast: !!X.growthFromLastYear, cap: X.pegCap ? PEG_GROWTH_CAP : null }) : r)) : snap.rows;   /* FD1 growthForward: the same PEG the field prices on */
  const peers = snap.members.filter((t) => t !== T && !(snap.excluded || []).some((e) => e.ticker === t) && !sel.peers.has(t));
  const allCols = columnsOf(rows, snap.table, peers, { cellsOff: sel.cells }), cols = only ? Object.fromEntries(Object.entries(allCols).filter(([k]) => only.includes(k))) : allCols, score = scorePeers(cols, peers, rule);   /* only: a what-if on fewer columns; rule: C6_RULE reproduces C6 as first built (the report), never the tab */
  const business = businessOf(set, peers), safe = new Set(business && business.mostlyDifferent ? business.same : []);   /* C6b 4 */
  const flagged = peers.filter((t) => score[t].outlier).sort((a, b) => score[b].n - score[a].n || score[b].far - score[a].far);
  const out = flagged.filter((t) => !kept.has(t) && !safe.has(t)), keptIn = flagged.filter((t) => kept.has(t)), notCut = flagged.filter((t) => !kept.has(t) && safe.has(t));
  const offRow = (t, why) => ({ company: T, peer: t, measure: "ALL", off: true, reason: why, set_by: "rule", set_at: RULE_AT });
  let ruleRows = out.map((t) => offRow(t, "outlier: " + score[t].words));
  const opts = { k: X.cellRule ? CUT : Infinity, fx: X, set };   /* CP1 cellRule: one wild multiple leaves its own measure · CP4: the set rides along for the closeness weights */
  const withAll = conclusion(snap, dec, estimates, today, way, { k: Infinity, fx: X, set });
  let C = out.length || X.cellRule ? conclusion(snap, [...dec, ...ruleRows], estimates, today, way, opts) : withAll;
  /* CP1 influence: leave one peer out at a time; a peer whose removal alone moves the centre by more than INFLUENCE dominates */
  let dominating = [], fragile = null;
  if (X.influence && C.band && C.band.mid > 0) {
    const left = peers.filter((t) => !out.includes(t)), movers = [];
    if (left.length >= INFLUENCE_MIN_N) for (const t of left) {
      const Ct = conclusion(snap, [...dec, ...ruleRows, offRow(t, "leave-one-out")], estimates, today, way, opts);
      if (Ct.band && Ct.band.mid > 0) { const shift = Ct.band.mid / C.band.mid - 1; if (Math.abs(shift) > INFLUENCE) movers.push({ ticker: t, shift, centre_without: Ct.band.mid }); }
    }
    const unusual = (t) => score[t] && (score[t].n >= 1 || score[t].side >= 2);
    if (movers.length === 1 && unusual(movers[0].ticker) && !kept.has(movers[0].ticker) && !safe.has(movers[0].ticker)) dominating = movers;
    if (movers.length && !dominating.length) fragile = { n: movers.length, of: left.length, movers, words: movers.length === 1 ? `the centre moves ${(movers[0].shift * 100).toFixed(0)}% when ${movers[0].ticker} alone is taken out (a peer with ordinary multiples at the pivot of the field: kept)` : `the centre moves more than ${Math.round(INFLUENCE * 100)}% when any one of ${movers.length} of the ${left.length} peers is taken out (${movers.map((m) => m.ticker).join(", ")}): it sits in a gap of the field` };
    if (dominating.length) { ruleRows = [...ruleRows, ...dominating.map((d) => offRow(d.ticker, `dominates: the centre moves ${(d.shift * 100).toFixed(0)}% without it`))]; C = conclusion(snap, [...dec, ...ruleRows], estimates, today, way, opts); }
  }
  const outAll = [...out, ...dominating.map((d) => d.ticker)], ruleOff = new Set(outAll);
  /* CP1 selfOutlier: the company measured against its own peers the way a peer is */
  let self = null;
  if (X.selfOutlier) {
    const flags = []; let have = 0;
    for (const v of VOTES) {
      const ds = v.cols.map((k) => { const c = cols[k], r = (C.rows || []).find((x) => x.key === k) || rows.find((x) => x.key === k), own = r && r.own ? r.own.multiple : null; return c && c.judged && own > 0 && c.median > 0 && c.spread > 0 ? { key: k, short: c.short, d: (Math.log(own) - Math.log(c.median)) / c.spread, v: own, median: c.median } : null; }).filter(Boolean);
      if (!ds.length) continue; have++;
      const far = ds.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a)); if (Math.abs(far.d) > CUT) flags.push({ ...far, vote: v.key, voteShort: v.short, side: far.d > 0 ? "high" : "low" });
    }
    const n = flags.length, is = n >= MIN_FLAGS || (n >= SHARE_MIN_FLAGS && have > 0 && n / have >= SHARE);
    self = { have, n, flags, outlier: is, words: n ? `${T} itself is priced far from this group on ${n} of ${have} multiples (${flags.map((f) => `${f.voteShort} ${f.v.toFixed(f.v < 10 ? 2 : 0)}× against ${f.median.toFixed(f.median < 10 ? 2 : 0)}×`).join(", ")})` : "" };
  }
  const noPeerSet = !!(self && self.outlier);
  return { ...C, band: noPeerSet ? null : C.band, upside: noPeerSet ? null : C.upside, reason: noPeerSet ? NO_PEER_SET : C.reason, sel: { ...C.sel, list: C.sel.list.filter((d) => !String(d.set_by || "").startsWith("rule")), userPeers: sel.peers }, off: sel.list.length,
    c6: { cols, score, peers, outliers: outAll, byRule: out, dominating, fragile, kept: keptIn, notCut, business, ruleOff, self, noPeerSet, bandFromPeers: C.band, upsideFromPeers: C.upside, flaggedCells: peers.reduce((s, t) => s + score[t].marks, 0), withOutliers: withAll, centre: { with: withAll.band ? withAll.band.mid : null, without: C.band ? C.band.mid : null } } };
}
/** Every CP1 switch of the three modules in one object, for the caller at the top of the stack. */
export const CP1_ALL = Object.freeze({ ...CP1_LINES_ON, ...CP1_FIELD_ON, ...CP1_OUT_ON });
export const CP1_NONE = Object.freeze({ ...CP1_LINES_OFF, ...CP1_FIELD_OFF, ...CP1_OUT_OFF });
/** FD1 (7 Oct): CP1's twelve switches plus growth measured from one forecast year to the next (field.mjs growthForward). */
export const FD1_ALL = Object.freeze({ ...CP1_LINES_ON, ...FD1_FIELD_ON, ...CP1_OUT_ON });
/* CP3 (7 Oct): CP1's twelve switches, the stated same-business sets, and the price from the same-business peers on every
   line. The forward basis is not a switch here: it is how the snapshot was read (cohort.mjs `forward`). */
export const CP3_ALL = Object.freeze({ ...CP1_LINES_ON, stated: true, ...CP1_FIELD_ON, ...CP1_OUT_ON, priceOnEveryLine: true });
/* CP4 (7 Oct 13:20): the method's sets (no stated set; equipment makers their own line), the growth-first prior, closeness
   weights, and the adjacent blend in place of "shown, not priced". */
export const CP4_ALL = Object.freeze({ memoryStorage: true, dcReit: true, complement: true, reference: true, stated: false, equipment: true, growthCredit: true, reitYardstick: true, marginGate: true, growthForward: true, cp4Prior: true, closeness: true, pegCap: true, cellRule: true, consistency: true, influence: true, selfOutlier: true, priceOnBusiness: false, adjacentBlend: true });
/* RL1 (7 Oct) · THE ONE LINE THAT SAYS WHAT IS LIVE ON THE HUB'S COMPS TAB. Alan, 7 Oct ~12:50 ET, approved the same-business
   pricing ("always go"); the decision cards, the universe knockout and the allocation tool were already built on CP3_ALL.
   The tab (comps-c5/tab.mjs) reads its switches from here and from nowhere else, so the tab, the card, the knockout and the
   tool price a name on one configuration. The way back is this line: CP1_NONE is the tab exactly as C6b left it. Callers
   that pass their own switches (the reports, the tools, the tests) are not touched by it. */
/* CP4: the in-browser fallback (a name the engine's artifact does not carry) stays on this configuration; the artifact itself is priced on CP4_ALL — one line to change if Alan wants the fallback on the same footing */
export const LIVE_FX = CP3_ALL;
/** The proposal beside it: growth from the fiscal year just reported, on the analysts' basis (field.mjs growthFromLastYear). */
export const FD1_ALL_LAST = Object.freeze({ ...CP1_LINES_ON, ...FD1_FIELD_LAST, ...CP1_OUT_ON });
export const isFlagged = (c6, peer, key) => !!(c6 && c6.cols[key] && c6.cols[key].cells[peer] && c6.cols[key].cells[peer].flag);
const VOTING = new Set(VOTES.flatMap((v) => v.cols));
/** Does this column count toward the verdict (a multiple), or is its mark information only? */
export const isVote = (key) => VOTING.has(key);
