#!/usr/bin/env node
// TR1 (6 Oct 2026) — THE COHORT TREE, ADOPTED BESIDE THE S&P SECTORS, WITHOUT TOUCHING THE HUB.
//
//   node scripts/cohort-tree-loader.mjs                       # dry run: validate, print the plan, write nothing
//   node scripts/cohort-tree-loader.mjs --write               # write the three SQL files under supabase/migrations/
//   node scripts/cohort-tree-loader.mjs --pglite <dir>        # also RUN schema + load + rollback in a throw-away
//                                                             # in-memory Postgres (<dir> holds node_modules/@electric-sql/pglite)
//   node scripts/cohort-tree-loader.mjs --served <universe.json>   # judge "served" against another universe file
//
// WHY NEW TABLES. The Hub builds its cohort tabs and filters from public.ticker_cohorts (index.html, loadCohSets →
// COHSETS). A row written there shows up on the board the same minute. Alan (3 Oct): nothing changes on the Hub
// without his word; (6 Oct): "After the tree, we decide what goes on the hub." So the tree lives in two NEW tables
// that no page reads: public.cohort_tree and public.cohort_tree_members. ticker_cohorts is not read, written or
// referenced by anything this script emits.
//
// THE LOADER NEVER TOUCHES THE DATABASE. It writes SQL; the coordinator applies it:
//   supabase db query --linked --project-ref wadinxqplrggagkvrdag -f supabase/migrations/20261006_tr1_cohort_tree.sql
//   supabase db query --linked --project-ref wadinxqplrggagkvrdag -f supabase/migrations/20261006_tr1_cohort_tree_LOAD.sql
// Way back: …/20261006_tr1_cohort_tree_ROLLBACK.sql (drops the two tables; nothing else was created).
// The load is idempotent: it empties the two tables it owns and refills them inside one transaction, then proves its
// own counts and refuses (rolls back) if they are not the ones printed here.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const flag = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1] }
const WRITE = argv.includes('--write')
const PGLITE = flag('--pglite')
const CO1 = 'deliverables/20261006/cohort-proposal'
const TR1 = 'deliverables/20261006/tree-adopted'
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
const SOURCE = 'TR1-20261006'
const MIG = 'supabase/migrations/20261006_tr1_cohort_tree'
// QRVO was bought by Skyworks on 5 Oct and leaves the universe in the same sitting (HB2). CO1 placed it; the tree
// does not carry a name that no longer trades. SWKS, its buyer, is already a member of the same cohort.
const RETIRING = ['QRVO']

