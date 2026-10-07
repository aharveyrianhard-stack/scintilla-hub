/* Scintilla · comps template (C3, 1 Oct) · the cohort read, once, with the FULL comps table (every column of
   deliverables/20260927/comps-single/comps.mjs) and the foreign-filer conversion (fx.mjs) applied before anything is
   computed. Builds on C2's read (deliverables/20260930/comps-tab/cohort.mjs): the same tables, plus cashflow_history
   (CapEx, FCF), filer_currency and fx_rates when they exist, and the chart API's prices. One snapshot per member. */
import { buildInputs, compsRead, cohortFor, row as rowOf, whoSets, peerBand, num } from "../../20260927/comps-r3/r3.mjs";
import { COMPONENTS, components as k2Components } from "../../20260927/comps-single/comps.mjs";
import { tsToISO } from "../../20260925/knockout/field.mjs";
import { filerCurrency, convertSrc, ratesByCurrency, withholdSrc, usdMarketValue, epsTtmByQuarter } from "./fx.mjs";
import { forwardRead, estFxPair } from "../../../lib/forward-basis.mjs";

/* CP3 (7 Oct) · ONE FORWARD BASIS. Alan: "Why is there inconsistencies everywhere on the forward P/E … if [the dashboard's]
   is the right one, it should be everywhere." This reader took the nearest FISCAL YEAR's estimate; the dashboard takes the
   NEXT FOUR QUARTERS. The rule now lives once, in lib/forward-basis.mjs, and this reader hands every company's forward
   EPS, its growth into the following year and its flags to buildInputs (comps.mjs) as `src.forward`:
     forward "next-four-quarters" (the default)  the dashboard's rule — P/E forward, PEG and the growth credit rest on it
     forward "fiscal-year"                       the comps system as it stood before CP3 (kept for before → after)
   A foreign reporter's EPS is put in dollars at the supplier's own paired rate, as on the dashboard; without an agreeing
   pair its forward multiple is withheld. `forwardSeries`: tickers the supplier serves no dollar estimates for at all (the
   comps-only reference peers) — their rate is the dated close this reader already holds, and their next twelve months
   are blended from their two nearest fiscal years, because they carry no quarterly estimates. */
export const FORWARD_DEFAULT = "next-four-quarters";

export const ROWS = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg"];               // the six valuation rows, Alan's order
export const SHORT = { pe_ttm: "P/E", pe_fwd: "P/E FWD", ev_ebitda: "EV/EBITDA", ev_sales: "EV/S", ps: "P/S", peg: "PEG" };
/** The original comps table: valuation · growth · margins · balance sheet · capex (comps.mjs COMPONENTS, P/S added). */
export const TABLE = [
  { key: "pe_ttm", group: "valuation", label: "P/E trailing", fmt: "x" }, { key: "pe_fwd", group: "valuation", label: "P/E forward", fmt: "x" },
  { key: "ev_ebitda", group: "valuation", label: "EV/EBITDA", fmt: "x" }, { key: "ev_sales", group: "valuation", label: "EV/sales", fmt: "x" },
  { key: "ps", group: "valuation", label: "P/S", fmt: "x" }, { key: "peg", group: "valuation", label: "PEG", fmt: "x2" },
  { key: "rev_g_ttm", group: "growth", label: "Revenue TTM", fmt: "pct" }, { key: "rev_g_fy", group: "growth", label: "Revenue, next four quarters", fmt: "pct" }, { key: "eps_g_fy", group: "growth", label: "EPS, next four quarters", fmt: "pct" },   /* CP3: on the one forward basis these two are the growth INTO THE FOLLOWING YEAR (the four quarters after the next four over the next four); the tabs say so from snapshot.forward */
  { key: "gm", group: "margins", label: "Gross", fmt: "pct" }, { key: "om", group: "margins", label: "Operating", fmt: "pct" }, { key: "fcfm", group: "margins", label: "FCF", fmt: "pct" },
  { key: "nd_ebitda", group: "balance sheet", label: "Net debt / EBITDA", fmt: "x" },
  { key: "capex_rev", group: "capex", label: "CapEx / revenue", fmt: "pct" }, { key: "capex_g", group: "capex", label: "CapEx growth", fmt: "pct" }, { key: "rev_per_capex", group: "capex", label: "New revenue per CapEx $", fmt: "usd2" },
];
const SIZE_TAGS = ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP"];
const daysBefore = (todayISO, n) => new Date(Date.parse(todayISO + "T00:00:00Z") - n * 86400e3).toISOString().slice(0, 10);
export function cohortChoice(ticker, tags, asked) { const cohort = cohortFor(ticker, tags, asked); return { cohort, options: [...new Set([cohort, ...(tags || []).filter((t) => !SIZE_TAGS.includes(t))])].filter(Boolean) }; }

