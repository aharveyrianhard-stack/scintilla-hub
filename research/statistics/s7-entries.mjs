/* S7 · DOES A BETTER ENTRY INSIDE THE PRE-REPORT WINDOW RAISE THE ODDS? (descriptive, prior bars only)
   Alan, 27 Sep: "If we use the rest of the indicators to find an actual entry throughout the period — a better
   entry — does that give more edge? … support or a resistance, a moving average and an RSI of X … parallel channels."

   For every report the S6 study measures (runupStudy, unchanged), the 20 candidate entry closes are the window
   start (the S6 entry) and the 19 closes after it; the trade enters at the FIRST close where the trigger (or
   every trigger of a pair / triple, on the same session) is true, and exits at the last close before the report
   (primary), at the report session's close and five sessions after it (secondary). Triggers: entries.mjs.
   The same trigger is run on ordinary 20-session windows of the same name: window starts every 5th session
   between the name's first and last listed report, keeping only windows whose sessions s0+1 … s0+26 hold no
   report session (so neither the exit nor the secondary exits touch a report).
   Discover = reports dated 2003–2016 (ordinary windows starting then), confirm = 2017 onward.

   node research/statistics/s7-entries.mjs --cache <dir>
   Writes data/s7-entries.json. Survivors only (today's universe). Nothing predicts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { runupStudy, reportTiming, reportSession, usualDay, spread } from "./stats.mjs";
import { SINGLE, BIT, triggerFlags, nextFire, tradeFor, wilson } from "./entries.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const CACHE = args.includes("--cache") ? args[args.indexOf("--cache") + 1] : null;
if (!CACHE) { console.error("--cache <dir> is required"); process.exit(2); }
const SPLIT_YEAR = 2017, MIN_TRADES = 200;

const earnings = JSON.parse(fs.readFileSync(path.join(here, "data/earnings-export-with-estimates-20260926.json"), "utf8"));
const byTicker = new Map();
for (const r of earnings) { if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []); byTicker.get(r.ticker).push(r); }
const tOf = (b) => { const x = b.t ?? b.time ?? b.ts ?? b.timestamp; return x < 1e11 ? x * 1000 : x; };
const day = (b) => new Date(tOf(b)).toISOString().slice(0, 10);

/* Singles, then every pair and triple drawn from DIFFERENT families (two RSI levels together say nothing new). */
const combos = [{ key: "window start (S6 baseline)", parts: [], mask: 0 }];
for (const s of SINGLE) combos.push({ key: s.key, parts: [s.key], mask: BIT[s.key] });
for (let a = 0; a < SINGLE.length; a++) for (let b = a + 1; b < SINGLE.length; b++) {
  if (SINGLE[a].fam === SINGLE[b].fam) continue;
  combos.push({ key: `${SINGLE[a].key} + ${SINGLE[b].key}`, parts: [SINGLE[a].key, SINGLE[b].key], mask: BIT[SINGLE[a].key] | BIT[SINGLE[b].key] });
  for (let c = b + 1; c < SINGLE.length; c++) {
    if (SINGLE[c].fam === SINGLE[a].fam || SINGLE[c].fam === SINGLE[b].fam) continue;
    combos.push({ key: `${SINGLE[a].key} + ${SINGLE[b].key} + ${SINGLE[c].key}`, parts: [SINGLE[a].key, SINGLE[b].key, SINGLE[c].key],
      mask: BIT[SINGLE[a].key] | BIT[SINGLE[b].key] | BIT[SINGLE[c].key] });
  }
}
const PERIODS = ["all", "discover", "confirm"];
const acc = combos.map(() => Object.fromEntries(["report", "ordinary"].flatMap((g) => PERIODS.map((p) => [`${g}:${p}`,
  { windows: 0, primary: [], primary_sd: [], reportDay: [], after5: [], wait: [], held: [], base_same: [], names: new Set() }]))));

let names = 0, reportWindows = 0, ordinaryWindows = 0; const missing = [];
for (const [t, reps] of byTicker) {
  const f = path.join(CACHE, t + ".json");
  const raw = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  if (!raw || raw.length < 400) { missing.push(t); continue; }
  const bars = raw.map((b) => ({ t: tOf(b), h: +b.h, l: +b.l, c: +b.c }));
  const st = runupStudy(bars, reps);
  if (!st.reports_used) continue;
  names++;
  const seg = bars.filter((b) => day(b) >= st.analysis_start);          // the same segment runupStudy measured
  const closes = seg.map((b) => b.c), dates = seg.map(day), idx = new Map(dates.map((d, i) => [d, i]));
  const usual = usualDay(closes, 60);
  const { flags } = triggerFlags(seg);
  const nf = combos.map((c) => nextFire(flags, c.mask));

  const windows = [];
  for (const e of st.events) {
    const s0 = idx.get(e.runup_from), r = idx.get(e.session);
    if (s0 == null || r == null || r - 1 - s0 !== 20) continue;
    windows.push({ g: "report", s0, scale: e.usual_day, period: +e.date.slice(0, 4) < SPLIT_YEAR ? "discover" : "confirm", base: e.runup_pct });
  }
  reportWindows += windows.length;
  // every listed report's news session, measured or not, fences the ordinary windows
  const rs = [];
  for (const rep of reps) { const d = String(rep.date).slice(0, 10); const r = reportSession(dates, d, reportTiming(rep.report_time).rule); if (r != null) rs.push(r); }
  rs.sort((a, b) => a - b);
  if (rs.length) {
    for (let s0 = Math.max(rs[0], 60); s0 + 26 < closes.length && s0 <= rs[rs.length - 1]; s0 += 5) {
      if (rs.some((r) => r > s0 && r <= s0 + 26) || !(usual[s0] > 0)) continue;
      windows.push({ g: "ordinary", s0, scale: usual[s0], period: +dates[s0].slice(0, 4) < SPLIT_YEAR ? "discover" : "confirm" });
      ordinaryWindows++;
    }
  }
  for (let ci = 0; ci < combos.length; ci++) {
    for (const w of windows) {
      for (const p of ["all", w.period]) {
        const a = acc[ci][`${w.g}:${p}`]; a.windows++;
        const tr = tradeFor(closes, w.s0, nf[ci][w.s0], w.scale);
        if (!tr) continue;
        a.primary.push(tr.primary); a.primary_sd.push(tr.primary_sd); a.wait.push(tr.wait); a.held.push(tr.held); a.names.add(t);
        if (w.g === "report") { a.reportDay.push(tr.reportDay); a.after5.push(tr.after5); a.base_same.push(w.base); }
      }
    }
  }
}

