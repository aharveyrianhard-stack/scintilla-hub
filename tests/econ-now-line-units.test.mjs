/* M70 (24 Sep 2026) — two rules of the Economic room, pinned to the page's own bytes.
   1. THE NOW LINE: where the marker lands in a list of releases, and when it is not drawn at all.
   2. THE SAME-SCALE TRIO: when a value the feed filed on another scale is corrected, and — just as
      important — when it is left alone.
   3. THE MONTH CELL: a High-impact release is never the entry that falls behind "+N more".
   Every block is VM-extracted from ../index.html, the way this repo's other tests do it, so the
   test cannot drift from what the page runs. No network, no browser. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (from, to, what) => {
  const a = page.indexOf(from), b = page.indexOf(to, a);
  assert.ok(a > 0 && b > a, what + " is in the page");
  return page.slice(a, b);
};
const UNITS = cut("const EC_SCALE_STEPS = [1e3, 1e6];", "/* what the dotted value says", "the same-scale trio rule") +
  page.match(/function ecUnitNote\(r, field\) \{[\s\S]*?\n\}\n/)[0];
const NOW = cut("function ecNowLabel(nowSec)", "function renderEconTable()", "the now-line engine");
const KEEP = cut("const EC_IMP_W = { High: 3", "function ecMonthHTML(rows) {", "the month-cell keep rule");
const HELPERS = page.match(/const ecDateKey = \(ts\) =>[^\n]*\n/)[0] +
  page.match(/const ecTimeET {2}= \(ts\) =>[\s\S]*?;\n/)[0] +
  page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];

/* ---- a DOM small enough to read, real enough to place a marker in ------------------ */
function makeNode(cls, ets) {
  const n = { className: cls, dataset: ets == null ? {} : { ets: String(ets) }, innerHTML: "",
              parentNode: null, children: [] };
  n.matches = (sel) => sel === ".ec-now" ? /\bec-now\b/.test(n.className)
    : sel === ".ec-ev" ? /\bec-ev\b/.test(n.className)
    : sel === ".ec-row:not(.sub)" ? /\bec-row\b/.test(n.className) && !/\bsub\b/.test(n.className)
    : false;
  n.querySelectorAll = (sel) => n.children.filter((c) => c.matches(sel));
  n.querySelector = (sel) => n.querySelectorAll(sel)[0] || null;
  n.insertBefore = (node, ref) => {
    const i = ref == null ? n.children.length : n.children.indexOf(ref);
    n.children.splice(i < 0 ? n.children.length : i, 0, node);
    node.parentNode = n;
    return node;
  };
  n.removeChild = (node) => { const i = n.children.indexOf(node); if (i >= 0) n.children.splice(i, 1); node.parentNode = null; return node; };
  return n;
}
function host(rows) {
  const tbl = makeNode("ec-tbl");
  for (const r of rows) tbl.insertBefore(makeNode(r.cls || "ec-row", r.ets), null);
  const box = makeNode("box");
  box.insertBefore(tbl, null);
  box.querySelector = (sel) => sel === ".ec-tbl" ? tbl : null;
  box.querySelectorAll = (sel) => sel === ".ec-now" ? tbl.children.filter((c) => c.matches(".ec-now")) : [];
  return { box, tbl };
}
function load(box) {
  const ctx = vm.createContext({
    console, setInterval: () => 1,
    document: { querySelectorAll: () => [], createElement: (t) => makeNode("") },
    el: (id) => (id === "econTbl" ? box : null),
  });
  return vm.runInContext(HELPERS + UNITS + KEEP + NOW +
    "\n;({ ecUnifyRow, ecUnitNote, ecScaleGap, ecNowPaint, ecNowPlace, ecNowLabel, ecCellKeep, ecTapeNowHTML })", ctx);
}
const ET = (iso) => Math.floor(Date.parse(iso) / 1000);
/* 24 Sep 2026 is a Thursday; ET is UTC−4 that week */
const T10 = ET("2026-09-24T14:00:00Z");   // 10:00 ET — New Home Sales
const T0830 = ET("2026-09-24T12:30:00Z"); // 08:30 ET
const T1300 = ET("2026-09-24T17:00:00Z"); // 13:00 ET
const NOW1145 = ET("2026-09-24T15:45:00Z");   // 11:45 ET

test("the now line lands between the release before it and the release after it", () => {
  const { box, tbl } = host([{ ets: T0830 }, { ets: T10 }, { ets: T1300 }]);
  const api = load(box);
  assert.equal(api.ecNowPaint(NOW1145), 1);
  const kinds = tbl.children.map((c) => (c.matches(".ec-now") ? "NOW" : c.dataset.ets));
  assert.deepEqual(kinds, [String(T0830), String(T10), "NOW", String(T1300)]);
  assert.equal(tbl.children[2].innerHTML.includes("now 11:45 ET"), true, tbl.children[2].innerHTML);
});

test("when everything today has already printed, the line sits after the last one", () => {
  const { box, tbl } = host([{ ets: T0830 }, { ets: T10 }]);
  const api = load(box);
  assert.equal(api.ecNowPaint(ET("2026-09-24T22:00:00Z")), 1);
  assert.equal(tbl.children[tbl.children.length - 1].matches(".ec-now"), true);
});

test("a day that is not today gets no now line at all", () => {
  const { box, tbl } = host([{ ets: ET("2026-09-25T13:00:00Z") }, { ets: ET("2026-09-25T14:00:00Z") }]);
  const api = load(box);
  assert.equal(api.ecNowPaint(NOW1145), 0);
  assert.equal(tbl.children.some((c) => c.matches(".ec-now")), false);
});

