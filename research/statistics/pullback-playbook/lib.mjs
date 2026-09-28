/* PULLBACK PLAYBOOK (N1, 28 Sep) · pure arithmetic. No fetch, no clock, no database.
   Shared by run.mjs (the study) and tests/pullback-playbook.test.mjs (hand-checked fixtures).

   Everything a day "knows" is read from bars strictly BEFORE that day's open unless the function says otherwise:
   · fan lines for day i are the line values at the close of day i−1 (the Lab's Pine reads ta.ema(src,L)[1], the
     previous completed bar, and the weekly 200 reads the previous completed week);
   · pivots are known `len` bars after they print; a diagonal exists only once both its pivots are known;
   · RSI is a close-based signal, so an RSI rung fills at the close that first shows it. */
import { rsiWilder, sma } from "../stats.mjs";
import { pivotPoints, PIVOT_LEN } from "../s9-research.mjs";
import * as X from "../statistician-2/lib.mjs";

export const fin = (x) => x != null && Number.isFinite(x);
export const r1 = X.r1, r2 = X.r2, mean = X.mean, median = X.median, quantile = X.quantile;

/* ------------------------------------------------ the full fan: 13 lines ------------------------------------------------ */
/** The Lab's EMA/SMA Fan (SCINTILLA_EMA_SMA_Fan_private_v19.pine, "Lengths" group): eight daily EMAs, four daily SMAs, one
    weekly SMA. Thirteen lines. The Station's nested clouds draw four of them (e13, e21, s50, s200); the Geiger fan uses nine. */
export const FAN = [
  ["e2", "e", 2], ["e3", "e", 3], ["e5", "e", 5], ["e8", "e", 8], ["e13", "e", 13], ["e21", "e", 21], ["e34", "e", 34], ["e50", "e", 50],
  ["s50", "s", 50], ["s100", "s", 100], ["s150", "s", 150], ["s200", "s", 200], ["w200", "w", 200],
];
export const FAN_KEYS = FAN.map((f) => f[0]);

export function ema(xs, n) {
  const k = 2 / (n + 1), out = new Array(xs.length).fill(null); let e = null;
  for (let i = 0; i < xs.length; i++) { const c = xs[i]; if (!fin(c)) { out[i] = e; continue; } e = e === null ? c : k * c + (1 - k) * e; out[i] = i >= n - 1 ? e : null; }
  return out;
}
/** ISO week id of a timestamp (Mon..Sun share one id). A daily bar at 04:00Z of its session date. */
export const weekId = (t) => Math.floor((Math.floor(t / 864e5) + 3) / 7);
/** The weekly 200-week simple average, mapped to each daily bar as the value of the LAST COMPLETED week
    (the week that ended before this bar's week). Weeks are built from the daily closes themselves. */
export function weeklySma200(bars, len = 200) {
  const weeks = []; // [{id, close}]
  for (const b of bars) { const id = weekId(b.t); if (weeks.length && weeks.at(-1).id === id) weeks.at(-1).close = b.c; else weeks.push({ id, close: b.c }); }
  const wsma = sma(weeks.map((w) => w.close), len);
  const byWeek = new Map(weeks.map((w, i) => [w.id, wsma[i]]));
  const out = new Array(bars.length).fill(null); let prevId = null, prevVal = null;
  for (let i = 0; i < bars.length; i++) {
    const id = weekId(bars[i].t);
    if (id !== prevId) { // a new week began: the last completed week is the one with the previous id seen
      const lastCompleted = weeks.filter((w) => w.id < id).at(-1);
      prevVal = lastCompleted ? byWeek.get(lastCompleted.id) ?? null : null; prevId = id;
    }
    out[i] = fin(prevVal) ? prevVal : null;
  }
  return out;
}
/** All thirteen lines AT THE CLOSE of each bar (what a chart draws on that bar). */
export function fanAtClose(bars) {
  const c = bars.map((b) => b.c), out = {};
  for (const [k, kind, n] of FAN) out[k] = kind === "e" ? ema(c, n) : kind === "s" ? sma(c, n) : weeklySma200(bars, n);
  return out;
}
/** The thirteen lines KNOWN AT THE OPEN of day i = their values at the close of day i−1. Day 0 knows nothing. */
export function fanKnown(bars) {
  const atClose = fanAtClose(bars), out = {};
  for (const k of FAN_KEYS) out[k] = atClose[k].map((_, i) => (i > 0 ? atClose[k][i - 1] : null));
  return out;
}
/** Where a price sits in the fan: how many of the thirteen lines are below it, and the nearest lines above/below. */
export function fanPosition(fan, i, price) {
  const rows = FAN_KEYS.map((k) => [k, fan[k][i]]).filter((r) => fin(r[1]));
  const below = rows.filter((r) => r[1] < price).sort((a, b) => b[1] - a[1]), above = rows.filter((r) => r[1] >= price).sort((a, b) => a[1] - b[1]);
  return { lines: rows.length, below: below.length, above: above.length, nextBelow: below[0] || null, nextAbove: above[0] || null, orderBull: rows.length >= 13 && isBullOrder(rows) };
}
/** Bull order = every faster line above every slower one (e2 > e3 > … > w200). */
export function isBullOrder(rows) { const v = FAN_KEYS.map((k) => rows.find((r) => r[0] === k)?.[1]); if (v.some((x) => !fin(x))) return null; for (let j = 1; j < v.length; j++) if (!(v[j - 1] > v[j])) return false; return true; }

