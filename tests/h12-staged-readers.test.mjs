/* H12 — the staged fix for the two database functions that still read the frozen Geiger copy.
   Measured 5 Oct 2026: scin_rebuild_sector_rankings (cron 233) and recompute_cohort_divergence (cron 25)
   read composite_staged, whose 364 stock and fund rows were last written 24 Aug. These tests pin the
   staged SQL: the new bodies no longer read that table directly, every rollback is the body that was
   live, and nothing destructive can run by pasting a file. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const rd = (f) => fs.readFileSync(new URL("../staged/h12/" + f, import.meta.url), "utf8");
const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

test("the two new bodies read the newest-reading function, never composite_staged directly", () => {
  for (const f of ["03_scin_rebuild_sector_rankings.sql", "04_recompute_cohort_divergence.sql"]) {
    const sql = code(rd(f));
    assert.match(sql, /scin_geiger_latest_d\(\)/, f);
    assert.doesNotMatch(sql, /composite_staged/, f + " must not read the frozen table");
    assert.doesNotMatch(sql, /\bdelete\b|\bdrop\b|\btruncate\b/i, f + " deletes nothing");
  }
});

test("the newest-reading function takes the newer of the live history and the staged row, and holds nothing back", () => {
  const sql = code(rd("01_geiger_latest_d.sql"));
  assert.match(sql, /h\.source like 'CHART_API_GEIGER%'/);
  assert.match(sql, /from composite_staged c/);
  assert.match(sql, /order by u\.ticker, u\.as_of desc nulls last/);
  assert.doesNotMatch(sql, /interval|current_date|now\(\)/, "no age cut-off: an old reading is returned with its age, not dropped");
});

test("each rollback is the body that was live on 5 Oct, byte for byte", () => {
  for (const n of ["scin_rebuild_sector_rankings", "recompute_cohort_divergence"]) {
    const live = rd("current-bodies/" + n + ".sql");
    const rb = rd((n.startsWith("scin") ? "03_" : "04_") + n + "_ROLLBACK.sql");
    assert.ok(rb.includes(live), n + " rollback carries the saved body");
    assert.match(live, /composite_staged/);
  }
});

test("the age columns are additive and the sector formula, members and key are unchanged", () => {
  assert.doesNotMatch(code(rd("02_age_columns.sql")).replace(/add column if not exists/g, ""), /\b(drop|update|delete|rename|alter column)\b/i);
  const neu = code(rd("03_scin_rebuild_sector_rankings.sql")), old = rd("current-bodies/scin_rebuild_sector_rankings.sql");
  for (const same of ["avg(0.5 * c.trend + 0.5 * c.momentum) score", "having count(*) >= 3", "on conflict (date, sector) do update",
    "join ticker_membership m on m.group_key = s.group_key and m.kind = s.kind"]) { assert.ok(old.includes(same)); assert.ok(neu.includes(same), same); }
});

test("the retirement proposal runs nothing when pasted", () => {
  assert.equal(code(rd("90_RETIRE_PROPOSAL_waits_for_alan.sql")).trim(), "");
});

test("the dry run on a throw-away Postgres recorded its result", () => {
  const r = JSON.parse(rd("dryrun/h12-dryrun-result.json"));
  assert.equal(r.before_first_live_evening.same_numbers_as_today, true);
  assert.equal(r.new_sectors.length, 13);
  assert.ok(r.new_sectors.every((s) => s.n_old === 0));
  assert.match(r.rollback, /restored/);
});
