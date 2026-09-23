/* EVENTS earnings — the rules the report-time backfill will not break.
   Alan, 23 Sep: "Why do I see time unknown in a couple of these? Costco and
   Micron… ASML." A stored calendar that carries no time must say so; a filled
   time must name the source that stated it; and nothing may ever be guessed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decide, NASDAQ_TIME, SOURCE_NAME } from "../scripts/earnings-report-time-backfill.mjs";

const row = (report_time = null) => ({ ticker: "COST", date: "2026-09-24", report_time });

test("only a source that STATES a time writes one", () => {
  assert.deepEqual(decide(row(), { time: "time-after-hours" }), { write: "AMC", reason: "FILLED" });
  assert.deepEqual(decide(row(), { time: "time-pre-market" }), { write: "BMO", reason: "FILLED" });
  assert.deepEqual(decide(row(), { time: "time-not-supplied" }), { write: null, reason: "SOURCE_STATES_NO_TIME" },
    "the calendar saying nothing is not a time — the card goes on saying it was not announced");
  assert.equal(decide(row(), { time: "time-lunchtime" }).write, null, "a value we do not understand is never mapped to a guess");
  assert.match(decide(row(), { time: "time-lunchtime" }).reason, /NOT_UNDERSTOOD/);
  assert.deepEqual(NASDAQ_TIME, { "time-pre-market": "BMO", "time-after-hours": "AMC", "time-not-supplied": null });
});

test("a time already in the calendar is never overwritten, whoever put it there", () => {
  for (const t of ["BMO", "AMC", "08:30", "amc"])
    assert.deepEqual(decide(row(t), { time: "time-pre-market" }), { write: null, reason: "ALREADY_SET" });
  assert.equal(decide(row("  "), { time: "time-pre-market" }).write, "BMO", "blank space is not a stored time");
});

test("no row for that day in the source means nothing is written", () => {
  assert.deepEqual(decide(row(), null), { write: null, reason: "SOURCE_HAS_NO_ROW_FOR_THIS_DAY" });
  assert.deepEqual(decide(row(), undefined), { write: null, reason: "SOURCE_HAS_NO_ROW_FOR_THIS_DAY" });
});

test("the write is matched on ticker AND date, filtered to empty rows at the database, and stamped with its source", () => {
  const src = fs.readFileSync(new URL("../scripts/earnings-report-time-backfill.mjs", import.meta.url), "utf8");
  assert.match(src, /earnings_events\?ticker=eq\.\$\{encodeURIComponent\(f\.ticker\)\}&date=eq\.\$\{f\.date\}&report_time=is\.null/,
    "the database itself refuses to overwrite, not only this script");
  assert.match(src, /report_time_source: SOURCE_NAME, report_time_set_at: new Date\(\)\.toISOString\(\)/);
  assert.equal(SOURCE_NAME, "nasdaq-calendar");
  assert.match(src, /const apply = argv\.includes\("--apply"\);/);
  assert.match(src, /if \(apply && !SERVICE\) throw new Error\("--apply needs SUPABASE_SERVICE_ROLE_KEY/);
  /* the dry-run line NAMES the environment variable, which is the point; what it must
     never do is print the value held in it */
  assert.doesNotMatch(src, /console\.(log|error)\([^\n]*(\$\{\s*(SERVICE|ANON|readKey)\s*\}|\+\s*(SERVICE|ANON|readKey)\b)/,
    "a key value is never printed");
  /* a date disagreement is reported, never corrected: a different date is a different event */
  assert.match(src, /disagreements\.push\(\{ ticker: row\.ticker, our_date: row\.date, source_dates: elsewhere \}\)/);
});

test("the migration adds only the two columns that make a filled time auditable", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260923_earnings_report_time_source.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists report_time_source text/);
  assert.match(sql, /add column if not exists report_time_set_at  timestamptz/);
  assert.doesNotMatch(sql, /drop |delete |truncate |update public\.earnings_events set/i, "it changes no stored value");
});