/** Read one cohort. pg: PostgREST GET; quotes: tickers → {quotes}; fxStandin: { CCY: [[date, rate]] } with a `source` word
    (used only for a currency fx_rates does not carry, and named as such on the row). */
/* FD1 (7 Oct) · marketValueFrom: "profile" — TODAY'S MARKET VALUE FOR EVERY COMPANY, a switch that is off by default.
   fundamentals.market_cap is FMP's key-metrics market value at the latest FISCAL PERIOD END (its writer says so:
   supabase/functions/fmp-fundamentals), while fundamentals.price is a quote taken when the row was written. This file
   and comps.mjs read the two as "measured on one day" and take shares = market value ÷ price: the share count, and with
   it the market value, EV/sales, EV/EBITDA and P/S, are off by however far the price has moved since the period ended
   (measured 7 Oct on the 26 card names: Western Digital +25%, Nebius +35%, Coherent +33%, Lam +26%, Nvidia −15%,
   Micron −9.5%). C5b already takes a FOREIGN reporter's market value and price together from company_profile, which is
   refreshed every day (its market value is its price × its shares). With the switch on, a dollar reporter is read the
   same way. Off, this file answers exactly as before. */
export async function readCohort({ ticker, cohortAsked = null, today, pg, quotes, livePrices = {}, fxStandin = null, membersAsked = null, labelAsked = null, reportedCcy = null, marketValueFrom = null, forward = FORWARD_DEFAULT, forwardSeries = [] }) {
  const TICKER = String(ticker).toUpperCase(), TODAY = today;
  const [own, home] = await Promise.all([pg(`ticker_cohorts?select=ticker,cohort&ticker=eq.${encodeURIComponent(TICKER)}`), pg(`tickers?select=cohort&ticker=eq.${encodeURIComponent(TICKER)}`).catch(() => [])]);
  /* the peer set is the company's HOME cohort on our board (tickers.cohort, the one the board files it under), unless asked
     otherwise; the other tags it carries are offered as alternatives */
  const homeCohort = home && home[0] && home[0].cohort ? String(home[0].cohort).toUpperCase() : null;
  const tags = [...new Set(own.map((x) => x.cohort))];
  let { cohort, options } = cohortChoice(TICKER, tags, cohortAsked || homeCohort);
  if (homeCohort && !options.includes(homeCohort)) options.unshift(homeCohort);
  if (!cohort) throw new Error(`${TICKER} carries no cohort tag in ticker_cohorts, so it has no peers on file`);
  /* C3b/C4 — a set given by name (FMP peers, the mechanic's kept list): its members are read as they are */
  const mem = membersAsked ? membersAsked.map((t) => ({ ticker: t })) : await pg(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(cohort)}&order=ticker.asc`);
  if (membersAsked && labelAsked) cohort = labelAsked;
  const T = [...new Set([TICKER, ...mem.map((m) => String(m.ticker).toUpperCase())])];
  if (T.length < 2) throw new Error(`${TICKER} is the only name tagged ${cohort}: no peers`);
  const inq = "in.(" + T.map(encodeURIComponent).join(",") + ")";
  const opt = (p) => pg(p).catch(() => null);
  const [fund, est, incH, cfH, bal, prof, gg, filers, fxRows, quotesRes] = await Promise.all([
    pg(`fundamentals?select=ticker,price,market_cap,eps_ttm,adjusted_eps_ttm,revenue_ttm,trailing_pe,adjusted_pe,updated_ts&ticker=${inq}`),
    pg(`analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_revenue_avg,price_target_avg,updated_ts&period=eq.annual&ticker=${inq}&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`),
    pg(`fundamentals_history?select=ticker,period,fiscal_year,fiscal_date,revenue,gross_profit,operating_income,ebitda,net_income,eps_diluted,shares_dil&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 1100)}&order=fiscal_date.desc`),
    pg(`cashflow_history?select=ticker,period,fiscal_year,fiscal_date,operating_cf,capex,free_cf&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 2200)}&order=fiscal_date.desc`),
    pg(`balance_history?select=ticker,period,fiscal_date,net_debt,total_debt,cash_and_equiv&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 800)}&order=fiscal_date.desc`),
    pg(`company_profile?select=ticker,name,industry,sector,is_etf,is_adr,country,price,market_cap&ticker=${inq}`),
    opt(`composite_staged?select=ticker,composite,updated_ts&tf=eq.D&ticker=${inq}&order=ticker.asc,updated_ts.desc`),
    opt(`filer_currency?select=ticker,reported_currency,listing_currency,is_adr,shares_dil,statement_date,source&ticker=${inq}`),
    (async () => { /* C4 — paged: fx_rates holds thousands of rows and PostgREST serves 1,000 per request */
      const all = []; for (let off = 0; off < 50000; off += 1000) { const page = await opt(`fx_rates?select=pair,date,rate&date=gte.${daysBefore(TODAY, 1200)}&order=date.asc,pair.asc&limit=1000&offset=${off}`); if (page == null) return off ? all : null; all.push(...page); if (page.length < 1000) break; } return all; })(),
    Promise.resolve().then(() => quotes(T)).catch((e) => ({ quotes: {}, error: String((e && e.message) || e) })),
  ]);
  const qmap = quotesRes && quotesRes.quotes && typeof quotesRes.quotes === "object" ? quotesRes.quotes : {};
  const first = (rows, t) => (rows || []).find((r) => r.ticker === t) || null;
  const rates = ratesByCurrency(fxRows || []);
  const standin = fxStandin && typeof fxStandin === "object" ? fxStandin : null;
  const srcs = new Map(), meta = {}, fx = {}, fwd = {};
  /* CP3 — the quarterly estimates (paged: a large cohort holds more than 1,000 rows) and, for the foreign reporters, the
     supplier's dollar estimates beside its local ones (the paired rate). Each read is optional: a table that does not
     answer leaves the company on the fiscal-year estimate, and its row says so. */
  const oneBasis = forward === "next-four-quarters", series4 = new Set((forwardSeries || []).map((t) => String(t).toUpperCase()));
  const paged = async (base) => { const all = []; for (let off = 0; off < 30000; off += 1000) { const page = await opt(`${base}&limit=1000&offset=${off}`); if (page == null) return off ? all : null; all.push(...page); if (page.length < 1000) break; } return all; };
  const ccyOf = (t) => { const p = first(prof, t) || {}; let ci = filerCurrency(t, p, first(filers, t), reportedCcy || (standin && standin.reported) || null); if (!ci.currency && standin && standin.filers && standin.filers[t]) ci = { currency: String(standin.filers[t]).toUpperCase() }; return ci.currency || null; };
  const foreignT = oneBasis ? T.filter((t) => { const c = ccyOf(t); return c && c !== "USD" && !series4.has(t); }) : [];
  const inF = "in.(" + foreignT.map(encodeURIComponent).join(",") + ")", since400 = daysBefore(TODAY, 400);
  const [estQ, pairEv, pairQ] = oneBasis ? await Promise.all([
    paged(`analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_revenue_avg,num_analysts_eps,updated_ts&period=eq.quarter&ticker=${inq}&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`),
    foreignT.length ? paged(`earnings_events?select=ticker,date,eps_estimate,revenue_estimate&ticker=${inF}&date=gte.${since400}&order=ticker.asc,date.desc`) : [],
    foreignT.length ? paged(`analyst_estimates?select=ticker,fiscal_date,est_eps_avg,est_revenue_avg&period=eq.quarter&ticker=${inF}&fiscal_date=gte.${since400}&order=ticker.asc,fiscal_date.desc`) : [],
  ]) : [null, [], []];
  for (const t of T) {
    const f = first(fund, t) || {}, p = first(prof, t) || {};
    let q = qmap[t] && qmap[t].price != null ? qmap[t] : null;
    const lp = livePrices && num(livePrices[t]);
    if (lp > 0) q = { price: lp, price_observation_utc: q && q.price_observation_utc ? q.price_observation_utc : null, live: true };
    const inc = (incH || []).filter((r) => r.ticker === t), cf = (cfH || []).filter((r) => r.ticker === t);
    let src = {
      ticker: t, profile: p, tags: [], fundamentals: { ...f, date: tsToISO(f.updated_ts) }, quote: q,
      price_date: q && q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : q && q.live ? TODAY : tsToISO(f.updated_ts),
      estimates: (est || []).filter((e) => e.ticker === t), incQ: inc.filter((r) => r.period !== "FY"), incFY: inc.filter((r) => r.period === "FY"),
      cfQ: cf.filter((r) => r.period !== "FY"), cfFY: cf.filter((r) => r.period === "FY"), balance: (bal || []).filter((r) => r.ticker === t),
      next_report: null, target: null, geiger: null, heartbeat: null,
    };
    /* the foreign filer: currency from filer_currency, rates from fx_rates; a stand-in series only where fx_rates has none */
    /* C5b — FMP's statement currency for every served company (reportedCcy, or the stand-in's `reported` map) outranks the
       profile guess, so a foreign reporter without a filer_currency row (PDD) is never taken for a dollar filer */
    let ci = filerCurrency(t, p, first(filers, t), reportedCcy || (standin && standin.reported) || null);
    if (!ci.currency && standin && standin.filers && standin.filers[t]) ci = { currency: String(standin.filers[t]).toUpperCase(), source: standin.filers_source || "stand-in filer list", known: false };
    let series = rates, standinUsed = false, impliedUsed = false;
    if (ci.currency && ci.currency !== "USD" && !(rates[ci.currency] && rates[ci.currency].length)) {
      if (standin && standin.rates && standin.rates[ci.currency]) { series = { ...rates, [ci.currency]: standin.rates[ci.currency] }; standinUsed = true; }
      else if (num(p.market_cap) > 0 && num(f.market_cap) > 0 && f.market_cap / p.market_cap > 1.5) {
        /* no published series for this currency (TWD is not an ECB currency): the one rate FMP serves implicitly, its USD
           market value over its own-currency market value, on the fundamentals row's date; one rate for every date, named */
        series = { ...rates, [ci.currency]: [["2000-01-01", p.market_cap / f.market_cap]] }; impliedUsed = true;
      }
    }
    const { src: conv, note } = convertSrc(src, ci, series, TODAY);
    if (standinUsed) { note.source_rates = standin.source || "stand-in rates"; const nr = note.rates[note.rates.length - 1]; note.why = `statements in ${ci.currency}, converted to USD at the ${ci.currency}USD rate for each statement date (newest ${nr ? nr.date + ": " + nr.rate.toPrecision(5) : "—"}; estimates at ${note.today_rate_date || "—"}) · ${standin.source || "stand-in rates"}`; note.standin = true; }
    else if (impliedUsed) { note.source_rates = "implied by FMP's own market values"; note.why = `statements in ${ci.currency}, converted at ONE rate, ${(p.market_cap / f.market_cap).toPrecision(4)} USD per ${ci.currency}, implied by FMP's USD market value over its ${ci.currency} market value (fundamentals row of ${tsToISO(f.updated_ts) || "?"}); a stand-in for every date until fx_rates carries ${ci.currency}USD`; note.implied = true; }
    else if (note.converted) note.source_rates = "fx_rates (FMP)";
    note.currency_source = ci.source;
    /* C5b — ONE CURRENCY PER MULTIPLE. Every multiple is a ratio of two dollar figures: statements at their period-end rate,
       estimates at today's (convertSrc), trailing EPS quarter by quarter, the market value from FMP's USD profile (the stored
       one is in the reporting currency). A foreign figure that cannot be put in dollars is withheld, never mixed. */
    let out = conv;
    if (ci.currency !== "USD") {
      if (!note.converted) { out = withholdSrc(src); note.withheld = true; note.why += " · its multiples are withheld (a figure in " + (ci.currency || "an unknown currency") + " is never divided by a dollar price)"; }
      else {
        const e = epsTtmByQuarter(src, conv);
        if (e != null) { out = { ...out, fundamentals: { ...out.fundamentals, eps_ttm: e } }; note.eps_ttm_basis = "the four newest quarters, each at its own period-end rate"; }
        const mv = usdMarketValue(out, ci.currency); out = mv.src; note.market_value = mv.from;
      }
    }
    /* FD1 marketValueFrom "profile": a dollar reporter's market value and price, together, from the profile (today's) */
    let mvFrom = null;
    if (marketValueFrom === "profile" && ci.currency === "USD" && num(p.market_cap) > 0 && num(p.price) > 0) { out = { ...out, fundamentals: { ...out.fundamentals, market_cap: Number(p.market_cap), price: Number(p.price), _mcap_from_profile: true } }; mvFrom = "company_profile (today's market value and price together)"; }
    /* CP3 — the one forward basis for this company, from its estimates AS STORED (its own currency), never the converted copy */
    if (oneBasis && estQ != null && !note.withheld) {
      const cc = ci.currency || "USD", foreign = cc !== "USD";
      let rate = null;
      const seriesRate = (why) => { const sr = (series[cc] || []).filter((r) => String(r[0]) <= TODAY).pop(); return sr && Number(sr[1]) > 0 ? { f: Number(sr[1]), on: String(sr[0]), from: `the ${cc}USD rate of ${sr[0]} on file (${why})` } : null; };
      if (foreign && series4.has(t)) rate = seriesRate("the supplier serves no dollar estimates for it");
      else if (foreign) { rate = estFxPair((pairEv || []).filter((r) => r.ticker === t), (pairQ || []).filter((r) => r.ticker === t)); if (!rate && pairEv == null) rate = seriesRate("the supplier's dollar estimates did not answer"); }
      const f = forwardRead({ price: null, rows: [...src.estimates, ...estQ.filter((e) => e.ticker === t)], today: TODAY, ccy: cc, fx: rate, annual: series4.has(t) ? "blend" : "nearest" });
      if (f.basis) { out = { ...out, forward: f }; fwd[t] = { basis: f.basis, label: f.label, through: f.through, growth_pct: f.growth_pct, growth_basis: f.growth_basis, growth_from: f.growth_from, flags: f.flags, rate: f.rate, quarters: f.quarters, eps_local: f.eps, eps_usd: f.eps_usd, withheld_why: foreign && !rate ? f.why : null, years: f.years || null }; }
    }
    fx[t] = note; src = out;
    srcs.set(t, src); if (mvFrom) note.market_value = mvFrom;
    const g = first(gg, t);
    meta[t] = { price_from: q ? (q.live ? "the Hub's live quote" : "chart API /quotes") : (num(f.price) != null ? "fundamentals row (dated)" : null), fund_date: tsToISO(f.updated_ts), geiger: g ? num(g.composite) : null, geiger_at: g ? tsToISO(g.updated_ts) : null, sector: p.sector || null, industry: p.industry || null };
  }
  /* the USD price for a company whose fundamentals row has no price (TSM): the quote or the profile's USD price */
  for (const t of T) { const s = srcs.get(t); if (!(num(s.fundamentals.price) > 0) && num(s.profile.price) > 0) s.fundamentals = { ...s.fundamentals, price: s.profile.price, market_cap: s.profile.market_cap ?? s.fundamentals.market_cap, _price_from_profile: true }; }
  const inputs = T.map((t) => buildInputs(srcs.get(t), TODAY)).filter((i) => i && i.ticker);
  const names = Object.fromEntries(T.map((t) => [t, ((first(prof, t) || {}).name) || t]));
  return { taken: new Date().toISOString(), today: TODAY, ticker: TICKER, cohort, cohort_options: options, home_cohort: homeCohort, members: T, inputs, names, meta, fx,
    forward: oneBasis && estQ != null ? "next-four-quarters" : "fiscal-year", fwd, forward_note: oneBasis && estQ == null ? "the quarterly estimates did not answer: every company is on its fiscal-year estimate" : null,
    fx_tables: { filer_currency: filers != null, fx_rates: fxRows != null, rate_days: (fxRows || []).length }, market_value_from: marketValueFrom || "fundamentals row (the last fiscal period end's market value over a later price)",
    excluded: inputs.filter((i) => i.is_etf).map((i) => ({ ticker: i.ticker, why: "a fund, not a company" })),
    quotes_error: quotesRes && quotesRes.error ? quotesRes.error : null, peer_source: cohort === homeCohort ? `${cohort}, the company's home cohort on our board` : `the ${cohort} cohort on our board${homeCohort ? " (its home cohort is " + homeCohort + ")" : ""}` };
}

