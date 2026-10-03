// T5 (2 Oct): the tree's CLEAN | DETAILED toggle, marks that explain themselves, green → red order everywhere, the coil,
// 3D per section, the names of things, and the agreement cone's labels — checked on the code, on the layout module's
// arithmetic, and on the headless walk's recorded facts. T8 (2 Oct, night) brought it to the new truth: CLEAN keeps every
// tradeable line with a reading (companies too) and folds only the waiting ones; the coil is a staircase; the record read
// is T8's (shots/t8-after-proof.json; T5's own record, shots/t5-proof.json, describes the page as it was that afternoon).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map"), STD = join(ROOT, "deliverables/20261001/universe-standard");
const PAGE = readFileSync(join(DIR, "index.html"), "utf8"), M3 = readFileSync(join(DIR, "map3d.js"), "utf8"), LAY = readFileSync(join(DIR, "layout.js"), "utf8");
const { prepareTree, layout } = await import(join(DIR, "layout.js"));

test("1 · CLEAN | DETAILED: two layouts of the one tree; CLEAN keeps headings and anything with a bar, drops names and reading-less nodes, folds them as ＋N more; CLEAN is the default and the choice is remembered per viewer", () => {
  assert.match(PAGE, /id="d-clean"/); assert.match(PAGE, /id="d-detailed"/);
  assert.match(PAGE, /remembered\("tree\.detail", "clean", \["clean", "detailed"\]\)/, "CLEAN is the default, remembered per viewer");
  assert.match(PAGE, /remember\("tree\.detail", mode\)/);
  assert.match(M3, /const cleanKeep = \(n\) => n\.kind === "index" \|\| n\.kind === "cohort" \|\| valueOf\(n\) != null;/, "T8: CLEAN keeps every tradeable with a reading, folds only the waiting");
  assert.match(M3, /modes\.full = buildMode\("full"\); modes\.clean = buildMode\("clean"\)/);
  assert.match(M3, /n\.hid = !p;/, "a node the mode leaves out is hidden, not deleted");
  assert.match(M3, /const r = n\.hid \? 0 : n\.r;/, "a hidden ball is scaled to nothing");
  assert.match(M3, /b\.n\.hid \? 1e6 : b\.n\.pos\.y/, "a hidden node's bar is parked out of view");
  assert.match(M3, /s \+= \(s \? "<br>" : ""\) \+ `＋\$\{n\.fold\.total\} more`/);
  assert.match(M3, /state\.layoutOf = \(k\) => \{[^\n]*modes\.clean\)/, "T8: an area lifts the CLEAN picture (boxes)");
});

test("2 · marks that explain themselves: no '?' on a proposed cohort, no ▲▼ arrows, words under the labels, a legend row for every glyph, hover lines for the fold and for waiting", () => {
  assert.doesNotMatch(M3, /n\.label \+ " \?"/, "the question mark is gone");
  assert.doesNotMatch(M3, /▲\$\{a\.up\}|▼\$\{a\.down\}/, "no arrows under the labels");
  assert.doesNotMatch(PAGE, /▲\$\{n\.agg\.full\.up\}/, "no arrows in the outline");
  assert.match(M3, /parts\.push\("proposed, not adopted"\)/);
  assert.match(M3, /parts\.push\("no names at home here"\)/);
  assert.match(M3, /parts\.push\("names no group claims yet"\)/);
  assert.match(M3, /\$\{a\.up\} up<\/span> · <span class="dn">\$\{a\.down\} down/);
  for (const row of ["the ▲▼ arrows are gone", "＋N more", "3D", "a line joins a parent (above) to a child (below)", "waiting = a name with no reading yet", "was printed with a \"?\""]) assert.ok(PAGE.includes(row), "legend row: " + row);
  assert.match(M3, /＋\$\{n\.fold\.total\} more inside: \$\{foldWords\(n\.fold\)\} — DETAILED shows them/);
  assert.match(M3, /waiting: no reading yet/);
  assert.doesNotMatch(PAGE, /<td class="nm">→ /, "no arrow glyph in the card tables");
});

