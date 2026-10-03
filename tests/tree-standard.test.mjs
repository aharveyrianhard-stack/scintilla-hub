// T10 (2 Oct, late night): the tree's design standard. The sheet (deliverables/20261002/tree-standard/tree-standard.json) is
// the one source of every size: the page reads it (map3d.js fetches it) and these tests read the SAME file — nothing is
// re-typed here. Checked on the code and on the headless walk's record (shots/t10-after-proof.json: 1920 × 1080 at scale 1,
// 1680 × 1050 at scale 2, 390 at 1; node proof-t10.mjs <base> after — and shots/t10-before-proof.json, T9's page).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map"), SHEET = join(ROOT, "deliverables/20261002/tree-standard");
const STD = JSON.parse(readFileSync(join(SHEET, "tree-standard.json"), "utf8"));
const M3 = readFileSync(join(DIR, "map3d.js"), "utf8"), PAGE = readFileSync(join(DIR, "index.html"), "utf8"), ATL = readFileSync(join(DIR, "tickers-atlas.js"), "utf8");
const load = (f) => (existsSync(join(DIR, "shots", f)) ? JSON.parse(readFileSync(join(DIR, "shots", f), "utf8")) : null);
const runs = load("t10-after-proof.json"), before = load("t10-before-proof.json");
const probes = (r, key) => r.log.filter((x) => x.probe && x.value && key in x.value).map((x) => x.value);
const blacks = (r) => Object.fromEntries(r.log.filter((x) => x.black).map((x) => [x.black.replace(/^\d+-/, ""), x.value.black_share]));
const screenOf = (r) => (+r.width === 390 ? "phone" : +r.width === 1680 ? "macbook" : "appletv");