/* ------------------------------------------------ pivots, diagonals, channels ------------------------------------------------ */
/** Swing lows/highs (symmetric window `len`, the s9 rule). Each carries `known` = the bar index from which it can be seen. */
export function pivots(highs, lows, len = PIVOT_LEN) { return pivotPoints(highs, lows, len).map((p) => ({ ...p, known: p.k + len })); }
/** Support levels known at the open of day i: the last `m` swing lows (already visible) whose price is below `ref`. */
export function supportsKnown(pvs, i, ref, m = 3) {
  return pvs.filter((p) => p.type === "L" && p.known < i && p.price < ref).slice(-m).map((p) => ({ k: p.k, price: p.price }));
}
/** The diagonal through the last two visible swing lows, and its lower parallel. Known at the open of day i.
    Rising diagonals only (a falling one is resistance turned around, not support). The parallel is the diagonal shifted DOWN
    by the channel width: the largest distance from the diagonal to any bar low between the two pivots (so the channel holds
    every low that was printed between them). Returns null when there are not two visible lows. */
export function diagonalKnown(pvs, lows, i) {
  const L = pvs.filter((p) => p.type === "L" && p.known < i).slice(-2); if (L.length < 2) return null;
  const [a, b] = L; const slope = (b.price - a.price) / (b.k - a.k); if (!(slope > 0)) return null;
  let width = 0; for (let k = a.k; k <= b.k; k++) { const d = (a.price + slope * (k - a.k)) - lows[k]; if (d > width) width = d; }
  const at = (k) => a.price + slope * (k - a.k);
  return { slope, from: a.k, to: b.k, width, d1: at(i), d2: at(i) - width, at };
}

/* ------------------------------------------------ depth, RSI, percentiles ------------------------------------------------ */
/** Closing drawdown from the highest close of the prior `look` sessions INCLUDING today, in % (≤ 0). */
export function depthFromHigh(c, look = 252) {
  const out = new Array(c.length).fill(null); const dq = [];
  for (let i = 0; i < c.length; i++) { while (dq.length && dq[0] < i - look + 1) dq.shift(); while (dq.length && c[dq.at(-1)] <= c[i]) dq.pop(); dq.push(i); out[i] = i >= 20 ? 100 * (c[i] / c[dq[0]] - 1) : null; }
  return out;
}
export const rsi14 = (c) => rsiWilder(c, 14).map((x, i) => (i < 60 ? null : x));
/** Own-history percentile from PRIOR values only (statistician-2 rule, at least `minN` prior readings). */
export const ownPct = (xs, minN = 250) => X.ownPct(xs, minN);

/* ------------------------------------------------ pullback episodes and the conditional depth curve ------------------------------------------------ */
/** Every pullback from a `look`-session closing high: begins the first close below the high, ends at the first close above it
    (or is censored at the end). Records the deepest close reached (depth, %), sessions to the low and the whole length. */
