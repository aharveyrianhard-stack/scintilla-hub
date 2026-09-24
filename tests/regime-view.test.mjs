/* M44-REGIME — the broad market read.
   Alan, 23 Sep: "are we sure the yield curve is accurate wait it says september 22… it cannot go
   stale again". So the rule this file exists to hold down is: a number older than its own cadence
   reads NO FEED. Nothing here reaches a network — the live route, the stored table and the clock
   are all handed in, so "now" is never "whenever the suite happens to run". */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const START = "/* ---- Room 9b · REGIME view (M44", END = "/* ---- Room 3 · COMPANY";
const src = page.slice(page.indexOf(START), page.indexOf(END));
assert.ok(src.length > 4000, "the REGIME block must be in the page");

const EXPORTS = ["rgCurve","rgScore","rgSessionsBehind","rgRowAt","rgChart","rgTrendCls","rgRenderCatalysts",
  "rgParagraph","RG","RG_TENORS","RG_LIVE_MAP","RG_LIVE_STALE_MS","rgMarketOpen","rgFmt","rgPct"];
function load(nowISO) {
  const ctx = {
    console, Math, Date: class extends Date {                 // a fixed clock
      constructor(...a) { return a.length ? new (Date.bind.apply(Date, [null, ...a]))() : new Date(nowISO); }
      static now() { return Date.parse(nowISO); }
      static parse(s) { return Date.parse(s); }
      static UTC(...a) { return Date.UTC(...a); }
    },
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    el: () => null, pg: async () => [], scJSONOnce: async () => ({}), scScint: () => {},
    setInterval: () => 0, clearInterval: () => {}, fetch: async () => { throw new Error("no network in tests"); },
    document: { hidden: false }, SECFS_BTN: "", S: {},
  };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(src + "\n;({" + EXPORTS.map((k) => k + ":typeof " + k + '!=="undefined"?' + k + ":undefined").join(",") + "})", ctx);
  return vm.runInContext("({" + EXPORTS.map((k) => k + ":" + k).join(",") + "})", ctx);
}
test("the regime view writes nothing, and reads only what it names", () => {
  /* the same guarantee tests/economic-port.test.mjs holds over the releases room, carried into
     this view: it may READ, and it may not write anything, anywhere. */
  for (const w of [/method\s*:\s*"(POST|PATCH|PUT|DELETE)"/, /operatorWrite\(/, /pgPatch\(/, /\/rpc\//,
                   /localStorage\.setItem/, /sessionStorage/])
    assert.doesNotMatch(src, w, "no write path: " + w);
  const tables = new Set([...src.matchAll(/"([a-z_]+)\?select=/g)].map((m) => m[1]));
  assert.deepEqual([...tables].sort(), ["catalyst_odds", "treasury_rates"]);
  const urls = [...src.matchAll(/fetch\("([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(urls, ["/data/regime/regime-static.json"], "one file, no other network of its own");
  assert.match(src, /SC_CHART_API\s*\+\s*"\/macro/, "the live tenors come from the board's own macro route");
});

const STORED = [
  { date: "2026-09-23", m1: 3.99, m2: 4.10, m3: 4.19, m6: 4.31, y1: 4.49, y2: 4.85, y3: 4.97, y5: 4.99, y7: 5.05, y10: 5.11, y20: 5.45, y30: 5.40 },
  { date: "2026-09-22", m1: 3.98, m2: 4.09, m3: 4.17, m6: 4.28, y1: 4.44, y2: 4.70, y3: 4.82, y5: 4.86, y7: 4.93, y10: 4.96, y20: 5.32, y30: 5.28 },
  { date: "2026-09-16", m1: 3.95, m2: 4.05, m3: 4.12, m6: 4.22, y1: 4.38, y2: 4.61, y3: 4.72, y5: 4.75, y7: 4.82, y10: 4.86, y20: 5.20, y30: 5.16 },
  { date: "2026-08-22", m1: 3.90, m2: 4.00, m3: 4.05, m6: 4.15, y1: 4.30, y2: 4.50, y3: 4.60, y5: 4.65, y7: 4.72, y10: 4.76, y20: 5.10, y30: 5.06 },
];
const liveAt = (iso, price) => ({ quote: { price, prev_close: price - 0.1, price_observation_utc: iso } });

test("a live tenor is used, and carries the time it was observed", () => {
  const R = load("2026-09-23T18:30:00Z");                       // 14:30 ET, market open
  R.RG.rows = STORED; R.RG.live = { US10Y: liveAt("2026-09-23T18:29:40Z", 5.115) };
  const p = R.rgCurve().find((x) => x.k === "y10");
  assert.equal(p.v, 5.115);
  assert.equal(p.src, "LIVE");
  assert.equal(p.feed, "LIVE");
  assert.equal(p.ts, "2026-09-23T18:29:40Z");
});

test("a live point that stopped updating inside a session reads NO FEED, not an old number", () => {
  const R = load("2026-09-23T18:30:00Z");
  R.RG.rows = STORED; R.RG.live = { US10Y: liveAt("2026-09-23T17:00:00Z", 5.115) };   // 90 minutes old
  const p = R.rgCurve().find((x) => x.k === "y10");
  assert.equal(p.feed, "NO FEED");
  assert.equal(p.v, null, "a stale live point must not print its last value as if it were now");
});

test("outside the session the same old point is the close, not a fault", () => {
  const R = load("2026-09-24T01:30:00Z");                       // 21:30 ET, market shut
  R.RG.rows = STORED; R.RG.live = { US10Y: liveAt("2026-09-23T18:59:54Z", 5.115) };
  assert.equal(R.rgCurve().find((x) => x.k === "y10").feed, "LIVE");
});

test("tenors the live route does not carry come from the stored close", () => {
  const R = load("2026-09-23T18:30:00Z");
  R.RG.rows = STORED; R.RG.live = { US10Y: liveAt("2026-09-23T18:29:40Z", 5.115) };
  const two = R.rgCurve().find((x) => x.k === "y2");
  assert.equal(two.v, 4.85);
  assert.equal(two.src, "CLOSE");
  assert.equal(two.feed, "CLOSE");
});

test("a stored curve more than one session behind reads NO FEED", () => {
  const R = load("2026-09-25T18:30:00Z");                       // two sessions after the newest row
  R.RG.rows = STORED; R.RG.live = {};
  const c = R.rgCurve();
  assert.ok(c.every((p) => p.feed === "NO FEED"), "every stored point is NO FEED once the table falls behind");
  assert.equal(R.rgSessionsBehind("2026-09-23"), 2);
});

test("the comparison curves take the nearest stored day at or before the target", () => {
  const R = load("2026-09-23T18:30:00Z");
  R.RG.rows = STORED;
  assert.equal(R.rgRowAt(7).date, "2026-09-16");
  assert.equal(R.rgRowAt(30).date, "2026-08-22");
  assert.equal(R.rgRowAt(3650), null, "no row that old — say nothing rather than invent one");
});

test("the regime score counts only the measures that arrived, and says how many", () => {
  const R = load("2026-09-24T01:30:00Z");
  R.RG.rows = STORED; R.RG.live = {}; R.RG.stat = null;
  const bare = R.rgScore();
  assert.equal(bare.of, 6);
  assert.ok(bare.n < 6, "with no measured file only the curve can score");
  R.RG.stat = { credit: { latest: { div: -6.91, breadth: -4.27, spy: 4.71, hyg: -2.19 }, froth: { composite: 38.6 } },
                liquidity: { latest: { total: 16.681, yoy_pct: -7.26 }, leads: [{ lead_months: 3, r: 0.33, r2: 0.109 }] },
                cycles: { month_of_year: [{ label: "Nasdaq Composite", months: [{ month: 9, mean: -0.68, n: 56 }] }] } };
  const full = R.rgScore();
  assert.equal(full.n, 6);
  assert.ok(full.score < 0, "credit behind, breadth behind and liquidity shrinking cannot read as a rising tide");
  assert.equal(full.tide, full.score <= -20 ? "FALLING" : "MIXED");
  assert.ok(/midterm year/.test(R.rgParagraph(full)), "the paragraph states the cycle it is in");
});

test("the 3m10y spread is measured from the points actually on screen", () => {
  const R = load("2026-09-23T18:30:00Z");
  R.RG.rows = STORED;
  R.RG.live = { US10Y: liveAt("2026-09-23T18:29:40Z", 5.115), US3M: liveAt("2026-09-23T18:29:40Z", 4.028) };
  const sc = R.rgScore();
  assert.equal(Math.round(sc.s3), 109);        // live 10y less live 3m
  assert.equal(Math.round(sc.s2), 27);         // live 10y less the stored 2y close
});

test("a chart with nothing in it says NO FEED instead of drawing an empty box", () => {
  const R = load("2026-09-24T01:30:00Z");
  assert.match(R.rgChart([{ pts: [] }], {}), /rg-nofeed/);
  const svg = R.rgChart([{ pts: [[0, 1], [1, 2]], cls: "rg-up" }], {});
  assert.match(svg, /<path class="rg-l rg-up"/);
  assert.match(svg, /rg-axis/, "a line without its scale is not a reading");
});

test("every chart line follows the board's colour rule: last step up is green, down is red", () => {
  const R = load("2026-09-24T01:30:00Z");
  assert.equal(R.rgTrendCls([[0, 1], [1, 2]]), "rg-up");
  assert.equal(R.rgTrendCls([[0, 2], [1, 1]]), "rg-dn");
});

test("catalysts: nothing stored and no snapshot is NO FEED, and a snapshot says it is one read", () => {
  const R = load("2026-09-24T01:30:00Z");
  R.RG.cats = { rows: [] }; R.RG.stat = null;
  assert.match(R.rgRenderCatalysts(), /NO FEED/);
  R.RG.stat = { catalysts: { taken_utc: "2026-09-24T01:40:00Z", rows: [
    { catalyst: "midterms_house", source: "polymarket", market: "m", question: "Democrats take the House?", outcome: "Yes", probability: 0.925, volume: 7e6, end_date: "2026-11-04" }] } };
  const h = R.rgRenderCatalysts();
  assert.match(h, /one-off read/);
  assert.match(h, /93%/);
});
