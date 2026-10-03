// T3 tree canvas (1 Oct): the CANVAS is the same tree as the whole-market 3D laid flat (same module, same balls, bars, labels
// and lines; the flat layout; the camera straight on; rotation locked), a click lifts an area into 3D and back returns to
// the same spot and zoom, LAYERS is gone, and the headless navigation run found every printed label within a few pixels of
// its node in every shot at 1680 and 390.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const PAGE = readFileSync(join(DIR, "index.html"), "utf8");
const M3 = readFileSync(join(DIR, "map3d.js"), "utf8");

test("the canvas is the same tree as the 3D: one module, the flat layout, the camera straight on, rotation locked, zoom toward the pointer; LAYERS is gone", () => {
  assert.match(PAGE, /id="v-canvas"/); assert.match(PAGE, /id="v-3d"/); assert.match(PAGE, /id="v-outline"/);
  assert.doesNotMatch(PAGE, /v-layers|layers\.js|layersLabelsNow|setLevel/);
  assert.ok(!existsSync(join(DIR, "layers.js")) && !existsSync(join(DIR, "layers-layout.js")), "the boxed LAYERS files are removed");
  assert.match(PAGE, /PHONE \? "outline" : "canvas"/, "CANVAS is the desktop default, OUTLINE the phone default");
  assert.match(M3, /function setCanvas\(on/);
  assert.match(M3, /controls\.enableRotate = !on; controls\.zoomToCursor = on/);
  assert.match(M3, /LEFT: on \? THREE\.MOUSE\.PAN/);
  assert.match(M3, /if \(on !== state\.flat\) setFlat\(on, ms\)/, "the canvas uses the tree's own flat layout");
  // the same layout module and the same bar shader serve both the canvas and the 3D
  assert.match(M3, /import \{ prepareTree, layout as layoutTree, bestRows, LAYOUT \} from "\.\/layout\.js"/);
  assert.equal((M3.match(/new THREE\.ShaderMaterial\(/g) || []).length, 1, "one bar material for every flat bar; T8 replaced T7's standing-column strip shader with instanced step meshes (the staircase)");
  assert.match(M3, /const mkBarMat = \(o\) => new THREE\.ShaderMaterial\(/); assert.match(M3, /new THREE\.InstancedMesh\(stepGeo, stepMat/, "T8: the podium's steps are one instanced mesh");
});

test("a click lifts an area into 3D with the subtree's own 3D positions and the 'also in' links; the finder and the card only fly; back drops to the canvas", () => {
  assert.match(M3, /function select\(n, fly = true, lift = false\)/);
  assert.match(M3, /if \(state\.canvas && lift && isBranch\(n\)\)[^\n]*enterArea\(n\)/);
  assert.match(M3, /select\(n, true, true\)/, "a canvas click lifts");
  assert.match(M3, /const L3 = state\.layoutOf\(1\)/, "the area uses the tree's 3D layout");
  assert.match(M3, /for \(const a of m\.also_in \|\| \[\]\) if \(!inSub\.has\(a\.id\)\) nbIds\.add\(a\.id\)/, "neighbours are the names' other cohorts and fund sets");
  assert.doesNotMatch(M3.slice(M3.indexOf("function enterCluster")), /T_HELD\[m\.ticker\]/, "holders are not drawn as neighbours (T2 decision 2)");
  assert.match(M3, /controls\.enableRotate = true; freeOrbit\(\); \/\/ orbit is allowed inside an area/); // T9: the full orbit, left button turns
  assert.match(M3, /if \(fly\) flyTo\(b, 700\); \/\/ back to the same spot and zoom/);
  assert.match(PAGE, /e\.key !== "Escape"[\s\S]*closeArea/);
  assert.match(PAGE, /← back to the canvas/);
});

test("the renderer sizes for any device scale: CSS size = the box, buffer = CSS × scale, the ratio set on resize, labels in CSS px", () => {
  assert.match(M3, /renderer\.setPixelRatio\(dprNow\(\)\); renderer\.setSize\(view\.w, view\.h, true\)/, "setSize must update the canvas CSS size (the Retina bug)");
  assert.doesNotMatch(M3, /renderer\.setSize\(view\.w, view\.h, false\)/);
  assert.match(M3, /const dprNow = \(\) => Math\.max\(1, Math\.min\(3, devicePixelRatio \|\| 1\)\)/);
  assert.match(M3, /watchScale/, "a window moved between screens re-fits");
  assert.match(M3, /const sx = \(V\.x \+ 1\) \* view\.w \/ 2, sy = \(1 - V\.y\) \* view\.h \/ 2/, "labels are projected in CSS px from the same view size");
  assert.match(PAGE, /drag to pan · scroll to zoom · OPEN 3D on a section lifts only that section/); // T6: the hint names the button
});

test("the headless navigation run at device scale 1 AND 2, 1680 and 390: every label within a few pixels of its node, the canvas CSS size is the box and the buffer is CSS × scale, the pose restored after back", () => {
  const f = join(DIR, "shots/nav-proof.json");
  assert.ok(existsSync(f), "shots/nav-proof.json (written by the navigation proof) is missing");
  const runs = JSON.parse(readFileSync(f, "utf8"));
  assert.ok(runs.length >= 4, "four runs: 1680 and 390 at scale 1 and 2");
  assert.deepEqual([...new Set(runs.map((r) => r.dpr))].sort(), [1, 2]);
  let checks = 0;
  for (const run of runs) {
    assert.deepEqual(run.page_errors, [], `${run.width}@${run.dpr}: page errors`);
    const views = new Set();
    for (const step of run.log) if (step.labels) {
      const L = step.labels; checks++; views.add(L.view);
      const c = L.canvas;
      assert.ok(c && c.css && c.buffer, `${run.width}@${run.dpr}: no canvas sizes recorded`);
      assert.ok(Math.abs(c.css[0] - c.w) <= 1 && Math.abs(c.css[1] - c.h) <= 1, `${run.width}@${run.dpr} ${L.view}: canvas CSS ${c.css} is not the box ${[c.w, c.h]}`);
      assert.ok(Math.abs(c.buffer[0] - c.css[0] * c.dpr) <= 2 && Math.abs(c.buffer[1] - c.css[1] * c.dpr) <= 2, `${run.width}@${run.dpr} ${L.view}: buffer ${c.buffer} is not CSS × ${c.dpr}`);
      assert.ok(L.count > 0, `${run.width}@${run.dpr} ${L.view}: no labels printed`);
      assert.ok(L.max_dx <= 3, `${run.width} ${L.view}: a label is ${L.max_dx}px off its node sideways`);
      assert.ok(L.min_dy >= -50 && L.max_dy <= 80, `${run.width} ${L.view}: a label is ${L.min_dy}…${L.max_dy}px off its node vertically`);
      assert.equal(L.outside, 0, `${run.width} ${L.view}: ${L.outside} labels outside the canvas`);
    }
    assert.ok(views.has("canvas"), `${run.width}: no label check on the canvas`);
    const first = run.log.find((x) => x.state || (x.pose && Object.keys(x).length === 1));
    const a = run.log.find((x) => x.area); assert.ok(a && a.after.area && a.after.areaCount.names > 0, `${run.width}: the area did not open`);
    assert.equal(a.after.view, "canvas");
    const poseBefore = run.log.slice(0, run.log.indexOf(a)).reverse().find((x) => x.pose && Object.keys(x).length === 1);
    const b = run.log.find((x) => x.back); assert.ok(b && !b.after.area, `${run.width}: back did not close the area`);
    assert.equal(b.pose.rotate, false, `${run.width}: rotation unlocked after back`);
    if (poseBefore) for (const k of ["p", "t"]) for (let i = 0; i < 3; i++) assert.ok(Math.abs(b.pose[k][i] - poseBefore.pose[k][i]) <= Math.max(2, 0.02 * poseBefore.pose.d), `${run.width}: ${k}[${i}] moved from ${poseBefore.pose[k][i]} to ${b.pose[k][i]} after back`);
    const firstPose = run.log.find((x) => x.pose && Object.keys(x).length === 1);
    const w = run.log.find((x) => x.wheel); assert.ok(w && firstPose && w.pose.d < firstPose.pose.d * 0.5, `${run.width}: the wheel did not zoom in (${firstPose && firstPose.pose.d} → ${w && w.pose.d})`);
    void first;
  }
  assert.ok(checks >= 8, `only ${checks} label checks`);
});
