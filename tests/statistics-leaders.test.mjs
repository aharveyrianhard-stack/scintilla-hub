import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { cutAtHoles, percentiles, pctRank, s9Series } from "../research/statistics/leaders-lib.mjs";
import { swings } from "../research/statistics/s9-research.mjs";
import { yearBlock, companiesOf, holdingsReturn } from "../research/statistics/leaders-concentration.mjs";
import { ttmGrowth, summarize } from "../research/statistics/leaders-traits.mjs";
import { prep, volBetween, forwardPath, basketPath, align, realtimeUpSwings, WHist, singleBlock } from "../research/statistics/leaders-rotation.mjs";
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
  assert.ok(imgs.length >= 10);
  for (const i of imgs) { assert.ok(fs.existsSync(path.join(DIR, i)), i); const svg = fs.readFileSync(path.join(DIR, i), "utf8"); assert.ok(svg.startsWith("<svg") && !/#fff\b|#ffffff|white/i.test(svg), i + " is a dark chart with no white"); }
  const C = JSON.parse(fs.readFileSync(path.join(DIR, "leaders-concentration.json"), "utf8"));
  for (const q of C.quarterCheck) assert.ok(Math.abs(q.gap) < 1.5, `measured quarter ${q.from} adds up to the index within 1.5 pts`);
});

test("leaders: rotation events are built in real time — a later, higher high cannot remove or move an earlier decision", () => {
  const v = [];
  for (let k = 0; k <= 10; k++) v.push(30 - k);                    // a low at bar 10
  for (let k = 11; k <= 20; k++) v.push(20 + (k - 10));            // first high at bar 20
  v.push(29.5, 29.2, 29.4);                                         // shallow dip: no pivot low
  for (let k = 24; k <= 40; k++) v.push(29.4 + (k - 23) * 0.6);     // a higher high at bar 40
  for (let k = 41; k <= 55; k++) v.push(v[40] - (k - 40));
  for (let k = 56; k <= 70; k++) v.push(v[55] + (k - 55) * 0.5);
  const h = v, l = v.map((x) => x - 1);
  // the S9 swing list (alternation + refinement, which uses later pivots) drops the first high altogether
  assert.ok(!swings(h, l, 3).some((p) => p.type === "H" && p.k === 20), "S9 swings merge the bar-20 high into the later bar-40 high");
  const full = realtimeUpSwings(h, l, 3);
  assert.deepEqual(full.map((e) => [e.kL, e.kH, e.kc]), [[10, 20, 23], [10, 40, 43]]);
  // every prefix sees exactly the events already confirmed inside it, unchanged
  for (let n = 5; n <= h.length; n++) {
    const pre = realtimeUpSwings(h.slice(0, n), l.slice(0, n), 3);
    assert.deepEqual(pre, full.filter((e) => e.kc <= n - 1), `prefix ${n}`);
  }
});

test("leaders: weighted histogram percentiles, and one-name switching counts every event once", () => {
  const H = new WHist(); for (let i = 1; i <= 100; i++) H.add(i);
  assert.equal(H.q(0.5), 50); assert.equal(H.q(0.9), 90); assert.equal(H.summary().aboveZero, 100);
  const W = new WHist(); W.add(-10, 0.5); W.add(10, 0.5); W.add(20, 1);
  assert.equal(W.q(0.25), -10); assert.equal(W.q(0.5), 10); assert.equal(W.q(0.75), 20);
  const path = (r, d) => ({ ret: Array.from({ length: 251 }, () => r), dd: Array.from({ length: 251 }, () => d) });
  const at = (r, d) => ({ ret: [r, r, r, r], dd: [d, d, d, d] });
  // event 1: two candidates (+30, -10), hold +10; event 2: one candidate (+0), hold +20 → weights ½, ½, 1
  const ev = [{ hold: path(10, -20), sw: path(10, -5), spy: path(5, -5), oneCalm: [at(30, -5), at(-10, -15)], oneAny: [at(10, -20)] },
              { hold: path(20, -20), sw: path(10, -5), spy: path(5, -5), oneCalm: [at(0, -10)], oneAny: [at(20, -20)] }];
  const S = singleBlock(ev);
  assert.equal(S.oneCalm.ret[3].weight, 2, "each event weighs 1 however many candidates it has");
  assert.equal(S.oneCalm.minusHold[3].aboveZero, 25, "only the +30 name (weight ½ of 2) beat its hold");
  assert.equal(S.oneAny.minusHold[3].p50, 0);
});

test("leaders: the RSI percentile reads the whole prior history, not a rolling 3-year window", () => {
  // 1,200 sessions of a steady rise, then 400 of a steady fall: a rolling 756-reading window would forget the early
  // highs; the expanding one keeps them. Today's reading is never inside its own sample.
  const t0 = Date.UTC(2010, 0, 4), bars = [];
  let p = 100; for (let i = 0; i < 1600; i++) { p *= i < 1200 ? (i % 3 ? 1.004 : 0.995) : (i % 3 ? 0.998 : 1.003); bars.push({ t: t0 + i * 864e5, o: p, h: p * 1.005, l: p * 0.995, c: p, v: 1 }); }
  const S = s9Series(bars);
  assert.equal(S.pct[200], null, "fewer than 250 earlier readings → no percentile");
  assert.ok(S.pct[300] != null);
  const rsi = S.rsi, i = 1599, prior = rsi.slice(0, i).filter((x) => x != null);
  const below = prior.filter((x) => x < rsi[i]).length, eq = prior.filter((x) => x === rsi[i]).length;
  assert.ok(Math.abs(S.pct[i] - 100 * (below + eq / 2) / prior.length) < 1e-9, "percentile against every earlier reading");
});

test("leaders: pre-2020 concentration years carry their coverage and are marked as floors", () => {
  const f = path.join(DIR, "leaders-concentration.json"); if (!fs.existsSync(f)) return;
  const C = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const y of C.years.filter((x) => x.regime === "estimated")) {
    assert.ok(y.coverage && y.coverage.floor === true && y.coverage.weight > 0 && y.coverage.weight < 100, `${y.year} coverage`);
    assert.equal(y.coverage.points, y.sumAll);
  }
  const h = fs.readFileSync(path.join(DIR, "LEADERS.html"), "utf8");
  assert.ok(!h.includes("larger than either"), "no unsupported claim about the size of the rise");
  assert.ok(h.includes("at least") && h.includes("floor"));
});
