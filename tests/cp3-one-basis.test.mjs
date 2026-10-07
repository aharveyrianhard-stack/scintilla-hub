/* CP3 (7 Oct 2026) · ONE FORWARD P/E EVERYWHERE.
   Alan: "Why is there inconsistencies everywhere on the forward P/E … I see on the dashboard Google 24.1×, Amazon 25.4×,
   Micron 5.9× … if that's the right one, it should be everywhere."
   These tests hold four surfaces of this repo to one multiple for thirty names, each through ITS OWN code on the same rows:
     the dashboard   index.html's own functions, cut out of the page as they stand (tools/dashboard-code.mjs)
     the COMPS tab   the comps reader (cohort.mjs readCohort → snapshotFromCohort), which every comps tab draws from
     the card        deliverables/20261007/one-basis/data/cards.json, built from that same snapshot
     the feed        supabase/functions/comps-feed (buildFeed), the CSV the allocation tool reads
   The fifth surface, the allocation tool, prints the card's and the feed's figure; its own repo tests that
   (tests/cp3-one-basis.spec.mjs there) against the same expected table. The fixture is real rows read on 7 Oct. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import * as FB from "../lib/forward-basis.mjs";
import { debtReading, DEBT_STEPS, DEBT_TOP } from "../lib/debt-reading.mjs";
import { dashboardPrints } from "../deliverables/20261007/one-basis/tools/dashboard-code.mjs";
import { buildFeed, VERSION, forwardEps as feedForwardEps } from "../supabase/functions/comps-feed/feed.mjs";
import { readCohort, snapshotFromCohort, FORWARD_DEFAULT } from "../deliverables/20261001/comps-template/cohort.mjs";
import { localPg } from "../deliverables/20261007/knockout/tools/local-pg.mjs";
import { CP3_STATED, CP3_LINES_ON } from "../deliverables/20261003/comps-c5/lines.mjs";
import { CP3_ALL, EVERY_LINE_MIN, businessOf, setCheck, SIZE_OFF, SIZE_SPREAD } from "../deliverables/20261005/comps-c6/outliers.mjs";

const R = (p) => new URL(p, import.meta.url), J = (p) => JSON.parse(fs.readFileSync(R(p), "utf8"));
const PAGE = fs.readFileSync(R("../index.html"), "utf8"), FX = J("./fixtures/cp3-one-basis-20261007.json"), T = FX.tables, TODAY = FX.today;
const CARDS = J("../deliverables/20261007/one-basis/data/cards.json"), DATA = J("../deliverables/20261007/one-basis/data/one-basis.json");
const quarters = (t) => T.analyst_estimates.filter((r) => r.period === "quarter" && (!t || r.ticker === t));
const q = (date, eps, rev = null, n = 5) => ({ period: "quarter", fiscal_date: date, est_eps_avg: eps, est_revenue_avg: rev, num_analysts_eps: n });
const y = (date, eps, rev = null) => ({ period: "annual", fiscal_date: date, est_eps_avg: eps, est_revenue_avg: rev });

/* ---- the thirty names ---------------------------------------------------------------------------------------------- */
test("thirty names: the dashboard, the COMPS tab, the decision card and the feed print ONE forward multiple, each through its own code", async () => {
  assert.equal(FX.names.length, 30);
  const dash = dashboardPrints(PAGE, { rows: T.analyst_estimates, prices: FX.closes, today: TODAY, events: T.earnings_events, pairQuarters: quarters() });
  const feed = Object.fromEntries(buildFeed(FX.names, { fundamentals: T.fundamentals, profiles: T.company_profile, history: [], ratios: [], estimates: T.analyst_estimates.filter((r) => r.fiscal_date >= TODAY), filers: T.filer_currency, fx: T.fx_rates, events: T.earnings_events, pairQuarters: quarters() }, TODAY).rows.map((r) => [r.sym, r]));
  const ctx = await readCohort({ ticker: "GOOGL", today: TODAY, pg: localPg(T), quotes: async (S) => ({ quotes: Object.fromEntries(S.map((t) => [t, { price: FX.closes[t], price_observation_utc: TODAY + "T20:00:00Z" }])) }), membersAsked: FX.names, labelAsked: "thirty" });
  assert.equal(ctx.forward, "next-four-quarters"); assert.equal(FORWARD_DEFAULT, "next-four-quarters", "the comps reader's default IS the dashboard's basis");
  let multiples = 0;
  for (const t of FX.names) {
    const s = snapshotFromCohort(ctx, t), row = s.rows.find((r) => r.key === "pe_fwd"), conv = !!(s.fwd && s.fwd.rate);
    const tab = row.own.multiple == null ? "—" : FB.multipleText(row.own.multiple, conv), fd = feed[t].fwd_pe == null ? "—" : FB.multipleText(feed[t].fwd_pe, conv);
    const card = CARDS.cards[t] ? CARDS.cards[t].fundamentals.fwd_pe_text : DATA.others[t] ? DATA.others[t].own.pe_fwd_text : null;
    assert.equal(dash[t].text, FX.expected[t], t + ": the dashboard's own code on these rows");
    assert.equal(tab, dash[t].text, `${t}: COMPS tab ${tab} against the dashboard's ${dash[t].text}`);
    assert.equal(fd, dash[t].text, `${t}: feed ${fd} against the dashboard's ${dash[t].text}`);
    assert.equal(card, dash[t].text, `${t}: card ${card} against the dashboard's ${dash[t].text}`);
    if (dash[t].pe != null) { multiples++; assert.ok(Math.abs(row.own.multiple / dash[t].pe - 1) < 1e-9, t + ": the same number, not only the same rounding"); assert.ok(Math.abs(feed[t].fwd_pe / dash[t].pe - 1) < 1e-9, t + ": the feed's cell too"); }
  }
  assert.ok(multiples >= 27, "nearly every name carries a multiple: " + multiples);
  /* the numbers Alan read on the dashboard (he quoted them live on 7 Oct; these are on the 6 Oct close) */
  assert.deepEqual(["GOOGL", "AMZN", "AVGO", "NVDA", "MU", "VST", "ORCL", "TSM"].map((t) => FX.expected[t]), ["24.2×", "25.7×", "21.6×", "19.9×", "6.0×", "15.6×", "17.0×", "≈23.1×"]);
  for (const t of ["NBIS", "IREN", "CRWV"]) assert.equal(FX.expected[t], "—", t + " has no earnings expected: a dash on every surface, never a number");
  assert.equal(DATA.test30_agree, 30); assert.equal(DATA.test30.length, 30);
});
test("what they printed before: three different multiples for Alphabet — 24.2× on the dashboard, 16.9× in the comps, 21.2× on its card", () => {
  const g = DATA.test30.find((r) => r.ticker === "GOOGL");
  assert.equal(g.dashboard, "24.2×"); assert.equal(g.was_fiscal_year, "16.9×"); assert.equal(g.was_card, "21.2×"); assert.equal(g.was_fiscal_year_date, "2026-12-31");
  const a = DATA.test30.find((r) => r.ticker === "AVGO"); assert.equal(a.dashboard, "21.6×"); assert.equal(a.was_fiscal_year, "32.2×", "a fast grower looked dearer on the fiscal year");
  assert.ok(DATA.test30.filter((r) => r.was_fiscal_year !== r.dashboard).length >= 25, "the fiscal-year multiple differed for nearly every name");
});
test("the comps reader can still be asked for the old basis: forward \"fiscal-year\" answers as before CP3", async () => {
  const pg = localPg(T), quotes = async (S) => ({ quotes: Object.fromEntries(S.map((t) => [t, { price: FX.closes[t], price_observation_utc: TODAY + "T20:00:00Z" }])) });
  const old = await readCohort({ ticker: "GOOGL", today: TODAY, pg, quotes, membersAsked: ["GOOGL", "AVGO", "MU"], labelAsked: "x", forward: "fiscal-year" });
  assert.equal(old.forward, "fiscal-year"); const s = snapshotFromCohort(old, "GOOGL"), fy = T.analyst_estimates.filter((r) => r.ticker === "GOOGL" && r.period === "annual" && r.fiscal_date >= TODAY).sort((a, b) => a.fiscal_date.localeCompare(b.fiscal_date))[0];
  assert.equal(s.eps_fy1, fy.est_eps_avg); assert.ok(Math.abs(s.rows.find((r) => r.key === "pe_fwd").own.multiple - 347.68 / fy.est_eps_avg) < 1e-9); assert.equal(s.fwd, null);
  const now = await readCohort({ ticker: "GOOGL", today: TODAY, pg, quotes, membersAsked: ["GOOGL", "AVGO", "MU"], labelAsked: "x" }), n = snapshotFromCohort(now, "GOOGL");
  assert.equal(n.eps_fy1_annual, fy.est_eps_avg, "the fiscal-year figure is kept beside the new one"); assert.ok(Math.abs(n.pe_fwd_annual - 16.87) < 0.01); assert.match(n.fwd.label, /^next four quarters to 2027-09-30$/);
  /* PEG is that forward P/E over growth into the following year: one number for "P/E ÷ growth" */
  const peg = n.rows.find((r) => r.key === "peg").own.multiple, pe = n.rows.find((r) => r.key === "pe_fwd").own.multiple, g = n.table.company.eps_g_fy;
  assert.ok(Math.abs(g - 15.4) < 0.1, "Alphabet's growth into the following year: " + g); assert.ok(Math.abs(peg - pe / g) < 1e-9); assert.ok(Math.abs(peg - 1.58) < 0.01);
});