export function buildTree ({ proposal, indexLayer, served }) {
  const servedSet = new Set(served)
  const nodes = []   // { cohort, label, kind, parent_1, parent_2, spine, spine_fund, spine_fund_next }
  const members = [] // { cohort, ticker, role, status, near_copy_of, why }
  // 1. headings (CO1's sixteen), root first
  for (const [id, h] of Object.entries(proposal.headings)) {
    nodes.push({ cohort: id, label: h.label, kind: 'heading', parent_1: h.parent ?? null, parent_2: null,
      spine: h.why ?? (h.gics ? `GICS: ${h.gics}` : null), spine_fund: null, spine_fund_next: null })
  }
  // 2. CO1's topic cohorts, members and reference funds exactly as proposed
  const homeOf = {}
  const left = []    // retiring names CO1 placed, left out on purpose
  for (const c of proposal.cohorts) {
    if (c.id.startsWith('IDX_')) continue           // the index layer is rebuilt below from the mapped table
    const refs = c.reference_funds ?? []
    nodes.push({ cohort: c.id, label: c.label, kind: 'cohort', parent_1: c.parents[0], parent_2: c.parents[1] ?? null,
      spine: c.spine, spine_fund: refs.find(t => servedSet.has(t)) ?? null, spine_fund_next: null })
    for (const t of c.members) {
      if (RETIRING.includes(t)) { left.push(`${t} (${c.id})`); continue }
      const second = homeOf[t] != null
      members.push({ cohort: c.id, ticker: t, role: 'member', status: servedSet.has(t) ? 'served' : 'not_served', near_copy_of: null,
        why: second ? `also in ${homeOf[t]} (a company may sit in two cohorts)` : `CO1 spine: ${c.spine}`.slice(0, 240) })
      homeOf[t] ??= c.id
    }
    for (const t of refs) {
      members.push({ cohort: c.id, ticker: t, role: 'reference', status: servedSet.has(t) ? 'served' : 'not_served', near_copy_of: null,
        why: 'reference line: the open fund this cohort is measured against' })
    }
  }
  // 3. the index layer, from the mapped table (TR1): only funds we keep, copy-mark or admit — never a SKIP
  const IDX = {
    IDX_US_BROAD: ['US BROAD & SIZE', 'INDEX_LAYER', 'the market itself: S&P 500, Nasdaq-100, Dow, total market, the equal-weight twins, mid and small caps', 'SPY', null],
    IDX_WORLD: ['WORLD & REGIONS', 'INDEX_LAYER', 'the MSCI family adds up: ACWI = URTH (developed) + EEM (emerging); URTH = US + EFA + Canada. VT stands in until ACWI is served', 'VT', 'ACWI'],
    IDX_COUNTRIES: ['COUNTRIES', 'IDX_WORLD', 'single-country MSCI funds: the reference line of each regional cohort', null, null],
    IDX_STYLE: ['GROWTH & VALUE', 'INDEX_LAYER', 'the same large caps split two ways by three index makers; Vanguard (CRSP) served, S&P to be admitted', null, null],
    IDX_FACTOR: ['FACTORS', 'INDEX_LAYER', 'MSCI\'s four (momentum, quality, low volatility, value) plus S&P low-vol and dividends', null, null],
    IDX_SECTOR_FUNDS: ['SECTOR FUNDS', 'INDEX_LAYER', 'the GICS side of the compare toggle — unchanged; the tree sits beside it', null, null],
    IDX_SECTOR_SPDR: ['SPDR SECTORS (the keep)', 'IDX_SECTOR_FUNDS', 'the eleven S&P 500 sector funds the Hub compares against today', null, null],
    IDX_SECTOR_EQUAL_WEIGHT: ['EQUAL-WEIGHT SECTORS', 'IDX_SECTOR_FUNDS', 'Invesco: the same sectors with every name counted the same', null, null],
    IDX_SECTOR_VANGUARD: ['VANGUARD SECTORS (copies)', 'IDX_SECTOR_FUNDS', 'near-copies of the SPDR eleven; kept as second opinions, not as separate lines', null, null],
    IDX_SECTOR_ISHARES: ['iSHARES SECTORS (copies)', 'IDX_SECTOR_FUNDS', 'near-copies of the SPDR eleven, except IYZ (telecom only)', null, null]
  }
  const co1 = Object.fromEntries(proposal.cohorts.map(c => [c.id, c]))
  for (const [id, [label, parent, spine, sf, sfNext]] of Object.entries(IDX)) {
    nodes.push({ cohort: id, label, kind: id === 'IDX_SECTOR_FUNDS' ? 'heading' : 'index', parent_1: parent, parent_2: null, spine,
      spine_fund: sf && servedSet.has(sf) ? sf : null, spine_fund_next: sfNext && !servedSet.has(sfNext) ? sfNext : null })
  }
  for (const f of indexLayer.funds) {
    if (f.verdict === 'SKIP') continue
    members.push({ cohort: f.cohort, ticker: f.ticker, role: 'index_fund',
      status: f.served ? 'served' : 'pending_admission',
      near_copy_of: f.verdict === 'COPY' ? f.vs : null,
      why: `${f.tracks} — ${f.why}${f.corr_6m != null ? ` (moves ${f.corr_6m.toFixed(2)} with ${f.vs} over six months)` : ''}`.slice(0, 240) })
  }
  // CO1's macro and theme-fund sets carry over unchanged
  for (const id of ['IDX_MACRO', 'IDX_THEME_FUNDS']) {
    const c = co1[id]
    nodes.push({ cohort: id, label: c.label, kind: 'index', parent_1: 'INDEX_LAYER', parent_2: null, spine: c.spine, spine_fund: null, spine_fund_next: null })
    for (const t of c.members) members.push({ cohort: id, ticker: t, role: 'index_fund', status: servedSet.has(t) ? 'served' : 'not_served', near_copy_of: null,
      why: id === 'IDX_MACRO' ? 'macro reference line' : 'theme fund: the spine line of the cohort it defines' })
  }
  // a served index fund CO1 placed that the mapped table does not name must not be dropped silently
  const placed = new Set(members.filter(m => m.cohort.startsWith('IDX_')).map(m => m.ticker))
  const dropped = proposal.cohorts.filter(c => c.id.startsWith('IDX_')).flatMap(c => c.members).filter(t => !placed.has(t))
  // regional cohorts take their country fund as the next spine once it is served
  const NEXT = { CANADA: 'EWC', LATAM: 'EWZ', ASIA_PACIFIC: 'EWT' }
  for (const n of nodes) if (NEXT[n.cohort] && !servedSet.has(NEXT[n.cohort])) n.spine_fund_next = NEXT[n.cohort]
  return { nodes, members, dropped, left }
}

