/* 21 Nov 2026 — DEFENSIVES and DIVIDEND (dispatch SCINTILLA-20261121-01; Alan: "where money hides in a sell-off").
   Static checks on index.html: the two cohorts are declared after the twelve, their boards (and only theirs) put P/E and
   YIELD in MKT CAP's and REVENUE's places, the three names not on the Hub are light rows, and the tab row and the compare
   card still fit with fourteen cohorts. The live proof (headless, the real origin) is in the coordinator's staging folder. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const HUB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function declared(src) {
  const a = src.indexOf("const COHORTS = [");
  const b = src.indexOf("];", a);
  return new Function("return " + src.slice(a + "const COHORTS = ".length, b + 1))();
}
function cut(from, to) {
  const a = HUB.indexOf(from), b = HUB.indexOf(to, a);
  assert.ok(a > 0 && b > a, "the page must still carry " + from);
  return HUB.slice(a, b);
}

test("DEFENSIVES and DIVIDEND are declared after the twelve, the twelve unchanged and in order", () => {
  const c = declared(HUB);
  assert.equal(c.length, 14);
  assert.deepEqual(c.slice(0, 12).map((p) => p[1]), ["AI_HARDWARE", "AI_SOFTWARE", "MEGACAP", "BLUE_CHIP", "GROWTH", "CRYPTO", "INTL", "MACRO", "INDEXES", "THEMATIC", "METALS", "AI_POWERTRAIN"]);
  assert.deepEqual(c.slice(12), [["DEFENSIVES", "DEFENSIVE"], ["DIVIDEND", "DIVIDEND"]]);
  assert.match(HUB, /DEFENSIVE:"DEFENS", DIVIDEND:"DIVS"/, "short names on the compare card");
});

test("only the DEFENSIVES and DIVIDEND boards swap MKT CAP / REVENUE for P/E / YIELD", () => {
  const BOARD_COLS = new Function(cut("const BOARD_COLS = [", "\n") + "\nreturn BOARD_COLS;")();
  const src = cut("const MULT_COHS = {", "/* the three component cells");
  const run = (coh) => new Function("BOARD_COLS", "S", src + "\nreturn boardCols().map((c) => c[1]);")(BOARD_COLS, { coh });
  const plain = BOARD_COLS.map((c) => c[1]);
  for (const coh of ["BLUE_CHIP", "MEGACAP", "AI_HARDWARE", "ALL", "FAV", "XLK", "STAPLES"]) assert.deepEqual(run(coh), plain, coh + " keeps its columns");
  for (const coh of ["DEFENSIVE", "DIVIDEND"]) {
    const k = run(coh);
    assert.equal(k.length, plain.length, "same number of columns: nothing else moves");
    assert.deepEqual(k.filter((x, i) => x !== plain[i]), ["pe", "dy"]);
    assert.equal(k.indexOf("pe"), plain.indexOf("mc")); assert.equal(k.indexOf("dy"), plain.indexOf("rev"));
  }
});

test("P/E is the live price over a positive dollar EPS; YIELD is the annual regular dividend over the live price", () => {
  const src = cut("let DIVANN = {}", "function peCellHTML(");
  const f = new Function("EPSTTM", "estNonUsd", "pg", "num", src + "\nreturn { peVal, dyVal, set: (m) => { DIVANN = m; } };");
  const api = f({ KO: 3.4, GILD: -3.16, TSM: 9 }, (t) => t === "TSM", () => Promise.resolve([]), Number);
  assert.equal(+api.peVal("KO", 96.9).toFixed(2), 28.5);
  assert.equal(api.peVal("GILD", 167), null, "a loss has no P/E");
  assert.equal(api.peVal("TSM", 300), null, "EPS in another currency is never divided into a dollar price");
  api.set({ KO: { annual: 2.12 }, ISRG: { annual: 0 } });
  assert.equal(+api.dyVal("KO", 96.9).toFixed(2), 2.19);
  assert.equal(api.dyVal("ISRG", 400), null);
  assert.equal(api.dyVal("NOPE", 10), null);
  assert.match(HUB, /scOpt\('dividend_annual', +typeof divAnnLoad === "function" \? divAnnLoad\(\) : null, \{\}\)/, "the board reads the view");
});

test("General Mills, Hershey and Kraft Heinz are light rows under DEFENSIVES, never board rows", () => {
  assert.match(HUB, /const COH_LITE = \{ DEFENSIVE: \{ label: "DEFENSIVES", h: \[\["GIS"\], \["HSY"\], \["KHC"\]\] \} \};/);
  assert.match(HUB, /const cl = typeof COH_LITE !== "undefined" && COH_LITE\[coh\] \? COH_LITE\[coh\] : null;/);
});

test("the tab row and the compare card still fit fourteen cohorts", () => {
  assert.match(HUB, /\.sc-ihead\.cohtabs \.cohtabstrip\{ flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:1px; overflow-x:auto; \}/);
  assert.match(HUB, /\.sc-ihead\.cohtabs \.sc-coh\{ flex:0 0 auto; padding:9px 3px; font-size:7px;/);
  assert.match(HUB, /\.sc-cohstrip\.is-dense \.sc-cohstrip__lbl\{font-size:7px !important\}/);
  assert.match(HUB, /\(id === "COHORTS" && list\.length > 12 \? " is-dense" : ""\)/);
});
