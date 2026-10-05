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

/* PASS 2 (3 Oct, afternoon): the coordinator's five points, each pinned to a measurement in shots/proof-p2.json, and the tape's ladder fixes */
const p2 = existsSync(new URL("shots/proof-p2.json", D)) ? JSON.parse(read("shots/proof-p2.json")) : null;
test("pass 2 · 1 the home view fills ~80 % of the height at 1680 and 1920", { skip: !p2 && "no proof-p2.json" }, () => {
  for (const r of p2.runs.filter((r) => r.home && r.home.fill && (r.w === 1680 || r.w === 1920) && !r.list)) assert.ok(r.home.fill.h >= 0.76 && r.home.fill.h <= 0.86, `${r.mode} ${r.w}: ${r.home.fill.h}`);
});
test("pass 2 · 2 no label reads mirrored or upside down, at home, from the side, from below, after a drag", { skip: !p2 && "no proof-p2.json" }, () => {
  for (const r of p2.runs.filter((r) => r.home && r.home.labels)) { assert.equal(r.home.labels.wrong, 0, `${r.mode} ${r.w} home`); if (r.side) assert.equal(r.side.labels.wrong, 0, `${r.mode} ${r.w} side`); if (r.below_opposite) assert.equal(r.below_opposite.labels.wrong, 0, `${r.mode} ${r.w} below`); if (r.after_drag_labels) assert.equal(r.after_drag_labels.wrong, 0, `${r.mode} drag`); }
  for (const r of p2.runs.filter((r) => r.home && r.home.labels && r.w === 1920 && !r.list)) assert.ok(r.home.labels.ticker_px_median >= 18, `${r.mode}: ticker ${r.home.labels.ticker_px_median} px`);
});
test("pass 2 · 3 the form is light: bloom on every direction, no lit slabs, glow tied to the reading", () => {
  const js = read("coil3d.js"); assert.match(js, /composer\.render\(\)/); assert.doesNotMatch(js, /MeshStandardMaterial|DirectionalLight|AmbientLight/); assert.match(js, /const glow = \(v\) => 0\.35 \+ 0\.65/);
});
test("pass 2 · 4 the red half shows at home (hue-sorted lit pixels) and the green bodies are glass", { skip: !p2 && "no proof-p2.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /basic\(col, 0\.06, THREE\.NormalBlending/); assert.match(js, /part\.floor = /);
  for (const r of p2.runs.filter((r) => r.home && r.home.pixels && r.w === 1920 && !r.list)) assert.ok(r.home.pixels.red > 2000, `${r.mode}: ${r.home.pixels.red} red px`);
});
test("pass 2 · 5 fps prints only while MEASURE FPS runs", { skip: !p2 && "no proof-p2.json" }, () => {
  for (const r of p2.runs.filter((r) => "hud_has_fps_before_measure" in r)) { assert.equal(r.hud_has_fps_before_measure, false, `${r.mode} ${r.w}`); assert.match(r.hud_while_measuring, /measuring fps/); assert.match(r.hud_after_measure, /\d+(\.\d+)? fps/); }
  for (const r of p2.runs.filter((r) => r.measure && !r.list)) assert.ok(r.measure.fps >= 50, `${r.mode} ${r.w}: ${r.measure.fps}`);
});
test("pass 2 · the tape's ladder: one scale for both sides, sorted by × usual, the × column always ×, the full-panel mode opens from a tap and closes", { skip: !p2 && "no proof-p2.json" }, () => {
  const js = read("tape.js"); assert.match(js, /const fmtX = \(m\) => m\.z\.toFixed\(1\) \+ "×"/); assert.match(js, /sort\(\(a, b\) => b\.z - a\.z\)/);
  for (const r of p2.runs.filter((r) => r.tape && r.sides)) { if (r.sides.up_px_per_x && r.sides.dn_px_per_x) assert.ok(Math.abs(r.sides.up_px_per_x - r.sides.dn_px_per_x) / r.sides.up_px_per_x < 0.05, `${r.tape} ${r.w}: ${r.sides.up_px_per_x} vs ${r.sides.dn_px_per_x}`); assert.equal(r.sides.x_col_all_x, true, `${r.tape} ${r.w}`); assert.equal(r.zoom.open, true, `${r.tape} ${r.w} zoom`); assert.equal(r.zoom_closed, true, `${r.tape} ${r.w} back`); }
});

