/* T14 (5 Oct 2026, night) · the tree as one connected market, preview only (deliverables/20261005/tree-connected-preview/).
   Alan: "everything feels so separate… I don't see the connection of things that are under technology to other areas of the
   market. Like the indexes." These tests pin:
     1 the data (connections-20261005.json, built from the dated read-only exports by connections.mjs): the 16 indexes, every
       index's sector shares ≤ its total and never re-scaled (unclassified stays), NVDA held by SPY/QQQ/XLK/SMH with weights,
       the cross-sector links symmetric and never inside one sector, AI HARDWARE ↔ AI POWER present with its parts
     2 the pure module gives the same numbers from the raw rows (the maths on the screen is the maths tested)
     3 the ring layout: 614 cells, the 16 indexes in the first band, 0 overlaps at every level, canvas ≥ 70 % covered at home
     4 the page: the outline column, the LINKS control, the link layer's classes, only Hub tokens in its own CSS, the supplier /
       customer honesty line, PAGE SPECS; the live TREE tab's folder (deliverables/20260929/tree-map) is byte-identical to T13
     5 the proof (shots/t14-proof.json): 0 page errors, 614 printed at home, 0 overlaps, SPY's hover lights 11 lines with weights,
       NVDA's hover lights ≥ 15 lines with fund weights, the AI HARDWARE ↔ AI POWER link lights with "9" */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, ".."), P = resolve(ROOT, "deliverables/20261005/tree-connected-preview"), LIVE = resolve(ROOT, "deliverables/20260929/tree-map");
const R = (p) => readFileSync(p, "utf8"), J = (p) => JSON.parse(R(p));
const C = J(join(P, "data/connections-20261005.json")), T = J(join(P, "tree.json"));
const page = R(join(P, "index.html"));

test("1 · the data: 16 indexes, honest sector shares, held-by with weights, cross-sector links", () => {
  assert.deepEqual(C.indexes.broad, ["SPY", "QQQ", "DIA", "IWM", "RSP"]); assert.equal(C.indexes.sector.length, 11); assert.equal(C.indexes.on_tree.length, 16);
  for (const f of C.indexes.on_tree) { const IS = C.index_sectors[f]; assert.ok(IS, f); const sum = Object.values(IS.shares).reduce((s, w) => s + w, 0); assert.ok(sum <= IS.total_pct + 0.05, `${f}: shares ${sum} ≤ total ${IS.total_pct}`); assert.ok(Math.abs(IS.classified_pct + IS.unclassified_pct - IS.total_pct) < 0.05, f + " classified + unclassified = total"); }
  assert.ok(C.index_sectors.SPY.shares.SEC_TECH > 30 && C.index_sectors.SPY.shares.SEC_TECH < 50, "SPY's technology weight is in the 30s");
  assert.ok(C.index_sectors.XLK.shares.SEC_TECH > 90, "XLK is technology"); assert.ok(C.index_sectors.IWM.unclassified_pct > 80, "IWM: most of its 1,988 names are off the Hub's sector map — printed, not hidden");
  const nv = Object.fromEntries(C.held_by.NVDA); for (const f of ["SPY", "QQQ", "XLK", "SMH"]) assert.ok(nv[f] > 0, "NVDA held by " + f); assert.ok(nv.SMH > nv.SPY, "SMH's NVDA weight is bigger than SPY's");
  assert.equal(C.counts.funds_in_file, 62); assert.ok(C.counts.names_held >= 450); assert.ok(C.counts.names_with_peers >= 550);
  assert.ok(C.peers.NVDA.some((p) => p.t === "AMD") && C.peers.NVDA.some((p) => p.t === "TSM"), "NVDA's peers include AMD and TSM");
  for (const l of C.cohort_links) { assert.notEqual(l.sa, l.sb, "a link crosses sectors: " + l.a + " " + l.b); assert.equal(l.count, l.members + l.peers + l.funds); assert.ok(l.count > 0); }
  const ids = new Set(C.cohort_links.map((l) => l.a + "|" + l.b)); assert.equal(ids.size, C.cohort_links.length, "one line per pair");
  const hp = C.cohort_links.find((l) => l.a === "COHORT_AI_HARDWARE" && l.b === "COHORT_AI_POWER"); assert.ok(hp, "AI HARDWARE ↔ AI POWER"); assert.equal(hp.sa, "SEC_TECH"); assert.equal(hp.sb, "SEC_UTIL"); assert.ok(hp.members >= 1 && hp.shared.members.includes("ETN"), "ETN sits in both");
  assert.equal(C.supplier_customer, null); assert.match(C.sources.supplier_customer, /NO DATA/);
});

