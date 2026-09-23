/* Six chart patterns, each written as the standard texts describe it, then turned
   into a detector that can only see the past.

   The rule that governs everything here: on any day d, a detector may use bars up
   to and including d, and may only use a turning point (a "pivot") once enough
   later bars exist to have confirmed it. A swing high needs k days on each side,
   so it is not known until k days after it happened. Detectors that forget this
   are the usual reason a pattern looks profitable on a chart and fails in life.

   Sources for the rules (quoted at most a line each, in the pattern files):
     Edwards & Magee, Technical Analysis of Stock Trends — head and shoulders (ch. VI),
       wedges (ch. X), flags and pennants (ch. XI).
     Bulkowski, Encyclopedia of Chart Patterns — measured statistics per pattern.
     Murphy, Technical Analysis of the Financial Markets — ch. 5-6, reversal and
       continuation patterns.                                                        */

export const PIVOT_K = 5;          // a turning point needs this many days either side
export const COOLOFF = 20;         // a second signal this soon after one already taken is skipped

/** Confirmed turning points. `confirmed` is the first day the pivot could be known. */
export function pivots(bars, k = PIVOT_K) {
  const hi = [], lo = [];
  for (let i = k; i < bars.length - k; i++) {
    let isH = true, isL = true;
    for (let j = i - k; j <= i + k && (isH || isL); j++) {
      if (j === i) continue;
      if (bars[j].h >= bars[i].h) isH = false;
      if (bars[j].l <= bars[i].l) isL = false;
    }
    if (isH) hi.push({ i, p: bars[i].h, confirmed: i + k });
    if (isL) lo.push({ i, p: bars[i].l, confirmed: i + k });
  }
  return { hi, lo };
}

const lineAt = (a, b, x) => a.p + ((b.p - a.p) / (b.i - a.i)) * (x - a.i);
const slope = (a, b) => (b.p - a.p) / (b.i - a.i);

/** A cursor over pivots that only ever hands back ones confirmed before today.
    Walking it forward day by day keeps the whole scan linear. */
function cursor(list) {
  let n = 0;
  return {
    seen: [],
    advance(d) { while (n < list.length && list[n].confirmed < d) this.seen.push(list[n++]); return this.seen; },
    /** the last pivot strictly inside (a, b), or undefined */
    lastBetween(a, b) {
      let lo = 0, hi = this.seen.length - 1, ans = -1;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (this.seen[m].i < b) { ans = m; lo = m + 1; } else hi = m - 1; }
      return ans >= 0 && this.seen[ans].i > a ? this.seen[ans] : undefined;
    },
  };
}

export const WEDGE = {
  k: PIVOT_K,
  min_span: 20,        // the shape must take at least this many days to form
  max_span: 120,       // and no more than this, or it is a trend, not a wedge
  converge: 0.75,      // the gap between the lines at the end, as a share of the gap at the start
  max_wait: 20,        // the break must come within this many days of the last turning point
  cooloff: COOLOFF,
};

/** Rising wedge (bearish) and falling wedge (bullish).
    Two lines that both slope the same way and close on each other; the signal is
    the close that breaks the line the shape has been leaning on. */
export function findWedge(bars, dir, R = WEDGE) {
  const { hi, lo } = pivots(bars, R.k);
  const out = [];
  let lastTaken = -Infinity;
  const cH = cursor(hi), cL = cursor(lo);
  for (let d = R.k * 4; d < bars.length; d++) {
    const seenH = cH.advance(d), seenL = cL.advance(d);
    if (seenH.length < 2 || seenL.length < 2) continue;
    const h1 = seenH[seenH.length - 2], h2 = seenH[seenH.length - 1];
    const l1 = seenL[seenL.length - 2], l2 = seenL[seenL.length - 1];
    const sH = slope(h1, h2), sL = slope(l1, l2);
    const startI = Math.min(h1.i, l1.i), endI = Math.max(h2.i, l2.i);
    const span = endI - startI;
    if (span < R.min_span || span > R.max_span) continue;
    if (d - Math.max(h2.confirmed, l2.confirmed) > R.max_wait) continue;

    // the two lines, measured where the shape starts and where it ends
    const gapStart = lineAt(h1, h2, startI) - lineAt(l1, l2, startI);
    const gapEnd = lineAt(h1, h2, endI) - lineAt(l1, l2, endI);
    if (!(gapStart > 0 && gapEnd > 0 && gapEnd < gapStart * R.converge)) continue;  // must be closing

    let ok, broke;
    if (dir === "rising") {
      ok = sH > 0 && sL > 0 && sL > sH;                       // both up, the floor rising faster
      broke = bars[d].c < lineAt(l1, l2, d);                  // gives way on the floor
    } else {
      ok = sH < 0 && sL < 0 && sH < sL;                       // both down, the ceiling falling faster
      broke = bars[d].c > lineAt(h1, h2, d);                  // breaks out through the ceiling
    }
    if (!(ok && broke)) continue;
    if (d - lastTaken < R.cooloff) continue;
    lastTaken = d;
    out.push({ i: d, t: bars[d].t, kind: dir === "rising" ? "rising-wedge" : "falling-wedge",
      draw: { upper: [h1, h2].map((p) => ({ i: p.i, p: p.p })), lower: [l1, l2].map((p) => ({ i: p.i, p: p.p })),
              from: startI, to: d } });
  }
  return out;
}

