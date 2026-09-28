import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { pivotPoints, swings, cleanBars, lineReached, cloudState, bandOf200, bucketOf, bandStudy, declines, seriesOf, leadLag, rsiLadder, PIVOT_LEN } from "../research/statistics/s9-research.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..");
const DAY = 864e5, T0 = Date.UTC(2015, 0, 5);
/** Bars from a close path with a small wick each side; weekends skipped. */
function bars(closes, wick = 0.002) {
  const out = []; let t = T0;
  for (let i = 0; i < closes.length; i++) {
    while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : closes[i];
    out.push({ t, o, h: Math.max(o, closes[i]) * (1 + wick), l: Math.min(o, closes[i]) * (1 - wick), c: closes[i], v: 1000 }); t += DAY;
  }
  return out;
}
/** A triangle wave: up 30 bars to 130, down 30 bars to 100, four times. */
const tri = (() => { const c = []; for (let k = 0; k < 4; k++) { for (let i = 0; i <= 30; i++) c.push(100 + i); for (let i = 29; i > 0; i--) c.push(100 + i); } return c; })();

test("S9: pivots are symmetric-window extremes on the wick and swings alternate high, low, high", () => {
  const b = bars(tri), h = b.map((x) => x.h), l = b.map((x) => x.l);
  const sw = swings(h, l, PIVOT_LEN);
  for (let i = 1; i < sw.length; i++) assert.notEqual(sw[i].type, sw[i - 1].type, "alternation");
  const highs = sw.filter((p) => p.type === "H"); assert.ok(highs.length >= 3 && highs.length <= 4);
  for (const p of highs) assert.ok(Math.abs(p.price - 130 * 1.002) < 1e-9, "each swing high is the wave's peak");
  const p = pivotPoints(h, l, PIVOT_LEN); for (const q of p) for (let j = 1; j <= PIVOT_LEN; j++) {
    if (q.type === "H") assert.ok(h[q.k] > h[q.k - j] && h[q.k] >= h[q.k + j]); else assert.ok(l[q.k] < l[q.k - j] && l[q.k] <= l[q.k + j]);
  }
});

test("S9: a decline's depth, length and rebound come from the swing points, and the low is only confirmed 10 bars later", () => {
  const b = bars(tri), S = seriesOf(b), recs = declines(S, PIVOT_LEN);
  assert.ok(recs.length >= 2);
  for (const r of recs) {
    assert.ok(r.hiK < r.loK && r.bars === r.loK - r.hiK);
    assert.ok(Math.abs(r.depth - (r.loPrice / r.hiPrice - 1) * 100) < 0.02);
    assert.equal(r.confirmedAt, S.dates[Math.min(r.loK + PIVOT_LEN, S.dates.length - 1)]);
    if (r.rebound != null) assert.ok(r.rebound > 0 && r.retrace > 0);
  }
  assert.equal(bucketOf(-2.9), "0–3%"); assert.equal(bucketOf(-3), "3–5%"); assert.equal(bucketOf(-10), "10–20%"); assert.equal(bucketOf(-45), "20%+");
});

test("S9: impossible wicks are clamped to the body and listed; honest wicks are left alone", () => {
  const b = bars([100, 101, 102, 103]); b[1] = { ...b[1], l: 11 }; b[2] = { ...b[2], h: 1020 };
  const { bars: c, cleaned } = cleanBars(b, 0.25);
  assert.equal(cleaned.length, 2); assert.equal(cleaned[0].fixed, "low"); assert.equal(cleaned[1].fixed, "high");
  assert.equal(c[1].l, Math.min(c[1].o, c[1].c)); assert.equal(c[2].h, Math.max(c[2].o, c[2].c));
  assert.equal(c[0], b[0]); assert.equal(c[3], b[3]);
});

