// T9 (2 Oct, late night): the podium you can turn freely and walk down, the red half coiling like the green, less black between
// things. Checked on the code and on the headless walk's record (shots/t9-after-proof.json: 1920 × 1080 at scale 1, 1680 × 1000
// at scale 2, 390 at 1; node proof-t9.mjs <base> after — and shots/t9-before-proof.json, the same walk on T8's page).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const PAGE = readFileSync(join(DIR, "index.html"), "utf8"), M3 = readFileSync(join(DIR, "map3d.js"), "utf8");
const load = (f) => (existsSync(join(DIR, "shots", f)) ? JSON.parse(readFileSync(join(DIR, "shots", f), "utf8")) : null);
const runs = load("t9-after-proof.json"), before = load("t9-before-proof.json");
const desk = (rs) => (rs || []).filter((r) => +r.width >= 1000);
const probes = (r, key) => r.log.filter((x) => x.probe && x.value && key in x.value).map((x) => x.value);
const blacks = (r) => Object.fromEntries(r.log.filter((x) => x.black).map((x) => [x.black.replace(/^\d+-/, ""), x.value.black_share]));

test("1 · red coils like green: one rule for every step (tread = reading × H, one H above and below zero), no flat run for the names with no reading, and the proof prints the pitch above / below / at the crossing", () => {
  assert.match(M3, /const treadOf = \(i\) => \(i < withV\.length \? withV\[i\]\.v \* H : 0\);/, "T10: one formula for every tread (reading × H); a no-reading step is a slab at zero past the red base");
  assert.doesNotMatch(M3, /tread = v == null \? floor \+ 2 : v \* H/, "T8's flat run at the floor is gone");
  assert.match(M3, /state\.pitchRule = \(\) =>/, "the pitch rule is printed for the proof");
  if (!runs) return;
  for (const r of runs) for (const P of probes(r, "rule")) {
    const R = P.rule; assert.ok(R, `${r.width}: the rule was read`);
    assert.equal(R.above.per_unit, R.below.per_unit, `${r.width} ${P.bar.slice(0, 22)}: pitch above ${R.above.per_unit} vs below ${R.below.per_unit} per unit of reading`);
    assert.equal(R.above.per_unit, R.H); assert.equal(R.above.per_unit_min, R.above.per_unit_max, `${r.width}: every green drop is the same rule`); assert.equal(R.below.per_unit_min, R.below.per_unit_max, `${r.width}: every red drop is the same rule`);
    if (R.crossing) assert.equal(R.crossing.per_unit, R.H, `${r.width}: no change of pitch where ${R.crossing.from} → ${R.crossing.to} crosses zero`);
    assert.ok(P.vMono, `${r.width}: the readings fall all the way down`); assert.ok(P.gap_world.max <= 0.5 && P.gap_world.touching === P.gap_world.n, `${r.width}: no gap between steps ${JSON.stringify(P.gap_world)}`);
    assert.ok(P.first.tread > 0 && P.last.tread < 0, `${r.width}: the stair crosses zero (first ${P.first.tread}, last ${P.last.tread})`);
  }
});