export function pullbackEpisodes(c, look = 252) {
  const out = []; let high = -Infinity, hi = -1, cur = null;
  for (let i = 0; i < c.length; i++) {
    const x = c[i]; if (!fin(x)) continue;
    if (x >= high) { if (cur) { cur.end = i; cur.censored = false; out.push(cur); cur = null; } high = x; hi = i; continue; }
    if (!cur) cur = { start: i, highIdx: hi, high, low: x, lowIdx: i, depth: 100 * (x / high - 1) };
    if (x < cur.low) { cur.low = x; cur.lowIdx = i; cur.depth = 100 * (x / high - 1); }
  }
  if (cur) { cur.end = c.length - 1; cur.censored = true; out.push(cur); }
  // a rolling `look` high (not the all-time high) would restart after long bears; the all-time rule keeps every episode whole
  return out.map((e) => ({ ...e, toLow: e.lowIdx - e.highIdx, length: e.end - e.highIdx }));
}
/** Given a pullback has already reached x% (closing), the distribution of its final depth and of the sessions still to go
    to the low. xs: the ladder of "reached" depths; every episode that reached x counts once. */
export function conditionalDepth(episodes, xs = Array.from({ length: 20 }, (_, i) => i + 1)) {
  return xs.map((x) => {
    const rs = episodes.filter((e) => !e.censored && -e.depth >= x);
    if (!rs.length) return { x, n: 0 };
    const finals = rs.map((e) => -e.depth), lowIn = rs.filter((e) => -e.depth < x + 1).length; // the low was within 1% of here
    return { x, n: rs.length, finalMed: r1(median(finals)), finalQ: [10, 25, 50, 75, 90].map((p) => r1(quantile(finals, p / 100))),
      pGoesOn5: r1(100 * rs.filter((e) => -e.depth >= x + 5).length / rs.length), pGoesOn10: r1(100 * rs.filter((e) => -e.depth >= x + 10).length / rs.length),
      lowWithin1: r1(100 * lowIn / rs.length) };
  });
}
/** Sessions from "reached x" to the low, per episode (0 when x was the low itself). */
export function sessionsToLowFrom(episodes, c, x) {
  const out = [];
  for (const e of episodes) { if (e.censored || -e.depth < x) continue; for (let i = e.highIdx + 1; i <= e.lowIdx; i++) if (100 * (c[i] / e.high - 1) <= -x) { out.push(e.lowIdx - i); break; } }
  return out;
}

/* ------------------------------------------------ analog days ------------------------------------------------ */
/** Nearest days to `today` across percentile gauges (0..100 each). Distance = root-mean-square of the differences on the
    gauges both days have. Candidates must have at least `minGauges` shared and be at least `gap` sessions apart from a
    nearer pick. Returns the K nearest with their distances. */
export function nearestDays(rows, today, keys, { k = 20, gap = 40, minGauges = 4, before = Infinity } = {}) {
  const scored = [];
  for (const r of rows) { if (r.i >= before) continue; let s = 0, n = 0; for (const key of keys) if (fin(r[key]) && fin(today[key])) { s += (r[key] - today[key]) ** 2; n++; } if (n >= minGauges) scored.push({ i: r.i, d: Math.sqrt(s / n), n }); }
  scored.sort((a, b) => a.d - b.d); const picks = [];
  for (const s of scored) { if (picks.every((p) => Math.abs(p.i - s.i) >= gap)) picks.push(s); if (picks.length >= k) break; }
  return picks;
}

/* ------------------------------------------------ the tranche simulator ------------------------------------------------ */
/** One campaign: a budget of 1 deployed over `W` sessions from the trigger day t0 by a list of rungs.
    rungs: [{ name, w (weight, the rungs sum to 1), level(i) → price or null, fillAtClose (bool: the rung is a close-based
    signal, filled at that close when level(i) is truthy) }]. A price rung fills on the first day i ≥ t0 whose low ≤ level(i),
    at min(open, level) (a limit order, or the open when the day gaps under it). Whatever is unfilled at t0+W is bought at that
    close (the campaign always ends fully invested, so every strategy is compared on the same money).
    Returns the fills, the average cost, the deployed fraction by day, and the time-weighted "time in market" over the window. */
