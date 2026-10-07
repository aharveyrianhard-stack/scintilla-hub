#!/usr/bin/env node
// TR2 (6 Oct 2026) — THE NEXT FUND BATCH'S TREE ROWS, AS FILES FOR A LATER SITTING. NEVER FOR TONIGHT.
//
//   node scripts/cohort-tree-next-funds-sql.mjs                     # print the plan, write nothing
//   node scripts/cohort-tree-next-funds-sql.mjs --write             # write the three SQL files under supabase/migrations/
//   node scripts/cohort-tree-next-funds-sql.mjs --hold FXY,XAR      # leave out funds held back at the gate (add --write to regenerate)
//   node scripts/cohort-tree-next-funds-sql.mjs --pglite <dir>      # also RUN the files in a throw-away in-memory Postgres
//                                                                   # (<dir> holds node_modules/@electric-sql/pglite); with
//                                                                   # --write the result is saved beside next-funds.json
//
// WHAT IT CARRIES. deliverables/20261006/tree-revision/next-funds.json names 26 funds to admit after TR1's ten
// ("admit_next"). Each gets one row in its index set (IDX_FACTOR, IDX_MACRO, …); ten of them are also the reference
// line of a topic cohort, and seven of those take the cohort's spine over once they are served.
//
// WHY SEPARATE FILES, AND WHY NOT TONIGHT. TR1's after-admission step is BLANKET: every pending row becomes served and
// every waiting spine is handed over. If these 26 were loaded as pending before TR1's ten are marked served, tonight's
// step would mark funds served that nobody admitted. So the PENDING file refuses while any other fund is still
// pending, and this batch's own after-admission step is TARGETED: it names its funds and touches nothing else.
//
// THE GENERATOR NEVER TOUCHES THE DATABASE. It writes SQL; the coordinator applies it at that later sitting:
//   1. …_tr2_next_funds_tree_PENDING.sql           after TR1's AFTER_ADMISSION has run (it checks, and refuses otherwise)
//   2. the provider admits the funds; /universe lists them
//   3. …_tr2_next_funds_tree_AFTER_ADMISSION.sql   marks exactly these funds served, hands exactly these spines over
// Way back: …_tr2_next_funds_tree_ROLLBACK.sql. All three write only public.cohort_tree and public.cohort_tree_members.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqlFiles as tr1SqlFiles } from './cohort-tree-loader.mjs'
import { reviseTree, loadInputs, TR2 } from './cohort-tree-revise.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
export const SOURCE = 'TR2-NEXT-20261006'
export const MIG = 'supabase/migrations/20261006_tr2_next_funds_tree'
export const DRY_RUN = `${TR2}/next-funds-tree-dry-run.json`
export const REF_WHY = 'reference line: the open fund this cohort is measured against'
const TR1_AFTER = '20261006_tr1_cohort_tree_AFTER_ADMISSION.sql'

