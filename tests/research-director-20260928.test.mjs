/* RESEARCH-DIRECTOR (28 Sep): the delivered page, its saved charts, its numbers file, the ten proposals, and the ways in. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/research-director");
const PAGE = readFileSync(join(DIR, "RESEARCH-DIRECTOR.html"), "utf8");
const J = (f) => JSON.parse(readFileSync(join(DIR, "data", f), "utf8"));

test("the page carries the way back, the status line and the four parts the common brief asks for", () => {
  assert.match(PAGE, /<!-- scnav · /);
  assert.match(PAGE, /STATUS/);
  for (const h of ["What the page shows", "Where each number comes from", "What could be wrong", "What was not done"]) assert.ok(PAGE.includes(h), `page lacks "${h}"`);
});

test("every chart on the page is a saved image next to it, and every saved chart is on the page", () => {
  const srcs = [...PAGE.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length >= 12, `only ${srcs.length} charts`);
  for (const s of srcs) assert.ok(existsSync(join(DIR, s)), `missing chart file ${s}`);
  for (const f of ["a1-gspc-stress-shade.png", "a2-stress-last3y.png", "a3-state-return-densities.png", "a4-vol-changepoints.png", "a5-three-state-stack.png",
    "b1-sector-changepoints.png", "b2-fresh-change-forward.png", "b3-rrg-cohorts.png", "b4-rrg-sectors.png",
    "c1-spa-by-family.png", "c2-rung-curve-luck-band.png", "c3-walk-forward.png"]) assert.ok(srcs.includes("charts/" + f), `${f} not on the page`);
});

test("the page stays monochrome apart from the up/down pair", () => {
  for (const [, hex] of PAGE.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = hex.toUpperCase(); if (h === "00FFA3" || h === "FF2D55") continue;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `#${hex} is not an allowed grey`);
  }
});

test("ten proposals, each with a named public source that has a link, a question, data we hold, value and cost; the first three ran", () => {
  const P = J("proposals.json");
  assert.equal(P.studies.length, 10);
  for (const s of P.studies) {
    for (const k of ["title", "question", "method", "data", "value", "cost"]) assert.ok(s[k] && s[k].length > (k === "cost" ? 5 : 20), `study ${s.n} lacks ${k}`);
    assert.ok(s.inspired_by.length >= 1 && s.inspired_by.every((i) => /^https:\/\//.test(i.url) && i.name), `study ${s.n} lacks a linked source`);
    assert.ok(PAGE.includes(s.title), `study ${s.n} not on the page`);
  }
  assert.deepEqual(P.studies.filter((s) => s.ran_today).map((s) => s.n), [1, 2, 3]);
});

test("the numbers the page quotes exist in the saved results, and today's regime probabilities sum to one", () => {
  const A = J("study-a-regime.json");
  for (const k of ["A0_gspc_returns_only_1928", "A_gspc_vix_1990", "B_spy_breadth_vixcurve_2006"]) assert.ok(A.models[k], `model ${k} missing`);
  const t = A.models.A_gspc_vix_1990.k2.today;
  for (const w of [t.filtered_full_fit, t.filtered_walk_forward]) assert.ok(Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) < 0.01);
  assert.equal(t.date, "2026-09-25");
  const B = J("study-b-rotation.json");
  assert.equal(Object.keys(B.changepoints.bic).length, 11);
  assert.ok(B.rrg.cohorts.table.length >= 18 && B.rrg.sectors.table.length === 11);
  for (const r of B.rrg.cohorts.table) assert.ok(["LEADING", "WEAKENING", "LAGGING", "IMPROVING"].includes(r.quadrant));
  const C = J("study-c-spa.json");
  for (const k of ["SPY", "GSPC", "QQQ", "IWM", "DIA"]) {
    const u = C.results[k].union; assert.ok(u.spa_p_consistent >= 0 && u.spa_p_consistent <= 1 && u.n_rules > 100, `${k} union`);
    assert.equal(C.results[k].rung_curve_hold20.excess_pts_per_year.length, 100);
  }
  assert.ok(C.results.GSPC.families["F5 calendar months (24)"], "the calendar family ran on the 1928 record");
});

test("provenance names every input file with its hash and bar count, and the bars end at the 25 Sep close", () => {
  for (const f of ["provenance-a.json", "provenance-b.json", "provenance-c.json"]) {
    const P = J(f);
    for (const [k, v] of Object.entries(P)) { assert.match(v.sha256_12, /^[0-9a-f]{12}$/, `${f} ${k}`); assert.ok(v.bars > 200); assert.equal(v.to, "2026-09-25", `${f} ${k} ends ${v.to}`); }
  }
});

test("the studies index and the workshop open this page", () => {
  const idx = readFileSync(join(ROOT, "deliverables/20260928/studies-index/STUDIES.html"), "utf8");
  assert.ok(idx.includes("/deliverables/20260928/research-director/RESEARCH-DIRECTOR.html"));
  const M = JSON.parse(readFileSync(join(ROOT, "workshop/manifest.json"), "utf8"));
  assert.ok(M.items.some((i) => i.href === "/deliverables/20260928/research-director/RESEARCH-DIRECTOR.html" && i.status !== "archive"));
});
