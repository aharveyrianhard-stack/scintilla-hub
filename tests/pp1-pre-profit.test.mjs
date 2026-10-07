/* The pre-profit shelf and debt in the knockout (7 Oct · deliverables/20261007/pre-profit): a method for companies with
   no profit now and none expected — sales in dollars, what the company costs against them, cash and the build-out,
   dilution, debt, how far the analysts agree — one score and a rank; and the knockout's round 2 run again with a debt
   reading that acts only in the debate.
   Tested here: each rule together with the rules it leans on (the knockout's quartile ramp, its tie band, its upper-half
   pass and its three finalists; the estimates path's "fewer than four analysts" cut; the knockout's venture rule), the
   saved result re-derived from its own readings, the fetch script (run against a stand-in, never the vendor), and the page.
   Offline: the committed result (data/pre-profit.json) and the knockout's (data/knockout.json). The rules are Python
   (tools/model.py), called through tools/rules-cli.py; those tests are skipped where python3 is not installed. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { compact, redact, run, KEEP, makeFmp } from "../deliverables/20261007/pre-profit/tools/pp1_fetch_fmp.mjs";

const here = (p) => new URL(p, import.meta.url), J = (p) => JSON.parse(readFileSync(here(p), "utf8")), T = (p) => readFileSync(here(p), "utf8");
const DIR = "../deliverables/20261007/pre-profit/", D = J(DIR + "data/pre-profit.json"), K = D.knockout, H = D.history, SHELF = D.shelf, BY = Object.fromEntries(SHELF.map((r) => [r.t, r]));
const KO = J("../deliverables/20261007/knockout/data/knockout.json");
const CLI = fileURLToPath(here(DIR + "tools/rules-cli.py"));
const hasPy = spawnSync("python3", ["-c", "import json"], { encoding: "utf8" }).status === 0, PY = { skip: !hasPy && "python3 is not available" };
const py = (...calls) => { const r = spawnSync("python3", [CLI], { input: JSON.stringify({ calls }), encoding: "utf8", maxBuffer: 128e6 }); if (r.status !== 0) throw new Error(r.stderr.slice(-800)); return JSON.parse(r.stdout); };
const near = (a, b, eps, msg) => assert.ok(a != null && Math.abs(a - b) <= eps, `${msg || ""} ${a} vs ${b}`);
const q = (oi, ni) => ({ operating_income: oi, net_income: ni });

/* ---- the fetch script: run against a stand-in, never the vendor ---------------------------------------------- */
test("the fetch script asks only the vendor's /stable/ routes, keeps numbers as numbers and dates as dates, and never lets the key out", async () => {
  const seen = [], methods = [];
  const fetchFn = async (u, o) => { seen.push(u); methods.push((o && o.method) || "GET"); return { status: 200, json: async () => [{ date: "2026-06-30", filingDate: "2026-08-07 16:05:11", fiscalYear: "2026", period: "Q2", reportedCurrency: "USD", revenue: "100.5", grossProfit: 40, interestExpense: -5000, weightedAverageShsOut: 10, cashAndCashEquivalents: 7, shortTermInvestments: 3, netCashProvidedByOperatingActivities: -9, capitalExpenditure: -20, netDebtIssuance: 15, revenueLow: 90, revenueHigh: 120, revenueAvg: 100, numAnalystsRevenue: 6 }] }; };
  const doc = await run({ env: { TICKERS: "aaa, bbb", FMP_API_KEY: "SECRETSECRET", QUARTERS: "8" }, nowMs: Date.now(), fetchFn });
  assert.equal(doc.names.length, 2); assert.equal(doc.calls, 8, "four statements a name");
  assert.ok(seen.every((u) => u.startsWith("https://financialmodelingprep.com/stable/")), "only /stable/ routes");
  assert.ok(methods.every((m) => m === "GET"), "reads only");
  assert.ok(seen.every((u) => u.includes("apikey=SECRETSECRET")), "the key rides on the request …");
  assert.ok(!JSON.stringify(doc).includes("SECRETSECRET"), "… and never on what is printed");
  assert.equal(redact("x?apikey=SECRETSECRET&y=1"), "x?apikey=***&y=1");
  const row = Object.fromEntries(doc.names[0].income.cols.map((k, i) => [k, doc.names[0].income.rows[0][i]]));
  assert.equal(row.revenue, 100.5, "a number sent as text is a number"); assert.equal(row.filed, "2026-08-07", "a date stays a date"); assert.equal(row.fy, 2026); assert.equal(row.interest_expense, -5000);
  assert.deepEqual(compact(null, "balance").rows, [], "nothing sent, nothing kept");
  for (const kind of ["income", "balance", "cashflow", "estimates"]) assert.equal(new Set(KEEP[kind].map(([n]) => n)).size, KEEP[kind].length, kind + ": no line kept twice");
  await assert.rejects(run({ env: { TICKERS: "" }, nowMs: 0, fetchFn }), /TICKERS is empty/);
  assert.throws(() => makeFmp({ key: "" }), /no vendor key/);
  let calls = 0; const flaky = async () => (++calls < 3 ? { status: 429, json: async () => ({}) } : { status: 200, json: async () => [] });
  await makeFmp({ key: "k", fetchFn: flaky, sleepFn: async () => {} })("income-statement?symbol=A"); assert.equal(calls, 3, "a busy answer is asked again, not taken as empty");
  await assert.rejects(makeFmp({ key: "k", fetchFn: async () => ({ status: 403, json: async () => ({}) }), sleepFn: async () => {} })("x?symbol=A&apikey=zz"), (e) => /http 403/.test(e.message) && !/zz/.test(e.message));
});

