/* Comps on the live company view (C1, 29 Sep · deliverables/20260929/comps-live): the ladder arithmetic — a snapshot
   in, the same numbers out — the way-B band, the outlier readings, the compare set, and the Hub's hook. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ladder, priceAt, denominator, stepBand, stepUpside, stepSentence, outlierReadings, repriceRow, compareSet, ROW_KEYS, MARKS, median } from "../deliverables/20260929/comps-live/ladder.mjs";
import { middleHalfBand } from "../deliverables/20260928/comps-r3-labels/labels-r3.mjs";
import { cohortChoice, ROWS } from "../deliverables/20260929/comps-live/snapshot-live.mjs";

const here = (p) => new URL(p, import.meta.url);
const snap29 = (t) => JSON.parse(readFileSync(here(`../deliverables/20260929/comps-live/snapshot-${t}-2026-09-29.json`), "utf8"));
const snap28 = (t) => JSON.parse(readFileSync(here(`../deliverables/20260928/comps-r3-labels/snapshot-${t}-2026-09-28.json`), "utf8"));
const MU = snap29("MU"), NVDA = snap29("NVDA"), GEV = snap29("GEV");
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("a snapshot in, the same numbers out: every implied price the snapshot states is reproduced by step 4's arithmetic (29 Sep and 28 Sep, MU / NVDA / GEV)", () => {
  for (const S of [MU, NVDA, GEV, snap28("MU"), snap28("NVDA"), snap28("GEV")]) {
    const L = ladder(S);
    let checked = 0;
    for (const r of L.steps[3].rows) for (const l of r.lines) if (l.stated != null) { close(l.price, l.stated, 1e-6); checked++; }
    assert.ok(checked >= 25, `${S.ticker}: ${checked} prices checked`);
  }
});

test("step 4 names the denominator and its arithmetic for every row; a missing figure is a named blank, not a number", () => {
  for (const k of ROW_KEYS) { const d = denominator(k, MU); assert.equal(d.key, k); assert.ok(d.word && d.formula); assert.ok(d.value > 0, k); }
  const peg = denominator("peg", GEV);
  assert.equal(peg.value, null); assert.match(peg.why, /growth/);
  assert.equal(priceAt("peg", 1.2, GEV), null, "no invented price on a blank denominator");
  assert.equal(priceAt("pe_ttm", null, MU), null);
  close(priceAt("pe_ttm", 10, MU), 10 * MU.eps_ttm);
  close(priceAt("ev_sales", 10, MU), (10 * MU.revenue_ttm - MU.net_debt) / MU.shares);
  close(priceAt("ps", 10, MU), 10 * MU.revenue_ttm / MU.shares);
  assert.equal(priceAt("ev_ebitda", 0.0001, { ...MU, net_debt: 1e15 }), 0, "a negative implied value is shown as zero, as on the live page");
});

test("step 3's percentiles are the snapshot's bands, and the sorted peers are there to check a median by eye", () => {
  const s3 = ladder(MU).steps[2];
  for (const r of s3.rows) {
    const row = MU.rows.find((x) => x.key === r.key);
    assert.deepEqual(r.band, row.band);
    const vals = r.sorted.map((p) => p.multiple);
    for (let i = 1; i < vals.length; i++) assert.ok(vals[i] >= vals[i - 1]);
    if (vals.length) close(median(vals), r.band.median);
  }
});

test("step 5 is way B exactly: the median of the 25ths, of the medians, of the 75ths — the approved round-3 middleHalfBand", () => {
  const s5 = stepBand(MU);
  const B = middleHalfBand(MU.rows);
  close(s5.band.lo, B.lo); close(s5.band.mid, B.mid); close(s5.band.hi, B.hi);
  close(s5.band.lo, median(s5.q1s.map((p) => p.price)));
  close(s5.band.mid, median(s5.medians.map((p) => p.price)));
  close(s5.band.hi, median(s5.q3s.map((p) => p.price)));
  assert.equal(s5.used.length, 6, "MU: all six rows price it");
  for (const list of [s5.q1s, s5.medians, s5.q3s]) for (let i = 1; i < list.length; i++) assert.ok(list[i].price >= list[i - 1].price, "sorted");
  const g = stepBand(GEV);
  assert.equal(g.used.length, 5); assert.equal(g.left_out.length, 1); assert.equal(g.left_out[0].key, "peg");
});

test("way B on a hand-made snapshot: 3 rows → the middle values", () => {
  const rows = [
    { key: "pe_ttm", label: "a", ok: true, ends: { q1: { price: 100 }, median: { price: 150 }, q3: { price: 200 } } },
    { key: "ps", label: "b", ok: true, ends: { q1: { price: 120 }, median: { price: 130 }, q3: { price: 300 } } },
    { key: "peg", label: "c", ok: true, ends: { q1: { price: 80 }, median: { price: 170 }, q3: { price: 250 } } },
    { key: "pe_fwd", label: "d", ok: false, reason: "blank", ends: {} },
  ];
  const s5 = stepBand({ rows, price: 100 }, rows);
  assert.equal(s5.band.lo, 100); assert.equal(s5.band.mid, 150); assert.equal(s5.band.hi, 250);
  assert.deepEqual(s5.band.envelope, { lo: 80, hi: 300 });
  assert.deepEqual(s5.left_out, [{ key: "pe_fwd", label: "d", why: "blank" }]);
  const u = stepUpside({ price: 100 }, s5.band);
  close(u.lo.pct, 0); close(u.mid.pct, 50); close(u.hi.pct, 150); close(u.hi.dollars, 150);
  const s7 = stepSentence({ ticker: "T", price: 100 }, s5.band, u);
  assert.equal(s7.where, "low-half");
  assert.match(s7.sentence, /^T at \$100 sits between the low edge and the centre of its peers' band, \$100 to \$250 with the centre at \$150 \(\+50% to the centre\)/);
});

test("step 6: upside = edge ÷ today − 1, in % and $, for the low edge, the centre and the high edge", () => {
  const L = ladder(MU), B = L.steps[4].band, U = L.steps[5];
  close(U.lo.pct, (B.lo / MU.price - 1) * 100); close(U.mid.pct, (B.mid / MU.price - 1) * 100); close(U.hi.pct, (B.hi / MU.price - 1) * 100);
  close(U.mid.dollars, B.mid - MU.price);
  assert.ok(U.lo.pct < U.mid.pct && U.mid.pct < U.hi.pct);
});

test("step 7 places the company in words, and the reading follows the price", () => {
  const L = ladder(MU);
  assert.equal(L.steps[6].where, MU.price < L.steps[4].band.lo ? "below" : "low-half");
  assert.match(L.steps[6].sentence, /MU at \$[\d,]+ sits/);
  const dear = stepSentence({ ticker: "X", price: 1000 }, { lo: 100, mid: 150, hi: 200 }, stepUpside({ price: 1000 }, { lo: 100, mid: 150, hi: 200 }));
  assert.equal(dear.where, "above"); assert.match(dear.sentence, /dear against the peers/);
  assert.match(stepSentence({ ticker: "X" }, null, null).sentence, /cannot be placed/);
});

test("outliers are named and the band is stated with and without them; nothing is dropped silently", () => {
  const O = outlierReadings(MU);
  assert.ok(O.outliers.length >= 1, "MU's cohort has at least one Tukey outlier");
  for (const o of O.outliers) { assert.ok(o.ticker && o.label && ["low", "high"].includes(o.side)); assert.ok(o.fence); }
  assert.ok(O.with && O.without);
  assert.ok(O.nm.length >= 1, "the not-meaningful peers are named (ARM, AXTI…)");
  assert.ok(O.missing.some((m) => m.key === "pe_ttm"), "the trailing-P/E blanks are named");
  // the without-band is way B on the repriced rows
  const B2 = middleHalfBand(O.rows_without);
  close(O.without.lo, B2.lo); close(O.without.mid, B2.mid); close(O.without.hi, B2.hi);
  // a repriced row keeps the arithmetic: its ends are priceAt of its new percentiles
  const r = O.rows_without.find((x) => MU.rows.find((y) => y.key === x.key).outliers.out.length);
  for (const k of MARKS) close(r.ends[k].price, priceAt(r.key, r.band[k], MU));
  assert.ok(r.peers.every((p) => !MU.rows.find((y) => y.key === r.key).outliers.out.some((o) => o.ticker === p.ticker)));
  const g = outlierReadings(GEV);
  assert.equal(g.outliers.length, 0, "GEV's rows have fewer than four peers: nobody is called an outlier");
  assert.equal(g.changed, false);
});

test("repriceRow on two peers: the ends are the two, the median their mean, who sets what is named", () => {
  const row = MU.rows.find((r) => r.key === "pe_ttm");
  const r = repriceRow(row, [{ ticker: "A", multiple: 10 }, { ticker: "B", multiple: 30 }], MU);
  assert.equal(r.n, 2); assert.equal(r.band.median, 20); assert.deepEqual(r.ends.median.who, ["A", "B"]); assert.deepEqual(r.ends.min.who, ["A"]);
  close(r.ends.median.price, 20 * MU.eps_ttm); assert.equal(r.ok, true);
  assert.equal(repriceRow(row, [{ ticker: "A", multiple: 10 }], MU).ok, false);
});

test("compare: every company's band as upside from its own price, one % axis with today at 0, ranked by the upside to the centre", () => {
  const C = compareSet([MU, NVDA, GEV]);
  assert.equal(C.companies.length, 3);
  assert.ok(C.axis.lo <= 0 && C.axis.hi >= 0);
  for (const c of C.companies) { close(c.upside.mid.pct, (c.band.mid / c.price - 1) * 100); assert.ok(c.sentence); }
  const mids = C.ranked.map((t) => C.companies.find((c) => c.ticker === t).upside.mid.pct);
  for (let i = 1; i < mids.length; i++) assert.ok(mids[i - 1] >= mids[i]);
  assert.ok(C.axis.hi >= Math.max(...C.companies.map((c) => c.upside.hi.pct)));
});

test("step 1 names the cohort, the peers and the exclusions; step 2 carries every peer with a state on every row", () => {
  const L = ladder(MU), s1 = L.steps[0], s2 = L.steps[1];
  assert.equal(s1.cohort, "SEMICONDUCTORS");
  assert.equal(s1.peers.length, MU.members.length - 1 - MU.excluded.length);
  assert.ok(!s1.peers.some((p) => p.ticker === "MU"));
  assert.equal(s2.table.length, s1.peers.length);
  for (const p of s2.table) for (const k of ROW_KEYS) assert.ok(["in", "nm", "missing", "absent"].includes(p.cells[k].state));
  const inCount = s2.table.filter((p) => p.cells.pe_ttm.state === "in").length;
  assert.equal(inCount, MU.rows.find((r) => r.key === "pe_ttm").n);
  assert.ok(s2.table.every((p) => p.dates && p.dates.price), "every peer carries its price date");
  const g = ladder(GEV).steps[1];
  assert.ok(g.table.some((p) => p.cells.pe_ttm.state === "nm"), "GEV's cohort: BE and CCJ are above the cap, named");
  assert.ok(g.table.some((p) => p.cells.pe_ttm.state === "missing"), "the loss-makers are blank, named");
});

test("the 29 Sep snapshots carry what the ladder needs and were taken with today's prices", () => {
  for (const S of [MU, NVDA, GEV]) {
    assert.equal(S.today, "2026-09-29");
    assert.deepEqual(S.rows.map((r) => r.key), ROWS);
    assert.ok(S.members.length > 1 && S.names[S.ticker]);
    assert.equal(S.quotes_error, null, "today's prices were reached");
    assert.equal(S.price_from, "chart API /quotes");
    assert.ok(S.dates.revenue_to && S.peer_dates[S.ticker]);
  }
});

test("cohortChoice: the coordinator's defaults for the four named companies, then the first non-size tag", () => {
  assert.equal(cohortChoice("MU", ["MEGA_CAP", "SEMICONDUCTORS"]).cohort, "SEMICONDUCTORS");
  assert.deepEqual(cohortChoice("XYZ", ["LARGE_CAP", "SOFTWARE", "AI"]), { cohort: "SOFTWARE", options: ["SOFTWARE", "AI"] });
  assert.equal(cohortChoice("XYZ", ["LARGE_CAP"]).cohort, null);
  assert.equal(cohortChoice("XYZ", ["A", "B"], "b").cohort, "B");
});

test("the Hub's ESTIMATES tab carries the COMPS section and mounts the module; the deliverable and its shots exist", () => {
  const html = readFileSync(here("../index.html"), "utf8");
  assert.match(html, /estConvictionHTML\(data\) \+ estPTGaugeHTML\(data\) \+ estCompsHTML\(data\)/);
  assert.match(html, /estSechead\("02·c", "Comps"/);
  assert.match(html, /import\("\/deliverables\/20260929\/comps-live\/live\.mjs"\)/);
  assert.match(html, /id="scCompsLive"/);
  assert.ok(existsSync(here("../deliverables/20260929/comps-live/COMPS-LIVE.html")));
  const page = readFileSync(here("../deliverables/20260929/comps-live/COMPS-LIVE.html"), "utf8");
  assert.match(page, /<!-- scnav ·/, "the BACK / CLOSE pair is on the page");
  for (const f of ["MU-1680.png", "MU-390.png", "CMP-1680.png", "CMP-390.png"]) assert.ok(existsSync(here("../deliverables/20260929/comps-live/shots/" + f)), f);
});
