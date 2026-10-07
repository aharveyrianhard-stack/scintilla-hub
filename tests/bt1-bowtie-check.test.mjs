// BT1 (6 Oct 2026) — Alan on the COHORT COMPARE bow tie: "Healthcare plus 55, financials plus 0.02, tech plus 0.00.
// I don't think this bow tie is right." Every number reproduced from the chart API's /geiger rows; two things were wrong
// around them: (1) the SPDR columns printed OUR NAMES' trend / momentum under the FUND's bar, (2) the hover called a
// +0.00 gap "the average stock is stronger" and never said the gap is Geiger points. These run the page's own functions.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => {
  const i = src.indexOf("\nfunction " + name + "(");
  assert.ok(i > 0, name + " is defined once at the top level");
  const j = src.indexOf("\n}\n", i);
  return src.slice(i, j + 3);
};
// the live rows of 6 Oct 2026 18:45Z (chart API /geiger, as the page received them)
const FEED = { RSPH: [0.429048, 0.636544, 0.221551], XLV: [-0.116726, -0.09362, -0.139833], RSPT: [0.944049, 1, 0.888098],
  XLK: [0.9412, 1, 0.882401], RSPF: [-0.120882, -0.127834, -0.11393], XLF: [-0.138172, -0.242959, -0.033384],
  RSP: [0.136333, -0.028008, 0.300674], SPY: [0.821701, 0.899252, 0.74415] };
function world({ mode = "SECTORS", fam = "SPDR", rewound = false } = {}) {
  const ctx = { window: { SC_CMP_MODE: mode, SECT_FAMILY: fam, SC_INDEX_FUNDS: [["SPY", "S&P 500"]],
      SCIN_TM: { NVDA: { tr: 0.4, mo: 0.2 }, MSFT: { tr: 0.2, mo: 0.4 }, XLK: { tr: 0.9, mo: 0.8 } } },
    document: { body: { classList: { contains: (c) => rewound && c === "gwx-on" } } },
    COHSETS: { TECH: new Set(["NVDA", "MSFT"]), AI_SOFTWARE: new Set(["MSFT"]) }, SPDR_TO_SECTOR: { XLK: "TECH" }, COHORT_OF: {},
    SC_PROV_TM: Object.fromEntries(Object.entries(FEED).map(([t, v]) => [t, { tr: v[1], mo: v[2] }])),
    L0_CMP_MIN_SPAN: 0.05, num: (v) => (v == null || !isFinite(+v) ? null : +v), isFinite };
  vm.createContext(ctx);
  vm.runInContext(["scCmpMode", "scStripIsFund", "scinGroupTM", "scinGroupTickers", "scinStripTM", "scBowtieLine"].map(fn).join("\n"), ctx);
  return ctx;
}
const line = (w, name, e, c) => w.scBowtieLine(name, e, c, FEED[e][0], FEED[c][0], FEED[e][1], FEED[c][1]);

test("a fund column's trend / momentum is the fund's own, not our names in that sector", () => {
  const w = world({ fam: "SPDR" });
  assert.deepEqual([...w.scinGroupTickers("XLK")], ["XLK"]);
  const g = w.scinStripTM("XLK");
  assert.equal(g.tr, 1); assert.equal(g.mo, 0.882401); assert.equal(g.n, 1);
  for (const f of ["ISHARES", "VANGUARD", "EQWT", "INDEXES", "BOWTIE"]) assert.equal(world({ fam: f }).scStripIsFund(), true, f);
});
test("OUR NAMES and the cohorts still average their members", () => {
  const m = world({ fam: "MEMBERS" });
  assert.equal(m.scStripIsFund(), false);
  assert.deepEqual([...m.scinGroupTickers("XLK")].sort(), ["MSFT", "NVDA"]);
  const g = m.scinStripTM("XLK");
  assert.ok(Math.abs(g.tr - 0.3) < 1e-9 && Math.abs(g.mo - 0.3) < 1e-9); assert.equal(g.n, 2);
  const c = world({ mode: "COHORTS", fam: "SPDR" });   // a stored SPDR choice must not leak into the cohort strip
  assert.equal(c.scStripIsFund(), false);
  assert.deepEqual([...c.scinGroupTickers("AI_SOFTWARE")], ["MSFT"]);
});
test("rewound, a fund column falls back to the board's store for that fund (the feed is today's)", () => {
  const g = world({ fam: "SPDR", rewound: true }).scinStripTM("XLK");
  assert.equal(g.tr, 0.9); assert.equal(g.mo, 0.8);
});
test("health: the arithmetic is on the line, in Geiger points, and it says the average stock is stronger", () => {
  const s = line(world({ fam: "BOWTIE" }), "HEALTH", "RSPH", "XLV");
  assert.match(s, /RSPH \(equal-weight\) \+0\.43 − XLV \(cap-weight\) −0\.12 = \+0\.55 Geiger points \(a gap between two scores, not a % return\)/);
  assert.match(s, /the average stock is stronger than the index$/);
});
test("tech +0.00 reads level and says both funds are at the gauge's limit — never 'stronger'", () => {
  const s = line(world({ fam: "BOWTIE" }), "TECH", "RSPT", "XLK");
  assert.match(s, /= \+0\.00 Geiger points/);
  assert.match(s, /level: the average stock and the index read the same/);
  assert.match(s, /both funds' trend is at the gauge's limit \(\+1\.00\), so no gap can show here$/);
  assert.doesNotMatch(s, /stronger than the index/);
});
test("financials +0.02 is inside the strip's own flat floor, so it reads level with no limit note", () => {
  const s = line(world({ fam: "BOWTIE" }), "FINANCIALS", "RSPF", "XLF");
  assert.match(s, /= \+0\.02 Geiger points/); assert.match(s, /level:/); assert.doesNotMatch(s, /limit|stronger|carried/);
});
test("a wide negative gap still says the index is carried by its biggest names; a missing Geiger says so", () => {
  const w = world({ fam: "BOWTIE" });
  assert.match(line(w, "S&P 500", "RSP", "SPY"), /= −0\.69 Geiger points.*the index is carried by its biggest names$/);
  assert.match(w.scBowtieLine("RUSSELL 1000", "EQAL", "IWB", null, null, null, null), /no Geiger yet − IWB \(cap-weight\) no Geiger yet · no difference: a Geiger is missing$/);
});
test("the page wires them in: the feed's pair is kept, the strip and the bow tie row call the two functions", () => {
  assert.match(src, /SC_PROV_TM\[t\] = \{ tr: num\(m\[t\]\.trend\), mo: num\(m\[t\]\.momentum\) \}/);
  assert.match(src, /const g = r\.blend \? \{ tr: null, mo: null, n: 0 \} : scinStripTM\(r\.key\);/);   /* HC1 (6 Oct) — a consolidated bar has no single pair; every other column still reads scinStripTM */
  assert.match(src, /full:scBowtieLine\(p\[2\], p\[0\], p\[1\], ew, cw, tOf\(p\[0\]\), tOf\(p\[1\]\)\)/);
});
