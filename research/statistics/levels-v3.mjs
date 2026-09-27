/* Scintilla · rulebook v3, chapter 1 — every absolute level becomes a per-instrument line (F5, 27 Sep 2026).
   node research/statistics/levels-v3.mjs --cache <dir> [--extra <dir>] [--s6 <runup-into-earnings.json>]
   <dir>/<SYMBOL>.json : the chart API's finished daily bars, saved as served (GET /candles?tf=D&limit=6000&symbol=X,
                         header Origin: https://scintillahub.ai). --extra holds names outside the 364 (BTCUSD).
   Reads data/taxonomy-20260924.json (funds vs companies, the 30 branches). Writes data/levels-v3.json only.
   Everything is descriptive: prior observations only for every line; the "what followed" blocks are counts of what
   happened after a live-knowable trigger, labelled as such, and never used to draw a line. Nothing predicts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { rsiWilder, sma, distanceToSma, usualDay, pctMoves, quantile, percentileOf, stdevSample } from "./stats.mjs";
import { segmentStart, barsPerYear, williamsR, sigmaRatio, sigma14, sigmaD200, walkLines, countFires, pullbackEpisodes,
  pullbackTriggers, followed, spearman, summarise, Z10 } from "./levels-v3-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const CACHE = opt("--cache"), EXTRA = opt("--extra"), S6 = opt("--s6");
if (!CACHE) { console.error("--cache <dir> is required"); process.exit(2); }
const TARGETS = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT"], FUNDS5 = ["SPY", "QQQ", "DIA", "IWM", "SMH"];
const FOCUS = [...TARGETS, ...FUNDS5, "BTCUSD"];
const tax = JSON.parse(fs.readFileSync(path.join(here, "../../data/taxonomy-20260924.json"), "utf8"));
const FUND_SET = new Set(Object.entries(tax.placement).filter(([, v]) => v.trunk === "FUNDS").map(([k]) => k));
const BRANCHES = Object.values(tax.nodes).filter((n) => n.level === "branch").map((n) => ({ id: n.id.replace(/^BR:/, ""), label: n.label, members: n.members }));
const branchOf = {}; for (const b of BRANCHES) for (const m of b.members) (branchOf[m] ||= []).push(b.id);
const AI_BRANCHES = ["AI_ACCELERATORS", "AI_DATACENTER", "AI_SOFTWARE", "AI_POWER", "MEMORY_STORAGE", "SEMI_EQUIPMENT", "PHOTONICS_OPTICAL"];
const r4 = (v) => (v == null || !Number.isFinite(v)) ? null : Math.round(v * 1e4) / 1e4;
const day = (t) => new Date(t).toISOString().slice(0, 10);

/* ── pass 1: every name's own series ───────────────────────────────────────────────────────────── */
function load(dir, sym) { const j = JSON.parse(fs.readFileSync(path.join(dir, sym + ".json"), "utf8")); return j; }
const files = fs.readdirSync(CACHE).filter((f) => f.endsWith(".json")).map((f) => [CACHE, f.slice(0, -5)]);
if (EXTRA && fs.existsSync(EXTRA)) for (const f of fs.readdirSync(EXTRA).filter((f) => f.endsWith(".json"))) files.push([EXTRA, f.slice(0, -5)]);
const S = {}; const missing = []; const provenance = {};
for (const [dir, sym] of files) {
  const j = load(dir, sym); const all = Array.isArray(j.series) ? j.series : [];
  provenance[sym] = { provider: j.provider ?? null, price_basis: j.price_basis ?? null, newest: all.length ? day(all[all.length - 1].t) : null, served: all.length, full_series_count: j.full_series_count ?? null };
  if (all.length < 300) { missing.push({ sym, bars: all.length }); continue; }
  const bars = all.slice(segmentStart(all));
  const c = bars.map((b) => +b.c), h = bars.map((b) => +b.h), l = bars.map((b) => +b.l);
  const bpy = barsPerYear(bars), W3 = 3 * bpy;
  const ud = usualDay(c, 60), mv = pctMoves(c), s200 = sma(c, 200);
  const x = { sym, dates: bars.map((b) => day(b.t)), c, h, l, bpy, W3, ud, mv, s200, s50: sma(c, 50),
    rsi: rsiWilder(c, 14), wr: williamsR(h, l, c, 14), d200: distanceToSma(c, 200), d50: distanceToSma(c, 50) };
  x.ratio = sigmaRatio(mv, ud); x.s14 = sigma14(c, ud); x.d200s = sigmaD200(x.d200, ud);
  x.fund = FUND_SET.has(sym) || sym === "BTCUSD"; x.company = !x.fund;
  S[sym] = x;
}
const SPY = S.SPY; const spyIdx = new Map(SPY.dates.map((d, i) => [d, i]));

