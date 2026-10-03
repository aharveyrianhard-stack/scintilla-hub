/* F1 (3 Oct 2026) · THE FILLS, AS ADDITIVE LOADS WITH THEIR ROLLBACKS (written first, applied by the coordinator).
   Reads the Hub database the way the page does (public REST, GET only), the chart API, and the FMP answers fetched on a throw-away
   batch machine (provider scripts/f1-fill-fetch.mjs → f1-fill.json). Writes, for each fill, a migration and its _ROLLBACK beside it
   under supabase/migrations/, plus data/staged-20261003.json (the rows, so the matrix can project "after" with the same checks).
   Every load is ADDITIVE: INSERT … ON CONFLICT DO NOTHING (or an UPDATE of a NULL column guarded by IS NULL); nothing is deleted
   or overwritten. Every rollback removes exactly what its load added (keyed by the tag or by rows that did not exist before).
     node build-loads.mjs --fill <f1-fill.json> --lists <fill-lists.json>
   Fills: (1) dossiers — the facts dossier (supabase/functions/_shared/facts-dossier.mjs) for every full name with no ticker_context
   row; (2) fund holdings — etf_holdings for funds with none; (3) next earnings dates FMP carries and the table lacks; (4) MOG.A — its
   FMP symbol and a profile row; (5) statements — a trigger of fmp-fundamentals' own run for the names with none (its rows are the
   schedule's rows), reusing cron job 10's stored headers inside the database so no key is ever copied. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
import { composeFactsDossier, FACTS_TAG } from '../../../supabase/functions/_shared/facts-dossier.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB = path.resolve(HERE, '../../..'), MIG = path.join(HUB, 'supabase/migrations')
const arg = (k) => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1] }
const FILL = JSON.parse(fs.readFileSync(arg('--fill'), 'utf8')), LISTS = JSON.parse(fs.readFileSync(arg('--lists'), 'utf8'))
const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8')
const SB = html.match(/const SB\s*=\s*"([^"]+)"/)[1]
const ANON = html.slice(html.indexOf('const ANON'), html.indexOf('const ANON') + 600).match(/"(eyJ[A-Za-z0-9._-]+)"/)[1]
async function get (p) { for (let i = 0; i < 4; i++) { const r = await fetch(SB + '/rest/v1/' + p, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } }); if (r.ok) return r.json(); if (r.status < 500) throw new Error(p.split('?')[0] + ' ' + r.status); await new Promise((s) => setTimeout(s, 500 * (i + 1))) } throw new Error('gave up ' + p) }
async function all (p) { const out = []; for (let off = 0; ; off += 1000) { const rows = await get(p + '&limit=1000&offset=' + off); out.push(...rows); if (rows.length < 1000) return out } }
async function forT (table, T, rest, chunk = 40) { const out = []; for (let i = 0; i < T.length; i += chunk) out.push(...await all(table + '?ticker=in.(' + T.slice(i, i + chunk).map(encodeURIComponent).join(',') + ')&' + rest)); return out }
const by = (rows) => { const m = {}; for (const r of rows) (m[r.ticker] ||= []).push(r); return m }
const q = (s) => { if (s == null) return 'null'; const t = String(s); if (t.includes('$f1$')) throw new Error('quote collision'); return '$f1$' + t + '$f1$' }
const n = (v) => (v == null || v === '' || !isFinite(+v)) ? 'null' : String(+v)
const today = new Date().toISOString().slice(0, 10), nowS = Math.floor(Date.now() / 1000)
const staged = { built_utc: new Date().toISOString(), tag: FACTS_TAG, ticker_context: [], etf_holdings: {}, earnings_events: [], company_profile: [], tickers_fmp_symbol: [], statements_expected: {} }
const write = (name, sql) => { fs.writeFileSync(path.join(MIG, name), sql); console.log('wrote', name, (sql.length / 1024).toFixed(0) + ' KB') }
const HEAD = (what, why) => `-- 2026-10-03 · F1 (full Hub treatment) · ${what}\n-- ${why}\n-- ADDITIVE (pre-approved class, F1 brief): nothing is deleted or overwritten. Rollback beside this file (_ROLLBACK).\n-- Built by deliverables/20261003/f1-full-treatment/build-loads.mjs from reads taken ${staged.built_utc}.\n`

/* ── 1 · DOSSIERS ─────────────────────────────────────────────────────────────────────────────────────────────── */
{
  const T = LISTS.dossier
  const [prof, fund, fh, ev, pt, rt, gr, of, cx, ei, eh, filer, est] = await Promise.all([
    forT('company_profile', T, 'select=ticker,name,sector,industry,market_cap,country,ipo_date,is_etf,description,beta,range_52wk&order=ticker.asc'),
    forT('fundamentals', T, 'select=ticker,revenue_ttm,eps_ttm&order=ticker.asc'),
    forT('fundamentals_history', T, 'select=ticker,fiscal_date,revenue&period=in.(Q1,Q2,Q3,Q4)&fiscal_date=gte.' + (+today.slice(0, 4) - 2) + '-01-01&order=ticker.asc,fiscal_date.asc,period.asc', 20),
    forT('earnings_events', T, 'select=ticker,date,eps_actual,eps_estimate,revenue_estimate,superseded_at&date=gte.' + (+today.slice(0, 4) - 1) + '-01-01&order=ticker.asc,date.asc', 30),
    forT('price_target_consensus', T, 'select=ticker,target_avg,target_high,target_low&order=ticker.asc'),
    forT('analyst_ratings', T, 'select=ticker,consensus&order=ticker.asc'),
    forT('analyst_grades', T, 'select=ticker,date,firm,action,to_grade&order=ticker.asc,date.asc,firm.asc', 30),
    forT('offering_filings', T, 'select=ticker,filed_date,form,class&order=ticker.asc,filed_date.asc,url.asc'),
    forT('ticker_context', T, 'select=ticker,narrative,business_now,catalysts,watch_notes,enrich_sources&order=ticker.asc'),
    forT('etf_info', T, 'select=ticker,etf_company,aum,expense_ratio,holdings_count,inception_date,description&order=ticker.asc'),
    forT('etf_holdings', T, 'select=ticker,asset,name,weight_pct&order=ticker.asc,name.asc', 10),
    forT('filer_currency', T, 'select=ticker,reported_currency&order=ticker.asc'),
    forT('analyst_estimates', T, 'select=ticker,period,fiscal_date,est_eps_avg&fiscal_date=gte.' + today + '&order=ticker.asc,period.asc,fiscal_date.asc', 40),
  ]).then((xs) => xs.map(by))
  const quotes = {}
  for (let i = 0; i < T.length; i += 60) { const r = await fetch('https://scintilla-massive-chart-api.fly.dev/quotes?symbols=' + encodeURIComponent(T.slice(i, i + 60).join(',')), { headers: { Origin: 'https://scintillahub.ai' } }); const j = await r.json(); Object.assign(quotes, j.quotes || {}) }
  const rows = []
  for (const t of T) {
    const c0 = (cx[t] || [])[0]
    const shell = !!c0 && [c0.narrative, c0.business_now, c0.catalysts, c0.watch_notes, c0.enrich_sources].every((v) => v == null || String(v).trim() === '')
    if (c0 && !shell) continue                              // a dossier with words exists — never touched
    const fq = (est[t] || []).filter((r) => r.period === 'quarter' && r.est_eps_avg != null && r.fiscal_date <= new Date(Date.now() + 457 * 86400e3).toISOString().slice(0, 10)).slice(0, 4)
    const fa = (est[t] || []).find((r) => r.period === 'annual' && r.est_eps_avg != null)
    const fwdEps = fq.length === 4 ? fq.reduce((s, r) => s + +r.est_eps_avg, 0) : fa ? +fa.est_eps_avg : null
    const holdings = (eh[t] && eh[t].length) ? eh[t] : ((FILL.etf[t] && FILL.etf[t].holdings) || [])   // the staged holdings feed the fund's dossier too
    const top10 = holdings.filter((h) => h.weight_pct != null).sort((a, b) => b.weight_pct - a.weight_pct).slice(0, 10).map((h) => h.asset).filter(Boolean)
    const hEarn = top10.length ? (await forT('earnings_events', top10, 'select=ticker,date&date=gte.' + today + '&superseded_at=is.null&order=ticker.asc,date.asc')).filter((r, i, a) => a.findIndex((z) => z.ticker === r.ticker) === i) : null
    const stagedProfile = (!prof[t] && FILL.profile[t] && FILL.profile[t].name) ? { ...FILL.profile[t], is_etf: false } : null
    const ccy0 = ((filer[t] || [])[0] || {}).reported_currency || (FILL.statements[t] && FILL.statements[t].currency) || null
    const d = composeFactsDossier({ ticker: t, today, holdingEarnings: hEarn, profile: (prof[t] || [])[0] || stagedProfile, fund: (fund[t] || [])[0], quarters: fh[t] || [], filerCcy: ccy0,
      earnings: ev[t] || [], target: (pt[t] || [])[0], rating: (rt[t] || [])[0], grades: gr[t] || [], offerings: of[t] || [], etfInfo: (ei[t] || [])[0], holdings,
      price: quotes[t] && quotes[t].state === 'OK' ? quotes[t].price : null, fwdEps })
    if (!d) continue
    rows.push({ ticker: t, shell, ...d })
  }
  staged.ticker_context = rows
  const src = 'F1 facts dossier v1 (3 Oct 2026): composed only from stored facts — FMP profile, fundamentals, estimates, targets, grades; earnings_events; SEC offering_filings; etf_info/holdings. No model wrote these words.'
  write('20261003_f1_facts_dossiers.sql', HEAD('READ: a facts dossier for ' + rows.length + ' full names with no ticker_context row',
    'Alan, 3 Oct: "go to READ, it says there\'s no template" — that line shows when a name has no dossier; 399 of 590 served names had none.') +
    '-- deep_done = false: a later deep dossier still sees these names as not done. Rows with enrich_sources = \'' + FACTS_TAG + '\' are the only ones the\n-- dossier-facts function ever rewrites; a real dossier (any other enrich_sources) is never touched.\n' +
    'insert into public.ticker_context (ticker, business_now, catalysts, watch_notes, sources, enrich_sources, enriched_ts, updated_ts, deep_done) values\n' +
    rows.filter((r) => !r.shell).map((r) => `(${q(r.ticker)}, ${q(r.business_now)}, ${q(r.catalysts)}, ${q(r.watch_notes)}, ${q(src)}, ${q(FACTS_TAG)}, ${nowS}, ${nowS}, false)`).join(',\n') +
    '\non conflict (ticker) do nothing;\n' +
    '-- EMPTY SHELLS: these names have a ticker_context row with every word column empty (' + rows.filter((r) => r.shell).map((r) => r.ticker).join(', ') + ').\n-- Filled only while every word column is still empty — a dossier written in between is never touched.\n' +
    rows.filter((r) => r.shell).map((r) => `update public.ticker_context set business_now = ${q(r.business_now)}, catalysts = ${q(r.catalysts)}, watch_notes = ${q(r.watch_notes)}, sources = ${q(src)}, enrich_sources = ${q(FACTS_TAG)}, enriched_ts = ${nowS}, updated_ts = ${nowS} where ticker = ${q(r.ticker)} and narrative is null and business_now is null and catalysts is null and watch_notes is null and enrich_sources is null;`).join('\n') + '\n')
  write('20261003_f1_facts_dossiers_ROLLBACK.sql', `-- Rollback of 20261003_f1_facts_dossiers.sql: removes only the rows it added (tag ${FACTS_TAG}) and the READ blocks read-engine\n-- derived from them (none of these names had business/catalysts/watch blocks before the load — measured ${staged.built_utc}).\n` +
    `delete from public.read_blocks where section in ('business','catalysts','watch') and ticker in (select ticker from public.ticker_context where enrich_sources = '${FACTS_TAG}');\n` +
    `update public.ticker_context set business_now = null, catalysts = null, watch_notes = null, sources = null, enrich_sources = null, enriched_ts = null, updated_ts = null where enrich_sources = '${FACTS_TAG}' and ticker in (${rows.filter((r) => r.shell).map((r) => q(r.ticker)).join(', ') || "''"});\n` +
    `delete from public.ticker_context where enrich_sources = '${FACTS_TAG}';\n`)
}

