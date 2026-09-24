/* M28 — the report-time fill as a job that runs itself.
   The rules are the reviewed script's rules, unchanged; what is new is that they run in
   Supabase on a schedule instead of on a Mac with a key on it. These tests pin the rules
   and the two safety properties that matter: it never guesses, and it never overwrites. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decide as scriptDecide } from "../scripts/earnings-report-time-backfill.mjs";
const fnSrc = fs.readFileSync(new URL("../supabase/functions/earnings-report-time/index.ts", import.meta.url), "utf8");
const sql = fs.readFileSync(new URL("../supabase/migrations/20260923_earnings_report_time_cron.sql", import.meta.url), "utf8");

/* the function's own decide(), lifted out of the TypeScript and run as written */
const body = fnSrc.match(/export function decide\(row: any, hit: any\) \{[\s\S]*?\n\}/)[0]
  .replace(/export function decide\(row: any, hit: any\)/, "function decide(row, hit)");
const table = fnSrc.match(/const NASDAQ_TIME: Record<string, string \| null> = \{[\s\S]*?\n\};/)[0]
  .replace(/: Record<string, string \| null>/, "");
const decide = new Function(table + "\n" + body + "\nreturn decide;")();

test("the job's rules are the script's rules, case for case", () => {
  const cases = [
    [{ report_time: "AMC" }, { time: "time-pre-market" }],      // already set
    [{ report_time: "" }, { time: "time-pre-market" }],         // blank counts as empty
    [{ report_time: null }, { time: "time-pre-market" }],
    [{ report_time: null }, { time: "time-after-hours" }],
    [{ report_time: null }, { time: "time-not-supplied" }],     // the source states no time
    [{ report_time: null }, { time: "time-something-new" }],    // a word we do not know
    [{ report_time: null }, null],                              // the source has no row that day
  ];
  for (const [row, hit] of cases) assert.deepEqual(decide(row, hit), scriptDecide(row, hit), JSON.stringify([row, hit]));
  assert.deepEqual(decide({ report_time: null }, { time: "time-pre-market" }), { write: "BMO", reason: "FILLED" });
  assert.deepEqual(decide({ report_time: null }, { time: "time-not-supplied" }), { write: null, reason: "SOURCE_STATES_NO_TIME" },
    "a source that does not state a time writes NOTHING — the card goes on saying it was not announced");
  assert.equal(decide({ report_time: "BMO" }, { time: "time-after-hours" }).write, null, "a stored time is never overwritten");
});

test("the write itself refuses to overwrite, at the database, not just in the code", () => {
  assert.match(fnSrc, /earnings_events\?ticker=eq\.\$\{encodeURIComponent\(f\.ticker\)\}&date=eq\.\$\{f\.date\}&report_time=is\.null/,
    "the PATCH filter carries report_time=is.null, so a row filled between the read and the write survives");
  assert.match(fnSrc, /report_time: f\.report_time, report_time_source: SOURCE_NAME, report_time_set_at: set_at/);
  /* three columns and no others: no price, no estimate, no result, no date */
  const patchBody = fnSrc.match(/\{ report_time: f\.report_time[^}]*\}/)[0];
  assert.deepEqual([...patchBody.matchAll(/(\w+):/g)].map((m) => m[1]).sort(),
    ["report_time", "report_time_set_at", "report_time_source"]);
  assert.match(fnSrc, /report_time=is\.null&superseded_at=is\.null&order=date\.asc/,
    "and it only reads the LIVE rows that are missing a time - a date M34 retired is not a report");
  assert.match(fnSrc, /report_time=is\.null&superseded_at=is\.null`,/, "and it never writes a time onto a retired date");
});

test("it runs itself, once at a time, and leaves a receipt", () => {
  assert.match(sql, /cron\.schedule\('earnings-report-time-1d', '23 13 \* \* 1-5'/, "weekday mornings, 09:23 New York");
  assert.match(sql, /functions\/v1\/earnings-report-time\?days=45/);
  assert.match(sql, /select cron\.unschedule\('earnings-report-time-1d'\);/, "the rollback is written down");
  assert.match(sql, /where report_time_source = 'nasdaq-calendar'/, "and so is how to undo what it wrote");
  assert.match(fnSrc, /if \(since < 20 \* 60e3\) return Response\.json\(\{ skipped: "ANOTHER_RUN_IN_FLIGHT"/,
    "single flight, like every other job in this estate");
  assert.match(fnSrc, /key: "earnings_time_last"/, "a job nobody can check is a job nobody can trust");
});

test("no key is written down anywhere in what is committed", () => {
  for (const [what, text] of [["the function", fnSrc], ["the migration", sql]]) {
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(text), what + " carries no JWT");
    assert.ok(!/sb_(secret|publishable)_[A-Za-z0-9]/.test(text), what + " carries no Supabase key literal");
  }
  assert.match(fnSrc, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/, "the function reads its key from its own environment");
  assert.match(sql, /from vault\.decrypted_secrets\s*\n?\s*where name = 'scintilla_functions_key'/, "the schedule reads its bearer from Vault by name");
});
