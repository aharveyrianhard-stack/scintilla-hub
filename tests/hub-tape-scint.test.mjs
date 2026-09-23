import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name);
  return page.slice(s, page.indexOf("\n}\n", s) + 3);
}
/* a tape item as the band actually builds it: TICKER <b>px</b> <span>pct</span> */
function item(t, px, pc) {
  const b = cell(fmtTapePx(px)), s = cell(fmtC(pc));
  const n = {
    attrs: { "data-t": t, "data-px": String(px), "data-pc": String(pc) },
    getAttribute: (k) => (k in n.attrs ? n.attrs[k] : null),
    setAttribute: (k, v) => { n.attrs[k] = String(v); },
    hasAttribute: (k) => k in n.attrs,
    querySelector: (q) => (q === "b" ? b : s),
    px: b, pc: s,
  };
  return n;
}
function cell(text) {
  const n = { textContent: text, anims: [], classes: new Set(), className: "",
    animate: (frames, opt) => { const a = { frames, opt, cancel() {} }; n.anims.push(a); return a; },
    classList: { add: (c) => n.classes.add(c), remove: () => {} }, get offsetWidth() { return 1; } };
  return n;
}
const fmtC = new Function("return " + page.match(/const fmtC {4}= ([^\n]*);\n/)[1])();
const fmtTapePx = new Function("return " + page.match(/const fmtTapePx = ([^\n]*);\n/)[1])();
function host(bands) {
  const tracks = bands.map((items) => ({
    items,
    querySelectorAll: () => items,
  }));
  return { querySelectorAll: () => tracks };
}
const scint = new Function("getComputedStyle", "document", "fmtC", "fmtTapePx",
  "const SCINT_MS = 520; let SCINT_OFF = false; let SCINT_C = null, SCINT_C_AT = 0;\n" +
  fn("scintColors") + "let SCINT_IO = null;\n" + fn("scScintVis") + fn("scScint") + fn("scScintSet") + fn("tapePatch") + "return tapePatch;")(
  () => ({ getPropertyValue: (k) => (k === "--bull" ? "#00ffa3" : "#ff2d55") }), { documentElement: {} }, fmtC, fmtTapePx);

test("a tick that changes only numbers patches the band where it stands", () => {
  const nodes = [item("AAPL", 100, 1.0), item("MSFT", 200, -2.0)];
  const ok = scint(host([nodes]), [[{ t: "AAPL", price: 101, pct: 1.5 }, { t: "MSFT", price: 200, pct: -2.0 }]]);
  assert.equal(ok, true, "same tickers in the same order → patch, never rebuild");
  assert.equal(nodes[0].px.textContent, "101", "the band's own formatter: no decimals at or above 10");
  assert.equal(nodes[0].px.anims.length, 1, "the price that moved glowed");
  assert.equal(nodes[0].pc.anims.length, 1, "so did its percentage");
  assert.equal(nodes[1].px.anims.length, 0, "the unchanged item stayed silent");
  assert.equal(nodes[1].pc.anims.length, 0);
  assert.equal(nodes[0].getAttribute("data-px"), "101", "the new baseline is stored for the next tick");
});

test("the direction is the move, not the sign of the number", () => {
  const nodes = [item("AAPL", 100, -3.0)];
  scint(host([nodes]), [[{ t: "AAPL", price: 99, pct: -1.0 }]]);
  assert.equal(nodes[0].px.anims[0].frames[0].color, "#ff2d55", "price fell → red");
  assert.equal(nodes[0].pc.anims[0].frames[0].color, "#00ffa3", "a percentage of -3.0 rising to -1.0 is an UP move");
  assert.equal(nodes[0].pc.className, "dn", "while the cell keeps its own negative colouring");
});

test("every copy of a repeated segment is patched, so the second half never scrolls in stale", () => {
  /* tapeSpeed duplicates the segment so the -50% loop is seamless; item n is data item n % len. */
  const nodes = [item("AAPL", 100, 1), item("MSFT", 200, 2), item("AAPL", 100, 1), item("MSFT", 200, 2)];
  const ok = scint(host([nodes]), [[{ t: "AAPL", price: 105, pct: 5 }, { t: "MSFT", price: 200, pct: 2 }]]);
  assert.equal(ok, true);
  assert.equal(nodes[2].px.textContent, "105", "the copy in the second half moved too");
  assert.equal(nodes[1].px.textContent, "200");
});

test("a change of membership or order rebuilds instead of patching the wrong nodes", () => {
  const nodes = [item("AAPL", 100, 1), item("MSFT", 200, 2)];
  assert.equal(scint(host([nodes]), [[{ t: "NVDA", price: 100, pct: 1 }, { t: "MSFT", price: 200, pct: 2 }]]), false, "different ticker");
  assert.equal(scint(host([nodes]), [[{ t: "MSFT", price: 200, pct: 2 }, { t: "AAPL", price: 100, pct: 1 }]]), false, "reordered");
  assert.equal(scint(host([nodes]), [[{ t: "AAPL", price: 100, pct: 1 }]]), false, "2 nodes are not a whole number of 1-item loops");
  assert.equal(nodes[0].px.textContent, "100", "nothing was written on the way to saying no");
});

test("the band is only rebuilt when the patch refuses, so the marquee keeps its place", () => {
  assert.match(page, /if \(!tapePatch\(px, \[macro, all\]\)\) \{\n    px\.innerHTML = tapeHTML\("MACRO", macro\) \+ tapeHTML\("ALL", all\);/);
  assert.match(page, /'<span class="sc-tape__item" data-t="' \+ esc\(it\.t\) \+ '" data-px="' \+ esc\(it\.price\) \+ '" data-pc="' \+ esc\(it\.pct\) \+ '">'/);
});
