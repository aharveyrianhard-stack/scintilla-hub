/* Lane M41. Alan: "this is awfully like a specs file not an actual sentiment system",
   "theres a timeline per ticker", "tap a keyword to see where it was said", "breadth
   confirmed how with what measure pulled from where? just the hub??"
   These run the room's OWN code, lifted out of index.html, with no browser and no
   network — the same way the M30 tests do — plus the house rules for this room. */
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
const CORE = await import(new URL("../supabase/functions/_shared/sentiment-core.mjs", import.meta.url));
const LEX = JSON.parse(fs.readFileSync(new URL("../data/news-lexicon/lm-headline-v1.json", import.meta.url), "utf8"));
const L = CORE.prepare(LEX);

/* the room's builders, with the page's own helpers stubbed the way the M30 tests do */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SRC = slice("/* ═══ THE SENTIMENT SYSTEM (lane M41)", "/* ═══ THE HEADLINES, EACH ONE SCORED", "the M41 system code");
const M41 = new Function(
  "esc", "SENTI", "S", "el", "pg", "NEWS_LEX_URL", "sentiSafe", "sentiBars", "SENTI_CACHE", "SENTI_TTL",
  SRC + "; return { snTapeRows, snTapeHTML, snDayStoriesHTML, snVoiceChipsHTML, snVoicesFrom, " +
  "snKeywordHTML, snWordsFor, snBreadthHTML, snSparkSVG, snNewsDrivenHTML, snTapeAfterPaint };",
)(esc, SENTI, {}, () => null, async () => [], "/data/news-lexicon/lm-headline-v1.json",
  async (p) => ({ ok: false, e: "stub" }), async () => [], {}, 600000);

const TS = (iso) => Math.floor(Date.parse(iso) / 1000);
const storeRows = (rows) => ({ rows, err: "", from: "2026-08-10" });
const DAILY = [
  { day: "2026-09-21", ticker: "NVDA", source: "news", score: 0.40, n: 9, scored: 6, bull: 5, bear: 1, top_keywords: [{ w: "beats", side: "bull", n: 4, s: "NVDA beats." }] },
  { day: "2026-09-22", ticker: "NVDA", source: "news", score: -0.25, n: 8, scored: 4, bull: 1, bear: 3, top_keywords: [{ w: "warns", side: "bear", n: 3, s: "NVDA warns on supply." }] },
  { day: "2026-09-23", ticker: "NVDA", source: "news", score: null, n: 3, scored: 0, bull: 0, bear: 0, top_keywords: [] },
  { day: "2026-09-22", ticker: "INTC", source: "news", score: -0.50, n: 4, scored: 2, bull: 0, bear: 2, top_keywords: [] },
];

test("the tape reads the STORED rows when they exist, oldest day first", () => {
  const tape = M41.snTapeRows(storeRows(DAILY), "NVDA", null, CORE, L);
  assert.equal(tape.stored, true);
  const by = Object.fromEntries(tape.days.map((d) => [d.day, d]));
  assert.ok(tape.days.length >= 14, "the tape runs over a continuous window, so a gap is visible");
  assert.deepEqual(tape.days.map((d) => d.day).slice().sort(), tape.days.map((d) => d.day), "oldest day first");
  assert.equal(by["2026-09-21"].score, 0.4);
  assert.equal(by["2026-09-23"].score, null, "a day with nothing scored has NO reading, not a zero");
  assert.equal(by["2026-09-22"].bear, 3);
  const padded = tape.days.find((d) => d.missing);
  assert.ok(padded, "days with no story at all are drawn as missing");
  assert.equal(padded.score, null);
  assert.equal(padded.scored, 0);
});

test("with nothing stored the tape is built here from the same scorer, and says so", () => {
  const heads = { rows: [
    { ticker: "NVDA", title: "Nvidia beats and surges on demand", snippet: "", published_ts: TS("2026-09-23T14:00:00Z"), url: "u1", site: "Reuters" },
    { ticker: "NVDA", title: "Nvidia warns on supply", snippet: "", published_ts: TS("2026-09-23T18:00:00Z"), url: "u2", site: "Bloomberg" },
    { ticker: "AAPL", title: "Apple names a new head of retail", snippet: "", published_ts: TS("2026-09-23T18:00:00Z"), url: "u3", site: "CNBC" },
  ] };
  const tape = M41.snTapeRows(storeRows([]), "NVDA", heads, CORE, L);
  assert.equal(tape.stored, false);
  const scored = tape.days.filter((d) => d.scored);
  assert.equal(scored.length, 1, "one day of headlines is one day of readings");
  assert.equal(scored[0].n, 2, "only NVDA's own filings");
  assert.equal(scored[0].bull, 1);
  assert.equal(scored[0].bear, 1);
  const html = M41.snTapeHTML(tape, "NVDA", scored[0].day);
  assert.match(html, /not stored yet · scored in this browser/);
});

