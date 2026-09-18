import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const match = new Function(page.match(/function matchCallSummaries\(events, calls\) \{[\s\S]*?\n\}\n/)[0] + "return matchCallSummaries;")();
const ev = (ticker, date) => ({ ticker, date });
const call = (ticker, quarter, call_date) => ({ ticker, quarter, call_date });   // the index holds ONLY calls that have a stored summary

test("a call summary is attached to an event only when the call is that event's call: same day, or the next day with nothing else on it", () => {
  // the three measured cards (2026-09-18): no release_summary, a summarised call on the very same date
  const m = match([ev("FDX", "2026-06-23"), ev("FDX", "2026-03-19"), ev("MU", "2026-06-24"), ev("COST", "2026-05-28")],
    [call("FDX", "Q4 2026", "2026-06-23"), call("FDX", "Q3 2026", "2026-03-19"), call("MU", "Q3 2026", "2026-06-24"), call("COST", "Q3 2026", "2026-05-28")]);
  assert.deepEqual(m.get("FDX|2026-06-23"), { call_date: "2026-06-23", quarter: "Q4 2026" });
  assert.deepEqual(m.get("FDX|2026-03-19"), { call_date: "2026-03-19", quarter: "Q3 2026" }, "each quarter's card gets its own quarter's call");
  assert.deepEqual(m.get("MU|2026-06-24"), { call_date: "2026-06-24", quarter: "Q3 2026" });
  assert.deepEqual(m.get("COST|2026-05-28"), { call_date: "2026-05-28", quarter: "Q3 2026" });
  // evening release, call the next morning (measured: STLD release 2026-07-20, summarised call 2026-07-21)
  assert.deepEqual(match([ev("STLD", "2026-07-20")], [call("STLD", "Q2 2026", "2026-07-21")]).get("STLD|2026-07-20"), { call_date: "2026-07-21", quarter: "Q2 2026" });
  assert.deepEqual(match([ev("X", "2026-12-31")], [call("X", "Q4", "2027-01-01")]).get("X|2026-12-31"), { call_date: "2027-01-01", quarter: "Q4" }, "next day across a year end");
  assert.deepEqual(match([ev("X", "2028-02-28")], [call("X", "Q4", "2028-02-29")]).get("X|2028-02-28"), { call_date: "2028-02-29", quarter: "Q4" }, "next day into a leap day");
});

test("never another quarter, never the day before, never 'the latest call'", () => {
  const calls = [call("FDX", "Q4 2026", "2026-06-23")];
  for (const d of ["2026-06-24", "2026-06-25", "2026-06-21", "2026-06-20", "2026-03-19", "2026-09-17", "2025-06-23", "2027-06-23"])
    assert.equal(match([ev("FDX", d)], calls).has("FDX|" + d), false, "event " + d + " must not pick up the 2026-06-23 call");
  assert.equal(match([ev("FDX", "2026-06-22")], calls).get("FDX|2026-06-22").call_date, "2026-06-23", "only the single next day is allowed");
  assert.equal(match([ev("EOSE", "2026-08-05")], [call("EOSE", "Q2 2026", "2026-08-07")]).size, 0, "measured: the one call two days after its event stays unmatched");
  assert.equal(match([ev("FDX", "2026-06-23")], [call("MU", "Q3 2026", "2026-06-23")]).size, 0, "another company's call on the same day is not this company's call");
  assert.equal(match([ev("FDX", "2026-06-23")], []).size, 0, "no summarised call, no button: a newer event never falls back to an older summary");
  assert.equal(match([ev("FDX", "2026-10-28")], [call("FDX", "Q4 2026", "2026-06-23")]).size, 0);
});

test("one call is never attached to two cards: adjacent-day rows of one report (measured: AVGO 09-02/09-03, CRDO, LI, BIDU, WULF)", () => {
  const a = match([ev("AVGO", "2026-09-02"), ev("AVGO", "2026-09-03")], [call("AVGO", "Q3 2026", "2026-09-03")]);
  assert.deepEqual([...a.keys()], ["AVGO|2026-09-03"], "the call belongs to the row on its own day; the row before it gets nothing");
  const b = match([ev("AVGO", "2026-09-02"), ev("AVGO", "2026-09-03")], [call("AVGO", "Q3 2026", "2026-09-02")]);
  assert.deepEqual([...b.keys()], ["AVGO|2026-09-02"], "never backwards to the later row");
  const every = match([ev("A", "2026-01-05"), ev("A", "2026-01-06"), ev("A", "2026-01-07")], [call("A", "Q", "2026-01-06"), call("A", "Q", "2026-01-07")]);
  const used = [...every.values()].map((v) => v.call_date); assert.equal(new Set(used).size, used.length, "no call date is used twice");
});

