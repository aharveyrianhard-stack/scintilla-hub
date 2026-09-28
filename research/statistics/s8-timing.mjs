/* S8 · step 1 · report timing. Writes a NEW export with a before-open / after-close time on every report it can
   place, then re-runs the S6 run-up both ways (old convention vs corrected) and writes data/s8-timing.json.
   FMP's calendar was the brief's first source; the key is not in this machine's environment, so every time
   that the export lacks is INFERRED from the opening gaps (ladder.mjs inferTiming) and flagged as inferred.
   node research/statistics/s8-timing.mjs [--cache-root <dir>]   (default: ~/Library/Application Support/scintilla/stats-cache) */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { runupStudy, spread } from "./stats.mjs";
import { seriesOf, segment, timeRows, inferTiming, r1, r2 } from "./ladder.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const ROOT = args.includes("--cache-root") ? args[args.indexOf("--cache-root") + 1] : path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const SRC = "data/earnings-export-with-estimates-20260926.json", DST = "data/earnings-export-timed-20260927.json";

export function loadBars(sym, root = ROOT) {
  const f5 = path.join(root, "candles-f5", sym + ".json"), s7 = path.join(root, "daily-bars-s7", sym + ".json");
  if (fs.existsSync(f5)) return JSON.parse(fs.readFileSync(f5, "utf8")).series;
  if (fs.existsSync(s7)) return JSON.parse(fs.readFileSync(s7, "utf8"));
  return null;
}

const rows = JSON.parse(fs.readFileSync(path.join(here, SRC), "utf8"));
const by = new Map();
for (const r of rows) { if (!by.has(r.ticker)) by.set(r.ticker, []); by.get(r.ticker).push(r); }
const out = [], check = { agree: 0, disagree: 0, ambiguous: 0, either: 0, examples: [] }, noBars = [];
const oldEv = [], newEv = [], perName = {};
for (const [t, reps] of by) {
  const raw = loadBars(t);
  if (!raw || raw.length < 400) { noBars.push(t); out.push(...reps.map((r) => ({ ...r, report_time_source: r.report_time ? "export" : "unknown (no bars)" }))); continue; }
  const S = seriesOf(segment(raw).bars);
  // validation on the reports whose time the export does carry
  for (const r of reps) if (r.report_time === "BMO" || r.report_time === "AMC") {
    const inf = inferTiming(S, r.date);
    if (inf.call === "either") check.either++;
    else if (inf.call === "BMO" || inf.call === "AMC") { if (inf.call === r.report_time) check.agree++; else { check.disagree++; if (check.examples.length < 12) check.examples.push({ t, date: r.date, export: r.report_time, inferred: inf.call, gapSame: inf.gapSame, gapNext: inf.gapNext }); } }
    else check.ambiguous++;
  }
  const timed = timeRows(S, reps);
  out.push(...timed.map(({ inferred_gap_same_ud, inferred_gap_next_ud, inferred_call, ...r }) => ({ ...r, inferred_gap_same_ud, inferred_gap_next_ud })));
  const happened = (xs) => xs.filter((r) => r.eps_actual != null);
  const a = runupStudy(raw, happened(reps).map((r) => ({ date: r.date, report_time: r.report_time }))), b = runupStudy(raw, happened(timed).map((r) => ({ date: r.date, report_time: r.report_time })));
  if (!a.enough && !b.enough) continue;
  const moved = b.events.filter((e) => { const o = a.events.find((x) => x.date === e.date); return o && o.session !== e.session; }).length;
  oldEv.push(...a.events.map((e) => ({ ...e, t }))); newEv.push(...b.events.map((e) => ({ ...e, t })));
  const sm = (ev) => ({ n: ev.length, runup_up: r1(spread(ev.map((e) => e.runup_pct)).share_positive), runup_med: r2(spread(ev.map((e) => e.runup_pct)).median),
    abs_day_med: r2(spread(ev.map((e) => Math.abs(e.day_pct))).median) });
  perName[t] = { old: sm(a.events), corrected: sm(b.events), moved, bmo_share: r1(100 * timed.filter((r) => r.report_time === "BMO").length / timed.length) };
}
const src = {}; for (const r of out) { const k = r.report_time_source.replace(/\(.*\)/, "").trim(); src[k] = (src[k] || 0) + 1; }
const T = (ev) => { const run = spread(ev.map((e) => e.runup_pct)), day = spread(ev.map((e) => Math.abs(e.day_pct)));
  return { reports: ev.length, runup_share_up: r1(run.share_positive), runup_median: r2(run.median), abs_report_day_median: r2(day.median) }; };
const movedAll = newEv.filter((e) => { const o = oldEv.find((x) => x.t === e.t && x.date === e.date); return o && o.session !== e.session; });
const bmoNames = Object.entries(perName).filter(([, v]) => v.bmo_share >= 60).map(([k, v]) => ({ t: k, ...v })).sort((a, b) => b.moved - a.moved);
const res = { built_utc: new Date().toISOString(), source_export: SRC, new_export: DST,
  fmp: "not used — no FMP key in this machine's environment (the brief allows env only); every missing time is inferred and flagged",
  rule: "ladder.mjs inferTiming: overnight gap into the report date vs into the next session, each in usual days; 2× and ≥ 1 usual day to call it; else the name's clear calls within 3 years",
  sources: src, validation_on_export_times: { ...check, agreement_pct: r1(100 * check.agree / (check.agree + check.disagree)) },
  no_bars: noBars, s6_pooled: { old_convention: T(oldEv), corrected: T(newEv), reports_moved_to_the_earlier_session: movedAll.length,
    moved_only: { old: T(oldEv.filter((e) => movedAll.some((m) => m.t === e.t && m.date === e.date))), corrected: T(movedAll) } },
  morning_reporters: bmoNames.slice(0, 40), per_name: perName };
fs.writeFileSync(path.join(here, DST), JSON.stringify(out));
fs.writeFileSync(path.join(here, "data/s8-timing.json"), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ sources: src, validation: res.validation_on_export_times, s6: res.s6_pooled, noBars: noBars.length }, null, 1));