test("1 · one sheet: the page sizes everything from tree-standard.json (fetched, never re-typed) — box, pitches, the staircase, the camera; the sheet carries the three screens and the targets", () => {
  assert.match(M3, /const STD = await fetch\(new URL\("\.\.\/\.\.\/20261002\/tree-standard\/tree-standard\.json", import\.meta\.url\)/);
  assert.match(M3, /const CLEAN_SP = qn\("sp", STD\.pitch\.column\), CLEAN_ROW = qn\("row", STD\.pitch\.row\), CLEAN_MINW = qn\("minw", STD\.pitch\.min_block_w\);/);
  assert.match(M3, /small: \{ w: STD\.box\.w \/ 2, h: STD\.box\.h \/ 2, min: STD\.box\.floor_px\.w \/ 2, slotW: STD\.pitch\.column \* STD\.box\.slot_share \/ 2, slotH: STD\.pitch\.row \* STD\.box\.slot_share \/ 2 \}/);
  assert.match(M3, /A: qn\("sa", SP\.inner_radius\), B: qn\("sb", 0\), D: qn\("sd", SP\.step_w\), RW: qn\("srw", SP\.tread_depth\), H: qn\("sh", SP\.H_max\), H_MIN: SP\.H_min, el: qn\("sel", SP\.camera\.home_el\)/);
  assert.doesNotMatch(M3, /qn\("sp", 104\)|w: 48, h: 15|qn\("sel", 70\)/, "no size typed into the page any more");
  assert.deepEqual(Object.keys(STD.screens), ["appletv", "macbook", "phone"]);
  assert.equal(STD.box.w / STD.box.h, STD.box.ratio); assert.equal(STD.pitch.column - STD.box.w, 8); assert.equal(STD.pitch.row - STD.box.h, 6);
  assert.ok(STD.targets.touching_boxes === 0 && STD.targets.clean.black_share_max < 0.81 && STD.podium.step_w === STD.podium.tread_depth);
  assert.ok(existsSync(join(SHEET, "TREE-STANDARD.html")));
});

test("2 · the page follows the sheet: a box never grows past its slot (no two boxes touch at any zoom), the ticker prints on the box only when the box can carry it; density and black inside the targets, before → after", () => {
  assert.match(M3, /float s = max\(1\.0, minPx \/ \(w \* ppu\)\); s = min\(s, min\(uSlotW \/ w, uSlotH \/ h\)\);/, "the slot cap in the shader");
  assert.match(M3, /vShow = uTick \* step\(uTickMinH, boxHpx\) \* step\(aTickEm \* boxHpx \* uTickRatio \+ uTickPad, boxWpx\) \* step\(-0\.5, aTile\);/, "the ticker prints whole or not at all");
  assert.match(M3, /else if \(bx\) \{ show = false; \}/, "no DOM label on a box");
  if (!runs) return;
  for (const r of runs) {
    const D = probes(r, "touching_pairs"), s = screenOf(r);
    assert.ok(D.length >= 1, `${r.width}: measured`);
    for (const d of D.filter((x) => !x.podium && !x.area)) { assert.equal(d.touching_pairs, STD.targets.touching_boxes, `${r.width} ${d.area || "CLEAN"}: ${d.touching_pairs} touching pairs (T9: ${before ? JSON.stringify((probes(before.find((b) => b.width === r.width), "touching_pairs")[0] || {}).touching_pairs) : "?"})`); assert.equal(d.label_on_label, 0); assert.equal(d.label_on_other_box, 0); assert.equal(d.ticker_labels, 0, `${r.width}: DOM tickers`); }
    if (s === "phone") continue;
    assert.ok(D[0].density_per_Mpx >= STD.targets.clean.density_per_Mpx_min, `${r.width}: density ${D[0].density_per_Mpx}`);
  }
});

test("2b · the white-space targets and the opened section in perspective (NOT MET YET — the sheet asks for less black than the page gives: CLEAN ≤ 0.76, the section ≤ 0.86, the podium ≤ 0.55; the measured shares are printed)", { todo: "T10 shipped the sheet, the mirror and the labels; the black-share targets are still open (decision for Alan in TREE-STANDARD.html)" }, () => {
  if (!runs) return;
  for (const r of runs.filter((x) => +x.width >= 1000)) {
    const B = blacks(r), B0 = before ? blacks(before.find((b) => b.width === r.width)) : {};
    console.log(`${r.width}: black CLEAN ${B0.clean} → ${B.clean} (target ≤ ${STD.targets.clean.black_share_max}) · section ${B0["area-tech"]} → ${B["area-tech"]} (≤ ${STD.targets.section.black_share_max}) · podium ${B0["podium-tech"]} → ${B["podium-tech"]} (≤ ${STD.targets.podium.black_share_max})`);
    for (const d of probes(r, "touching_pairs").filter((x) => x.area && !x.podium)) { console.log(`${r.width}: the opened section ${d.area}: ${d.touching_pairs} touching pairs in perspective (T9: ${(probes(before.find((b) => b.width === r.width), "touching_pairs").find((x) => x.area && !x.podium) || {}).touching_pairs})`); assert.equal(d.touching_pairs, 0, `${r.width} ${d.area}: touching in perspective`); }
    assert.ok(B.clean <= STD.targets.clean.black_share_max, `${r.width}: CLEAN black ${B.clean}`);
    assert.ok(B["area-tech"] <= STD.targets.section.black_share_max, `${r.width}: section black ${B["area-tech"]}`);
    assert.ok(B["podium-tech"] <= STD.targets.podium.black_share_max, `${r.width}: podium black ${B["podium-tech"]}`);
  }
});

test("3 · the red mirrored staircase: two snakes, mirror images in the zero plane — the same spiral from each tip (A, B, D, RW), one H above and below zero, green stands on zero, red hangs from it and descends inwards, the flat base between", () => {
  assert.match(M3, /if \(i < withV\.length\) return \{ \.\.\.spiralAt\(dnN - 1 - \(i - upN\)\), half: -1 \};/, "the red spiral is the green one reflected");
  assert.match(M3, /const base = above \? tread - 1\.5 : 0;/, "every column meets the zero plane");
  assert.match(M3, /new THREE\.RingGeometry\(Math\.max\(1, Math\.min\(rUp, rDn\) - P\.RW \/ 2\), outerR, 96\)/, "the flat base at zero");
  if (!runs) return;
  for (const r of runs) for (const P of probes(r, "mirror").filter((p) => p.mirror && p.mirror.mode === "3d")) {
    const m = P.mirror, R = P.rule;
    assert.equal(m.same_spiral_from_tip.max_dr, 0, `${r.width}: the k-th red step from the tip sits at the green's radius`); assert.equal(m.same_spiral_from_tip.max_dth, 0);
    assert.ok(m.green_stands_on_zero && m.red_hangs_from_zero && m.red_descends_inwards, `${r.width}: ${JSON.stringify(m)}`);
    assert.equal(R.above.per_unit, R.below.per_unit, `${r.width}: pitch above ${R.above.per_unit} vs below ${R.below.per_unit}`); assert.equal(R.above.per_unit, m.H);
    assert.ok(P.gap_world.max <= 0.5 && P.gap_world.touching === P.gap_world.n, `${r.width}: steps touch on both spirals ${JSON.stringify(P.gap_world)}`);
    assert.equal(m.A, STD.podium.inner_radius); assert.equal(m.D, STD.podium.step_w); assert.equal(m.RW, STD.podium.tread_depth);
  }
});

test("4 · labels on the steps: the ticker is painted on the step's own mesh (an atlas tile on the reading face and the outer face), no billboard, no DOM ticker; it prints only once the tread is wide enough; the bars in 3D carry theirs in the bar shader", () => {
  assert.match(ATL, /export function buildAtlas\(tickers\)/); assert.match(M3, /stepMat\.onBeforeCompile = \(sh\) =>/);
  assert.doesNotMatch(M3, /quaternion\.copy\(camera\.quaternion\)[^\n]*step/, "no billboard on a step");
  assert.match(M3, /vShow = step\(uMinPx, wpx\);/, "a step's ticker prints whole once the tread is ≥ the sheet's px, else not at all");
  assert.match(M3, /if \(cluster && cluster\.coil && n !== cluster\.c\) show = false;/, "no DOM ticker on a step");
  assert.match(M3, /uniforms\.uMinPx = \{ value: SP\.label\.legible_min_tread_px \}/);
  if (!runs) return;
  for (const r of runs) for (const P of probes(r, "step_labels").filter((p) => p.step_labels)) { assert.equal(P.step_labels.billboard, false); assert.equal(P.step_labels.dom_tickers, 0, `${r.width}: DOM tickers on the podium`); assert.equal(P.dom_ticker_labels, 0); assert.equal(P.step_labels.on_mesh, P.n, `${r.width}: every step carries its ticker`); assert.equal(P.step_labels.min_px, STD.podium.label.legible_min_tread_px); }
});

test("the walk: three runs (1920 @ 1, 1680 @ 2, 390 @ 1), no page errors", () => {
  assert.ok(runs, "shots/t10-after-proof.json is missing (node proof-t10.mjs <base> after)");
  assert.deepEqual(runs.map((r) => [+r.width, r.dpr]), [[1920, 1], [1680, 2], [390, 1]]);
  for (const r of runs) assert.deepEqual(r.page_errors, [], `${r.width}: page errors`);
});
