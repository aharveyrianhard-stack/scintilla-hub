// T1-MARKET-MAP-3D · the node list is a sound graph (every parent exists, no cycles), every served line matches /universe,
// no reading is stored or invented, and the page obeys the house rules (one CDN, greys, direction colours only).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260927/market-map");
const D = JSON.parse(readFileSync(join(DIR, "nodes.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "index.html"), "utf8");
const DOC = readFileSync(join(DIR, "MARKET-MAP.html"), "utf8");
const byId = new Map(D.nodes.map((n) => [n.id, n]));

test("ids are unique and every parent exists", () => {
  assert.equal(byId.size, D.nodes.length, "duplicate node id");
  for (const n of D.nodes) {
    for (const p of n.parents) assert.ok(byId.has(p), `${n.id} names a parent that does not exist: ${p}`);
    assert.equal(new Set(n.parents).size, n.parents.length, `${n.id} lists a parent twice`);
  }
});

test("exactly one root (the market) and every node reaches it", () => {
  const roots = D.nodes.filter((n) => n.parents.length === 0).map((n) => n.id);
  assert.deepEqual(roots, ["MARKET"]);
  for (const n of D.nodes) {
    let cur = n, hops = 0;
    while (cur.parents.length) { cur = byId.get(cur.parents[0]); assert.ok(++hops < 20, `${n.id}: primary parent chain too long`); }
    assert.equal(cur.id, "MARKET", `${n.id} does not reach the market`);
  }
});

test("no cycles through any parent link", () => {
  const state = new Map(); // 1 = on the stack, 2 = done
  const visit = (id, path) => {
    if (state.get(id) === 2) return;
    assert.notEqual(state.get(id), 1, "cycle: " + [...path, id].join(" → "));
    state.set(id, 1);
    for (const p of byId.get(id).parents) visit(p, [...path, id]);
    state.set(id, 2);
  };
  for (const n of D.nodes) visit(n.id, []);
});

test("the tree runs market → headings → funds → names; names never parent anything", () => {
  const kinds = new Set(["index", "fund", "name"]);
  for (const n of D.nodes) {
    assert.ok(kinds.has(n.kind), `${n.id} has kind ${n.kind}`);
    for (const p of n.parents) {
      const pk = byId.get(p).kind;
      assert.notEqual(pk, "name", `${n.id} hangs off a name (${p})`);
      if (n.kind === "index") assert.equal(pk, "index", `heading ${n.id} under a ${pk}`);
    }
    if (n.kind === "fund") assert.equal(byId.get(n.parents[0]).kind, "index", `fund ${n.id} is not under a heading`);
  }
});

test("every served ticker matches the recorded /universe exactly, and every universe line is on the map", () => {
  const U = D.provenance.universe;
  assert.equal(U.symbols.length, U.count);
  const served = D.nodes.filter((n) => n.served).map((n) => n.ticker).sort();
  assert.deepEqual(served, [...U.symbols].sort());
  assert.deepEqual(D.counts.universe_missed, []);
  for (const n of D.nodes) {
    if (!n.ticker) { assert.equal(n.served, false); continue; }
    assert.equal(n.served, U.symbols.includes(n.ticker), `${n.ticker} served flag disagrees with /universe`);
    // since the 27 Sep sitting a served line is FULL or (served) GEIGER-ONLY; FULL still always means served
    if (n.tier === "FULL") assert.equal(n.served, true, `${n.ticker}: FULL must mean served`);
    if (n.served) assert.ok(n.tier === "FULL" || n.tier === "GEIGER-ONLY", `${n.ticker}: served must be FULL or GEIGER-ONLY`);
  }
});

test("the recorded universe is still the live one (skips when the chart API cannot be reached)", async (t) => {
  let live;
  try {
    const r = await fetch("https://scintilla-massive-chart-api.fly.dev/universe", { headers: { Origin: "https://scintillahub.ai" }, signal: AbortSignal.timeout(8000) });
    live = await r.json();
  } catch (e) { t.skip("chart API unreachable: " + e.message); return; }
  if (live.universe_sha256 !== D.provenance.universe.sha256) {
    const added = live.symbols.filter((s) => !D.provenance.universe.symbols.includes(s));
    const gone = D.provenance.universe.symbols.filter((s) => !live.symbols.includes(s));
    assert.fail(`the served set moved since the build (added ${added.join(",") || "none"}; gone ${gone.join(",") || "none"}) — rerun scripts/build-market-map.mjs`);
  }
});

test("tiers are honest: waiting lines are never FULL, admission-list funds are GEIGER-ONLY", () => {
  for (const n of D.nodes.filter((x) => x.ticker && !x.served)) {
    assert.ok(["GEIGER-ONLY", "NOT_ADMITTED"].includes(n.tier), `${n.ticker} tier ${n.tier}`);
  }
  for (const t of ["IYW", "VGT", "VT", "ITOT", "IBIT", "AGG", "DBC"]) assert.equal(byId.get(t).tier, "GEIGER-ONLY", t);
  for (const t of ["EEM", "EWY", "SMH", "SOXX", "XLK"]) assert.equal(byId.get(t).tier, "FULL", t);
});

test("each sector shows SPDR, iShares, Vanguard and Invesco equal-weight side by side", () => {
  const sectors = D.nodes.filter((n) => n.id.startsWith("SEC_"));
  assert.equal(sectors.length, 11);
  for (const s of sectors) {
    const issuers = D.nodes.filter((n) => n.role === "sector" && n.parents[0] === s.id).map((n) => n.issuer).sort();
    assert.deepEqual(issuers, ["Invesco (equal weight)", "State Street SPDR", "Vanguard", "iShares"], s.label);
  }
});

test("no reading is stored in the node list: Geigers, prices and changes are read live", () => {
  const txt = JSON.stringify(D.nodes);
  for (const k of ["composite", "geiger", "change_pct", "price", "trend", "momentum"]) assert.ok(!txt.includes(`"${k}"`), `node list stores ${k}`);
  for (const n of D.nodes.filter((x) => x.holdings)) {
    assert.equal(n.holdings.as_of, "2026-09-26");
    const sum = n.holdings.top.reduce((s, h) => s + h.weight_pct, 0);
    assert.ok(sum > 0 && sum <= 100.5, `${n.id} top weights sum to ${sum}`);
  }
});

test("the page: one CDN, no random numbers, hollow placeholders, the scintillate hook left unwired", () => {
  const srcs = [...PAGE.matchAll(/https?:\/\/[^"'`\s)]+/g)].map((m) => m[0]);
  for (const u of srcs) {
    assert.ok(/^https:\/\/(cdn\.jsdelivr\.net\/npm\/|scintilla-massive-chart-api\.fly\.dev|station\.scintillahub\.ai\/)/.test(u), "unexpected URL " + u);
  }
  assert.ok(!/Math\.random/.test(PAGE), "the page must never invent a reading");
  assert.match(PAGE, /waiting for admission/);
  assert.match(PAGE, /function scintillate\(node, multiple\)/);
  const code = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.equal((code.match(/scintillate\(/g) || []).length, 1, "scintillate() must be defined and never called yet");
  assert.match(PAGE, /pauseAnimation\(\)/, "the render loop must stop when idle");
  assert.match(PAGE, /data-scnav-slot/);
  assert.match(PAGE, /<!-- scnav · /, "BACK / CLOSE pair missing (run scripts/inject-scnav.py)");
});

test("house look: every colour is a grey at or under 210, except the up / down direction pair", () => {
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

test("the plain-words deliverable says what is real and what is placeholder", () => {
  for (const s of ["waiting for admission", "80%", "what is real", "placeholder", "green", "red"]) {
    assert.ok(DOC.toLowerCase().includes(s.toLowerCase()), "MARKET-MAP.html should cover: " + s);
  }
});