test("the tape is a scrubbable day-by-day picture: bar above or below the middle, a dot per story", () => {
  const tape = M41.snTapeRows(storeRows(DAILY), "NVDA", null, CORE, L);
  const html = M41.snTapeHTML(tape, "NVDA", "2026-09-22");
  assert.match(html, /stored · \d+ days/);
  /* a bullish day leaves the middle upward, a bearish one downward */
  const cell = (d) => html.match(new RegExp('<div class="sn-tlday[^>]*data-day="' + d + '"[\\s\\S]*?<\\/div><\\/div>'))[0];
  const up = cell("2026-09-21"), dn = cell("2026-09-22");
  assert.match(up, /sn-tlbar pos" style="bottom:50%;/);
  assert.match(dn, /sn-tlbar neg" style="top:50%;/);
  assert.equal((up.match(/sn-tlmark pos/g) || []).length, 5, "five bullish stories, five dots");
  assert.equal((dn.match(/sn-tlmark neg/g) || []).length, 3);
  /* the picked day is marked, every day is tappable, and an empty day is dimmed */
  assert.match(dn, /class="sn-tlday is-on/);
  assert.match(html, /data-act="sntlday" data-day="2026-09-23"/);
  assert.match(cell("2026-09-23"), /is-empty/);
  assert.match(html, /tap a day for the stories/);
  /* and the hover text carries the numbers behind the bar */
  assert.match(html, /title="2026-09-21 · \+0\.40 · 6 of 9 scored · 5 bullish \/ 1 bearish"/);
});

test("a ticker with no reading says so instead of drawing an empty tape", () => {
  const html = M41.snTapeHTML({ stored: true, days: [] }, "ZZZZ", null);
  assert.match(html, /No day has a reading for <b>ZZZZ<\/b> yet/);
  assert.match(html, /The store holds no row for this ticker/);
});

test("the stories on a day carry the headline, the publisher, the words AND the sentence", () => {
  const stories = [
    { url: "u1", title: "Nvidia beats and surges", site: "Reuters", score: 1, question: false,
      sample: "Nvidia beats and surges", hits: [{ w: "beats", effect: 1, s: "Nvidia beats and surges" }], published_ts: TS("2026-09-22T14:00:00Z") },
    { url: "u2", title: "Is Nvidia about to crash?", site: "Barron's", score: -1, question: true,
      sample: "Is Nvidia about to crash?", hits: [{ w: "crash", effect: -1, s: "Is Nvidia about to crash?" }], published_ts: TS("2026-09-22T15:00:00Z") },
    { url: "u3", title: "another day entirely", site: "CNBC", score: 0.5, question: false, sample: null, hits: [], published_ts: TS("2026-09-19T15:00:00Z") },
  ];
  const html = M41.snDayStoriesHTML("NVDA", "2026-09-22", stories, CORE, L);
  assert.match(html, /2 stored stories · 1 bullish, 1 bearish/, "only that day's stories");
  assert.ok(!html.includes("another day entirely"));
  assert.match(html, /Reuters · <span class="w-bull">beats<\/span>/);
  assert.match(html, /“Nvidia beats and surges”/, "the sentence is shown, not only the word");
  assert.match(html, /a question · not counted/);
  const none = M41.snDayStoriesHTML("NVDA", "2026-09-20", stories, CORE, L);
  assert.match(none, /No stored story for <b>NVDA<\/b> on 2026-09-20/);
});

test("voices are chips: size is the weight it carries, colour is the direction", () => {
  const html = M41.snVoiceChipsHTML([
    { name: "Reuters", n: 40, lean: 0.35, src: "news · 24h" },
    { name: "@oneguy", n: 1, lean: -0.6, src: "x · 24h" },
    { name: "Quiet Co", n: 4, lean: null, src: "news · 24h" },
  ], "headlines");
  const big = html.match(/Reuters[\s\S]{0,80}/)[0];
  const small = html.match(/@oneguy[\s\S]{0,80}/)[0];
  const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => +m[1]);
  assert.equal(sizes.length, 3);
  assert.ok(Math.max(...sizes) > Math.min(...sizes), "a voice that filed forty items is drawn larger than one that filed one");
  assert.match(html, /sn-vchip pos[^>]*>Reuters/);
  assert.match(html, /sn-vchip neg[^>]*>@oneguy/);
  assert.match(html, /sn-vchip flat[^>]*>Quiet Co/);
  assert.match(big, /\+0\.35/);
  assert.match(small, /-0\.60/);
  assert.match(M41.snVoiceChipsHTML([], "posts"), /No voice carried a reading in this window/);
});

