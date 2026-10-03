// T8 (2 Oct, night): the tree with BIG Geigers — only tradeable lines carry a bar (no aggregate drawn), the tree never says
// "scout" or "aggregate", the side panel is empty until something is clicked, the podium is a staircase whose steps touch
// (gap 0) with no cliff (max drop ≤ one tread), a click on a step opens the card first (SHOW ON THE TREE jumps), MY LISTS
// (★ ♥ ◎) apart from the tree with RADAR from sc_lists.radar, camera 70°. Checked on the code and on the headless walk's
// record (shots/t8-after-proof.json: 1920 × 1080 at scale 1, 1680 × 1000 at scale 2, 390 at 1; node proof-t8.mjs <base> after).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const PAGE = readFileSync(join(DIR, "index.html"), "utf8"), M3 = readFileSync(join(DIR, "map3d.js"), "utf8"), LAY = readFileSync(join(DIR, "layout.js"), "utf8");
const WALK = join(DIR, "shots/t8-after-proof.json");
export const runs = existsSync(WALK) ? JSON.parse(readFileSync(WALK, "utf8")) : null;
const probes = (r, key) => r.log.filter((x) => x.probe && x.value && key in x.value).map((x) => x.value);
const desk = () => (runs || []).filter((r) => +r.width >= 1000);

