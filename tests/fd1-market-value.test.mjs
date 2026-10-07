/* FD1 (7 Oct 2026) — today's market value for every company in the comps reader (cohort.mjs marketValueFrom "profile"),
   a switch that is off by default, tested with the rules it touches: comps.mjs's share count, C5b's foreign-reporter
   rule (which already reads the profile), the P/E rows (which must not move).
   Offline: C5b's committed FMP facts of 3 Oct through C5b's own table builder — fundamentals.market_cap is FMP's
   key-metrics market value at the last fiscal period end, company_profile.market_cap the profile's, as on the Hub. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCohort, snapshotFromCohort } from "../deliverables/20261001/comps-template/cohort.mjs";
import { readSet } from "../deliverables/20261001/comps-mechanic/read.mjs";
import { tablesFrom, pgFrom, quotesFrom } from "../deliverables/20261003/comps-c5b/fmp-rows.mjs";

const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8")), read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const FACTS = J("../deliverables/20261003/comps-c5b/fmp-facts-2026-10-03.json"), standin = J("../deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json"), reported = J("../deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json");
const tables = tablesFrom(FACTS), TODAY = "2026-10-03", MEMBERS = ["MU", "SNDK", "NVDA", "AMD", "LRCX", "TSM"];
const near = (a, b, rel, msg) => assert.ok(a != null && b != null && Math.abs(a - b) <= rel * Math.abs(b), `${msg || ""} ${a} vs ${b}`);
const ctxOf = (marketValueFrom) => readCohort({ ticker: "MU", today: TODAY, pg: pgFrom(tables), quotes: quotesFrom(FACTS), fxStandin: { ...standin, reported: reported.reported }, membersAsked: MEMBERS, labelAsked: "test", marketValueFrom });
const C = (t) => FACTS.companies[t];

test("the stored market value is the last fiscal period end's, and the reader takes shares = that ÷ a later price", async () => {
  assert.match(read("../supabase/functions/fmp-fundamentals/index.ts"), /market_cap: FMP key-metrics marketCap at the latest FISCAL PERIOD END \(kmAll\[0\]\), not a current value/);
  assert.match(read("../deliverables/20260927/comps-single/comps.mjs"), /Shares = market value ÷ the price on the\s+same fundamentals row, so both are measured on one day/);
  const ctx = await ctxOf(null), I = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, i]));
  for (const t of ["MU", "SNDK", "NVDA", "AMD", "LRCX"]) {
    const c = C(t), stored = c.key_metrics_q.marketCap / c.quote.price, real = c.profile.marketCap / c.profile.price;
    near(I[t].shares, stored, 1e-9, t + ": shares as read"); assert.ok(real > 0);
  }
  /* on 3 Oct, by FMP's own two figures: Micron's share count read 13% low and Nvidia's 20% low */
  const off = (t) => C(t).key_metrics_q.marketCap / C(t).quote.price / (C(t).profile.marketCap / C(t).profile.price);
  assert.ok(off("MU") < 0.92 && off("NVDA") < 0.85, `MU ${off("MU").toFixed(3)} · NVDA ${off("NVDA").toFixed(3)}`);
  assert.match(ctx.market_value_from, /fundamentals row \(the last fiscal period end's market value over a later price\)/);
});
test("with the switch on, a dollar reporter's market value and price come from the profile together: the share count is the listed one", async () => {
  const off = await ctxOf(null), on = await ctxOf("profile"), A = Object.fromEntries(off.inputs.map((i) => [i.ticker, i])), B = Object.fromEntries(on.inputs.map((i) => [i.ticker, i]));
  for (const t of ["MU", "SNDK", "NVDA", "AMD", "LRCX"]) {
    const c = C(t), real = c.profile.marketCap / c.profile.price;
    near(B[t].shares, real, 1e-9, t + ": the listed share count"); near(B[t].mcap, real * c.quote.price, 1e-9, t + ": today's market value");
    assert.equal(B[t].price, A[t].price, t + ": the price is the quote's either way"); assert.equal(B[t].eps_ttm, A[t].eps_ttm); assert.equal(B[t].net_debt, A[t].net_debt);
    assert.match(on.fx[t].market_value, /company_profile \(today's market value and price together\)/); assert.equal(off.fx[t].market_value, undefined);
  }
  assert.equal(on.market_value_from, "profile");
  /* a foreign reporter already took the profile (C5b): the switch changes nothing for it */
  near(B.TSM.shares, A.TSM.shares, 1e-12); near(B.TSM.mcap, A.TSM.mcap, 1e-12); assert.match(off.fx.TSM.market_value, /company_profile \(FMP, USD\)/); assert.match(on.fx.TSM.market_value, /company_profile \(FMP, USD\)/);
});
test("what moves and what does not: P/E rows are untouched; P/S and the EV rows move by the share count", async () => {
  const a = snapshotFromCohort(await ctxOf(null), "MU"), b = snapshotFromCohort(await ctxOf("profile"), "MU"), row = (s, k) => s.rows.find((r) => r.key === k);
  for (const k of ["pe_ttm", "pe_fwd"]) { assert.equal(row(b, k).own.multiple, row(a, k).own.multiple, k + " own"); for (const t of MEMBERS.slice(1)) assert.equal(row(b, k).values[t].multiple, row(a, k).values[t].multiple, k + " " + t); }
  const k = (t) => C(t).profile.marketCap / C(t).profile.price / (C(t).key_metrics_q.marketCap / C(t).quote.price);   /* today's shares ÷ the stored count */
  near(row(b, "ps").own.multiple / row(a, "ps").own.multiple, k("MU"), 1e-9, "Micron's P/S"); assert.ok(row(b, "ps").own.multiple > row(a, "ps").own.multiple * 1.1, "Micron's market value was read more than 10% low");
  for (const t of ["SNDK", "NVDA", "AMD", "LRCX"]) near(row(b, "ps").values[t].multiple / row(a, "ps").values[t].multiple, k(t), 1e-9, t + " P/S");
  near(row(b, "ps").values.TSM.multiple, row(a, "ps").values.TSM.multiple, 1e-12, "the foreign reporter does not move");
  assert.notEqual(row(b, "ev_ebitda").own.multiple, row(a, "ev_ebitda").own.multiple); assert.notEqual(row(b, "ev_sales").values.NVDA.multiple, row(a, "ev_sales").values.NVDA.multiple);
  near(b.shares, C("MU").profile.marketCap / C("MU").profile.price, 1e-9); near(b.mcap, b.shares * b.price, 1e-12);
});
test("off is off, a company with no profile figures keeps the stored ones, and readSet passes the switch through", async () => {
  const base = snapshotFromCohort(await ctxOf(null), "MU"), again = snapshotFromCohort(await readCohort({ ticker: "MU", today: TODAY, pg: pgFrom(tables), quotes: quotesFrom(FACTS), fxStandin: { ...standin, reported: reported.reported }, membersAsked: MEMBERS, labelAsked: "test" }), "MU");
  assert.deepEqual(again.rows.map((r) => [r.key, r.own.multiple, r.band]), base.rows.map((r) => [r.key, r.own.multiple, r.band]), "no option given = the reader as it was");
  const bare = { ...tables, company_profile: tables.company_profile.map((r) => (r.ticker === "NVDA" ? { ...r, market_cap: null } : r)) };
  const ctx = await readCohort({ ticker: "MU", today: TODAY, pg: pgFrom(bare), quotes: quotesFrom(FACTS), fxStandin: { ...standin, reported: reported.reported }, membersAsked: MEMBERS, labelAsked: "test", marketValueFrom: "profile" }), nv = ctx.inputs.find((i) => i.ticker === "NVDA");
  near(nv.shares, C("NVDA").key_metrics_q.marketCap / C("NVDA").quote.price, 1e-9, "no profile market value: the stored one stands, as before"); assert.equal(ctx.fx.NVDA.market_value, undefined);
  const set = { kept: MEMBERS.slice(1).map((t) => ({ ticker: t })), rule: "test" }, opts = { today: TODAY, pg: pgFrom(tables), quotes: quotesFrom(FACTS), fxStandin: { ...standin, reported: reported.reported } };
  const x = await readSet("MU", set, opts), y = await readSet("MU", set, { ...opts, marketValueFrom: "profile" });
  near(x.inputs.find((i) => i.ticker === "MU").shares, C("MU").key_metrics_q.marketCap / C("MU").quote.price, 1e-9); near(y.inputs.find((i) => i.ticker === "MU").shares, C("MU").profile.marketCap / C("MU").profile.price, 1e-9);
});
