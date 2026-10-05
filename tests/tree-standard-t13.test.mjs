/* T13 (5 Oct 2026) · the tree rebuilt from the standard parts. Alan: option A (the tree's own drawings) is rejected everywhere; the
   Hub's own look is the standard for every flat part, V3's laser coil for every 3D part. These tests pin:
     1 one source: hub-parts.css equals what tools/extract-hub-parts.mjs copies out of the Hub page right now, and the page links it
     2 the page draws no colour of its own (its own <style> holds no hex colour), loads canvas.js + coil3d.js + label-scale.mjs, and
       has none of the dropped controls (DETAILED, BY SIZE, FLAT 2D, OPEN 3D, FROM ABOVE, the KEY)
     3 the canvas layout (pure, no browser): every tradeable on the tree gets a cell, cells never overlap, never leave their block's
       tile, all the same pitch, the pitch ≥ 0.85 of the standard's 88 × 28 at the home view on 1920 × 949 and 1680 × 919, the
       canvas ≥ 70 % covered at home; the same holds at the INDUSTRY, COHORT and INSTRUMENT levels (0 overlaps, inside the tile)
     4 the coil is V3's file plus the walk and the click, with the settled values (70°, the mirror, $1 T = 80 U)
     5 the proof's numbers (measure.mjs, proof-t13.mjs, fps.mjs — committed JSON): 614 of 614 tickers printed at home on both
       screens (was 108 / 82), black share below the before, 0 overlaps at every level shot, 0 mirrored labels, fps ≥ 50 in the podium */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, ".."), TREE = resolve(ROOT, "deliverables/20260929/tree-map"), REP = resolve(ROOT, "deliverables/20261005/t13-tree-standard");
const R = (p) => readFileSync(p, "utf8"), J = (p) => JSON.parse(R(p));
const page = R(resolve(TREE, "index.html"));

test("1 · one source: hub-parts.css is what the extractor copies out of the Hub page now, and the page links it", async () => {
  const { extract, WANT } = await import("../deliverables/20260929/tree-map/tools/extract-hub-parts.mjs");
  const { css, missing } = extract(R(resolve(ROOT, "index.html")));
  assert.deepEqual(missing, [], "every wanted Hub rule is found in the Hub page");
  assert.equal(R(resolve(TREE, "hub-parts.css")), css, "hub-parts.css = the Hub's CSS (re-run tools/extract-hub-parts.mjs)");
  for (const sel of [":root", ".ctabs", ".ct.on", ".mytab th", ".gsum .gs-comp .gs-cgr", ".gsum .gs-comp .gs-big"]) assert.ok(WANT.includes(sel) && css.includes(`/* ${sel} ·`), sel);
  assert.match(page, /<link rel="stylesheet" href="hub-parts.css">/);
  assert.match(page, /<body class="gsum">/); assert.match(page, /class="main gs-comp"/, "the Hub's track rule needs its ancestors");
});

