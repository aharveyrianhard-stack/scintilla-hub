/* Builds research/statistics/data/summary.json: the statistics package for every name.
   node research/statistics/build.mjs --cache <dir>   reads <dir>/<SYMBOL>.json saved from the chart API
   node research/statistics/build.mjs --fetch          asks the chart API itself (GET /candles?tf=D, finished bars only)
   S6 (run-up into the report) is added with --earnings <file>: a read-only export of public.earnings_events
   (CSV with a header, or a JSON array) holding ticker, date, report_time and, when present, eps_actual and
   superseded_at. Only rows with an eps_actual and no superseded_at are used. It writes data/runup-into-earnings.json;
   --s6-only skips rewriting summary.json, --out <file> writes S6 elsewhere, --fixture marks the output as test data.
   Data source for prices is the chart API only. Nothing is written anywhere except the files named above. */
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyseSymbol, WINDOWS, MIN_N, runupStudy, sameWindows, summariseEvents, spread, MIN_REPORTS, RUNUP_SESSIONS, AFTER_SESSIONS, USUAL_SESSIONS } from "./stats.mjs";
import crypto from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const cache = opt("--cache"), earningsFile = opt("--earnings"), s6Out = opt("--out");
const s6Only = args.includes("--s6-only"), fixture = args.includes("--fixture");
const API = "https://scintilla-massive-chart-api.fly.dev";
const TARGETS = opt("--targets")?.split(",") ?? ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT"];     // public.station_targets, 25 Sep
const FUNDS = opt("--funds")?.split(",") ?? ["SPY", "QQQ", "DIA", "IWM", "SMH"];

