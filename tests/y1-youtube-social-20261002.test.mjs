/* Y1 (2 Oct) — SOCIAL › YouTube: titles first, the Edit-tickers count, searches from the RADAR list.
   Fixtures only, no network: tests/fixtures/y1-youtube/measured-20261002.json is the RADAR list, its cohorts, the old
   searched list and the favourites, read from the database on 2 Oct 2026 ~02:05Z. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchList, planRun, dayPlan, pacificClock, queryFor, bestCohort, NEVER_SEARCH, COST_PER_SEARCH, SEARCH_BUDGET_UNITS, DAILY_QUOTA, MAX_PER_RUN }
  from "../supabase/functions/_shared/yt-search-plan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const M = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/y1-youtube/measured-20261002.json"), "utf8"));
const SRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const FEED = fs.readFileSync(path.join(ROOT, "supabase/functions/youtube-feed/index.ts"), "utf8");
const CFG = fs.readFileSync(path.join(ROOT, "supabase/functions/yt-config/index.ts"), "utf8");
const RSS = fs.readFileSync(path.join(ROOT, "supabase/functions/yt-rss-sweep/index.ts"), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/mg, "");   // comments out: test what runs

/* ---------- item 4: the search rule ---------- */
test("the searched names are the RADAR list, in RADAR order, SPY and QQQ never", () => {
  const list = searchList(M.radar);
  assert.equal(list.length, 17);
  assert.deepEqual(list.slice(0, 3), ["MU", "NBIS", "GOOGL"]);
  const withIndexes = searchList([...M.radar, { ticker: "SPY", position: 0 }, { ticker: "qqq", position: 99 }, { ticker: "MU", position: 100 }]);
  assert.deepEqual(withIndexes, list, "SPY / QQQ dropped, duplicates dropped");
  assert.deepEqual(NEVER_SEARCH, ["SPY", "QQQ"]);
});