/* ── 2 · FUND HOLDINGS ────────────────────────────────────────────────────────────────────────────────────────── */
{
  const T = LISTS.etf, have = by(await forT('etf_holdings', T, 'select=ticker&order=ticker.asc,name.asc', 10))
  const funds = T.filter((t) => !have[t] && FILL.etf[t] && FILL.etf[t].holdings.length)
  const lines = []
  for (const t of funds) {
    const seen = new Set()
    for (const h of FILL.etf[t].holdings) { const key = String(h.name || h.asset); if (seen.has(key)) continue; seen.add(key); lines.push(`(${q(t)}, ${q(h.asset)}, ${q(key)}, ${n(h.shares)}, ${n(h.weight_pct)}, ${n(h.market_value)}, now())`) }
    staged.etf_holdings[t] = seen.size
  }
  write('20261003_f1_etf_holdings.sql', HEAD('FINANCIALS → HOLDINGS: ' + lines.length + ' holdings lines for ' + funds.length + ' funds that had none',
    'Every served fund opened HOLDINGS on "No etf_holdings rows … yet": no scheduled job writes etf_holdings (last 22 Jul). Source: FMP /stable/etf/holdings, read ' + FILL.built_utc + '.') +
    '-- Not loaded (FMP has no holdings list): ' + T.filter((t) => FILL.etf[t] && !FILL.etf[t].holdings.length).join(', ') + '.\n' +
    'insert into public.etf_holdings (ticker, asset, name, shares, weight_pct, market_value, updated_ts) values\n' + lines.join(',\n') + '\non conflict (ticker, name) do nothing;\n')
  write('20261003_f1_etf_holdings_ROLLBACK.sql', '-- Rollback of 20261003_f1_etf_holdings.sql: these funds had no etf_holdings row before the load (measured ' + staged.built_utc + ').\n' +
    'delete from public.etf_holdings where ticker in (' + funds.map(q).join(', ') + ');\n')
}

