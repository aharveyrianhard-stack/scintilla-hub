// D2 (6 Oct 2026) · THE DRY RUN. Runs the real supabase/functions/dossier-facts/index.ts (its text, unchanged but for the two import
// lines) in Node against a read-only snapshot of the database (data/db-snapshot-20261006.json, taken with read-only SQL) and the
// live chart API (GET only). NOTHING is written anywhere but this folder: the "database" here is memory.
//   stage A  the database as it is today (the 64 funds have no fund facts yet)
//   stage B  + what FMP answered for those funds on 6 Oct (data/fmp-fund-read-20261006.json) laid over etf_info / etf_holdings —
//            what the tables hold after fmp-backfill?job=etf has run once
// For each stage: the function is called with no ?sym= until nothing is pending (the scheduled path), writes land in memory, and
// the count of active names with no usable dossier (business_now under 40 characters — the coordinator's rule) is taken before/after.
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../../..')
const snap = JSON.parse(fs.readFileSync(path.join(here, '../data/db-snapshot-20261006.json'), 'utf8'))
const fmp = JSON.parse(fs.readFileSync(path.join(here, '../data/fmp-fund-read-20261006.json'), 'utf8'))
const clone = (o) => JSON.parse(JSON.stringify(o))

function makeDb (stage) {
  const db = clone(snap)
  if (stage === 'B') for (const [t, f] of Object.entries(fmp.funds)) {
    if (f.info) db.etf_info.push({ ticker: t, ...f.info })
    for (const h of f.top10) db.etf_holdings.push({ ticker: t, ...h })   // the ten largest are all the composer reads
  }
  /* the snapshot holds the stored facts of the 72 names and 8 samples only (S). The walk is limited to S so that the function's
     hourly REFRESH of the other 335 facts dossiers is not replayed here against facts this snapshot does not carry. */
  const S = new Set(db.company_profile.map((r) => r.ticker).concat(SAMPLE, MISSING))
  db.fmp_full_universe = db.fmp_full_universe.filter((r) => S.has(r.ticker))
  db.tickers = db.tickers.map((r) => ({ ...r, walked: S.has(r.ticker) }))
  return db
}
const ctx0 = Object.fromEntries(snap.ticker_context.map((c) => [c.ticker, c]))
const MISSING = snap.tickers.filter((t) => t.active && !((ctx0[t.ticker] || {}).bl >= 40)).map((t) => t.ticker)
const SAMPLE = ['XLI', 'AAOI', 'BTCUSD', 'VIX'].concat(snap.etf_info.map((r) => r.ticker))
let DB, writes
function from (table) {
  const f = [], ord = []; let lim = null, rng = null, op = 'select', payload = null, opts = null, single = false, activeOnly = false
  const run = () => {
    const rows = DB[table] || (DB[table] = [])
    const hit = (r) => f.every((g) => g(r)) && (table !== 'tickers' || !activeOnly || r.walked)
    if (op === 'upsert') { if (rows.some((r) => r.ticker === payload.ticker)) return { data: null, error: null }; rows.push({ ...payload, bl: (payload.business_now || '').length }); writes.push({ op, table, ticker: payload.ticker }); return { data: null, error: null } }
    if (op === 'update') { for (const r of rows.filter(hit)) { Object.assign(r, payload, { bl: (payload.business_now || '').length }); writes.push({ op, table, ticker: r.ticker }) } return { data: null, error: null } }
    let out = rows.filter(hit)
    for (const [k, asc] of ord.slice().reverse()) out = out.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1))
    if (rng) out = out.slice(rng[0], rng[1] + 1); if (lim != null) out = out.slice(0, lim)
    return single ? { data: out[0] || null, error: null } : { data: out, error: null }
  }
  const b = {
    select: () => b, in: (k, a) => (f.push((r) => a.includes(r[k])), b), eq: (k, v) => { if (k === 'active') activeOnly = true; f.push((r) => r[k] === v); return b }, gte: (k, v) => (f.push((r) => r[k] >= v), b),
    is: (k, v) => (f.push((r) => (r[k] ?? null) === v), b), not: (k, o, v) => (f.push((r) => (r[k] ?? null) !== v), b),
    order: (k, o) => (ord.push([k, !(o && o.ascending === false)]), b), range: (a, z) => (rng = [a, z], b), limit: (n) => (lim = n, b), maybeSingle: () => (single = true, b),
    upsert: (p, o) => (op = 'upsert', payload = p, opts = o, b), update: (p) => (op = 'update', payload = p, b),
    then: (res, rej) => Promise.resolve().then(run).then(res, rej),
  }
  return b
}
// the function's own text, with its two imports pointed at this harness and at the shared composer on disk
let handler
globalThis.__d2 = { createClient: () => ({ from }) }
globalThis.Deno = { env: { get: () => 'x' }, serve: (h) => { handler = h } }
const src = fs.readFileSync(path.join(root, 'supabase/functions/dossier-facts/index.ts'), 'utf8')
  .replace("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'", 'const { createClient } = globalThis.__d2')
  .replace("'../_shared/facts-dossier.mjs'", JSON.stringify(pathToFileURL(path.join(root, 'supabase/functions/_shared/facts-dossier.mjs')).href))
