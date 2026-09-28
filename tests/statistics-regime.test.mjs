// Market-regime research (28 Sep 2026): fixture tests for the arithmetic, the calendars and the parsers, plus a shape check on the built JSON.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "../research/statistics/regime/regime-lib.mjs";
import { pairStudy, fomcDates, marketOdds, fedStudy, seasonality, adjustSpinoff } from "../research/statistics/regime/regime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("third Friday and the expiry session (Thursday when the Friday was shut)", () => {
  assert.equal(L.thirdFriday("2026-09"), "2026-09-18");
  assert.equal(L.thirdFriday("2026-01"), "2026-01-16");
  const set = new Set(["2025-04-16", "2025-04-17", "2025-04-21"]);   // Good Friday 2025-04-18 was the third Friday
  assert.equal(L.expirySession("2025-04", set), "2025-04-17");
});

test("pre-holiday sessions: a weekday with no bar after the session", () => {
  const dates = ["2026-07-01", "2026-07-02", "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-13"];
  assert.deepEqual(L.preHolidaySessions(dates).map((i) => dates[i]), ["2026-07-02"]);   // 3 July 2026 (observed holiday); weekends do not count
});

test("Fed meeting labels → decision day (last day of the meeting)", () => {
  assert.equal(L.fedDecisionDate("January 29-30", 2013), "2013-01-30");
  assert.equal(L.fedDecisionDate("Jan/Feb 31-1", 2017), "2017-02-01");
  assert.equal(L.fedDecisionDate("April/May 30-1", 2019), "2019-05-01");
  assert.equal(L.fedDecisionDate("March 22", 2005), "2005-03-22");
  assert.equal(L.fedDecisionDate("nonsense", 2005), null);
});

test("fomcDates keeps scheduled meetings only and joins FMP's decision rows", () => {
  const html = `<h5>January 28-29 Meeting - 2020</h5><h5>March 2 (unscheduled) Meeting - 2020</h5><h5>March 15 (unscheduled) Meeting - 2020</h5><h5>March 17-18 (cancelled) Meeting - 2020</h5><h5>April 28-29 Meeting - 2020</h5><h5>May 3 Conference Call - 2020</h5>`;
  const cur = `<div>2027 FOMC Meetings</div><p>January</p><p>26-27</p><p>March 16-17*</p><p>January 25-26</p>`;
  const econ = [{ event: "Fed Interest Rate Decision", date: "2020-04-29 18:00:00", previous: 0.25, actual: 0.25, change: 0 }, { event: "Fed Interest Rate Decision", date: "2020-03-15 21:00:00", change: -1 }];
  const m = fomcDates({ 2020: html, current: cur }, econ);
  assert.deepEqual(m.map((x) => x.d), ["2020-01-29", "2020-04-29", "2027-01-27", "2027-03-17"]);   // the trailing "January 25-26" (next year's footnote) is ignored
  assert.equal(m.find((x) => x.d === "2020-04-29").change, 0);
  assert.deepEqual(m.fmpNotOnFedSchedule, ["2020-03-15"]);
});

test("runs merge short gaps; entries need a gap before a new visit", () => {
  const f = [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1].map(Boolean);
  assert.deepEqual(L.runs(f, 0), [{ s: 1, e: 2 }, { s: 5, e: 5 }, { s: 10, e: 10 }]);
  assert.deepEqual(L.runs(f, 2), [{ s: 1, e: 5 }, { s: 10, e: 10 }]);
  assert.deepEqual(L.entries(f, 3), [1, 10]);
});

test("drawdowns: peak, trough, recovery and an open episode", () => {
  const v = [100, 110, 99, 104, 111, 105, 100, 101];
  const dd = L.drawdowns(v, 3);
  assert.equal(dd.length, 2);
  assert.deepEqual([dd[0].peak, dd[0].trough, dd[0].rec], [1, 2, 4]);
  assert.equal(Math.round(dd[0].depth * 10) / 10, -10);
  assert.deepEqual([dd[1].peak, dd[1].trough, dd[1].rec], [4, 6, null]);
});

test("percentile rule counts half of the ties; versus() reads the interval", () => {
  assert.equal(L.percentileOf([1, 2, 3, 4], 3), 62.5);
  assert.equal(L.versus({ ci: [1, 2] }, { mean: 0.5 }), "above");
  assert.equal(L.versus({ ci: [-1, 0.2] }, { mean: 0.5 }), "below");
  assert.equal(L.versus({ ci: [0, 1] }, { mean: 0.5 }), "overlaps");
});

test("bootstrap intervals are reproducible and contain the mean", () => {
  const xs = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 3 + 1);
  const a = L.bootMeanCI(xs), b = L.bootMeanCI(xs);
  assert.deepEqual(a, b);
  const m = L.mean(xs); assert.ok(a[0] < m && m < a[1]);
  const keys = xs.map((_, i) => `2020-${String(1 + (i % 12)).padStart(2, "0")}`);
  const c = L.clusterMeanCI(xs, keys); assert.ok(c[0] < m && m < c[1]);
  assert.equal(L.bootMeanCI([1, 2]), null);   // too few to say anything
});

test("monthly returns drop the unfinished month", () => {
  const s = [{ d: "2026-06-30", c: 100 }, { d: "2026-07-31", c: 110 }, { d: "2026-08-31", c: 99 }, { d: "2026-09-25", c: 120 }];
  const m = L.monthlyReturns(s, "2026-08");
  assert.deepEqual(m.map((x) => x.ym), ["2026-07", "2026-08"]);
  assert.equal(Math.round(m[1].ret * 10) / 10, -10);
});

