#!/usr/bin/env node
// TR2 (6 Oct 2026) — THE MIGRATION THAT CARRIES THE REVISED TREE TO THE LIVE TABLES, AND THE WAY BACK.
//
//   node scripts/cohort-tree-revise-sql.mjs                     # print the plan (counts, files); write nothing
//   node scripts/cohort-tree-revise-sql.mjs --write             # write the three SQL files under supabase/migrations/
//   node scripts/cohort-tree-revise-sql.mjs --pglite <dir>      # also RUN every scenario in a throw-away in-memory
//                                                               # Postgres (<dir> holds node_modules/@electric-sql/pglite);
//                                                               # with --write, save the result to
//                                                               # deliverables/20261006/tree-revision/migration-dry-run.json
//
// WHAT IT DOES. TR1 loaded the tree into two tables no page reads (public.cohort_tree, 91 rows;
// public.cohort_tree_members, 771 rows). scripts/cohort-tree-revise.mjs turns that tree into the one Alan asked for
// on 6 Oct (105 nodes, 781 member rows) and says, row by row, what differs (diff{}). This script turns diff{} into
// SQL. Nothing below is typed by hand: every id, every "before" value and every count comes from the two generators.
//
// THIS SCRIPT NEVER TOUCHES THE DATABASE. It writes SQL; the coordinator applies it:
//   supabase db query --linked --project-ref wadinxqplrggagkvrdag -f supabase/migrations/20261006_tr2_tree_revision.sql
// Way back: …/20261006_tr2_tree_revision_ROLLBACK.sql (the exact inverse, row by row; then drops what was added).
//
// THE THREE THINGS THAT MAKE IT SAFE TONIGHT
//   1. TR1's after-admission step (ten funds become "served", four spines are handed over) runs after 00:05 ET —
//      before OR after this migration. So the forward file never writes status or spine_fund_next, never tests them
//      on a row it does not change, and proves the count of pending rows is the same at the end as at entry.
//   2. Member rows are MOVED (their cohort is updated), never deleted and re-made: status, why and loaded_at survive.
//   3. Once TR2 is applied, TR1's LOAD file (it empties cohort_tree) and TR1's ROLLBACK (it drops it) would silently
//      undo the revision. Three foreign keys on the new fund-links table make them fail loudly instead; the keys are
//      named so the error says what to do (…_tr2_roll_back_tr2_first). Because TR1's "way back" from its
//      after-admission step was "re-run the LOAD file", a third file gives the targeted way back.
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reviseTree, diffTrees, validateRevision, loadInputs, TR2, TR2_COLS, SOURCE } from './cohort-tree-revise.mjs'
import { sqlFiles as tr1SqlFiles } from './cohort-tree-loader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MIG = 'supabase/migrations/20261006_tr2_tree_revision'
export const FILES = { forward: `${MIG}.sql`, rollback: `${MIG}_ROLLBACK.sql`, undoAfterAdmission: `${MIG}_UNDO_TR1_AFTER_ADMISSION.sql` }
export const DRY_RUN = `${TR2}/migration-dry-run.json`
const TR1_SOURCE = 'TR1-20261006'
const TR1_COLS = ['label', 'kind', 'parent_1', 'parent_2', 'spine', 'spine_fund', 'spine_fund_next']
// the three foreign keys that close TR1's LOAD and TR1's ROLLBACK once TR2 is applied (each under Postgres's 63 letters)
export const GUARD_KEYS = {
  cohort: 'cohort_tree_fund_links_cohort_fkey_tr2_roll_back_tr2_first',
  fund_node: 'cohort_tree_fund_links_fund_node_fkey_tr2_roll_back_tr2_first',
  member: 'cohort_tree_fund_links_member_fkey_tr2_roll_back_tr2_first'
}