test("2 · the page adds no colour of its own, uses the Hub's tab row and table, and the dropped controls are gone", () => {
  const own = page.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, ""); // the rules, not the comments
  assert.equal((own.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((h) => !/^#(graph|canvas|outline|podium|areabar|walkhud|tip|fallback|crumbs|main|card|stamp|q|viewtabs|listtabs|reset|tickers)/.test(h)).length, 0, "no hex colour in the page's own CSS — every colour is a Hub token");
  assert.ok(!/\bgray\b|\bgrey\b|border:\s*1px solid var\(--line2\)/.test(own), "no grey frame");
  for (const want of ['class="ctabs" id="viewtabs"', 'class="mytab"', "gs-cgr", "gs-big", "gs-lab", 'import { mountCanvas', 'import("./coil3d.js")', "label-scale.mjs"]) assert.ok(page.includes(want) || R(resolve(TREE, "canvas.js")).includes(want), want);
  const markup = page.split('<script type="module">')[0]; // the controls and the words on the page, not the module's list of what was dropped
  for (const gone of ["DETAILED", "BY SIZE", "FLAT 2D", "OPEN 3D", "FROM ABOVE", "what every mark means", "LET GO"]) assert.ok(!markup.includes(gone), gone + " is dropped");
  for (const gone of ["map3d.js", "layout.js"]) assert.ok(!page.includes(gone), gone + " is not loaded");
  assert.ok(!existsSync(resolve(TREE, "map3d.js")) && !existsSync(resolve(TREE, "layout.js")), "the old WebGL tree and its layout are gone from the folder");
  assert.match(page, /<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/);
});

const buildItems = () => {
  const T = J(resolve(TREE, "tree.json")), IND = J(resolve(TREE, "industry-20261002.json"));
  const byId = new Map(T.nodes.map((n) => [n.id, n]));
  const BLOCK_IDS = new Set(["SEC_TECH", "SEC_FIN", "SEC_HLTH", "SEC_ENGY", "SEC_INDU", "SEC_STPL", "SEC_DISC", "SEC_UTIL", "SEC_MATL", "SEC_REIT", "SEC_COMM", "US_BROAD", "US_STYLE", "INTL_DEV", "EM", "BONDS", "CMDTY", "CRYPTO", "MACRO"]);
  const blockOf = (n) => { let c = n, last = null; while (c && c.parents.length) { c = byId.get(c.parents[0]); if (!c) break; if (c.kind === "index") { if (BLOCK_IDS.has(c.id)) return c.id; last = last || c.id; } } return last || "MARKET"; };
  const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return (h % 2000) / 1000 - 1; }; // a deterministic stand-in for the live reading
  const items = T.nodes.filter((n) => n.ticker).map((n) => ({ id: n.id, t: n.ticker, kind: n.kind, v: hash(n.ticker), label: n.label, block: blockOf(n), industry: n.kind === "fund" ? "FUNDS" : (IND.rows[n.ticker] && IND.rows[n.ticker].fmp_industry) || n.gics_industry || "OTHER", cohort: n.home_id || "NONE", cohortId: n.home_id || null, cap: null }));
  const blocks = [...new Set(items.map((i) => i.block))].map((id) => ({ id, label: id, short: id }));
  return { items, blocks, T };
};
const overlaps = (cells) => { let n = 0; for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) { const a = cells[i], b = cells[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) n++; } return n; };

test("3 · the canvas layout: a cell for every tradeable, none overlapping, none outside its tile, one pitch near the standard, ≥ 70 % covered at home; every level sound", async () => {
  const { layoutLevel, CELL, LEVELS, levelOf } = await import("../deliverables/20260929/tree-map/canvas.js");
  const { items, blocks, T } = buildItems();
  assert.equal(items.length, T.nodes.filter((n) => n.ticker).length);
  assert.deepEqual(LEVELS.map((l) => l.name), ["SECTOR", "INDUSTRY", "COHORT", "INSTRUMENT"]); assert.equal(levelOf(1), 0); assert.equal(levelOf(1.5), 1); assert.equal(levelOf(2.5), 2); assert.equal(levelOf(4), 3);
  assert.equal(CELL.w / CELL.h > 3.1 && CELL.w / CELL.h < 3.3, true, "the cell is the Hub bar's 3.2 : 1");
  for (const [W, H] of [[1920, 949], [1680, 919]]) {
    for (const L of [0, 1, 2, 3]) {
      const lay = layoutLevel(items, blocks, W, H, L);
      assert.equal(lay.cells.length, items.length, `${W} L${L}: every tradeable has a cell`);
      assert.equal(overlaps(lay.cells), 0, `${W} L${L}: no cell on another`);
      const tiles = new Map(lay.tiles.map((t) => [t.id, t]));
      for (const c of lay.cells) { const t = tiles.get(c.it.block); assert.ok(c.x >= t.x - 0.01 && c.x + c.w <= t.x + t.w + 0.01 && c.y >= t.y - 0.01 && c.y + c.h <= t.y + t.h + 0.01, `${W} L${L}: ${c.it.t} inside its tile`); }
      const ws = new Set(lay.cells.map((c) => c.w.toFixed(2))), hs = new Set(lay.cells.map((c) => c.h.toFixed(2))); assert.equal(ws.size, 1); assert.equal(hs.size, 1, "one pitch everywhere");
      assert.ok(lay.tiles.every((t) => t.y + t.h <= H + 0.01 && t.x + t.w <= W + 0.01), `${W} L${L}: the bands fit the canvas`);
      if (L === 0) { assert.ok(lay.k >= 0.85, `${W}: the home pitch is ≥ 0.85 of the standard's 88 × 28 (k = ${lay.k.toFixed(3)})`); assert.ok(lay.covered >= 0.7, `${W}: ≥ 70 % of the canvas is cells and titles (${(lay.covered * 100).toFixed(1)} %)`); assert.equal(lay.captions.length, 0); }
      else assert.ok(lay.captions.length > 0, "captions above level 0");
    }
  }
});

