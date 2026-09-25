import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeS6Fixture } from "./fixtures/s6-fixture.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("S6 build: the export is filtered to reports that happened, and the output is complete and labelled", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "s6-"));
  const fx = makeS6Fixture(dir);
  const out = path.join(dir, "runup.json");
  const before = fs.readFileSync(path.join(root, "research/statistics/data/summary.json"));
  execFileSync(process.execPath, [path.join(root, "research/statistics/build.mjs"), "--cache", fx.cache, "--earnings", fx.earnings,
    "--s6-only", "--fixture", "--out", out, "--targets", fx.targets.join(","), "--funds", fx.funds.join(",")], { stdio: "pipe" });
  assert.deepEqual(fs.readFileSync(path.join(root, "research/statistics/data/summary.json")), before, "--s6-only never rewrites summary.json");
  const j = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(j.fixture, true);
  assert.match(j.reports.rule, /eps_actual, superseded_at/);
  const rows = fs.readFileSync(fx.earnings, "utf8").trim().split("\n").length - 1;
  assert.equal(j.reports.rows, rows);
  const reporting = JSON.parse(fs.readFileSync(path.join(dir, "universe.json"), "utf8")).symbols.filter((s) => !s.startsWith("FUND")).length;
  assert.equal(j.reports.happened, rows - 2 * reporting, "each reporting name loses its no-actual and its superseded row");
  const t1 = j.symbols.TEST1;
  assert.ok(t1.excluded.some((e) => /before this name's own history/.test(e.reason)));
  assert.ok(!t1.events.some((e) => e.date === "2019-06-01"));
  assert.equal(j.symbols.TEST8.enough, false);
  assert.equal(j.pooled.universe.names, Object.values(j.symbols).filter((v) => v.enough).length);
  assert.equal(j.pooled.universe.reports, Object.values(j.symbols).filter((v) => v.enough).reduce((s, v) => s + v.reports_used, 0));
  assert.ok(!Object.keys(j.symbols).includes("TEST8") || j.symbols.TEST8.reports_used < 8);
  assert.equal(j.table.length, 10);
  const fund = j.table.find((r) => r.name === "FUNDA");
  assert.equal(fund.kind, "fund"); assert.equal(fund.windows_asked, j.pooled.universe.reports);
  assert.equal(fund.windows_matched, j.pooled.universe.reports, "the fund holds every session the fixture names hold");
  assert.equal(j.pooled.universe.summary.runup.pct.n, j.pooled.universe.reports);
  assert.ok(j.pooled.universe.any20.sd.n > j.pooled.universe.reports, "the any-20-sessions baseline is its own, larger sample");
  fs.rmSync(dir, { recursive: true, force: true });
});
