/* Scintilla · statistics S7b · what was true at the real reversals BETWEEN two reports.
   Pure functions, no fetch, no clock. Used by s7b-between.mjs (node) and the tests.

   Every factor at session i is read from bars 0..i only. The reversal LABELS (the hindsight low of a stretch,
   the ±5-session swing lows and highs) use later bars — that is the point: they say where the turn really was,
   and the factors say what could be seen at that close.

   Factors (per name, against its own history):
   · rsi       RSI(14), Wilder (stats.mjs).
   · rsi_pct   that RSI as a percentile of the name's own previous 756 sessions (needs 250) — entries.mjs.
   · d13/d21/d50/d200 (pct, ud)   close vs the Station cloud lines: 13- and 21-day EMA (seeded at the first close,
               α = 2/(n+1), withheld for the first 60 sessions exactly as _indicators/station-clouds.js does), 50- and
               200-day SMA. In % and in usual days (the % distance ÷ the 60-session usual day read that close).
   · cloud     the three cloud colours of the Station: 13E ≥ 21E, 21E ≥ 50S, 50S ≥ 200S, written as "+ + +".
   · chan_pos  where the close sits in the parallel channel of entries.mjs (method A of the APCh Pine, pivot 9):
               0 = lower rail, 1 = upper rail, below 0 / above 1 = outside. Only when that channel is valid.
   · reg_pos   the same reading in a 63-session straight-line (least-squares) channel of closes, rails at ±2
               residual spreads: always defined once 63 closes exist. An addition, disclosed on the page.
   · dd_ud     close vs the highest high of the last 60 sessions, in usual days (not scaled by √n).
   · since     sessions since the last report's news session (1 = the first close after it).
   · spy_pct   SPY's own RSI percentile on the same date. */
import { rsiWilder, sma, usualDay } from "./stats.mjs";
import { pivots, channelStates, rsiOwnPercentile } from "./entries.mjs";

export const SWING = 5;
export const DD_LOOKBACK = 60;
export const REG_LEN = 63;
export const EMA_WARMUP = 60;
export const MIN_STRETCH = 20, MAX_STRETCH = 90;

/** The Station's EMA: seeded at the first close, α = 2/(n+1), null for the first `warm` sessions. */
export function emaStation(closes, n, warm = EMA_WARMUP) {
  const out = new Array(closes.length).fill(null), a = 2 / (n + 1);
  let e = null;
  for (let i = 0; i < closes.length; i++) {
    e = e === null ? closes[i] : a * closes[i] + (1 - a) * e;
    if (i >= warm) out[i] = e;
  }
  return out;
}

/** Position of each close inside a rolling least-squares line of the last `len` closes, rails at ±2 residual sd. */
export function regressionPosition(closes, len = REG_LEN) {
  const out = new Array(closes.length).fill(null);
  const xm = (len - 1) / 2; let sxx = 0; for (let x = 0; x < len; x++) sxx += (x - xm) ** 2;
  for (let i = len - 1; i < closes.length; i++) {
    let sy = 0, sxy = 0;
    for (let x = 0; x < len; x++) { const y = closes[i - len + 1 + x]; sy += y; sxy += (x - xm) * y; }
    const ym = sy / len, b = sxy / sxx, a = ym - b * xm;
    let ss = 0; for (let x = 0; x < len; x++) { const r = closes[i - len + 1 + x] - (a + b * x); ss += r * r; }
    const sd = Math.sqrt(ss / (len - 2));
    if (!(sd > 0)) continue;
    const mid = a + b * (len - 1);
    out[i] = (closes[i] - (mid - 2 * sd)) / (4 * sd);
  }
  return out;
}

