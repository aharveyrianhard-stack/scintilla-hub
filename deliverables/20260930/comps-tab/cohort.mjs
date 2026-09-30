/* Scintilla · COMPS tab (C2, 30 Sep) · the cohort read, once, and a snapshot for ANY member of it.
   C1's snapshot-taker (deliverables/20260929/comps-live/snapshot-live.mjs) read the tables once per company; the cohort
   table needs every member's band, so this reads the cohort ONCE and cuts one snapshot per member from the same inputs,
   with the same arithmetic (deliverables/20260927/comps-r3/r3.mjs → compsRead). Differences from C1, on purpose:
   · NO CAP: every peer with a positive multiple is in ALL PEERS (C1 set aside anything above 100x / 50x / 10x). Alan,
     30 Sep: "i havent seen any outliers discussed by us for you to be showing that" — so nothing is set aside by a rule;
     the flags (comps-tab.mjs) only suggest, the operator decides.
   · a peer whose multiple is negative or undefined has no number to rank; it is NOT MEANINGFUL on that measure and
     the row says why. */
import { buildInputs, compsRead, cohortFor, row, whoSets, peerBand, num } from "../../20260927/comps-r3/r3.mjs";
import { tsToISO } from "../../20260925/knockout/field.mjs";

export const ROWS = ["pe_ttm", "pe_fwd", "ev_sales", "ev_ebitda", "ps", "peg"];
export const SHORT = { pe_ttm: "P/E", pe_fwd: "P/E FWD", ev_sales: "EV/S", ev_ebitda: "EV/EBITDA", ps: "P/S", peg: "PEG" };
const SIZE_TAGS = ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP"];
const daysBefore = (todayISO, n) => new Date(Date.parse(todayISO + "T00:00:00Z") - n * 86400e3).toISOString().slice(0, 10);

export function cohortChoice(ticker, tags, asked) {
  const cohort = cohortFor(ticker, tags, asked);
  return { cohort, options: [...new Set([cohort, ...(tags || []).filter((t) => !SIZE_TAGS.includes(t))])].filter(Boolean) };
}

