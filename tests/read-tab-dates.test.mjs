import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("READ blocks and the composite basis are labelled with their date when older than a day", () => {
  /* M32 — the epoch/ISO parse moved into readTsMs so the per-section ages and this label cannot
     drift apart; both are extracted here, and the test below pins that there is only one parser. */
  const src = page.match(/const READ_STALE_MS = [^\n]*\n/)[0] + page.match(/function readTsMs\(ts\) \{[\s\S]*?\n\}\n/)[0] +
    page.match(/function readAgeLabel\(ts, nowMs\) \{[\s\S]*?\n\}\n/)[0] + "return readAgeLabel;";
  const readAgeLabel = new Function(src)();
  const now = Date.parse("2026-09-18T04:50:00Z");
  assert.equal(readAgeLabel("2026-06-11T16:20:02.256+00:00", now), "AS OF 2026-06-11 (99d old)", "read_blocks ISO stamp");
  assert.equal(readAgeLabel(1787584061, now), "AS OF 2026-08-24 (25d old)", "composite_staged epoch-seconds stamp");
  assert.equal(readAgeLabel("2026-09-18T04:40:13.155+00:00", now), null, "today's block carries no label");
  assert.equal(readAgeLabel(null, now), null);
  assert.match(page, /read_blocks\?ticker=eq\." \+ e \+ "&select=section,body,updated_ts"/);
  assert.match(page, /asOf: d0\.updated_ts \|\| null/);
  assert.match(page, /const extras = \[\["NARRATIVE BASIS", \[basis\]\]\];/, "the 2026-06-11 trend/levels/cohort rows are no longer drawn; the narrative basis is");
  assert.match(page, /const basis = rb\.basis \? String\(rb\.basis\)/, "the writer's own basis section is preferred when present");
  /* M37 — the legacy capture is GONE. The verdict is no longer dated by composite_staged at all:
     it reads the row the board's own provider overlay just wrote. */
  assert.doesNotMatch(page, /legacyCompositeAsOf/, "the frozen composite date is no longer captured for the verdict");
  assert.doesNotMatch(page, /legacyAsOf/, "and nothing downstream can still read it");
  assert.match(page, /const liveRead = scLiveRead\(d0\);/, "the verdict reads the overlaid row");
  assert.match(page, /verdict\.push\(liveReadSentence\(d, t\)\);/);
  assert.equal((page.match(/^function readTsMs\(/gm) || []).length, 1, "one epoch/ISO parser for every read date on this surface");
  assert.match(page.match(/function readAgeLabel\(ts, nowMs\) \{[\s\S]*?\n\}\n/)[0], /const v = readTsMs\(ts\);/, "and this label uses it");
  assert.equal(readAgeLabel(0, now), null, "a 0 epoch is no date at all — never 2000-01-01");
});
