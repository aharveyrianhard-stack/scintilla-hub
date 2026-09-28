/* LEADERS · 3 · THE ROTATION QUESTION — after a big up-swing in a leader, what did holding it look like next to moving
   the money into calmer names that were in a strong trend at that moment? Research, not a rule.
   node research/statistics/leaders-rotation.mjs --fmp <dir> --conc <leaders-concentration.json> [--out <file>]

   · The names: every company that was one of the S&P 500's top 20 contributors in any year 2004 → 2026 and has bars.
   · The moment: every up-swing as it could be known AT THE TIME (realtimeUpSwings): each S9 pivot high (10 bars each
     side on the wick) is confirmed 10 sessions later, and is paired with the latest pivot low before it (itself
     confirmed before that day). No alternation and no refinement: those S9 steps merge and move swing ends using
     pivots confirmed LATER, which would drop highs that were followed by a higher high (review 28 Sep). The
     comparison starts at the close of the confirmation day; nothing up to that day uses later data (fixture test).
   · How big the swing was: its gain, and the gain's percentile among the same name's EARLIER up-swings (own history,
     needs 8 earlier swings). No fixed "big" threshold: results are shown across the whole range.
   · Hold: stay in the name. Candidates: every other company in the bar cache that, on the same day, (a) had the
     Station bull order (13 EMA > 21 EMA > 50 SMA > 200 SMA) with price above all four lines, and (b) moved less than
     the name did over the same swing (standard deviation of daily returns, swing low → decision day).
     Three switch paths, so that "calmer" is not confused with "spread across many names":
       - ONE calm name: a single candidate picked at random — computed exactly, every candidate weighted 1 ÷ their
         number, so each event counts once (no random draws, nothing to re-seed);
       - ONE strong-trend name of ANY volatility (the control: same trend rule, no "calmer" filter);
       - the equal-weight basket of all candidates (spreading the money; this is mostly diversification).
     SPY is the last path.
   · Forward: for every horizon from 1 to 250 sessions, the price return and the worst peak-to-trough drop inside
     that horizon, for hold, switch and SPY. The page reads the curves; the JSON keeps every percentile 1..100 at
     every 10th horizon. Price only (dividends ignored), no costs, no taxes.
   Caveats that bias the answer: the names are chosen because they BECAME leaders (hindsight flatters holding them);
   the candidates are today's survivors; overlapping swings in the same weeks are not independent. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { loadBars, setPatchDir, listCachedSymbols, idxOnOrBefore, quantile, median, percentiles, r1, r2, dstr, NOT_STOCKS, PIVOT_LEN } from "./leaders-lib.mjs";
import { pivotPoints } from "./s9-research.mjs";
import { stationAverages } from "./ladder.mjs";

export const H_MAX = 250, MIN_PRIOR_SWINGS = 8, MIN_HISTORY = 260;

/** Put one stock on the SPY calendar: closes forward-filled after listing, null before. */
export function align(cal, bars) {
  const n = cal.length, c = new Array(n).fill(null), h = new Array(n).fill(null), l = new Array(n).fill(null);
  let j = 0;
  for (let i = 0; i < n; i++) {
    while (j < bars.length && dstr(bars[j].t) <= cal[i]) j++;
    if (j === 0) continue;
    const b = bars[j - 1];
    if (dstr(b.t) === cal[i]) { c[i] = +b.c; h[i] = +b.h; l[i] = +b.l; } else if (i > 0 && c[i - 1] != null && Date.parse(cal[i]) - Date.parse(dstr(b.t)) < 10 * 864e5) { c[i] = c[i - 1]; h[i] = c[i - 1]; l[i] = c[i - 1]; }
  }
  return { c, h, l };
}

