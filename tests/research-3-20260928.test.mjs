/* P5-RESEARCH-3 (28 Sep): the evening questions answered like a statistician. Pins the page, its data and the Geiger port. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/research-3");
const PAGE = readFileSync(join(DIR, "RESEARCH-3.html"), "utf8");
const J = (n) => JSON.parse(readFileSync(join(DIR, "data", n), "utf8"));

test("the page exists, carries the way back, and answers all six questions with saved charts", () => {
  assert.match(PAGE, /<!-- scnav · /);
  for (const id of ["q1", "q2", "q3", "q4", "q5", "q6", "followups", "notdone"]) assert.ok(PAGE.includes(`id="${id}"`), `missing section ${id}`);
  const imgs = [...PAGE.matchAll(/src="(charts\/[^"]+\.png)"/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 18, `only ${imgs.length} charts`);
  for (const i of imgs) assert.ok(existsSync(join(DIR, i)), `chart missing on disk: ${i}`);
});

test("the Geiger port equals the live publisher for SPY at the 28 Sep close (all seven rungs, Alan's Equalizer)", () => {
  const q2 = J("q2-geiger.json");
  const last = q2.today_path[q2.today_path.length - 1];
  assert.equal(Math.round(last.composite * 1e6) / 1e6, 0.294986);          // /geiger at 2026-09-28T23:00Z
  assert.equal(Math.round(last.rungs["3h"] * 1e6) / 1e6, -0.323301);
  assert.equal(Math.round(last.rungs["1w"] * 1e6) / 1e6, 0.832235);
  assert.deepEqual(Object.keys(q2.weights).sort(), ["12h", "1d", "1w", "3d", "3h", "4h", "6h"]);
  assert.ok(q2.intraday_weight_share > 0.4 && q2.intraday_weight_share < 0.41);
});

test("every conditional number on the page sits next to its base rate and a range, and the cells tried are counted", () => {
  const q3 = J("q3-short.json");
  assert.equal(q3.rules.tests, q3.rules.grid.length * 2);
  for (const row of q3.rules.grid) for (const h of ["f5", "f21"]) { assert.ok("base_median" in row[h]); assert.ok("lo" in row[h] && "hi" in row[h]); assert.ok("bh_pass" in row[h]); }
  const q1 = J("q1-regime.json");
  assert.ok(q1.pairs.length >= 14);
  for (const p of q1.pairs) assert.ok(p.pctile >= 0 && p.pctile <= 100);
  const q6 = J("q6-public.json");
  for (const r of q6.harvey_liu.rows) if (r.hl) assert.ok(r.hl.bonferroni.p_adj >= r.hl.p - 1e-12, `${r.rule}: adjusted p below raw p`);
  for (const r of q6.harvey_liu.rows) if (r.hl && r.hl.holm) assert.ok(r.hl.holm.p_adj >= r.hl.p - 1e-12, `${r.rule}: Holm below raw p`);
});

test("the page keeps the estate's colour rule: greys, plus green/red only for up and down", () => {
  const allowed = new Set(["00ffa3", "ff2d55"]);
  for (const [, hex] of PAGE.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    if (allowed.has(hex.toLowerCase())) continue;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `#${hex} is not an allowed grey`);
  }
});
