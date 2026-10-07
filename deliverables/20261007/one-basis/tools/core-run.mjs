/* CP3 · THE CORE CANDIDATES' COMPS IN FULL, ON THE ONE FORWARD BASIS — and the figures behind the one-basis table.
   For every name asked for, four readings of the same comps code on the same tables and the same closes:
     live   the comps system as it stands on the Hub (C6b, every switch off), fiscal-year forward basis
     cp1    the comps fix's switches on (memory and storage one line, the landlords, growth credit …), fiscal-year basis
            — the numbers the decision cards and the universe knockout carried until today
     one    the same switches on THE ONE FORWARD BASIS (next four quarters; lib/forward-basis.mjs) — the basis alone
     cp3    the one basis plus the stated same-business sets and the price from the same-business peers — what CP3 proposes
   and, for `cp3`, every peer's row (multiples, growth, P/E ÷ growth, debt, the four sources' votes), where the company
   sits among the peers that price it, its own debt reading, and the legs of a two-business company.

   WHERE THE FIGURES COME FROM: one snapshot of the Hub's public tables (the universe knockout's snapshot of 7 Oct 05:50Z,
   its estimates table re-read at 14:45Z with BOTH periods) answered locally by the knockout's local-pg.mjs, and the settled
   6 Oct closes. So every reading is on the same close and the same rows, and the run needs no network and no key.
   Read-only: nothing is written to any table. Run from the scratch folder (snap/*.json, quotes-all-raw.json):
     node core-run.mjs --out <file.json> [TICKER …]                                                                    */
