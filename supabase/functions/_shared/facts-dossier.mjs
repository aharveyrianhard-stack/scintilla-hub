/* F1 (3 Oct 2026) · THE FACTS DOSSIER — the READ tab's BUSINESS / CATALYSTS / WATCH for a name that has no dossier.
   Alan, 3 Oct: "when I select them and go to … READ, it says there's no template." 399 of 590 served names had no ticker_context
   row, so READ showed the developer line. No dossier writer runs (DOSSIER_AGENT_PROTOCOL is a draft that would call a paid model).
   This composes the three sections from facts the Hub already stores — nothing is invented, every sentence names its number:
     BUSINESS   company_profile (FMP profile: description, sector, industry, market value, country, IPO) + fundamentals (revenue TTM)
                + fundamentals_history (the newest quarter vs the same quarter a year earlier) · a fund: etf_info + top holdings
     CATALYSTS  earnings_events (next date + the consensus beside it; last result vs estimate) · price_target_consensus +
                analyst_ratings · analyst_grades (last 90 days) · offering_filings (last 120 days)
     WATCH      only stated facts: a loss on the forward estimate, price beyond the high target, a recent offering filing,
                a non-USD reporter, a short trading history
   PURE: no fetch, no clock (today is passed in), no randomness — the one-off load and the scheduled function write the same words.
   Shared by deliverables/20261003/f1-full-treatment/build-loads.mjs (Node) and supabase/functions/dossier-facts (Deno).

   D2 (6 Oct 2026) · EVERY ACTIVE NAME. Alan, 6 Oct: "a bunch of companies they weren't even available for — it said something about
   a dossier." 72 of 612 active names had none: 64 funds admitted 27 Sep as geiger_only (outside fmp_full_universe, so no loader and
   no dossier writer ever walked them), 2 metals futures and 6 Treasury series (no company profile exists for them anywhere).
     a FUND       says what it holds: the provider's description (the index it follows), the ten largest lines with their weights,
                  expense ratio, assets, the sector mix (etf_info.sectors) — and, with no profile row, its range from daily bars
     a RATE / FUTURE / CRYPTO / INDEX has no profile: composeInstrumentDossier() says what the series is, the contract and the
                  session from INSTRUMENTS below (fixed, reviewed words — no number in them), and its recent range from daily bars */

export const FACTS_TAG = 'FACTS:f1-v1'

const num = (v) => (v == null || v === '' || !isFinite(+v)) ? null : +v
function money (v, ccy) {
  const x = num(v); if (x == null) return null
  const a = Math.abs(x), s = x < 0 ? '−' : ''
  const unit = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, '']
  const body = (a / unit[0]).toFixed(a / unit[0] >= 100 ? 0 : 1) + unit[1]
  return s + (!ccy || ccy === 'USD' ? '$' + body : body + ' ' + ccy)
}
const px = (v) => { const x = num(v); if (x == null) return null; const a = Math.abs(x); return (x < 0 ? '−' : '') + '$' + (a >= 100 ? a.toFixed(0) : a.toFixed(2)) }
const eps = (v, ccy) => { const x = num(v); if (x == null) return null; return ccy ? (x < 0 ? '−' : '') + Math.abs(x).toFixed(2) + ' ' + ccy : px(x) }
const pct = (v) => { const x = num(v); return x == null ? null : (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(0) + '%' }
const longDay = (d) => { if (!d) return null; const t = Date.parse(String(d).slice(0, 10) + 'T12:00:00Z'); return isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null }
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3)
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()
function firstSentences (text, max = 700) {
  const t = clean(text); if (t.length <= max) return t
  /* D2: the cut falls after a real sentence end — never inside an abbreviation such as "U.S. " */
  const cut = t.slice(0, max); let i = -1; for (const m of cut.matchAll(/[a-z0-9)]\. /g)) i = m.index + 1
  return (i > 200 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…')
}

/* the recent range, from daily bars oldest → newest ({ t | date, h, l, c }): the low, the high and the last close over the bars given.
   null under 20 bars (never a range from a handful of days). PURE. */