export const FLAG = {
  pole_days: 10, pole_min_move: 0.15,
  flag_min_days: 5, flag_max_days: 15,
  flag_max_giveback: 0.5, flag_must_tighten: true,
  cooloff: COOLOFF,
};

const meanOf = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** Bear flag: a sharp fall, a short tight drift that recovers only part of it,
    then a close below the drift's low. The mirror of M17's bull flag, same shape
    of rule, so the two can be compared without arguing about the definition. */
export function findBearFlag(bars, R = FLAG) {
  const out = [];
  let lastTaken = -Infinity;
  for (let p = R.pole_days; p < bars.length; p++) {
    const start = bars[p - R.pole_days], bottom = bars[p];
    const fall = 1 - bottom.c / start.c;
    if (!(fall >= R.pole_min_move)) continue;
    const poleLow = Math.min(...bars.slice(p - R.pole_days, p + 1).map((b) => b.l));
    const poleRange = meanOf(bars.slice(p - R.pole_days, p + 1).map((b) => (b.h - b.l) / b.c));
    const poleTop = start.c;
    for (let f = p + R.flag_min_days; f <= p + R.flag_max_days && f < bars.length; f++) {
      const flag = bars.slice(p + 1, f + 1);
      if (flag.length < R.flag_min_days) continue;
      const flagHigh = Math.max(...flag.map((b) => b.h));
      const flagLow = Math.min(...flag.map((b) => b.l));
      const giveback = (flagHigh - poleLow) / (poleTop - poleLow);
      if (!(giveback > 0 && giveback <= R.flag_max_giveback)) break;   // it recovered too far
      if (flagLow < poleLow * 0.98) break;                             // it kept falling: not a pause
      const tight = meanOf(flag.map((b) => (b.h - b.l) / b.c)) < poleRange;
      const prior = bars.slice(p + 1, f);                              // the breakdown day itself excluded
      const priorLow = prior.length ? Math.min(...prior.map((b) => b.l)) : flagLow;
      if (bars[f].c < priorLow && (!R.flag_must_tighten || tight)) {
        if (f - lastTaken >= R.cooloff) {
          out.push({ i: f, t: bars[f].t, kind: "bear-flag",
            draw: { pole: [p - R.pole_days, p], flag: [p + 1, f], from: p - R.pole_days, to: f } });
          lastTaken = f;
        }
        break;
      }
    }
  }
  return out;
}

export const HS = {
  k: PIVOT_K,
  head_min: 0.02,      // the head must clear both shoulders by this much
  shoulder_tol: 0.12,  // the shoulders must be within this of each other
  neck_tol: 0.06,      // the two necklines points must be within this of each other
  min_span: 25, max_span: 160,
  max_wait: 25,
  cooloff: COOLOFF,
};

/** Head and shoulders (bearish) and its inverse (bullish).
    Three turning points with the middle one furthest out, two points between them
    that make the neckline, and a close through that neckline as the signal. */
export function findHeadShoulders(bars, dir, R = HS) {
  const { hi, lo } = pivots(bars, R.k);
  const outer = dir === "top" ? hi : lo, inner = dir === "top" ? lo : hi;
  const out = [];
  let lastTaken = -Infinity;
  const cO = cursor(outer), cI = cursor(inner);
  for (let d = R.k * 6; d < bars.length; d++) {
    const seenO = cO.advance(d); cI.advance(d);
    if (seenO.length < 3) continue;
    const ls = seenO[seenO.length - 3], head = seenO[seenO.length - 2], rs = seenO[seenO.length - 1];
    const n1 = cI.lastBetween(ls.i, head.i), n2 = cI.lastBetween(head.i, rs.i);
    if (!n1 || !n2) continue;

    const span = rs.i - ls.i;
    if (span < R.min_span || span > R.max_span) continue;
    if (d - Math.max(rs.confirmed, n2.confirmed) > R.max_wait) continue;

    const bigger = dir === "top"
      ? head.p > ls.p * (1 + R.head_min) && head.p > rs.p * (1 + R.head_min)
      : head.p < ls.p * (1 - R.head_min) && head.p < rs.p * (1 - R.head_min);
    if (!bigger) continue;
    if (Math.abs(ls.p - rs.p) / Math.max(ls.p, rs.p) > R.shoulder_tol) continue;      // lopsided
    if (Math.abs(n1.p - n2.p) / Math.max(n1.p, n2.p) > R.neck_tol) continue;          // neckline too steep

    const neck = lineAt(n1, n2, d);
    const broke = dir === "top" ? bars[d].c < neck : bars[d].c > neck;
    if (!broke) continue;
    if (d - lastTaken < R.cooloff) continue;
    lastTaken = d;
    out.push({ i: d, t: bars[d].t, kind: dir === "top" ? "head-shoulders" : "inverse-head-shoulders",
      draw: { points: [ls, head, rs].map((p) => ({ i: p.i, p: p.p })),
              neck: [n1, n2].map((p) => ({ i: p.i, p: p.p })), from: ls.i, to: d } });
  }
  return out;
}

/** what each pattern claims will happen: up for bullish, down for bearish */
export const DIRECTION = {
  "rising-wedge": "down", "falling-wedge": "up",
  "bull-flag": "up", "bear-flag": "down",
  "head-shoulders": "down", "inverse-head-shoulders": "up",
};
