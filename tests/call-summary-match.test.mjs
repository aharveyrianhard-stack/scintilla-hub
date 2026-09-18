import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const helpers = page.match(/function callDayWindow\(day, n\) \{[\s\S]*?\n\}\n/)[0] + page.match(/function pickCall\(rows, ticker, quarter, day, exactDay\) \{[\s\S]*?\n\}\n/)[0];
const match = new Function(helpers + page.match(/function matchCallSummaries\(events, calls\) \{[\s\S]*?\n\}\n/)[0] + "return matchCallSummaries;")();
const pickCall = new Function(helpers + "return pickCall;")();
const callDayWindow = new Function(helpers + "return callDayWindow;")();
const ev = (ticker, date, report_time = null) => ({ ticker, date, report_time });
const call = (ticker, quarter, call_date) => ({ ticker, quarter, call_date });   // the index holds ONLY calls that have a stored summary

test("a call summary is attached to an event only when the call is that event's call: same day, or the next day with nothing else on it", () => {
  // the three measured cards (2026-09-18): no release_summary, a summarised call on the very same date
  const m = match([ev("FDX", "2026-06-23"), ev("FDX", "2026-03-19"), ev("MU", "2026-06-24"), ev("COST", "2026-05-28")],
    [call("FDX", "Q4 2026", "2026-06-23"), call("FDX", "Q3 2026", "2026-03-19"), call("MU", "Q3 2026", "2026-06-24"), call("COST", "Q3 2026", "2026-05-28")]);
  assert.deepEqual(m.get("FDX|2026-06-23"), { call_date: "2026-06-23", quarter: "Q4 2026" });
  assert.deepEqual(m.get("FDX|2026-03-19"), { call_date: "2026-03-19", quarter: "Q3 2026" }, "each quarter's card gets its own quarter's call");
  assert.deepEqual(m.get("MU|2026-06-24"), { call_date: "2026-06-24", quarter: "Q3 2026" });
  assert.deepEqual(m.get("COST|2026-05-28"), { call_date: "2026-05-28", quarter: "Q3 2026" });
  // after-close release, call the next morning (measured: STLD 2026-07-20 stored AMC, summarised call 2026-07-21; likewise FNV, DKNG, PAAS, SIMO)
  assert.deepEqual(match([ev("STLD", "2026-07-20", "AMC")], [call("STLD", "Q2 2026", "2026-07-21")]).get("STLD|2026-07-20"), { call_date: "2026-07-21", quarter: "Q2 2026" });
  assert.deepEqual(match([ev("X", "2026-12-31", "amc")], [call("X", "Q4", "2027-01-01")]).get("X|2026-12-31"), { call_date: "2027-01-01", quarter: "Q4" }, "next day across a year end");
  assert.deepEqual(match([ev("X", "2028-02-28", "AMC")], [call("X", "Q4", "2028-02-29")]).get("X|2028-02-28"), { call_date: "2028-02-29", quarter: "Q4" }, "next day into a leap day");
  for (const session of [null, undefined, "", "BMO", "TBD", "DMH"])
    assert.equal(match([ev("STLD", "2026-07-20", session)], [call("STLD", "Q2 2026", "2026-07-21")]).size, 0, "a next-day call is matched only to an event STORED as after-close; session " + JSON.stringify(session) + " gets none");
  assert.equal(match([ev("FDX", "2026-06-23", null)], [call("FDX", "Q4 2026", "2026-06-23")]).size, 1, "the same-day match never depends on the session");
});

test("never another quarter, never the day before, never 'the latest call'", () => {
  const calls = [call("FDX", "Q4 2026", "2026-06-23")];
  for (const d of ["2026-06-24", "2026-06-25", "2026-06-21", "2026-06-20", "2026-03-19", "2026-09-17", "2025-06-23", "2027-06-23"])
    assert.equal(match([ev("FDX", d)], calls).has("FDX|" + d), false, "event " + d + " must not pick up the 2026-06-23 call");
  assert.equal(match([ev("FDX", "2026-06-22", "AMC")], calls).get("FDX|2026-06-22").call_date, "2026-06-23", "only the single next day is allowed, and only after an after-close release");
  for (const d of ["2026-06-24", "2026-06-21", "2026-06-20"]) assert.equal(match([ev("FDX", d, "AMC")], calls).size, 0, "AMC does not widen anything else: " + d);
  assert.equal(match([ev("EOSE", "2026-08-05", "BMO")], [call("EOSE", "Q2 2026", "2026-08-07")]).size, 0, "measured: the one call two days after its (BMO) event stays unmatched");
  assert.equal(match([ev("FDX", "2026-06-23")], [call("MU", "Q3 2026", "2026-06-23")]).size, 0, "another company's call on the same day is not this company's call");
  assert.equal(match([ev("FDX", "2026-06-23")], []).size, 0, "no summarised call, no button: a newer event never falls back to an older summary");
  assert.equal(match([ev("FDX", "2026-10-28")], [call("FDX", "Q4 2026", "2026-06-23")]).size, 0);
});