test("re-painting moves the line instead of leaving a trail", () => {
  const { box, tbl } = host([{ ets: T0830 }, { ets: T10 }, { ets: T1300 }]);
  const api = load(box);
  api.ecNowPaint(ET("2026-09-24T13:00:00Z"));   // 09:00 ET
  api.ecNowPaint(NOW1145);
  api.ecNowPaint(ET("2026-09-24T16:30:00Z"));   // 12:30 ET
  assert.equal(tbl.children.filter((c) => c.matches(".ec-now")).length, 1);
  assert.equal(tbl.children.map((c) => c.matches(".ec-now")).indexOf(true), 2);
});

test("a sub-row of a collapsed family never splits its parent from the line", () => {
  const { box, tbl } = host([{ ets: T0830 }, { ets: T0830, cls: "ec-row sub" }, { ets: T1300 }]);
  const api = load(box);
  api.ecNowPaint(NOW1145);
  assert.equal(tbl.children[2].matches(".ec-now"), true, "the line follows the whole family, not its first child");
});

/* ---- the same-scale trio ---------------------------------------------------------- */
test("New Home Sales, 24 Sep: the estimate filed in millions is shown at the scale of the other two", () => {
  const api = load(host([]).box);
  const r = { actual: 684, estimate: 0.62, previous: 607 };
  const u = api.ecUnifyRow(r);
  assert.ok(u, "the row is corrected");
  assert.equal(u.ref, "previous");
  assert.equal(u.fixes.length, 1);
  assert.equal(u.fixes[0].field, "estimate");
  assert.equal(u.fixes[0].to, 620);
  assert.equal(u.fixes[0].factor, 1 / 1000);
  assert.equal(684 - u.fixes[0].to, 64, "the surprise becomes +64k, not +683.38");
});

test("the row as the feed now carries it — all three in millions — is left alone", () => {
  const api = load(host([]).box);
  assert.equal(api.ecUnifyRow({ actual: 0.684, estimate: 0.62, previous: 0.643 }), null);
});

test("a ten-fold or hundred-fold difference is never touched: that can be a real miss", () => {
  const api = load(host([]).box);
  assert.equal(api.ecUnifyRow({ actual: 684, estimate: 68.4, previous: 607 }), null);
  assert.equal(api.ecUnifyRow({ actual: 684, estimate: 6.84, previous: 607 }), null);
});

test("the corrected value can be the actual, and a millionfold slip is corrected too", () => {
  const api = load(host([]).box);
  const a = api.ecUnifyRow({ actual: 0.684, estimate: 620, previous: 607 });
  assert.equal(a.fixes[0].field, "actual");
  assert.equal(Math.round(a.fixes[0].to), 684);
  const m = api.ecUnifyRow({ actual: 684e6, estimate: 620, previous: 607 });
  assert.equal(m.fixes[0].field, "actual");
  assert.equal(m.fixes[0].to, 684);
});

test("negative values, zeros and single values are handled without inventing anything", () => {
  const api = load(host([]).box);
  assert.equal(api.ecUnifyRow({ actual: -246, estimate: -255, previous: -212.6 }), null, "the Current Account row is one scale");
  assert.equal(api.ecUnifyRow({ actual: 684, estimate: null, previous: null }), null, "one value alone cannot be judged");
  assert.equal(api.ecUnifyRow({ actual: 0, estimate: 0.62, previous: null }), null, "zero takes no part");
  const neg = api.ecUnifyRow({ actual: -684, estimate: -0.62, previous: -607 });
  assert.equal(neg.fixes[0].to, -620, "sign is preserved");
});

test("the reader is told what was changed, and the feed's own number is kept", () => {
  const api = load(host([]).box);
  const r = { event: "New Home Sales (Aug)", actual: 684, estimate: 0.62, previous: 607 };
  const u = api.ecUnifyRow(r);
  r.unit_fix = u;
  for (const f of u.fixes) { r["raw_" + f.field] = r[f.field]; r[f.field] = f.to; }
  assert.equal(r.raw_estimate, 0.62);
  assert.equal(r.estimate, 620);
  const note = api.ecUnitNote(r, "estimate");
  assert.match(note, /the feed filed this as 0\.62/);
  assert.equal(api.ecUnitNote(r, "actual"), "", "a value that was not changed says nothing");
});

/* ---- the month cell --------------------------------------------------------------- */
test("a full month cell keeps the loudest releases and still draws them in time order", () => {
  const api = load(host([]).box);
  const mk = (h, imp) => ({ head: { event_ts: ET("2026-09-24T" + h + ":00:00Z"), impact: imp } });
  const list = [mk("12", "Low"), mk("13", "Medium"), mk("14", "High"), mk("15", "Low"), mk("16", "Low"),
                mk("17", "Low"), mk("18", "Low")];
  const kept = api.ecCellKeep(list, 5);
  assert.equal(kept.length, 5);
  assert.ok(kept.includes(list[2]), "the High-impact release is kept");
  assert.ok(kept.includes(list[1]), "then the Medium one");
  assert.deepEqual(kept.map((g) => g.head.event_ts), kept.map((g) => g.head.event_ts).slice().sort((a, b) => a - b),
    "what is kept is still drawn in time order");
  assert.equal(api.ecCellKeep(list.slice(0, 3), 5).length, 3, "a cell that fits keeps everything");
});

test("two numbers a thousand apart with no third value are NOT corrected — the room says so instead", () => {
  const api = load(host([]).box);
  const u = api.ecUnifyRow({ actual: 0.66, estimate: 655 });
  assert.equal(u.ambiguous, true, "no majority, so no scale is chosen");
  assert.equal(u.fixes.length, 0, "nothing is rescaled on a guess");   // values cross a VM realm: compare content
});
