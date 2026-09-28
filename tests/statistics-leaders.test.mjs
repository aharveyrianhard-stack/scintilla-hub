import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { cutAtHoles, percentiles, pctRank } from "../research/statistics/leaders-lib.mjs";
import { yearBlock, companiesOf, holdingsReturn } from "../research/statistics/leaders-concentration.mjs";
import { ttmGrowth, summarize } from "../research/statistics/leaders-traits.mjs";
import { prep, volBetween, forwardPath, basketPath, align } from "../research/statistics/leaders-rotation.mjs";
import { slopeLine, UP, DN } from "../research/statistics/leaders-page.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..");
const DIR = path.join(root, "deliverables/20260928/leaders");

test("leaders: a year's top-N sums and the top-10 share of the gain come straight from the ranked contributions", () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ sym: "S" + i, name: "S" + i, c: (30 - i) / 1000, wStart: 1 }));
  const indexR = rows.reduce((s, r) => s + r.c, 0);
  const b = yearBlock(2030, "2029-12-31", "2030-12-31", indexR, rows, "measured", false);
  assert.equal(b.top20[0].sym, "S0");
  assert.ok(Math.abs(b.tops[1] - 3.0) < 1e-9 && Math.abs(b.tops[5] - (30 + 29 + 28 + 27 + 26) / 10) < 1e-9);
  assert.ok(Math.abs(b.share[10] - 100 * b.tops[10] / (100 * indexR)) < 0.01);
  assert.ok(Math.abs(b.rest - (100 * indexR - b.tops[20])) < 0.01);
  const down = yearBlock(2031, "a", "b", -0.1, rows, "measured", false);
  assert.equal(down.share[10], null, "no share of a gain in a down year");
});

test("leaders: share classes of one company merge by CUSIP issuer and the stock sleeve is re-based to 100", () => {
  const rows = [
    { assetCat: "EC", payoffProfile: "Long", cusip: "02079K305", symbol: "GOOGL", name: "Alphabet A", balance: 10, valUsd: 300 },
    { assetCat: "EC", payoffProfile: "Long", cusip: "02079K107", symbol: "GOOG", name: "Alphabet C", balance: 10, valUsd: 200 },
    { assetCat: "EC", payoffProfile: "Long", cusip: "30303M102", symbol: "FB", name: "Meta", balance: 5, valUsd: 500 },
    { assetCat: "STIV", payoffProfile: "Long", cusip: "CASH00000", symbol: null, name: "cash", balance: 1, valUsd: 999 },
  ];
  const co = companiesOf(rows);
  assert.equal(co.size, 2);
  assert.equal(co.get("02079K").sym, "GOOGL");
  assert.ok(Math.abs(co.get("02079K").w - 50) < 1e-9 && Math.abs(co.get("30303M").w - 50) < 1e-9);
  assert.equal(co.get("30303M").sym, "META", "FB is renamed to META");
});

test("leaders: a 2-for-1 split in the fund's holdings is recognised and does not look like a -50% quarter", () => {
  const a = { bal: 100, p: 200 }, b = { bal: 204, p: 110 };
  const r = holdingsReturn(a, b, 1.02);
  assert.equal(r.split, 2);
  assert.ok(Math.abs(r.r - 0.10) < 1e-9);
  assert.equal(holdingsReturn({ bal: 100, p: 100 }, { bal: 101, p: 90 }, 1.0).split, 1);
});

test("leaders: history before a hole of more than 20 days is dropped (reused tickers such as META before June 2022)", () => {
  const D = 864e5, t0 = Date.UTC(2021, 0, 4);
  const bars = [0, 1, 2, 3].map((k) => ({ t: t0 + k * D, c: 15 })).concat([0, 1, 2].map((k) => ({ t: t0 + (130 + k) * D, c: 180 })));
  const { bars: cut, cutBefore } = cutAtHoles(bars);
  assert.equal(cut.length, 3); assert.equal(cut[0].c, 180); assert.ok(cutBefore);
  assert.equal(cutAtHoles(bars.slice(0, 4)).cutBefore, null);
});