/** Per-stock daily arrays: strong-trend flag and prefix sums of daily log returns (for any-window volatility). */
export function prep(A) {
  const n = A.c.length, first = A.c.findIndex((x) => x != null);
  const strong = new Array(n).fill(false), s1 = new Float64Array(n + 1), s2 = new Float64Array(n + 1), cnt = new Int32Array(n + 1);
  if (first >= 0) {
    const closes = A.c.slice(first), ma = stationAverages(closes);
    for (let k = 0; k < closes.length; k++) {
      const e13 = ma.e13[k], e21 = ma.e21[k], s50 = ma.s50[k], s200 = ma.s200[k];
      strong[first + k] = e13 != null && s200 != null && e13 > e21 && e21 > s50 && s50 > s200 && closes[k] > e13;
    }
  }
  for (let i = 0; i < n; i++) {
    const ok = i > 0 && A.c[i] != null && A.c[i - 1] != null && A.c[i] > 0 && A.c[i - 1] > 0;
    const r = ok ? Math.log(A.c[i] / A.c[i - 1]) : 0;
    s1[i + 1] = s1[i] + r; s2[i + 1] = s2[i] + r * r; cnt[i + 1] = cnt[i] + (ok ? 1 : 0);
  }
  return { ...A, first, strong, s1, s2, cnt };
}
/** Standard deviation of daily log returns over bars (a, b]. */
export function volBetween(P, a, b) {
  const n = P.cnt[b + 1] - P.cnt[a + 1]; if (n < 5) return null;
  const m = (P.s1[b + 1] - P.s1[a + 1]) / n, v = (P.s2[b + 1] - P.s2[a + 1]) / n - m * m;
  return Math.sqrt(Math.max(0, v));
}
/** Forward path from entry i: returns[h] and max peak-to-trough drop within h, h = 1..H (null past the data). */
export function forwardPath(c, i, H = H_MAX) {
  const ret = new Array(H + 1).fill(null), dd = new Array(H + 1).fill(null);
  let peak = c[i], worst = 0;
  for (let h = 1; h <= H && i + h < c.length; h++) {
    const x = c[i + h]; if (x == null || c[i] == null) break;
    peak = Math.max(peak, x); worst = Math.min(worst, x / peak - 1);
    ret[h] = 100 * (x / c[i] - 1); dd[h] = 100 * worst;
  }
  return { ret, dd };
}
/** Equal-weight basket path of several aligned series from entry i (each normalised to 1 at entry). */
export function basketPath(list, i, H = H_MAX) {
  const ret = new Array(H + 1).fill(null), dd = new Array(H + 1).fill(null);
  let peak = 1, worst = 0;
  for (let h = 1; h <= H; h++) {
    let s = 0, k = 0;
    for (const c of list) { if (i + h >= c.length) continue; const x = c[i + h] ?? c[i + h - 1]; if (x == null) continue; s += x / c[i]; k++; }
    if (k < Math.max(1, list.length * 0.5)) break;
    const v = s / k; peak = Math.max(peak, v); worst = Math.min(worst, v / peak - 1);
    ret[h] = 100 * (v - 1); dd[h] = 100 * worst;
  }
  return { ret, dd };
}

/** Up-swings as they could be known at the time. Every pivot high k (confirmed at k + len) is paired with the latest
    pivot low before it (confirmed at kL + len < k + len). Nothing merges or moves an event afterwards, so the events
    whose confirmation day is before bar n are identical whether the series ends at n or runs on for years. */
export function realtimeUpSwings(highs, lows, len = PIVOT_LEN) {
  const pts = pivotPoints(highs, lows, len), lowsP = pts.filter((p) => p.type === "L"), out = [];
  let j = -1;
  for (const p of pts) {
    if (p.type !== "H") continue;
    while (j + 1 < lowsP.length && lowsP[j + 1].k < p.k) j++;
    if (j < 0 || !(p.price > lowsP[j].price)) continue;
    out.push({ kL: lowsP[j].k, kH: p.k, kc: p.k + len, gain: 100 * (p.price / lowsP[j].price - 1) });
  }
  return out;
}

