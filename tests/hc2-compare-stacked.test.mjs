// HC2 (7 Oct 2026) — THE COMPARE CARDS, ONE ABOVE THE OTHER. Alan, 7 Oct ~09:15 ET, on HC1's row of nine cards live:
// "No, that's gonna make me swipe left to right. No, no, no, bro. Let's organize them one above each other, don't you
// think? They can be thinner. Think of the proportions of things, try and make it work. I don't want to swipe left to
// right — scrolling up to down."
// These run the page's own code (lifted from index.html) on a stand-in page, and hold it to what the release it branched
// from drew (tests/fixtures/hc1-cards-b80c01e.json, frozen by deliverables/20261007/hc2-compare-stacked/tools/make-fixture.mjs).
// Nothing reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeWorld, SCENARIOS, shown, digest, cardsOf } from "./fixtures/hc2-compare-world.mjs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const HC1 = JSON.parse(fs.readFileSync(new URL("./fixtures/hc1-cards-b80c01e.json", import.meta.url), "utf8"));
const fn = (name) => {
  const m = page.match(new RegExp("\\n(async )?function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"));
  assert.ok(m, name + " is a top-level function of the page");
  return m[0];
};
/* the compare cards' sheet: from its heading to the next part of the page's style */
const SHEET = page.slice(page.indexOf("/* ── HC1 (6 Oct) → HC2 (7 Oct) — EVERY COMPARE VIEW ON ONE SCREEN, ONE ABOVE THE OTHER."), page.indexOf("/* the Geiger cell is the button that opens the breakdown"));
assert.ok(SHEET.length > 3000, "the compare cards' sheet is on the page");
const rule = (sel) => { const i = SHEET.indexOf("\n" + sel + "{"); assert.ok(i >= 0, sel + " has a rule"); return SHEET.slice(i + 1, SHEET.indexOf("}", i) + 1); };
const media = (query) => { const i = SHEET.indexOf("\n@media" + query + "{"); assert.ok(i >= 0, "@media" + query); return SHEET.slice(i, SHEET.indexOf("\n}\n", i) + 2); };
const NINE = ["BLEND", "BOWTIE", "SPDR", "ISHARES", "VANGUARD", "EQWT", "COHORTS", "MEMBERS", "INDEXES"];

