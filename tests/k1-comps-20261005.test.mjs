/* K1 (5 Oct 2026) — comps: a company's own-business peers seat first, next-door businesses after them, same-family
   fill-ins are capped (MU was priced at $4,393 against $1,065 because 11 of its 12 peers were chip designers). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSet, similarity, linesOf, NEIGHBOURS, NEIGHBOUR_SIM, MIN_PACK, OWN_MIN, HAND } from "../deliverables/20261003/comps-c5/lines.mjs";
import { conclusion } from "../deliverables/20261003/comps-c5/field.mjs";
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const semis = ["AMD", "INTC", "NVDA", "QCOM", "TXN", "ARM", "ADI", "MRVL", "NXPI", "MPWR"];
const profiles = (extra = {}) => ({ MU: { industry: "Semiconductors", market_cap: 1.2e12 }, SNDK: { industry: "Computer Hardware", market_cap: 2.5e11 }, WDC: { industry: "Computer Hardware", market_cap: 1.5e11 },
  STX: { industry: "Computer Hardware", market_cap: 1.2e11 }, ...Object.fromEntries(semis.map((t, i) => [t, { industry: "Semiconductors", market_cap: 1e12 / (i + 1) }])), XLK: { industry: "x", is_etf: true }, ...extra });

test("memory and storage are next door: counted at three quarters, above a chip designer's half", () => {
  assert.deepEqual(NEIGHBOURS, { memory: ["storage"], storage: ["memory"] }); assert.equal(NEIGHBOUR_SIM, 0.75);
  assert.equal(similarity({ lines: { memory: 1 } }, { lines: { memory: 1 } }).sim, 1);
  assert.equal(similarity({ lines: { memory: 1 } }, { lines: { storage: 1 } }).sim, 0.75);
  assert.equal(similarity({ lines: { memory: 1 } }, { lines: { semiconductors: 1 } }).sim, 0.5, "the same family, a different business");
  assert.equal(similarity({ lines: { "e-commerce": 1 } }, { lines: { cloud: 1 } }).neighbour, 0, "no other pair is declared next door");
});

test("MU: the memory maker first, the two storage makers next, then chip designers only as a capped fill", () => {
  const set = buildSet("MU", { profiles: profiles(), segments: {}, fmpRows: [], srcRows: [] });
  assert.deepEqual(set.kept.map((r) => r.ticker).slice(0, 3), ["SNDK", "WDC", "STX"]);
  assert.deepEqual(set.kept.map((r) => r.tier), ["OWN", "NEIGHBOUR", "NEIGHBOUR", "FILL", "FILL"], "three true peers allow two fill-ins: the fill never outnumbers them");
  assert.deepEqual(set.counts.fill_cap, 2); assert.equal(set.kept.length, MIN_PACK);
  assert.ok(set.kept.slice(3).every((r) => semis.includes(r.ticker)));
  assert.match(set.kept[1].why, /^next-door business: storage \(MU is memory\)/);
  assert.match(set.rule, /own-business peers seat first, then next-door businesses, then same-family fill-ins/);
});

test("when SK hynix is served it seats with the memory makers, with no code change", () => {
  assert.deepEqual(HAND.SKHY, { lines: { memory: 1 } }); assert.deepEqual(HAND.MU, { lines: { memory: 1 } });
  const set = buildSet("MU", { profiles: profiles({ SKHY: { industry: "Semiconductors", market_cap: 3e11 } }), segments: {}, fmpRows: [], srcRows: [] });
  assert.deepEqual(set.kept.filter((r) => r.tier === "OWN").map((r) => r.ticker).sort(), ["SKHY", "SNDK"]);
  assert.deepEqual([set.counts.own, set.counts.neighbour, set.counts.fill], [2, 2, 3], "four true peers allow three fill-ins");
});

test("a company in a broad line keeps its full set: every peer that shares 5 cents of its revenue dollar is its own business", () => {
  const p = profiles(); delete p.MU;
  const set = buildSet("NVDA", { profiles: p, segments: {}, fmpRows: [], srcRows: [] });
  assert.equal(OWN_MIN, 0.05);
  const own = set.kept.filter((r) => r.tier === "OWN");
  assert.equal(own.length, 9, "the nine other chip names are all its own business, none capped"); assert.deepEqual(set.kept.slice(0, 9).map((r) => r.tier), Array(9).fill("OWN"), "and they seat before any fill-in");
});

test("a company with no own or next-door peer at all is filled to N as before", () => {
  const p = { ONE: { industry: "Semiconductor Equipment & Materials", market_cap: 1e11 }, ...Object.fromEntries(semis.map((t, i) => [t, { industry: "Semiconductors", market_cap: 1e11 / (i + 1) }])) };
  const set = buildSet("ONE", { profiles: p, segments: {}, fmpRows: [], srcRows: [] });
  assert.equal(set.counts.own + set.counts.neighbour, 0); assert.equal(set.kept.length, 10); assert.equal(set.counts.fill_cap, set.n);
});

test("an equipment maker's customer-market segments are not its business (FormFactor is test equipment, not a memory maker)", () => {
  assert.deepEqual(linesOf("FORM", { industry: "Semiconductors" }, { product: { fy: 2025, data: { "DRAM Product Group": 34, "Foundry & Logic Product Group": 47 } } }).lines, { "semiconductor equipment": 1 });
  const lam = linesOf("LRCX", { industry: "Semiconductor Equipment & Materials" }, { product: { fy: 2025, data: { "Memory": 40, "Foundry": 45, "Logic and other": 15 } } });
  assert.deepEqual(lam.lines, { "semiconductor equipment": 1 }, "memory / foundry keywords never move an equipment maker's revenue");
  const mem = linesOf("XYZ", { industry: "Semiconductors" }, { product: { fy: 2025, data: { "DRAM": 70, "NAND": 30 } } });
  assert.deepEqual(mem.lines, { memory: 1 }, "a chip maker's DRAM and NAND are memory, as before");
});

test("the nine sets re-run on 5 Oct: MU sits with SNDK, WDC, STX and its centre halves; the broad-line names keep twelve", () => {
  const rows = JSON.parse(read("deliverables/20261005/k1-comps/nine-sets-before-after.json")), by = Object.fromEntries(rows.map((r) => [r.ticker, r]));
  assert.deepEqual(Object.keys(by).sort(), ["AMZN", "COST", "JPM", "LLY", "META", "MU", "NVDA", "TSM", "XOM"]);
  assert.deepEqual(by.MU.new.kept.slice(0, 3), ["SNDK", "WDC", "STX"]); assert.equal(by.MU.new.tiers, "ONNFF");
  assert.ok(by.MU.old.mid > 4000 && by.MU.new.mid < by.MU.old.mid * 0.55, `MU centre ${by.MU.old.mid} → ${by.MU.new.mid}`);
  for (const t of ["AMZN", "NVDA", "JPM", "META", "XOM", "LLY"]) assert.equal(by[t].new.kept.length, 12, t + " keeps twelve");
  const f = JSON.parse(read("deliverables/20261003/comps-c5/set-MU-2026-10-05.json"));
  const c = conclusion(f.snapshot, [], f.estimates, f.today, "C");
  assert.equal(Math.round(c.band.mid), by.MU.new.mid, "the stored set gives the stored centre");
});

test("COMPS tab: the set table fits its panel (the business cell wraps) and a fill-in says so", () => {
  const tab = read("deliverables/20261003/comps-c5/tab.mjs");
  assert.match(tab, /\.cm5 table\.p td\.biz,\.cm5 table\.p th\.biz\{white-space:normal;overflow-wrap:anywhere/);
  assert.match(tab, /<span class="seat fill"[^>]*>fill-in<\/span>/); assert.match(tab, /<span class="seat nb"[^>]*>next door<\/span>/);
});
