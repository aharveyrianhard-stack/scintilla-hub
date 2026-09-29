/* N9 · read the point-in-time bundle (research cache). Read-only, no network. */
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
import { PIT_ROOT } from "./build-universe.mjs";
import { membersOn } from "./pit-core.mjs";

const rd = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());

export function loadPit(root = PIT_ROOT) {
  const M = rd(path.join(root, "membership.json.gz")), caps = rd(path.join(root, "caps-monthly.json.gz")), raw = rd(path.join(root, "bars-pit.json.gz"));
  const bars = new Map();
  const capSeries = new Map(Object.entries(caps).map(([s, rows]) => [s, { dates: rows.map((r) => r[0]), v: rows.map((r) => r[1] * 1e6) }]));
  const ends = new Map(); for (const idx of Object.values(M.membership)) for (const iv of idx.intervals) if (iv.to) (ends.get(iv.sym) ?? ends.set(iv.sym, []).get(iv.sym)).push(iv.to);
  const flags = [];
  const series = (sym) => {
    if (bars.has(sym)) return bars.get(sym);
    const r = raw[sym]; if (!r || r.length < 2) { bars.set(sym, null); return null; }
    const g = guardSeries(sym, r, ends.get(sym) ?? [], capSeries.get(sym));
    flags.push(...g.flags);
    bars.set(sym, g.s); return g.s;
  };
  const members = (index, d) => membersOn(M.membership[index].intervals, d);
  const stretches = (index, sym) => M.membership[index].intervals.filter((iv) => iv.sym === sym);
  return { M, manifest: M.manifest, series, capSeries, members, stretches, symbols: Object.keys(raw), flags };
}

export const HOLE_DAYS = 20, JUMP = Math.log(1.8);
/** Collapses checked by hand against the record (conservatorship 7 Sep 2008; Sovereign's Santander deal 13 Oct 2008 after
    the 29 Sep run): real moves the cap check cannot confirm because these names' caps are price × dated shares. */
export const REAL_MOVES = new Set(["FNMA|2008-09-08", "FMCC|2008-09-08", "SOV|2008-09-29"]);
const SPLIT_RATIOS = [2, 3, 4, 5, 10, 20, 3 / 2, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 10, 1 / 20, 2 / 3];
/** Guards against two faults in by-ticker history.
    1 · A hole of more than HOLE_DAYS calendar days usually means the ticker belonged to another security before it
        (MS before 2006, WM before Aug 2009). Everything before the last such hole is dropped — unless the earlier
        stretch ends within 30 days of a recorded membership end (the company left, and the ticker came back later).
    2 · A one-day move beyond +80% / −44% that FMP's month-end caps do not confirm (cap ratio across the move differs
        from the price ratio by more than 1.5×) is an unadjusted split or spin-off: that day's return is set to 0.
        Where no cap exists to check against, only a move within 4% of a standard split ratio is treated that way.
    Real collapses (AIG, Bear Stearns) are confirmed by the caps and stay. */
