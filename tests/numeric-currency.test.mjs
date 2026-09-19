// numeric-currency (2026-09-19): NT-2 screen step. The page asks for fundamentals.reported_currency through pgFund(), which falls
// back to production's exact select on a 400 (column not migrated yet). A served currency decides WHICH currency the EPS is in;
// it converts nothing and never unlocks a cross-currency or ADR multiple. EXAMPLE fixtures only; nothing here is a live check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name + " present");
  return page.slice(s, page.indexOf("\n}\n", s) + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0]; };
const CCY = line(/^const EST_CCY_MEASURED = [^\n]*\n/m) + line(/^const EST_CCY = [^\n]*\n/m) + line(/^let FUND_CCY_COL = [^\n]*\n/m) +
  fn("ccyCode") + fn("estCcy") + fn("estNonUsd") + fn("fundPath") + fn("pgFund") + fn("noteServedCcy");
// pg stub: records every path; answers like PostgREST (400 when a select names a column the table lacks)
function api(hasColumn, fail) {
  const calls = [], tried = [];
  const pg = async (path, tries) => { calls.push(path); tried.push(tries);
    if (fail) throw new Error("pg " + path + " → " + fail);
    if (!hasColumn && /reported_currency/.test(path)) throw new Error("pg " + path + " → 400");
    return [{ ticker: "AAPL", eps_ttm: 8.27, ...(hasColumn ? { reported_currency: "USD" } : {}) }]; };
  const o = new Function("pg", CCY + "return { pgFund, fundPath, noteServedCcy, estCcy, estNonUsd, EST_CCY, get col() { return FUND_CCY_COL; } };")(pg);
  return Object.assign(o, { calls, tried });
}

test("pre-migration: a 400 re-asks production's exact select once, then the column is never asked for again", async () => {
  const a = api(false);
  const rows = await a.pgFund("ticker,eps_ttm");
  assert.deepEqual(a.calls, ["fundamentals?select=ticker,eps_ttm,reported_currency", "fundamentals?select=ticker,eps_ttm"]);
  assert.equal(a.tried[0], 1, "the with-column attempt is ONE try (pg would retry a 400 three times)");
  assert.equal(rows.length, 1, "the board still gets its fundamentals");
  assert.equal(a.col, false);
  await a.pgFund("trailing_pe,eps_ttm,revenue_ttm,market_cap", "ticker=eq.AAPL");
  assert.equal(a.calls[2], "fundamentals?ticker=eq.AAPL&select=trailing_pe,eps_ttm,revenue_ttm,market_cap", "company read = production's string, 1 request");
  assert.equal(a.calls.length, 3);
});

test("the fallback strings are byte-identical to the reads 8de19eb makes today", () => {
  const a = api(true);
  assert.equal(a.fundPath("ticker,eps_ttm"), "fundamentals?select=ticker,eps_ttm");
  assert.equal(a.fundPath("trailing_pe,eps_ttm,revenue_ttm,market_cap", "ticker=eq." + "MSFT"), "fundamentals?ticker=eq.MSFT&select=trailing_pe,eps_ttm,revenue_ttm,market_cap");
});

test("post-migration: one request with the column; a non-400 failure is NOT mistaken for a missing column", async () => {
  const a = api(true);
  const rows = await a.pgFund("ticker,eps_ttm");
  assert.deepEqual(a.calls, ["fundamentals?select=ticker,eps_ttm,reported_currency"]); assert.equal(rows[0].reported_currency, "USD"); assert.equal(a.col, true);
  const b = api(true, 503);
  await assert.rejects(b.pgFund("ticker,eps_ttm"), /→ 503/); assert.equal(b.col, true, "a busy database does not switch the column off");
  assert.deepEqual(b.calls, ["fundamentals?select=ticker,eps_ttm,reported_currency", "fundamentals?select=ticker,eps_ttm,reported_currency"], "busy: one quick try, then pg's usual retries with the column");
  assert.deepEqual(b.tried, [1, undefined]);
});

test("served currencies: valid codes are kept (normalised), malformed or missing ones are ignored", () => {
  const a = api(true);
  a.noteServedCcy([{ ticker: "tsm", reported_currency: "TWD" }, { ticker: "BABA", reported_currency: " cny " }, { ticker: "AAPL", reported_currency: "USD" },
    { ticker: "XX1", reported_currency: "US Dollar" }, { ticker: "XX2", reported_currency: "" }, { ticker: "XX3", reported_currency: null }, { ticker: "XX4" },
    { reported_currency: "EUR" }, null]);
  assert.deepEqual({ ...a.EST_CCY }, { TSM: "TWD", BABA: "CNY", AAPL: "USD" });
  assert.equal(a.noteServedCcy("not an array"), "not an array");
});

test("precedence: a served value outranks the measured set; with none served the measured fallback remains; unknown stays unknown", () => {
  const a = api(true);
  assert.equal(a.estCcy("ASML"), "EUR", "measured fallback while nothing is served");
  a.noteServedCcy([{ ticker: "ASML", reported_currency: "USD" }, { ticker: "OKLO", reported_currency: "USD" }]);
  assert.equal(a.estCcy("ASML"), "USD", "served wins over the measured guess");
  assert.equal(a.estNonUsd("ASML"), false);
  assert.equal(a.estCcy("ZZZZ"), null, "no served value and not measured: no guessed currency");
});

test("comparison guards are preserved: a served non-USD currency (incl. an ADR) still withholds every multiple; nothing converts", () => {
  const a = api(true);
  a.noteServedCcy([{ ticker: "TSM", reported_currency: "TWD" }, { ticker: "CCJ", reported_currency: "CAD" }]);
  for (const t of ["TSM", "CCJ"]) assert.equal(a.estNonUsd(t), true, t + " stays non-comparable");
  // no FX table, no ADS/ADR share-unit ratio and no conversion helper exists anywhere in the page
  assert.doesNotMatch(page, /\b(fx_?rate|FX_RATES?|usdPer|toUsd|ads_?ratio|adsRatio|ADR_RATIO)\b/i);
  // the served column only ever feeds the currency code; shares are never derived from market cap / price
  assert.doesNotMatch(page, /market_cap\s*\/\s*[a-z_.]*price|mc\s*\/\s*px/i);
});
