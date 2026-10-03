/* U4b (3 Oct 2026) · the admission audit, SK Hynix's dry run and the facts table hold together. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const D = "deliverables/20261003/u4b-facts/";
const J = (p) => JSON.parse(readFileSync(D + p, "utf8"));

test("the audit covers every name admitted since 24 Sep, nine checks each, and its counts add up", () => {
  const a = J("audit.json"), g = J("data/admission-groups-20261003.json");
  const admitted = new Set(g.batches.flatMap((b) => b.symbols));
  assert.equal(a.rows.length, admitted.size);
  assert.equal(a.rows.length, 226);
  for (const r of a.rows) { assert.ok(admitted.has(r.ticker)); assert.equal(Object.keys(r.checks).length, 9); for (const c of Object.values(r.checks)) assert.match(c.v, /^(GREEN|AMBER|RED)$/); }
  const reds = a.rows.reduce((n, r) => n + Object.values(r.checks).filter((c) => c.v === "RED").length, 0);
  assert.equal(reds, a.counts.red_cells);
  assert.equal(reds, a.reds.length);
});

test("the facts table is 590 + U3's in + U3's off-Hub, one row per name, and carries no recommendation", () => {
  const f = J("facts.json"), u = J("data/universe-20261003.json");
  const s = JSON.parse(readFileSync("deliverables/20261002/served-set-v2/served-set-v2.json", "utf8"));
  const want = new Set([...u.symbols, ...s.in.map((r) => r.ticker), ...s.offhub.map((r) => r.ticker)]);
  assert.equal(f.rows.length, want.size);
  assert.equal(new Set(f.rows.map((r) => r.ticker)).size, f.rows.length);
  for (const r of f.rows) { assert.ok(want.has(r.ticker)); for (const k of Object.keys(r)) assert.doesNotMatch(k, /recommend|verdict|keep|remove|cut/i); }
});

test("SK Hynix's dry run: the ADS ratio, 591 names, and C5 reproduces nothing it should not", () => {
  const d = J("data/skhy-dryrun-20261003.json");
  assert.equal(d.currency.ads_per_share, 10);
  assert.equal(d.currency.filer_currency_row.reported_currency, "KRW");
  assert.equal(d.currency.filer_currency_row.listing_currency, "USD");
  assert.ok(d.c4.set.length > 0 && d.c5.set.length > 0);
  const page = readFileSync(D + "U4B-FACTS.html", "utf8");
  assert.match(page, /591 names · d9eef302/);
  assert.match(page, /sc-pagespecs/);
  assert.match(page, /BACK/);
});
