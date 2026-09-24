/* CLAUDE CHECK BUILDS · M60 — the one place that fetches.
   Five small builds need one pass over the bars the Hub already holds. That pass is far too much
   for a page load (364 names and a year and a half of rungs), so it is measured here and written
   to data/claude-check/ with the time it was measured and the exact request it came from. The
   page reads those files, so a stale reading looks stale instead of looking current.

   Reads only: the chart API, never a write, never another provider.
     node scripts/claude-check-snapshot.mjs [--limit N] [--waits-sample N] [--out data/claude-check]
*/
import fs from "node:fs";
import path from "node:path";
import {
  participationBySession, weekly, peakLine, bollWidth, squeezeState, unfinishedWicks,
  railState, oversoldExitSignals, measureWaits, verdictFor, verdictPair, median,
} from "../lib/claude-check-builds.mjs";

const API = process.env.SC_CHART_API || "https://scintilla-massive-chart-api.fly.dev";
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg("--out", "data/claude-check");
const LIMIT = +arg("--limit", 0) || 0;
const WAITS_SAMPLE = +arg("--waits-sample", 24);
const CONC = +arg("--concurrency", 6);
const DAILY_BARS = +arg("--daily-bars", 1500);
/* How long a wick has to be before it is worth keeping, measured in the bar's own recent range.
   Set at 1x because that is what it takes for a DAILY bar to hold the example Alan named — the
   SPY print on 26 June is 1.22x its own range on the daily chart, because an intraday spike is
   half-erased by the time the day closes. Every row carries its own multiple, so the bar can be
   raised without re-measuring anything. */
const WICK_MIN = +arg("--wick-atr", 1);
const RULES = JSON.parse(fs.readFileSync("data/claude-check-rules.json", "utf8")).rules;

/* the Hub's own macro rail, copied from index.html's MACRO_SET so the two cannot drift */
const RAILS = ["SPY", "QQQ", "IWM", "SMH", "GLD", "TLT", "NVDA", "COIN"];
const COMPARE = ["SPY", "RSP"];                 // the equal-weight / cap-weight pair
const RUNGS = ["2h", "3h", "4h", "6h", "12h", "1d", "3d", "1w"];
const log = (s) => process.stderr.write(s + "\n");

async function getJSON(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { last = e; await new Promise((s) => setTimeout(s, 500 * (i + 1))); }
  }
  throw last;
}
const candles = async (sym, tf, limit) => {
  const j = await getJSON(`${API}/candles?symbol=${encodeURIComponent(sym)}&tf=${tf}&limit=${limit}`);
  const s = Array.isArray(j.series) ? j.series : [];
  return s.map((b) => ({ t: +b.t, o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: +b.v,
    session: new Date(+b.t).toISOString().slice(0, 10) }));
};
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: String(e.message || e) }; } }
  }));
  return out;
}

/* ---- the daily pass: one request per name, four measures out of it --------------------- */
const tally = new Map();                       // session -> {above, of}  (participation)
const squeezes = [], unfinished = [], breadthRows = [], failures = [];

function feedParticipation(bars) {
  const closes = bars.map((b) => +b.c), sessions = bars.map((b) => b.session);
  for (const row of participationBySession([{ closes, sessions }])) {
    const t = tally.get(row.session) || { above: 0, of: 0 };
    t.above += row.above; t.of += row.of; tally.set(row.session, t);
  }
}

async function measureName(sym) {
  const bars = await candles(sym, "1d", DAILY_BARS);
  if (bars.length < 60) { failures.push({ sym, why: "TOO_SHORT", bars: bars.length }); return; }
  feedParticipation(bars);
  const closes = bars.map((b) => +b.c), sessions = bars.map((b) => b.session);
  const sq = squeezeState(bollWidth(closes), sessions, { lookback: 252 });
  if (sq.width != null) squeezes.push({ sym, ...sq });
  for (const lv of unfinishedWicks(bars, { minWickAtr: WICK_MIN, maxAgeBars: 180 }).slice(0, 4)) unfinished.push({ sym, ...lv });
  const st = railState(bars);
  breadthRows.push({ sym, session: bars[bars.length - 1].session, close: st.close,
    above50: st.above50, above200: st.above200, day_pct: st.day_pct, bars: bars.length });
}

