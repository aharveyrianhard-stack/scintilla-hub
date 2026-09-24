/* M37 — THE PILOT OF FIVE. The staged dossiers must be checkable without a database:
   every section names a source and a date, nothing writes to the live table, and the
   migration is additive with a rollback. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const sql = fs.readFileSync(new URL("../supabase/migrations/20260924_ticker_context_staged.sql", import.meta.url), "utf8");
const TICKERS = ["AAPL", "NVDA", "AMD", "PANW", "MU"];

/* the five rows, parsed out of the insert by their $b$…$b$ bodies */
function rows() {
  const bodies = [...sql.matchAll(/\$b\$([\s\S]*?)\$b\$/g)].map((m) => m[1]);
  assert.equal(bodies.length, TICKERS.length * 3, "three sections for each of five companies");
  const out = {};
  TICKERS.forEach((t, i) => {
    out[t] = { business: bodies[i * 3], catalysts: bodies[i * 3 + 1], watch: bodies[i * 3 + 2] };
  });
  return out;
}

test("the table is additive, read-only to the browser, and carries its rollback", () => {
  assert.match(sql, /create table if not exists public\.ticker_context_staged/);
  assert.match(sql, /alter table public\.ticker_context_staged enable row level security/);
  assert.match(sql, /for select to anon, authenticated using \(true\)/);
  assert.match(sql, /ROLLBACK:\n--   drop policy if exists ticker_context_staged_read on public\.ticker_context_staged;\n--   drop table if exists public\.ticker_context_staged;/);
  assert.equal((sql.match(/\$b\$/g) || []).length % 2, 0, "every dollar-quoted body is closed");
});

test("nothing in this migration touches the live dossier table", () => {
  for (const write of [/insert into public\.ticker_context\b/i, /update public\.ticker_context\b/i,
                       /delete from public\.ticker_context\b/i, /drop table public\.ticker_context\b/i])
    assert.doesNotMatch(sql, write, "public.ticker_context must be left exactly as it is");
  assert.equal((sql.match(/insert into/gi) || []).length, 1, "one insert, into the staged table");
});

test("all five companies are present with all three sections", () => {
  const r = rows();
  for (const t of TICKERS)
    for (const sec of ["business", "catalysts", "watch"])
      assert.ok(r[t][sec].trim().length > 400, t + " " + sec + " is substantive");
});

test("every section carries dates, and every section names where it came from", () => {
  const r = rows();
  for (const t of TICKERS) for (const sec of ["business", "catalysts", "watch"]) {
    const body = r[t][sec];
    const dates = body.match(/20\d\d-\d\d-\d\d/g) || [];
    assert.ok(dates.length >= 2, t + " " + sec + " must date its claims (found " + dates.length + ")");
    assert.match(body, /earnings_events|earnings call summary|earnings_call_transcripts|fundamentals|chart API|news|analyst_grades|analyst_estimates/,
      t + " " + sec + " must name its source");
    assert.ok(!/\b(19[0-9]\d|200\d)\b-\d\d-\d\d/.test(body) || sec === "watch",
      t + " " + sec + " should not quote a pre-2010 date outside a stated data caution");
  }
});

test("each row's sources list is valid JSON and names the tables it used", () => {
  const all = [...sql.matchAll(/'(\[[^']*\])'::jsonb/g)].map((m) => JSON.parse(m[1]));
  const lists = all.filter((l) => l.length);        // the column default '[]' is the sixth match
  assert.equal(all.length, 6);
  assert.equal(lists.length, 5);
  for (const l of lists) {
    assert.ok(l.length >= 4, "at least four named sources");
    assert.ok(l.some((s) => /earnings_events/.test(s)) && l.some((s) => /chart API/.test(s)));
  }
});

test("the two data faults found while writing are recorded, not smoothed over", () => {
  const r = rows();
  assert.match(r.PANW.watch, /2026-08-17 row with no actuals, dated BEFORE the 2026-09-01 report/,
    "PANW's upcoming-date row is dated before its last report");
  assert.match(r.PANW.watch, /no rows at all in analyst_grades/);
  assert.match(r.AMD.watch, /analyst_estimates rows for AMD begin in 1996/);
});

test("no claim is dressed as current market advice", () => {
  const r = rows();
  for (const t of TICKERS) for (const sec of ["business", "catalysts", "watch"])
    for (const banned of [/\bbuy\b(?! -> )/i, /\bsell\b/i, /price target of/i, /we expect/i, /will outperform/i])
      assert.doesNotMatch(r[t][sec], banned, t + " " + sec + " states sourced facts, not a recommendation");
});
