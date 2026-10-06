/* T16 (6 Oct 2026) · the tree's look, properly — preview only (deliverables/20261006/tree-design-preview/).
   Alan, 6 Oct ~09:35 ET: "it's going to the outline page … you have not modified the canvas … there's this question mark everywhere
   … the Geigers are disproportionate … coils would be better in a lot of these areas, with a clickable thing that expands a list …
   it looks ugly, the tree." These tests pin what the preview does about each line:
     1 the canvas is the page at every width: no PHONE → OUTLINE default; the OUTLINE button has left the main bar; the KEY's "list" link
     2 cohorts as coils: a cohort's names are never laid out as boxes; one coil mesh; a click on a coil opens the numbered list (rank ·
       ticker · Geiger · day), a row opens the card; Esc closes the list before anything else
     3 one Geiger scale: GU = the box's half-width; a coil's bar stands GU × |v|; no pixel floor on a box (min 0)
     4 no "?" printed for a missing reading anywhere on the page: the KEY's old remark is gone, a quiet dot and a hover reason instead
     5 the look: no new colour (the page's own :root tokens only), the T15 caption crowding fixed by measuring the small lines
     6 the proof (shots/t16-proof.json, headless Chrome with WebGL): both pages, three widths, five moments each — 0 page errors,
       0 label overlaps and 0 "?" on the preview at every moment, the live page's boxes at their 60 px floor vs the preview's never
       larger than the slot, 62 coils drawn, the AI HARDWARE list with 17 rows
   The live tree (deliverables/20260929/tree-map) and T15's preview are untouched; the Hub's TREE tab still opens the live one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, ".."), P = resolve(ROOT, "deliverables/20261006/tree-design-preview"), T15 = resolve(ROOT, "deliverables/20261005/tree-live-connected");
const R = (p) => readFileSync(p, "utf8");
const page = R(join(P, "index.html")), map = R(join(P, "map3d.js"));

test("1 · the canvas is the page at every width; OUTLINE only by the KEY's list link", () => {
  assert.match(page, /const wanted = p\.get\("view"\) \|\| "canvas";/, "no phone → outline default");
  assert.doesNotMatch(page, /PHONE \? "outline" : "canvas"/);
  assert.match(page, /#v-outline\{display:none\}/, "the OUTLINE button has left the main bar");
  assert.match(page, /id="key-list"/, "a small list link in the KEY");
  assert.match(page, /\$\("key-list"\)\.addEventListener\("click", \(\) => setView\("outline"\)\)/);
});

test("2 · cohorts as coils that open into a numbered list", () => {
  assert.match(map, /const inCoil = \(n\) => n\.kind === "name" && \(state\.byId\.get\(n\.parents\[0\]\) \|\| \{\}\)\.kind === "cohort"/, "a cohort's names live in its coil");
  assert.match(map, /\.filter\(\(n\) => !inCoil\(n\)\)\.map\(\(n\) => layNode\(n\)\)/, "never laid out as boxes, in either picture");
  assert.match(map, /const coilMesh = new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(1, 1, 1\)/, "one instanced mesh for every coil");
  assert.match(map, /sort\(\(a, b\) => b\.v - a\.v \|\| \(a\.n\.ticker < b\.n\.ticker \? -1 : 1\)\)/, "green → red left to right");
  assert.match(map, /if \(n\.kind === "cohort" && n\.coil && !\(cluster && cluster\.coil\)\) \{ onSelect\(n\); toggleList\(n\);/, "a click on a coil = its list");
  assert.match(map, /class="rk">\$\{i \+ 1\}<\/span><span class="tk">\$\{esc\(n\.ticker\)\}/, "rank · ticker");
  assert.match(map, /class="dp \$\{dp == null \? "mute" : dp >= 0 \? "up" : "dn"\}"/, "the day column");
  assert.match(map, /if \(onRow\) onRow\(n\);/, "a row opens the card");
  assert.match(page, /onRow: \(n\) => \{ state\.selected = n\.id; renderCard\(n\); crumbs\(\); \}/);
  assert.match(page, /if \(m3 && m3\.listOpen && m3\.listOpen\(\)\) \{ m3\.closeList\(\); return; \}/, "Esc closes the list first");
  assert.match(map, /openList, closeList, listOpen: \(\) => \(coilList \? coilList\.c\.id : null\)/, "the module hands the list to the page");
});

test("3 · one Geiger scale on the canvas, no pixel floor", () => {
  assert.match(map, /const BOX = \{ small: \{ w: 34, h: 9, min: 0 \}, big: \{ w: 34, h: 9, min: 0 \}/, "68 × 18 units, no floor");
  assert.match(map, /const GU = BOX\.small\.w;/, "the coil's unit is the box's half-width: one scale");
  assert.match(map, /Math\.max\(COIL\.line, Math\.abs\(s\.v\) \* GU\)/, "a coil bar stands GU × |v|");
  assert.match(map, /const boxMode = \(\) => true;/, "both pictures draw boxes, never balls");
});

test("4 · no question mark for a missing reading", () => {
  assert.doesNotMatch(page, /was printed with a "\?"/, "the KEY's remark is gone");
  for (const [f, s] of [["index.html", page], ["map3d.js", map]]) {
    // a "?" glyph printed as text: inside a template/string next to a quote, a tag or a middle dot — never
    const printed = [...s.matchAll(/(>|`|·\s|"\s*)\?(\s*<|`|"|\s·)/g)].map((m) => m[0]);
    assert.deepEqual(printed, [], `${f} prints a "?": ${printed.join(" | ")}`);
  }
  assert.match(map, /if \(vKind > 3\.5\) \{ if \(abs\(x\) > 0\.09 \|\| abs\(vUv\.y\) > 0\.3\) discard; c = vec3\(0\.42\); \}/, "no reading on the canvas = a quiet dot");
  assert.match(map, /const noReadingWhy = \(n\) => n\.served \? "no reading yet — served/, "the hover reason");
  assert.match(page, /const noReadingWhy = \(n\) => n\.served \? "no reading yet — served/, "the same reason on the card and the list");
  assert.match(page, /class="gb nr"/, "the quiet dot in the list and the card");
});

test("5 · the Hub's own look: no new colour token, the caption's small lines are measured", () => {
  const live = R(join(T15, "index.html"));
  const tokens = (s) => s.slice(s.indexOf(":root{"), s.indexOf("}", s.indexOf(":root{")));
  assert.equal(tokens(page), tokens(live), "the :root colour tokens are T15's");
  const hexes = [...page.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()), liveHexes = new Set([...live.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()));
  assert.deepEqual(hexes.filter((h) => !liveHexes.has(h)), [], "no colour the live page did not already carry");
  assert.match(map, /const subW = s \? Math\.max\(\.\.\.s\.split\("<br>"\)\.map\(\(line\) => measure\(line\.replace\(\/<\[\^>\]\+>\/g, ""\), 11, 0\.5\)\)\) \+ 6 : 0;/, "T15 crowding: the small lines count");
  assert.match(map, /\(chip \? 38 : 0\)/, "the OPEN 3D chip line is 38 px, as drawn");
});

test("6 · the proof: three widths, five moments, 0 errors, 0 overlaps, 0 '?' on the preview; the live page's 60 px floor", () => {
  const f = join(P, "shots", "t16-proof.json");
  assert.ok(existsSync(f), "shots/t16-proof.json (node proof-t16.mjs)");
  const J = JSON.parse(R(f));
  for (const w of [1680, 1440, 390]) {
    const t = J[`t16-${w}`], l = J[`live-${w}`];
    assert.ok(t && l, `${w}: both pages`);
    assert.match(String(t.renderer), /SwiftShader|ANGLE/, "WebGL rendered");
    assert.equal(t.errors.length, 0, `${w}: page errors on the preview`);
    const facts = t.log.filter((x) => x.probe && x.probe.startsWith("({ view")).map((x) => x.value);
    assert.equal(facts.length, 5, `${w}: five moments`);
    for (const v of facts) { assert.equal(v.view, "canvas", `${w}: the canvas at every moment`); assert.deepEqual(v.overlaps, [], `${w}: labels overlap`); assert.deepEqual(v.question_marks, [], `${w}: a "?" printed`); assert.equal(v.coils, 62, `${w}: 62 coils (every cohort with a member)`); }
    assert.equal(facts[2].list.open, "COHORT_AI_HARDWARE"); assert.equal(facts[2].list.rows, 17, "AI HARDWARE's 17 names in its list");
    assert.equal(facts[4].selected, "NVDA"); assert.equal(facts[4].list.open, "COHORT_AI_ACCELERATORS", "NVDA's card opens with its cohort's list");
    assert.equal(facts[0].scale.GU, 34); assert.equal(facts[0].scale.box.floor_px, 0);
    const lf = l.log.filter((x) => x.probe && x.probe.startsWith("({ view")).map((x) => x.value).filter((v) => v.view === "canvas");
    assert.ok(lf.some((v) => v.marks.box_px_max === 60 && v.marks.box_px_min === 60), `${w}: the live tree's boxes sit on their 60 px floor at the zoom-out`);
    assert.ok(facts[0].marks.box_px_max < 20 && facts[0].marks.box_px_max > 3, `${w}: the preview's boxes at home are their slot's size (${facts[0].marks.box_px_max} px)`);
    for (const m of ["home", "technology-zoom", "coil-expanded", "technology-open3d", "nvda-card"]) for (const tag of ["live", "t16"]) assert.ok(existsSync(join(P, "shots", `t16-${tag}-${w}-${m}.png`)), `shots/t16-${tag}-${w}-${m}.png`);
  }
  assert.ok(J["live-1680"].log.some((x) => x.probe && x.value && x.value.question_marks && x.value.question_marks.length === 1), "the live page prints one '?' (the KEY's remark); the preview none");
});

test("7 · the live tree and T15's preview untouched; the Hub's TREE tab still opens the live one", () => {
  assert.match(R(join(ROOT, "index.html")), /const TREE_MAP_URL = "\/deliverables\/20260929\/tree-map\/";/);
  assert.ok(!existsSync(join(P, "shots", "try1-home.png")));
  for (const f of ["tree.json", "layout.js", "connections.js", "aggregate.js", "industry-20261002.json", "scout-geiger-snapshot.json", "data/connections-20261005.json"]) assert.equal(R(join(P, f)), R(join(T15, f)), `${f} is T15's byte for byte`);
});
