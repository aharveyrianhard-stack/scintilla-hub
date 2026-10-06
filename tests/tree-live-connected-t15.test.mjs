/* T15 (5 Oct 2026, night) · connections added to the LIVE tree, preview only (deliverables/20261005/tree-live-connected/).
   Alan: "everything feels so separate … I don't see the connection of things under technology to other areas of the market, like
   the indexes" · "there can't be a bazillion toggles" · "we kind of do have to make it branch". These tests pin:
     1 the copy differs from the live tree (deliverables/20260929/tree-map) ONLY by added files and added one-line hooks tagged
       T15: every shared file is byte-identical except index.html and map3d.js, whose every live line is still present in order
       and whose every extra line carries "T15"; the live folder itself is untouched; the Hub's TREE tab still opens the live one
     2 one new toggle only (CONNECTIONS), no new view / mode, no change to the header's HTML
     3 the data (T14's connections file, reused as data): the 16 indexes, honest sector shares, NVDA held by SPY/QQQ/XLK/SMH,
       cross-sector links never inside one sector
     4 the proof (shots/t15-proof.json, headless, WebGL rendering): 0 page errors on both pages, the same camera pose and the
       same screen place of five nodes on the live and the connected page at every moment, 65 index lines, SPY → TECHNOLOGY
       hover prints 39.3 %, NVDA's click draws 20 lines, AI HARDWARE's click draws 20 arcs, CONNECTIONS off hides them */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, ".."), LIVE = resolve(ROOT, "deliverables/20260929/tree-map"), P = resolve(ROOT, "deliverables/20261005/tree-live-connected");
const R = (p) => readFileSync(p, "utf8"), J = (p) => JSON.parse(R(p));
const walk = (d, skip) => { const out = []; (function w(x) { for (const f of readdirSync(x)) { const p = join(x, f); const rel = relative(d, p); if (skip.some((s) => rel === s || rel.startsWith(s + "/"))) continue; if (statSync(p).isDirectory()) w(p); else out.push(rel); } })(d); return out.sort(); };
const ADDED = ["connections.js", "data/connections-20261005.json", "proof-t15.mjs", "T15-TREE.html"];

test("1 · the copy is the live tree plus added files and T15 hook lines, nothing else", () => {
  const liveFiles = walk(LIVE, ["shots"]), copyFiles = walk(P, ["shots"]);
  for (const f of liveFiles) assert.ok(copyFiles.includes(f), `${f} is missing from the copy`);
  const extra = copyFiles.filter((f) => !liveFiles.includes(f));
  assert.deepEqual(extra, ADDED.slice().sort(), "only the four added files");
  for (const f of liveFiles) {
    const a = R(join(LIVE, f)), b = R(join(P, f));
    if (f !== "index.html" && f !== "map3d.js") { assert.equal(a, b, `${f} must be byte-identical to the live tree`); continue; }
    // every live line is still there, in order; every extra line is a T15 hook
    const A = a.split("\n"), B = b.split("\n"); let i = 0; const extraLines = [];
    for (const line of B) { if (i < A.length && line === A[i]) i++; else extraLines.push(line); }
    assert.equal(i, A.length, `${f}: a live line was changed or removed`);
    assert.ok(extraLines.length >= 3 && extraLines.length <= 4, `${f}: ${extraLines.length} added lines`);
    for (const l of extraLines) assert.match(l, /T15/, `${f}: an added line without the T15 tag: ${l.slice(0, 80)}`);
  }
  assert.equal(R(join(P, "index.html")).split("\n").length - R(join(LIVE, "index.html")).split("\n").length, 3);
  assert.equal(R(join(P, "map3d.js")).split("\n").length - R(join(LIVE, "map3d.js")).split("\n").length, 4);
  assert.match(R(join(ROOT, "index.html")), /const TREE_MAP_URL = "\/deliverables\/20260929\/tree-map\/";/, "the Hub's TREE tab still opens the live tree");
});