/* ---- the rule, case by case, and the dashboard's own code held to it --------------------------------------------- */
test("the rule: four quarters summed; fewer than four → the nearest fiscal year; four that sum to zero or less → no multiple and no swap; under 2.5× withheld", () => {
  const four = [q("2026-12-31", 1), q("2027-03-31", 1.5), q("2027-06-30", 2), q("2027-09-30", 2.5), q("2027-12-31", 3), y("2026-12-31", 99), y("2027-12-31", 9)];
  const b = FB.forwardBasis(four, "2026-10-07"); assert.equal(b.eps, 7); assert.equal(b.basis, "next four quarters"); assert.equal(b.through, "2027-09-30");
  assert.equal(FB.forwardMultiple(140, b).text, "20.0×");
  const three = FB.forwardBasis(four.filter((r) => r.fiscal_date !== "2027-09-30" && r.fiscal_date !== "2027-12-31"), "2026-10-07");
  assert.equal(three.basis, "fiscal year"); assert.equal(three.eps, 99); assert.ok(three.flags.some((f) => f.code === "fiscal-year-basis"));
  const loss = FB.forwardBasis([q("2026-12-31", -1), q("2027-03-31", -1), q("2027-06-30", 0.5), q("2027-09-30", 0.5), y("2026-12-31", 4)], "2026-10-07");
  assert.equal(loss.eps, -1); const m = FB.forwardMultiple(50, loss); assert.equal(m.pe, null); assert.equal(m.text, "—"); assert.match(m.why, /not positive/);
  assert.equal(FB.forwardMultiple(10, b).pe, null, "10 ÷ 7 = 1.4×: a wrong-basis estimate, withheld"); assert.equal(FB.forwardMultiple(17.5, b).text, "2.5×");
  assert.equal(FB.forwardBasis([], "2026-10-07"), null); assert.equal(FB.forwardMultiple(100, null).text, "—");
  /* the dashboard reads the quarters ending within fifteen months: a fourth quarter beyond that does not count */
  const far = FB.forwardBasis([q("2026-12-31", 1), q("2027-03-31", 1), q("2027-06-30", 1), q("2028-06-30", 1), y("2026-12-31", 5)], "2026-10-07"); assert.equal(far.basis, "fiscal year");
  /* the same estimate handed twice (two reads joined) is counted once */
  assert.equal(FB.forwardBasis([...four, ...four], "2026-10-07").eps, 7);
});
test("one currency: a foreign reporter's EPS takes the supplier's paired rate; no agreeing pair → withheld and named, never mixed", () => {
  const b = FB.forwardBasis(quarters("TSM").concat(T.analyst_estimates.filter((r) => r.ticker === "TSM" && r.period === "annual")), TODAY);
  const pair = FB.estFxPair(T.earnings_events.filter((r) => r.ticker === "TSM"), quarters("TSM"));
  assert.ok(pair && pair.f > 0.03 && pair.f < 0.033, "Taiwan dollars to dollars, from the supplier's own two estimates: " + (pair && pair.f)); assert.ok(Math.abs(pair.fxE / pair.fxR - 1) <= FB.FX_TOL);
  const m = FB.forwardMultiple(FX.closes.TSM, b, { ccy: "TWD", fx: pair }); assert.equal(m.text, "≈23.1×"); assert.equal(m.converted, true);
  const none = FB.forwardMultiple(FX.closes.TSM, b, { ccy: "TWD", fx: null }); assert.equal(none.pe, null); assert.equal(none.text, "EPS TWD"); assert.match(none.why, /not comparable: EPS in TWD/);
  assert.equal(FB.estFxPair([{ date: "2026-07-16", eps_estimate: 3, revenue_estimate: 40e9 }], [{ fiscal_date: "2026-06-30", est_eps_avg: 100, est_revenue_avg: 1000e9 }]), null, "EPS says 0.030, revenue says 0.040: no rate");
  /* the yuan names in the dry run: converted at their own pair, or left out */
  for (const r of DATA.dry_run.foreign.filter((x) => x.currency === "CNY")) assert.ok(r.rate != null ? (r.rate > 0.13 && r.rate < 0.16) : /^(EPS CNY|—)$/.test(r.prints), r.ticker + " " + JSON.stringify(r));
  assert.ok(DATA.dry_run.foreign.some((r) => r.ticker === "BABA" && r.prints.startsWith("≈")));
});
test("the dashboard's own code and the shared function agree on 400 made-up companies (the rule is one, wherever it is written)", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, rows = [], prices = {}, today = "2026-10-07";
  const ends = ["2026-10-31", "2026-12-31", "2027-01-31", "2027-03-31", "2027-04-30", "2027-06-30", "2027-07-31", "2027-09-30", "2027-10-31", "2027-12-31", "2028-01-31", "2028-03-31"];
  for (let i = 0; i < 400; i++) { const t = "X" + i, start = Math.floor(rnd() * 3), nq = Math.floor(rnd() * 7), base = (rnd() - 0.15) * 4;
    for (let k = 0; k < nq; k++) rows.push({ ticker: t, ...q(ends[start + k * 2 > 11 ? 11 : start + k * 2] || ends[11], rnd() < 0.05 ? 0 : base * (1 + k * 0.1) + (rnd() - 0.5) * 0.2), updated_ts: 1791000000 });
    if (rnd() < 0.9) { rows.push({ ticker: t, ...y("2026-12-31", rnd() < 0.05 ? null : base * 4), updated_ts: 1791000000 }); rows.push({ ticker: t, ...y("2027-12-31", base * 5), updated_ts: 1791000000 }); }
    prices[t] = rnd() < 0.03 ? null : 5 + rnd() * 300; }
  const dash = dashboardPrints(PAGE, { rows, prices, today }); let withMultiple = 0, fallback = 0;
  for (const t of Object.keys(prices)) { const r = FB.forwardRead({ price: prices[t], rows: rows.filter((x) => x.ticker === t), today });
    assert.equal(r.text, dash[t].text, `${t}: shared ${r.text} · dashboard ${dash[t].text}`);
    if (dash[t].pe != null) { withMultiple++; assert.ok(Math.abs(r.pe / dash[t].pe - 1) < 1e-12); } if (r.basis === "fiscal year") fallback++; }
  assert.ok(withMultiple > 150 && fallback > 60, `a real mix: ${withMultiple} with a multiple, ${fallback} on the fiscal-year fallback`);
});
test("the feed is version 7, its forward column is this rule, and the copy beside the edge function is the shared file to the byte", () => {
  assert.equal(VERSION, "comps-feed-v7");
  assert.equal(fs.readFileSync(R("../supabase/functions/comps-feed/forward-basis.mjs"), "utf8"), fs.readFileSync(R("../lib/forward-basis.mjs"), "utf8"));
  assert.ok(fs.existsSync(R("../supabase/functions/comps-feed/feed.mjs.ROLLBACK-v6-20261007")), "the way back is kept");
  const src = fs.readFileSync(R("../supabase/functions/comps-feed/feed.mjs"), "utf8"); assert.match(src, /import \{ forwardRead, forwardBasis, estFxPair \} from "\.\/forward-basis\.mjs";/); assert.match(src, /fwd_pe: fwd\.pe,/);
  /* the coordinator's 11:04 hot fix named the rule forwardEps() in the feed; merged here, that name answers from the shared rule */
  const g = T.analyst_estimates.filter((r) => r.ticker === "GOOGL"), viaName = feedForwardEps(g, TODAY), shared = FB.forwardBasis(g, TODAY);
  assert.equal(viaName.eps, shared.eps); assert.equal(viaName.fiscal_date, "2027-09-30"); assert.equal(viaName.basis, "next four quarters"); assert.ok(Math.abs(FX.closes.GOOGL / viaName.eps - 24.21) < 0.01);
  assert.match(fs.readFileSync(R("../supabase/functions/comps-feed/index.ts"), "utf8"), /timeZone: "America\/New_York"/, "the feed's today is the dashboard's today");
});

