/* Scintilla · comps on the live company view (C1, 29 Sep) · ONE dated snapshot of every valuation row for one
   company, taken from the Hub's own tables. This is the round-3 snapshot (deliverables/20260928/comps-r3-labels/
   snapshot.mjs) made into a function so the LIVE company view and the node script take the SAME snapshot with the
   SAME arithmetic (../../20260927/comps-r3/r3.mjs → compsRead). No fetch of its own: the caller passes `pg` (a
   PostgREST read: path → rows) and `quotes` (tickers → { quotes: {T: {price, price_observation_utc}} }).

   What is added to the round-3 shape (nothing is taken away):
   · members, excluded (funds, by name and why), names, cohort_options — for step 1 of the ladder;
   · peer_dates — each peer's fundamentals date, estimate year, TTM window, balance date and price date — for step 2;
   · dates — the subject's TTM windows — for step 4;
   · sources, with the quotes error named when today's price could not be read. */

import { buildInputs, compsRead, cohortFor, row, whoSets, outliers, peerBand, num } from "../../20260927/comps-r3/r3.mjs";
import { tsToISO } from "../../20260925/knockout/field.mjs";

export const ROWS = ["pe_ttm", "pe_fwd", "ev_sales", "ev_ebitda", "ps", "peg"];
const SIZE_TAGS = ["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP"];
const daysBefore = (todayISO, n) => new Date(Date.parse(todayISO + "T00:00:00Z") - n * 86400e3).toISOString().slice(0, 10);

/** The cohort a company's comps run on, and the other cohorts it could run on. */
export function cohortChoice(ticker, tags, asked) {
  const cohort = cohortFor(ticker, tags, asked);
  const options = [...new Set([cohort, ...(tags || []).filter((t) => !SIZE_TAGS.includes(t))])].filter(Boolean);
  return { cohort, options };
}

