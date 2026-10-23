/* CW6 (22 Oct · deliverables/20261022/cw6-comps-tab): the COMPS tab runs the CW3 method for any name. The engine on the
   store's own answers (the files the browser reads) gives the check's numbers; the band, the loss-maker rule, the sets,
   the wiring, and the browser's promises (no FMP call, no write). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { company, readName, fxRates, cycleLine, verdictWords, RULES, BAND_DEFAULT, median } from "../deliverables/20261022/cw6-comps-tab/engine.mjs";

const here = (p) => new URL(p, import.meta.url);
const D = "../deliverables/20261022/cw6-comps-tab/";
const J = (p) => JSON.parse(readFileSync(here(D + p), "utf8"));
const sets = J("sets.json"), cycle = J("cycle.json"), check = J("CHECK.json"), idx = J("store/_index.json");
const rates = fxRates(J("store/_fx.json")), TODAY = idx.fetch_utc_first.slice(0, 10), fin = new Set(sets.financial);
const store = (t) => J(`store/${t}.json`).answers;
function run(t, band) {
  const n = sets.names[t], rules = RULES[n.set] || RULES.CW3, mk = (x) => company(x, store(x), { today: TODAY, rates, financial: fin.has(x), rules });
  return readName(mk(t), n.peers.map((p) => ({ t: p.t, why: p.why, c: mk(p.t) })), { rules, band, today: TODAY, answers: store(t) });
}

test("median is statistics.median (the mean of the two middle values)", () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null);
});

test("the check: the engine reproduced CW3's 23 midpoints exactly, and the tab's numbers are the engine on the store", () => {
  assert.equal(check.rows.length, 23);
  assert.ok(check.identity_max_abs_pct < 1e-6, "engine identity on CW3's raw answers: " + check.identity_max_abs_pct);
  for (const r of check.rows) {
    const R = run(r.ticker, null);
    assert.ok(Math.abs(R.midpoint / r.tab_today - 1) < 1e-9, `${r.ticker}: ${R.midpoint} vs ${r.tab_today}`);
    if (!r.within_1pct) assert.ok(r.why.length > 0, r.ticker + " is over 1% and must say why");
  }
});

test("the ±10× band applies to every set: NVDA keeps three peers and is thin; nothing is struck with the band off", () => {
  const on = run("NVDA", BAND_DEFAULT), off = run("NVDA", null);
  assert.deepEqual(on.struck.map((s) => s.t).sort(), ["ARM", "INTC", "MRVL", "QCOM"]);
  assert.equal(on.thin, true); assert.equal(off.struck.length, 0); assert.equal(off.thin, false);
  assert.ok(on.struck.every((s) => /outside ±10×/.test(s.why)));
});

test("a loss-maker is priced on sales: no P/E or PEG row on a negative figure, the runway beside it", () => {
  const R = run("IREN", BAND_DEFAULT);
  assert.equal(R.company.loss_maker, true);
  assert.ok(!("pe" in R.implied) && !("peg" in R.implied)); assert.ok("ev_sales" in R.implied);
  assert.ok(R.pre_profit && "runway_quarters" in R.pre_profit);
  assert.match(verdictWords(R, { setWords: "x" }).join(" "), /Loss-making: priced on sales only/);
});

test("P/S is a column, never a priced row; the farthest-peer swing is printed on every priced row of three or more", () => {
  const R = run("BE", null);
  assert.ok(R.company.m.ps > 0 && R.median.ps > 0); assert.ok(!("ps" in R.implied));
  for (const r of Object.values(R.implied)) if (r.n >= 3) assert.ok(r.swing && Number.isFinite(r.swing.swing_pct));
});

test("the sets: every RADAR (23) and Dow (30) name, CW3's set where both lists carry a name, Alan's 20 Oct notes", () => {
  assert.equal(Object.keys(sets.names).length, 48);
  for (const t of ["MU", "NVDA", "IREN", "SHOP", "BE", "AAOI", "AXTI"]) assert.equal(sets.names[t].set, "CW3");
  for (const t of ["AAPL", "KO", "GS", "JPM", "MMM"]) assert.equal(sets.names[t].set, "CW4");
  for (const t of ["NVDA", "AMZN", "WMT", "CAT", "GOOGL"]) assert.equal(sets.names[t].also.same_members, true);
  for (const t of ["IREN", "ORCL", "NVDA", "AVGO", "VST", "SHOP", "BE", "CAT", "NFLX", "MU"]) assert.ok(sets.names[t].alan, t);
  assert.ok(["MU", "SNDK", "WDC"].every((t) => sets.names[t].cycle && cycle.names[t]));
  assert.equal(new Set(sets.all).size, idx.tickers.length);
});

test("the cycle line places today's trailing multiple among the name's own ten years", () => {
  const cy = cycle.names.MU, c = cycleLine(cy, cy.price_at_cw5, {});
  assert.ok(Math.abs(c.pe.percentile - cy.dist.pe.at_cw5.percentile) < 1.5, `${c.pe.percentile} vs ${cy.dist.pe.at_cw5.percentile}`);
  assert.ok(Math.abs(c.pe.now / cy.dist.pe.at_cw5.today - 1) < 1e-6);
});

test("the Hub loads CW6; the browser makes no FMP call and no write; the deliverable exists", () => {
  assert.match(readFileSync(here("../index.html"), "utf8"), /import\("\/deliverables\/20261022\/cw6-comps-tab\/tab\.mjs"\)/);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const f of ["tab.mjs", "sources.mjs", "engine.mjs"]) {
    const code = strip(readFileSync(here(D + f), "utf8"));
    assert.ok(!/functions\/v1\/fmp-proxy|financialmodelingprep\.com|fetch\([^)]*fmp/i.test(code), f + " calls no FMP");
    assert.ok(!/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(code) && !/opts\.write\(/.test(code), f + " writes nothing");
  }
  for (const f of ["CHECK.md", "sql/20261022_comps_fmp_answers.sql", "sql/20261022_comps_fmp_answers_ROLLBACK.sql", "tools/fill_store.py", "tools/check.mjs", "tools/shots.mjs", "README.md"]) assert.ok(existsSync(here(D + f)), f);
  for (const t of ["MU", "NVDA", "IREN", "SHOP", "BE", "AAPL", "LRCX"]) for (const s of ["1680x1050", "2560x1440"]) assert.ok(existsSync(here(`${D}pictures/${t}-${s}.png`)), `${t} ${s}`);
});

test("coordinator 22 Oct: a reviewed set opens with the size band off; the business-lines sets keep ±10×", () => {
  const tab = readFileSync(here("../deliverables/20261022/cw6-comps-tab/tab.mjs"), "utf8");
  assert.match(tab, /S\.path = "curated";[^\n]*\n(?:\s*\/\*[\s\S]*?\*\/\n)?\s*S\.band = null;/, "the curated branch turns the band off");
  assert.match(tab, /const S = \{ root, opts, T, band: BAND_DEFAULT,/, "every other set starts at the default band");
  assert.match(tab, /starts on for the business-lines sets and off for the reviewed sets/, "the page says so");
});

test("coordinator 23 Oct: the table answers first and dates the read; profile and peers do not date it; no table → the files", async () => {
  const { fromStore } = await import("../deliverables/20261022/cw6-comps-tab/sources.mjs");
  const rows = [
    { ticker: "NVDA", path: "analyst-estimates", status: 200, fetched_at: "2026-10-26T10:30:05.1+00:00", data: [] },
    { ticker: "NVDA", path: "quote", status: 200, fetched_at: "2026-10-26T10:30:01+00:00", data: { price: 1 } },
    { ticker: "NVDA", path: "profile", status: 200, fetched_at: "2026-10-20T03:28:57+00:00", data: [] },
    { ticker: "NVDA", path: "income-statement-ttm", status: 429, fetched_at: "2026-10-26T10:31:00+00:00", data: null },
  ];
  const files = (u) => { if (u.endsWith("/AMD.json")) return Promise.resolve({ answers: { quote: { status: 200 } }, filled_utc: "2026-10-22T18:07:00Z" }); return Promise.reject(new Error("404")); };
  const a = await fromStore(["NVDA", "AMD"], { fetchJson: files, read: async () => rows });
  assert.equal(a.from.NVDA, "public.comps_fmp_answers"); assert.match(a.from.AMD, /^store file/);
  assert.deepEqual(a.tableAt, { first: "2026-10-26T10:30:01.000Z", last: "2026-10-26T10:30:05.100Z", n: 2 });
  const b = await fromStore(["AMD"], { fetchJson: files, read: async () => { throw new Error("404"); } });
  assert.equal(b.tableAt, null); assert.match(b.from.AMD, /^store file/);
  const tab = readFileSync(here(D + "tab.mjs"), "utf8");
  assert.match(tab, /S\.tableAt = st\.tableAt/); assert.match(tab, /re-read server-side each weekday morning by the comps-fill job/);
});
