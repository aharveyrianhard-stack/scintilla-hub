/* Guards for the "how unusual" read. Offline: no network, no fixtures beyond this file. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rsi14, levelStats, percentileCurve, findGaps, buildSymbol } from "../tools/how-unusual/build.mjs";

const HUB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the page and the builder compute the same RSI, digit for digit", () => {
  const m = HUB.match(/function rsi14\(c, p\)\{[\s\S]*?return out; \}/);
  assert.ok(m, "the page must carry its own copy of rsi14");
  const pageRsi = new Function("return (" + m[0].replace(/^function rsi14/, "function") + ")")();
  let x = 100; const closes = [];
  for (let i = 0; i < 400; i++) { x *= 1 + Math.sin(i * 1.7) * 0.012 + Math.cos(i * 0.37) * 0.006; closes.push(x); }
  const a = rsi14(closes), b = pageRsi(closes, 14);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    if (a[i] == null) { assert.equal(b[i], null); continue; }
    assert.ok(Math.abs(a[i] - b[i]) < 1e-9, `differ at ${i}: ${a[i]} vs ${b[i]}`);
  }
});

test("RSI is 100 when nothing ever falls, and stays inside 0..100", () => {
  const up = Array.from({ length: 60 }, (_, i) => 100 + i);
  assert.equal(rsi14(up).at(-1), 100);
  const noisy = Array.from({ length: 300 }, (_, i) => 50 + Math.sin(i / 3) * 10);
  for (const v of rsi14(noisy)) if (v != null) assert.ok(v >= 0 && v <= 100);
});

test("a run counts once, not once per day", () => {
  // closes engineered to fall hard, sit low for several days, then recover
  const closes = [];
  for (let i = 0; i < 40; i++) closes.push(100 + i);          // climb
  for (let i = 0; i < 25; i++) closes.push(140 - i * 3);      // fall through 40 and stay
  for (let i = 0; i < 40; i++) closes.push(65 + i);           // recover
  const rsi = rsi14(closes);
  const L = levelStats(closes, rsi, 40, "below");
  assert.ok(L.days > L.episodes, "a multi-day run must show more days than episodes");
  assert.equal(L.episodes, 1, "one uninterrupted run below the level is one time");
});

test("the percentile curve rises and covers the measured range", () => {
  const closes = Array.from({ length: 800 }, (_, i) => 100 * (1 + Math.sin(i / 11) * 0.2 + i / 4000));
  const c = percentileCurve(rsi14(closes));
  assert.equal(c.length, 101);
  for (let k = 1; k <= 100; k++) assert.ok(c[k] >= c[k - 1], `curve dips at ${k}`);
});

test("a hole in the history is found and named", () => {
  const day = 864e5, t0 = Date.UTC(2020, 0, 1);
  const series = [];
  for (let i = 0; i < 30; i++) series.push({ t: t0 + i * day, c: 100 });
  for (let i = 0; i < 30; i++) series.push({ t: t0 + (i + 400) * day, c: 100 });
  const gaps = findGaps(series);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].calendar_days, 371);
});

test("what followed is measured forward only, never off the end of the data", () => {
  const closes = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 5) * 12);
  const series = closes.map((c, i) => ({ t: Date.UTC(2020, 0, 1) + i * 864e5, c }));
  const rec = buildSymbol({ t: "T", name: "test", kind: "index", moves: "it" }, series, "TEST");
  for (const L of rec.levels) {
    assert.ok(L.fwd60.n <= L.episodes, "cannot measure more outcomes than episodes");
    assert.ok(L.fwd5.n >= L.fwd60.n, "the longer horizon loses the most recent episodes");
  }
});

test("the shipped history file says what it is measured on", () => {
  const doc = JSON.parse(fs.readFileSync(new URL("../data/how-unusual.json", import.meta.url), "utf8"));
  assert.ok(doc.built_utc && doc.source && doc.method);
  assert.equal(doc.symbols.length, 9);
  for (const s of doc.symbols) {
    assert.ok(s.history.daily_bars > 1000, `${s.t} has too little history to claim anything`);
    assert.ok(s.history.rsi_days_measured <= s.history.daily_bars);
    assert.ok(s.latest && s.latest.rsi >= 0 && s.latest.rsi <= 100);
    for (const L of s.levels) {
      assert.ok(L.episodes <= L.days, `${s.t} ${L.level}: more runs than days`);
      assert.ok(L.days_pct >= 0 && L.days_pct <= 100);
    }
  }
  const qqq = doc.symbols.find((s) => s.t === "QQQ");
  assert.equal(qqq.history.gaps.length, 1, "QQQ's missing years must stay visible in the data");
});
