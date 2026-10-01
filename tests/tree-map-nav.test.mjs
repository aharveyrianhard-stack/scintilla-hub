// T2 tree navigation (30 Sep): the flat LAYERS map is whole (every heading, cohort and fund has a box; boxes nest inside
// their parent; a cohort is never deeper than level 4), the level steps hide depth and nothing else, a label is anchored ON
// its node, and the headless navigation run found every printed label within a few pixels of its node in every shot.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const { layoutLayers, labelAnchor, visibleAt, PAD, TITLE } = await import(join(DIR, "layers-layout.js"));
const T = JSON.parse(readFileSync(join(DIR, "tree.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "index.html"), "utf8");
const M3 = readFileSync(join(DIR, "map3d.js"), "utf8");
const { rects, order } = layoutLayers(T.nodes, 1600, 1000);

test("every heading, cohort and fund has a box on the flat map; names are not boxes; boxes nest inside their parent's", () => {
  for (const n of T.nodes) {
    if (n.kind === "name") { assert.ok(!rects.has(n.id), `${n.id}: a name is not a box on the broad map`); continue; }
    if (n.id === "US_SECTORS") { assert.ok(!rects.has(n.id), "US SECTORS is folded away"); continue; }
    const r = rects.get(n.id);
    assert.ok(r, `${n.id} has no box`);
    assert.ok(r.w >= 0 && r.h >= 0);
    if (r.parent) { const p = rects.get(r.parent); const eps = 0.01; assert.ok(r.x >= p.x - eps && r.y >= p.y - eps && r.x + r.w <= p.x + p.w + eps && r.y + r.h <= p.y + p.h + eps, `${n.id} sticks out of ${r.parent}`); }
  }
  assert.equal(order[0], "MARKET");
  assert.deepEqual(rects.get("MARKET"), { ...rects.get("MARKET"), x: 0, y: 0, w: 1600, h: 1000, level: 1 });
});

test("levels: the market is 1, its asset classes 2, the sectors 3, every cohort 4; a step shows depth up to it and hides the rest", () => {
  assert.equal(rects.get("MARKET").level, 1);
  for (const id of ["US", "WORLD", "BONDS", "CMDTY", "CRYPTO", "MACRO"]) assert.equal(rects.get(id).level, 2, id);
  for (const id of ["SEC_TECH", "SEC_FIN", "US_BROAD", "INTL_DEV", "EM"]) assert.equal(rects.get(id).level, 3, id);
  for (const n of T.nodes.filter((x) => x.kind === "cohort")) assert.equal(rects.get(n.id).level, 4, n.id);
  for (const n of T.nodes.filter((x) => x.kind === "fund")) assert.equal(rects.get(n.id).level, 4, n.id);
  const at = (l) => [...rects.values()].filter((r) => visibleAt(l, r)).length;
  assert.equal(at(1), 1); assert.equal(at(2), 7);
  assert.ok(at(3) > at(2) && at(4) > at(3));
  assert.equal(at(4), rects.size);
  // a child is never shown when its parent is hidden
  for (const [id, r] of rects) if (r.parent) assert.ok(rects.get(r.parent).level <= r.level, id);
});

test("a label is anchored ON its node: a region's title strip, a leaf's middle; nothing is ever placed in a side column", () => {
  for (const [id, r] of rects) {
    const a = labelAnchor(r);
    if (r.region) { assert.equal(a.x, r.x + PAD); assert.equal(a.y, r.y + TITLE / 2); assert.equal(a.align, "left"); }
    else { assert.equal(a.x, r.x + r.w / 2); assert.equal(a.y, r.y + r.h / 2); assert.equal(a.align, "center"); }
    assert.ok(a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h, `${id}: anchor outside its box`);
  }
  // the 3D view: a label is centred on its ball and hidden off-screen, never clamped to the canvas edge
  assert.match(M3, /x = c\.sx - w \/ 2; \/\/ centred on the ball/);
  assert.doesNotMatch(M3, /Math\.max\(2, Math\.min\(view\.w - w - 2/);
  assert.match(M3, /V\.x < -1\.02 \|\| V\.x > 1\.02/);
  assert.match(M3, /state\.labelsNow = /);
});

test("the page has the three views, the level steps, the breadcrumb and the cluster; LAYERS is the desktop default, OUTLINE the phone default", () => {
  for (const id of ["v-outline", "v-layers", "v-3d", "levels", "crumbs", "layers"]) assert.match(PAGE, new RegExp(`id="${id}"`));
  assert.match(PAGE, /PHONE \? "outline" : "3d"/);   // 1 Oct: Alan rejected the boxed LAYERS map as the default; the 3D tree is the desktop default again
  assert.match(PAGE, /enterCluster/); assert.match(M3, /function enterCluster/); assert.match(M3, /function exitCluster/);
  assert.match(PAGE, /e\.key !== "Escape"[\s\S]*closeCluster/);
});

test("the headless navigation run: every printed label sits within a few pixels of its node, in every shot, at 1680 and 390", () => {
  const f = join(DIR, "shots/nav-proof.json");
  assert.ok(existsSync(f), "shots/nav-proof.json (written by the navigation proof) is missing");
  const runs = JSON.parse(readFileSync(f, "utf8"));
  assert.ok(runs.length >= 2);
  let checks = 0;
  for (const run of runs) {
    assert.deepEqual(run.page_errors, [], `${run.width}: page errors`);
    for (const step of run.log) if (step.labels) {
      const L = step.labels; checks++;
      assert.ok(L.count > 0, `${run.width} ${L.view}: no labels printed`);
      assert.ok(L.max_dx <= 3, `${run.width} ${L.view}: a label is ${L.max_dx}px off its node sideways`);
      assert.ok(L.min_dy >= -50 && L.max_dy <= 80, `${run.width} ${L.view}: a label is ${L.min_dy}…${L.max_dy}px off its node vertically`);
      assert.equal(L.outside, 0, `${run.width} ${L.view}: ${L.outside} labels outside the canvas`);
    }
    const c = run.log.find((x) => x.cluster); assert.ok(c && c.after.cluster, `${run.width}: the cluster did not open`);
    const b = run.log.find((x) => x.back); assert.ok(b && !b.after.cluster, `${run.width}: back did not close the cluster`);
    const lv = run.log.filter((x) => x.level); assert.ok(lv.length >= 2 && lv.every((x) => x.after.layersLevel === +x.level), `${run.width}: level steps`);
  }
  assert.ok(checks >= 6, `only ${checks} label checks`);
});
