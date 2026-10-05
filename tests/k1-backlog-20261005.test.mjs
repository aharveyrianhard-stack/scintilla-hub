/* K1 (5 Oct 2026) — the backlog sweep. Item 1: the world group's history, the Rating-changes table on the nightly notes,
   SOCIAL → SENTIMENT on the daily table, the resolution log, the PAGE SPECS fold with the trending sources. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = html.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("the world group's favourites are asked for with the tracked topics' history, in the one request", () => {
  assert.match(html, /const heads = pmChips\(PM\.latest, null, Date\.now\(\)\)\.concat\(pmDiscoverChips\(PM\.latest, null, Date\.now\(\)\)\)\.map\(\(c\) => c\.head\.market_id\)/);
});

test("05 Rating changes reads the nightly notes: one row per note with a rating, set-aside rows and round-ups left out, the old table only as the fallback", () => {
  const src = "const REV_ROUNDUP = /top \\d+ stock calls|wall street'?s top|stock calls this week/i;\nconst revNum = (v) => (v == null || v === '' || !isFinite(+v) ? null : +v);\nconst revPriorFromTitle = () => null;\n" +
    grab(/const revFirmKey = [^\n]*\n/) + grab(/function revLines\(rows\) \{[\s\S]*?\n\}/) + "\n" +
    grab(/const GRADES_MAX = 12, GRADES_OLD = \{\};\n/) + grab(/function gradeRowsFromNotes\(c\) \{[\s\S]*?\n\}/) + "\n" + grab(/function estGradesPick\(t, c\) \{[\s\S]*?\n\}/) + "\n";
  const { gradeRowsFromNotes, estGradesPick, GRADES_OLD } = new Function(src + "return { gradeRowsFromNotes, estGradesPick, GRADES_OLD };")();
  const rows = [
    { published_utc: "2026-10-01T10:56:00Z", kind: "GRADE", firm: "Cantor Fitzgerald", prior_grade: "Overweight", new_grade: "Overweight", action: "hold", quality: "ok" },
    { published_utc: "2026-09-09T12:00:00Z", kind: "GRADE", firm: "Piper Sandler", prior_grade: "Neutral", new_grade: "Overweight", action: "upgrade", quality: "ok" },
    { published_utc: "2026-09-09T12:00:00Z", kind: "TARGET", firm: "Piper Sandler", target: 300, adj_target: 300, action: "raise", quality: "ok" },
    { published_utc: "2026-09-08T12:00:00Z", kind: "GRADE", firm: "Junk Capital", prior_grade: "Buy", new_grade: "Sell", action: "downgrade", quality: "quarantine" },
    { published_utc: "2026-09-07T12:00:00Z", kind: "GRADE", firm: "Roundup LLC", new_grade: "Buy", action: "hold", title: "Wall Street's top 10 stock calls this week", quality: "ok" },
    { published_utc: "2026-09-06T12:00:00Z", kind: "TARGET", firm: "Target Only", target: 250, quality: "ok" },
  ];
  const got = gradeRowsFromNotes({ rows });
  assert.deepEqual(got.map((g) => g.firm), ["Cantor Fitzgerald", "Piper Sandler"], "newest first; the set-aside row, the round-up and the target-only note are not rating changes");
  assert.deepEqual(got[1], { firm: "Piper Sandler", action: "upgrade", from_grade: "Neutral", to_grade: "Overweight", price_target: 300, date: "2026-09-09" }, "the target filed with the same note rides on the row");
  assert.equal(estGradesPick("NVDA", { rows }).src, "analyst_target_news");
  GRADES_OLD.OLD = [{ firm: "Needham", action: "maintain", to_grade: "Buy", date: "2026-06-02" }];
  assert.equal(estGradesPick("OLD", { rows: [] }).src, "analyst_grades", "no rating in the notes: the old table still shows");
  assert.equal(estGradesPick("OLD", null).rows.length, 1, "while the notes are being read the old rows hold the place");
  assert.equal(gradeRowsFromNotes({ err: "x", rows }), null);
  assert.match(html, /const REV_SEL_NEWS = "[^"]*,quality";/, "the notes are read with A4's quality column");
  assert.match(grab(/function revR3Paint\(t\) \{[\s\S]*?\n\}/), /\.sc-grsec\[data-rev-t=/, "the table repaints when the notes land");
});

test("SOCIAL → SENTIMENT: the daily table's last days are summed per name and replace the stale youtube rows; other sources are left alone", () => {
  const src = "const num = (v) => (v == null || v === '' || !isFinite(+v) ? null : +v);\nconst SOCSENT = { NVDA: { ticker: 'NVDA', source: 'youtube', posts: 3, _old: true }, OLDY: { ticker: 'OLDY', source: 'youtube', posts: 1 }, KEEP: { ticker: 'KEEP', source: 'stocktwits', posts: 9 } };\n" +
    grab(/const SOC_DAILY_DAYS = 7, SOC_DAILY_TTL = [^\n]*\n/) + grab(/const SOCDAILY = \{[^\n]*\n/) + grab(/function socDailyFold\(rows\) \{[\s\S]*?\n\}/) + "\n" + grab(/function socDailyApply\(\) \{[\s\S]*?\n\}/) + "\n";
  const { socDailyFold, socDailyApply, SOCDAILY, SOCSENT } = new Function(src + "return { socDailyFold, socDailyApply, SOCDAILY, SOCSENT };")();
  assert.equal(socDailyApply(), false, "nothing read yet: nothing is replaced");
  assert.ok(SOCSENT.NVDA._old);
  SOCDAILY.rows = [
    { day: "2026-10-05", ticker: "NVDA", score: "0.000", n: 5, scored: 4, bull: 2, bear: 2, updated_at: "2026-10-05T12:25:03Z" },
    { day: "2026-10-04", ticker: "nvda", score: "0.500", n: 4, scored: 4, bull: 3, bear: 1, updated_at: "2026-10-04T12:25:03Z" },
    { day: "2026-10-05", ticker: "BE", score: null, n: 1, scored: 0, bull: 0, bear: 0, updated_at: "2026-10-05T12:25:03Z" },
  ];
  const by = socDailyFold(SOCDAILY.rows);
  assert.deepEqual([by.NVDA.posts, by.NVDA.bullish, by.NVDA.bearish, by.NVDA.score], [9, 5, 3, 0.25], "videos, bullish and bearish are summed; the lean is weighted by the videos that could be scored");
  assert.equal(by.BE.score, null, "a name with no scored video carries no lean");
  assert.equal(by.NVDA.updated_ts, Date.parse("2026-10-05T12:25:03Z") / 1000, "the newest write time, in seconds like the old table");
  assert.equal(socDailyApply(), true);
  assert.ok(!SOCSENT.NVDA._old && SOCSENT.NVDA.posts === 9 && !SOCSENT.OLDY && SOCSENT.KEEP.posts === 9 && SOCSENT.BE);
  assert.match(grab(/function fillSocial\(\) \{[\s\S]*?\n\}/), /socDailyLoad\(\);/);
  assert.match(html, /if \(typeof socDailyApply === "function"\) socDailyApply\(\);/, "a board pull re-reads the old table: the daily rows are put back on top");
});

test("the resolution log: one line per question, the winning outcome first, newest first; it reads an additive view with a rollback", () => {
  const src = "const esc = (s) => String(s).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c]));\nconst pmShort = (t) => t;\nconst pmCut = (s, n) => String(s).slice(0, n);\n" +
    grab(/const PM_CLOSED_SHOW = 30;[\s\S]*?"<\/details>";\n/);
  const { pmClosedFold, pmClosedHTML, PM_PAGE_SPECS } = new Function(src + "return { pmClosedFold, pmClosedHTML, PM_PAGE_SPECS };")();
  const rows = [
    { topic: "discover", event_id: "e1", market_id: "m1", outcome: "Lula 5-10%", question: "Margin of Victory", last_probability: "0.0040", first_ts: "2026-10-01T10:00:00Z", last_ts: "2026-10-04T22:00:00Z", end_date: "2026-10-05T03:59:00Z", how: "ENDED NO" },
    { topic: "discover", event_id: "e1", market_id: "m2", outcome: "Bolsonaro <5%", question: "Margin of Victory", last_probability: "0.9995", first_ts: "2026-10-01T10:00:00Z", last_ts: "2026-10-05T08:00:00Z", end_date: "2026-10-05T03:59:00Z", how: "ENDED YES" },
    { topic: "boj-next", event_id: "e2", market_id: "m3", outcome: "Yes", question: "BoJ +50 bps?", last_probability: "0.0100", first_ts: "2026-09-21T10:00:00Z", last_ts: "2026-10-04T18:00:00Z", end_date: "2026-10-30T03:59:00Z", how: "DELISTED" },
    { topic: "discover", event_id: "e3", market_id: "m4", outcome: "Tom Cotton", question: "GOP Nominee 2028", last_probability: "0.0100", first_ts: "2026-09-29T10:00:00Z", last_ts: "2026-10-06T01:00:00Z", end_date: "2028-11-07T00:00:00Z", how: "LEFT THE LIST" },
  ];
  const list = pmClosedFold(rows);
  assert.deepEqual(list.map((c) => c.question), ["GOP Nominee 2028", "Margin of Victory", "BoJ +50 bps?"], "newest last reading first");
  const mv = list[1];
  assert.deepEqual([mv.head.outcome, mv.how, mv.n], ["Bolsonaro <5%", "ENDED YES", 2], "the outcome that ended YES speaks for the question");
  const h = pmClosedHTML(rows, Date.parse("2026-10-06T12:00:00Z"), {});
  assert.match(h, /RESOLUTION LOG <i>3 questions ended or left the feed · newest first<\/i>/);
  assert.match(h, /pmx-crow is-yes"[\s\S]*?Bolsonaro &lt;5%[\s\S]*?100%[\s\S]*?ended · yes/, "stored text is escaped");
  assert.match(h, /left the most-traded list/); assert.match(h, /no longer listed/);
  assert.match(pmClosedHTML(null, 0, {}), /reading the closed markets…/);
  assert.match(pmClosedHTML([], 0, {}), /0 markets have ended or left the feed yet/);
  assert.match(pmClosedHTML(null, 0, { err: "HTTP_404" }), /could not be read · HTTP_404/);
  assert.match(PM_PAGE_SPECS, /^<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/, "the explanations sit in the PAGE SPECS fold, not in the panel");
  for (const w of ["StockTwits trending", "Polymarket’s own 24-hour volume ranking", "Reddit", "Yahoo Finance", "Google Trends", "X trends"]) assert.ok(PM_PAGE_SPECS.includes(w), "trending source listed: " + w);
  const up = read("supabase/migrations/20261005_prediction_market_closed.sql"), down = read("supabase/migrations/20261005_prediction_market_closed_ROLLBACK.sql");
  assert.match(up, /create or replace view public\.prediction_market_closed with \(security_invoker = true\)/);
  assert.ok(!/\b(drop|delete|update|insert|alter|truncate)\b/i.test(up.replace(/^--.*$/gm, "").replace(/'[^']*'/g, "''")), "the migration only adds a view (comments and quoted text aside)");
  assert.equal(down.replace(/^--.*$/gm, "").trim(), "drop view if exists public.prediction_market_closed;");
});

/* ── item 2 ── */
test("CAPITAL: the projection carries the cash forward at the last four quarters' pace — operations minus spending — and names the crossing", () => {
  const src = "const esc = (s) => String(s);\nconst ofDayDiff = (a, b) => Math.round(Math.abs(Date.parse(b) - Date.parse(a)) / 86400000);\nconst ofFmtDay = (d) => String(d);\n" +
    grab(/function ofMoney\(v\) \{[\s\S]*?\n\}/) + "\n" + grab(/const OF_PROJ_Q = 8;\n/) + grab(/function ofProjModel\(balq, cfq\) \{[\s\S]*?\n\}/) + "\n" + grab(/function ofProjHTML\(m\) \{[\s\S]*?\n\}/) + "\n";
  const { ofProjModel, ofProjHTML } = new Function(src + "return { ofProjModel, ofProjHTML };")();
  const CRWV = [   // cashflow_history, read 5 Oct 2026
    { fiscal_date: "2026-06-30", capex: -6422000000, operating_cf: 679000000 }, { fiscal_date: "2026-03-31", capex: -7695000000, operating_cf: 2984000000 },
    { fiscal_date: "2025-12-31", capex: -4060000000, operating_cf: 1559000000 }, { fiscal_date: "2025-09-30", capex: -2388888000, operating_cf: 1689134000 } ];
  const m = ofProjModel({ cash_and_equiv: 6397e6, fiscal_date: "2026-06-30" }, CRWV);
  assert.equal(Math.round(m.ops / 1e6), 1728); assert.equal(Math.round(m.spend / 1e6), 5141); assert.equal(Math.round(m.net / 1e6), -3414);
  assert.equal(m.pts.length, 9); assert.equal(m.pts[0], 6397e6);
  assert.ok(Math.abs(m.zeroQ - 6397 / 3413.69) < 0.01, "about 1.9 quarters of cash");
  assert.equal(m.zeroDay, "2026-12-18", "30 Jun + 1.87 quarters");
  assert.equal(Math.round(m.need / 1e9), 21, "what eight quarters at this pace would need raised");
  const h = ofProjHTML(m);
  assert.match(h, /data-of-proj="runs-out"/); assert.match(h, /cash reaches zero about Dec 2026 · \$20\.91B to raise by the end of 2 years/); assert.match(h, /<circle /);
  assert.match(h, /a pace, not a forecast/, "the method rides on the hover; the panel carries numbers only");
  const up = ofProjModel({ cash_and_equiv: 10e9, fiscal_date: "2026-06-30" }, [{ fiscal_date: "2026-06-30", capex: -1e9, operating_cf: 3e9 }]);
  assert.equal(up.zeroQ, null); assert.match(ofProjHTML(up), /data-of-proj="funds-itself"[\s\S]*pays for its own spending · \+\$2\.00B a quarter/);
  const slow = ofProjModel({ cash_and_equiv: 10e9, fiscal_date: "2026-06-30" }, [{ fiscal_date: "2026-06-30", capex: -2e9, operating_cf: 1.5e9 }]);
  assert.match(ofProjHTML(slow), /data-of-proj="lasts"[\s\S]*cash lasts past 2 years \(20 quarters\)/);
  assert.equal(ofProjModel(null, CRWV), null, "no balance sheet: no line, the coverage sentence already says why");
  assert.equal(ofProjModel({ cash_and_equiv: 1e9 }, [{ fiscal_date: "2026-06-30", capex: -1e9 }]), null, "a quarter without its operating line is not counted");
  assert.equal(ofProjHTML(null), "");
  assert.match(html, /select=period,fiscal_year,fiscal_date,capex,operating_cf&order=fiscal_date\.desc&limit=4/);
  assert.match(grab(/const OF_PAGE_SPECS = [\s\S]*?<\/details>";/), /It is a pace, not a forecast/);
});

test("previous close: a provisional or provider-revised close is said on hover; a held close keeps its own words; a confirmed close says nothing", () => {
  const cells = {}; const mk = (id) => (cells[id] = { attrs: {}, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } });
  mk("lc_MU"); mk("lc_NVDA"); mk("lc_FINX"); mk("coPrev");
  const src = "const el = (id) => cells[id] || null;\nconst LEFT_T = 'MU';\n" + grab(/function scSetTitle \(node, value\) \{[\s\S]*?\n\}/) + "\n" + grab(/function scSetAttr \(node, name, value\) \{[\s\S]*?\n\}/) + "\n" +
    grab(/const SC_HELD_PREV = \{\};\n/) + grab(/function scHeldPrevTitle \(t\) \{[\s\S]*?\n\}/) + "\n" + grab(/const SC_PREV_NOTE = \{\};\n/) + grab(/function scPrevNoteSet \(t, q\) \{[\s\S]*?\n\}/) + "\n" +
    grab(/function scPrevNoteTitle \(t\) \{[\s\S]*?\n\}/) + "\n" + grab(/function scPrevNoteState \(t\) \{[^\n]*\n/) + grab(/function scHeldPrevPaint \(t\) \{[\s\S]*?\n\}/) + "\n";
  const K = new Function("cells", src + "return { scPrevNoteSet, scPrevNoteTitle, scHeldPrevPaint, SC_HELD_PREV, SC_PREV_NOTE };")(cells);
  K.scPrevNoteSet("MU", { previous_close: 1097.41, previous_close_provisional: false, previous_close_revised: { own_close: 1097.39, provider_close: 1097.41 } });
  K.scHeldPrevPaint("MU");
  assert.equal(cells.lc_MU.attrs.title, "previous close revised by the provider: 1,097.39 → 1,097.41 (our close at the bell → the official close)");
  assert.equal(cells.lc_MU.attrs["data-sc-prev-close-state"], "REVISED");
  assert.equal(cells.coPrev.attrs.title, cells.lc_MU.attrs.title, "the open company's header says the same");
  K.scPrevNoteSet("NVDA", { previous_close: 233.95, previous_close_provisional: true, previous_close_revised: null });
  K.scHeldPrevPaint("NVDA");
  assert.match(cells.lc_NVDA.attrs.title, /^previous close 233\.95 is provisional: our own close at the bell/);
  assert.equal(cells.lc_NVDA.attrs["data-sc-prev-close-state"], "PROVISIONAL");
  K.scPrevNoteSet("NVDA", { previous_close: 233.95, previous_close_provisional: false, previous_close_revised: null });
  K.scHeldPrevPaint("NVDA");
  assert.equal(cells.lc_NVDA.attrs.title, ""); assert.equal(cells.lc_NVDA.attrs["data-sc-prev-close-state"], undefined, "confirmed: silent");
  K.SC_HELD_PREV.FINX = { spread_abs: 0.02, sources: { daily: 30.10, print: 30.12 } };
  K.scPrevNoteSet("FINX", { previous_close: 30.1, previous_close_provisional: true });
  K.scHeldPrevPaint("FINX");
  assert.match(cells.lc_FINX.attrs.title, /^previous close held: sources disagree/); assert.equal(cells.lc_FINX.attrs["data-sc-prev-close-state"], "HELD", "P9's held state wins");
  assert.match(html, /if \(typeof scPrevNoteSet === "function"\) scPrevNoteSet\(t, q\);/);
});
