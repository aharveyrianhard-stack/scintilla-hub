// F1 (3 Oct 2026) · dossier-facts — the READ tab's BUSINESS / CATALYSTS / WATCH for every full-treatment name that has no dossier.
// Alan, 3 Oct: "go to READ, it says there's no template." No dossier writer runs (DOSSIER_AGENT_PROTOCOL is a draft that would call a
// paid model), so a newly admitted name showed the developer line until someone wrote one by hand. This function composes the three
// sections from facts the Hub already stores (supabase/functions/_shared/facts-dossier.mjs — the same composer as the 3 Oct one-off
// load, so both write identical words) and writes ONLY:
//   · a new ticker_context row for a name in fmp_full_universe that has none;
//   · an existing row whose word columns are ALL empty (a shell), guarded so a dossier written in between is never touched;
//   · its own earlier rows (enrich_sources = 'FACTS:f1-v1'), refreshed so dates, targets and next earnings stay current.
// A real dossier (any other enrich_sources, or any words) is never read for writing, never updated, never deleted. deep_done stays
// false so a later deep dossier still sees the name as not done. ?sym=A,B limits the run; ?dry=1 returns the rows without writing.
// Neighbours: read-engine (reads business_now / catalysts / watch_notes every 10 min into read_blocks), the READ tab's age label
// (enriched_ts = the time these facts were read), the chat function (reads ticker_context as context).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { composeFactsDossier, FACTS_TAG } from '../_shared/facts-dossier.mjs'
const SB_URL = Deno.env.get('SUPABASE_URL') || '', SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const J = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })
const BATCH = 60
const SRC = 'F1 facts dossier v1: composed only from stored facts — FMP profile, fundamentals, estimates, targets, grades; earnings_events; SEC offering_filings; etf_info/holdings. No model wrote these words.'
const empty = (v: unknown) => v == null || String(v).trim() === ''
Deno.serve(async (req) => {
  const u = new URL(req.url), dry = u.searchParams.get('dry') === '1'
  const sb = createClient(SB_URL, SB_KEY)
  const out: any = { inserted: 0, filled_shells: 0, refreshed: 0, skipped_real: 0, nothing_to_say: 0, errors: [] as string[], dry }
  try {
    const symP = (u.searchParams.get('sym') || '').toUpperCase().split(',').map((s) => s.trim()).filter(Boolean)
    let uni: string[]
    if (symP.length) uni = symP
    else { const { data, error } = await sb.from('fmp_full_universe').select('ticker'); if (error) throw new Error('universe: ' + error.message); uni = (data || []).map((r: any) => String(r.ticker)) }
    if (!uni.length) throw new Error('universe EMPTY - refusing to run silently')
    const cx: any = {}
    for (let i = 0; i < uni.length; i += 200) { const { data, error } = await sb.from('ticker_context').select('ticker,narrative,business_now,catalysts,watch_notes,enrich_sources').in('ticker', uni.slice(i, i + 200)); if (error) throw new Error('ticker_context: ' + error.message); for (const r of data || []) cx[r.ticker] = r }
    const mode: Record<string, 'insert' | 'shell' | 'refresh'> = {}
    for (const t of uni) {
      const c = cx[t]
      if (!c) mode[t] = 'insert'
      else if (c.enrich_sources === FACTS_TAG) mode[t] = 'refresh'
      else if ([c.narrative, c.business_now, c.catalysts, c.watch_notes, c.enrich_sources].every(empty)) mode[t] = 'shell'
      else out.skipped_real++
    }
    // new names and shells first, then the refreshes in name order (hourly at 60 a run: every facts dossier is re-read about every 6 h)
    const order = Object.keys(mode).sort((a, b) => (mode[a] === 'refresh' ? 1 : 0) - (mode[b] === 'refresh' ? 1 : 0) || a.localeCompare(b))
    const T = order.slice(0, BATCH)
    if (!T.length) return J(out)
    const today = new Date().toISOString().slice(0, 10), since2y = (+today.slice(0, 4) - 2) + '-01-01', since1y = (+today.slice(0, 4) - 1) + '-01-01'
    // every read is paged under a stable order (the API answers at most 1000 rows a page)
    const q = async (table: string, sel: string, order: string, f?: (x: any) => any) => {
      const m: any = {}
      for (let off = 0; ; off += 1000) {
        let x: any = sb.from(table).select(sel).in('ticker', T); if (f) x = f(x)
        for (const k of order.split(',')) x = x.order(k)
        const { data, error } = await x.range(off, off + 999); if (error) throw new Error(table + ': ' + error.message)
        for (const r of data || []) (m[r.ticker] ||= []).push(r)
        if (!data || data.length < 1000) return m
      }
    }
    const [prof, fund, fh, ev, pt, rt, gr, of, ei, eh, filer, est] = await Promise.all([
      q('company_profile', 'ticker,name,sector,industry,market_cap,country,ipo_date,is_etf,description,beta,range_52wk', 'ticker'),
      q('fundamentals', 'ticker,revenue_ttm,eps_ttm', 'ticker'),
      q('fundamentals_history', 'ticker,fiscal_date,revenue', 'ticker,fiscal_date,period', (x) => x.in('period', ['Q1', 'Q2', 'Q3', 'Q4']).gte('fiscal_date', since2y)),
      q('earnings_events', 'ticker,date,eps_actual,eps_estimate,revenue_estimate,superseded_at', 'ticker,date', (x) => x.gte('date', since1y)),
      q('price_target_consensus', 'ticker,target_avg,target_high,target_low', 'ticker'),
      q('analyst_ratings', 'ticker,consensus', 'ticker'),
      q('analyst_grades', 'ticker,date,firm,action,to_grade', 'ticker,date,firm', (x) => x.gte('date', new Date(Date.now() - 95 * 86400e3).toISOString().slice(0, 10))),
      q('offering_filings', 'ticker,filed_date,form,class', 'ticker,filed_date,url', (x) => x.gte('filed_date', new Date(Date.now() - 125 * 86400e3).toISOString().slice(0, 10))),
      q('etf_info', 'ticker,etf_company,aum,expense_ratio,holdings_count,inception_date,description', 'ticker'),
      Promise.resolve({}),   // holdings: per fund below (the ten largest), never a capped bulk read
      q('filer_currency', 'ticker,reported_currency', 'ticker'),
      q('analyst_estimates', 'ticker,period,fiscal_date,est_eps_avg', 'ticker,period,fiscal_date', (x) => x.gte('fiscal_date', today)),
    ])
    const quotes: any = {}
    try { const r = await fetch('https://scintilla-massive-chart-api.fly.dev/quotes?symbols=' + encodeURIComponent(T.join(',')), { signal: AbortSignal.timeout(20000) }); if (r.ok) Object.assign(quotes, (await r.json()).quotes || {}) } catch (_) { /* no price: the price facts are left out, never guessed */ }
    const nowS = Math.floor(Date.now() / 1000), rows: any[] = []
    for (const t of T) {
      try {
        const e = (est[t] || []).sort((a: any, b: any) => String(a.fiscal_date).localeCompare(String(b.fiscal_date)))
        const fq = e.filter((r: any) => r.period === 'quarter' && r.est_eps_avg != null && r.fiscal_date <= new Date(Date.now() + 457 * 86400e3).toISOString().slice(0, 10)).slice(0, 4)
        const fa = e.find((r: any) => r.period === 'annual' && r.est_eps_avg != null)
        const isFund = !!(ei[t] && ei[t].length) || ((prof[t] || [])[0] || {}).is_etf === true
        let holdings: any[] = []
        if (isFund) { const { data } = await sb.from('etf_holdings').select('ticker,asset,name,weight_pct').eq('ticker', t).not('weight_pct', 'is', null).order('weight_pct', { ascending: false }).limit(10); holdings = data || [] }
        const top10 = holdings.filter((h: any) => h.weight_pct != null).sort((a: any, b: any) => b.weight_pct - a.weight_pct).slice(0, 10).map((h: any) => h.asset).filter(Boolean)
        let hEarn: any[] | null = null
        if (top10.length) { const { data } = await sb.from('earnings_events').select('ticker,date').in('ticker', top10).gte('date', today).is('superseded_at', null).order('date'); hEarn = (data || []).filter((r: any, i: number, a: any[]) => a.findIndex((z) => z.ticker === r.ticker) === i) }
        const d = composeFactsDossier({ ticker: t, today, holdingEarnings: hEarn, profile: (prof[t] || [])[0], fund: (fund[t] || [])[0], quarters: fh[t] || [], filerCcy: ((filer[t] || [])[0] || {}).reported_currency,
          earnings: ev[t] || [], target: (pt[t] || [])[0], rating: (rt[t] || [])[0], grades: gr[t] || [], offerings: of[t] || [], etfInfo: (ei[t] || [])[0], holdings,
          price: quotes[t] && quotes[t].state === 'OK' ? quotes[t].price : null, fwdEps: fq.length === 4 ? fq.reduce((s: number, r: any) => s + +r.est_eps_avg, 0) : fa ? +fa.est_eps_avg : null })
        if (!d) { out.nothing_to_say++; continue }
        rows.push({ t, m: mode[t], d })
        if (dry) continue
        const set = { ...d, sources: SRC, enrich_sources: FACTS_TAG, enriched_ts: nowS, updated_ts: nowS }
        if (mode[t] === 'insert') { const { error } = await sb.from('ticker_context').upsert({ ticker: t, ...set, deep_done: false }, { onConflict: 'ticker', ignoreDuplicates: true }); if (error) throw error; out.inserted++ }
        else if (mode[t] === 'refresh') { const { error } = await sb.from('ticker_context').update(set).eq('ticker', t).eq('enrich_sources', FACTS_TAG); if (error) throw error; out.refreshed++ }
        else { const { error } = await sb.from('ticker_context').update(set).eq('ticker', t).is('narrative', null).is('business_now', null).is('catalysts', null).is('watch_notes', null).is('enrich_sources', null); if (error) throw error; out.filled_shells++ }
      } catch (e) { out.errors.push(t + ': ' + String((e as any)?.message || e).slice(0, 120)) }
    }
    if (dry) out.rows = rows
    out.pending_after = Math.max(0, order.length - T.length)
  } catch (e) { out.errors.push('fatal: ' + String((e as any)?.message || e)) }
  return J(out)
})