export const FACTORS = [
  { key: "rsi", fam: "rsi", label: "RSI(14) value", edges: [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] },
  { key: "rsi_pct", fam: "rsi", label: "RSI own 3-year percentile", edges: [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95] },
  { key: "d13_pct", fam: "short", label: "close vs 13-day EMA, %", edges: [-10, -6, -4, -2, -1, 0, 1, 2, 4, 6, 10] },
  { key: "d21_pct", fam: "short", label: "close vs 21-day EMA, %", edges: [-12, -8, -5, -3, -1, 0, 1, 3, 5, 8, 12] },
  { key: "d50_pct", fam: "d50", label: "close vs 50-day SMA, %", edges: [-20, -12, -8, -5, -2, 0, 2, 5, 8, 12, 20] },
  { key: "d200_pct", fam: "d200", label: "close vs 200-day SMA, %", edges: [-30, -20, -10, -5, 0, 5, 10, 20, 30, 50] },
  { key: "d13_ud", fam: "short", label: "close vs 13-day EMA, usual days", edges: [-4, -3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3] },
  { key: "d21_ud", fam: "short", label: "close vs 21-day EMA, usual days", edges: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5] },
  { key: "d50_ud", fam: "d50", label: "close vs 50-day SMA, usual days", edges: [-8, -6, -4, -2, -1, 0, 1, 2, 4, 6, 8] },
  { key: "d200_ud", fam: "d200", label: "close vs 200-day SMA, usual days", edges: [-12, -8, -4, -2, 0, 2, 4, 8, 12, 20] },
  { key: "chan_pos", fam: "chan", label: "place in the parallel channel (0 lower rail, 1 upper)", edges: [-0.25, 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.25] },
  { key: "reg_pos", fam: "reg", label: "place in the 63-session straight-line channel", edges: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1] },
  { key: "dd_ud", fam: "dd", label: "below the 60-session high, usual days", edges: [-10, -8, -6, -5, -4, -3, -2, -1, -0.25] },
  { key: "since", fam: "since", label: "sessions since the last report", edges: [3, 6, 11, 16, 21, 31, 41, 51, 61] },
  { key: "spy_pct", fam: "spy", label: "SPY's own RSI percentile", edges: [10, 20, 30, 40, 50, 60, 70, 80, 90] },
];
export const CLOUD_STATES = ["+++", "++-", "+-+", "+--", "-++", "-+-", "--+", "---"];

/** Bin index for value v against ascending edges: 0 = below edges[0], k = [edges[k-1], edges[k]), n = at or above the last. */
export function binOf(v, edges) {
  if (v == null || !Number.isFinite(v)) return -1;
  let k = 0; while (k < edges.length && v >= edges[k]) k++;
  return k;
}
export function binLabel(k, edges) {
  if (k === 0) return `< ${edges[0]}`;
  if (k === edges.length) return `≥ ${edges[edges.length - 1]}`;
  return `${edges[k - 1]} to ${edges[k]}`;
}

/** Every factor for one name. bars = [{h,l,c}] oldest first; reportIdx = sorted news-session indexes;
    spyPctByBar = SPY's own RSI percentile aligned to these bars (null where SPY has no such date). */
export function factorSeries(bars, reportIdx, spyPctByBar) {
  const closes = bars.map((b) => +b.c), highs = bars.map((b) => +b.h), lows = bars.map((b) => +b.l), n = closes.length;
  const rsi = rsiWilder(closes, 14), rsiPct = rsiOwnPercentile(rsi);
  const usual = usualDay(closes, 60);
  const e13 = emaStation(closes, 13), e21 = emaStation(closes, 21), s50 = sma(closes, 50), s200 = sma(closes, 200);
  const chan = channelStates(highs, lows, closes);
  const reg = regressionPosition(closes);
  const F = Object.fromEntries(FACTORS.map((f) => [f.key, new Array(n).fill(null)]));
  const cloud = new Array(n).fill(null);
  let rp = -1;
  for (let i = 0; i < n; i++) {
    const c = closes[i], u = usual[i] > 0 ? usual[i] : null;
    F.rsi[i] = rsi[i]; F.rsi_pct[i] = rsiPct[i];
    for (const [k, m] of [["d13", e13], ["d21", e21], ["d50", s50], ["d200", s200]]) {
      if (m[i] > 0) { const p = (c / m[i] - 1) * 100; F[`${k}_pct`][i] = p; F[`${k}_ud`][i] = u ? p / u : null; }
    }
    if (e13[i] != null && e21[i] != null && s50[i] != null && s200[i] != null)
      cloud[i] = (e13[i] >= e21[i] ? "+" : "-") + (e21[i] >= s50[i] ? "+" : "-") + (s50[i] >= s200[i] ? "+" : "-");
    const ch = chan[i];
    if (ch && ch.valid && ch.upper > ch.lower) F.chan_pos[i] = (c - ch.lower) / (ch.upper - ch.lower);
    F.reg_pos[i] = reg[i];
    if (i >= DD_LOOKBACK - 1 && u) {
      let H = -Infinity; for (let j = i - DD_LOOKBACK + 1; j <= i; j++) if (highs[j] > H) H = highs[j];
      F.dd_ud[i] = ((c / H - 1) * 100) / u;
    }
    while (rp + 1 < reportIdx.length && reportIdx[rp + 1] < i) rp++;   // the last news session strictly before i
    F.since[i] = rp >= 0 ? i - reportIdx[rp] : null;
    F.spy_pct[i] = spyPctByBar ? spyPctByBar[i] : null;
  }
  return { closes, highs, lows, usual, F, cloud };
}