test("the nine cards are one column that scrolls up and down; nothing here can scroll sideways", () => {
  const w = makeWorld(page);
  assert.deepEqual(cardsOf(w.api.cmpxCardsHTML()).map((c) => c.id), NINE, "the same nine, in the same order");
  const list = rule(".sc-cmpx__scroll");
  assert.match(list, /--cmpx-cols:1;/, "one card to a line");
  assert.match(list, /display:flex; flex-flow:row wrap; align-content:flex-start;/, "a line under a line");
  assert.match(list, /overflow-x:hidden; overflow-y:auto;/, "the list scrolls up and down, and cannot scroll sideways");
  const card = rule(".sc-cmpx__card");
  assert.match(card, /flex:1 1 calc\(100% \/ var\(--cmpx-cols\) - var\(--cmpx-gap\)\); max-width:calc\(\(100% - \(var\(--cmpx-cols\) - 1\) \* var\(--cmpx-gap\)\) \/ var\(--cmpx-cols\)\);/, "a card is as wide as its line, never wider");
  assert.match(card, /min-width:0;/);
  /* what made HC1's row scroll is gone from the whole sheet: a card as wide as its columns, and a list allowed to scroll across */
  assert.doesNotMatch(SHEET, /width:calc\(var\(--cmpx-n/, "no card is sized by its column count");
  assert.doesNotMatch(SHEET, /--cmpx-col\b/, "no fixed column width");
  assert.doesNotMatch(SHEET.replace(/\/\*[\s\S]*?\*\//g, ""), /overflow-x:\s*(auto|scroll)|scroll-snap-type:\s*x/, "nothing in the sheet scrolls sideways");
  /* inside a card the strip's columns share the card's width (the strip's own rule, kept) */
  assert.match(page, /\.sc-cohstrip\{grid-template-columns:repeat\(var\(--coh-n,10\),minmax\(0,1fr\)\) !important;[^}]*overflow-x:hidden !important/);
});

test("thinner: a card takes a third of the list, the bar's track is what stretches, and a card is never squeezed under its content", () => {
  const list = rule(".sc-cmpx__scroll");
  assert.match(list, /--cmpx-rows:3;/, "three cards to the list: the nine are three screens of three");
  assert.match(rule(".sc-cmpx__card"), /min-height:calc\(\(100% - \(var\(--cmpx-rows\) - 1\) \* var\(--cmpx-gap\)\) \/ var\(--cmpx-rows\)\);/, "a card's height is its share of the list's own height");
  /* the share, worked for the list measured on the 1680 screen (513 px of list, 6 px padding top and bottom, 6 px between cards): a third less the gaps */
  const share = (listH, rows, gap = 6, pad = 12) => ((listH - pad) - (rows - 1) * gap) / rows;
  assert.equal(+share(513, 3).toFixed(1), 163.0);
  assert.ok(share(513, 3) / 513 > 0.31 && share(513, 3) / 513 < 0.33, "31.8 % of the list");
  /* only the track stretches; the name and value keep their size */
  const track = rule(".sc-cohtabwrap.sc-cmpx .sc-vmini");
  assert.match(track, /height:auto; flex:1 1 auto; min-height:var\(--cmpx-track\);/);
  assert.match(list, /--cmpx-track:44px;/, "a bar's track is never under 44 px: where a third would squeeze it, the card keeps its content's height");
  assert.match(track, /width:38%; min-width:10px; max-width:16px;/, "a bar is a share of its column, on every card");
  assert.match(rule(".sc-cohtabwrap.sc-cmpx .sc-cohstrip__slot"), /height:20px; flex:0 0 20px;/);
  assert.match(rule(".sc-cmpx__hd"), /flex:0 0 18px; height:18px;/);
  /* the tab's own strip may be squeezed to fit a pane (min-height:0); a card's may not, or its bars would run over the next card */
  assert.match(rule(".sc-cohtabwrap.sc-cmpx .sc-cohstrip"), /min-height:auto;/);
  assert.match(rule(".sc-cohtabwrap.sc-cmpx .sc-cohstrip__col"), /min-height:auto;/);
  assert.doesNotMatch(rule(".sc-cmpx__card"), /min-height:0/);
});

test("the replay handle and LIVE are above the list, not in it: they stay at the top while the cards scroll", () => {
  const w = makeWorld(page, { asof: "2026-09-08" });
  const screen = w.api.cohCompareScreenHTML();
  const at = (s) => { const i = screen.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.equal(at('<div class="sc-cmpx__bar" id="cmpxBar">'), 0, "the handle is the first thing in the panel");
  for (const id of ["cmpxPlay", "cmpxSpeed", "cmpxBack", "cmpxSc", "cmpxLive", "cmpxDt"]) assert.ok(at('id="' + id + '"') < at('id="cmpxScroll"'), id + " is above the list");
  assert.ok(at('id="cmpxScroll"') < at('<details class="sc-pagespecs'), "PAGE SPECS is under the list");
  assert.match(screen, /id="cmpxLive" title="back to the newest reading">↻ LIVE<\/button><span class="sc-l0asof" id="cmpxDt">2026-09-08<\/span>/, "rewound: the way back to live, and the day");
  assert.doesNotMatch(w.api.cmpxCardsHTML(), /cmpxBar|cmpxLive|sc-pagespecs/, "what scrolls is the cards and nothing else");
  assert.match(rule(".sc-cmpx__bar"), /flex:0 0 auto;/);
  assert.match(page, /\.sc-pagespecs\{ flex:0 0 auto;/);
  /* the painter redraws the list's cards and leaves the handle standing */
  assert.match(fn("cohComparePaint"), /else \{ const y = sc\.scrollTop; sc\.innerHTML = cmpxCardsHTML\(\); if \(y\) sc\.scrollTop = y; \}/);
});

test("every card shows what HC1's card showed — the same words, the same numbers, the same hovers — in every state", () => {
  assert.equal(HC1.from, "b80c01e", "the release HC2 branched from");
  assert.deepEqual(Object.keys(HC1.scenarios), SCENARIOS.map((s) => s.name));
  for (const s of SCENARIOS) {
    const now = shown(makeWorld(page, s.opts).api.cmpxCardsHTML()).map(digest), was = HC1.scenarios[s.name];
    assert.equal(now.length, 9);
    now.forEach((c, i) => assert.deepEqual(c, was[i], s.name + " · " + c.id));
  }
  /* and the state the fixture cannot fake: the words that only an unfolded card shows are there, the pair beside them */
  const un = HC1.scenarios["live, State Street, COHORTS and OUR NAMES unfolded"].find((c) => c.id === "SPDR");
  assert.match(un.text, /^STATE STREET ±0\.90 ⤡ XLB \+0\.90 aligned bull 1\.00 \/ \.40 /);
  assert.equal(HC1.scenarios["a day before any fund has a reading"].find((c) => c.id === "SPDR").text, "STATE STREET ⤢ no stored reading for 2025-01-02 — this history starts later");
});

test("how many bars to a row: one where the panel has the width, two where a column could not hold its words", () => {
  const w = makeWorld(page);
  assert.equal(w.api.CMPX_ROW_MAX, 11);
  for (const [n, exp, per] of [[11, false, 11], [12, false, 6], [14, false, 7], [11, true, 6], [12, true, 6], [3, false, 3], [3, true, 2]]) assert.equal(w.api.cmpxPerRow(n, exp), per, n + (exp ? " unfolded" : " folded"));
  const strip = (c) => /class="sc-cohstrip[^"]*" style="--coh-n:(\d+);--coh-half:(\d+)"/.exec(c.html).slice(1).map(Number);
  let cards = cardsOf(w.api.cmpxCardsHTML());
  assert.deepEqual(cards.map((c) => strip(c)), [[11, 11], [14, 7], [11, 11], [11, 11], [11, 11], [11, 11], [12, 6], [11, 11], [11, 11]]);
  assert.deepEqual(cards.filter((c) => / is-wide/.test(c.cls)).map((c) => c.id), ["BOWTIE", "COHORTS"], "the cards of more than eleven columns are marked");
  cards = cardsOf(makeWorld(page, { stored: "SPDR,COHORTS" }).api.cmpxCardsHTML());
  assert.deepEqual(strip(cards[2]), [11, 6], "an unfolded card's words need the width: six to a row where the panel is narrow");
  assert.equal(cards[2].cls, " is-exp"); assert.equal(cards[6].cls, " is-exp is-wide");
  /* where it applies: a window under 1280 px (a phone, a small window) reads --coh-half; a wider one keeps one row, but for an unfolded card of more than eleven columns */
  assert.match(media("(max-width:1279px)"), /\.sc-cohtabwrap\.sc-cmpx \.sc-cmpx__card \.sc-cohstrip\{ grid-template-columns:repeat\(var\(--coh-half,6\),minmax\(0,1fr\)\) !important; \}/);
  const wide = media("(min-width:1280px)");
  assert.match(wide, /\.sc-cohtabwrap\.sc-cmpx \.sc-cmpx__card\.is-exp\.is-wide \.sc-cohstrip\{ grid-template-columns:repeat\(var\(--coh-half,6\),minmax\(0,1fr\)\) !important; \}/);
  assert.doesNotMatch(wide, /\.sc-cohtabwrap\.sc-cmpx \.sc-cmpx__card \.sc-cohstrip\{/, "…and no other card there");
  /* the old strip's own phone rule is what a card under 821 px already obeyed; it is still on the page */
  assert.match(page, /@media\(max-width:820px\)\{\.sc-cohstrip\{grid-template-columns:repeat\(var\(--coh-half,5\),minmax\(0,1fr\)\) !important\}\}/);
});

test("full screen: the nine sit three across, and a card's share of its line is its share of the line's columns", () => {
  const w = makeWorld(page);
  const cards = cardsOf(w.api.cmpxCardsHTML());
  const f = cards.map((c) => +/--cmpx-f:([\d.]+);--cmpx-n:\d+/.exec(c.style)[1]);
  assert.equal(w.api.CMPX_PER_LINE, 3);
  assert.deepEqual(f, [0.917, 1.167, 0.917, 1, 1, 1, 1.299, 0.851, 0.851]);
  for (let i = 0; i < 9; i += 3) assert.ok(Math.abs(f[i] + f[i + 1] + f[i + 2] - 3) < 0.005, "the three shares of a line make the line");
  /* a column is as wide in one card of a line as in the next: BREADTH's fourteen beside two elevens */
  assert.equal(+(f[1] / 14).toFixed(4), +(f[0] / 11).toFixed(4));
  assert.equal(w.api.cmpxColWeight("COHORTS"), 1.4); assert.equal(w.api.cmpxColWeight("SPDR"), 1);
  assert.ok(f[6] / 12 > f[7] / 11 * 1.39, "a cohort column is 1.4 of a sector column: its names run to six letters");
  assert.equal(w.api.cmpxLineShare(NINE, "NOT_A_CARD"), 1, "a card the line does not know gets an even share");
  const wide = media("(min-width:1280px)");
  assert.match(wide, /\.sc-layer0\.sc-secfs \.sc-cmpx__scroll\{ --cmpx-cols:3; \}/);
  assert.match(wide, /\.sc-layer0\.sc-secfs \.sc-cmpx__card\{ flex-basis:calc\(\(100% \/ var\(--cmpx-cols\) - var\(--cmpx-gap\)\) \* var\(--cmpx-f,1\)\);\s*max-width:calc\(\(100% - \(var\(--cmpx-cols\) - 1\) \* var\(--cmpx-gap\)\) \/ var\(--cmpx-cols\) \* var\(--cmpx-f,1\)\); \}/);
  assert.match(wide, /\.sc-layer0\.sc-secfs \.sc-cmpx__card\.is-exp \.sc-cohstrip\{ grid-template-columns:repeat\(var\(--coh-half,6\),minmax\(0,1fr\)\) !important; \}/, "unfolded there: two rows, the words need the width");
  /* three across needs the width: only the pane's own sheet reads --cmpx-f, and only from 1280 px */
  assert.equal((SHEET.match(/--cmpx-cols:3/g) || []).length, 1);
  assert.match(media("(min-width:821px) and (max-width:1279px)"), /\.sc-layer0\.sc-secfs \.sc-cmpx__card \.sc-cohstrip\{ grid-template-columns:repeat\(var\(--coh-n,11\),minmax\(0,1fr\)\) !important; \}/);
});

test("the list keeps its place — how far DOWN it is — across a feed tick and across a rebuild of the pane", () => {
  /* a stand-in list that behaves as a browser's does: replacing its content throws it back to the top */
  const listOn = (w, y) => { const sc = w.mk("cmpxScroll"); sc._y = y; sc._h = "old";
    Object.defineProperties(sc, { scrollTop: { get() { return this._y; }, set(v) { this._y = v; } }, innerHTML: { get() { return this._h; }, set(v) { this._h = v; this._y = 0; } } });
    return sc; };
  const w = makeWorld(page); w.api.SC_BLEND.at = Date.now();
  const pane = w.mk("cohCompare", { innerHTML: "" });
  w.api.cohComparePaint();
  assert.match(pane.innerHTML, /^<div class="sc-cmpx__bar" id="cmpxBar">[\s\S]*id="cmpxScroll"[\s\S]*PAGE SPECS/, "a first paint draws the whole panel");
  const shell = pane.innerHTML, sc = listOn(w, 506);                                  // one screen down, on the 1680 screen
  w.api.cohComparePaint();
  assert.equal(sc.scrollTop, 506, "a feed tick: the same three cards are still in front of the reader");
  assert.match(sc.innerHTML, /^<section class="sc-cmpx__card/); assert.equal(pane.innerHTML, shell, "the handle and PAGE SPECS were not redrawn");
  /* a rebuild (a click on a cohort's bar remounts the pane): the place was remembered as the reader scrolled, and is put back */
  const again = makeWorld(page); again.api.SC_BLEND.at = Date.now();
  assert.equal(again.heard.scroll.length, 1, "the page listens for the list's own scroll");
  again.heard.scroll[0]({ target: { id: "somethingElse", scrollTop: 55, scrollLeft: 900 } });
  again.heard.scroll[0]({ target: { id: "cmpxScroll", scrollTop: 1013, scrollLeft: 0 } });   // the reader scrolls to the last three cards
  const fresh = listOn(again, 0);
  again.api.cmpxRestoreScroll();
  assert.equal(fresh.scrollTop, 1013);
  again.heard.scroll[0]({ target: { id: "cmpxScroll", scrollTop: 0, scrollLeft: 0 } });      // back at the top by hand: nothing is forced
  fresh.scrollTop = 0; again.api.cmpxRestoreScroll(); assert.equal(fresh.scrollTop, 0);
  /* nothing in the compare block reads or sets a sideways position any more */
  const BLOCK = page.slice(page.indexOf("/* ══ HC1 (6 Oct) — EVERY COMPARE VIEW ON ONE SCREEN"), page.indexOf("\nfunction boardPanelHTML() {"));
  assert.doesNotMatch(BLOCK, /scrollLeft|CMPX_X\b/);
  assert.match(BLOCK, /let CMPX_Y = 0;/);
});

test("PAGE SPECS says how the panel is laid out, under the list — never inside a card", () => {
  const t = makeWorld(page).api.CMPX_SPECS.replace(/<[^>]+>/g, " ");
  for (const s of ["Every compare view sits one above the other: scroll down.", "Nothing here scrolls sideways.", "A card takes a third of the list, so three views show at once and the nine are three screens of three",
    "in full screen the nine sit three across and all show", "Each card stretches its own tallest bar to the top and prints that scale"]) assert.ok(t.includes(s), s);
  assert.doesNotMatch(t, /side by side|sideways\.\s*A bar/, "the old sentence is gone");
  assert.doesNotMatch(makeWorld(page).api.cmpxCardsHTML(), /<p>|sc-pagespecs/, "no sentence inside a card");
});

/* ── the page as measured in a headless browser (deliverables/20261007/hc2-compare-stacked/data, written by tools/capture.mjs):
      what the report says, held to what was read off the page ─────────────────────────────────────────────────────────── */
const cap = (which, tag) => JSON.parse(fs.readFileSync(new URL("../deliverables/20261007/hc2-compare-stacked/data/capture-" + which + "-" + tag + ".json", import.meta.url), "utf8"));
const laidOut = (j) => Object.entries(j.steps).filter(([, v]) => v && v.sideways && typeof v.sideways === "object");   // the states read whole

test("measured at 1680, 1440, 1280 and 390: no sideways scroll at any level, in any state; nothing cut; three cards to the list", () => {
  for (const tag of ["1680", "1440", "1280", "390"]) {
    const j = cap("after", tag);
    assert.equal(j.error, undefined, tag + ": the run finished"); assert.equal(j.requests.stoppedNonGet, 0); assert.equal(j.consoleErrors.length, 0);
    assert.ok(laidOut(j).length >= 8, tag + ": every state was measured");
    for (const [step, v] of laidOut(j)) {
      for (const [level, px] of Object.entries(v.sideways)) assert.equal(px, 0, tag + " · " + step + " · " + level + " cannot be scrolled sideways");
      assert.equal(v.listScroll.overflowX, "hidden", tag + " · " + step); assert.equal(v.listScroll.left, 0);
      assert.equal(v.listScroll.wholeW, v.listScroll.shownW, tag + " · " + step + ": the list is no wider than what shows");
      assert.deepEqual(v.cutLabels, [], tag + " · " + step + ": no name or number is cut");
      for (const c of v.cards) assert.ok(c.w <= v.list.w, tag + " · " + step + " · " + c.view + " is no wider than the list");
    }
    const o = j.steps.opens, phone = tag === "390";
    /* a card of one row of bars is a third of the list less the gaps; on a phone the two cards of more than eleven columns take two rows */
    for (const c of o.cards) { if (c.rowsOfBars === 1) assert.ok(c.shareOfListHeight > 0.30 && c.shareOfListHeight < 0.335, tag + " · " + c.view + " takes " + c.shareOfListHeight + " of the list"); assert.ok(c.barTrackH >= 44, c.view + ": the track keeps its floor"); }
    assert.deepEqual(o.cards.filter((c) => c.rowsOfBars === 2).map((c) => c.view), phone ? ["BREADTH", "COHORTS"] : []);
    if (!phone) {
      assert.deepEqual(o.cardsFullyShown, ["SECTORS · BLENDED", "BREADTH", "STATE STREET"]);
      assert.deepEqual(j.steps.oneScreenDown.cardsFullyShown, ["iSHARES", "VANGUARD", "EQUAL-WEIGHT"]);
      assert.deepEqual(j.steps.atTheEnd.cardsFullyShown, ["COHORTS", "OUR NAMES", "INDEX FUNDS"]);
      assert.equal(j.steps.fullScreen.cardsFullyShown.length, 9, tag + ": full screen shows all nine");
      assert.ok(j.steps.fullScreen.listScroll.wholeH <= j.steps.fullScreen.listScroll.shownH, tag + ": …with nothing to scroll");
      assert.equal(j.steps.cohortClick.listAfter, j.steps.cohortClick.listBefore); assert.equal(j.steps.cohortClick.board, "METALS");
    }
    /* the handle stays put while the list scrolls, live and rewound; LIVE is there to press */
    for (const step of ["oneScreenDown", "atTheEnd", "replayedScrolled"]) assert.equal(j.steps[step].replayBarMovedPx, 0, tag + " · " + step);
    assert.ok(j.steps.replayedScrolled.listScroll.top > 100); assert.equal(j.steps.replayedScrolled.replay.liveChipShown, true); assert.equal(j.steps.replayedScrolled.replay.date, "2026-09-08");
    assert.equal(j.steps.keepsPlaceOnRepaint.after, j.steps.keepsPlaceOnRepaint.before);
    /* the replay is still the board's own clock */
    assert.equal(j.steps.replayed.bar.thisThumb, j.steps.replayed.bar.boardThumb); assert.equal(j.steps.replayed.bar.boardStamp, "2026-09-08");
    assert.equal(j.steps.playing.second, "❙❙ PAUSE"); assert.equal(j.steps.playing.board, "❙❙ PAUSE"); assert.ok(j.steps.playing.day > "2026-09-08");
    assert.equal(j.steps.backToLive.day, null); assert.equal(j.steps.backToLive.liveChipShown, false);
    /* the ⤢: the word and the pair under each bar, none cut */
    assert.equal(j.steps.unfolded.stateStreet.words.length, 11); assert.deepEqual(j.steps.unfolded.stateStreet.cutWords, []);
    assert.equal(j.steps.cohortsUnfolded.rowsOfBars, 2); assert.deepEqual(j.steps.cohortsUnfolded.cut, []); assert.deepEqual(j.steps.fullScreenUnfolded.cutWords, []);
    /* OUR NAMES unfolded wears the longest names on the screen: each has its whole column, and none is cut */
    const on = j.steps.ourNamesUnfolded;
    assert.deepEqual(on.cut, [], tag + ": OUR NAMES unfolded"); assert.ok(on.names.includes("INDUSTRY")); assert.equal(on.rowsOfBars, phone ? 2 : 1);
    assert.ok(on.longestNameCssPx <= on.columnCssPx, tag + ": " + on.longestName + " (" + on.longestNameCssPx + " px) fits its column (" + on.columnCssPx + ")");
  }
});

test("measured at the widths in between — where the zoom steps, where the rows switch, where the dashboard stacks, a small phone", () => {
  const E = JSON.parse(fs.readFileSync(new URL("../deliverables/20261007/hc2-compare-stacked/data/edge-widths.json", import.meta.url), "utf8"));
  assert.deepEqual(E.runs.map((r) => r.width), [1920, 1400, 1279, 1100, 901, 821, 360]);
  for (const r of E.runs) {
    assert.equal(r.error, undefined, r.width + ": the run finished"); assert.equal(r.requests.stoppedNonGet, 0); assert.equal(r.consoleErrors.length, 0);
    assert.equal(r.states.length, 4);
    for (const s of r.states) {
      assert.equal(s.sidewaysPx, 0, r.width + " · " + s.state + ": nothing to scroll sideways");
      assert.deepEqual(s.cut, [], r.width + " · " + s.state + ": no name, number or word is cut");
      assert.deepEqual(s.cardsRunningOverTheirBox, [], r.width + " · " + s.state + ": no card runs over its box");
      assert.equal(s.cards.length, 9);
      /* one card to a line everywhere but full screen from 1280 px, which is three */
      assert.equal(s.cardsToALine, /^full screen/.test(s.state) && r.width >= 1280 ? 3 : 1, r.width + " · " + s.state);
    }
    /* the bars-to-a-row rule, read off the page: from 1280 px one row (unfolded COHORTS two); under it, more than eleven columns or unfolded takes two */
    const rows = (st, id) => r.states[st].cards.find((c) => c.id === id).rowsOfBars;
    assert.equal(rows(0, "SPDR"), 1); assert.equal(rows(0, "BOWTIE"), r.width >= 1280 ? 1 : 2); assert.equal(rows(0, "COHORTS"), r.width >= 1280 ? 1 : 2);
    assert.equal(rows(1, "SPDR"), r.width >= 1280 ? 1 : 2); assert.equal(rows(1, "COHORTS"), 2); assert.equal(rows(1, "MEMBERS"), r.width >= 1280 ? 1 : 2);
  }
});

test("measured before, on the Hub as deployed: one row 3,388 px wide that had to be swiped", () => {
  for (const tag of ["1680", "390"]) {
    const o = cap("before", tag).steps.opens;
    assert.equal(o.listScroll.overflowX, "auto"); assert.equal(o.listScroll.wholeW, 3388);
    assert.ok(o.listScroll.wholeW > 6 * o.listScroll.shownW, tag + ": more than six panels of row");
    assert.equal(o.cardsFullyShown.length, 1, tag + ": one card in full");
  }
});