test("one call is never attached to two cards: adjacent-day rows of one report (measured: AVGO 09-02/09-03, CRDO, LI, BIDU, WULF)", () => {
  const a = match([ev("AVGO", "2026-09-02", "AMC"), ev("AVGO", "2026-09-03", "AMC")], [call("AVGO", "Q3 2026", "2026-09-03")]);
  assert.deepEqual([...a.keys()], ["AVGO|2026-09-03"], "the call belongs to the row on its own day; the row before it gets nothing");
  const b = match([ev("AVGO", "2026-09-02", "AMC"), ev("AVGO", "2026-09-03", "AMC")], [call("AVGO", "Q3 2026", "2026-09-02")]);
  assert.deepEqual([...b.keys()], ["AVGO|2026-09-02"], "never backwards to the later row");
  const every = match([ev("A", "2026-01-05", "AMC"), ev("A", "2026-01-06", "AMC"), ev("A", "2026-01-07", "AMC")], [call("A", "Q", "2026-01-06"), call("A", "Q", "2026-01-07")]);
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
  assert.match(page, /"earnings_call_transcripts\?ticker=eq\." \+ encodeURIComponent\(tk\) \+ "&call_date=eq\." \+ encodeURIComponent\(cd\) \+ "&ai_summary=not\.is\.null&select=ticker,quarter,call_date,ai_summary&limit=4"/, "exact ticker and call date - no order-by-latest");
  assert.match(page, /const r = pickCall\(rows, tk, cq, cd, true\);/, "and the row shown is the one that was named, or nothing");
  assert.doesNotMatch(page, /\|\| \(rows && rows\[0\]\)|if \(!tr\) tr = rows\[0\];/, "no 'first row that came back' fallback is left anywhere");
  assert.match(page, /Summary of the earnings call held ' \+ esc\(fmtEvDate\(r\.call_date\)\)[^\n]*No release summary is stored for this event\./);
  assert.match(page, /'<div style="margin-bottom:14px">' \+ summaryHTML\(r\.ai_summary\) \+ "<\/div>"/, "drawn by the escape-first formatter");
  assert.match(page, /if \(!r \|\| !r\.ai_summary\) \{ b\.textContent = "no call summary on file for this call" \+ \(cq \? " \(" \+ cq \+ "\)" : ""\) \+ "\."; return; \}/, "truthful when the summary is gone by the time it is opened");
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
  assert.match(page, /if \(fh && fh\.firstChild\) \{ fh\._gen = \(fh\._gen \|\| 0\) \+ 1; fh\.innerHTML = ""; return; \}/);
});

test("a day that is not a real day never throws and never matches (it used to throw RangeError and take the whole feed down)", () => {
  for (const d of ["2026-13-01", "2026-00-10", "2026-01-00", "2026-01-32", "2026-02-30", "0000-00-00", "9999-99-99"]) {
    assert.doesNotThrow(() => match([ev("X", d, "AMC")], [call("X", "Q", "2026-01-05")]), d);
    assert.equal(callDayWindow(d, 1), null, d + " is not a day");
  }
  assert.doesNotThrow(() => match([ev("A|B", "2026-01-05", "AMC")], [call("A|B", "Q", "2026-01-06")]));
  assert.deepEqual(match([ev("A|B", "2026-01-05", "AMC")], [call("A|B", "Q", "2026-01-06")]).get("A|B|2026-01-05"), { call_date: "2026-01-06", quarter: "Q" }, "a | inside a ticker cannot shift the date");
  assert.deepEqual(callDayWindow("2026-03-01", 3), ["2026-02-26", "2026-03-04"]);
  assert.deepEqual(callDayWindow("2028-02-28", 1), ["2028-02-27", "2028-02-29"]);
});

test("pickCall returns the call that was asked for - same company, named period, named day - or nothing; never another quarter", () => {
  const rows = [{ ticker: "FDX", quarter: "Q4 2026", call_date: "2026-06-23", ai_summary: "q4" }, { ticker: "FDX", quarter: "Q3 2026", call_date: "2026-03-19", ai_summary: "q3" }];
  assert.equal(pickCall(rows, "FDX", "Q3 2026", "2026-03-19", true).ai_summary, "q3", "historical call by period and day");
  assert.equal(pickCall(rows, "fdx", "Q4 2026", "2026-06-23", true).ai_summary, "q4", "latest call by period and day");
  assert.equal(pickCall(rows, "FDX", "Q2 2026", "2025-12-18", true), null, "the requested period is absent: NOTHING, not the newest row (this used to return rows[0])");
  assert.equal(pickCall(rows, "FDX", "Q4 2026", "2026-03-19", true), null, "period and day disagree: nothing");
  assert.equal(pickCall(rows, "NIO", "Q4 2026", "2026-06-23", true), null, "another company's rows are never this company's call");
  assert.equal(pickCall([{ quarter: "Q4 2026", call_date: "2026-06-23", ai_summary: "no ticker" }], "FDX", "Q4 2026", "2026-06-23", true), null, "a row that does not say whose it is is not accepted");
  assert.equal(pickCall(rows, "FDX", "", "2026-06-23", true).quarter, "Q4 2026", "a call stored without a period name is found by its exact day");
  // a card knows only its event date: the call within three days of it, the nearest one, never further
  assert.equal(pickCall(rows, "FDX", "", "2026-06-22").quarter, "Q4 2026");
  assert.equal(pickCall(rows, "FDX", "", "2026-06-27"), null, "four days away is not this event's call");
  assert.equal(pickCall(rows, "FDX", "", "2026-09-17"), null, "a date with no call nearby gets nothing - it used to get the nearest call however far away");
  assert.equal(pickCall(rows, "FDX", "", ""), null, "no period and no day: nothing - it used to get the newest call");
  assert.equal(pickCall(rows, "FDX", "Q3 2026", "").quarter, "Q3 2026", "a named period alone is enough");
  for (const bad of [null, undefined, {}, "x", [null, 1, "y"]]) assert.equal(pickCall(bad, "FDX", "Q4 2026", "2026-06-23", true), null);
});

test("the transcript panel asks for exactly the call it was opened for", () => {
  assert.match(page, /\(qq \? "&quarter=eq\." \+ encodeURIComponent\(qq\) : "&call_date=gte\." \+ span\[0\] \+ "&call_date=lte\." \+ span\[1\]\) \+ "&select=ticker,transcript,quarter,call_date&order=call_date\.desc&limit=8"/);
  assert.match(page, /const tr = pickCall\(rows, tk, qq, dd\);/);
  assert.match(page, /if \(!qq && !span\) \{ if \(body\) body\.textContent = "transcript not stored for this call\."; break; \}/, "a control that names neither a period nor a day starts no request");
  assert.doesNotMatch(page, /select=transcript,quarter,call_date&order=call_date\.desc&limit=24/, "the 'read the 24 newest and guess' read is gone");
});

test("a company's own EVENTS tab brings its own call dates, so the Transcript control no longer depends on the master feed having been opened", () => {
  assert.match(page, /pg\("earnings_call_transcripts\?ticker=eq\." \+ e \+ "&select=ticker,quarter,call_date&order=call_date\.desc&limit=40"\)\.catch\(\(\) => \[\]\)/, "keys only - no transcript text, no summary text");
  assert.match(page, /grds, etfi, etfh, csum, ckeys\] = \(await Promise\.all\(\[/, "destructured in the order the requests are listed");
  assert.match(page, /_callDays: \(ckeys \|\| \[\]\)\.map\(\(c\) => c && c\.call_date\)\.filter\(Boolean\),/);
  assert.match(page, /const toBlock = \(r\) => earningsRowToBlock\(r, data\._callsum, data\._callDays\);/);
  assert.match(page, /const arr = Array\.isArray\(callDays\) \? callDays : TRANSCRIPT_IDX\.get\(String\(ticker\)\.toUpperCase\(\)\);/, "the master feed keeps using its one shared index");
  const exists = new Function("TRANSCRIPT_IDX", page.match(/function transcriptExists\(ticker, date, callDays\) \{[\s\S]*?\n\}\n/)[0] + "return transcriptExists;")(new Map([["KR", ["2026-09-11"]]]));
  assert.equal(exists("FDX", "2026-06-23", ["2026-06-23", "2026-03-19"]), true);
  assert.equal(exists("FDX", "2026-06-21", ["2026-06-23"]), true, "the card's existing three-day allowance is unchanged");
  assert.equal(exists("FDX", "2026-09-17", ["2026-06-23", "2026-03-19"]), false, "a date with no call nearby shows no control");
  assert.equal(exists("FDX", "2026-06-23", []), false, "an empty list of its own is an answer: it does not fall through to the shared index");
  assert.equal(exists("KR", "2026-09-11"), true); assert.equal(exists("FDX", "2026-06-23"), false);
});
