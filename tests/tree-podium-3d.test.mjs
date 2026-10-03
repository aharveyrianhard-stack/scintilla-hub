// T7 (2 Oct, evening): the podium standing up — PODIUM 3D (the default) | FROM ABOVE on the top bar; ★ FAVORITES and ♥ LIKED
// as podiums read from the Hub's own browser mirror; an empty list says so in one line; Esc drops back. T8 (2 Oct, night)
// brought it to the new truth: the standing podium is a STAIRCASE of touching steps on one floor (T7's ramp, helix and
// billboard columns are gone — see tests/tree-big-geigers.test.mjs for the staircase itself), ◎ RADAR joins the two lists
// in one MY LISTS area, and the record read is T8's (shots/t8-after-proof.json: 1920 @ 1, 1680 @ 2 with 30 FAVORITES,
// 60 LIKED and 30 RADAR planted under the Hub's keys, 390 @ 1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const PAGE = readFileSync(join(DIR, "index.html"), "utf8"), M3 = readFileSync(join(DIR, "map3d.js"), "utf8"), PROOF = readFileSync(join(DIR, "proof.mjs"), "utf8"), WALKER = readFileSync(join(DIR, "proof-t8.mjs"), "utf8");
const HUB = readFileSync(join(ROOT, "index.html"), "utf8");
const WALK = join(DIR, "shots/t8-after-proof.json");
const runs = existsSync(WALK) ? JSON.parse(readFileSync(WALK, "utf8")) : null;
const podiums = (r) => r.log.filter((x) => x.probe && x.value && "neighbour_gap_px" in x.value).map((x) => x.value);
const listsOf = (r) => r.log.filter((x) => x.probe && x.value && x.value.lists).map((x) => x.value);

test("1 · PODIUM 3D | FROM ABOVE on the top bar, 3D the default; standing, the podium is a staircase on one floor; from above, the same steps as flat slabs", () => {
  assert.match(M3, /state\.podium = Q\.get\("podium"\) === "above" \? "above" : "3d";/, "PODIUM 3D is the default when a podium opens");
  assert.match(M3, /const y0 = above \? p\.tread - 1\.5 : Math\.min\(p\.base, p\.tread\), y1 = above \? p\.tread \+ 1\.5 : Math\.max\(p\.base, p\.tread\);/, "standing: floor → tread; from above: a slab at the tread");
  assert.match(M3, /above: \{ el: qn\("pel", SP\.camera\.above_el\), az: qn\("paz", SP\.camera\.home_az\) \}/, "FROM ABOVE looks from 88° up");
  assert.match(M3, /function setPodium\(mode\)/); assert.match(M3, /setPodium, podiumMode: \(\) => state\.podium/);
  assert.match(PAGE, /<span class="seg" id="podium-seg"[^>]*><button data-go="above"[^>]*>FROM ABOVE<\/button><button data-go="3d"[^>]*>PODIUM 3D<\/button><\/span>/, "the toggle on the top bar");
  assert.match(PAGE, /if \(b\.dataset\.go === "above" \|\| b\.dataset\.go === "3d"\) \{ if \(m3\) m3\.setPodium\(b\.dataset\.go\); return; \}/);
  if (!runs) return;
  for (const d of runs.filter((r) => +r.width >= 1000)) {
    const stand = podiums(d).filter((p) => p.mode === "3d" && !p.count.list), above = podiums(d).filter((p) => p.mode === "above");
    assert.ok(stand.length >= 1 && above.length === 1, `${d.width}: the Technology podium was measured standing and from above`);
    for (const p of [...stand, ...above]) { assert.equal(p.n, 113); assert.ok(p.vMono && p.rMono && p.treadMono, `${d.width} ${p.mode}: the three orders along the spiral`); assert.ok(p.bar.includes("PODIUM COIL") && p.bar.includes("← BACK TO THE CANVAS") && p.bar.includes("≡ LIST"), `the top bar: ${p.bar}`); assert.ok(p.focused, "the canvas holds focus so Esc works"); }
  }
});