export function runCampaign(bars, t0, W, rungs) {
  const n = bars.length, end = Math.min(t0 + W, n - 1), fills = [], deployed = new Array(end - t0 + 1).fill(0);
  let spent = 0, units = 0, invested = 0;
  const open = new Set();
  for (let i = t0; i <= end; i++) {
    for (let r = 0; r < rungs.length; r++) {
      if (open.has(r)) continue; const rung = rungs[r]; let px = null;
      if (i === end) px = bars[i].c; // forced completion at the window's close
      else if (rung.fillAtClose) { if (rung.level(i)) px = bars[i].c; }
      else { const lv = rung.level(i); if (fin(lv) && lv > 0 && bars[i].l <= lv) px = Math.min(bars[i].o, lv); }
      if (px != null) { open.add(r); const amt = rung.w; spent += amt; units += amt / px; invested += amt; fills.push({ rung: rung.name, i, px, w: amt, forced: i === end && !(rung.fillAtClose ? rung.level(i) : (fin(rung.level(i)) && bars[i].l <= rung.level(i))) }); }
    }
    deployed[i - t0] = invested;
  }
  const avgCost = units > 0 ? spent / units : null, tim = deployed.reduce((s, v) => s + v, 0) / deployed.length;
  const forced = fills.filter((f) => f.forced).reduce((s, f) => s + f.w, 0);
  return { fills, avgCost, units, spent, timeInMarket: tim, forcedShare: forced, endIdx: end, fullAt: fills.length ? Math.max(...fills.map((f) => f.i)) - t0 : null };
}
/** Worst mark-to-cost from t0 through t0+h: the lowest value of (units × close) ÷ money spent, in %, over days with money in. */
export function worstMarkToCost(bars, t0, h, fills) {
  let units = 0, spent = 0, worst = 0, j = 0; const fs = [...fills].sort((a, b) => a.i - b.i);
  for (let i = t0; i <= Math.min(t0 + h, bars.length - 1); i++) { while (j < fs.length && fs[j].i === i) { units += fs[j].w / fs[j].px; spent += fs[j].w; j++; } if (spent > 0) { const m = 100 * (units * bars[i].c / spent - 1); if (m < worst) worst = m; } }
  return worst;
}
/** Return at t0+h on the campaign's average cost, in % (null when the series ends first). */
export function campaignReturn(bars, t0, h, avgCost) { const i = t0 + h; return i < bars.length && fin(avgCost) && avgCost > 0 ? 100 * (bars[i].c / avgCost - 1) : null; }

/** Campaign triggers: the first close at or below `depth`% under the rolling `look`-session closing high, one per pullback
    (the next trigger needs a NEW high first). Returns bar indexes. */
export function triggers(c, depth, look = 252) {
  const dd = depthFromHigh(c, look), out = []; let armed = true;
  for (let i = 0; i < c.length; i++) { if (!fin(dd[i])) continue; if (dd[i] >= 0) armed = true; else if (armed && dd[i] <= -depth) { out.push(i); armed = false; } }
  return out;
}

/** The rung sets, built at the trigger day from what is known at its open (plus the trigger close itself).
    Every set begins with the trigger tranche so a ladder with no levels below still buys something. Equal weights. */