export function rangeOf (bars) {
  const b = (bars || []).filter((r) => r && num(r.c) != null).map((r) => ({ d: r.date || new Date(+r.t).toISOString().slice(0, 10), h: num(r.h) ?? num(r.c), l: num(r.l) ?? num(r.c), c: num(r.c) })).sort((x, y) => x.d.localeCompare(y.d))
  if (b.length < 20) return null
  let hi = b[0], lo = b[0]
  for (const r of b) { if (r.h > hi.h) hi = r; if (r.l < lo.l) lo = r }
  return { from: b[0].d, to: b[b.length - 1].d, n: b.length, lo: lo.l, loDate: lo.d, hi: hi.h, hiDate: hi.d, last: b[b.length - 1].c }
}
function rangeLine (r, f) {
  const off = r.hi > 0 ? Math.round(100 * (1 - r.last / r.hi)) : null
  return 'Over ' + span(r) + ' it traded between ' + f(r.lo) + ' (' + longDay(r.loDate) + ') and ' + f(r.hi) + ' (' + longDay(r.hiDate) + '); last close ' + f(r.last) + ' on ' + longDay(r.to) + (off == null ? '' : off <= 0 ? ', at the high' : ', ' + off + '% below the high') + '.'
}
const span = (r) => { const m = Math.round(daysBetween(r.from, r.to) / 30.4); return m >= 11 ? 'the last 12 months' : 'the last ' + Math.max(1, m) + ' months' }

/* in: { ticker, today:'YYYY-MM-DD', profile, fund, quarters:[{fiscal_date, revenue}], filerCcy, earnings:[{date, eps_actual,
   eps_estimate, revenue_estimate, superseded_at}], target, rating, grades:[{date, firm, action, to_grade}], offerings:[{filed_date,
   form, class}], etfInfo, holdings:[{asset, name, weight_pct}], price, fwdEps, isFund (tickers.type = 'etf'), range (rangeOf) }
   out: null (nothing to say — never an empty row) or { business_now, catalysts, watch_notes } */