/* ── pass 2: cross-sectional leader rank (120-session return minus SPY's, ranked among companies each day) ── */
const REL = 120;
for (const x of Object.values(S)) {
  x.rel = new Array(x.c.length).fill(null); x.rel60 = new Array(x.c.length).fill(null);
  if (x.bpy > 300) continue;                                        // BTCUSD: 7-day calendar, no session alignment with SPY
  for (let i = REL; i < x.c.length; i++) {
    const k = spyIdx.get(x.dates[i]); if (k == null || k < REL) continue;
    x.rel[i] = ((x.c[i] / x.c[i - REL]) - (SPY.c[k] / SPY.c[k - REL])) * 100;
    x.rel60[i] = ((x.c[i] / x.c[i - 60]) - (SPY.c[k] / SPY.c[k - 60])) * 100;
  }
}
const byDate = new Map();
for (const x of Object.values(S)) if (x.company) x.dates.forEach((d, i) => { if (x.rel[i] != null) { if (!byDate.has(d)) byDate.set(d, []); byDate.get(d).push(x.rel[i]); } });
for (const v of byDate.values()) v.sort((a, b) => a - b);
function rankOf(d, v) { const a = byDate.get(d); if (!a || a.length < 50 || v == null) return null; return percentileOf(a, v); }
for (const x of Object.values(S)) x.lead = x.rel.map((v, i) => v == null ? null : rankOf(x.dates[i], v));

/* ── pass 3: per name — the mapping, the out-of-sample firing, pullbacks, sigma follow-through ───────── */
const FAM = {
  rsi_low:    { s: "rsi",   side: "le", fixed: 30,  sig: "s14",   q: 0.10 },
  rsi_high:   { s: "rsi",   side: "ge", fixed: 70,  sig: "s14",   q: 0.90 },
  wr_low:     { s: "wr",    side: "le", fixed: -80, sig: null,    q: 0.10 },
  wr_high:    { s: "wr",    side: "ge", fixed: -20, sig: null,    q: 0.90 },
  d200_low:   { s: "d200",  side: "le", fixed: -10, sig: "d200s", q: 0.10 },
  d200_high:  { s: "d200",  side: "ge", fixed: 10,  sig: "d200s", q: 0.90 },
  sigma_down: { s: "ratio", side: "le", fixed: -2,  sig: null,    q: 0.025 },
  sigma_up:   { s: "ratio", side: "ge", fixed: 2,   sig: null,    q: 0.975 },
};
const SERIES = ["rsi", "wr", "d200", "ratio"];
const out = { built_utc: new Date().toISOString(), study: "F5 · levels → per-instrument lines (rulebook v3 ch. 1)",
  source: "chart API https://scintilla-massive-chart-api.fly.dev/candles?tf=D&limit=6000 — finished daily bars, split-adjusted as served (BTCUSD from FMP, 7-day calendar)",
  definitions: { P: "own percentile, prior window; line = the prior window's q-quantile", Z: "(reading − prior mean) ÷ prior sd; line Z ≤ −1.2816 / ≥ +1.2816 (the nominal 10% / 90%)",
    sigma: "RSI family: 14-session return ÷ (usual day before it × √14); 200-day family: distance ÷ (prior usual day × √(200/3)); daily move: move ÷ prior usual day; line ±1.2816 (±2 for the daily move, the board's line)",
    windows: "3y = 3 × the name's bars per year (756 for stocks, ~1,095 for BTCUSD); all = every prior bar since the history start", warmup: "a line is drawn only when at least 252 prior readings exist",
    episode: "a new firing episode starts after 5 or more sessions without firing", oos: "out of sample: day i is compared with the line the days before i would have drawn" },
  focus: FOCUS, targets: TARGETS, funds5: FUNDS5, provenance, missing, symbols: {} };

const pooledTrig = [];                  // pullback triggers across companies, for the leader-relative table
const pooledBase = [];                  // every 5th session: the same class's ordinary outcome
const sigmaPool = { down2: [], up2: [], any: [] };

