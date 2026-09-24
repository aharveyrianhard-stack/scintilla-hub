/* M41 · the sentiment STORE: one measuring stick, the words with their sentences, the
   per-ticker daily rows a timeline can scrub, and an honest refusal on "news-driven"
   until there is enough stored history. Offline: no network, no database. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = await import(join(ROOT, "supabase/functions/_shared/sentiment-core.mjs"));
const LEX = JSON.parse(readFileSync(join(ROOT, "data/news-lexicon/lm-headline-v1.json"), "utf8"));
const L = C.prepare(LEX);

const ms = (iso) => Date.parse(iso);

test("ONE stick: lib/news-sentiment.mjs re-exports the shared core, it does not re-implement it", async () => {
  const src = readFileSync(join(ROOT, "lib/news-sentiment.mjs"), "utf8");
  assert.match(src, /export \{[\s\S]*\} from "\.\.\/supabase\/functions\/_shared\/sentiment-core\.mjs"/);
  assert.ok(!/function scoreText/.test(src), "a second copy of the arithmetic is how two screens disagree");
  const lib = await import(join(ROOT, "lib/news-sentiment.mjs"));
  assert.equal(lib.METHOD, C.METHOD);
  assert.equal(typeof lib.scoreText, "function");
  assert.equal(typeof lib.dailyRollup, "function");
});

test("every word that fires carries the sentence it was said in", () => {
  const s = C.scoreText("Nvidia beats and surges on data centre demand. Analysts warn the rally may stall.", L);
  assert.ok(s.marks.length >= 3, "beats, surges and warn should all fire");
  for (const m of s.marks) {
    assert.equal(typeof m.s, "string", m.w + " must carry its sentence");
    assert.ok(m.s.toLowerCase().includes(m.w), m.w + " must appear in the sentence stored for it");
  }
  const beats = s.marks.find((m) => m.w === "beats");
  const warn = s.marks.find((m) => m.w === "warn");
  assert.ok(beats.s.includes("surges"), "beats belongs to the first sentence");
  assert.ok(!warn.s.includes("surges"), "warn belongs to the second sentence, not the first");
  assert.equal(typeof s.sample, "string");
});

test("the nth occurrence of a word gets its own sentence", () => {
  const txt = "Tesla misses on deliveries. Ford misses too, and the sector falls.";
  const a = C.sentenceAround(txt, "misses", 0);
  const b = C.sentenceAround(txt, "misses", 1);
  assert.ok(a.includes("Tesla"));
  assert.ok(b.includes("Ford"));
});

test("a headline with no listed word is not scored, and is never a zero", () => {
  const s = C.scoreText("Apple names a new head of retail in Japan", L);
  assert.equal(s.score, null);
  assert.equal(s.reason, "no lexicon word in this item");
  const roll = C.dailyRollup([{ ticker: "AAPL", ms: ms("2026-09-23T14:00:00Z"), score: s.score, question: s.question, marks: s.marks }], { source: "news" });
  assert.equal(roll[0].scored, 0);
  assert.equal(roll[0].unscored, 1);
  assert.equal(roll[0].score, null, "no reading, not 0.00");
});

test("a question is scored, shown, and left out of the day's total", () => {
  const q = C.scoreText("Is NVDA about to crash?", L);
  assert.equal(q.question, true);
  assert.ok(q.score != null, "the score is kept so the exclusion can be checked");
  const roll = C.dailyRollup([
    { ticker: "NVDA", ms: ms("2026-09-23T14:00:00Z"), score: q.score, question: true, marks: q.marks },
    { ticker: "NVDA", ms: ms("2026-09-23T15:00:00Z"), score: 0.5, question: false, marks: [{ w: "beats", effect: 1, s: "NVDA beats." }] },
  ], { source: "news" });
  assert.equal(roll[0].questions, 1);
  assert.equal(roll[0].scored, 1);
  assert.equal(roll[0].score, 0.5, "the question must not drag the day's mean");
});

test("the daily row is one per ticker per day per source, with the top words and a sentence", () => {
  const items = [
    { ticker: "NVDA", ms: ms("2026-09-23T14:00:00Z"), score: 0.6, marks: [{ w: "beats", effect: 1, s: "NVDA beats." }, { w: "surges", effect: 1, s: "NVDA surges." }] },
    { ticker: "NVDA", ms: ms("2026-09-23T18:00:00Z"), score: -0.2, marks: [{ w: "beats", effect: 1, s: "still beats." }, { w: "warns", effect: -1, s: "NVDA warns on supply." }] },
    { ticker: "INTC", ms: ms("2026-09-23T18:00:00Z"), score: -0.5, marks: [{ w: "plunge", effect: -1, s: "INTC shares plunge." }] },
  ];
  const roll = C.dailyRollup(items, { source: "news", lexicon_sha: "abc" });
  const nvda = roll.find((r) => r.ticker === "NVDA");
  assert.equal(roll.length, 2);
  assert.equal(nvda.day, "2026-09-23");
  assert.equal(nvda.source, "news");
  assert.equal(nvda.n, 2);
  assert.equal(nvda.scored, 2);
  assert.equal(nvda.bull, 1);
  assert.equal(nvda.bear, 1);
  assert.equal(nvda.score, 0.2, "the mean of its scored items");
  assert.equal(nvda.top_keywords[0].w, "beats");
  assert.equal(nvda.top_keywords[0].n, 2, "counted across the day's items");
  assert.ok(nvda.top_keywords[0].s, "a keyword carries a sentence, so tapping it can show where it was said");
  assert.equal(nvda.lexicon_sha, "abc");
  assert.equal(nvda.weighting, C.WEIGHTING);
});

test("a New York day is a New York day, on both sides of daylight saving", () => {
  /* 23:30 ET belongs to that day; 00:30 ET the next morning does not */
  assert.equal(C.dayOf(ms("2026-09-24T03:30:00Z")), "2026-09-23");
  assert.equal(C.dayOf(ms("2026-09-24T04:30:00Z")), "2026-09-24");
  const summer = C.dayBounds("2026-07-15");
  const winter = C.dayBounds("2026-01-15");
  assert.equal(summer.offset, -4);
  assert.equal(winter.offset, -5);
  assert.equal(new Date(summer.from * 1000).toISOString(), "2026-07-15T04:00:00.000Z");
  assert.equal(new Date(winter.from * 1000).toISOString(), "2026-01-15T05:00:00.000Z");
  assert.equal(summer.to - summer.from, 86400);
  /* every item inside the bounds must map back to the same day */
  for (const h of [0, 6, 12, 23]) {
    assert.equal(C.dayOf((summer.from + h * 3600) * 1000), "2026-07-15");
  }
});

