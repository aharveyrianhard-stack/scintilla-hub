// MARKET-MAP r3 (28 Sep) · the tree map: the node list is the 27 Sep one node for node (nothing else changes), the holdings
// weights are honest, the aggregate maths is right on a fixture, the tree layout is deterministic and top-down, and the page
// wires the Geiger bars, the holdings bar, click-again / Esc to let go, render on demand and the house look.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/market-map-r3");
const R3 = JSON.parse(readFileSync(join(DIR, "nodes.json"), "utf8"));
const OLD = JSON.parse(readFileSync(join(ROOT, "deliverables/20260927/market-map/nodes.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "index.html"), "utf8");
const DOC = readFileSync(join(DIR, "MARKET-MAP-R3.html"), "utf8");
const { holdingsAggregate, divergence } = await import(pathToFileURL(join(DIR, "aggregate.js")));
const { prepareTree, layout, LAYOUT } = await import(pathToFileURL(join(DIR, "layout.js")));
const byId = new Map(R3.nodes.map((n) => [n.id, n]));
const SERVED = new Set(R3.provenance.universe.symbols);

test("node list integrity: the r3 list is the 27 Sep list node for node (same ids, order, parents, kinds, tiers)", () => {
  assert.equal(R3.nodes.length, OLD.nodes.length);
  R3.nodes.forEach((n, i) => {
    const o = OLD.nodes[i];
    for (const k of ["id", "ticker", "label", "kind", "role", "issuer", "served", "tier", "market_value_usd"]) assert.deepEqual(n[k], o[k], `${n.id}.${k}`);
    assert.deepEqual(n.parents, o.parents, `${n.id} parents`);
  });
  assert.deepEqual(R3.provenance.universe, OLD.provenance.universe);
});

test("node list integrity: unique ids, every parent exists, one root, no cycles", () => {
  assert.equal(byId.size, R3.nodes.length);
  const roots = R3.nodes.filter((n) => !n.parents.length).map((n) => n.id);
  assert.deepEqual(roots, ["MARKET"]);
  for (const n of R3.nodes) {
    for (const p of n.parents) assert.ok(byId.has(p), `${n.id} → missing parent ${p}`);
    let cur = n, hops = 0;
    while (cur.parents.length) { cur = byId.get(cur.parents[0]); assert.ok(++hops < 20, `${n.id}: chain too long`); }
    assert.equal(cur.id, "MARKET");
  }
});

test("holdings weights are honest: only served tickers, positive, never more than the fund's whole file", () => {
  const funds = R3.nodes.filter((n) => n.holdings && n.holdings.served_weights);
  assert.equal(funds.length, R3.provenance.holdings.served_weights_for_funds);
  assert.ok(funds.length >= 40, "expected the 51-fund holdings file to cover most funds");
  for (const f of funds) {
    const h = f.holdings;
    assert.ok(h.total_weight_pct > 0 && h.total_weight_pct <= 100.5, `${f.id} total ${h.total_weight_pct}`);
    const seen = new Set(); let sum = 0;
    for (const [t, w] of h.served_weights) {
      assert.ok(SERVED.has(t), `${f.id}: ${t} is not served`);
      assert.ok(!seen.has(t), `${f.id}: ${t} twice`); seen.add(t);
      assert.ok(w > 0, `${f.id}: ${t} weight ${w}`); sum += w;
    }
    assert.ok(sum <= h.total_weight_pct + 0.01, `${f.id}: served ${sum} > total ${h.total_weight_pct}`);
    for (const x of h.top) assert.equal(x.served, SERVED.has(x.ticker), `${f.id} top ${x.ticker} served flag`);
  }
  // spot checks against the 26 Sep file: XLK is almost all served, IWM (2,000 small caps) almost none
  const cov = (t) => byId.get(t).holdings.served_weights.reduce((s, [, w]) => s + w, 0) / byId.get(t).holdings.total_weight_pct;
  assert.ok(cov("XLK") > 0.85, "XLK coverage"); assert.ok(cov("IWM") < 0.1, "IWM coverage");
});

test("no reading is stored in the node list: Geigers, prices and changes are read live", () => {
  const txt = JSON.stringify(R3.nodes);
  for (const k of ["composite", "geiger", "change_pct", "price", "trend", "momentum"]) assert.ok(!txt.includes(`"${k}"`), `node list stores ${k}`);
});

test("aggregate maths on a fixture: weight-blended over the holdings with a reading, coverage against the whole fund", () => {
  const fund = { holdings: { total_weight_pct: 100, served_weights: [["A", 50], ["B", 30], ["C", 10], ["Z", 0]] } };
  const G = { A: 0.5, B: -0.5, C: null };
  const a = holdingsAggregate(fund, (t) => (t in G ? G[t] : null));
  assert.ok(Math.abs(a.value - (50 * 0.5 + 30 * -0.5) / 80) < 1e-12, "value = Σw·g / Σw = 10/80 = 0.125");
  assert.equal(a.count, 2);
  assert.equal(a.weight_pct, 80);
  assert.equal(a.coverage_pct, 80);
  assert.deepEqual(a.not_read, ["C"]);
  // coverage is against the fund's whole file (cash included), not against the served part
  const b = holdingsAggregate({ holdings: { total_weight_pct: 99.7, served_weights: [["A", 41.2]] } }, () => -0.3);
  assert.ok(Math.abs(b.coverage_pct - (100 * 41.2) / 99.7) < 1e-9); assert.equal(b.value, -0.3);
  // nothing read, or no holdings file → no bar at all (never a zero that looks like a reading)
  assert.equal(holdingsAggregate(fund, () => null), null);
  assert.equal(holdingsAggregate({ holdings: null }, () => 1), null);
  assert.equal(holdingsAggregate({}, () => 1), null);
  assert.equal(holdingsAggregate({ holdings: { total_weight_pct: 0, served_weights: [["A", 1]] } }, () => 1), null);
  // a reading outside the numbers (NaN) is treated as no reading
  assert.deepEqual(holdingsAggregate({ holdings: { total_weight_pct: 100, served_weights: [["A", 60], ["B", 40]] } }, (t) => (t === "A" ? NaN : 0.2)).not_read, ["A"]);
});

test("divergence line: holdings minus fund, in plain words, two decimals", () => {
  assert.equal(divergence(0.1, 0.31).text, "holdings stronger than the fund by 0.21");
  assert.equal(divergence(0.71, 0.42).text, "holdings weaker than the fund by 0.29");
  assert.equal(divergence(-0.2, -0.2).text, "fund and holdings read the same");
  assert.ok(divergence(0.71, 0.42).diff < 0);
  assert.equal(divergence(null, 0.4), null);
  assert.equal(divergence(0.4, null), null);
});

test("the aggregate on the real list: XLK blends its served holdings, a fund with no file has none", () => {
  const G = (t) => (SERVED.has(t) ? 0.5 : null);
  const x = holdingsAggregate(byId.get("XLK"), G);
  assert.ok(Math.abs(x.value - 0.5) < 1e-12);
  assert.equal(x.count, byId.get("XLK").holdings.served_weights.length);
  assert.ok(x.coverage_pct > 85 && x.coverage_pct <= 100);
  assert.equal(holdingsAggregate(byId.get("GLD"), G), null, "GLD has no holdings file");
});

test("tree layout: deterministic, top-down (every child below its parent), upper tree flat, depth only where rows need it", () => {
  const run = (k) => {
    const nodes = structuredClone(R3.nodes), heads = prepareTree(nodes), out = new Map();
    layout(heads, k, (n, x, y, z) => { assert.ok(!out.has(n.id), `${n.id} placed twice`); out.set(n.id, [x, y, z]); });
    return { out, heads };
  };
  const a = run(1), b = run(1), f = run(0);
  assert.equal(a.out.size, R3.nodes.length, "every node placed");
  assert.deepEqual([...a.out], [...b.out], "same input → same picture");
  for (const n of R3.nodes) {
    const p = a.out.get(n.id);
    assert.ok(p.every(Number.isFinite), `${n.id} has a finite position`);
    if (n.parents.length) assert.ok(p[1] < a.out.get(n.parents[0])[1], `${n.id} is not below its parent`);
    if (n.kind === "index") assert.equal(p[2], 0, `heading ${n.id} must sit in the flat upper tree`);
    assert.equal(f.out.get(n.id)[2], 0, `FLAT 2D: ${n.id} must have no depth`);
  }
  for (const h of a.heads) {
    const leaves = [...h.funds, ...h.names];
    const rows = Math.max(Math.ceil(h.funds.length / (h.cols || 1)), Math.ceil(h.names.length / (h.cols || 1)));
    const zs = leaves.map((n) => a.out.get(n.id)[2]);
    if (rows <= 1) assert.ok(zs.every((z) => z === 0), `${h.id}: one row, so no depth`);
    else assert.ok(Math.max(...zs) > 0, `${h.id}: ${rows} rows should step into depth`);
    assert.ok(h.cols <= 9, `${h.id}: at most 9 columns`);
  }
  const tech = a.heads.find((h) => h.id === "SEC_TECH"), reit = a.heads.find((h) => h.id === "SEC_REIT");
  assert.ok(tech.nRows > reit.nRows, "a big sector is deeper than a small one");
});

test("tree layout: no two balls on top of each other, in 3D or flat", () => {
  for (const k of [1, 0]) {
    const nodes = structuredClone(R3.nodes), heads = prepareTree(nodes), pts = [];
    layout(heads, k, (n, x, y, z) => pts.push([n.id, x, y, z]));
    const min = LAYOUT.SP * 0.5;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][1] - pts[j][1], pts[i][2] - pts[j][2], pts[i][3] - pts[j][3]);
      assert.ok(d >= min, `${k ? "3D" : "flat"}: ${pts[i][0]} and ${pts[j][0]} are ${d.toFixed(1)} apart`);
    }
  }
});

