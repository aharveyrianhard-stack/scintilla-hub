// T7 (2 Oct, evening): the podium standing up — PODIUM 3D (the default) | FROM ABOVE on the top bar; a standing Geiger column
// per name on a spiral ramp whose height and radius fall along the spiral; no two bars touch at 1680 wide, device scale 2,
// for Technology (113 names) in either picture; ★ FAVORITES and ♥ LIKED at the top of the tree, read from the Hub's own
// browser mirror, each opening straight as a podium; an empty list says so in one line; Esc drops back. Checked on the code
// and on the headless walk's recorded facts (shots/t7-proof.json: 1680 at device scale 2 with 30 FAVORITES and 60 LIKED
// planted under the Hub's keys, 1680 with nothing planted, 390 at scale 1).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const PAGE = readFileSync(join(DIR, "index.html"), "utf8"), M3 = readFileSync(join(DIR, "map3d.js"), "utf8"), PROOF = readFileSync(join(DIR, "proof.mjs"), "utf8"), WALKER = readFileSync(join(DIR, "proof-t7.mjs"), "utf8");
const HUB = readFileSync(join(ROOT, "index.html"), "utf8");
const WALK = join(DIR, "shots/t7-proof.json");
const runs = existsSync(WALK) ? JSON.parse(readFileSync(WALK, "utf8")) : null;
const podiums = (r) => r.log.filter((x) => x.probe && x.value && "overlaps" in x.value).map((x) => x.value);
const listsOf = (r) => r.log.filter((x) => x.probe && x.value && x.value.lists).map((x) => x.value);
const states = (r) => r.log.filter((x) => x.state).map((x) => x.state);

