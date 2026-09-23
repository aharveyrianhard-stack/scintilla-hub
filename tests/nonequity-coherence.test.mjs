/* Retained non-equity quotes must not paint an invented day change on the Hub board, company view
   or tape. Runs the real helper extracted from index.html. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const helper = html.match(/function scCoherentRetainedQuotes\(rows\) \{[\s\S]*?\n\}\n/)?.[0];
assert.ok(helper, "scCoherentRetainedQuotes must stay statically extractable");
const num = (x) => (x == null ? null : Number(x));
const scCoherentRetainedQuotes = new Function("num", helper + "return scCoherentRetainedQuotes;")(num);

test("an incoherent retained previous close is withheld; coherent and empty rows pass through", () => {
  const [cl, btc, us10y, es] = scCoherentRetainedQuotes([
    { ticker:"CLUSD", price:102.4, change:2.05, chg_pct:1.03, prev_close:81.25 },
    { ticker:"BTCUSD", price:76352.995, change:1118.022, chg_pct:0.27, prev_close:76144.99 },
    { ticker:"US10Y", price:4.695, change:null, chg_pct:null, prev_close:null },
    { ticker:"ESUSD", price:7667.25, change:60, chg_pct:-0.19, prev_close:7822.5 },
  ]);
  assert.deepEqual([cl.prev_close, cl.chg_pct, cl.change, cl.price], [null, null, null, 102.4]);
  assert.equal(cl.prev_close_withheld, "RETAINED_PREV_CLOSE_INCOHERENT");
  assert.equal(btc.prev_close, 76144.99);
  assert.equal(btc.chg_pct, 0.27);
  assert.equal(us10y.prev_close_withheld, undefined);
  assert.equal(es.chg_pct, null, "ESUSD's stored -0.19% contradicts its own -1.98% and is withheld");
});

test("every live_quotes read that carries a day change passes through the coherence helper", () => {
  const reads = (html.match(/pg\("live_quotes\?[^)]*\)[^,\n]*/g) || []).filter((r) => /chg_pct|prev_close/.test(r));
  assert.equal(reads.length, 3);
  for (const read of reads) assert.match(read, /\.then\(scCoherentRetainedQuotes\)/, read);
});

test("the tape leaves an unknown day change off instead of painting 0.00%", () => {
  const tape = html.match(/async function fetchTapeItems\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(tape, /\|\| 0 \}/);
  assert.match(tape, /\.filter\(\(q\) => q\.pct != null\)/);
});

test("a stored quote older than four days is dropped, so the row shows NO FEED instead of an old number (23 Sep)", () => {
  const now = Date.now();
  const rows = scCoherentRetainedQuotes([
    { ticker:"VIX", price:14.25, change:-1.74, chg_pct:-10.88, prev_close:15.99, updated_ts:"2026-08-14T23:33:50.414Z" },
    { ticker:"US10Y", price:4.695, change:null, chg_pct:null, prev_close:null, updated_ts:new Date(now - 3 * 86400e3).toISOString() },
  ]);
  assert.deepEqual(rows.map((r) => r.ticker), ["US10Y"], "August's VIX row is gone; a three-day-old row (a weekend) stays");
  assert.match(html, /live_quotes\?select=ticker,price,change,chg_pct,prev_close,updated_ts/, "the reads carry the row's age");
  assert.match(html, /const SC_MACRO_SYMS = \["VIX", "US10Y", "US5Y", "US30Y", "US3M", "DXY", "DXUSD", "CLUSD", "GCUSD", "SIUSD"\];/);
  /* M19 §B — the same URL, now through scJSONOnce so two callers asking at the same moment
     share one request. The assertion keeps its intent: the macro rows read the chart API. */
  assert.match(html, /(fetch|scJSONOnce)\(SC_CHART_API \+ "\/macro\?symbols=" \+ encodeURIComponent\(SC_MACRO_SYMS\.join\(","\)\)\)/, "the macro rows take the chart API's live quote");
});

test("the 12-second stored-price poll and the realtime channel never overwrite the live macro quote (23 Sep: VIX reverted to 14.25)", () => {
  assert.match(html, /pg\("live_quotes\?ticker=in\.\(" \+ batch \+ "\)&select=ticker,price,updated_ts"\)/);
  assert.match(html, /for \(const qq of scCoherentRetainedQuotes\(j\)\)\n\s+if \(qq && qq\.ticker && qq\.price != null && !scMacroOwned\(qq\.ticker\)\) patch\(/);
  assert.match(html, /!cryptoSet\.has\(p\.new\.ticker\) && !scMacroOwned\(p\.new\.ticker\)\) patch\(p\.new\.ticker, p\.new\.price, "LEGACY"\)/);
  assert.match(html, /function scMacroOwned\(t\) \{ return SC_MACRO_SYMS\.includes\(String\(t \|\| ""\)\.toUpperCase\(\)\); \}/);
});

test("the tape asks the provider for its own symbols, so an aged-out stored row cannot empty MACRO (23 Sep)", () => {
  assert.match(html, /if \(window\.SC_CLEAN_READS\) await scApplyProviderQuotes\(_tix, \[\.\.\.new Set\(\[\.\.\.Object\.keys\(_tix\), \.\.\.MACRO_SET, \.\.\.inComp\]\)\]\);/);
  assert.match(html, /const all = Object\.values\(_tix\)\.filter\(\(q\) => q\.price != null && inComp\.has\(q\.ticker\)\)/);
});
