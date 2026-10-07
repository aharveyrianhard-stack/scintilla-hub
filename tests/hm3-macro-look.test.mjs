// HM3 (7 Oct 2026) — THE MACRO CARDS IN THE SLIDER'S LOOK. Alan, ~16:10 ET, on HM2's pictures: "these visuals of the macro
// stuff … look a little bit antiquated and analog in a lot of ways. Boxy … the economic one [the slider] looks way better
// than the other ones. This treasury curve one seems a little analog and weird … I can't really see much of the
// information on there … macro prints — what would be the idea, expand upon click?" and "Event card with the official
// link — just keep it simple. It's just about having access to the information. Don't go nuts."
// The layer redraws four of HM2's cards; every read and every rule stays HM2's (tests/hm2-macro.test.mjs holds those).
// These run the page's own helpers, the HM3 layer and the HM2 block in a VM; nothing reaches the network. The last
// tests hold the report to what was read off the page in a headless browser (deliverables/20261007/hm3-macro-look/data).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel) => fs.readFileSync(P(rel), "utf8");
const page = read("../index.html");
const hm2 = read("../deliverables/20261007/hm2-macro/tools/hm2-block.js");
const hm3 = read("../deliverables/20261007/hm3-macro-look/tools/hm3-block.js");
const css = read("../deliverables/20261007/hm3-macro-look/tools/hm3-style.css");
const shoot = (tag) => JSON.parse(read("../deliverables/20261007/hm3-macro-look/data/shoot-" + tag + ".json"));

const grab = (re, what) => { const m = page.match(re); assert.ok(m, what + " must exist on the page"); return m[0]; };
const helpers = [
  grab(/const num = \(x\) => [^\n]*\n/, "num"), grab(/const esc = \(s\) => [\s\S]*?;\n/, "esc"),
  grab(/const ecDateKey\s+= [^\n]*\n/, "ecDateKey"), grab(/const ecTimeET\s+= [^;]*;\n/, "ecTimeET"), grab(/const ecToday\s+= [^\n]*\n/, "ecToday"),
  grab(/const ecAnchor\s+= [^\n]*\n/, "ecAnchor"), grab(/const ecShift\s+= [^\n]*\n/, "ecShift"),
  grab(/const EC_G7\s+= [^\n]*\n/, "EC_G7"), grab(/const EC_G20 = [^\n]*\n/, "EC_G20"), grab(/const EC_EM\s+= \[[\s\S]*?\];\n/, "EC_EM"),
  grab(/function ecInRegion\(country, region\) \{[\s\S]*?\n\}\n/, "ecInRegion"), grab(/const ecPassImp = [^\n]*\n/, "ecPassImp"),
  grab(/const EC_CATS = \[[\s\S]*?\n\];\n/, "EC_CATS"), grab(/const EC_INVERT = [^\n]*\n/, "EC_INVERT"),
  grab(/const EC_MONTH_TAG = [^\n]*\n/, "EC_MONTH_TAG"), grab(/const ecBase\s+= [^\n]*\n/, "ecBase"),
  grab(/const ecPeriod = [^\n]*\n/, "ecPeriod"), grab(/const ecCat = [^\n]*\n/, "ecCat"),
].join("");
const EXPORTS = "HM3_ON, HM3, HM3_THEN, HM3_SPECS_P, hm3BarsHTML, hm3CurveHTML, hm3AuctionsHTML, hm3PrintsHTML, hm3PrintsPaint, hm3EventHTML, hm3RailCardsHTML, " +
  "hm2RailCardsHTML, hm2StripRows, hm2AuctionsHTML, hm2AuctionsPaint, hm2CurveHTML, hm2CurveFill, hm2StripsFill, hm2AuctionsFill, hm2EventPaint, HM2_SPECS, HM2_AUC, HM2_EV, HM2_TL, hm3On, ecToday, ecShift, ecAnchor";
/* the layer above the block, as on the page. `on` false = the switch thrown; `layer` false = a page without the layer. */
function load({ on = true, layer = true, hosts = {}, pg = async () => [] } = {}) {
  const heard = { click: [], keydown: [] };
  const ctx = { S: { econCty: "US", econCat: "ALL", econImp: "ALL", econDay: null }, el: (id) => hosts[id] || null, pg, console,
    document: { addEventListener: (k, f) => { (heard[k] || (heard[k] = [])).push(f); }, querySelectorAll: () => [], visibilityState: "visible" } };
  vm.runInNewContext(helpers + "const ecNormalize = (r) => r; const ecCountryFilter = () => '&country=eq.US'; const ecKeysetAfter = () => ''; const ecFetchWindow = async () => [];\n" +
    (layer ? (on ? hm3 : hm3.replace("var HM3_ON = true;", "var HM3_ON = false;")) : "") + hm2 +
    "\nglobalThis.out = { " + (layer ? EXPORTS : EXPORTS.split(", ").filter((n) => !/^(hm3|HM3)/.test(n) || n === "hm3On").join(", ")) + " };", ctx);
  return Object.assign(ctx.out, { ctx, heard });
}
const host = (id) => ({ id, nodeType: 1, innerHTML: "", clientWidth: 456, querySelectorAll: () => [], classList: { toggle() {} } });
/* the layer's click listener is the first the page registers (its script is above HM2's block, whose two come after) */
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);
const count = (s, re) => (s.match(re) || []).length;