export function rungSets(bars, t0, ctx) {
  const c0 = bars[t0].c, lows = bars.map((b) => b.l);
  const eq = (list) => list.map((r) => ({ ...r, w: 1 / list.length }));
  const trigger = { name: "trigger", fillAtClose: true, level: (i) => i === t0 };
  const sets = {};
  sets.single = eq([trigger]);
  // time DCA: five equal parts at the trigger close and every 12 sessions after (t0, +12, +24, +36, +48)
  sets.dca = eq([0, 12, 24, 36, 48].map((d) => ({ name: d === 0 ? "trigger" : "dca+" + d, fillAtClose: true, level: (i) => i === t0 + d })));
  // the fan ladder: every fan line below the trigger close, each a limit at that line's daily value (known at each open)
  const fanBelow = FAN_KEYS.filter((k) => fin(ctx.fan[k][t0]) && ctx.fan[k][t0] < c0);
  sets.fan = eq([trigger, ...fanBelow.map((k) => ({ name: k, level: (i) => ctx.fan[k][i] }))]);
  // pivots: the last three swing lows below, the diagonal through the last two lows and its lower parallel
  const sup = supportsKnown(ctx.pvs, t0, c0, 3), dg = diagonalKnown(ctx.pvs, lows, t0);
  const pivRungs = sup.map((s, j) => ({ name: "swingLow" + (j + 1), level: () => s.price }));
  if (dg && dg.d1 < c0) pivRungs.push({ name: "diagonal", level: (i) => dg.at(i) }, { name: "parallel", level: (i) => dg.at(i) - dg.width });
  sets.pivots = eq([trigger, ...pivRungs]);
  // RSI own-percentile rungs: 20, 10, 5, 2, 1 — each fills at the first close whose RSI percentile is at or under it
  sets.rsi = eq([trigger, ...[20, 10, 5, 2, 1].map((p) => ({ name: "rsi≤p" + p, fillAtClose: true, level: (i) => fin(ctx.rsiPct[i]) && ctx.rsiPct[i] <= p }))]);
  // all levels together (fan + pivots + RSI), still equal weights
  sets.all = eq([trigger, ...fanBelow.map((k) => ({ name: k, level: (i) => ctx.fan[k][i] })), ...pivRungs, ...[10, 5, 1].map((p) => ({ name: "rsi≤p" + p, fillAtClose: true, level: (i) => fin(ctx.rsiPct[i]) && ctx.rsiPct[i] <= p }))]);
  return sets;
}
/** Sized by market state: the fan ladder, with the trigger tranche's share set by how much fear is already priced
    (VIX own percentile at the trigger: 100th → half the money at once, 0th → an equal share) and the rest spread equally. */
export function stateSized(fanSet, vixPct) {
  const k = fanSet.length; if (k < 2 || !fin(vixPct)) return fanSet;
  const front = Math.max(1 / k, Math.min(0.5, vixPct / 200)), rest = (1 - front) / (k - 1);
  return fanSet.map((r, j) => ({ ...r, w: j === 0 ? front : rest }));
}

/* ------------------------------------------------ small helpers ------------------------------------------------ */
export function fwd(c, i, h) { return X.fwdReturn(c, i, h); }
export function maxDrawdownAhead(c, i, h) { return X.fwdMaxDrawdown(c, i, h); }
export function sessionsToLowAhead(c, i, h) { let m = c[i], at = 0; for (let k = i + 1; k <= Math.min(i + h, c.length - 1); k++) if (c[k] < m) { m = c[k]; at = k - i; } return at; }
export const pctRank = (sortedAsc, x) => { let lo = 0, hi = sortedAsc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] < x) lo = m + 1; else hi = m; } let eq = lo; while (eq < sortedAsc.length && sortedAsc[eq] === x) eq++; return sortedAsc.length ? 100 * (lo + 0.5 * (eq - lo)) / sortedAsc.length : null; };
export const dist = X.dist, blockBootstrap = X.blockBootstrap, episodeBootstrap = X.episodeBootstrap, benjaminiHochberg = X.benjaminiHochberg, statusWord = X.statusWord, mulberry32 = X.mulberry32;
export function decileTable(vals, outcomes, k = 10) {
  const idx = vals.map((v, i) => i).filter((i) => fin(vals[i])).sort((a, b) => vals[a] - vals[b]); const out = [];
  for (let d = 0; d < k; d++) { const sl = idx.slice(Math.floor(d * idx.length / k), Math.floor((d + 1) * idx.length / k)); const row = { decile: d + 1, n: sl.length, lo: r2(vals[sl[0]]), hi: r2(vals[sl.at(-1)]) }; for (const [name, arr] of Object.entries(outcomes)) { const xs = sl.map((i) => arr[i]).filter(fin); row[name] = xs.length ? { n: xs.length, med: r2(median(xs)), mean: r2(mean(xs)), up: r1(100 * xs.filter((x) => x > 0).length / xs.length) } : null; } out.push(row); }
  return out;
}
