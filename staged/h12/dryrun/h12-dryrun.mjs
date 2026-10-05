// H12 dry run (5 Oct 2026): the staged SQL EXECUTED on a throw-away PostgreSQL (PGlite — Postgres compiled
// to WebAssembly; no network, nothing live is touched), loaded with a read-only copy of the live rows taken
// 5 Oct ~17:20 ET and with the live chart API /geiger standing in for the rows H11's job writes at 20:20 ET.
//   PGLITE_DIR=<folder holding node_modules/@electric-sql/pglite> node h12-dryrun.mjs <dryrun-input.json> <out.json>
import fs from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const here = dirname(fileURLToPath(import.meta.url))
const sql = f => fs.readFileSync(join(here, '..', f), 'utf8')
const { PGlite } = await import(pathToFileURL(join(process.env.PGLITE_DIR, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const I = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const db = new PGlite()
const all = async (q, p) => (await db.query(q, p)).rows
await db.exec(`
  create table public.composite_staged (ticker text, tf text, trend double precision, momentum double precision,
    volatility double precision, conviction double precision, core double precision, composite double precision,
    updated_ts bigint, tf_contributors integer, primary key (ticker, tf));
  create table public.composite_history (snapshot_date date not null, ticker text not null, tf text not null,
    trend double precision, momentum double precision, structure double precision, volatility double precision,
    conviction double precision, core double precision, composite double precision, source_ts bigint,
    captured_at timestamptz not null default now(), as_of timestamptz, source text, primary key (snapshot_date, ticker, tf));
  create table public.tickers (ticker text primary key, cohort text, active boolean, type text);
  create table public.ticker_membership (ticker text, group_key text, kind text);
  create table public.sector_vendor_map (vendor_sector text, group_key text, spdr text, note text);
  create table public.sector_rankings (date date, sector text, sector_name text, rank integer, score double precision,
    trend double precision, momentum double precision, method text, updated_at timestamptz, primary key (date, sector));
  create table public.cohort_divergence (ticker text primary key, cohort text, geiger double precision,
    cohort_mean double precision, divergence double precision, flag text);`)
const load = async (t, cols, rows) => { for (let i = 0; i < rows.length; i += 200) await db.query(
  `insert into public.${t} (${cols.join(',')}) select ${cols.map(c => 'x.' + c).join(',')} from json_populate_recordset(null::public.${t}, $1::json) x`,
  [JSON.stringify(rows.slice(i, i + 200))]) }
await load('composite_staged', ['ticker', 'tf', 'trend', 'momentum', 'composite', 'updated_ts', 'tf_contributors'], I.staged.map(r => ({ ...r, tf: 'D' })))
await load('tickers', ['ticker', 'cohort', 'active', 'type'], I.tickers)
await load('ticker_membership', ['ticker', 'group_key', 'kind'], I.tm)
await load('sector_vendor_map', ['vendor_sector', 'group_key', 'spdr', 'note'], I.svm)
await load('cohort_divergence', ['ticker', 'cohort', 'geiger', 'cohort_mean', 'divergence', 'flag'], I.cd)
await load('sector_rankings', ['date', 'sector', 'sector_name', 'rank', 'score', 'trend', 'momentum', 'method', 'updated_at'], I.sr)

const D = '2026-10-05'
const sectors = () => all(`select sector, sector_name, rank, score, trend, momentum, method from sector_rankings where date = $1 order by rank`, [D])
const cohorts = () => all(`select cohort, count(*)::int n, round(avg(cohort_mean)::numeric,4)::float8 mean, count(*) filter (where flag='DIVERGENT')::int divergent from cohort_divergence group by 1 order by 1`)
const names = () => all(`select * from cohort_divergence order by ticker`)
const out = { taken: 'live rows read 5 Oct 2026 ~17:20 ET; /geiger computed ' + I.geiger.computed_utc }

// A. the bodies that run live today
await db.exec(sql('current-bodies/scin_rebuild_sector_rankings.sql')); await db.exec(sql('current-bodies/recompute_cohort_divergence.sql'))
out.live_published = I.sr                                   // what sector_rankings really holds (2 Oct)
await db.query(`select scin_rebuild_sector_rankings($1::date)`, [D]); await db.query(`select recompute_cohort_divergence()`)
out.old_sectors = await sectors(); out.old_cohorts = await cohorts(); const oldNames = await names()
// the old body reproduces the live published scores from the same frozen stock rows (proof the copy is faithful)
out.old_vs_published = out.old_sectors.map(r => { const p = I.sr.find(x => x.sector === r.sector); return { sector: r.sector, recomputed: r.score, published_2oct: p ? p.score : null } })
out.orphans = (await all(`select d.ticker from cohort_divergence d where not exists (select 1 from composite_staged c where c.ticker=d.ticker) order by 1`)).map(r => r.ticker)

// B. apply 01-04 (twice: safe to re-apply) BEFORE any live history row exists -> must change no number
for (let k = 0; k < 2; k++) for (const f of ['01_geiger_latest_d.sql', '02_age_columns.sql', '03_scin_rebuild_sector_rankings.sql', '04_recompute_cohort_divergence.sql']) await db.exec(sql(f))
await db.query(`select scin_rebuild_sector_rankings($1::date)`, [D]); await db.query(`select recompute_cohort_divergence()`)
const pre = await sectors()
assert.deepEqual(pre.map(r => [r.sector, r.rank, r.score, r.trend, r.momentum]), out.old_sectors.map(r => [r.sector, r.rank, r.score, r.trend, r.momentum]), 'before the first live evening, 03 publishes the same numbers')
assert.deepEqual((await names()).map(r => [r.ticker, r.cohort, r.geiger, r.cohort_mean, r.divergence, r.flag]), oldNames.map(r => [r.ticker, r.cohort, r.geiger, r.cohort_mean, r.divergence, r.flag]), 'before the first live evening, 04 writes the same numbers')
out.before_first_live_evening = { same_numbers_as_today: true, method_now_says: pre.map(r => r.sector + ': ' + r.method) }

// C. tonight: H11's job has written the live /geiger into composite_history (simulated from the real payload)
const hist = Object.entries(I.geiger.symbols).filter(([, v]) => typeof v.composite === 'number').map(([t, v]) => ({
  snapshot_date: D, ticker: t, tf: 'D', trend: v.trend, momentum: v.momentum, core: v.composite, composite: v.composite,
  source_ts: Math.floor(Date.parse(v.computed_utc) / 1000), as_of: v.computed_utc,
  source: v.liveness && v.liveness.state !== 'FRESH' ? 'CHART_API_GEIGER_CARRIED' : 'CHART_API_GEIGER' }))
await load('composite_history', ['snapshot_date', 'ticker', 'tf', 'trend', 'momentum', 'core', 'composite', 'source_ts', 'as_of', 'source'], hist)
out.history_rows_simulated = hist.length
await db.query(`select scin_rebuild_sector_rankings($1::date)`, [D]); await db.query(`select recompute_cohort_divergence()`)
out.new_sectors = await all(`select sector, sector_name, rank, score, trend, momentum, method, n_names, n_old, as_of_oldest, as_of_newest from sector_rankings where date=$1 order by rank`, [D])
out.new_cohorts = await all(`select cohort, count(*)::int n, round(avg(cohort_mean)::numeric,4)::float8 mean, count(*) filter (where flag='DIVERGENT')::int divergent, min(cohort_as_of_oldest) oldest from cohort_divergence where as_of is not null group by 1 order by 1`)
const newNames = await names()
out.sources = await all(`select coalesce(source,'(row not rewritten)') source, count(*)::int n, min(as_of) oldest, max(as_of) newest from cohort_divergence group by 1 order by 2 desc`)
const om = Object.fromEntries(oldNames.map(r => [r.ticker, r]))
out.flag_changes = { names_before: oldNames.length, names_after: newNames.length,
  new_names: newNames.filter(r => !om[r.ticker]).length,
  flag_flipped: newNames.filter(r => om[r.ticker] && om[r.ticker].flag !== r.flag).map(r => ({ ticker: r.ticker, cohort: r.cohort, was: om[r.ticker].flag, now: r.flag, geiger_was: om[r.ticker].geiger, geiger_now: r.geiger, mean_was: om[r.ticker].cohort_mean, mean_now: r.cohort_mean })),
  divergent_before: oldNames.filter(r => r.flag === 'DIVERGENT').length, divergent_after: newNames.filter(r => r.flag === 'DIVERGENT').length }
out.spdr_fund_live = Object.fromEntries(['XLK','XLC','XLY','XLF','XLI','XLB','XLE','XLV','XLP','XLU','XLRE'].map(t => [t, I.geiger.symbols[t] ? { composite: I.geiger.symbols[t].composite, trend: I.geiger.symbols[t].trend, momentum: I.geiger.symbols[t].momentum } : null]))
out.spdr_fund_staged = Object.fromEntries(I.staged.filter(r => /^XL/.test(r.ticker)).map(r => [r.ticker, { composite: r.composite, trend: r.trend, momentum: r.momentum, updated_ts: r.updated_ts }]))

// D. a missed evening: the live rows are one day old -> still used, and marked
await db.exec(`update composite_history set snapshot_date = snapshot_date - 6, as_of = as_of - interval '6 days'`)
await db.query(`select scin_rebuild_sector_rankings($1::date)`, [D])
out.if_live_writer_stops_6_days = (await all(`select sector, score, n_names, n_old, method from sector_rankings where date=$1 order by rank`, [D]))
assert.ok(out.if_live_writer_stops_6_days.some(r => /OLD/.test(r.method)), 'an old input is published and marked, never held')
await db.exec(`update composite_history set snapshot_date = snapshot_date + 6, as_of = as_of + interval '6 days'`)

// E. rollbacks, in order, restore the bodies that ran on 5 Oct and remove what H12 added
for (const f of ['04_recompute_cohort_divergence_ROLLBACK.sql', '03_scin_rebuild_sector_rankings_ROLLBACK.sql', '02_age_columns_ROLLBACK.sql', '01_geiger_latest_d_ROLLBACK.sql']) await db.exec(sql(f))
const src = async n => (await all(`select prosrc from pg_proc where proname=$1`, [n]))[0].prosrc
assert.match(await src('scin_rebuild_sector_rankings'), /join composite_staged c/); assert.match(await src('recompute_cohort_divergence'), /FROM composite_staged cs/)
assert.equal((await all(`select 1 from pg_proc where proname='scin_geiger_latest_d'`)).length, 0)
assert.equal((await all(`select 1 from information_schema.columns where table_name in ('sector_rankings','cohort_divergence') and column_name in ('as_of','as_of_oldest','n_old','source','updated_at_h12','cohort_as_of_oldest','n_names','as_of_newest')`)).length, 0)
await db.query(`select scin_rebuild_sector_rankings($1::date)`, [D]); await db.query(`select recompute_cohort_divergence()`)
assert.deepEqual((await sectors()).map(r => [r.sector, r.rank, r.score, r.method]), out.old_sectors.map(r => [r.sector, r.rank, r.score, r.method]), 'after rollback the sector numbers are todays again')
out.rollback = 'bodies restored, added columns and helper removed, sector numbers back to todays'
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1))
console.log('DRY RUN OK', { sectors: out.new_sectors.length, cohorts: out.new_cohorts.length, history: out.history_rows_simulated, flips: out.flag_changes.flag_flipped.length })
