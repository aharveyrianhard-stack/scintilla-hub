import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { stationAverages, entries, forward, seriesOf, inferTiming, timeRows, clusterBootstrap, shuffleBaseline, consistency, bandOf, segment, rng, EMA_WARMUP } from "../research/statistics/ladder.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DAY = 864e5, T0 = Date.UTC(2010, 0, 4);
/** Business-day bars from a close path; o = previous close unless a gap is given. */
function bars(closes, gaps = {}) {
  const out = []; let t = T0;
  for (let i = 0; i < closes.length; i++) {
    while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY;
    const o = i ? (gaps[i] != null ? closes[i - 1] * (1 + gaps[i]) : closes[i - 1]) : closes[i];
    out.push({ t, o, h: Math.max(o, closes[i]) * 1.001, l: Math.min(o, closes[i]) * 0.999, c: closes[i] }); t += DAY;
  }
  return out;
}
const walk = (n, seed, drift = 0.0003) => { const R = rng(seed); let c = 100; return Array.from({ length: n }, () => (c *= 1 + drift + (R() - 0.5) * 0.02)); };

test("S8: the cloud averages are station-clouds.js exactly — EMA seeded at the first close, hidden for 60 sessions", () => {
  const c = Array.from({ length: 250 }, (_, i) => 100 + Math.sin(i / 7) * 5 + i * 0.1);
  const m = stationAverages(c);
  let e13 = c[0], e21 = c[0];
  for (let i = 1; i < c.length; i++) { e13 = (2 / 14) * c[i] + (1 - 2 / 14) * e13; e21 = (2 / 22) * c[i] + (1 - 2 / 22) * e21; }
  assert.equal(m.e13[EMA_WARMUP - 1], null); assert.notEqual(m.e13[EMA_WARMUP], null);
  assert.ok(Math.abs(m.e13.at(-1) - e13) < 1e-9); assert.ok(Math.abs(m.e21.at(-1) - e21) < 1e-9);
  assert.equal(m.s50[48], null); assert.ok(Math.abs(m.s50[49] - c.slice(0, 50).reduce((a, b) => a + b) / 50) < 1e-9);
  assert.ok(Math.abs(m.s200.at(-1) - c.slice(-200).reduce((a, b) => a + b) / 200) < 1e-9);
});

test("S8: episodes count a run once; non-overlapping trades wait the holding period", () => {
  const sig = [0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1].map(Boolean);
  const { eps, non } = entries(sig, 3);
  assert.deepEqual(eps, [1, 5, 8]);
  assert.deepEqual(non, [1, 5, 8, 11]);
  const f = forward([100, 110, 99], 1); assert.ok(Math.abs(f[0] - 10) < 1e-9); assert.equal(f[2], null);
});

test("S8: no look-ahead — changing the future leaves every past reading unchanged", () => {
  const c = walk(1400, 3), b1 = bars(c), c2 = c.slice(); for (let i = 1100; i < c2.length; i++) c2[i] *= 1.5;
  const A = seriesOf(b1), B = seriesOf(bars(c2));
  for (let i = 0; i < 1100; i++) {
    assert.equal(A.pct[i], B.pct[i]);
    for (const k of ["e21", "s200"]) assert.equal(A.distPct[k][i], B.distPct[k][i]);
  }
  assert.ok(A.pct.slice(0, 263).every((v) => v == null), "the RSI rank needs 250 prior readings");
  assert.equal(bandOf(5), "p0-10"); assert.equal(bandOf(95), "p90-100"); assert.equal(bandOf(100), "p90-100");
});

test("S8: a hole of more than a year drops the history before it (QQQ's QQQQ years)", () => {
  const b = bars(walk(300, 5)); for (let i = 150; i < b.length; i++) b[i].t += 400 * DAY;
  const s = segment(b); assert.equal(s.dropped, 150); assert.match(s.note, /dropped/);
});

test("S8: report timing is read from the opening gaps; weekends are either; unclear ones take the name's neighbours", () => {
  const c = walk(400, 9, 0);
  const b = bars(c, { 300: 0.08, 351: 0.07 });                 // a morning gap on bar 300, an evening one into bar 351
  const S = seriesOf(b);
  assert.equal(inferTiming(S, S.dates[300]).call, "BMO");
  assert.equal(inferTiming(S, S.dates[350]).call, "AMC");
  assert.equal(inferTiming(S, S.dates[200]).call, "ambiguous");
  const sat = new Date(Date.parse(S.dates[210]) + DAY); while (sat.getUTCDay() !== 6) sat.setTime(sat.getTime() + DAY);
  assert.equal(inferTiming(S, sat.toISOString().slice(0, 10)).call, "either");
  const rows = timeRows(S, [{ date: S.dates[300], report_time: null }, { date: S.dates[350], report_time: null }, { date: S.dates[200], report_time: "BMO" }, { date: S.dates[220], report_time: null }]);
  assert.equal(rows[0].report_time, "BMO"); assert.match(rows[0].report_time_source, /inferred: opening gap/);
  assert.equal(rows[1].report_time, "AMC");
  assert.equal(rows[2].report_time_source, "export");
  assert.equal(rows[3].report_time_source, "unknown", "one BMO and one AMC neighbour is a tie, and fewer than 3 clear calls: left unknown");
});