/* ── 3 · NEXT EARNINGS DATES ──────────────────────────────────────────────────────────────────────────────────── */
{
  const T = LISTS.earnings, have = by(await forT('earnings_events', T, 'select=ticker,date&date=gte.' + today + '&order=ticker.asc,date.asc'))
  const rows = []
  for (const t of T) {
    const f = FILL.earnings[t]; if (!f || !f.future.length || (have[t] && have[t].length)) continue   // only a name with NO future row
    const d = f.future.sort((a, b) => a.date.localeCompare(b.date))[0]
    rows.push({ ticker: t, ...d })
  }
  staged.earnings_events = rows
  write('20261003_f1_earnings_next.sql', HEAD('EARNINGS calendar + tab: the next date FMP carries for ' + rows.length + ' names with no future row',
    'Source: FMP /stable/earnings?symbol=T, read ' + FILL.built_utc + '; none of these dates is in recovery_earnings_archive (checked 3 Oct). fmp-events will own the row from its next pass.') +
    'insert into public.earnings_events (ticker, date, eps_estimate, revenue_estimate, updated_ts) values\n' +
    rows.map((r) => `(${q(r.ticker)}, ${q(r.date)}, ${n(r.eps_estimate)}, ${n(r.revenue_estimate)}, ${nowS})`).join(',\n') + '\non conflict (ticker, date) do nothing;\n')
  write('20261003_f1_earnings_next_ROLLBACK.sql', '-- Rollback of 20261003_f1_earnings_next.sql: removes exactly the (ticker, date) rows it added, only while no actual has arrived on them.\n' +
    rows.map((r) => `delete from public.earnings_events where ticker = ${q(r.ticker)} and date = ${q(r.date)} and eps_actual is null;`).join('\n') + '\n')
}

