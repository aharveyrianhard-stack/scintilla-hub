// SENTIMENT master tab — offline checks. The math block is lifted out of index.html
// by its markers and run in a bare sandbox, so these tests exercise the exact bytes
// the page ships, with no network and no DOM.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const between = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, "marker " + a); const j = html.indexOf(b, i + a.length); assert.ok(j > i, "marker " + b); return html.slice(i + a.length, j); };
const M = vm.runInNewContext(between("/* SENTI-MATH */", "/* /SENTI-MATH */") + "; SENTI", {});
// the sandbox has its own Array/Object realm: compare shapes, not prototypes
const plain = (x) => JSON.parse(JSON.stringify(x));

test("moving average, returns and percentile are exact", () => {
  assert.deepEqual(plain(M.sma([1, 2, 3, 4], 2)), [null, 1.5, 2.5, 3.5]);
  assert.deepEqual(plain(M.ret([100, 110, 121], 1)).map((v) => v == null ? v : +v.toFixed(3)), [null, 0.1, 0.1]);
  assert.equal(M.pct([1, 2, 3, 4, 5], 3), 60);
  assert.equal(M.pct([1, null, NaN, 4], 4), 100);
  assert.equal(M.pct([], 1), null);
  assert.equal(M.pct([1, 2], null), null);
});

test("linear lean map clamps at the stated extremes", () => {
  assert.equal(M.lin(0, 0.3), 50);
  assert.equal(M.lin(0.15, 0.3), 75);
  assert.equal(M.lin(-0.3, 0.3), 0);
  assert.equal(M.lin(9, 0.3), 100);
  assert.equal(M.lin(NaN, 0.3), null);
});

test("labels follow the CNN bands", () => {
  assert.equal(M.label(10), "EXTREME FEAR"); assert.equal(M.label(30), "FEAR"); assert.equal(M.label(50), "NEUTRAL");
  assert.equal(M.label(60), "GREED"); assert.equal(M.label(90), "EXTREME GREED"); assert.equal(M.label(null), "NO READING");
});

test("the headline counts LIVE inputs only — stale and missing are shown, never counted", () => {
  const h = M.headline([{ status: "live", score: 20 }, { status: "live", score: 40 }, { status: "stale", score: 95 }, { status: "none", score: null }, { status: "none" }]);
  assert.deepEqual(plain(h), { score: 30, n: 2, of: 5, label: "FEAR" });
  assert.deepEqual(plain(M.headline([{ status: "stale", score: 90 }])), { score: null, n: 0, of: 1, label: "NO READING" });
});

test("the keyword lexicon leans the obvious way and honours negation", () => {
  assert.ok(M.lexLean("$NVDA bullish breakout, loading calls") > 0);
  assert.ok(M.lexLean("puts printing, this thing is going to tank") < 0);
  assert.ok(M.lexLean("not bullish at all here") < 0);
  assert.equal(M.lexLean("earnings on thursday after the close"), 0);
  assert.equal(M.lexLean("long term short term"), 0, "bare long/short are deliberately neutral");
  assert.equal(M.lexLean("https://bullish.example/rip"), 0, "URLs are stripped before matching");
});

test("X voice keeps to the window, splits leans and counts cashtags", () => {
  const now = Date.parse("2026-09-23T08:00:00Z"), h = 3600e3;
  const posts = [
    { created_at: new Date(now - 1 * h).toISOString(), text: "$AAPL ripping, bullish" },
    { created_at: new Date(now - 2 * h).toISOString(), text: "$AAPL $TSLA dump incoming, bearish" },
    { created_at: new Date(now - 3 * h).toISOString(), text: "$MSFT earnings thursday" },
    { created_at: new Date(now - 30 * h).toISOString(), text: "$OLD bullish bullish bullish" },
    { created_at: "garbage", text: "bullish" },
    ...Array.from({ length: 22 }, () => ({ created_at: new Date(now - 50 * h).toISOString(), text: "bullish" })),   // an earlier day with ≥20 leaning posts → history
  ];
  const v = M.xVoice(posts, now, 24 * h);
  assert.equal(v.n, 3); assert.equal(v.bull, 1); assert.equal(v.bear, 1); assert.equal(v.net, 0);
  assert.equal(v.latest, now - 1 * h);
  assert.deepEqual(plain(v.top[0]), ["$AAPL", 2]);
  assert.deepEqual(plain(v.hist), [1], "history = net share of earlier days with ≥20 leaning posts; today and thin days excluded");
  assert.equal(M.xVoice([], now).n, 0);
  assert.deepEqual(plain(M.xVoice([], now).hist), []);
});