/** Weighted histogram (bin 0.1 pt) — exact-enough weighted percentiles without keeping millions of values. */
export class WHist {
  constructor(lo = -1000, hi = 3000, bin = 0.1) { this.lo = lo; this.bin = bin; this.n = Math.round((hi - lo) / bin) + 1; this.w = new Float64Array(this.n); this.tot = 0; this.pos = 0; }
  add(x, w = 1) { if (x == null || !Number.isFinite(x)) return; const i = Math.max(0, Math.min(this.n - 1, Math.round((x - this.lo) / this.bin))); this.w[i] += w; this.tot += w; if (x > 0) this.pos += w; }
  /** Several quantiles in one pass (ps ascending). */
  qs(ps) { if (!this.tot) return ps.map(() => null); const out = []; let acc = 0, i = 0; for (const p of ps) { const target = p * this.tot - 1e-9; while (i < this.n - 1 && acc + this.w[i] < target) { acc += this.w[i]; i++; } out.push(this.lo + i * this.bin); } return out; }
  q(p) { return this.qs([p])[0]; }
  summary() { if (!this.tot) return null; const pct = this.qs(Array.from({ length: 100 }, (_, k) => (k + 1) / 100)).map(r2), [p10, p25, p50, p75, p90] = this.qs([0.1, 0.25, 0.5, 0.75, 0.9]).map(r2);
    return { p10, p25, p50, p75, p90, weight: r1(this.tot), aboveZero: r1(100 * this.pos / this.tot), pct }; }
}
export const H_SINGLE = [21, 63, 126, 250];
/** Forward return and worst drop at the H_SINGLE horizons only (null past the data). */
export function forwardAt(c, i) { const f = forwardPath(c, i, H_SINGLE.at(-1)); return { ret: H_SINGLE.map((h) => f.ret[h]), dd: H_SINGLE.map((h) => f.dd[h]) }; }

export function run(fmpDir, conc) {
  setPatchDir(path.join(fmpDir, "bars-patch"));
  const spyL = loadBars("SPY"), cal = spyL.bars.map((b) => dstr(b.t)), spyC = spyL.bars.map((b) => +b.c);
  const leaders = [...new Set(conc.years.flatMap((y) => y.top20.map((x) => x.sym)))];
  const universe = listCachedSymbols().filter((s) => !NOT_STOCKS.has(s));
  const P = new Map();
  for (const s of universe) { const L = loadBars(s); if (!L || L.bars.length < MIN_HISTORY) continue; P.set(s, prep(align(cal, L.bars))); }
  const events = [], fwdCache = new Map();
  for (const sym of leaders) {
    const X = P.get(sym); if (!X || X.first < 0) continue;
    const off = X.first, h = X.h.slice(off), l = X.l.slice(off);
    const legs = realtimeUpSwings(h, l, PIVOT_LEN).map((g) => ({ kL: g.kL + off, kH: g.kH + off, gain: g.gain }));
    legs.forEach((g, idx) => {
      const kc = g.kH + PIVOT_LEN; if (kc >= cal.length - 1) return;
      const prior = legs.slice(0, idx).map((x) => x.gain);
      const gainPct = prior.length >= MIN_PRIOR_SWINGS ? 100 * prior.filter((x) => x < g.gain).length / prior.length : null;
      const vName = volBetween(X, g.kL, kc); if (vName == null) return;
      const cands = [], anyVol = [];
      for (const [s, Q] of P) { if (s === sym || !Q.strong[kc] || Q.c[kc] == null) continue; anyVol.push(s); const v = volBetween(Q, g.kL, kc); if (v != null && v < vName) cands.push({ s, v }); }
      if (!cands.length) return;
      const hold = forwardPath(X.c, kc), sw_ = basketPath(cands.map((q) => P.get(q.s).c), kc), spy = forwardPath(spyC, kc);
      const one = (list) => list.map((s) => { const key = s + "|" + kc; let f = fwdCache.get(key); if (!f) { f = forwardAt(P.get(s).c, kc); fwdCache.set(key, f); } return f; });
      events.push({ sym, low: cal[g.kL], high: cal[g.kH], decide: cal[kc], gain: r1(g.gain), gainPct: gainPct == null ? null : r1(gainPct), vol: r2(100 * vName * Math.sqrt(252)),
        candVolMed: r2(100 * median(cands.map((q) => q.v)) * Math.sqrt(252)), nCand: cands.length, nAny: anyVol.length, pullbackFromHigh: r1(100 * (X.c[kc] / X.h[g.kH] - 1)), hold, sw: sw_, spy,
        oneCalm: one(cands.map((q) => q.s)), oneAny: one(anyVol) });
    });
  }
  return summarise(events);
}