test("2 · free rotation: no pitch or yaw clamp inside the podium or a section's 3D, the left button and one finger TURN (the canvas's pan mapping is given back on exit), 70° start, RESET VIEW and a double-click return to it", () => {
  assert.match(M3, /function freeOrbit\(\) \{ controls\.minPolarAngle = 0; controls\.maxPolarAngle = Math\.PI; controls\.minAzimuthAngle = -Infinity; controls\.maxAzimuthAngle = Infinity; controls\.enabled = true; orbitButtons\(true\); \}/);
  assert.doesNotMatch(M3, /(min|max)PolarAngle = (?!0|Math\.PI)/, "no other polar clamp anywhere");
  assert.match(M3, /controls\.enableRotate = true; freeOrbit\(\); \/\/ T9: the full orbit/); assert.match(M3, /controls\.enableRotate = true; freeOrbit\(\); \/\/ orbit is allowed inside an area/);
  assert.match(M3, /controls\.enableRotate = cluster\.rotate; orbitButtons\(false\);/, "the canvas's buttons come back on exit");
  assert.match(M3, /el: qn\("sel", SP\.camera\.home_el\)/, "T10: the start is the sheet's camera (24°, so both snakes show)"); assert.match(M3, /cluster\.home = to;/); assert.match(M3, /cluster\.home = framing\(\[root, \.\.\.sub, \.\.\.nbs\], DIR3, 0\.8\);/);
  assert.match(M3, /renderer\.domElement\.addEventListener\("dblclick", \(e\) => \{ if \(!cluster\) return; e\.preventDefault\(\); resetView\(700\); \}\);/);
  assert.match(PAGE, /<button data-go="reset" title="back to the starting view \(a double-click on the canvas does the same\)">RESET VIEW<\/button>/);
  if (!runs) return;
  for (const r of desk(runs)) {
    const P = probes(r, "limits").filter((p) => p.limits); assert.ok(P.length >= 4);
    for (const p of P) { assert.deepEqual([p.limits.minPolar, p.limits.maxPolar, p.limits.minAz, p.limits.maxAz], [0, Math.PI, null, null], `${r.width}: limits ${JSON.stringify(p.limits)} (±Infinity prints as null)`); assert.equal(p.limits.left, "rotate", `${r.width}: the left button turns`); assert.equal(p.limits.one_finger, "rotate"); }
    const els = P.filter((p) => p.count && !p.count.list).map((p) => p.elevation.el); assert.ok(els.includes(6) && els.includes(-16), `${r.width}: the camera stood at the side (6°) and below the rim (−16°): ${els}`);
    const drag = r.log.find((x) => x.drag && x.drag[1] !== x.drag[3] && x.drag[0] === x.drag[2]); assert.ok(drag && drag.elevation.el < 60, `${r.width}: a real upward drag lowered the camera (T8: the drag panned, the angle stayed 70)`);
    for (const d of r.log.filter((x) => x.dblclick)) assert.deepEqual(d.pose.p, d.home.p, `${r.width}: a double-click brought the camera home`);
  }
});