test("4 · the coil is V3's file with the walk and the click added; the settled values stand", () => {
  const c = R(resolve(TREE, "coil3d.js"));
  assert.match(c, /COIL LAB \(3 Oct 2026\)/); assert.match(c, /hub\/v2-coil-lab-20261003 @f219335/);
  assert.match(c, /const CAP_R1T = 80;/); assert.match(c, /const HOME = \{ el: 70,/); assert.match(c, /the mirror: reflected/);
  for (const w of ["walkTo", "walkStep", "endWalk", "walkOrder", "onPick", "onHover", "stepAt", "screenOfStep"]) assert.ok(c.includes(w), w);
  assert.match(c, /const WALK = \{ ms: 480, eye: 120, back: 3.2, ahead: 12, fov: 62 \};/, "T9's walk numbers");
  assert.equal(R(resolve(TREE, "label-scale.mjs")).includes("export const LABEL_RULE = { base_px: 13, floor_px: 11, ceil_px: 24"), true);
});

test("5 · the proof: 614 of 614 tickers printed at home on both screens (was 108 / 82), black below the before, 0 overlaps, 0 mirrored labels, the podium ≥ 50 fps", () => {
  const before = J(resolve(REP, "shots/before-measure.json")), after = J(resolve(REP, "shots/after-measure.json"));
  for (const k of ["1920x1080@1", "1680x1050@2"]) {
    assert.equal(after[k].tickers_printed, after[k].boxes, k + ": every ticker prints"); assert.equal(after[k].boxes, 614);
    assert.ok(before[k].tickers_printed < 130, k + ": before printed " + before[k].tickers_printed);
    assert.ok(after[k].black_share < before[k].black_share - 0.2, `${k}: black ${before[k].black_share} → ${after[k].black_share}`);
    assert.ok(after[k].pitch.covered >= 0.7 && after[k].pitch.k >= 0.85, k + ": the pitch");
    assert.deepEqual(after[k].errors, []);
  }
  const P = J(resolve(REP, "shots/t13-proof.json")), F = J(resolve(REP, "shots/t13-fps.json"));
  for (const k of Object.keys(P)) {
    assert.deepEqual(P[k].errors, [], k + ": no page errors");
    for (const x of P[k].log) { if (x.probe && x.probe.startsWith("({ pose") && x.value && x.value.pitch && x.value.cluster == null && x.value.pitch.cells === 614) assert.equal(x.value.overlaps, 0, k + ": 0 overlaps at level " + x.value.level); if (x.probe && x.probe.startsWith("(() => { const c") && x.value) { assert.equal(x.value.labels.wrong, 0, k + ": no mirrored label"); assert.equal(x.value.capScale.r1T_units, 80); assert.equal(x.value.boxes, false, "no boxes on the coil"); assert.equal(x.value.capMode, "sphere"); } }
    assert.ok(F[k].podium_ai_accelerators_18.fps >= 50 && F[k].podium_liked_141.fps >= 50, k + ": the podium ≥ 50 fps");
  }
});
