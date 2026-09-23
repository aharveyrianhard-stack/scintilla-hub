/* "Read the cohort composites exactly as the DASHBOARD computes them — same function, same
   numbers." This test is that claim, mechanised: it lifts the dashboard's own
   cohortCompareRows() out of index.html and the allocation page's cohortRowsFrom() out of
   allocation/index.html, runs BOTH over the same made-up membership and Geiger, and fails if a
   single number differs. No network, no browser. If either page's arithmetic is edited on its
   own, this goes red. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const HUB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ALLOC = fs.readFileSync(new URL("../allocation/index.html", import.meta.url), "utf8");

function slice(src, from, to, what) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  assert.ok(a > 0 && b > a, "the page must still carry " + what);
  return src.slice(a, b);
}
/* the dashboard's cohort read, as it stands in the Hub */
const HUB_SRC = slice(HUB, "function cohortCompareRows()", "function cohortCompareHTML()", "cohortCompareRows");
const hubRows = (COHSETS, GCOMP, COHORTS, COHORT_OF) =>
  new Function("COHSETS", "GCOMP", "COHORTS", "COHORT_OF",
    HUB_SRC + "\nreturn cohortCompareRows();")(COHSETS, GCOMP, COHORTS, COHORT_OF);

/* the allocation page's cohort read */
const ALLOC_SRC = slice(ALLOC, "function cohortRowsFrom(", "function gcompMap()", "cohortRowsFrom");
const allocRows = (cohsets, gcomp, cohorts, cohortOf) =>
  new Function("cohsets", "gcomp", "cohorts", "cohortOf",
    ALLOC_SRC + "\nreturn cohortRowsFrom(cohsets, gcomp, cohorts, cohortOf);")(cohsets, gcomp, cohorts, cohortOf);

/* both pages must be naming the same twelve cohorts, or "the same numbers" is meaningless */
function declared(src) {
  const a = src.indexOf("const COHORTS = [");
  const b = src.indexOf("];", a);
  assert.ok(a > 0 && b > a, "the page must still declare COHORTS");
  return new Function("return " + src.slice(a + "const COHORTS = ".length, b + 1))();
}
const HUB_COHORTS = declared(HUB), ALLOC_COHORTS = declared(ALLOC);

const SETS = {
  AI_HARDWARE: new Set(["NVDA", "AMD", "AVGO"]),
  BLUE_CHIP:   new Set(["WMT", "COST", "NVDA"]),        // a name in two cohorts, on purpose
  METALS:      new Set(["GLD", "GDX", "GCUSD", "SIUSD"]), // two members with no Geiger
  CRYPTO:      new Set(["COIN", "BTCUSD"]),
  MEGACAP:     new Set([]),                              // declared, empty
  TECH:        new Set(["ORCL"]),                        // a SECTOR key: must never appear
};
const G = { NVDA: 0.55, AMD: -0.20, AVGO: 0.15, WMT: 0.28, COST: -0.33, GLD: -0.38, GDX: 0.44, COIN: 0.61, ORCL: 0.9 };

test("the allocation page and the dashboard return the same cohort numbers from the same reads", () => {
  const a = hubRows(SETS, G, HUB_COHORTS, {});
  const b = allocRows(SETS, G, ALLOC_COHORTS, null);
  assert.deepEqual(b.map((r) => [r.key, r.mean, r.n]), a.map((r) => [r.key, r.mean, r.n]));
});

test("both pages declare the same cohorts, in the same order", () => {
  assert.deepEqual(ALLOC_COHORTS, HUB_COHORTS);
});

test("a sector key in the membership table never becomes a cohort", () => {
  const rows = allocRows(SETS, G, ALLOC_COHORTS, null);
  assert.equal(rows.find((r) => r.key === "TECH"), undefined);
  assert.ok(rows.every((r) => ALLOC_COHORTS.some((c) => c[1] === r.key)));
});

test("a member with no Geiger is left out of the mean instead of counted as zero", () => {
  const rows = allocRows(SETS, G, ALLOC_COHORTS, null);
  const metals = rows.find((r) => r.key === "METALS");
  assert.equal(metals.n, 2, "GCUSD and SIUSD have no composite and must not be counted");
  assert.equal(metals.mean, (G.GLD + G.GDX) / 2);
  assert.notEqual(metals.mean, (G.GLD + G.GDX + 0 + 0) / 4);
});

