/* N9 · point-in-time universe: the membership walk, the price guards, the old-ticker join, coverage, and the page. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMembership, membersOn, isMember, everMembers, dailyDelta, normSym, monthEnd } from "../research/statistics/point-in-time/pit-core.mjs";
import { guardSeries, repairedBars, dayRet, REAL_MOVES } from "../research/statistics/point-in-time/pit-data.mjs";
import { joinOld, stretchCoverage, expandBars } from "../research/statistics/point-in-time/build-universe.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("membership: today's list walked back through the change log", () => {
  const M = buildMembership(["AAA", "BBB", "NEW", "BRK-B"], [
    { date: "2020-06-01", symbol: "NEW", removedTicker: "OLD" },
    { date: "2010-03-01", symbol: "BBB", removedTicker: "GONE" },
    { date: "2008-01-01", symbol: "GHOST", removedTicker: "" },
    { date: "2006-05-01", symbol: "SWAP", removedTicker: "SWAP" }, // same-day add + remove of one ticker: no anomaly; the ticker counts as a member before
    { date: "1999-01-01", symbol: "AAA", removedTicker: "ANCIENT" }, // before the floor: ignored
  ], { floor: "2003-01-01" });
  assert.deepEqual(membersOn(M.intervals, "2021-01-04"), ["AAA", "BBB", "BRK.B", "NEW"]);
  assert.deepEqual(membersOn(M.intervals, "2015-01-02"), ["AAA", "BBB", "BRK.B", "OLD"]);
  assert.deepEqual(membersOn(M.intervals, "2005-01-03"), ["AAA", "BRK.B", "GONE", "OLD", "SWAP"]);
  assert.ok(isMember(M.intervals, "GONE", "2010-02-28") && !isMember(M.intervals, "GONE", "2010-03-01"));
  assert.deepEqual(M.anomalies.map((a) => a.sym), ["GHOST"]);
  assert.deepEqual(everMembers(M.intervals, "2003-01-01"), ["AAA", "BBB", "BRK.B", "GONE", "NEW", "OLD", "SWAP"]);
  const dd = dailyDelta(M.intervals, ["2010-02-26", "2010-03-01", "2010-03-02"]);
  assert.equal(dd.length, 2); assert.deepEqual(dd[1], { d: "2010-03-01", n: 4, add: ["BBB"], rem: ["GONE"] });
  assert.ok(guardSeries("Y", rows([["2008-09-05", 7], ["2008-09-08", 0.7]]), [], null).s.skip.has("2008-09-08")); // exactly 1-for-10: read as a split
  assert.equal(normSym("bf/b"), "BF.B");
  assert.deepEqual(monthEnd([{ date: "2020-01-02", v: 1 }, { date: "2020-01-31", v: 2 }, { date: "2020-02-03", v: 3 }]).map((r) => r.v), [2, 3]);
});

const rows = (pairs) => pairs.map(([d, c]) => [d, c, c, c, c, 100]);

test("guard 1: a long hole means another security — cut, unless the company left the index then", () => {
  const r = rows([["2005-01-03", 10], ["2005-01-04", 11], ["2006-01-17", 40], ["2006-01-18", 41]]);
  const cut = guardSeries("MS", r, [], null);
  assert.equal(cut.s.dates[0], "2006-01-17"); assert.equal(cut.flags[0].kind, "cut-before-hole");
  const kept = guardSeries("CEG", r, ["2005-01-10"], null);
  assert.equal(kept.s.dates[0], "2005-01-03"); assert.ok(kept.s.skip.has("2006-01-17"));
});

test("guard 2: an unconfirmed split-sized jump is skipped and repaired; a confirmed crash and the named collapses stay", () => {
  const r = rows([["2014-03-31", 100], ["2014-04-01", 101], ["2014-04-02", 100], ["2014-04-03", 50], ["2014-04-04", 52]]);
  const caps = { dates: ["2014-03-31", "2014-04-04"], v: [1e12, 1.04e12] }; // cap flat across the halving → a split
  const g = guardSeries("GOOG", r, [], caps);
  assert.ok(g.s.skip.has("2014-04-03"));
  const i = g.s.dates.indexOf("2014-04-03"); assert.equal(dayRet(g.s, i - 1, i), 0);
  const rep = repairedBars(g.s); assert.equal(rep[0].c, 50); assert.equal(rep.at(-1).c, 52);
  const crash = guardSeries("AIG", r, [], { dates: ["2014-03-31", "2014-04-04"], v: [1e12, 0.52e12] });
  assert.ok(!crash.s.skip.has("2014-04-03"));
  const nocap = guardSeries("X", rows([["2008-09-05", 7], ["2008-09-08", 1.2]]), [], null); // −83%, not within 4% of a split ratio
  assert.ok(!nocap.s.skip.has("2008-09-08"));
  assert.ok(REAL_MOVES.has("FNMA|2008-09-08"));
  const named = guardSeries("FNMA", rows([["2008-09-05", 7.04], ["2008-09-08", 0.73]]), [], { dates: ["2008-08-29", "2008-09-30"], v: [7e9, 7e9] });
  assert.ok(!named.s.skip.has("2008-09-08")); assert.equal(named.flags[0].kind, "real-move-kept");
});

test("old-ticker bars join in front only when the join is continuous", () => {
  const cur = [{ d: "2020-01-02", c: 100 }, { d: "2020-01-03", c: 101 }];
  assert.equal(joinOld([{ d: "2019-12-31", c: 98 }], cur).length, 3);
  assert.equal(joinOld([{ d: "2019-12-31", c: 40 }], cur), null);
  assert.equal(joinOld([{ d: "2020-01-03", c: 98 }], cur), null);
});

test("coverage of a member stretch and the compact bar format", () => {
  const b = expandBars({ t0: Date.parse("2020-01-02T00:00:00Z"), rows: [[0, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 1], [5, 1, 1, 1, 3, 1]] });
  assert.deepEqual(b.map((x) => x.d), ["2020-01-02", "2020-01-03", "2020-01-07"]);
  const c = stretchCoverage(b, ["2020-01-02", "2020-01-03", "2020-01-06", "2020-01-07"], "2020-01-02", "2020-01-07");
  assert.equal(c.withBar, 3); assert.equal(c.share, 0.75); assert.equal(c.maxHoleDays, 4);
});

test("the playbook's --pit-leaders switch is opt-in: without it the leaders basket code path is the published one", () => {
  const src = readFileSync(join(ROOT, "research/statistics/pullback-playbook/run.mjs"), "utf8");
  assert.match(src, /pitTop = PITL \? PITL\.top : topByYear\(capHist, YEARS, 20\)/);
  assert.match(src, /for \(const s of PITL \? \[\] : leaderSyms\)/);
});

test("the page: every section, the way back, allowed colours only, links and data files present", () => {
  const P = join(ROOT, "deliverables/20260928/point-in-time/POINT-IN-TIME.html"), page = readFileSync(P, "utf8");
  assert.match(page, /<!-- scnav · /);
  for (const h of ["What changed, in plain words", "1 · The universe", "2 · Leaders", "3 · What leaders looked like", "4 · Size tranches", "5 · Tranche back-test", "Where each number comes from", "What could be wrong", "What was not done"]) assert.ok(page.includes(h), `missing section ${h}`);
  assert.equal((page.match(/<svg class="chart"/g) || []).length, 2);
  assert.ok(!/NaN|undefined|null%/.test(page.replace(/<script[\s\S]*?<\/script>/g, "")), "a number did not render");
  const DIRECTION = new Set(["00FFA3", "FF2D55"]);
  for (const [, hex] of page.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    if (DIRECTION.has(hex.toUpperCase())) continue;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `#${hex} is not an allowed grey`);
  }
  for (const [, px] of page.matchAll(/font-size[:=]"?(\d+)(?:px)?/g)) assert.ok(+px >= 11, `font ${px}px`);
  for (const f of ["manifest.json", "membership-sp500-ndx.json", "pit-concentration.json", "pit-traits.json", "pit-q1d.json", "pit-playbook.json"]) assert.ok(existsSync(join(ROOT, "deliverables/20260928/point-in-time/data", f)), f);
  const idx = readFileSync(join(ROOT, "deliverables/20260928/studies-index/STUDIES.html"), "utf8");
  assert.ok(idx.includes('href="/deliverables/20260928/point-in-time/POINT-IN-TIME.html"'));
});