test("trimPlaceholders drops flat zero-volume bars at both ends only", () => {
  const f = { o: 1, h: 1, l: 1, c: 1, v: 0 }, r = { o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };
  assert.equal(L.trimPlaceholders([f, f, r, f, r, f]).length, 3);
});

test("pairStudy: ratio, stretch vs its 200-day, extremes and what followed", () => {
  const n = 900, d = Array.from({ length: n }, (_, i) => L.addDays("2020-01-01", i));
  const cw = Array.from({ length: n }, (_, i) => 100 + i * 0.05);
  const ew = cw.map((x, i) => x * (1 + 0.1 * Math.sin(i / 40)));
  const p = pairStudy(d, ew, cw);
  assert.equal(p.sessions, n);
  assert.ok(p.lows.length >= 2 && p.highs.length >= 2);
  assert.ok(p.thresholds.low < 0 && p.thresholds.high > 0);
  // a low-stretch visit on a sine is followed by the ratio rising 63 sessions later
  assert.ok(p.lowsSummary.ratio63.median > 0);
  assert.equal(p.weekly.at(-1)[0], d.at(-1));
});

test("marketOdds reads Kalshi and Polymarket snapshots without inventing numbers", () => {
  const kalshi = { events: [{ event_ticker: "KXFEDDECISION-26OCT", title: "Fed decision in Oct 2026?", strike_date: "2026-10-28T18:00:00Z", markets: [{ yes_sub_title: "Hike 25bps", last_price_dollars: "0.6700", yes_bid_dollars: "0.6700", yes_ask_dollars: "0.6800", volume_fp: "1040086.32" }] }] };
  const poly = [{ title: "Fed Decision in October?", slug: "x", endDate: "2026-10-29", volume: 15323884.8, volume24hr: 450766.5, markets: [{ groupItemTitle: "25 bps increase", outcomePrices: '["0.655","0.345"]', bestBid: 0.65, bestAsk: 0.66, volume: "3858723.3" }] }];
  const o = marketOdds({ kalshi, polyOct: poly, polyDec: null, fetchedAt: "2026-09-28T13:18:14Z", zq: { symbol: "ZQUSD", price: 95.955, timestamp: 1790600535, contractMonth: null } });
  assert.equal(o.kalshi[0].markets[0].last, 0.67);
  assert.equal(o.polymarket[0].markets[0].yes, 0.655);
  assert.equal(o.futures.impliedRate, 4.045);
  assert.equal(o.futures.contractMonth, null);
});

test("fedStudy windows around a decision day", () => {
  const d = [], c = []; let x = 100; for (let i = 0; i < 400; i++) { d.push(L.addDays("1994-01-03", i)); x *= 1.001; c.push(x); }
  const g = d.map((dd, i) => ({ d: dd, c: c[i] }));
  const f = fedStudy(g, [{ d: d[100] }, { d: d[200] }, { d: d[300] }, { d: d[150] }, { d: d[250] }, { d: "2030-01-01" }]);
  assert.equal(f.meetings, 5);
  assert.ok(Math.abs(f.windows.day.meetings.mean - 0.1) < 1e-6 + 0.01);
});

test("seasonality on a synthetic index: every month present, option-expiry weeks found", () => {
  const g = []; let x = 100; for (let i = 0; i < 365 * 40; i++) { const d = L.addDays("1985-01-01", i); const w = new Date(d + "T12:00:00Z").getUTCDay(); if (w === 0 || w === 6) continue; x *= 1.0002; g.push({ d, c: x }); }
  const s = seasonality(g);
  assert.equal(s.months.all.by.length, 12);
  assert.ok(s.opex.expiryWeek.n > 300);
  assert.ok(s.months.all.by.every((m) => m.up === 100));
});

test("the built JSON has every section and the stated as-of date", () => {
  const f = path.join(root, "research/statistics/data/regime-20260928.json");
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  assert.equal(j.asOf, "2026-09-25");
  for (const k of ["pairs", "vix", "credit", "macro", "season", "fed", "odds", "dataFaults", "sources"]) assert.ok(j[k], k);
  assert.ok(j.pairs.length >= 15);
  assert.ok(j.vix.invertedPct > 0 && j.vix.invertedPct < 50);
  assert.ok(j.fed.meetings > 250);
  assert.ok(j.odds.kalshi.length && j.odds.polymarket.length);
  // no key-looking strings leaked into the data file
  assert.ok(!/apikey|api_key|FMP_API_KEY=/.test(fs.readFileSync(f, "utf8")));
});

test("spin-off correction scales the bars before the date so that day's move matches SPY", () => {
  const bars = [{ d: "2016-09-15", o: 21, h: 21, l: 21, c: 21 }, { d: "2016-09-16", o: 20.7, h: 20.8, l: 20.6, c: 20.7 }, { d: "2016-09-19", o: 19.3, h: 19.4, l: 19.2, c: 19.3 }];
  const spy = [{ d: "2016-09-16", c: 200 }, { d: "2016-09-19", c: 202 }];
  const a = adjustSpinoff(bars, spy, { date: "2016-09-19" });
  assert.ok(Math.abs(a.bars[2].c / a.bars[1].c - 1.01) < 1e-9);
  assert.equal(a.bars[2].c, 19.3);
});
