// L2 CHART-SPEED, 28 Sep 2026 — the page states numbers from saved measurement files; these tests keep the two together
// and hold the page to the Hub's look rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/chart-speed");
const html = readFileSync(join(DIR, "CHART-SPEED.html"), "utf8");
const summary = JSON.parse(readFileSync(join(DIR, "data/final-summary.json"), "utf8"));

test("every before/after run the page draws from is saved, three of each", () => {
  const files = readdirSync(join(DIR, "data/final")).filter((f) => f.endsWith(".json"));
  for (const sc of ["hubrow", "hubearly", "st8"]) for (const v of ["before", "after"])
    assert.equal(files.filter((f) => f.startsWith(sc + "-" + v + "-")).length, 3, sc + " " + v);
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(DIR, "data/final", f), "utf8"));
    assert.ok(Array.isArray(j.runs) && j.runs.length === 2, f);
    assert.deepEqual(j.writes.filter((w) => w.method !== "GET"), j.writes, "writes are only recorded, never sent");
  }
});

test("the headline numbers on the page are the medians in the saved summary", () => {
  const s = (ms) => (ms / 1000).toFixed(1) + " s";
  const o = summary.hubrow;
  assert.ok(html.includes(s(o.o_cold_fanAll.before)) && html.includes(s(o.o_cold_fanAll.after)), "Hub cold fan before/after");
  const t = summary.st8;
  assert.ok(html.includes(s(t.o_cold_price.before)) && html.includes(s(t.o_cold_price.after)), "Station cold price before/after");
});

test("the server ask and the screenshots are saved next to the page", () => {
  assert.ok(existsSync(join(DIR, "I5-SERVER-ASK.md")));
  const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 4, "1680 and 390 of the Hub and the Station");
  for (const src of imgs) assert.ok(existsSync(join(DIR, src)), src);
});

test("the page is greys only, no white, text 11 px and up, and carries the way back", () => {
  assert.doesNotMatch(html, /#fff\b|#ffffff|\bwhite\b(?!-space)/i);
  for (const m of html.matchAll(/font-size(?::\s*|=")(\d+(?:\.\d+)?)(?:px)?/g)) assert.ok(Number(m[1]) >= 11, m[0]);
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, m[0]);
  }
  assert.match(html, /<!-- scnav · /);
});
