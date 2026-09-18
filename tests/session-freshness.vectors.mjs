// Shared vectors for the session-freshness rule (run against the Hub copy and the Station copy).
import assert from "node:assert/strict";
export function runVectors(api) {
  const at = (s) => Date.parse(s);
  const F = (sd, st, now) => api.gsDailySessionFreshness(sd, st, at(now));
  // Fri 2026-09-18 01:04 ET (05:04Z): the expected settled session is Thu Sep 17.
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T05:04:00Z")), "2026-09-17");
  let r = F("2026-09-17 00:00:00", "SETTLED", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, false); assert.equal(r.current, true); assert.equal(r.sessionsBehind, 0); assert.equal(r.settled, true); assert.equal(r.reason, "expected session");
  r = F("2026-09-16", "SETTLED", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, true); assert.equal(r.sessionsBehind, 1); assert.match(r.reason, /1 session behind the expected 2026-09-17 session/);
  // recently fetched old value stays stale: fetched_at is not an input at all
  assert.equal(api.gsDailySessionFreshness.length, 3);
  // Aug 20 FORMING seen on Sep 18: 19 sessions behind (Labor Day Sep 7 skipped), never settled
  r = F("2026-08-20 00:00:00", "FORMING", "2026-09-18T05:04:00Z");
  assert.equal(r.stale, true); assert.equal(r.sessionsBehind, 19); assert.equal(r.settled, false);
  // the settlement window: Thu Sep 17 at 19:59 ET still expects Wed Sep 16; at 20:00 ET it expects Thu Sep 17
  assert.equal(api.gsExpectedSettledSession(at("2026-09-17T23:59:00Z")), "2026-09-16");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T00:00:00Z")), "2026-09-17");
  assert.equal(F("2026-09-16", "SETTLED", "2026-09-17T23:59:00Z").stale, false, "one session back is current until the newer one is expected");
  assert.equal(F("2026-09-16", "SETTLED", "2026-09-18T00:00:00Z").stale, true, "and stale the minute the newer session is expected");
  // today's forming session during market hours is current but not settled
  r = F("2026-09-18", "FORMING", "2026-09-18T15:00:00Z");
  assert.equal(r.stale, false); assert.equal(r.settled, false); assert.match(r.reason, /today's session, forming/);
  // ET midnight boundary: 00:30 ET Sep 18 expects Sep 17; 23:30 ET Sep 17 (03:30Z Sep 18) also expects Sep 17
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T04:30:00Z")), "2026-09-17");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-18T03:30:00Z")), "2026-09-17");
  // weekend: Sat Sep 19 10:00 ET and Sun Sep 20 both expect Fri Sep 18; Mon Sep 21 08:00 ET still expects Fri
  assert.equal(api.gsExpectedSettledSession(at("2026-09-19T14:00:00Z")), "2026-09-18");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-20T14:00:00Z")), "2026-09-18");
  assert.equal(api.gsExpectedSettledSession(at("2026-09-21T12:00:00Z")), "2026-09-18");
  assert.equal(F("2026-09-18", "SETTLED", "2026-09-20T14:00:00Z").stale, false, "Friday's close is current all weekend");
  assert.equal(F("2026-09-17", "SETTLED", "2026-09-20T14:00:00Z").sessionsBehind, 1, "Thursday's close is one session behind on Sunday");
  // Mon Sep 21 20:01 ET expects Mon Sep 21; Friday's close is then stale by one session
  assert.equal(F("2026-09-18", "SETTLED", "2026-09-22T00:01:00Z").stale, true);
  // Labor Day: Mon 2026-09-07 21:00 ET expects Fri Sep 4
  assert.equal(api.gsExpectedSettledSession(at("2026-09-08T01:00:00Z")), "2026-09-04");
  assert.equal(F("2026-09-04", "SETTLED", "2026-09-08T01:00:00Z").stale, false, "Friday's close is current through the holiday Monday");
  // fail closed: missing, unparseable, weekend-dated and future-dated sessions are STALE and say why
  for (const bad of [null, "", "not a date", "2026-13-40"]) { r = F(bad, "SETTLED", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.equal(r.known, false); assert.equal(r.reason, "no session date"); }
  r = F("2026-09-19", "SETTLED", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.match(r.reason, /after today/);
  r = F("2026-09-13", "SETTLED", "2026-09-18T05:04:00Z"); assert.equal(r.stale, true); assert.match(r.reason, /not a trading session/);
  // a very old reading counts sessions, bounded (the holiday table starts at 2026, so 2025 holidays count as weekdays: 261 weekdays minus the 8 listed 2026 holidays)
  assert.equal(F("2025-09-17", "SETTLED", "2026-09-18T05:04:00Z").sessionsBehind, 253);
  // an unstated session state is reported, not assumed settled
  r = F("2026-09-17", null, "2026-09-18T05:04:00Z"); assert.equal(r.stale, false); assert.equal(r.settled, false); assert.equal(r.state, "UNSTATED");
  return true;
}