test("the market read is item-weighted, names its drivers and says where it moved", () => {
  const rows = [
    { day: "2026-09-22", ticker: "NVDA", score: 0.10, scored: 10, top_keywords: [] },
    { day: "2026-09-23", ticker: "NVDA", score: 0.50, scored: 30, top_keywords: [{ w: "beats", side: "bull", n: 9 }] },
    { day: "2026-09-23", ticker: "INTC", score: -0.40, scored: 10, top_keywords: [{ w: "plunge", side: "bear", n: 4 }] },
  ];
  const read = C.marketRead(rows);
  assert.equal(read.day, "2026-09-23");
  assert.equal(read.items, 40);
  assert.equal(read.score, 0.275, "30 items at +0.5 and 10 at -0.4");
  assert.equal(read.prev_day, "2026-09-22");
  assert.equal(read.move, 0.175);
  assert.equal(read.drivers[0].ticker, "NVDA", "the biggest mover of the read comes first");
  assert.equal(read.drivers[0].weight, 0.75);
  assert.match(C.moodWords(read), /positive/);
  assert.match(C.moodWords(read), /firmer than the day before/);
  assert.equal(C.moodWords({ score: null }), "no stored reading for this day yet");
});

test("news-driven refuses to be a number until the stored history can carry it", () => {
  const thin = C.newsDriven([{ day: "2026-09-23", ticker: "NVDA", score: 0.5, ret: 0.02 }]);
  assert.equal(thin.enough, false);
  assert.equal(thin.r, null);
  assert.match(thin.need, /needs 9 more stored days and 199 more ticker-days/);

  /* a clean straight line through 12 days × 20 names must read as fully explained */
  const pairs = [];
  for (let d = 1; d <= 12; d++) {
    for (let i = 0; i < 20; i++) {
      const s = (i - 10) / 10;
      pairs.push({ day: "2026-09-" + String(d).padStart(2, "0"), ticker: "T" + i, score: s, ret: 0.01 * s });
    }
  }
  const strong = C.newsDriven(pairs);
  assert.equal(strong.enough, true);
  assert.equal(strong.days, 12);
  assert.equal(strong.pairs, 240);
  assert.equal(strong.r, 1);
  assert.equal(strong.explained_pct, 100);
  /* and noise must not be dressed up as a signal */
  const noise = pairs.map((p, i) => ({ ...p, ret: (i % 7 - 3) / 1000 }));
  assert.ok(Math.abs(C.newsDriven(noise).r) < 0.3);
});

