// GL1 (7 Oct 2026) — trend and momentum shown apart on the board and the compare cards, and which reading it is.
// Alan: "I would like to see [trend and momentum] separately." Nothing here may change the board until he has seen the
// pictures, so the first thing proved is that it is OFF unless switched on.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
// a named function's own source, cut out by matching its braces
function fnSrc(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " is in the page");
  let i = html.indexOf("{", start), depth = 0;
  for (; i < html.length; i++) { if (html[i] === "{") depth++; else if (html[i] === "}") { depth--; if (depth === 0) break; } }
  return html.slice(start, i + 1);
}
const NAMES = ["scGl1On", "scGl1Form", "scGl1Fmt", "scGl1Tone", "scGl1Row", "scGl1AgeText", "scGl1ThinHTML", "geigerMiniHTML", "geigerTMHTML", "scGl1BoardTagHTML", "vminiHTML", "vminiTMHTML"];
function world({ href = "https://scintillahub.ai/", stored = null, flag = undefined, map = null, now = Date.parse("2026-10-07T18:08:00Z") } = {}) {
  const ctx = { window: { SC_GL1_TM: flag }, location: { href }, localStorage: { getItem: (k) => (k === "sc_gl1_tm" ? stored : null) },
    SC_CG: { map }, esc: (x) => String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"),
    Date: class extends Date { static now() { return now; } }, isFinite, Math, String, Number, RegExp };
  vm.createContext(ctx);
  vm.runInContext(NAMES.map(fnSrc).join("\n") + "\nthis.api = { " + NAMES.join(", ") + " };", ctx);
  return ctx.api;
}
const MU = { composite: 0.57, trend: 0.63, momentum: 0.51, reading: "live", price_utc: "2026-10-07T18:07:00.000Z", settled: { composite: 0.39, trend: 0.48, momentum: 0.3 } };

test("OFF unless switched on: no address flag, no stored flag, no global — nothing is drawn differently", () => {
  assert.equal(world().scGl1On(), false);
  assert.equal(world({ href: "https://scintillahub.ai/?gl1=1" }).scGl1On(), true);
  assert.equal(world({ href: "https://scintillahub.ai/?gl1=2" }).scGl1On(), true);
  assert.equal(world({ href: "https://scintillahub.ai/?gl1=10" }).scGl1On(), false, "only 1 and 2 are switches");
  assert.equal(world({ stored: "1" }).scGl1On(), true);
  assert.equal(world({ stored: "yes" }).scGl1On(), false);
  assert.equal(world({ flag: true }).scGl1On(), true);
  assert.equal(world({ href: "https://scintillahub.ai/?gl1=2" }).scGl1Form(), 2);
  assert.equal(world({ href: "https://scintillahub.ai/?gl1=1" }).scGl1Form(), 1);
});

test("every place that draws it asks the switch first, and survives the switch not existing at all", () => {
  const guard = '(typeof scGl1On === "function" && scGl1On())';
  assert.equal(html.split(guard).length - 1, 6, "the board cell (2), the cohort line (2), the compare column and its page specs");
  const bare = html.replace(/typeof scGl1On === "function" && scGl1On\(\)/g, "").replace("function scGl1On() {", "").match(/[^.\w]scGl1On\(\)/g) || [];
  assert.equal(bare.length, 0, "no call site reads the switch without the guard (a function cut out of the page on its own must not throw)");
  // the board cell's own tag is byte for byte what it was; the switch rides on a separate attribute
  assert.match(html, /'<span class="sc-gcell" role="button" tabindex="0" data-act="gpop" data-t="' \+ esc\(d\.t\) \+ '" aria-haspopup="dialog" aria-expanded="false"' \+\s*\n\s*\(\(typeof scGl1On === "function" && scGl1On\(\)\) \? ' data-gl1="' \+ scGl1Form\(\) \+ '"' : ""\)/);
});