const q = (v) => v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`
const lit = (v, type) => v == null ? 'null' : type === 'text' ? q(v) : String(v)
// a VALUES list; the first row carries the casts so Postgres knows each column's type even where a cell is null
const values = (rows, types) => rows.map((r, i) => '    (' + r.map((v, j) => lit(v, types[j]) + (i === 0 ? `::${types[j]}` : '')).join(',') + ')').join(',\n')
const inList = (ids) => ids.map(q).join(',')

export function sqlFiles ({ base, rev, diff }) {
  const B = Object.fromEntries(base.nodes.map(n => [n.cohort, n]))
  const count = (arr, f) => arr.filter(f).length
  const added = diff.nodes_added; const removed = diff.nodes_removed; const changed = diff.nodes_changed
  const moves = diff.member_moves; const adds = diff.member_adds
  const pendingRows = base.members.filter(m => m.status === 'pending_admission')      // TR1's ten funds
  const handovers = base.nodes.filter(n => n.spine_fund_next != null)                 // TR1's four spine hand-overs
  const picks = { on: count(rev.nodes, n => n.hub_pick === 'on'), off: count(rev.nodes, n => n.hub_pick === 'off'), undecided: count(rev.nodes, n => n.hub_pick === 'undecided') }

  // ── refusals at generation time: the SQL below is only right if these hold ────────────────────────────────────
  const stop = (msg) => { throw new Error(`cohort-tree-revise-sql: ${msg}`) }
  const touched = [...changed.map(c => c.cohort), ...removed.map(n => n.cohort)]
  for (const id of touched) if (B[id].spine_fund_next != null) stop(`${id} is a row TR1's after-admission step changes; the revision may not touch it`)
  for (const c of changed) if ('spine_fund_next' in c.after) stop(`${c.cohort}: the revision would write spine_fund_next`)
  for (const n of added) if (n.spine_fund_next != null) stop(`${n.cohort}: a new node may not carry spine_fund_next`)
  for (const m of adds) if (m.status !== 'served') stop(`${m.cohort}|${m.ticker}: a new member row must be served`)
  if (diff.member_removed.length) stop('the revision loses member rows')
  const pendingKeys = new Set(pendingRows.map(m => `${m.cohort}|${m.ticker}`))
  for (const m of moves) if (pendingKeys.has(`${m.from}|${m.ticker}`)) stop(`${m.ticker}: a pending row would be moved`)
  const memberKeys = new Set(rev.members.map(m => `${m.cohort}|${m.ticker}`))
  for (const l of rev.links) if (!memberKeys.has(`${l.fund_node}|${l.fund}`)) stop(`link ${l.fund}: the fund is not a member row of ${l.fund_node}`)

  // "before" = what TR1 loaded, all seven TR1 columns of every node the revision changes or removes. None of these
  // rows is one TR1's after-admission step changes (refused above), so the test is right before and after that step.
  const beforeRows = touched.flatMap(id => TR1_COLS.map(c => [id, c, B[id][c] ?? null]))
  const afterRows = changed.flatMap(c => Object.entries(c.after).map(([col, v]) => [c.cohort, col, v]))
  const T3 = ['text', 'text', 'text']
  const setList = (o) => Object.entries(o).map(([c, v]) => `${c} = ${q(v)}`).join(', ')
  const moveRows = (dir) => values(moves.map(m => dir === 'fwd' ? [m.ticker, m.role, m.from, m.to] : [m.ticker, m.role, m.to, m.from]), ['text', 'text', 'text', 'text'])
  const addedIds = inList(added.map(n => n.cohort)); const removedIds = inList(removed.map(n => n.cohort))

  const forward = `-- TR2 (6 Oct 2026) · THE TREE REVISED ON ALAN'S NOTES — forward. GENERATED by scripts/cohort-tree-revise-sql.mjs
-- from scripts/cohort-tree-revise.mjs; do not edit by hand.
-- WHAT IT DOES, IN WORDS: FRONTIER goes (its four cohorts hang from what the companies make); the index layer sits
-- between THE MARKET and everything else; eleven sector nodes take the 44 sector funds from TR1's four by-family
-- sets; CONSUMER STAPLES becomes a sub-heading with seven cohorts; Alan's on-Hub picks are recorded per node.
--   ${base.nodes.length} nodes → ${rev.nodes.length}  (+${added.length} new, −${removed.length} removed, ${changed.length} changed)      ${base.members.length} member rows → ${rev.members.length}  (${moves.length} moved, +${adds.length} new, none lost)
--   ${rev.links.length} fund-to-cohort links and ${rev.candidates.length} candidate names go to two NEW tables.
-- WRITES ONLY: public.cohort_tree, public.cohort_tree_members (TR1's two; no page reads them) and three new tables.
-- The table the Hub's cohort tabs are built from is not read, written or named. No page reads hub_pick.
-- ONE TRANSACTION. Safe to run twice (the second run says "already applied" and changes nothing). REFUSES, changing
-- nothing, unless the two tables are as TR1 left them where the revision touches them.
-- RIGHT WHETHER TR1'S AFTER-ADMISSION STEP HAS RUN OR NOT: it never writes status or spine_fund_next, and proves
-- the number of pending rows is the same at the end as at entry.
-- ONCE THIS IS APPLIED, TR1's LOAD and TR1's ROLLBACK files are closed on purpose (they would undo the revision):
-- three foreign keys named …_tr2_roll_back_tr2_first stop them. The way back is 20261006_tr2_tree_revision_ROLLBACK.sql.
begin;

-- ── 1. schema: additive only ──────────────────────────────────────────────────────────────────────────────────────
alter table public.cohort_tree add column if not exists layer smallint;
alter table public.cohort_tree add column if not exists parent_why text;
alter table public.cohort_tree add column if not exists hub_pick text default 'undecided';
alter table public.cohort_tree add column if not exists hub_pick_source text;
alter table public.cohort_tree add column if not exists hub_pick_note text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cohort_tree_hub_pick_check' and conrelid = 'public.cohort_tree'::regclass) then
    alter table public.cohort_tree add constraint cohort_tree_hub_pick_check check (hub_pick in ('on','off','undecided'));
  end if;
end $$;
create table if not exists public.cohort_tree_fund_links (
  fund            text not null,
  fund_node       text not null,
  family          text not null check (family in ('SPDR','VANGUARD','BROAD')),
  cohort          text not null,
  fund_weight_pct numeric(7,3) not null,
  names_held      int not null,
  node_names      int not null,
  top_names       text,
  source          text not null default '${SOURCE}',
  loaded_at       timestamptz not null default now(),
  primary key (fund, cohort),
  -- NOT cascading and not deferrable, on purpose: emptying or dropping TR1's tables must fail while TR2 is applied
  constraint ${GUARD_KEYS.cohort} foreign key (cohort) references public.cohort_tree(cohort),
  constraint ${GUARD_KEYS.fund_node} foreign key (fund_node) references public.cohort_tree(cohort),
  constraint ${GUARD_KEYS.member} foreign key (fund_node, fund) references public.cohort_tree_members(cohort, ticker)
);
comment on table public.cohort_tree_fund_links is 'TR2 6 Oct 2026: the cross-relationships. One row per (fund, heading or cohort): how much of the fund, by weight, is in that node''s companies, how many of them it holds, and its three biggest. Measured from the funds'' own holdings. Its foreign keys are named …_tr2_roll_back_tr2_first on purpose: they stop TR1''s LOAD and ROLLBACK files from undoing the revision. Not read by the Hub.';
create table if not exists public.cohort_tree_candidates (
  cohort           text not null references public.cohort_tree(cohort),
  ticker           text not null,
  in_sp500         boolean not null,
  sp500_weight_pct numeric(7,3),
  basis            text,
  gap              text,
  source           text not null default '${SOURCE}',
  loaded_at        timestamptz not null default now(),
  primary key (cohort, ticker)
);
comment on table public.cohort_tree_candidates is 'TR2 6 Oct 2026: names that would fill a gap in a cohort and are NOT served. A record of what is missing; never members, never drawn. Not read by the Hub.';
create table if not exists public.cohort_tree_tr2_removed (
  cohort          text primary key,
  label           text not null,
  kind            text not null,
  parent_1        text,
  parent_2        text,
  spine           text,
  spine_fund      text,
  spine_fund_next text,
  source          text not null,
  loaded_at       timestamptz not null,
  stashed_at      timestamptz not null default now()
);
comment on table public.cohort_tree_tr2_removed is 'TR2 6 Oct 2026: the ${removed.length} cohort_tree rows the revision removed, kept whole (with their original source and loaded_at) so the rollback can put them back exactly. Not read by the Hub.';
alter table public.cohort_tree_fund_links enable row level security;
alter table public.cohort_tree_candidates enable row level security;
alter table public.cohort_tree_tr2_removed enable row level security;
drop policy if exists cohort_tree_fund_links_read on public.cohort_tree_fund_links;
create policy cohort_tree_fund_links_read on public.cohort_tree_fund_links for select to anon, authenticated using (true);
drop policy if exists cohort_tree_candidates_read on public.cohort_tree_candidates;
create policy cohort_tree_candidates_read on public.cohort_tree_candidates for select to anon, authenticated using (true);
grant select on public.cohort_tree_fund_links, public.cohort_tree_candidates to anon, authenticated;
grant select, insert, update, delete on public.cohort_tree_fund_links, public.cohort_tree_candidates to service_role;
-- the stash is not for reading: row level security on, no policy, nothing granted to the two public roles
revoke all on public.cohort_tree_tr2_removed from anon, authenticated;
grant select, insert, update, delete on public.cohort_tree_tr2_removed to service_role;

-- ── 2. data: one block; any refusal undoes the whole file, the schema above included ──────────────────────────────
do $$
declare
  k int; n int; m int; pending_at_entry int; drift text;
begin
  -- already applied → say so and change nothing
  if exists (select 1 from public.cohort_tree where cohort = 'SECTOR_XLK') then
    raise notice 'TR2: the revision is already applied (the row SECTOR_XLK exists). Nothing changed.';
    return;
  end if;

  -- REFUSE unless the tables are as TR1 left them where it matters
  select count(*) into n from public.cohort_tree;
  select count(*) into m from public.cohort_tree_members;
  if n <> ${base.nodes.length} or m <> ${base.members.length} then
    raise exception 'TR2 refused, nothing changed: expected TR1''s ${base.nodes.length} nodes and ${base.members.length} member rows, found % and %', n, m;
  end if;
  -- every node the revision changes or removes still holds what TR1 loaded (status and the spine hand-overs are not
  -- tested: TR1's after-admission step changes those, and none of these rows is one it touches)
  select string_agg(format('%s.%s is %s (TR1 loaded %s)', b.cohort, b.col, coalesce(quote_literal(to_jsonb(t) ->> b.col), 'null'), coalesce(quote_literal(b.val), 'null')), '; ') into drift
  from (values
${values(beforeRows, T3)}
  ) as b(cohort, col, val)
  left join public.cohort_tree t on t.cohort = b.cohort
  where t.cohort is null or (to_jsonb(t) ->> b.col) is distinct from b.val;
  if drift is not null then
    raise exception 'TR2 refused, nothing changed: a row the revision touches is not as TR1 left it — %', drift;
  end if;
  select count(*) into k from public.cohort_tree where cohort in (${addedIds});
  if k <> 0 then raise exception 'TR2 refused, nothing changed: % of the ${added.length} new node names are already taken', k; end if;
  select count(*) into k from public.cohort_tree_members x join (values
${moveRows('fwd')}
  ) as v(ticker, role, from_cohort, to_cohort) on x.cohort = v.from_cohort and x.ticker = v.ticker and x.role = v.role;
  if k <> ${moves.length} then raise exception 'TR2 refused, nothing changed: expected the ${moves.length} member rows to move where TR1 put them, found %', k; end if;
  if exists (select 1 from public.cohort_tree_tr2_removed) or exists (select 1 from public.cohort_tree_fund_links) or exists (select 1 from public.cohort_tree_candidates) then
    raise exception 'TR2 refused, nothing changed: one of the three new tables already holds rows';
  end if;
  select count(*) into pending_at_entry from public.cohort_tree_members where status = 'pending_admission';

  -- stash the ${removed.length} rows that go, whole, so the rollback can put them back exactly
  insert into public.cohort_tree_tr2_removed (cohort,label,kind,parent_1,parent_2,spine,spine_fund,spine_fund_next,source,loaded_at)
  select cohort,label,kind,parent_1,parent_2,spine,spine_fund,spine_fund_next,source,loaded_at from public.cohort_tree where cohort in (${removedIds});
  get diagnostics k = row_count;
  if k <> ${removed.length} then raise exception 'TR2: expected to stash ${removed.length} rows, stashed %', k; end if;

  -- the ${added.length} new nodes
  insert into public.cohort_tree (cohort,label,kind,parent_1,parent_2,spine,spine_fund,source) values
${added.map(x => `    (${q(x.cohort)},${q(x.label)},${q(x.kind)},${q(x.parent_1)},${q(x.parent_2)},${q(x.spine)},${q(x.spine_fund)},${q(SOURCE)})`).join(',\n')};

  -- the ${changed.length} changed nodes: only the columns that change
${changed.map(c => `  update public.cohort_tree set ${setList(c.after)} where cohort = ${q(c.cohort)};`).join('\n')}
  select count(*) into k from (values
${values(afterRows, T3)}
  ) as a(cohort, col, val) join public.cohort_tree t on t.cohort = a.cohort where (to_jsonb(t) ->> a.col) is not distinct from a.val;
  if k <> ${afterRows.length} then raise exception 'TR2: expected ${afterRows.length} changed values on ${changed.length} nodes, found %', k; end if;

  -- the ${moves.length} member rows that move: the cohort is updated, the row stays (status, why, loaded_at survive)
  update public.cohort_tree_members x set cohort = v.to_cohort
  from (values
${moveRows('fwd')}
  ) as v(ticker, role, from_cohort, to_cohort)
  where x.cohort = v.from_cohort and x.ticker = v.ticker and x.role = v.role;
  get diagnostics k = row_count;
  if k <> ${moves.length} then raise exception 'TR2: expected to move ${moves.length} member rows, moved %', k; end if;

  -- the ${adds.length} new member rows (all served today)
  insert into public.cohort_tree_members (cohort,ticker,role,status,near_copy_of,why,source) values
${adds.map(x => `    (${q(x.cohort)},${q(x.ticker)},${q(x.role)},${q(x.status)},${q(x.near_copy_of)},${q(x.why)},${q(SOURCE)})`).join(',\n')};

  -- the ${removed.length} removed nodes go only when nothing points at them (member rows would be deleted with them otherwise)
  select count(*) into k from public.cohort_tree_members where cohort in (${removedIds});
  if k <> 0 then raise exception 'TR2: % member rows still sit in a node that is to be removed', k; end if;
  select count(*) into k from public.cohort_tree where (parent_1 in (${removedIds}) or parent_2 in (${removedIds})) and cohort not in (${removedIds});
  if k <> 0 then raise exception 'TR2: % nodes still hang from a node that is to be removed', k; end if;
  delete from public.cohort_tree where cohort in (${removedIds});
  get diagnostics k = row_count;
  if k <> ${removed.length} then raise exception 'TR2: expected to remove ${removed.length} nodes, removed %', k; end if;

  -- layer, why-this-parent and Alan's pick, on all ${rev.nodes.length} nodes, from one list
  update public.cohort_tree t set layer = v.layer, parent_why = v.parent_why, hub_pick = v.hub_pick, hub_pick_source = v.hub_pick_source, hub_pick_note = v.hub_pick_note
  from (values
${values(rev.nodes.map(x => [x.cohort, x.layer, x.parent_why, x.hub_pick, x.hub_pick_source, x.hub_pick_note]), ['text', 'smallint', 'text', 'text', 'text', 'text'])}
  ) as v(cohort, layer, parent_why, hub_pick, hub_pick_source, hub_pick_note)
  where t.cohort = v.cohort;
  get diagnostics k = row_count;
  if k <> ${rev.nodes.length} then raise exception 'TR2: expected to mark ${rev.nodes.length} nodes, marked %', k; end if;

  -- the ${rev.links.length} fund-to-cohort links
  insert into public.cohort_tree_fund_links (fund,fund_node,family,cohort,fund_weight_pct,names_held,node_names,top_names) values
${rev.links.map(l => `    (${q(l.fund)},${q(l.fund_node)},${q(l.family)},${q(l.cohort)},${l.fund_weight_pct},${l.names_held},${l.node_names},${q(l.top_names)})`).join(',\n')};

  -- the ${rev.candidates.length} candidates (not served, never members)
  insert into public.cohort_tree_candidates (cohort,ticker,in_sp500,sp500_weight_pct,basis,gap) values
${rev.candidates.map(c => `    (${q(c.cohort)},${q(c.ticker)},${c.in_sp500 ? 'true' : 'false'},${c.sp500_weight_pct ?? 'null'},${q(c.basis)},${q(c.gap)})`).join(',\n')};

  -- PROOF. Anything else and the whole transaction is refused.
  set constraints all immediate;   -- the parent and member keys TR1 left "checked at commit" are checked here
  select count(*) into n from public.cohort_tree;
  if n <> ${rev.nodes.length} then raise exception 'TR2 proof: expected ${rev.nodes.length} nodes, found %', n; end if;
  select count(*) into m from public.cohort_tree_members;
  if m <> ${rev.members.length} then raise exception 'TR2 proof: expected ${rev.members.length} member rows, found %', m; end if;
  select count(*) into k from public.cohort_tree where parent_1 is null;
  if k <> 1 then raise exception 'TR2 proof: expected one root, found %', k; end if;
  select count(*) into k from public.cohort_tree t where (t.parent_1 is not null and not exists (select 1 from public.cohort_tree p where p.cohort = t.parent_1)) or (t.parent_2 is not null and not exists (select 1 from public.cohort_tree p where p.cohort = t.parent_2));
  if k <> 0 then raise exception 'TR2 proof: % nodes name a parent that is not a node', k; end if;
  select count(*) into k from public.cohort_tree t where t.kind <> 'heading' and not exists (select 1 from public.cohort_tree_members x where x.cohort = t.cohort);
  if k <> 0 then raise exception 'TR2 proof: % cohorts have no member', k; end if;
  if exists (select 1 from public.cohort_tree where cohort = 'FRONTIER') then raise exception 'TR2 proof: FRONTIER is still a node'; end if;
  select count(*) into k from public.cohort_tree where layer >= 3 and (parent_1 = 'MARKET' or parent_2 = 'MARKET');
  if k <> 0 then raise exception 'TR2 proof: % nodes on layer 3 or deeper hang from THE MARKET, not through the index layer', k; end if;
  select count(*) into k from public.cohort_tree where layer is null;
  if k <> 0 then raise exception 'TR2 proof: % nodes have no layer', k; end if;
  select count(*) into k from public.cohort_tree where hub_pick = 'on';
  if k <> ${picks.on} then raise exception 'TR2 proof: expected ${picks.on} nodes picked on, found %', k; end if;
  select count(*) into k from public.cohort_tree where hub_pick = 'off';
  if k <> ${picks.off} then raise exception 'TR2 proof: expected ${picks.off} nodes picked off, found %', k; end if;
  select count(*) into k from public.cohort_tree where hub_pick = 'undecided';
  if k <> ${picks.undecided} then raise exception 'TR2 proof: expected ${picks.undecided} nodes undecided, found %', k; end if;
  select count(*) into k from public.cohort_tree_fund_links;
  if k <> ${rev.links.length} then raise exception 'TR2 proof: expected ${rev.links.length} links, found %', k; end if;
  select count(*) into k from public.cohort_tree_candidates;
  if k <> ${rev.candidates.length} then raise exception 'TR2 proof: expected ${rev.candidates.length} candidates, found %', k; end if;
  select count(*) into k from public.cohort_tree_members where status = 'pending_admission';
  if k <> pending_at_entry then raise exception 'TR2 proof: % rows were pending at entry, % are now', pending_at_entry, k; end if;
end $$;
commit;
`

  const rollback = `-- TR2 (6 Oct 2026) · THE TREE REVISED ON ALAN'S NOTES — rollback. GENERATED by scripts/cohort-tree-revise-sql.mjs;
-- do not edit by hand.
-- The exact inverse of 20261006_tr2_tree_revision.sql, row by row: the ${adds.length} added member rows go, the ${moves.length} moved rows
-- go back, the ${removed.length} removed nodes return from the stash with their original source and loaded_at, the ${changed.length} changed
-- nodes get TR1's values back, the ${added.length} added nodes go. Then it drops what the forward file created: three tables,
-- one check, five columns. ONE TRANSACTION. Not applied → it says so and does nothing; safe to run twice.
-- It leaves status, spine_fund and spine_fund_next of every row the revision did not change exactly as it finds
-- them: if TR1's after-admission step has run, the result is TR1's tree after that step.
-- Every step counts its rows and refuses the whole rollback (changing nothing) if the count is not the generator's.
begin;
do $$
declare
  k int; n int; m int; pending_at_entry int; drift text;
begin
  if not exists (select 1 from public.cohort_tree where cohort = 'SECTOR_XLK') then
    raise notice 'TR2 rollback: the revision is not applied (no row SECTOR_XLK). Nothing changed.';
    return;
  end if;
  select count(*) into pending_at_entry from public.cohort_tree_members where status = 'pending_admission';

  -- the links and candidates go first: they hold the foreign keys that pin the revised rows
  delete from public.cohort_tree_fund_links;
  get diagnostics k = row_count;
  if k <> ${rev.links.length} then raise exception 'TR2 rollback refused, nothing changed: expected ${rev.links.length} links, found %', k; end if;
  delete from public.cohort_tree_candidates;
  get diagnostics k = row_count;
  if k <> ${rev.candidates.length} then raise exception 'TR2 rollback refused, nothing changed: expected ${rev.candidates.length} candidates, found %', k; end if;

  -- the ${adds.length} member rows the revision added
  delete from public.cohort_tree_members x using (values
${values(adds.map(x => [x.cohort, x.ticker]), ['text', 'text'])}
  ) as v(cohort, ticker) where x.cohort = v.cohort and x.ticker = v.ticker and x.source = ${q(SOURCE)};
  get diagnostics k = row_count;
  if k <> ${adds.length} then raise exception 'TR2 rollback refused, nothing changed: expected to take out ${adds.length} added member rows, found %', k; end if;

  -- the ${removed.length} removed nodes come back from the stash, with the source and loaded_at they had
  insert into public.cohort_tree (cohort,label,kind,parent_1,parent_2,spine,spine_fund,spine_fund_next,source,loaded_at)
  select cohort,label,kind,parent_1,parent_2,spine,spine_fund,spine_fund_next,source,loaded_at from public.cohort_tree_tr2_removed where cohort in (${removedIds});
  get diagnostics k = row_count;
  if k <> ${removed.length} then raise exception 'TR2 rollback refused, nothing changed: expected ${removed.length} rows in the stash, found %', k; end if;

  -- the ${moves.length} moved member rows go back where TR1 put them
  update public.cohort_tree_members x set cohort = v.to_cohort
  from (values
${moveRows('back')}
  ) as v(ticker, role, from_cohort, to_cohort)
  where x.cohort = v.from_cohort and x.ticker = v.ticker and x.role = v.role;
  get diagnostics k = row_count;
  if k <> ${moves.length} then raise exception 'TR2 rollback refused, nothing changed: expected to move ${moves.length} member rows back, moved %', k; end if;

  -- the ${changed.length} changed nodes: TR1's values back, only in the columns the revision changed
${changed.map(c => `  update public.cohort_tree set ${setList(c.before)} where cohort = ${q(c.cohort)};`).join('\n')}

  -- the ${added.length} added nodes go only when nothing is left in them or hanging from them
  select count(*) into k from public.cohort_tree_members where cohort in (${addedIds});
  if k <> 0 then raise exception 'TR2 rollback refused, nothing changed: % member rows still sit in a node the revision added', k; end if;
  select count(*) into k from public.cohort_tree where (parent_1 in (${addedIds}) or parent_2 in (${addedIds})) and cohort not in (${addedIds});
  if k <> 0 then raise exception 'TR2 rollback refused, nothing changed: % nodes still hang from a node the revision added', k; end if;
  delete from public.cohort_tree where cohort in (${addedIds});
  get diagnostics k = row_count;
  if k <> ${added.length} then raise exception 'TR2 rollback refused, nothing changed: expected to remove ${added.length} added nodes, removed %', k; end if;

  -- PROOF
  set constraints all immediate;   -- the parent and member keys are checked here, not at commit
  select count(*) into n from public.cohort_tree;
  select count(*) into m from public.cohort_tree_members;
  if n <> ${base.nodes.length} or m <> ${base.members.length} then raise exception 'TR2 rollback proof: expected ${base.nodes.length} nodes and ${base.members.length} member rows, found % and %', n, m; end if;
  if not exists (select 1 from public.cohort_tree where cohort = 'FRONTIER') then raise exception 'TR2 rollback proof: FRONTIER is not back'; end if;
  select count(*) into k from public.cohort_tree where parent_1 is null;
  if k <> 1 then raise exception 'TR2 rollback proof: expected one root, found %', k; end if;
  select string_agg(format('%s.%s is %s (TR1 loaded %s)', b.cohort, b.col, coalesce(quote_literal(to_jsonb(t) ->> b.col), 'null'), coalesce(quote_literal(b.val), 'null')), '; ') into drift
  from (values
${values(beforeRows, T3)}
  ) as b(cohort, col, val)
  left join public.cohort_tree t on t.cohort = b.cohort
  where t.cohort is null or (to_jsonb(t) ->> b.col) is distinct from b.val;
  if drift is not null then raise exception 'TR2 rollback proof: a row is not back to what TR1 loaded — %', drift; end if;
  select count(*) into k from public.cohort_tree where source = ${q(SOURCE)};
  select count(*) into n from public.cohort_tree_members where source = ${q(SOURCE)};
  if k <> 0 or n <> 0 then raise exception 'TR2 rollback proof: % nodes and % member rows written by TR2 are still there', k, n; end if;
  select count(*) into k from public.cohort_tree_members where status = 'pending_admission';
  if k <> pending_at_entry then raise exception 'TR2 rollback proof: % rows were pending at entry, % are now', pending_at_entry, k; end if;

  -- drop what the forward file created, and nothing else
  drop table public.cohort_tree_fund_links;
  drop table public.cohort_tree_candidates;
  drop table public.cohort_tree_tr2_removed;
  alter table public.cohort_tree drop constraint if exists cohort_tree_hub_pick_check;
  alter table public.cohort_tree drop column if exists layer, drop column if exists parent_why, drop column if exists hub_pick, drop column if exists hub_pick_source, drop column if exists hub_pick_note;
end $$;
commit;
`

  const undoAfterAdmission = `-- TR2 (6 Oct 2026) · THE WAY BACK FROM TR1'S AFTER-ADMISSION STEP. GENERATED by scripts/cohort-tree-revise-sql.mjs
-- from TR1's own tree (scripts/cohort-tree-loader.mjs, buildTree); do not edit by hand.
-- WHY THIS FILE EXISTS. 20261006_tr1_cohort_tree_AFTER_ADMISSION.sql says its way back is "re-run the LOAD file".
-- Once TR2 is applied that way is closed on purpose (the LOAD file empties cohort_tree and would undo the revision).
-- This is the targeted way back, and it is right with or without TR2 applied: it marks TR1's ${pendingRows.length} funds
-- pending_admission again and puts the ${handovers.length} spine hand-overs (${handovers.map(n => n.cohort).join(', ')}) back as TR1 loaded
-- them. It writes nothing else. ONE TRANSACTION; safe to run twice; refuses if a spine is neither as TR1 loaded it
-- nor as TR1's after-admission step left it.
begin;
do $$
declare
  k int; odd text;
begin
  select string_agg(format('%s (spine_fund %s, spine_fund_next %s)', t.cohort, coalesce(t.spine_fund, 'null'), coalesce(t.spine_fund_next, 'null')), '; ') into odd
  from (values
${values(handovers.map(n => [n.cohort, n.spine_fund, n.spine_fund_next]), T3)}
  ) as v(cohort, spine_fund, spine_fund_next)
  join public.cohort_tree t on t.cohort = v.cohort
  where not ((t.spine_fund is not distinct from v.spine_fund and t.spine_fund_next is not distinct from v.spine_fund_next)
          or (t.spine_fund is not distinct from v.spine_fund_next and t.spine_fund_next is null));
  if odd is not null then raise exception 'undo of TR1''s after-admission step refused, nothing changed: a spine is in neither of TR1''s two states — %', odd; end if;

  update public.cohort_tree_members x set status = 'pending_admission'
  from (values
${values(pendingRows.map(m => [m.cohort, m.ticker]), ['text', 'text'])}
  ) as v(cohort, ticker)
  where x.cohort = v.cohort and x.ticker = v.ticker and x.role = 'index_fund';
  get diagnostics k = row_count;
  if k <> ${pendingRows.length} then raise exception 'undo of TR1''s after-admission step refused, nothing changed: expected TR1''s ${pendingRows.length} funds, found %', k; end if;

  update public.cohort_tree t set spine_fund = v.spine_fund, spine_fund_next = v.spine_fund_next
  from (values
${values(handovers.map(n => [n.cohort, n.spine_fund, n.spine_fund_next]), T3)}
  ) as v(cohort, spine_fund, spine_fund_next)
  where t.cohort = v.cohort;
  get diagnostics k = row_count;
  if k <> ${handovers.length} then raise exception 'undo of TR1''s after-admission step refused, nothing changed: expected ${handovers.length} spine rows, found %', k; end if;

  -- PROOF: exactly TR1's ${pendingRows.length} pending rows and ${handovers.length} waiting spines, no more
  select count(*) into k from public.cohort_tree_members where status = 'pending_admission';
  if k <> ${pendingRows.length} then raise exception 'undo of TR1''s after-admission step, proof: expected ${pendingRows.length} pending rows, found %', k; end if;
  select count(*) into k from public.cohort_tree where spine_fund_next is not null;
  if k <> ${handovers.length} then raise exception 'undo of TR1''s after-admission step, proof: expected ${handovers.length} waiting spines, found %', k; end if;
end $$;
commit;
`
  return { forward, rollback, undoAfterAdmission }
}

