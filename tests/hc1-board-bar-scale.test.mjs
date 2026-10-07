// HC1 (6 Oct 2026) — ONE SCALE FOR A NAME'S GEIGER BAR, WHEREVER IT IS LISTED. Alan: EQIX looked "all the way green" in search
// but "just past the midline" in the LIKED list. Cause: the board drew each bar against the strongest reading AMONG THE ROWS ON
// SCREEN, so a search that found one name always filled its bar. Every row is now drawn on the Geiger's own fixed −1 … +1.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => {
  const m = page.match(new RegExp("\\n(async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " is a top-level function of the page");
  return m[0];
};
const geigerMiniHTML = new Function(fn("geigerMiniHTML") + "return geigerMiniHTML;")();
const widthOf = (html) => +(+/width:([\d.]+)%/.exec(html)[1]).toFixed(3);   // the bar's share of the track; 50 = the whole half

test("the bug, as it was drawn: the same +0.29 filled the bar in a one-row search and sat near the midline in a long list", () => {
  const relative = (g, rows) => geigerMiniHTML(g, Math.max(...rows.map((v) => Math.abs(v)), 0.0001), true);   // the old rule: the strongest row on screen = full
  assert.equal(widthOf(relative(0.29, [0.29])), 50, "EQIX alone in search: the whole half-track — 'all the way green'");
  assert.equal(+widthOf(relative(0.29, [0.97, 0.29, -0.4])).toFixed(1), 14.9, "EQIX in LIKED beside a +0.97: just past the midline");
});

test("now: the board draws every row on the Geiger's fixed scale, so a name's bar is the same length in any list", () => {
  const rows = fn("boardRowsHTML");
  assert.match(rows, /geigerMiniHTML\(d\.g, 1, true\)/);
  assert.doesNotMatch(rows, /gMax/, "no scale taken from the rows on screen");
  assert.equal(widthOf(geigerMiniHTML(0.29, 1, true)), 14.5, "+0.29 is 29% of its half of the track — in search, in LIKED, in FAVORITES");
  assert.equal(widthOf(geigerMiniHTML(-0.29, 1, true)), 14.5);
  assert.equal(widthOf(geigerMiniHTML(1, 1, true)), 50, "only a reading at the Geiger's own limit fills the bar");
  assert.equal(widthOf(geigerMiniHTML(1.3, 1, true)), 50, "and it never runs past the track");
  assert.match(geigerMiniHTML(null, 1, true), /—/);
});

test("the neighbours of that rule share the scale: a replay must not change a bar's scale, and the other Geiger bars were already fixed", () => {
  /* the rewind module rewrites the same bars in place while it plays */
  assert.match(page, /var mx=1;   \/\* HC1 — the Geiger's own fixed scale, as boardRowsHTML draws it/);
  assert.doesNotMatch(page, /mx=Math\.max\(mx,Math\.abs\(vals\[k\]\)\)/);
  assert.match(page, /"width:"\+\(Math\.min\(Math\.abs\(v\)\/mx,1\)\*50\)\.toFixed\(2\)\+"%;"/, "the same arithmetic as geigerMiniHTML, against the same 1");
  /* the cohort line above the board, the Geiger breakdown and the company view's name rail */
  assert.match(fn("cohortGeigerHTML"), /geigerMiniHTML\(v, 1\)/);
  assert.match(page, /geigerMiniHTML\(num\(r\.g\), 1\) \+ "<\/button>"/, "the company view's rail");
  assert.match(page, /geigerMiniHTML\(g, 1\)\) \+ "<\/div>"/, "the breakdown");
  /* the compare strip is the one place that stretches to its own range — and it prints that range */
  assert.match(fn("cohortCompareSpan"), /return Math\.max\(L0_CMP_MIN_SPAN, m\);/);
  assert.match(fn("cmpxCardHTML"), /"±" \+ span\.toFixed\(2\)/);
});
