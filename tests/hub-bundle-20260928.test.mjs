/* N6 (28 Sep) — small Hub items from Alan's afternoon notes: the INDEXES family in SECTORS compare, the REACTION column in
   the earnings room's past-reports list, and the company view's EVENTS tab reading EARNINGS.
   Offline: functions are sliced out of the page by name and run with stubs; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };

/* ---- 1 · INDEXES ---------------------------------------------------------------------------------------------------- */
const idxSrc = page.match(/var INDEX_FUNDS=\[([\s\S]*?)\]\];/)[1];
const IDX = [...idxSrc.matchAll(/\["([A-Z]+)","([^"]+)"/g)].map((m) => [m[1], m[2]]);

test("INDEXES is a family of its own, between the sector families and OUR NAMES", () => {
  const fam = page.match(/window\.SECT_FAMILIES=\[([\s\S]*?)\]\];/)[1];
  const keys = [...fam.matchAll(/\["([A-Z]+)","([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ["SPDR", "ISHARES", "VANGUARD", "EQWT", "INDEXES", "MEMBERS"]);
});
test("the index funds are the brief's list, kept to those the chart API serves a Geiger for", () => {
  assert.deepEqual(IDX.map((r) => r[0]), ["SPY", "QQQ", "DIA", "IWM", "MDY", "IJR", "RSP", "QQQE", "IWV", "ITOT", "VTI"]);
  assert.equal(new Set(IDX.map((r) => r[0])).size, IDX.length, "no fund twice");
  for (const [, label] of IDX) assert.ok(label.length > 2, "each fund names its index");
  assert.doesNotMatch(idxSrc, /QQEW|EQAL/, "no column that could only ever read 'no Geiger'");
});
test("INDEXES builds one column per fund from the fund's own Geiger, sorted bull to bear, and is remembered", () => {
  const block = page.slice(page.indexOf('if(SECT_FAMILY==="INDEXES"){'), page.indexOf('if(SECT_FAMILY!=="MEMBERS" && SECT_FAMILY_FUNDS[SECT_FAMILY]){'));
  assert.match(block, /return INDEX_FUNDS\.map\(function\(p\)\{\s*var g=gAt\(p\[0\]\);/);
  assert.match(block, /return \{key:p\[0\], label:p\[1\], short:p\[0\],/);
  /* run it: gAt is the rewind-aware Geiger lookup; a missing Geiger sorts last and says so */
  const G = { SPY: 0.33, QQQ: 0.41, IWM: -0.6 };
  const rows = new Function("INDEX_FUNDS", "gAt", block.replace('if(SECT_FAMILY==="INDEXES"){', "") .replace(/\}\s*$/, "") )(IDX, (t) => (t in G ? G[t] : null));
  assert.deepEqual(rows.slice(0, 3).map((r) => r.key), ["QQQ", "SPY", "IWM"]);
  assert.equal(rows.length, IDX.length);
  assert.match(rows[rows.length - 1].full, /no Geiger yet/);
  assert.match(page, /sf==="MEMBERS" \|\| sf==="INDEXES"\)\) window\.SECT_FAMILY=sf;/);
});
test("the strip header says INDEX FUND COMPARE under INDEXES, and a column reads its own fund's trend and momentum", () => {
  assert.match(fn("cohortCompareStripHTML"), /idxFam \? "INDEX FUND" : "SECTOR"/);
  const g = new Function("window", "scCmpMode", "COHSETS", "COHORT_OF", fn("scinGroupTickers") + "\nreturn scinGroupTickers;")(
    { SC_INDEX_FUNDS: IDX, SECT_FAMILY: "INDEXES" }, () => "SECTORS", {}, {});
  assert.deepEqual(g("IWM"), ["IWM"]);
  const g2 = new Function("window", "scCmpMode", "COHSETS", "COHORT_OF", fn("scinGroupTickers") + "\nreturn scinGroupTickers;")(
    { SC_INDEX_FUNDS: IDX, SECT_FAMILY: "SPDR" }, () => "SECTORS", {}, {});
  assert.deepEqual(g2("IWM"), [], "other families keep their own rule");
});

/* ---- 4 · REACTION --------------------------------------------------------------------------------------------------- */
const REACT = new Function("esc", "num",
  fn("ernWhen") + line(/^const erpPct = [^\n]*/m) + fn("erpReaction") + fn("ernRxCellHTML") + fn("ernRxLimit") +
  line(/^const ERP_PX_LIMIT = [^\n]*/m).replace(/\/\*.*$/, "") +
  "\nreturn { erpReaction, ernRxCellHTML, ernRxLimit };")(esc, (v) => (v == null ? null : +v));
const bars = [{ d: "2026-09-22", c: 100 }, { d: "2026-09-23", c: 110 }, { d: "2026-09-24", c: 99 }, { d: "2026-09-25", c: 99 }];

test("REACTION: before the open reads the report day itself; after the close reads the next session", () => {
  const bmo = REACT.ernRxCellHTML({ date: "2026-09-23", report_time: "BMO" }, { bars });
  assert.match(bmo, /class="ev-rx up"[^>]*>\+10\.0%</);
  const amc = REACT.ernRxCellHTML({ date: "2026-09-23", report_time: "AMC" }, { bars });
  assert.match(amc, /class="ev-rx dn"[^>]*>−10\.0%</);
  assert.match(amc, /close to close on 2026-09-24 against 2026-09-23/);
});
test("REACTION: no report time stored is the honest default (the next session) and the cell is marked as assumed", () => {
  const c = REACT.ernRxCellHTML({ date: "2026-09-23", report_time: null }, { bars });
  assert.match(c, /class="ev-rx dn is-assumed"/);
  assert.match(c, /assumes the news landed after the close/);
});
test("REACTION: a report whose next session has not traded yet says 'next'; a flat day is neither colour; failures are a dash", () => {
  assert.match(REACT.ernRxCellHTML({ date: "2026-09-25", report_time: "AMC" }, { bars }), />next</);
  assert.match(REACT.ernRxCellHTML({ date: "2026-09-25", report_time: "BMO" }, { bars }), /class="ev-rx "[^>]*>0\.0%</);
  assert.match(REACT.ernRxCellHTML({ date: "2026-09-23", report_time: "BMO" }, { bars: null, err: true }), /did not answer[^>]*>—</);
  assert.match(REACT.ernRxCellHTML({ date: "2026-09-23", report_time: "BMO" }, null), />…</);
});
test("REACTION: the rail asks only for the bars that reach its oldest row (no fixed window), capped by the full series", () => {
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  assert.ok(REACT.ernRxLimit(d(7)) >= 5 + 1 && REACT.ernRxLimit(d(7)) <= 20);
  assert.ok(REACT.ernRxLimit(d(70)) >= 50);
  assert.equal(REACT.ernRxLimit("1996-01-02"), 1500);
});
test("REACTION: the rail has a header and a fourth column, and reuses a name's full series when it is already loaded", () => {
  const list = fn("evPastListHTML");
  assert.match(list, /<span class="r"[^>]*>REACTION<\/span>/);
  assert.match(list, /ernRxCellHTML\(r, ernRxBarsFor\(r\.ticker\)\)/);
  assert.match(list, /ernRxEnsure\(rows\)/);
  assert.match(fn("ernRxBarsFor"), /ERP_PX\.get\(k\)/);
  assert.match(page, /\.ev-pastrow, \.ev-pasthd\{ display:grid; grid-template-columns:64px 58px minmax\(0,1fr\) 64px;/);
  assert.match(fn("ernRxPump"), /SC_CHART_API \+ "\/candles\?symbol="/, "prices come from the chart API only");
});

/* ---- 5 · EARNINGS tab ----------------------------------------------------------------------------------------------- */
test("the company view's EVENTS tab reads EARNINGS in all four tab bars; the key stays EVENTS", () => {
  assert.match(page, /^const CO_TAB_LABEL = \{ EVENTS: "EARNINGS" \};/m);
  assert.equal((page.match(/coTabLabel\(x\)/g) || []).length, 4);
  assert.match(page, /^const CO_TABS = \[[^\]]*"EVENTS"[^\]]*\];/m);
  assert.match(page, /^const MTAB_LABEL = \{ USUAL: "USUAL DAY", EVENTS: "EARNINGS" \};/m, "the master tab it matches");
});

/* ---- 3 · USUAL DAY nightly top-up (supabase/functions/sigma-daily) ------------------------------------------------- */
import { planTopUp, barsNeeded, weekdaysBetween } from "../supabase/functions/sigma-daily/topup.mjs";
import { sigmaHistory, dayCounts } from "../supabase/functions/heartbeat-daily/sigma.mjs";
import { RULES } from "../supabase/functions/scintillas-detect/rules.mjs";
/* a deterministic daily series: weekdays from `start`, a wobble plus a few shocks; bars stamped 04:00Z like the chart API */
function series(start, n, seed, { gapAt = -1, shocks = [] } = {}) {
  const out = []; let t = Date.parse(start + "T04:00:00Z"), c = 100, x = seed;
  for (let i = 0; i < n; i++) {
    if (i === gapAt) t += 40 * 864e5;                          // a reused ticker: a 40-day hole, then a new security
    while ([0, 6].includes(new Date(t).getUTCDay())) t += 864e5;
    x = (x * 16807) % 2147483647;
    const mv = ((x / 2147483647) - 0.5) * 2.4 + (shocks.includes(i) ? (i % 2 ? -9 : 9) : 0);
    c = Math.max(1, c * (1 + mv / 100));
    out.push({ t, o: c, h: c, l: c, c, v: 1 });
    t += 864e5;
  }
  return out;
}
const iso = (b) => new Date(b.t).toISOString().slice(0, 10);

test("top-up: a short window reproduces the whole-series history exactly for the days it writes (reused-ticker gap included)", () => {
  const names = { AAA: series("2019-01-02", 1900, 7, { shocks: [1850, 1880, 1897] }),
                  BBB: series("2019-01-02", 1900, 11, { gapAt: 1840, shocks: [1870, 1899] }),
                  CCC: series("2019-01-02", 1900, 13, { shocks: [1895] }) };
  const last = [iso(names.AAA[1899]), iso(names.BBB[1899])].sort().pop(), since = iso(names.AAA[1880]);
  const limit = barsNeeded(since, last);
  const short = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, v.slice(-limit)]));
  const plan = planTopUp(short, RULES, { since });
  const full = Object.entries(names).flatMap(([k, v]) => sigmaHistory(k, v, RULES).events.filter((e) => e.date >= since));
  const strip = (e) => [e.ticker, e.date, e.move_pct, e.usual_day_60, e.x_usual, e.direction, e.fired.join("+")].join("|");
  assert.ok(full.length >= 3, "the shocks fire");
  assert.deepEqual(plan.events.map(strip).sort(), full.map(strip).sort());
  assert.equal(plan.written_dates[plan.written_dates.length - 1], last);
  const fullCounts = dayCounts(Object.entries(names).map(([k, v]) => sigmaHistory(k, v, RULES))).filter((c) => plan.written_dates.includes(c.date));
  assert.deepEqual(plan.counts, fullCounts, "the day counts match the whole-series counts");
});
test("top-up: the newest day waits while a name that traded the session before is missing its bar; older days never wait", () => {
  const a = series("2025-01-02", 200, 3), b = series("2025-01-02", 200, 5);
  const since = iso(a[195]);
  const late = { A: a, B: b.slice(0, 199) };                     // B has not got the newest bar yet
  const p = planTopUp(late, RULES, { since });
  assert.deepEqual(p.held, [iso(a[199])]);
  assert.deepEqual(p.lagging[iso(a[199])], ["B"]);
  assert.ok(!p.written_dates.includes(iso(a[199])) && p.written_dates.includes(iso(a[198])));
  assert.ok(planTopUp(late, RULES, { since, force: true }).written_dates.includes(iso(a[199])), "force writes it");
  const gone = { A: a, B: b.slice(0, 197) };                     // B stopped two sessions ago: it holds nothing
  assert.deepEqual(planTopUp(gone, RULES, { since }).held, []);
});
test("top-up: a name the chart API failed for holds the run; the window refuses anything past 250 sessions", () => {
  const a = series("2025-01-02", 200, 3);
  const p = planTopUp({ A: a }, RULES, { since: iso(a[195]), failed: ["ZZZ"] });
  assert.deepEqual(p.written_dates, []);
  assert.deepEqual(p.failed_hold, ["ZZZ"]);
  assert.equal(weekdaysBetween("2026-09-25", "2026-09-28"), 1);
  assert.equal(barsNeeded("2026-09-25", "2026-09-28"), 2 + 60 + 40);
  assert.equal(barsNeeded("2025-01-02", "2026-09-28"), null);
});
test("top-up: the function only ADDS rows (ignore-duplicates), never writes counts for a partial universe, and the schedule has a rollback", () => {
  const fnSrc = fs.readFileSync(new URL("../supabase/functions/sigma-daily/index.ts", import.meta.url), "utf8");
  assert.match(fnSrc, /Prefer: "resolution=ignore-duplicates,return=representation"/);
  assert.doesNotMatch(fnSrc, /merge-duplicates/);
  assert.match(fnSrc, /if \(!only\.length\) wroteC = await insertNew\("sigma_day_counts"/);
  assert.doesNotMatch(fnSrc, /ohlcv|live_quotes|\/scintillas\?/, "no price table and not the detector's store");
  const mig = fs.readFileSync(new URL("../supabase/migrations/20260928_sigma_daily_cron.sql", import.meta.url), "utf8");
  const rb = fs.readFileSync(new URL("../supabase/migrations/20260928_sigma_daily_cron_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(mig, /cron\.schedule\('sigma-daily', '20 23 \* \* 1-5', body\)/);
  assert.match(mig, /cron\.schedule\('sigma-daily-catchup', '20 11 \* \* 2-6', body\)/);
  assert.doesNotMatch(mig, /eyJ[A-Za-z0-9_-]{20,}/, "no key in the migration");
  assert.match(rb, /cron\.unschedule\('sigma-daily'\)/);
  assert.match(rb, /cron\.unschedule\('sigma-daily-catchup'\)/);
  assert.match(rb, /^--\s+delete from public\.sigma_events_daily/m, "row deletes are commented out: they need Alan");
});
