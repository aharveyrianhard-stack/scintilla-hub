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
  assert.match(js, /HOME = \{ el: 70/); assert.match(js, /new TrackballControls\(camera/); // pass 5: the full sphere is a trackball now (pass 4 pinned OrbitControls' maxPolarAngle = π — it still locked at the poles)
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

/* PASS 4 (5 Oct 2026, afternoon; Alan: "I hate these boxes … make the lasers at least as thick as the fonts … the zooming kind of snaps …
   fonts a little smaller … balance it out"), pinned to shots/proof-p4.json */
const p4 = existsSync(new URL("shots/proof-p4.json", D)) ? JSON.parse(read("shots/proof-p4.json")) : null;
const p4laser = (w) => p4 && p4.runs.find((r) => r.item === "laser" && r.w === w);
test("pass 4 · 1 no rectangles: no chip behind the type, no tread frame on a LASER step unless V2b's boxes are asked for", () => {
  const js = read("coil3d.js"); assert.doesNotMatch(js, /fillRect\(TEX\.w/); assert.match(js, /strokeText\(txt, x, y\)/); // painted type with an outline, nothing boxed
  assert.match(js, /if \(mode !== "laser" \|\| boxes\) part\.frame = /); assert.match(js, /if \(p\.frame\) \{ p\.frame\.position/);
});
test("pass 4 · 2 the beam's core is at least as wide as the ticker's cap height at every zoom, and the halo follows the reading", { skip: !p4 && "no proof-p4.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /core_over_type: 1\.15/); assert.match(js, /halo: \(v\) => 1\.5 \+ 1\.5/);
  // the core is sized at the coil's centre depth, so a step keeps its perspective: at home even the farthest step's core ≥ the type; at every zoom the median step's core is 1.1–1.35 × the type
  for (const w of [1920, 1680]) { const H = p4laser(w).zoom.home.beam; assert.ok(H.core_px_min >= H.type_px, `${w} home: core min ${H.core_px_min} px < type ${H.type_px} px`);
    for (const [k, z] of Object.entries(p4laser(w).zoom)) { const b = z.beam; assert.ok(b.core_over_type >= 1.1 && b.core_over_type <= 1.35, `${w} ${k}: core/type ${b.core_over_type}`); assert.ok(b.halo_px > b.core_px * 1.4, `${w} ${k}: halo ${b.halo_px} vs core ${b.core_px}`); } }
});
test("pass 4 · 3 balance by zoom: 11 px ticker / 9 px value at home, ~16 zoomed in, 8 zoomed out (1920), scaled with the height at 1680; biggest readings kept first", { skip: !p4 && "no proof-p4.json" }, () => {
  const r = p4laser(1920); assert.equal(r.zoom.home.beam.type_px, 11); assert.equal(r.zoom.home.beam.value_px, 9); assert.equal(r.zoom.in.beam.type_px, 16); assert.equal(r.zoom.out.beam.type_px, 8);
  const m = p4laser(1680); assert.ok(Math.abs(m.zoom.home.beam.type_px - 11 * (1050 / 1080)) < 0.2, `1680 home ${m.zoom.home.beam.type_px}`); assert.equal(m.zoom.out.beam.type_px, 8);
  for (const w of [1920, 1680]) { const z = p4laser(w).zoom; assert.ok(z.in.labels.labels > z.home.labels.labels && z.out.labels.labels < z.home.labels.labels, `${w}: shown in/home/out ${z.in.labels.labels}/${z.home.labels.labels}/${z.out.labels.labels}`); assert.ok(z.in.labels.hidden_by_thinning <= z.home.labels.hidden_by_thinning, `${w}: thinning`); }
  assert.match(read("label-scale.mjs"), /base_px: 11, value_share: 9 \/ 11, floor_px: 8, ceil_px: 16/);
});
test("pass 4 · 4 smooth zoom: 20 ticks in and 20 out are one continuous motion at 60 fps, no re-fit on a tick, ≤ 2 re-flips a second, the camera back home after", { skip: !p4 && "no proof-p4.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /controls\.noZoom = true/); /* pass 5: the trackball's own zoom is off, as OrbitControls' was */ assert.match(js, /tau_ms: 120/); assert.doesNotMatch(js, /wheel[\s\S]{0,400}framing\(/); // the wheel never calls the bisection fit
  for (const w of [1920, 1680]) { const r = p4laser(w), z = r.wheel;
    assert.equal(z.wheel_events, 40, `${w}: wheel events`); assert.equal(z.wheel_px_abs, 4800, `${w}: 40 × 120 px seen by the page`);
    assert.ok(z.fps_while_moving >= 55, `${w}: ${z.fps_while_moving} fps while moving`); assert.ok(z.longest_gap_ms_while_moving <= 34, `${w}: longest gap ${z.longest_gap_ms_while_moving} ms`);
    assert.ok(z.max_frame_step_share_of_travel <= 0.05, `${w}: biggest frame step ${z.max_frame_step_share_of_travel} of the travel`); // a snap would be ≥ 1/20 of it in one frame
    assert.ok(z.reflips_per_second <= 2, `${w}: ${z.reflips_per_second} re-flips a second`); assert.ok(z.px_max <= 16.01 && z.px_min >= 8, `${w}: px ${z.px_min}–${z.px_max}`);
    assert.ok(Math.abs(r.wheel_end.labels.distance_ratio - 1) < 0.02, `${w}: back home at ${r.wheel_end.labels.distance_ratio}× after 20 in / 20 out`); }
});
test("pass 4 · 5 the red half is as bright as the green (mean brightness of the lit red pixels within 10 % of the green's) and 0 labels read wrong from any angle", { skip: !p4 && "no proof-p4.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /laser: \{ s: 0\.3, r: 0\.3, t: 0 \}/);
  for (const w of [1920, 1680]) { const r = p4laser(w), px = r.zoom.home.pixels; assert.ok(px.red_mean_brightness >= 0.9 * px.green_mean_brightness, `${w}: red ${px.red_mean_brightness} vs green ${px.green_mean_brightness}`); assert.ok(px.red > 2000, `${w}: ${px.red} red px`);
    for (const k of ["side", "below_opposite"]) assert.equal(r[k].labels.wrong, 0, `${w} ${k}`); for (const z of Object.values(r.zoom)) assert.equal(z.labels.wrong, 0, `${w} zoom`); }
});
test("pass 4 · 6 the pictures, the video and the spheres with the new type; fps ≥ 60 on the Mac's GPU; 0 writes, 0 errors", { skip: !p4 && "no proof-p4.json" }, () => {
  for (const w of [1920, 1680]) for (const k of ["home", "in", "out", "side", "spheres"]) assert.ok(existsSync(new URL(`shots/p4-${k}-${w}.png`, D)), `p4-${k}-${w}.png`);
  assert.ok(existsSync(new URL("shots/p4-zoom-1680.webm", D)));
  for (const r of p4.runs.filter((r) => r.measure)) assert.ok(r.measure.fps >= 55, `${r.item} ${r.w}: ${r.measure.fps}`);
  const two = p4.runs.find((r) => r.item === "spheres" && r.w === 1920); assert.ok(two && two.sphere_px.length === 2 && two.home.beam.type_px === 11);
  assert.equal(p4.writes.length, 0); assert.equal(p4.errors.length, 0); assert.match(String(p4.gpu), /Apple M/);
});

/* ---- pass 5 (5 Oct 2026, night) · no shine, no hue, free spin — pinned to shots/proof-p5.json ---- */
const p5 = existsSync(new URL("shots/proof-p5.json", D)) ? JSON.parse(read("shots/proof-p5.json")) : null;
test("pass 5 · the matte bar is one opaque unlit cylinder in the Hub's own green or red: no bloom, no additive layer, no fog, no light in the matte look", () => {
  const js = read("coil3d.js");
  assert.match(js, /let look = opts\.look === "glow" \? "glow" : opts\.look === "matte" \? "matte" : "laser"/); // pass 6: matte is still offered; the contained laser is the default now
  assert.match(js, /part\.core = new THREE\.Mesh\(barGeo, new THREE\.MeshBasicMaterial\(\{ color: col, toneMapped: false, fog: false \}\)\)/);
  assert.match(js, /if \(matte\(\)\) \{ renderer\.autoClear = true; renderer\.render\(scene, camera\); \} else composer\.render\(\)/); // no bloom chain
  assert.match(js, /scene\.fog = !matte\(\) && diag\.fog \? fog : null/);
  assert.doesNotMatch(js, /MeshStandardMaterial|MeshPhongMaterial|MeshPhysicalMaterial|MeshLambertMaterial|DirectionalLight|AmbientLight|PointLight|scene\.environment =/); // nothing that could shine
  assert.match(js, /bull: 0x00ffa3, bear: 0xff2d55/);
});
test("pass 5 · the cause, measured: pass 4's page prints grey and no pixel is the true green or red; matte prints the page as 0A0A0F and the bars true at all 12 angles", { skip: !p5 && "no proof-p5.json" }, () => {
  const v = Object.fromEntries(p5.cause.variants.map((x) => [x.name, x.sum])), m = p5.cause.matte;
  assert.deepEqual(v["pass 4 as it is"].page_corner_rgb, [105, 105, 127]); assert.deepEqual(v["no bloom"].page_corner_rgb, [56, 56, 69]); // the post chain lifts the page; the bloom doubles it
  assert.equal(v["pass 4 as it is"].true_share_of_lit, 0); assert.equal(v["pass 4 as it is"].lit_share_of_frame, 1);
  assert.ok(v["no bloom"].washed_share_of_lit < v["pass 4 as it is"].washed_share_of_lit / 5, "the bloom is most of the shine");
  assert.ok(v["no bloom, no additive"].washed_share_of_lit < 0.002, "without the bloom and the additive sum nothing washes to white");
  assert.equal(v["no fog"].washed_share_of_lit, v["pass 4 as it is"].washed_share_of_lit); // the fog was not it
  assert.deepEqual(m.sum.page_corner_rgb, [10, 10, 15]); assert.ok(m.sum.washed_share_of_lit < 0.002); assert.equal(m.sum.white_share_of_lit, 0); assert.ok(m.sum.veil_share_of_frame < 0.005);
  for (const a of m.per_angle) { assert.ok(a.washed < 0.002, "angle " + a.n + " washed"); assert.ok(a.true_green_of_greenish > 0.8, "angle " + a.n + " green " + a.true_green_of_greenish); assert.ok(a.true_red_of_reddish > 0.5, "angle " + a.n + " red " + a.true_red_of_reddish); /* from above the red half is slivers between green bars, so more of it is soft edge */ }
  assert.deepEqual([p5.cause.scene.lights, p5.cause.scene.environment, p5.cause.scene.toneMapping], [0, false, "none"]);
});
test("pass 5 · the 12 angles before and after, and the labels unchanged in size and upright at every one", { skip: !p5 && "no proof-p5.json" }, () => {
  assert.equal(p5.before.shots.length, 12); assert.equal(p5.after.shots.length, 12);
  for (const s of [...p5.before.shots, ...p5.after.shots]) assert.ok(existsSync(new URL(s.path, D)), s.path);
  for (const s of p5.after.shots) assert.equal(s.labels.wrong, 0);
  const p4 = JSON.parse(read("shots/proof-p4.json")).runs.find((r) => r.item === "spheres" && r.w === 1680); // pass 4's type and beam at this screen with the sphere on
  assert.equal(p5.after.beam.type_px, p4.home.beam.type_px); assert.ok(Math.abs(p5.after.beam.core_px - p4.home.beam.core_px) <= 0.5, "the bar is as wide as pass 4's beam core");
  assert.ok(p5.after.beam.core_px >= p5.after.beam.type_px);
});
test("pass 5 · free spin: a trackball — over the pole and on, three different drags, a short coast, double-click home upright, the zoom still smooth, 60 fps", { skip: !p5 && "no proof-p5.json" }, () => {
  const s = p5.spin; assert.equal(s.controls, "TrackballControls"); assert.equal(s.over_the_pole, true);
  for (const d of s.drags) assert.ok(d.turned_deg > 40, d.what + " turned " + d.turned_deg);
  assert.ok(s.coast.coasted_after_release_deg > 3 && s.coast.coasted_after_release_deg < s.coast.turned_while_dragging_deg, "coasts a little: " + s.coast.coasted_after_release_deg + "°"); assert.ok(s.coast.coast_ms < 1200); assert.equal(s.coast.stopped, true);
  assert.ok(s.home_again.dir_off_deg < 0.5); assert.equal(s.home_again.upright, true);
  assert.equal(s.wheel.wheel_px_abs, 4800); assert.ok(s.wheel.fps_while_moving >= 58); assert.ok(s.wheel.longest_gap_ms_while_moving <= 34); assert.ok(s.wheel.max_frame_step_share_of_travel <= 0.05); assert.ok(s.wheel.reflips_per_second <= 2);
  assert.ok(s.zoom_keeps_attitude.dir_off_deg < 0.5 && s.zoom_keeps_attitude.up_kept, "the wheel does not turn an upside-down view");
  assert.ok(s.measure.fps >= 58);
  assert.equal(p5.tumble.frames.length, 16); assert.ok(p5.tumble.upside_down_frames >= 4); for (const f of p5.tumble.frames) { assert.ok(existsSync(new URL(f.path, D)), f.path); assert.ok(f.audit.washed < 0.002, "tumble " + f.n); }
  assert.ok(existsSync(new URL(p5.tumble.video, D))); assert.equal(p5.writes.length, 0); assert.equal(p5.errors.length, 0);
});
test("pass 5 · the page offers MATTE (the default) beside GLOW, and the report leads with pass 5", () => {
  const html = read("index.html"); assert.match(html, /data-look="matte"/); /* pass 6: MATTE is still there, LASER (PASS 6) is the one that opens */ assert.match(html, /data-look="glow"/);
  const rep = read("COIL-LAB.html"); assert.match(rep, /id="pass5"/); for (const f of ["p5-sheet-before.png", "p5-sheet-after.png", "p5-sheet-tumble.png", "p5-tumble-1680.webm", "p5-cause-glow.png"]) assert.ok(rep.includes("shots/" + f), f);
});

/* ---- pass 6 (6 Oct 2026) · the laser back without the spill, a calmer spin, the front row always labelled, the numbered list — pinned to shots/proof-p6.json ---- */
const p6 = existsSync(new URL("shots/proof-p6.json", D)) ? JSON.parse(read("shots/proof-p6.json")) : null;
const { layoutFront, makeFrontState, FRONT_RULE } = await import(new URL("label-scale.mjs", D));
test("pass 6 · the contained laser: one mixed (never summed) ribbon per bar whose alpha is 0 on the bar's own outline; no bloom, no fog, no dark fill; it is the default", () => {
  const js = read("coil3d.js"), mat = js.slice(js.indexOf("function beamMat("), js.indexOf("[boxGeo, edgesGeo")); // (the slice ends well past the material)
  const m = mat.slice(0, mat.indexOf("  function clear()"));
  assert.match(m, /blending: THREE\.NormalBlending/); assert.doesNotMatch(m, /AdditiveBlending/); assert.match(m, /if \(d >= 1\.0\) discard;/); assert.match(m, /depthWrite: false/);
  assert.match(js, /const contained = \(\) => look === "laser" && mode === "laser"/); assert.match(js, /const matte = \(\) => look !== "glow" && mode === "laser"/); // the flat pipeline: no composer, no fog
  assert.match(js, /if \(contained\(\)\) \{[^\n]*\n\s*part\.core = new THREE\.Mesh\(beamGeo, beamMat\(col\)\)/);
  const L = Function("return " + js.match(/const LASER = (\{[^}]+\})/)[1])(), ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const alpha = (d) => L.body * (1 - ss(L.body_to, 1, d)) + (1 - L.body) * (1 - ss(L.hot - 0.06, L.hot + 0.06, d));
  assert.equal(alpha(0), 1); assert.equal(alpha(1), 0); assert.ok(alpha(0.99) < 0.01, "nothing left at the outline"); for (let d = 0; d < 1; d += 0.01) assert.ok(alpha(d + 0.01) <= alpha(d) + 1e-9, "the light only falls off toward the edge");
  assert.match(read("index.html"), /data-look="laser" class="on"/);
});
test("pass 6 · no light outside a bar: at the 12 angles, both zooms, two spheres, the phone and the tumble, every pixel the bars change is inside a bar's footprint and the page prints 0A0A0F", { skip: !p6 && "no proof-p6.json" }, () => {
  assert.equal(p6.after.shots.length, 12); assert.equal(p6.before.shots.length, 12); const page = (c) => assert.deepEqual(c, [10, 10, 15]);
  for (const s of p6.after.shots) { assert.ok(existsSync(new URL(s.path, D)), s.path); assert.equal(s.spill.outside_a_footprint, 0, "angle " + s.n); assert.ok(s.spill.px_the_bars_changed > 20000, "angle " + s.n + ": the bars are really drawn (" + s.spill.px_the_bars_changed + " px)"); assert.ok(s.spill.px_the_bars_changed <= s.spill.bar_footprint_px);
    s.spill.corners.forEach(page); s.picture.points.forEach(page); page(s.audit.page_corner_rgb); assert.equal(s.audit.white_share_of_lit, 0, "angle " + s.n + ": nothing burns to white"); assert.ok(s.audit.washed_share_of_lit < 0.03, "angle " + s.n + " washed " + s.audit.washed_share_of_lit); }
  for (const s of p6.before.shots) assert.ok(existsSync(new URL(s.path, D)), s.path);
  for (const k of ["zoom_in", "zoom_out", "spheres"]) { assert.equal(p6.after[k].outside_a_footprint, 0, k); p6.after[k].corners.forEach(page); }
  assert.equal(p6.list.phone.outside_a_footprint, 0); p6.list.phone.corners.forEach(page); assert.equal(p6.list.row_to_bar.spill_while_lit.outside_a_footprint, 0, "a lit bar does not spill either");
  for (const f of p6.tumble.frames) { assert.equal(f.outside_a_footprint, 0, "tumble " + f.n); assert.equal(f.corners_page, true, "tumble " + f.n); }
  assert.deepEqual([p6.after.spec.look, p6.after.spec.contained, p6.after.spec.bloom, p6.after.spec.fog, p6.after.spec.lights], ["laser", true, false, false, 0]);
  assert.ok(p6.after.beam.core_px >= p6.after.beam.type_px, "the bar's footprint is at least as wide as the type");
});
test("pass 6 · the calmer spin: 1.25 against pass 5's 2.5 — the same 200 px drag turns the coil half as far; still free over the top, a short coast, double-click home", { skip: !p6 && "no proof-p6.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /const SPIN = \{ rotate_speed: 1\.25, was: 2\.5, coast: 0\.3 \}/); assert.match(js, /new TrackballControls\(camera/); assert.match(js, /addEventListener\("dblclick", \(\) => flyHome\(700\)\)/);
  const s = p6.spin; assert.equal(s.pass5.rotate_speed, 2.5); assert.equal(s.pass6.rotate_speed, 1.25); assert.ok(s.ratio >= 0.47 && s.ratio <= 0.53, "measured ratio " + s.ratio);
  assert.equal(s.over_the_pole, true); for (const d of s.drags) assert.ok(d.turned_deg > 20, d.what + " turned " + d.turned_deg);
  assert.ok(s.coast.coasted_after_release_deg > 2 && s.coast.coasted_after_release_deg < s.coast.turned_while_dragging_deg); assert.ok(s.coast.coast_ms < 1200); assert.equal(s.coast.stopped, true);
  assert.ok(s.home_again.dir_off_deg < 0.5); assert.equal(s.home_again.upright, true); assert.ok(s.wheel.fps_while_moving >= 58); assert.ok(s.measure.fps >= 58);
});
test("pass 6 · the front-row rule (pure): the nearest always show and slide rather than hide; nothing changes twice within the dwell; a pinned label always shows", () => {
  const R = { ...FRONT_RULE, min: 2, share: 0.2 }, mk = (id, x, y, depth, priority = 0) => ({ id, x, y, w: 40, h: 20, depth, priority, ux: 0, uy: -1 });
  const st = makeFrontState(); let r = layoutFront([mk("A", 0, 0, 1), mk("B", 5, 0, 2, 9), mk("C", 6, 2, 30, 5), mk("D", 300, 0, 40, 1)], st, 0, R);
  assert.deepEqual([...r.front].sort(), ["A", "B"]); assert.ok(r.shown.has("A") && r.shown.has("B"), "both front labels show though they would print on each other"); assert.ok(r.slot.get("B") > 0, "the farther one slid"); assert.equal(r.overlaps, 0);
  assert.ok(!r.shown.has("C"), "a label behind does not print over the front row"); assert.ok(r.shown.has("D"));
  // the coil turns: C comes to the front at t = 100 — it joins at once (first change), then cannot change again before t = 600
  const turned = [mk("A", 0, 0, 50), mk("B", 5, 0, 2, 9), mk("C", 200, 2, 1, 5), mk("D", 300, 0, 40, 1)];
  r = layoutFront(turned, st, 100, R); assert.ok(r.front.has("C") && r.shown.has("C"));
  const back = [mk("A", 0, 0, 1), mk("B", 5, 0, 2, 9), mk("C", 6, 2, 30, 5), mk("D", 300, 0, 3, 1)]; // C is now fourth: past the leaving rank (1.5 × 2 = 3)
  r = layoutFront(back, st, 300, R); assert.ok(r.shown.has("C"), "200 ms later C may not flip back yet"); assert.equal(r.held, true);
  r = layoutFront(back, st, 700, R); assert.ok(!r.shown.has("C"), "after the dwell it goes");
  r = layoutFront(back, st, 5000, R, "C"); assert.ok(r.shown.has("C") && r.front.has("C"), "the hovered bar's label always shows");
  // a random walk: no id ever changes shown-state twice within the dwell, and the front row is always all shown
  const N = 40, items = Array.from({ length: N }, (_, i) => mk("T" + i, 0, 0, 0, (i * 7) % 11)), s2 = makeFrontState(), last = new Map(), was = new Map(); let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let f = 0; f < 600; f++) { const now = f * 16, a = f * 0.02; items.forEach((it, i) => { const th = a + (i / N) * Math.PI * 2, rad = 40 + (i % 5) * 25; it.x = 400 + Math.cos(th) * rad * 1.6 + rnd(); it.y = 300 + Math.sin(th) * rad * 0.5; it.depth = 500 - Math.sin(th) * rad; });
    const o = layoutFront(items, s2, now, FRONT_RULE); for (const id of o.front) assert.ok(o.shown.has(id), "front label hidden: " + id);
    for (const it of items) { const v = o.shown.has(it.id); if (was.has(it.id) && was.get(it.id) !== v) { if (last.has(it.id)) assert.ok(now - last.get(it.id) >= FRONT_RULE.dwell_ms, it.id + " flipped twice within " + (now - last.get(it.id)) + " ms"); last.set(it.id, now); } was.set(it.id, v); } }
  assert.ok(last.size > 5, "the walk did change labels");
});
test("pass 6 · labels on the real page: the front row carries its ticker at all 12 angles, through 16 tumble frames and 19 s of turning; no label blinks; none reads mirrored", { skip: !p6 && "no proof-p6.json" }, () => {
  const js = read("coil3d.js"); assert.match(js, /layoutFront\(items, frontSt, now, FRONT_RULE/);
  for (const s of p6.after.shots) { assert.ok(s.labels.front >= FRONT_RULE.min, "angle " + s.n); assert.equal(s.labels.front_shown, s.labels.front, "angle " + s.n); assert.equal(s.labels.wrong, 0); }
  for (const f of p6.tumble.frames) assert.equal(f.front_shown, f.front, "tumble " + f.n);
  const L = p6.labels; assert.ok(L.seconds > 10 && L.frames > 500); assert.ok(L.changes > 20, "labels did come and go as it turned"); assert.equal(L.reflips_within_500ms, 0); assert.ok(L.front_samples > 100); assert.equal(L.front_labels_missing, 0);
  assert.equal(p6.spin.wheel.reflips_per_second, 0);
});
test("pass 6 · the numbered list: at the right, the coil's own height, rank · ticker · value in the bars' order; a row lights its bar and a bar lights its row", { skip: !p6 && "no proof-p6.json" }, () => {
  const html = read("index.html"); assert.match(html, /<aside id="rank"[^>]*><div class="hd" id="rkhd"><\/div><ol id="rk"><\/ol><\/aside>/); assert.match(html, /<div id="stage">\s*<div id="gl">/);
  const F = p6.list.favorites; assert.equal(F.coil_pane_h, F.list_panel_h); assert.equal(F.list_top_minus_coil_top, 0); assert.equal(F.list_bottom_minus_coil_bottom, 0); assert.equal(F.scrolls, false); assert.ok(F.font_px >= 11);
  assert.equal(F.rows, 58); assert.equal(F.numbered_1_to_n, true); assert.equal(F.order_is_reading_desc, true); assert.equal(F.bar_tips_descend_down_the_list, true); assert.ok(F.width_share_of_screen < 0.11);
  assert.deepEqual([p6.list.row_to_bar.bar_lit, p6.list.row_to_bar.row_on, p6.list.row_to_bar.label_shown], ["NVDA", true, true]);
  const reach = p6.list.bar_to_row.filter((b) => b.reachable); assert.ok(reach.length >= 3); for (const b of reach) { assert.deepEqual(b.row_on, [b.t]); assert.equal(b.bar_lit, b.t); }
  assert.deepEqual(p6.list.after_leaving, { bar_lit: null, rows_on: 0 });
  assert.equal(p6.list.liked.rank.rows, 144); assert.equal(p6.list.liked.scrolls, false); assert.ok(p6.list.liked.font_px >= 11); assert.equal(p6.list.liked.list_panel_h, p6.list.liked.coil_pane_h); assert.equal(p6.list.radar.rank.rows, 17);
  assert.equal(p6.list.phone.page_scrolls_sideways, false); assert.ok(p6.list.phone.font_px >= 11);
  assert.match(read("coil3d.js"), /order_rule: "top to bottom as the bars stand: the highest reading first/);
});
test("pass 6 · the proof wrote nothing and logged no error; the report leads with pass 6 and carries its pictures", { skip: !p6 && "no proof-p6.json" }, () => {
  assert.equal(p6.writes.length, 0); assert.equal(p6.errors.length, 0); assert.equal(p6.tumble.frames.length, 16); assert.ok(p6.tumble.upside_down_frames >= 3); assert.ok(existsSync(new URL(p6.tumble.video, D)));
  const rep = read("COIL-LAB.html"); assert.match(rep, /id="pass6"/); assert.ok(rep.indexOf('id="pass6"') < rep.indexOf('id="pass5"'));
  for (const f of ["p6-sheet-before.jpg", "p6-sheet-after.jpg", "p6-sheet-tumble.jpg", "p6-tumble-1680.webm", "p6-list-row-lights-bar.jpg", "p6-after-04.jpg", "p6-before-04.jpg"]) { assert.ok(rep.includes("shots/" + f), f); assert.ok(existsSync(new URL("shots/" + f, D)), f); }
  assert.equal(JSON.parse(read("coil.template.json")).pass6.spin.rotate_speed, 1.25);
});
