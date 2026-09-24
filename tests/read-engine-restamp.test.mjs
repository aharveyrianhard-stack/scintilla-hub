/* M37 — READ-ENGINE: A ROW'S DATE IS THE DATE OF ITS WORDS.
   The deployed function (downloaded 2026-09-24, sha256 7a5ac872…66e4) upserted every row with
   updated_ts:now on every 10-minute run, so a body unchanged since June read as minutes old.
   These tests run the candidate's OWN write tail — extracted from the candidate source, not a
   copy of it — against the shapes production actually produces. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const dir = new URL("../deliverables/20260924/verdict-live/read-engine/", import.meta.url);
const CURRENT = fs.readFileSync(new URL("index.CURRENT-DEPLOYED.ts", dir), "utf8");
const CANDIDATE = fs.readFileSync(new URL("index.CANDIDATE.ts", dir), "utf8");

/* the candidate's write tail, lifted verbatim and given the same inputs the handler gives it */
function writeTail(rows, prev, errs = {}) {
  const src = CANDIDATE.slice(CANDIDATE.indexOf("  const PREVBODY=new Map"),
                              CANDIDATE.indexOf("  for(const ch of chunks){"));
  const js = stripTypeScriptTypes(src, { mode: "strip" });
  const fn = new Function("prevV", "prevB", "prevD", "rows",
    js + "\n  return { changed, unchanged, chunks, compared: prevReadOk };");
  const d = (section) => ({ data: prev.filter((r) => r.section === section), error: errs[section] || null });
  return fn(d("verdict"), d("basis"), { data: prev.filter((r) => ["business", "catalysts", "watch"].includes(r.section)), error: errs.dossier || null }, rows);
}

const PREV = [
  { ticker: "AAPL", section: "verdict",   body: "AAPL sits in a firm uptrend — the Geiger composite reads strongly bullish at +0.50." },
  { ticker: "AAPL", section: "basis",     body: "Geiger: provider artifact computed 2026-09-24T01:18:06.980Z (current)." },
  { ticker: "AAPL", section: "business",  body: "Designs iPhone, Mac, wearables + high-margin Services." },
  { ticker: "AAPL", section: "catalysts", body: "iPhone 17 supercycle demand." },
];

test("a body that did not change is not written, so it keeps the date its words changed", () => {
  const rows = [
    { ticker: "AAPL", section: "verdict",   body: "AAPL sits in a firm uptrend — the Geiger composite reads strongly bullish at +0.52.", updated_ts: "NOW" },
    { ticker: "AAPL", section: "basis",     body: "Geiger: provider artifact computed 2026-09-24T01:28:06.980Z (current).", updated_ts: "NOW" },
    { ticker: "AAPL", section: "business",  body: "Designs iPhone, Mac, wearables + high-margin Services.", updated_ts: "NOW" },
    { ticker: "AAPL", section: "catalysts", body: "iPhone 17 supercycle demand.", updated_ts: "NOW" },
  ];
  const r = writeTail(rows, PREV);
  assert.deepEqual(r.changed.map((x) => x.section), ["verdict", "basis"], "the two that moved");
  assert.equal(r.unchanged, 2, "the June dossier sections are left alone");
  assert.equal(r.compared, true);
});

test("a section with no stored row is always written", () => {
  const rows = [{ ticker: "NVDA", section: "watch", body: "Gaming is a rounding error.", updated_ts: "NOW" }];
  const r = writeTail(rows, PREV);
  assert.equal(r.changed.length, 1);
  assert.equal(r.unchanged, 0);
});

test("when nothing at all changed, nothing is written and the run says so", () => {
  const rows = PREV.map((p) => ({ ...p, updated_ts: "NOW" }));
  const r = writeTail(rows, PREV);
  assert.equal(r.changed.length, 0);
  assert.equal(r.unchanged, 4);
  assert.equal(r.chunks.filter((c) => c.length).length, 0, "no upsert is issued");
});

test("a failed read of the previous bodies writes everything, exactly as before", () => {
  const rows = PREV.map((p) => ({ ...p, updated_ts: "NOW" }));
  const r = writeTail(rows, PREV, { dossier: { message: "boom" } });
  assert.equal(r.compared, false);
  assert.equal(r.changed.length, 4, "an unreadable comparison is never read as 'nothing changed'");
});

test("a ticker's rows still travel together in one chunk", () => {
  const rows = [];
  for (let i = 0; i < 300; i++) for (const section of ["verdict", "basis"])
    rows.push({ ticker: "T" + String(i).padStart(3, "0"), section, body: "b" + i + section, updated_ts: "NOW" });
  const r = writeTail(rows, []);
  assert.equal(r.changed.length, 600);
  for (const ch of r.chunks) assert.ok(ch.length <= 401, "chunk stays at the 400-row budget");
  for (const t of new Set(rows.map((x) => x.ticker)))
    assert.equal(r.chunks.filter((c) => c.some((x) => x.ticker === t)).length, 1, t + " is never split across chunks");
});

test("the candidate is valid TypeScript-stripped JavaScript, and differs from the deployed source only in the restamp", () => {
  const js = stripTypeScriptTypes(CANDIDATE, { mode: "strip" });
  const f = path.join(os.tmpdir(), "read-engine-candidate-check.mjs");
  fs.writeFileSync(f, js);
  execFileSync(process.execPath, ["--check", f]);          // throws if the candidate does not parse
  fs.unlinkSync(f);
  /* the change is small and surgical: it removes seven lines, each of which is one of the five
     places the restamp touches, and adds their replacements. Nothing else in the function moves. */
  const patch = fs.readFileSync(new URL("read-engine-restamp.patch", dir), "utf8");
  const removed = patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
  assert.equal(removed.length, 7);
  const allowed = [/^-async function pageAll\(/, /^-    let q=sb\.from\(table\)/,
    /^-  const \[comp,reg,mtf,st,coh,tc,rib,prevV,prevB,G\]/, /^-  for\(const \[k,r\] of Object\.entries\(/,
    /^-  \/\/ a ticker's rows travel together/, /^-  const chunks:any\[\]\[\]=\[\[\]\];/,
    /^-  return new Response\(JSON\.stringify\(\{blocks:rows\.length,err:e/];
  for (const line of removed)
    assert.ok(allowed.some((re) => re.test(line)), "unexpected removal: " + line.slice(0, 80));
  assert.equal(CURRENT.split("\n").length + 19, CANDIDATE.split("\n").length, "19 lines added, all of them the change");
  assert.match(CANDIDATE, /const changed=prevReadOk\?rows\.filter\(r=>PREVBODY\.get\(r\.ticker\+'::'\+r\.section\)!==r\.body\):rows/);
  assert.match(CANDIDATE, /written:changed\.length,unchanged,compared:prevReadOk/);
});

test("the rollback is the exact source that is deployed today", () => {
  assert.match(CURRENT, /v13 2026-09-18/, "the deployed version marker");
  assert.doesNotMatch(CURRENT, /PREVBODY/, "the rollback contains none of the change");
  assert.ok(fs.existsSync(new URL("read-engine-restamp.patch", dir)), "the patch between the two is saved beside them");
});
