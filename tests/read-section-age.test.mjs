import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name);
  return page.slice(s, page.indexOf("\n}\n", s) + 3);
}
const api = new Function(page.match(/^const READ_AGE_OLD_D = [^\n]*\n/m)[0] +
  fn("readTsMs") + fn("readSectionAge") + "return readSectionAge;")();
const NOW = Date.parse("2026-09-23T23:15:00Z");
/* the real values read out of production on 2026-09-23 */
const DOSSIER_AAPL = 1781496978;                      // AAPL ticker_context.enriched_ts → 2026-06-15
const COMPOSITE_AAPL = Date.parse("2026-08-24T15:07:41Z") / 1000;
const RESTAMP = "2026-09-23T23:10:01.629+00:00";      // read_blocks.updated_ts, written by read-engine

test("a section is dated by its own source, not by the job that re-stamped it", () => {
  const a = api("DOSSIER", DOSSIER_AAPL, RESTAMP, NOW);
  assert.equal(a.date, "2026-06-15");
  assert.equal(a.days, 100, "the words behind AAPL's BUSINESS tab have not changed in 100 days");
  assert.equal(a.text, "DOSSIER · AS OF 2026-06-15 · 100D OLD");
  assert.equal(a.level, "dead");
  assert.match(a.note, /re-stamped 2026-09-23 23:10Z by read-engine — that is when the job ran, not when these words changed/);
});

test("the verdict is dated by the composite it was written from", () => {
  const a = api("COMPOSITE BASIS", COMPOSITE_AAPL, RESTAMP, NOW);
  assert.equal(a.text, "COMPOSITE BASIS · AS OF 2026-08-24 · 30D OLD");
  assert.equal(a.level, "dead", "364 of 386 tf=D rows are frozen at this date");
});

test("a date that cannot be proved says so — it never reads as current", () => {
  for (const missing of [null, undefined, "", 0]) {
    const a = api("DOSSIER", missing, RESTAMP, NOW);
    assert.equal(a.text, "DOSSIER · SOURCE DATE NOT RECORDED");
    assert.equal(a.level, "unknown");
    assert.equal(a.days, null);
  }
});

test("the ladder: today is quiet, two days is old, a month is dead", () => {
  const day = 86400e3;
  assert.equal(api("DOSSIER", NOW / 1000, null, NOW).level, "fresh");
  assert.equal(api("DOSSIER", (NOW - day) / 1000, null, NOW).level, "fresh");
  assert.equal(api("DOSSIER", (NOW - 2 * day) / 1000, null, NOW).level, "old");
  assert.equal(api("DOSSIER", (NOW - 29 * day) / 1000, null, NOW).level, "old");
  assert.equal(api("DOSSIER", (NOW - 30 * day) / 1000, null, NOW).level, "dead");
  assert.equal(api("DOSSIER", NOW / 1000, null, NOW).text, "DOSSIER · AS OF 2026-09-23 · TODAY");
});

test("the dossier's own write date is fetched, and each tab carries the date of its own source", () => {
  assert.match(page, /ticker_context\?ticker=eq\." \+ e \+ "&select=ticker,narrative,business_now,catalysts,watch_notes,enriched_ts,updated_ts&limit=1/,
    "enriched_ts is what dossier-refresh writes; read_blocks.updated_ts cannot date these words");
  assert.match(page, /const dossierAt = cx \? \(cx\.enriched_ts != null \? cx\.enriched_ts : cx\.updated_ts\) : null;/);
  for (const tab of ["BUSINESS", "CATALYSTS", "WATCH"])
    assert.match(page, new RegExp(tab + ': readSectionAge\\("DOSSIER", dossierAt, rbAt\\.' + tab.toLowerCase() + "\\)"));
  assert.match(page, /VERDICT: rb\.verdict != null\n      \? readSectionAge\("COMPOSITE BASIS", \(d && \(d\.legacyAsOf != null \? d\.legacyAsOf : d\.asOf\)\), rbAt\.verdict\)/);
});

test("the age is drawn on the face of the words, and nowhere claims a date it does not have", () => {
  assert.match(page, /\? readAgeHTML\(age\) \+ paras\.map/, "the chip sits above the paragraphs it dates");
  assert.match(page, /\.readage\.dead\{ color:var\(--bear\)/, "a month-old section is marked, not merely noted");
  assert.match(page, /\.readage\.unknown\{ color:var\(--bear\)/, "an unprovable date is treated as badly as a dead one");
  const txt = page.match(/function readTxtHTML\(data\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(txt, /paras\.length\n    \? readAgeHTML\(age\)/, "the chip rides the words…");
  assert.doesNotMatch(txt.split("Desk narrative auto-generates")[1] || "", /readAgeHTML/, "…and no words means no date claim");
  const basis = page.match(/const basis = rb\.basis \? String\(rb\.basis\)[\s\S]*?\);\n/)[0];
  assert.match(basis, /read-engine re-stamps the stored block on every run/);
  assert.doesNotMatch(basis, /re-stamps it every 10 minutes/, "the composite is frozen, not re-stamped — measured 2026-09-23");
});
