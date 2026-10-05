/* M68 — what happened AFTER a sigma day. The Playbook's first chapter.

   It replays the SAME code the backfill will run (scripts/scintillas-backfill.mjs -> the live
   detectPriceOutliers), over two years of stored daily bars, and then measures what the next 1, 5
   and 20 sessions did — against the name's own close and against SPY over the same dates.

   HONEST LIMITS, stated in the output as well as here:
     · only closes that existed AFTER the event are used; an event too near the end of the cache has
       no 20-session answer and is counted as missing, never as zero;
     · the divisor is the usual day as of the session BEFORE the event, computed here from bars that
       all close before it — the same formula public.ticker_heartbeat_daily stores (hb-2). No key to
       that table exists in this environment, so the study computes it rather than reading it;
     · the 364 names are TODAY's universe: anything delisted in the last two years is absent.

   Usage: node scripts/sigma-history-study.mjs <bars-cache-dir> <out.json>
*/
import fs from "node:fs";
import path from "node:path";
import { backfillSymbol, BACKFILL_FIRST_SESSION } from "./scintillas-backfill.mjs";
import { detectPriceOutliers, stdev, assetClassOf } from "./scintillas-detect.mjs";

const CACHE = process.argv[2];
const OUT = process.argv[3];
const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const TAXO = JSON.parse(fs.readFileSync(new URL("../data/taxonomy-20260924.json", import.meta.url), "utf8"));
const PLACE = TAXO.placement || {};
const FROM = BACKFILL_FIRST_SESSION, HORIZONS = [1, 5, 20];

const load = (sym) => {
  const f = path.join(CACHE, sym.replace(/[^A-Z0-9._-]/gi, "_") + ".json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).bars : null;
};
const symbols = JSON.parse(fs.readFileSync(path.join(CACHE, "_universe.json"), "utf8"));

/* the usual day as hb-2 stores it: the spread of the last 60 daily % moves, one row per date,
   each row describing the day it is dated — so the backfill's "row before the session" rule picks
   a number that cannot contain the session it judges. */
function heartbeatFromBars(bars) {
  const rets = [], rows = [];
  for (let i = 1; i < bars.length; i++) {
    rets.push((bars[i].c / bars[i - 1].c - 1) * 100);
    const win = rets.slice(-60);
    rows.push({ date: bars[i].d, usual_day_60: win.length >= 20 ? stdev(win) : null, n: win.length });
  }
  return rows;
}

const med = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : null);
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

/* ── replay ─────────────────────────────────────────────────────────────────────────────────── */
const spyBars = load("SPY");
const spyIdx = new Map(spyBars.map((b, i) => [b.d, i]));
const spyFwd = (date, k) => {
  const i = spyIdx.get(date);
  if (i == null || i + k >= spyBars.length) return null;
  return (spyBars[i + k].c / spyBars[i].c - 1) * 100;
};

const events = [];
/* THE CONTROL. A cohort that simply rose for two years will show a fat number after its sigma days
   whether or not the sigma meant anything. So every (name, day) in the window is also measured —
   the same 1/5/20-session forward excess over SPY — and the tables report the event-day figure
   ALONGSIDE the same names' ordinary day. The difference between the two is what the sigma added. */
const baselineBySymbol = new Map();
const sessionsSeen = new Set();
let examined = 0, skippedCounts = {}, namesUsed = 0;

for (const sym of symbols) {
  const bars = load(sym);
  if (!bars || bars.length < 25) continue;
  namesUsed++;
  const heartbeat = heartbeatFromBars(bars);
  const out = backfillSymbol({ detect: detectPriceOutliers, symbol: sym, bars, heartbeat, from: FROM, rules: RULES });
  examined = Math.max(examined, out.sessions_examined);
  for (const s of out.skipped) skippedCounts[s.reason] = (skippedCounts[s.reason] || 0) + 1;
  const idx = new Map(bars.map((b, i) => [b.d, i]));
  const base = [];
  for (let i = 0; i < bars.length; i++) {
    const d = bars[i].d;
    if (d < FROM) continue;
    const own = i + 20 < bars.length ? (bars[i + 20].c / bars[i].c - 1) * 100 : null;
    const sp = spyFwd(d, 20);
    if (own != null && sp != null) base.push(own - sp);
  }
  baselineBySymbol.set(sym, base);
  for (const e of out.events) {
    const d = e.detail.session, i = idx.get(d);
    sessionsSeen.add(d);
    const fwd = {}, exc = {};
    for (const k of HORIZONS) {
      const own = i + k < bars.length ? (bars[i + k].c / bars[i].c - 1) * 100 : null;
      const sp = spyFwd(d, k);
      fwd[k] = own;
      exc[k] = own == null || sp == null ? null : own - sp;
    }
    const x = Math.abs(e.detail.x_usual == null ? 0 : e.detail.x_usual);
    events.push({
      symbol: sym, session: d, dir: e.direction, x, move: e.detail.move_pct,
      usual: e.detail.daily_vol_pct, cls: e.detail.asset_class || assetClassOf(sym, RULES),
      fired: e.detail.fired, cohort: (PLACE[sym] && (PLACE[sym].family || PLACE[sym].branch)) || "UNPLACED",
      sector: (PLACE[sym] && PLACE[sym].sector) || null,
      trunk: (PLACE[sym] && PLACE[sym].trunk) || "UNPLACED",
      size: x >= 3 ? "3x+" : x >= 2 ? "2-3x" : "raw only", fwd, exc,
    });
  }
}
events.sort((a, b) => (a.session < b.session ? -1 : a.session > b.session ? 1 : 0));