/* ---- growth into the following year, and the bad rows ------------------------------------------------------------- */
test("growth into the following year: the four quarters after the next four over the next four — Alphabet +15%, Broadcom +55%, Nvidia +60%", () => {
  const g = (t) => DATA.test30.find((r) => r.ticker === t);
  for (const [t, lo, hi, peg] of [["GOOGL", 15, 16, 1.58], ["AVGO", 55, 56, 0.39], ["NVDA", 59, 60, 0.33], ["VST", 19.5, 20.5, 0.78], ["MU", 22, 23, 0.27], ["ORCL", 41, 42, 0.41]]) { assert.ok(g(t).growth_pct >= lo && g(t).growth_pct <= hi, `${t} ${g(t).growth_pct}`); assert.ok(Math.abs(g(t).peg - peg) < 0.011, `${t} P/E ÷ growth ${g(t).peg}`); }
  const made = FB.forwardBasis([q("2026-12-31", 1), q("2027-03-31", 1), q("2027-06-30", 1), q("2027-09-30", 1), q("2027-12-31", 1.2), q("2028-03-31", 1.2), q("2028-06-30", 1.2), q("2028-09-30", 1.2)], "2026-10-07");
  assert.ok(Math.abs(made.growth.pct - 20) < 1e-9); assert.equal(made.growth.from, "quarters");
});
test("bad rows are flagged and kept out of growth: Amazon's 2028 quarters add to 23.38 against a yearly 13.86; Equinix's 2028 quarters are zeros", () => {
  const rows = (t) => T.analyst_estimates.filter((r) => r.ticker === t && r.fiscal_date >= TODAY);
  const a = FB.forwardBasis(rows("AMZN"), TODAY), bad = a.reconcile.find((r) => r.fiscal_date === "2028-12-31");
  assert.ok(bad.bad); assert.ok(Math.abs(bad.quarters_eps - 23.38) < 0.01); assert.ok(Math.abs(bad.year_eps - 13.86) < 0.01); assert.equal(a.reconcile.find((r) => r.fiscal_date === "2027-12-31").bad, false);
  assert.ok(Math.abs(a.eps - 9.97) < 0.01, "the next four quarters are sound: the multiple stands"); assert.ok(!a.flags.some((f) => f.code === "next-four-in-a-bad-year"));
  assert.equal(a.growth.from, "years"); assert.ok(a.growth.pct > 25 && a.growth.pct < 36, "+31% from the yearly estimates, not +93% from the bad quarters: " + a.growth.pct); assert.match(a.growth.basis, /FY2027 and FY2028/);
  const naive = rows("AMZN").filter((r) => r.period === "quarter").slice(4, 8).reduce((s, r) => s + r.est_eps_avg, 0) / a.eps - 1; assert.ok(naive > 0.9, "the bad rows said +" + Math.round(naive * 100) + "%");
  const e = FB.forwardBasis(rows("EQIX"), TODAY); assert.equal(e.growth.from, "years"); assert.ok(e.growth.pct > 5 && e.growth.pct < 25, "not −73%: " + e.growth.pct);
  assert.ok(DATA.dry_run.counts.zero_rows > 50 && DATA.dry_run.counts.years_that_do_not_add_up > 50, "the dry run counts them across everything on file"); assert.ok(DATA.dry_run.worst_years.length >= 10);
  const D = J("../deliverables/20261007/one-basis/data/estimate-rows-dry-run.json"); assert.match(D.what, /nothing was written to any table/i); assert.ok(D.years_that_do_not_add_up.some((r) => r.ticker === "AMZN" && r.year === "2028-12-31"));
});
test("a property trust's forward P/E is on reported earnings, not funds from operations: the card says so and prices it on P/FFO", () => {
  assert.ok(DATA.dry_run.reits.some((r) => r.ticker === "DLR" && r.forward_pe_on_eps > 60), "Digital Realty on EPS: " + JSON.stringify(DATA.dry_run.reits.find((r) => r.ticker === "DLR")));
  const dlr = CARDS.cards.DLR; assert.equal(dlr.comps.reit, true); assert.ok(dlr.comps.rows.p_ffo && dlr.comps.rows.p_ffo.own > 5 && dlr.comps.rows.p_ffo.own < 40, "P/FFO " + JSON.stringify(dlr.comps.rows.p_ffo)); assert.ok(dlr.comps.rows.p_ffo.weight > dlr.comps.rows.pe_fwd.weight);
});
test("a company with no quarterly estimates at all (the comps-only reference peers) is read on the next twelve months blended from two fiscal years", () => {
  const rows = [y("2026-12-31", 100), y("2027-12-31", 140), y("2028-12-31", 160)], b = FB.forwardBasis(rows, "2026-10-07", { annual: "blend" }), w = 85 / 365;
  assert.ok(Math.abs(b.eps - (w * 100 + (1 - w) * 140)) < 1e-9); assert.match(b.label, /^next twelve months \(23% FY2026, 77% FY2027\)$/); assert.ok(b.flags.some((f) => f.code === "blended-years"));
  assert.ok(Math.abs(b.growth.pct - ((w * 140 + (1 - w) * 160) / b.eps - 1) * 100) < 1e-9);
  assert.equal(FB.forwardBasis(rows, "2026-10-07").eps, 100, "a served company keeps the dashboard's fallback: the nearest fiscal year");
  const sk = DATA.core.MU.peers.find((p) => p.ticker === "000660.KS"); assert.ok(sk && sk.priced && sk.reference); assert.match(sk.forward.label, /next twelve months/); assert.ok(sk.pe_fwd > 3 && sk.pe_fwd < 5, "SK hynix " + sk.pe_fwd);
});