test("the function reads RADAR, not the old fixed list, and never writes it", () => {
  assert.match(FEED, /from\('station_lists'\)\.select\('ticker,position'\)\.eq\('list','radar'\)/);
  assert.doesNotMatch(code(FEED), /yt_search_tickers/, "the old ten-name list is no longer read");
  assert.doesNotMatch(FEED, /station_lists'\)\.(upsert|insert|update|delete)/, "RADAR is read only");
  assert.match(FEED, /planRun\(/);
  assert.doesNotMatch(FEED + CFG + RSS, /AIza[0-9A-Za-z_-]{20,}/, "no key in any source");
});

test("before: what every run cost (the arithmetic in the report)", () => {
  const before = M.yt_search_tickers_before.split(",");
  assert.equal(before.length, 10);
  assert.ok(before.includes("SPY") && before.includes("QQQ"));
  /* crons 168–171: 0 5,10,16 · 15 8 · 45 11,20 · 30 13,18,23 → 3 + 1 + 2 + 3 runs a day */
  const runs = 3 + 1 + 2 + 3;
  const units = runs * (before.length * 100 + 1);
  assert.equal(units, 9009);
  assert.ok(units / DAILY_QUOTA > 0.9, "90 % of the default daily quota on searches alone");
});

function simulate(everyMin, startIso, hours) {
  const tickers = searchList(M.radar);
  let prev = null; const days = {};
  for (let t = Date.parse(startIso); t < Date.parse(startIso) + hours * 3600e3; t += everyMin * 60e3) {
    const p = planRun({ tickers, prev, nowMs: t, everyMin });
    const d = days[p.day] = days[p.day] || { searches: 0, runs: 0, maxRun: 0, per: {} };
    d.runs++; d.searches += p.pick.length; d.maxRun = Math.max(d.maxRun, p.pick.length);
    p.pick.forEach((x) => { d.per[x] = (d.per[x] || 0) + 1; });
    assert.equal(p.searches_today, d.searches, "the stored count is the real count");
    prev = { day: p.day, searches_today: p.searches_today, cursor: p.cursor };
  }
  return days;
}

test("after: every 20 minutes for two quota days stays under budget and gives every RADAR name its turns", () => {
  const perDay = Math.floor(SEARCH_BUDGET_UNITS / COST_PER_SEARCH);
  assert.equal(perDay, 79);
  /* 07:00Z = midnight Pacific (PDT): two whole quota days */
  const days = simulate(20, "2026-10-03T07:00:00Z", 48);
  const full = Object.entries(days).filter(([, d]) => d.runs === 72);
  assert.equal(full.length, 2, "two full days of 72 runs");
  for (const [, d] of full) {
    assert.ok(d.searches <= perDay && d.searches >= perDay - 1, "uses the budget, never more: " + d.searches);
    assert.ok(d.searches * COST_PER_SEARCH <= SEARCH_BUDGET_UNITS);
    assert.ok(d.maxRun <= 2, "spread out, not bunched: max " + d.maxRun + " in one run");
    const counts = Object.values(d.per);
    assert.equal(counts.length, 17, "every RADAR name searched");
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "evenly: " + counts.join(","));
  }
});

test("a slower cadence or a gap never overspends", () => {
  for (const every of [5, 30, 60, 240]) {
    const days = simulate(every, "2026-10-03T07:00:00Z", 24);
    for (const d of Object.values(days)) {
      assert.ok(d.searches * COST_PER_SEARCH <= SEARCH_BUDGET_UNITS, every + " min: " + d.searches);
      assert.ok(d.maxRun <= MAX_PER_RUN);
    }
  }
  /* a run late in the day after a long outage catches up at most MAX_PER_RUN, not the whole backlog */
  const p = planRun({ tickers: searchList(M.radar), prev: { day: "2026-10-03", searches_today: 0, cursor: 0 }, nowMs: Date.parse("2026-10-04T05:00:00Z"), everyMin: 20 });
  assert.equal(p.pick.length, MAX_PER_RUN);
});

test("the count starts again at midnight Pacific, when YouTube resets the quota", () => {
  assert.equal(pacificClock(Date.parse("2026-10-03T06:59:00Z")).day, "2026-10-02");
  assert.equal(pacificClock(Date.parse("2026-10-03T07:01:00Z")).day, "2026-10-03");
  const p = planRun({ tickers: searchList(M.radar), prev: { day: "2026-10-02", searches_today: 79, cursor: 5 }, nowMs: Date.parse("2026-10-03T12:00:00Z"), everyMin: 20 });
  assert.ok(p.pick.length > 0, "yesterday's count does not block today");
  assert.equal(p.pick[0], searchList(M.radar)[5], "the rotation carries on where it stopped");
});

test("the day plan Alan reads", () => {
  const d = dayPlan(17, 20);
  assert.deepEqual(d, { runs_per_day: 72, searches_per_day: 79, units_per_day_max: 7979, per_ticker_per_day: 4.6, hours_between_turns: 5.2 });
  assert.equal(queryFor("MU"), "$MU stock");
  assert.equal(queryFor("BTCUSD"), "bitcoin price");
});

/* ---------- item 3: the Edit-tickers window ---------- */
test("yt-config no longer asks for the column that does not exist", () => {
  assert.doesNotMatch(code(CFG), /is_primary/);
  assert.match(CFG, /select\('ticker,cohort'\)/);
  assert.match(CFG, /source:'radar'/);
  assert.doesNotMatch(CFG, /from\('station_lists'\)\.(upsert|insert|update|delete)/);
});

test("RADAR names land in real groups, not one OTHER pile", () => {
  const by = {};
  for (const r of M.cohorts) (by[r.ticker] = by[r.ticker] || []).push(r.cohort);
  const groups = new Set(searchList(M.radar).map((t) => by[t] ? bestCohort(by[t]) : "OTHER"));
  assert.ok(groups.size >= 3, [...groups].join(","));
  assert.equal(bestCohort(["MEGA_CAP", "AI_HARDWARE", "TECH"]), "AI_HARDWARE");
  assert.equal(bestCohort(["CRYPTO"]), "CRYPTO");
  assert.equal(bestCohort(["LARGE_CAP", "TRAVEL_SERVICES", "GROWTH"]), "TRAVEL_SERVICES");
  assert.equal(bestCohort([]), "OTHER");
});

/* the page's own functions, run in a sandbox */
function grab(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i > 0, name + " found");
  let depth = 0, j = SRC.indexOf("{", i);
  for (; j < SRC.length; j++) { if (SRC[j] === "{") depth++; else if (SRC[j] === "}" && --depth === 0) break; }
  return SRC.slice(i, j + 1);
}
function grabConst(name) { const m = SRC.match(new RegExp("const " + name + " = [\\s\\S]*?;\\n")); assert.ok(m, name); return m[0]; }
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`var S = { ytFilt: "ALL" }; var YT_FEED = []; var YT_JOBS = null; var YT_CFG = {};
  function el() { return null; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  ${grabConst("YT_PUBLISHED_SHAPE")} ${grabConst("YT_TOPIC_WORDS")} ${grabConst("YT_BULL_WORDS")} ${grabConst("YT_BEAR_WORDS")}
  ${["ytAgo", "ytTickers", "ytAccounts", "ytHasAccount", "ytProvenance", "ytDecode", "ytTitle", "ytExtractHashtags", "ytHeuristicSentiment",
     "ytRawRowHTML", "ytFreshHTML", "ytCfgChip", "ytCfgRadarHTML", "ytModeBarHTML", "socSubtabsHTML"].map(grab).join("\n")}
  var SOC_TABS = [["SENTIMENT","SENTIMENT"],["YOUTUBE","YOUTUBE"]];`, sandbox);

