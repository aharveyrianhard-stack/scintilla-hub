/* M62 — the allocation rebuild: one combined screener, the rails the template carries,
   evidence first and the conclusion last. These read the page's own source, the same way the
   other allocation tests do, because the page computes everything in the browser. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "allocation", "index.html"), "utf8");
const js = page.slice(page.indexOf("<script>"), page.lastIndexOf("</script>"));

test("the screener carries one column per method, and every header re-ranks", () => {
  for (const [k, t] of [["g","GEIGER"],["mom","MOMENTUM"],["val","VALUE"],["qual","QUALITY"],
                        ["pull","PULLBACK"],["over","OVERSOLD"],["sig","USUAL DAY"],["earn","EARNINGS"]]) {
    assert.ok(js.includes(`k:"${k}"`), "missing column " + k);
    assert.ok(js.includes(`t:"${t}"`), "missing header " + t);
  }
  assert.ok(js.includes('data-sort="'), "headers must carry a sort key");
  assert.ok(js.includes('th[data-sort]'), "a click on a header must re-rank");
});

test("every weight and rule is a toggle with a baseline beside it", () => {
  const ids = ["wGeiger","wMom","wValue","wQual","wPull","wOver","wSigma","wEarn","scrRows",
    "rateOn","rate10Hi","rateDrag","finLift","slopeFloor","slopeCut","hikeCut",
    "pcOn","pcHi","pcLo","pcLift","pcCash","ernOn","ernCut","sigMult","cancelPct","planScore",
    "leadAbove200","basketN"];
  const base = js.slice(js.indexOf("const BASE = {"), js.indexOf("const T = Object.assign"));
  for (const id of ids) {
    assert.ok(new RegExp("\\b" + id + ":").test(base), id + " must have a baseline in BASE");
    assert.ok(js.includes(`id:"${id}"`), id + " must be a knob on the page");
  }
  assert.ok(js.includes("const b = BASE[k.id];") && js.includes('class="base">baseline '),
    "every knob must print its baseline beside the setting");
});

test("the named presets are the ones Alan asked for", () => {
  assert.ok(js.includes('t:"PULLBACK LEADERS"'), "pullback leaders");
  assert.ok(js.includes('t:"MOST OVERSOLD"'), "most oversold");
  assert.ok(js.includes('t:"QUALITY ON SALE"'), "quality on sale");
  assert.ok(js.includes("VIEWS_KEY") && js.includes("viewsSave"), "saved views");
  assert.ok(js.includes('data-f="sector"') && js.includes('data-f="cohort"') && js.includes('data-f="favOnly"'),
    "filters for sector, cohort and favourites");
});

test("the template reads the rails it claims to use, each from its own store", () => {
  assert.ok(js.includes('pg("treasury_rates?select=*'), "the whole treasury curve");
  assert.ok(js.includes("series=eq.federalFunds"), "the Fed's own rate");
  assert.ok(js.includes('["PCC","PCCE","PCCI"]'), "put/call, with its parts");
  assert.ok(js.includes("indicator=in.(sma,rsi,williams,adx,standarddeviation)"),
    "the published table must carry Williams, ADX and the 20-day sigma too");
  assert.ok(js.includes('api("/candles?symbol=" + s + "&tf=1d&limit=260")'), "put/call comes through the chart API");
});

test("a rule states its number and is applied where it is stated", () => {
  assert.ok(js.includes("function ruleEffect"), "the per-row rules");
  assert.ok(js.includes("function railEffectOnCash"), "the rules that move how much to own");
  assert.ok(js.includes("m.investedNoRails"), "the page must keep what the number was before the rails moved it");
  assert.ok(/rate10Hi/.test(js) && /finLift/.test(js) && /net interest margin/i.test(js),
    "the rates rule must say what it does to growth and to financials");
});

test("evidence comes first and the conclusion sits last", () => {
  const state = page.indexOf('id="STATE"');
  const screen = page.indexOf('id="SCREEN"');
  const said = page.indexOf('id="SAIDL"');
  assert.ok(state > 0 && screen > state, "the six lines, then the screener");
  assert.ok(said > screen, "the conclusion must come after the screener");
  assert.ok(js.includes("function drawCites"), "and it must cite the rows it rests on");
  assert.ok(js.includes("rests on: "), "each sentence names its evidence");
});

test("the staged plan is Alan's list, and it is never called a buy", () => {
  assert.ok(js.includes('const WATCH = ["AVGO","GOOGL","NVDA","VST","WMT","BAC","AMZN","NBIS","MU","SNDK","GEV","BE"]'),
    "the watch list is Alan's own twelve");
  assert.ok(/what your rules say, not a recommendation to buy/i.test(js), "it must be labelled as rules, not advice");
  assert.ok(!/\bBUY\b/.test(js.replace(/buying the move/g, "")), "the word BUY must not be presented as an instruction");
});

test("the dead price table is gone, and the page says why", () => {
  assert.ok(!/pg(All)?\("live_quotes/.test(js), "nothing may read live_quotes");
  assert.ok(js.includes("live_quotes (the table)") && js.includes("REMOVED"),
    "the audit must name it as removed, with the reason");
  assert.ok(js.includes("function drawAudit"), "the wiring audit itself");
});