test("who is moving the read is built from the outlets, handles and channels that are readable", () => {
  const heads = { rows: [
    { ticker: "NVDA", title: "Nvidia beats and surges", snippet: "", site: "Reuters", published_ts: TS("2026-09-23T14:00:00Z") },
    { ticker: "INTC", title: "Intel plunges and warns", snippet: "", site: "Reuters", published_ts: TS("2026-09-23T15:00:00Z") },
    { ticker: "AAPL", title: "Apple names a new head of retail", snippet: "", site: "CNBC", published_ts: TS("2026-09-23T15:00:00Z") },
  ] };
  const xPosts = [{ handle: "@trader", text: "$NVDA breakout, strong beat", created_at: new Date().toISOString() }];
  const ytc = { ok: true, v: { items: [{ ch: "Chan A", lean: 0.4, text: "", at: Date.now(), tk: "NVDA" }] } };
  const v = M41.snVoicesFrom(storeRows([]), heads, xPosts, ytc, CORE, L);
  const byName = Object.fromEntries(v.map((x) => [x.name, x]));
  assert.equal(byName.Reuters.n, 2, "two scored headlines from one outlet");
  assert.ok(!byName.CNBC, "a headline that carried no listed word gives its outlet no vote");
  assert.equal(byName["@trader"].kind, "x");
  assert.equal(byName["Chan A"].kind, "youtube");
  assert.ok(v[0].n >= v[v.length - 1].n, "the loudest voice is first");
});

test("a keyword can be opened, and it shows where it was said", () => {
  const tape = M41.snTapeRows(storeRows(DAILY), "NVDA", null, CORE, L);
  const stories = [{ url: "u1", title: "NVDA beats again", site: "Reuters", score: 1, question: false,
    hits: [{ w: "beats", effect: 1, s: "NVDA beats again on data centre demand" }], published_ts: TS("2026-09-21T14:00:00Z") }];
  const words = M41.snWordsFor(tape, "2026-09-21", stories, CORE);
  assert.equal(words[0].w, "beats");
  assert.equal(words[0].n, 4, "the stored count for the day");
  assert.equal(words[0].said[0].q, "NVDA beats again on data centre demand");
  assert.match(words[0].said[0].m, /Reuters/);
  const shut = M41.snKeywordHTML(words, null);
  assert.match(shut, /data-act="snkw" data-k="beats\|bull"/);
  assert.ok(!shut.includes("sn-said"), "closed until it is tapped");
  const open = M41.snKeywordHTML(words, "beats|bull");
  assert.match(open, /sn-kw bull is-on/);
  assert.match(open, /“NVDA beats again on data centre demand”/);
  const bare = M41.snKeywordHTML([{ w: "surge", side: "bull", n: 2, s: null, said: [] }], "surge|bull");
  assert.match(bare, /no sentence was stored with this word/);
  assert.match(M41.snKeywordHTML([], null), /No word from the list fired/);
});