/* ---- same-business peers --------------------------------------------------------------------------------------------- */
test("the stated sets: each core name is priced on the peers that do the same business, and the others are shown, not priced", () => {
  assert.deepEqual(Object.keys(CP3_STATED).sort(), ["AMZN", "AVGO", "GOOGL", "MU", "NVDA", "ORCL", "TSM", "VST"]);
  assert.equal(CP3_LINES_ON.stated, true); assert.equal(CP3_ALL.stated, true); assert.equal(CP3_ALL.priceOnEveryLine, true); assert.equal(EVERY_LINE_MIN, 4);
  for (const t of Object.keys(CP3_STATED)) { const n = DATA.core[t], priced = n.sets.priced.slice().sort(), stated = CP3_STATED[t].peers.filter((p) => n.peers.some((x) => x.ticker === p && x.has_figures)).sort();
    assert.deepEqual(priced, stated, t + " is priced on its stated peers"); assert.equal(n.runs.cp3.priced_on, "business"); assert.ok(n.sets.old.every((p) => n.sets.now.includes(p)), t + ": no kept peer was removed"); }
  const eq = ["LRCX", "AMAT", "KLAC", "ASML"]; for (const t of ["AVGO", "NVDA"]) assert.ok(!DATA.core[t].sets.priced.some((p) => eq.includes(p)), t + ": the equipment makers do not price it");
  assert.deepEqual(DATA.core.VST.sets.priced.slice().sort(), ["CEG", "NRG", "TLN"]); assert.ok(DATA.core.VST.sets.shown_not_priced.some((p) => ["AEP", "DUK", "XEL", "ETR"].includes(p)), "regulated utilities are shown, not priced");
  assert.deepEqual(DATA.core.MU.sets.priced.slice().sort(), ["000660.KS", "005930.KS", "285A.T", "SNDK", "STX", "WDC"]); assert.deepEqual(Object.keys(DATA.core.AMZN.legs).sort(), ["cloud", "retail and e-commerce"]);
  for (const t of ["DLR", "EQIX"]) assert.equal(DATA.core[t].runs.cp3.priced_on, "business");
  /* every peer row carries the four sources' votes */
  for (const t of Object.keys(DATA.core)) for (const p of DATA.core[t].peers) assert.ok(p.votes && p.votes.n >= 0 && p.votes.n <= 4, t + " " + p.ticker);
  /* the set's own answer when it carries a statement */
  const b = businessOf({ stated: { line: "x" }, kept: [{ ticker: "A", exact: 0, stated: true }, { ticker: "B", exact: 0.9, stated: false }, { ticker: "C", exact: 0, stated: true }] }, ["A", "B", "C"]);
  assert.deepEqual(b.same, ["A", "C"]); assert.equal(b.stated, true); assert.equal(b.line, "x");
});
test("Micron with the three foreign memory leaders priced in: the +99% does not stand", () => {
  const mu = DATA.core.MU; assert.equal(mu.forward.text, "6.0×");
  assert.ok(mu.runs.live.upside_pct > 250, "as the comps system stands (chip designers and equipment): " + mu.runs.live.upside_pct);
  assert.ok(mu.runs.cp3.upside_pct > 0 && mu.runs.cp3.upside_pct < 30, "on six memory and storage makers: " + mu.runs.cp3.upside_pct);
  assert.ok(mu.sits.pe_fwd.median > 4 && mu.sits.pe_fwd.median < 8, "the peers' forward P/E: " + mu.sits.pe_fwd.median);
  for (const t of ["000660.KS", "005930.KS", "285A.T"]) { const p = mu.peers.find((x) => x.ticker === t); assert.ok(p.priced && p.pe_fwd > 3 && p.pe_fwd < 5 && p.pe_fwd_text.startsWith("≈"), t + " " + p.pe_fwd_text); }
});

