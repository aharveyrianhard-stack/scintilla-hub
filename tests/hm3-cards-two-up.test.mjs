// HM3 (7 Oct 2026) — THE COMPARE CARDS, TWO TO A VIEW. Alan, 7 Oct ~16:10 ET, on HC2's column live: "we need to stack them
// less — two at a time, two per [view], that I can view two in each view before scrolling. Looks good. Easier to navigate,
// less stuff at the top. I like it."
// The whole change is one number in the sheet: a card's share of the list (--cmpx-rows 3 → 2), with a third kept in the
// two places that were not asked to change — a phone and full screen. What a card draws did not change, and HC2's own
// tests still hold that (tests/hc2-compare-stacked.test.mjs). Here: the rule, then the page as measured in a headless
// browser, one page at a time (deliverables/20261007/hm3-cards-two-up/data, written by tools/capture.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SHEET = page.slice(page.indexOf("/* ── HC1 (6 Oct) → HC2 (7 Oct) — EVERY COMPARE VIEW ON ONE SCREEN, ONE ABOVE THE OTHER."), page.indexOf("/* the Geiger cell is the button that opens the breakdown"));
const D = new URL("../deliverables/20261007/hm3-cards-two-up/data/", import.meta.url);
const cap = (which, tag) => JSON.parse(fs.readFileSync(new URL("capture-" + which + "-" + tag + ".json", D), "utf8"));
const NINE = ["SECTORS · BLENDED", "BREADTH", "STATE STREET", "iSHARES", "VANGUARD", "EQUAL-WEIGHT", "COHORTS", "OUR NAMES", "INDEX FUNDS"];

test("the rule: two cards to the list; a phone and full screen keep three; nothing else in the sheet moved", () => {
  assert.ok(SHEET.length > 3000, "the compare cards' sheet is on the page");
  const css = SHEET.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.deepEqual(css.match(/--cmpx-rows:\d/g), ["--cmpx-rows:2", "--cmpx-rows:3", "--cmpx-rows:3"], "the list's own rule, then full screen, then the phone");
  assert.match(css, /\n\.sc-cmpx__scroll\{ --cmpx-rows:2; --cmpx-cols:1; --cmpx-gap:6px; --cmpx-track:44px;/);
  assert.match(css, /\n\.sc-layer0\.sc-secfs \.sc-cmpx__scroll\{ --cmpx-rows:3; \}\n@media\(max-width:820px\)\{ \.sc-cmpx__scroll\{ --cmpx-rows:3; \} \}\n/);
  /* still one column that scrolls up and down and cannot scroll sideways */
  assert.match(css, /overflow-x:hidden; overflow-y:auto;/); assert.match(css, /--cmpx-cols:1;/);
  assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll)|scroll-snap-type:\s*x/);
  /* the heading says who asked and what was kept */
  assert.match(SHEET, /HM3 \(7 Oct, ~16:10 ET\) — Alan, on the column live: "we need to stack them less — two at a time, two per \[view\]/);
});

test("measured at 1680, 1440 and 1280: two cards in full as it opens, each just under half the list; the next two a screen down", () => {
  for (const tag of ["1680", "1680x940", "1440", "1280"]) {
    const j = cap("after", tag), o = j.steps.opens;
    assert.equal(j.error, undefined, tag + ": the run finished"); assert.equal(j.requests.stoppedNonGet, 0); assert.equal(j.consoleErrors.length, 0);
    assert.equal(o.rowsVar, "2"); assert.equal(o.colsVar, "1"); assert.equal(o.cardsToALine, 1);
    assert.deepEqual(o.cards.map((c) => c.view), NINE, tag + ": the same nine, in the same order");
    assert.deepEqual(o.cardsFullyShown, ["SECTORS · BLENDED", "BREADTH"], tag + ": two views before scrolling");
    for (const c of o.cards) {
      assert.ok(c.shareOfListHeight > 0.47 && c.shareOfListHeight < 0.5, tag + " · " + c.view + " takes " + c.shareOfListHeight + " of the list (half, less the gaps)");
      assert.equal(c.rowsOfBars, 1); assert.equal(c.runsOverItsBox, false); assert.ok(c.barTrackCssPx >= 44, c.view + ": the track keeps its floor");
      assert.ok(c.cssPx[0] <= o.listCssPx[0], c.view + " is no wider than the list");
    }
    /* the card's height is the list's, less its padding and the one gap, halved */
    assert.ok(Math.abs(o.cards[0].cssPx[1] - (o.listCssPx[1] - 12 - 6) / 2) < 1, tag + ": " + o.cards[0].cssPx[1] + " px of a " + o.listCssPx[1] + " px list");
    assert.deepEqual(j.steps.oneScreenDown.cardsFullyShown, ["STATE STREET", "iSHARES"], tag + ": one screen down");
    assert.deepEqual(j.steps.atTheEnd.cardsFullyShown, ["OUR NAMES", "INDEX FUNDS"], tag + ": at the end");
    for (const step of ["opens", "oneScreenDown", "atTheEnd", "unfolded", "fullScreen"]) {
      const v = j.steps[step];
      assert.equal(v.sidewaysPx, 0, tag + " · " + step + ": nothing to scroll sideways"); assert.equal(v.overflowX, "hidden");
      assert.deepEqual(v.cut, [], tag + " · " + step + ": no name, number or word is cut");
      assert.deepEqual(v.cards.filter((c) => c.runsOverItsBox).map((c) => c.id), [], tag + " · " + step + ": no card runs over its box");
    }
    /* full screen is as it was: three across, three down, all nine with nothing to scroll */
    const f = j.steps.fullScreen;
    assert.equal(f.fullScreen, true); assert.equal(f.rowsVar, "3"); assert.equal(f.colsVar, "3"); assert.equal(f.cardsToALine, 3);
    assert.equal(f.cardsFullyShown.length, 9, tag + ": full screen shows all nine"); assert.ok(f.listWholeCssPx[1] <= f.listCssPx[1], tag + ": …with nothing to scroll");
  }
});

