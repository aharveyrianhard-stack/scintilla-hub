import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("READ blocks and the composite basis are labelled with their date when older than a day", () => {
  const src = page.match(/const READ_STALE_MS = [^\n]*\n/)[0] + page.match(/function readAgeLabel\(ts, nowMs\) \{[\s\S]*?\n\}\n/)[0] + "return readAgeLabel;";
  const readAgeLabel = new Function(src)();
  const now = Date.parse("2026-09-18T04:50:00Z");
  assert.equal(readAgeLabel("2026-06-11T16:20:02.256+00:00", now), "AS OF 2026-06-11 (99d old)", "read_blocks ISO stamp");
  assert.equal(readAgeLabel(1787584061, now), "AS OF 2026-08-24 (25d old)", "composite_staged epoch-seconds stamp");
  assert.equal(readAgeLabel("2026-09-18T04:40:13.155+00:00", now), null, "today's block carries no label");
  assert.equal(readAgeLabel(null, now), null);
  assert.match(page, /read_blocks\?ticker=eq\." \+ e \+ "&select=section,body,updated_ts"/);
  assert.match(page, /asOf: d0\.updated_ts \|\| null/);
  assert.match(page, /\[k\.toUpperCase\(\) \+ \(age \? " · " \+ age : ""\), toParas\(rb\[k\]\)\]/);
  assert.match(page, /verdict\.push\(liveReadSentence\(d\) \+ \(compAge \? " Composite basis " \+ compAge\.toLowerCase\(\) \+ "\." : ""\)\);/);
});