test("the page: Geiger bars on the Hub scale, the holdings bar, click again or Esc to let go, render on demand", () => {
  assert.match(PAGE, /from "\.\/aggregate\.js"/, "the page must use the tested aggregate");
  assert.match(PAGE, /from "\.\/layout\.js"/, "the page must use the tested layout");
  assert.match(PAGE, /InstancedBufferGeometry/, "bars are one instanced draw");
  assert.match(PAGE, /Math\.min\(1, Math\.abs\(v\)\) \* 50/, "card bar: ±1 fills the half, as the Hub's composite bars");
  assert.match(PAGE, /if \(n\.id === state\.selected\) release\(\); else select\(n\);/, "clicking the picked ball again lets go");
  assert.match(PAGE, /e\.key === "Escape" && state\.selected/, "Esc lets go");
  assert.match(PAGE, /aggregate of <b>\$\{a\.count\}<\/b> holdings = <b>\$\{a\.coverage_pct\.toFixed\(0\)\}%<\/b> of the fund's weight/);
  assert.match(PAGE, /DIVERGENCE/);
  assert.match(PAGE, /not served/);
  assert.ok(!/Math\.random/.test(PAGE), "the page must never invent a reading");
  assert.match(PAGE, /pauseAnimation\(\)/, "the render loop must stop when idle");
  assert.match(PAGE, /FLAT 2D/);
  assert.match(PAGE, /data-scnav-slot/);
  assert.match(PAGE, /<!-- scnav · /, "BACK / CLOSE pair missing (run scripts/inject-scnav.py)");
  const srcs = [...PAGE.matchAll(/https?:\/\/[^"'`\s)]+/g)].map((m) => m[0]);
  for (const u of srcs) assert.ok(/^https:\/\/(cdn\.jsdelivr\.net\/npm\/|scintilla-massive-chart-api\.fly\.dev|station\.scintillahub\.ai\/)/.test(u), "unexpected URL " + u);
});

test("house look: every colour is a grey at or under 210, except the up / down pair; text at least 11 px", () => {
  const allowed = new Set(["35b06a", "d1483f"]);
  const hexes = [...PAGE.matchAll(/(?:#|0x)([0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase());
  assert.ok(hexes.length > 5);
  for (const h of hexes) {
    if (allowed.has(h)) continue;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, "not a house grey: #" + h);
  }
  const sizes = [...PAGE.matchAll(/font(?:-size)?:\s*(?:[^;}\n]*?\s)?(\d+)px/g)].map((m) => +m[1]);
  for (const s of sizes) assert.ok(s >= 11, "text below 11px: " + s);
});

test("the plain-words deliverable covers what it shows, where numbers come from, what could be wrong, what was not done", () => {
  for (const s of ["what this page shows", "where the numbers come from", "what could be wrong", "what i did not do", "coverage", "let go", "flat 2d"]) {
    assert.ok(DOC.toLowerCase().includes(s), "MARKET-MAP-R3.html should cover: " + s);
  }
});