test("2 · the Hub's lists as podiums: ★ FAVORITES, ♥ LIKED, ◎ RADAR in one MY LISTS area, read from the Hub's own browser mirror under the Hub's keys, each opening straight as a podium (3D); an empty list a one-line note, never a blank", () => {
  assert.match(HUB, /const LISTS_LS_KEY = "sc_lists";/); assert.match(HUB, /lsSet\("sc_fav", JSON\.stringify\(S\.fav\)\)/);
  assert.match(HUB, /function listsRemember\(\) \{ try \{ lsSet\(LISTS_LS_KEY, JSON\.stringify\(\{ favorites: LISTS\.favorites, radar: LISTS\.radar \}\)\); \}/);
  assert.match(PAGE, /\{ id: "LIST_FAVORITES", glyph: "★", name: "FAVORITES", key: "sc_lists", read: \(raw\) => \{ const o = JSON\.parse\(raw \|\| "null"\); return o && Array\.isArray\(o\.favorites\) \? o\.favorites : null; \} \}/);
  assert.match(PAGE, /\{ id: "LIST_LIKED", glyph: "♥", name: "LIKED", key: "sc_fav", read: \(raw\) => \{ const a = JSON\.parse\(raw \|\| "null"\); return Array\.isArray\(a\) \? a : null; \} \}/);
  assert.match(PAGE, /\{ id: "LIST_RADAR", glyph: "◎", name: "RADAR", key: "sc_lists", read: \(raw\) => \{ const o = JSON\.parse\(raw \|\| "null"\); return o && Array\.isArray\(o\.radar\) \? o\.radar : null; \} \}/);
  assert.doesNotMatch(PAGE, /supabase\.co|apikey|Bearer /, "the tree page copies no key and calls no server for the lists");
  assert.match(PAGE, /O\.innerHTML = myListsHTML\(\) \+ /, "the MY LISTS block at the top of the outline, apart from the tree");
  assert.match(PAGE, /<div id="listbar" style="display:none"><\/div>/); assert.match(PAGE, /function paintLists\(\)/, "the MY LISTS area at the top of the canvas");
  assert.match(PAGE, /const listEmptyNote = \(n\) => \(n\.name === "FAVORITES" \? "no favorites in this browser yet" : n\.name === "RADAR" \? "no radar names in this browser yet" : "no liked names in this browser yet"\)/);
  assert.match(PAGE, /if \(!n\.listMembers\.length\) \{ h \+= `<div class="wait">\$\{esc\(listEmptyNote\(n\)\)\}<\/div>`; \$\("card"\)\.innerHTML = h; return; \}/, "an empty list: the note on the card, no podium");
  assert.match(M3, /const all = root\.listMembers \? root\.listMembers : beneathNames\(root\);/, "a list carries its own members into the podium");
  assert.match(WALKER, /localStorage\.setItem\("sc_lists"/); assert.match(WALKER, /localStorage\.setItem\("sc_fav"/); assert.match(WALKER, /FAVS = served\.slice\(0, 30\), LIKED = served\.slice\(0, 60\), RADAR = served\.slice\(100, 130\)/, "the walk plants 30 / 60 / 30 real served tickers under the Hub's keys");
  assert.match(PROOF, /PROOF_INIT/);
  if (!runs) return;
  for (const d of runs.filter((r) => +r.width >= 1000)) {
    const L = listsOf(d)[0];
    assert.deepEqual(L.lists.map((l) => [l.id, l.on_hub_list, l.on_tree, l.known]), [["LIST_FAVORITES", 30, 30, true], ["LIST_LIKED", 60, 60, true], ["LIST_RADAR", 30, 30, true]], "the planted lists are read whole");
    assert.ok(L.chips.length === 3 && L.chips[0][0].startsWith("★ FAVORITES (30)") && L.chips[1][0].startsWith("♥ LIKED (60)") && L.chips[2][0].startsWith("◎ RADAR (30)") && L.chips.every((c) => c[1]), `the three buttons: ${JSON.stringify(L.chips)}`);
    const fav = podiums(d).find((p) => p.count.list && p.bar.startsWith("★ FAVORITES")), radar = podiums(d).find((p) => p.count.list && p.bar.startsWith("◎ RADAR"));
    assert.ok(fav && fav.mode === "3d" && fav.bars === 30 && fav.treadMono, `the FAVORITES podium opened standing: ${fav && fav.bar}`);
    assert.ok(radar && radar.mode === "3d" && radar.bars === 30 && radar.treadMono && radar.gap_world.touching === 29, `the RADAR podium opened standing, steps touching: ${radar && radar.bar}`);
    const escs = d.log.filter((x) => x.key === "Escape"); assert.ok(escs.length >= 2 && escs.every((e) => e.after.area === null), "Esc drops back out of every podium and area");
    const outline = listsOf(d).at(-1); assert.ok(outline.rows.length === 3 && outline.rows[0].startsWith("★ FAVORITES (30)") && outline.rows[1].startsWith("♥ LIKED (60)") && outline.rows[2].startsWith("◎ RADAR (30)"), `the rows in the MY LISTS block: ${JSON.stringify(outline.rows)}`);
  }
});

test("the walk: three runs, no page errors, every label within a few px of its anchor; the 390 phone shows the standing podium too", () => {
  assert.ok(runs, "shots/t8-after-proof.json is missing (node proof-t8.mjs <base> after)");
  assert.deepEqual(runs.map((r) => [+r.width, r.dpr]), [[1920, 1], [1680, 2], [390, 1]]);
  for (const r of runs) { assert.deepEqual(r.page_errors, [], `${r.width}: page errors`); for (const x of r.log) if (x.labels) { assert.equal(x.labels.outside, 0); assert.ok(x.labels.max_dx <= 3, `${r.width}: dx ${x.labels.max_dx}`); } }
  const ph = podiums(runs[2]); assert.ok(ph.length >= 1 && ph.every((p) => p.mode === "3d" && p.treadMono), "the phone: Technology standing");
});