for (const x of Object.values(S)) {
  const T = x.c.length - 1; const L756 = Math.max(0, T - x.W3 + 1);
  const walks = {};
  for (const s of SERIES) {
    const qLo = s === "ratio" ? 0.025 : 0.10, qHi = s === "ratio" ? 0.975 : 0.90;
    walks[s] = { w3: walkLines(x[s], x.W3, { qLo, qHi }), all: walkLines(x[s], Infinity, { qLo, qHi }) };
  }
  const rec = { bars: x.c.length, first_day: x.dates[0], last_day: x.dates[T], fund: x.fund, bpy: x.bpy, branches: branchOf[x.sym] || [], close: x.c[T] };
  /* today, against the prior window (exact percentiles, as stats.mjs computes them) */
  const prior = (arr, len) => { const a = []; for (let k = Math.max(0, T - len); k < T; k++) if (arr[k] != null && Number.isFinite(arr[k])) a.push(arr[k]); return a; };
  const today = {};
  for (const s of ["rsi", "wr", "d200", "ratio", "s14", "d200s"]) {
    const v = x[s][T]; const p3 = prior(x[s], x.W3), pa = prior(x[s], Infinity);
    const m3 = p3.length ? p3.reduce((a, b) => a + b, 0) / p3.length : null, sd3 = stdevSample(p3);
    today[s] = { v: r4(v), p3y: v == null || p3.length < 30 ? null : r4(percentileOf(p3, v)), pall: v == null || pa.length < 30 ? null : r4(percentileOf(pa, v)),
      z3y: v == null || !sd3 ? null : r4((v - m3) / sd3), n3y: p3.length, nall: pa.length };
  }
  today.ud = r4(x.ud[T]); today.move = r4(x.mv[T]); today.lead = r4(x.lead[T]); today.rel120 = r4(x.rel[T]); today.rel60 = r4(x.rel60[T]);
  let hi60 = -Infinity; for (let k = Math.max(0, T - 59); k <= T; k++) hi60 = Math.max(hi60, x.c[k]);
  today.dd60 = r4((x.c[T] / hi60 - 1) * 100);
  { let mn = Infinity; for (let k = Math.max(0, T - x.bpy + 1); k <= T; k++) if (x.rsi[k] != null) mn = Math.min(mn, x.rsi[k]); today.rsi_min_1y = r4(mn); }
  rec.today = today;
  /* the lines as they stand today (drawn from the prior window) */
  const lines = {};
  for (const s of SERIES) {
    const p3 = prior(x[s], x.W3).sort((a, b) => a - b), pa = prior(x[s], Infinity).sort((a, b) => a - b);
    const st = (a) => { if (a.length < 30) return null; const m = a.reduce((p, q) => p + q, 0) / a.length, sd = stdevSample(a);
      const qs = s === "ratio" ? [0.01, 0.025, 0.05, 0.95, 0.975, 0.99] : [0.02, 0.05, 0.10, 0.25, 0.5, 0.75, 0.90, 0.95, 0.98];
      return { n: a.length, mean: r4(m), sd: r4(sd), ...Object.fromEntries(qs.map((q) => ["q" + Math.round(q * 1000) / 10, r4(quantile(a, q))])),
        zlo: r4(m + Z10 * sd), zhi: r4(m - Z10 * sd), m2sd: r4(m - 2 * sd), p2sd: r4(m + 2 * sd) }; };
    lines[s] = { "3y": st(p3), all: st(pa) };
  }
  rec.lines = lines;
  /* descriptive shares of the prior window beyond the fixed line */
  const share = {};
  for (const [f, F] of Object.entries(FAM)) {
    const cmp = F.side === "le" ? (v) => v <= F.fixed : (v) => v >= F.fixed;
    const p3 = prior(x[F.s], x.W3), pa = prior(x[F.s], Infinity);
    share[f] = { "3y": p3.length ? r4(100 * p3.filter(cmp).length / p3.length) : null, all: pa.length ? r4(100 * pa.filter(cmp).length / pa.length) : null,
      days3y: p3.filter(cmp).length, daysAll: pa.filter(cmp).length };
  }
  rec.share = share;
  /* out-of-sample firing: fixed line vs own P (3y, all) vs Z (3y) vs σ form, over the last 3 years and the whole history */
  const oos = {};
  for (const [f, F] of Object.entries(FAM)) {
    const ser = x[F.s], w3 = walks[F.s].w3, wa = walks[F.s].all; const N = ser.length;
    const le = F.side === "le"; const beyond = (v, line) => Number.isFinite(line) && (le ? v <= line : v >= line);
    const fire = { fixed: [], p3y: [], pall: [], z3y: [], sig: [] }; const evaluated = new Array(N).fill(false);
    for (let i = 0; i < N; i++) {
      const v = ser[i]; const ok = v != null && Number.isFinite(v) && w3.n[i] >= 252;
      evaluated[i] = ok;
      fire.fixed[i] = ok && (le ? v <= F.fixed : v >= F.fixed);
      fire.p3y[i] = ok && beyond(v, le ? w3.lo[i] : w3.hi[i]);
      fire.pall[i] = ok && beyond(v, le ? wa.lo[i] : wa.hi[i]);
      const z = ok && w3.sd[i] > 0 ? (v - w3.mean[i]) / w3.sd[i] : null;
      fire.z3y[i] = ok && z != null && (le ? z <= Z10 : z >= -Z10) && F.s !== "ratio";
      const sv = F.sig ? x[F.sig][i] : null;
      fire.sig[i] = ok && sv != null && (le ? sv <= Z10 : sv >= -Z10);
    }
    const span = (from) => {
      let days = 0; for (let i = from; i <= T; i++) if (evaluated[i]) days++;
      const r = { days };
      for (const k of Object.keys(fire)) { if (k === "z3y" && F.s === "ratio") continue; if (k === "sig" && !F.sig) continue;
        const cf = countFires(fire[k], from, T); r[k] = { d: cf.days, e: cf.episodes, share: days ? r4(100 * cf.days / days) : null }; }
      let both = 0, pOnly = 0, fOnly = 0; for (let i = from; i <= T; i++) { const a = fire.fixed[i], b = fire.p3y[i]; if (a && b) both++; else if (b) pOnly++; else if (a) fOnly++; }
      Object.assign(r, { both, p_only: pOnly, fixed_only: fOnly });
      return r;
    };
    oos[f] = { last1y: span(Math.max(0, T - x.bpy + 1)), last3y: span(L756), full: span(0) };
    if (FOCUS.includes(x.sym) && (f === "rsi_low" || f === "rsi_high")) {
      const ep = (k) => countFires(fire[k], L756, T).starts.map((i) => ({ date: x.dates[i], v: r4(ser[i]), line: r4(k === "p3y" ? (le ? w3.lo[i] : w3.hi[i]) : F.fixed) }));
      oos[f].episodes_last3y = { fixed: ep("fixed"), p3y: ep("p3y") };
    }
  }
  rec.oos = oos;
  /* RSI and Williams %R: one witness or two (study S2, descriptive) */
  rec.rsi_wr_spearman = r4(spearman(x.rsi, x.wr));
  /* range shift (Brown): the own 10th / 90th RSI percentile when the close is above vs below the 200-day, all history */
  const up = [], dn = []; for (let i = 0; i <= T; i++) if (x.rsi[i] != null && x.s200[i] != null) (x.c[i] >= x.s200[i] ? up : dn).push(x.rsi[i]);
  up.sort((a, b) => a - b); dn.sort((a, b) => a - b);
  rec.range_shift = { above200: { n: up.length, q10: r4(quantile(up, 0.1)), q90: r4(quantile(up, 0.9)) }, below200: { n: dn.length, q10: r4(quantile(dn, 0.1)), q90: r4(quantile(dn, 0.9)) } };
  /* pullbacks: where past pullbacks ended (hindsight lows) and the live-knowable triggers */
  const eps = pullbackEpisodes(x.c, x.s200, x.ud);
  const q = eps.filter((e) => e.qualified);
  const at = (e) => { const m = e.m;
    let p3 = null; { const a = []; for (let k = Math.max(0, m - x.W3); k < m; k++) if (x.rsi[k] != null) a.push(x.rsi[k]); if (a.length >= 252 && x.rsi[m] != null) p3 = percentileOf(a, x.rsi[m]); }
    return { rsi: x.rsi[m], rsiP: p3, d200: x.d200[m], d50: x.d50[m], depth: e.depth, depthUsual: e.depthUsual, sessions: m - e.jH }; };
  const lows = q.map(at);
  const band = (key, list) => { const s = list.map((o) => o[key]).filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b); return s.length ? { q25: r4(quantile(s, 0.25)), med: r4(quantile(s, 0.5)), q75: r4(quantile(s, 0.75)) } : null; };
  const recent = q.filter((e) => e.jH >= L756).map(at);
  const cur = eps.length && eps[eps.length - 1].open ? eps[eps.length - 1] : null;
  const medDepth = band("depth", lows)?.med ?? null;
  const curDepth = cur ? (x.c[T] / cur.H - 1) * 100 : 0;
  rec.pullbacks = { n: q.length, n_last3y: recent.length, recovered_share: q.length ? r4(100 * q.filter((e) => e.recovered).length / q.length) : null,
    all: q.length ? Object.fromEntries(["depth", "depthUsual", "rsi", "rsiP", "d200", "d50", "sessions"].map((k) => [k, band(k, lows)])) : null,
    last3y: recent.length ? Object.fromEntries(["depth", "depthUsual", "rsi", "rsiP", "d200", "d50"].map((k) => [k, band(k, recent)])) : null,
    current: { from_high: r4(curDepth), high_date: cur ? x.dates[cur.jH] : x.dates[T], high_above_200: cur ? (x.s200[cur.jH] != null && cur.H >= x.s200[cur.jH]) : null,
      vs_usual: medDepth ? r4(curDepth / medDepth) : null, rsi_vs_usual_low: band("rsi", lows)?.med != null && x.rsi[T] != null ? r4(x.rsi[T] - band("rsi", lows).med) : null } };
  if (x.company && x.bpy < 300) {
    for (const t of pullbackTriggers(x.c, x.s200, eps)) {
      const f = followed(x.c, t.i, t.H);
      const u = x.ud[t.i]; const ret60u = f.ret60 != null && u > 0 ? f.ret60 / (u * Math.sqrt(60)) : null; const maeu = f.mae != null && u > 0 ? f.mae / (u * Math.sqrt(60)) : null;
      pooledTrig.push({ sym: x.sym, year: +x.dates[t.i].slice(0, 4), kind: t.kind, level: t.level, lead: x.lead[t.i], ...f, ret60u, maeu, ud: u, date: x.dates[t.i] });
    }
    for (let i = 250; i + 60 < x.c.length; i += 5) {
      if (x.lead[i] == null || x.s200[i] == null) continue;
      let mn = Infinity; for (let k = i + 1; k <= i + 60; k++) mn = Math.min(mn, x.c[k]); const u = x.ud[i]; const r60 = (x.c[i + 60] / x.c[i] - 1) * 100, mae = (mn / x.c[i] - 1) * 100;
      pooledBase.push({ year: +x.dates[i].slice(0, 4), date: x.dates[i], lead: x.lead[i], above: x.c[i] >= x.s200[i], ret20: (x.c[i + 20] / x.c[i] - 1) * 100, ret60: r60, mae,
        ret60u: u > 0 ? r60 / (u * Math.sqrt(60)) : null, maeu: u > 0 ? mae / (u * Math.sqrt(60)) : null, ud: u });
    }
  }
  /* sigma days: what followed the name's own ≥ 2 usual-day days (5 sessions later), and today's move in usual days */
  const after = { down2: [], up2: [] };
  for (let i = 61; i + 5 <= T; i++) { const r = x.ratio[i]; if (r == null) continue; const f5 = (x.c[i + 5] / x.c[i] - 1) * 100;
    if (r <= -2) after.down2.push(f5); else if (r >= 2) after.up2.push(f5);
    if (x.company && x.bpy < 300 && i % 5 === 0) sigmaPool.any.push(f5); }
  if (x.company && x.bpy < 300) { sigmaPool.down2.push(...after.down2); sigmaPool.up2.push(...after.up2); }
  rec.sigma = { today_ratio: r4(x.ratio[T]), down2: summarise(after.down2), up2: summarise(after.up2) };
  for (const k of ["down2", "up2"]) for (const kk of ["up", "median", "q25", "q75"]) rec.sigma[k][kk] = r4(rec.sigma[k][kk]);
  out.symbols[x.sym] = rec;
}