/** One-name switch vs hold at the H_SINGLE horizons: each event weight 1, split equally over its candidates. */
export function singleBlock(sel) {
  const out = { horizons: H_SINGLE };
  for (const [key, label] of [["oneCalm", "one calm strong-trend name"], ["oneAny", "one strong-trend name, any volatility"]]) {
    const ret = H_SINGLE.map(() => new WHist()), dd = H_SINGLE.map(() => new WHist()), diff = H_SINGLE.map(() => new WHist()), ddDiff = H_SINGLE.map(() => new WHist());
    for (const e of sel) { const list = e[key]; if (!list || !list.length) continue; const w = 1 / list.length;
      H_SINGLE.forEach((h, k) => { const hr = e.hold.ret[h], hd = e.hold.dd[h]; for (const f of list) { if (f.ret[k] == null) continue; ret[k].add(f.ret[k], w); dd[k].add(f.dd[k], w); if (hr != null) diff[k].add(f.ret[k] - hr, w); if (hd != null) ddDiff[k].add(f.dd[k] - hd, w); } }); }
    out[key] = { label, ret: ret.map((x) => x.summary()), dd: dd.map((x) => x.summary()), minusHold: diff.map((x) => x.summary()), ddMinusHold: ddDiff.map((x) => x.summary()) };
  }
  // hold, basket and SPY read at the same horizons, for a like-for-like table
  const at = (k, part) => H_SINGLE.map((h) => { const H = new WHist(); for (const e of sel) H.add(e[k][part][h]); return H.summary(); });
  out.hold = { ret: at("hold", "ret"), dd: at("hold", "dd") }; out.basket = { ret: at("sw", "ret"), dd: at("sw", "dd") }; out.spy = { ret: at("spy", "ret"), dd: at("spy", "dd") };
  return out;
}

/** One calm name minus hold at 250 sessions, for the swing-size deciles. */
function oneAt250(sel) { const H = new WHist(), D = new WHist(); for (const e of sel) { const hr = e.hold.ret[250], hd = e.hold.dd[250], list = e.oneCalm; if (hr == null || !list?.length) continue; for (const f of list) if (f.ret[3] != null) { H.add(f.ret[3] - hr, 1 / list.length); D.add(f.dd[3] - hd, 1 / list.length); } }
  return H.tot ? { med: r2(H.q(0.5)), beat: r1(100 * H.pos / H.tot), ddMed: r2(D.q(0.5)), weight: r1(H.tot) } : null; }
