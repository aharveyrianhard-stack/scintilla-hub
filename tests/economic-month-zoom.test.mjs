// EVENTS 22 Sep — MONTH opens first and ZOOM is a repaint only (no read, no write).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("the calendar opens on MONTH", () => {
  assert.match(src, /econSpan: "MONTH", econZoom: false,/);
});
test("ZOOM sits beside DAY / WEEK / MONTH and only repaints", () => {
  assert.match(src, /id="econZoom" data-act="eczoom"/);
  const h = src.slice(src.indexOf('case "eczoom": {'), src.indexOf('case "ecspan": {'));
  assert.ok(h.includes("renderEconTable()"), "repaints what is loaded");
  assert.ok(!/ecLoadWindow|pg\(|fetch\(|operatorWrite/.test(h), "no read and no write from the toggle");
});
test("zoom folds the weekend columns with CSS only", () => {
  assert.match(src, /#econTbl\.ec-zoomed \.ec-cal > :nth-child\(7n\+1\), #econTbl\.ec-zoomed \.ec-cal > :nth-child\(7n\)\{ display:none; \}/);
});
/* ECON TAPE 22 Sep — the flaw found with ZOOM on: in WEEK the date line broke in two ("…SEP 28," / "2026") because
   the ZOOM + button pushed the row past the panel (MEASURED: 731px wanted of 721px at the 1240px design width). */
test("the day bar never breaks a label in two: nothing wraps inside it, the group wraps instead", () => {
  assert.match(src, /\.ec-daybar\{ display:flex; align-items:center; gap:8px; padding:6px 12px 6px; flex-wrap:wrap; row-gap:6px;/);
  assert.match(src, /\.ec-day\{[^}]*white-space:nowrap;/, "the date keeps one line");
  assert.match(src, /\.ec-today\{[^}]*white-space:nowrap;/, "· TODAY keeps one line");
  assert.match(src, /\.ec-sp\{[^}]*white-space:nowrap;/, "HIGH ONLY / TODAY / DAY / WEEK / MONTH / ZOOM + keep one line each");
  assert.match(src, /\.ec-day\.ec-day--range\{ letter-spacing:\.1em; \}/, "the week's two-date label is set tighter");
  assert.match(src, /lbl\.classList\.toggle\("ec-day--range", \(S\.econSpan \|\| "DAY"\) === "WEEK"\)/, "and only WEEK gets it");
});
