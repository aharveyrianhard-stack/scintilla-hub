/* M37 — THE COMPANY VERDICT READS THE LIVE ENGINE, NEVER THE FROZEN COMPOSITE.
   Measured against production on 2026-09-24T01:3xZ (read-only):
     · composite_staged tf=D carries 386 rows; the 364 equity rows all stamp 1787584061
       (2026-08-24 15:07Z) and only 22 non-equity rows are current;
     · the chart API artifact computed 2026-09-24T01:28:06.980Z under receipt f6cf97b57cf2
       gives AAPL composite 0.503084 / trend 0.791630 / momentum 0.214538 over 8 timeframes,
       against the frozen row's 0.304499 / 0.385274 / 0.223724.
   Those two sets of numbers are the fixtures below: the verdict must speak the first. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function block(re, what) {
  const m = page.match(re);
  assert.ok(m, "not found in index.html: " + what);
  return m[0];
}
const NOW = Date.parse("2026-09-24T01:34:00Z");
function api(meta) {
  const src =
    "const SC_CG = " + JSON.stringify({ meta }) + ";\n" +
    "const num = (x) => (x == null ? null : Number(x));\n" +
    block(/const sigWord = \(v\) =>\n[\s\S]*?negative"\);\n/, "sigWord") +
    block(/function readTsMs\(ts\) \{[\s\S]*?\n\}\n/, "readTsMs") +
    block(/function scLiveRead\(row\) \{[\s\S]*?\n\}\n/, "scLiveRead") +
    block(/function scReadStamp\(ts\) \{[\s\S]*?\n\}\n/, "scReadStamp") +
    block(/function liveReadSentence\(d, t\) \{[\s\S]*?\n\}\n/, "liveReadSentence") +
    "return { scLiveRead, liveReadSentence, scReadStamp };";
  return new Function(src)();
}
const META = { receipt: "f6cf97b57cf26a37e0f1", computed: "2026-09-24T01:28:06.980Z",
               current_equalizer_validated: true };
/* what the row looks like AFTER scApplyCandidateGeiger() has overlaid it — the board's own row */
const LIVE_AAPL = { composite: 0.503084, trend: 0.79163, momentum: 0.214538, tf_contributors: 8,
  updated_ts: "2026-09-24T01:28:06.980Z", sc_geiger_source: "CANDIDATE_PROVIDER_EQUALIZER",
  sc_geiger_state: "OK" };
/* the frozen legacy row the verdict used to be dated by */
const FROZEN_AAPL = { composite: 0.304499, trend: 0.385274, momentum: 0.223724, updated_ts: 1787584061 };
/* a declared equity the artifact could not price: scApplyCandidateGeiger blanks it */
const BLANKED = { composite: null, trend: null, momentum: null, tf_contributors: null,
  updated_ts: null, sc_geiger_source: null, sc_geiger_state: "PROVIDER_GEIGER_UNAVAILABLE" };
/* a non-equity the overlay leaves alone — composite_staged is its approved owner and IS current */
const NON_EQUITY = { composite: 0.61, trend: 0.4, momentum: 0.55, updated_ts: 1790213400 };

