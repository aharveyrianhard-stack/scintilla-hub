/* The room now claims it can show how every reading is built. These run the page's own
   code — lifted straight out of index.html, no browser, no network — and pin the claims:
   the words that scored an item are the words the page highlights, a negator really does
   flip one, the keyword tracker counts what fired, a question is scored and then left
   out, a headline with no scoring word gets NO score rather than a zero, the dial's five
   zones sit where CNN puts them, and StockTwits is gone from the room and from the blend.
   The news scorer is checked against lib/news-sentiment.mjs and the shared fixtures, so
   the browser, the job that stores the rows and these tests cannot drift apart. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as NS from "../lib/news-sentiment.mjs";

const PAGE = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const LEX = JSON.parse(fs.readFileSync(new URL("../data/news-lexicon/lm-headline-v1.json", import.meta.url), "utf8"));

function slice(from, to, what) {
  const a = PAGE.indexOf(from), b = PAGE.indexOf(to);
  assert.ok(a > 0 && b > a, "the page must still carry " + what);
  return PAGE.slice(a, b);
}
const MATH = slice("/* SENTI-MATH */", "/* /SENTI-MATH */", "the sentiment maths");
const WORDS = slice("function snDecode(t) {", "const SENTI_TABS", "the word highlighter");
const DIAL = slice("const FG_ZONES = [", "function sgBar(", "the dial zones");

const API = new Function(`
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const SENTI_CACHE = {};
  ${MATH}
  ${WORDS}
  ${DIAL}
  return { SENTI, snHiHTML, SN_SOC_SETS, snSum, snLeanCls, newsScore, newsAggregate, sgZone, FG_ZONES, NEWS_WINDOW_MS, SENTI_T };
`)();
const { SENTI, snHiHTML, SN_SOC_SETS, newsScore, newsAggregate, sgZone } = API;
const NEWS_SETS = {
  bull: new Set(LEX.lm_positive.concat(LEX.supplement_positive)),
  bear: new Set(LEX.lm_negative.concat(LEX.supplement_negative)),
  neg: new Set(LEX.negators),
  unc: new Set(LEX.lm_uncertainty),
};

test("a reading can be taken apart: every word that scored is returned with its position", () => {
  const r = SENTI.lexScan("NVDA breakout looks strong, but the bubble is not bullish");
  const words = r.marks.map((m) => m.w);
  assert.deepEqual(words, ["breakout", "strong", "bubble", "bullish"]);
  assert.equal(r.marks[3].negated, true, "a negator three words back flips the hit");
  assert.equal(r.marks[3].effect, -1);
  assert.equal(r.net, r.marks.reduce((s, m) => s + m.effect, 0), "the lean IS the sum of the marks");
  assert.equal(SENTI.lexLean("NVDA breakout looks strong, but the bubble is not bullish"), r.net,
    "lexLean must keep producing the number the room already shows");
});