test("3 · the walk: WALK on the top bar, ↓ / J / wheel / ▼ one step down, ↑ / K / ▲ one step up, Esc leaves (the podium stays), an eased move per step, the step's ticker and reading large, the phone's ▲ ▼", () => {
  assert.match(M3, /const WALK = \{ ms: qn\("wms", 480\), eye: qn\("weye", 120\), back: qn\("wback", 3\.2\), ahead: qn\("wahead", 12\), fov: qn\("wfov", 62\) \};/);
  assert.match(M3, /walkStep\(1\);\n\s+else if \(k === "ArrowUp" \|\| k === "k" \|\| k === "K" \|\| k === "PageUp"\) walkStep\(-1\);/); assert.match(M3, /if \(k === "ArrowDown" \|\| k === "j" \|\| k === "J" \|\| k === "PageDown"\) walkStep\(1\);/);
  assert.match(M3, /else if \(k === "Escape"\) setWalk\(false\);/); assert.match(M3, /walkStep\(e\.deltaY > 0 \? 1 : -1\);/, "the wheel walks");
  assert.match(M3, /flyTo\(walkPose\(i\), ms\);/, "an eased move per step (flyTo's ease), not a jump");
  assert.match(PAGE, /<div id="walkhud" style="display:none"><\/div>/); assert.match(PAGE, /#walkhud b\{font-size:34px/); assert.match(PAGE, /#walkhud button\{font-size:24px;padding:14px 18px\}/, "the phone's ▲ ▼");
  assert.match(PAGE, /<button data-go="walk"\$\{walking \? ' class="on"' : ""\}/); assert.match(PAGE, /if \(m3 && m3\.walking && m3\.walking\(\)\) \{ m3\.walk\(false\); crumbs\(\); return; \}/, "Esc leaves the walk first");
  if (!runs) return;
  for (const r of runs) {
    const W = probes(r, "walking"); const on = W.filter((w) => w.walking);
    assert.ok(on.length >= 4, `${r.width}: the walk was recorded`);
    assert.equal(on[0].at, 0, `${r.width}: the walk starts at the winner`); assert.equal(on[1].at, 1, `${r.width}: one key / tap = one step`); assert.equal(on[2].at, 2);
    assert.ok(on.every((w) => w.hud === "flex" && /#\d+ of \d+/.test(w.hudText) && w.hudFont >= 30), `${r.width}: the HUD shows rank, ticker and reading large (${on[0].hudFont} px)`);
    assert.ok(on.every((w) => w.bar.includes("WALKING · Esc leaves")), `${r.width}: the top bar says WALKING`);
    const off = W.at(-1); assert.ok(!off.walking && off.hud === "none" && off.area === "SEC_TECH", `${r.width}: Esc left the walk, the podium stayed: ${JSON.stringify([off.walking, off.hud, off.area, off.elevation])}`);
    if (+r.width >= 1000) { const seq = on.map((w) => w.at); assert.deepEqual(seq.slice(0, 7), [0, 1, 2, 9, 8, 7, 112], `${r.width}: ↓, J, 7 × ↓, ↑, wheel up, End: ${seq}`); }
    else assert.deepEqual(on.map((w) => w.at), [0, 1, 2, 1], `${r.width}: ▼ ▼ ▲ on the phone: ${on.map((w) => w.at)}`);
  }
});

test("4 · black between things: the podium's and the opened section's share of empty black falls (T8 → T9), labels never overlap another label or another thing's box (CLEAN and the opened section), the staircase's inner radius 30 (was 46), the podium's fill 0.9", () => {
  assert.match(M3, /const PARAMS = \{ stand: \{ A: qn\("sa", SP\.inner_radius\)/, "T10: from the sheet (30)"); assert.match(M3, /const to = framing\(frameList, dirOf\(above \? PARAMS\.above : PARAMS\.stand\), 0\.9\);/);
  assert.match(M3, /const LABEL_DEPTH = 40;/); assert.match(M3, /0\.94, getPos, Math\.min\(0\.55, bottomBand\(\)/);
  if (!runs) return;
  for (const r of desk(runs)) {
    const B = blacks(r), B0 = before ? blacks(before.find((b) => b.width === r.width)) : null;
    // T10: the T9 record stays as it was taken (the mirror is measured by tree-standard.test.mjs)
    if (B0) { assert.ok(B["podium-tech"] < B0["podium-tech"] - 0.1, `${r.width}: podium ${B0["podium-tech"]} → ${B["podium-tech"]}`); assert.ok(B["area-tech"] <= B0["area-tech"] + 0.002, `${r.width}: Technology opened ${B0["area-tech"]} → ${B["area-tech"]} (T8's frame kept: a fuller one put a ticker on a box at 1680)`); assert.ok(B["clean"] <= B0["clean"] + 0.001, `${r.width}: CLEAN ${B0["clean"]} → ${B["clean"]}`); }
    for (const S of probes(r, "label_on_other_box").filter((s) => !s.area || s.area === "SEC_TECH")) { const inPodium = probes(r, "rule").length && r.log.indexOf(r.log.find((x) => x.probe && x.value === S)) > r.log.findIndex((x) => x.eval === "__mm.openCoil('SEC_TECH')"); if (inPodium) continue; assert.equal(S.label_on_label, 0, `${r.width} ${S.area || "CLEAN"}: labels on labels`); assert.equal(S.label_on_other_box, 0, `${r.width} ${S.area || "CLEAN"}: ${S.label_on_other_box} labels on another thing's box`); }
    for (const P of probes(r, "rule")) assert.equal(P.label_on_label, 0, `${r.width} podium: tickers never overlap`);
  }
});

test("the walk: three runs (1920 @ 1, 1680 @ 2, 390 @ 1), no page errors", () => {
  assert.ok(runs, "shots/t9-after-proof.json is missing (node proof-t9.mjs <base> after)");
  assert.deepEqual(runs.map((r) => [+r.width, r.dpr]), [[1920, 1], [1680, 2], [390, 1]]);
  for (const r of runs) assert.deepEqual(r.page_errors, [], `${r.width}: page errors`);
});