// The batch: which rows the files write. base = TR1's tree, rev = the revised one; a node must be in both, because the
// files have to work whether or not the revision has been applied when they are run.
export function buildBatch ({ nextFunds, base, rev, served, hold = [] }) {
  const errors = []
  const all = nextFunds.admit_next
  const names = all.map(f => f.ticker)
  const held = [...new Set(hold.map(t => String(t).trim().toUpperCase()).filter(Boolean))]
  for (const t of held) if (!names.includes(t)) errors.push(`--hold ${t}: not one of the batch's ${all.length} funds (a typing slip would hold nothing back)`)
  if (new Set(names).size !== names.length) errors.push('a fund is listed twice in admit_next')
  const B = Object.fromEntries(base.nodes.map(n => [n.cohort, n])); const R = Object.fromEntries(rev.nodes.map(n => [n.cohort, n]))
  const servedSet = new Set(served)
  const inTree = new Set([...base.members, ...rev.members].map(m => m.ticker))
  const spineOf = (f) => ({ cohort: f.spine_for, ticker: f.ticker, was: B[f.spine_for]?.spine_fund ?? null })
  for (const f of all) {                               // held funds are checked too: the files name them to keep them out
    if (!/^[A-Z][A-Z0-9]{0,5}$/.test(f.ticker)) errors.push(`${f.ticker}: not a plain fund symbol`)
    if (servedSet.has(f.ticker)) errors.push(`${f.ticker}: already served`)
    if (inTree.has(f.ticker)) errors.push(`${f.ticker}: already in the tree (TR1's ten or a served fund)`)
    if (!f.tree_node_id) errors.push(`${f.ticker}: no tree_node_id`)
    for (const id of [f.tree_node_id, f.spine_for].filter(Boolean)) {
      if (!B[id]) errors.push(`${f.ticker}: ${id} is not a node in TR1's tree`)
      if (!R[id]) errors.push(`${f.ticker}: ${id} is not a node in the revised tree`)
    }
    if (f.takes_over_spine && !f.spine_for) errors.push(`${f.ticker}: takes a spine over but names no cohort`)
    if (f.spine_for && B[f.spine_for] && R[f.spine_for]) {
      if ((B[f.spine_for].spine_fund ?? null) !== (R[f.spine_for].spine_fund ?? null)) errors.push(`${f.spine_for}: the two trees disagree on today's spine fund`)
      if (B[f.spine_for].spine_fund_next || R[f.spine_for].spine_fund_next) errors.push(`${f.spine_for}: another fund is already waiting for this spine`)
    }
  }
  const funds = all.filter(f => !held.includes(f.ticker))
  if (!funds.length) errors.push('every fund is held back: nothing to write')
  const rows = []
  for (const f of funds) rows.push({ cohort: f.tree_node_id, ticker: f.ticker, role: 'index_fund', status: 'pending_admission', near_copy_of: null, why: String(f.adds ?? '').replace(/^adds:\s*/, '').slice(0, 240), source: SOURCE })
  for (const f of funds) if (f.spine_for) rows.push({ cohort: f.spine_for, ticker: f.ticker, role: 'reference', status: 'pending_admission', near_copy_of: null, why: REF_WHY, source: SOURCE })
  const keys = new Set()
  for (const r of rows) { const k = `${r.cohort}|${r.ticker}`; if (keys.has(k)) errors.push(`duplicate row ${k}`); keys.add(k); if (!r.why) errors.push(`${k}: no reason given`) }
  const spines = funds.filter(f => f.takes_over_spine && f.spine_for).map(spineOf)
  const heldSpines = all.filter(f => held.includes(f.ticker) && f.takes_over_spine && f.spine_for).map(spineOf)
  const taken = [...spines, ...heldSpines].map(s => s.cohort)
  if (new Set(taken).size !== taken.length) errors.push('two funds take over the same cohort\'s spine')
  return { funds, tickers: funds.map(f => f.ticker), held, rows, spines, heldSpines, nodes: [...new Set(rows.map(r => r.cohort))].sort(), errors }
}

const q = (v) => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const list = (a) => a.map(q).join(',')
const pairs = (a) => a.map(s => `(${q(s.cohort)},${q(s.ticker)})`).join(',')
const heldLine = (b) => `-- held: ${b.held.length ? b.held.join(',') : 'none'}`

// Funds held back at the gate are not part of the batch. If an earlier, fuller run of the PENDING file already wrote
// their rows, every file takes those rows out: only this batch's own, and only while they are still pending. A stale
// pending row is what a blanket step would later mark served.
function heldSql (b) {
  if (!b.held.length) return ''
  return `-- HELD BACK AT THE GATE (${b.held.join(', ')}): left out of this batch. Rows an earlier run wrote for them are taken out.
delete from public.cohort_tree_members where ticker in (${list(b.held)}) and status = 'pending_admission' and source = ${q(SOURCE)};
${b.heldSpines.length ? `update public.cohort_tree t set spine_fund_next = null from (values ${pairs(b.heldSpines)}) v(cohort, fund) where t.cohort = v.cohort and t.spine_fund_next = v.fund;\n` : ''}`
}