/* ── universe tables ─────────────────────────────────────────────────────────────────────────────── */
const syms = Object.keys(out.symbols); const comp = syms.filter((s) => !out.symbols[s].fund); const funds = syms.filter((s) => out.symbols[s].fund && s !== "BTCUSD");
const med = (a) => { const s = a.filter((v) => v != null && Number.isFinite(v)).sort((p, q) => p - q); return s.length ? r4(quantile(s, 0.5)) : null; };
const iqr = (a) => { const s = a.filter((v) => v != null && Number.isFinite(v)).sort((p, q) => p - q); return s.length ? [r4(quantile(s, 0.25)), r4(quantile(s, 0.75))] : null; };
const calib = {};
for (const f of Object.keys(FAM)) {
  calib[f] = {};
  for (const [grp, list] of [["companies", comp], ["funds", funds]]) {
    const g = {};
    for (const k of ["fixed", "p3y", "pall", "z3y", "sig"]) {
      const sh = list.map((s) => out.symbols[s].oos[f].last3y[k]?.share).filter((v) => v != null);
      const shf = list.map((s) => out.symbols[s].oos[f].full[k]?.share).filter((v) => v != null);
      if (!sh.length) continue;
      g[k] = { names: sh.length, median_share_last3y: med(sh), iqr_last3y: iqr(sh), median_share_full: med(shf), iqr_full: iqr(shf),
        never_last3y: list.filter((s) => out.symbols[s].oos[f].last3y[k] && out.symbols[s].oos[f].last3y[k].d === 0).length };
    }
    calib[f][grp] = g;
  }
}
out.calibration = calib;
const neverFixed30 = syms.filter((s) => out.symbols[s].oos.rsi_low.last3y.fixed && out.symbols[s].oos.rsi_low.last3y.fixed.d === 0 && out.symbols[s].oos.rsi_low.last3y.days > 200);
out.never30 = { count: neverFixed30.length, funds: neverFixed30.filter((s) => out.symbols[s].fund).length,
  rows: neverFixed30.map((s) => { const o = out.symbols[s].oos.rsi_low.last3y; return { sym: s, fund: out.symbols[s].fund, days: o.days, p3y_days: o.p3y.d, p3y_episodes: o.p3y.e, pall_days: o.pall.d, z_days: o.z3y.d, sig_days: o.sig.d, line_today: out.symbols[s].lines.rsi["3y"]?.q10 }; })
    .sort((a, b) => (b.fund - a.fund) || a.sym.localeCompare(b.sym)) };
