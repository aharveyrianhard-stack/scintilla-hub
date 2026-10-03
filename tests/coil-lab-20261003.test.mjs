/* COIL LAB (3 Oct 2026): the lab reads the T10 sheet and the Hub's tokens, never a size typed to taste; the template agrees with the sheet; the data beside the page is real and dated. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const D = new URL("../deliverables/20261003/coil-lab/", import.meta.url);
const read = (f) => readFileSync(new URL(f, D), "utf8");
const std = JSON.parse(read("data/tree-standard.t10-e133a81.json")), tpl = JSON.parse(read("coil.template.json"));
test("the template's sizes are the T10 sheet's", () => {
  const P = std.podium, T = tpl.geometry.sizes_from_T10;
  assert.equal(T.step_w, P.step_w); assert.equal(T.tread_depth, P.tread_depth); assert.equal(T.inner_radius, P.inner_radius);
  assert.equal(T.H_max, P.H_max); assert.equal(T.H_min, P.H_min); assert.equal(T.label_type_u, P.label.type_u);
});
test("the page sizes from the sheet and starts at the settled 70°", () => {
  const js = read("coil3d.js");
  assert.match(js, /A: P\.inner_radius, D: P\.step_w, RW: P\.tread_depth/); assert.match(js, /H: P\.H_max, H_MIN: P\.H_min/);
  assert.match(js, /HOME = \{ el: 70/); assert.match(js, /maxPolarAngle = Math\.PI/);
  assert.equal(tpl.camera.home.el, 70);
});
test("the coil uses the Hub's tokens, not the tree page's greys", () => {
  const js = read("coil3d.js"); assert.match(js, /bull: 0x00ffa3, bear: 0xff2d55, crk: 0x00d4ff/); assert.doesNotMatch(js, /0x35b06a|0xd1483f/);
});
test("the data beside the page is real and dated", () => {
  const rows = JSON.parse(read("data/scintillas-20261002.json")); assert.equal(rows.length, 12); assert.ok(rows.every((r) => r.detail && r.detail.session === "2026-10-02"));
  const g = JSON.parse(read("data/geiger-snapshot-20261003.json")); assert.ok(Object.keys(g.symbols).length > 500); assert.match(g.computed_utc, /^2026-10-03T/);
  const L = JSON.parse(read("data/hub-lists-20261003.json")); assert.ok(L.favorites.length >= 50);
});
test("the report carries the captures it names", () => {
  const html = read("COIL-LAB.html"); for (const m of html.matchAll(/(?:src)="(shots\/[^"]+)"/g)) assert.ok(existsSync(new URL(m[1], D)), m[1]);
  assert.match(html, /sc-pagespecs/);
});