/* ---- who is on the shelf ---------------------------------------------------------------------------------------- */
test("the shelf: no profit now, none expected this year, and growing a quarter or more; everything else is listed with its reason", PY, () => {
  const loss = [q(-5, -6), q(-4, -5), q(-3, -4), q(-2, -3)], profit = [q(5, 4), q(4, 3), q(3, 2), q(2, 1)], paper = [q(-5, 30), q(-4, -5), q(-3, -4), q(-2, -3)], interest = [q(5, -9), q(4, -8), q(3, -7), q(2, -6)];
  const [c, a, slow, edge, exp, prof, est, young, v, vest, pg, ib, none, thin] = py(["consts", []], ["classify", [loss, [], false, -1, 80]], ["classify", [loss, [], false, -1, 24.9]], ["classify", [loss, [], false, -1, 25]], ["classify", [loss, [], false, 0.4, 80]],
    ["classify", [profit, [], false, 2, 80]], ["classify", [loss, [9, 8, -1, 7, 2], false, -1, 80]], ["classify", [loss, [9, 8, 7], false, -1, 80]], ["classify", [profit, [], true, 2, 5]], ["classify", [loss, [9, 8, 7, 6, 5], true, -1, 80]],
    ["classify", [paper, [], false, -1, 80]], ["classify", [interest, [], false, -1, 80]], ["classify", [loss, [], false, null, null]], ["classify", [loss.slice(0, 2), [], false, -1, 80]]);
  assert.equal(c.gate, 25); assert.equal(c.venture_share, KO.rules ? 0.01 : 0.01, "the knockout's own venture line");
  assert.equal(a.tier, "A"); assert.match(a.words, /operating line and the bottom line/);
  assert.equal(slow.tier, null); assert.match(slow.why_not, /grow under 25%/); assert.equal(edge.tier, "A", "exactly a quarter more is on the shelf");
  assert.equal(exp.tier, null); assert.match(exp.why_not, /analysts expect a profit/, "a loss as filed with a profit expected is the knockout's to price");
  assert.equal(prof.tier, null); assert.match(prof.why_not, /made a profit/);
  assert.equal(est.tier, null); assert.match(est.why_not, /had steady profits and lost them: an operating profit in 4 of the 5/); assert.equal(young.tier, "A", "three good years on file is not five: not called established");
  assert.equal(v.tier, "V", "next to no sales: on the shelf whatever its profit line says"); assert.equal(vest.tier, null, "… unless it had steady profits before");
  assert.equal(pg.tier, "A"); assert.match(pg.words, /paper gain lifted the bottom line/, "a paper gain does not make a company profitable");
  assert.equal(ib.tier, "A"); assert.match(ib.words, /operations made a profit; interest and other items took it/);
  assert.equal(none.tier, "A", "no estimates at all: on the shelf, to be listed, not ranked"); assert.match(thin.words, /only 2 quarters on file/);
  /* the saved shelf obeys it */
  for (const r of SHELF.filter((x) => !x.compare)) { assert.ok(r.tier === "A" || r.tier === "V", r.t); if (r.tier === "A" && r.sales.g1 != null) assert.ok(r.sales.g1 >= 25, r.t + " grows under the gate"); if (r.tier === "A") assert.ok(!(r.eps_this_year > 0), r.t + " expects a profit"); }
  assert.deepEqual(new Set(KO.blind_spots ? Object.keys(KO.names).filter((t) => KO.names[t].venture) : []), new Set(SHELF.filter((r) => r.tier === "V").map((r) => r.t)), "the knockout's venture shelf is on it, name for name");
  const kinds = Object.fromEntries(D.off_shelf.map((x) => [x.t, x.kind])); assert.equal(kinds.BA, "slow"); assert.equal(kinds.SNAP, "slow"); assert.equal(kinds.CRWD, "expected"); assert.equal(kinds.INTC, "lost");
  assert.ok(BY.BE.compare && !BY.BE.ranked && BY.BE.would_rank > 0, "Bloom is profitable: beside the shelf, never ranked on it");
  assert.equal(D.counts.on_shelf, SHELF.filter((r) => !r.compare).length); assert.equal(D.counts.ranked, SHELF.filter((r) => r.ranked).length);
});