test("a cohort with nothing to read has no mean, not a zero", () => {
  const rows = allocRows(SETS, G, ALLOC_COHORTS, null);
  const mega = rows.find((r) => r.key === "MEGACAP");
  assert.equal(mega.mean, null);
  assert.equal(mega.n, 0);
});

test("a name in two cohorts counts in both", () => {
  const rows = allocRows(SETS, G, ALLOC_COHORTS, null);
  assert.equal(rows.find((r) => r.key === "AI_HARDWARE").n, 3);
  assert.equal(rows.find((r) => r.key === "BLUE_CHIP").n, 3);
  assert.equal(rows.find((r) => r.key === "BLUE_CHIP").mean, (G.WMT + G.COST + G.NVDA) / 3);
});

test("the cohorts come out sorted bull to bear, exactly as the strip shows them", () => {
  const rows = allocRows(SETS, G, ALLOC_COHORTS, null).filter((r) => r.mean != null);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].mean >= rows[i].mean);
});

test("the whole membership table is read in pages, because it is longer than one page", () => {
  assert.match(ALLOC, /async function pgAll\(/, "the page must page its reads");
  assert.match(ALLOC, /pgAll\("ticker_cohorts\?select=ticker,cohort&order=ticker\.asc,cohort\.asc"\)/,
    "the cohort membership must be read with the paged reader and an explicit order");
});

test("favourites are read from the board's own list and never forced into a pick", () => {
  assert.match(ALLOC, /localStorage\.getItem\("sc_fav"\)/, "favourites come from the board's saved list");
  assert.match(ALLOC, /const FAV_SEED = \["MU", "NBIS", "SNDK"\]/, "and from the board's seed");
  const scoreBlock = slice(ALLOC, "const scoreOf = (x) =>", "F.candidates.forEach(scoreOf)", "the name score");
  assert.match(scoreBlock, /favAdd = x\.fav \? T\.favBoost : 0/, "a star is worth exactly the knob, no more");
  assert.match(scoreBlock, /scoreBare: bare/, "the page must keep the score without the star, to say what it changed");
});

/* THE PART A FIXTURE CANNOT PROVE, PINNED IN SOURCE. Running the two functions over the same
   inputs showed 12 of 12 identical — and the two pages STILL disagreed on four cohorts live,
   because the board does not feed its function the artifact alone. A member that is not a
   declared equity keeps the value in the older composite_staged table; only declared equities
   are blanked when the artifact has nothing. These pin that precedence so it cannot quietly
   revert to "the artifact only" and put the two surfaces out of step again. */
test("a declared equity fails closed: no artifact value means no value, never a legacy one", () => {
  const src = slice(ALLOC, "function gcompMap()", "function gsrc(", "gcompMap");
  assert.match(src, /if \(declared && declared\.has\(t\)\) continue;/,
    "a declared equity must never fall back to the staged table");
  assert.match(src, /if \(t in out\) continue;/, "the artifact wins wherever it spoke");
  assert.match(src, /if \(!declared\) continue;/,
    "with no declared list the page must not guess which rows are equities");
});

test("the non-equity members are read, so the cohort means match the board's", () => {
  assert.match(ALLOC, /pgAll\("composite_staged\?select=ticker,composite,updated_ts&tf=eq\.D&order=updated_ts\.desc"\)/,
    "the legacy staged composites must be read, newest first");
  assert.match(ALLOC, /api\("\/universe"\)/, "the declared equity set comes from the chart API");
});

test("the page can say which engine produced a number", () => {
  const src = slice(ALLOC, "function gsrc(", "/* ---- BREADTH", "gsrc");
  assert.match(src, /return "artifact"/);
  assert.match(src, /return "staged"/);
  assert.match(ALLOC, /r\.staged = Array\.from\(set\)\.filter\(\(t\)=> gsrc\(t\) === "staged"\)/,
    "every cohort must count how many of its members came from the older store");
});
