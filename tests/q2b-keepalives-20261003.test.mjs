// Q2b (3 Oct 2026): the staged keep-awake fixes, the job register and the status page.
// Nothing here may go live without Alan: every staged SQL file says NOT APPLIED and has a rollback twin; no key,
// bearer or ntfy topic is ever written into these files; the register and the page agree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const MIG = join(root, "supabase/migrations");
const DIR = join(root, "deliverables/20261003/q2b-jobs");
const staged = readdirSync(MIG).filter(f => /^20261003_q2b_STAGED_[A-Z]_.*\.sql$/.test(f) && !f.endsWith("_ROLLBACK.sql"));

test("every staged file says NOT APPLIED and has a rollback twin", () => {
  assert.deepEqual(staged.map(f => f.match(/STAGED_([A-Z])_/)[1]).sort(), ["A", "B", "C", "D", "E"]);
  for (const f of staged) {
    const src = readFileSync(join(MIG, f), "utf8");
    assert.match(src, /STATUS: NOT APPLIED/, f);
    const rb = f.replace(/\.sql$/, "_ROLLBACK.sql");
    assert.ok(readdirSync(MIG).includes(rb), `${f} has ${rb}`);
  }
});

test("no credential, bearer or ntfy topic in any Q2b file", () => {
  const files = [...staged, ...staged.map(f => f.replace(/\.sql$/, "_ROLLBACK.sql"))].map(f => join(MIG, f));
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  files.push(...walk(DIR).filter(f => /\.(json|html|py|mjs|sql)$/.test(f)), join(root, "deliverables/20261003/status/index.html"));
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, `${f}: a JWT`);
    assert.doesNotMatch(s, /sb_secret_[A-Za-z0-9]|scin-tvkey-[0-9a-f]{4}/, `${f}: a key`);
    assert.doesNotMatch(s, /ntfy\.sh\/[A-Za-z0-9_-]{6,}/, `${f}: an ntfy topic`);
  }
});

test("STAGED A registers a feed_contract row before any job: alarm (feed_alarm.feed is a foreign key)", () => {
  const a = readFileSync(join(MIG, "20261003_q2b_STAGED_A_heartbeat_alarms_on.sql"), "utf8");
  const i = a.indexOf("insert into public.feed_contract"), j = a.indexOf("insert into public.feed_alarm");
  assert.ok(i > 0 && j > i, "contract first, alarm second");
  assert.match(a.slice(i, j), /'job_heartbeat', 'last_ok_at'[\s\S]*null, '', false, false/, "disabled for the old watchdog, no auto repair");
});

test("STAGED D never prints or moves a command out of the database, and refuses one that does not plan", () => {
  const d = readFileSync(join(MIG, "20261003_q2b_STAGED_D_record_real_http_answers.sql"), "utf8");
  assert.match(d, /scin_archive\.q2b_cron_command_backup_20261003/);
  assert.match(d, /execute 'explain ' \|\| newcmd;/);
  assert.doesNotMatch(d, /raise notice[^;]*newcmd/i);
});

test("the register counts agree with its rows, and the report and status page are built from it", () => {
  const reg = JSON.parse(readFileSync(join(DIR, "jobs.json"), "utf8"));
  assert.equal(reg.counts.jobs, reg.jobs.length);
  assert.equal(Object.values(reg.counts.verdicts).reduce((a, b) => a + b, 0), reg.jobs.length);
  for (const j of reg.jobs) assert.ok(["KEEP", "CHANGE", "REPLACE", "REMOVE"].includes(j.verdict), j.job);
  const report = readFileSync(join(DIR, "Q2B-JOBS.html"), "utf8");
  assert.ok(report.includes(`<b>${reg.counts.jobs}</b> things`));
  for (const j of reg.counts.late_or_failing_now) assert.ok(report.includes(j), `report lists ${j}`);
  const page = readFileSync(join(root, "deliverables/20261003/status/index.html"), "utf8");
  const snap = JSON.parse(page.match(/<script id="snapshot" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(snap.broken.length, snap.parts.flatMap(p => p.items).filter(i => i.state === "red").length);
  for (const p of [report, page]) { assert.match(p, /class="scnav|scnav-css/); assert.match(p, /sc-pagespecs/); }
});
