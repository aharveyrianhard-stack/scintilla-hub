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
   Shared by deliverables/20261003/f1-full-treatment/build-loads.mjs (Node) and supabase/functions/dossier-facts (Deno). */

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
  const cut = t.slice(0, max), i = cut.lastIndexOf('. ')
  return (i > 200 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…')
}

/* in: { ticker, today:'YYYY-MM-DD', profile, fund, quarters:[{fiscal_date, revenue}], filerCcy, earnings:[{date, eps_actual,
   eps_estimate, revenue_estimate, superseded_at}], target, rating, grades:[{date, firm, action, to_grade}], offerings:[{filed_date,
   form, class}], etfInfo, holdings:[{asset, name, weight_pct}], price, fwdEps }
   out: null (nothing to say — never an empty row) or { business_now, catalysts, watch_notes } */
export function composeFactsDossier (x) {
  const p = x.profile || {}, t = x.ticker, today = x.today
  const isFund = p.is_etf === true || p.is_etf === 'true' || !!x.etfInfo
  const name = clean(p.name) || t
  const ccy = x.filerCcy && x.filerCcy !== 'USD' ? x.filerCcy : null
  const biz = [], cat = [], watch = []

  /* BUSINESS */
  if (isFund) {
    const e = x.etfInfo || {}
    const head = [name + ' is an exchange-traded fund' + (e.etf_company ? ' run by ' + clean(e.etf_company) : '') + '.',
      e.aum != null ? 'Assets ' + money(e.aum) + '.' : null,
      e.expense_ratio != null ? 'Expense ratio ' + (+e.expense_ratio).toFixed(2) + '%.' : null,
      e.holdings_count ? clean(e.holdings_count) + ' holdings.' : null,
      e.inception_date ? 'Listed ' + longDay(e.inception_date) + '.' : null].filter(Boolean).join(' ')
    biz.push(head)
    const d = clean(e.description || p.description); if (d) biz.push(firstSentences(d))
    const top = (x.holdings || []).filter((h) => num(h.weight_pct) != null).sort((a, b) => num(b.weight_pct) - num(a.weight_pct)).slice(0, 5)
    if (top.length) biz.push('Largest holdings: ' + top.map((h) => (h.asset || clean(h.name)) + ' ' + num(h.weight_pct).toFixed(1) + '%').join(', ') + '.')
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
  if (num(p.beta) != null) watch.push('Beta ' + num(p.beta).toFixed(2) + (num(p.beta) >= 1.5 ? ': it has moved well beyond the market.' : num(p.beta) <= 0.6 ? ': it has moved much less than the market.' : '.'))

  const out = { business_now: biz.join('\n\n').trim(), catalysts: cat.join('\n\n').trim(), watch_notes: watch.join('\n\n').trim() }
  if (!out.business_now && !out.catalysts && !out.watch_notes) return null
  for (const k of Object.keys(out)) if (!out[k]) out[k] = null
  return out
}