/* ---- debt -------------------------------------------------------------------------------------------------------------- */
test("the debt reading: net debt ÷ EBITDA with its word and its points; interest cover is said to be not on file, never guessed", () => {
  const d = (nd, eb, more = {}) => debtReading({ net_debt: nd, ebitda: eb, ...more });
  assert.deepEqual([d(-5, 10).word, d(5, 10).word, d(20, 10).word, d(35, 10).word, d(50, 10).word, d(70, 10).word, d(5, -1).word], ["net cash", "light", "moderate", "heavy", "very heavy", "stretched", "nothing to carry it"]);
  assert.deepEqual([d(-5, 10).points, d(20, 10).points, d(25, 10).points, d(35, 10).points, d(50, 10).points, d(70, 10).points, d(5, -1).points], [0, 0, 0, 0.03, 0.06, 0.10, 0.10]);
  assert.equal(d(50, 10, { financial: true }).points, 0); assert.equal(d(50, 10, { financial: true }).word, "not read");
  assert.equal(d(5, 10).interest_cover, null); assert.match(d(5, 10).interest_cover_why, /not on file/); assert.equal(d(5, 10, { operating_income: 8, interest_expense: 2 }).interest_cover, 4);
  assert.equal(d(20, 10, { total_debt: 30, fcf: 6 }).debt_fcf_years, 5); assert.match(d(1, 100, { operating_income: 30 }).warn, /3\.3 times operating income/);
  /* the knockout's steps are these steps */
  const py = fs.readFileSync(R("../deliverables/20261007/knockout/tools/rounds.py"), "utf8"), m = /DEBT_STEPS = \(\(([\d.]+), ([\d.]+)\), \(([\d.]+), ([\d.]+)\), \(([\d.]+), ([\d.]+)\)\); DEBT_TOP = ([\d.]+)/.exec(py);
  assert.ok(m, "rounds.py names the steps"); assert.deepEqual([[+m[1], +m[2]], [+m[3], +m[4]], [+m[5], +m[6]]], DEBT_STEPS); assert.equal(+m[7], DEBT_TOP);
  /* every card carries the reading */
  assert.equal(Object.keys(CARDS.cards).length, 27); for (const [t, c] of Object.entries(CARDS.cards)) { assert.ok(c.debt && typeof c.debt.word === "string", t + " has a debt reading"); assert.ok("interest_cover_why" in c.debt); }
  assert.equal(CARDS.cards.VST.debt.word, "heavy"); assert.ok(Math.abs(CARDS.cards.VST.debt.net_debt_ebitda - 3.0) < 0.2); assert.equal(CARDS.cards.MU.debt.word, "net cash"); assert.equal(CARDS.cards.JPM.debt.word, "not read");
  assert.ok(CARDS.cards.DLR.debt.net_debt_ebitda > 4 && CARDS.cards.EQIX.debt.net_debt_ebitda > 4); assert.ok(CARDS.cards.CRWV.debt.net_debt_ebitda > 10, "CoreWeave: " + CARDS.cards.CRWV.debt.net_debt_ebitda);
});
test("debt in the knockout bites only in the debate: it never changes who passes, and it can reorder the names that did", () => {
  const code = `import json,sys; sys.path.insert(0, sys.argv[1]); import rounds as R
mk=lambda t,v,nd,**k: dict({"t":t,"g1_rev":v,"g1_eps":v,"g2_rev":v,"g2_eps":v,"comps":v,"comps_strength":1,"revisions":v,"cash":v,"pctl":50,"nd_ebitda":nd,"net_debt":nd*10,"ebitda_ttm":10},**k)
rows=[mk("AHEAD",40,0.2),mk("GEARED",21,7.0),mk("CLEAN",20,0.5),mk("MID",10,3.0),mk("M2",8,1.0),mk("M3",5,1.0),mk("WEAK",1,9.0),mk("BANK",2,9.0,financial=True)]
import copy; a=R.score_branch(copy.deepcopy(rows)); b=R.score_branch(copy.deepcopy(rows),debt=True)
print(json.dumps({"a":{"order":a["order"],"pass":sorted(r["t"] for r in a["rows"] if r["passes"]),"fin":a["finalists"]},"b":{"order":b["order"],"pass":sorted(r["t"] for r in b["rows"] if r["passes"]),"fin":b["finalists"],"moved":b["debt_moved"],"pen":{r["t"]:r.get("debt_penalty") for r in b["rows"]}},
 "p":[R.debt_penalty(1.0)[0],R.debt_penalty(3.0)[0],R.debt_penalty(5.0)[0],R.debt_penalty(8.0)[0],R.debt_penalty(None,-5,10)[0],R.debt_penalty(None,5,-1)[0],R.debt_penalty(8.0,exempt=True)[0]]}))`;
  const o = JSON.parse(execFileSync("python3", ["-c", code, fs.realpathSync(R("../deliverables/20261007/knockout/tools/"))], { encoding: "utf8" }));
  assert.deepEqual(o.p, [0, 0.03, 0.06, 0.10, 0, 0.10, 0]);
  assert.deepEqual(o.a.pass, o.b.pass, "the same names pass with and without debt"); assert.deepEqual(o.a.fin, ["AHEAD", "GEARED", "CLEAN"]); assert.deepEqual(o.b.fin, ["AHEAD", "CLEAN", "GEARED"], "the geared name loses the place it held by a hair; it is still a finalist, and still passes");
  assert.ok(o.b.moved.length >= 1); assert.equal(o.b.pen.GEARED, 0.10); assert.equal(o.b.pen.CLEAN, 0); assert.equal(o.b.pen.MID, 0.03); assert.equal(o.b.pen.WEAK, null, "a name that did not pass is not debated");
  /* on the real universe: the knockout is reproduced on the old basis, then re-run */
  const K = DATA.knockout; assert.equal(K.reproduced.same_champions, K.reproduced.of, "published champions reproduced before anything was changed"); assert.ok(K.names_run > 430);
  assert.ok(K.penalised.length > 20 && K.penalised.every((p) => p.points > 0)); assert.ok(K.moved_5 > 100, "the basis alone moves " + K.moved_5 + " comps numbers by more than five points");
});

