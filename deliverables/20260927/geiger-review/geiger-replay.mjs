// GEIGER REPLAY — pure arithmetic for the G2 Geiger review. Read-only research code: nothing here
// is wired into the Hub, the board or any worker.
//
// The per-rung maths are copied in behaviour from the live publisher
// (provider repo services/hot-query/geiger-publish-artifact.mjs:40-63, 183-201) and the composite
// from geiger-source-contract.mjs:194-211, so a replayed reading equals what /geiger would have
// published for the same 230 bars.

export const FAN_SPECS = [['e', 5], ['e', 8], ['e', 13], ['e', 21], ['e', 34], ['s', 50], ['s', 100], ['s', 150], ['s', 200]]
export const RSI_PERIOD = 14, WILLIAMS_PERIOD = 14, WINDOW = 230
export const RSI_OS = 23, RSI_OB = 77, W_OS = -90, W_OB = -10

const cl = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x))
function emaLast (a, n) { const k = 2 / (n + 1); let e = a[0]; for (let i = 1; i < a.length; i++) e = a[i] * k + e * (1 - k); return e }
function smaLast (a, n) { if (a.length < n) return null; let s = 0; for (let i = a.length - n; i < a.length; i++) s += a[i]; return s / n }

export function fan (c) {
  const out = []
  for (const [ty, n] of FAN_SPECS) {
    if (c.length < n) continue
    const v = ty === 'e' ? emaLast(c, n) : smaLast(c, n)
    if (v != null) out.push(v)
  }
  return out
}

export function rsiLast (c, p = RSI_PERIOD) {
  let g = 0, l = 0
  for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d }
  g /= p; l /= p
  for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p }
  return 100 - 100 / (1 + (l === 0 ? 1e9 : g / l))
}

// One rung's reading from its newest bars (the publisher slices the newest 230).
// Returns null when the fan cannot form one pair (publisher counts that as trend_insufficient).
export function rungReading (bars, { familyWeights = { TREND: 0.5, MOMENTUM: 0.5 }, mix = { rsi: 0.6, williams: 0.4 } } = {}) {
  const b = bars.slice(-WINDOW)
  const c = b.map(x => +x.c), h = b.map(x => +x.h), l = b.map(x => +x.l)
  const f = fan(c), close = c[c.length - 1], pairs = f.length - 1
  if (pairs <= 0) return null
  let inOrder = 0
  for (let i = 0; i < pairs; i++) if (f[i] > f[i + 1]) inOrder++
  const trend = (2 * inOrder - pairs) / pairs
  let momentum = null, rsi = null, wr = null
  if (c.length >= RSI_PERIOD + 1 && c.length >= WILLIAMS_PERIOD) {
    rsi = rsiLast(c)
    let hh = -1e18, ll = 1e18
    for (let j = c.length - WILLIAMS_PERIOD; j < c.length; j++) { if (h[j] > hh) hh = h[j]; if (l[j] < ll) ll = l[j] }
    wr = hh > ll ? (hh - close) / (hh - ll) * -100 : -50
    const ws = (mix.rsi + mix.williams) || 1
    momentum = (cl((rsi - RSI_OS) / (RSI_OB - RSI_OS) * 2 - 1) * mix.rsi + cl((wr - W_OS) / (W_OB - W_OS) * 2 - 1) * mix.williams) / ws
  }
  const fw = familyWeights
  const composite = momentum == null ? trend : (fw.TREND * trend + fw.MOMENTUM * momentum) / ((fw.TREND + fw.MOMENTUM) || 1)
  return { trend, momentum, composite, rsi, wr, fanLines: f.length }
}

// Weighted mean of rung composites over rungs with weight > 0 that produced a reading.
export function composite (readings, weights) {
  let ws = 0, s = 0
  for (const [k, w] of Object.entries(weights)) {
    if (!(w > 0) || readings[k] == null) continue
    ws += w; s += w * readings[k]
  }
  return ws ? s / ws : null
}

// Exact additive split of a day-to-day composite change into per-rung pieces. Valid when the same
// rungs are present on both days (the caller skips days where they are not).
export function changePieces (prev, next, weights) {
  let ws = 0
  for (const [k, w] of Object.entries(weights)) if (w > 0 && prev[k] != null && next[k] != null) ws += w
  const pieces = {}
  if (!ws) return pieces
  for (const [k, w] of Object.entries(weights)) {
    if (!(w > 0) || prev[k] == null || next[k] == null) continue
    pieces[k] = w / ws * (next[k] - prev[k])
  }
  return pieces
}

// Variance share: each group's covariance with the total change over the total's variance.
// Group shares sum to 1. `rows` is an array of { total, groups: { name: piece } }.
export function varianceShares (rows) {
  const n = rows.length
  if (n < 2) return null
  const mt = rows.reduce((a, r) => a + r.total, 0) / n
  const vt = rows.reduce((a, r) => a + (r.total - mt) ** 2, 0) / n
  if (!vt) return null
  const names = [...new Set(rows.flatMap(r => Object.keys(r.groups)))]
  const out = {}
  for (const g of names) {
    const mg = rows.reduce((a, r) => a + (r.groups[g] || 0), 0) / n
    out[g] = rows.reduce((a, r) => a + ((r.groups[g] || 0) - mg) * (r.total - mt), 0) / n / vt
  }
  return out
}

// Share of the summed absolute movement each group carries (a cruder, always-positive view).
export function absShares (rows) {
  const tot = {}
  let all = 0
  for (const r of rows) for (const [g, v] of Object.entries(r.groups)) { tot[g] = (tot[g] || 0) + Math.abs(v); all += Math.abs(v) }
  const out = {}
  for (const g of Object.keys(tot)) out[g] = all ? tot[g] / all : 0
  return out
}

// Crossings from <= lo to >= hi. A crossing starts at the LAST observation <= lo before the first
// later observation >= hi, and its length is measured in the series' own time units (ms).
// Upward and downward crossings are both collected (downward: >= hi to <= lo).
export function crossings (series, lo = -0.5, hi = 0.5) {
  const out = []
  let lastLo = null, lastHi = null, state = null
  for (const { t, v } of series) {
    if (v == null) continue
    if (v <= lo) {
      if (state === 'hi' && lastHi != null) out.push({ dir: 'down', ms: t - lastHi })
      state = 'lo'; lastLo = t
    } else if (v >= hi) {
      if (state === 'lo' && lastLo != null) out.push({ dir: 'up', ms: t - lastLo })
      state = 'hi'; lastHi = t
    }
  }
  return out
}

export function quantile (a, q) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

// Correlation, for "how much would the reading change" comparisons.
export function corr (x, y) {
  const n = x.length
  if (n < 2) return null
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}
