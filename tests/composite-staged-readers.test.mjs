/* M37 — THE AUDIT, PINNED. Every place the Hub still touches composite_staged, and what it is
   allowed to do with it. Measured 2026-09-24: 364 of the table's 386 tf=D rows are frozen at
   2026-08-24 15:07Z; only 22 non-equity rows are current. So no EQUITY number may reach a screen
   from it. A reader may still use it for membership (names), or for a non-equity whose approved
   owner it is, and every such use is listed here by name. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const hub = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fundamentals = fs.readFileSync(new URL("../fundamentals/index.html", import.meta.url), "utf8");
const allocation = fs.readFileSync(new URL("../allocation/index.html", import.meta.url), "utf8");

test("every composite_staged read in the Hub is one of the five known ones", () => {
  const reads = (hub.match(/(?:pg|api)\("composite_staged\?[^"]*"/g) || []).map((s) => s.slice(s.indexOf("?")));
  assert.deepEqual(reads.sort(), [
    '?select=ticker&tf=eq.D"',                                                           // tape universe: names only
    '?select=ticker,composite,trend,momentum,updated_ts&tf=eq.D&order=updated_ts.desc"',  // board: overlaid below
    '?select=ticker,trend,momentum&tf=eq.D&limit=400"',                                   // cohort strip: non-equities only
    '?ticker=eq."',                                                                       // company READ payload
    '?ticker=ex."'.replace("ex", "eq"),                                                   // company Geiger tile
  ].sort(), "a new reader of this table must be added to the audit deliberately");
  assert.equal(reads.length, 5, "five readers, no more");
});

test("each of the three equity-number readers is overlaid by the live engine first", () => {
  for (const [what, re] of [
    ["board",         /scOpt\('composite_staged',[\s\S]{0,8000}?if \(window\.SC_CLEAN_READS\) await scApplyCandidateGeiger\(gg\);/],
    ["company READ",  /pg\("composite_staged\?ticker=eq\." \+ e[\s\S]{0,8000}?await scApplyCandidateGeiger\(_g\); \}\n  const liveRead = scLiveRead\(d0\);/],
    ["Geiger tile",   /pg\("composite_staged\?ticker=eq\." \+ enc[\s\S]{0,4000}?await scApplyCandidateGeiger\(_g\);/],
  ]) assert.match(hub, re, what + " must apply the provider overlay before anything reads the row");
});

test("the cohort strip takes trend/momentum from this table for non-equities only", () => {
  assert.match(hub, /\(rows\|\|\[\]\)\.forEach\(function\(r\)\{if\(!eq\.has\(r\.ticker\)\) next\[r\.ticker\]=\{tr:r\.trend,mo:r\.momentum\};\}\);/);
  assert.match(hub, /if\(eq\.has\(t\) && value && value\.composite!=null\)\n            next\[t\]=\{tr:value\.trend,mo:value\.momentum\};/);
});

test("the fundamentals page uses the table for names only, and no longer calls it live", () => {
  assert.match(fundamentals, /composite_staged\?select=ticker,composite,updated_ts&order=ticker\.asc/);
  assert.doesNotMatch(fundamentals, /tickers loaded live from/, "a frozen table is not a live one");
  assert.match(fundamentals, /ticker list only, from the retired <span class="mono2">composite_staged<\/span> table/);
  assert.match(fundamentals, /no number on this page is read from it/);
  assert.equal((fundamentals.match(/s\.composite/g) || []).length, 0, "the composite column is read but never displayed");
});

test("the allocation page reads it for non-equities, under the board's own precedence", () => {
  assert.match(allocation, /composite_staged\?select=ticker,composite,updated_ts&tf=eq\.D/);
  assert.match(allocation, /only DECLARED equities are blanked when the artifact has nothing for them/);
});
