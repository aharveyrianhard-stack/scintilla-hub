/* CP3 · everything the page, the cards and the tests read, from the runs in the scratch folder. Read-only; writes files
   beside the page and one test fixture. Run from the scratch folder after core-run.mjs and the three universe runs:
     node build-data.mjs
   IN   core.json (core-run.mjs) · ko-a/b/c/c-debt.json (the knockout joined on each universe comps run) · snap/*.json ·
        quotes-all-raw.json · the published knockout (deliverables/20261007/knockout/data/knockout.json) · CP1's cards
   OUT  data/one-basis.json          the one-basis table, the core candidates in full, the leaders, the knockout before → after
        data/cards.json              the decision cards re-priced: forward P/E on the one basis, the comps, the debt, the peers
        data/estimate-rows-dry-run.json   every estimate row the rule flags — a report; no table is written
        tests/fixtures/cp3-one-basis-20261007.json   the rows the five surfaces are tested on                        */
import { readFileSync, writeFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../.."), DATA = path.resolve(HERE, "../data");
const { forwardBasis, forwardRead, estFxPair, multipleText, reconcileYears } = await import(WT + "/lib/forward-basis.mjs");
const { dashboardPrints } = await import(HERE + "/dashboard-code.mjs");
const { buildFeed, REPORTS_IN } = await import(WT + "/supabase/functions/comps-feed/feed.mjs");
const { readCohort, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-template/cohort.mjs");
const { localPg } = await import(WT + "/deliverables/20261007/knockout/tools/local-pg.mjs");
const J = (p) => JSON.parse(readFileSync(p, "utf8")), load = (n) => J(path.join("snap", n + ".json"));
const CORE = J("core.json"), N = CORE.names, TODAY = CORE.today, T30 = CORE.thirty, CORE10 = CORE.core;
const EST = load("analyst_estimates"), EV = load("earnings_events"), PROF = load("company_profile"), FUND = load("fundamentals"), FILERS = load("filer_currency"), FX = load("fx_rates"), TC = load("ticker_cohorts"), TK = load("tickers");
const RAW = J("quotes-all-raw.json"), close = (t) => { const q = RAW.quotes[t]; return q && q.today_session_close > 0 ? q.today_session_close : q ? q.price : null; };
const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const OLD = J(WT + "/deliverables/20261006/decision-cards/data/cards.json"), PAGE = readFileSync(WT + "/index.html", "utf8");
const SINCE = new Date(Date.parse(TODAY + "T00:00:00Z") - 400 * 86400e3).toISOString().slice(0, 10);

/* ---- 1 · THE FIXTURE: the rows the five surfaces are tested on. Every surface is given the SAME price (the 6 Oct close):
        the profile row's price is set to it, because the live profile is refreshed at 06:25Z and still held the 5 Oct close. */
const foreign30 = T30.filter((t) => REPORTS_IN[t] && REPORTS_IN[t] !== "USD");
const fixture = { what: "CP3 · the rows the dashboard, the COMPS tab, the decision card and the comps-feed are tested on for thirty names (tests/cp3-one-basis.test.mjs)", today: TODAY, price_is: CORE.price_is + " — given to every surface, the profile rows included",
  names: T30, closes: Object.fromEntries(T30.map((t) => [t, close(t)])),
  tables: {
    analyst_estimates: EST.filter((r) => T30.includes(r.ticker) && (r.fiscal_date >= TODAY || (foreign30.includes(r.ticker) && r.period === "quarter" && r.fiscal_date >= SINCE))).map((r) => ({ ticker: r.ticker, period: r.period, fiscal_date: r.fiscal_date, est_eps_avg: r.est_eps_avg, est_revenue_avg: r.est_revenue_avg, num_analysts_eps: r.num_analysts_eps, price_target_avg: r.price_target_avg ?? null, updated_ts: r.updated_ts })),
    earnings_events: EV.filter((r) => foreign30.includes(r.ticker) && r.date >= SINCE).map((r) => ({ ticker: r.ticker, date: r.date, eps_estimate: r.eps_estimate, revenue_estimate: r.revenue_estimate })),
    fundamentals: FUND.filter((r) => T30.includes(r.ticker)).map((r) => ({ ticker: r.ticker, price: r.price, market_cap: r.market_cap, eps_ttm: r.eps_ttm, adjusted_eps_ttm: r.adjusted_eps_ttm ?? null, revenue_ttm: r.revenue_ttm, trailing_pe: r.trailing_pe, adjusted_pe: r.adjusted_pe ?? null, updated_ts: r.updated_ts })),
    company_profile: PROF.filter((r) => T30.includes(r.ticker)).map((r) => ({ ticker: r.ticker, name: r.name, industry: r.industry, sector: r.sector, is_etf: r.is_etf, is_adr: r.is_adr, country: r.country, price: close(r.ticker), market_cap: r.price > 0 ? r.market_cap * (close(r.ticker) / r.price) : r.market_cap, updated_ts: Math.floor(Date.parse(TODAY + "T12:00:00Z") / 1000) })),
    filer_currency: FILERS.filter((r) => T30.includes(r.ticker)), fx_rates: FX.filter((r) => r.date >= "2026-09-20"),
    ticker_cohorts: TC.filter((r) => r.ticker === "GOOGL"), tickers: TK.filter((r) => r.ticker === "GOOGL").map((r) => ({ ticker: r.ticker, cohort: r.cohort })),
    fundamentals_history: [], cashflow_history: [], balance_history: [], composite_staged: [], ratios_history: [],
  } };
/* the five surfaces, each through its own code, on those rows */
const F = fixture.tables, prices = fixture.closes;
const dash = dashboardPrints(PAGE, { rows: F.analyst_estimates, prices, today: TODAY, events: F.earnings_events, pairQuarters: F.analyst_estimates.filter((r) => r.period === "quarter") });
const feed = Object.fromEntries(buildFeed(T30, { fundamentals: F.fundamentals, profiles: F.company_profile, history: [], ratios: [], estimates: F.analyst_estimates.filter((r) => r.fiscal_date >= TODAY), filers: F.filer_currency, fx: F.fx_rates, events: F.earnings_events, pairQuarters: F.analyst_estimates.filter((r) => r.period === "quarter") }, TODAY).rows.map((r) => [r.sym, r]));
const ctx = await readCohort({ ticker: "GOOGL", today: TODAY, pg: localPg(F), quotes: async (T) => ({ quotes: Object.fromEntries(T.map((t) => [t, { price: prices[t], price_observation_utc: TODAY + "T20:00:00Z" }])) }), membersAsked: T30, labelAsked: "the thirty names of the one-basis table" });
const tab = Object.fromEntries(T30.map((t) => { const s = snapshotFromCohort(ctx, t), r = s.rows.find((x) => x.key === "pe_fwd"); return [t, { pe: r.own.multiple, converted: !!(s.fwd && s.fwd.rate), why: r.own_why || null }]; }));
const txt = (pe, conv, t) => (pe == null ? (REPORTS_IN[t] && REPORTS_IN[t] !== "USD" && !conv ? "EPS " + REPORTS_IN[t] : "—") : multipleText(pe, conv));
const oldCard = (t) => (OLD.cards[t] && OLD.cards[t].fundamentals ? OLD.cards[t].fundamentals.fwd_pe : null);
const test30 = T30.map((t) => { const n = N[t], fw = n.forward, conv = !!fw.rate;
  return { ticker: t, name: n.name, price: prices[t], eps: fw.eps, eps_usd: fw.eps_usd, basis: fw.basis, label: fw.label, converted: conv, rate: fw.rate ? { f: fw.rate.f, currency: fw.rate.currency, quarter: fw.rate.quarter } : null,
    dashboard: dash[t].text, comps_tab: txt(tab[t].pe, tab[t].converted, t), card: txt(n.own.pe_fwd != null ? n.own.pe_fwd : null, conv, t) === "—" ? "—" : n.own.pe_fwd_text, feed: txt(feed[t].fwd_pe, conv, t), tool: txt(feed[t].fwd_pe, conv, t),
    was_fiscal_year: fw.fiscal_year.pe == null ? "—" : multipleText(fw.fiscal_year.pe, conv), was_fiscal_year_date: fw.fiscal_year.year, was_card: oldCard(t) == null ? (OLD.cards[t] ? "—" : null) : multipleText(oldCard(t)), growth_pct: fw.growth_pct, peg: fw.peg, flags: fw.flags.map((f) => f.code), why: fw.why }; });
fixture.expected = Object.fromEntries(test30.map((r) => [r.ticker, r.dashboard]));
const agree = test30.filter((r) => r.dashboard === r.comps_tab && r.comps_tab === r.card && r.card === r.feed).length;
writeFileSync(WT + "/tests/fixtures/cp3-one-basis-20261007.json", JSON.stringify(fixture));

/* ---- 2 · THE DRY-RUN REPORT: every estimate row the rule flags, across everything on file. No table is written. */
const byT = new Map(); for (const r of EST) if (r.fiscal_date >= TODAY) { if (!byT.has(r.ticker)) byT.set(r.ticker, []); byT.get(r.ticker).push(r); }
const profOf = Object.fromEntries(PROF.map((r) => [r.ticker, r]));
const dry = { what: "CP3 · the estimate rows the one-basis rule flags (lib/forward-basis.mjs), across every company with estimates on file. A REPORT: nothing was written to any table.", today: TODAY, read_utc: CORE.tables.analyst_estimates.read_utc, tickers: byT.size,
  on_next_four_quarters: 0, on_fiscal_year: [], zero_rows: [], years_that_do_not_add_up: [], next_four_touched: [], thin_next_four: [], foreign: [], reits_on_eps: [] };
for (const [t, rows] of byT) {
  const b = forwardBasis(rows, TODAY); if (!b || b.eps == null) continue;
  if (b.basis === "next four quarters") dry.on_next_four_quarters++; else dry.on_fiscal_year.push({ ticker: t, year: b.through, eps: r2(b.eps) });
  for (const r of rows) if (Number(r.est_eps_avg) === 0 && r.est_eps_avg != null) dry.zero_rows.push({ ticker: t, period: r.period, fiscal_date: r.fiscal_date, analysts: r.num_analysts_eps ?? null });
  for (const y of reconcileYears(rows, TODAY)) if (y.bad) dry.years_that_do_not_add_up.push({ ticker: t, year: y.fiscal_date, quarters_add_to: r2(y.quarters_eps), year_estimate: r2(y.year_eps), ratio: r2(y.ratio), in_next_four: b.quarters.some((q) => y.quarters.includes(q.fiscal_date)) });
  const codes = b.flags.map((f) => f.code);
  if (codes.includes("next-four-in-a-bad-year") || codes.includes("zero-in-next-four") || codes.includes("next-four-not-consecutive")) dry.next_four_touched.push({ ticker: t, why: b.flags.filter((f) => f.code !== "thin" && f.code !== "quarters-do-not-add-up").map((f) => f.words).join("; "), eps: r2(b.eps), price: close(t) });
  if (codes.includes("thin")) dry.thin_next_four.push(t);
  const cc = REPORTS_IN[t] || (FILERS.find((f) => f.ticker === t) || {}).reported_currency || "USD";
  if (cc !== "USD") { const pr = estFxPair(EV.filter((r) => r.ticker === t), EST.filter((r) => r.ticker === t && r.period === "quarter")), fr = forwardRead({ price: close(t), rows, today: TODAY, ccy: cc, fx: pr });
    dry.foreign.push({ ticker: t, currency: cc, rate: pr ? Number(pr.f.toPrecision(5)) : null, rate_quarter: pr ? pr.q : null, prints: fr.text, why: fr.pe == null ? fr.why : null }); }
  const p = profOf[t]; if (p && /reit/i.test(p.industry || "")) { const fr = forwardRead({ price: close(t), rows, today: TODAY }); dry.reits_on_eps.push({ ticker: t, industry: p.industry, forward_pe_on_eps: r1(fr.pe) }); }
}
dry.years_that_do_not_add_up.sort((a, b) => Math.abs(Math.log(Math.max(0.01, b.ratio))) - Math.abs(Math.log(Math.max(0.01, a.ratio))));
dry.counts = { zero_rows: dry.zero_rows.length, years_that_do_not_add_up: dry.years_that_do_not_add_up.length, companies_with_such_a_year: new Set(dry.years_that_do_not_add_up.map((r) => r.ticker)).size, next_four_touched: dry.next_four_touched.length, thin_next_four: dry.thin_next_four.length, on_fiscal_year: dry.on_fiscal_year.length, foreign: dry.foreign.length, foreign_withheld: dry.foreign.filter((r) => r.rate == null).length, reits: dry.reits_on_eps.length };
dry.would_change = "nothing is changed in any table. For the coordinator: the zero rows and the years that do not add up are the supplier's; re-pulling those companies' quarterly estimates from FMP (fmp-analyst) is the fix at the source, and the rule here keeps them out of growth until then.";
writeFileSync(DATA + "/estimate-rows-dry-run.json", JSON.stringify(dry, null, 1));

/* ---- 3 · THE KNOCKOUT, BEFORE → AFTER (the universe run joined four ways) */
const KP = J(WT + "/deliverables/20261007/knockout/data/knockout.json"), KA = J("ko-a.json"), KB = J("ko-b.json"), KC = J("ko-c.json"), KD = J("ko-c-debt.json");
const champs = (K) => Object.fromEntries(Object.entries(K.branches).map(([id, b]) => [id, { label: b.label, champion: b.champion || null, finalists: b.finalists || [], rank: b.rank }]));
const cP = champs(KP), cA = champs(KA), cB = champs(KB), cC = champs(KC), cD = champs(KD);
const passOf = (K, t) => { const n = K.names[t]; if (!n || !n.branches) return null; const bs = Object.values(n.branches).filter((b) => b.business !== false); return bs.length ? bs.some((b) => b.passes) : null; };
const upOf = (K, t) => (K.names[t] ? K.names[t].comps : null);
const knockout = { what: "the universe knockout re-joined on each comps run: published (fiscal-year basis) → reproduced on today's tables → the one forward basis → + the stated same-business sets → + debt in the debate", names_run: Object.keys(KD.names).length,
  reproduced: { same_champions: Object.keys(cP).filter((id) => cP[id].champion === (cA[id] || {}).champion).length, of: Object.keys(cP).length },
  champions_changed: Object.keys(cP).filter((id) => cP[id].champion !== (cD[id] || {}).champion).map((id) => ({ branch: cP[id].label, was: cP[id].champion, now: cD[id].champion, by_basis: cA[id].champion !== cB[id].champion, by_sets: cB[id].champion !== cC[id].champion, by_debt: cC[id].champion !== cD[id].champion, finalists_was: cP[id].finalists, finalists_now: cD[id].finalists })),
  debt_moved: Object.entries(KD.branches).filter(([, b]) => (b.debt_moved || []).length).map(([id, b]) => ({ branch: b.label, order_before: KC.branches[id].finalists, order_after: b.finalists, penalties: Object.fromEntries(Object.entries(b.scores).filter(([, s]) => s.debt_penalty > 0).map(([t, s]) => [t, { points: s.debt_penalty, words: s.debt_words, score: s.score, debate: s.debate }])) })),
  penalised: Object.values(KD.branches).flatMap((b) => Object.entries(b.scores).filter(([, s]) => s.debt_penalty > 0).map(([t, s]) => ({ ticker: t, branch: b.label, points: s.debt_penalty, words: s.debt_words, finalist: (b.finalists || []).includes(t) }))),
  funnel: { published: KP.funnel, now: KD.funnel },
  radar: (KP.lists.RADAR || []).map((t) => ({ ticker: t, comps_was: upOf(KP, t), comps_now: upOf(KD, t), passes_was: passOf(KP, t), passes_now: passOf(KD, t), pe_fwd: KD.names[t] ? KD.names[t].pe_fwd : null, debt: KD.names[t] ? KD.names[t].nd_ebitda : null })),
  moved_5: Object.keys(KA.names).filter((t) => upOf(KA, t) != null && upOf(KB, t) != null && Math.abs(upOf(KA, t) - upOf(KB, t)) > 5).length, moved_20: Object.keys(KA.names).filter((t) => upOf(KA, t) != null && upOf(KB, t) != null && Math.abs(upOf(KA, t) - upOf(KB, t)) > 20).length, priced_both: Object.keys(KA.names).filter((t) => upOf(KA, t) != null && upOf(KB, t) != null).length,
  priced_on_business: { before: Object.values(KB.names).filter((n) => n.comps_priced_on === "business").length, now: Object.values(KC.names).filter((n) => n.comps_priced_on === "business").length },
  pass_flips: Object.keys(KD.names).filter((t) => passOf(KP, t) != null && passOf(KD, t) != null && passOf(KP, t) !== passOf(KD, t)).map((t) => ({ ticker: t, was: passOf(KP, t), now: passOf(KD, t), lists: KD.names[t].lists || [] })) };

/* ---- 4 · THE LEADERS AGAINST EACH OTHER, and the page's data */
const tech = (t) => { const o = OLD.cards[t] && OLD.cards[t].technicals, k = KD.names[t]; return o ? { geiger: r2(o.geiger), pctl: o.geiger_pctl_own_year != null ? Math.round(o.geiger_pctl_own_year) : null, from: "its decision card" } : k ? { geiger: k.geiger, pctl: k.pctl, from: "the universe knockout" } : null; };
const leaders = CORE10.map((t) => { const n = N[t], c = n.runs.cp3, o = n.own;
  return { ticker: t, name: n.name, price: n.price, pe_fwd: n.forward.pe, pe_fwd_text: n.forward.text, was_fiscal_year: n.forward.fiscal_year.pe, was_card: oldCard(t), growth: n.forward.growth_pct, growth_from: n.forward.growth_from, peg: n.forward.peg, pe_ttm: o.pe_ttm, ev_ebitda: o.ev_ebitda, p_ffo: o.p_ffo, rev_g_ttm: o.rev_g_ttm, om: o.om, fcfm: o.fcfm,
    debt: o.debt, comps: { low: c.band && c.band.lo, centre: c.band && c.band.centre, high: c.band && c.band.hi, upside: c.upside_pct, n: (n.sets.priced || []).length, thin: !!c.thin, fragile: !!c.fragile, no_peer_set: !!c.no_peer_set },
    was: { live: n.runs.live.upside_pct ?? null, cp1: n.runs.cp1.upside_pct ?? null, one: n.runs.one.upside_pct ?? null }, sits: n.sits, technicals: tech(t), flags: n.forward.flags.map((f) => f.code) }; });
const slimName = (n) => ({ name: n.name, price: n.price, line: n.line, forward: n.forward, sets: n.sets, runs: n.runs, own: n.own, peers: n.peers, sits: n.sits, legs: n.legs });
const out = { what: "CP3 · one forward P/E everywhere, same-business peer sets, the core candidates' comps and the debt reading", built_utc: new Date().toISOString(), today: TODAY, price_is: CORE.price_is, tables: CORE.tables, reference: CORE.reference,
  rule: { forward: "price ÷ the next four quarters of consensus EPS; the nearest fiscal year only when fewer than four quarters are on file; a foreign reporter's EPS in dollars at the supplier's own paired rate, or the multiple is withheld; under 2.5× withheld", growth: "the four quarters after the next four ÷ the next four − 1; when those rows are missing or not sound, each of those quarters is a quarter of its fiscal year's own estimate", peg: "that forward P/E ÷ that growth" },
  test30, test30_agree: agree, core: Object.fromEntries(CORE10.map((t) => [t, slimName(N[t])])), others: Object.fromEntries(T30.filter((t) => !CORE10.includes(t)).map((t) => [t, { name: N[t].name, price: N[t].price, forward: N[t].forward, sets: { old: N[t].sets.old, now: N[t].sets.now, priced: N[t].sets.priced, rule: N[t].sets.rule, added: N[t].sets.added }, runs: N[t].runs, own: N[t].own, sits: N[t].sits }])),
  leaders, knockout, dry_run: { counts: dry.counts, next_four_touched: dry.next_four_touched, worst_years: dry.years_that_do_not_add_up.slice(0, 14), on_fiscal_year: dry.on_fiscal_year, foreign: dry.foreign, reits: dry.reits_on_eps, zero_rows: dry.zero_rows.slice(0, 20) } };
writeFileSync(DATA + "/one-basis.json", JSON.stringify(out));

/* ---- 5 · THE CARDS, re-priced. CP1's cards keep everything they carried (technicals, risk, the plan); the fundamentals'
        forward figures, the comps block and two new blocks (debt, peers) are this run's. A TSMC card is added (it is on
        the radar): its technicals come from the universe knockout's own readings of the same close. */
const flagsOf = (c, n) => [...(c.thin ? [`thin: ${(n.sets.priced || []).length} peers price it`] : []), ...(c.fragile ? ["fragile: " + c.fragile] : []), ...(c.no_peer_set ? ["no peer set"] : []), ...n.forward.flags.filter((f) => f.code !== "thin").map((f) => f.words)];
const cardOfName = (t) => { const n = N[t], c = n.runs.cp3, old = OLD.cards[t] || null, k = KD.names[t] || {};
  const base = old || { ticker: t, name: n.name, card_date: TODAY, price: n.price, price_is: "session close " + TODAY, parents: [], cohorts: (k.cohorts || []), line: n.line,
    technicals: { geiger: k.geiger ?? null, geiger_trend: k.trend ?? null, geiger_momentum: k.momentum ?? null, geiger_pctl_own_year: k.pctl ?? null, geiger_own_median: k.p50 ?? null, from: "the universe knockout's reading of the 6 Oct close", lines_below: k.near_below ? [{ label: k.near_below.label, level: k.near_below.level, pct: k.near_below.pct }] : [], lines_above: (k.above || []).map((x) => ({ label: x.label, level: x.level, pct: x.pct })), zone: k.zone || null },
    risk: { usual_day_60: k.usual_day ?? null }, plan: { core_or_conviction: null, entry_levels: null, size_by_risk: null, exit_trim_rule: null, given: null }, fundamentals: {} };
  return { ...base, repriced: "2026-10-07 — one forward basis, same-business peers, debt",
    fundamentals: { ...base.fundamentals, fwd_pe: n.forward.pe, fwd_pe_text: n.forward.text, fwd_pe_basis: n.forward.label, fwd_eps: n.forward.eps_usd, fwd_pe_was: { on_the_fiscal_year: n.forward.fiscal_year.pe, fiscal_year: n.forward.fiscal_year.year, card_blend: old ? old.fundamentals.fwd_pe ?? null : null },
      eps_g_following_year: n.forward.growth_pct, eps_g_following_year_basis: n.forward.growth_basis, rev_g_following_year: n.forward.rev_growth_pct, peg: n.forward.peg, forward_flags: n.forward.flags, forward_rate: n.forward.rate, forward_why: n.forward.why },
    comps: { priced_on: c.priced_on, rule: n.sets.rule, stated: n.sets.stated, peers_priced: n.sets.priced || [], n_priced: (n.sets.priced || []).length, shown_not_priced: n.sets.shown_not_priced || [], low: c.band ? c.band.lo : null, centre: c.band ? c.band.centre : null, high: c.band ? c.band.hi : null, upside_pct: c.upside_pct ?? null,
      before: { as_it_stands: n.runs.live.upside_pct ?? null, card_on_the_fiscal_year: old && old.comps ? old.comps.upside_pct ?? null : n.runs.cp1.upside_pct ?? null, same_sets_one_basis: n.runs.one.upside_pct ?? null }, flags: flagsOf(c, n), rows: c.rows, growth_credit: c.growth_credit, sales_rows_off: c.sales_rows_off, reit: c.reit, old_set: n.sets.old, added: n.sets.added },
    debt: n.own.debt, sits: n.sits, legs: n.legs,
    peers: n.peers.map((p) => ({ ticker: p.ticker, name: p.name, priced: p.priced, stated: p.stated, added: p.added, reference: p.reference, has_figures: p.has_figures, in_old_set: p.in_old_set, votes: p.votes ? p.votes.n : null, pe_fwd: p.pe_fwd ?? null, pe_fwd_text: p.pe_fwd_text || "—", pe_ttm: p.pe_ttm ?? null, ev_ebitda: p.ev_ebitda ?? null, peg: p.peg ?? null, p_ffo: p.p_ffo ?? null, growth_eps: p.growth_eps ?? null, rev_g_ttm: p.rev_g_ttm ?? null, om: p.om ?? null, net_debt_ebitda: p.debt ? p.debt.net_debt_ebitda : null, debt_word: p.debt ? p.debt.word : null, basis: p.forward ? p.forward.label : null })) }; };
const cardNames = [...Object.keys(OLD.cards), ...CORE10.filter((t) => !OLD.cards[t])];
const cards = { what: "the decision cards, re-priced on 7 Oct on the one forward basis (CP3): CP1's 26 cards with their technicals, risk and plan kept; forward P/E, growth, PEG, the comps range and its peers, and the debt reading are new; TSMC added",
  as_of: { card_date: TODAY, built_utc: new Date().toISOString(), repriced: "2026-10-07", basis: "next four quarters (the dashboard's forward P/E)", lines_as_of: OLD.as_of && OLD.as_of.lines_as_of, previous_built_utc: OLD.as_of && OLD.as_of.built_utc }, price_is: OLD.price_is, comps_code: "hub/cp3-one-basis-20261007: lib/forward-basis.mjs, comps-c5/lines.mjs CP3_STATED, comps-c6/outliers.mjs CP3_ALL", cards: Object.fromEntries(cardNames.map((t) => [t, cardOfName(t)])) };
writeFileSync(DATA + "/cards.json", JSON.stringify(cards));
console.log("one-basis table:", agree, "of", test30.length, "names print the same multiple on the dashboard, the COMPS tab, the card and the feed");
for (const r of test30.filter((x) => !(x.dashboard === x.comps_tab && x.comps_tab === x.card && x.card === x.feed))) console.log("  DIFFERS", r.ticker, r.dashboard, r.comps_tab, r.card, r.feed);
console.log("dry run:", JSON.stringify(dry.counts));
console.log("knockout: champions the same as published on the old basis", knockout.reproduced.same_champions, "of", knockout.reproduced.of, "· champions changed in the end", knockout.champions_changed.length, "· branches reordered by debt", knockout.debt_moved.length, "· names with a debt penalty", knockout.penalised.length, "· moved >5 pts by the basis", knockout.moved_5, "of", knockout.priced_both);
console.log("cards:", Object.keys(cards.cards).length, "· files →", DATA);