test("1 · the Geiger is the biggest thing: a tradeable's box is 96 × 30 units with a 60 × 19 px floor, its ticker 15 px white on it; the titles keep their style", () => {
  assert.match(M3, /const BOX = \{ small: \{ w: 48, h: 15, min: 30 \}/, "the box: 96 × 30 units, a 60 px floor (T6: 84 × 28, 21 px)");
  assert.match(M3, /kind === "c" \? 11 : PHONE \? 12 : 15/, "a ticker label measures at 15 px");
  assert.match(PAGE, /\.lb\.n\.onbox,\.lb\.f\.onbox\{color:#fff;font-size:15px/, "white, 15 px, on the box");
  assert.match(PAGE, /\.lb\.h\{color:var\(--ink\);font-size:12px/, "the titles unchanged");
  if (!runs) return;
  for (const r of desk()) { const S = probes(r, "boxes")[0];
    assert.ok(S.names >= 400 && S.funds >= 100, `${r.width}: ${S.names} company boxes and ${S.funds} fund boxes at the zoom-out`);
    assert.ok(S.name_h.min >= 18 && S.fund_h.min >= 18, `${r.width}: the smallest bar is ${S.name_h.min} / ${S.fund_h.min} px tall (was 7)`);
    assert.equal(S.font_name[0], 15, `${r.width}: the ticker font is ${S.font_name[0]} px (was 11)`); assert.equal(S.font_name[1], "rgb(255, 255, 255)"); }
});

test("2 · no aggregates: only a tradeable line draws a bar; a heading, a cohort, a Hub list carries none; the code stays behind a flag that is off; the tree never says scout or aggregate; the off-Hub Geiger is drawn like the Hub's", () => {
  assert.match(PAGE, /const SHOW_AGGREGATES = false;/); assert.match(PAGE, /const SCOUT_SLIM = false;/);
  assert.match(PAGE, /const aggBar = \(n\) => \(SHOW_AGGREGATES \? aggBarRaw\(n\) : null\);/, "the display bar is null unless the flag is on");
  assert.match(PAGE, /const valueOf = orderValue;/, "the mean still orders the headings green → red");
  assert.match(M3, /if \(agg && SHOW_AGG\) bars\.push/, "the 3D never pushes an aggregate bar unless the flag is on");
  assert.match(M3, /if \(!own && !\(agg && SHOW_AGG\) && n\.ticker\) bars\.push\(\{ n, v: 0, kind: 4, slot: 0 \}\)/, "the empty track only on a tradeable");
  assert.doesNotMatch(PAGE.replace(/<script type="module">[\s\S]*<\/script>/, ""), /scout|aggregate|striped/i, "the page's markup (KEY, header) says neither");
  assert.match(PAGE, /computed at the close/); assert.match(M3, /"· computed at the close"/, "the hover may say when it was computed");
  if (!runs) return;
  for (const r of runs) {
    for (const S of probes(r, "aggregate_boxes")) assert.equal(S.aggregate_boxes, 0, `${r.width}: ${S.aggregate_boxes} aggregate boxes drawn in ${S.area || "the whole map"}`);
    for (const W of probes(r, "bad")) assert.deepEqual(W.bad, [["scout", 0], ["aggregate", 0]], `${r.width}: the words on the page: ${JSON.stringify(W.bad)}`);
  }
});

test("3 · the side panel shows only the thing clicked: empty (and gone) until then, the canvas has the width; no 'Click any line', no HOW TO READ A BAR", () => {
  assert.doesNotMatch(PAGE, /Click any line|HOW TO READ A BAR/);
  assert.match(PAGE, /\.main\.nocard\{grid-template-columns:minmax\(0,1fr\) 0\} \.main\.nocard aside\{display:none\}/);
  assert.match(PAGE, /document\.querySelector\("\.main"\)\.classList\.toggle\("nocard", !n\);/);
  if (!runs) return;
  for (const r of desk()) { const W = probes(r, "clickAny");
    assert.ok(W[0] && !W[0].clickAny && !W[0].howTo && W[0].aside_w === 0, `${r.width}: at the start the panel is ${W[0] && W[0].aside_w} px wide`);
    const picked = W.find((w) => w.card); assert.ok(picked && picked.aside_w >= 380, `${r.width}: after a click the panel shows ${picked && picked.card}`); }
});

test("4 · no black space: CLEAN packs with its own distances (columns 104, rows 36, levels 70), and a label never sits on another label or on another thing's box", () => {
  assert.match(LAY, /heads\.L = L;/); assert.match(LAY, /= heads\.L \|\| LAYOUT;/, "the layout reads the picture's own distances");
  assert.match(M3, /const CLEAN_SP = qn\("sp", 104\), CLEAN_ROW = qn\("row", 36\), CLEAN_MINW = qn\("minw", 120\);/);
  assert.match(M3, /const CLEAN_L = \{ GAP: qn\("gap", 24\), LEVEL: qn\("level", 70\), NAMES_DROP: qn\("drop", 50\), ROWGAP: qn\("rowgap", 110\) \};/);
  assert.match(M3, /if \(ok && avoidBoxes\) for \(const b of boxRects\) if \(b\.n !== n && /, "a label that would land on another thing's box moves or is not printed");
  if (!runs) return;
  for (const r of desk()) for (const S of probes(r, "label_on_other_box")) { assert.equal(S.label_on_label, 0, `${r.width} ${S.area || "whole"}: labels on labels`); assert.equal(S.label_on_other_box, 0, `${r.width} ${S.area || "whole"}: ${S.label_on_other_box} labels on another thing's box (live page: 85 at 1920, 121 at 1680)`); }
});

test("5 · the staircase: steps touch (gap 0 between every pair of neighbours), the biggest drop is at most one tread (the height scale is lowered, never below H_MIN), treads fall from the first place at the centre-top to the last at the outer bottom, 70° camera", () => {
  assert.match(M3, /const PARAMS = \{ stand: \{ A: qn\("sa", 30\), B: qn\("sb", 0\), D: qn\("sd", 30\), RW: qn\("srw", 30\), H: qn\("sh", 260\), H_MIN: 60, el: qn\("sel", 70\), az: qn\("saz", 28\) \}/, "70° up (T9: the inner radius 30, was 46)");
  assert.match(M3, /PARAMS\.stand\.B = \(PARAMS\.stand\.RW \* 1\.04\) \/ \(2 \* Math\.PI\);/, "one turn out = one tread's depth");
  assert.match(M3, /const H = Math\.max\(P\.H_MIN, Math\.min\(P\.H, maxGap > 0 \? P\.D \/ maxGap : P\.H\)\);/, "the drop cap");
  assert.match(M3, /w = \(P\.D \* \(p\.r \+ P\.RW \/ 2\)\) \/ p\.r;/, "a step is one arc step wide, so the neighbours touch");
  assert.match(M3, /function stairMesh\(members, P, above\)/); assert.doesNotMatch(M3, /function rampMesh|standMat|rampY/, "T7's ramp and helix are gone");
  assert.match(M3, /const floor = Math\.min\(0, members\.length \? treadOf\(members\.length - 1\) : 0\) - P\.D;/, "one common floor under the lowest tread (T9: under the lowest no-reading step too)");
  if (!runs) return;
  for (const r of desk()) {
    const P = probes(r, "neighbour_gap_px").filter((p) => p.count && !p.count.list && p.neighbour_gap_px);
    assert.ok(P.length >= 2, `${r.width}: the Technology podium was measured standing and from above`);
    for (const p of P) {
      assert.equal(p.n, 113); assert.ok(p.vMono && p.rMono && p.treadMono, `${r.width} ${p.mode}: readings fall, radius grows, treads fall`);
      assert.ok(p.gap_world && p.gap_world.max <= 0.5 && p.gap_world.touching === p.gap_world.n, `${r.width} ${p.mode}: neighbours' gap ${JSON.stringify(p.gap_world)} units along the outer edge (live page: up to 62 px of black between neighbours)`);
      assert.ok(p.neighbour_gap_px.max <= 10, `${r.width} ${p.mode}: on the screen the steps' rectangles sit within ${JSON.stringify(p.neighbour_gap_px)} px (the true rule is gap_world above — the steps touch in the model; a turned box's screen rectangle is wider than its face, 8.8 px at most in the 2 Oct record)`);
      assert.ok(p.count.max_drop <= p.count.drop_cap + 0.01, `${r.width} ${p.mode}: the biggest drop ${p.count.max_drop} vs the cap ${p.count.drop_cap} (units)`);
      assert.ok(p.count.H >= 60, `${r.width}: H ${p.count.H}`); assert.ok(p.first.tread > 0 && p.last.tread < 0 && p.first.r < p.last.r, `${r.width}: first ${JSON.stringify(p.first)} last ${JSON.stringify(p.last)}`);
      assert.equal(p.label_on_label, 0, `${r.width} ${p.mode}: tickers never overlap`); assert.ok(p.labels >= Math.floor(p.n * 0.75), `${r.width} ${p.mode}: ${p.labels} of ${p.n} tickers printed`);
    }
  }
});

test("6 · a click on a step = the card first, with SHOW ON THE TREE; 7 · MY LISTS (★ ♥ ◎) apart from the tree, RADAR from the same browser mirror (sc_lists.radar)", () => {
  assert.match(M3, /if \(cluster && cluster\.coil && n\.kind === "name"\) \{ onSelect\(n\); select\(n, false\); return; \}/, "the step's click selects, the podium stays");
  assert.match(M3, /ray\.intersectObject\(cluster\.steps, false\)\[0\]/, "a step is picked by a real ray");
  assert.match(PAGE, /<button class="coilbtn" data-tree="\$\{esc\(n\.id\)\}"[^>]*>SHOW ON THE TREE →<\/button>/);
  assert.match(PAGE, /\{ id: "LIST_RADAR", glyph: "◎", name: "RADAR", key: "sc_lists", read: \(raw\) => \{ const o = JSON\.parse\(raw \|\| "null"\); return o && Array\.isArray\(o\.radar\) \? o\.radar : null; \} \}/);
  assert.match(PAGE, /<span class="ttl">MY LISTS<\/span>/); assert.match(PAGE, /<div id="mylists"><div class="ttl">MY LISTS · ★ FAVORITES · ♥ LIKED · ◎ RADAR/);
  if (!runs) return;
  for (const r of desk()) {
    const click = r.log.find((x) => x.click === "NVDA"); assert.ok(click && click.after.selected === "NVDA" && click.after.area === "SEC_TECH" && click.after.card === "NVDA", `${r.width}: the click opened the card (${click && JSON.stringify([click.after.selected, click.after.area, click.after.card])}) and the podium stayed`);
    const P = probes(r, "cardHasTreeBtn").find((p) => p.card === "NVDA"); assert.ok(P && P.cardHasTreeBtn, `${r.width}: the card carries SHOW ON THE TREE`);
    const jump = r.log.find((x) => x.clickSel === "#card [data-tree]"); assert.ok(jump && jump.found && jump.after.area === null && jump.after.selected === "NVDA", `${r.width}: SHOW ON THE TREE left the podium for NVDA on the tree`);
    const L = probes(r, "lists")[0]; assert.deepEqual(L.lists.map((l) => [l.id, l.on_hub_list, l.on_tree]), [["LIST_FAVORITES", 30, 30], ["LIST_LIKED", 60, 60], ["LIST_RADAR", 30, 30]], `${r.width}: the planted lists`);
    assert.ok(L.listbarText.startsWith("MY LISTS") && L.chips.length === 3 && L.chips[2][0].startsWith("◎ RADAR (30)"), `${r.width}: the MY LISTS area: ${L.listbarText}`);
    const radar = probes(r, "neighbour_gap_px").find((p) => p.count && p.count.list && p.n === 30 && p.bar.startsWith("◎ RADAR")); assert.ok(radar && radar.mode === "3d" && radar.gap_world && radar.gap_world.touching === 29, `${r.width}: the RADAR podium (30) opened standing, steps touching`);
    const outline = probes(r, "rows").at(-1); assert.ok(outline.rows.length === 3 && outline.rows[2].startsWith("◎ RADAR (30)"), `${r.width}: the MY LISTS block on the outline: ${JSON.stringify(outline.rows)}`);
  }
});

test("the walk: three runs (1920 @ 1, 1680 @ 2, 390 @ 1), no page errors, every label within a few px of its anchor", () => {
  assert.ok(runs, "shots/t8-after-proof.json is missing (node proof-t8.mjs <base> after)");
  assert.deepEqual(runs.map((r) => [+r.width, r.dpr]), [[1920, 1], [1680, 2], [390, 1]]);
  for (const r of runs) { assert.deepEqual(r.page_errors, [], `${r.width}: page errors`); for (const x of r.log) if (x.labels) { assert.equal(x.labels.outside, 0); assert.ok(x.labels.max_dx <= 3, `${r.width}: dx ${x.labels.max_dx}`); } }
});