test("S8: the clustered bootstrap resamples whole months and is repeatable", () => {
  const items = []; for (let m = 0; m < 40; m++) for (let k = 0; k < 5; k++) items.push({ ret: m % 4 ? 1 : -1, cluster: m });
  const a = clusterBootstrap(items, 300, 1), b = clusterBootstrap(items, 300, 1);
  assert.deepEqual(a, b); assert.equal(a.clusters, 40);
  assert.ok(a.ci95[0] < 75 && a.ci95[1] > 75);
  assert.deepEqual(clusterBootstrap([{ ret: 1, cluster: 1 }, { ret: 2, cluster: 2 }], 50).ci95, [100, 100]);
  const s = shuffleBaseline([{ taken: 200, candidates: Array.from({ length: 1000 }, (_, i) => (i % 5 ? 1 : -1)) }], 200, 3);
  assert.ok(Math.abs(s.mean - 80) < 1.5 && s.p95 > s.mean);
  assert.deepEqual(consistency([1, -1, 2, 3, -2, 1, 1, 1, 1, -1], 8), { of: 8, same: 6 });
});

test("S8: the build runs end to end on made-up bars and keeps its promises", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s8fix-")), f5 = path.join(dir, "candles-f5");
  fs.mkdirSync(f5);
  const put = (sym, seed) => fs.writeFileSync(path.join(f5, sym + ".json"), JSON.stringify({ series: bars(walk(1500, seed)) }));
  put("SPY", 1); put("AAA", 2); put("BBB", 3);
  const spyDates = seriesOf(bars(walk(1500, 1))).dates;
  const reps = []; for (let i = 400; i < 1480; i += 63) for (const t of ["AAA", "BBB"]) reps.push({ ticker: t, date: spyDates[i], eps_actual: 1, report_time: i % 2 ? "AMC" : "BMO" });
  fs.writeFileSync(path.join(dir, "export.json"), JSON.stringify(reps));
  const out = path.join(dir, "out.json");
  execFileSync(process.execPath, [path.join(here, "../research/statistics/s8-ladder.mjs"), "--cache-root", dir, "--export", path.join(dir, "export.json"), "--out", out], { stdio: "pipe" });
  const j = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(j.names.count, 2);
  assert.ok(j.indexes.SPY.rows["rsi<=5|all|20"].ep.n > 0);
  assert.equal(j.indexes.QQQ.missing, true);
  const any = j.names.fwd["any|all|20"].ep.full, low = j.names.fwd["rsi<=70|all|20"].ep.full;
  assert.ok(any.n > low.n, "the any-day line counts every usable day");
  assert.ok(j.names.to_report["any|all"].full.n > 0 && j.names.to_report["any|all"].full.n <= reps.length);
  for (const c of j.combos.chosen) { assert.ok(c.disc.n >= 100 && c.conf.n >= 100); assert.equal(c.trades.length <= 5, true); }
  assert.match(j.price_basis, /price only/); assert.match(j.survivorship, /survivors/);
  fs.rmSync(dir, { recursive: true, force: true });
});

const page = path.join(here, "../deliverables/20260927/ladder/LADDER.html");
test("S8 page: five plain sentences first, the way back, the dark look, the honesty section", { skip: !fs.existsSync(page) }, () => {
  const html = fs.readFileSync(page, "utf8");
  const lead = html.slice(html.indexOf('<ol class="lead">'), html.indexOf("</ol>", html.indexOf('<ol class="lead">')));
  assert.equal((lead.match(/<li>/g) || []).length, 5);
  assert.ok(html.indexOf('<ol class="lead">') < html.indexOf("<h2>"), "the sentences open the page");
  assert.match(html, /data-scnav-slot/);
  assert.match(html, /<h2>6 · What could be wrong<\/h2>/);
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  for (const m of css.matchAll(/font(?:-size)?:\s*(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `font ${m[1]}px`);
  for (const m of css.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
    if (m[1].toUpperCase() === "00FFA3" || m[1].toUpperCase() === "FF2D55") continue;   // up / down
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `#${m[1]} is not a dark-look grey`);
  }
});

test("S8 on the statistics page: one self-contained section that reads the small summary", () => {
  const html = fs.readFileSync(path.join(here, "../research/statistics/index.html"), "utf8");
  assert.match(html, /<section class="s8" id="s8">/);
  assert.match(html, /S8 · LADDER/);
  assert.match(html, /fetch\("\.\/data\/s8-summary\.json"/);
  assert.doesNotMatch(html, /s8-ladder\.json"/, "the page never loads the 7.5 MB file");
  assert.match(html, /href="\.\.\/\.\.\/deliverables\/20260927\/ladder\/LADDER\.html"/);
});
