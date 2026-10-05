// C2 dry run (5 Oct 2026): loads the live market_calendar rows (public read, saved as JSON) into a throw-away
// PostgreSQL (PGlite), applies the staged 2028 file twice, checks the counts, then the rollback. No network, no live database.
// Run: PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node calendar-dryrun.mjs <live-rows.json>
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const { PGlite } = await import(pathToFileURL(join(process.env.PGLITE_DIR, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const live = JSON.parse(readFileSync(process.argv[2], 'utf8'))
await db.exec(`create table public.market_calendar (d date primary key, is_trading_day boolean not null, open_min int, close_min int,
  regular_minutes int, label text, source text, updated_at timestamptz default now())`)
for (const r of live) await db.query('insert into market_calendar values ($1,$2,$3,$4,$5,$6,$7,$8)',
  [r.d, r.is_trading_day, r.open_min, r.close_min, r.regular_minutes, r.label, r.source, r.updated_at])
const S = join(here, '../../../../staged/c2-calendar')
const q = async s => (await db.query(s)).rows
const snap = async () => JSON.stringify(await q(`select d::text,is_trading_day,open_min,close_min,regular_minutes,label,source from market_calendar where d < '2028-01-01' order by d`))
const out = {}
out.before = (await q(`select count(*)::int n, max(d)::text last from market_calendar`))[0]
const pre = await snap()
const up = readFileSync(join(S, '20261005_c2_market_calendar_2028.sql'), 'utf8')
await db.exec(up); await db.exec(up) // twice: the second run must add nothing
out.after = (await q(`select count(*)::int n, max(d)::text last from market_calendar`))[0]
out.y2028 = (await q(`select count(*)::int days, count(*) filter (where is_trading_day)::int sessions, count(*) filter (where label='weekend')::int weekend,
  count(*) filter (where not is_trading_day and label<>'weekend')::int holidays, count(*) filter (where regular_minutes=210)::int early,
  max(d) filter (where is_trading_day)::text last_session from market_calendar where d between '2028-01-01' and '2028-12-31'`))[0]
out.special = await q(`select d::text, is_trading_day t, open_min o, close_min c, regular_minutes m, label, source from market_calendar where d >= '2028-01-01' and label not in ('regular session','weekend') order by d`)
out.bad_shape = (await q(`select count(*)::int n from market_calendar where d>='2028-01-01' and not (
  (is_trading_day and open_min=570 and close_min in (960,780) and regular_minutes=close_min-open_min) or
  (not is_trading_day and open_min is null and close_min is null and regular_minutes=0))`))[0].n
out.older_rows_untouched = pre === await snap()
await db.exec(readFileSync(join(S, '20261005_c2_market_calendar_2028_ROLLBACK.sql'), 'utf8'))
out.after_rollback = (await q(`select count(*)::int n, max(d)::text last from market_calendar`))[0]
out.rollback_restores_exactly = pre === await snap() && out.after_rollback.n === out.before.n
console.log(JSON.stringify(out, null, 1))
