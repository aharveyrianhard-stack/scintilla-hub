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

const mkt = (key, score, status) => ({ key, score, status: status || "live" });
const voice = (key, score, status) => ({ key, score, status: status || "live" });

test("the headline counts LIVE inputs only — stale and missing are shown, never counted", () => {
  const h = M.headline([mkt("momentum", 20), mkt("volatility", 40), mkt("junk", 30), mkt("safehaven", 95, "stale"), mkt("breadth", null, "none")]);
  assert.equal(h.score, 30);
  assert.equal(h.n, 3, "only the three live market inputs are counted");
  assert.equal(h.of, 5);
  assert.equal(h.label, "FEAR");
  assert.equal(M.headline([mkt("momentum", 90, "stale")]).score, null);

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
  assert.ok(html.includes('case "SENTIMENT": return "SENTI|" + S.sentiTab;'), "each sub-tab is its own mount");
  assert.ok(html.includes('case "SENTIMENT": return sentimentRoomHTML();'));
  assert.ok(html.includes('else if (S.sec === "SENTIMENT") sentiDispatch();'), "the mount dispatches to the open sub-tab");
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

test("house rule for this room (23 Sep): colour where it carries meaning, and still no white", () => {
  /* Alan, 23 Sep: "I need some more colour, but this is very bland." So the SENTIMENT room
     is the one place that may use colour — the fear-to-greed zones, which way an item leans,
     and the words that made it lean. Everything else in the room stays grey, and WHITE IS
     STILL FORBIDDEN, here as everywhere else. */
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");   // comments may SAY "white"; values may not USE it
  const css = strip("/*" + between("/* ── Room · SENTIMENT (master tab)", '/* ── AREA D · "◆ AI READ"'));
  const js = strip("/*" + between("Room · SENTIMENT (master tab, market-wide)", "/* ---- Room 8 · EVENTS"));
  const white = /#fff\b|#ffffff\b|#f[0-9a-f]f[0-9a-f]f[0-9a-f]\b|(?<![-\w])white(?![-\w])|rgb\(\s*255\s*,\s*255\s*,\s*255|var\(--ink\)/i;
  for (const [name, txt] of [["css", css], ["js", js]]) { const m = txt.match(white); assert.equal(m, null, name + " uses white: " + (m && m[0])); }
  /* the only colours allowed are the named scale and the lean/highlight pair */
  const allowed = new Set(["--fg1", "--fg2", "--fg3", "--fg4", "--fg5", "--crk"]);
  for (const m of (css + js).matchAll(/var\(--(sv[1-5]|bull|bear|fg[1-5]|crk|coin)\)/g)) {
    assert.ok(allowed.has("--" + m[1]), "the room may not use " + m[0] + " — colour here is the fear/greed scale only");
  }
  /* and the scale itself is five real, distinct, non-white colours */
  const scale = html.slice(html.indexOf("--fg1:"), html.indexOf("--fg5:") + 40);
  const hexes = [...scale.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  assert.equal(hexes.length, 5, "five zones");
  assert.equal(new Set(hexes).size, 5, "five different colours");
  for (const h of hexes) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) <= 240, "#" + h + " is too close to white");
  }
  assert.ok(css.includes("body.senti .sc-cohrow{ display:none; }"));
});

test("missing inputs are labelled on the row and never scored, and StockTwits is gone", () => {
  const js = between("Room · SENTIMENT (master tab, market-wide)", "/* ---- Room 8 · EVENTS");
  /* 23 Sep: put/call is no longer one of the missing ones. Cboe retired the CSV files in 2019,
     not the data - it still publishes a free JSON after every close - so this input now reads the
     chart API's PCC series, five-day average, inverted, and the row names the published session. */
  assert.ok(js.includes('key: "putcall", name: "Put / call ratio", val, score, none'));
  assert.ok(js.includes('sentiSafe(sentiBars("PCC"))'), "the gauge reads the same series the chart draws");
  assert.ok(js.includes("Cboe daily put/call (PCC)"), "and says where the number came from");
  assert.ok(!js.includes("Cboe retired the free daily files in Oct 2019"), "the retired-in-2019 claim is gone");
  assert.ok(js.includes('name: "52-week highs vs lows", val: "no source", score: null, none: true'));
  assert.ok(js.includes('name: "How many stocks are up"'), "breadth now has a real source");
  assert.ok(js.includes("counted per stock, where CNN weighs by volume"), "and says how it differs from CNN's");
  /* M27, Alan: "You can remove StockTwits." The voice, the input and the read are all gone
     from this room; social_posts itself is untouched in the database. */
  assert.ok(!js.includes('key: "stocktwits"'), "no StockTwits input or voice");
  assert.ok(!js.includes("social_posts?select"), "the room does not read social_posts any more");
  assert.ok(!/STOCKTWITS/.test(js), "and it is not named in the room at all");
});

/* ── the 68-vs-35 fix, pinned ────────────────────────────────────────────────
   The market gauge must measure the market. These four tests fail on the build
   that read 68 GREED while CNN read 35 FEAR the same night. */