/* ---- waiting time per rung: counted on our own bars ------------------------------------ */
async function measureRung(rung, syms) {
  const per = await pool(syms, CONC, async (s) => {
    const bars = await candles(s, rung, 1200);
    if (bars.length < 120) return { sym: s, skip: "TOO_SHORT", bars: bars.length };
    const r = measureWaits(bars, { signalAt: oversoldExitSignals(bars), moveAtr: 1, horizonBars: 40 });
    return { sym: s, ...r, first: bars[0].session, last: bars[bars.length - 1].session };
  });
  const good = per.filter((p) => p && !p.skip && !p.error);
  const days = good.flatMap((p) => p.days);
  const n = good.reduce((s, p) => s + p.n, 0), hits = good.reduce((s, p) => s + p.hits, 0);
  const q = (p) => { const a = days.slice().sort((x, y) => x - y); if (!a.length) return null;
    const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo); };
  return {
    rung, n, hits, hit_rate: n ? hits / n : null, names: good.length,
    median_days: median(days), p25_days: q(0.25), p75_days: q(0.75), min_n: 30,
    window: good.length ? `${good[0].first} → ${good[0].last}, ${good.length} names` : null,
    how: "the reading leaves oversold (RSI 14 Wilder crosses back above 30) on that rung's own bars, then the first bar that traded one of that rung's own usual bars (20-bar true range) above the signal close, within 40 bars",
    target_basis: good[0]?.target_basis ?? null,
    why: good.length ? null : "no rung bars long enough to count",
  };
}

/* ---- run ------------------------------------------------------------------------------- */
const t0 = Date.now();
const u = await getJSON(API + "/universe");
let syms = Array.isArray(u.symbols) ? u.symbols : [];
if (LIMIT) syms = syms.slice(0, LIMIT);
log(`daily pass: ${syms.length} names, ${DAILY_BARS} bars each…`);
await pool(syms, CONC, async (s) => { try { await measureName(s); } catch (e) { failures.push({ sym: s, why: String(e.message || e) }); } });
log(`daily pass done in ${Math.round((Date.now() - t0) / 1000)}s · ${failures.length} failures`);

/* the indexes the page compares against, measured exactly the same way */
const refs = {};
for (const s of [...new Set([...RAILS, ...COMPARE])]) {
  try {
    const bars = await candles(s, "1d", DAILY_BARS);
    const closes = bars.map((b) => +b.c), sessions = bars.map((b) => b.session);
    refs[s] = {
      rail: railState(bars),
      squeeze: squeezeState(bollWidth(closes), sessions, { lookback: 252 }),
      unfinished: unfinishedWicks(bars, { minWickAtr: WICK_MIN, maxAgeBars: 180 }).slice(0, 6),
      weekly_close: weekly(bars.map((b) => ({ session: b.session, pct: +b.c, of: 1 }))).map((w) => ({ week: w.week, close: w.pct })),
      spark: bars.slice(-60).map((b) => +b.c),
      first: bars[0]?.session, last: bars[bars.length - 1]?.session, bars: bars.length,
    };
  } catch (e) { refs[s] = { error: String(e.message || e) }; }
}
log(`reference names: ${Object.keys(refs).filter((k) => !refs[k].error).join(" ")}`);

/* participation, weekly, with the peaks line */
const daily = [...tally.entries()].map(([session, t]) => ({ session, above: t.above, of: t.of, pct: (100 * t.above) / t.of }))
  .sort((a, b) => a.session.localeCompare(b.session));
const wk = weekly(daily, { minOf: Math.max(50, Math.round(syms.length * 0.5)) });
const since2023 = wk.filter((w) => w.week >= "2023-01-01");
const peaks = peakLine(since2023, { span: 6 });