const H_KEEP = [1, 5, 10, 21, 42, 63, 84, 105, 126, 147, 168, 189, 210, 231, 250];
export function summarise(events) {
  const curve = (sel, key, part) => { const out = []; for (let h = 1; h <= H_MAX; h++) { const xs = sel.map((e) => e[key][part][h]).filter((x) => x != null); out.push(xs.length ? [r2(quantile(xs, 0.1)), r2(quantile(xs, 0.25)), r2(quantile(xs, 0.5)), r2(quantile(xs, 0.75)), r2(quantile(xs, 0.9)), xs.length] : null); } return out; };
  const diffCurve = (sel, a, b) => { const out = []; for (let h = 1; h <= H_MAX; h++) { const xs = sel.map((e) => e[a].ret[h] != null && e[b].ret[h] != null ? e[a].ret[h] - e[b].ret[h] : null).filter((x) => x != null); out.push(xs.length ? [r2(quantile(xs, 0.1)), r2(quantile(xs, 0.25)), r2(quantile(xs, 0.5)), r2(quantile(xs, 0.75)), r2(quantile(xs, 0.9)), xs.length, r1(100 * xs.filter((x) => x > 0).length / xs.length)] : null); } return out; };
  const block = (sel) => ({ n: sel.length, names: new Set(sel.map((e) => e.sym)).size,
    hold: { ret: curve(sel, "hold", "ret"), dd: curve(sel, "hold", "dd") }, switch: { ret: curve(sel, "sw", "ret"), dd: curve(sel, "sw", "dd") }, spy: { ret: curve(sel, "spy", "ret"), dd: curve(sel, "spy", "dd") },
    switchMinusHold: diffCurve(sel, "sw", "hold"),
    single: singleBlock(sel),
    fullPct: Object.fromEntries(H_KEEP.map((h) => [h, { hold: percentiles(sel.map((e) => e.hold.ret[h])), switch: percentiles(sel.map((e) => e.sw.ret[h])), holdDD: percentiles(sel.map((e) => e.hold.dd[h])), switchDD: percentiles(sel.map((e) => e.sw.dd[h])) }])) });
  const withPct = events.filter((e) => e.gainPct != null);
  const byGain = []; for (let p = 0; p < 100; p += 10) { const sel = withPct.filter((e) => e.gainPct >= p && (p === 90 ? e.gainPct <= 100 : e.gainPct < p + 10)); const at = (h) => { const xs = sel.map((e) => e.sw.ret[h] != null && e.hold.ret[h] != null ? e.sw.ret[h] - e.hold.ret[h] : null).filter((x) => x != null); return { med: r2(median(xs)), beat: xs.length ? r1(100 * xs.filter((x) => x > 0).length / xs.length) : null, n: xs.length }; };
    const dd = (k, h) => r2(median(sel.map((e) => e[k].dd[h])));
    byGain.push({ from: p, to: p + 10, n: sel.length, h63: at(63), h126: at(126), h250: at(250), holdDD250: dd("hold", 250), switchDD250: dd("sw", 250), holdRet250: r2(median(sel.map((e) => e.hold.ret[250]))), switchRet250: r2(median(sel.map((e) => e.sw.ret[250]))), oneCalm250: oneAt250(sel) }); }
  return { generated: new Date().toISOString(), kind: "Leaders 3 — hold the leader after a big up-swing, or move to calmer strong-trend names (research). Events built in real time (no later pivots)", hMax: H_MAX,
    all: block(events), upperHalf: block(withPct.filter((e) => e.gainPct >= 50)), byGain,
    events: events.map((e) => ({ sym: e.sym, low: e.low, high: e.high, decide: e.decide, gain: e.gain, gainPct: e.gainPct, vol: e.vol, candVolMed: e.candVolMed, nCand: e.nCand, nAny: e.nAny, pullback: e.pullbackFromHigh,
      hold: [63, 126, 250].map((h) => r2(e.hold.ret[h])), sw: [63, 126, 250].map((h) => r2(e.sw.ret[h])), holdDD: [63, 126, 250].map((h) => r2(e.hold.dd[h])), swDD: [63, 126, 250].map((h) => r2(e.sw.dd[h])) })) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const conc = JSON.parse(fs.readFileSync(opt("--conc"), "utf8"));
  const t0 = Date.now(), out = run(opt("--fmp"), conc); fs.writeFileSync(opt("--out") ?? "leaders-rotation.json", JSON.stringify(out));
  console.log(`done in ${Date.now() - t0} ms; events ${out.all.n} from ${out.all.names} names; upper half ${out.upperHalf.n}`);
  for (const k of ["all", "upperHalf"]) for (const h of [21, 63, 126, 250]) { const B = out[k]; console.log(k, h, "hold", JSON.stringify(B.hold.ret[h - 1]), "switch", JSON.stringify(B.switch.ret[h - 1]), "spy", JSON.stringify(B.spy.ret[h - 1]), "diff", JSON.stringify(B.switchMinusHold[h - 1]), "DD hold/sw", B.hold.dd[h - 1]?.[2], B.switch.dd[h - 1]?.[2], "DD10 hold/sw", B.hold.dd[h - 1]?.[0], B.switch.dd[h - 1]?.[0]); }
  for (const g of out.byGain) console.log("gain", g.from, g.to, "n", g.n, "diff250", JSON.stringify(g.h250), "hold250", g.holdRet250, "sw250", g.switchRet250, "DD", g.holdDD250, g.switchDD250);
}