export function composeFactsDossier (x) {
  const p = x.profile || {}, t = x.ticker, today = x.today
  const isFund = p.is_etf === true || p.is_etf === 'true' || !!x.etfInfo || x.isFund === true
  const name = clean(p.name) || clean(x.etfInfo && x.etfInfo.name) || t
  const ccy = x.filerCcy && x.filerCcy !== 'USD' ? x.filerCcy : null
  const biz = [], cat = [], watch = []

  /* BUSINESS */
  if (isFund) {
    const e = x.etfInfo || {}
    const head = [name + ' is an exchange-traded fund' + (e.etf_company ? ' run by ' + clean(e.etf_company) : '') + '.',
      e.aum != null ? 'Assets ' + money(e.aum) + '.' : null,
      e.expense_ratio != null ? 'Expense ratio ' + (+e.expense_ratio).toFixed(2) + '%.' : null,
      e.holdings_count ? (num(e.holdings_count) != null ? num(e.holdings_count).toLocaleString('en-US') : clean(e.holdings_count)) + ' holdings.' : null,
      e.inception_date ? 'Listed ' + longDay(e.inception_date) + '.' : null].filter(Boolean).join(' ')
    /* a fund with no stored facts yet still says what it is and that the rest is on its way — never a developer line */
    biz.push(x.etfInfo || p.name ? head : head + ' Its holdings, fees and size have not been loaded from the provider yet.')
    const d = clean(e.description || p.description); if (d) biz.push(firstSentences(d))
    const top = (x.holdings || []).filter((h) => num(h.weight_pct) != null).sort((a, b) => num(b.weight_pct) - num(a.weight_pct)).slice(0, 10)
    if (top.length) biz.push('Largest holdings: ' + top.map((h) => (h.asset || clean(h.name)) + ' ' + num(h.weight_pct).toFixed(1) + '%').join(', ') + '.' + (top.length >= 5 ? ' Together ' + top.reduce((a, h) => a + num(h.weight_pct), 0).toFixed(0) + '% of the fund.' : ''))
    /* the sector mix as the provider states it (etf_info.sectors: [{industry, exposure %}]); slices under 1% are left out */
    const mix = (Array.isArray(e.sectors) ? e.sectors : []).map((r) => ({ k: clean(r.industry), w: num(r.exposure) })).filter((r) => r.k && r.w != null && r.w >= 1).sort((a, b) => b.w - a.w).slice(0, 6)
    /* a bond or commodity fund comes back as one "Cash & Others" slice: that says nothing, so no line */
    if (mix.length && !/^cash/i.test(mix[0].k)) biz.push('Sector mix: ' + mix.map((r) => r.k + ' ' + r.w.toFixed(0) + '%').join(', ') + '.')
  } else {
    const facts = [[p.sector, p.industry].filter(Boolean).map(clean).join(' · ') || null,
      num(p.market_cap) > 0 ? 'market value ' + money(p.market_cap) : null,
      num(x.fund && x.fund.revenue_ttm) > 0 ? 'revenue over the last four quarters ' + money(x.fund.revenue_ttm, ccy) : null,
      p.country && p.country !== 'US' ? 'based in ' + clean(p.country) : null].filter(Boolean)
    if (facts.length) biz.push(name + ' — ' + facts.join(', ') + '.')
    const q = (x.quarters || []).filter((r) => num(r.revenue) != null).sort((a, b) => String(b.fiscal_date).localeCompare(String(a.fiscal_date)))
    if (q.length >= 5) {
      const now = q[0], yago = q.find((r) => Math.abs(daysBetween(r.fiscal_date, now.fiscal_date) - 365) <= 20)
      if (yago && num(yago.revenue) > 0) biz.push('Quarter to ' + longDay(now.fiscal_date) + ': revenue ' + money(now.revenue, ccy) + ', ' + pct(100 * (num(now.revenue) / num(yago.revenue) - 1)) + ' on the same quarter a year earlier.')
    }
    const d = clean(p.description); if (d) biz.push(firstSentences(d))
  }

  /* CATALYSTS */
  const ev = (x.earnings || []).filter((r) => !r.superseded_at)
  const next = ev.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
  const last = ev.filter((r) => r.date < today && num(r.eps_actual) != null).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!isFund) {
    /* a non-USD reporter: the estimates' currency is not provable from the row (the Hub withholds them on the board), so dates only */
    if (next) cat.push('Next earnings ' + longDay(next.date) + (!ccy && num(next.eps_estimate) != null ? ': consensus EPS ' + eps(next.eps_estimate) : '') + (!ccy && num(next.revenue_estimate) > 0 ? ', revenue ' + money(next.revenue_estimate) : '') + '.')
    if (last) cat.push('Last report ' + longDay(last.date) + (ccy ? '.' : ': EPS ' + eps(last.eps_actual) + (num(last.eps_estimate) != null ? ' against ' + eps(last.eps_estimate) + ' expected' : '') + '.'))
    const tg = x.target || {}, rt = x.rating || {}
    if (num(tg.target_avg) > 0) cat.push('Analysts’ consensus target ' + px(tg.target_avg) + (num(tg.target_low) > 0 && num(tg.target_high) > 0 ? ' (range ' + px(tg.target_low) + ' to ' + px(tg.target_high) + ')' : '') + (rt.consensus ? '; consensus rating ' + clean(rt.consensus) : '') + '.')
    const since = new Date(Date.parse(today) - 90 * 86400e3).toISOString().slice(0, 10)
    const g = (x.grades || []).filter((r) => r.date >= since).sort((a, b) => b.date.localeCompare(a.date))
    if (g.length) {
      const up = g.filter((r) => /up/i.test(r.action)).length, dn = g.filter((r) => /down/i.test(r.action)).length
      cat.push('Last 90 days: ' + g.length + ' rating action' + (g.length > 1 ? 's' : '') + (up || dn ? ' (' + up + ' upgrade' + (up === 1 ? '' : 's') + ', ' + dn + ' downgrade' + (dn === 1 ? '' : 's') + ')' : '') + '; newest ' + longDay(g[0].date) + ', ' + clean(g[0].firm) + (g[0].to_grade ? ' — ' + clean(g[0].to_grade) : '') + '.')
    }
  }
  if (isFund) {
    /* a fund's own catalysts are its largest holdings' reports: the earnings_events rows of its ten largest lines */
    const soon = (x.holdingEarnings || []).filter((r) => r.date >= today && daysBetween(today, r.date) <= 45).sort((a, b) => a.date.localeCompare(b.date))
    const top10 = (x.holdings || []).filter((h) => num(h.weight_pct) != null).sort((a, b) => num(b.weight_pct) - num(a.weight_pct)).slice(0, 10).map((h) => h.asset).filter(Boolean)
    if (soon.length) cat.push('Its largest holdings reporting in the next 45 days: ' + soon.map((r) => r.ticker + ' ' + longDay(r.date).replace(/, \d{4}$/, '')).join(', ') + '.')
    else if (top10.length && x.holdingEarnings) cat.push('None of its ten largest holdings (' + top10.join(', ') + ') reports in the next 45 days.')
  }
  const sinceOf = new Date(Date.parse(today) - 120 * 86400e3).toISOString().slice(0, 10)
  const of = (x.offerings || []).filter((r) => r.filed_date >= sinceOf).sort((a, b) => b.filed_date.localeCompare(a.filed_date))
  if (of.length) cat.push('Offering filings at the SEC since ' + longDay(sinceOf) + ': ' + of.length + ' (newest ' + clean(of[0].form) + ', ' + longDay(of[0].filed_date) + ').')

  /* WATCH — facts only */
  if (!isFund) {
    if (num(x.fwdEps) != null && num(x.fwdEps) <= 0) watch.push('Analysts expect a loss over the next year' + (ccy ? '' : ' (forward EPS ' + eps(x.fwdEps) + ')') + ', so there is no forward P/E.')
    const tg = x.target || {}
    if (num(x.price) > 0 && num(tg.target_high) > 0 && num(x.price) > num(tg.target_high)) watch.push('The price (' + px(x.price) + ') is above the highest analyst target (' + px(tg.target_high) + ').')
    if (ccy) watch.push('Reports in ' + ccy + ': the board shows no dollar revenue or P/E for it.')
  }
  if (of.some((r) => /424B|S-1|S-3/.test(r.form || '') && r.class && !/UNCLASSIFIED|SHELF|RESALE/i.test(r.class))) watch.push('A recent offering filing may add new shares (see FINANCIALS → CAPITAL).')
  if (p.ipo_date && daysBetween(p.ipo_date, today) < 365) watch.push('Listed ' + longDay(p.ipo_date) + ': less than a year of trading history.')
  if (next && daysBetween(today, next.date) <= 14) watch.push('Reports in ' + daysBetween(today, next.date) + ' days (' + longDay(next.date) + ').')
  const rg = String(p.range_52wk || '').match(/([\d.]+)\s*-\s*([\d.]+)/)
  if (rg && num(x.price) > 0) {
    const lo = +rg[1], hi = +rg[2], pr = num(x.price)
    if (hi > lo && lo > 0) watch.push('Price ' + px(pr) + ' against a 52-week range of ' + px(lo) + ' to ' + px(hi) + ' (' + (pr >= hi ? 'at the high' : Math.round(100 * (1 - pr / hi)) + '% below the high') + ').')
  }
  /* no profile range (a fund outside the company loaders): the range from its own daily bars */
  else if (x.range) watch.push(rangeLine(x.range, px))
  if (num(p.beta) != null) watch.push('Beta ' + num(p.beta).toFixed(2) + (num(p.beta) >= 1.5 ? ': it has moved well beyond the market.' : num(p.beta) <= 0.6 ? ': it has moved much less than the market.' : '.'))

  const out = { business_now: biz.join('\n\n').trim(), catalysts: cat.join('\n\n').trim(), watch_notes: watch.join('\n\n').trim() }
  if (!out.business_now && !out.catalysts && !out.watch_notes) return null
  for (const k of Object.keys(out)) if (!out[k]) out[k] = null
  return out
}