/* geiger, saved against the plain baseline (equal weight on every rung) */
let geiger = { error: null };
try {
  const g = await getJSON(API + "/geiger");
  const comps = Object.values(g.symbols || {}).map((s) => s.composite).filter(Number.isFinite);
  const detailSyms = syms.slice(0, 60);
  const det = await getJSON(`${API}/geiger?symbols=${detailSyms.join(",")}&detail=1`);
  const pairs = [];
  for (const [sym, row] of Object.entries(det.symbols || {})) {
    const rungs = Object.values(row.rungs || {}).filter((r) => Number.isFinite(r.tf_composite));
    if (!rungs.length || !Number.isFinite(row.composite)) continue;
    pairs.push({ sym, saved: row.composite, baseline: rungs.reduce((s, r) => s + r.tf_composite, 0) / rungs.length, rungs: rungs.length });
  }
  geiger = {
    completed_session_et: g.verification?.completed_session_et ?? null,
    computed_utc: g.computed_utc ?? null,
    label: g.verification?.label ?? null,
    blocking_issue_count: g.verification?.blocking_issue_count ?? null,
    universe: comps.length,
    median_composite: median(comps),
    positive: comps.filter((c) => c > 0).length,
    participating_rungs: (g.participating_rungs || []).map((r) => ({ rung: r.equalizer_key, weight: r.weight })),
    baseline_sample: pairs.length,
    median_saved: median(pairs.map((p) => p.saved)),
    median_baseline: median(pairs.map((p) => p.baseline)),
    biggest_gaps: pairs.map((p) => ({ ...p, gap: p.saved - p.baseline }))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 8),
  };
} catch (e) { geiger = { error: String(e.message || e) }; }

/* waiting time per rung */
const sample = syms.slice(0, WAITS_SAMPLE);
const waits = {};
for (const r of RUNGS) { waits[r] = await measureRung(r, sample); log(`rung ${r}: ${waits[r].n} signals, middle ${waits[r].median_days == null ? "—" : Math.round(waits[r].median_days * 10) / 10} days`); }

