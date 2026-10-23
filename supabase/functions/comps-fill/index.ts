// SCINTILLA · comps-fill v1 — 23 Oct 2026 (coordinator). Keeps public.comps_fmp_answers fresh for the Hub's COMPS tab (CW6).
// WHY: the tab priced every name on FMP's answers of 22 Oct 18:06 UTC, served as files; statements, estimates and targets go stale
//   after earnings (BE and WDC reported on 22 Oct after that fetch, AXP on 23 Oct before the open). The tab reads this table first.
// HOW: POST from pg_cron (weekdays 10:30 UTC, the set in parts: ?part=1&of=3 …). The companies and the reviewed names come from the
//   Hub's own sets.json. A company with no row yet is seeded from its store file (every answer, profile and FMP's peer list included,
//   dated as fetched); a company with neither a row nor a file is left to the files. Then, per company: analyst-estimates (annual, 6),
//   income-statement-ttm, balance-sheet-statement (quarter, 1); quotes 30 a call; the reviewed names add price-target-consensus and
//   -summary, and the loss-makers among them cash-flow-statement (quarter, 4) and shares-float — the reads and trimmed fields of CW6's
//   tools/fill_store.py. Only a 200 answer replaces a row; a failed read keeps the last good one.
// GUARD: the bearer must be the Vault key scintilla_functions_key (public.push_cron_key_ok); anyone else gets 401. One fmp_bandwidth_log
//   row per run (fn = 'comps-fill'); the run's summary in app_config comps_fill_last_<part>of<of>. The FMP key is never printed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }
const SB_URL = Deno.env.get('SUPABASE_URL') || ''
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const HUB = 'https://scintillahub.ai/deliverables/20261022/cw6-comps-tab/'
const FMP = 'https://financialmodelingprep.com/stable/'
const WORKERS = 8
const KEEP: Record<string, string[]> = {
  'profile': ['symbol', 'companyName', 'industry', 'sector', 'exchange', 'country', 'ipoDate', 'isAdr', 'currency', 'marketCap', 'price'],
  'quote': ['symbol', 'name', 'price', 'marketCap', 'timestamp', 'exchange', 'previousClose'],
  'analyst-estimates': ['symbol', 'date', 'revenueAvg', 'revenueLow', 'revenueHigh', 'ebitdaAvg', 'ebitAvg', 'netIncomeAvg', 'epsAvg', 'epsHigh', 'epsLow', 'numAnalystsRevenue', 'numAnalystsEps'],
  'income-statement-ttm': ['symbol', 'date', 'reportedCurrency', 'revenue', 'grossProfit', 'operatingIncome', 'ebitda', 'netIncome', 'epsDiluted', 'weightedAverageShsOutDil'],
  'balance-sheet-statement': ['symbol', 'date', 'reportedCurrency', 'cashAndShortTermInvestments', 'cashAndCashEquivalents', 'totalDebt', 'shortTermDebt', 'longTermDebt', 'totalStockholdersEquity', 'totalEquity'],
  'price-target-consensus': ['symbol', 'targetHigh', 'targetLow', 'targetConsensus', 'targetMedian'],
  'price-target-summary': ['symbol', 'lastMonthCount', 'lastMonthAvgPriceTarget', 'lastQuarterCount', 'lastQuarterAvgPriceTarget', 'lastYearCount', 'lastYearAvgPriceTarget'],
  'cash-flow-statement': ['symbol', 'date', 'reportedCurrency', 'operatingCashFlow', 'capitalExpenditure', 'freeCashFlow'],
  'shares-float': ['symbol', 'freeFloat', 'floatShares', 'outstandingShares'],
  'stock-peers': ['symbol', 'companyName', 'mktCap', 'price'],
}
type Params = Record<string, string | number>
const COMMON: [string, Params][] = [['analyst-estimates', { period: 'annual', limit: 6 }], ['income-statement-ttm', {}], ['balance-sheet-statement', { period: 'quarter', limit: 1 }]]
const SUBJ: [string, Params][] = [['price-target-consensus', {}], ['price-target-summary', {}]]
const LOSS: [string, Params][] = [['cash-flow-statement', { period: 'quarter', limit: 4 }], ['shares-float', {}]]
const pick = (keep: string[], r: Record<string, unknown>) => { const o: Record<string, unknown> = {}; for (const k of keep) if (k in r) o[k] = r[k]; return o }
function trim(path: string, data: unknown) {
  const keep = KEEP[path]
  if (!keep || data == null) return data
  if (Array.isArray(data)) return data.filter((r) => r && typeof r === 'object').map((r) => pick(keep, r))
  if (typeof data === 'object') return pick(keep, data as Record<string, unknown>)
  return data
}
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clean = (s: unknown) => String(s).replace(/apikey=[^&\s)"']+/gi, 'apikey=…').slice(0, 300)

// deno-lint-ignore no-explicit-any
async function run(sb: any, K: string, part: number, of: number) {
  const t0 = Date.now()
  const sets = await (await fetch(HUB + 'sets.json')).json()
  const subjects = new Set(Object.keys(sets.names || {}))
  const mine: string[] = (sets.all || []).filter((_: string, i: number) => i % of === part - 1)
  let calls = 0, bytes = 0
  const byStatus: Record<string, number> = {}
  async function get(path: string, params: Params) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) q.set(k, String(v))
    q.set('apikey', K)
    let status = 0, body = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const r = await fetch(FMP + path + '?' + q.toString()); status = r.status; body = await r.text() } catch (_) { status = 0; body = '' }
      calls++; bytes += body.length
      if ((status === 429 || status === 0 || status >= 500) && attempt < 2) { await sleep(1500 + 2500 * attempt); continue }
      break
    }
    byStatus[status] = (byStatus[status] || 0) + 1
    let data: unknown = null
    if (status === 200) { try { data = JSON.parse(body) } catch (_) { data = null } }
    return { status, fetched_at: new Date().toISOString(), data: trim(path, data) }
  }
  // which rows exist (no data column: one small read per 40 companies)
  const have = new Map<string, Set<string>>()
  for (let i = 0; i < mine.length; i += 40) {
    const { data, error } = await sb.from('comps_fmp_answers').select('ticker,path').in('ticker', mine.slice(i, i + 40)).limit(1000)
    if (error) throw new Error('read: ' + error.message)
    for (const r of data || []) { if (!have.has(r.ticker)) have.set(r.ticker, new Set()); have.get(r.ticker)!.add(r.path) }
  }
  // 1 · quotes, 30 a call
  // deno-lint-ignore no-explicit-any
  const quotes: Record<string, any> = {}
  for (let i = 0; i < mine.length; i += 30) {
    const a = await get('batch-quote', { symbols: mine.slice(i, i + 30).join(',') })
    if (a.status === 200 && Array.isArray(a.data)) for (const row of a.data) if (row && row.symbol) quotes[row.symbol] = { status: 200, fetched_at: a.fetched_at, data: trim('quote', row) }
  }
  // 2 · per company
  const today = new Date().toISOString().slice(0, 10)
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [], skipped: string[] = [], kept: string[] = []
  let seeded = 0
  async function work(t: string) {
    const ex = have.get(t) || new Set<string>()
    // deno-lint-ignore no-explicit-any
    const out: Record<string, any> = {}
    if (!ex.size) {
      // deno-lint-ignore no-explicit-any
      let seed: any = null
      try { const r = await fetch(HUB + 'store/' + encodeURIComponent(t) + '.json'); if (r.ok) seed = await r.json() } catch (_) { seed = null }
      if (!seed || !seed.answers) { skipped.push(t + ' (no row and no store file: left to the files)'); return }
      // deno-lint-ignore no-explicit-any
      for (const [path, a] of Object.entries<any>(seed.answers)) out[path] = { ticker: t, path, params: { seeded: 'store file', from: a.from || null }, status: Number(a.status) || 0, fetched_at: a.fetched_utc || seed.filled_utc || new Date().toISOString(), data: a.data ?? null }
      seeded++
    }
    const known = (p: string) => ex.has(p) || !!out[p]
    // deno-lint-ignore no-explicit-any
    const put = (path: string, params: Params, a: any) => {
      if (a.status === 200) out[path] = { ticker: t, path, params, status: 200, fetched_at: a.fetched_at, data: a.data }
      else if (!known(path)) out[path] = { ticker: t, path, params, status: a.status, fetched_at: a.fetched_at, data: null }
      else kept.push(t + ' ' + path + ' ' + a.status)
    }
    if (quotes[t]) out['quote'] = { ticker: t, path: 'quote', params: { via: 'batch-quote' }, ...quotes[t] }
    const plan: [string, Params][] = [...COMMON, ...(known('profile') ? [] : [['profile', {}] as [string, Params]]), ...(subjects.has(t) ? SUBJ : [])]
    for (const [path, params] of plan) put(path, params, await get(path, { symbol: t, ...params }))
    if (subjects.has(t)) {   // a loss-maker gets the cash-flow and float reads (the pre-profit facts), as fill_store.py decides
      const ttm = out['income-statement-ttm']?.data
      const ni = Array.isArray(ttm) && ttm.length ? (ttm[0] || {}).netIncome : null
      // deno-lint-ignore no-explicit-any
      const ests = (Array.isArray(out['analyst-estimates']?.data) ? out['analyst-estimates'].data : []).slice().sort((x: any, y: any) => String(x.date || '').localeCompare(String(y.date || '')))
      // deno-lint-ignore no-explicit-any
      const fut = ests.filter((r: any) => String(r.date || '') > today)
      const nin = fut.length ? fut[0].netIncomeAvg : null
      if ((ni != null && ni <= 0) || (nin != null && nin <= 0) || nin == null) for (const [path, params] of LOSS) put(path, params, await get(path, { symbol: t, ...params }))
    }
    rows.push(...Object.values(out))
  }
  let next = 0
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (next < mine.length) { const t = mine[next++]; try { await work(t) } catch (e) { skipped.push(t + ' (' + clean((e as Error)?.message || e) + ')') } }
  }))
  let upserted = 0
  for (let j = 0; j < rows.length; j += 200) {
    const batch = rows.slice(j, j + 200)
    const { error } = await sb.from('comps_fmp_answers').upsert(batch, { onConflict: 'ticker,path' })
    if (error) throw new Error('upsert: ' + error.message)
    upserted += batch.length
  }
  const summary = { at: new Date().toISOString(), part, of, companies: mine.length, seeded, upserted, skipped, kept_last_good: kept.length, kept: kept.slice(0, 25), calls, by_status: byStatus, mb: Math.round(bytes / 1e4) / 100, ms: Date.now() - t0 }
  try { await sb.from('fmp_bandwidth_log').insert({ fn: 'comps-fill', calls, symbols: mine.length, bytes, status: 200, at: new Date().toISOString() }) } catch (_) { /* never fails the run */ }
  return summary
}