/* D2 · THE NAMES WITH NO COMPANY BEHIND THEM. What each series is, its contract and its session, in fixed words that carry no number
   that can go stale (the numbers come from the bars). kind: rate (a yield, in percent) · spread (percentage points) · future ·
   crypto · index. A name not listed here still gets a dossier from its tickers.type (GENERIC), so a new one is never left empty. */
const GLOBEX = 'It trades nearly around the clock on CME Globex: Sunday 6 p.m. to Friday 5 p.m. New York time, with a one-hour pause each day at 5 p.m.'
const CBOE_YIELD = 'The Hub reads it from the Cboe yield index, which moves through the US trading day.'
const RATE_MOVES = 'What moves it: Federal Reserve decisions and what its officials say, the monthly inflation (CPI) and jobs reports, and how Treasury auctions are received.'
const CRYPTO_SESSION = 'It trades every hour of every day, weekends included — there is no close, so the Hub’s day runs midnight to midnight UTC.'
export const INSTRUMENTS = {
  US3M: { kind: 'rate', name: 'the 3-month US Treasury bill yield', what: 'The yearly interest rate the US government pays to borrow for three months (the 13-week bill). It sits close to the Federal Reserve’s policy rate, so it shows where short-term money is priced today.', contract: 'A yield in percent, not a price: when the bill’s price rises, the yield falls. ' + CBOE_YIELD, moves: RATE_MOVES },
  US2Y: { kind: 'rate', name: 'the 2-year US Treasury yield', what: 'The yearly interest rate the US government pays to borrow for two years. Of all the Treasury yields it follows expected Federal Reserve policy most closely: it rises when the market expects higher rates over the next two years.', contract: 'A yield in percent, not a price. The Hub reads the US Treasury’s official daily yield curve, so there is one value per trading day, published after the close.', moves: RATE_MOVES },
  US5Y: { kind: 'rate', name: 'the 5-year US Treasury yield', what: 'The yearly interest rate the US government pays to borrow for five years — the middle of the curve, between what the Federal Reserve is expected to do and the long-run view of growth and inflation.', contract: 'A yield in percent, not a price: when the note’s price rises, the yield falls. ' + CBOE_YIELD, moves: RATE_MOVES },
  US10Y: { kind: 'rate', name: 'the 10-year US Treasury yield', what: 'The yearly interest rate the US government pays to borrow for ten years. It is the benchmark long-term rate: mortgages and company borrowing are priced from it, and a higher 10-year yield lowers what investors will pay for future earnings — growth stocks most of all.', contract: 'A yield in percent, not a price: when the note’s price rises, the yield falls. ' + CBOE_YIELD, moves: RATE_MOVES },
  US30Y: { kind: 'rate', name: 'the 30-year US Treasury yield', what: 'The yearly interest rate the US government pays to borrow for thirty years — the longest point of the curve, the most sensitive to long-run inflation and to how much debt the government has to sell.', contract: 'A yield in percent, not a price: when the bond’s price rises, the yield falls. ' + CBOE_YIELD, moves: RATE_MOVES },
  US2S10S: { kind: 'spread', name: 'the 2s10s spread', what: 'The 10-year US Treasury yield minus the 2-year yield, in percentage points — the slope of the yield curve. Above zero, long-term money costs more than short-term money (the normal shape). Below zero the curve is inverted, which has come before most US recessions.', contract: 'The Hub works it out from the US Treasury’s official daily yield curve (10-year minus 2-year), so there is one value per trading day. It is a difference between two yields, not something that trades by itself.', moves: 'What moves it: the 2-year end follows expected Federal Reserve policy; the 10-year end follows growth, inflation and the supply of government debt. It steepens when the market expects rate cuts or demands more to hold long bonds.' },
  VIX: { kind: 'index', name: 'the Cboe Volatility Index (VIX)', what: 'How much movement the options market expects in the S&P 500 over the next 30 days, as a yearly percentage. It rises when investors pay up for protection — usually when stocks fall.', contract: 'An index worked out from S&P 500 option prices; it cannot be bought directly (futures and options on it trade at Cboe). It is published through the US trading day.', moves: 'What moves it: sharp moves in the S&P 500, scheduled risks such as Federal Reserve decisions, inflation reports and elections, and sudden shocks.' },
  GCUSD: { kind: 'future', name: 'Gold futures', what: 'The price of gold in US dollars per troy ounce, from the front futures contract on COMEX (CME Group) — the world’s reference price for gold.', contract: 'One contract is 100 troy ounces (symbol GC). ' + GLOBEX, moves: 'What moves it: real interest rates and the dollar (gold pays no interest, so it tends to rise when both fall), central-bank buying, and demand for safety when markets or politics are tense.' },
  SIUSD: { kind: 'future', name: 'Silver futures', what: 'The price of silver in US dollars per troy ounce, from the front futures contract on COMEX (CME Group). Silver is both a precious metal and an industrial one (electronics, solar panels), so it usually moves more than gold.', contract: 'One contract is 5,000 troy ounces (symbol SI). ' + GLOBEX, moves: 'What moves it: the same forces as gold — real interest rates, the dollar, demand for safety — plus industrial demand and mine supply.' },
  CLUSD: { kind: 'future', name: 'WTI crude oil futures', what: 'The price of West Texas Intermediate crude oil in US dollars per barrel, from the front futures contract on NYMEX (CME Group) — the US benchmark for oil.', contract: 'One contract is 1,000 barrels (symbol CL), delivered at Cushing, Oklahoma. ' + GLOBEX, moves: 'What moves it: OPEC+ output decisions, the weekly US inventory report, conflict near producing regions and shipping lanes, and the outlook for world demand.' },
  DXUSD: { kind: 'index', name: 'the US Dollar Index', what: 'The value of the US dollar against a fixed basket of six currencies — mostly the euro, then the yen, pound, Canadian dollar, Swedish krona and Swiss franc.', contract: 'An index level (ICE). Currencies trade around the clock from Sunday evening to Friday evening New York time.', moves: 'What moves it: the gap between US interest rates and those abroad, Federal Reserve and European Central Bank decisions, and demand for safety.' },
  ESUSD: { kind: 'future', name: 'E-mini S&P 500 futures', what: 'The futures contract on the S&P 500 index at CME — how the US stock market is priced outside the regular session as well as inside it.', contract: 'One contract is $50 times the index (symbol ES), settled in cash each quarter. ' + GLOBEX, moves: 'What moves it: the earnings of the largest companies, interest rates, the inflation and jobs reports, and overnight news from Asia and Europe.' },
  NQUSD: { kind: 'future', name: 'E-mini Nasdaq-100 futures', what: 'The futures contract on the Nasdaq-100 index at CME — the 100 largest non-financial Nasdaq companies, dominated by large technology names.', contract: 'One contract is $20 times the index (symbol NQ), settled in cash each quarter. ' + GLOBEX, moves: 'What moves it: the earnings of the largest technology companies, long-term interest rates, and the inflation and jobs reports.' },
  BTCUSD: { kind: 'crypto', name: 'Bitcoin', what: 'The price of one bitcoin in US dollars. Bitcoin is the largest cryptocurrency; its supply is capped at 21 million coins.', contract: CRYPTO_SESSION },
  ETHUSD: { kind: 'crypto', name: 'Ethereum', what: 'The price of one ether in US dollars. Ether is the currency of the Ethereum network, the largest platform for smart contracts, stablecoins and tokenized assets.', contract: CRYPTO_SESSION },
  SOLUSD: { kind: 'crypto', name: 'Solana', what: 'The price of one SOL in US dollars. SOL is the currency of the Solana network, a fast, low-cost platform for payments and applications.', contract: CRYPTO_SESSION },
  XRPUSD: { kind: 'crypto', name: 'XRP', what: 'The price of one XRP in US dollars. XRP is the native asset of the XRP Ledger, built for moving money across borders.', contract: CRYPTO_SESSION },
  ADAUSD: { kind: 'crypto', name: 'Cardano', what: 'The price of one ADA in US dollars. ADA is the currency of the Cardano network, a proof-of-stake smart-contract platform.', contract: CRYPTO_SESSION },
  AVAXUSD: { kind: 'crypto', name: 'Avalanche', what: 'The price of one AVAX in US dollars. AVAX is the currency of the Avalanche network, a smart-contract platform that lets institutions run their own chains.', contract: CRYPTO_SESSION },
  DOGEUSD: { kind: 'crypto', name: 'Dogecoin', what: 'The price of one DOGE in US dollars. Dogecoin began as a joke coin; it has no supply cap.', contract: CRYPTO_SESSION },
  LINKUSD: { kind: 'crypto', name: 'Chainlink', what: 'The price of one LINK in US dollars. LINK pays for Chainlink’s network, which feeds outside prices and data to blockchains.', contract: CRYPTO_SESSION },
  LTCUSD: { kind: 'crypto', name: 'Litecoin', what: 'The price of one LTC in US dollars. Litecoin is an early offshoot of Bitcoin built for faster, cheaper payments.', contract: CRYPTO_SESSION },
}
const CRYPTO_MOVES = 'What moves it: Bitcoin’s own direction (most coins follow it), money flowing into or out of the spot funds, US regulation, and the general appetite for risk.'
const GENERIC = {
  rate: (t) => ({ kind: 'rate', name: t, what: t + ' is an interest-rate series on the Hub’s MACRO list: a yield in percent, not a price.', moves: RATE_MOVES }),
  spread: (t) => ({ kind: 'spread', name: t, what: t + ' is a spread on the Hub’s MACRO list: the difference between two yields, in percentage points.' }),
  index: (t) => ({ kind: 'index', name: t, what: t + ' is an index on the Hub: a calculated level, not something that trades by itself.' }),
  future: (t) => ({ kind: 'future', name: t, what: t + ' is a futures contract on the Hub: an agreement to buy or sell at a set date, priced through most of the day and night.' }),
  crypto: (t) => ({ kind: 'crypto', name: t, what: t + ' is a cryptocurrency priced in US dollars.', contract: CRYPTO_SESSION }),
}
/* the class of a name that is not a company: its INSTRUMENTS entry, else its tickers.type; null = a company or a fund */
export function instrumentOf (ticker, type) {
  if (INSTRUMENTS[ticker]) return INSTRUMENTS[ticker]
  const k = type === 'rate' ? 'rate' : type === 'index' ? 'index' : type === 'future' ? 'future' : type === 'crypto' ? 'crypto' : null
  return k ? GENERIC[k](ticker) : null
}