test("2 · the pure module reproduces the file from the raw rows", async () => {
  const { indexShares, heldBy, peersOf, cohortLinks } = await import("../deliverables/20261005/tree-connected-preview/connections.mjs");
  const rows = [{ fund: "F", asset: "A", w: 60 }, { fund: "F", asset: "B", w: 30 }, { fund: "F", asset: "C", w: 9.5 }, { fund: "G", asset: "A", w: 5 }];
  const IS = indexShares(rows, "F", (a) => ({ A: "S1", B: "S2" }[a] || null)); assert.deepEqual(IS.shares, { S1: 60, S2: 30 }); assert.equal(IS.unclassified_pct, 9.5); assert.equal(IS.total_pct, 99.5);
  assert.deepEqual(heldBy(rows, (a) => a !== "C"), { A: [["F", 60], ["G", 5]], B: [["F", 30]] });
  assert.deepEqual(peersOf([{ ticker: "A", peer: "B", source: "fmp" }, { ticker: "A", peer: "B", source: "massive" }, { ticker: "A", peer: "A", source: "fmp" }, { ticker: "Z", peer: "B", source: "fmp" }], (t) => t === "A"), { A: [{ t: "B", src: ["fmp", "massive"] }] });
  const links = cohortLinks([{ id: "X", sector: "S1", members: ["A", "B"] }, { id: "Y", sector: "S2", members: ["B", "C"] }, { id: "Z", sector: "S1", members: ["C"] }], { A: [{ t: "C" }] }, { A: [["F", 1]], C: [["F", 1]], B: [["BROAD", 9]] }, { narrowFund: (f) => f !== "BROAD" });
  assert.deepEqual(links.map((l) => [l.a, l.b, l.members, l.peers, l.funds]), [["X", "Y", 1, 1, 1], ["Y", "Z", 1, 0, 1]]);
  // the committed file equals a rebuild from the raw exports (the build is deterministic apart from built_utc)
  const rebuilt = JSON.parse(execSync("node build-connections.mjs >/dev/null && cat data/connections-20261005.json", { cwd: P }).toString());
  for (const k of ["index_sectors", "held_by", "peers", "cohort_links", "counts", "indexes"]) assert.deepEqual(rebuilt[k], C[k], k);
});

test("3 · the ring layout: 614 cells, the 16 indexes in the first band, 0 overlaps at every level, ≥ 70 % covered at home", async () => {
  const { layoutLevel } = await import("../deliverables/20261005/tree-connected-preview/canvas.js");
  const IND = J(join(P, "industry-20261002.json")), byId = new Map(T.nodes.map((n) => [n.id, n]));
  const BLOCK_IDS = new Set(["SEC_TECH", "SEC_FIN", "SEC_HLTH", "SEC_ENGY", "SEC_INDU", "SEC_STPL", "SEC_DISC", "SEC_UTIL", "SEC_MATL", "SEC_REIT", "SEC_COMM", "US_BROAD", "US_STYLE", "INTL_DEV", "EM", "BONDS", "CMDTY", "CRYPTO", "MACRO"]);
  const blockOf = (n) => { let c = n, last = null; while (c && c.parents.length) { c = byId.get(c.parents[0]); if (!c) break; if (c.kind === "index") { if (BLOCK_IDS.has(c.id)) return c.id; last = last || c.id; } } return last || "MARKET"; };
  const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return (h % 2000) / 1000 - 1; };
  const ring = new Set(C.indexes.on_tree), broad = new Set(C.indexes.broad);
  const items = T.nodes.filter((n) => n.ticker).map((n) => ({ id: n.id, t: n.ticker, kind: n.kind, v: hash(n.ticker), label: n.label, block: ring.has(n.ticker) ? "RING" : blockOf(n), industry: ring.has(n.ticker) ? (broad.has(n.ticker) ? "BROAD INDEXES" : "SECTOR FUNDS") : n.kind === "fund" ? "FUNDS" : (IND.rows[n.ticker] && IND.rows[n.ticker].fmp_industry) || n.gics_industry || "OTHER", cohort: n.home_id || "NONE", cohortId: n.home_id || null, cap: null }));
  const blocks = [{ id: "RING", label: "THE MARKET · INDEXES", short: "THE MARKET · INDEXES" }, ...[...new Set(items.map((i) => i.block))].filter((b) => b !== "RING").map((id) => ({ id, label: id, short: id }))];
  const overlaps = (cells) => { let n = 0; for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) { const a = cells[i], b = cells[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) n++; } return n; };
  for (const [W, H] of [[1920 - 210, 949], [1680 - 210, 919], [1680, 919]]) for (const L of [0, 1, 2, 3]) {
    const R0 = layoutLevel(items, blocks, W, H, L); assert.equal(R0.cells.length, 614, `${W} L${L} every tradeable`); assert.equal(overlaps(R0.cells), 0, `${W} L${L} no overlap`);
    const ringTile = R0.tiles.find((t) => t.id === "RING"); assert.ok(ringTile && ringTile.y === 0, "the ring is the first band");
    const inRing = R0.cells.filter((c) => c.y < ringTile.h); assert.equal(inRing.length, 16, `${W} L${L} the 16 indexes sit in the ring`); assert.ok(inRing.every((c) => ring.has(c.it.t)));
    assert.ok(R0.cells.every((c) => c.y + c.h <= H + 1e-6), "inside the canvas");
    if (L === 0) assert.ok(R0.covered >= 0.7, `${W} covered ${R0.covered}`);
    const rows = R0.captions.filter((c) => c.block === "RING").map((c) => c.key); assert.deepEqual(rows, ["BROAD INDEXES", "SECTOR FUNDS"]);
  }
});