test("two stored rows for one call (a period named two ways) are one call; malformed rows are ignored; ticker case does not matter", () => {
  const m = match([ev("KR", "2026-03-05")], [call("KR", "Q4 2026", "2026-03-05"), call("KR", "Q4 2025", "2026-03-05")]);
  assert.deepEqual(m.get("KR|2026-03-05"), { call_date: "2026-03-05", quarter: "Q4 2026" }, "first listed");
  assert.equal(match([ev("kr", "2026-03-05")], [call("KR", null, "2026-03-05")]).get("KR|2026-03-05").quarter, "");
  assert.equal(match([null, {}, ev("KR", null), ev("KR", "03/05/2026"), ev(null, "2026-03-05")], [null, {}, call("KR", "Q", "not a date"), call(null, "Q", "2026-03-05")]).size, 0);
  assert.equal(match(undefined, undefined).size, 0);
});

test("the card: the event's own summary first; otherwise the matched call, labelled as a call summary; otherwise nothing", () => {
  assert.match(page, /\(d\.summary \? '<button class="sc-ern__lnk" data-act="ernsum" data-t="[^\n]*<\/button>'\n\s*: \(d\.callSummary \? '<button class="sc-ern__lnk" data-act="ernsum" data-kind="call"[^\n]*▤ Call summary<\/button>' : ''\)\) \+/, "release_summary takes precedence; no third fallback");
  assert.match(page, /title="summary of the earnings call held ' \+ esc\(fmtEvDate\(d\.callSummary\.call_date\)\) \+ ' — no release summary is stored for this event"/);
  assert.match(page, /data-cd="' \+ esc\(d\.callSummary\.call_date\) \+ '" data-q="' \+ esc\(d\.callSummary\.quarter \|\| ""\) \+ '"/, "stored values are escaped into the attributes");
  assert.match(page, /callSummary: \(callsum instanceof Map && row\.ticker && row\.date\) \? \(callsum\.get\(String\(row\.ticker\)\.toUpperCase\(\) \+ "\|" \+ row\.date\) \|\| null\) : null,/);
  assert.doesNotMatch(page, /\.map\(earningsRowToBlock\)/, "never passed bare to Array.map: the index would arrive as the match table");
});

test("the panel says which summary it is, and the call text is fetched for exactly that call", () => {
  assert.match(page, /\(isCall \? ' · CALL SUMMARY' \+ \(cq \? ' · ' \+ esc\(cq\) : ''\) : ' · SUMMARY'\)/, "a call summary is titled as one from the moment the panel opens");
  assert.match(page, /"earnings_call_transcripts\?ticker=eq\." \+ encodeURIComponent\(tk\) \+ "&call_date=eq\." \+ encodeURIComponent\(cd\) \+ "&ai_summary=not\.is\.null&select=quarter,call_date,ai_summary&limit=4"/, "exact ticker and call date - no order-by-latest");
  assert.match(page, /Summary of the earnings call held ' \+ esc\(fmtEvDate\(r\.call_date\)\)[^\n]*No release summary is stored for this event\./);
  assert.match(page, /'<div style="margin-bottom:14px">' \+ summaryHTML\(r\.ai_summary\) \+ "<\/div>"/, "drawn by the escape-first formatter");
  assert.match(page, /if \(!r \|\| !r\.ai_summary\) \{ b\.textContent = "no call summary on file\."; return; \}/, "truthful when the summary is gone by the time it is opened");
});

test("no fetch storm: one key-only request per feed and one per company open; summary text only when a card's summary is opened", () => {
  assert.equal((page.match(/ai_summary=not\.is\.null/g) || []).length, 3, "master index, company index, and the on-demand read - nothing else asks for call summaries");
  assert.match(page, /pg\("earnings_call_transcripts\?select=ticker,quarter,call_date&ai_summary=not\.is\.null&order=call_date\.desc&limit=1000"\)\.catch\(\(\) => \[\]\)/, "master: keys only, failure degrades to no buttons");
  assert.match(page, /pg\("earnings_call_transcripts\?ticker=eq\." \+ e \+ "&ai_summary=not\.is\.null&select=ticker,quarter,call_date&order=call_date\.desc&limit=24"\)\.catch\(\(\) => \[\]\)/, "company: keys only");
  assert.match(page, /CALLSUM_IDX = matchCallSummaries\(\[\.\.\.up, \.\.\.past\], csidx \|\| \[\]\);/);
  assert.match(page, /_callsum: matchCallSummaries\(evs \|\| \[\], csum \|\| \[\]\),/);
  assert.doesNotMatch(page.match(/function earningsBlockHTML\(d\) \{[\s\S]*?\n\}\n/)[0], /pg\(|fetch\(/, "rendering a card never starts a request");
});

test("where no call summary is stored the bubble says so - nothing is 'generating' one", () => {
  assert.doesNotMatch(page, /AI summary generating/);
  assert.match(page, /"No call summary is stored for this call — open the full transcript\."/);
});

test("a transcript opened from a call summary sits above it, and Esc closes the topmost panel first", () => {
  assert.match(page, /host\.id = "trFullHost"; \}\n\s*document\.body\.appendChild\(host\);/);
  assert.match(page, /if \(fh && fh\.firstChild\) \{ fh\.innerHTML = ""; return; \}/);
});