const never1y = syms.filter((s) => { const o = out.symbols[s].oos.rsi_low.last1y; return o.fixed && o.fixed.d === 0 && o.days > 200; });
out.never30_1y = { count: never1y.length, funds: never1y.filter((s) => out.symbols[s].fund).length, companies: never1y.filter((s) => !out.symbols[s].fund).length,
  rows: never1y.map((s) => { const o = out.symbols[s].oos.rsi_low.last1y; return { sym: s, fund: out.symbols[s].fund, days: o.days, p3y_days: o.p3y.d, p3y_episodes: o.p3y.e, z_days: o.z3y.d, sig_days: o.sig.d, line_today: out.symbols[s].lines.rsi["3y"]?.q10, rsi_min_1y: out.symbols[s].today.rsi_min_1y }; })
    .sort((a, b) => (b.fund - a.fund) || a.sym.localeCompare(b.sym)) };
out.never70 = syms.filter((s) => out.symbols[s].oos.rsi_high.last3y.fixed && out.symbols[s].oos.rsi_high.last3y.fixed.d === 0 && out.symbols[s].oos.rsi_high.last3y.days > 200);
out.rsi_wr = { companies_median: med(comp.map((s) => out.symbols[s].rsi_wr_spearman)), companies_iqr: iqr(comp.map((s) => out.symbols[s].rsi_wr_spearman)),
  funds_median: med(funds.map((s) => out.symbols[s].rsi_wr_spearman)), min: r4(Math.min(...syms.map((s) => out.symbols[s].rsi_wr_spearman ?? 1))) };

