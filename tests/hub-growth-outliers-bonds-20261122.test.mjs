/* 22 Nov 2026 — Alan (relayed by the markets session): GROWTH on every ticker row as a small quarterly bar strip, OUTLIERS ringed
   inside each cohort, and a long-vs-short bonds gauge (TLT/SHY) on cohort compare. Static checks on index.html; the live proof
   (headless, the real origin) is in the coordinator's staging folder. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const HUB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function cut(from, to) {
  const a = HUB.indexOf(from), b = HUB.indexOf(to, a);
  assert.ok(a > 0 && b > a, "the page must still carry " + from);
  return HUB.slice(a, b);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

test("GROWTH is the last column of the model and the last cell of every row, drawn after REVENUE by order", () => {
  const BOARD_COLS = new Function(cut("const BOARD_COLS = [", "\n") + "\nreturn BOARD_COLS;")();
  assert.deepEqual(BOARD_COLS[BOARD_COLS.length - 1], ["Growth", "gr"]);
  assert.deepEqual(BOARD_COLS.slice(0, 14).map((c) => c[1]), [null, "t", "price", "c", "fpe", "mc", "rev", "rsi", "tr", "mo", null, "g", "rv", null], "the fourteen keep their places");
  assert.match(HUB, /mktDotHTML\(d\.t\) \+\n {6}\(typeof growCellHTML === "function" \? growCellHTML\(d\) : ""\) \+/);
  assert.match(HUB, /\(key === "gr" \? " sc-grow" : ""\)/);
  assert.match(HUB, /#boardPanel \.ch > :nth-child\(n\+8\):not\(\.sc-grow\)\{ order:1; \}/);
  assert.match(HUB, /\.ch > \.sc-grow\{ display:none; \}/, "hidden wherever a layout does not make room for it (phone, motion)");
  const desk = /body:not\(\.secfs\):not\(\.gwx-motion\) #boardPanel \.ch\{ grid-template-columns:([^!]+)!important/.exec(HUB);
  assert.ok(desk); assert.equal(desk[1].match(/minmax/g).length, 12, "beside the left panel: 11 drawn cells + GROWTH");
  const fs15 = /body\.secfs #boardPanel\.sc-secfs \.ch, body\.secfs \.sc-secfs #boardPanel \.ch\{ grid-template-columns:([^!]+)!important/.exec(HUB);
  assert.ok(fs15); assert.equal(fs15[1].match(/minmax/g).length, 15, "full screen: 14 cells + GROWTH");
});

test("the strip (second pass): four quarters of revenue, a labelled bar each, 24 px tall, a dash with no data", () => {
  const src = cut("let GROWQ = {}", "/* 22 Nov 2026 — OUTLIERS INSIDE THE COHORT.");
  const api = new Function("pg", "esc", "SC_PENDING", src + "\nreturn { set: (m, r) => { GROWQ = m; GROWQ_READ = r; }, growCellHTML, grVal };")(() => Promise.resolve([]), esc, "…");
  api.set({ LLY: { q: ["2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"],
    rev: [0.4468, 0.4518, 0.3765, 0.5387, 0.4256, 0.5554, 0.4767, 0.3861], eps: [1.0165, 0.2339, 0.9177, 4.8037, 0.5143, 1.6993, 0.2623, -0.1207] } }, true);
  const h = api.growCellHTML({ t: "LLY" });
  assert.equal((h.match(/<rect /g) || []).length, 4, "the last four quarters");
  assert.match(h, /height="24"/);
  assert.deepEqual([...h.matchAll(/class="sc-grow__n" fill="[^"]+">([^<]+)</g)].map((m) => m[1]), ["43", "56", "48", "39"]);
  assert.match(h, /Dec '25 \+43% · Mar '26 \+56% · Jun '26 \+48% · Sep '26 \+39%/);
  assert.match(h, /EPS \(reported\): Dec '25 \+51%/, "EPS in the hover");
  assert.equal(+api.grVal("LLY").toFixed(2), 38.61, "the column sorts by the newest quarter's revenue growth");
  assert.match(api.growCellHTML({ t: "SPY" }), />—</, "a fund: a dash");
});

test("outliers: against the board's own middle; multiples on their log at 2.5 spreads, the Geiger at 3; six readings or none; RSI is never ringed", () => {
  const src = cut("const OUT_K = 3;", "/* 22 Nov 2026 — THE GROWTH-SCARE GAUGE");
  const api = new Function(src + "\nreturn { outlierStats, outlierMark, boardOutlierStats };")();
  const fpe = [20, 21, 19, 22, 18, 20.5, 23, 17, 21, 48, 9.2];
  const st = api.outlierStats(fpe, true);
  assert.equal(st.log, true); assert.equal(st.k, 2.5);
  assert.match(api.outlierMark(st, 48), /is-out-hi/); assert.match(api.outlierMark(st, 9.2), /is-out-lo/); assert.equal(api.outlierMark(st, 23), "");
  assert.equal(api.outlierStats([1, 2, 3, 4, 5]), null, "five readings: nothing is ringed");
  const g = api.outlierStats([-0.5, -0.55, -0.6, -0.45, -0.5, -0.52, -0.48, 0.3]);
  assert.equal(g.k, 3); assert.match(api.outlierMark(g, 0.3), /is-out-hi/);
  const b = api.boardOutlierStats([{ fpe: 20 }, { fpe: 21 }, { fpe: 19 }, { fpe: 22 }, { fpe: 18 }, { fpe: 60 }]);
  assert.ok(b.fpe && b.fpe.log); assert.equal(b.g, null);
  assert.match(HUB, /'<span class="sc-fpe' \+ oMark\(OS\.fpe, d\.fpe\)/);
  assert.match(HUB, /'<span class="sc-gcell' \+ oMark\(OS\.g, d\.g\)/);
  assert.doesNotMatch(HUB, /oMark\(OS\.rsi/, "second pass: RSI flashes at its extremes instead of a ring");
  assert.equal("rsi" in b, false);
});

test("the bonds gauge: TLT ÷ SHY against its 200-day, its month and its year, in plain words", () => {
  const src = cut("let BONDG = null", "function bondGaugePaint()");
  const day = 86400e3, t0 = Date.UTC(2025, 0, 1);
  const mk = (f) => Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * day, r: f(i) }));
  const run = (pts) => new Function("esc", "GROW_MON", "SC_CHART_API", src + "\nBONDG = arguments[3]; BONDG_AT = Date.now(); return bondGaugeHTML();")(esc, ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], "", pts);
  assert.match(run(mk((i) => 1 + i * 0.001)), /climbing: money moving into long bonds/);
  assert.match(run(mk((i) => 1.3 - i * 0.001)), /falling: long bonds lagging short ones/);
  assert.match(HUB, /return cmpxBarHTML\(\) \+ \(typeof bondGaugeHTML === "function" \? bondGaugeHTML\(\) : ""\) \+ '<div class="sc-cmpx__scroll"/);
});