test("the highlighter marks exactly the words the score counted, and no others", () => {
  const text = "AAPL is not strong here, the breakout failed";
  const scan = SENTI.lexScan(text);
  const hi = snHiHTML(text, SN_SOC_SETS);
  assert.equal(hi.net, scan.net);
  assert.equal(hi.pos, scan.bull);
  assert.equal(hi.neg, scan.bear);
  assert.equal((hi.html.match(/class="hi /g) || []).length, scan.marks.length, "one highlight per scoring word");
  assert.match(hi.html, /hi-flip/, "the flipped word is struck through");
  assert.ok(!/<b[^>]*>is<\/b>/.test(hi.html), "an ordinary word is never highlighted");
});

test("a link is never scored or highlighted", () => {
  const withLink = snHiHTML("strong https://x.com/a/crash/bubble move", SN_SOC_SETS);
  assert.equal(withLink.pos, 1);
  assert.equal(withLink.neg, 0, "words inside a URL must not count");
});

test("the keyword tracker counts today against the week, on the side the word scored", () => {
  const now = Date.UTC(2026, 8, 23, 12);
  const items = [
    { at: now - 3600e3, text: "bullish breakout" },
    { at: now - 7200e3, text: "not bullish at all" },
    { at: now - 4 * 86400e3, text: "bullish again" },
    { at: now - 30 * 86400e3, text: "bullish long ago" },
  ];
  const t = SENTI.lexTally(items, now, 86400e3, 7 * 86400e3);
  const bull = t.bullToday.find((c) => c.w === "bullish");
  assert.equal(bull.n, 1, "one un-flipped bullish word today");
  assert.equal(t.weekCount("bullish"), 2, "the week carries today's and the one four days back");
  const flipped = t.bearToday.find((c) => c.w === "bullish" && c.negated);
  assert.ok(flipped, "a flipped bullish word is counted on the bearish side and marked");
  assert.equal(t.weekCount("bullish (flipped)"), 1);
});

test("a headline with no scoring word gets NO score — never a zero", () => {
  const r = newsScore("Fed holds rates steady", "", { sets: NEWS_SETS });
  assert.equal(r.score, null);
  assert.equal(r.hits, 0);
  assert.match(String(r.reason), /no lexicon word/);
});

test("a question is scored but never counted", () => {
  const q = newsScore("Is NVDA about to crash?", "", { sets: NEWS_SETS });
  assert.equal(q.question, true);
  assert.equal(q.score, -1, "the score is still shown, so the exclusion can be checked");
  const now = Date.now();
  const rows = [
    { published_ts: Math.floor(now / 1000) - 60, ticker: "NVDA", s: q },
    { published_ts: Math.floor(now / 1000) - 60, ticker: "NVDA", s: newsScore("NVDA surges", "", { sets: NEWS_SETS }) },
  ];
  const agg = newsAggregate(rows, now);
  assert.equal(agg.questions, 1);
  assert.equal(agg.n, 1, "only the statement counts");
  assert.equal(agg.mean, 1, "the question did not drag the reading down");
});

test("the room's scorer, the module and the shipped fixtures all agree", () => {
  const cases = JSON.parse(fs.readFileSync(new URL("./fixtures/news-sentiment-cases.json", import.meta.url), "utf8")).cases;
  const L = NS.prepare(LEX);
  for (const c of cases) {
    const mod = NS.scoreText(c.text, L);
    assert.equal(mod.score === null ? null : Math.round(mod.score * 1000) / 1000, c.expect.score, "module: " + c.text);
    assert.equal(mod.pos, c.expect.pos, "module pos: " + c.text);
    assert.equal(mod.neg, c.expect.neg, "module neg: " + c.text);
    assert.deepEqual(mod.marks.map((m) => m.w + (m.negated ? "!" : "")), c.expect.words, "module words: " + c.text);
    const page = newsScore(c.text, "", { sets: NEWS_SETS });
    const pageScore = page.score === null ? null : Math.round(page.score * 1000) / 1000;
    assert.equal(pageScore, c.expect.score, "the page must score it the same: " + c.text);
    assert.equal(page.pos, c.expect.pos, "page pos: " + c.text);
    assert.equal(page.neg, c.expect.neg, "page neg: " + c.text);
  }
});

test("the aggregate counts every scored headline once and says what it left out", () => {
  const now = Date.now(), ts = Math.floor(now / 1000) - 60;
  const mk = (t, ticker) => ({ published_ts: ts, ticker, s: newsScore(t, "", { sets: NEWS_SETS }) });
  const agg = newsAggregate([
    mk("AAPL surges", "AAPL"), mk("AAPL beats", "AAPL"), mk("TSLA plunges", "TSLA"),
    mk("Fed holds rates steady", "SPY"),
  ], now);
  assert.equal(agg.n, 3);
  assert.equal(agg.unscored, 1, "the one with no scoring word is reported, not averaged in");
  assert.equal(Math.round(agg.mean * 1000) / 1000, Math.round(((1 + 1 - 1) / 3) * 1000) / 1000,
    "each scored headline counts once, so two AAPL stories outweigh one TSLA");
  const aapl = agg.tickers.find((t) => t.ticker === "AAPL");
  assert.equal(aapl.n, 2);
});

test("the dial's five zones sit where the publishers put them", () => {
  assert.equal(sgZone(0).name, "extreme fear");
  assert.equal(sgZone(24).name, "extreme fear");
  assert.equal(sgZone(25).name, "fear");
  assert.equal(sgZone(44).name, "fear");
  assert.equal(sgZone(45).name, "neutral");
  assert.equal(sgZone(55).name, "greed");
  assert.equal(sgZone(75).name, "extreme greed");
  assert.equal(sgZone(100).name, "extreme greed");
  assert.equal(sgZone(null), null, "no reading gets no zone");
});

test("the dial is drawn with all five zones in colour, and a needle only when there is a reading", () => {
  for (const v of ["--fg1", "--fg2", "--fg3", "--fg4", "--fg5"]) assert.ok(DIAL.includes(v), "zone colour " + v + " must be on the dial");
  assert.equal(API.FG_ZONES.length, 5, "five zones, the way the publishers draw them");
  const DIALSRC = PAGE.slice(PAGE.indexOf("function sgDial(score, max)"), PAGE.indexOf("function sgCardHTML"));
  assert.match(DIALSRC, /for \(const z of FG_ZONES\)/, "the zones are drawn as real arcs, not painted on");
  assert.match(DIALSRC, /if \(ok\) \{/, "the needle is drawn only when a value exists");
  /* every zone colour is a colour, and none of them is white */
  const css = PAGE.slice(PAGE.indexOf("--fg1:"), PAGE.indexOf("--fg5:") + 40);
  for (const m of css.matchAll(/#([0-9A-Fa-f]{6})/g)) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) <= 240, "no channel may be white-bright: #" + m[1]);
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) > 24, "a zone colour must actually be a colour: #" + m[1]);
  }
});

test("StockTwits is gone from the room and from every blend", () => {
  const ROOM = PAGE.slice(PAGE.indexOf("/* SENTI-MATH */"), PAGE.indexOf("/* ═══ SENTIMENT · YOUTUBE"));
  assert.ok(!/social_posts\?select/.test(ROOM), "the room must not read social_posts any more");
  assert.ok(!/key: "stocktwits"/.test(ROOM), "there must be no StockTwits voice or input");
  assert.ok(!/STOCKTWITS/.test(ROOM), "the room does not mention it at all");
  /* the SOCIAL room's own reserved slot is another lane's surface and its own test guards
     it, so M27 left it exactly as it was and wrote it up as a decision for Alan instead. */
});

test("the shipped lexicon carries its provenance and matches its own counts", () => {
  assert.equal(LEX.method, "lm-v1");
  assert.ok(LEX.source && LEX.source.fetched_from && LEX.source.file_sha256, "where the dictionary came from must be recorded");
  assert.equal(LEX.counts.lm_positive, LEX.lm_positive.length);
  assert.equal(LEX.counts.lm_negative, LEX.lm_negative.length);
  assert.equal(LEX.counts.supplement_positive, LEX.supplement_positive.length);
  assert.equal(LEX.counts.supplement_negative, LEX.supplement_negative.length);
  assert.ok(LEX.lm_negative.length > LEX.lm_positive.length * 3, "the imbalance the balance-score exists for");
  assert.ok(LEX.known_bias && LEX.why_supplement && LEX.question_rule, "the caveats ship with the words");
});