test("weighted mean weights by count and ignores empty rows", () => {
  assert.equal(M.wmean([{ score: 0.2, n: 3 }, { score: -0.1, n: 1 }, { score: 9, n: 0 }, { score: "x", n: 5 }], "score", "n").toFixed(9), (0.125).toFixed(9));
  assert.equal(M.wmean([], "score", "n"), null);
});

test("age text", () => {
  assert.equal(M.ageTxt(10e3), "now"); assert.equal(M.ageTxt(5 * 60e3), "5m"); assert.equal(M.ageTxt(7 * 3600e3), "7h"); assert.equal(M.ageTxt(3 * 86400e3), "3d"); assert.equal(M.ageTxt(null), "—");
});

test("the room is wired into the master tabs, the view key, the mount and the entry hash", () => {
  assert.ok(html.includes('const SECTIONS = ["DASHBOARD", "SCENES", "NEWS", "SOCIAL", "SENTIMENT", "ALERTS", "SCREENER", "EVENTS", "ECONOMIC"]'));
  assert.ok(html.includes('case "SENTIMENT": return "SENTI";'));
  assert.ok(html.includes('case "SENTIMENT": return sentimentRoomHTML();'));
  assert.ok(html.includes('else if (S.sec === "SENTIMENT") fillSentiment();'));
  assert.ok(html.includes('document.body.classList.toggle("senti", S.sec === "SENTIMENT");'));
  const fn = between("function scEntryRoom() {", "\n}") ;
  const entry = (hash) => vm.runInNewContext("(function(){" + fn + "})()", { location: { hash } });
  assert.equal(entry("#sentiment"), "SENTIMENT"); assert.equal(entry("#economic"), "ECONOMIC"); assert.equal(entry(""), null);
  assert.ok(html.includes('window.addEventListener("hashchange", () => { const r = scEntryRoom(); if (r && S.sec !== r) go(r); });'));
});

test("the SOCIAL → SENTIMENT sub-tab is untouched", () => {
  assert.ok(html.includes('const SOC_TABS = [["SENTIMENT","SENTIMENT"],["YOUTUBE","YOUTUBE"],["X","X"],["STOCKTWITS","STOCKTWITS"]];'));
  assert.ok(html.includes("function socSentimentPaneHTML() {"));
  assert.ok(html.includes('else if (S.socTab === "SENTIMENT") fillSocial();'));
});

test("house rule: the new room is monochrome — no white, no near-white, no bull/bear colour", () => {
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");   // comments may SAY "white"; values may not USE it
  // both slices begin inside their opening comment, so the opener is put back before stripping
  const css = strip("/*" + between("/* ── Room · SENTIMENT (master tab)", '/* ── AREA D · "◆ AI READ"'));
  const js = strip("/*" + between("Room · SENTIMENT (master tab, market-wide)", "/* ---- Room 8 · EVENTS"));
  const bad = /#fff\b|#ffffff\b|#f[0-9a-f]f[0-9a-f]f[0-9a-f]\b|(?<![-\w])white(?![-\w])|rgb\(\s*255\s*,\s*255\s*,\s*255|var\(--ink\)|var\(--bull\)|var\(--bear\)|var\(--crk\)|var\(--sv[1-5]\)/i;
  for (const [name, txt] of [["css", css], ["js", js]]) { const m = txt.match(bad); assert.equal(m, null, name + " uses a forbidden colour: " + (m && m[0])); }
  assert.ok(css.includes("body.senti .sc-cohrow{ display:none; }"));
});

test("stale StockTwits and missing CNN inputs are labelled on the row, never scored", () => {
  const js = between("Room · SENTIMENT (master tab, market-wide)", "/* ---- Room 8 · EVENTS");
  assert.ok(js.includes('name: "Put / call ratio", val: "no source", score: null, none: true'));
  assert.ok(js.includes('name: "52-week highs vs lows", val: "no source", score: null, none: true'));
  assert.ok(js.includes('name: "Stock price breadth", val: "no source", score: null, none: true'));
  assert.ok(js.includes("the ingester has not written since. Shown, never counted."));
});