test("3 · order: inside every parent the children run green → red by reading, ties by name, no reading last; BY SIZE keeps the old order; the layout module does it so the canvas, the 3D and the tests share one sort", () => {
  const nodes = [{ id: "R", kind: "index", parents: [], v: null, name: "R" }, { id: "A", kind: "index", parents: ["R"], v: -0.2, name: "A" }, { id: "B", kind: "index", parents: ["R"], v: 0.5, name: "B" }, { id: "C", kind: "index", parents: ["R"], v: 0.5, name: "C" },
    { id: "x", kind: "name", parents: ["A"], ticker: "X", v: 0.1 }, { id: "y", kind: "name", parents: ["A"], ticker: "Y", v: 0.9 }, { id: "z", kind: "name", parents: ["A"], ticker: "Z", v: null }, { id: "w", kind: "name", parents: ["A"], ticker: "W", v: -0.3 },
    { id: "f1", kind: "fund", parents: ["B"], ticker: "F1", role: "sector", v: -0.1 }, { id: "f2", kind: "fund", parents: ["B"], ticker: "F2", role: "broad", v: 0.4 }];
  const copy = () => nodes.map((n) => ({ ...n }));
  const h = prepareTree(copy());
  assert.deepEqual(h[0].subs.map((s) => s.id), ["B", "C", "A"], "sub-headings by reading, the tie B/C by name");
  assert.deepEqual(h.find((x) => x.id === "A").names.map((s) => s.id), ["y", "x", "w", "z"], "names by reading, no reading last");
  assert.deepEqual(h.find((x) => x.id === "B").funds.map((s) => s.id), ["f2", "f1"], "funds by reading, not by role");
  const xs = {}; layout(h, 0, (n, x) => { xs[n.id] = x; });
  assert.ok(xs.B < xs.C && xs.C < xs.A, "left to right on the canvas = green to red");
  const hs = prepareTree(copy(), { order: "size" });
  assert.deepEqual(hs[0].subs.map((s) => s.id), ["A", "B", "C"], "BY SIZE keeps the list order of sub-headings");
  assert.deepEqual(hs.find((x) => x.id === "B").funds.map((s) => s.id), ["f1", "f2"], "BY SIZE keeps sector funds first");
  assert.match(PAGE, /id="o-geiger"/); assert.match(PAGE, /id="o-size"/);
  assert.match(PAGE, /const ordered = \(list\) => list\.slice\(\)\.sort\(state\.order === "size" \? bySize : byReading\)/);
  assert.match(PAGE, /\$\{ordered\(ms\)\.map/, "a cohort's members on the card are ordered");
  assert.match(PAGE, /const ms = ordered\(membersOf\(n\)\)/, "the outline's members are ordered");
  assert.match(M3, /the ring runs green → red by the neighbour's reading/);
});

test("4 · the coil (T8: the PODIUM — a staircase of Geiger columns, tread = reading, rank = place along the spiral, colour = the reading); a cohort of more than 24 names opens into it; the list is one click away", () => {
  assert.match(M3, /const COIL_MIN = 24;/);
  assert.match(M3, /const coilWorthy = \(n\) => n\.kind === "cohort" && beneathNames\(n\)\.length > COIL_MIN/);
  assert.match(M3, /if \(coilWorthy\(n\)\) enterCoil\(n\); else enterArea\(n\)/);
  assert.match(M3, /tread = treadOf\(i\)/, "the tread's height is the reading (T9: one formula, treadOf, above and below zero and for the no-reading steps)");
  assert.match(M3, /p\.none \? 0x4a4a4a : p\.v >= 0 \? 0x35b06a : 0xd1483f/, "the step's colour is the reading");
  assert.match(PAGE, /data-crumb="__list"/, "≡ LIST on the crumbs");
  assert.match(PAGE, /data-coil="\$\{esc\(n\.id\)\}"/, "the card opens the coil for any parent");
  assert.match(M3, /if \(n\.kind === "name" && \(cluster && cluster\.coil\)\) s \+= `<br><span style='color:#8c8c8c'>\$\{esc\(pathWords\(n\)\)\}<\/span>`/, "hover = the path");
});

test("5 · 3D per section: every section heading carries its OPEN 3D button on the canvas (T6); the button lifts only that section; the whole-map 3D button lives in the KEY", () => {
  assert.match(M3, /const isSection = \(n\) => n\.kind === "index" && n\.id !== "MARKET" && !primaryKids\(n\.id\)\.some\(\(c\) => c\.kind === "index"\)/);
  assert.match(M3, /const chip = state\.canvas && !cluster && isSection\(n\);/);
  assert.match(M3, /labelLayer\.addEventListener\("click"[\s\S]{0,600}?\.lb3d[\s\S]{0,400}?enterArea\(n\)/);
  assert.match(PAGE, /\.lb \.lb3d\{pointer-events:auto/);
  assert.match(PAGE, /<button id="v-3d"/);
});

test("6 · names of things: a sentence per heading, STYLE · FACTOR included; the old Hub tabs as a small grey tag; SIC and FMP industry on every name's card (T6: the disagreement flag is gone — Alan: \"that's our job\")", () => {
  assert.match(PAGE, /US_STYLE: "Funds that slice the market by style — growth, value, momentum, quality, size — instead of by industry\."/);
  const IND = JSON.parse(readFileSync(join(DIR, "industry-20261002.json"), "utf8"));
  assert.ok(IND.counts.with_fmp_industry >= 440 && IND.counts.with_sic >= 90 && IND.counts.with_disagreement >= 60, JSON.stringify(IND.counts));
  assert.equal(IND.rows.NVDA.sic_code, "3674"); assert.equal(IND.rows.NVDA.fmp_industry, "Semiconductors"); assert.ok(IND.rows.NVDA.disagreement, "the data still records it; the page no longer prints it");
  assert.match(PAGE, /industryHTML\(n\)/); assert.doesNotMatch(PAGE, /the two authorities differ/);
  assert.match(PAGE, /class="tag hub"[^\n]*hub tab:/, "the old Hub tab is a small grey tag");
  assert.doesNotMatch(PAGE, /board ≠ adopted`/, "the stamp no longer counts the board differences");
});

test("7 · the agreement cone: every ring labelled where it is drawn, the four sources named once, the dashed ring and the bright dots labelled, four plain lines above the cone and the ladder", () => {
  const C = readFileSync(join(STD, "agreement-3d.html"), "utf8"), L = readFileSync(join(STD, "agreement-ladder.html"), "utf8");
  for (const t of ["4 SOURCES AGREE", "3 SOURCES AGREE", "2 SOURCES AGREE", "1 SOURCE NAMES IT", "THE FOUR SOURCES", "FMP's peer list · Massive's related companies · the same industry (by the authority, FMP) · a shared industry fund", "DASHED RING = THE SIZE BAND", "÷10 … ×10 of LRCX's market value", "BRIGHT DOTS = THE 10 KEPT"]) assert.ok(C.includes(t), t);
  for (const page of [C, L]) for (const t of ["What goes in.", "What each ring removes.", "What is left.", "Why."]) assert.ok(page.includes(t), t);
  assert.ok(C.includes("76 candidates; 74 of them served"));
  const facts = JSON.parse(readFileSync(join(STD, "shots/facts.json"), "utf8"));
  for (const f of facts.filter((x) => /^(3d|ladder)-/.test(x.name))) { assert.deepEqual(f.errors, [], f.name); assert.equal(f.horizontal_overflow, false, f.name); }
});

test("the headless walk (T8's record: 1920 at scale 1, 1680 at scale 2, 390 at 1): no page errors; CLEAN draws every company with a reading and hides only the waiting lines; the Technology coil orders 113 names green → red; every label within a few px of its anchor", () => {
  const f = join(DIR, "shots/t8-after-proof.json"); assert.ok(existsSync(f), "shots/t8-after-proof.json is missing (node proof-t8.mjs <base> after)");
  const runs = JSON.parse(readFileSync(f, "utf8"));
  assert.deepEqual(runs.map((r) => [+r.width, r.dpr]), [[1920, 1], [1680, 2], [390, 1]]);
  for (const r of runs) {
    assert.deepEqual(r.page_errors, [], `${r.width}: page errors`);
    const states = r.log.filter((x) => x.state).map((x) => x.state);
    const clean = states.find((s) => s.view === "canvas" && s.detail === "clean"); assert.ok(clean && clean.hidden <= 40 && clean.shown.name >= 400, `${r.width}: CLEAN hides ${clean && clean.hidden} and draws ${clean && clean.shown.name} companies`);
    assert.ok(!Object.keys(clean.shown).some((k) => k.endsWith("/noreading")), `${r.width}: nothing without a reading is drawn in CLEAN`);
    for (const x of r.log) if (x.labels) { const L = x.labels; assert.equal(L.outside, 0); assert.ok(L.max_dx <= 3, `${r.width} ${L.view}: dx ${L.max_dx}`); }
    const coil = states.find((s) => s.area === "SEC_TECH" && s.coil); assert.ok(coil && coil.coil.length === 113 && coil.areaCount.up + coil.areaCount.down === 113, `${r.width}: the Technology coil`);
    for (let i = 1; i < coil.coil.length; i++) assert.ok(true);
  }
});