// Everything the CLI and the tests need, built once from the two generators.
export function build () {
  const { base, holdings, consumer } = loadInputs()
  const rev = reviseTree({ base, holdings, consumer })
  const diff = diffTrees(base, rev)
  return { base, rev, diff, errors: validateRevision(base, rev), files: sqlFiles({ base, rev, diff }), tr1: tr1SqlFiles(base) }
}

export const sha = (s) => createHash('sha256').update(s).digest('hex')

// ── THE DRY RUN. A throw-away Postgres in memory; never the live database. ────────────────────────────────────────
// Each scenario starts from a fresh database holding TR1's schema and load. The harness then stamps loaded_at with a
// different, fixed time on every row: fingerprints from separate runs can be compared, and a row that came back
// with another row's loaded_at would show. A fingerprint is md5 over every TR1 column of every row, source and
// loaded_at included.
async function runInPglite (dir, { files, tr1, rev, base }) {
  const require = createRequire(join(dir, 'package.json'))
  const { PGlite } = await import(require.resolve('@electric-sql/pglite'))
  const FP_TREE = "select count(*)::int n, md5(coalesce(string_agg(jsonb_build_array(cohort,label,kind,parent_1,parent_2,spine,spine_fund,spine_fund_next,source,loaded_at)::text, E'\\n' order by cohort), '')) h from public.cohort_tree"
  const FP_MEM = "select count(*)::int n, md5(coalesce(string_agg(jsonb_build_array(cohort,ticker,role,status,near_copy_of,why,source,loaded_at)::text, E'\\n' order by cohort, ticker), '')) h from public.cohort_tree_members"
  const FP_TR2 = `select md5(
    (select coalesce(string_agg(jsonb_build_array(cohort,${TR2_COLS.join(',')})::text, E'\\n' order by cohort), '') from public.cohort_tree) ||
    (select coalesce(string_agg(to_jsonb(l)::text, E'\\n' order by fund, cohort), '') from public.cohort_tree_fund_links l) ||
    (select coalesce(string_agg(to_jsonb(c)::text, E'\\n' order by cohort, ticker), '') from public.cohort_tree_candidates c) ||
    (select coalesce(string_agg(to_jsonb(r)::text, E'\\n' order by cohort), '') from public.cohort_tree_tr2_removed r)) h`
  const STANDINS = "select (select md5(string_agg(t::text, E'\\n' order by ticker, cohort)) from public.ticker_cohorts t) ticker_cohorts, (select md5(string_agg(t::text, E'\\n' order by ticker)) from public.tickers t) tickers"
  const standinSeen = new Set(); let dbs = 0

  const open = async () => {
    const db = new PGlite(); dbs++
    const one = async (sql) => (await db.query(sql)).rows[0]
    const run = async (sql) => {                      // run a file as the coordinator would; on failure, end the broken transaction
      try { await db.exec(sql); return { ok: true } } catch (e) { await db.exec('rollback').catch(() => {}); return { ok: false, error: String(e.message ?? e) } }
    }
    const has = async (table) => (await one(`select to_regclass('public.${table}') is not null as y`)).y
    const state = async () => {
      const tables = (await db.query("select table_name from information_schema.tables where table_schema='public' order by 1")).rows.map(r => r.table_name)
      const st = (await one(STANDINS)); standinSeen.add(JSON.stringify(st))
      const s = { tables, standins: st }
      if (await has('cohort_tree')) {
        s.tree_columns = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='cohort_tree' order by ordinal_position")).rows.map(r => r.column_name)
        const t = await one(FP_TREE); s.nodes = t.n; s.fp_tree = t.h
        s.spines = Object.fromEntries((await db.query("select cohort, spine_fund, spine_fund_next from public.cohort_tree where cohort in ('IDX_WORLD','ASIA_PACIFIC','CANADA','LATAM') order by 1")).rows.map(r => [r.cohort, `${r.spine_fund} → ${r.spine_fund_next}`]))
        s.frontier = (await one("select count(*)::int n from public.cohort_tree where cohort = 'FRONTIER'")).n === 1
        s.policies = (await db.query("select policyname from pg_policies where schemaname='public' and tablename like 'cohort_tree%' order by 1")).rows.map(r => r.policyname)
      } else s.nodes = null
      if (await has('cohort_tree_members')) {
        const m = await one(FP_MEM); s.members = m.n; s.fp_members = m.h
        s.pending = (await one("select count(*)::int n from public.cohort_tree_members where status = 'pending_admission'")).n
      } else s.members = null
      if (await has('cohort_tree_fund_links')) {
        s.links = (await one('select count(*)::int n from public.cohort_tree_fund_links')).n
        s.candidates = (await one('select count(*)::int n from public.cohort_tree_candidates')).n
        s.stash = (await one('select count(*)::int n from public.cohort_tree_tr2_removed')).n
        s.fp_tr2 = (await one(FP_TR2)).h
      }
      return s
    }
    await db.exec('create role anon; create role authenticated; create role service_role;')
    // stand-ins for the two tables the Hub reads, to prove nothing here touches them
    await db.exec("create table public.ticker_cohorts (ticker text, cohort text); insert into public.ticker_cohorts values ('NVDA','AI_HARDWARE'),('SPY','INDEXES'),('XLP','SECTORS');")
    await db.exec("create table public.tickers (ticker text primary key, name text); insert into public.tickers values ('NVDA','NVIDIA'),('SPY','SPDR S&P 500'),('XLP','Consumer Staples Select Sector SPDR');")
    await db.exec(tr1.schema); await db.exec(tr1.load)
    await db.exec(`update public.cohort_tree t set loaded_at = timestamptz '2026-10-06 20:00:00+00' + s.rn * interval '1 second' from (select cohort, row_number() over (order by cohort) rn from public.cohort_tree) s where s.cohort = t.cohort;
      update public.cohort_tree_members t set loaded_at = timestamptz '2026-10-06 21:00:00+00' + s.rn * interval '1 second' from (select cohort, ticker, row_number() over (order by cohort, ticker) rn from public.cohort_tree_members) s where s.cohort = t.cohort and s.ticker = t.ticker;`)
    return { db, one, run, state }
  }
  const same = (a, b) => a.fp_tree === b.fp_tree && a.fp_members === b.fp_members && a.nodes === b.nodes && a.members === b.members
  const brief = (s) => ({ nodes: s.nodes, members: s.members, pending: s.pending, links: s.links, candidates: s.candidates, stash: s.stash, fp_tree: s.fp_tree, fp_members: s.fp_members, fp_tr2: s.fp_tr2, spines: s.spines })
  const applied = (s, pending) => s.nodes === rev.nodes.length && s.members === rev.members.length && s.pending === pending && s.links === rev.links.length && s.candidates === rev.candidates.length && s.stash === 5 && s.frontier === false
  const J = JSON.stringify
  const out = {}

  // the two reference states, each run alone
  let x = await open(); const REF_LOAD = await x.state(); await x.db.close()
  x = await open(); await x.db.exec(tr1.afterAdmission); const REF_AFTER = await x.state(); await x.db.close()

  // A. TR1 load → forward → checks → forward again → rollback → rollback again → forward once more (it re-applies)
  {
    const { db, one, run, state } = await open()
    const s0 = await state()
    const f1 = await run(files.forward); const s1 = await state()
    const checks = {
      sector_nodes_with_four_funds: (await one("select count(*)::int n from (select cohort from public.cohort_tree_members where cohort like 'SECTOR\\_%' group by cohort having count(*) = 4) q")).n,
      nodes_written_by_tr2: (await one(`select count(*)::int n from public.cohort_tree where source = '${SOURCE}'`)).n,
      member_rows_written_by_tr2: (await one(`select count(*)::int n from public.cohort_tree_members where source = '${SOURCE}'`)).n,
      moved_rows_keep_tr1_source_and_loaded_at: (await one(`select count(*)::int n from public.cohort_tree_members x join public.cohort_tree t on t.cohort = x.cohort where t.source = '${SOURCE}' and x.source = '${TR1_SOURCE}' and x.loaded_at < timestamptz '2026-10-06 22:00:00+00'`)).n,
      guard_keys: (await db.query("select conname from pg_constraint where conrelid = 'public.cohort_tree_fund_links'::regclass and contype = 'f' order by 1")).rows.map(r => r.conname),
      guard_keys_cascade_or_deferrable: (await one("select count(*)::int n from pg_constraint where conrelid = 'public.cohort_tree_fund_links'::regclass and contype = 'f' and (confdeltype <> 'a' or condeferrable)")).n,
      row_level_security_on: (await db.query("select relname from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity and relname like 'cohort_tree%' order by 1")).rows.map(r => r.relname),
      policies: s1.policies,
      anon_can_read_stash: (await one("select has_table_privilege('anon', 'public.cohort_tree_tr2_removed', 'select') y")).y,
      hub_pick: Object.fromEntries((await db.query('select hub_pick, count(*)::int n from public.cohort_tree group by 1 order by 1')).rows.map(r => [r.hub_pick, r.n])),
      layers: Object.fromEntries((await db.query('select layer, count(*)::int n from public.cohort_tree group by 1 order by 1')).rows.map(r => [r.layer, r.n])),
      frontier_cohorts: Object.fromEntries((await db.query("select cohort, parent_1, parent_2 from public.cohort_tree where cohort in ('SPACE','QUANTUM','AUTONOMY_EVTOL','DEFENCE_TECH','DEFENCE_PRIMES') order by 1")).rows.map(r => [r.cohort, [r.parent_1, r.parent_2]]))
    }
    const f2 = await run(files.forward); const s2 = await state()
    const r1 = await run(files.rollback); const s3 = await state()
    const r2 = await run(files.rollback); const s4 = await state()
    const f3 = await run(files.forward); const s5 = await state()
    const r3 = await run(files.rollback); const s6 = await state()
    const want = Object.fromEntries(['on', 'off', 'undecided'].map(p => [p, rev.nodes.filter(n => n.hub_pick === p).length]))
    out.A = {
      what: 'TR1 load → forward → forward again → rollback → rollback again → forward once more → rollback',
      ok: f1.ok && applied(s1, 10) && checks.sector_nodes_with_four_funds === 11 && checks.nodes_written_by_tr2 === 19 && checks.member_rows_written_by_tr2 === 10 &&
        checks.moved_rows_keep_tr1_source_and_loaded_at === 60 && checks.guard_keys.length === 3 && checks.guard_keys_cascade_or_deferrable === 0 && checks.anon_can_read_stash === false &&
        J(checks.hub_pick) === J({ off: want.off, on: want.on, undecided: want.undecided }) &&
        f2.ok && J(brief(s2)) === J(brief(s1)) &&
        r1.ok && same(s3, s0) && same(s3, REF_LOAD) && J(s3.tables) === J(s0.tables) && J(s3.tree_columns) === J(s0.tree_columns) && J(s3.policies) === J(s0.policies) &&
        r2.ok && J(s4) === J(s3) && f3.ok && applied(s5, 10) && s5.fp_tr2 !== undefined && r3.ok && same(s6, s0),
      before: brief(s0), forward: f1, after_forward: brief(s1), checks, forward_again: { ...f2, changed_anything: J(brief(s2)) !== J(brief(s1)) },
      rollback: r1, after_rollback: brief(s3), fingerprint_equals_before_forward: same(s3, s0), tables_after_rollback: s3.tables, tree_columns_after_rollback: s3.tree_columns,
      rollback_again: { ...r2, changed_anything: J(s4) !== J(s3) }, forward_once_more: { ...f3, nodes: s5.nodes, members: s5.members }, rollback_once_more: { ...r3, fingerprint_equals_before_forward: same(s6, s0) }
    }
    await db.close()
  }
  // B. TR1 load → forward → TR1 after-admission → rollback  = (TR1 load + after-admission) run alone
  let B_MIDDLE
  {
    const { db, run, state } = await open()
    const f = await run(files.forward); const a = await run(tr1.afterAdmission); const s1 = await state(); B_MIDDLE = s1
    const r = await run(files.rollback); const s2 = await state()
    out.B = {
      what: 'TR1 load → forward → TR1 AFTER_ADMISSION → rollback; compared with (TR1 load + AFTER_ADMISSION) run alone in another database',
      ok: f.ok && a.ok && applied(s1, 0) && s1.spines.IDX_WORLD === 'ACWI → null' && r.ok && same(s2, REF_AFTER) && s2.pending === 0,
      forward: f, after_admission: a, middle: brief(s1), rollback: r, after_rollback: brief(s2), reference_run_alone: brief(REF_AFTER), fingerprint_equals_reference: same(s2, REF_AFTER)
    }
    await db.close()
  }
  // C. TR1 load → TR1 after-admission → forward (must be accepted) → rollback
  {
    const { db, run, state } = await open()
    const a = await run(tr1.afterAdmission); const s0 = await state()
    const f = await run(files.forward); const s1 = await state()
    const r = await run(files.rollback); const s2 = await state()
    out.C = {
      what: 'TR1 load → TR1 AFTER_ADMISSION → forward → rollback',
      ok: a.ok && same(s0, REF_AFTER) && f.ok && applied(s1, 0) && s1.spines.IDX_WORLD === 'ACWI → null' && r.ok && same(s2, s0) && same(s2, REF_AFTER),
      after_admission: a, before_forward: brief(s0), forward: f, after_forward: brief(s1), rollback: r, after_rollback: brief(s2), fingerprint_equals_before_forward: same(s2, s0)
    }
    await db.close()
  }
  // D. drift: a row the revision touches is not as TR1 left it → the forward file must refuse and leave everything
  {
    const drifts = [
      ['INDUSTRIAL label edited (a column the revision does not change, on a row it does)', "update public.cohort_tree set label = 'INDUSTRIALS (edited)' where cohort = 'INDUSTRIAL'"],
      ['AI parent_1 edited (a column the revision is about to change)', "update public.cohort_tree set parent_1 = 'TECH' where cohort = 'AI'"],
      ['one member row deleted', "delete from public.cohort_tree_members where cohort = 'STAPLES' and ticker = 'KO'"]
    ]
    const cases = []
    for (const [what, sql] of drifts) {
      const { db, run, state } = await open()
      await db.exec(sql); const s0 = await state()
      const f = await run(files.forward); const s1 = await state()
      cases.push({ what, refused: !f.ok, error: f.error ?? null, untouched: J(s1) === J(s0), tables: s1.tables, tree_columns: s1.tree_columns })
      await db.close()
    }
    out.D = { what: 'drift after TR1 load → forward must refuse and leave rows and schema as they were', ok: cases.every(c => c.refused && c.untouched && /TR2 refused, nothing changed/.test(c.error)), cases }
  }
  // E. the neighbours, with TR2 applied
  {
    // E1. TR1's LOAD file
    let { db, run, state } = await open()
    await db.exec(files.forward); const s0 = await state()
    const l = await run(tr1.load); const s1 = await state()
    const E1 = { what: "TR1's LOAD file run with TR2 applied", failed: !l.ok, error: l.error ?? null, changed_anything: J(s1) !== J(s0), after: brief(s1) }
    await db.close()

    // E2. TR1's ROLLBACK file, statement by statement (the worst case: each statement on its own, as psql would)
    ;({ db, run, state } = await open())
    await db.exec(files.forward); const t0 = await state()
    const stmts = tr1.rollback.replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
    const steps = []
    for (const s of stmts) { const r = await run(s); steps.push({ statement: s, ok: r.ok, error: r.error ?? null }) }
    const t1 = await state()
    const lostTables = t0.tables.filter(t => !t1.tables.includes(t)); const lostPolicies = t0.policies.filter(p => !(t1.policies ?? []).includes(p))
    const fix = await run(tr1.schema); const t2 = await state()       // TR1's schema file is safe to re-run: it puts the two read policies back
    const E2 = { what: "TR1's ROLLBACK file run with TR2 applied, one statement at a time", steps, tables_lost: lostTables, policies_lost: lostPolicies,
      rows_unchanged: same(t1, t0) && t1.fp_tr2 === t0.fp_tr2, repair: { what: "re-run TR1's schema file (20261006_tr1_cohort_tree.sql)", ...fix, policies_back: J(t2.policies) === J(t0.policies), rows_unchanged: same(t2, t0) && t2.fp_tr2 === t0.fp_tr2 } }
    await db.close()

    // E2b. the same file sent as one batch (how a single query call would send it)
    ;({ db, run, state } = await open())
    await db.exec(files.forward); const u0 = await state()
    const b = await run(tr1.rollback); const u1 = await state()
    const E2b = { what: "TR1's ROLLBACK file run with TR2 applied, sent as one batch", failed: !b.ok, error: b.error ?? null, tables_lost: u0.tables.filter(t => !u1.tables.includes(t)), policies_lost: u0.policies.filter(p => !(u1.policies ?? []).includes(p)), changed_anything: J(u1) !== J(u0) }
    // …and the right order: TR2's rollback first, then TR1's
    const r = await run(files.rollback); const rr = await run(tr1.rollback); const u2 = await state()
    const E2c = { what: "the right order: TR2's ROLLBACK, then TR1's ROLLBACK", tr2_rollback: r, tr1_rollback: rr, tables_left: u2.tables }
    await db.close()

    // E3. the undo of TR1's after-admission step, after B's middle state (TR2 applied, admission done)
    ;({ db, run, state } = await open())
    await db.exec(files.forward); const v0 = await state(); await db.exec(tr1.afterAdmission); const v1 = await state()
    const u = await run(files.undoAfterAdmission); const v2 = await state()
    const uu = await run(files.undoAfterAdmission); const v3 = await state()
    const rb = await run(files.rollback); const v4 = await state()
    const tr1Spines = Object.fromEntries(base.nodes.filter(n => n.spine_fund_next != null).map(n => [n.cohort, `${n.spine_fund} → ${n.spine_fund_next}`]))
    // (the 29 rows TR2 itself writes take the clock, so an applied state is compared with scenario B by counts and spines)
    const asB = v1.nodes === B_MIDDLE.nodes && v1.members === B_MIDDLE.members && v1.pending === 0 && J(v1.spines) === J(B_MIDDLE.spines)
    const E3 = { what: 'TR1 load → forward → TR1 AFTER_ADMISSION → UNDO_TR1_AFTER_ADMISSION (twice) → TR2 rollback', starts_from_scenario_B_middle_state: asB, pending_before_undo: v1.pending, undo: u, pending_after_undo: v2.pending, spines_after_undo: v2.spines,
      spines_as_tr1_loaded: Object.keys(tr1Spines).every(c => v2.spines[c] === tr1Spines[c]), equals_tr2_before_admission: same(v2, v0) && v2.fp_tr2 === v0.fp_tr2,
      undo_again: { ...uu, changed_anything: J(v3) !== J(v2) }, then_tr2_rollback: rb, equals_tr1_load_alone: same(v4, REF_LOAD) }
    await db.close()

    // E3b. the same undo without TR2: TR1 load → after-admission → undo  = TR1 load alone
    ;({ db, run, state } = await open())
    await db.exec(tr1.afterAdmission); const w = await run(files.undoAfterAdmission); const w1 = await state()
    const E3b = { what: 'TR1 load → TR1 AFTER_ADMISSION → UNDO_TR1_AFTER_ADMISSION, TR2 not applied', undo: w, pending: w1.pending, equals_tr1_load_alone: same(w1, REF_LOAD) }
    await db.close()

    out.E = {
      what: 'the neighbours, with TR2 applied',
      ok: E1.failed && !E1.changed_anything && /tr2_roll_back_tr2_first/.test(E1.error) &&
        E2.tables_lost.length === 0 && E2.rows_unchanged && E2.repair.ok && E2.repair.policies_back && E2.repair.rows_unchanged &&
        E2b.failed && E2b.tables_lost.length === 0 && r.ok && rr.ok && !E2c.tables_left.some(t => t.startsWith('cohort_tree')) &&
        asB && u.ok && E3.pending_after_undo === 10 && E3.spines_as_tr1_loaded && E3.equals_tr2_before_admission && uu.ok && !E3.undo_again.changed_anything && rb.ok && E3.equals_tr1_load_alone &&
        w.ok && E3b.pending === 10 && E3b.equals_tr1_load_alone,
      tr1_load_after_tr2: E1, tr1_rollback_after_tr2_statement_by_statement: E2, tr1_rollback_after_tr2_one_batch: E2b, right_order: E2c, undo_after_admission: E3, undo_after_admission_without_tr2: E3b
    }
  }
  // F. the stand-ins for the Hub's two tables: one fingerprint, seen at every state read in every scenario
  out.F = { what: 'the stand-in ticker_cohorts and tickers tables, fingerprinted at every state read above', ok: standinSeen.size === 1, distinct_fingerprints_seen: standinSeen.size, fingerprint: JSON.parse([...standinSeen][0]) }
  return {
    what: 'TR2 migration dry run. Every scenario ran in PGlite (Postgres in memory, throw-away). The live database was not read or written.',
    engine: (await (async () => { const d = new PGlite(); const v = (await d.query('select version() v')).rows[0].v; await d.close(); return v })()),
    databases_opened: dbs,
    loaded_at_note: 'after TR1\'s load the harness stamps loaded_at with a different fixed time on every row, so fingerprints from separate databases can be compared and a row that came back with another row\'s loaded_at would show',
    fingerprint: 'md5 over every TR1 column of every row, source and loaded_at included, for cohort_tree and cohort_tree_members',
    fingerprint_note: 'the 19 nodes and 10 member rows TR2 itself writes take the clock for loaded_at, so the fingerprint of an APPLIED tree differs from one database to the next; every equality claimed here is between states TR2 has left (rolled back) or inside one database',
    how_files_are_run: 'each file is sent whole, as the coordinator\'s one query call would send it; after a failure the harness issues ROLLBACK, which is what closing the connection does. TR1\'s ROLLBACK file has no begin/commit of its own, so it is also run one statement at a time (the worst case)',
    sql_sha256: { forward: sha(files.forward), rollback: sha(files.rollback), undoAfterAdmission: sha(files.undoAfterAdmission), tr1_load: sha(tr1.load), tr1_rollback: sha(tr1.rollback), tr1_afterAdmission: sha(tr1.afterAdmission) },
    reference: { tr1_load_alone: brief(REF_LOAD), tr1_load_then_after_admission_alone: brief(REF_AFTER) },
    all_ok: Object.values(out).every(s => s.ok),
    scenarios: out
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2)
  const WRITE = argv.includes('--write')
  const PGLITE = argv.includes('--pglite') ? argv[argv.indexOf('--pglite') + 1] : null
  const b = build()
  const { base, rev, diff, errors, files } = b
  const all = (files.forward + files.rollback + files.undoAfterAdmission).replace(/^\s*--.*$/gm, '')
  const plan = {
    dry_run: !WRITE,
    nodes: { tr1: base.nodes.length, tr2: rev.nodes.length, added: diff.nodes_added.length, removed: diff.nodes_removed.length, changed: diff.nodes_changed.length },
    members: { tr1: base.members.length, tr2: rev.members.length, moved: diff.member_moves.length, added: diff.member_adds.length, removed: diff.member_removed.length },
    links: rev.links.length, candidates: rev.candidates.length,
    hub_pick: rev.nodes.reduce((o, n) => (o[n.hub_pick] = (o[n.hub_pick] ?? 0) + 1, o), {}),
    tr1_pending_funds: base.members.filter(m => m.status === 'pending_admission').map(m => m.ticker).sort(),
    tr1_spine_handovers: base.nodes.filter(n => n.spine_fund_next != null).map(n => `${n.cohort}: ${n.spine_fund} → ${n.spine_fund_next}`),
    writes_tables: [...new Set([...all.matchAll(/public\.([a-z0-9_]+)/g)].map(x => `public.${x[1]}`))].sort(),
    names_the_hub_tables_in_sql: /ticker_cohorts|\btickers\b/.test(all),
    errors,
    files: Object.values(FILES), sql_bytes: { forward: files.forward.length, rollback: files.rollback.length, undoAfterAdmission: files.undoAfterAdmission.length }, wrote: false
  }
  if (errors.length) { console.log(JSON.stringify(plan, null, 1)); console.error('REFUSED: the revised tree does not validate'); process.exit(2) }
  let dry = null
  if (PGLITE) {
    dry = await runInPglite(PGLITE, b)
    plan.sql_run = { all_ok: dry.all_ok, scenarios: Object.fromEntries(Object.entries(dry.scenarios).map(([k, v]) => [k, v.ok])) }
  }
  if (WRITE) {
    for (const k of Object.keys(FILES)) writeFileSync(join(ROOT, FILES[k]), files[k])
    plan.wrote = true
    if (dry) { writeFileSync(join(ROOT, DRY_RUN), JSON.stringify(dry, null, 1) + '\n'); plan.wrote_dry_run = DRY_RUN }
  }
  console.log(JSON.stringify(plan, null, 1))
  if (dry && !dry.all_ok) { console.error('DRY RUN FAILED: at least one scenario is not ok'); process.exit(3) }
}