export function validate ({ nodes, members, dropped }) {
  const errors = []
  const ids = new Set()
  for (const n of nodes) { if (ids.has(n.cohort)) errors.push(`duplicate cohort ${n.cohort}`); ids.add(n.cohort) }
  const roots = nodes.filter(n => n.parent_1 == null)
  if (roots.length !== 1 || roots[0].cohort !== 'MARKET') errors.push(`exactly one root (MARKET) expected, found ${roots.map(r => r.cohort)}`)
  for (const n of nodes) for (const p of [n.parent_1, n.parent_2]) if (p != null && !ids.has(p)) errors.push(`${n.cohort}: parent ${p} is not a node`)
  for (const n of nodes) {                              // no loops: every node reaches MARKET
    const seen = new Set(); let cur = n
    while (cur && cur.parent_1 != null) { if (seen.has(cur.cohort)) { errors.push(`loop at ${n.cohort}`); break } seen.add(cur.cohort); cur = nodes.find(x => x.cohort === cur.parent_1) }
  }
  const keys = new Set()
  for (const m of members) {
    const k = `${m.cohort}|${m.ticker}`
    if (keys.has(k)) errors.push(`duplicate member ${k}`); keys.add(k)
    if (!ids.has(m.cohort)) errors.push(`member ${k}: cohort is not a node`)
    if (m.status === 'not_served') errors.push(`member ${k}: neither served nor on the admission list`)
  }
  if (dropped.length) errors.push(`index funds CO1 placed that the mapped table lost: ${dropped}`)
  const withMembers = new Set(members.map(m => m.cohort))
  for (const n of nodes) if (n.kind !== 'heading' && !withMembers.has(n.cohort)) errors.push(`${n.cohort}: a cohort with no member`)
  return errors
}

const q = (v) => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`

export function sqlFiles ({ nodes, members }) {
  const pending = members.filter(m => m.status === 'pending_admission').length
  const schema = `-- TR1 (6 Oct 2026) · THE COHORT TREE — schema. GENERATED by scripts/cohort-tree-loader.mjs; do not edit by hand.
-- ADDITIVE (pre-approved class: new tables). Two NEW tables that no Hub or Station page reads. public.ticker_cohorts
-- — the table the Hub's cohort tabs are built from — is not read, written or referenced here.
-- Rollback: 20261006_tr1_cohort_tree_ROLLBACK.sql
create table if not exists public.cohort_tree (
  cohort          text primary key,
  label           text not null,
  kind            text not null check (kind in ('heading','cohort','index')),
  parent_1        text references public.cohort_tree(cohort) deferrable initially deferred,
  parent_2        text references public.cohort_tree(cohort) deferrable initially deferred,
  spine           text,
  spine_fund      text,
  spine_fund_next text,
  source          text not null default '${SOURCE}',
  loaded_at       timestamptz not null default now()
);
comment on table public.cohort_tree is 'TR1 6 Oct 2026: the theme tree beside the GICS sectors. One row per node; up to two parents; spine_fund = the served fund the cohort is measured against; spine_fund_next = the fund that takes over once admitted. Not read by the Hub.';
create table if not exists public.cohort_tree_members (
  cohort       text not null references public.cohort_tree(cohort) on delete cascade deferrable initially deferred,
  ticker       text not null,
  role         text not null check (role in ('member','reference','index_fund')),
  status       text not null check (status in ('served','pending_admission')),
  near_copy_of text,
  why          text,
  source       text not null default '${SOURCE}',
  loaded_at    timestamptz not null default now(),
  primary key (cohort, ticker)
);
comment on table public.cohort_tree_members is 'TR1 6 Oct 2026: who sits in each cohort_tree node and why. role member = a company; reference = the fund a topic cohort is measured against; index_fund = a market aggregate. Not read by the Hub.';
create index if not exists cohort_tree_members_ticker_idx on public.cohort_tree_members (ticker);
alter table public.cohort_tree enable row level security;
alter table public.cohort_tree_members enable row level security;
drop policy if exists cohort_tree_read on public.cohort_tree;
create policy cohort_tree_read on public.cohort_tree for select to anon, authenticated using (true);
drop policy if exists cohort_tree_members_read on public.cohort_tree_members;
create policy cohort_tree_members_read on public.cohort_tree_members for select to anon, authenticated using (true);
grant select on public.cohort_tree, public.cohort_tree_members to anon, authenticated;
grant select, insert, update, delete on public.cohort_tree, public.cohort_tree_members to service_role;
`
  const nodeRows = nodes.map(n => `  (${q(n.cohort)},${q(n.label)},${q(n.kind)},${q(n.parent_1)},${q(n.parent_2)},${q(n.spine)},${q(n.spine_fund)},${q(n.spine_fund_next)})`).join(',\n')
  const memRows = members.map(m => `  (${q(m.cohort)},${q(m.ticker)},${q(m.role)},${q(m.status)},${q(m.near_copy_of)},${q(m.why)})`).join(',\n')
  const load = `-- TR1 (6 Oct 2026) · THE COHORT TREE — load. GENERATED by scripts/cohort-tree-loader.mjs; do not edit by hand.