test("a clip is read around each mention, so one bullish name does not colour the others", () => {
  const words = (n, w) => Array(n).fill(w).join(" ");
  const text = "NVDA beats and surges on demand " + words(120, "filler") + " INTC plunges and warns on margins";
  const nv = C.scoreMentions(text, "NVDA", L, { radius: 8 });
  const intc = C.scoreMentions(text, "INTC", L, { radius: 8 });
  assert.equal(nv.mentions, 1);
  assert.ok(nv.lean > 0, "the NVDA window is bullish");
  assert.ok(intc.lean < 0, "the INTC window is bearish");
  assert.ok(nv.sample && nv.sample.length, "the window that produced the lean is kept");
  const absent = C.scoreMentions("a clip that never says the name", "NVDA", L);
  assert.equal(absent.mentions, 0);
  assert.equal(absent.lean, null, "a clip that never names the ticker gets no reading, not a bearish one");
});

test("cashtags are what files an X post against a ticker", () => {
  assert.deepEqual(C.cashTags("$NVDA and $intc both moved, $NVDA again"), ["NVDA", "INTC"]);
  assert.deepEqual(C.cashTags("no tags here"), []);
});

test("the three scorers share the one stick, hold no key, and each schedule has a rollback", () => {
  for (const f of ["sentiment-news", "sentiment-youtube", "sentiment-x"]) {
    const src = readFileSync(join(ROOT, "supabase/functions", f, "index.ts"), "utf8");
    assert.match(src, /_shared\/sentiment-core\.mjs/, f + " must score with the shared stick");
    assert.match(src, /claim\(/, f + " must take a single-flight claim before it writes");
    assert.match(src, /cfgPut\(/, f + " must leave a receipt");
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(src), f + " must not contain a key");
    assert.ok(!/SERVICE_ROLE_KEY\s*=\s*["']/.test(src), f + " must read its key from the environment");
  }
  const db = readFileSync(join(ROOT, "supabase/functions/_shared/db.ts"), "utf8");
  assert.match(db, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  const cron = readFileSync(join(ROOT, "supabase/migrations/20260924_sentiment_cron.sql"), "utf8");
  for (const job of ["sentiment-news-10m", "sentiment-news-backfill", "sentiment-youtube-6h", "sentiment-x-2h"]) {
    assert.ok(cron.includes("cron.schedule('" + job + "'"), job + " must be scheduled");
    assert.ok(cron.includes("cron.unschedule('" + job + "')"), job + " must have its exact rollback written down");
  }
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(cron), "the schedule must read the bearer from Vault, not carry it");
  for (const m of ["20260924_sentiment_ticker_daily", "20260924_sentiment_x_posts", "20260924_sentiment_backfill_state", "20260924_sentiment_evidence"]) {
    const sql = readFileSync(join(ROOT, "supabase/migrations", m + ".sql"), "utf8");
    assert.match(sql, /ROLLBACK \(exact/, m + " must state its rollback");
    assert.ok(!/drop table (?!if exists)/i.test(sql.split("ROLLBACK")[0]), m + " must not drop anything outside its rollback note");
  }
});
