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
  "let SCINT_C = null, SCINT_C_AT = 0;\n" +
  /* M72 — the overlay helpers live beside scScint and are pulled in with it. */
  page.match(/^let SC_GLOW_Q = [^\n]*\n/m)[0] + page.match(/^const SC_WARM_SEL = [^\n]*\n/m)[0];

/* M72 — scScint now leans on small helpers beside it; every sandbox below gets them too. Without a
   KeyframeEffect that knows pseudo-elements they report "no overlay here" and the classic glow runs,
   which is exactly what an old browser does. */
const GLOW = () => fn("scGlowCapable") + fn("scGlowOK") + fn("scGlowWrite") + fn("scGlowPlay") +
  fn("scGlowQueue") + fn("scGlowFlush") + fn("scGlowWarm");

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
function api(reduced = false, world = {}) {
  const src = "const REDUCED = " + reduced + ";\n" + consts + fn("scintColors") + "let SCINT_IO = null;\n" +
    fn("scScintVis") + GLOW() + fn("scScint") + fn("scScintSet") + fn("scSetText") +
    "return { scScint, scScintSet, scSetText, scGlowFlush, scGlowWarm, off: () => SCINT_OFF };";
  return new Function("getComputedStyle", "document", "KeyframeEffect", "requestAnimationFrame", src)(
    world.getComputedStyle || (() => ({ getPropertyValue: (k) => (k === "--bull" ? "#00ffa3" : "#ff2d55"),
      position: "static" })),
    world.document || { documentElement: {} },
    world.KeyframeEffect, world.requestAnimationFrame);
}
/* A browser that CAN put the glow on the graphics chip: it knows pseudo-element animations, and it
   runs animation-frame callbacks when the test says so. */
function gpuWorld() {
  const frames = [];
  const w = {
    KeyframeEffect: function () {}, frames,
    requestAnimationFrame: (f) => { frames.push(f); return frames.length; },
    tick: () => { const q = frames.splice(0, frames.length); q.forEach((f) => f()); },
    getComputedStyle: () => ({ getPropertyValue: (k) => (k === "--bull" ? "#00ffa3" : "#ff2d55"), position: "static" }),
    document: { documentElement: {}, querySelectorAll: () => w.warmable || [] },
  };
  w.KeyframeEffect.prototype = { pseudoElement: null };
  return w;
}
/* the cell as the overlay path sees it: attributes, inline custom properties, and animate() with a
   pseudoElement option that returns a replayable animation. */
function gpuNode(text = "", opts = {}) {
  const n = node(text);
  n.firstElementChild = opts.child || null;
  n.namespaceURI = opts.ns || "http://www.w3.org/1999/xhtml";
  n.props = {}; n.plays = 0; n.seeks = [];
  n.style = { setProperty: (k, v) => { n.props[k] = v; n.propWrites = (n.propWrites || 0) + 1; } };
  n.animate = (framesArg, opt) => {
    const a = { frames: framesArg, opt, cancelled: false, currentTime: 0, pseudo: opt && opt.pseudoElement,
      cancel() { this.cancelled = true; }, play() { n.plays++; this.cancelled = false; } };
    Object.defineProperty(a, "currentTime", { get: () => a._t || 0, set: (v) => { a._t = v; n.seeks.push(v); } });
    n.anims.push(a); return a;
  };
  const setAttr = n.setAttribute;
  n.attrWrites = 0;
  n.setAttribute = (k, v) => { n.attrWrites++; setAttr(k, v); };
  return n;
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
  assert.deepEqual(Object.keys(up.anims[0].frames[0]).filter((k) => k !== "offset").sort(), ["color", "textShadow"],
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
    fn("scintColors") + fn("scScintVis") + GLOW() + fn("scScint") + fn("scScintSet") + "return { scScintSet, io: () => SCINT_IO };";
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
    fn("scintColors") + fn("scScintVis") + GLOW() + fn("scScint") + fn("scScintSet") + "return scScintSet;";
  const scScintSet = new Function("getComputedStyle", "document", src)(
    () => ({ getPropertyValue: () => "#00ffa3" }), { documentElement: {} });
  const n = node("1.00");
  scScintSet(n, "1.01", true);
  assert.equal(n.anims.length, 1);
});

test("the glow starts bright and fades: its one keyframe sits at offset 0", () => {
  /* 24 Sep: without an offset, Web Animations puts a lone keyframe at the END, so the live board
     glowed backwards - base colour at t=0, full green at t=519 ms, then a snap back to white. */
  const { scScintSet } = api();
  const n = node("1.00");
  scScintSet(n, "1.01", true);
  assert.equal(n.anims.length, 1);
  assert.equal(n.anims[0].frames.length, 1);
  assert.equal(n.anims[0].frames[0].offset, 0, "the glow is the FIRST frame; the cell's own style is the implicit end");
});

/* ── M72 · the same glow for less work (and the defect that cost the board its flash) ─────────── */

