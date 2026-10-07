/* R2 — THE PUT/CALL LANDING REPORTS TO THE JOB HEARTBEAT (staged; nothing here is applied or deployed).
   IB Gateway was logged out Sun 4 Oct 04:39 ET -> Mon 5 Oct 20:37 ET. These tests pin the staged SQL, the
   ibkr-ingest change and the result of the dry run on a throw-away Postgres (staged/r2-ib-alarm/dryrun). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { HEARTBEAT_JOB, HEARTBEAT_MIN_GAP_MS, heartbeatDue, heartbeatArgs } from "../supabase/functions/ibkr-ingest/heartbeat.mjs";
import { ALLOWED_TABLES } from "../supabase/functions/ibkr-ingest/validate.mjs";

const rd = (f) => fs.readFileSync(new URL("../staged/r2-ib-alarm/" + f, import.meta.url), "utf8");
const fn = (f) => fs.readFileSync(new URL("../supabase/functions/ibkr-ingest/" + f, import.meta.url), "utf8");
const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

test("the ping names the row Q2b already registered, and carries no reading and no token", () => {
  assert.equal(HEARTBEAT_JOB, "mac:com.scintilla.ibkr-putcall");
  assert.deepEqual(heartbeatArgs(true, "OK", null), { p_job: HEARTBEAT_JOB, p_ok: true, p_cause: "OK", p_detail: null });
  const bad = heartbeatArgs(false, "WRITE_FAILED", "ibkr_option_volume: denied for Bearer abc.def.ghi eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.x");
  assert.equal(bad.p_ok, false);
  assert.doesNotMatch(bad.p_detail, /abc\.def\.ghi|eyJhbGci/);
  assert.ok(heartbeatArgs(false, "X", "y".repeat(5000)).p_detail.length <= 300);
});

test("a success is pinged at most once a minute per instance; a failure always is", () => {
  assert.equal(heartbeatDue(0, 1_000_000, true), true, "the first landing pings");
  assert.equal(heartbeatDue(1_000_000, 1_000_000 + HEARTBEAT_MIN_GAP_MS - 1, true), false);
  assert.equal(heartbeatDue(1_000_000, 1_000_000 + HEARTBEAT_MIN_GAP_MS, true), true);
  assert.equal(heartbeatDue(1_000_000, 1_000_001, false), true);
});

test("the landing function is the deployed one plus the ping, and the ping can never fail a landing", () => {
  const live = rd("ibkr-ingest.DEPLOYED-20261005/index.ts"), next = fn("index.ts");
  assert.equal(rd("ibkr-ingest.DEPLOYED-20261005/validate.mjs"), fn("validate.mjs"), "what the door accepts is unchanged");
  assert.deepEqual(Object.values(ALLOWED_TABLES), ["ibkr_option_volume", "ibkr_putcall_minute"]);
  const strip = (s) => s.replace(/\s+/g, " ");
  for (const keep of ['if (req.method !== "POST") return json({ error: "POST_ONLY" }, 405);', "tokenAccepted(req.headers.get(\"authorization\"), Deno.env.get(\"IBKR_INGEST_TOKEN\"))",
    "upsert(rows, { onConflict, ignoreDuplicates: true })", 'return json({ error: "TABLE_NOT_ALLOWED" }, 400);'])
    assert.ok(strip(live).includes(strip(keep)) && strip(next).includes(strip(keep)), keep);
  assert.match(next, /db\.rpc\("job_heartbeat_ping", heartbeatArgs\(ok, cause, detail\)\)/);
  assert.match(next, /catch \{ return "failed"; \}/, "a heartbeat error is an answer, never an exception");
  assert.match(next, /const heartbeat = await beat\(db, true, "OK", null\);\s*return json\(\{ accepted: rows\.length, rejected: parsed\.rejected, table, heartbeat \}\);/);
  assert.match(next, /beat\(db, false, "WRITE_FAILED"/);
  assert.equal((next.match(/\.from\(/g) || []).length, (live.match(/\.from\(/g) || []).length, "no new table is touched");
  assert.doesNotMatch(next, /\.(delete|update)\(/);
});

test("01 is additive columns plus the judge; rows without hours are judged by the live rule", () => {
  const sql = code(rd("01_job_heartbeat_hours.sql")), live = rd("current-bodies/job_heartbeat_judge.sql");
  assert.equal((sql.match(/add column if not exists hours_/g) || []).length, 4);
  assert.doesNotMatch(sql, /\b(drop|delete|truncate|rename)\b/i);
  assert.match(sql, /in_hours := true; opened := null;/);
  // everything outside the heartbeat branch is the live text, line for line
  const head = (s, stop) => s.slice(s.indexOf("for h in select"), s.indexOf(stop)).replace(/\s+/g, " ");
  assert.equal(head(sql, "in_hours := true; opened := null;"), head(live, "if not h.armed or"));
  const tail = (s) => s.slice(s.indexOf("if new_status is distinct from h.status"));
  assert.equal(tail(sql).replace(/\s+/g, " ").replace(/;\s*$/, ""), tail(live).replace(/\s+/g, " ").replace(/;\s*$/, ""));
  assert.ok(rd("01_job_heartbeat_hours_ROLLBACK.sql").includes(live), "the rollback carries the saved body byte for byte");
});

test("02 changes one row's terms, adds one read-only function for the watchman, and its rollback restores the terms read on 5 Oct", () => {
  const sql = code(rd("02_putcall_heartbeat_row.sql")), rb = code(rd("02_putcall_heartbeat_row_ROLLBACK.sql"));
  assert.equal((sql.match(/\bupdate public\.job_heartbeat\b/g) || []).length, 1);
  assert.match(sql, /where job = 'mac:com\.scintilla\.ibkr-putcall';/);
  assert.match(sql, /expected_every = interval '5 minutes', grace = interval '10 minutes', fail_after = 3/);
  assert.match(sql, /hours_dow = array\[1,2,3,4,5\], hours_from = time '09:30', hours_to = time '16:00'/);
  assert.doesNotMatch(sql, /\b(insert|delete|truncate|drop)\b/i);
  assert.match(sql, /grant execute on function public\.scin_putcall_night_line\(date\) to service_role, massive_writer;/);
  assert.match(sql, /revoke all on function public\.scin_putcall_night_line\(date\) from public, anon, authenticated;/);
  assert.match(rb, /expected_every = interval '10 minutes', grace = interval '10 minutes', fail_after = 1/);
  assert.match(rb, /drop function if exists public\.scin_putcall_night_line\(date\);/);
});

test("the dry run on a throw-away Postgres: no other job's verdict moves, and the 4-5 Oct outage would have read LATE at 09:45 ET", () => {
  const r = JSON.parse(rd("dryrun/r2-dryrun-result.json"));
  assert.equal(r.result, "ALL CHECKS PASSED");
  assert.equal(r.neighbours.differences, 0); assert.ok(r.neighbours.rows >= 150); assert.equal(r.neighbours.moments, 11);
  const by = Object.fromEntries(r.putcall_timeline.map((x) => [x.step, x.status]));
  assert.equal(by["Sun 4 Oct 18:00 ET, silent, weekend"], "UP");
  assert.equal(by["Mon 5 Oct 09:44 ET, silent, 14 min after the open"], "UP");
  assert.equal(by["Mon 5 Oct 09:45 ET, silent, 15 min after the open"], "LATE");
  assert.equal(by["Mon 5 Oct 16:05 ET, still silent after the close"], "LATE", "the close never sends a false back-to-normal");
  assert.equal(by["Tue 6 Oct 02:00 ET, IB nightly logout, silent"], "UP", "the nightly logout pages no one");
  assert.deepEqual(r.failing, { after_one_failed_landing: "UP", after_three: "FAILING", note: "last 3 run(s) failed: WRITE_FAILED" });
  assert.equal(r.rollback.judge_agrees_with_live_again, true);
});