/* ---- the verdict cards, built here so the page only draws ----------------------------- */
const cur = breadthRows.filter((r) => r.session === (function () {
  const c = new Map(); for (const r of breadthRows) c.set(r.session, (c.get(r.session) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
})());
const pctTrue = (k) => { const have = cur.filter((r) => r[k] !== null); return have.length ? (100 * have.filter((r) => r[k]).length) / have.length : null; };
const b50 = pctTrue("above50"), b200 = pctTrue("above200");
const cards = [
  { key: "geiger", title: "GEIGER", ...verdictPair(
      { saved: geiger.median_saved ?? geiger.median_composite, baseline: geiger.median_baseline,
        saved_basis: "Alan's saved Equalizer weights", baseline_basis: "baseline: every rung, equal weight" }, RULES.geiger_market),
    rows: [
      ["Names read", geiger.universe == null ? "—" : String(geiger.universe)],
      ["Reading positive", geiger.positive == null ? "—" : `${geiger.positive} of ${geiger.universe}`],
      ["Completed session", geiger.completed_session_et ?? "—"],
    ],
    spark: null,
    spark_missing: "the Geiger artifact is published as one reading at a time; nothing on the Hub keeps yesterday's, so there is no line to draw yet" },
  { key: "breadth50", title: "BREADTH · 50-DAY", ...verdictPair(
      { saved: b50, baseline: b50, saved_basis: "measured on our 364", baseline_basis: "no toggle: this is the plain count" }, RULES.breadth_above50),
    rows: [
      ["Names counted", String(cur.length)],
      ["Above their 50-day", b50 == null ? "—" : `${Math.round(b50 * 10) / 10}%`],
      ["Session", cur[0]?.session ?? "—"],
    ],
    spark: daily.slice(-60).map((d) => Math.round(d.pct * 10) / 10) },
  { key: "breadth200", title: "BREADTH · 200-DAY", ...verdictPair(
      { saved: b200, baseline: b200, saved_basis: "measured on our 364", baseline_basis: "no toggle: this is the plain count" }, RULES.breadth_above200),
    rows: [
      ["Names counted", String(cur.length)],
      ["Above their 200-day", b200 == null ? "—" : `${Math.round(b200 * 10) / 10}%`],
      ["Session", cur[0]?.session ?? "—"],
    ],
    spark: daily.slice(-60).map((d) => Math.round(d.pct * 10) / 10) },
  ...RAILS.map((s) => ({
    key: "rail_" + s, title: "RAIL · " + s,
    ...verdictPair({ saved: refs[s]?.rail?.distance50_pct, baseline: refs[s]?.rail?.distance50_pct,
      saved_basis: "its own 50-day average", baseline_basis: "no toggle: one average, one price" }, RULES.rail_distance50),
    rows: [
      ["Close", refs[s]?.rail?.close == null ? "—" : String(Math.round(refs[s].rail.close * 100) / 100)],
      ["Day", refs[s]?.rail?.day_pct == null ? "—" : `${Math.round(refs[s].rail.day_pct * 100) / 100}%`],
      ["Above its 200-day", refs[s]?.rail?.above200 == null ? "—" : refs[s].rail.above200 ? "yes" : "no"],
    ],
    day_pct: refs[s]?.rail?.day_pct ?? null,
    spark: refs[s]?.spark ?? null,
    spark_missing: refs[s]?.spark ? null : "this rail's bars could not be read",
  })),
];

const manifest = {
  schema: "scintilla.claude_check_builds.v1",
  measured_utc: new Date().toISOString(),
  took_s: Math.round((Date.now() - t0) / 1000),
  source: `${API}/candles?tf=1d&limit=${DAILY_BARS} · one request per name; ${API}/geiger; ${API}/geiger?detail=1`,
  universe: u.count ?? syms.length, universe_sha256: u.universe_sha256 || null,
  names_measured: breadthRows.length, failures,
  rules_version: JSON.parse(fs.readFileSync("data/claude-check-rules.json", "utf8")).version,
};
fs.mkdirSync(OUT, { recursive: true });
const write = (f, o) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(o, null, 1) + "\n");
write("manifest.json", manifest);
write("verdicts.json", { manifest, cards, geiger });
write("participation.json", {
  manifest, daily_points: daily.length, weekly: since2023, all_weekly_from: wk[0]?.week ?? null,
  peaks: { n: peaks.peaks.length, direction: peaks.direction ?? null, reason: peaks.reason ?? null,
    slope_per_year: peaks.line?.slope_per_year ?? null, says: peaks.says ?? null,
    points: peaks.peaks.map((p) => ({ week: p.week, pct: Math.round(p.pct * 10) / 10 })),
    line_points: peaks.line ? since2023.map((w) => ({ week: w.week, pct: Math.round(peaks.line.at(w.week) * 100) / 100 })) : [] },
  compare: Object.fromEntries(COMPARE.map((s) => [s, refs[s]?.weekly_close ? refs[s].weekly_close.filter((w) => w.week >= "2023-01-01") : { error: refs[s]?.error ?? "not fetched" }])),
  note: "the 364 names the Hub holds are not the S&P 500: they are Alan's universe, cap-weighted by nothing — every name counts once",
});
write("squeeze.json", {
  manifest, lookback_sessions: 252, tight_threshold_pctile: 5,
  names: squeezes.filter((s) => s.pctile != null).sort((a, b) => a.pctile - b.pctile).slice(0, 40),
  not_ranked: squeezes.filter((s) => s.pctile == null).map((s) => ({ sym: s.sym, lookback: s.lookback, says: s.says })),
  candidates: squeezes.filter((s) => s.candidate).length, measured: squeezes.filter((s) => s.pctile != null).length,
  min_history_to_rank: 120,
  indexes: Object.fromEntries(RAILS.map((s) => [s, refs[s]?.squeeze ?? { error: refs[s]?.error }])),
});
write("unfinished.json", {
  manifest,
  rule: `a wick at least ${WICK_MIN}x the bar's own recent true range (20 bars), where nothing has traded back through the middle of that wick since`,
  how_rare: [1, 1.25, 1.5, 2, 3].map((k) => ({ threshold: k, levels: unfinished.filter((l) => l.wick_atr >= k).length })),
  intraday: "not measured: /candles serves about a day of minute bars however the range is asked for, so the 3:59 PM print on 26 June can only be seen here as that day's daily low",
  levels: unfinished.sort((a, b) => b.t - a.t).slice(0, 120), total_found: unfinished.length,
  indexes: Object.fromEntries(RAILS.map((s) => [s, refs[s]?.unfinished ?? []])),
});
write("waits.json", { manifest, rungs: waits, sample_names: sample,
  rule_of_thumb_source: "@asklivermore, 23 Sep bookmark: 4-hour 4–10 days, daily 8–20 days, weekly 2–5 months" });
log(`wrote ${OUT}/{manifest,verdicts,participation,squeeze,unfinished,waits}.json in ${manifest.took_s}s`);