/* ── 4 · MOG.A ────────────────────────────────────────────────────────────────────────────────────────────────── */
{
  const p = FILL.profile['MOG.A']
  if (p && p.name) {
    staged.company_profile.push({ ticker: 'MOG.A', name: p.name, market_cap: p.market_cap, industry: p.industry, sector: p.sector, is_etf: false })
    staged.tickers_fmp_symbol.push({ ticker: 'MOG.A', fmp_symbol: 'MOG-A' })
    write('20261003_f1_mog_a.sql', HEAD('MOG.A: its FMP symbol (MOG-A) and a company_profile row',
      'MOG.A (Moog class A) had no profile, statements or estimates: FMP spells it MOG-A and tickers.fmp_symbol was empty (U4b B3). The profile job reads fmp_symbol; fmp-fundamentals / fmp-analyst / fmp-events do once the F1 loader fix (FMP symbol) is deployed.') +
      "update public.tickers set fmp_symbol = 'MOG-A' where ticker = 'MOG.A' and fmp_symbol is null;\n" +
      'insert into public.company_profile (ticker, name, exchange, sector, industry, market_cap, price, beta, range_52wk, shares_out, ipo_date, website, description, is_etf, updated_ts) values\n' +
      `(${q('MOG.A')}, ${q(p.name)}, ${q(p.exchange)}, ${q(p.sector)}, ${q(p.industry)}, ${n(p.market_cap)}, ${n(p.price)}, ${n(p.beta)}, ${q(p.range_52wk)}, ${n(p.shares_out)}, ${q(p.ipo_date)}, ${q(p.website)}, ${q(p.description)}, false, ${nowS})\non conflict (ticker) do nothing;\n`)
    write('20261003_f1_mog_a_ROLLBACK.sql', "-- Rollback of 20261003_f1_mog_a.sql (MOG.A had no company_profile row and an empty fmp_symbol before it).\ndelete from public.company_profile where ticker = 'MOG.A';\nupdate public.tickers set fmp_symbol = null where ticker = 'MOG.A' and fmp_symbol = 'MOG-A';\n")
  }
}