test("measured at 390: the phone is as it was — three to the list, the two wide cards on two rows of bars", () => {
  const now = cap("after", "390").steps.opens, was = cap("before", "390").steps.opens;
  assert.equal(now.rowsVar, "3"); assert.equal(was.rowsVar, "3");
  assert.deepEqual(now.listCssPx, was.listCssPx);
  assert.deepEqual(now.cards.map((c) => [c.view, c.cssPx, c.rowsOfBars, c.shareOfListHeight]), was.cards.map((c) => [c.view, c.cssPx, c.rowsOfBars, c.shareOfListHeight]), "every card the size it is on the Hub as deployed");
  assert.deepEqual(now.cards.filter((c) => c.rowsOfBars === 2).map((c) => c.view), ["BREADTH", "COHORTS"]);
  assert.equal(now.sidewaysPx, 0); assert.deepEqual(now.cut, []);
});

test("measured before, on the Hub as deployed at 1680: three to the list — and the cards print the same views after", () => {
  const was = cap("before", "1680"), now = cap("after", "1680");
  assert.equal(was.steps.opens.rowsVar, "3");
  assert.deepEqual(was.steps.opens.cardsFullyShown, ["SECTORS · BLENDED", "BREADTH", "STATE STREET"]);
  for (const c of was.steps.opens.cards) assert.ok(c.shareOfListHeight > 0.30 && c.shareOfListHeight < 0.335);
  assert.deepEqual(was.steps.opens.listCssPx, now.steps.opens.listCssPx, "the list itself is the size it was: only a card's share of it changed");
  /* the same views, the same columns in the same order (the readings themselves move with the feed between two page loads) */
  const names = (j) => j.numbers.map((n) => [n.view, n.bars.map((b) => b.split(" ")[0])]);
  assert.deepEqual(names(now), names(was));
});

test("measured at the widths in between: two to the list down to 821 px, three from 820 px; full screen three down everywhere", () => {
  const E = JSON.parse(fs.readFileSync(new URL("between-widths.json", D), "utf8"));
  assert.deepEqual(E.runs.map((r) => r.width), [1920, 1400, 1279, 1100, 901, 821, 820, 360]);
  for (const r of E.runs) {
    assert.equal(r.error, undefined, r.width + ": the run finished"); assert.equal(r.requests.stoppedNonGet, 0); assert.equal(r.consoleErrors.length, 0);
    assert.deepEqual(r.states.map((s) => s.state), ["folded", "State Street, COHORTS, OUR NAMES and INDEX FUNDS unfolded", "full screen"]);
    const phone = r.width <= 820;
    for (const s of r.states) {
      assert.equal(s.sidewaysPx, 0, r.width + " · " + s.state + ": nothing to scroll sideways");
      assert.deepEqual(s.cut, [], r.width + " · " + s.state + ": no name, number or word is cut");
      assert.deepEqual(s.cards.filter((c) => c.runsOverItsBox).map((c) => c.id), [], r.width + " · " + s.state + ": no card runs over its box");
      assert.equal(s.cards.length, 9);
      assert.equal(s.rowsVar, s.fullScreen || phone ? "3" : "2", r.width + " · " + s.state);
      assert.equal(s.cardsToALine, s.fullScreen && r.width >= 1280 ? 3 : 1, r.width + " · " + s.state);
    }
    /* a card of one row of bars takes its share; one that needs more (two rows of bars under 1280 px) takes what it needs */
    const one = r.states[0].cards.filter((c) => c.rowsOfBars === 1);
    assert.ok(one.length >= 7);
    for (const c of one) assert.ok(phone ? c.shareOfListHeight > 0.30 && c.shareOfListHeight < 0.335 : c.shareOfListHeight > 0.47 && c.shareOfListHeight < 0.5, r.width + " · " + c.id + " takes " + c.shareOfListHeight);
    if (!phone) assert.equal(r.states[0].cardsFullyShown.length, 2, r.width + ": two views before scrolling");
  }
});
