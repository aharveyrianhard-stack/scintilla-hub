// Day restoration 2026-09-19: Alan opened the calendar preview and saw a dashboard (room tabs tuck away). A link ending in
// #economic / #calendar opens the ECONOMIC room directly; every other address keeps the DASHBOARD landing. Phone controls wrap.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fnSrc = (name) => { const s = page.indexOf("function " + name + "("); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n}\n", s) + 3); };
const entry = (hash) => new Function("location", fnSrc("scEntryRoom") + "return scEntryRoom();")({ hash });

test("direct entry: #economic and #calendar open ECONOMIC; anything else keeps the dashboard landing", () => {
  for (const h of ["#economic", "#ECONOMIC", "#calendar", "#Calendar"]) assert.equal(entry(h), "ECONOMIC", h);
  for (const h of ["", "#", "#dashboard", "#economics", "#economic/x", "#news"]) assert.equal(entry(h), null, JSON.stringify(h));
  assert.equal(new Function(fnSrc("scEntryRoom") + "return scEntryRoom();")(), null, "no location at all (tests, workers) is harmless");
  assert.match(page, /const S = \{\n  sec: scEntryRoom\(\) \|\| "DASHBOARD", coh: "FAV",/, "the default landing is still DASHBOARD");
});
test("direct entry: one hashchange listener, which only ever switches to ECONOMIC", () => {
  const n = (page.match(/addEventListener\("hashchange"/g) || []).length;
  assert.equal(n, 1);
  assert.match(page, /window\.addEventListener\("hashchange", \(\) => \{ if \(scEntryRoom\(\) === "ECONOMIC" && S\.sec !== "ECONOMIC"\) go\("ECONOMIC"\); \}\);/);
});
test("phone: the day-bar controls wrap under the date instead of overlapping it; the nudge is not shown on a phone", () => {
  assert.match(page, /@media \(max-width:900px\)\{ \.ec-daybar\{ flex-wrap:wrap; row-gap:6px; \} \.ec-span\{ margin-left:0; width:100%; flex-wrap:wrap; \} \}/);
  /* ECON TAPE 22 Sep — the ident row on a phone is one nowrap line with no room to give, so the queue stays hidden
     there (the ECON band under the price bands is what carries the week on a phone). */
  assert.match(page, /@media \(max-width:900px\)\{ \.sc-cident--nudge \.sc-macronext\{ display:none; \} \}/);
  assert.match(page, /\nconst ECON_TAPE_ON = true;/, "the nudge ships ON (22 Sep)");
  assert.match(page, /\nconst ECON_BAND_ON = true;/, "the ECON band ships ON (22 Sep)");
});