-- Needs 20261006_tr1_cohort_tree.sql first. Writes ONLY public.cohort_tree and public.cohort_tree_members (both new,
-- read by no page). Idempotent: one transaction empties the two tables and refills them; the proof at the end
-- refuses the whole load unless the counts are the loader's own (${nodes.length} nodes, ${members.length} members, ${pending} pending).
begin;
delete from public.cohort_tree_members;
delete from public.cohort_tree;
insert into public.cohort_tree (cohort,label,kind,parent_1,parent_2,spine,spine_fund,spine_fund_next) values
${nodeRows};
insert into public.cohort_tree_members (cohort,ticker,role,status,near_copy_of,why) values
${memRows};
do $$
declare n int; m int; p int; r int;
begin
  select count(*) into n from public.cohort_tree;
  select count(*) into m from public.cohort_tree_members;
  select count(*) into p from public.cohort_tree_members where status = 'pending_admission';
  select count(*) into r from public.cohort_tree where parent_1 is null;
  if n <> ${nodes.length} then raise exception 'cohort tree: expected ${nodes.length} nodes, found %', n; end if;
  if m <> ${members.length} then raise exception 'cohort tree: expected ${members.length} members, found %', m; end if;
  if p <> ${pending} then raise exception 'cohort tree: expected ${pending} pending members, found %', p; end if;
  if r <> 1 then raise exception 'cohort tree: expected one root, found %', r; end if;
end $$;
commit;
`
  const rollback = `-- TR1 (6 Oct 2026) · THE COHORT TREE — rollback. GENERATED by scripts/cohort-tree-loader.mjs.
