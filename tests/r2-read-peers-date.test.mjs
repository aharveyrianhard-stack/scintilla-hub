/* R2 — READ-ENGINE: THE PEERS SENTENCE PRINTS THE AGE OF ITS OWN INPUTS.
   Before: "Against its <cohort> peers it is … (compared on the legacy daily composite of 2026-08-24, 42d old)" — the date
   of composite_staged's row, whatever recompute_cohort_divergence actually read. H12's staged 04 moves that function to
   the newest daily Geiger and fills cohort_divergence.as_of / cohort_as_of_oldest (columns added by H12 02).
   These tests run the engine's OWN helper, lifted from the source, on the row shapes before and after 04. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const SRC = fs.readFileSync(new URL("../supabase/functions/read-engine/index.ts", import.meta.url), "utf8");
const cut = (from, to) => SRC.slice(SRC.indexOf(from), SRC.indexOf(to));
const js = stripTypeScriptTypes(
  "const FUTURE_SKEW_MS=60*1000\n" + cut("const EPOCH_FLOOR_MS", "const unit=(v:any)=>"), { mode: "strip" });
const { peersAge, isStale } = new Function(js + "\nreturn { peersAge, isStale };")();

const NOW = Date.parse("2026-10-06T01:00:00Z");
const LEGACY = Date.parse("2026-08-24T20:10:00Z");
/* the sentence exactly as the handler builds it */
const sentence = (co, lMs, gValid = true) => {
  const pa = peersAge(co, lMs, NOW);
  return `Against its ${co.cohort} peers it is ${co.flag === "DIVERGENT" ? "diverging from the group" : "roughly in line"}` +
    `${pa.dated || gValid || isStale(lMs, NOW, 24 * 3600 * 1000) ? ` (compared on ${pa.words})` : ""}.`;
};

test("the handler builds the sentence from the helper, and the hard-coded legacy date is gone from it", () => {
  assert.match(SRC, /if\(co\)para2\+=`Against its \$\{co\.cohort\} peers it is .*\$\{pa\.dated\|\|gValid\|\|isStale\(lMs,nowMs,SOURCE_STALE_MS\)\?` \(compared on \$\{pa\.words\}\)`:''\}\.`/);
  assert.doesNotMatch(SRC, /\(compared on the legacy daily composite of \$\{day\(lMs\)\}/);
  assert.match(SRC, /select\('ticker,cohort,geiger,cohort_mean,flag,as_of,source,cohort_as_of_oldest'\)/, "the age columns are read");
  assert.match(SRC, /w\.error\?sb\.from\('cohort_divergence'\)\.select\('ticker,cohort,geiger,cohort_mean,flag'\):w/, "and their absence costs only the date, not the comparison");
});

test("before H12 04 (no age on the row) the sentence is word for word what is live today", () => {
  const co = { ticker: "MU", cohort: "Semis", flag: "inline", as_of: null, source: null, cohort_as_of_oldest: null };
  assert.equal(sentence(co, LEGACY),
    "Against its Semis peers it is roughly in line (compared on the legacy daily composite of 2026-08-24, 42d old).");
  assert.equal(peersAge(co, LEGACY, NOW).dated, false);
});

test("after H12 04, a group read this evening prints this evening's date and its true age", () => {
  const co = { ticker: "MU", cohort: "Semis", flag: "DIVERGENT", as_of: "2026-10-06T00:20:00+00:00", source: "CHART_API_GEIGER", cohort_as_of_oldest: "2026-10-06T00:20:00+00:00" };
  assert.equal(sentence(co, LEGACY),
    "Against its Semis peers it is diverging from the group (compared on daily Geiger readings of 2026-10-06, 40m old).");
});

test("one old reading inside the group dates the whole comparison — the range and the oldest age are printed", () => {
  const co = { ticker: "MU", cohort: "Semis", flag: "inline", as_of: "2026-10-06T00:20:00Z", source: "CHART_API_GEIGER", cohort_as_of_oldest: "2026-08-24T20:10:00Z" };
  const pa = peersAge(co, LEGACY, NOW);
  assert.equal(pa.oldest, LEGACY);
  assert.equal(sentence(co, LEGACY),
    "Against its Semis peers it is roughly in line (compared on daily Geiger readings of 2026-08-24 to 2026-10-06, oldest 42d old).");
  assert.match(pa.basis, /this name's own reading 2026-10-06 from CHART_API_GEIGER, oldest reading in its group 2026-08-24/);
});

test("a fresh comparison is still dated when the provider Geiger is down (it used to go silent)", () => {
  const co = { ticker: "MU", cohort: "Semis", flag: "inline", as_of: "2026-10-05T22:00:00Z", cohort_as_of_oldest: "2026-10-05T22:00:00Z" };
  assert.match(sentence(co, NOW - 3600e3, false), /\(compared on daily Geiger readings of 2026-10-05, 3h old\)/);
});

test("a name whose own reading is the old one says so; a future or unreadable date is never printed", () => {
  const stale = { cohort: "REITs", flag: "inline", as_of: "2026-08-24T20:10:00Z", source: "COMPOSITE_STAGED", cohort_as_of_oldest: "2026-08-24T20:10:00Z" };
  assert.match(sentence(stale, LEGACY), /daily Geiger readings of 2026-08-24, 42d old/);
  assert.match(peersAge(stale, LEGACY, NOW).basis, /from COMPOSITE_STAGED/);
  const bad = { cohort: "REITs", flag: "inline", as_of: "2031-01-01T00:00:00Z", cohort_as_of_oldest: "not a date" };
  assert.equal(peersAge(bad, null, NOW).dated, false);
  assert.match(sentence(bad, null), /legacy daily composite of unknown date, age unknown/);
  const half = { cohort: "REITs", flag: "inline", as_of: null, cohort_as_of_oldest: "2026-10-05T22:00:00Z" };
  assert.match(peersAge(half, null, NOW).basis, /this name's own reading of unknown date, oldest reading in its group 2026-10-05/);
});

test("H12 04 fills exactly the columns the engine reads", () => {
  const sql = fs.readFileSync(new URL("../staged/h12/04_recompute_cohort_divergence.sql", import.meta.url), "utf8");
  for (const c of ["as_of=EXCLUDED.as_of", "source=EXCLUDED.source", "cohort_as_of_oldest=EXCLUDED.cohort_as_of_oldest"]) assert.ok(sql.includes(c), c);
});