export function guardSeries(sym, r, memberEnds, cs) {
  let rows = r, flags = [];
  for (let i = rows.length - 1; i > 0; i--) {
    const gap = (Date.parse(rows[i][0]) - Date.parse(rows[i - 1][0])) / 864e5;
    if (gap <= HOLE_DAYS) continue;
    const endedThen = memberEnds.some((e) => Math.abs(Date.parse(e) - Date.parse(rows[i - 1][0])) <= 30 * 864e5);
    if (endedThen) { flags.push({ sym, kind: "hole-kept", from: rows[i - 1][0], to: rows[i][0] }); continue; }
    flags.push({ sym, kind: "cut-before-hole", from: rows[i - 1][0], to: rows[i][0] }); rows = rows.slice(i); break;
  }
  const s = { dates: rows.map((x) => x[0]), o: rows.map((x) => +x[1]), h: rows.map((x) => +x[2]), l: rows.map((x) => +x[3]), c: rows.map((x) => +x[4]), v: rows.map((x) => +x[5]), skip: new Set() };
  for (let i = 1; i < s.c.length; i++) {
    const gap = (Date.parse(s.dates[i]) - Date.parse(s.dates[i - 1])) / 864e5;
    if (gap > HOLE_DAYS) { s.skip.add(s.dates[i]); continue; }
    const lr = Math.log(s.c[i] / s.c[i - 1]); if (!(Math.abs(lr) > JUMP)) continue;
    let confirmed = false, checked = false;
    if (cs) { const a = atOrBefore(cs.dates, s.dates[i - 1]), b = a + 1;
      if (a >= 0 && b < cs.dates.length) { const ia = atOrBefore(s.dates, cs.dates[a]), ib = atOrBefore(s.dates, cs.dates[b]);
        if (ia >= 0 && ib >= 0) { const capR = Math.log(cs.v[b] / cs.v[a]), pxR = Math.log(s.c[ib] / s.c[ia]); confirmed = Math.abs(capR - pxR) < Math.log(1.5); checked = true; } } }
    // no cap to check against: only a move at a standard split ratio is treated as a split (FNMA, WB in 2008 were real)
    if (!checked) confirmed = !SPLIT_RATIOS.some((x) => Math.abs(lr - Math.log(x)) < Math.log(1.04));
    if (REAL_MOVES.has(sym + "|" + s.dates[i])) { flags.push({ sym, kind: "real-move-kept", date: s.dates[i], move: Math.round(100 * (Math.exp(lr) - 1)) }); continue; }
    if (!confirmed) { s.skip.add(s.dates[i]); flags.push({ sym, kind: "jump-ignored", date: s.dates[i], move: Math.round(100 * (Math.exp(lr) - 1)) }); }
  }
  return { s, flags };
}

/** Day return of a guarded series between bar indices i0 < i1 (0 when the day is skipped). */
export function dayRet(S, i0, i1) { return S.skip.has(S.dates[i1]) ? 0 : S.c[i1] / S.c[i0] - 1; }

/** Last index with dates[i] <= d (−1 when none). */
export function atOrBefore(dates, d) {
  let a = 0, b = dates.length - 1, best = -1;
  while (a <= b) { const m = (a + b) >> 1; if (dates[m] <= d) { best = m; a = m + 1; } else b = m - 1; }
  return best;
}

/** Full market cap on date d: the latest month-end cap on or before d (within 40 days), carried by price to d. */
export function capOn(P, sym, d) {
  const cs = P.capSeries.get(sym), s = P.series(sym); if (!cs || !s) return null;
  const k = atOrBefore(cs.dates, d); if (k < 0 || Date.parse(d) - Date.parse(cs.dates[k]) > 40 * 864e5) return null;
  const i = atOrBefore(s.dates, d), j = atOrBefore(s.dates, cs.dates[k]);
  if (i < 0 || j < 0 || Date.parse(d) - Date.parse(s.dates[i]) > 7 * 864e5) return null;
  return cs.v[k] * s.c[i] / s.c[j];
}

/** Bars with every ignored jump undone (earlier prices scaled so the skipped day moves 0%) — for traits and back-tests
    that read price levels over a span. [{t,o,h,l,c,v}] with t in ms, the shape the S9 / leaders code reads. */
export function repairedBars(S) {
  const n = S.c.length, f = new Array(n).fill(1);
  for (let i = n - 1; i > 0; i--) f[i - 1] = f[i] * (S.skip.has(S.dates[i]) ? S.c[i] / S.c[i - 1] : 1);
  return S.dates.map((d, i) => ({ t: Date.parse(d + "T00:00:00Z"), o: S.o[i] * f[i], h: S.h[i] * f[i], l: S.l[i] * f[i], c: S.c[i] * f[i], v: S.v[i] }));
}
