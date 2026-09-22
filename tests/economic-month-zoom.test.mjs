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
test("zoom folds the weekend columns with CSS only and keeps the tape flag off", () => {
  assert.match(src, /#econTbl\.ec-zoomed \.ec-cal > :nth-child\(7n\+1\), #econTbl\.ec-zoomed \.ec-cal > :nth-child\(7n\)\{ display:none; \}/);
  assert.match(src, /const ECON_TAPE_ON = false;/);
});
