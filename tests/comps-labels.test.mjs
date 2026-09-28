/* The labelled comps row (deliverables/20260928/comps-labels): labels never sit on each other, never
   leave the chart, and the words on each label carry the mark, the multiple, whose it is and the price. */
import test from "node:test";
import assert from "node:assert/strict";
import { placeLabels, placeStrip, rowLabels, withoutPeers } from "../deliverables/20260928/comps-labels/labels.mjs";
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
  assert.equal(res[0].lane, 0); assert.equal(res[0].leader, false);
  assert.equal(res[1].lane, 1); assert.equal(res[1].leader, true);
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

test("the peer strip spreads close names into rows", () => {
  const names = ["AVGO", "ADI", "RMBS", "TXN", "AMAT"].map((id, i) => ({ id, x: 500 + i * 9, w: 34 }));
  const res = placeStrip(names, { width: 1000, rows: 4 });
  for (let i = 0; i < res.length; i++) for (let j = i + 1; j < res.length; j++) assert.ok(!(res[i].row === res[j].row && res[i].left < res[j].left + 34 && res[j].left < res[i].left + 34), `${res[i].id} sits on ${res[j].id}`);
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