/* ---- the cards and the page -------------------------------------------------------------------------------------------- */
test("the cards keep what they carried (technicals, risk, the plan) and take the new forward figures, comps, peers and debt", () => {
  const OLD = J("../deliverables/20261006/decision-cards/data/cards.json");
  for (const [t, o] of Object.entries(OLD.cards)) { const c = CARDS.cards[t]; { const { long_term_channel, ...kept } = c.technicals; assert.deepEqual(kept, o.technicals, t + ": what the card carried is untouched; the long-term channel is added beside it"); } assert.deepEqual(c.risk, o.risk, t); assert.deepEqual(c.plan, o.plan, t); assert.equal(c.price, o.price); assert.equal(c.fundamentals.rev_g_ntm, o.fundamentals.rev_g_ntm);
    assert.equal(c.fundamentals.fwd_pe_was.card_blend, o.fundamentals.fwd_pe ?? null); assert.ok(Array.isArray(c.peers) && c.peers.length >= 2, t + " carries its peers"); }
  assert.ok(CARDS.cards.TSM, "TSMC, on the radar, has a card"); assert.equal(CARDS.cards.TSM.fundamentals.fwd_pe_text, "≈23.1×"); assert.equal(CARDS.as_of.card_date, "2026-10-06"); assert.equal(CARDS.as_of.repriced, "2026-10-07");
  const g = CARDS.cards.GOOGL; assert.equal(g.fundamentals.fwd_pe_text, "24.2×"); assert.ok(Math.abs(g.fundamentals.fwd_pe_was.on_the_fiscal_year - 16.87) < 0.01); assert.ok(Math.abs(g.fundamentals.fwd_pe_was.card_blend - 21.15) < 0.01);
  assert.deepEqual(g.comps.peers_priced.slice().sort(), ["AMZN", "APP", "META", "MSFT", "PINS", "RDDT", "SNAP"]); assert.ok(g.comps.low < g.comps.centre && g.comps.centre < g.comps.high);
  for (const p of g.peers.filter((x) => x.priced)) assert.ok(p.pe_fwd_text && p.votes != null, p.ticker);
});

