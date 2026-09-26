/* S6b · WHAT CONDITIONS COME WITH A BETTER RUN-UP INTO THE REPORT (descriptive, prior data only).
   Alan, 26 Sep: "is there any correlation… types of securities that do better… leaders, laggards…
   when it's oversold prior to earnings versus overbought versus in the middle… a 60% edge is not a crazy
   edge, 70% starts to be one; with confluences we can start to hike up the probabilities."

   For every report the S6 study can measure, the state of the name at the START of the 20-session
   run-up window is read from bars before that day only:
     · RSI(14) — absolute, and as a percentile of the name's OWN prior 3 years (Micron's oversold is
       not Bitcoin's oversold: the own-percentile form is the fair comparison);
     · distance to the 200-day average, and whether price is above it;
     · leader or laggard — the name's prior 60-session return minus SPY's over the same 60 sessions;
     · how jumpy the name is — its usual day (sd of daily moves, prior 60 sessions), in terciles
       across all events;
     · the market at the same moment — SPY's own RSI percentile;
     · whether the previous report beat its EPS estimate;
     · the name's cohorts (today's cohort table; a label, not a point-in-time fact).
   Each state is compared against the SAME state's ordinary 20-session outcome (every 5th session of
   the name's history, pooled), so an "oversold" row is read against oversold stretches in general —
   that separates the report effect from the plain oversold-bounce effect.

   node research/statistics/s6-conditions.mjs --cache <dir> [--fetch]
     --cache <dir>  reads/writes <dir>/<SYMBOL>.json (the chart API's finished daily bars)
     --fetch        fills missing cache files from the chart API (GET /candles?tf=D&limit=6000)
   Writes data/s6-conditions.json. Survivors only (today's universe). Nothing predicts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { runupStudy, rsiWilder, sma, usualDay, percentileOf, spread, RUNUP_SESSIONS } from "./stats.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const CACHE = opt("--cache"); const FETCH = args.includes("--fetch");
const API = "https://scintilla-massive-chart-api.fly.dev";
if (!CACHE) { console.error("--cache <dir> is required"); process.exit(2); }
fs.mkdirSync(CACHE, { recursive: true });

const earnings = JSON.parse(fs.readFileSync(path.join(here, "data/earnings-export-with-estimates-20260926.json"), "utf8"));
const meta = JSON.parse(fs.readFileSync(path.join(here, "data/meta-cohorts-caps-20260926.json"), "utf8"));
const byTicker = new Map();
for (const r of earnings) { if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []); byTicker.get(r.ticker).push(r); }

async function bars(sym) {
  const f = path.join(CACHE, sym + ".json");
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  if (!FETCH) return null;
  const r = await fetch(`${API}/candles?tf=D&limit=6000&symbol=${encodeURIComponent(sym)}`, { headers: { Origin: "https://scintillahub.ai" } });
  if (!r.ok) return null;
  const j = await r.json(); const arr = Array.isArray(j) ? j : (Object.values(j).find(Array.isArray) || null);
  if (!arr) return null;
  fs.writeFileSync(f, JSON.stringify(arr)); return arr;
}
const tOf = (b) => { const x = b.t ?? b.time ?? b.ts ?? b.timestamp; return x < 1e11 ? x * 1000 : x; };
const day = (b) => new Date(tOf(b)).toISOString().slice(0, 10);

/* The name's state at index i, from closes[0..i] only. */
function stateAt(closes, rsi, ma200, usual, i) {
  const r = rsi[i];
  const prior = []; for (let k = Math.max(0, i - 756); k < i; k++) if (rsi[k] != null) prior.push(rsi[k]);
  const rsiPct = prior.length >= 250 ? percentileOf(prior, r) : null;
  const d200 = ma200[i] ? (closes[i] / ma200[i] - 1) * 100 : null;
  const ret60 = i >= 60 && closes[i - 60] > 0 ? (closes[i] / closes[i - 60] - 1) * 100 : null;
  return { rsi: r, rsiPct, d200, ret60, usual: usual[i] };
}

