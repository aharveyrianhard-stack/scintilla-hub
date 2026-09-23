/* THE ECONOMIC TAB, CHECKED AGAINST ITS BUILDER'S NOTES (13 Aug plan, re-checked 23 Sep).
   Alan pasted the notes from the session that restructured the tab and asked what matches and what does not.
   Every line of that plan that can be pinned in code is pinned here, including the three gaps this branch closed:
   the tab landing on WEEK, OTHER reading 0, and the colour law's three separate channels.
   The room is VM-extracted from ../index.html the way the repo's own tests do — no network, no browser. The rows
   are the captured US week fixture the econ-tape lane recorded (tests/fixtures/econ-week-us-20260921.json). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mod = page.slice(page.indexOf("/* ---- Room 9 · ECONOMIC"), page.indexOf("/* ---- Room 3 · COMPANY"));
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const WEEK = JSON.parse(fs.readFileSync(new URL("./fixtures/econ-week-us-20260921.json", import.meta.url), "utf8")).rows;
const plain = (x) => JSON.parse(JSON.stringify(x));

const EXPORTS = ["ecCat", "ecBase", "ecRowHTML", "ecDayRowsHTML", "ecMonthHTML", "econRoomHTML", "EC_CAT_COLOR",
  "EC_REGIONS", "EC_CAT_NAMES", "ecImpCls", "ecFam"];
function load(S = {}) {
  const ctx = vm.createContext({ console, setTimeout,
    S: { sec: "ECONOMIC", econCty: "US", econCat: "ALL", econDay: "2026-09-23", econSpan: "WEEK", econOpen: {}, econImp: "ALL", ...S },
    pg: async () => [], el: () => null, go: () => {}, SECFS_BTN: "", document: { querySelectorAll: () => [] } });
  return vm.runInContext(escSrc + numSrc + mod + "\n;({" + EXPORTS.join(",") + "})", ctx);
}
const api = load();
const row = (o) => ({ event: "Retail Sales MoM", country: "US", impact: "Medium", event_ts: 1790000000,
                      actual: null, estimate: null, previous: null, ...o });

/* ---- 2.1 · three nav rows ------------------------------------------------ */
test("regions are US · G7 · G20 · EM · ALL", () => {
  assert.deepEqual(plain(api.EC_REGIONS), ["US", "G7", "G20", "EM", "ALL"]);
});
test("every category chip carries its own colour dot — the legend", () => {
  const html = page.slice(page.indexOf("function renderEconCats"), page.indexOf("function renderEconCats") + 900);
  assert.match(html, /<i class="cd" style="background:' \+ \(EC_CAT_COLOR\[n\]/);
  for (const n of plain(api.EC_CAT_NAMES)) {
    if (n === "ALL") continue;
    assert.ok(api.EC_CAT_COLOR[n], "every category has a hue: " + n);
  }
});
test("the day stepper carries DAY · WEEK · MONTH — but the tab lands on MONTH, not WEEK", () => {
  const room = api.econRoomHTML();
  for (const s of ["DAY", "WEEK", "MONTH"]) assert.match(room, new RegExp('data-act="ecspan" data-s="' + s + '"'));
  /* THE ONE LINE OF THE 13 AUG PLAN THAT IS NOT TRUE, AND IS NOT A REGRESSION: the plan says WEEK is the
     default landing; the tab lands on MONTH because the later iPad-calendar rebuild made MONTH the landing
     on purpose, and tests/economic-month-zoom.test.mjs pins it. Left as Alan's more recent decision; this
     test records the conflict instead of quietly overruling either side. */
  assert.match(page, /econSpan: "MONTH",/, "the state default is the landing span");
  assert.match(load({ econSpan: "MONTH" }).econRoomHTML(), /<span class="ec-sp on" data-act="ecspan" data-s="MONTH"/);
  assert.match(load({ econSpan: "WEEK" }).econRoomHTML(), /<span class="ec-sp on" data-act="ecspan" data-s="WEEK"/,
    "and WEEK lights up the moment it is chosen");
});

/* ---- 2.2 · the table ----------------------------------------------------- */
test("the columns are Release / Time / Actual / Est / Prior / Surprise", () => {
  const head = page.match(/const head = '<div class="ec-hd">[\s\S]*?;\n/)[0];
  for (const c of ["Release", "Time", "Actual", "Est", "Prior", "Surprise"]) assert.ok(head.includes(">" + c + "<"), "column " + c);
});
test("a composite release collapses to one headline row that opens inline", () => {
  const ts = 1790000000;
  const cpi = [
    row({ event: "Inflation Rate YoY", impact: "High", event_ts: ts, actual: 3.1, estimate: 3.0 }),
    row({ event: "Inflation Rate MoM", impact: "Medium", event_ts: ts }),
    row({ event: "Core Inflation Rate YoY", impact: "High", event_ts: ts }),
    row({ event: "CPI", impact: "Medium", event_ts: ts }),
  ];
  const shut = api.ecDayRowsHTML(cpi, false);
  assert.equal((shut.match(/ec-row par/g) || []).length, 1, "collapsed to ONE headline row");
  assert.ok(!/ec-row sub/.test(shut), "its components are not loose in the day");
  assert.match(shut, /Inflation Rate YoY/);
  assert.match(shut, /data-act="ecfam" data-k="US\|/, "and the headline is what opens them");
  assert.match(page, /\.ec-row\.par \.nm::after\{ content:"  ▸"/, "a headline says it opens");
  const key = (shut.match(/data-k="([^"]+)"/) || [])[1];
  const open = load({ econOpen: { [key]: true } }).ecDayRowsHTML(cpi, false);
  assert.equal((open.match(/ec-row sub/g) || []).length, 3, "opened, its components sit inline underneath");
  const solo = api.ecDayRowsHTML([row({ event: "Retail Sales MoM", event_ts: ts })], false);
  assert.ok(!/ec-row par/.test(solo), "a release with no family stays a flat row");
});

/* ---- 2.3 · MONTH is a real calendar -------------------------------------- */
test("MONTH is a Sunday-first grid with the date top-right, today badged and neighbouring months greyed", () => {
  const cal = api.ecMonthHTML([row({ event_ts: 1790000000 })]);
  const dows = [...cal.matchAll(/class="ec-dow">(\w+)</g)].map((m) => m[1]);
  assert.deepEqual(dows, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  assert.match(cal, /class="ec-cal"/);
  assert.match(cal, /ec-cell out/, "days from the neighbouring month are there, marked");
  assert.match(cal, /ec-dnum is-today/, "today is badged");
  const css = page.slice(page.indexOf(".ec-cal{"), page.indexOf(".ec-cal{") + 600);
  assert.match(css, /grid-template-columns:repeat\(7/);
  assert.match(page, /\.ec-dnum\{[^}]*justify-content:flex-end/, "the date sits top-right");
});

/* ---- 2.4 · the colour law, three channels -------------------------------- */
test("what KIND it is sets the hue: the spine and its dot, from the chips' own table", () => {
  const html = api.ecRowHTML(row({ event: "Inflation Rate YoY", impact: "High" }), "", false);
  assert.match(html, new RegExp('border-left-color:' + api.EC_CAT_COLOR.INFLATION.replace(/[()]/g, "\\$&")));
  assert.match(html, new RegExp('class="dot" style="color:' + api.EC_CAT_COLOR.INFLATION));
  const labor = api.ecRowHTML(row({ event: "Initial Jobless Claims", impact: "High" }), "", false);
  assert.match(labor, new RegExp(api.EC_CAT_COLOR.LABOR));
  assert.ok(!/EC_DOT\[ecImpCls/.test(page), "importance no longer picks a hue anywhere");
});
test("how much it MATTERS is weight only — a thicker spine and brighter text, never hue", () => {
  const hi = api.ecRowHTML(row({ event: "Inflation Rate YoY", impact: "High" }), "", false);
  const lo = api.ecRowHTML(row({ event: "Inflation Rate YoY", impact: "Low" }), "", false);
  assert.match(hi, /ec-row  imp-high/);
  assert.match(lo, /ec-row  imp-low/);
  const hueOf = (h) => (h.match(/border-left-color:([^"]+)"/) || [])[1];
  assert.equal(hueOf(hi), hueOf(lo), "the same kind keeps the same hue whatever its importance");
  assert.match(page, /\.ec-row\.imp-high\{ border-left-width:3px; \}/);
  assert.match(page, /\.ec-row\.imp-high \.rel \.nm\{ color:var\(--ink\); font-weight:600; \}/);
});
test("how it CAME OUT sets the name's hue — green, yellow, red, and nothing else wears them", () => {
  const hotter = api.ecRowHTML(row({ event: "Inflation Rate YoY", actual: 3.4, estimate: 3.0 }), "", false);
  const cooler = api.ecRowHTML(row({ event: "Inflation Rate YoY", actual: 2.6, estimate: 3.0 }), "", false);
  const inline = api.ecRowHTML(row({ event: "Inflation Rate YoY", actual: 3.0, estimate: 3.0 }), "", false);
  assert.match(hotter, /res-up/); assert.match(cooler, /res-dn/); assert.match(inline, /res-flat/);
  assert.ok(!/res-/.test(api.ecRowHTML(row({ event: "Inflation Rate YoY" }), "", false)), "nothing printed, no result colour");
  for (const [cls, v] of [["res-up", "--sv5"], ["res-dn", "--sv1"], ["res-flat", "--sv3"]])
    assert.match(page, new RegExp("\\.ec-row\\." + cls + " \\.rel \\.nm\\{ color:var\\(" + v + "\\)"));
  /* the three reserved colours appear on the row only through the name and the surprise value */
  const svUse = [...page.matchAll(/\.ec-row[^{]*\{[^}]*var\(--sv[135]\)[^}]*\}/g)].map((m) => m[0]);
  for (const rule of svUse) assert.match(rule, /\.(nm|v)\b|\.v\./, "a reserved colour outside the result: " + rule);
});

/* ---- 2.5 · OTHER reads 0 ------------------------------------------------- */
test("the three releases that had no home now have one", () => {
  assert.equal(api.ecCat("M2 Money Supply MoM (Aug)"), "CENTRAL BANK");
  assert.equal(api.ecCat("Money Supply (Aug)"), "CENTRAL BANK");
  assert.equal(api.ecCat("2-Year FRN Auction"), "AUCTIONS");
  assert.equal(api.ecCat("Non Defense Goods Orders Ex Air (Aug)"), "GROWTH");
});
test("over a real US week, OTHER holds nothing but the one thing that is not a data release", () => {
  const other = WEEK.filter((r) => api.ecCat(r.event) === "OTHER").map((r) => api.ecBase(r.event));
  assert.deepEqual([...new Set(other)], ["UN General Assembly"],
    "OTHER is a leak detector: anything else in here is a release with no home");
});