test("2 · one toggle (CONNECTIONS, on by default), no new mode, the header's HTML untouched", () => {
  const page = R(join(P, "index.html")), live = R(join(LIVE, "index.html"));
  const header = (s) => s.slice(s.indexOf("<header>"), s.indexOf("</header>"));
  assert.equal(header(page), header(live), "the header markup is the live one (the button is added by the module)");
  const mod = R(join(P, "connections.js"));
  assert.equal((mod.match(/document\.createElement\("button"\)/g) || []).length, 1, "exactly one button is created");
  assert.match(mod, /btn\.textContent = "CONNECTIONS"/);
  assert.match(mod, /remembered\("tree\.connections", "on"/, "on by default");
  assert.ok(!/setView|v-3d|v-canvas|v-outline/.test(mod), "no view or mode is added or driven");
  assert.ok(!/\.pos\.set\(|flyTo|frameWhole|camera\.position/.test(mod), "nothing moves a node or the camera");
  for (const c of ["0x3c3c3c", "0x4e4e4e", "0x9a9a9a", "0x484848", "0x6a6a6a", "0x5a5a5a"]) assert.ok(mod.includes(c), c + " is a grey of the tree");
});

test("3 · the data: 16 indexes, honest sector shares, held-by with weights, cross-sector links", () => {
  const C = J(join(P, "data/connections-20261005.json"));
  assert.deepEqual(C.indexes.broad, ["SPY", "QQQ", "DIA", "IWM", "RSP"]); assert.equal(C.indexes.sector.length, 11); assert.equal(C.indexes.on_tree.length, 16);
  for (const f of C.indexes.on_tree) { const IS = C.index_sectors[f]; const sum = Object.values(IS.shares).reduce((s, w) => s + w, 0); assert.ok(sum <= IS.total_pct + 0.05, f); assert.ok(Math.abs(IS.classified_pct + IS.unclassified_pct - IS.total_pct) < 0.05, f); }
  assert.ok(C.index_sectors.SPY.shares.SEC_TECH > 30 && C.index_sectors.SPY.shares.SEC_TECH < 50);
  assert.ok(C.index_sectors.XLK.shares.SEC_TECH > 90);
  const nv = Object.fromEntries(C.held_by.NVDA); for (const f of ["SPY", "QQQ", "XLK", "SMH"]) assert.ok(nv[f] > 0, "NVDA held by " + f);
  for (const l of C.cohort_links) { assert.notEqual(l.sa, l.sb); assert.equal(l.count, l.members + l.peers + l.funds); }
  const T = J(join(P, "tree.json")), ids = new Set(T.nodes.map((n) => n.id));
  for (const l of C.cohort_links.slice(0, 40)) { assert.ok(ids.has(l.a), l.a); assert.ok(ids.has(l.b), l.b); }
});

test("4 · the proof: WebGL rendered, 0 errors, same camera and layout on both pages, the lines and numbers", () => {
  const f = join(P, "shots/t15-proof.json"); assert.ok(existsSync(f), "run node proof-t15.mjs first");
  const o = J(f);
  for (const tag of ["live", "connected"]) { assert.match(String(o[tag].renderer), /ANGLE|SwiftShader|Metal/, tag + " rendered WebGL"); assert.deepEqual(o[tag].errors, [], tag + ": page errors"); }
  assert.equal(o.same_camera_same_layout.equal, true, "same pose and node places at every moment");
  assert.ok(o.same_camera_same_layout.moments >= 3);
  const links = o.connected.log.filter((x) => x.probe && x.probe.includes("ext.links()")).map((x) => x.value);
  assert.equal(links[0].index_branches, 5); assert.equal(links[0].index_sector_lines, 60); assert.equal(links[0].on, true);
  const nvda = links.find((l) => l.selected === "NVDA"); assert.ok(nvda && nvda.ticker_lines >= 15, "NVDA draws its lines");
  const coh = links.find((l) => l.selected === "COHORT_AI_HARDWARE"); assert.ok(coh && coh.arcs === 20, "AI HARDWARE draws 20 arcs");
  assert.equal(links[links.length - 1].visible, false, "CONNECTIONS off hides the lines");
  const hover = o.connected.log.find((x) => x.probe && x.probe.includes("hoverAt")).value; assert.match(hover.tip, /39\.3% of SPY's weight sits in TECHNOLOGY/); assert.equal(hover.hot, true);
  const liveLinks = o.live.log.filter((x) => x.probe && x.probe.includes("ext.links()")).map((x) => x.value); assert.ok(liveLinks.every((v) => v === null), "the live page has no connections module");
  const btns = o.connected.log[o.connected.log.length - 1].value, liveBtns = o.live.log[o.live.log.length - 1].value;
  assert.deepEqual(btns.filter((b) => b !== "CONNECTIONS"), liveBtns, "the header has exactly one more button: CONNECTIONS");
  for (const n of ["t15-live-home.png", "t15-connected-home.png", "t15-live-nvda.png", "t15-connected-nvda.png", "t15-live-ai-hardware.png", "t15-connected-ai-hardware.png", "t15-connected-spy-tech-hover.png", "t15-connected-home-connections-off.png"]) assert.ok(statSync(join(P, "shots", n)).size > 50000, n);
});
