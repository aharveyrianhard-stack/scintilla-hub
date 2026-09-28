// T2-MAP-WORKSHOP · the workshop page draws itself from ONE manifest, so it cannot go stale by hand:
// the manifest is sound (areas, statuses, dates, links that exist), the page reads it and carries a plain-list fallback,
// and the add script accepts a good leaf and refuses a bad one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validate } from "../scripts/workshop-add.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const M = JSON.parse(readFileSync(join(ROOT, "workshop/manifest.json"), "utf8"));
const PAGE = readFileSync(join(ROOT, "workshop/index.html"), "utf8");

test("the manifest validates: unique ids, known areas and statuses, dated, every site link exists", () => {
  assert.deepEqual(validate(M), []);
  assert.ok(M.items.length >= 20, "the manifest carries the workshop's leaves");
});

test("the seven branches Alan named are there, in order", () => {
  assert.deepEqual(M.areas.map((a) => a.id), ["comps", "allocation", "statistics", "station", "hub", "geiger", "backend"]);
});

test("every branch has at least one leaf and every decision carries its question", () => {
  for (const a of M.areas) assert.ok(M.items.some((i) => i.area === a.id), `branch ${a.id} is empty`);
  for (const i of M.items.filter((i) => i.status === "decision")) assert.ok(i.ask && i.ask.length > 2, i.id);
});

test("the page has no hand-written cards: it fetches the manifest, and keeps a plain list fallback", () => {
  assert.match(PAGE, /fetch\("manifest\.json/);
  assert.ok(!/class="card" href=/.test(PAGE), "a hand-written card is back on the page");
  assert.match(PAGE, /<noscript>/);
  assert.match(PAGE, /id="list"/, "the plain list view is missing");
  assert.match(PAGE, /data-scnav-slot/);
  assert.match(PAGE, /<!-- scnav · /, "BACK / CLOSE pair missing (run scripts/inject-scnav.py)");
  const sizes = [...PAGE.matchAll(/font(?:-size)?:\s*(?:[^;}\n]*?\s)?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  for (const s of sizes) assert.ok(s >= 11, "text below 11px: " + s);
});

test("the add script refuses a bad leaf and accepts a good one", () => {
  const copy = JSON.parse(JSON.stringify(M));
  copy.items.push({ id: "Bad Id", area: "nowhere", title: "", blurb: "", href: "/not/here.html", status: "shiny", date: "27 Sep" });
  const errs = validate(copy);
  for (const s of ["kebab-case", "unknown area", "unknown status", "lacks title", "date must be", "is not in this repo"]) assert.ok(errs.some((e) => e.includes(s)), "should complain: " + s);
  const good = JSON.parse(JSON.stringify(M));
  good.items.push({ id: "test-leaf", area: "hub", title: "A test leaf", blurb: "Only in this test.", href: "/workshop/", status: "read", date: "2026-09-27" });
  assert.deepEqual(validate(good), []);
});

test("a leaf that supersedes another names one that exists, and the superseded one is archived", () => {
  for (const i of M.items.filter((i) => i.supersedes)) {
    const old = M.items.find((o) => o.id === i.supersedes);
    assert.ok(old, i.id); assert.equal(old.status, "archive", `${old.id} is superseded by ${i.id} but not archived`);
  }
});
