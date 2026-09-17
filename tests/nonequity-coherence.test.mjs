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