/* PASS 3 (5 Oct 2026, Alan: no boxes · labels that tilt with the view and scale with the zoom · the set's market cap as the sphere), pinned to shots/proof-p3.json */
const p3 = existsSync(new URL("shots/proof-p3.json", D)) ? JSON.parse(read("shots/proof-p3.json")) : null;
test("pass 3 · 1 a step is its light: no body, verticals, plate or footprint unless V2b's boxes are asked for", () => {
  const js = read("coil3d.js"); assert.match(js, /if \(boxes\) \{ \/\/ V2b's column boxes/); assert.match(js, /part\.frame = new THREE\.LineSegments\(frameGeo/); assert.match(js, /part\.core = new THREE\.Mesh\(coreGeo/);
  assert.doesNotMatch(js, /labelPlane|putLabels|orientLabel\(/); // the painted-on-the-step labels are gone
});
test("pass 3 · 2 labels are sprites that face the camera, drawn after the bloom; 0 read mirrored or upside down at home, side, below, after a drag, at every zoom", { skip: !p3 && "no proof-p3.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /new THREE\.Sprite\(m\)/); assert.match(js, /renderer\.render\(labelScene, camera\)/);
  for (const r of p3.runs.filter((r) => r.home && r.home.labels)) { assert.equal(r.home.labels.wrong, 0, `${r.item} ${r.w} home`); for (const k of ["side", "below_opposite", "after_drag"]) if (r[k]) assert.equal(r[k].labels.wrong, 0, `${r.item} ${r.w} ${k}`); if (r.zoom) for (const z of Object.values(r.zoom)) assert.equal(z.wrong, 0, `${r.item} ${r.w} zoom`); }
});
test("pass 3 · 3 the type follows the zoom between the floor and the ceiling, and thinned labels come back zoomed in", { skip: !p3 && "no proof-p3.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /import \{ labelPx, thinLabels, worldHeightForPx, LABEL_RULE \} from "\.\/label-scale\.mjs"/);
  for (const r of p3.runs.filter((r) => r.zoom)) {
    const { home, in: zi, out: zo } = r.zoom; const k = Math.max(11 / 13, r.h / 1080);
    assert.ok(Math.abs(home.ticker_px_median - 13 * k) < 1.2, `${r.w} home ${home.ticker_px_median}`); // 13 px at home on 1080, scaled with the screen's height
    assert.ok(zi.ticker_px_median > home.ticker_px_median && zi.ticker_px_median <= 24 * k + 1, `${r.w} in ${zi.ticker_px_median}`);
    assert.ok(zo.ticker_px_median < home.ticker_px_median && zo.ticker_px_median >= 11 - 0.6, `${r.w} out ${zo.ticker_px_median}`); // never under 11 px
    assert.ok(zi.hidden_by_thinning <= home.hidden_by_thinning && zo.hidden_by_thinning >= home.hidden_by_thinning, `${r.w} thinning in ${zi.hidden_by_thinning} / home ${home.hidden_by_thinning} / out ${zo.hidden_by_thinning}`);
    assert.ok(zi.labels + zi.hidden_by_thinning >= r.state.rows - 4, `${r.w} every label accounted for`);
  }
});
test("pass 3 · 4 the sphere's volume is the set's market cap ($1 T = 80 U of radius) and two sets side by side keep one scale", { skip: !p3 && "no proof-p3.json" }, () => {
  const caps = JSON.parse(read("data/market-caps-20261005.json")); assert.ok(caps.with_cap >= 140); assert.match(caps.source, /company_profile/);
  for (const r of p3.runs.filter((r) => r.item && r.item.startsWith("sphere"))) for (const s of r.state.sets) { assert.ok(Math.abs(s.capR - 80 * Math.cbrt(s.capSumT)) < 0.5, `${s.name}: r ${s.capR} vs ${80 * Math.cbrt(s.capSumT)}`); }
  const two = p3.runs.find((r) => r.item === "sphere-favorites-vs-radar" && r.w === 1920); assert.ok(two && two.sphere_px.length === 2);
  const [a, b] = two.sphere_px; assert.ok(Math.abs(a.r_px / a.r_units - b.r_px / b.r_units) / (a.r_px / a.r_units) < 0.12, `one scale on screen: ${a.r_px}/${a.r_units} vs ${b.r_px}/${b.r_units}`); // perspective allows a little
});
test("pass 3 · 5 fps ≥ 60 on the Mac's GPU, cap off and with two spheres", { skip: !p3 && "no proof-p3.json" }, () => {
  for (const r of p3.runs.filter((r) => r.measure)) assert.ok(r.measure.fps >= 55, `${r.item} ${r.w}: ${r.measure.fps}`);
  assert.match(String(p3.gpu), /Apple M/);
});
test("pass 3 · the tree label demo runs the same rule", { skip: !p3 && "no proof-p3.json" }, () => {
  const d = p3.runs.find((r) => r.item === "tree-label-demo"); assert.ok(d && d.demo); assert.equal(d.demo.home.px, 13); assert.equal(d.demo.in.px, 24); assert.equal(d.demo.out.px, 11); assert.ok(d.demo.in.hidden <= d.demo.home.hidden && d.demo.out.hidden >= d.demo.home.hidden);
  assert.match(read("label-scale-demo.html"), /from "\.\/label-scale\.mjs"/);
});