test("breadth: every measure names its source, says what it covers, and shows its line", () => {
  const C = {
    brd: { snap: { measured: 316, session_et: "2026-09-23", above50: { pct: 48, n: 152, of: 316 }, above200: { pct: 61, n: 193, of: 316 },
             new_highs: 9, new_lows: 4, names_new_high: [], names_new_low: [] },
           hist: [{ session_et: "2026-09-19", above50_pct: 44, above200_pct: 58, new_highs: 5, new_lows: 6 },
                  { session_et: "2026-09-22", above50_pct: 46, above200_pct: 60, new_highs: 7, new_lows: 5 },
                  { session_et: "2026-09-23", above50_pct: 48, above200_pct: 61, new_highs: 9, new_lows: 4 }] },
    inputs: [{ key: "breadth", val: "180 of our 316 stocks are up today · 57% advancing", score: 57 },
             { key: "eqw", val: "equal weight − cap weight, 20-day return: -1.2 pts", score: 41 }],
  };
  const html = M41.snBreadthHTML(C, 316);
  assert.match(html, /Above the 50-day average/);
  assert.match(html, /breadth-snapshot\.mjs/, "the measure names the script that measured it");
  assert.match(html, /session 2026-09-23/);
  assert.match(html, /the Hub&#039;s own 316 companies · NOT the whole market|the Hub's own 316 companies · NOT the whole market/);
  assert.match(html, /CNN counts every NYSE listing/);
  assert.match(html, /CNN weighs its own by volume/);
  assert.match(html, /<polyline/, "each measure carries its own line over time");
  assert.match(html, /cannot be quoted as a market-wide breadth number/);
  const bare = M41.snBreadthHTML({ brd: null, inputs: [] }, null);
  assert.match(bare, /not measured yet/);
  assert.match(bare, /no history stored/);
});

test("news-driven is a refusal until the stored history can carry it", () => {
  const thin = M41.snNewsDrivenHTML({ nd: CORE.newsDriven([{ day: "2026-09-23", ticker: "NVDA", score: 0.4, ret: 0.01 }]), tickers: 1 });
  assert.match(thin, /not yet a number/);
  assert.match(thin, /needs 9 more stored days and 199 more ticker-days/);
  assert.ok(!/\d+%<\/span>/.test(thin), "no percentage is printed while the sample cannot carry one");
  const pairs = [];
  for (let d = 1; d <= 12; d++) for (let i = 0; i < 20; i++) {
    const s = (i - 10) / 10;
    pairs.push({ day: "2026-09-" + String(d).padStart(2, "0"), ticker: "T" + i, score: s, ret: 0.01 * s });
  }
  const strong = M41.snNewsDrivenHTML({ nd: CORE.newsDriven(pairs), tickers: 20 });
  assert.match(strong, /100%<\/span>/);
  assert.match(strong, /240<\/b> ticker-days/);
  assert.match(strong, /12<\/b> stored days/);
  assert.match(strong, /co-movement, not a cause/);
});

test("the room leads with ONE READ, and the picture is wired to the page's own acts", () => {
  assert.match(PAGE, /el\("snMain"\)\.innerHTML = SYS \+/, "the system comes first, the spec sheet after it");
  assert.match(PAGE, /MARKET MOOD NOW/);
  assert.match(PAGE, /el\("snRail"\)\.innerHTML = voicesCard \+ saidCard \+ brd41/);
  for (const act of ["sntk", "sntlday", "snkw"]) {
    assert.ok(PAGE.includes('case "' + act + '": {'), act + " must be handled by the page's one click dispatcher");
  }
  assert.match(PAGE, /sentiTk: null, sentiDay: null, sentiKw: null/, "the tape's place is state, so it survives a re-render");
  /* the same drag rule the earnings tape follows: a drag must not open a day */
  /* comments may EXPLAIN scrollIntoView; the code may not USE it */
  const tapeWire = slice("function snTapeAfterPaint() {", "/* ═══ THE HEADLINES", "the tape wiring").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(tapeWire, /if \(moved > 4\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); \}/);
  assert.ok(!/scrollIntoView/.test(tapeWire), "moving the tape must not scroll the panel around it");
  assert.match(tapeWire, /sc\.scrollLeft = Math\.max\(0, on\.offsetLeft/, "the tape opens where the reading is, by moving its own scroller");
});

test("ONE stick in the browser too: the room imports the scorer the functions use", () => {
  assert.match(SRC, /const SN_CORE_URL = "\/supabase\/functions\/_shared\/sentiment-core\.mjs"/);
  assert.match(SRC, /SN_CORE = await import\(SN_CORE_URL\)/);
  for (const fn of ["core.scoreText", "core.dailyRollup", "core.marketRead", "core.newsDriven", "core.dayOf"]) {
    assert.ok(PAGE.includes(fn), "the room must call " + fn + " rather than re-implement it");
  }
  assert.ok(!/function dailyRollup|function marketRead|function newsDriven/.test(SRC), "no second copy of the arithmetic in the page");
});

test("house rules hold in the new surface: no white, direction colour only, 11px body text", () => {
  const css = slice("/* ── Room · SENTIMENT · THE SYSTEM (lane M41)", "\n.kw-tk{", "the M41 css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(css.match(/var\(--ink\)|#fff\b|(?<![-\w])white(?![-\w])/i), null, "the room stays off white");
  for (const m of css.matchAll(/var\(--(sv[1-5]|bull|bear|fg[1-5]|crk|coin|trend|momentum|structure|volume|volatility)\)/g)) {
    assert.ok(["--fg1", "--fg5", "--crk"].includes("--" + m[1]), "colour here means up, down or a hairline — not " + m[0]);
  }
  /* body text: every font-size in the new block is either a mono label or >= 11px */
  for (const m of css.matchAll(/font-size:([\d.]+)px/g)) {
    const px = +m[1];
    assert.ok(px >= 7.5, "nothing smaller than the existing mono labels: " + px);
  }
  const body = [...css.matchAll(/\.(sn-one__say|sn-story__t|sn-brd td|sn-vchip|sn-kw|sn-said__q|sn-nd)\{[^}]*font-size:([\d.]+)px/g)];
  for (const m of body) assert.ok(+m[2] >= 11, m[1] + " is body text and must be 11px or more, not " + m[2]);
});