/** The stretches between consecutive news sessions r_k < r_k1: sessions r_k+1 … r_k1-1 (the last is the exit close).
    Kept when 20 ≤ length ≤ 90 (a longer gap means a report is missing from the list). */
export function stretches(reportIdx, n) {
  const out = [];
  for (let k = 0; k + 1 < reportIdx.length; k++) {
    const s = reportIdx[k] + 1, x = reportIdx[k + 1] - 1, len = x - s + 1;
    if (len < MIN_STRETCH || len > MAX_STRETCH || x >= n) continue;
    out.push({ k, s, x, r: reportIdx[k + 1] });
  }
  return out;
}

/** Reversal points inside one stretch. best = the lowest close among s … x-1 (the best hindsight entry for the
    run into the report); swingLows/Highs = pivots of ±SWING sessions on lows/highs whose bar is in s … x. */
export function reversalsIn(st, closes, piv) {
  let best = st.s;
  for (let i = st.s; i < st.x; i++) if (closes[i] < closes[best]) best = i;
  const inS = (p) => p.k >= st.s && p.k <= st.x;
  return { best, swingLows: piv.lo.filter(inS).map((p) => p.k), swingHighs: piv.hi.filter(inS).map((p) => p.k) };
}
export const swingPivots = (highs, lows) => pivots(highs, lows, SWING);

/** Conditions: a factor, a side ("lt" = below, "ge" = at or above — the same cut as the bins) and a threshold;
    or a cloud state. */
export function condHolds(cond, F, cloud, i) {
  if (cond.factor === "cloud") return cloud[i] === cond.value;
  const v = F[cond.factor][i];
  if (v == null || !Number.isFinite(v)) return false;
  return cond.side === "lt" ? v < cond.value : v >= cond.value;
}
export function condKey(c) { return c.factor === "cloud" ? `cloud ${c.value}` : `${c.factor} ${c.side === "lt" ? "<" : "≥"} ${c.value}`; }

/** One trade in a stretch: enter at the first close e in s … x-1 where `fires(e)`; exit at x (the last close before
    the report), r (the report session's close) and r+5. Percent returns; null when it never fires. */
export function stretchTrade(closes, st, fires) {
  for (let e = st.s; e < st.x; e++) {
    if (!fires(e)) continue;
    const pct = (b) => (b < closes.length && closes[e] > 0 && closes[b] > 0) ? (closes[b] / closes[e] - 1) * 100 : null;
    return { entry: e, wait: e - st.s, held: st.x - e, primary: pct(st.x), reportDay: pct(st.r), after5: pct(st.r + 5) };
  }
  return null;
}

/** Lift table for one factor: per bin, the share of ordinary sessions and of each reversal kind, and lift = share at
    the reversal ÷ share at ordinary sessions. counts = {ordinary: [], best: [], swingLow: [], swingHigh: []}, each
    an array of per-bin counts (defined values only). */
export function liftTable(counts, edges) {
  const tot = Object.fromEntries(Object.entries(counts).map(([k, a]) => [k, a.reduce((s, x) => s + x, 0)]));
  const rows = [];
  for (let b = 0; b <= edges.length; b++) {
    const share = (k) => tot[k] ? 100 * counts[k][b] / tot[k] : null;
    const o = share("ordinary");
    const lift = (k) => o > 0 && share(k) != null ? share(k) / o : null;
    rows.push({ bin: binLabel(b, edges), ordinary: o, best: share("best"), swingLow: share("swingLow"), swingHigh: share("swingHigh"),
      lift_best: lift("best"), lift_swingLow: lift("swingLow"), lift_swingHigh: lift("swingHigh"),
      n_best: counts.best[b], n_swingLow: counts.swingLow[b] });
  }
  return { totals: tot, rows };
}