Deno.serve(async (req) => {
  const sb = createClient(SB_URL, SB_KEY)
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const { data: ok } = await sb.rpc('push_cron_key_ok', { k: bearer })
  if (ok !== true) return J({ error: 'not allowed' }, 401)
  const u = new URL(req.url)
  const of = Math.max(1, Math.min(10, Number(u.searchParams.get('of')) || 1))
  const part = Math.max(1, Math.min(of, Number(u.searchParams.get('part')) || 1))
  const { data: kc } = await sb.from('app_config').select('value').eq('key', 'FMP_KEY').maybeSingle()
  const K = String(kc?.value || '').trim()
  if (!K) return J({ error: 'no key' }, 500)
  const job = run(sb, K, part, of)
    .catch((e) => ({ at: new Date().toISOString(), part, of, error: clean((e as Error)?.message || e) }))
    .then(async (s) => { try { await sb.from('app_config').upsert({ key: `comps_fill_last_${part}of${of}`, value: JSON.stringify(s), updated_ts: new Date().toISOString() }, { onConflict: 'key' }) } catch (_) { /* the summary is a convenience */ } return s })
  if (u.searchParams.get('wait') === '1') return J(await job)
  EdgeRuntime.waitUntil(job)
  return J({ started: true, part, of }, 202)
})
