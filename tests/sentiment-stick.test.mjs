/* Lane M30. Alan asked for three things that can be checked without a browser: every
   voice measured the same way, the words people actually use, and keywords tied to the
   ticker they were said about. These run the page's own code, lifted out of index.html,
   with no network and no browser. The breadth test reads the measured snapshot and
   checks it against itself, so a half-written file cannot quietly become a reading. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PAGE = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function slice(from, to, what) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to);
  assert.ok(a > 0 && b > a, "the page must still carry " + what);
  return PAGE.slice(a, b);
}
const SENTI = new Function(slice("/* SENTI-MATH */", "/* /SENTI-MATH */", "the sentiment maths") + "; return SENTI;")();
const DAY = 86400e3, NOW = Date.UTC(2026, 8, 23, 23, 0, 0);

test("one measuring stick: the percentages are of the SCORED items, never of the read ones", () => {
  const v = SENTI.voiceStat({ key: "x", name: "X", read: 200, scored: 40, bull: 30, bear: 6, window: "24 hours" });
  assert.equal(v.read, 200);
  assert.equal(v.scored, 40);
  assert.equal(v.bullPct, 75);          // 30 of 40 scored, not 30 of 200 read
  assert.equal(v.bearPct, 15);
  assert.equal(v.flat, 4);              // scored but leaning neither way
  assert.equal(v.coverage, 20);         // 40 of 200 carried a word we know
  assert.equal(v.net, 60);              // (30-6)/40 -> +60 on -100..+100
});

test("a voice with nothing scored reports no reading rather than a zero", () => {
  const v = SENTI.voiceStat({ key: "youtube", name: "YOUTUBE", read: 12, scored: 0, bull: 0, bear: 0 });
  assert.equal(v.net, null);
  assert.equal(v.bullPct, null);
  assert.equal(v.coverage, 0);
  assert.equal(v.thin, true, "under 30 scored items is a thin voice, and says so");
});

test("every voice is measured with the same five numbers", () => {
  const keys = (o) => Object.keys(o).sort().join(",");
  const a = SENTI.voiceStat({ key: "news", name: "NEWS", read: 31, scored: 28, bull: 21, bear: 7, window: "24 hours" });
  const b = SENTI.voiceStat({ key: "youtube", name: "YOUTUBE", read: 90, scored: 50, bull: 20, bear: 20, window: "7 days" });
  assert.equal(keys(a), keys(b));
  assert.equal(a.net, 50);
  assert.equal(b.net, 0, "an even split is zero, and is not the same as no reading");
  assert.notEqual(b.net, null);
});

test("slang, abbreviations and emoji are read, and each carries a note", () => {
  for (const [text, want] of [["rekt again", -1], ["LFG 🚀", 1], ["ngmi", -1], ["tendies printed", 1], ["bagholder here 💀", -1]]) {
    const r = SENTI.lexScan(text);
    assert.ok(r.marks.length, "nothing matched in: " + text);
    assert.equal(Math.sign(r.net), want, text);
  }
  for (const e of SENTI.SOCIAL_LEX_ADDED) {
    assert.ok(e[0] && (e[1] === 1 || e[1] === -1), "polarity must be +1 or -1: " + e[0]);
    assert.ok(["word", "phrase", "emoji"].includes(e[2]), "kind must be word, phrase or emoji: " + e[0]);
    assert.ok(typeof e[3] === "string" && e[3].length > 8, "every entry needs a note saying why: " + e[0]);
  }
  assert.match(SENTI.SOCIAL_LEX_VERSION, /^sc-social-v\d/);
});

test("a phrase is read as one thing, so 'puts printing' is bearish and 'buy the dip' is one reading", () => {
  const p = SENTI.lexScan("puts printing today");
  assert.deepEqual(p.marks.map((m) => m.w), ["puts printing"]);
  assert.equal(p.net, -1, "the phrase wins over the bullish word inside it");
  const d = SENTI.lexScan("buy the dip");
  assert.deepEqual(d.marks.map((m) => m.w), ["buy the dip"]);
  assert.equal(d.net, 1);
  const s = SENTI.lexScan("this is a short squeeze");
  assert.deepEqual(s.marks.map((m) => m.w), ["short squeeze"]);
  assert.equal(s.net, 1, "the words apart would read bearish");
});