/** Take the snapshot. Throws with a plain sentence when the company has no cohort or no peers. */
export async function takeSnapshot({ ticker, cohortAsked = null, today, pg, quotes, livePrice = null }) {
  const TICKER = String(ticker).toUpperCase();
  const TODAY = today;
  const own = await pg(`ticker_cohorts?select=ticker,cohort&ticker=eq.${encodeURIComponent(TICKER)}`);
  const tags = [...new Set(own.map((x) => x.cohort))];
  const { cohort, options } = cohortChoice(TICKER, tags, cohortAsked);
  if (!cohort) throw new Error(`${TICKER} carries no cohort tag in ticker_cohorts, so it has no peers on file`);
  const mem = await pg(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(cohort)}&order=ticker.asc`);
  const T = [...new Set([TICKER, ...mem.map((m) => m.ticker)])];
  if (T.length < 2) throw new Error(`${TICKER} is the only name tagged ${cohort}: no peers`);
  const inq = "in.(" + T.map(encodeURIComponent).join(",") + ")";
  const [fund, est, incH, bal, prof, quotesRes] = await Promise.all([
    pg(`fundamentals?select=ticker,price,market_cap,eps_ttm,revenue_ttm,trailing_pe,adjusted_pe,updated_ts&ticker=${inq}`),
    pg(`analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_revenue_avg,price_target_avg,updated_ts&period=eq.annual&ticker=${inq}&fiscal_date=gte.${TODAY}&order=ticker.asc,fiscal_date.asc`),
    pg(`fundamentals_history?select=ticker,period,fiscal_year,fiscal_date,revenue,gross_profit,operating_income,ebitda&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 1100)}&order=fiscal_date.desc`),
    pg(`balance_history?select=ticker,period,fiscal_date,net_debt,total_debt,cash_and_equiv&ticker=${inq}&fiscal_date=gte.${daysBefore(TODAY, 800)}&order=fiscal_date.desc`),
    pg(`company_profile?select=ticker,name,industry,is_etf&ticker=${inq}`),
    Promise.resolve().then(() => quotes(T)).catch((e) => ({ quotes: {}, error: String((e && e.message) || e) })),
  ]);
  const qmap = quotesRes && quotesRes.quotes && typeof quotesRes.quotes === "object" ? quotesRes.quotes : {};
  const first = (rows, t) => rows.find((r) => r.ticker === t) || null;
  const srcOf = (t) => {
    const f = first(fund, t) || {};
    let q = qmap[t] && qmap[t].price != null ? qmap[t] : null;
    if (t === TICKER && livePrice != null && livePrice > 0) q = { price: livePrice, price_observation_utc: q && q.price_observation_utc ? q.price_observation_utc : null, live: true };
    const inc = incH.filter((r) => r.ticker === t);
    return {
      ticker: t, profile: first(prof, t) || {}, tags: [], fundamentals: { ...f, date: tsToISO(f.updated_ts) }, quote: q,
      price_date: q && q.price_observation_utc ? String(q.price_observation_utc).slice(0, 10) : q && q.live ? TODAY : tsToISO(f.updated_ts),
      price_from: q ? (q.live ? "the Hub's live quote" : "chart API /quotes") : (num(f.price) != null ? "fundamentals row (dated)" : null),
      estimates: est.filter((e) => e.ticker === t),
      incQ: inc.filter((r) => r.period !== "FY"), incFY: inc.filter((r) => r.period === "FY"),
      cfQ: [], cfFY: [], balance: bal.filter((r) => r.ticker === t), next_report: null, target: null, geiger: null, heartbeat: null,
    };
  };
  const srcs = new Map(T.map((t) => [t, srcOf(t)]));
  const inputs = T.map((t) => buildInputs(srcs.get(t), TODAY)).filter((i) => i && i.ticker);
  const me = inputs.find((i) => i.ticker === TICKER);
  if (!me) throw new Error(`${TICKER} has no fundamentals row`);
  const names = Object.fromEntries(T.map((t) => [t, ((first(prof, t) || {}).name) || t]));
  const excluded = inputs.filter((i) => i.ticker !== TICKER && i.is_etf).map((i) => ({ ticker: i.ticker, why: "a fund, not a company" }));
  const read = compsRead(me, inputs, { outOut: false });

  /* P/S on the same inputs: market value ÷ revenue TTM; the price it implies = multiple × revenue ÷ shares. */
  const revOf = (i) => i.rev?.now ?? i.revenue_ttm_on_file;
  const psOf = (i) => (i.mcap > 0 && revOf(i) > 0) ? i.mcap / revOf(i) : null;
  function psRow() {
    const peers = inputs.filter((p) => p.ticker !== TICKER && !p.is_etf).map((p) => ({ ticker: p.ticker, value: psOf(p) }));
    const usable = peers.filter((x) => x.value != null && x.value <= 50);
    const o = outliers(usable), sets = whoSets(usable), band = peerBand(usable.map((x) => x.value));
    const sh = me.shares, rev = revOf(me);
    const price = (m) => (m != null && rev > 0 && sh > 0) ? m * rev / sh : null;
    const at = (m, who) => ({ multiple: m, who, price: price(m) });
    return {
      key: "ps", label: "P/S", basis: "market value ÷ revenue, TTM", fmt: "x",
      own: { multiple: psOf(me), price: num(me.price) },
      figure: { word: "revenue TTM", value: rev, fmt: "money", formula: "multiple × revenue ÷ shares" },
      n: band.n, band, ends: { min: at(band.min, sets.low ? [sets.low] : []), q1: at(band.q1, []), median: at(band.median, sets.median || []), q3: at(band.q3, []), max: at(band.max, sets.high ? [sets.high] : []) },
      peers: (sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })),
      nm: peers.filter((x) => x.value != null && x.value > 50), missing: peers.filter((x) => x.value == null).map((x) => x.ticker),
      outliers: { rule: o.rule, fence: o.fence, out: o.out.map((x) => ({ ticker: x.ticker, multiple: x.value, side: x.side })) },
      upside: price(band.median) != null && me.price > 0 ? (price(band.median) / me.price - 1) * 100 : null, ok: band.n >= 2 && price(band.min) != null, reason: band.n < 2 ? `only ${band.n} peer${band.n === 1 ? "" : "s"} carr${band.n === 1 ? "ies" : "y"} this multiple — a range needs two` : price(band.min) == null ? `${TICKER} cannot be priced on this row: no revenue or share count` : null,
    };
  }
  function liveRow(key) {
    const rd = read.rows.find((r) => r.key === key), bar = read.bars.find((b) => b.key === key), r = row(key);
    return {
      key, label: r.label, basis: r.basis, fmt: r.fmt,
      own: { multiple: rd.value, price: num(me.price) }, figure: bar.figure,
      n: rd.n, band: rd.band, ends: Object.fromEntries(Object.entries(bar.ends).map(([k, e]) => [k, { multiple: e.m, who: e.who, price: e.price }])),
      peers: (rd.sets.sorted || []).map((x) => ({ ticker: x.ticker, multiple: x.value })),
      nm: rd.nm, missing: rd.missing, outliers: { rule: rd.outliers.rule, fence: rd.outliers.fence, out: rd.outliers.out.map((x) => ({ ticker: x.ticker, multiple: x.value, side: x.side })) },
      upside: bar.upside, ok: bar.ok, reason: bar.reason,
    };
  }
  const rows = ROWS.map((k) => (k === "ps" ? psRow() : liveRow(k)));
  const peerDates = {};
  for (const i of inputs) {
    const s = srcs.get(i.ticker);
    peerDates[i.ticker] = { fundamentals: s.fundamentals.date || null, estimate_fy: i.fy1_date || null, ttm_to: i.rev?.to || null, ttm_basis: i.rev?.basis || null, balance: i.net_debt_date || null, price: i.price_date || null, price_from: s.price_from };
  }
  const meSrc = srcs.get(TICKER);
  return {
    taken: new Date().toISOString(), today: TODAY, ticker: TICKER, name: names[TICKER], cohort, cohort_options: options,
    members: T, excluded, names,
    price: num(me.price), price_date: me.price_date, price_from: meSrc.price_from, shares: me.shares, mcap: me.mcap, net_debt: me.net_debt, net_debt_date: me.net_debt_date,
    eps_ttm: me.eps_ttm, eps_date: meSrc.fundamentals.date, eps_fy1: me.eps_fy1, fy1_date: me.fy1_date, eps_fy2: me.eps_fy2 ?? null, fy2_date: me.fy2_date || null,
    revenue_ttm: revOf(me), ebitda_ttm: me.ebitda?.now ?? null,
    dates: { eps: meSrc.fundamentals.date, revenue_to: me.rev?.to || null, revenue_basis: me.rev?.basis || null, ebitda_to: me.ebitda?.to || null, ebitda_basis: me.ebitda?.basis || null, balance: me.net_debt_date || null },
    rows, peer_dates: peerDates,
    sources: {
      ticker_cohorts: "who is in the cohort " + cohort,
      fundamentals: "each company's EPS TTM, revenue TTM, market value and the price on the same row (→ shares)",
      analyst_estimates: "analysts' EPS for the current fiscal year → forward P/E; the next year's → growth, PEG",
      fundamentals_history: "revenue and EBITDA by quarter → TTM",
      balance_history: "net debt at the newest balance date → enterprise value",
      company_profile: "company names, fund or not",
      "chart API /quotes": quotesRes && quotesRes.error ? "NOT REACHED: " + quotesRes.error : "today's price for every name",
    },
    quotes_error: quotesRes && quotesRes.error ? quotesRes.error : null,
    arithmetic: "deliverables/20260927/comps-r3/r3.mjs (compsRead → rows, bars) · P/S computed here on the same inputs",
  };
}
