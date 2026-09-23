import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name);
  return page.slice(s, page.indexOf("\n}\n", s) + 3);
}
const consts = page.match(/^const SCINT_MS = [^\n]*\n/m)[0] + "let SCINT_OFF = REDUCED;\n" +
  "let SCINT_C = null, SCINT_C_AT = 0;\n";

/* the smallest node this surface actually uses: text, attributes, one child query, animate(). */
function node(text = "", attrs = {}) {
  const n = {
    textContent: text, attrs: { ...attrs }, anims: [], classes: new Set(), _w: 0,
    getAttribute: (k) => (k in n.attrs ? String(n.attrs[k]) : null),
    setAttribute: (k, v) => { n.attrs[k] = String(v); },
    hasAttribute: (k) => k in n.attrs,
    animate: (frames, opt) => { const a = { frames, opt, cancelled: false, cancel() { this.cancelled = true; } }; n.anims.push(a); return a; },
    classList: { add: (c) => n.classes.add(c), remove: (...c) => c.forEach((x) => n.classes.delete(x)) },
    get offsetWidth() { n._w++; return 1; },
  };
  return n;
}
function api(reduced = false) {
  const src = "const REDUCED = " + reduced + ";\n" + consts + fn("scintColors") + "let SCINT_IO = null;\n" + fn("scScintVis") + fn("scScint") + fn("scScintSet") +
    "return { scScint, scScintSet, off: () => SCINT_OFF };";
  return new Function("getComputedStyle", "document", src)(
    () => ({ getPropertyValue: (k) => (k === "--bull" ? "#00ffa3" : "#ff2d55") }), { documentElement: {} });
}

test("a number that did not change on screen never glows — and is not rewritten", () => {
  const { scScintSet } = api();
  const n = node("100.00");
  assert.equal(scScintSet(n, "100.00", true), false, "identical rendered text is a no-op");
  assert.equal(n.anims.length, 0);
  /* the real case this protects: a price moving inside the printed precision. */
  assert.equal(scScintSet(n, (100.004).toFixed(2), true), false, "100.001 -> 100.004 both print 100.00");
  assert.equal(scScintSet(n, "100.01", true), true);
  assert.equal(n.textContent, "100.01");
  assert.equal(n.anims.length, 1);
});

test("the glow carries the direction of the move, and only colour and shadow", () => {
  const { scScintSet } = api();
  const up = node("1.00"), dn = node("1.00");
  scScintSet(up, "1.01", true); scScintSet(dn, "0.99", false);
  assert.deepEqual(Object.keys(up.anims[0].frames[0]).sort(), ["color", "textShadow"],
    "no width, padding, weight or background — a glow must never move the row");
  assert.equal(up.anims[0].frames[0].color, "#00ffa3");
  assert.equal(dn.anims[0].frames[0].color, "#ff2d55");
  assert.equal(up.anims[0].frames.length, 1, "implicit end frame: it returns to the cell's own style");
  assert.ok(up.anims[0].opt.duration >= 400 && up.anims[0].opt.duration <= 700, "inside the 400-700 ms Alan asked for");
});

test("an unknown direction writes the value and stays silent", () => {
  const { scScintSet } = api();
  const n = node("—");
  assert.equal(scScintSet(n, "+1.20%", null), true);
  assert.equal(n.textContent, "+1.20%");
  assert.equal(n.anims.length, 0, "a first paint has no baseline to have moved from");
});

test("prefers-reduced-motion: the number still updates, nothing animates", () => {
  const { scScintSet, off } = api(true);
  assert.equal(off(), true);
  const n = node("1.00");
  assert.equal(scScintSet(n, "1.01", true), true);
  assert.equal(n.textContent, "1.01");
  assert.equal(n.anims.length, 0);
  assert.equal(n.classes.size, 0);
  assert.match(page, /@media \(prefers-reduced-motion:reduce\)\{\n  \.sc-scint-up, \.sc-scint-dn, \.sc-last\.fl-up, \.sc-last\.fl-dn\{ animation:none; \}/,
    "and the CSS fallback path is switched off too");
});

test("restarting a glow does not read layout — the 364-row tick pays no forced reflow", () => {
  const { scScintSet } = api();
  const n = node("1.00");
  scScintSet(n, "1.01", true);
  scScintSet(n, "1.02", true);
  assert.equal(n._w, 0, "Element.animate path never touches offsetWidth");
  assert.equal(n.anims[0].cancelled, true, "the first animation is cancelled, not left running");
  assert.equal(n.anims.length, 2);
  /* the shipped flash restarted a CSS animation, which cost one synchronous layout per row. */
  assert.doesNotMatch(page, /lp\.classList\.remove\("fl-up", "fl-dn"\); void lp\.offsetWidth/,
    "the per-row forced reflow on the board price is gone");
});

test("the board scintillates the percentage as well as the price, against its own baseline", () => {
  assert.match(page, /const prevC = r \? num\(r\.c\) : null;/, "the percentage's baseline is read before the row is overwritten");
  assert.match(page, /scScintSet\(lp, price\.toFixed\(2\), prev != null && \+prev !== price \? price > \+prev : null\)/);
  assert.match(page, /scScintSet\(lc, cc != null \? fmtC\(cc\) : "—", \(prevC != null && cc != null && cc !== prevC\) \? cc > prevC : null\)/);
  assert.match(page, /if \(htTxt && hc != null\) scScintSet\(htTxt, fmtC\(hc\)/, "the cohort heat tile too");
  assert.match(page, /scScintSet\(px, fmtPxIdent\(price\)/, "and the company ident");
});

test("a cell the reader cannot see is not animated at all", () => {
  const seen = [];
  const src = "const REDUCED = false;\n" + consts + "let SCINT_IO = null;\n" +
    fn("scintColors") + fn("scScintVis") + fn("scScint") + fn("scScintSet") + "return { scScintSet, io: () => SCINT_IO };";
  const IO = function (cb, opt) { seen.push(opt); this.observe = (n) => seen.push(n); this.cb = cb; };
  const { scScintSet, io } = new Function("getComputedStyle", "document", "IntersectionObserver", src)(
    () => ({ getPropertyValue: () => "#00ffa3" }), { documentElement: {} }, IO);
  const n = node("1.00");
  scScintSet(n, "1.01", true);
  assert.equal(n.anims.length, 1, "a cell registers as visible and glows on its first change");
  assert.ok(seen.includes(n), "and registers itself with the one observer — no call site had to");
  assert.equal(seen[0].rootMargin, "80px", "a row just off the edge still counts as on screen");
  n.__scVis = false;                                   // the observer reports it scrolled away
  assert.equal(scScintSet(n, "1.02", true), true, "the value still updates…");
  assert.equal(n.textContent, "1.02");
  assert.equal(n.anims.length, 1, "…but nothing animates off screen");
  n.__scVis = true;
  scScintSet(n, "1.03", true);
  assert.equal(n.anims.length, 2, "and it glows again when it scrolls back");
});

test("no IntersectionObserver means everything glows, rather than nothing", () => {
  const src = "const REDUCED = false;\n" + consts + "let SCINT_IO = null;\n" +
    fn("scintColors") + fn("scScintVis") + fn("scScint") + fn("scScintSet") + "return scScintSet;";
  const scScintSet = new Function("getComputedStyle", "document", src)(
    () => ({ getPropertyValue: () => "#00ffa3" }), { documentElement: {} });
  const n = node("1.00");
  scScintSet(n, "1.01", true);
  assert.equal(n.anims.length, 1);
});