test("the Edit button is off the strip under ECONOMIC and in the YouTube view bar", () => {
  sandbox.S.socTab = "YOUTUBE";
  assert.doesNotMatch(vm.runInContext("socSubtabsHTML()", sandbox), /ytedit/);
  assert.match(vm.runInContext("ytModeBarHTML()", sandbox), /data-act="ytedit"/);
});

test("the RADAR window shows every searched name, SPY/QQQ as never searched, and the plan", () => {
  const by = {};
  for (const r of M.cohorts) (by[r.ticker] = by[r.ticker] || []).push(r.cohort);
  const searched = searchList(M.radar);
  const d = { source: "radar", searched, excluded: NEVER_SEARCH, radar: M.radar.map((r) => ({ ticker: r.ticker, cohort: by[r.ticker] ? bestCohort(by[r.ticker]) : "OTHER", searched: searched.includes(r.ticker) })),
    plan: { ...dayPlan(searched.length, 20), every_min: 20, daily_quota: DAILY_QUOTA, cost_per_search: COST_PER_SEARCH, searches_today: 12 } };
  const html = vm.runInContext("ytCfgRadarHTML(" + JSON.stringify(d) + ")", sandbox);
  assert.equal((html.match(/sc-ytcfg__chip sel/g) || []).length, searched.length, "every searched name drawn, highlighted");
  assert.match(html, /\$SPY · \$QQQ/);
  assert.match(html, /79<\/b> searches a day across <b>17<\/b> names/);
  assert.doesNotMatch(html, /onclick="ytCfgToggle/, "read only — RADAR is changed in RADAR");
});

/* ---------- item 2: titles first ---------- */
test("the raw row: title is the big column, side columns are chips, the row opens the video", () => {
  const row = vm.runInContext(`ytRawRowHTML({ video_id: "abc", title: "NVDA breakout? Why AI chips rally &amp; more #stocks", channel: "Chan",
    tickers: "NVDA", published_at: "2026-10-02T20:00:00Z", subscription_accounts: ["scintilla"] })`, sandbox);
  assert.match(row, /^<div class="sc-ytraw__row" data-act="ytopenraw" data-vid="abc"/);
  assert.match(row, /class="sc-ytraw__c ttl" title="NVDA breakout\? Why AI chips rally &amp; more #stocks">/);
  assert.match(row, /<span class="sc-ytraw__chip tk">\$NVDA<\/span>/);
  assert.match(row, /<span class="sc-ytraw__chip sent">▲ BULL<\/span>/);
  assert.doesNotMatch(row, /chip tag">#NVDA/, "a ticker is not repeated as a hashtag");
  assert.match(row, /chip more">\+\d/, "more than two tags are counted, not printed");
  assert.match(SRC, /grid-template-columns:56px 128px minmax\(0,1fr\) 92px 128px 66px/);
  assert.match(SRC, /\.sc-ytraw__row \.sc-ytraw__c\.ttl\{[^}]*font-size:14px[^}]*-webkit-line-clamp:2/);
  assert.doesNotMatch(SRC, /\.sc-ytraw__head, \.sc-ytraw__row\{ min-width:640px; \}/, "no sideways scroll on a phone");
});

/* ---------- item 1: is it current? ---------- */
test("the updated line says what it knows and marks what is late", () => {
  const now = Date.parse("2026-10-03T02:00:00Z");
  vm.runInContext(`YT_FEED = [{ published_at: "2026-10-03T00:42:02+00:00" }, { published_at: "2026-10-02T20:00:00+00:00" }]; YT_JOBS = null;`, sandbox);
  let h = vm.runInContext(`ytFreshHTML(${now})`, sandbox);
  assert.match(h, /newest video posted <b>1h ago<\/b>/);
  assert.match(h, /job run times not published yet/);
  vm.runInContext(`YT_JOBS = { subscriptions: { at: "2026-10-03T01:55:02Z", rss_failed: 140 }, searches: { at: "2026-10-02T23:30:13Z" }, sentiment: { at: "2026-10-03T00:25:06Z" } };`, sandbox);
  h = vm.runInContext(`ytFreshHTML(${now})`, sandbox);
  assert.match(h, /subscribed channels checked <b>4m ago<\/b> · 140 channel feeds not answering/);
  assert.match(h, /ticker searches ran <b>2h ago<\/b>/);
  assert.match(h, /sentiment scored <b>1h ago<\/b>/);
  assert.equal((h.match(/is-late/g) || []).length, 1, "only the failing channel feeds are marked");
  vm.runInContext(`YT_JOBS.searches.at = "2026-10-02T16:00:00Z";`, sandbox);
  assert.equal((vm.runInContext(`ytFreshHTML(${now})`, sandbox).match(/is-late/g) || []).length, 2, "searches 10 h old are late");
});

test("the sweep counts channel feeds that do not answer instead of dropping them silently", () => {
  assert.match(RSS, /rss_failed: rssFailed/);
  assert.match(RSS, /if \(!r \|\| !r\.ok\) \{ rssFailed\+\+; return; \}/);
});