const spy = await bars("SPY");
const spyDates = spy.map(day), spyCloses = spy.map((b) => +b.c), spyRsi = rsiWilder(spyCloses, 14);
const spyIdx = new Map(spyDates.map((d, i) => [d, i]));
function spyState(date) {
  const i = spyIdx.get(date); if (i == null) return {};
  const prior = []; for (let k = Math.max(0, i - 756); k < i; k++) if (spyRsi[k] != null) prior.push(spyRsi[k]);
  return { spyRsiPct: prior.length >= 250 ? percentileOf(prior, spyRsi[i]) : null,
    spyRet60: i >= 60 ? (spyCloses[i] / spyCloses[i - 60] - 1) * 100 : null };
}

const events = [], base = [];
let names = 0, missing = [];
for (const [t, reps] of byTicker) {
  const b = await bars(t);
  if (!b || b.length < 400) { missing.push(t); continue; }
  const st = runupStudy(b, reps);
  if (!st.reports_used) continue;
  names++;
  const closes = b.map((x) => +x.c), dates = b.map(day);
  const rsi = rsiWilder(closes, 14), ma200 = sma(closes, 200), usual = usualDay(closes, 60);
  const idxOf = new Map(dates.map((d, i) => [d, i]));
  const repsSorted = [...reps].sort((a, c) => String(a.date).localeCompare(String(c.date)));
  const cohorts = meta.cohorts?.[t] || [];
  for (const e of st.events) {
    const i = idxOf.get(e.runup_from); if (i == null) continue;
    const s = stateAt(closes, rsi, ma200, usual, i); const m = spyState(e.runup_from);
    const prev = repsSorted.filter((r) => String(r.date) < e.date).slice(-1)[0];
    const beat = prev && prev.eps_estimate != null && prev.eps_actual != null ? (prev.eps_actual > prev.eps_estimate ? "beat" : prev.eps_actual < prev.eps_estimate ? "miss" : "inline") : null;
    events.push({ t, date: e.date, runup: e.runup_pct, day: e.day_pct, after: e.after_pct, ...s, ...m,
      rel60: s.ret60 != null && m.spyRet60 != null ? s.ret60 - m.spyRet60 : null, prevBeat: beat, cohorts });
  }
  /* The same states on ordinary stretches: every 5th session, outcome = the next 20 sessions. */
  for (let i = 820; i + RUNUP_SESSIONS < closes.length; i += 5) {
    const s = stateAt(closes, rsi, ma200, usual, i); const m = spyState(dates[i]);
    const out = (closes[i + RUNUP_SESSIONS] / closes[i] - 1) * 100;
    base.push({ t, runup: out, ...s, ...m, rel60: s.ret60 != null && m.spyRet60 != null ? s.ret60 - m.spyRet60 : null, cohorts });
  }
}