test("one board cell: the Geiger's bar, TREND and MOMENTUM as two thin bars, the three numbers, and the reading in the hover", () => {
  const w = world({ map: { MU, CAT: { composite: -0.15, trend: 0.2, momentum: -0.51, reading: "live", price_utc: "2026-10-07T18:07:00.000Z" }, OLD: { composite: 0.4, trend: 0.5, momentum: 0.3 } } });
  const cell = w.geigerTMHTML("MU", 0.57);
  assert.equal((cell.match(/class="sc-gtm__bar"/g) || []).length, 2, "two thin bars");
  assert.match(cell, /class="sc-gmini sc-clip"/, "the Geiger keeps its own bar");
  assert.match(cell, /title="Geiger \+0\.57 · trend \+0\.63 · momentum \+0\.51 · LIVE, newest price 1m ago · finished bars only: \+0\.39"/);
  assert.match(cell, /<span class="sc-gtm__num is-l"><b style="color:var\(--bull\)">\+0\.57<\/b>/, "a rising Geiger's number sits in the empty left half");
  assert.match(cell, /<em>T<\/em><span style="color:var\(--bull\)">\+0\.63<\/span><em>M<\/em><span style="color:var\(--bull\)">\+0\.51<\/span>/);
  // trend up, momentum down: each thin bar goes its own way from the centre, each in its own colour
  const cat = w.geigerTMHTML("CAT", -0.15);
  assert.match(cat, /sc-gtm__num is-r/, "a falling Geiger's number sits in the empty right half");
  assert.match(cat, /<span class="sc-gtm__bar"><i style="left:50%;width:10%;background:var\(--bull\)"><\/i><\/span><span class="sc-gtm__bar"><i style="right:50%;width:25\.5%;background:var\(--bear\)">/);
  // a name the back end sent without a reading (carried, or before GL1): the numbers, and no claim about live or settled
  assert.doesNotMatch(w.geigerTMHTML("OLD", 0.4), /LIVE|SETTLED/);
  // no number at all: the same honest dash as before
  assert.equal(w.geigerTMHTML("XYZ", null), w.geigerMiniHTML(null, 1, true));
});

test("the board's own line: LIVE with the age of its oldest price, SETTLED, or how many of each", () => {
  const live = (age) => ({ composite: 0.1, reading: "live", price_utc: new Date(Date.parse("2026-10-07T18:08:00Z") - age * 1000).toISOString() });
  const w = world({ map: { A: live(60), B: live(240), C: { composite: 0.2, reading: "settled", price_utc: "2026-10-07T16:00:00.000Z" }, D: { composite: 0.3 } } });
  assert.match(w.scGl1BoardTagHTML([{ t: "A" }, { t: "B" }]), /<b>LIVE<\/b> · 4m/, "the OLDEST live price, so the tag never flatters the board");
  assert.match(w.scGl1BoardTagHTML([{ t: "C" }]), /<b>SETTLED<\/b>/);
  assert.match(w.scGl1BoardTagHTML([{ t: "A" }, { t: "C" }]), /<b>1 LIVE<\/b> · 1 SETTLED/);
  assert.equal(w.scGl1BoardTagHTML([{ t: "D" }, { t: "ZZ" }]), "", "no reading known, nothing claimed");
  assert.equal(w.scGl1AgeText(Date.parse("2026-10-07T18:07:30Z")), "1m");
  assert.equal(w.scGl1AgeText(Date.parse("2026-10-07T16:08:00Z")), "2h");
  assert.equal(w.scGl1AgeText(NaN), null);
});

test("a compare column: TREND left and MOMENTUM right of the column's own bar, on the card's scale; nothing where there is no pair", () => {
  const w = world();
  const col = w.vminiTMHTML(0.76, 1.0, 0.4, 0.76);
  assert.match(col, /^<span class="sc-vtm"><span class="sc-vtm__bar"><i style="bottom:50%;height:50%;background:var\(--bull\)"><\/i><\/span><span class="sc-vmini sc-clip">/, "a trend beyond the card's scale stops at the end of its track");
  assert.match(col, /<span class="sc-vtm__bar"><i style="bottom:50%;height:26\.3\d*%;background:var\(--bull\)"><\/i><\/span><\/span>$/);
  assert.equal(w.vminiTMHTML(0.3, null, null, 0.76), w.vminiHTML(0.3, 0.76), "no trend and no momentum: the bar exactly as it was");
  // a BREADTH pair's bar is a gap between two funds, a blended bar an average of five readings: neither has a pair of its own
  assert.match(html, /\(typeof scGl1On === "function" && scGl1On\(\)\) && !r\.pair && !r\.blend \? vminiTMHTML\(r\.mean, g\.tr, g\.mo, span\) : vminiHTML\(r\.mean, span\)/);
});

test("no row grows and nothing is explained inside a panel", () => {
  assert.match(html, /\.sc-gcell\[data-gl1\] > \.sc-gtm\{[^}]*margin:-3px 0;/, "the three bars borrow the row's own padding");
  assert.match(html, /\.ch > \.sc-gcell\[data-gl1\]\{ overflow:visible; \}/);
  assert.match(html, /@container \(max-width:119px\)\{ \.sc-gtm__num\{ display:none; \} \}/, "a phone's 33 px cell shows the three bars alone");
  assert.match(html, /const CMPX_SPECS_GL1 = "<p><b>TREND and MOMENTUM<\/b>: the thin bar to the left of a bar/, "the compare cards' explanation lives in PAGE SPECS");
  assert.match(html, /\(typeof scGl1On === "function" && scGl1On\(\)\) \? CMPX_SPECS\.replace\("<\/div><\/details>", CMPX_SPECS_GL1 \+ "<\/div><\/details>"\) : CMPX_SPECS/);
});