export function sqlFiles (b) {
  const N = b.tickers.length
  const I = b.rows.filter(r => r.role === 'index_fund').length
  const REFS = b.rows.filter(r => r.role === 'reference').length
  const S = b.spines.length
  const T = list(b.tickers)
  const P = pairs(b.spines)
  const head = (title) => `-- TR2 (6 Oct 2026) · THE NEXT FUND BATCH — tree rows, ${title}. GENERATED by scripts/cohort-tree-next-funds-sql.mjs; do not edit by hand.
-- funds: ${N} · index-set rows: ${I} · reference rows: ${REFS} · spine hand-overs: ${S}
${heldLine(b)}`
  const rowsSql = b.rows.map(r => `  (${q(r.cohort)},${q(r.ticker)},${q(r.role)},${q(r.status)},${q(r.near_copy_of)},${q(r.why)},${q(r.source)})`).join(',\n')
  const spinesWaiting = S ? `(select count(*)::int from public.cohort_tree t where (t.cohort, t.spine_fund_next) in (${P}))` : '0'
  const spinesHanded = S ? `(select count(*)::int from public.cohort_tree t where (t.cohort, t.spine_fund) in (${P}) and t.spine_fund_next is null)` : '0'

  const pending = `${head('PENDING')}
-- NOT FOR TONIGHT. Run it at the sitting that admits this batch, and only AFTER ${TR1_AFTER}
-- has run. That step is blanket (every pending row becomes served): rows loaded here before it would be marked served
-- without anyone admitting the funds. This file checks, and refuses if any other fund is still pending.
-- Writes ONLY public.cohort_tree_members (${N + REFS} rows) and public.cohort_tree.spine_fund_next (${S} cohorts). One transaction;
-- safe to run twice. Every node it writes to is in TR1's tree and in the revised one, so it runs on either.
-- Way back: 20261006_tr2_next_funds_tree_ROLLBACK.sql
begin;
${heldSql(b)}do $$
declare x text;
begin
  select string_agg(distinct ticker, ', ' order by ticker) into x from public.cohort_tree_members
   where status = 'pending_admission' and ticker not in (${T});
  if x is not null then raise exception 'TR2-NEXT refused: other funds are still pending admission (%). Run TR1''s after-admission step first; nothing was changed.', x; end if;
  select string_agg(c, ', ' order by c) into x from unnest(array[${list(b.nodes)}]) c
   where not exists (select 1 from public.cohort_tree t where t.cohort = c);
  if x is not null then raise exception 'TR2-NEXT refused: the tree has no node %; nothing was changed.', x; end if;
  select string_agg(distinct ticker, ', ' order by ticker) into x from public.cohort_tree_members
   where ticker in (${T}) and (status <> 'pending_admission' or source <> ${q(SOURCE)});
  if x is not null then raise exception 'TR2-NEXT refused: already in the tree, served or put there by another load (%); nothing was changed.', x; end if;
${S ? `  select string_agg(t.cohort || ' waits for ' || t.spine_fund_next, ', ' order by t.cohort) into x from public.cohort_tree t
   join (values ${P}) v(cohort, fund) on v.cohort = t.cohort
   where t.spine_fund_next is not null and t.spine_fund_next <> v.fund;
  if x is not null then raise exception 'TR2-NEXT refused: a spine is already promised to another fund (%); nothing was changed.', x; end if;
` : ''}end $$;
insert into public.cohort_tree_members (cohort,ticker,role,status,near_copy_of,why,source) values
${rowsSql}
on conflict (cohort, ticker) do nothing;
${S ? `update public.cohort_tree t set spine_fund_next = v.fund from (values ${P}) v(cohort, fund) where t.cohort = v.cohort and t.spine_fund_next is null;\n` : ''}do $$
declare i int; r int; d int; s int; o int;
begin
  select count(*) filter (where role = 'index_fund'), count(*) filter (where role = 'reference'), count(distinct ticker) into i, r, d
    from public.cohort_tree_members where ticker in (${T}) and status = 'pending_admission' and source = ${q(SOURCE)};
  select count(*) into o from public.cohort_tree_members where status = 'pending_admission' and ticker not in (${T});
  select ${spinesWaiting} into s;
  if i <> ${I} then raise exception 'TR2-NEXT: expected ${I} pending index-set rows, found %', i; end if;
  if r <> ${REFS} then raise exception 'TR2-NEXT: expected ${REFS} pending reference rows, found %', r; end if;
  if d <> ${N} then raise exception 'TR2-NEXT: expected ${N} distinct pending funds, found %', d; end if;
  if s <> ${S} then raise exception 'TR2-NEXT: expected ${S} spines waiting, found %', s; end if;
  if o <> 0 then raise exception 'TR2-NEXT: % pending rows belong to other funds', o; end if;
end $$;
commit;
select 'TR2-NEXT pending' as step, count(*) filter (where role = 'index_fund')::int as index_fund_rows, count(*) filter (where role = 'reference')::int as reference_rows,
  count(distinct ticker)::int as pending_funds, ${spinesWaiting} as spines_waiting
  from public.cohort_tree_members where ticker in (${T}) and status = 'pending_admission';
`

  const afterAdmission = `${head('AFTER ADMISSION')}
-- Run ONLY once these ${N} funds are admitted and /universe lists them. TARGETED, never blanket: it marks served only
-- the funds named here, and hands a spine over only on the ${S} cohorts this batch set and only where the cohort is
-- still waiting for this batch's fund. Writes ONLY public.cohort_tree_members.status and public.cohort_tree's two
-- spine columns. One transaction; refuses unless the PENDING file has run.
-- Way back: the second block of 20261006_tr2_next_funds_tree_ROLLBACK.sql
begin;
${heldSql(b)}do $$
declare n int;
begin
  select count(distinct ticker) into n from public.cohort_tree_members where ticker in (${T}) and role = 'index_fund';
  if n <> ${N} then raise exception 'TR2-NEXT refused: only % of the ${N} funds have a row in the tree. Run the PENDING file first; nothing was changed.', n; end if;
end $$;
update public.cohort_tree_members set status = 'served' where ticker in (${T}) and status = 'pending_admission';
${S ? `update public.cohort_tree t set spine_fund = t.spine_fund_next, spine_fund_next = null from (values ${P}) v(cohort, fund) where t.cohort = v.cohort and t.spine_fund_next = v.fund;\n` : ''}do $$
declare i int; r int; p int; s int;
begin
  select count(*) filter (where role = 'index_fund' and status = 'served'), count(*) filter (where role = 'reference' and status = 'served'),
         count(*) filter (where status = 'pending_admission') into i, r, p
    from public.cohort_tree_members where ticker in (${T});
  select ${spinesHanded} into s;
  if i <> ${I} then raise exception 'TR2-NEXT: expected ${I} served index-set rows, found %', i; end if;
  if r <> ${REFS} then raise exception 'TR2-NEXT: expected ${REFS} served reference rows, found %', r; end if;
  if p <> 0 then raise exception 'TR2-NEXT: % rows of this batch are still pending', p; end if;
  if s <> ${S} then raise exception 'TR2-NEXT: expected ${S} spines handed over, found % (a cohort was no longer waiting for this batch''s fund); nothing was changed.', s; end if;
end $$;
commit;
select 'TR2-NEXT served' as step, count(*) filter (where role = 'index_fund')::int as index_fund_rows, count(*) filter (where role = 'reference')::int as reference_rows,
  count(distinct ticker)::int as served_funds, ${spinesHanded} as spines_handed_over
  from public.cohort_tree_members where ticker in (${T}) and status = 'served';
`

  const allT = list([...b.tickers, ...b.held])
  const allP = pairs([...b.spines, ...b.heldSpines])
  const rollbackReverse = `begin;
update public.cohort_tree_members set status = 'pending_admission' where ticker in (${T}) and status = 'served' and source = ${q(SOURCE)};
${S ? `update public.cohort_tree t set spine_fund = v.was, spine_fund_next = v.fund from (values ${b.spines.map(s => `(${q(s.cohort)},${q(s.ticker)},${q(s.was)}::text)`).join(',')}) v(cohort, fund, was) where t.cohort = v.cohort and t.spine_fund = v.fund and t.spine_fund_next is null;\n` : ''}commit;
`
  const rollback = `${head('ROLLBACK')}
-- BLOCK 1 (this is what runs): takes out this batch's PENDING rows and clears the ${S} waiting spines it set. It REFUSES
-- if any of the funds is already served: then the rows are no longer a plan, and the way back is block 2.
-- Writes ONLY public.cohort_tree_members (delete) and public.cohort_tree.spine_fund_next. One transaction.
begin;
do $$
declare x text;
begin
  select string_agg(distinct ticker, ', ' order by ticker) into x from public.cohort_tree_members where ticker in (${allT}) and status = 'served';
  if x is not null then raise exception 'TR2-NEXT rollback refused: already served (%). To undo an admission, run block 2 of this file on purpose, then this block; nothing was changed.', x; end if;
end $$;
delete from public.cohort_tree_members where ticker in (${allT}) and status = 'pending_admission' and source = ${q(SOURCE)};
${allP ? `update public.cohort_tree t set spine_fund_next = null from (values ${allP}) v(cohort, fund) where t.cohort = v.cohort and t.spine_fund_next = v.fund;\n` : ''}do $$
declare m int; s int;
begin
  select count(*) into m from public.cohort_tree_members where ticker in (${allT});
  select ${allP ? `(select count(*)::int from public.cohort_tree t where (t.cohort, t.spine_fund_next) in (${allP}))` : '0'} into s;
  if m <> 0 then raise exception 'TR2-NEXT rollback: % rows of this batch remain', m; end if;
  if s <> 0 then raise exception 'TR2-NEXT rollback: % spines are still waiting for this batch', s; end if;
end $$;
commit;
select 'TR2-NEXT rolled back' as step, count(*)::int as rows_left from public.cohort_tree_members where ticker in (${allT});

-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- BLOCK 2 — ONLY ON PURPOSE. The reverse of 20261006_tr2_next_funds_tree_AFTER_ADMISSION.sql: the ${N} funds go back
-- to pending and the ${S} spines go back to the fund each cohort had on 6 Oct, with this batch's fund waiting again.
-- It is commented out so that running this file never does it by accident. To use it: copy the lines below without
-- their leading "-- ", run them, then run block 1. (Also the way back if TR1's blanket step was run by mistake while
-- this batch was pending.)
${rollbackReverse.trimEnd().split('\n').map(l => `-- ${l}`).join('\n')}
`
  return { pending, afterAdmission, rollback, rollbackReverse }
}