/* ---- the page for Alan ----------------------------------------------------------------------------------------------- */
test("the page: pictures first, the thirty rows with no cell that differs, ten core panels, BACK / CLOSE, greys only, 11px or more, no internal code, nothing sideways", () => {
  const html = fs.readFileSync(R("../deliverables/20261007/one-basis/ONE-BASIS.html"), "utf8"), facts = J("../deliverables/20261007/one-basis/shots/shots-facts.json");
  assert.match(html, /<title>One forward P\/E everywhere · 7 Oct 2026 · Scintilla<\/title>/); assert.match(html, /class="scnav|scnav-css/); assert.match(html, /<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/);
  assert.equal((html.match(/<section id="core-/g) || []).length, 10); for (const t of ["GOOGL", "AMZN", "AVGO", "NVDA", "TSM", "VST", "MU", "ORCL", "DLR", "EQIX"]) assert.ok(html.includes(`<section id="core-${t}"`), t);
  assert.ok(!/class="mx diff"/.test(html), "no surface prints a different multiple for any of the thirty");
  const visible = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  assert.deepEqual(visible.match(/\b(CP[123]|ER1|CZ1|KO1|FD1|PP1|AL[78]|DM[12]|NQ1|C5b?|C6b?)\b/g) || [], [], "no internal code in anything Alan reads");
  assert.ok(!/licensed advisor|not financial advice/i.test(visible)); assert.ok(!/\b(buy now|sell now)\b/i.test(visible));
  for (const w of ["1680", "390"]) { const f = facts[w]; assert.equal(f.sideways, false, w + " does not scroll sideways"); assert.ok(f.smallest_font_px >= 11, w + " smallest text " + f.smallest_font_px); assert.equal(f.scnav, true); assert.deepEqual(f.colours_off_grey, []); assert.deepEqual(f.internal_codes, []);
    assert.deepEqual(f.page_errors, []); assert.equal(f.non_get_blocked, 0); assert.equal(f.requests_off_file, 0); assert.equal(f.rows30, 30); assert.equal(f.cells_that_differ, 0); assert.equal(f.core_panels, 10); assert.ok(f.images.length >= 6 && f.images.every((i) => i.ok), "the tool's pictures load"); }
  for (const f of ["1680-00-first-screen.png", "390-00-first-screen.png", "1680-04-core-GOOGL.png", "390-10-core-MU.png", "1680-18-tool.png"]) assert.ok(fs.statSync(R("../deliverables/20261007/one-basis/shots/" + f)).size > 20000, f);
});

/* ---- the coordinator's steering of 11:20 ET, 7 Oct (Alan's further points) --------------------------------------------- */
test("Micron three ways: US-listed peers only, plus SK hynix, plus all three foreign makers — and the same for the rest of its line", () => {
  const w = CARDS.cards.MU.comps.three_ways;
  assert.deepEqual(w.us_listed_only.peers.slice().sort(), ["SNDK", "STX", "WDC"]); assert.deepEqual(w.plus_sk_hynix.peers.slice().sort(), ["000660.KS", "SNDK", "STX", "WDC"]); assert.equal(w.all_three.peers.length, 6);
  assert.ok(w.us_listed_only.upside_pct > 80 && w.us_listed_only.upside_pct < 100, "US-listed only: " + w.us_listed_only.upside_pct);
  assert.ok(w.plus_sk_hynix.upside_pct > 40 && w.plus_sk_hynix.upside_pct < 60, "+ SK hynix: " + w.plus_sk_hynix.upside_pct);
  assert.ok(w.all_three.upside_pct > 5 && w.all_three.upside_pct < 20, "+ all three: " + w.all_three.upside_pct); assert.equal(w.all_three.upside_pct, CARDS.cards.MU.comps.upside_pct);
  assert.ok(w.us_listed_only.pe_fwd_median > w.plus_sk_hynix.pe_fwd_median && w.plus_sk_hynix.pe_fwd_median > w.all_three.pe_fwd_median, "each foreign maker pulls the peers' forward P/E down");
  for (const t of ["SNDK", "WDC", "STX"]) assert.ok(CARDS.cards[t].comps.three_ways && CARDS.cards[t].comps.three_ways.all_three.peers.length === 6, t);
  assert.equal(CARDS.cards.GOOGL.comps.three_ways, null, "a name with no foreign reference peer has one reading");
});
test("\"ratios are ratios — do the currency\": the Chinese names price Amazon, converted; TSMC's revenue on the dashboard is in dollars at the rate its forward P/E uses", () => {
  const amzn = DATA.core.AMZN; for (const t of ["BABA", "JD", "PDD"]) { assert.ok(amzn.sets.priced.includes(t), t + " prices Amazon"); const p = amzn.peers.find((x) => x.ticker === t); assert.ok(p.priced && p.pe_fwd_text.startsWith("≈") && p.pe_fwd > 5 && p.pe_fwd < 15, t + " " + p.pe_fwd_text); assert.equal(p.currency, "CNY"); }
  assert.ok(amzn.legs["retail and e-commerce"].peers.includes("BABA")); assert.ok(amzn.runs.cp3.upside_pct > 10 && amzn.runs.cp3.upside_pct < 40, "Amazon with them in: " + amzn.runs.cp3.upside_pct);
  /* the dashboard's revenue cell, cut out of the page as it stands */
  const fn = (name) => { const i = PAGE.search(new RegExp("^function " + name + "\\b", "m")); assert.ok(i >= 0, name); return PAGE.slice(i, PAGE.indexOf("\n}\n", i) + 3); };
  const fmtCap = (n) => "$" + (n >= 1e12 ? (n / 1e12).toFixed(1) + "T" : (n / 1e9).toFixed(1) + "B"), num = (x) => (x == null ? null : Number(x)), esc = (x) => String(x);
  const kit = (estFx) => new Function("num", "esc", "fmtCap", "estFx", fn("fmtRevCell") + fn("fmtRevLocal") + fn("revTitle") + fn("revUsd") + fn("revCellHTML") + "return { revUsd, revCellHTML };")(num, esc, fmtCap, estFx);
  const withRate = kit((t) => (t === "TSM" ? { f: 0.0315, ccy: "TWD", q: "2026-09-30" } : null)), cell = withRate.revCellHTML("TSM", null, 1791000000, "TWD", 4450400000000, false);
  assert.ok(Math.abs(withRate.revUsd("TSM", null, "TWD", 4450400000000) - 4450400000000 * 0.0315) < 1); assert.match(cell, />≈\$140\.2B<\/span>/); assert.ok(!/is-ccy/.test(cell)); assert.match(cell, /TWD 4\.5T × 0\.03150 = \$140\.2B/); assert.match(cell, /the rate the forward P\/E uses/);
  const noRate = kit(() => null).revCellHTML("TSM", null, 1791000000, "TWD", 4450400000000, false); assert.match(noRate, /class="sc-rev is-ccy"[^>]*>in TWD<\/span>/, "no agreeing rate: withheld and named, as before");
  assert.equal(withRate.revUsd("MU", 133188000000, null, null), 133188000000, "a dollar reporter is untouched"); assert.match(withRate.revCellHTML("MU", 133188000000, 1791000000, null, null, false), />\$133\.2B</);
  assert.match(PAGE, /rev:\s+REVTTM\[m\.ticker\] \? \(REVTTM\[m\.ticker\]\.v != null \? REVTTM\[m\.ticker\]\.v : revUsd\(/, "the board sorts on the dollar figure"); assert.match(fn("fpeRepaint"), /revUsd\(r\.t, null, r\.revCcy, r\.revLocal\)/, "the late rate fills the cell where it stands");
  assert.equal(fs.readFileSync(R("../preview/company-view/index.html"), "utf8").includes("function revUsd(t, v, ccy, local)"), true, "the trial copy was rebuilt from the page");
});
test("every set is checked automatically: fewer than half of the kept peers in the same business, or pricing peers far from its size, is said on the card", () => {
  const mk = (ratio, same) => ({ ticker: "P" + Math.random().toString(36).slice(2, 7), ratio, same_business: same });
  const bad = setCheck({ kept: [mk(1, true), mk(1, true), mk(1, false), mk(1, false), mk(1, false), mk(1, false)] }); assert.equal(bad.business.mostly_different, true); assert.match(bad.flags[0], /only 2 of its 6 peers share its business/);
  assert.deepEqual(setCheck({ kept: [mk(1, true), mk(2, true), mk(0.5, true), mk(1, false)] }).flags, [], "three of four share it and they are its own size: no flag");
  const small = setCheck({ kept: [mk(0.01, true), mk(0.02, true), mk(0.05, true)] }); assert.match(small.flags[0], /the middle one is 1\/50 of its size/); assert.equal(SIZE_OFF, 10);
  const wide = setCheck({ kept: [mk(0.02, true), mk(0.5, true), mk(1, true), mk(4, true)] }); assert.match(wide.flags[0], /run from 1\/50 of its size to 4\.0 times its size/); assert.equal(SIZE_SPREAD, 100);
  assert.equal(setCheck(null), null);
  /* on the real sets: the check would have caught each wrong one, and it says what was done about it */
  for (const [t, same, of, n] of [["MU", 2, 12, 6], ["VST", 4, 12, 3], ["NVDA", 3, 12, 5], ["ORCL", 2, 12, 8]]) { const c = CARDS.cards[t].comps; assert.deepEqual([c.set_check.as_kept.same, c.set_check.as_kept.of], [same, of], t); assert.ok(c.set_check.words.some((w) => w === `set check: only ${same} of the ${of} peers the sources kept share its business — it is priced on the ${n} that do`), t + ": " + c.set_check.words.join(" | ")); assert.ok(c.flags.some((f) => f.startsWith("set check:")), t + " shows it on the card"); }
  assert.ok(CARDS.cards.GOOGL.comps.set_check.words.some((w) => /far from its size — the middle one is 1\/\d+ of its size/.test(w)), "Alphabet's ad-platform peers are a fraction of its size: " + CARDS.cards.GOOGL.comps.set_check.words.join(" | "));
});
test("growth is shown two ways on every card, in words; the growth credit is said whether it applies or not; the blend leads", () => {
  const mu = CARDS.cards.MU.fundamentals; assert.ok(mu.eps_g_reported_to_next_four > 125 && mu.eps_g_reported_to_next_four < 140, "Micron, reported → next four: " + mu.eps_g_reported_to_next_four); assert.ok(mu.eps_g_following_year > 21 && mu.eps_g_following_year < 24);
  assert.ok(Math.abs(mu.eps_g_reported_to_next_four - (mu.eps_next_four_quarters / mu.eps_reported_last_twelve_months - 1) * 100) < 0.2); assert.match(mu.growth_words.reported_to_next, /last twelve months, as reported → the next four quarters/); assert.match(mu.growth_words.next_to_following, /next four quarters → the four after/);
  for (const [t, c] of Object.entries(CARDS.cards)) { assert.ok("eps_g_reported_to_next_four" in c.fundamentals && "eps_g_following_year" in c.fundamentals && c.fundamentals.growth_words, t); assert.ok(c.comps.growth_credit_words == null || /^growth credit/.test(c.comps.growth_credit_words), t); }
  assert.match(CARDS.cards.GOOGL.fundamentals.reported_base_note, /one-off/, "Alphabet's reported year carries paper gains, and the card says so beside the growth from it"); assert.ok(CARDS.cards.GOOGL.fundamentals.eps_g_reported_to_next_four < 0);
  assert.match(CARDS.cards.VST.comps.growth_credit_words, /^growth credit: none — it grows 20% into the following year against its peers' 27%$/, "Vistra against independent power producers: " + CARDS.cards.VST.comps.growth_credit_words);
  assert.match(CARDS.cards.MU.comps.growth_credit_words, /^growth credit ×1\.\d+: it grows 22% into the following year against its peers' 19%/); assert.ok(CARDS.cards.VST.comps.rows.peg.own > 0.7 && CARDS.cards.VST.comps.rows.peg.median < 0.6, "P/E ÷ growth, Vistra against its peers");
  /* every yardstick of the blend is on the card with its weight, and the weights add up */
  for (const t of ["GOOGL", "MU", "VST", "AVGO"]) { const rows = CARDS.cards[t].comps.rows, w = Object.values(rows).reduce((a, r) => a + (r.weight || 0), 0); assert.ok(Object.keys(rows).length >= 6, t); assert.ok(Math.abs(w - 1) < 0.03, t + " weights add to " + w); assert.ok(Object.values(rows).filter((r) => r.weight > 0).length >= 3, t + " is priced on several yardsticks, not one"); }
  const html = fs.readFileSync(R("../deliverables/20261007/one-basis/ONE-BASIS.html"), "utf8"); assert.ok(html.indexOf("EVERY YARDSTICK TOGETHER") > 0 && html.indexOf("EVERY YARDSTICK TOGETHER") < html.indexOf("WHERE IT SITS · FORWARD P/E"), "each panel leads with the blended range"); assert.match(html, /THREE WAYS · WHO PRICES IT/); assert.match(html, /WEIGHT IN THE BLEND/);
});

test("the long-term channel is on the card only where the reviewed lines carry all three of its rails; the place in it is the channels study's measure", () => {
  const ch = (t) => CARDS.cards[t].technicals.long_term_channel, mu = ch("MU");
  assert.ok(mu, "Micron has one"); assert.deepEqual([mu.upper.label, mu.mid.label, mu.lower.label], ["3D B2", "3D B4", "3D B6"]); assert.ok(mu.upper.level > mu.mid.level && mu.mid.level > mu.lower.level);
  assert.ok(Math.abs(mu.position_pct - ((1045.56 - mu.lower.level) / (mu.upper.level - mu.lower.level)) * 100) < 0.06); assert.ok(mu.position_pct > 25 && mu.position_pct < 40, "Micron sits in the lower third: " + mu.position_pct); assert.match(mu.words, /^31% of the way up its long-term channel \(3D B6 880\.3 → 3D B2 1410\.79\)$/);
  const have = Object.keys(CARDS.cards).filter((t) => ch(t)); assert.deepEqual(have.sort(), ["AMZN", "MU", "WDC"], "the three names whose three rails are on file");
  for (const t of ["NVDA", "GOOGL", "AVGO", "VST", "TSM"]) assert.equal(ch(t), null, t + ": no complete channel on file, so none is shown");
});