test("M72 — the overlay hangs off the printed attribute, never off a class a repaint can wipe", () => {
  /* The board rewrites a change cell's className on every direction change (index.html:20797,
     23128, 23151). When the overlay was keyed to a `sc-glow` class, that assignment removed the
     overlay while the cell still believed it had one, and the cell stopped flashing for good. */
  assert.match(page, /\[data-scv\]::after\{ content:attr\(data-scv\)/, "the overlay is keyed to the attribute");
  assert.ok(!/classList\.add\("sc-glow"\)/.test(page), "nothing re-creates the class dependency");
  assert.ok(!/\.sc-glow::after/.test(page), "the class-keyed rule is gone");
  const wipes = page.match(/^\s*lc\.className\s*=/gm) || [];
  assert.ok(wipes.length >= 2, "the className rewrites this protects against are still in the page");
});

test("M72 — one animation per cell, replayed; a glow is not rebuilt 45 times a second", () => {
  const w = gpuWorld(), { scScint } = api(false, w);
  const n = gpuNode("1.00");
  scScint(n, true);                       // first glow: the overlay is born, classic path runs
  assert.equal(n.anims.length, 1);
  scScint(n, true); w.tick();             // second glow: queued, flushed, played on the overlay
  assert.equal(n.anims.length, 2, "one overlay animation is built");
  assert.equal(n.anims[1].pseudo, "::after");
  scScint(n, true); w.tick();
  scScint(n, true); w.tick();
  assert.equal(n.anims.length, 2, "later glows replay the same animation, they do not build new ones");
  assert.deepEqual(n.seeks, [0, 0], "each replay restarts it at the beginning");
  assert.equal(n.plays, 2);
});

test("M72 — the overlay's text and tone are written only when they actually change", () => {
  const w = gpuWorld(), { scScint } = api(false, w);
  const n = gpuNode("1.00");
  scScint(n, true); w.tick();
  const attrs = n.attrWrites, props = n.propWrites;
  scScint(n, true); w.tick();             // same text, same direction
  assert.equal(n.attrWrites, attrs, "the same text is not written to the overlay again");
  assert.equal(n.propWrites, props, "the same tone is not written again");
  n.textContent = "1.01";
  scScint(n, true); w.tick();
  assert.equal(n.attrWrites, attrs + 1, "new text is written once");
  scScint(n, false); w.tick();
  assert.ok(n.propWrites > props, "the other direction writes the new tone");
  assert.equal(n.props["--sc-glow-c"], "#ff2d55");
});

test("M72 — every cell that glows in one frame is written in one pass, then played", () => {
  const w = gpuWorld(), { scScint } = api(false, w);
  const cells = [gpuNode("1"), gpuNode("2"), gpuNode("3")];
  cells.forEach((c) => { scScint(c, true); w.tick(); });      // give each one its overlay
  const order = [];
  cells.forEach((c) => {
    c.setAttribute = (k, v) => { order.push("write"); c.attrs[k] = String(v); };
    c.animate = ((orig) => (f, o) => { order.push("play"); return orig(f, o); })(c.animate);
    c.textContent += "x";
  });
  cells.forEach((c) => scScint(c, true));
  assert.equal(w.frames.length, 1, "three glows in one frame ask for ONE animation frame");
  w.tick();
  assert.deepEqual(order.slice(0, 3), ["write", "write", "write"], "all the writes happen before any glow starts");
});

test("M72 — a cell with children inside it, or an SVG cell, keeps the classic glow", () => {
  const w = gpuWorld(), { scScint } = api(false, w);
  const row = gpuNode("AAPL +2.1%", { child: {} });          // a row: the overlay would double its text
  scScint(row, true); w.tick(); scScint(row, true); w.tick();
  assert.ok(row.anims.every((a) => !a.pseudo), "no overlay on a cell with element children");
  assert.deepEqual(Object.keys(row.anims[0].frames[0]).filter((k) => k !== "offset").sort(), ["color", "textShadow"]);
  assert.equal(row.attrs["data-scv"], undefined, "and no overlay text is printed for it");
  const svg = gpuNode("+2.1", { ns: "http://www.w3.org/2000/svg" });
  scScint(svg, true); w.tick(); scScint(svg, true); w.tick();
  assert.ok(svg.anims.every((a) => !a.pseudo), "a pseudo-element never renders on SVG, so it keeps the classic glow");
});

test("M72 — warming creates overlays while the browser is idle, and nothing glows from it", () => {
  const w = gpuWorld(), api2 = api(false, w);
  const cells = [gpuNode("1.00"), gpuNode("2.00")];
  w.warmable = cells;
  assert.equal(api2.scGlowWarm(80), 2, "both cells get their overlay");
  cells.forEach((c) => {
    assert.equal(c.attrs["data-scv"], c.textContent, "the overlay carries the cell's own text");
    assert.equal(c.anims.length, 0, "warming animates nothing");
  });
  assert.equal(api2.scGlowWarm(80), 0, "a warmed cell is not warmed twice");
  api2.scScint(cells[0], true); w.tick();
  assert.equal(cells[0].anims.length, 1, "the very first tick after warming already fades the overlay");
  assert.equal(cells[0].anims[0].pseudo, "::after", "no cell pays the first-glow fallback");
});

test("M72 — a value written without a glow cancels the fade, so no overlay shows a stale number", () => {
  const w = gpuWorld(), { scScint, scSetText, scScintSet } = api(false, w);
  const n = gpuNode("1.00");
  scScint(n, true); w.tick(); n.textContent = "1.01"; scScint(n, true); w.tick();
  const a = n.anims[n.anims.length - 1];
  scSetText(n, "9.99");
  assert.equal(a.cancelled, true, "the overlay still printed 1.01, so its fade is stopped");
  scScint(n, true); w.tick();
  assert.equal(n.attrs["data-scv"], "9.99", "the next glow prints what the cell now says");
  const m = gpuNode("5.00");
  scScint(m, true); w.tick(); scScint(m, true); w.tick();
  const b = m.anims[m.anims.length - 1];
  scScintSet(m, "5.01", null);            // a value with no direction: write, do not glow
  assert.equal(b.cancelled, true);
});