// ── the dry run: every file RUN in a throw-away in-memory Postgres, never anywhere else ──────────────────────────────
async function dryRun (dir, { nextFunds, base, rev, served, hold, holdTrial }) {
  const require = createRequire(join(dir, 'package.json'))
  const { PGlite } = await import(require.resolve('@electric-sql/pglite'))
  const batch = buildBatch({ nextFunds, base, rev, served, hold })
  const files = sqlFiles(batch)
  const trial = buildBatch({ nextFunds, base, rev, served, hold: [...hold, ...holdTrial] })
  const trialFiles = sqlFiles(trial)
  const open = async (tree, { tr1Admitted }) => {
    const tr1 = tr1SqlFiles(tree)
    const db = new PGlite()
    await db.exec('create role anon; create role authenticated; create role service_role;')
    await db.exec(tr1.schema); await db.exec(tr1.load)
    if (tr1Admitted) await db.exec(tr1.afterAdmission)
    const rowsOf = async (sql) => (await db.query(sql)).rows
    const fp = async () => (await rowsOf(`select (select md5(coalesce(string_agg(t::text, '|' order by t.cohort), '')) from public.cohort_tree t) as cohort_tree,
      (select md5(coalesce(string_agg(m::text, '|' order by m.cohort, m.ticker), '')) from public.cohort_tree_members m) as cohort_tree_members`))[0]
    const state = async () => ({
      ...(await rowsOf("select count(*)::int as member_rows, count(*) filter (where status = 'pending_admission')::int as pending_rows, count(distinct ticker) filter (where status = 'pending_admission')::int as pending_funds from public.cohort_tree_members"))[0],
      batch_rows: await rowsOf(`select role, status, count(*)::int as n, count(distinct ticker)::int as funds from public.cohort_tree_members where source = ${q(SOURCE)} group by 1, 2 order by 1, 2`),
      spines: await rowsOf(`select cohort, spine_fund, spine_fund_next from public.cohort_tree where cohort in (${list(nextFunds.admit_next.filter(f => f.takes_over_spine).map(f => f.spine_for))}) order by 1`),
      tables: (await rowsOf("select table_name from information_schema.tables where table_schema = 'public' order by 1")).map(r => r.table_name)
    })
    const run = async (file, sql) => {
      const before = await fp()
      let accepted = true; let message = null; let proof = null
      try { const res = await db.exec(sql); proof = res.filter(r => r.rows?.length).pop()?.rows[0] ?? null } catch (e) { accepted = false; message = e.message; await db.exec('rollback') }
      const after = await fp()
      return { file, accepted, message, proof, changed: JSON.stringify(before) !== JSON.stringify(after), fingerprint: after }
    }
    return { db, fp, state, run, tr1 }
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const sum = (st, role, status) => st.batch_rows.filter(r => r.role === role && r.status === status).reduce((s, r) => s + r.n, 0)
  const scenarios = []

  // the full round on an admitted tree: pending, pending again, rollback
  const round = async (tree, f, b) => {
    const s = await open(tree, { tr1Admitted: true })
    const fp0 = await s.fp()
    const p1 = await s.run('PENDING', f.pending); const st1 = await s.state()
    const p2 = await s.run('PENDING (again)', f.pending)
    const rb = await s.run('ROLLBACK', f.rollback); const st2 = await s.state()
    await s.db.close()
    const N = b.tickers.length; const REFS = b.rows.length - N
    return { steps: [p1, p2, rb], after_pending: st1, after_rollback: { pending_rows: st2.pending_rows, batch_rows: st2.batch_rows },
      ok: p1.accepted && p1.changed && sum(st1, 'index_fund', 'pending_admission') === N && sum(st1, 'reference', 'pending_admission') === REFS && st1.pending_funds === N &&
        st1.spines.filter(x => x.spine_fund_next).length === b.spines.length && p2.accepted && !p2.changed && rb.accepted && same(rb.fingerprint, fp0) && same(st1.tables, st2.tables) }
  }

  { // 1
    const s = await open(base, { tr1Admitted: false })
    const st0 = await s.state()
    const p = await s.run('PENDING', files.pending)
    await s.db.close()
    scenarios.push({ n: 1, name: 'TR1 loaded, its ten funds still pending (TR1\'s after-admission step has NOT run)', expect: 'PENDING refuses; nothing changes',
      before: { pending_funds: st0.pending_funds }, steps: [p], ok: !p.accepted && !p.changed && /still pending admission/.test(p.message ?? '') })
  }
  { // 2
    const r = await round(base, files, batch)
    scenarios.push({ n: 2, name: 'TR1 loaded and its after-admission step run', expect: `PENDING accepted (${batch.tickers.length} index-set rows, ${batch.rows.length - batch.tickers.length} reference rows, ${batch.spines.length} spines waiting); PENDING again changes nothing; ROLLBACK returns the exact state before`, ...r })
  }
  let servedState = null
  { // 3
    const s = await open(base, { tr1Admitted: true })
    const fp0 = await s.fp()
    const p = await s.run('PENDING', files.pending); const fp1 = await s.fp()
    const a = await s.run('AFTER_ADMISSION', files.afterAdmission); const st = await s.state()
    const a2 = await s.run('AFTER_ADMISSION (again)', files.afterAdmission)
    const rb = await s.run('ROLLBACK', files.rollback)
    const rev2 = await s.run('ROLLBACK block 2 (on purpose)', files.rollbackReverse); const fp2 = await s.fp()
    const rb2 = await s.run('ROLLBACK', files.rollback)
    await s.db.close()
    servedState = { batch_rows: st.batch_rows, spines: st.spines }
    scenarios.push({ n: 3, name: 'PENDING, then this batch\'s own AFTER_ADMISSION', expect: '0 pending; the spines handed over; ROLLBACK refuses; block 2 run on purpose undoes the admission, then ROLLBACK returns the exact state before PENDING',
      steps: [p, a, a2, rb, rev2, rb2], after_admission: st,
      spines_handed_over: batch.spines.map(x => ({ cohort: x.cohort, was: x.was, now: st.spines.find(y => y.cohort === x.cohort)?.spine_fund })),
      ok: p.accepted && a.accepted && st.pending_rows === 0 && sum(st, 'index_fund', 'served') === batch.tickers.length && sum(st, 'reference', 'served') === batch.rows.length - batch.tickers.length &&
        batch.spines.every(x => { const y = st.spines.find(z => z.cohort === x.cohort); return y.spine_fund === x.ticker && y.spine_fund_next == null }) &&
        a2.accepted && !a2.changed && !rb.accepted && !rb.changed && /already served/.test(rb.message ?? '') && rev2.accepted && same(fp2, fp1) && rb2.accepted && same(rb2.fingerprint, fp0) })
  }
  { // 4
    const s = await open(base, { tr1Admitted: true })
    const fp0 = await s.fp()
    const p = await s.run('PENDING', files.pending); const fp1 = await s.fp()
    const blanket = await s.run(`TR1 ${TR1_AFTER} (BY MISTAKE)`, s.tr1.afterAdmission); const st = await s.state()
    const rb = await s.run('ROLLBACK', files.rollback)
    const rev2 = await s.run('ROLLBACK block 2 (on purpose)', files.rollbackReverse); const fp2 = await s.fp()
    const rb2 = await s.run('ROLLBACK', files.rollback)
    await s.db.close()
    const sameAsTargeted = same({ batch_rows: st.batch_rows, spines: st.spines }, servedState)
    scenarios.push({ n: 4, name: 'TR1\'s BLANKET after-admission step run by mistake while this batch is pending', expect: 'it marks every fund of this batch served and hands every spine over, though nobody admitted them (the warning for the runbook); ROLLBACK refuses; block 2 then ROLLBACK is the way back',
      steps: [p, blanket, rb, rev2, rb2], after_mistake: st,
      what_it_does: { rows_marked_served: sum(st, 'index_fund', 'served') + sum(st, 'reference', 'served'), funds_marked_served: batch.tickers.length, spines_handed_over: st.spines.filter(x => batch.spines.some(y => y.cohort === x.cohort && y.ticker === x.spine_fund)).map(x => `${x.cohort} → ${x.spine_fund}`), pending_left: st.pending_rows, same_rows_as_the_targeted_step: sameAsTargeted },
      ok: p.accepted && blanket.accepted && blanket.changed && st.pending_rows === 0 && sum(st, 'index_fund', 'served') === batch.tickers.length && sameAsTargeted && !rb.accepted && !rb.changed && rev2.accepted && same(fp2, fp1) && rb2.accepted && same(rb2.fingerprint, fp0) })
  }
  { // 5
    const r = await round(base, trialFiles, trial)
    // held back AFTER the full batch was already loaded: the regenerated files take the held funds out
    const s = await open(base, { tr1Admitted: true })
    const full = await s.run('PENDING (full batch, before the gate)', files.pending)
    const p = await s.run(`PENDING (regenerated, --hold ${trial.held.join(',')})`, trialFiles.pending); const st1 = await s.state()
    const a = await s.run('AFTER_ADMISSION (regenerated)', trialFiles.afterAdmission); const st2 = await s.state()
    await s.db.close()
    const s2 = await open(base, { tr1Admitted: true })
    const fp0b = await s2.fp()
    const full2 = await s2.run('PENDING (full batch, before the gate)', files.pending)
    const rb = await s2.run('ROLLBACK (regenerated)', trialFiles.rollback)
    await s2.db.close()
    const heldLeft = (st) => st.spines.filter(x => trial.heldSpines.some(y => y.cohort === x.cohort && (x.spine_fund_next === y.ticker || x.spine_fund === y.ticker))).length
    scenarios.push({ n: 5, name: `--hold ${trial.held.join(',')}: ${trial.tickers.length} funds`, expect: `the three files regenerate without the held funds; scenario 2 passes with ${trial.tickers.length}; if the full batch was already pending, the regenerated files take the held funds' rows out`,
      held: trial.held, funds: trial.tickers.length, reference_rows: trial.rows.length - trial.tickers.length, spines: trial.spines.length,
      held_named_only_to_remove: !trial.rows.some(x => trial.held.includes(x.ticker)), ...r,
      held_after_full_load: { steps: [full, p, a], after_regenerated_pending: { pending_funds: st1.pending_funds, batch_rows: st1.batch_rows }, after_admission: { pending_rows: st2.pending_rows, batch_rows: st2.batch_rows } },
      rollback_after_full_load: { steps: [full2, rb], back_to_start: same(rb.fingerprint, fp0b) },
      ok: r.ok && trial.tickers.length === nextFunds.admit_next.length - trial.held.length && full.accepted && p.accepted && st1.pending_funds === trial.tickers.length && a.accepted && st2.pending_rows === 0 &&
        sum(st2, 'index_fund', 'served') === trial.tickers.length && heldLeft(st2) === 0 && full2.accepted && rb.accepted && same(rb.fingerprint, fp0b) && !st2.batch_rows.some(x => x.status === 'pending_admission') })
  }
  { // 6
    const r = await round(rev, files, batch)
    scenarios.push({ n: 6, name: 'the REVISED tree\'s rows (105 nodes) loaded into the same two tables, its ten marked served', expect: 'scenario 2 passes unchanged: the files do not depend on whether the revision has been applied',
      note: 'the revised rows are loaded here by TR1\'s loader from reviseTree(); this lane\'s own revision migration was not run in this dry run', ...r })
  }
  return { what: 'TR2: the next fund batch\'s tree files RUN in a throw-away Postgres. Generated by scripts/cohort-tree-next-funds-sql.mjs --pglite. Nothing here touched a real database.',
    engine: 'PGlite (Postgres in memory, throw-away; not the live database)', fingerprint: 'md5 over every column of every row, one per table (public.cohort_tree, public.cohort_tree_members)',
    source: SOURCE, held: batch.held, funds: batch.tickers.length, hold_trial: trial.held, scenarios, all_ok: scenarios.every(s => s.ok) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2)
  const flag = (n) => { const i = argv.indexOf(n); return i < 0 ? null : argv[i + 1] }
  const WRITE = argv.includes('--write')
  const PGLITE = flag('--pglite')
  const hold = (flag('--hold') ?? '').split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  const nextFunds = J(`${TR2}/next-funds.json`)
  const universe = J('deliverables/20261006/cohort-proposal/data/universe-20261006.json')
  const { base, holdings, consumer } = loadInputs()
  const rev = reviseTree({ base, holdings, consumer })
  const inputs = { nextFunds, base, rev, served: universe.symbols }
  const batch = buildBatch({ ...inputs, hold })
  const files = sqlFiles(batch)
  const byNode = {}
  for (const r of batch.rows) (byNode[r.cohort] ??= []).push(r.role === 'reference' ? `${r.ticker} (reference)` : r.ticker)
  const sql = (files.pending + files.afterAdmission + files.rollback).replace(/^--.*$/gm, '') + files.rollbackReverse
  const plan = {
    dry_run: !WRITE, source: SOURCE, not_for_tonight: `run only after ${TR1_AFTER} has run; the PENDING file refuses otherwise`,
    funds: batch.tickers.length, held: batch.held, tickers: batch.tickers,
    rows: batch.rows.length, rows_by_role: batch.rows.reduce((o, r) => (o[r.role] = (o[r.role] ?? 0) + 1, o), {}), rows_by_node: byNode,
    spine_hand_overs: batch.spines.map(s => `${s.cohort}: ${s.was ?? 'no fund today'} → ${s.ticker}`),
    reference_only: batch.rows.filter(r => r.role === 'reference' && !batch.spines.some(s => s.cohort === r.cohort && s.ticker === r.ticker)).map(r => `${r.cohort}: ${r.ticker} beside today's spine`),
    writes_tables: [...new Set([...sql.matchAll(/public\.([a-z_]+)/g)].map(m => `public.${m[1]}`))].sort(),
    errors: batch.errors,
    files: [`${MIG}_PENDING.sql`, `${MIG}_AFTER_ADMISSION.sql`, `${MIG}_ROLLBACK.sql`], wrote: false
  }
  if (batch.errors.length) { console.log(JSON.stringify(plan, null, 1)); console.error('REFUSED: the batch does not validate'); process.exit(2) }
  if (PGLITE) {
    const holdTrial = (nextFunds.counts?.borderline_volume_in_admit_next ?? []).filter(t => !hold.includes(t))
    const run = await dryRun(PGLITE, { ...inputs, hold, holdTrial })
    plan.sql_run = { all_ok: run.all_ok, scenarios: run.scenarios.map(s => ({ n: s.n, name: s.name, ok: s.ok, steps: s.steps.map(x => `${x.file}: ${x.accepted ? 'accepted' : 'REFUSED'}${x.changed ? '' : ' (nothing changed)'}`) })) }
    if (WRITE) { writeFileSync(join(ROOT, DRY_RUN), JSON.stringify(run, null, 1) + '\n'); plan.sql_run.saved = DRY_RUN }
  }
  if (WRITE) {
    writeFileSync(join(ROOT, `${MIG}_PENDING.sql`), files.pending)
    writeFileSync(join(ROOT, `${MIG}_AFTER_ADMISSION.sql`), files.afterAdmission)
    writeFileSync(join(ROOT, `${MIG}_ROLLBACK.sql`), files.rollback)
    plan.wrote = true
  }
  console.log(JSON.stringify(plan, null, 1))
  if (plan.sql_run && !plan.sql_run.all_ok) { console.error('DRY RUN FAILED: a scenario did not behave as expected'); process.exit(3) }
}