/* Terciles of the usual day and of rel60 across events (so buckets are balanced). */
const tercile = (xs) => { const s = xs.filter((v) => v != null).sort((a, b) => a - b); return [s[Math.floor(s.length / 3)], s[Math.floor(2 * s.length / 3)]]; };
const [u1, u2] = tercile(events.map((e) => e.usual)), [l1, l2] = tercile(events.map((e) => e.rel60));
const buckets = {
  "own RSI percentile (3y) at window start": (e) => e.rsiPct == null ? null : e.rsiPct < 20 ? "a · low (below its own 20th pct)" : e.rsiPct > 80 ? "c · high (above its own 80th pct)" : "b · middle",
  "absolute RSI(14) at window start": (e) => e.rsi == null ? null : e.rsi < 35 ? "a · below 35" : e.rsi > 65 ? "c · above 65" : "b · 35–65",
  "price vs its 200-day average": (e) => e.d200 == null ? null : e.d200 < 0 ? "a · below" : e.d200 > 20 ? "c · more than 20% above" : "b · 0–20% above",
  "leader or laggard (60 sessions vs SPY, terciles)": (e) => e.rel60 == null ? null : e.rel60 < l1 ? "a · laggard (bottom third)" : e.rel60 > l2 ? "c · leader (top third)" : "b · middle third",
  "how jumpy (usual day, terciles)": (e) => e.usual == null ? null : e.usual < u1 ? "a · calm third" : e.usual > u2 ? "c · jumpy third" : "b · middle third",
  "the market (SPY's own RSI percentile)": (e) => e.spyRsiPct == null ? null : e.spyRsiPct < 20 ? "a · market washed out" : e.spyRsiPct > 80 ? "c · market stretched" : "b · market middle",
  "previous report": (e) => e.prevBeat ? ({ beat: "a · beat", inline: "b · in line", miss: "c · missed" })[e.prevBeat] : null,
};
const confluences = {
  "leader AND own RSI low (below its 40th pct)": (e) => e.rel60 > l2 && e.rsiPct != null && e.rsiPct < 40,
  "leader AND above 200-day AND previous beat": (e) => e.rel60 > l2 && e.d200 > 0 && e.prevBeat === "beat",
  "own RSI low (<20th pct) AND above 200-day": (e) => e.rsiPct != null && e.rsiPct < 20 && e.d200 > 0,
  "own RSI low (<20th pct) AND below 200-day": (e) => e.rsiPct != null && e.rsiPct < 20 && e.d200 != null && e.d200 < 0,
  "laggard AND own RSI high (>80th pct)": (e) => e.rel60 < l1 && e.rsiPct > 80,
  "market washed out AND previous beat": (e) => e.spyRsiPct != null && e.spyRsiPct < 20 && e.prevBeat === "beat",
  "own RSI low (<30th pct) AND previous beat AND above 200-day": (e) => e.rsiPct != null && e.rsiPct < 30 && e.prevBeat === "beat" && e.d200 > 0,
};
const row = (xs) => { const s = spread(xs.map((x) => x.runup)); return { n: s.n, median: s.median, share_up: s.share_positive, q25: s.q25, q75: s.q75 }; };
const table = {};
for (const [name, f] of Object.entries(buckets)) {
  const groups = {};
  for (const e of events) { const k = f(e); if (k) (groups[k] ||= { ev: [], bs: [] }).ev.push(e); }
  for (const b of base) { if (name === "previous report") continue; const k = f(b); if (k && groups[k]) groups[k].bs.push(b); }
  table[name] = Object.fromEntries(Object.entries(groups).sort().map(([k, g]) => [k, { before_report: row(g.ev), ordinary_20_sessions: g.bs.length ? row(g.bs) : null }]));
}
const conf = Object.fromEntries(Object.entries(confluences).map(([k, f]) => [k, { before_report: row(events.filter(f)), ordinary_20_sessions: row(base.filter(f)) }]));
const cohortRows = {};
for (const e of events) for (const c of e.cohorts) (cohortRows[c] ||= []).push(e);
const cohorts = Object.fromEntries(Object.entries(cohortRows).filter(([, v]) => v.length >= 150).map(([k, v]) => [k, row(v)]).sort((a, b) => b[1].share_up - a[1].share_up));
const out = { built_utc: new Date().toISOString(), study: "S6b run-up conditions", names, reports: events.length, ordinary_stretches: base.length,
  all_reports: row(events), all_ordinary: row(base), buckets: table, confluences: conf, cohorts_min150: cohorts,
  cutoffs: { usual_day_terciles_pct: [u1, u2], rel60_terciles_pts: [l1, l2] }, missing_bars: missing,
  caveats: ["survivors only: today's universe", "cohorts are today's labels, not what the name was then", "RSI percentile needs 250 prior readings", "descriptive; no prediction; overlapping windows in the ordinary rows"] };
fs.writeFileSync(path.join(here, "data/s6-conditions.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ names, reports: events.length, ordinary: base.length, missing: missing.length }));