/* ── what happened after ────────────────────────────────────────────────────────────────────── */
const dates = [...sessionsSeen].sort();
const byDate = new Map();
for (const e of events) { if (!byDate.has(e.session)) byDate.set(e.session, []); byDate.get(e.session).push(e); }

/* the same names' ordinary 20 sessions, over every day in the window */
function baselineFor(list) {
  const names = new Set(list.map((e) => e.symbol));
  const all = [];
  for (const n of names) all.push(...(baselineBySymbol.get(n) || []));
  return { n: all.length, median_vs_spy: r2(med(all)), beat_spy_rate: r2(share(all, (v) => v > 0) * 100) };
}
function statsFor(list) {
  const out = { n: list.length, names: new Set(list.map((e) => e.symbol)).size, horizons: {},
                baseline20: baselineFor(list) };
  for (const k of HORIZONS) {
    const own = list.map((e) => e.fwd[k]).filter((v) => v != null);
    const ex = list.map((e) => e.exc[k]).filter((v) => v != null);
    out.horizons[k] = {
      n: own.length, missing: list.length - own.length,
      median: r2(med(own)), mean: r2(mean(own)), up_rate: r2(share(own, (v) => v > 0) * 100),
      median_vs_spy: r2(med(ex)), beat_spy_rate: r2(share(ex, (v) => v > 0) * 100),
    };
  }
  return out;
}

/* CIRCULAR BLOCK BOOTSTRAP. Events on the same day are not independent — one market shock lights up
   dozens of names at once — so the resampling unit is a BLOCK OF CONSECUTIVE SESSIONS, not an event.
   The interval below is where the median 20-session excess lands in 400 such resamples. */
function bootstrapMedianExcess(list, k = 20, B = 400, block = 20) {
  const byDay = new Map();
  for (const e of list) { const v = e.exc[k]; if (v == null) continue;
    if (!byDay.has(e.session)) byDay.set(e.session, []); byDay.get(e.session).push(v); }
  const days = dates.filter((d) => byDay.has(d));
  if (days.length < block * 2) return null;
  const nBlocks = Math.ceil(days.length / block);
  const meds = [];
  for (let b = 0; b < B; b++) {
    const pool = [];
    for (let j = 0; j < nBlocks; j++) {
      const s = Math.floor(Math.random() * days.length);
      for (let t = 0; t < block; t++) pool.push(...byDay.get(days[(s + t) % days.length]));
    }
    const m = med(pool);
    if (m != null) meds.push(m);
  }
  meds.sort((a, b) => a - b);
  return { lo: r2(meds[Math.floor(meds.length * 0.05)]), hi: r2(meds[Math.floor(meds.length * 0.95)]),
           point: r2(med(list.map((e) => e.exc[k]).filter((v) => v != null))), resamples: meds.length, block_sessions: block };
}

const groups = {};
const put = (name, list) => {
  if (list.length < 25) return;
  groups[name] = statsFor(list);
  groups[name].ci20 = bootstrapMedianExcess(list);
  const b = groups[name].baseline20.median_vs_spy, e = groups[name].horizons[20].median_vs_spy;
  /* WHAT THE SIGMA ADDED: the event-day figure minus the same names' ordinary 20 sessions. */
  groups[name].lift20 = b == null || e == null ? null : r2(e - b);
};
put("ALL", events);
for (const dir of [1, -1]) {
  const l = events.filter((e) => e.dir === dir);
  put(dir > 0 ? "UP" : "DOWN", l);
  for (const size of ["2-3x", "3x+", "raw only"]) put((dir > 0 ? "UP" : "DOWN") + " · " + size, l.filter((e) => e.size === size));
  for (const cls of ["equity", "index_etf", "sector_etf"]) put((dir > 0 ? "UP" : "DOWN") + " · " + cls, l.filter((e) => e.cls === cls));
}
const cohorts = {};
for (const e of events) (cohorts[e.cohort] ||= []).push(e);
const cohortStats = {};
for (const [c, l] of Object.entries(cohorts)) {
  if (l.length < 60) continue;
  const up = l.filter((e) => e.dir > 0), dn = l.filter((e) => e.dir < 0);
  cohortStats[c] = { n: l.length, names: new Set(l.map((e) => e.symbol)).size,
    up: up.length, down: dn.length,
    up_med20_vs_spy: r2(med(up.map((e) => e.exc[20]).filter((v) => v != null))),
    down_med20_vs_spy: r2(med(dn.map((e) => e.exc[20]).filter((v) => v != null))),
    baseline20_vs_spy: baselineFor(l).median_vs_spy };
}

