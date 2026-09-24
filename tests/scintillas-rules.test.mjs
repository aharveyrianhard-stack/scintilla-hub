/* M48 — RULES ALAN CAN DEFEND AND CHANGE.
   Alan, 24 Sep: "these are relative, pretty high percentages. But like raw, something above X
   percent on equities, above X percent on indexes … it depends on really what kind of good rules
   for scintillation would be nice. Statistical analysis based rules."
   Two families in ONE versioned file: the move against the name's own usual day, and a plain
   percentage floor, each with its own numbers per asset class. What is pinned here: the file is
   whole and says why; the detector and the Hub read the SAME file; either family can fire alone;
   a tiny move on a dead-flat name cannot; and changing a threshold is changing one number. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assetClassOf, priceRuleFor, priceVerdict, detectPriceOutliers } from "../scripts/scintillas-detect.mjs";
import { RULES as SHIPPED, RULES_VERSION } from "../supabase/functions/scintillas-detect/rules.mjs";

const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/index.ts", import.meta.url), "utf8");
const CLASSES = ["equity", "index_etf", "sector_etf", "crypto", "futures"];

test("one file, both readers: the edge function's copy is the file, and the Hub fetches the same path", () => {
  assert.deepEqual(SHIPPED, RULES, "run scripts/build-scintilla-rules.mjs — the copy has drifted");
  assert.equal(RULES_VERSION, RULES.version);
  assert.match(page, /SCINT_RULES_URL = "\/data\/scintilla-rules\.json"/, "the Hub reads the same file");
  assert.match(fn, /import \{ RULES \} from "\.\/rules\.mjs"/, "the detector's function reads the generated copy");
  assert.match(fn, /rules: RULES/, "and passes it to the price detector rather than a number in the code");
});

test("every asset class Alan named carries both families, and says why", () => {
  for (const cls of CLASSES) {
    const p = RULES.price[cls];
    assert.ok(p, cls + " has a rule");
    assert.ok(p.x_usual > 0, cls + " has a statistical bar");
    assert.ok(p.raw_move_pct > 0, cls + " has a raw floor");
    assert.ok(p.x_usual_needs_move_pct >= 0, cls + " states the smallest move the statistical rule will accept");
    for (const k of ["why_x_usual", "why_raw", "why_needs_move"])
      assert.ok(String(p[k] || "").length > 20, cls + " explains " + k + " in a line");
  }
  assert.equal(RULES.usual_day.sessions, 60);
  assert.ok(RULES.usual_day.min_sessions >= 20, "too little history means no claim at all");
});

test("a symbol lands in the class the file says, and anything unnamed is a single company", () => {
  assert.equal(assetClassOf("SPY", RULES), "index_etf");
  assert.equal(assetClassOf("XLF", RULES), "sector_etf");
  assert.equal(assetClassOf("BTCUSD", RULES), "crypto");
  assert.equal(assetClassOf("CLUSD", RULES), "futures");
  assert.equal(assetClassOf("NVDA", RULES), "equity");
  assert.equal(assetClassOf("SOMETHINGNEW", RULES), "equity");
});

test("STATISTICAL: 2× its own usual day is a scintilla for a single name; 1.9× is not", () => {
  const rule = priceRuleFor("NVDA", RULES);
  assert.equal(priceVerdict(4.0, 2.0, rule).fired.join(), "statistical", "4% against a 2% usual day");
  assert.equal(priceVerdict(3.8, 2.0, rule).hit, false, "1.9× is under the bar and stays quiet");
  assert.equal(priceVerdict(-4.4, 2.0, rule).fired.join(), "statistical", "a fall counts the same as a rise");
});

test("RAW: a big move on a wild name counts even when its own history shrugs", () => {
  const rule = priceRuleFor("NVDA", RULES);
  const v = priceVerdict(9.0, 6.0, rule);           // only 1.5× usual for a very volatile name
  assert.deepEqual(v.fired, ["raw"], "the raw floor is what caught it");
  assert.ok(Math.abs(v.x) < rule.x_usual, "and the statistical rule did not");
});

test("A TINY MOVE ON A DEAD-FLAT NAME IS NOT A POINTER, however unusual it looks", () => {
  const rule = priceRuleFor("KO", RULES);
  const v = priceVerdict(0.4, 0.1, rule);           // four times its usual day — and worth nothing
  assert.equal(v.hit, false, "under the smallest move the rule accepts, nothing is claimed");
  assert.ok(Math.abs(v.x) > rule.x_usual, "even though the multiple alone would have passed");
});

test("an index fund is judged by the index's numbers, not a single company's", () => {
  const idx = priceRuleFor("SPY", RULES), eq = priceRuleFor("NVDA", RULES);
  assert.ok(idx.raw_move_pct < eq.raw_move_pct, "a whole market needs a smaller raw move to matter");
  assert.ok(idx.x_usual > eq.x_usual, "and a bigger multiple, because an index wanders inside its own band");
  assert.equal(priceVerdict(3.0, 2.0, idx).hit, true, "a 3% day is a market event even when the fund is jumpy");
  assert.equal(priceVerdict(3.0, 2.0, eq).hit, false, "the same 3% on a single jumpy name is an ordinary day");
  assert.equal(priceVerdict(2.2, 1.0, eq).hit, true, "2.2x its usual day marks a single name");
  assert.equal(priceVerdict(2.2, 1.0, idx).hit, false, "and leaves a whole market alone");
});

test("changing a threshold is changing one number — the detector reads the file, not itself", () => {
  const quotes = [{ symbol: "AAPL", price: 103, prev_close: 100 }];
  const historyBySymbol = { AAPL: Array.from({ length: 40 }, (_, i) => ({ c: 100 + (i % 2 ? 1 : -1) })) };
  const base = { quotes, historyBySymbol, session: "2026-09-24", ts: "2026-09-24T20:05:00Z" };
  const loud = JSON.parse(JSON.stringify(RULES));
  loud.price.equity.raw_move_pct = 2;               // one number
  assert.equal(detectPriceOutliers({ ...base, rules: loud }).events.length, 1);
  const quiet = JSON.parse(JSON.stringify(RULES));
  quiet.price.equity.raw_move_pct = 99;
  quiet.price.equity.x_usual = 99;
  assert.equal(detectPriceOutliers({ ...base, rules: quiet }).events.length, 0);
});

test("a stored row carries the rule that made it, in words, so it can be argued with", () => {
  const quotes = [{ symbol: "BYND", price: 87.84, prev_close: 100 }];
  const historyBySymbol = { BYND: Array.from({ length: 61 }, (_, i) => ({ c: 100 * (1 + Math.sin(i) * 0.05) })) };
  const { events } = detectPriceOutliers({ quotes, historyBySymbol, session: "2026-09-23",
    ts: "2026-09-23T20:05:00Z", rules: RULES });
  assert.equal(events.length, 1);
  const d = events[0].detail;
  assert.equal(d.asset_class, "equity");
  assert.equal(d.rules_version, RULES.version);
  assert.ok(d.fired.length >= 1);
  assert.ok(d.x_usual > 0 && d.daily_vol_pct > 0 && d.n_days >= 20);
  assert.match(d.rule, /its usual day|raw move/, "the rule is stated in the words the strip uses");
  assert.ok(!/σ/.test(d.rule), "no Greek letter, even in the stored reason");
});

test("with no rules passed the detector behaves exactly as it did before this file existed", () => {
  const quotes = [{ symbol: "AAPL", price: 105, prev_close: 100 }];   /* ±2% history, so 5% is about 2.5x */
  const historyBySymbol = { AAPL: Array.from({ length: 40 }, (_, i) => ({ c: 100 + (i % 2 ? 1 : -1) })) };
  const { events } = detectPriceOutliers({ quotes, historyBySymbol, session: "2026-09-24", ts: "2026-09-24T20:05:00Z" });
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.rules_version, null);
  assert.equal(events[0].detail.asset_class, "equity");
});

test("the intraday prefilter can never sit above the lowest bar a rule can fire on", () => {
  assert.match(fn, /const PREFILTER_PCT = Math\.min\(0\.5, \.\.\.Object\.values\(RULES\.price/,
    "the prefilter is derived from the file, not typed next to it");
  const lowest = Math.min(...CLASSES.map((c) => RULES.price[c].x_usual_needs_move_pct));
  assert.ok(lowest >= 0, "and the file's own lowest acceptance is " + lowest + "%");
});

test("the counts behind the defaults were measured, and the file says so", () => {
  assert.ok(RULES.measured, "the file records the measurement");
  assert.equal(RULES.measured.when, "2026-09-24");
  assert.match(RULES.measured.how, /scripts\/scintilla-rule-counts\.mjs/);
  for (const k of ["statistical", "raw", "either"]) assert.ok(RULES.measured.per_day_on_that_sample[k] > 0);
  assert.ok(fs.existsSync(new URL("../scripts/scintilla-rule-counts.mjs", import.meta.url)),
    "and the script that produced them is in the repo, so it can be re-run");
});