test("the old readings do not move: v1 words, negation and the three-word window are unchanged", () => {
  const a = SENTI.lexScan("NVDA breakout looks strong, but the bubble is not bullish");
  assert.deepEqual(a.marks.map((m) => m.w), ["breakout", "strong", "bubble", "bullish"]);
  assert.equal(a.marks[3].negated, true);
  assert.equal(a.marks[3].effect, -1);
  const core = SENTI.lexScanCore("NVDA breakout looks strong, but the bubble is not bullish");
  assert.equal(core.net, a.net, "a sentence with no slang must read the same before and after");
});

test("keywords are tied to the ticker they were said about", () => {
  const items = [
    { at: NOW - 3600e3, text: "$NVDA breakout, calls printing 🚀", tks: ["NVDA"] },
    { at: NOW - 2 * 3600e3, text: "NVDA looks overbought here", tks: ["nvda"] },
    { at: NOW - 3 * DAY, text: "TSLA rekt 💀", tks: ["TSLA"] },
  ];
  const out = SENTI.lexTallyByTicker(items, NOW, DAY, 7 * DAY);
  const nv = out.find((r) => r.tk === "NVDA");
  assert.ok(nv, "the ticker is normalised, $ and case and all");
  assert.equal(nv.itemsToday, 2);
  assert.deepEqual(nv.bullToday.map((w) => w.w).sort(), ["breakout", "calls printing", "🚀"].sort());
  assert.deepEqual(nv.bearToday.map((w) => w.w), ["overbought"]);
  const ts = out.find((r) => r.tk === "TSLA");
  assert.equal(ts.itemsToday, 0, "three days ago is not today");
  assert.deepEqual(ts.bearWeek.map((w) => w.w).sort(), ["rekt", "💀"].sort(), "but it still counts in the week");
});

test("the spread behind a blended reading is kept, not averaged away", () => {
  const agree = SENTI.chanBlend([{ ch: "a", lean: 1 }, { ch: "b", lean: 1 }]);
  const split = SENTI.chanBlend([{ ch: "a", lean: 1 }, { ch: "b", lean: -1 }]);
  assert.equal(agree.lo, 1); assert.equal(agree.hi, 1);
  assert.equal(split.lo, -1); assert.equal(split.hi, 1);
  assert.equal(split.net, 0);
  assert.equal(split.disagree, 0.5, "an even split is reported as an even split");
  assert.equal(agree.net, 1, "unanimous reads as unanimous");
  assert.equal(agree.hi - agree.lo, 0, "no spread when everyone agrees");
  assert.equal(split.hi - split.lo, 2, "the full spread survives the average");
});

test("the measured breadth snapshot agrees with itself", () => {
  const snap = JSON.parse(fs.readFileSync(new URL("../data/breadth/latest.json", import.meta.url), "utf8"));
  assert.ok(snap.session_et && snap.measured_utc, "a snapshot must say which session and when it was measured");
  assert.ok(snap.measured > 0 && snap.measured <= snap.universe);
  for (const k of ["above50", "above200"]) {
    const b = snap[k];
    assert.ok(b.n >= 0 && b.n <= b.of, k + " cannot count more names than it measured");
    assert.equal(b.pct, Math.round((1000 * b.n) / b.of) / 10, k + " percentage must match its own counts");
  }
  assert.equal(snap.new_highs, snap.names_new_high.length);
  assert.equal(snap.new_lows, snap.names_new_low.length);
  assert.equal(snap.high_low_net, snap.new_highs - snap.new_lows);
  assert.equal(snap.failed.length, 0, "a snapshot with failed names would under-count breadth");
});

test("the room shows the voices instead of dumping a table of them", () => {
  assert.ok(PAGE.includes("snStickHTML(stats)"), "the overview must print the one measuring stick");
  assert.ok(PAGE.includes("snTickerChips("), "tickers are chips now");
  assert.ok(PAGE.includes("KEYWORDS &middot; BY TICKER"), "keywords must be shown per ticker");
  assert.ok(!PAGE.includes('<th>blended lean</th>'), "the old blended data-dump table is gone");
  assert.ok(PAGE.includes("data/breadth/latest.json"), "breadth is read from the measured snapshot");
});