/* in: { ticker, type (tickers.type), bars: daily bars oldest → newest ({ t | date, h, l, c }) }
   out: { business_now, catalysts, watch_notes } or null when the name is a company or a fund. PURE. */
export function composeInstrumentDossier (x) {
  const s = instrumentOf(x.ticker, x.type); if (!s) return null
  const yieldLike = s.kind === 'rate' || s.kind === 'spread'
  const f = s.kind === 'rate' ? (v) => num(v).toFixed(2) + '%' : s.kind === 'spread' ? (v) => (num(v) < 0 ? '−' : '+') + Math.abs(num(v)).toFixed(2) + ' points' : s.kind === 'index' ? (v) => num(v).toFixed(2) : (v) => { const a = Math.abs(num(v)); return '$' + (a >= 1000 ? Math.round(a).toLocaleString('en-US') : a >= 1 ? a.toFixed(2) : a.toFixed(4)) }
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)
  const biz = [(s.name !== x.ticker ? x.ticker + ' is ' + s.name + '. ' : '') + s.what, s.contract].filter(Boolean)
  const cat = [s.moves || (s.kind === 'crypto' ? CRYPTO_MOVES : null)].filter(Boolean)
  const watch = [], r = rangeOf(x.bars)
  if (r) {
    if (yieldLike) watch.push('Over ' + span(r) + ' it ranged from ' + f(r.lo) + ' (' + longDay(r.loDate) + ') to ' + f(r.hi) + ' (' + longDay(r.hiDate) + '); last ' + f(r.last) + ' on ' + longDay(r.to) + '.')
    else watch.push(rangeLine(r, f))
    if (s.kind === 'spread') watch.push(r.last < 0 ? 'The curve is inverted: the 2-year yield is above the 10-year.' : 'The curve slopes upward: the 10-year yield is above the 2-year.')
    if (s.kind === 'rate') watch.push('It is a yield, not a price: a rising yield means falling bond prices.')
  }
  const out = { business_now: biz.join('\n\n').trim() || null, catalysts: cat.join('\n\n').trim() || null, watch_notes: watch.join('\n\n').trim() || null }
  return out.business_now ? out : null
}
