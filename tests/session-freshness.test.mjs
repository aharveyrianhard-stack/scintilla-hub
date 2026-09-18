import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runVectors } from "./session-freshness.vectors.mjs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const block = page.slice(page.indexOf("/* SESSION-FRESHNESS BEGIN"), page.indexOf("/* SESSION-FRESHNESS END */") + "/* SESSION-FRESHNESS END */".length);
test("daily indicator freshness is judged by the expected settled New York session, fail closed", () => {
  const c = vm.createContext({ Intl, Date, Number, String, isFinite });
  vm.runInContext(block + "\nthis.api = { gsDailySessionFreshness, gsExpectedSettledSession };", c);
  assert.equal(runVectors(c.api), true);
});
test("the Hub gates the board RSI cell and the company tile by session, not by fetched_at", () => {
  assert.doesNotMatch(page, /gsFreshIso|GS_PROVIDER_FRESH_MS|gsAgeDaysIso/);
  assert.match(page, /if \(gsSessionCurrent\(r\)\) m\[r\.ticker\] = num\(r\.value\);/);
  assert.match(page, /const providerRows = \(pind \|\| \[\]\)\.filter\(gsSessionCurrent\);/);
  assert.match(page, /why: gsSessionWhy\("RSI", anyRsi\)/);
  assert.match(page, /last reading ' \+ un\.sessions_behind \+ ' session'/);
  assert.match(page, /d\.indicatorSourceDate \? "current session" : null\]\.filter\(Boolean\)\.join\(" · "\)/);
  const c = vm.createContext({ Intl, Date, Number, String, isFinite, console });
  const helpers = page.match(/function gsSessionCurrent \(row\) \{[\s\S]*?const gsSessionsBehind = [^\n]*\n/)[0];
  vm.runInContext(block + "\n" + helpers + "\nthis.api = { gsSessionCurrent, gsSessionWhy, gsSessionsBehind };", c);
  const RealNow = Date.now; Date.now = () => Date.parse("2026-09-18T05:04:00Z");
  try {
    assert.equal(c.api.gsSessionCurrent({ source_date: "2026-09-17 00:00:00", session_state: "SETTLED", fetched_at: "2026-09-18T05:04:01Z" }), true, "Sep 17 settled is current at 01:04 ET Sep 18");
    assert.equal(c.api.gsSessionCurrent({ source_date: "2026-08-20 00:00:00", session_state: "FORMING", fetched_at: "2026-09-18T05:00:00Z" }), false, "a month-old value fetched minutes ago stays stale");
    assert.equal(c.api.gsSessionCurrent(null), false);
    assert.match(c.api.gsSessionWhy("RSI", { source_date: "2026-08-20 00:00:00", session_state: "FORMING" }), /FMP RSI reading of 2026-08-20 is 19 sessions behind the expected 2026-09-17 session/);
    assert.equal(c.api.gsSessionWhy("RSI", null), "no FMP RSI row for this symbol");
    assert.equal(c.api.gsSessionsBehind({ source_date: "2026-08-20", session_state: "FORMING" }), 19);
  } finally { Date.now = RealNow; }
});