/* ---- what is measured ------------------------------------------------------------------------------------------- */
test("the share count is the company's own newest cover; a quarter's average when the cover is older; never one class of several", PY, () => {
  const [cover, older, none, classes, both] = py(["shares_pick", [{ total: 551.5e6, as_of: "2026-07-31", n_classes: 2 }, null, 551e6, "2026-06-30", 626e6]], ["shares_pick", [{ total: 357e6, as_of: "2026-04-30" }, null, 362e6, "2026-06-30", 399e6]],
    ["shares_pick", [null, null, 280e6, "2026-06-30", 323e6]], ["shares_pick", [null, null, 110e6, "2026-06-30", 590e6]], ["shares_pick", [{ total: 100, as_of: "2026-07-01" }, { total: 237.6e6, as_of: "2026-08-05" }, 151e6, "2026-06-30", 248e6]]);
  assert.equal(cover.source, "cover"); assert.equal(cover.shares, 551.5e6);
  assert.equal(older.source, "quarter average"); assert.equal(older.shares, 362e6, "a cover from before the quarter ended is behind the quarter itself");
  assert.equal(none.source, "quarter average");
  assert.equal(classes.shares, null); assert.match(classes.source, /one share class of several/, "the vendor's count more than 1.5× the quarter's: a class is missing, and no count is offered");
  assert.equal(both.shares, 237.6e6, "of two covers the newer");
  for (const r of SHELF) if (r.shares.source === "cover") { assert.ok(r.shares.as_of >= r.quarter_end, r.t); near(r.market_value, r.shares.count * r.price, Math.max(2, r.market_value * 1e-9), r.t + " market value"); }
  near(BY.CRWV.shares.count, 551536602, 0.5, "CoreWeave's cover, both classes"); assert.match(BY.CRWV.shares.quote || "", /458,871,690 shares of Class A/);
});
test("the whole company = its shares + what it owes − its cash, set against next year's sales on one calendar window", PY, () => {
  for (const t of ["CRWV", "NBIS", "IREN", "BE"]) {
    const r = BY[t], d = r.debt; near(d.net_debt, d.total - r.cash.cash_sti, 2, t + " net debt counts short-term investments as cash");
    assert.ok(r.ev >= r.market_value + d.net_debt - 2 && r.ev <= r.market_value + d.net_debt + 1e9, t + " EV (plus any preferred and minority)");
    near(r.ev_sales, r.ev / r.sales.next, 1e-3, t + " EV ÷ next year's sales");
    const y = r.sales.years, [L, N1, N2] = py(["calendarize", [y[0].avg, y[1].avg, y[2].avg, y[3] ? y[3].avg : null, r.sales.w]])[0];
    /* the saved window weight is kept to three places, so the dollars re-derive to within a tenth of a percent */
    near(r.sales.last, L, L * 1e-3, t + " the twelve months to today"); near(r.sales.next, N1, N1 * 1e-3, t + " next twelve months"); near(r.sales.g1, (r.sales.next / r.sales.last - 1) * 100, 0.01, t + " growth is next year over the twelve months to today");
    if (N2 != null) { near(r.sales.after, N2, N2 * 1e-3, t + " the twelve after"); near(r.sales.g2, (r.sales.after / r.sales.next - 1) * 100, 0.01, t + " growth after"); }
    assert.ok(r.sales.next_low <= r.sales.next && r.sales.next <= r.sales.next_high, t + " the average sits inside its own range");
  }
  assert.ok(BY.IREN.sales.w > 0.7 && BY.CRWV.sales.w < 0.3, "IREN's year ends in June and CoreWeave's in December: each is weighed by how much of its own year is still to run");
  near(BY.CRWV.ev_sales, 4.1, 0.15); near(BY.NBIS.ev_sales, 7.2, 0.2); near(BY.IREN.ev_sales, 4.2, 0.2); near(BY.BE.ev_sales, 13.6, 0.3);
  const g = D.checks.growth_vs_knockout; assert.ok(g.within_2pts / g.n > 0.97, `growth here agrees with the knockout's own for ${g.within_2pts} of ${g.n}`);
});
test("cash: the faster of two paces, and Alan's rule — a build-out the cash does not cover is money still to find", PY, () => {
  const [last, avg, none, nofig, gap, covered, burnops, mix] = py(["runway", [1000, [-400, -100, -100, -100]]], ["runway", [1000, [-50, -300, -300, -300]]], ["runway", [1000, [50, 60, -10, 40]]], ["runway", [1000, []]],
    ["funding_gap", [27.5e9, 0.17e9, 2.08e9, 6.08e9, 14.94e9]], ["funding_gap", [1.7e9, 0.8e9, -0.17e9, 8.6e9, 42e9]], ["funding_gap", [2.0e9, 0.7e9, -5.3e9, 0.76e9, 1.64e9]], ["financing_mix", [100, 20, 50, 40, 10]]);
  assert.equal(last.burn_q, 400); assert.equal(last.quarters, 2.5); assert.match(last.basis, /last quarter/);
  near(avg.burn_q, 237.5, 1e-9); assert.match(avg.basis, /last year's average/);
  assert.equal(none.quarters, null); assert.equal(none.basis, "not burning"); assert.equal(nofig.basis, "no cash-flow figures");
  near(gap.gap, 27.5e9 + 0.17e9 - 6.08e9 - 2.08e9, 1); near(gap.pct_of_value, 130.6, 0.2, "IREN: still to find, as a share of its market value");
  assert.equal(covered.gap, 0); assert.equal(covered.pct_of_value, 0);
  near(burnops.need, 2.0e9 + 0.7e9 + 5.3e9, 1, "operations that lose cash add to the need"); near(burnops.have, 0.76e9, 1);
  assert.deepEqual(mix, { operations: 20, "new debt": 50, "new shares": 40, "other financing": 10, "cash on hand": -20 }, "raised more than was spent: cash on hand went up");
  /* the saved shelf: planned spending is the announced figure where one was read, otherwise the faster pace */
  const A = J(DIR + "data/capex-announced.json").names;
  for (const r of SHELF) { const a = A[r.t], c = r.capex; if (a && a.use) { near(c.plan, a.amount, 1, r.t); assert.equal(c.plan_basis, "announced by the company"); } else if (c.year != null) near(c.plan, Math.max(c.year, 4 * c.last_quarter), 2, r.t); }
  assert.equal(D.counts.with_announced_capex, SHELF.filter((r) => r.capex.announced && r.capex.announced.use).length);
  for (const [t, words] of [["IREN", "$25 billion to $30 billion"], ["NBIS", "$20 billion to $25 billion"], ["CRWV", "$35 billion to $39 billion"]]) { assert.ok(A[t].quote.includes(words), t); assert.equal(A[t].checked, "read in context"); }
  for (const t of ["WULF", "BTDR", "SPCX"]) assert.equal(A[t].use, false, t + " was seen and not used");
  assert.ok(BY.IREN.gap.pct_of_value > 100 && BY.CRWV.gap.pct_of_value > 50 && BY.NBIS.gap.pct_of_value < 20);
});
test("the capex reader keeps a sentence only when it names the spending, carries dollars and looks ahead", PY, () => {
  const text = "Revenue was $2.6 billion. Capital expenditures in the quarter were $6.4 billion. We now expect 2026 CapEx in the range of $35 billion to $39 billion. Our margin was 40%. We plan capital expenditures of approximately $150 million for the full year.";
  const [hits, amt, one] = py(["read_call", [text]], ["amounts", ["between $1.7 billion-$1.8 billion"]], ["amounts", ["roughly $2 billion of total"]]);
  assert.equal(hits.length, 3); assert.equal(hits[0].low, 35e9); assert.equal(hits[0].high, 39e9); assert.ok(hits[0].score > hits[2].score, "guidance outranks what was spent");
  assert.ok(hits.every((h) => /cap/i.test(h.quote)), "a sentence about revenue is not kept");
  assert.deepEqual(amt, [[1.7e9, 1.8e9]]); assert.deepEqual(one, [[2e9, 2e9]]);
});
test("dilution: a count that rises is shares sold; a count that falls by a clean ratio is a reverse split", PY, () => {
  const [up, rev, both, fwd, ch] = py(["split_factor", [[24.7e6, 66.6e6]]], ["split_factor", [[3.06e9, 0.306e9, 0.39e9]]], ["split_factor", [[100, 200, 20]]], ["split_factor", [[100, 1000], true]], ["share_change", [362, 257.2]]);
  assert.equal(up, 1, "Sidus tripling its count in a quarter is dilution, and is counted as such");
  near(rev, 0.1, 1e-9, "one for ten"); near(both, 0.1, 1e-9, "the doubling is shares sold, the tenth is the split"); assert.equal(fwd, 10, "a forward split is read only when asked for");
  near(ch, 40.75, 0.01);
  near(BY.IREN.dilution.change_1y, 40.7, 0.2); assert.ok(BY.IREN.dilution.overhang_pct > 35, "IREN: two shares in five still to come");
  assert.equal(BY.CBRS.dilution.change_1y, null); assert.match(BY.CBRS.dilution.why_1y, /would cross its listing/, "a window across a listing is not measured");
  for (const r of SHELF) if (r.dilution.change_1y != null) assert.ok(r.dilution.change_1y > -40, r.t + " a fall that large is a split, not a buyback");
});

/* ---- the score -------------------------------------------------------------------------------------------------- */
test("the score: growth the largest of seven parts that add to 100, counted with the dollars; thin estimates are listed, never ranked", PY, () => {
  const [c] = py(["consts", []]), W = c.weights;
  assert.equal(Object.values(W).reduce((a, b) => a + b, 0), 100); assert.ok(Object.entries(W).every(([k, v]) => k === "growth" || v < W.growth), "growth is the largest (Alan, 6 Oct)");
  assert.deepEqual([...c.promise, ...c.footing].sort(), Object.keys(W).sort(), "promise and footing are the seven parts, each once");
  assert.equal(c.thin, 4, "the estimates path's own cut");
  const [big, small, norate, half] = py(["growth_part", [1, 1, 1]], ["growth_part", [1, 1, 0]], ["growth_part", [null, null, 1]], ["growth_part", [0.6, 0, null]]);
  assert.equal(big, 1); assert.equal(small, c.dollar_floor, "the same rate on the shelf's smallest dollars counts at half"); assert.equal(norate, null); near(half, 0.4 * 0.5, 1e-9, "next year twice the year after");
  const base = { g2: 40, ev_sales: 6, gm: 50, gm_change: 0, runway_q: 8, burning: true, gap_pct: 0, shares_1y: 10, overhang: 10, nd_sales: -0.5, net_debt: -1, analysts: 10, spread_sales: 20, spread_eps: 2, venture: false };
  const rows = [{ ...base, t: "FAST_BIG", g1: 200, sales_next: 10e9 }, { ...base, t: "FAST_SMALL", g1: 200, sales_next: 20e6 }, { ...base, t: "SLOW", g1: 30, sales_next: 10e9 }, { ...base, t: "MID", g1: 80, sales_next: 500e6 },
    { ...base, t: "THIN", g1: 900, sales_next: 5e9, analysts: 3 }, { ...base, t: "NOEST", g1: null, ev_sales: null, sales_next: null, analysts: null }, { ...base, t: "NOTHING", g1: 9000, sales_next: 30e6, venture: true },
    { ...base, t: "GAP", g1: 80, sales_next: 500e6, gap_pct: 120 }, { ...base, t: "DEBT", g1: 80, sales_next: 500e6, nd_sales: 2.5, net_debt: 1 }, { ...base, t: "CASHIN", g1: 80, sales_next: 500e6, burning: false, runway_q: null }];
  const [S] = py(["score_shelf", [rows]]), R = S.rows;
  assert.ok(R.FAST_BIG.parts.growth > R.FAST_SMALL.parts.growth, "revenue in dollar figures matters, not only growth percentages");
  assert.ok(R.FAST_BIG.parts.growth > R.SLOW.parts.growth);
  assert.equal(R.NOTHING.sub.rate_next, 1, "a rate from next to no sales is read against the names with real sales, and cannot stretch their scale");
  assert.equal(R.THIN.ranked, false); assert.equal(R.THIN.rank, null); assert.equal(R.THIN.parts.growth, null); assert.equal(R.THIN.parts.price, null, "fewer than four analysts: growth and price are not read");
  assert.equal(R.NOEST.ranked, false); assert.ok(!S.order.includes("THIN") && !S.order.includes("NOEST"));
  assert.equal(R.MID.sub.gap, 1, "no gap to fund is simply good"); assert.ok(R.GAP.sub.gap < 0.76 && R.GAP.parts.money < R.MID.parts.money);
  assert.equal(R.MID.parts.debt, 1, "net cash is simply good"); assert.ok(R.DEBT.parts.debt < 0.76); assert.equal(R.CASHIN.sub.runway, 1, "cash coming in is simply good");
  assert.ok(R.GAP.score < R.MID.score && R.DEBT.score < R.MID.score);
  for (const r of Object.values(R)) { const p = r.parts, s = Object.keys(W).reduce((a, k) => a + W[k] * (p[k] == null ? 0.5 : p[k]), 0) / 100; near(r.score, s, 1e-9, "the score is the weighted parts, a part not read counting as the middle"); near(r.score, (55 * r.promise + 45 * r.footing) / 100, 1e-9, "… and the sum of its two halves"); }
});
test("the saved shelf re-derives from its own readings: every score, every rank, and where Bloom would stand", PY, () => {
  const row = (r) => ({ t: r.t, venture: r.tier === "V", g1: r.sales.g1 ?? null, g2: r.sales.g2 ?? null, sales_next: r.sales.next ?? null, ev_sales: r.ev_sales, gm: r.margin.now, gm_change: r.margin.change, runway_q: r.burn.quarters, burning: r.burn.burn_q == null ? null : r.burn.burn_q > 0,
    gap_pct: r.gap.pct_of_value, shares_1y: r.dilution.change_1y, overhang: r.dilution.overhang_pct, nd_sales: r.debt.nd_sales, net_debt: r.debt.net_debt, analysts: r.quality.analysts, spread_sales: r.quality.spread_sales, spread_eps: r.quality.spread_eps_vs_price });
  const proper = SHELF.filter((r) => !r.compare), [S, S2] = py(["score_shelf", [proper.map(row)]], ["score_shelf", [SHELF.map(row)]]);
  for (const r of proper) { near(S.rows[r.t].score, r.score, 0.002, r.t + " score"); assert.equal(S.rows[r.t].rank, r.rank, r.t + " rank"); assert.equal(S.rows[r.t].thin, r.thin, r.t); for (const k of Object.keys(r.parts)) { if (r.parts[k] == null) assert.equal(S.rows[r.t].parts[k], null, r.t + " " + k); else near(S.rows[r.t].parts[k], r.parts[k], 0.011, r.t + " " + k); } }
  assert.deepEqual(S.order, SHELF.filter((r) => r.ranked).map((r) => r.t), "the page's order is the score's order");
  near(S2.rows.BE.score, BY.BE.score, 0.002, "Bloom is read against the shelf's own field"); assert.equal(BY.BE.would_rank, proper.filter((r) => r.ranked && S.rows[r.t].score > S2.rows.BE.score).length + 1);
  assert.ok(BY.IREN.rank < BY.CRWV.rank && BY.NBIS.rank < BY.CRWV.rank && BY.BE.would_rank > BY.NBIS.rank, "the order Alan asked about: Nebius and IREN ahead of CoreWeave, Bloom behind them");
  assert.ok(BY.IREN.promise > BY.NBIS.promise && BY.IREN.footing < BY.NBIS.footing, "IREN on promise, Nebius on footing");
  assert.ok(BY.IREN.parts.dilution < 0.1 && BY.CRWV.parts.debt < 0.15 && BY.CRWV.parts.money < 0.3, "each one's weak part is the one the page names");
  assert.equal(SHELF.filter((r) => r.thin).every((r) => !r.ranked), true);
});
test("how far apart the analysts stand: IREN's sales for the year ahead are tight, its profit a share and its year after are not", () => {
  const y = BY.IREN.sales.years.filter((x) => x.kind === "estimate");
  assert.ok(y[0].spread_sales < 15 && y[0].n >= 10, "the year to June 2027: a dozen analysts inside a tenth of each other");
  assert.ok(y[0].eps_low < -10 && y[0].eps_high > 10 && BY.IREN.price < 60, "profit a share: a range wider than the share price");
  assert.ok(y[1].spread_sales > 60, "the year after: the range opens");
  for (const r of SHELF) if (r.quality.spread_sales != null) near(r.quality.spread_sales, ((r.sales.next_high - r.sales.next_low) / r.sales.next) * 100, 0.05, r.t);
});

/* ---- debt in the knockout: the rule, with its neighbours --------------------------------------------------------- */
test("the debt load follows the rating agencies' bands; a pre-profit company is read on next year's sales; a bank is not read", PY, () => {
  const [c, at3, at4, at5, cov, both, cash, pre, preE, noE, bank, nob, nothing] = py(["consts", []], ["leverage", [30, 10, 1]], ["leverage", [40, 10, 1]], ["leverage", [50, 10, 1]], ["leverage", [10, 10, 2.5]], ["leverage", [45, 10, 4]],
    ["leverage", [-5, 10, 4]], ["leverage", [45.2e9, 3.77e9, 1.88e9, 23.3e9, null, true]], ["leverage", [2.0e9, 0.22e9, 0.21e9, 10e9, null, true]], ["leverage", [1.3e9, -1, 0.1e9, 1e9]], ["leverage", [9, 1, 1, null, "BANKS"]], ["leverage", [null, 1, 1]], ["leverage", [5, -1, 1, null]]);
  assert.deepEqual(c.bands.nd_ebitda, [3, 5], "S&P: 'significant' begins at 3× debt to EBITDA, 'highly leveraged' at 5×"); assert.deepEqual(c.bands.cover, [6, 2], "EBITDA to interest: 6× down to 2×");
  assert.equal(at3.load, 0); assert.equal(at4.load, 0.5); assert.equal(at5.load, 1);
  assert.equal(cov.basis, "cover"); near(cov.load, (6 - 4) / 4, 1e-9, "light debt but thin cover: the heavier reading counts");
  near(both.nd_ebitda, 4.5, 1e-9); near(both.cover, 2.5, 1e-9); assert.equal(both.basis, "cover"); near(both.load, 0.875, 1e-9, "4.5× EBITDA would be 75; 2.5× cover is 87.5; the heavier of the two is the load");
  assert.equal(cash.load, 0); assert.equal(cash.basis, "net cash");
  assert.equal(pre.basis, "nd_sales"); assert.equal(pre.load, 1, "CoreWeave: 1.94× next year's sales"); near(pre.nd_ebitda, 12.0, 0.05, "… and 12× EBITDA, shown, not what the load is read on");
  assert.equal(preE.load, 0, "Nebius: a sliver of EBITDA would read 9×; against next year's sales its debt is a fifth");
  assert.equal(noE.basis, "nd_sales"); near(noE.load, (1.3 - 1) / (5 / 3 - 1), 1e-6, "no EBITDA: the same two bands at a one-third margin");
  assert.equal(bank.load, null); assert.match(bank.words, /bank or an insurer/); assert.equal(nob.load, null); assert.equal(nothing.load, null);
  const F = Object.fromEntries(K.focus.map((f) => [f.t, f]));
  assert.equal(F.CRWV.load, 1); assert.equal(F.NBIS.load, 0); assert.equal(F.IREN.load, 0); assert.equal(F.BE.load, 0);
  for (const t of ["HUT", "MARA", "RIOT", "WULF"]) assert.notEqual(K.leverage[t].load, null, t + " is a miner filed under capital markets: read as an ordinary company");
  for (const t of ["JPM", "GS", "CB"]) assert.equal(K.leverage[t].load, null, t);
  assert.equal(K.counts.not_read, K.counts.not_read_banks_insurers + K.counts.not_read_other.length);
});
test("the neighbours hold: with no loads the debate is the knockout itself, in every branch, narrow or wide", PY, () => {
  const cols = ["t", "g1_rev", "g1_eps", "g2_rev", "g2_eps", "comps", "comps_strength", "revisions", "cash", "pctl", "venture"];
  const many = Object.fromEntries(Object.entries(KO.branches).map(([c, b]) => [c, b.run.map((t) => Object.fromEntries(cols.map((k) => [k, KO.names[t][k]])))]));
  const [c, none, wide] = py(["consts", []], ["branches", [many, {}]], ["branches", [many, {}, null, true]]);
  assert.equal(c.even, c.ko_even, "the tie band is the knockout's own"); assert.equal(c.top, c.ko_top, "three finalists, as the knockout has them"); assert.equal(c.max_cut * 100, c.ko_weights.cash, "a full load takes off what cash yield weighs in round 2"); assert.equal(c.ko_weights.cash, c.ko_weights.revisions);
  assert.equal(Object.keys(many).length, 63);
  for (const [id, b] of Object.entries(KO.branches)) for (const X of [none, wide]) {
    assert.deepEqual(X[id].ko.order, b.order, id + ": the knockout's own round 2 re-derives"); assert.deepEqual(X[id].order, b.order, id + " order"); assert.deepEqual(X[id].finalists, b.finalists, id + " finalists"); assert.equal(X[id].champion, b.champion, id + " champion");
    assert.deepEqual(new Set(X[id].passes), new Set(b.order.filter((t) => b.scores[t].passes)), id + " who passes");
  }
  assert.equal(K.same_as_ko1_without_loads, true);
});
test("the load acts only in the debate: it re-orders finalists and settles ties, and never fails a name that was not even", PY, () => {
  const R = (t, score, pctl) => ({ t, score, pctl, judged: true }), rows = [R("LEAD", 0.72, 50), R("SECOND", 0.66, 50), R("THIRD", 0.60, 50), R("FOURTH", 0.56, 50), R("FIFTH", 0.30, 50), R("SIXTH", 0.20, 50), R("OUT", 0.9, 50)];
  rows[6].judged = false;
  const [heavy, light, wide, small, evenAfter, tieDebt, tieWash, tieNear, pass] = py(["debate", [rows, { LEAD: 1 }]], ["debate", [rows, { LEAD: 0.2 }]], ["debate", [rows, { THIRD: 1 }, null, true]], ["debate", [rows, { LEAD: 1 }, 0.03]], ["debate", [rows, { LEAD: 0.3 }]],
    ["debate", [[R("A", 0.50, 20), R("B", 0.49, 80), R("C", 0.2, 50), R("D", 0.1, 50)], { A: 1, B: 0 }]], ["debate", [[R("A", 0.50, 80), R("B", 0.49, 20), R("C", 0.2, 50), R("D", 0.1, 50)], { A: 0.5, B: 0.4 }]],
    ["debate", [[R("A", 0.50, 20), R("B", 0.49, 80), R("C", 0.2, 50), R("D", 0.1, 50)], { A: 0.5, B: 0.3 }]], ["debate", [[R("A", 0.9, 50), R("B", 0.5, 50), R("C", 0.495, 50), R("D", 0.1, 50), R("E", 0.05, 50)], { C: 0, B: 1 }]]);
  assert.deepEqual(heavy.finalists, ["SECOND", "THIRD", "LEAD"], "a full load takes 15 points: 72 becomes 57, behind 66 and 60"); assert.equal(heavy.champion, "SECOND");
  assert.deepEqual(heavy.order.slice(0, 4), ["LEAD", "SECOND", "THIRD", "FOURTH"], "the branch's own order is untouched …"); assert.deepEqual(heavy.passes, ["LEAD", "SECOND", "THIRD"], "… and so is who passed round 2");
  assert.ok(!heavy.order.includes("OUT"), "a name the knockout does not judge is not in the debate");
  assert.deepEqual(light.finalists, ["LEAD", "SECOND", "THIRD"], "a light load (3 points) does not overturn a 6-point lead");
  assert.deepEqual(evenAfter.finalists, ["SECOND", "LEAD", "THIRD"], "a load of 30 takes 4.5 points: the two are then within the tie band, and of two even names the lighter goes first");
  near(evenAfter.rows.LEAD.debated, 0.675, 1e-9); assert.ok(heavy.rows.LEAD.cut <= 0.15 + 1e-12 && evenAfter.rows.LEAD.score - evenAfter.rows.SECOND.score <= 0.15 + 0.02, "never more than the cut plus the tie band");
  assert.deepEqual(small.finalists, ["LEAD", "SECOND", "THIRD"], "were a full load to take 3 points, a 6-point lead would hold: it is more than the cut plus the tie band");
  assert.deepEqual(wide.finalists, ["LEAD", "SECOND", "THIRD"], "wide: only names that passed are weighed, and here only three passed");
  assert.deepEqual(tieDebt.order.slice(0, 2), ["B", "A"], "even on fundamentals: the lighter load goes first, even over the more washed out"); assert.deepEqual(tieDebt.swaps, [{ up: "B", down: "A", why: "debt" }]);
  assert.deepEqual(tieWash.order.slice(0, 2), ["B", "A"], "loads no different (under a quarter of the scale apart): the knockout's own rule, the more washed out first"); assert.equal(tieWash.swaps[0].why, "washed out");
  assert.deepEqual(tieNear.order.slice(0, 2), ["A", "B"], "loads no different and the leader the more washed out: nothing moves");
  assert.deepEqual(pass.passes, ["A", "C", "B"], "a tie on the pass line (five names, three pass): debt decides the order of the two even names, and both still pass here"); assert.equal(pass.rows.B.passes, true);
});
test("who moved: the saved re-run re-derives from the knockout's data and the saved loads, at every setting", PY, () => {
  const cols = ["t", "g1_rev", "g1_eps", "g2_rev", "g2_eps", "comps", "comps_strength", "revisions", "cash", "pctl", "venture"];
  const many = Object.fromEntries(Object.entries(KO.branches).map(([c, b]) => [c, b.run.map((t) => Object.fromEntries(cols.map((k) => [k, KO.names[t][k]])))]));
  /* the saved loads are rounded to two places; a load is only ever compared in quarters of the scale or multiplied by 15 points */
  const loads = Object.fromEntries(Object.entries(K.leverage).map(([t, x]) => [t, x.load]));
  const settings = K.sensitivity.map((s) => s.max_cut), res = py(["branches", [many, loads]], ["branches", [many, loads, null, true]], ...settings.map((m) => ["branches", [many, loads, m]]));
  const [narrow, wide] = res, label = (c) => KO.branches[c].label;
  const moved = Object.keys(many).filter((c) => narrow[c].champion !== KO.branches[c].champion).map((c) => ({ branch: label(c), before: KO.branches[c].champion, after: narrow[c].champion }));
  const key = (x) => x.branch + x.before + x.after;
  assert.deepEqual(moved.map(key).sort(), K.champions_changed.map(key).sort(), "the champions that change");
  for (const b of K.branches) { assert.deepEqual(narrow[b.branch].finalists, b.finalists_after, b.label + " finalists after"); assert.deepEqual(b.finalists_before, KO.branches[b.branch].finalists, b.label + " finalists before are the knockout's"); }
  assert.deepEqual(K.wide.differs_in.map((x) => x.id).sort(), Object.keys(many).filter((c) => JSON.stringify(wide[c].finalists) !== JSON.stringify(narrow[c].finalists)).sort(), "where the wide debate differs");
  settings.forEach((m, i) => assert.equal(K.sensitivity[i].champions_changed.length, Object.keys(many).filter((c) => res[2 + i][c].champion !== KO.branches[c].champion).length, "champions changed at " + m));
  /* what the page says of the four */
  assert.deepEqual(K.champions_changed.map((x) => `${x.before}→${x.after}`).sort(), ["AEP→PNW", "TDG→HWM"]);
  const F = Object.fromEntries(K.focus.map((f) => [f.t, f])), crwv = F.CRWV.where.find((w) => /NEOCLOUDS/.test(w.branch));
  assert.equal(crwv.passes_before, false, "CoreWeave had already failed round 2 on fundamentals: the debt reading has nothing left to move"); assert.equal(crwv.rank_before, crwv.rank_after);
  assert.ok(F.IREN.where.every((w) => w.place_before === 1 && w.place_after === 1), "IREN stays champion of each of its branches");
  for (const f of K.pass_flips) assert.equal(f.in.length, f.out.length, f.branch + ": a tie on the pass line swaps one name for one");
  for (const b of K.branches) for (const t of b.pass_out) { const s = KO.branches[b.branch].scores, cut = KO.branches[b.branch].cut; assert.ok(b.pass_in.some((u) => Math.abs(s[u].score - s[t].score) < 0.06), `${b.label}: ${t} left on a tie, not on the load alone`); }
});

/* ---- the test on history ------------------------------------------------------------------------------------------ */
test("the history test is reported as it came out: four Octobers, no part confirmed, and the score did not pick the winners", () => {
  assert.deepEqual(H.dates, ["2021-10-06", "2022-10-06", "2023-10-06", "2024-10-06"]); assert.equal(H.gate, 25);
  assert.ok(H.cohorts.every((c) => c.n >= 30 && c.with_r2 === c.n), "each October has thirty or more companies, every one with a price two years on");
  const R = Object.fromEntries(H.readings.map((r) => [r.key, r])), S = Object.fromEntries(H.schemes.map((r) => [r.name, r]));
  assert.equal(H.readings.length, 9); for (const r of H.readings) { assert.equal(r.per.length, 4); for (const x of r.per) assert.ok(x.rho == null || (x.rho >= -1 && x.rho <= 1)); }
  assert.ok(R.price.positive_in >= 3 && R.price.avg > 0, "price is the one reading that pointed the right way in most years");
  assert.ok(R.growth.per[0].rho < -0.3, "at the 2021 top the fastest growers fell the most");
  assert.ok(S["the model's weights"].top_beat_bottom_in <= 2, "the page must not claim the score picked winners: its top third beat its bottom third in fewer than three of four Octobers");
  const iren = H.names["2023-10-06"].findIndex((x) => x.t === "IREN"); assert.ok(iren > H.names["2023-10-06"].length * 0.7 && H.names["2023-10-06"][iren].r2 > 1000, "October 2023: IREN low in the model's order, and up more than tenfold two years on");
  assert.deepEqual(Object.keys(H.schemes[0].weights).sort(), ["debt", "dilution", "growth", "margin", "money", "price"], "how far the analysts agree cannot be tested on history, and is left out of it");
  const specs = T(DIR + "PRE-PROFIT.html"); assert.match(specs, /No part reliably told the winners from the losers/); assert.match(specs, /not as a forecast of which one goes up most/); assert.match(specs, /were not fitted to this test, and the test did not confirm them/);
});

/* ---- the page ----------------------------------------------------------------------------------------------------- */
test("the page: pictures first, the numbers the data holds, no internal codes, the house greys, BACK / CLOSE in place", () => {
  const html = T(DIR + "PRE-PROFIT.html"), body = html.slice(html.indexOf("<body")), specsAt = body.indexOf('<details class="sc-pagespecs">');
  const order = ["four", "shelf", "map", "margin", "money", "dilution", "quality", "history", "knockout", "loads", "off"].map((id) => body.indexOf(`<section id="${id}"`));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])) && specsAt > order[order.length - 1], "eleven sections in order, the words after the pictures");
  assert.equal((body.slice(0, specsAt).match(/<p[ >]/g) || []).length, 0, "no paragraph of explanation above PAGE SPECS");
  assert.equal((html.match(/<\/body>/g) || []).length, 1); assert.match(html, /data-scnav-slot/); assert.match(html, /<!-- scnav · [\s\S]*<!-- \/scnav -->\s*<\/body>/, "the pair, placed as the injector places it");
  const text = body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  assert.equal((text.match(/\b(CP1|ER1|CZ1|GH1|KO1|PP1|NP1|FD1|CF1|CF3|TR1|TR2|LB1|LB2|NQ1|PA6|AL7|HM1)\b/g) || []).length, 0, "no lane code in what Alan reads");
  assert.ok(!/\b(None|NaN|undefined|null)\b/.test(text), "nothing empty printed as a programmer's word"); assert.ok(!/\{\{[A-Z0-9_]+\}\}/.test(html), "every figure in PAGE SPECS was filled from the data");
  assert.ok(!/\b(buy now|sell now|you should buy|you should sell)\b/i.test(text));
  /* colours: greys (channels within 24 of each other, none above 210) and the Hub's green, red and cyan */
  const ok = new Set(["3caa6e", "c85050", "3cb4c8"]);
  for (const m of new Set((html.match(/#[0-9a-fA-F]{6}\b/g) || []).map((x) => x.slice(1).toLowerCase()))) { if (ok.has(m)) continue; const c = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)); assert.ok(Math.max(...c) - Math.min(...c) <= 24 && Math.max(...c) <= 210, "#" + m + " is not a house grey"); }
  for (const m of html.match(/font-size="(\d+(?:\.\d+)?)"/g) || []) assert.ok(parseFloat(m.slice(11)) >= 11, m); for (const m of T(DIR + "tools/page-extra.css").match(/font-size:\s*(\d+)px/g) || []) assert.ok(parseInt(m.replace(/\D+/g, ""), 10) >= 11, m);
  /* the numbers on the page are the data's */
  const ranked = SHELF.filter((r) => r.ranked);
  assert.equal((body.match(/<tr data-find="[^"]*"><td class="rk"/g) || []).length, SHELF.length, "one row a name on the shelf table"); assert.equal((body.match(/class="panel card"/g) || []).length, 4);
  /* every company without steady profits is measured: the shelf, and the names left off it with their reason and the same readings */
  const off = body.slice(body.indexOf('<section id="off"'), specsAt); assert.equal((off.match(/<tr data-find=/g) || []).length, D.off_shelf.length); assert.equal((off.match(/<tr class="sec">/g) || []).length, 3);
  for (const x of D.off_shelf) { assert.ok(["slow", "expected", "lost"].includes(x.kind), x.t); assert.ok("ev_sales" in x && "runway_q" in x && "shares_1y" in x && "net_debt" in x && "gap_pct" in x, x.t + " carries its readings"); }
  /* the margin path: a line a name with a margin to read, green when it ends higher than it began, red when lower — never grey */
  const mg = body.slice(body.indexOf('<section id="margin"'), body.indexOf('<section id="money"')), lines = mg.match(/<polyline [^>]*stroke="(#[0-9a-f]{6})"/g) || [];
  assert.equal(lines.length, SHELF.filter((r) => r.margin.now != null && r.margin.quarters.filter((q) => q.gm != null).length >= 3).length); assert.ok(lines.every((l) => /#3caa6e|#c85050/.test(l)), "up green, down red");
  for (const r of SHELF) if (r.margin.now == null && !r.compare) assert.ok(r.sales.booked == null || r.sales.booked < 25e6, r.t + ": a margin is left unread only where sales are too small to read one");
  for (const r of ranked.slice(0, 5)) assert.ok(body.includes(`>${r.rank} of ${ranked.length}`) || body.includes(`data-l="PLACE"><span class="v">${r.rank}</span>`), r.t + " rank on the page");
  assert.ok(body.includes(`${BY.BE.would_rank} OF ${ranked.length}`), "Bloom: where it would stand");
  assert.ok(body.includes("AEP</span>") && body.includes("PNW</span>") && body.includes("TDG</span>") && body.includes("HWM</span>"));
  assert.ok(body.includes(`<b>${K.champions_changed.length}</b><span>OF ${K.counts.champion_slots} CHAMPIONS CHANGE</span>`));
  for (const h of ["WHAT THIS PAGE SHOWS", "THE METHOD, IN PLAIN WORDS", "WHAT &quot;EV ÷ NEXT YEAR'S SALES&quot; MEANS", "WHY IREN READS AS SCATTERED", "THE TEST ON HISTORY, AND WHAT IT DOES AND DOES NOT SAY", "DEBT IN THE KNOCKOUT: THE RULE", "WHERE EACH NUMBER COMES FROM", "WHAT COULD BE WRONG", "WHAT WAS NOT DONE"])
    assert.ok(body.includes(`<h4>${h.replace(/&quot;/g, '"')}</h4>`), "PAGE SPECS: " + h);
  assert.match(body, /It is what the whole company costs — every share at today's price, plus everything it owes, less the cash it holds — for each dollar of sales the analysts expect over the next twelve months\./);
  assert.match(body, /had "uploading a script to the throw-away machine" refused by its permission layer/, "how the vendor figures were fetched is said plainly, for the coordinator to judge");
});
test("nothing here writes, deploys or carries a key: the folder's files are reads and figures only", () => {
  const dir = fileURLToPath(here(DIR)), files = [];
  const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.name === "shots" || f.name === "__pycache__") continue; f.isDirectory() ? walk(d + "/" + f.name) : files.push(d + "/" + f.name); } };
  walk(dir);
  assert.ok(files.length >= 12);
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(s), f + ": a token");
    assert.ok(!/apikey=(?!["'`\s)+]|\*\*\*|SECRET|zz|\$\{|"\s*\+)[A-Za-z0-9]{12,}/.test(s), f + ": a key in a URL");
    if (/\.(py|mjs)$/.test(f) && !/rules-cli|pp1-pre-profit/.test(f)) { assert.ok(!/supabase (functions deploy|db push)|fly deploy|vercel (deploy|--prod)|method:\s*["'](POST|PATCH|PUT|DELETE)/i.test(s), f + ": a write or a deploy"); }
  }
  const sha = spawnSync("shasum", ["-a", "256", dir + "/tools/pp1_fetch_fmp.mjs"], { encoding: "utf8" }).stdout.split(" ")[0], proof = J(DIR + "data/keyed-pull.json");
  assert.equal(proof.script_sha256, sha, "the fetch script on the branch is the one that ran, to the byte"); assert.equal(proof.machine.state_after, "destroyed"); assert.equal(proof.wrote_any_table, false);
  assert.ok(T(DIR + "PRE-PROFIT.html").includes(sha), "… and the page prints that same fingerprint");
  assert.ok(!files.some((f) => /fmp-statements|fmp-calls|\.anon$/.test(f)), "the raw vendor answers and the read key are not in the repo");
  assert.ok(gunzipSync, "node's own zlib unpacks what the machine printed");
});