/* leader-relative pullbacks: triggers by leader class, split discover (2003–2016) / confirm (2017–) */
const cls = (p) => p == null ? null : p >= 200 / 3 ? "leader" : p <= 100 / 3 ? "laggard" : "middle";
const agg = (rows) => { const s20 = summarise(rows.map((r) => r.ret20)), s60 = summarise(rows.map((r) => r.ret60)); const rg = rows.filter((r) => r.regained != null);
  return { n: rows.length, months: new Set(rows.map((r) => r.date?.slice(0, 7))).size, up20: r4(s20.up), med20: r4(s20.median), up60: r4(s60.up), med60: r4(s60.median),
    q25_60: r4(s60.q25), q75_60: r4(s60.q75), regained60: rg.length ? r4(100 * rg.filter((r) => r.regained).length / rg.length) : null,
    mae60_med: r4(summarise(rows.map((r) => r.mae)).median), ret60u_med: r4(summarise(rows.map((r) => r.ret60u)).median), maeu_med: r4(summarise(rows.map((r) => r.maeu)).median),
    ud_med: r4(summarise(rows.map((r) => r.ud)).median) }; };
const trig = {};
for (const key of ["own", 5, 10, 20, 30]) for (const c of ["leader", "middle", "laggard"]) {
  const rows = pooledTrig.filter((r) => (key === "own" ? r.kind === "own" : r.kind === "fixed" && r.level === key) && cls(r.lead) === c);
  trig[`${key}|${c}`] = { all: agg(rows), discover: agg(rows.filter((r) => r.year <= 2016)), confirm: agg(rows.filter((r) => r.year >= 2017)) };
}
const base = {}; for (const c of ["leader", "middle", "laggard"]) { const rows = pooledBase.filter((r) => cls(r.lead) === c);
  base[c] = { all: agg(rows), discover: agg(rows.filter((r) => r.year <= 2016)), confirm: agg(rows.filter((r) => r.year >= 2017)) }; }