-- Drops exactly what 20261006_tr1_cohort_tree.sql creates: two policies, one index, two tables (their rows go with
-- them). Nothing else was created or changed: no other table, no view, no function, no cron, no row elsewhere.
drop policy if exists cohort_tree_members_read on public.cohort_tree_members;
drop policy if exists cohort_tree_read on public.cohort_tree;
drop table if exists public.cohort_tree_members;
drop table if exists public.cohort_tree;
`
  const afterAdmission = `-- TR1 · run ONLY after the ten index funds are admitted and /universe lists them (the universe sitting's last step).
-- Writes only the two TR1 tables: marks the pending funds served and hands the spine to the fund that was waiting.
begin;
update public.cohort_tree_members set status = 'served' where status = 'pending_admission';
update public.cohort_tree set spine_fund = spine_fund_next, spine_fund_next = null where spine_fund_next is not null;
commit;
-- way back:  re-run 20261006_tr1_cohort_tree_LOAD.sql (it restores the loaded state exactly)
`
  return { schema, load, rollback, afterAdmission }
}

async function runInPglite (dir, files) {
  const require = createRequire(join(dir, 'package.json'))
  const { PGlite } = await import(require.resolve('@electric-sql/pglite'))
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated; create role service_role;')
  // a stand-in for the table the Hub reads, to prove the load leaves it alone
  await db.exec("create table public.ticker_cohorts (ticker text, cohort text); insert into public.ticker_cohorts values ('NVDA','AI_HARDWARE'),('SPY','INDEXES');")
  const one = async (sql) => (await db.query(sql)).rows[0]
  const tables = async () => (await db.query("select table_name from information_schema.tables where table_schema='public' order by 1")).rows.map(r => r.table_name)
  const before = { tables: await tables(), ticker_cohorts: (await one('select count(*)::int n, md5(string_agg(ticker||cohort, \',\' order by ticker)) h from public.ticker_cohorts')) }
  await db.exec(files.schema)
  await db.exec(files.load)
  const loaded = {
    tables: await tables(),
    nodes: (await one('select count(*)::int n from public.cohort_tree')).n,
    members: (await one('select count(*)::int n from public.cohort_tree_members')).n,
    pending: (await one("select count(*)::int n from public.cohort_tree_members where status='pending_admission'")).n,
    orphans: (await one('select count(*)::int n from public.cohort_tree t where parent_1 is not null and not exists (select 1 from public.cohort_tree p where p.cohort = t.parent_1)')).n,
    ticker_cohorts: (await one('select count(*)::int n, md5(string_agg(ticker||cohort, \',\' order by ticker)) h from public.ticker_cohorts'))
  }
  await db.exec(files.load)                             // run it twice: idempotent
  const reloaded = { nodes: (await one('select count(*)::int n from public.cohort_tree')).n, members: (await one('select count(*)::int n from public.cohort_tree_members')).n }
  await db.exec(files.afterAdmission)
  const afterAdmission = { pending: (await one("select count(*)::int n from public.cohort_tree_members where status='pending_admission'")).n,
    world_spine: (await one("select spine_fund, spine_fund_next from public.cohort_tree where cohort='IDX_WORLD'")) }
  await db.exec(files.rollback)
  const rolledBack = { tables: await tables(), ticker_cohorts: (await one('select count(*)::int n, md5(string_agg(ticker||cohort, \',\' order by ticker)) h from public.ticker_cohorts')) }
  await db.close()
  return { engine: 'PGlite (Postgres in memory, throw-away; not the live database)', before, loaded, reloaded, afterAdmission, rolledBack,
    ticker_cohorts_untouched: JSON.stringify(before.ticker_cohorts) === JSON.stringify(loaded.ticker_cohorts) && JSON.stringify(before.ticker_cohorts) === JSON.stringify(rolledBack.ticker_cohorts),
    rollback_leaves_nothing: JSON.stringify(before.tables) === JSON.stringify(rolledBack.tables) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const universe = flag('--served') ? JSON.parse(readFileSync(flag('--served'), 'utf8')) : J(`${CO1}/data/universe-20261006.json`)
  const indexLayer = J(`${TR1}/index-layer.json`)
  const tree = buildTree({ proposal: J(`${CO1}/proposal.json`), indexLayer, served: universe.symbols })
  const errors = validate(tree)
  const files = sqlFiles(tree)
  const by = (arr, k) => arr.reduce((o, r) => (o[r[k]] = (o[r[k]] ?? 0) + 1, o), {})
  const plan = {
    dry_run: !WRITE, served_universe: { count: universe.count, digest: universe.universe_sha256 },
    nodes: tree.nodes.length, nodes_by_kind: by(tree.nodes, 'kind'),
    members: tree.members.length, members_by_role: by(tree.members, 'role'), members_by_status: by(tree.members, 'status'),
    distinct_tickers: new Set(tree.members.map(m => m.ticker)).size,
    companies: new Set(tree.members.filter(m => m.role === 'member').map(m => m.ticker)).size,
    pending_admission: [...new Set(tree.members.filter(m => m.status === 'pending_admission').map(m => m.ticker))].sort(),
    left_out_retiring: tree.left,
    near_copies_marked: tree.members.filter(m => m.near_copy_of).length,
    writes_tables: ['public.cohort_tree', 'public.cohort_tree_members'],
    mentions_ticker_cohorts_in_sql: /ticker_cohorts/.test((files.schema + files.load + files.rollback + files.afterAdmission).replace(/^--.*$/gm, '')),
    errors,
    files: [`${MIG}.sql`, `${MIG}_LOAD.sql`, `${MIG}_ROLLBACK.sql`, `${MIG}_AFTER_ADMISSION.sql`], wrote: false
  }
  if (errors.length) { console.log(JSON.stringify(plan, null, 1)); console.error('REFUSED: the tree does not validate'); process.exit(2) }
  if (PGLITE) plan.sql_run = await runInPglite(PGLITE, files)
  if (WRITE) {
    writeFileSync(join(ROOT, `${MIG}.sql`), files.schema)
    writeFileSync(join(ROOT, `${MIG}_LOAD.sql`), files.load)
    writeFileSync(join(ROOT, `${MIG}_ROLLBACK.sql`), files.rollback)
    writeFileSync(join(ROOT, `${MIG}_AFTER_ADMISSION.sql`), files.afterAdmission)
    plan.wrote = true
  }
  console.log(JSON.stringify(plan, null, 1))
}
