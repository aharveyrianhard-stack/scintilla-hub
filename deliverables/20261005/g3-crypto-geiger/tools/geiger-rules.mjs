// G3 (5 Oct 2026) — the two voting rules of the non-equity Geiger, as plain functions, plus a port of the
// ribbon job's MOMENTUM reading (ribbon-engine v21: RSI 14 + Williams %R 14, levels 23/77 and -90/-10).
// The SQL in staged/g3/03_geiger_width_votes.sql is the thing that runs; this file mirrors it so the rules can be
// tested without a database and so the dry run can recompute a reading from bars.

export const TF_KEY = { '1': '1m', '3': '3m', '5': '5m', '10': '10m', '15': '15m', '30': '30m', '60': '1h', '120': '2h',
  '180': '3h', '240': '4h', '6h': '6h', '12h': '12h', 'D': '1d', '3D': '3d', 'W': '1w', '2W': '2w', '1M': '1M' }
export const TF_SECONDS = { '1': 60, '3': 180, '5': 300, '10': 600, '15': 900, '30': 1800, '60': 3600, '120': 7200,
  '180': 10800, '240': 14400, '6h': 21600, '12h': 43200, 'D': 86400, '3D': 259200, 'W': 604800, '2W': 1209600, '1M': 2592000 }
export const OLD_WINDOW_S = 10800      // the live rule: a reading counts for 3 hours after its ribbon job stamped it
export const MIN_READING_LIFE_S = 900  // the 1-minute ribbon job runs every 2 minutes; never drop a width between two runs

// OLD rule (live on 5 Oct): only the stamp of the ribbon job matters, the bar's own date is never looked at.
export function votesOld({ now, readTs }) { return readTs != null && readTs > now - OLD_WINDOW_S }

// NEW rules. Rule 1: the newest stored bar must be the one forming now or the one just closed (younger than two
// bar-lengths) — otherwise the width does not vote and is marked. Rule 2: the reading then votes until the next
// bar is due plus one bar-length of grace for a late ribbon job (also two bar-lengths), not for a fixed 3 hours.
export function votesNew({ now, tf, readTs, barTs }) {
  const secs = TF_SECONDS[tf]
  if (!secs) return { votes: votesOld({ now, readTs }), why: null }
  if (readTs == null) return { votes: false, why: 'no reading' }
  if (barTs == null) return { votes: false, why: 'no bar stored' }
  if (now - barTs >= 2 * secs) return { votes: false, why: 'no fresh bar' }
  if (now - readTs >= Math.max(2 * secs, MIN_READING_LIFE_S)) return { votes: false, why: 'reading too old' }
  return { votes: true, why: null }
}

// Momentum of one name = weighted mean of the voting widths (weights renormalised over those that vote);
// if every voting width has weight 0, the plain mean (unchanged from the live function).
export function momentum(rows) {
  const v = rows.filter(r => r.votes)
  if (!v.length) return { mom: null, n: 0 }
  const sw = v.reduce((p, r) => p + r.w, 0)
  const mom = sw > 0 ? v.reduce((p, r) => p + r.read * r.w, 0) / sw : v.reduce((p, r) => p + r.read, 0) / v.length
  return { mom, n: v.length }
}
export function composite({ mom, trend, wt = 0.5, wm = 0.5 }) {
  if (mom == null) return null
  return trend == null ? mom : (wt * trend + wm * mom) / (wt + wm)
}
export const r4 = x => x == null ? null : Math.round(x * 1e4) / 1e4

// ---- ribbon-engine MOMENTUM port (bars oldest -> newest, at most 230, live price spliced onto the last bar) ----
const cl = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x))
function rsiLast(c, p = 14) {
  let g = 0, l = 0
  for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d }
  g /= p; l /= p
  for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p }
  return 100 - 100 / (1 + (l === 0 ? 1e9 : g / l))
}
export function momentumRead(bars, livePrice, wRSI = 0.6, wWill = 0.4) {
  const b = bars.slice(-230)
  if (b.length < 15) return null
  const c = b.map(x => +x.c), h = b.map(x => +x.h), l = b.map(x => +x.l)
  if (livePrice && livePrice > 0) { const i = c.length - 1; c[i] = livePrice; h[i] = Math.max(h[i], livePrice); l[i] = Math.min(l[i], livePrice) }
  const close = c[c.length - 1]
  const rsi = rsiLast(c, 14)
  let hh = -1e18, ll = 1e18
  for (let j = c.length - 14; j < c.length; j++) { if (h[j] > hh) hh = h[j]; if (l[j] < ll) ll = l[j] }
  const wr = hh > ll ? (hh - close) / (hh - ll) * -100 : -50
  const read = (cl((rsi - 23) / (77 - 23) * 2 - 1) * wRSI + cl((wr + 90) / 80 * 2 - 1) * wWill) / ((wRSI + wWill) || 1)
  return { read: +read.toFixed(4), rsi: +rsi.toFixed(2), wr: +wr.toFixed(2) }
}

// 3-day bars from daily bars, bucketed exactly as public.scin_resample_tf does (anchor Mon 3 Jan 2000, UTC);
// a bucket is published once it holds at least 2 daily bars.
const ANCHOR_DAY = Date.UTC(2000, 0, 3) / 86400000
export function threeDayFromDaily(daily) {
  const m = new Map()
  for (const d of [...daily].sort((a, b) => a.t - b.t)) {
    const day = Math.floor(d.t / 86400)
    const bucket = (ANCHOR_DAY + Math.floor((day - ANCHOR_DAY) / 3) * 3) * 86400
    const x = m.get(bucket)
    if (!x) m.set(bucket, { t: bucket, o: +d.o, h: +d.h, l: +d.l, c: +d.c, n: 1 })
    else { x.h = Math.max(x.h, +d.h); x.l = Math.min(x.l, +d.l); x.c = +d.c; x.n++ }
  }
  return [...m.values()].filter(x => x.n >= 2).sort((a, b) => a.t - b.t)
}
