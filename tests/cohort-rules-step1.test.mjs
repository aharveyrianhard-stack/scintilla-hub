// COHORT RULES STEP 1 (28 Sep 2026): parents, merges and the five labels-to-filters, as one additive registry table.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const sql = read("supabase/migrations/20260928_cohort_rules_step1.sql");
const rollback = read("supabase/migrations/20260928_cohort_rules_step1_ROLLBACK.sql");
const reg = JSON.parse(read("data/cohort-registry-step1.json")).rows;
const proposal = JSON.parse(read("deliverables/20260928/tree-cohorts/proposed-cohorts.json"));

test("every one of the 36 cohort labels on the tree has exactly one registry row", () => {
  const labels = reg.map((r) => r.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const l of Object.keys(proposal.label_verdicts)) assert.ok(labels.includes(l), l);
  assert.equal(reg.length, 38);
});

test("every cohort has one parent; every merge points at a cohort; the five size/style labels are filters", () => {
  const by = Object.fromEntries(reg.map((r) => [r.label, r]));
  for (const r of reg) {
    if (r.kind === "cohort") assert.ok(r.parent, r.label);
    if (r.kind === "merged") assert.equal(by[r.merged_into]?.kind, "cohort", r.label);
  }
  assert.deepEqual(reg.filter((r) => r.kind === "filter").map((r) => r.label).sort(), ["BLUE_CHIP", "LARGE_CAP", "MEGA_CAP", "MID_CAP", "SMALL_CAP"]);
  assert.equal(by.PRECIOUS_METALS.merged_into, "METALS");
  assert.equal(by.AI_POWERTRAIN.merged_into, "AI_POWER");
  assert.equal(by.MEMORY_STORAGE.merged_into, "MEMORY_SEMICAP");
  assert.equal(by.SEMI_EQUIPMENT.merged_into, "MEMORY_SEMICAP");
});

test("step 1 moves no name: the migration never writes membership, tickers or favourites", () => {
  assert.doesNotMatch(sql, /\b(insert into|update|delete from|truncate)\s+public\.(ticker_membership|tickers|hub_favorites)/i);
  assert.doesNotMatch(sql, /\bdrop\b(?!\s+policy if exists cohort_registry_read)/i);
  assert.match(sql, /create table if not exists public\.cohort_registry/);
  assert.match(sql, /if n <> 38 then raise exception/);
});

test("the rollback drops the new table and nothing else", () => {
  const stmts = rollback.split("\n").filter((l) => l.trim() && !l.startsWith("--"));
  assert.deepEqual(stmts, ["drop table if exists public.cohort_registry;"]);
});