const tmp = path.join(here, '.dossier-facts.run.ts'); fs.writeFileSync(tmp, src)
try { await import(pathToFileURL(tmp).href) } finally { fs.unlinkSync(tmp) }

const missing = () => DB.tickers.filter((t) => t.active && !((DB.ticker_context.find((c) => c.ticker === t.ticker) || {}).bl >= 40)).map((t) => t.ticker).sort()
const call = async (qs) => (await handler(new Request('http://local/dossier-facts' + qs))).json()
const result = { run_utc: new Date().toISOString(), snapshot_utc: snap.read_utc, fmp_read_utc: fmp.read_utc, active: snap.tickers.filter((t) => t.active).length, stages: {} }
for (const stage of ['A', 'B']) {
  DB = makeDb(stage); writes = []
  const before = missing(), runs = [], texts = {}
  const dry = await call('?dry=1&sym=' + before.slice(0, 60).join(','))             // ?dry=1 writes nothing: checked below
  if (writes.length) throw new Error('dry=1 wrote ' + writes.length)
  const real0 = DB.ticker_context.filter((c) => c.enrich_sources !== 'FACTS:f1-v1').map((c) => JSON.stringify(c)).sort().join('\n')
  for (let i = 0; i < 20; i++) {                                                     // the scheduled path, hour after hour
    const o = await call(''); runs.push({ inserted: o.inserted, filled_shells: o.filled_shells, refreshed: o.refreshed, skipped_real: o.skipped_real, nothing_to_say: o.nothing_to_say, errors: o.errors, pending_after: o.pending_after })
    if (o.errors.length) break
    if (!(o.inserted + o.filled_shells)) break                                         // only refreshes left
  }
  const real1 = DB.ticker_context.filter((c) => c.enrich_sources !== 'FACTS:f1-v1').map((c) => JSON.stringify(c)).sort().join('\n')
  for (const t of before) { const c = DB.ticker_context.find((r) => r.ticker === t); if (c) texts[t] = { business_now: c.business_now, catalysts: c.catalysts, watch_notes: c.watch_notes } }
  const after = missing()
  result.stages[stage] = { walked: DB.tickers.filter((t) => t.walked).length, before: before.length, after: after.length, still_missing: after, dry_rows: (dry.rows || []).length, runs, real_dossiers_untouched: real0 === real1,
    inserted_by_class: before.reduce((m, t) => { const k = (snap.tickers.find((r) => r.ticker === t) || {}).type; m[k] = (m[k] || 0) + (texts[t] ? 1 : 0); return m }, {}),
    shortest_business: Object.entries(texts).map(([t, d]) => [t, (d.business_now || '').length]).sort((a, b) => a[1] - b[1]).slice(0, 3), with_range: Object.values(texts).filter((d) => /traded between|ranged from|52-week/.test(d.watch_notes || '')).length, texts }
}
fs.writeFileSync(path.join(here, '../data/dry-run-20261006.json'), JSON.stringify(result, null, 1))
for (const [k, s] of Object.entries(result.stages)) console.log('stage', k, '· missing', s.before, '→', s.after, '· by class', JSON.stringify(s.inserted_by_class), '· with a range line', s.with_range, '· real dossiers untouched', s.real_dossiers_untouched, '· runs', JSON.stringify(s.runs.map((r) => [r.inserted, r.refreshed, r.errors.length, r.pending_after])), '· shortest', JSON.stringify(s.shortest_business))