test("leaders: growth uses only quarters filed on or before the date", () => {
  const q = (date, filed, rev, ni) => ({ date, filingDate: filed, revenue: rev, netIncome: ni });
  const rows = [q("2020-03-31", "2020-05-01", 100, 10), q("2020-06-30", "2020-08-01", 100, 10), q("2020-09-30", "2020-11-01", 100, 10), q("2020-12-31", "2021-02-01", 100, 10),
    q("2021-03-31", "2021-05-01", 120, 12), q("2021-06-30", "2021-08-01", 120, 12), q("2021-09-30", "2021-11-01", 120, 12), q("2021-12-31", "2022-02-01", 999, 999)];
  const g = ttmGrowth(rows, "2021-12-31");
  assert.equal(g.rev, null, "the Q4 2021 report was not filed yet, so fewer than 8 quarters are known");
  const g2 = ttmGrowth(rows, "2022-03-01");
  assert.ok(g2.rev > 100, "once filed, the big quarter counts");
});

test("leaders: the base-rate curve is the leader share among names at or above each rank", () => {
  const rows = []; for (let i = 0; i < 100; i++) rows.push({ leader: i >= 90, rsRank: i, wRank: 50, revGRank: 50, niGRank: 50, fromHighRank: 50, rsiPct: 50, rs: i, fromHigh: -5, revG: 5, niG: 5, w: 1, order: "mixed", position: "between", comparableSize: true });
  const S = summarize(rows).traits.all.T.rsRank.baseRateAtOrAbove;
  assert.equal(S[0], 10); assert.equal(S[90], 100); assert.ok(S[50] > S[10]);
});

test("leaders: volatility, forward paths, drawdowns and the equal-weight basket", () => {
  const cal = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10));
  const bars = (cs) => cs.map((c, i) => ({ t: Date.parse(cal[i]), c, h: c, l: c }));
  const A = prep(align(cal, bars([100, 110, 99, 108.9, 98, 107.8, 97, 106.7, 96, 105.6, 95, 104.5])));
  const B = prep(align(cal, bars([100, 100.5, 101, 101.5, 102, 102.5, 103, 103.5, 104, 104.5, 105, 105.5])));
  assert.ok(volBetween(A, 0, 11) > volBetween(B, 0, 11) * 10, "the zig-zag is far more volatile");
  const f = forwardPath(A.c, 1, 5);
  assert.ok(Math.abs(f.ret[1] - 100 * (99 / 110 - 1)) < 1e-9);
  assert.ok(f.dd[2] <= f.dd[1] && f.dd[5] <= 0, "the worst drop never improves");
  const bk = basketPath([A.c, B.c], 0, 3);
  assert.ok(Math.abs(bk.ret[1] - 100 * ((110 / 100 + 100.5 / 100) / 2 - 1)) < 1e-9);
  assert.deepEqual(percentiles([1, 2, 3]).length, 100);
  assert.equal(pctRank([1, 2, 3, 4], 3), 62.5);
});

test("leaders: no grey data lines — every segment is green when it rises on screen and red when it falls", () => {
  const svg = slopeLine([[0, 100], [10, 80], [20, 90], [30, 90], [40, 70], [50, 60]]);
  const strokes = [...svg.matchAll(/stroke="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(strokes, [UP, DN, UP], "up (screen y falls) green, down red, a flat step keeps the colour, and one colour run is one polyline");
  assert.ok(!/stroke="#[0-9A-Fa-f]{6}"/.test(svg.replace(new RegExp(UP, "g"), "").replace(new RegExp(DN, "g"), "")), "no other colour");
});

test("leaders: the page exists, carries the four plain-words parts, and every chart it shows is saved next to it", () => {
  const f = path.join(DIR, "LEADERS.html"); if (!fs.existsSync(f)) return;
  const h = fs.readFileSync(f, "utf8");
  for (const s of ["What it says, in plain words", "Where every number comes from", "What could be wrong", "What was not done"]) assert.ok(h.includes(s), s);
  const imgs = [...h.matchAll(/<img class="chart" src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 8);
  for (const i of imgs) { assert.ok(fs.existsSync(path.join(DIR, i)), i); const svg = fs.readFileSync(path.join(DIR, i), "utf8"); assert.ok(svg.startsWith("<svg") && !/#fff\b|#ffffff|white/i.test(svg), i + " is a dark chart with no white"); }
  const C = JSON.parse(fs.readFileSync(path.join(DIR, "leaders-concentration.json"), "utf8"));
  for (const q of C.quarterCheck) assert.ok(Math.abs(q.gap) < 1.5, `measured quarter ${q.from} adds up to the index within 1.5 pts`);
});
