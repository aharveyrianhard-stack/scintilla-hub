// Read-only analysis of the live /geiger detail: what momentum and the read words would be if
// momentum were RSI-only (as the Station pane is). Same per-rung mapping and rung weights as the publisher.
const j = require(process.argv[2]);
const cl = (x) => Math.max(-1, Math.min(1, x));
const rsiMap = (r, os, ob) => cl((r - os) / (ob - os) * 2 - 1);
const wMap = (w) => cl((w + 90) / 80 * 2 - 1);
function read(T, M) { // the Hub's scinRead(), verbatim thresholds
  if (T >= 0.5 && M >= 0.4) return "aligned bull"; if (T <= -0.5 && M <= -0.4) return "aligned bear";
  if (T >= 0.4 && M <= -0.15) return "pullback"; if (T <= -0.2 && M >= 0.35) return "turning up";
  if (Math.abs(T) < 0.25 && M >= 0.5) return "mom leads"; if (T >= 0.5 && Math.abs(M) < 0.2) return "stalling";
  if (T >= 0.3 && M >= 0) return "constructive"; if (T <= -0.3 && M <= 0) return "broken"; return "mixed"; }
let n = 0, recon = 0, dA = [], dB = [], chA = 0, chB = 0, gA = [], newestByTf = {}, words = {}, wordsA = {};
const trans = {};
for (const [sym, v] of Object.entries(j.symbols)) {
  if (!v || !v.rungs || v.momentum == null || v.trend == null) continue;
  let w = 0, mNow = 0, mA = 0, mB = 0;
  for (const [k, r] of Object.entries(v.rungs)) {
    if (r.availability !== "AVAILABLE" || r.rsi14 == null || r.williams14 == null) continue;
    const ww = +r.eq_weight; w += ww;
    mNow += ww * (0.6 * rsiMap(r.rsi14, 23, 77) + 0.4 * wMap(r.williams14));
    mA += ww * rsiMap(r.rsi14, 23, 77);     // RSI only, the score's own 23/77 ends
    mB += ww * rsiMap(r.rsi14, 30, 70);     // RSI only, the pane's 30/70 guides as the ends
    (newestByTf[k] = newestByTf[k] || new Set()).add(String(r.newest).slice(0, 16));
  }
  if (!w) continue; n++;
  mNow /= w; mA /= w; mB /= w;
  if (Math.abs(mNow - v.momentum) < 1e-3) recon++;
  dA.push(mA - v.momentum); dB.push(mB - v.momentum);
  const r0 = read(v.trend, v.momentum), rA = read(v.trend, mA), rB = read(v.trend, mB);
  words[r0] = (words[r0] || 0) + 1; wordsA[rA] = (wordsA[rA] || 0) + 1;
  if (r0 !== rA) { chA++; const key = r0 + " -> " + rA; trans[key] = (trans[key] || 0) + 1; }
  if (r0 !== rB) chB++;
  const compA = 0.5 * v.trend + 0.5 * mA; gA.push(compA - v.composite);
}
const st = (a) => { const s = a.slice().sort((x, y) => x - y), m = a.reduce((p, q) => p + q, 0) / a.length;
  return { mean: +m.toFixed(3), median: +s[Math.floor(s.length / 2)].toFixed(3), p10: +s[Math.floor(s.length * .1)].toFixed(3), p90: +s[Math.floor(s.length * .9)].toFixed(3),
    absOver010: a.filter((x) => Math.abs(x) > 0.10).length, absOver020: a.filter((x) => Math.abs(x) > 0.20).length }; };
console.log(JSON.stringify({ computed_utc: j.computed_utc, names: n, momentum_reconstructed_within_0_001: recon,
  rsiOnly_23_77_minus_now: st(dA), rsiOnly_30_70_minus_now: st(dB), composite_shift_rsiOnly_23_77: st(gA),
  read_word_changes_23_77: chA, read_word_changes_30_70: chB, words_now: words, words_rsiOnly_23_77: wordsA,
  top_transitions: Object.entries(trans).sort((a, b) => b[1] - a[1]).slice(0, 8),
  newest_bar_per_timeframe: Object.fromEntries(Object.entries(newestByTf).map(([k, s]) => [k, [...s].sort().slice(-3)])) }, null, 1));
