import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* K3 — slice the pure plan and its two consts out of the page, exactly like
   hub-scintillation.test.mjs does for the glow. */
const s = page.search(/^function hubSelfUpdatePlan\b/m);
assert.ok(s >= 0, "hubSelfUpdatePlan is declared with `function` at column 0");
const src = page.match(/^const HUB_SELF_UPDATE_IDLE_MS = [^\n]*\n/m)[0] +
  page.match(/^const HUB_SELF_UPDATE_EVERY_MS = [^\n]*\n/m)[0] +
  page.slice(s, page.indexOf("\n}\n", s) + 3) +
  "return { hubSelfUpdatePlan, HUB_SELF_UPDATE_IDLE_MS, HUB_SELF_UPDATE_EVERY_MS };";
const { hubSelfUpdatePlan, HUB_SELF_UPDATE_IDLE_MS, HUB_SELF_UPDATE_EVERY_MS } = new Function(src)();

test("the thresholds are the agreed 2 minutes idle / 3 minute poll", () => {
  assert.equal(HUB_SELF_UPDATE_IDLE_MS, 120000);
  assert.equal(HUB_SELF_UPDATE_EVERY_MS, 180000);
});

test("same build is a no-op", () => {
  assert.deepEqual(hubSelfUpdatePlan("v1", "v1", 200000, false, false),
    { reload: false, adopt: false, reason: "same build" });
  assert.deepEqual(hubSelfUpdatePlan("v1", null, 200000, false, false),
    { reload: false, adopt: false, reason: "same build" }, "missing re-sample never reloads either");
});

test("a different build while the page is only 60 s idle does not reload", () => {
  assert.deepEqual(hubSelfUpdatePlan("v1", "v2", 60000, false, false),
    { reload: false, adopt: false, reason: "in use" });
});

test("a different build while a video is playing does not reload", () => {
  assert.deepEqual(hubSelfUpdatePlan("v1", "v2", 200000, true, false),
    { reload: false, adopt: false, reason: "video playing" });
});

test("a different build while the user is typing does not reload", () => {
  assert.deepEqual(hubSelfUpdatePlan("v1", "v2", 200000, false, true),
    { reload: false, adopt: false, reason: "typing" });
});

test("a different build, quiet for 200 s, nothing playing, not typing → reload", () => {
  assert.deepEqual(hubSelfUpdatePlan("v1", "v2", 200000, false, false),
    { reload: true, adopt: false, reason: "reload" });
});

test("no seen etag yet → adopt this sample without reloading", () => {
  assert.deepEqual(hubSelfUpdatePlan(null, "v2", 200000, false, false),
    { reload: false, adopt: true, reason: "adopted" });
  assert.deepEqual(hubSelfUpdatePlan("", "v2", 200000, false, false),
    { reload: false, adopt: true, reason: "adopted" }, "empty string counts as no sample");
});
