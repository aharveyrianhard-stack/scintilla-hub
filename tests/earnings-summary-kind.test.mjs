import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const kind = new Function(page.match(/function ernSummaryKind\(row\) \{[\s\S]*?\n\}\n/)[0] + "return ernSummaryKind;")();

test("the event summary is titled by its own stored provenance - 'release summary' only where a press release is the stored source", () => {
  // measured 2026-09-18 over the 167 rows with a release_summary: transcript 113, data 44, press_release-only 10
  assert.deepEqual(kind({ summary_source: "transcript", release_source: null }), { btn: "▤ Summary", head: "EARNINGS SUMMARY", note: "Written from the reported figures and the earnings call - not a summary of the company's release (stored source: transcript)." }, "KR 2026-09-11");
  assert.equal(kind({ summary_source: "transcript", release_source: "press_release:GlobeNewsWire" }).head, "EARNINGS SUMMARY", "NIO 2026-09-01: the summariser overwrote the press text, so the press source no longer describes what is shown");
  assert.equal(kind({ summary_source: "data", release_source: "press_release:PRNewswire" }).note, "Written from the headline figures only - no release or call text behind it (stored source: data).");
  assert.deepEqual(kind({ summary_source: null, release_source: "press_release:Business Wire" }), { btn: "▤ Release summary", head: "RELEASE SUMMARY", note: "Opening text of the press release (Business Wire)." });
  assert.equal(kind({ summary_source: null, release_source: "press_release:" }).note, "Opening text of the press release (wire).");
  for (const r of [{}, null, undefined, { summary_source: null, release_source: null }, { summary_source: "", release_source: "sec_filing" }, { summary_source: "something-new" }])
    assert.deepEqual(kind(r), { btn: "▤ Summary", head: "SUMMARY", note: "The source of this text is not recorded." }, JSON.stringify(r) + ": no provenance, no claim");
  assert.equal(kind({ summary_source: "TRANSCRIPT" }).head, "EARNINGS SUMMARY");
});

test("the provenance travels with the row and is escaped where it is printed", () => {
  assert.equal((page.match(/release_summary,release_metrics,summary_source,release_source/g) || []).length, 2, "company payload and master feed read both provenance columns");
  assert.match(page, /&select=release_summary,release_metrics,call_url,release_link,summary_source,release_source&limit=1"/, "the panel reads them with the text it shows");
  assert.match(page, /summaryKind: ernSummaryKind\(row\),/);
  assert.match(page, /'">' \+ esc\(\(d\.summaryKind && d\.summaryKind\.btn\) \|\| "▤ Summary"\) \+ '<\/button>'/);
  assert.match(page, /if \(kh && r\.release_summary\) kh\.textContent = " · " \+ kind\.head;/, "the title is set as text, never as markup");
  assert.match(page, /'<div style="color:#8A8EA8;margin-bottom:12px">' \+ esc\(kind\.note\) \+ '<\/div>/, "a publisher name from the stored row is escaped");
  assert.doesNotMatch(page, /' · RELEASE SUMMARY'/, "no panel is titled a release summary before its row says so");
});