test("1 · PODIUM 3D: a standing Geiger column per name on a spiral ramp — the ramp is a helix (an even drop per turn), the column rises above the ramp for a positive reading and hangs below it for a negative one, the ticker sits at the tip, the toggle FROM ABOVE | PODIUM 3D is on the top bar and 3D is the default", () => {
  assert.match(M3, /state\.podium = Q\.get\("podium"\) === "above" \? "above" : "3d";/, "PODIUM 3D is the default when a podium opens");
  assert.match(M3, /const rampY = \(th\) => \(-th \/ \(2 \* Math\.PI\)\) \* P\.STEP;/, "the ramp: one turn round = STEP lower");
  assert.match(M3, /n\.podium = \{ foot: new THREE\.Vector3\(x, y0, z\), tip: new THREE\.Vector3\(x, y0 \+ v \* H, z\)/, "the column: foot on the ramp, tip a reading above or below it");
  assert.match(M3, /function standGeometry\(list\)/); assert.match(M3, /const standMat = new THREE\.ShaderMaterial\(/, "the standing column is its own billboarded strip");
  assert.match(M3, /if \(length\(e\) < minL\) e = up \* \(aVal < 0\.0 \? -1\.0 : 1\.0\) \* minL;/, "a tiny reading still shows a stub, the right way up");
  assert.match(M3, /function rampMesh\(members, P\)/, "the ramp is drawn: a stepped ribbon");
  assert.match(M3, /const tries = c\.stand \? \(c\.stand\.up \? \[c\.stand\.tip\[1\] - c\.sy - h - 2, c\.stand\.tip\[1\] - c\.sy \+ 3\]/, "the ticker sits just past the tip");
  assert.match(M3, /function setPodium\(mode\)/); assert.match(M3, /setPodium, podiumMode: \(\) => state\.podium/);
  assert.match(M3, /const PARAMS = \{ above: \{[^}]*\},\n\s+stand: \{[^}]*\} \};/, "each picture has its own spacing");
  assert.match(PAGE, /<span class="seg" id="podium-seg"[^>]*><button data-go="above"[^>]*>FROM ABOVE<\/button><button data-go="3d"[^>]*>PODIUM 3D<\/button><\/span>/, "the toggle on the top bar");
  assert.match(PAGE, /if \(b\.dataset\.go === "above" \|\| b\.dataset\.go === "3d"\) \{ if \(m3\) m3\.setPodium\(b\.dataset\.go\); return; \}/);
  assert.match(M3, /mv\.xy = f\.xy \+ e \* k \+ px \* position\.x \* uW \* s;/, "the column is drawn between its foot and its tip in view space, so it reads from any angle");
  if (!runs) return;
  const d = runs[0];
  const stand = podiums(d).filter((p) => p.mode === "3d" && !p.count.list);
  assert.ok(stand.length >= 2, "the Technology podium was measured standing (on open, and again after FROM ABOVE)");
  for (const p of stand) {
    assert.equal(p.n, 113, `Technology: ${p.n} names`); assert.equal(p.read, 113);
    assert.ok(p.vMono && p.rMono && p.rampMono && p.tipMono, `the three orders along the spiral: readings fall (${p.vMono}), radius grows (${p.rMono}), the ramp falls (${p.rampMono}), the tips fall (${p.tipMono})`);
    assert.ok(p.first.ramp === 0 && p.first.tip > 0 && p.last.ramp < 0 && p.last.tip < p.last.ramp, `first place at the centre on the top step (${JSON.stringify(p.first)}), the last one lowest with its red column hanging below the ramp (${JSON.stringify(p.last)})`);
    assert.ok(p.first.r < p.last.r, "the first at the centre, the last at the outer edge");
    assert.equal(p.bars, 113, "a column for every name");
    assert.ok(p.minW >= 9.5 && p.minH >= 4.5, `the thinnest column still reads: ${p.minW} × ${p.minH} px`);
    assert.ok(p.seg.length === 2 && p.seg[0][0] === "FROM ABOVE" && p.seg[1][0] === "PODIUM 3D" && p.seg[1][1] && !p.seg[0][1], `the toggle shows PODIUM 3D on: ${JSON.stringify(p.seg)}`);
    assert.ok(p.bar.includes("PODIUM COIL") && p.bar.includes("← BACK TO THE CANVAS") && p.bar.includes("≡ LIST"), `the top bar: ${p.bar}`);
    assert.ok(p.focused, "the canvas holds focus so Esc works");
    assert.ok(p.card.includes("standing") && p.card.includes("ramp"), "the card says what the picture is");
  }
  const above = podiums(d).filter((p) => p.mode === "above");
  assert.equal(above.length, 1, "FROM ABOVE was measured once");
  assert.ok(above[0].seg[0][1] && !above[0].seg[1][1], "the toggle shows FROM ABOVE on");
  assert.ok(above[0].vMono && above[0].rMono && above[0].yMono && above[0].rampMono === null, "from above: the flat picture, readings fall, radius grows, height falls");
  const nv = d.log.find((x) => x.hover === "NVDA"); assert.ok(nv && nv.tip.includes("Geiger") && nv.tip.includes("›"), "hover on a column: the full bar and the path");
  const click = d.log.find((x) => x.click === "NVDA"); assert.ok(click && click.after.selected === "NVDA" && !click.after.area, "a click on a column: that name's card, on the tree");
});

test("2 · no two bars touch at 1680 wide, device scale 2, for Technology (113 names) — standing and from above (T6: 62 pairs touched in the flat middle turns)", () => {
  assert.match(WALKER, /run\(1680, 1000, false, 2,/, "the walk runs 1680 at device scale 2");
  assert.match(PROOF, /PROOF_DPR/);
  if (!runs) return;
  const d = runs[0]; assert.equal(+d.width, 1680); assert.equal(d.dpr, 2);
  for (const p of podiums(d).filter((p) => !p.count.list)) assert.equal(p.overlaps, 0, `${p.mode}: ${p.overlaps} of ${p.bars} bars touch another (${JSON.stringify(p.sample)})`);
  for (const p of podiums(d).filter((p) => !p.count.list)) assert.ok(p.labels >= Math.floor(p.n * 0.8), `${p.mode}: ${p.labels} of ${p.n} tickers printed`);
});

test("3 · ★ FAVORITES and ♥ LIKED at the top of the tree: read from the Hub's own browser mirror under the Hub's keys, each opening straight as a podium (3D), an empty list a one-line note, never a blank", () => {
  // the keys are the Hub's: index.html writes "sc_lists" ({favorites, radar}) on every list read and "sc_fav" (the LIKED tickers) on every toggle and read
  assert.match(HUB, /const LISTS_LS_KEY = "sc_lists";/); assert.match(HUB, /lsSet\("sc_fav", JSON\.stringify\(S\.fav\)\)/);
  assert.match(HUB, /function listsRemember\(\) \{ try \{ lsSet\(LISTS_LS_KEY, JSON\.stringify\(\{ favorites: LISTS\.favorites, radar: LISTS\.radar \}\)\); \}/);
  assert.match(PAGE, /\{ id: "LIST_FAVORITES", glyph: "★", name: "FAVORITES", key: "sc_lists", read: \(raw\) => \{ const o = JSON\.parse\(raw \|\| "null"\); return o && Array\.isArray\(o\.favorites\) \? o\.favorites : null; \} \}/);
  assert.match(PAGE, /\{ id: "LIST_LIKED", glyph: "♥", name: "LIKED", key: "sc_fav", read: \(raw\) => \{ const a = JSON\.parse\(raw \|\| "null"\); return Array\.isArray\(a\) \? a : null; \} \}/);
  assert.doesNotMatch(PAGE, /supabase\.co|apikey|Bearer /, "the tree page copies no key and calls no server for the lists");
  assert.match(PAGE, /O\.innerHTML = listRowsHTML\(\) \+ /, "the two rows at the top of the outline");
  assert.match(PAGE, /<div id="listbar" style="display:none"><\/div>/); assert.match(PAGE, /function paintLists\(\)/, "the two chips at the top of the canvas");
  assert.match(PAGE, /const listEmptyNote = \(n\) => \(n\.name === "FAVORITES" \? "no favorites in this browser yet" : "no liked names in this browser yet"\)/);
  assert.match(PAGE, /if \(!n\.listMembers\.length\) \{ h \+= `<div class="wait">\$\{esc\(listEmptyNote\(n\)\)\}<\/div>`; \$\("card"\)\.innerHTML = h; return; \}/, "an empty list: the note on the card, no podium");
  assert.match(M3, /const all = root\.listMembers \? root\.listMembers : beneathNames\(root\);/, "a list carries its own members into the podium");
  assert.match(WALKER, /localStorage\.setItem\("sc_lists"/); assert.match(WALKER, /localStorage\.setItem\("sc_fav"/); assert.match(WALKER, /served\.slice\(0, 30\), LIKED = served\.slice\(0, 60\)/, "the walk plants 30 and 60 real served tickers under the Hub's keys");
  if (!runs) return;
  const d = runs[0], L = listsOf(d)[0];
  assert.deepEqual(L.lists.map((l) => [l.id, l.on_hub_list, l.on_tree, l.known]), [["LIST_FAVORITES", 30, 30, true], ["LIST_LIKED", 60, 60, true]], "the planted lists are read whole");
  assert.ok(L.chips.length === 2 && L.chips[0][0].startsWith("★ FAVORITES (30)") && L.chips[1][0].startsWith("♥ LIKED (60)") && L.chips.every((c) => c[1]), `the chips at the top of the canvas: ${JSON.stringify(L.chips)}`);
  const fav = podiums(d).find((p) => p.count.list && p.n === 30), liked = podiums(d).find((p) => p.count.list && p.n === 60);
  assert.ok(fav && fav.mode === "3d" && fav.bars === 30 && fav.rampMono && fav.bar.startsWith("★ FAVORITES"), `the FAVORITES podium opened standing: ${fav && fav.bar}`);
  assert.ok(liked && liked.mode === "3d" && liked.bars === 60 && liked.rampMono && liked.bar.startsWith("♥ LIKED"), `the LIKED podium opened standing: ${liked && liked.bar}`);
  // the brief's hard line is Technology; the planted lists measured 1 touching pair each on 2 Oct (ANET/AMCR, AXTI/BRK-B) — recorded, see the deliverable
  assert.ok(fav.overlaps <= 2, `FAVORITES: ${fav.overlaps} pairs touch`); assert.ok(liked.overlaps <= 2, `LIKED: ${liked.overlaps} pairs touch`);
  const escs = d.log.filter((x) => x.key === "Escape"); assert.ok(escs.length >= 2 && escs.every((e) => e.after.area === null), "Esc drops back out of both list podiums");
  const outline = listsOf(d).at(-1); assert.ok(outline.rows.length === 2 && outline.rows[0].startsWith("★ FAVORITES (30)") && outline.rows[1].startsWith("♥ LIKED (60)"), `the rows at the top of the outline: ${JSON.stringify(outline.rows)}`);
  // nothing planted: the entries still exist and say so
  const e = runs[1], E = listsOf(e);
  assert.deepEqual(E[0].lists.map((l) => [l.on_hub_list, l.known, l.note]), [[0, false, "no favorites in this browser yet — open the Hub once in this browser and they appear here"], [0, false, "no liked names in this browser yet — open the Hub once in this browser and they appear here"]]);
  const opened = E.at(-1); assert.ok(opened.cardTitle === "★ FAVORITES" && opened.cardNote.startsWith("no favorites in this browser yet"), `an empty list opened: the card says "${opened.cardNote}"`);
  assert.ok(states(e).every((s) => !s.area), "an empty list never opens a podium");
});

test("the walk: three runs, no page errors, every label within a few px of its anchor; the 390 phone shows the standing podium too", () => {
  assert.ok(runs, "shots/t7-proof.json is missing (node proof-t7.mjs)");
  assert.deepEqual(runs.map((r) => [+r.width, r.dpr]), [[1680, 2], [1680, 2], [390, 1]]);
  for (const r of runs) { assert.deepEqual(r.page_errors, [], `${r.width}: page errors`); for (const x of r.log) if (x.labels) { assert.equal(x.labels.outside, 0); assert.ok(x.labels.max_dx <= 3, `${r.width}: dx ${x.labels.max_dx}`); } }
  const ph = podiums(runs[2]); assert.ok(ph.length >= 2 && ph.every((p) => p.mode === "3d" && p.rampMono), "the phone: Technology and FAVORITES standing");
});