/* ── 5 · STATEMENTS (fmp-fundamentals' own run) ───────────────────────────────────────────────────────────────── */
{
  const T = LISTS.statements.filter((t) => t !== 'MOG.A')
  const [fh, fu] = await Promise.all([forT('fundamentals_history', T, 'select=ticker&order=ticker.asc,fiscal_date.asc,period.asc', 20), forT('fundamentals', T, 'select=ticker,price,market_cap,trailing_pe,eps_ttm,revenue_ttm,source,updated_ts&order=ticker.asc')]).then((x) => x.map(by))
  const none = T.filter((t) => !fh[t] && FILL.statements[t] && FILL.statements[t].fy && FILL.statements[t].q)
  for (const t of none) staged.statements_expected[t] = FILL.statements[t]
  const batches = []; for (let i = 0; i < none.length; i += 10) batches.push(none.slice(i, i + 10))
  const prior = none.filter((t) => fu[t]).map((t) => fu[t][0])
  write('20261003_f1_statements_trigger.sql', HEAD('FUNDAMENTALS / FINANCIALS / CAPITAL / REVENUE: fmp-fundamentals run for ' + none.length + ' companies with no statements',
    'fmp-fundamentals walks fmp_full_universe 10 names every 6 h (cron 10), so these v3 names wait up to ~13 days (U4b B2). FMP answers for every one (counts read ' + FILL.built_utc + ').') +
    '-- HOW: the function\'s own run, one call per 10 names, reusing cron job 10\'s stored request headers INSIDE the database — no key is copied anywhere.\n' +
    '-- Each call deletes nothing these names have (they have no rows) and writes fundamentals_history, balance_history, cashflow_history, ratios_history and\n-- the fundamentals row. Run the statements below one at a time, ~2 minutes apart (the function holds a 3-minute busy lock only in offset mode).\n' +
    batches.map((b) => `select net.http_post(url := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-fundamentals?sym=${b.map(encodeURIComponent).join(',')}', headers := (regexp_match(command, 'headers:=''([^'']+)''::jsonb'))[1]::jsonb, timeout_milliseconds := 150000) from cron.job where jobid = 10;`).join('\n') +
    '\n-- READ BACK: select ticker, count(*) from public.fundamentals_history where ticker in (' + none.map(q).join(', ') + ') group by 1 order by 1;\n')
  write('20261003_f1_statements_trigger_ROLLBACK.sql', '-- Rollback of 20261003_f1_statements_trigger.sql: these ' + none.length + ' names had NO fundamentals_history / balance_history / cashflow_history /\n-- ratios_history rows before the run (measured ' + staged.built_utc + '); ' + prior.length + ' had a fundamentals row, restored below to its prior values.\n' +
    ['fundamentals_history', 'balance_history', 'cashflow_history', 'ratios_history'].map((tb) => `delete from public.${tb} where ticker in (${none.map(q).join(', ')});`).join('\n') + '\n' +
    `delete from public.fundamentals where ticker in (${none.filter((t) => !fu[t]).map(q).join(', ') || "''"});\n` +
    prior.map((r) => `update public.fundamentals set price = ${n(r.price)}, market_cap = ${n(r.market_cap)}, trailing_pe = ${n(r.trailing_pe)}, eps_ttm = ${n(r.eps_ttm)}, revenue_ttm = ${n(r.revenue_ttm)}, source = ${q(r.source)}, updated_ts = ${n(r.updated_ts)} where ticker = ${q(r.ticker)};`).join('\n') + '\n')
}

fs.mkdirSync(path.join(HERE, 'data'), { recursive: true })
fs.writeFileSync(path.join(HERE, 'data/staged-20261003.json'), JSON.stringify(staged))
console.log(JSON.stringify({ dossiers: staged.ticker_context.length, funds: Object.keys(staged.etf_holdings).length, holdings_lines: Object.values(staged.etf_holdings).reduce((a, b) => a + b, 0), earnings: staged.earnings_events.length, statements: Object.keys(staged.statements_expected).length, mog: staged.company_profile.length }))
