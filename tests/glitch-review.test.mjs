/* PG1 — the nightly slowness-and-glitch review: its ranking, and the promises its workflow makes
   (headless only, both seasons' clocks, never a commit to main or a release branch, one way to switch it off). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rank } from "../tools/glitch-review/report.mjs";
import { SCREENS, LIMITS, HUB_TABS, COMPANIES } from "../tools/glitch-review/screens.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const screen = (id, over = {}) => ({ id, name: id, ok: true, notes: [], firstDataMs: 500, weightKB: 300, layoutShift: 0.01, longTasks: 0, longestFreezeMs: 0, frozenMs: 0, consoleErrors: 0, pageErrors: 0, pageErrorSamples: [], failedCalls: 0, failedCallSamples: [], placeholders: 0, blankPanels: 0, staleBadges: 0, staleSamples: [], picChangedPct: 1, ...over });

test("glitch review covers every Hub master tab, three company views, Station deck + chart, allocation and the tree", () => {
  const ids = SCREENS.map((s) => s.id);
  for (const t of HUB_TABS) assert.ok(ids.includes("hub-" + t.toLowerCase()), t);
  assert.equal(COMPANIES.length, 3);
  for (const id of ["station-deck", "station-chart", "allocation", "tree"]) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length, "screen ids are unique");
  for (const s of SCREENS) assert.match(s.url, /^https:\/\/([a-z]+\.)?scintillahub\.ai\//, "public Scintilla pages only");
});

test("glitch review: a clean run is green and lists nothing", () => {
  const r = rank({ limits: LIMITS, screens: [screen("a"), screen("b")] }, null);
  assert.equal(r.verdict, "green");
  assert.equal(r.findings.length, 0);
});

test("glitch review: red outranks amber, the worse red comes first, and last run's number rides along", () => {
  const now = { limits: LIMITS, screens: [screen("slow", { firstDataMs: 5000 }), screen("jumpy", { layoutShift: 0.9 }), screen("heavy", { weightKB: 5400 })] };
  const r = rank(now, { screens: [screen("jumpy", { layoutShift: 0.5 })] });
  assert.equal(r.verdict, "red");
  assert.deepEqual(r.findings.map((f) => f.screenId), ["jumpy", "heavy", "slow"]);
  assert.deepEqual(r.findings.map((f) => f.level), ["red", "red", "amber"]);
  assert.equal(r.findings[0].lastRun, 0.5);
});

test("glitch review: a screen that never shows data is red, a parked room is only listed, a server error is never amber", () => {
  const r = rank({ limits: LIMITS, screens: [
    screen("blank", { firstDataMs: null }), screen("parked", { firstDataMs: null, parked: true }),
    screen("five", { failedCalls: 1, failedCallSamples: [{ n: 1, text: "503 example/api" }] }),
    screen("four", { failedCalls: 1, failedCallSamples: [{ n: 1, text: "404 example/api" }] }),
    screen("dead", { ok: false, notes: ["the page itself answered 500"] }) ] }, null);
  const lvl = Object.fromEntries(r.findings.map((f) => [f.screenId, f.level]));
  assert.deepEqual(lvl, { dead: "red", blank: "red", five: "red", four: "amber", parked: "amber" });
});

test("glitch review: the worst five holds at most two lines per page, phone width counted with its page", () => {
  const bad = { firstDataMs: 20000, weightKB: 9000, layoutShift: 0.9, longestFreezeMs: 3000, longTasks: 3, frozenMs: 4000 };
  const r = rank({ limits: LIMITS, screens: [screen("a", bad), screen("a-phone", bad), screen("b", bad), screen("c", bad)] }, null);
  assert.equal(r.worstFive.length, 5);
  const per = {};
  for (const f of r.worstFive) { const b = f.screenId.replace(/-phone$/, ""); per[b] = (per[b] || 0) + 1; }
  assert.ok(Object.values(per).every((n) => n <= 2), JSON.stringify(per));
});

test("glitch review: the browser is headless and every write is blocked", () => {
  const src = read("tools/glitch-review/review.mjs");
  assert.match(src, /chromium\.launch\(\{ headless: true \}\)/);
  assert.doesNotMatch(src, /headless:\s*false/);
  assert.match(src, /--headless=new/, "Lighthouse's browser is headless too");
  assert.match(src, /route\.abort\("blockedbyclient"\)/);
});

test("glitch review workflow: both seasons' clocks, a switch, and no commit to main or a release branch", () => {
  const y = read(".github/workflows/glitch-review.yml");
  for (const c of ["30 1 * * *", "30 2 * * *", "0 14 * * 1-5", "0 15 * * 1-5"]) assert.ok(y.includes('cron: "' + c + '"'), c);
  assert.match(y, /vars\.GLITCH_REVIEW_OFF != '1'/);
  assert.match(y, /REPORTS_BRANCH: glitch-review-reports/);
  const pushes = y.match(/git push[^\n]*/g) || [];
  assert.equal(pushes.length, 1);
  assert.match(pushes[0], /HEAD:\$REPORTS_BRANCH/);
  assert.doesNotMatch(y, /secrets\./, "no stored key is used");
  assert.doesNotMatch(y, /pull_request/);
});
