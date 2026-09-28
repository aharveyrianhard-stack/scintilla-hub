/* The labelled comps row (deliverables/20260928/comps-labels): labels never sit on each other, never
   leave the chart, and the words on each label carry the mark, the multiple, whose it is and the price. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeLabels, placeStrip, rowLabels, withoutPeers, sanity } from "../deliverables/20260928/comps-labels/labels.mjs";
import { peerBand, fmt } from "../deliverables/20260927/comps-r3/r3.mjs";

const overlap = (a, b) => a.side === b.side && a.lane === b.lane && a.left < b.right && b.left < a.right;

test("labels on one row never overlap and never leave the chart, at 1600 and at 340 wide", () => {
  const marks = [
    { id: "me", x: 0.27, w: 190, side: "above", prio: 0 }, { id: "min", x: 0.01, w: 150, side: "above", prio: 2 },
    { id: "median", x: 0.5, w: 175, side: "above", prio: 1 }, { id: "max", x: 0.95, w: 155, side: "above", prio: 2 },
    { id: "q1", x: 0.29, w: 140, side: "below", prio: 3 }, { id: "q3", x: 0.58, w: 140, side: "below", prio: 3 },
  ];
  for (const width of [1600, 340]) {
    const res = placeLabels(marks.map((m) => ({ ...m, x: m.x * width })), { width, lanes: 5 });
    assert.equal(res.length, marks.length);
    for (let i = 0; i < res.length; i++) for (let j = i + 1; j < res.length; j++) assert.ok(!overlap(res[i], res[j]), `${res[i].id} sits on ${res[j].id} at ${width}`);
    for (const r of res) { assert.ok(r.left >= 0 && r.right <= width, `${r.id} leaves the chart at ${width}`); }
    assert.equal(res[0].id, "me");
  }
});

test("the most important label keeps its spot; a label pushed off its mark gets a leader line", () => {
  const res = placeLabels([{ id: "a", x: 100, w: 120, side: "above", prio: 0 }, { id: "b", x: 110, w: 120, side: "above", prio: 1 }], { width: 800, lanes: 3 });
  assert.equal(res[0].lane, 0); assert.equal(res[0].side, "above"); assert.equal(res[0].leader, false);
  // b cannot go out a lane above: its pointer would pass behind a. It takes the other side of the bar instead, and says it moved.
  assert.equal(res[1].side, "below"); assert.equal(res[1].leader, true);
});

test("a label at the chart's edge is pulled inside and marked as moved", () => {
  const [r] = placeLabels([{ id: "min", x: 2, w: 150, side: "above", prio: 2 }], { width: 1000, lanes: 3 });
  assert.equal(r.left, 0); assert.ok(r.leader);
});

test("when every lane is taken the label slides along the outer lane instead of sitting on another", () => {
  const stack = Array.from({ length: 4 }, (_, i) => ({ id: "l" + i, x: 400, w: 100, side: "above", prio: i }));
  const res = placeLabels([...stack, { id: "extra", x: 400, w: 100, side: "above", prio: 9 }], { width: 1000, lanes: 2 });
  const extra = res[4];
  for (const r of res.slice(0, 4)) assert.ok(!overlap(r, extra), "extra sits on " + r.id);
  assert.ok(extra.left >= 0 && extra.right <= 1000);
});

test("the peer strip: names too close to point at one by one are joined, and no pointer runs through a name", () => {
  const names = ["AVGO", "ADI", "RMBS", "TXN", "AMAT"].map((id, i) => ({ id, x: 500 + i * 9, w: 34 }));
  const res = placeStrip(names, { width: 1000, rows: 4 });
  assert.ok(res.length < names.length, "close names are joined");
  assert.deepEqual(res.flatMap((r) => r.ids).sort(), names.map((n) => n.id).sort(), "every name is still on the strip");
  for (const a of res) {
    assert.ok(a.ok);
    assert.ok(a.left < a.x && a.x < a.right, a.id + " sits over its own pointer");
    for (const b of res) if (b !== a && b.row < a.row) assert.ok(!(b.left - 3 < a.x && a.x < b.right + 3), `${a.id}'s pointer runs through ${b.id}`);
  }
  const far = placeStrip(["TSM", "TEL", "AVGO", "MRVL"].map((id, i) => ({ id, x: 20 + i * 300, w: 38 })), { width: 1000, rows: 4 });
  assert.equal(far.length, 4, "names with room keep their own labels");
});

/* the rules the reviewer found broken at 390: a pointer must never pass behind a label, and no label may cover the company's dashed line */
function assertRules(res, blocked, label) {
  for (const a of res) {
    assert.ok(a.ok, `${label}: ${a.id} could not honour every rule`);
    assert.ok(a.left <= a.x && a.x <= a.right, `${label}: ${a.id} is not over its own mark`);
    for (const b of blocked) if (b.side === a.side) assert.ok(!(a.left - 3 < b.x && b.x < a.right + 3), `${label}: ${a.id} covers the dashed line`);
    for (const b of res) {
      if (b === a || b.side !== a.side) continue;
      if (b.lane < a.lane) assert.ok(!(b.left - 3 < a.x && a.x < b.right + 3), `${label}: ${a.id}'s pointer passes behind ${b.id}`);
      if (b.lane === a.lane) assert.ok(a.right <= b.left || b.right <= a.left, `${label}: ${a.id} sits on ${b.id}`);
    }
  }
}

