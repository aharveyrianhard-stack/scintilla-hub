/* REPORT tab on the company pages (28 Nov 2026).
   Alan: "into the companies, like when you click on the ticker, they're like ticker specific pages".
   The AI Chain report's view of one company, shown after ESTIMATES only where the report covers the name.
   Offline: functions are sliced out of the page by name and run with stubs; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const data = JSON.parse(fs.readFileSync(new URL("../reports/ai-chain-visual/data.json", import.meta.url), "utf8"));
function fn(name) {
  const start = page.search(new RegExp("^function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const CO_TABS = JSON.parse(page.match(/^const CO_TABS = (\[[^\]]*\]);/m)[1]);

test("the ten tabs and their keys are untouched; REPORT is not a remembered landing tab", () => {
  assert.deepEqual(CO_TABS, ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"]);
  assert.match(fn("coTabOk"), /CO_TABS\.indexOf\(x\) >= 0/, "coTabOk still only knows the ten");
});

test("REPORT rides after ESTIMATES only where the report covers the name (or while it is open)", () => {
  const run = (covered, open) => new Function("CO_TABS", "S", "aichFor", fn("coTabsList") + "\nreturn coTabsList;")(
    CO_TABS, { coTab: open ? "REPORT" : "GEIGER" }, (t) => (covered && t === "MU" ? {} : null));
  assert.deepEqual(run(true, false)("MU"), ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "REPORT", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"]);
  assert.deepEqual(run(false, false)("WMT"), CO_TABS, "an uncovered name's page is unchanged");
  assert.deepEqual(run(false, true)("WMT"), ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "REPORT", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"], "the open tab stays visible");
});

test("cvTabsHTML keeps the ten tabs' markup and keys, and gives REPORT no key", () => {
  const S = { coTab: "REPORT" };
  const html = new Function("S", "CO_TABS", "coTabLabel", "coTabsList", "LEFT_T", fn("cvTabsHTML") + "\nreturn cvTabsHTML;")(
    S, CO_TABS, (x) => (x === "EVENTS" ? "EARNINGS" : x), () => ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "REPORT", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"], "MU")();
  assert.deepEqual([...html.matchAll(/title="key (\d)"/g)].map((m) => +m[1]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  assert.match(html, /class="cv-tabs has-aich"/, "the row may wrap there");
  assert.match(html, /class="cv-tab on" aria-selected="true" data-act="cotab" data-tab="REPORT" title="the AI Chain report on this company">REPORT<\/button>/);
});

test("the tab's content comes from coTabHTML, and the data file covers the Hub names the report follows", () => {
  assert.match(fn("coTabHTML"), /case "REPORT":\s+return aichTabHTML\(data\.t\);/);
  for (const t of ["MU", "SNDK", "NVDA", "AMD", "AVGO", "MSFT", "GOOGL", "AMZN", "META", "ORCL", "CRWV", "NBIS", "AAPL", "QCOM", "INTC"]) assert.ok(data.by_ticker[t], t);
  assert.ok(!data.by_ticker.WMT, "WMT is not in the report");
  assert.ok(data.by_ticker.MU.events.length >= 4 && data.by_ticker.MU.margin && data.by_ticker.MU.says.length, "Micron has marks, a margin and lines");
  assert.equal(page.match(/const AICH_URL = "([^"]+)"/)[1], "/reports/ai-chain-visual/data.json");
});

test("its CSS is greys only (channels within 24, none above 210) with text 11 px and up, like the rest of the company view", () => {
  const a = page.indexOf("/* REPORT tab (28 Nov 2026, Alan:"), b = page.indexOf(".aich-links{", a);
  assert.ok(a > 0 && b > a);
  const css = page.slice(a, page.indexOf("}", b) + 1).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 24 && Math.max(r, g, bl) <= 210, hex + " is a grey");
  }
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, "font " + m[0]);
});