/** Read one cohort. pg: PostgREST GET; quotes: tickers → {quotes:{T:{price,price_observation_utc}}}; geiger optional. */
export async function readCohort({ ticker, cohortAsked = null, today, pg, quotes, livePrices = {} }) {
  const TICKER = String(ticker).toUpperCase(), TODAY = today;
  const own = await pg(`ticker_cohorts?select=ticker,cohort&ticker=eq.${encodeURIComponent(TICKER)}`);
  const { cohort, options } = cohortChoice(TICKER, [...new Set(own.map((x) => x.cohort))], cohortAsked);
  if (!cohort) throw new Error(`${TICKER} carries no cohort tag in ticker_cohorts, so it has no peers on file`);
  const mem = await pg(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(cohort)}&order=ticker.asc`);
  const T = [...new Set([TICKER, ...mem.map((m) => m.ticker)])];
  if (T.length < 2) throw new Error(`${TICKER} is the only name tagged ${cohort}: no peers`);
  const inq = "in.(" + T.map(encodeURIComponent).join(",") + ")";
  const [fund, est, incH, bal, prof, gg, quotesRes] = await Promise.all([
    pg(`fundamentals?select=ticker,price,market_cap,eps_ttm,revenue_ttm,trailing_pe,adjusted_pe,updated_ts&ticker=${inq}`),
    pg(`analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_revenue_avg,price_target_avg,updated_ts&period=eq.annual&ticker=${inq}&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`),
    pg(`fundamentals_history?select=ticker,period,fiscal_year,fiscal_date,revenue,gross_profit,operating_income,ebitda&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 1100)}&order=fiscal_date.desc`),
    pg(`balance_history?select=ticker,period,fiscal_date,net_debt,total_debt,cash_and_equiv&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 800)}&order=fiscal_date.desc`),
    pg(`company_profile?select=ticker,name,industry,is_etf&ticker=${inq}`),
    pg(`composite_staged?select=ticker,composite,updated_ts&tf=eq.D&ticker=${inq}&order=ticker.asc,updated_ts.desc`).catch(() => []),
    Promise.resolve().then(() => quotes(T)).catch((e) => ({ quotes: {}, error: String((e && e.message) || e) })),
  ]);
  const qmap = quotesRes && quotesRes.quotes && typeof quotesRes.quotes === "object" ? quotesRes.quotes : {};
  const first = (rows, t) => rows.find((r) => r.ticker === t) || null;
  const srcs = new Map(), meta = {};
  for (const t of T) {
    const f = first(fund, t) || {};
    let q = qmap[t] && qmap[t].price != null ? qmap[t] : null;
    const lp = livePrices && num(livePrices[t]);
    if (lp > 0) q = { price: lp, price_observation_utc: q && q.price_observation_utc ? q.price_observation_utc : null, live: true };
    const inc = incH.filter((r) => r.ticker === t);
    srcs.set(t, {
      ticker: t, profile: first(prof, t) || {}, tags: [], fundamentals: { ...f, date: tsToISO(f.updated_ts) }, quote: q,
      price_date: q && q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : q && q.live ? TODAY : tsToISO(f.updated_ts),
      estimates: est.filter((e) => e.ticker === t), incQ: inc.filter((r) => r.period !== "FY"), incFY: inc.filter((r) => r.period === "FY"),
      cfQ: [], cfFY: [], balance: bal.filter((r) => r.ticker === t), next_report: null, target: null, geiger: null, heartbeat: null,
    });
    const g = first(gg, t);
    meta[t] = { price_from: q ? (q.live ? "the Hub's live quote" : "chart API /quotes") : (num(f.price) != null ? "fundamentals row (dated)" : null), fund_date: tsToISO(f.updated_ts), geiger: g ? num(g.composite) : null, geiger_at: g ? tsToISO(g.updated_ts) : null };
  }
  const inputs = T.map((t) => buildInputs(srcs.get(t), TODAY)).filter((i) => i && i.ticker);
  const names = Object.fromEntries(T.map((t) => [t, ((first(prof, t) || {}).name) || t]));
  return { taken: new Date().toISOString(), today: TODAY, ticker: TICKER, cohort, cohort_options: options, members: T, inputs, names, meta,
    excluded: inputs.filter((i) => i.is_etf).map((i) => ({ ticker: i.ticker, why: "a fund, not a company" })),
    quotes_error: quotesRes && quotesRes.error ? quotesRes.error : null };
}

/** One member's snapshot from the cohort read: the C1 shape, every peer in (no cap), plus `values` per row —
    every peer's multiple or the reason it has none. */
export function snapshotFromCohort(ctx, ticker) {
  const TICKER = String(ticker).toUpperCase();
  const me = ctx.inputs.find((i) => i.ticker === TICKER);
  if (!me) throw new Error(`${TICKER} has no fundamentals row`);
  const read = compsRead(me, ctx.inputs, { outOut: false, nm: false });
  const revOf = (i) => i.rev?.now ?? i.revenue_ttm_on_file;
  const psOf = (i) => (i.mcap > 0 && revOf(i) > 0) ? i.mcap / revOf(i) : null;
  const peersIn = ctx.inputs.filter((p) => p.ticker !== TICKER && !p.is_etf);
  function ends(key, band, sets, price) {
    const at = (m, who) => ({ multiple: m, who, price: price(m) });
    return { min: at(band.min, sets.low ? [sets.low] : []), q1: at(band.q1, []), median: at(band.median, sets.median || []), q3: at(band.q3, []), max: at(band.max, sets.high ? [sets.high] : []) };
  }
  function psRow() {
    const vals = peersIn.map((p) => ({ ticker: p.ticker, value: psOf(p) }));
    const usable = vals.filter((x) => x.value != null);
    const sets = whoSets(usable), band = peerBand(usable.map((x) => x.value));
    const sh = me.shares, rev = revOf(me);
    const price = (m) => (m != null && rev > 0 && sh > 0) ? m * rev / sh : null;
    const E = ends("ps", band, sets, price);
    return { key: "ps", label: "P/S", basis: "market value ÷ revenue, TTM", fmt: "x", own: { multiple: psOf(me), price: num(me.price) },
      figure: { word: "revenue TTM", value: rev, fmt: "money", formula: "multiple × revenue ÷ shares" }, n: band.n, band, ends: E,
      peers: (sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })), nm: [], missing: vals.filter((x) => x.value == null).map((x) => x.ticker),
      values: Object.fromEntries(vals.map((x) => [x.ticker, { multiple: x.value, why: x.value == null ? (revOf(ctx.inputs.find((i) => i.ticker === x.ticker)) == null ? "no revenue on file" : "no market value") : null }])),
      outliers: { rule: "no rule sets a peer aside here; the flags suggest, the operator decides", fence: null, out: [] },
      upside: price(band.median) != null && me.price > 0 ? (price(band.median) / me.price - 1) * 100 : null,
      ok: band.n >= 2 && price(band.min) != null, reason: band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} carr${band.n === 1 ? "ies" : "y"} this multiple — a range needs two` : price(band.min) == null ? `${TICKER} cannot be priced on this row: no revenue or share count` : null };
  }
  function liveRow(key) {
    const rd = read.rows.find((r) => r.key === key), bar = read.bars.find((b) => b.key === key), r = row(key);
    const values = {};
    for (const p of peersIn) {
      const inRow = (rd.peers || []).find((x) => x.ticker === p.ticker);
      values[p.ticker] = inRow ? { multiple: inRow.value, why: null } : { multiple: null, why: peerWhy(key, p) };
    }
    return { key, label: r.label, basis: r.basis, fmt: r.fmt, own: { multiple: rd.value, price: num(me.price) }, figure: bar.figure,
      n: rd.n, band: rd.band, ends: Object.fromEntries(Object.entries(bar.ends).map(([k, e]) => [k, { multiple: e.m, who: e.who, price: e.price }])),
      peers: (rd.sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })), nm: [], missing: rd.missing, values,
      outliers: { rule: "no rule sets a peer aside here; the flags suggest, the operator decides", fence: null, out: [] },
      upside: bar.upside, ok: bar.ok, reason: bar.reason };
  }
  const rows = ROWS.map((k) => (k === "ps" ? psRow() : liveRow(k)));
  const m = ctx.meta[TICKER] || {};
  const peerDates = {};
  for (const i of ctx.inputs) peerDates[i.ticker] = { fundamentals: (ctx.meta[i.ticker] || {}).fund_date || null, estimate_fy: i.fy1_date || null, ttm_to: i.rev?.to || null, ttm_basis: i.rev?.basis || null, balance: i.net_debt_date || null, price: i.price_date || null, price_from: (ctx.meta[i.ticker] || {}).price_from || null };
  return {
    taken: ctx.taken, today: ctx.today, ticker: TICKER, name: ctx.names[TICKER], cohort: ctx.cohort, cohort_options: ctx.cohort_options,
    members: ctx.members, excluded: ctx.excluded.filter((e) => e.ticker !== TICKER), names: ctx.names,
    price: num(me.price), price_date: me.price_date, price_from: m.price_from || null, geiger: m.geiger ?? null, geiger_at: m.geiger_at || null,
    shares: me.shares, mcap: me.mcap, net_debt: me.net_debt, net_debt_date: me.net_debt_date,
    eps_ttm: me.eps_ttm, eps_date: m.fund_date || null, eps_fy1: me.eps_fy1, fy1_date: me.fy1_date, eps_fy2: me.eps_fy2 ?? null, fy2_date: me.fy2_date || null,
    revenue_ttm: revOf(me), ebitda_ttm: me.ebitda?.now ?? null,
    dates: { eps: m.fund_date || null, revenue_to: me.rev?.to || null, revenue_basis: me.rev?.basis || null, ebitda_to: me.ebitda?.to || null, ebitda_basis: me.ebitda?.basis || null, balance: me.net_debt_date || null },
    rows, peer_dates: peerDates, quotes_error: ctx.quotes_error,
    arithmetic: "deliverables/20260927/comps-r3/r3.mjs (compsRead, nm:false → rows, bars) · P/S computed here on the same inputs",
  };
}
/** Why a peer has no number on a measure: negative or undefined figure. */
function peerWhy(key, p) {
  const revNow = p.rev?.now ?? p.revenue_ttm_on_file;
  if (key === "pe_ttm") return p.eps_ttm == null ? "no trailing EPS on file" : p.eps_ttm <= 0 ? "trailing EPS is negative or zero" : "no price";
  if (key === "pe_fwd") return p.eps_fy1 == null ? "no EPS estimate on file" : p.eps_fy1 <= 0 ? "estimated EPS is negative or zero" : "no price";
  if (key === "ev_sales") return p.net_debt == null ? "no net debt on file (no enterprise value)" : revNow == null ? "no revenue on file" : revNow <= 0 ? "revenue is not positive" : "enterprise value is not positive";
  if (key === "ev_ebitda") return p.ebitda?.now == null ? "no EBITDA history on file" : p.ebitda.now <= 0 ? "EBITDA is negative or zero" : p.net_debt == null ? "no net debt on file" : "enterprise value is not positive";
  if (key === "peg") return p.eps_fy1 == null || p.eps_fy2 == null ? "two EPS estimates are needed" : p.eps_fy1 <= 0 ? "estimated EPS is not positive" : "EPS is not expected to grow";
  return "no figure";
}