test("MU's own row at phone and desktop width: no label covers the dashed line, no pointer passes behind a label", () => {
  const eps = 44.18, me = 1071.29;
  const rows = { A: { min: 45.5, q1: 1144.9, median: 1984.6, q3: 2317.5, max: 3768.7 }, B: { min: 940.2, q1: 1821.1, median: 2051.8, q3: 2397.6, max: 3768.7 } };
  // label widths as measured in the headless browser (compact labels at 390, full labels at 1680)
  const widths = { 312: { me: 117, min: 94, q1: 75, median: 86, q3: 75, max: 86 }, 1506: { me: 218, min: 224, q1: 119, median: 156, q3: 119, max: 156 } };
  for (const [IW, w] of Object.entries(widths).map(([k, v]) => [+k, v])) for (const [name, r] of Object.entries(rows)) {
    const hi = 4000, px = (v) => (v / hi) * IW;
    const ww = name === "B" ? { ...w, min: IW === 312 ? 78 : 150 } : w;          // chart B's lowest peer (TEL) carries no data-fault line
    const marks = [{ id: "me", x: px(me), side: "above", prio: 0 }, { id: "median", x: px(r.median), side: "above", prio: 1 }, { id: "min", x: px(r.min), side: "above", prio: 2 },
      { id: "max", x: px(r.max), side: "above", prio: 2 }, { id: "q1", x: px(r.q1), side: "below", prio: 3 }, { id: "q3", x: px(r.q3), side: "below", prio: 3 }].map((m) => ({ ...m, w: ww[m.id] }));
    const blocked = [{ x: px(me), side: "below" }];
    const res = placeLabels(marks, { width: IW, lanes: 6, gap: 8, blocked });
    assertRules(res, blocked, `chart ${name} at ${IW}`);
    assert.equal(res[0].lane, 0, "MU's flag sits in the lane nearest the bar, so its dashed line hangs from it");
  }
  void eps;
});

test("a label pushed out a lane keeps a clear pointer, even when the lane nearest the bar is crowded", () => {
  const res = placeLabels([{ id: "wide", x: 200, w: 300, side: "above", prio: 0 }, { id: "a", x: 120, w: 80, side: "above", prio: 1 }, { id: "b", x: 330, w: 80, side: "above", prio: 1 }], { width: 600, lanes: 4 });
  assertRules(res, [], "crowded");
});

test("data sanity: TSM and SIMO fail, the clean peers pass (checks-2026-09-28.json)", () => {
  const C = JSON.parse(readFileSync(new URL("../deliverables/20260928/comps-labels/checks-2026-09-28.json", import.meta.url)));
  const got = Object.fromEntries(C.peers.map((p) => [p.ticker, sanity(p).faults.map((f) => f.check)]));
  assert.deepEqual(got.TSM, ["eps"]);
  assert.deepEqual(got.SIMO, ["eps", "mcap"]);
  for (const t of Object.keys(got)) if (!["TSM", "SIMO"].includes(t)) assert.deepEqual(got[t], [], t + " should hold together");
  const simo = sanity(C.peers.find((p) => p.ticker === "SIMO"));
  assert.ok(simo.pe_mcap > 30 && simo.pe_mcap < 34, "SIMO at today's market value over its net income is about 32x");
  assert.deepEqual(C.faulty, ["TSM", "SIMO"]);
});