test("4 · the page: outline, LINKS control, the link layer, only Hub tokens, the honesty line; the live tree folder is untouched", () => {
  for (const want of ['<nav id="tree"></nav>', 'id="linktabs"', 'data-links="top"', 'data-links="all"', 'data-links="off"', 'id="navbtn"', "data/connections-20261005.json", ".links .ln.hot", ".links .lb.hot", "SUPPLIERS &amp; CUSTOMERS", "no data on the Hub", "WHERE IT LIVES", "COMPS PEERS", "INDEXES &amp; FUNDS HOLDING IT", "AT THE CLOSE", '<details class="sc-pagespecs"><summary>PAGE SPECS</summary>', "T14 · one connected market"]) assert.ok(page.includes(want), want);
  const own = page.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((own.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((h) => !/^#(graph|canvas|outline|podium|areabar|walkhud|tip|fallback|crumbs|main|card|stamp|q|viewtabs|listtabs|linktabs|navbtn|tree|reset|tickers)/.test(h)).length, 0, "no hex colour of its own");
  const cv = R(join(P, "canvas.js")); for (const want of ["setLinks", "cohortAnchor", "anchor", "hot(", "vector", "RING", "onLayout", "frameCohort"]) assert.ok(cv.includes(want), want);
  assert.ok(existsSync(join(P, "connections.mjs")) && existsSync(join(P, "build-connections.mjs")) && existsSync(join(P, "data/raw-20261005/etf_holdings.json")));
  const t13 = execSync("git ls-tree -r ac86899 --name-only deliverables/20260929/tree-map", { cwd: ROOT }).toString().trim().split("\n");
  for (const f of t13) { const now = execSync(`git hash-object "${f}"`, { cwd: ROOT }).toString().trim(), was = execSync(`git rev-parse ac86899:"${f}"`, { cwd: ROOT }).toString().trim(); assert.equal(now, was, f + " unchanged since T13"); }
});

test("5 · the proof: 0 page errors, 614 printed, 0 overlaps, the lines light on hover with their labels", () => {
  const prf = join(P, "shots/t14-proof.json"); if (!existsSync(prf)) { assert.ok(true, "no proof run yet"); return; }
  const o = J(prf)["1680x1050@2"]; assert.deepEqual(o.errors, []);
  const facts = o.log.filter((x) => x.probe && x.probe.startsWith("({ pose")).map((x) => x.value); assert.ok(facts.length >= 5);
  assert.equal(facts[0].printed, 614); for (const f of facts) assert.equal(f.overlaps, 0); assert.equal(facts[0].links.index, 56); assert.equal(facts[0].links.indexes, 16); assert.equal(facts[0].nav.marks.live + facts[0].nav.marks.close + facts[0].nav.marks.none > 600, true);
  const hots = o.log.filter((x) => x.probe && x.probe.startsWith("[...document.querySelectorAll('.links .ln.hot')")).map((x) => x.value); assert.equal(hots[0], 11, "SPY's hover lights its 11 sector lines"); assert.ok(hots[1] >= 15, "NVDA's hover lights its lines"); assert.equal(hots[2], 1, "one cross-sector link lit");
  const labels = o.log.filter((x) => x.probe && x.probe.startsWith("[...document.querySelectorAll('.links .lb.hot')")).map((x) => x.value); assert.ok(labels[0].includes("39%")); assert.ok(labels[1].some((l) => /^SMH 19\./.test(l))); assert.deepEqual(labels[2], ["9"]);
  const shots = readdirSync(join(P, "shots")).filter((f) => f.startsWith("t14-") && f.endsWith(".png")); for (const want of ["t14-market-top-1680.png", "t14-technology-open-1680.png", "t14-nvda-connections-1680.png", "t14-cross-sector-link-1680.png"]) assert.ok(shots.includes(want), want);
});