test("news, YouTube and X never move the market gauge — they get their own number", () => {
  const ins = [mkt("momentum", 30), mkt("volatility", 30), mkt("junk", 30),
               voice("news", 100), voice("youtube", 100), voice("x", 100)];
  const h = M.headline(ins);
  assert.equal(h.score, 30, "three cheerful feeds must not lift a fearful market reading");
  assert.equal(h.label, "FEAR");
  assert.equal(h.vScore, 100, "the voices keep their own score");
  assert.equal(h.vLabel, "EXTREME GREED");
  assert.equal(h.vN, 3);
  assert.equal(h.n, 3);
});

test("a market reading needs at least three live market inputs, or none is shown", () => {
  const thin = M.headline([mkt("momentum", 80), mkt("volatility", 80), voice("news", 90), voice("x", 90)]);
  assert.equal(thin.score, null, "two market inputs is not a market reading");
  assert.equal(thin.label, "NO MARKET READING");
  assert.equal(thin.vScore, 90, "the voices still read");
  const ok = M.headline([mkt("momentum", 80), mkt("volatility", 80), mkt("breadth", 80)]);
  assert.equal(ok.score, 80);
  assert.equal(ok.label, "EXTREME GREED");
  assert.equal(M.MIN_MARKET, 3);
});

test("every market key is market, every voice key is a voice", () => {
  for (const k of ["momentum", "volatility", "safehaven", "junk", "strength", "breadth", "putcall"]) assert.ok(M.MARKET_KEYS.has(k), k + " must be a market input");
  for (const k of ["news", "youtube", "x", "stocktwits"]) assert.ok(!M.MARKET_KEYS.has(k), k + " must not be a market input");
});

test("deviation scoring: the middle is 50, one normal move is 25 points, and it clamps", () => {
  const flat = Array.from({ length: 100 }, (_, i) => (i % 2 ? 1 : -1));   // mean 0, sd 1
  assert.equal(M.dev(flat, 0), 50, "sitting on its own average is neutral");
  assert.equal(M.dev(flat, 1), 75, "one standard deviation above average");
  assert.equal(M.dev(flat, -1), 25);
  assert.equal(M.dev(flat, 9), 100, "clamped, never above 100");
  assert.equal(M.dev(flat, -9), 0);
  assert.equal(M.dev([1, 1, 1], 1), null, "too little history is no reading, not a guess");
  assert.equal(M.dev(Array.from({ length: 40 }, () => 5), 5), null, "a series that never moves has no scale");
});

test("the board strip stays gone and the room draws no Scintilla composite number", () => {
  const js = between("Room · SENTIMENT (master tab, market-wide)", "/* ---- Room 8 · EVENTS");
  assert.ok(js.includes("async function sentiComputeAll()"), "one shared computation still exists");
  assert.ok(/async function fillSentiment\(\)[\s\S]{0,400}sentiComputeAll\(\)/.test(js), "the tab reads it");
  /* Alan, 23 Sep: "Why is there a fear and greed meter here? Who asked for this?" The board
     strip went in 56f051d and its code goes with it — a dead function is a future regression. */
  assert.ok(!js.includes("function snFrontHTML"), "the board strip's markup is gone");
  assert.ok(!js.includes("fillSnFront"), "and nothing fills it");
  assert.ok(!html.includes('id="snFront"'), "and no element asks for it");
  /* "An internal sentiment meter when we don't have the entire market... same problem as the
     put to call." No blended Scintilla score is drawn: the rows stay, the headline does not. */
  assert.ok(!js.includes("snGaugeSVG(H.score)"), "no Scintilla dial");
  assert.ok(js.includes("There is no single Scintilla fear &amp; greed number here any more"),
    "and the page says so in plain words");
});