/* ---- the layer is on the page, above HM2's block, and can be thrown off ------------------------------- */
test("the page carries the HM3 layer and its stylesheet byte for byte, once: the script just above HM2's block, the sheet just after HM2's", () => {
  assert.equal(page.split(hm3).length - 1, 1, "tools/hm3-block.js is the source of what the page runs");
  assert.equal(page.indexOf(hm3) + hm3.length, page.indexOf(hm2), "it ends where HM2's block begins — HM2's block still ends on the economic room's own module");
  assert.equal(page.indexOf(hm2) + hm2.length, page.indexOf("/* ---- Room 9 · ECONOMIC"));
  const sheet = '<style id="hm3-macro-look-20261007">\n' + css + "</style>\n";
  assert.equal(page.split(sheet).length - 1, 1);
  assert.ok(page.indexOf(sheet) > page.indexOf('<style id="hm2-macro-20261007">'), "after HM2's sheet");
  assert.equal(page.indexOf(sheet) + sheet.length, page.indexOf("</head>\n"));
  assert.match(hm3, /^var HM3_ON = true;/m, "var, so HM2's block can ask `typeof HM3_ON` from anywhere");
  assert.match(hm3, /\/\* ==== END HM3 =+ \*\/\n$/);
});
test("HM2's block asks the layer for HTML in six places and nowhere else; without the layer, or with the switch off, HM2's cards are drawn", () => {
  assert.match(hm2, /\nconst hm3On = \(\) => typeof HM3_ON !== "undefined" && HM3_ON;\n/);
  assert.equal(count(hm2, /hm3On\(\)/g), 7, "the curve, the auctions (two painters), the prints, the event card, the frames and PAGE SPECS");
  assert.equal(count(hm2, /\(hm3On\(\) \? hm3\w+ : hm2\w+\)\(/g), 4);
  const off = load({ on: false }), none = load({ layer: false }), on = load();
  assert.equal(off.hm3On(), false); assert.equal(none.hm3On(), false); assert.equal(on.hm3On(), true);
  for (const h of [off, none]) {
    assert.match(h.hm2RailCardsHTML(), /TREASURY AUCTIONS <i class="ec-li-note">each against the six before it<\/i>/, "HM2's frames");
    assert.match(h.HM2_SPECS, /<b>Auction history\.<\/b>/); assert.doesNotMatch(h.HM2_SPECS, /THEN VS NOW/);
  }
  assert.equal(on.hm2RailCardsHTML(), on.hm3RailCardsHTML());
  /* the same three hosts and the same two labels HM2's fills write into, in flat frames */
  for (const id of ["hm2Curve", "hm2CurveAsOf", "hm2Auctions", "hm2Strips", "hm2StripsSince"]) assert.equal(count(on.hm3RailCardsHTML(), new RegExp('id="' + id + '"', "g")), 1, id);
  assert.equal(count(on.hm3RailCardsHTML(), /class="card hm2-card hm3-card"/g), 3);
  assert.match(on.HM2_SPECS, /<b>The slider\.<\/b>/, "the slider's own paragraph is HM2's, untouched");
  for (const word of ["Treasury curve", "Treasury auctions", "Macro prints", "The event card"]) assert.ok(on.HM3_SPECS_P.includes("<b>" + word + ".</b>") && on.HM2_SPECS.includes(on.HM3_SPECS_P), word);
  assert.match(on.HM2_SPECS, /The tail is not shown: it needs the yield the new issue traded at one minute before the deadline, and no free source carries it\./);
});
test("the sheet styles only the layer's own classes, its text is 11 px or more, and nothing in it is a box inside a box", () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map((r) => r.split("{")[0].trim()).filter(Boolean).filter((s) => !s.startsWith("@media"));
  assert.ok(rules.length > 60);
  for (const sel of rules) for (const one of sel.split(",")) assert.match(one, /\.hm3-/, "“" + one.trim() + "” reaches only what the layer draws: with HM3_ON = false HM2's cards are as they were");
  const sizes = [...css.matchAll(/font-size:([\d.]+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 12); assert.ok(Math.min(...sizes) >= 11, "smallest is " + Math.min(...sizes));
  /* flat: the only rules that name all four sides are the two that take the rail card's own box away (the three cards; the event card's host) */
  assert.deepEqual(css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[;{ ]border:[^;]+;/g), [" border:0 !important;", " border:0 !important;"]);
  /* :has() is in a rule of its own: a browser that does not know it drops that one line, not the flat frames of the three cards */
  for (const sel of rules.filter((r) => r.includes(":has("))) assert.doesNotMatch(sel, /,/, "“" + sel + "” shares its rule with nothing");
  assert.equal(rules.filter((r) => r.includes(":has(")).length, 1);
  assert.doesNotMatch(css, /border-radius:[3-9]px|box-shadow/);
  for (const [lbl, , col] of load().HM3_THEN) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) > 24, lbl + " " + col + " is a hue, not a grey");
  }
  assert.match(css, /\.hm3-cl--now\.up, \.hm3-sl\.up\{ stroke:var\(--bull\); \} \.hm3-cl--now\.dn, \.hm3-sl\.dn\{ stroke:var\(--bear\); \}/, "the newest curve and the 2s10s line are the day's colour");
  assert.match(css, /\.hm3-row:hover\{ background:rgba\(255,255,255,\.035\); \}\n\.hm3-row\.is-open\{ background:rgba\(255,255,255,\.07\); \}/, "a line's hover and its open are the slider's own two greys");
});