async function universe() {
  if (cache && fs.existsSync(path.join(cache, "..", "universe.json"))) return JSON.parse(fs.readFileSync(path.join(cache, "..", "universe.json"), "utf8"));
  const r = await fetch(API + "/universe", { headers: { Origin: "https://scintillahub.ai" } }); return r.json();
}
async function candles(sym) {
  if (cache) { const f = path.join(cache, sym + ".json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; }
  const r = await fetch(`${API}/candles?tf=D&symbol=${encodeURIComponent(sym)}`, { headers: { Origin: "https://scintillahub.ai" } });
  return r.ok ? r.json() : null;
}

/** The export, as rows that happened: eps_actual present and superseded_at empty (when those columns exist). */
function readEarnings(file) {
  const text = fs.readFileSync(file, "utf8");
  let rows;
  if (/^\s*\[/.test(text)) rows = JSON.parse(text);
  else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const cells = (l) => { const out = []; let cur = "", q = false;
      for (let i = 0; i < l.length; i++) { const ch = l[i];
        if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
      out.push(cur); return out; };
    const head = cells(lines[0]).map((h) => h.trim());
    rows = lines.slice(1).map((l) => { const c = cells(l); return Object.fromEntries(head.map((h, i) => [h, c[i] === "" ? null : c[i]])); });
  }
  const has = (k) => rows.some((r) => k in r);
  const happened = rows.filter((r) => (!has("eps_actual") || (r.eps_actual != null && r.eps_actual !== "")) && (!has("superseded_at") || r.superseded_at == null || r.superseded_at === ""));
  const by = new Map();
  for (const r of happened) { const t = String(r.ticker).toUpperCase(); if (!by.has(t)) by.set(t, []); by.get(t).push({ date: String(r.date).slice(0, 10), report_time: r.report_time ?? null }); }
  return { by, rows: rows.length, happened: happened.length,
    filtered_on: ["eps_actual", "superseded_at"].filter(has), sha256: crypto.createHash("sha256").update(text).digest("hex") };
}
const round = (k, v) => (typeof v === "number" && !Number.isInteger(v)) ? Math.round(v * 1e4) / 1e4 : v;

const u = await universe();
const symbols = [...TARGETS, ...FUNDS, ...u.symbols.filter((s) => !TARGETS.includes(s) && !FUNDS.includes(s))];
const out = { built_utc: new Date().toISOString(), source: `chart API ${API}/candles?tf=D — finished daily bars only, split-adjusted as served`,
  universe: { count: u.count, sha256: u.universe_sha256 }, targets: TARGETS, funds: FUNDS,
  windows: Object.fromEntries(Object.entries(WINDOWS).map(([k, v]) => [k, Number.isFinite(v) ? v : "all history"])), min_n: MIN_N,
  method: "see research/statistics/stats.mjs header — prior observations only, sample sd, percentile with half-ties, Wilder RSI, SMA200 distance, 60-session usual day",
  symbols: {}, missing: [] };
const earn = earningsFile ? readEarnings(earningsFile) : null;
const s6 = earn && { built_utc: out.built_utc, study: "S6 · into the report", fixture, source: out.source,
  reports: { file: path.basename(earningsFile), sha256: earn.sha256, rows: earn.rows, happened: earn.happened,
    rule: `eps_actual present and superseded_at empty (columns found and filtered on: ${earn.filtered_on.join(", ") || "none — the export was taken as already filtered"})` },
  definitions: { runup_sessions: RUNUP_SESSIONS, after_sessions: AFTER_SESSIONS, usual_day_sessions: USUAL_SESSIONS, min_reports: MIN_REPORTS,
    method: "see the S6 block in research/statistics/stats.mjs — report session by BMO/AMC, run-up close[r-21] -> close[r-1], report day close[r-1] -> close[r], five after close[r] -> close[r+5], scaled by the usual day at the run-up start" },
  universe: out.universe, targets: TARGETS, funds: FUNDS, survivorship: "the universe is today's list; names that were delisted, merged or dropped before today are not in it, so the pooled rows describe survivors",
  symbols: {}, no_reports: [], missing_bars: [], pooled: {}, table: [] };
const pooledEvents = [], pooledAny = { pct: [], sd: [] }, fundBars = {};
for (const sym of symbols) {
  const j = await candles(sym);
  if (!j || !Array.isArray(j.series) || j.series.length < 2) { out.missing.push(sym); if (s6) s6.missing_bars.push(sym); continue; }
  if (!s6Only) { const a = analyseSymbol(j.series);
    a.provider = j.provider; a.price_basis = j.price_basis; a.api_series_count = j.full_series_count ?? j.candles ?? null;
    a.acquired_utc = j.derived_utc ?? null;
    out.symbols[sym] = a; }
  if (!s6) continue;
  if (FUNDS.includes(sym)) fundBars[sym] = j.series;
  const reps = earn.by.get(sym);
  if (!reps || !reps.length) { if (!FUNDS.includes(sym)) s6.no_reports.push(sym); continue; }
  const st = runupStudy(j.series, reps, { keepStretches: true });
  if (st.enough) { pooledEvents.push(...st.events.map((e) => ({ ...e, symbol: sym }))); pooledAny.pct.push(...st._any20_raw.pct); pooledAny.sd.push(...st._any20_raw.sd); }
  delete st._any20_raw;
  st.events = st.events.map(({ date, session, runup_from, timing, timing_flagged, usual_day, runup_pct, runup_sd, day_pct, day_sd, after_pct, after_sd }) =>
    ({ date, session, runup_from, timing, timing_flagged, usual_day, runup_pct, runup_sd, day_pct, day_sd, after_pct, after_sd }));
  s6.symbols[sym] = st;
}
if (s6) {
  const names = Object.entries(s6.symbols).filter(([, v]) => v.enough).map(([k]) => k);
  s6.pooled.universe = { names: names.length, reports: pooledEvents.length, summary: summariseEvents(pooledEvents),
    any20: { pct: spread(pooledAny.pct), sd: spread(pooledAny.sd) },
    timing: pooledEvents.reduce((m, e) => (m[e.timing] = (m[e.timing] || 0) + 1, m), {}) };
  for (const t of TARGETS) { const v = s6.symbols[t];
    s6.table.push(v ? { name: t, kind: "target", reports_used: v.reports_used, enough: v.enough, summary: v.summary, any20: v.any20, timing: v.timing, first_day: v.first_day }
                    : { name: t, kind: "target", reports_used: 0, enough: false, note: s6.missing_bars.includes(t) ? "no bars from the chart API" : "no reports in the export" }); }
  for (const f of FUNDS) {
    const own = s6.symbols[f];
    const same = fundBars[f] ? sameWindows(fundBars[f], pooledEvents) : null;
    s6.table.push({ name: f, kind: "fund", reports_used: own ? own.reports_used : 0,
      note: "a fund does not report; this row is the fund over the very same sessions as every pooled report",
      windows_asked: same?.windows_asked ?? 0, windows_matched: same?.windows_matched ?? 0, summary: same?.summary ?? null });
  }
  const file = s6Out || path.join(here, "data", "runup-into-earnings.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s6, round));
  console.log(`S6: names with >=${MIN_REPORTS} reports ${names.length}, pooled reports ${pooledEvents.length}, no reports ${s6.no_reports.length}, missing bars ${s6.missing_bars.length}, bytes ${fs.statSync(file).size}`);
}
if (!s6Only) {
  fs.mkdirSync(path.join(here, "data"), { recursive: true });
  fs.writeFileSync(path.join(here, "data", "summary.json"), JSON.stringify(out, round));
  console.log(`symbols ${Object.keys(out.symbols).length}, missing ${out.missing.length} ${out.missing.join(",")}, bytes ${fs.statSync(path.join(here, "data", "summary.json")).size}`);
}