out.leader_pullbacks = { triggers: trig, baseline_every_5th_session: base, trigger_count: pooledTrig.length,
  note: "trigger = first close in an episode (high at or above its 200-day) at the stated depth below the running high; 'own' = the name's median completed pullback depth from episodes that ended before the trigger (≥ 5 needed). Leader = top third of companies by 120-session return minus SPY's on that day; laggard = bottom third. Survivors only; one selloff triggers many names at once, so 'months' shows how many distinct calendar months the triggers come from." };
out.sigma_pool = { down2: summarise(sigmaPool.down2), up2: summarise(sigmaPool.up2), any_every5th: summarise(sigmaPool.any) };
for (const k of Object.keys(out.sigma_pool)) for (const kk of ["up", "median", "q25", "q75"]) out.sigma_pool[k][kk] = r4(out.sigma_pool[k][kk]);

/* ── breadth and rotation (companies; equal weight; moves clipped at ±40% so a bad print cannot move a cohort) ── */
const dates = SPY.dates; const N = dates.length;
const series = (x, key) => { const m = new Map(x.dates.map((d, i) => [d, i])); return (d) => { const i = m.get(d); return i == null ? null : x[key][i] ?? null; }; };
const compX = comp.map((s) => S[s]).filter((x) => x.bpy < 300);
const idxMaps = new Map(compX.map((x) => [x.sym, new Map(x.dates.map((d, i) => [d, i]))]));
const above = { d200: new Array(N).fill(null), d50: new Array(N).fill(null), n: new Array(N).fill(0) };
for (let k = 0; k < N; k++) { let a2 = 0, a5 = 0, n2 = 0, n5 = 0; const d = dates[k];
  for (const x of compX) { const i = idxMaps.get(x.sym).get(d); if (i == null) continue; if (x.s200[i] != null) { n2++; if (x.c[i] >= x.s200[i]) a2++; } if (x.s50[i] != null) { n5++; if (x.c[i] >= x.s50[i]) a5++; } }
  if (n2 >= 100) above.d200[k] = 100 * a2 / n2; if (n5 >= 100) above.d50[k] = 100 * a5 / n5; above.n[k] = n2; }
const pctToday = (arr, len) => { const T = N - 1; const a = []; for (let k = Math.max(0, T - len); k < T; k++) if (arr[k] != null) a.push(arr[k]); return a.length >= 30 ? r4(percentileOf(a, arr[T])) : null; };
out.breadth = { date: dates[N - 1], above200: r4(above.d200[N - 1]), above50: r4(above.d50[N - 1]), names: above.n[N - 1],
  above200_p3y: pctToday(above.d200, 756), above200_pall: pctToday(above.d200, Infinity), above50_p3y: pctToday(above.d50, 756), above50_pall: pctToday(above.d50, Infinity),
  above200_5d_ago: r4(above.d200[N - 6]), above50_5d_ago: r4(above.d50[N - 6]), first_date: dates[above.d200.findIndex((v) => v != null)] };
