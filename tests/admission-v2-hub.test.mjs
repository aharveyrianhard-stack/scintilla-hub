/* ADMISSION V2 (27 Sep) — computed, not shown.
   Alan: the map's funds "need the Geiger" and are shown "only where I ask". So a geiger-only name is in
   the provider set (priced, scored, in the digest) but never on ALL or a cohort tab; it appears on
   LIKED / FAVORITES / RADAR once Alan puts it there. One rule decides: boardScopeHas(). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  const end = page.indexOf("\n}\n", start);
  return page.slice(start, end + 3);
}

function scope(geigerOnly) {
  const src = page.slice(page.indexOf("const LIST_COHS = "), page.indexOf("/* apply one intent")) +
    "const SC_GEIGER_ONLY = new Set(" + JSON.stringify(geigerOnly) + ");\n" + fn("boardScopeHas") + "\nreturn boardScopeHas;";
  const COHSETS = { AI_HARDWARE: new Set(["NVDA", "VGT"]) };
  return new Function("COHSETS", "cohKey", src)(COHSETS, (k) => k);
}

test("a geiger-only name is off ALL and off every cohort tab", () => {
  const has = scope(["VGT"]);
  assert.equal(has("ALL", "VGT", "FUNDS"), false);
  assert.equal(has("AI_HARDWARE", "VGT", "FUNDS"), false, "even when membership would place it on the tab");
  assert.equal(has("FUNDS", "VGT", "FUNDS"), false, "even on its own home cohort");
});

test("it is on Alan's lists when he puts it there (the list filter then narrows to members)", () => {
  const has = scope(["VGT"]);
  for (const list of ["FAV", "FAVORITES", "RADAR"]) assert.equal(has(list, "VGT", "FUNDS"), true, list);
});

test("a full-treatment name is exactly where it was", () => {
  const has = scope(["VGT"]);
  assert.equal(has("ALL", "NVDA", "AI_HARDWARE"), true);
  assert.equal(has("AI_HARDWARE", "NVDA", "AI_HARDWARE"), true);
  assert.equal(scope([])("ALL", "VGT", "FUNDS"), true, "with no tier known, nothing is hidden");
});

test("the rule tolerates a page (or a test sandbox) that never declared the set", () => {
  const src = page.slice(page.indexOf("const LIST_COHS = "), page.indexOf("/* apply one intent")) + fn("boardScopeHas") + "\nreturn boardScopeHas;";
  const has = new Function("COHSETS", "cohKey", src)({}, (k) => k);
  assert.equal(has("ALL", "VGT", "FUNDS"), true);
});

test("the tier comes from the accepted /universe artifact, never widens it, and survives the cache", () => {
  const decl = fn("scDeclaredEquities");
  assert.match(decl, /j\.tiers && Array\.isArray\(j\.tiers\.geiger_only\) \? j\.tiers\.geiger_only : \[\]\)\.filter\(\(t\) => SC_EQ\.has\(t\)\)/);
  assert.match(decl, /JSON\.stringify\(\{ at: Date\.now\(\), digest, syms, geo \}\)/);
  assert.match(fn("scEqFromCache"), /if \(Array\.isArray\(r\.geo\) && typeof scNoteGeigerOnly === "function"\) scNoteGeigerOnly\(r\.geo\);/);
});

test("the tier is also read from public.tickers.role, once, and a 400 before the column exists costs nothing", () => {
  assert.match(page, /scOpt\('tickers_role',\s+pg\("tickers\?select=ticker&role=eq\.geiger_only", 1\)\.catch\(\(\) => \[\]\), \[\]\)/);
  assert.match(page, /scNoteGeigerOnly\(\(geoRows \|\| \[\]\)\.map\(\(r\) => r && r\.ticker\)\);\n  const declaredSet =/);
});

test("the rank gate still counts the WHOLE declared set, geiger-only names included", () => {
  // hiding a name from the board must not make the board think the provider set is short
  assert.match(page, /window\.SC_RANK_READY = declaredSet\.size === SC_EXPECTED_EQUITY_COUNT &&/);
});