test("every label says what the mark is, the multiple, whose it is, and the price", () => {
  const read = {
    ends: { min: { multiple: 1.03, who: ["TSM"], price: 45.5 }, q1: { multiple: 25.9, who: [], price: 1144.9 }, median: { multiple: 44.9, who: ["AVGO"], price: 1984.6 }, q3: { multiple: 52.5, who: [], price: 2317.5 }, max: { multiple: 85.3, who: ["MRVL"], price: 3768.7 } },
    own: { price: 1071.29, multiple: 24.2 }, upside: 85.3,
  };
  const L = rowLabels(read, { ticker: "MU", eps: "$44.18", fmtX: (v) => fmt("x", v), fmtPrice: (v) => fmt("price", v), fmtPct: (v) => fmt("pct", v) });
  const by = Object.fromEntries(L.map((l) => [l.id, l]));
  assert.equal(by.min.text, "TSM 1.0x → $45.50"); assert.equal(by.min.head, "LOWEST PEER");
  assert.equal(by.median.text, "AVGO 44.9x → $1,985"); assert.equal(by.q1.text, "25.9x → $1,145"); assert.equal(by.q3.head, "75TH PERCENTILE");
  assert.equal(by.max.text, "MRVL 85.3x → $3,769");
  assert.equal(by.me.head, "MU TODAY"); assert.equal(by.me.text, "$1,071 = 24.2x × EPS $44.18"); assert.equal(by.me.tail, "+85% to the peer median");
  assert.equal(by.me.prio, 0);
});

test("without one peer the ends move on the same arithmetic as the live row", () => {
  const peers = [["TSM", 1.03], ["SIMO", 7.9], ["TEL", 21.3], ["AVGO", 44.9], ["ADI", 46.4], ["MRVL", 85.3]].map(([ticker, multiple]) => ({ ticker, multiple }));
  const r = withoutPeers(peers, ["TSM"], 44.18, peerBand);
  assert.equal(r.n, 5); assert.equal(r.ends.min.who[0], "SIMO"); assert.equal(r.ends.max.who[0], "MRVL");
  assert.deepEqual(r.ends.median.who, ["AVGO"]);
  assert.ok(Math.abs(r.ends.median.price - 44.9 * 44.18) < 1e-9);
  const even = withoutPeers(peers, [], 44.18, peerBand);
  assert.deepEqual(even.ends.median.who, ["TEL", "AVGO"]);
});

test("phone labels: short heads, price on its own line, a data fault named on the end it sets", () => {
  const read = {
    ends: { min: { multiple: 1.03, who: ["TSM"], price: 45.5 }, q1: { multiple: 25.9, who: [], price: 1144.9 }, median: { multiple: 44.9, who: ["AVGO"], price: 1984.6 }, q3: { multiple: 52.5, who: [], price: 2317.5 }, max: { multiple: 85.3, who: ["MRVL"], price: 3768.7 } },
    own: { price: 1071.29, multiple: 24.2 }, upside: 85.3,
  };
  const L = rowLabels(read, { ticker: "MU", eps: "$44.18", fmtX: (v) => fmt("x", v), fmtPrice: (v) => fmt("price", v), fmtPct: (v) => fmt("pct", v), faulty: ["TSM", "SIMO"], compact: true });
  const by = Object.fromEntries(L.map((l) => [l.id, l]));
  assert.equal(by.min.head, "LOWEST"); assert.equal(by.min.text, "TSM 1.0x"); assert.equal(by.min.text2, "→ $45.50"); assert.equal(by.min.tail, "DATA FAULT *"); assert.equal(by.min.good, false);
  assert.equal(by.q1.head, "25TH PCTL"); assert.equal(by.me.text, "$1,071"); assert.equal(by.me.text2, "24.2x × $44.18"); assert.equal(by.me.tail, "+85% to median");
  assert.equal(by.max.tail, undefined);
  const wide = rowLabels(read, { ticker: "MU", eps: "$44.18", fmtX: (v) => fmt("x", v), fmtPrice: (v) => fmt("price", v), fmtPct: (v) => fmt("pct", v), faulty: ["TSM"] });
  assert.equal(wide.find((l) => l.id === "min").tail, "DATA FAULT (TSM): see the note");
});