test("the headline is the published gauges, each with publisher, date, plain words and a link", () => {
  const blk = between("/* PUBLIC-GAUGES", "/* /PUBLIC-GAUGES */");
  const ctx = { SENTI: M, esc: (x) => String(x), fetch: () => { throw new Error("no network in tests"); },
                sentiBars: () => { throw new Error("no network in tests"); }, sentiSafe: null, SENTI_CACHE: {} };
  const api = vm.runInNewContext("/* PUBLIC-GAUGES" + blk + "; ({ PUBG, sgCardHTML, sgDial })", ctx);
  const keys = api.PUBG.map((g) => g.key);
  for (const want of ["cnn", "crypto", "vix", "putcall", "aaii", "naaim"]) assert.ok(keys.includes(want), "gauge " + want);
  for (const g of api.PUBG) {
    assert.ok(g.pub && g.pub.length > 2, g.key + " names its publisher");
    assert.ok(g.measures && g.measures.length > 30, g.key + " says in one line what it measures");
    assert.ok(/^https:\/\//.test(g.link), g.key + " links to the source");
    assert.ok(typeof g.read === "function" || (g.blocked && g.fix), g.key + " either reads its source or says why it cannot");
  }
});

test("a gauge that cannot be read shows a dash and the reason — never a guess, never a stale number", () => {
  const blk = between("/* PUBLIC-GAUGES", "/* /PUBLIC-GAUGES */");
  const ctx = { SENTI: M, esc: (x) => String(x), fetch: null, sentiBars: null, sentiSafe: null, SENTI_CACHE: {} };
  const api = vm.runInNewContext("/* PUBLIC-GAUGES" + blk + "; ({ PUBG, sgCardHTML })", ctx);
  const blocked = api.PUBG.find((g) => g.key === "aaii");
  const offCard = api.sgCardHTML({ g: blocked, ok: false, blocked: true, e: blocked.blocked });
  assert.ok(offCard.includes("<b>—</b>"), "no number is shown");
  assert.ok(offCard.includes("403"), "the real reason is on the card");
  assert.ok(offCard.includes("what would fix it"), "and what would make it readable");
  const failed = api.sgCardHTML({ g: api.PUBG.find((g) => g.key === "cnn"), ok: false, e: "CNN answered 500" });
  assert.ok(failed.includes("CNN answered 500") && failed.includes("<b>—</b>"), "a live failure prints its own error");
  const good = api.sgCardHTML({ g: api.PUBG.find((g) => g.key === "crypto"), ok: true,
    v: { value: 71, scale: "0 – 100", label: "Greed", asOf: "2026-09-23" } });
  assert.ok(good.includes(">71<") && good.includes("Greed") && good.includes("as of 2026-09-23"),
    "a live gauge shows the publisher's own value, label and date");
  assert.match(good, /sg-zone4/, "and the value is drawn in the colour of the zone it sits in");
  const withPrev = api.sgCardHTML({ g: api.PUBG.find((g) => g.key === "crypto"), ok: true,
    v: { value: 71, scale: "0 – 100", label: "Greed", asOf: "2026-09-23",
         prev: [{ name: "previous close", value: 68 }, { name: "one week ago", value: 40 }] } });
  assert.ok(withPrev.includes("previous close") && withPrev.includes(">68<"),
    "the publisher's own previous readings sit beside the dial");
});

test("voices blend across channels: one channel, one vote, whatever its volume", () => {
  /* Alan: "Scoring by newest channel is not necessarily the right way. We need to blend the
     opinions of different channels." A single loud channel must not carry the reading. */
  const loud = Array.from({ length: 50 }, () => ({ ch: "LoudChannel", lean: 3 }));
  const three = [{ ch: "A", lean: -1 }, { ch: "B", lean: -2 }, { ch: "C", lean: -1 }];
  const b = M.chanBlend(loud.concat(three));
  assert.equal(b.channels, 4);
  assert.equal(b.items, 53);
  assert.equal(b.net, -0.5, "three quiet bearish channels outweigh one loud bullish one");
  assert.ok(b.score < 50, "and the score follows the channels, not the volume");
  assert.equal(b.pos, 1); assert.equal(b.neg, 3);
  assert.equal(b.disagree, 0.25, "a quarter of the voting channels sit on the smaller side");
});

test("a split between channels is reported, and a unanimous one is not called a split", () => {
  const split = M.chanBlend([{ ch: "A", lean: 1 }, { ch: "B", lean: 1 }, { ch: "C", lean: -1 }, { ch: "D", lean: -1 }]);
  assert.equal(split.disagree, 0.5, "an even split reads 0.5");
  assert.equal(split.net, 0);
  const agreed = M.chanBlend([{ ch: "A", lean: 2 }, { ch: "B", lean: 1 }, { ch: "C", lean: 4 }]);
  assert.equal(agreed.disagree, 0);
  assert.equal(agreed.net, 1);
  assert.equal(M.chanBlend([]).channels, 0);
  assert.equal(M.chanBlend([{ ch: "  ", lean: 1 }]).score, null, "an item with no channel cannot vote");
});

test("one ticker's lean is the average of its channels, with the split behind it", () => {
  const rows = [{ tk: "NVDA", ch: "A", lean: 2 }, { tk: "NVDA", ch: "A", lean: 2 }, { tk: "NVDA", ch: "B", lean: -1 },
                { tk: "SPY", ch: "C", lean: -3 }];
  const nv = M.tickerBlend(rows, "NVDA");
  assert.equal(nv.channels, 2); assert.equal(nv.items, 3); assert.equal(nv.net, 0);
  assert.equal(nv.pos, 1); assert.equal(nv.neg, 1);
  assert.equal(M.tickerBlend(rows, "SPY").channels, 1);
  assert.equal(M.tickerBlend(rows, "TSLA").channels, 0, "a ticker nobody covered has no reading");
});

test("the X page shows the pictures, not only the text", () => {
  const js = between("Room · SENTIMENT (master tab, market-wide)", "/* ---- Room 8 · EVENTS");
  assert.ok(js.includes("p.photos"), "posts carry their photos through");
  assert.ok(js.includes("withPic.concat("), "posts with a picture are drawn first");
  assert.ok(js.includes('loading="lazy"'));
});
