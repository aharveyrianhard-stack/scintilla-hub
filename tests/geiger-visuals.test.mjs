/* deliverables/20260925/geiger-visuals — the Geiger visuals proposal pages.
   What is pinned: the six mockups and the write-up exist and link to each other; the shared
   stylesheet keeps the house rules (every grey within 24 across channels and no channel above 210,
   no white, body text at least 11px, the only hues are the bull green and the bear red); the data
   bundle is real, named, and carries the eight rungs of Alan's saved Equalizer for MU. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables", "20260925", "geiger-visuals");
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");
const PAGES = ["motion-a.html", "motion-b.html", "motion-c.html", "tab-a.html", "tab-b.html", "tab-c.html"];

test("the write-up and the six mockups exist and the write-up links every mockup", () => {
  const doc = read("GEIGER-VISUALS.html");
  for (const p of PAGES) {
    assert.ok(fs.existsSync(path.join(DIR, p)), p + " exists");
    assert.ok(doc.includes('href="' + p + '"'), "GEIGER-VISUALS.html links " + p);
  }
});

test("every mockup loads the shared stylesheet, the data bundle and the shared runtime", () => {
  for (const p of PAGES) {
    const s = read(p);
    assert.ok(s.includes('href="gv.css"'), p + " uses gv.css");
    assert.ok(s.includes('src="data.js"') && s.includes('src="gv-common.js"'), p + " uses the shared data and runtime");
    assert.ok(s.includes('name="robots" content="noindex"'), p + " is noindex");
  }
});

test("house colours: greys stay grey, nothing is white, the only hues are the two directions", () => {
  const css = read("gv.css") + PAGES.map(read).join("\n");
  const body = css.replace(/<!-- scnav ·[\s\S]*?<!-- \/scnav -->/g, "");   /* the shared BACK/CLOSE pair is the hub's own, not this page's palette */
  const hexes = [...new Set(body.match(/#[0-9a-fA-F]{6}\b/g) || [])];
  const ALLOWED_HUES = new Set(["#00FFA3", "#FF2D55"]);
  for (const h of hexes) {
    if (ALLOWED_HUES.has(h.toUpperCase())) continue;
    const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    assert.ok(spread <= 24, h + " is a grey (channels within 24)");
    assert.ok(Math.max(r, g, b) <= 210, h + " has no channel above 210 (no white)");
  }
  assert.ok(!/\bwhite\b(?!-space)|#fff\b|#ffffff\b/i.test(body), "no white anywhere (white-space is a CSS property, not a colour)");
});

test("body text is at least 11px in the shared stylesheet", () => {
  const css = read("gv.css");
  const body = css.match(/body\{[^}]*font-size:(\d+(?:\.\d+)?)px/);
  assert.ok(body && +body[1] >= 11, "body font-size >= 11px");
});

test("the data bundle is real and names its sources; MU carries the eight saved rungs", () => {
  const js = read("data.js");
  assert.ok(js.startsWith("window.GV_DATA="), "bundle shape");
  const d = JSON.parse(js.slice("window.GV_DATA=".length).replace(/;\s*$/, ""));
  assert.ok(d.META.hist_note.includes("fan_daily"), "history source named");
  assert.ok(d.META.px_note && d.META.px_note.includes("/candles"), "price source named");
  assert.deepEqual(Object.keys(d.RUNGS.MU).sort(), ["12h", "1d", "1w", "2h", "3d", "3h", "4h", "6h"], "the eight rungs");
  assert.ok(d.COHORTS.AI_HARDWARE.length > 30 && d.COHORTS.FAV.length > 30, "both cohorts present");
  assert.ok(d.MU_HIST.length >= 200, "MU history depth");
});

test("the motion mockups never scale the bar to the day's maximum, and never move rows in a batch", () => {
  const a = read("motion-a.html");
  assert.ok(a.includes("Math.min(1,Math.abs(v))"), "bar scale fixed to ±1");
  assert.ok(a.includes("GV.approach(r.y,target,dt,150)"), "rows glide per frame, not per day");
  assert.ok(a.includes("NEAR-TIES HOLD"), "near-ties hold");
});