test("the verdict speaks the board's live numbers, not the month-old ones", () => {
  const { scLiveRead, liveReadSentence } = api(META);
  const live = scLiveRead(LIVE_AAPL);
  assert.equal(live.ok, true);
  assert.equal(live.state, "OK");
  assert.equal(live.g, 0.503084);
  assert.equal(live.tr, 0.79163);
  assert.equal(live.at, "2026-09-24T01:28:06.980Z", "dated by the artifact's own compute time");
  assert.equal(live.receipt, "f6cf97b57cf2", "the same receipt the board validated");
  assert.equal(live.rungs, 8);
  const s = liveReadSentence({ live }, "AAPL");
  assert.match(s, /multi-timeframe read is constructive/);
  assert.match(s, /Trend is strongly positive/, "0.79 is strongly positive; the frozen 0.385 would read clearly");
  assert.match(s, /board's own live numbers/);
  assert.match(s, /2026-09-24 01:28Z/);
  assert.match(s, /receipt f6cf97b57cf2/);
  assert.match(s, /across 8 timeframes/);
  assert.doesNotMatch(s, /2026-08-24/, "the frozen composite's date can never appear");
});

test("a frozen composite row cannot be mistaken for a live read", () => {
  const { scLiveRead } = api(META);
  /* the legacy row has no provider marking, so it is never reported as the live engine */
  assert.notEqual(scLiveRead(FROZEN_AAPL).state, "OK");
  assert.equal(scLiveRead(FROZEN_AAPL).g, null, "no legacy number is ever carried into the verdict");
});

test("no live number says so plainly and shows nothing", () => {
  const { scLiveRead, liveReadSentence } = api(META);
  const live = scLiveRead(BLANKED);
  assert.equal(live.ok, false);
  assert.equal(live.state, "UNAVAILABLE");
  assert.equal(live.g, null); assert.equal(live.tr, null); assert.equal(live.mo, null);
  assert.equal(live.at, null, "an absent reading has no date");
  const s = liveReadSentence({ live }, "PANW");
  assert.match(s, /There is no live multi-timeframe read for PANW/);
  assert.match(s, /deliberately not shown in its place/);
  assert.doesNotMatch(s, /constructive|heavy/, "an absent read is never called constructive");
  assert.doesNotMatch(s, /positive|negative/, "and never carries a direction word");
  assert.doesNotMatch(s, /\d\.\d\d/, "no number at all");
});

test("null is not zero: a missing reading never becomes a neutral one", () => {
  /* the defect this closes: `num(d0.composite) || 0` turned an absent provider value into 0,
     and 0 >= 0 printed "constructive" with "mildly positive" trend and momentum. */
  const { scLiveRead, liveReadSentence } = api(META);
  const s = liveReadSentence({ live: scLiveRead(BLANKED) }, "PANW");
  assert.doesNotMatch(s, /mildly positive/);
  assert.match(page, /const ok = provider && g != null && tr != null && mo != null;/);
});

test("a non-equity keeps its approved owner, and the sentence says which one", () => {
  const { scLiveRead, liveReadSentence } = api(META);
  const live = scLiveRead(NON_EQUITY);
  assert.equal(live.state, "LEGACY_NON_EQUITY");
  assert.equal(live.ok, false, "it is not the provider engine, so it is never labelled as one");
  assert.equal(live.at, 1790213400, "dated by that table's own write");
  const s = liveReadSentence({ live }, "BTCUSD");
  assert.match(s, /BTCUSD is not a declared equity/);
  assert.match(s, /legacy daily composite/);
});

test("the verdict and the board read the same object, so they cannot disagree", () => {
  /* the board's authority */
  assert.match(page, /if \(window\.SC_CLEAN_READS\) await scApplyCandidateGeiger\(gg\);/);
  /* the company payload applies the same overlay to its own row, and the verdict reads THAT row */
  const co = block(/if \(window\.SC_CLEAN_READS\) \{ const _g = \{ \[t\]: d0 \}; await scApplyCandidateGeiger\(_g\); \}\n  const liveRead = scLiveRead\(d0\);/, "company overlay → live read");
  assert.ok(co.indexOf("scApplyCandidateGeiger") < co.indexOf("scLiveRead"), "read after the overlay, never before");
  assert.match(page, /const d = \{ g: num\(d0\.composite\) \|\| 0[^\n]*live: liveRead \};/);
});

test("the READ pill and the narrative basis follow the same rule", () => {
  assert.match(page, /const pills = \["TREND " \+ \(live\.ok \? sigWord\(live\.tr\)\.toUpperCase\(\) : "NO LIVE READ"\)\];/);
  const basis = block(/const basis = rb\.basis \? String\(rb\.basis\)[\s\S]*?substituted";\n/, "narrative basis");
  assert.match(basis, /live read from the provider Equalizer artifact/);
  assert.match(basis, /receipt/);
  assert.doesNotMatch(basis, /legacy daily composite" \+ \(legacyNote/, "the frozen-composite basis line is gone");
  assert.match(basis, /not a declared equity: the legacy daily composite is this symbol's approved owner/);
});

test("nothing in the verdict path still reads composite_staged's date", () => {
  const buildRead = block(/function buildRead\(t, cx, d, price, fund, est, rb, rbAt\) \{[\s\S]*?\n\}\n/, "buildRead");
  assert.doesNotMatch(buildRead, /legacyAsOf/);
  assert.doesNotMatch(buildRead, /d\.asOf/, "the verdict no longer quotes the legacy row's stamp");
  assert.doesNotMatch(buildRead, /\+ " Composite basis "/, "the tail that quoted it is not emitted (the note explaining its removal stays)");
});