function cohortIndex(members) {
  const xs = members.map((m) => S[m]).filter((x) => x && x.bpy < 300); const lvl = new Array(N).fill(null); let L = 100; let started = false;
  for (let k = 1; k < N; k++) { const d = dates[k]; const mv = [];
    for (const x of xs) { const i = idxMaps.get(x.sym)?.get(d) ?? (x.fund ? null : null); if (i == null || x.mv[i] == null) continue; mv.push(Math.max(-40, Math.min(40, x.mv[i]))); }
    if (mv.length >= Math.max(2, Math.ceil(xs.length * 0.5))) { L *= 1 + mv.reduce((a, b) => a + b, 0) / mv.length / 100; started = true; lvl[k] = L; } else if (started) lvl[k] = L; }
  return { lvl, members: xs.length };
}
const ret = (lvl, k, h) => lvl[k] != null && lvl[k - h] != null ? (lvl[k] / lvl[k - h] - 1) * 100 : null;
const spyL = SPY.c.slice(); const T0 = N - 1;
function cohortRow(id, label, members) {
  const { lvl, members: n } = cohortIndex(members);
  const rel20 = lvl.map((v, k) => k >= 20 && v != null && lvl[k - 20] != null ? ret(lvl, k, 20) - ret(spyL, k, 20) : null);
  const k0 = lvl.findIndex((v) => v != null); const rsiC = new Array(N).fill(null);
  if (k0 >= 0) rsiWilder(lvl.slice(k0), 14).forEach((v, j) => { rsiC[k0 + j] = v; });
  const p3 = []; for (let k = Math.max(0, T0 - 756); k < T0; k++) if (rel20[k] != null) p3.push(rel20[k]);
  const r3 = []; for (let k = Math.max(0, T0 - 756); k < T0; k++) if (rsiC[k] != null) r3.push(rsiC[k]);
  let a50 = 0, n50 = 0; for (const m of members) { const x = S[m]; if (!x || x.bpy > 300) continue; const T = x.c.length - 1; if (x.dates[T] !== dates[T0] || x.s50[T] == null) continue; n50++; if (x.c[T] >= x.s50[T]) a50++; }
  return { id, label, members: n, r5: r4(ret(lvl, T0, 5)), r20: r4(ret(lvl, T0, 20)), r60: r4(ret(lvl, T0, 60)),
    rel5: r4(ret(lvl, T0, 5) - ret(spyL, T0, 5)), rel20: r4(rel20[T0]), rel60: r4(ret(lvl, T0, 60) - ret(spyL, T0, 60)),
    rel20_p3y: p3.length >= 250 && rel20[T0] != null ? r4(percentileOf(p3, rel20[T0])) : null,
    rsi: r4(rsiC[T0]), rsi_p3y: r3.length >= 250 && rsiC[T0] != null ? r4(percentileOf(r3, rsiC[T0])) : null, above50: n50 ? r4(100 * a50 / n50) : null };
}
out.rotation = { date: dates[T0], spy: { r5: r4(ret(spyL, T0, 5)), r20: r4(ret(spyL, T0, 20)), r60: r4(ret(spyL, T0, 60)) },
  cohorts: BRANCHES.filter((b) => b.members.length >= 3).map((b) => cohortRow(b.id, b.label, b.members)).sort((a, b) => (b.rel20 ?? -1e9) - (a.rel20 ?? -1e9)),
  ai_complex: cohortRow("AI_COMPLEX", "the AI complex: " + AI_BRANCHES.join(", "), [...new Set(AI_BRANCHES.flatMap((id) => BRANCHES.find((b) => b.id === id)?.members || []))]) };
{ // the AI complex's own readings, for the AI-cycle context line (context only; the state is Alan's to set)
  const ai = [...new Set(AI_BRANCHES.flatMap((id) => BRANCHES.find((b) => b.id === id)?.members || []))].filter((s) => out.symbols[s] && !out.symbols[s].fund);
  const rp = ai.map((s) => out.symbols[s].today.rsi.p3y).filter((v) => v != null);
  out.rotation.ai_complex.names = ai.length; out.rotation.ai_complex.median_rsi_p3y = med(rp);
  out.rotation.ai_complex.at_or_below_own_p10 = ai.filter((s) => out.symbols[s].today.rsi.p3y != null && out.symbols[s].today.rsi.p3y <= 10);
  out.rotation.ai_complex.at_or_above_own_p90 = ai.filter((s) => out.symbols[s].today.rsi.p3y != null && out.symbols[s].today.rsi.p3y >= 90);
  out.rotation.ai_complex.leaders_top_third = ai.filter((s) => (out.symbols[s].today.lead ?? 0) >= 200 / 3).length;
}

/* ── S6: per-name run-up into the report, for the names reporting inside 20 sessions (read from the S6 branch output) ── */
if (S6 && fs.existsSync(S6)) {
  const j = JSON.parse(fs.readFileSync(S6, "utf8")); out.s6 = { built_utc: j.built_utc, source_file: path.basename(S6), names: {} };
  for (const [s, v] of Object.entries(j.symbols || {})) { if (!v.events?.length) continue;
    const ev = v.events.map((e) => e.runup_pct), sd = v.events.map((e) => e.runup_sd), d1 = v.events.map((e) => e.day_pct);
    const a = summarise(ev), b = summarise(sd), c = summarise(d1);
    out.s6.names[s] = { reports: v.events.length, runup_up: r4(a.up), runup_med: r4(a.median), runup_q25: r4(a.q25), runup_q75: r4(a.q75), runup_sd_med: r4(b.median), day_up: r4(c.up), day_med: r4(c.median) }; }
  out.s6.pooled = j.pooled?.universe?.summary?.runup?.pct ?? null;
}

fs.writeFileSync(path.join(here, "data", "levels-v3.json"), JSON.stringify(out));
const s = out.symbols;
console.log(`names ${syms.length} (companies ${comp.length}, funds ${funds.length}, +BTCUSD ${s.BTCUSD ? "yes" : "no"}), missing ${missing.map((m) => m.sym).join(",") || "none"}; ` +
  `fixed RSI 30 never fired in the last 3y for ${out.never30.count} (${out.never30.funds} funds); pullback triggers ${pooledTrig.length}; bytes ${fs.statSync(path.join(here, "data", "levels-v3.json")).size}`);
