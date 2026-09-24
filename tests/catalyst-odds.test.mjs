/* M44-REGIME — the catalyst collector's resolution rules.
   Both cases below are mistakes I made by hand against the live venues on 24 Sep before the
   function was written: a bare search for "cpi" returned BRAZIL's inflation market, and a bare
   search for "senate midterms" returned the HOUSE event. They are pinned here so the collector
   cannot quietly store the wrong market under the right name. No network: the payloads are the
   shapes both venues actually returned. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";

const ts = fs.readFileSync(new URL("../supabase/functions/catalyst-odds/index.ts", import.meta.url), "utf8");
const pure = ts.slice(ts.indexOf("export type Spec"), ts.indexOf("async function j("));
const js = stripTypeScriptTypes(pure.replace(/^export /gm, ""));
const ctx = { console, Math, Date, Number, JSON, String, isFinite };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(js, ctx);
const { SPECS, eventMatches, pickEvent, rowsFromPolymarket, rowsFromKalshi } =
  vm.runInContext("({SPECS,eventMatches,pickEvent,rowsFromPolymarket,rowsFromKalshi})", ctx);
const NOW = new Date("2026-09-24T01:40:00Z");

test("all six catalysts Alan named are covered", () => {
  /* SPECS is built inside the vm, so its Array comes from another realm: compare the values,
     not the prototypes. */
  assert.equal(JSON.stringify(SPECS.map((s) => s.catalyst).sort()),
    JSON.stringify(["cpi", "fomc", "midterms_house", "midterms_senate", "recession", "shutdown"]));
  for (const s of SPECS) assert.ok(s.slug || s.search, s.catalyst + " needs a way to be found");
});

test("the CPI spec refuses Brazil's inflation market", () => {
  const brazil = { title: "Brazil's Annual Inflation in 2026", slug: "brazil-inflation-2026", volume: 9e6, endDate: "2027-01-01T00:00:00Z" };
  const us = { title: "U.S. inflation in 2026", slug: "us-inflation-2026", volume: 1e5, endDate: "2027-01-01T00:00:00Z" };
  const spec = SPECS.find((s) => s.catalyst === "cpi");
  assert.equal(eventMatches(brazil, spec.require), false);
  assert.equal(pickEvent([brazil, us], spec.require, NOW), us, "the smaller US market beats the bigger Brazilian one");
});

test("the Senate spec refuses the House event", () => {
  const house = { title: "Which party will win the House in 2026?", slug: "which-party-will-win-the-house-in-2026", volume: 12e6, endDate: "2026-11-05T00:00:00Z" };
  const senate = { title: "Which party will win the Senate in 2026?", slug: "which-party-will-win-the-senate-in-2026", volume: 5e6, endDate: "2026-11-05T00:00:00Z" };
  const spec = SPECS.find((s) => s.catalyst === "midterms_senate");
  assert.equal(pickEvent([house, senate], spec.require, NOW), senate);
});

test("a closed or already-resolved market is never stored as a live probability", () => {
  const done = { title: "US recession", slug: "us-recession-2025", volume: 9e6, endDate: "2026-01-01T00:00:00Z" };
  const open = { title: "US recession by end of 2026", slug: "us-recession-2026", volume: 1e6, endDate: "2027-01-01T00:00:00Z" };
  const shut = { title: "US recession", slug: "x", volume: 9e9, endDate: "2027-01-01T00:00:00Z", closed: true };
  assert.equal(pickEvent([done, shut, open], "us ", NOW), open);
  assert.equal(pickEvent([done, shut], "us ", NOW), null);
});

test("Polymarket: outcomes and prices are JSON strings, and the NO leg is not stored twice", () => {
  const ev = { slug: "e", title: "T", endDate: "2026-11-05T00:00:00Z", markets: [
    { slug: "dem-house", question: "Will the Democratic Party control the House?", outcomes: '["Yes", "No"]',
      outcomePrices: '["0.925", "0.075"]', volumeNum: 7053332.5, endDate: "2026-11-05T00:00:00Z" },
    { slug: "closed-one", question: "gone", outcomes: '["Yes","No"]', outcomePrices: '["0.5","0.5"]', closed: true } ] };
  const rows = rowsFromPolymarket(ev, "midterms_house", "run1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].probability, 0.925);
  assert.equal(rows[0].outcome, "Yes");
  assert.equal(rows[0].source, "polymarket");
  assert.equal(rows[0].run_id, "run1");
});

test("Polymarket: a three-way market keeps every leg", () => {
  const ev = { slug: "e", endDate: "2026-12-01T00:00:00Z", markets: [
    { slug: "m", question: "q", outcomes: '["A","B","C"]', outcomePrices: '["0.2","0.3","0.5"]' } ] };
  assert.equal(rowsFromPolymarket(ev, "fomc", "r").length, 3);
});

test("Kalshi: prices are dollar strings, and an unquoted market has no price to store", () => {
  const ms = [
    { ticker: "KXFED-A", title: "hold", last_price_dollars: "0.3400", open_interest_fp: "100", close_time: "2026-10-29T18:00:00Z", yes_sub_title: "Fed maintains" },
    { ticker: "KXFED-B", title: "hike", yes_bid_dollars: "0.6400", yes_ask_dollars: "0.6800", open_interest_fp: "900", close_time: "2026-10-29T18:00:00Z", yes_sub_title: "Hike 25bps" },
    { ticker: "KXFED-C", title: "no market", open_interest_fp: "5000" } ];
  const rows = rowsFromKalshi(ms, "fomc", "r");
  assert.equal(rows.length, 2, "the unquoted market is dropped, not stored at zero");
  assert.equal(rows[0].market, "KXFED-B", "the deepest market comes first");
  assert.equal(rows[0].probability, 0.66, "bid/ask midpoint when nothing has traded");
  assert.equal(rows[1].probability, 0.34);
  assert.equal(rows[0].outcome, "Hike 25bps");
});

test("Kalshi: a price that is not a probability is refused", () => {
  assert.equal(rowsFromKalshi([{ ticker: "X", last_price_dollars: "34" }], "fomc", "r").length, 0);
});