/* ---- 1 · the curve -------------------------------------------------------------------------------------- */
const curveRow = (date, base, slope) => ({ date, m1: base, m2: base + 0.02, m3: base + 0.05, m6: base + 0.1, y1: base + 0.2, y2: base + 0.3 + slope * 0.2,
  y3: base + 0.4 + slope * 0.3, y5: base + 0.5 + slope * 0.5, y7: base + 0.6 + slope * 0.7, y10: base + 0.7 + slope, y20: base + 1.0 + slope, y30: base + 0.95 + slope });
function curveRows() {      /* newest first, one row a weekday for 400 days */
  const out = [], h = load(); let d = "2026-10-06";
  for (let i = 0; i < 400; i++) { const wd = new Date(h.ecAnchor(d) * 1000).getUTCDay(); if (wd !== 0 && wd !== 6) out.push(curveRow(d, 4.0 + i * 0.001, 0.5 - i * 0.002)); d = h.ecShift(d, -1); }
  return out;
}
test("the curve: three lines (now, a month ago, a year ago), five yields printed on the newest, THEN VS NOW, and 2s10s as one number with its year", () => {
  const h = load(), html = h.hm3CurveHTML(curveRows().slice(0, 270), 456);
  assert.equal(count(html, /<polyline class="hm3-cl" /g), 2, "a month ago and a year ago — no week-ago line");
  assert.equal(count(html, /<polyline class="hm3-cl hm3-cl--now (up|dn)"/g), 1, "the newest, in the day's colour");
  assert.equal(count(html, /<text class="hm3-val"/g), 5, "3M, 2Y, 5Y, 10Y and 30Y are printed on the line");
  assert.deepEqual([...html.matchAll(/<text class="hm3-ax"[^>]*>([^<]+)</g)].map((m) => m[1]), ["1M", "3M", "1Y", "2Y", "5Y", "10Y", "30Y"]);
  assert.doesNotMatch(html, /hm2-grid|<table|hm2-sp\b|3m10y|1W AGO/, "no grid, no table, no boxed tile, no second spread, no week-ago");
  assert.match(html, /<div class="hm3-tvn__r hm3-tvn__h"><span>THEN VS NOW<\/span><span>3M<\/span><span>2Y<\/span><span>10Y<\/span><span>30Y<\/span><\/div>/);
  assert.deepEqual([...html.matchAll(/<i><\/i>([A-Z0-9 ]+)<em> · ([^<]+)<\/em>/g)].map((m) => m[1] + "|" + m[2]), ["NOW|OCT 6", "1M AGO|SEP 4", "1Y AGO|OCT 6 2025"]);
  assert.equal(count(html, /<div class="hm3-tvn__r">/g), 3);
  assert.match(html, /<span class="is-now">4\.05<\/span><span class="is-now">4\.40<\/span><span class="is-now">5\.20<\/span><span class="is-now">5\.45<\/span>/, "the newest curve's 3M, 2Y, 10Y, 30Y");
  assert.match(html, /title="10Y [+−]\d+ bp from then to today"/, "a then-number's hover says how far it has moved");
  assert.match(html, /<span class="hm3-sp__l">2s10s<\/span><b class="hm3-sp__v (up|dn)">\+0\.80<\/b><span class="hm3-sp__c (up|dn)">[+−]\d+ bp on the day<\/span><svg class="hm3-spark"/, "one number, the day's move, its year as a line");
  assert.equal(count(html, /<svg class="hm3-spark"/g), 1);
  assert.match(html, /<span class="hm3-sp__o"><span style="color:#00D4FF">1M \+0\.7\d<\/span><span style="color:#FF8A00">1Y \+0\.\d\d<\/span><\/span>/);
  assert.doesNotMatch(html, /stroke:#(8|9|a|b|c)[0-9a-f]\1/i, "no grey line");
});
test("the curve: the day's colour follows the 10-year; an inverted 2s10s says so; a short table draws what it has; none says so", () => {
  const h = load();
  const up = h.hm3CurveHTML([curveRow("2026-10-06", 4.1, 0.5), curveRow("2026-10-05", 4.0, 0.5)], 400);
  assert.match(up, /hm3-cl--now up/); assert.equal(count(up, /<polyline class="hm3-cl" /g), 0, "no older curve stored: none drawn");
  assert.equal(count(up, /<div class="hm3-tvn__r">/g), 1, "and THEN VS NOW is the one line it has");
  assert.match(h.hm3CurveHTML([curveRow("2026-10-06", 4.0, 0.5), curveRow("2026-10-05", 4.1, 0.5)], 400), /hm3-cl--now dn/);
  assert.match(h.hm3CurveHTML([curveRow("2026-10-06", 4.0, -1.2), curveRow("2026-10-05", 4.0, -1.1)], 400), /bp on the day · INVERTED<\/span>/);
  assert.match(h.hm3CurveHTML([curveRow("2026-10-06", 4.0, 0.5), curveRow("2026-10-05", 4.0, 0.5)], 400), /hm3-cl--now flat/, "an unchanged 10-year is the accent colour, never a grey");
  assert.match(h.hm3CurveHTML([], 400), /the curve is not stored yet/);
  /* a narrow host (a phone) keeps its floor: the picture is never drawn smaller than 280 wide */
  assert.match(h.hm3CurveHTML([curveRow("2026-10-06", 4.1, 0.5)], 120), /viewBox="0 0 280 150"/);
});

/* ---- 2 · the auctions ----------------------------------------------------------------------------------- */
const auc = (term, date, btc, ind, dlr, extra = {}) => Object.assign({ cusip: term + date, auction_date: date, term, status: "auctioned", reopening: false, closing_time_et: "01:00 PM",
  offering_amount: 39e9, high_yield: 5.3, median_yield: 5.25, bid_to_cover: btc, indirect_pct: ind, direct_pct: 100 - ind - dlr, dealer_pct: dlr, results_pdf: null }, extra);
function auctionRows(h) {
  const t = h.ecToday();
  return [auc("30-Year", h.ecShift(t, 1), null, null, null, { status: "announced", reopening: true, offering_amount: 22e9, high_yield: null, bid_to_cover: null, indirect_pct: null, direct_pct: null, dealer_pct: null }),
    auc("10-Year", t, 2.77, 80.3, 2.5, { reopening: true, results_pdf: "R_20261007_2.pdf" }), auc("2-Year", h.ecShift(t, -15), 2.63, 58, 13, { offering_amount: 69e9, high_yield: 4.787 }),
    auc("10-Year", h.ecShift(t, -28), 2.71, 79.2, 4.3, { high_yield: 5.2 }), auc("10-Year", h.ecShift(t, -56), 2.53, 76.7, 8.6, { high_yield: 5.25 }), auc("10-Year", h.ecShift(t, -84), 2.59, 74, 9, { high_yield: 5.1 })];
}
test("auctions: one line per term, folded as it opens; a number is green for more demand than the six before it — and for dealers LESS is the stronger auction", () => {
  const h = load(), rows = auctionRows(h), html = h.hm3AuctionsHTML(rows, [{ term: "20-Year", day: "2026-10-21", last: 13e9 }]);
  assert.match(html, /^<div class="hm3-row hm3-ar hm3-ar--h"><span>TERM<\/span><span>DATE<\/span><span>SIZE<\/span><span>STOP<\/span><span>COVER<\/span><span>INDIRECT<\/span><span>DEALERS<\/span><\/div>/);
  assert.deepEqual([...html.matchAll(/data-hm3="auc" data-k="([^"]+)" role="button" tabindex="0" aria-expanded="(\w+)"/g)].map((m) => m[1] + " " + m[2]), ["2-Year false", "10-Year false"], "the terms it has, in the curve's order, none open");
  assert.doesNotMatch(html, /hm3-open|<table|hm2-ah\b|hm2-al\b/, "no history until a line is clicked; no table, no boxed head");
  const ten = html.slice(html.indexOf('data-k="10-Year"'), html.indexOf('<div class="hm3-next">'));
  assert.match(ten, /<i class="hm3-chev">▸<\/i>10Y<i class="hm3-re">r<\/i><\/span><span>TODAY<\/span><span>\$39B<\/span><span><b>5\.300%<\/b><\/span>/);
  assert.match(ten, /<span class="up" title="the six before it averaged 2\.61×">2\.77×<\/span><span class="up" title="the six before it averaged 77%">80%<\/span><span class="up" title="the six before it averaged 7%">3%<\/span>/,
    "more cover and more indirect than usual: green; dealers left with less than usual: also green");
  assert.match(html, /class="hm3-row hm3-ar is-today" data-hm3="auc" data-k="10-Year"/, "today's auction is marked");
  assert.match(html, /<div class="hm3-next"><b>COMING<\/b><span><b>30Y reopening<\/b> \$22B · tomorrow 1:00 PM ET<\/span><\/div>/);
  assert.match(html, /<div class="hm3-next hm3-next--later"[^>]*><b>LATER<\/b><span title="its last auction was \$13B"><b>20Y<\/b> OCT 21<\/span><\/div>/, "dated, not yet sized: the last size is in the hover, never shown as this one's");
  assert.match(h.hm3AuctionsHTML([], null), /no auctions stored yet/);
});
test("auctions: a click opens that term — Treasury's own result and its auctions as five rows of bars, oldest on the left — and a second click folds it", () => {
  const h = load({ hosts: { hm2Auctions: host("hm2Auctions") } }), rows = auctionRows(h);
  h.HM2_AUC.rows = rows; h.hm2AuctionsPaint();
  const box = h.ctx.el("hm2Auctions");
  assert.match(box.innerHTML, /^<div class="hm3-row hm3-ar hm3-ar--h">/, "HM2's own painter draws the layer's lines");
  const click = (k, v, inside = null) => h.heard.click[0]({ type: "click", target: { closest: (sel) => (sel === "a, [data-hm2]" ? inside : sel === "[data-hm3]" ? { dataset: { hm3: k, k: v } } : null) } });
  assert.equal(click("auc", "10-Year"), true); assert.equal(h.HM3.auc, "10-Year");
  const open = box.innerHTML;
  assert.equal(count(open, /<div class="hm3-open">/g), 1); assert.match(open, /class="hm3-row hm3-ar is-open is-today" data-hm3="auc" data-k="10-Year" role="button" tabindex="0" aria-expanded="true"/);
  assert.match(open, /<span>4 AUCTIONS · [A-Z]{3} \d{4} → [A-Z]{3} \d{4}<\/span><a class="hm3-link" href="https:\/\/www\.treasurydirect\.gov\/instit\/annceresult\/press\/preanre\/2026\/R_20261007_2\.pdf" target="_blank" rel="noopener"[^>]*>OFFICIAL RESULT ↗<\/a>/);
  assert.deepEqual([...open.matchAll(/<div class="hm3-m__h"><b>([^<]+)<\/b>/g)].map((m) => m[1]), ["STOPPED AT", "BID-TO-COVER", "INDIRECT", "DIRECT", "DEALERS"]);
  assert.equal(count(open, /<span class="hm3-bars" style="--h:30px">/g), 5); assert.equal(count(open, / is-now" style="--p:/g), 5, "each row ends on this auction's own bar");
  const dealers = open.slice(open.indexOf("<b>DEALERS</b>"));
  assert.match(dealers, /what the banks were left holding · lower is stronger/);
  assert.match(dealers, /<i class="up is-now" style="--p:12%" title="[^"]*2\.5% · the six before it averaged 7\.3%"><\/i><\/span><span class="hm3-chart__v up"><b>2\.5%<\/b><i>six before 7\.3<\/i>/, "the smallest dealer share of the four: the shortest bar, and green");
  const stop = open.slice(open.indexOf("<b>STOPPED AT</b>"), open.indexOf("<b>BID-TO-COVER</b>"));
  assert.match(stop, /<span class="hm3-chart__v up"><b>5\.300%<\/b><\/span>/, "the stop has no better or worse: it is coloured by which way it moved, with no six-before beside it");
  /* a link or one of HM2's own controls inside the open row is not a fold */
  assert.equal(click("auc", "10-Year", { href: "x" }), false); assert.equal(h.HM3.auc, "10-Year");
  click("auc", "2-Year"); assert.equal(h.HM3.auc, "2-Year"); assert.equal(count(box.innerHTML, /<div class="hm3-open">/g), 1, "one term open at a time");
  click("auc", "2-Year"); assert.equal(h.HM3.auc, null); assert.doesNotMatch(box.innerHTML, /hm3-open/);
  /* with the switch off the same painter draws HM2's card, and the layer's click does nothing */
  const off = load({ on: false, hosts: { hm2Auctions: host("hm2Auctions") } }); off.HM2_AUC.rows = auctionRows(off); off.hm2AuctionsPaint();
  assert.match(off.ctx.el("hm2Auctions").innerHTML, /^<div class="hm2-ah">/);
  assert.equal(off.heard.click[0]({ type: "click", target: { closest: (sel) => (sel === "[data-hm3]" ? { dataset: { hm3: "auc", k: "10-Year" } } : null) } }), false);
});

/* ---- 3 · the prints -------------------------------------------------------------------------------------- */
const print = (event, day, actual, estimate, previous = null) => ({ event_ts: ts(day + "T12:30:00Z"), country: "US", event, actual, estimate, previous, impact: "High" });
function printsBy(h) {
  const all = [print("Unemployment Rate (Aug)", "2026-09-04", 4.0, 4.1), print("Unemployment Rate (Sep)", "2026-10-02", 4.2, 4.1), print("Inflation Rate YoY (Aug)", "2026-09-11", 3.4, 3.4), print("Inflation Rate YoY (Jul)", "2026-08-12", 3.2, 3.3)];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* fifteen payroll prints a month apart: small misses, then small beats; one month it shrank (−23 against 20); the newest is the biggest miss (29 against 90) */
  for (let i = 0; i < 15; i++) all.push(print("Non Farm Payrolls (" + MON[(6 + i) % 12] + ")", h.ecShift("2025-08-01", i * 30), i === 14 ? 29 : i === 5 ? -23 : 100 + i * 10, i === 14 ? 90 : i === 5 ? 20 : 105 + i * 9, 50 + i));
  return h.hm2StripRows(all);
}
test("prints: one line per indicator — its last twelve surprises on a line and the newest print — folded as it opens; lower is better for unemployment and inflation", () => {
  const h = load(), by = printsBy(h), have = ["Non Farm Payrolls", "Unemployment Rate", "Inflation Rate YoY"], html = h.hm3PrintsHTML(have, by);
  assert.deepEqual([...html.matchAll(/data-hm3="print" data-k="([^"]+)" role="button" tabindex="0" aria-expanded="false"/g)].map((m) => m[1]), have);
  assert.doesNotMatch(html, /hm3-open|hm2-st\b/);
  const row = (k) => html.slice(html.indexOf('data-k="' + k + '"')).split('<div class="hm3-row')[0];
  const nfp = row("Non Farm Payrolls");
  assert.match(nfp, /<i class="hm3-chev">▸<\/i>PAYROLLS<\/span><span class="hm3-bars hm3-bars--mid" style="--h:20px">/);
  assert.equal(count(nfp, /<i class="(up|dn|eq)[^"]*" style="--p:/g), 12, "fifteen stored, the last twelve shown on the line");
  assert.match(nfp, /<i class="dn is-now is-lo" style="--p:100%" title="[^"]*actual 29 · expected 90[^"]*worse than expected"><\/i><\/span><span class="hm3-row__v dn"><b>29<\/b> vs 90<\/span>/, "the newest: the biggest miss, below the line and red");
  const ur = row("Unemployment Rate");
  assert.match(ur, /<i class="up" style="--p:100%" title="[^"]*actual 4 · expected 4\.1[^"]*better than expected"><\/i><i class="dn is-now is-lo"/, "4.0% against 4.1%: fewer out of work, above the line and green; then 4.2%: red");
  assert.match(row("Inflation Rate YoY"), /<i class="up"[^>]*actual 3\.2 · expected 3\.3[^>]*><\/i><i class="eq is-now is-zero" style="--p:0%"[^>]*on consensus/, "cooler than expected: green; exactly on consensus: the yellow dot on the line");
  assert.doesNotMatch(html, /class="(flat|grey|gray|mute)/, "no grey bar");
});
test("prints: a click opens every stored print as bars of the number itself, then the last four in words, and the way to the calendar; one open at a time", () => {
  const strips = host("hm2Strips"), h = load({ hosts: { hm2Strips: strips } }), by = printsBy(h), have = ["Non Farm Payrolls", "Unemployment Rate", "Inflation Rate YoY"];
  strips.innerHTML = h.hm3PrintsHTML(have, by);
  const click = (k, v) => h.heard.click[0]({ type: "click", target: { closest: (sel) => (sel === "[data-hm3]" ? { dataset: { hm3: k, k: v } } : null) } });
  click("print", "Non Farm Payrolls");
  let open = strips.innerHTML.slice(strips.innerHTML.indexOf('<div class="hm3-open">'), strips.innerHTML.indexOf('data-k="Unemployment Rate"'));
  assert.match(open, /<span>15 PRINTS · AUG 2025 → [A-Z]{3} 2026<\/span><span>\d+ BETTER · \d+ WORSE<\/span>/);
  assert.match(open, /<span class="hm3-bars hm3-bars--mid" style="--h:46px">/, "payrolls went below zero in this stretch: its bars stand on a zero line");
  assert.equal(count(open, /<i class="(up|dn|eq)[^"]*" style="--p:/g), 15, "every stored print");
  assert.match(open, /<i class="dn is-lo" style="--p:10%" title="[^"]*actual -23 /, "the month it shrank: below the line");
  assert.match(open, /<span class="hm3-chart__v dn"><b>29<\/b><i>low -23 · high 230<\/i><\/span>/);
  assert.equal(count(open, /<span class="hm3-pl">/g), 4, "the last four prints in words");
  assert.match(open, /<span class="hm3-pl"><i>[A-Z]{3} \d+<\/i><b class="dn">29<\/b><span>expected 90 · before 64<\/span><\/span>/, "newest first");
  assert.match(open, /<span class="hm3-link" data-hm2="strip" data-day="\d{4}-\d\d-\d\d"[^>]*>IN THE CALENDAR →<\/span>/, "HM2's own click opens that day in the calendar");
  click("print", "Unemployment Rate");
  assert.equal(h.HM3.print, "Unemployment Rate"); assert.equal(count(strips.innerHTML, /<div class="hm3-open">/g), 1, "one indicator open at a time");
  open = strips.innerHTML.slice(strips.innerHTML.indexOf('<div class="hm3-open">'));
  assert.match(open, /<span class="hm3-bars" style="--h:46px"><i class="up" style="--p:12%"[^>]*><\/i><i class="dn is-now" style="--p:100%"/, "a rate that never crosses zero is stretched between its own low and high");
  click("print", "Unemployment Rate"); assert.equal(h.HM3.print, null); assert.doesNotMatch(strips.innerHTML, /hm3-open/);
  /* Enter or the space bar on a line does what a click does */
  let stopped = 0;
  h.heard.keydown[0]({ type: "keydown", key: "Enter", preventDefault: () => { stopped++; }, target: { dataset: { hm3: "print", k: "Inflation Rate YoY" }, closest: (sel) => (sel === "[data-hm3]" ? { dataset: { hm3: "print", k: "Inflation Rate YoY" } } : null) } });
  assert.equal(h.HM3.print, "Inflation Rate YoY"); assert.equal(stopped, 1);
  h.heard.keydown[0]({ type: "keydown", key: "a", preventDefault: () => { stopped++; }, target: { dataset: { hm3: "print", k: "Non Farm Payrolls" }, closest: () => null } });
  assert.equal(h.HM3.print, "Inflation Rate YoY", "any other key is left alone");
});
test("prints: HM2's one read fills the layer's lines (no second read), and a redraw after a click reads nothing", async () => {
  let reads = 0; const strips = host("hm2Strips"), since = host("hm2StripsSince");
  const rows = [print("Unemployment Rate (Aug)", "2026-09-04", 4.0, 4.1), print("Unemployment Rate (Sep)", "2026-10-02", 4.2, 4.1)];
  const h = load({ hosts: { hm2Strips: strips, hm2StripsSince: since }, pg: async (q) => { reads++; return /^econ_calendar/.test(q) ? rows : []; } });
  await h.hm2StripsFill();
  assert.equal(reads, 1); assert.match(strips.innerHTML, /^<div class="hm3-row hm3-pr" data-hm3="print" data-k="Unemployment Rate"/); assert.equal(since.textContent, "since SEP 2026");
  h.HM3.print = "Unemployment Rate"; h.hm3PrintsPaint();
  assert.equal(reads, 1, "the click's redraw is from what was read"); assert.match(strips.innerHTML, /hm3-open/);
});

/* ---- 4 · the event card ----------------------------------------------------------------------------------- */
test("the event card: the official link and the three headlines, nothing more", () => {
  const h = load(), now = ts("2026-10-07T18:33:00Z");
  const ev = { sub: "FOMC Minutes", event: "FOMC Minutes", ets: ts("2026-10-07T18:00:00Z"), cty: "US", impact: "High", actual: null, estimate: null, previous: null, has: true, why: "now" };
  const news = [{ title: "Fed minutes show most policymakers see another rate hike by year end", site: "Investing.com", url: "https://www.investing.com/a", published_ts: ts("2026-10-07T18:05:00Z") },
    { title: "Fed policymakers divided over rate-hike logic in September, minutes show", site: "Investing.com", url: "https://www.investing.com/b", published_ts: ts("2026-10-07T18:06:00Z") },
    { title: "A third", site: "Reuters", url: null, published_ts: ts("2026-10-07T18:09:00Z") }];
  const html = h.hm3EventHTML(ev, now, news, null);
  assert.match(html, /^<h4 class="hm3-ev">FOMC MINUTES <i class="ec-li-note">TODAY 14:00 ET · out 33 min ago<\/i><\/h4><a class="hm3-link hm3-ev__src" href="https:\/\/www\.federalreserve\.gov\/monetarypolicy\/fomccalendars\.htm" target="_blank" rel="noopener"[^>]*>FEDERALRESERVE\.GOV ↗<\/a>/);
  assert.equal(count(html, /<span class="hm3-ev__n">/g), 3);
  assert.match(html, /<span class="hm3-ev__n"><a href="https:\/\/www\.investing\.com\/a" target="_blank" rel="noopener">Fed minutes show[^<]+<\/a> <i>Investing\.com · 14:05 ET<\/i><\/span>/);
  assert.match(html, /<span class="hm3-ev__n">A third <i>Reuters · 14:09 ET<\/i><\/span>$/, "the card ends on the third headline");
  assert.doesNotMatch(html, /FROM THE CALENDAR|OFFICIAL SOURCE|FROM OUR NEWS FEED|hm2-evr|high importance|No text and no number/, "the three labelled rows and their sentences are gone");
  /* before the release: the link is already there (it is where it will be published); no headline line at all */
  const before = h.hm3EventHTML(Object.assign({}, ev, { ets: now + 1800 }), now, null, null);
  assert.match(before, /in 30 min<\/i><\/h4><a class="hm3-link hm3-ev__src"[^>]*>FEDERALRESERVE\.GOV ↗<\/a>$/);
  /* out, the feed read and empty: one quiet line */
  assert.match(h.hm3EventHTML(ev, now, [], null), /↗<\/a><span class="hm3-ev__none">no headline in our feed yet<\/span>$/);
  /* a print keeps its numbers in the day table; the card is still the link and the headlines */
  const cpi = h.hm3EventHTML({ sub: "Inflation Rate YoY", event: "Inflation Rate YoY (Sep)", ets: ev.ets, cty: "US", impact: "High", actual: 3.4, estimate: 3.4, previous: 3.2, has: true, why: "picked" }, now, [], null);
  assert.match(cpi, /BLS\.GOV ↗/); assert.doesNotMatch(cpi, /actual|expected/); assert.match(cpi, /data-hm2="evclose"/, "a picked release keeps HM2's × back to what is happening now");
  /* an auction that has a result links Treasury's own page for it; a release with no publisher on file says so */
  const a = h.hm3EventHTML({ sub: "10-Year Note Auction", event: "10-Year Note Auction", ets: ev.ets, cty: "US", impact: "Medium", actual: 5.3, estimate: null, previous: 5.1, has: true, why: "now" }, now, [], { results_pdf: "R_20261007_2.pdf" });
  assert.match(a, /href="https:\/\/www\.treasurydirect\.gov\/instit\/annceresult\/press\/preanre\/2026\/R_20261007_2\.pdf"[^>]*>THIS AUCTION’S RESULT · TREASURYDIRECT\.GOV ↗<\/a>/);
  assert.match(h.hm3EventHTML(Object.assign({}, ev, { sub: "Some Unknown Survey" }), now, [], null), /<span class="hm3-ev__none">no official link on file for this release<\/span>/);
});

/* ---- the page as pictured, held to what was read off it (data/shoot-*.json, written by tools/shoot.mjs) ---- */
test("read off the page at 1680: every card is flat and whole inside one view of the rail; nothing cut, nothing under 11 px; before, two cards were taller than the rail", () => {
  const was = shoot("before-1680"), now = shoot("after-1680");
  for (const j of [was, now]) { assert.equal(j.error, undefined); assert.equal(j.pageErrors.length, 0); assert.ok(j.requests.stoppedNonGet <= 2, "every request that was not a GET was stopped: " + j.requests.stoppedNonGet); }
  assert.match(was.page, /@ca8e0dc$/); assert.equal(now.facts.event, "FOMC Minutes 14:00 ET");
  const a = now.facts.asItOpens, b = was.facts.asItOpens;
  assert.deepEqual(a.railCssPx, b.railCssPx); assert.equal(a.sidewaysPx, 0);
  for (const k of ["event", "curve", "auctions", "prints"]) {
    const c = a.cards[k];
    assert.equal(c.fitsInOneRailView, true, k + " is " + c.cssPx[1] + " px of a " + a.railCssPx[1] + " px rail"); assert.ok(c.cssPx[1] < b.cards[k].cssPx[1], k + " is shorter than it was");
    assert.equal(c.sidewaysPx, 0); assert.deepEqual(c.cut, [], k + ": nothing cut"); assert.ok(c.smallestTextPx >= 11, k + ": " + c.smallestTextPx);
  }
  for (const k of ["curve", "auctions", "prints"]) assert.equal(a.cards[k].borders, 0, k + ": no box inside it");
  assert.ok(b.cards.curve.borders >= 2 && b.cards.auctions.borders >= 5, "before: the two spread tiles; the auction's boxed head and its chips");
  assert.equal(b.cards.auctions.fitsInOneRailView, false); assert.equal(b.cards.prints.fitsInOneRailView, false);
  assert.ok(a.cards.curve.sharePctOfRailHeight <= 50, "the whole curve card is " + a.cards.curve.sharePctOfRailHeight + " % of the rail's height");
  assert.equal(a.cards.auctions.lines, 7); assert.equal(a.cards.prints.lines, 18);
  assert.match(a.cards.event.text, /^FOMC MINUTES TODAY 14:00 ET · OUT \d+ (MIN|H) AGO × FEDERALRESERVE\.GOV ↗ /);
  /* a click, in the page: the term opens and folds; one print open at a time */
  assert.ok(now.facts.auctionOpen.cssPx[1] > a.cards.auctions.cssPx[1] + 200); assert.equal(now.facts.auctionFoldedAgain, true);
  assert.deepEqual(now.facts.oneOpenAtATime, ["Inflation Rate YoY"]);
  assert.deepEqual(now.facts.auctionOpen.cut, []); assert.deepEqual(now.facts.printOpen.cut, []);
});
test("read off the page at 390: the same four cards, each narrower than the screen, nothing cut, nothing under 11 px", () => {
  const was = shoot("before-390"), now = shoot("after-390");
  for (const j of [was, now]) { assert.equal(j.error, undefined); assert.equal(j.pageErrors.length, 0); }
  const a = now.facts.asItOpens, b = was.facts.asItOpens;
  assert.equal(a.sidewaysPx, 0);
  for (const k of ["event", "curve", "auctions", "prints"]) {
    const c = a.cards[k];
    assert.ok(c.cssPx[0] <= 364 && c.cssPx[1] < b.cards[k].cssPx[1], k); assert.equal(c.sidewaysPx, 0); assert.deepEqual(c.cut, [], k + ": nothing cut"); assert.ok(c.smallestTextPx >= 11);
  }
  assert.ok(b.cards.prints.cut.length > 0, "before: indicator names were cut short on a phone");
  assert.deepEqual(now.facts.auctionOpen.cut, []); assert.deepEqual(now.facts.printOpen.cut, []);
});