/** One member's snapshot: the C2 shape (six rows, every peer in, `values` per row) plus `table` — every component of the
    original comps table per peer and for the company — and the fx note. */
export function snapshotFromCohort(ctx, ticker) {
  const TICKER = String(ticker).toUpperCase();
  const me = ctx.inputs.find((i) => i.ticker === TICKER);
  if (!me) throw new Error(`${TICKER} has no fundamentals row`);
  const read = compsRead(me, ctx.inputs, { outOut: false, nm: false });
  const revOf = (i) => i.rev?.now ?? i.revenue_ttm_on_file;
  const psOf = (i) => (i.mcap > 0 && revOf(i) > 0) ? i.mcap / revOf(i) : null;
  const peersIn = ctx.inputs.filter((p) => p.ticker !== TICKER && !p.is_etf);
  const ends = (band, sets, price) => { const at = (m, who) => ({ multiple: m, who, price: price(m) }); return { min: at(band.min, sets.low ? [sets.low] : []), q1: at(band.q1, []), median: at(band.median, sets.median || []), q3: at(band.q3, []), max: at(band.max, sets.high ? [sets.high] : []) }; };
  const noRule = { rule: "no rule sets a peer aside; the flags suggest, the operator decides", fence: null, out: [] };
  function psRow() {
    const vals = peersIn.map((p) => ({ ticker: p.ticker, value: psOf(p) }));
    const usable = vals.filter((x) => x.value != null), sets = whoSets(usable), band = peerBand(usable.map((x) => x.value));
    const sh = me.shares, rev = revOf(me), price = (m) => (m != null && rev > 0 && sh > 0) ? m * rev / sh : null;
    return { key: "ps", label: "P/S", basis: "market value ÷ revenue, TTM", fmt: "x", own: { multiple: psOf(me), price: num(me.price) },
      figure: { word: "revenue TTM", value: rev, fmt: "money", formula: "multiple × revenue ÷ shares" }, n: band.n, band, ends: ends(band, sets, price),
      peers: (sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })), nm: [], missing: vals.filter((x) => x.value == null).map((x) => x.ticker),
      values: Object.fromEntries(vals.map((x) => [x.ticker, { multiple: x.value, why: x.value == null ? (revOf(ctx.inputs.find((i) => i.ticker === x.ticker)) == null ? "no revenue on file" : "no market value") : null }])),
      outliers: noRule, upside: price(band.median) != null && me.price > 0 ? (price(band.median) / me.price - 1) * 100 : null,
      ok: band.n >= 2 && price(band.min) != null, reason: band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} carr${band.n === 1 ? "ies" : "y"} this multiple — a range needs two` : price(band.min) == null ? `${TICKER} cannot be priced on this row: no revenue or share count` : null };
  }
  function liveRow(key) {
    const rd = read.rows.find((r) => r.key === key), bar = read.bars.find((b) => b.key === key), r = rowOf(key);
    const values = {};
    for (const p of peersIn) { const inRow = (rd.peers || []).find((x) => x.ticker === p.ticker); values[p.ticker] = inRow ? { multiple: inRow.value, why: null } : { multiple: null, why: peerWhy(key, p, ctx.fx[p.ticker]) }; }
    return { key, label: r.label, basis: r.basis, fmt: r.fmt, own: { multiple: rd.value, price: num(me.price) }, figure: bar.figure, own_why: rd.value == null ? ((ctx.fx[TICKER] && ctx.fx[TICKER].withheld ? peerWhy(key, me, ctx.fx[TICKER]) : null) || rd.why || peerWhy(key, me, ctx.fx[TICKER])) : null,
      n: rd.n, band: rd.band, ends: Object.fromEntries(Object.entries(bar.ends).map(([k, e]) => [k, { multiple: e.m, who: e.who, price: e.price }])),
      peers: (rd.sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })), nm: [], missing: rd.missing, values, outliers: noRule, upside: bar.upside, ok: bar.ok, reason: bar.reason };
  }
  const rows = ROWS.map((k) => (k === "ps" ? psRow() : liveRow(k)));
  /* the full table: every component of comps.mjs for the company and each peer (P/S added) */
  /* CP1 (6 Oct) — four figures added to every company's row. None is in TABLE, so no tab draws them until asked.
     ffo_ps / p_ffo: funds from operations APPROXIMATED from the statements on file — net income (trailing EPS × shares)
     plus depreciation and amortisation (EBITDA − operating income), trailing twelve months. Nareit's FFO also takes out
     gains on property sales and adds back only real-estate depreciation; the companies' own FFO / AFFO is not in our data.
     rev_g_2y / eps_g_2y: TWO-YEAR FORWARD GROWTH, a year — from the trailing twelve months to the consensus for the fiscal
     year after next, annualised over the time between the two period ends. It counts the fiscal year in progress, which
     the "next FY" column (FY2 over FY1) leaves out: for a company whose year has just turned, that column skips the year
     the growth is in (Micron, 6 Oct: next FY +18%, two-year forward +55% a year). */
  const yearsTo = (from, to) => (from && to ? (Date.parse(to + "T00:00:00Z") - Date.parse(String(from).slice(0, 10) + "T00:00:00Z")) / (365.25 * 86400e3) : null);
  const comp = (i) => { const c = k2Components(i).v; c.ps = psOf(i);
    const da = i.ebitda?.now != null && i.oi?.now != null ? i.ebitda.now - i.oi.now : null;
    c.ffo_ps = i.eps_ttm != null && da != null && i.shares > 0 ? i.eps_ttm + da / i.shares : null;
    c.p_ffo = c.ffo_ps > 0 && i.price > 0 ? i.price / c.ffo_ps : null;
    const yrs = i.rev?.basis === "TTM" || i.rev?.basis === "FY" ? yearsTo(i.rev.to, i.fy2_date) : null, ok = yrs != null && yrs >= 0.75 && yrs <= 3.5;
    c.rev_g_2y = ok && i.rev.now > 0 && i.rev_fy2 > 0 ? (Math.pow(i.rev_fy2 / i.rev.now, 1 / yrs) - 1) * 100 : null;
    c.eps_g_2y = ok && i.eps_ttm > 0 && i.eps_fy2 > 0 ? (Math.pow(i.eps_fy2 / i.eps_ttm, 1 / yrs) - 1) * 100 : null;
    c.g_2y_years = ok ? yrs : null;
    return c; };
  const table = { company: comp(me), peers: Object.fromEntries(peersIn.map((p) => [p.ticker, comp(p)])) };
  const m = ctx.meta[TICKER] || {};
  const peerDates = {};
  for (const i of ctx.inputs) peerDates[i.ticker] = { fundamentals: (ctx.meta[i.ticker] || {}).fund_date || null, estimate_fy: i.fy1_date || null, ttm_to: i.rev?.to || null, ttm_basis: i.rev?.basis || null, balance: i.net_debt_date || null, price: i.price_date || null, price_from: (ctx.meta[i.ticker] || {}).price_from || null };
  return {
    taken: ctx.taken, today: ctx.today, ticker: TICKER, name: ctx.names[TICKER], cohort: ctx.cohort, cohort_options: ctx.cohort_options, peer_source: ctx.peer_source,
    members: ctx.members, excluded: ctx.excluded.filter((e) => e.ticker !== TICKER), names: ctx.names, sector: m.sector || null, industry: m.industry || null,
    price: num(me.price), price_date: me.price_date, price_from: m.price_from || null, geiger: m.geiger ?? null, geiger_at: m.geiger_at || null,
    shares: me.shares, mcap: me.mcap, net_debt: me.net_debt, net_debt_date: me.net_debt_date,
    eps_ttm: me.eps_ttm, eps_date: m.fund_date || null, eps_fy1: me.eps_fy1, fy1_date: me.fy1_date, eps_fy2: me.eps_fy2 ?? null, fy2_date: me.fy2_date || null,
    /* CP3 — which forward basis every row of this snapshot is on, each company's own note, and the fiscal-year figures it replaced */
    forward: ctx.forward || "fiscal-year", fwd: (ctx.fwd && ctx.fwd[TICKER]) || null, fwd_peers: Object.fromEntries(peersIn.map((p) => [p.ticker, (ctx.fwd && ctx.fwd[p.ticker]) || null])),
    eps_fy1_annual: me.eps_fy1_annual ?? null, fy1_annual_date: me.fy1_annual_date || null, pe_fwd_annual: me.eps_fy1_annual > 0 && me.price > 0 ? me.price / me.eps_fy1_annual : null,
    pe_fwd_annual_peers: Object.fromEntries(peersIn.map((p) => [p.ticker, p.eps_fy1_annual > 0 && p.price > 0 ? p.price / p.eps_fy1_annual : null])),
    revenue_ttm: revOf(me), ebitda_ttm: me.ebitda?.now ?? null,
    dates: { eps: m.fund_date || null, revenue_to: me.rev?.to || null, revenue_basis: me.rev?.basis || null, ebitda_to: me.ebitda?.to || null, ebitda_basis: me.ebitda?.basis || null, balance: me.net_debt_date || null },
    rows, table, fx: ctx.fx[TICKER] || null, fx_peers: Object.fromEntries(peersIn.map((p) => [p.ticker, ctx.fx[p.ticker] || null])), fx_tables: ctx.fx_tables, peer_dates: peerDates, quotes_error: ctx.quotes_error,
    arithmetic: "deliverables/20260927/comps-r3/r3.mjs (compsRead, nm:false → rows, bars) · comps-single/comps.mjs (components → the table) · P/S computed here · foreign filers converted by fx.mjs",
  };
}
function peerWhy(key, p, fx) {
  if (fx && fx.currency && fx.currency !== "USD" && !fx.converted) return `statements in ${fx.currency}: no USD rate on file`;
  if (fx && fx.withheld && !fx.currency) return "reporting currency unknown: withheld, never divided by a dollar price";   // C5b
  const revNow = p.rev?.now ?? p.revenue_ttm_on_file;
  if (key === "pe_ttm") return p.eps_ttm == null ? "no trailing EPS on file" : p.eps_ttm <= 0 ? "trailing EPS is negative or zero" : "no price";
  if (key === "pe_fwd") return p.eps_fy1 == null ? "no EPS estimate on file" : p.eps_fy1 <= 0 ? "estimated EPS is negative or zero" : "no price";
  if (key === "ev_sales") return p.net_debt == null ? "no net debt on file (no enterprise value)" : revNow == null ? "no revenue on file" : revNow <= 0 ? "revenue is not positive" : "enterprise value is not positive";
  if (key === "ev_ebitda") return p.ebitda?.now == null ? "no EBITDA history on file" : p.ebitda.now <= 0 ? "EBITDA is negative or zero" : p.net_debt == null ? "no net debt on file" : "enterprise value is not positive";
  if (key === "peg") return p.eps_fy1 == null || p.eps_fy2 == null ? "two EPS estimates are needed" : p.eps_fy1 <= 0 ? "estimated EPS is not positive" : "EPS is not expected to grow";
  return "no figure";
}