test("S9: the line reached is the lowest-priced cloud line the wick touched; cloud order words follow the Station flags", () => {
  const ma = { e13: [105], e21: [104], s50: [102], s200: [98] };
  assert.equal(lineReached(ma, 103, 0), "e21"); assert.equal(lineReached(ma, 101, 0), "s50"); assert.equal(lineReached(ma, 104.5, 0), "e13"); assert.equal(lineReached(ma, 97, 0), "s200"); assert.equal(lineReached(ma, 106, 0), "none");
  const st = cloudState(ma, 106, 0); assert.equal(st.order, "e13>e21>s50>s200"); assert.ok(st.bull && !st.bear && st.f && st.m && st.o); assert.equal(st.position, "above all");
  const bear = cloudState({ e13: [90], e21: [92], s50: [95], s200: [100] }, 93, 0); assert.ok(bear.bear); assert.equal(bear.position, "between");
});

test("S9: the 200-day bands and the breaking point follow the written rule", () => {
  assert.equal(bandOf200(-12), "more than 10% below"); assert.equal(bandOf200(-5), "2–5% below"); assert.equal(bandOf200(-6), "5–10% below"); assert.equal(bandOf200(0), "0–2% above"); assert.equal(bandOf200(2), "2–5% above"); assert.equal(bandOf200(15), "more than 10% above");
  // 260 flat days, then a 12% drop over 12 days, 20 flat days, back above in 15 days
  const c = Array(260).fill(100); for (let i = 1; i <= 12; i++) c.push(100 - i); for (let i = 0; i < 20; i++) c.push(88); for (let i = 1; i <= 15; i++) c.push(88 + i); for (let i = 0; i < 130; i++) c.push(103);
  const S = seriesOf(bars(c)), st = bandStudy(S);
  const b5 = st.breaks.find((r) => r.X === 5); assert.equal(b5.n, 1); assert.ok(b5.events[0].further < -6 && b5.events[0].further > -8, "further fall from the first close below -5%"); assert.ok(b5.events[0].toReclaim > 20);
  const b0 = st.breaks.find((r) => r.X === 0); assert.equal(b0.n, 1);
  const b15 = st.breaks.find((r) => r.X === 15); assert.equal(b15.n, 0);
});

test("S9: lead/lag pairs the nearest low within the window and reads the offset in days", () => {
  const byU = { SPY: [{ hi: "2020-02-19", lo: "2020-03-23", depth: -35, rsiLow: 29, line: "e13", vixMax: 82, rebound: 35 }], QQQ: [{ lo: "2020-03-23", depth: -30, rsiLow: 35 }], IWM: [{ lo: "2020-03-19", depth: -43, rsiLow: 27 }], BTCUSD: [{ lo: "2020-03-13", depth: -63, rsiLow: 26 }, { lo: "2020-01-03", depth: -20, rsiLow: 30 }] };
  const L = leadLag(byU, 10);
  assert.equal(L.rows[0].others.IWM.offset, -4); assert.equal(L.rows[0].others.BTCUSD.offset, -10); assert.equal(L.rows[0].firstEquity, "IWM"); assert.equal(L.summary.BTCUSD.earlier, 1);
});

test("S9: the RSI ladder is a 5%-step quantile of the readings", () => {
  const rsi = Array.from({ length: 1000 }, (_, i) => i / 10); const L = rsiLadder(rsi);
  assert.equal(L.steps.length, 19); assert.ok(Math.abs(L.steps[0].rsi - 5) < 0.2); assert.ok(Math.abs(L.steps[9].rsi - 50) < 0.2);
});

test("S9: the deliverable exists, carries its five sections, the BACK / CLOSE pair, and no white", () => {
  const f = path.join(root, "deliverables/20260927/research-program/RESEARCH-PROGRAM.html"); assert.ok(fs.existsSync(f));
  const h = fs.readFileSync(f, "utf8");
  for (const s of ["1 · The research questions", "2 · Exact measurement definitions", "3 · Data each question needs", "4 · Proof of method", "5 · The execution plan", "What could be wrong", "What was not done"]) assert.ok(h.includes(s), s);
  assert.ok(h.includes('class="scnav"') || h.includes("scnav-css"), "BACK / CLOSE pair");
  assert.ok(!/#fff\b|#ffffff|white/i.test(h.replace(/<!--[\s\S]*?-->/g, "")), "no white");
  const j = JSON.parse(fs.readFileSync(path.join(root, "research/statistics/data/s9-research.json"), "utf8"));
  assert.ok(j.instruments.SPY.declines > 50 && j.band.SPY.full.breaks.length === 12);
});
