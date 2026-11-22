/* 22 Nov 2026 — Alan (relayed by the markets session): "We definitely need more things on charts, on rotation." ROTATION keeps
   the RRG and gains BONDS (TLT ÷ SHY over its history) and VALUATION (the index funds' own P/E over 20+ years, trailing and forward,
   the published reference); the board's GROWTH strip gets its one-line legend; the corrected study is on REPORTS. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const HUB = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const PE = JSON.parse(fs.readFileSync(new URL("../deliverables/20261122/valuation/own-pe.json", import.meta.url), "utf8"));
function cut(from, to) {
  const a = HUB.indexOf(from), b = HUB.indexOf(to, a);
  assert.ok(a > 0 && b > a, "the page must still carry " + from);
  return HUB.slice(a, b);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

test("ROTATION offers RRG, RATIOS and VALUATION on its own control row; the RRG path is untouched", () => {
  assert.match(HUB, /const L0_ROT_VIEWS = \[\["RRG", "RRG"\], \["RATIOS", "RATIOS"\], \["VALUE", "VALUATION"\]\];/);
  assert.match(HUB, /h \+= '<span class="sc-l0rng__sep"><\/span>' \+ l0RotViewChips\(\);/);
  assert.match(HUB, /if \(LAYER0_TAB === "ROTATION" && typeof L0_ROT_VIEW !== "undefined" && L0_ROT_VIEW !== "RRG"\) return l0RotAltHTML\(head\);/);
  assert.match(HUB, /case "l0rview": \{/); assert.match(HUB, /case "l0rrng": \{/);
  assert.match(HUB, /requestAnimationFrame\(l0AltFill\);/, "the SVG views are drawn at their box's real size");
  assert.match(HUB, /const W = Math\.floor\(n\.clientWidth\), H = Math\.floor\(n\.clientHeight\)/, "layout size, never the zoomed rect");
  assert.match(HUB, /\? renderL0RRG\(\)/, "the RRG still draws on its canvas");
});

test("the series are drawn step by step, green up and red down (SVG y grows downward)", () => {
  const steps = new Function(cut("function l0SvgSteps(", "const L0_RAT_DAYS") + "\nreturn l0SvgSteps;")();
  const g = steps([0, 10, 20], [50, 40, 45], 1.5, "");
  assert.equal((g.match(/<line /g) || []).length, 2);
  assert.match(g.split("<line ")[1], /var\(--bull\)/, "40 is above 50 on screen: up, green");
  assert.match(g.split("<line ")[2], /var\(--bear\)/, "45 is below 40 on screen: down, red");
});

test("the VALUATION data: four funds, trailing month by month since 2003, forward today, the published reference, his channels", () => {
  for (const k of ["SPY", "QQQ", "DIA", "SMH"]) {
    const f = PE.funds[k];
    assert.ok(f.trailing.length > 240, k + ": twenty years of months");
    assert.ok(f.forward_now > 0 && f.trailing_now > 0, k + ": both multiples today");
    assert.ok(f.pct_full >= 0 && f.pct_full <= 1);
    assert.ok(PE.channels[k] && PE.channels[k].upper > PE.channels[k].mid && PE.channels[k].mid > PE.channels[k].lower, k + ": his three lines");
  }
  assert.equal(PE.reference[0].source.indexOf("FactSet") === 0, true);
  const src = cut("const VALUE_CAP = {", "/* fill every SVG box");
  const draw = new Function("l0SvgSteps", "esc", src + "\nreturn valueChartSVG;")(() => "", esc);
  const svg = draw(PE.funds.SMH, 400, 150, "SMH");
  assert.match(svg, /^<svg class="l0svg" width="400" height="150"/);
  assert.doesNotMatch(svg, /1649/, "a near-zero-earnings month (1649×) is off the capped axis, not drawn");
});

test("the GROWTH strip has its one-line legend on the board, and the corrected study is on REPORTS", () => {
  assert.match(HUB, /GROWTH: revenue, last 4 quarters, oldest left · number = % vs year-ago quarter · own scale per row · EPS on hover/);
  assert.match(HUB, /\(typeof growNoteHTML === "function" \? growNoteHTML\(\) : ""\)/);
  assert.match(HUB, /\{ id: "index-sizing", title: "Index sizing \+ valuation",/);
  assert.ok(fs.existsSync(new URL("../reports/INDEX-SIZING-20261122.html", import.meta.url)), "the report page ships with the Hub");
  const chainAt = HUB.indexOf('{ id: "chain"'), sizingAt = HUB.indexOf('{ id: "index-sizing"');
  assert.ok(chainAt > 0 && sizingAt > chainAt, "the AI Chain stays the default report");
});