import { readFileSync, writeFileSync, readdirSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { localPg } = await import(WT + "/deliverables/20261007/knockout/tools/local-pg.mjs");
const { inputs: c4inputs, readSet, snapshotFromCohort } = await import(WT + "/deliverables/20261001/comps-mechanic/read.mjs");
const { buildSet, votesFor, lineWords, CP1_LINES_OFF, CP1_LINES_ON, CP3_LINES_ON, CP3_STATED, REFERENCE_PEERS, SIM_MIN } = await import(WT + "/deliverables/20261003/comps-c5/lines.mjs");
const { conclusion6, CP1_ALL, CP1_NONE, CP3_ALL, setCheck } = await import(WT + "/deliverables/20261005/comps-c6/outliers.mjs");
const { isValuation } = await import(WT + "/deliverables/20261003/comps-c5/field.mjs");
const { referenceOf, withReference, withReferenceQuotes } = await import(WT + "/deliverables/20261003/comps-c5/reference.mjs");
const { forwardRead, estFxPair, multipleText } = await import(WT + "/lib/forward-basis.mjs");
const { debtReading } = await import(WT + "/lib/debt-reading.mjs");

export const CORE = ["GOOGL", "AMZN", "AVGO", "NVDA", "TSM", "VST", "MU", "ORCL", "DLR", "EQIX"];
export const CARDS = ["MU", "SNDK", "WDC", "AVGO", "GOOGL", "AMZN", "VST", "NBIS", "BE", "IREN", "EQIX", "DLR", "IRM", "LRCX", "CRDO", "COHR", "STX", "NVDA", "AMAT", "CEG", "LLY", "JPM", "BAC", "ORCL", "CRWV", "AME"];
/* the thirty names of the one-basis table: the 26 card names and four leaders the core sets lean on */
export const THIRTY = [...CARDS, "TSM", "META", "MSFT", "AMD"];

const argv = process.argv.slice(2), opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt("--out", "one-basis-core.json"), TODAY = opt("--today", "2026-10-06"), SNAP = opt("--snap", "snap");
const asked = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--out", "--today", "--snap"].includes(argv[i - 1]))).map((s) => s.toUpperCase());
const NAMES = asked.length ? asked : [...new Set([...CORE, ...THIRTY])];
const load = (n) => JSON.parse(readFileSync(path.join(SNAP, n + ".json"), "utf8"));
const TABLES = Object.fromEntries(["company_profile", "ticker_industry", "tickers", "ticker_cohorts", "fmp_peers", "peer_sources", "fundamentals", "analyst_estimates", "fundamentals_history", "cashflow_history", "balance_history", "composite_staged", "filer_currency", "fx_rates", "earnings_events"].map((n) => [n, load(n)]));
const META = JSON.parse(readFileSync(path.join(SNAP, "_meta.json"), "utf8"));
const CACHE = new Map(), pgRaw = localPg(TABLES), pg0 = async (p) => { if (!CACHE.has(p)) CACHE.set(p, pgRaw(p)); return CACHE.get(p); };
const fetchJson = async (u) => JSON.parse(readFileSync(path.join(WT, u), "utf8"));
const RAW = JSON.parse(readFileSync("quotes-all-raw.json", "utf8"));
const settle = (q) => (q && q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 ? { price: q.today_session_close, price_observation_utc: q.today_session_et + "T20:00:00Z" } : q && q.price > 0 ? { price: q.price, price_observation_utc: q.price_observation_utc } : null);
const quotes0 = async (T) => ({ quotes: Object.fromEntries(T.map((t) => [t, settle(RAW.quotes[t])]).filter(([, q]) => q)) });
const refDir = WT + "/deliverables/20261003/comps-c5", refFile = readdirSync(refDir).filter((f) => /^reference-peers-facts-.*\.json$/.test(f)).sort().pop() || null;
const FACTS = refFile ? JSON.parse(readFileSync(path.join(refDir, refFile), "utf8")) : null, REF = referenceOf(FACTS);
const pg = FACTS ? withReference(pg0, FACTS) : pg0, quotes = FACTS ? withReferenceQuotes(quotes0, FACTS) : quotes0;
const fxStandin = JSON.parse(readFileSync(WT + "/deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
fxStandin.reported = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json", "utf8")).reported;
if (FACTS && FACTS.fx) { fxStandin.rates = { ...(fxStandin.rates || {}) }; for (const [c, rows] of Object.entries(FACTS.fx)) if (rows && rows.length && !(fxStandin.rates[c] && fxStandin.rates[c].length)) fxStandin.rates[c] = rows; for (const [t, c] of Object.entries(REF.peers)) fxStandin.reported[t] = c.currency; }
const inp = await c4inputs({ pg: pg0, fetchJson });
inp.segments = JSON.parse(readFileSync(WT + "/deliverables/20261003/comps-c5/segments-2026-10-03.json", "utf8")).companies; inp.reference = REF.peers;
{ const tree = JSON.parse(readFileSync(WT + "/deliverables/20260929/tree-map/tree.json", "utf8")), nodes = Array.isArray(tree.nodes) ? tree.nodes : Object.values(tree.nodes);
  const top = Object.fromEntries(nodes.filter((n) => n.kind === "fund" && n.holdings).map((n) => [n.ticker, n.holdings]));
  inp.funds = inp.funds.map((f) => { const h = top[f.ticker] || {}; const all = new Map(f.holdings.map(([s, w]) => [String(s).toUpperCase(), w])); for (const r of h.top || []) if (r.ticker) all.set(String(r.ticker).toUpperCase(), r.weight_pct); return { ...f, all: [...all], count: h.count_in_fund || f.holdings.length }; }); }
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100), r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const nameOf = (t) => (inp.profiles[t] || {}).name || (REFERENCE_PEERS[t] || {}).name || t;
const median = (a) => { const v = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };

const SNAPS = new Map();
async function snapOf(T, set, forward) {
  const served = { ...set, kept: set.kept.filter((r) => !r.reference || r.has_figures) }, key = forward + "|" + T + "|" + served.kept.map((r) => r.ticker).join(",");
  if (SNAPS.has(key)) return SNAPS.get(key);
  const ctx = await readSet(T, served, { today: TODAY, pg, quotes, fxStandin, forward }), snap = snapshotFromCohort(ctx, T);
  const estRows = await pg(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg&period=eq.annual&ticker=in.(${ctx.members.map(encodeURIComponent).join(",")})&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`);
  const estimates = Object.fromEntries(ctx.inputs.map((i) => [i.ticker, { eps_ttm: i.eps_ttm ?? null, est: estRows.filter((e) => e.ticker === i.ticker).map((e) => ({ fiscal_date: e.fiscal_date, eps: e.est_eps_avg })) }]));
  const v = { ctx, snap, estimates }; SNAPS.set(key, v); return v;
}
async function price(T, set, fx, forward) {
  const pricedPeers = set.kept.filter((r) => !r.reference || r.has_figures);
  if (!pricedPeers.length) return { ok: false, reason: "no peers" };
  const { ctx, snap, estimates } = await snapOf(T, set, forward), C = conclusion6(snap, [], estimates, TODAY, "C", { set, fx });
  const c6 = C.c6, band = (x) => (x ? { lo: r2(x.lo), centre: r2(x.mid), hi: r2(x.hi) } : null), up = (x) => (x && snap.price > 0 ? r1((x.mid / snap.price - 1) * 100) : null);
  const wayC = (C.ways || []).find((w) => w.way === "C"), behind = wayC && wayC.ok ? [...new Set(wayC.points.map((p) => p.ticker))].sort() : [];
  const mw = C.measureWeights || { weights: {}, parts: {} }, keys = C.rows.filter((r) => isValuation(r.key)).map((r) => r.key);
  return { ok: true, C, ctx, snap, price: snap.price, n_set: pricedPeers.length, behind, thin: behind.length < 4, band: band(C.band), upside_pct: up(C.band), no_peer_set: !!c6.noPeerSet, reason: C.reason || null,
    priced_on: c6.pricedOn || "set", business_peers: c6.businessPeers || null, not_priced: c6.notPriced || [], outliers: c6.outliers || [], fragile: c6.fragile ? c6.fragile.words : null,
    whole_set: c6.wholeSet ? { band: band(c6.wholeSet.bandFromPeers || c6.wholeSet.band), upside_pct: up(c6.wholeSet.bandFromPeers || c6.wholeSet.band) } : null,
    growth_credit: C.cp1 && C.cp1.growth ? { own: r1(C.cp1.growth.own), peers: r1(C.cp1.growth.peers), n: C.cp1.growth.n, credit: r2(C.cp1.growth.credit), from: C.cp1.growth.from || null, why: C.cp1.growth.why || null } : null,
    sales_rows_off: !!(C.cp1 && C.cp1.margin && C.cp1.margin.off), reit: !!(C.cp1 && C.cp1.reit),
    rows: Object.fromEntries(keys.map((k) => { const r = C.rows.find((x) => x.key === k), e = (r && r.ends) || {}, p = mw.parts[k] || {}; return [k, { label: r.label, own: r2(r.own && r.own.multiple), median: r2(r.band && r.band.median), lo: r2(r.band && r.band.min), hi: r2(r.band && r.band.max), n: r.n || 0, price: r2(r && r.ok && e.median ? e.median.price : null), weight: r2(mw.weights[k]), credit: p.credit ? r2(p.credit) : null, off: p.off || null }]; })) };
}
const slim = (x) => { if (!x || !x.ok) return x; const { C, ctx, snap, ...rest } = x; return rest; };
const BAL = new Map();
async function balanceOf(tickers) {
  const need = tickers.filter((t) => !BAL.has(t)); if (need.length) { const since = new Date(Date.parse(TODAY + "T00:00:00Z") - 800 * 86400e3).toISOString().slice(0, 10);
    const rows = await pg(`balance_history?select=ticker,period,fiscal_date,net_debt,total_debt,cash_and_equiv&ticker=in.(${need.map(encodeURIComponent).join(",")})&fiscal_date=gte.${since}&order=fiscal_date.desc`);
    for (const t of need) BAL.set(t, rows.find((r) => r.ticker === t) || null); }
  return Object.fromEntries(tickers.map((t) => [t, BAL.get(t)]));
}
const isFinancial = (t) => ((inp.profiles[t] || {}).sector || "") === "Financial Services";
/* one company's row of the peer table, from the snapshot the comps tab itself draws */
function rowOf(t, T, X, bal) {
  const { snap, ctx, C } = X, own = t === T, tb = own ? snap.table.company : snap.table.peers[t] || {}, i = ctx.inputs.find((x) => x.ticker === t) || {}, note = own ? snap.fwd : snap.fwd_peers[t], fxn = own ? snap.fx : snap.fx_peers[t];
  const m = (k) => { const r = C.rows.find((x) => x.key === k) || snap.rows.find((x) => x.key === k); if (!r) return null; return own ? (r.own ? r.own.multiple : null) : r.values && r.values[t] ? r.values[t].multiple : null; };
  /* the balance row is as filed, in the company's own currency: its total debt and cash are read only for a dollar reporter
     (net debt, EBITDA and free cash flow come from the comps reader, already in dollars) */
  const usdFiler = !(fxn && fxn.currency && fxn.currency !== "USD"), b = usdFiler ? bal[t] || {} : {}, debt = debtReading({ net_debt: i.net_debt, total_debt: b.total_debt, cash: b.cash_and_equiv, ebitda: i.ebitda && i.ebitda.now, operating_income: i.oi && i.oi.now, interest_expense: null, fcf: i.fcf && i.fcf.now, mcap: i.mcap, financial: isFinancial(t) });
  const annual = own ? snap.pe_fwd_annual : snap.pe_fwd_annual_peers[t];
  return { ticker: t, name: nameOf(t), price: r2(i.price), mcap: i.mcap || null,
    pe_ttm: r2(m("pe_ttm")), pe_fwd: r2(m("pe_fwd")), pe_fwd_text: multipleText(m("pe_fwd"), !!(note && note.rate)), pe_fwd_fiscal_year: r2(annual), ev_ebitda: r2(m("ev_ebitda")), ev_sales: r2(m("ev_sales")), ps: r2(m("ps")), peg: r2(m("peg")), p_ffo: r2(tb.p_ffo),
    /* GROWTH, TWO WAYS (Alan, 7 Oct: "+22% growth doesn't make sense" for Micron): earnings of the last twelve months as reported → the
       next four quarters; and the next four quarters → the four after. Both are on the card, labelled in words. */
    growth_reported_to_next: i.eps_ttm > 0 && i.eps_fy1 != null ? r1((i.eps_fy1 / i.eps_ttm - 1) * 100) : null, eps_ttm: r2(i.eps_ttm), eps_next_four: r2(i.eps_fy1),
    growth_eps: r1(tb.eps_g_fy), growth_rev: r1(tb.rev_g_fy), rev_g_ttm: r1(tb.rev_g_ttm), eps_g_2y: r1(tb.eps_g_2y), gm: r1(tb.gm), om: r1(tb.om), fcfm: r1(tb.fcfm),
    forward: note ? { basis: note.basis, label: note.label, growth_basis: note.growth_basis, growth_from: note.growth_from, flags: (note.flags || []).map((f) => ({ code: f.code, words: f.words })), rate: note.rate || null, quarters: note.quarters || [], years: note.years || null, withheld: note.withheld_why || null } : null,
    currency: fxn && fxn.currency && fxn.currency !== "USD" ? fxn.currency : "USD",
    debt: { net_debt: debt.net_debt, total_debt: debt.total_debt, cash: debt.cash, net_debt_ebitda: r2(debt.net_debt_ebitda), interest_cover: r2(debt.interest_cover), interest_cover_why: debt.interest_cover_why, debt_fcf_years: r1(debt.debt_fcf_years), net_debt_pct_mcap: r1(debt.net_debt_pct_mcap), word: debt.word, points: debt.points, words: debt.words, warn: debt.warn, balance_date: b.fiscal_date || null } };
}
const sitsOf = (own, peers, key, lowIsCheap = true) => { const vals = peers.map((p) => p[key]).filter((v) => v != null && v > 0).sort((a, b) => a - b); if (own == null || !(own > 0) || !vals.length) return null; const below = vals.filter((v) => v < own).length; return { place: below + 1, of: vals.length + 1, median: r2(median(vals)), vs_median_pct: r1((own / median(vals) - 1) * 100) }; };

const out = { run_utc: new Date().toISOString(), today: TODAY, price_is: `the ${TODAY} regular-session close (chart API /quotes, captured ${RAW.fetched_utc})`,
  tables: Object.fromEntries(["analyst_estimates", "fundamentals", "company_profile", "balance_history", "earnings_events"].map((n) => [n, { rows: TABLES[n].length, read_utc: (META[n] || {}).read_utc || null }])),
  reference: { file: refFile, taken: REF.taken, carried: Object.keys(REF.peers), missing: REF.missing, listing: Object.fromEntries(Object.entries(REF.peers).map(([t, c]) => [t, c.listing || null])) }, core: CORE, thirty: THIRTY, names: {} };
for (const T of NAMES) {
  try {
    const set0 = buildSet(T, inp, { fx: CP1_LINES_OFF }), set1 = buildSet(T, inp, { fx: CP1_LINES_ON }), set3 = buildSet(T, inp, { fx: CP3_LINES_ON });
    const live = await price(T, set0, CP1_NONE, "fiscal-year"), cp1 = await price(T, set1, CP1_ALL, "fiscal-year"), one = await price(T, set1, CP1_ALL, "next-four-quarters"), cp3 = await price(T, set3, CP3_ALL, "next-four-quarters");
    const members = [T, ...set3.kept.filter((r) => !r.reference || r.has_figures).map((r) => r.ticker)], bal = await balanceOf(members);
    const pricedSet = new Set(cp3.priced_on === "business" ? cp3.business_peers : cp3.behind), outl = new Set(cp3.outliers || []);
    const peers = set3.kept.map((r) => { const has = !r.reference || r.has_figures, row = has ? rowOf(r.ticker, T, cp3, bal) : { ticker: r.ticker, name: nameOf(r.ticker) };
      const v = votesFor(T, r.ticker, inp, { also: (REFERENCE_PEERS[r.ticker] || {}).also || [] });
      return { ...row, stated: !!r.stated, same_business: !!(r.same_business ?? (r.exact >= SIM_MIN)), in_old_set: set0.kept.some((k) => k.ticker === r.ticker), added: !!r.added, reference: !!r.reference, has_figures: has,
        priced: has && pricedSet.has(r.ticker) && !outl.has(r.ticker), outlier: outl.has(r.ticker), votes: { fmp: !!v.fmp, massive: !!v.massive, industry: !!v.industry, fund: !!v.fund, n: v.n, words: v.words || null }, why: r.why || null }; });
    const own = rowOf(T, T, cp3, bal), pricedRows = peers.filter((p) => p.priced);
    /* the automatic check on the set (outliers.mjs setCheck): on the set as it was kept before any statement, and on the peers that price it now */
    const checkOld = setCheck(set0, null), checkNow = setCheck(set3, [...pricedSet].filter((t) => !outl.has(t)));
    /* Micron and its line, three ways (the coordinator, 7 Oct 10:35): US-listed peers only, plus SK hynix, plus all three foreign makers */
    const refs = set3.kept.filter((r) => r.reference && r.has_figures).map((r) => r.ticker), refVariant = (keep) => ({ ...set3, kept: set3.kept.map((r) => (r.reference && !keep.includes(r.ticker) ? { ...r, has_figures: false } : r)) });
    const way = async (keep) => { const x = await price(T, refVariant(keep), CP3_ALL, "next-four-quarters"); return { peers: (x.business_peers || x.behind || []).slice(), upside_pct: x.upside_pct ?? null, band: x.band || null, pe_fwd_median: x.rows && x.rows.pe_fwd ? x.rows.pe_fwd.median : null, fragile: !!x.fragile, thin: !!x.thin }; };
    const threeWays = refs.length ? { us_listed_only: await way([]), plus_sk_hynix: refs.includes("000660.KS") ? await way(["000660.KS"]) : null, all_three: await way(refs) } : null;
    const sits = Object.fromEntries(["pe_fwd", "pe_ttm", "ev_ebitda", "peg", "ps", "p_ffo"].map((k) => [k, sitsOf(own[k], pricedRows, k)]));
    const gPeers = pricedRows.map((p) => p.growth_eps).filter((v) => v != null);
    sits.growth_eps = own.growth_eps != null && gPeers.length ? { place: gPeers.filter((v) => v > own.growth_eps).length + 1, of: gPeers.length + 1, median: r1(median(gPeers)) } : null;
    const dPeers = pricedRows.map((p) => p.debt && p.debt.net_debt_ebitda).filter((v) => v != null);
    sits.net_debt_ebitda = dPeers.length ? { own: own.debt.net_debt_ebitda, median: r2(median(dPeers)), more_levered_than: own.debt.net_debt_ebitda != null ? dPeers.filter((v) => v < own.debt.net_debt_ebitda).length : null, of: dPeers.length } : null;
    /* a two-business company: each leg's own medians, and what the company's forward EPS is worth on each leg's forward P/E */
    const st = set3.stated, legs = st && st.legs ? Object.fromEntries(Object.entries(st.legs).map(([leg, list]) => { const rows = peers.filter((p) => list.includes(p.ticker) && p.has_figures);
      const pe = median(rows.map((p) => p.pe_fwd)), ev = median(rows.map((p) => p.ev_ebitda)), eps = cp3.snap.eps_fy1;
      return [leg, { peers: rows.map((p) => p.ticker), pe_fwd: r2(pe), ev_ebitda: r2(ev), peg: r2(median(rows.map((p) => p.peg))), growth_eps: r1(median(rows.map((p) => p.growth_eps))), om: r1(median(rows.map((p) => p.om))),
        price_on_pe: pe != null && eps > 0 ? r2(pe * eps) : null, upside_on_pe: pe != null && eps > 0 && cp3.price > 0 ? r1((pe * eps / cp3.price - 1) * 100) : null }]; })) : null;
    /* the fiscal-year forward P/E this name carried before, and the card's old blend when it has a card */
    const rawRows = TABLES.analyst_estimates.filter((r) => r.ticker === T && r.fiscal_date >= TODAY);
    const cc = own.currency, pair = cc !== "USD" ? estFxPair(TABLES.earnings_events.filter((r) => r.ticker === T), TABLES.analyst_estimates.filter((r) => r.ticker === T && r.period === "quarter")) : null;
    const fw = forwardRead({ price: cp3.price, rows: rawRows, today: TODAY, ccy: cc, fx: pair });
    out.names[T] = { ok: true, name: nameOf(T), price: cp3.price, line: lineWords(set3.own_lines), industry: (inp.profiles[T] || {}).industry || null, sector: (inp.profiles[T] || {}).sector || null,
      /* pe, eps and eps_usd are kept to full precision: the allocation tool divides a live price by eps_usd and must print the dashboard's digit */
      forward: { pe: fw.pe, text: fw.text, eps: fw.eps, eps_usd: fw.eps_usd, basis: fw.basis, label: fw.label, through: fw.through, quarters: fw.quarters, growth_pct: r1(fw.growth_pct), growth_basis: fw.growth_basis, growth_from: fw.growth_from, peg: r2(fw.peg), rev_growth_pct: r1(fw.rev_growth_pct), flags: fw.flags.map((f) => ({ code: f.code, words: f.words })), rate: fw.rate, why: fw.why,
        fiscal_year: { pe: r2(cp3.snap.pe_fwd_annual), eps: r2(cp3.snap.eps_fy1_annual), year: cp3.snap.fy1_annual_date } },
      sets: { old: set0.kept.map((r) => r.ticker), cp1: set1.kept.map((r) => r.ticker), now: set3.kept.map((r) => r.ticker), stated: st ? { line: st.line, peers: st.peers, why: st.why, from: st.from, not_served: st.not_served, added: st.added, legs: st.legs } : null,
        added: set3.kept.filter((r) => !set0.kept.some((k) => k.ticker === r.ticker)).map((r) => r.ticker), priced: [...pricedSet].filter((t) => !outl.has(t)), shown_not_priced: cp3.not_priced || [], rule: cp3.priced_on === "business" ? (st ? "stated same-business peers" : "same-business peers (the line holds four or more, or it is one of the two lines named on 6 Oct)") : "the whole set (too few same-business peers to price on)" },
      runs: { live: slim(live), cp1: slim(cp1), one: slim(one), cp3: slim(cp3) }, own, peers, sits, legs,
      /* the check in words, for the card: what the sources' own set looked like, what was done about it, and the size of the peers that price it */
      set_check: { as_kept: checkOld, now: checkNow, words: [
        ...(checkOld.business.mostly_different ? [`set check: only ${checkOld.business.same} of the ${checkOld.business.of} peers the sources kept share its business — ${cp3.priced_on === "business" ? "it is priced on the " + pricedSet.size + " that do" : "and the whole set still prices it"}`] : []),
        ...checkNow.flags.filter((f) => !/share its business/.test(f)) ] }, three_ways: threeWays };
    const f = (x) => (x && x.band ? `${x.upside_pct >= 0 ? "+" : ""}${x.upside_pct}%${x.priced_on === "business" ? "*" : ""}` : x && x.no_peer_set ? "no set" : "—");
    console.log(`${T.padEnd(5)} ${String(cp3.price).padStart(8)} · fwd ${fw.text.padStart(7)} (fiscal year ${r1(cp3.snap.pe_fwd_annual) ?? "—"}×) growth ${r1(fw.growth_pct) ?? "—"}% PEG ${r2(fw.peg) ?? "—"} · live ${f(live)} · cp1 ${f(cp1)} · one basis ${f(one)} · CP3 ${f(cp3)} on ${[...pricedSet].join(" ")} · debt ${own.debt.word}${own.debt.net_debt_ebitda != null ? " " + own.debt.net_debt_ebitda + "×" : ""}`);
  } catch (e) { out.names[T] = { ok: false, error: String((e && e.stack) || e).slice(0, 700) }; console.log(`${T.padEnd(5)} FAILED ${out.names[T].error}`); }
}
writeFileSync(OUT, JSON.stringify(out));
console.log("DONE →", OUT, "·", Object.values(out.names).filter((n) => n.ok).length, "of", NAMES.length, "names");
