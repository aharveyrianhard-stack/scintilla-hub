/* EVENTS earnings (M26) — the Transcript control.
   MEASURED 2026-09-23 against the live store: earnings_call_transcripts holds
   1,405 rows, every one of them carrying the call's TEXT, and NOT ONE carrying a
   url; earnings_events.transcript_url is empty across the whole table. So the
   control can never be a link — it has to open the stored text, and it must not
   appear when there is no text to open. These tests pin exactly that. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the button is drawn from the stored content, never from the dead url column", () => {
  assert.match(src, /\(d\.hasTranscript \? '<button class="sc-ern__lnk" data-act="fulltranscript"/,
    "the control is a button over stored content, not an anchor to a url");
  assert.match(src, /hasTranscript: transcriptExists\(row\.ticker, row\.date, callDays\)/);
  /* transcript_url is still read off the row into the block, and nothing may render it */
  const foot = src.slice(src.indexOf("const foot = reported"), src.indexOf("return '<div class=\"sc-ern\">"));
  assert.doesNotMatch(foot, /transcriptUrl/, "no code path turns the dead column back into a link");
});

test("no stored call, no control: the button cannot appear over nothing", () => {
  const fn = new Function(src.match(/function transcriptExists\(ticker, date, callDays\) \{[\s\S]*?\n\}/)[0] +
    "return transcriptExists;")();
  assert.equal(fn("AVGO", "2026-09-03", []), false, "an empty index shows no control");
  assert.equal(fn("AVGO", "2026-09-03", ["2026-09-02"]), true, "the call the day before its card's date is that call");
  assert.equal(fn("AVGO", "2026-09-03", ["2026-09-06"]), true, "three days is the window");
  assert.equal(fn("AVGO", "2026-09-03", ["2026-09-07"]), false, "four days is another event");
  assert.equal(fn("", "2026-09-03", ["2026-09-03"]), false);
  assert.equal(fn("AVGO", "", ["2026-09-03"]), false);
});

test("the transcript window fits inside the screen it opens on", () => {
  /* MEASURED at 1680x1000 before the fix: the panel was 1,103px tall in a 1,000px
     window, so its header and its ✕ Close sat 35px above the top of the screen and
     could not be clicked. The cockpit's zoom law makes a vh worth more than it looks. */
  const modal = src.slice(src.indexOf('case "fulltranscript"'), src.indexOf('case "fulltranscript"') + 2600);
  assert.doesNotMatch(modal, /max-height:86vh/, "a vh height is not safe under the global zoom law");
  assert.match(modal, /position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;box-sizing:border-box/);
  assert.match(modal, /width:min\(860px,92vw\);max-height:100%/);
});