const r1 = (x) => x == null ? null : Math.round(x * 100) / 100;
function row(a, withSecondary) {
  const s = spread(a.primary), sd = spread(a.primary_sd);
  const out = { windows: a.windows, trades: s.n, fire_rate: a.windows ? r1(100 * s.n / a.windows) : null, names: a.names.size,
    share_up: r1(s.share_positive), ci95: wilson(s.positive, s.n).map(r1), median: r1(s.median), q25: r1(s.q25), q75: r1(s.q75),
    median_usual_days: r1(sd.median), median_wait: spread(a.wait).median, median_held: spread(a.held).median };
  if (withSecondary) {
    const rd = spread(a.reportDay), a5 = spread(a.after5), b = spread(a.base_same);
    out.to_report_close = { n: rd.n, share_up: r1(rd.share_positive), median: r1(rd.median), q25: r1(rd.q25), q75: r1(rd.q75) };
    out.to_five_after = { n: a5.n, share_up: r1(a5.share_positive), median: r1(a5.median), q25: r1(a5.q25), q75: r1(a5.q75) };
    out.same_reports_window_start = { share_up: r1(b.share_positive), median: r1(b.median) };
  }
  return out;
}
const rows = combos.map((c, ci) => ({ key: c.key, parts: c.parts, size: c.parts.length,
  report: Object.fromEntries(PERIODS.map((p) => [p, row(acc[ci][`report:${p}`], true)])),
  ordinary: Object.fromEntries(PERIODS.map((p) => [p, row(acc[ci][`ordinary:${p}`], false)])) }));

/* The confluence screen: chosen on DISCOVER only, then read on CONFIRM. */
const screen = (thr) => rows.filter((r) => r.size >= 2 && r.report.discover.trades >= MIN_TRADES && r.report.discover.share_up >= thr)
  .sort((a, b) => b.report.discover.share_up - a.report.discover.share_up)
  .map((r) => ({ key: r.key, discover: r.report.discover, confirm: r.report.confirm, ordinary_confirm: r.ordinary.confirm,
    held_up: r.report.confirm.trades >= MIN_TRADES && r.report.confirm.share_up >= thr }));
const allPeriod = (thr) => rows.filter((r) => r.size >= 2 && r.report.all.trades >= MIN_TRADES && r.report.all.share_up >= thr).map((r) => r.key);
/* Rules that clear 65% on discover but on fewer than MIN_TRADES trades: shown so nothing is hidden, never promoted. */
const small = rows.filter((r) => r.size >= 1 && r.report.discover.trades >= 50 && r.report.discover.trades < MIN_TRADES && r.report.discover.share_up >= 65)
  .sort((a, b) => b.report.discover.share_up - a.report.discover.share_up)
  .map((r) => ({ key: r.key, discover: r.report.discover, confirm: r.report.confirm }));
const out = {
  built_utc: new Date().toISOString(), study: "S7 entry confluence inside the 20 sessions before a report",
  names, report_windows: reportWindows, ordinary_windows: ordinaryWindows, combos_tested: combos.length - 1,
  split: { discover: `reports dated before ${SPLIT_YEAR}`, confirm: `reports dated ${SPLIT_YEAR} onward` }, min_trades: MIN_TRADES,
  triggers: SINGLE, rows,
  confluence: { at65: screen(65), at70: screen(70), all_period_at65: allPeriod(65), all_period_at70: allPeriod(70), small_samples_at65: small },
  missing_bars: missing,
  caveats: ["survivors only: today's universe", "a trade enters on the first qualifying close, so triggered trades are held fewer sessions than the window-start trade",
    "trades on the same dates across names move together; the 95% interval treats them as independent and is therefore too narrow",
    "178 rules were tried; with that many, some clear 65% by luck — read the confirm column", "descriptive; no prediction; no costs or slippage"],
};
fs.writeFileSync(path.join(here, "data/s7-entries.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ names, reportWindows, ordinaryWindows, combos: combos.length - 1, at65: out.confluence.at65.length, at70: out.confluence.at70.length, missing: missing.length }));