/* ── breadth of the unusual ─────────────────────────────────────────────────────────────────── */
const breadth = dates.map((d) => {
  const l = byDate.get(d);
  return { session: d, up: l.filter((e) => e.dir > 0).length, down: l.filter((e) => e.dir < 0).length,
           total: l.length, names: new Set(l.map((e) => e.symbol)).size,
           spy_fwd5: r2(spyFwd(d, 5)), spy_fwd20: r2(spyFwd(d, 20)) };
});
/* every session in the window, including the quiet ones with no event at all */
const allSessions = spyBars.filter((b) => b.d >= FROM).map((b) => b.d);
const breadthByDate = new Map(breadth.map((b) => [b.session, b]));
const fullBreadth = allSessions.map((d) => breadthByDate.get(d) ||
  ({ session: d, up: 0, down: 0, total: 0, names: 0, spy_fwd5: r2(spyFwd(d, 5)), spy_fwd20: r2(spyFwd(d, 20)) }));

function quintiles(rows, key) {
  const withKey = rows.filter((r) => r.spy_fwd5 != null && r.spy_fwd20 != null).sort((a, b) => a[key] - b[key]);
  const q = [], size = Math.floor(withKey.length / 5);
  for (let i = 0; i < 5; i++) {
    const slice = withKey.slice(i * size, i === 4 ? withKey.length : (i + 1) * size);
    q.push({ bucket: i + 1, from: slice[0] && slice[0][key], to: slice.at(-1) && slice.at(-1)[key], sessions: slice.length,
      spy_next5_median: r2(med(slice.map((r) => r.spy_fwd5))), spy_next20_median: r2(med(slice.map((r) => r.spy_fwd20))),
      spy_next20_up_rate: r2(share(slice.map((r) => r.spy_fwd20), (v) => v > 0) * 100) });
  }
  return q;
}

/* ── the worked example Alan asked for ──────────────────────────────────────────────────────── */
const example = events.find((e) => e.symbol === "EOSE" && e.session === "2026-09-23") ||
                events.filter((e) => e.symbol === "EOSE").at(-1) || null;

const perClass = {};
for (const e of events) {
  const c = (perClass[e.cls] ||= { events: 0, up: 0, down: 0, statistical: 0, raw: 0, both: 0, names: new Set() });
  c.events++; c.names.add(e.symbol);
  if (e.dir > 0) c.up++; else c.down++;
  if (e.fired.includes("statistical")) c.statistical++;
  if (e.fired.includes("raw")) c.raw++;
  if (e.fired.length === 2) c.both++;
}
const sessionsInWindow = allSessions.length;
const counts = { sessions: sessionsInWindow, total: events.length, per_day: r2(events.length / sessionsInWindow),
  by_class: Object.fromEntries(Object.entries(perClass).map(([k, v]) => [k, { events: v.events, per_day: r2(v.events / sessionsInWindow),
    names: v.names.size, up: v.up, down: v.down, statistical: v.statistical, raw: v.raw, both: v.both }])) };

const busiest = [...fullBreadth].sort((a, b) => b.total - a.total).slice(0, 10)
  .map((b) => ({ session: b.session, total: b.total, up: b.up, down: b.down }));

fs.writeFileSync(OUT, JSON.stringify({
  meta: { built_utc: new Date().toISOString(), from: FROM, to: allSessions.at(-1), sessions: sessionsInWindow,
          names_in_universe: symbols.length, names_used: namesUsed, rules_version: RULES.version,
          bars_source: "chart-api:/candles?tf=1d (cached locally, read-only)",
          usual_day_source: "computed here from bars closing before each session, same formula as ticker_heartbeat_daily (hb-2)",
          horizons: HORIZONS },
  counts, skipped: skippedCounts,
  rules_measured: RULES.measured,
  groups, cohorts: cohortStats,
  breadth: fullBreadth,
  breadth_quintiles: { by_down: quintiles(fullBreadth, "down"), by_total: quintiles(fullBreadth, "total") },
  busiest, example,
  events_head: events.slice(0, 5),
}, null, 1));
console.log("events", events.length, "sessions", sessionsInWindow, "per day", r2(events.length / sessionsInWindow));
console.log("ALL 20d:", JSON.stringify(groups.ALL?.horizons?.[20]));
console.log("wrote", OUT);
