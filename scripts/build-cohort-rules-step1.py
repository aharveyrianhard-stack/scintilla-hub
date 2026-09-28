#!/usr/bin/env python3
"""COHORT RULES, STEP 1 (Alan, 28 Sep: "adopt the tree-derived cohort rules in two separate steps, parents and merges first").

Writes supabase/migrations/20260928_cohort_rules_step1.sql (+ _ROLLBACK.sql) and data/cohort-registry-step1.json from
deliverables/20260928/tree-cohorts/{proposed-cohorts.json, build/critique.json}. Nothing is typed: every parent comes
from the proposal (a label that survives as itself) or from rule R1 applied to the measured parent fit.

Step 1 is the registry's SHAPE, not its membership: one new table, public.cohort_registry, one row per label.
  - parents  (R1) for every one of the 36 cohort labels on the tree, and for the two labels the merges create
  - merges   (R4) METALS/PRECIOUS METALS, AI POWERTRAIN into AI POWER, CRYPTO into CRYPTO EQUITIES,
             MEMORY STORAGE + SEMI EQUIPMENT into MEMORY & SEMI EQUIPMENT, CYBER into SECURITY & DATA PLATFORMS
  - filters  (R2) LARGE CAP, MEGA CAP, MID CAP, SMALL CAP -> the cap tranche; BLUE CHIP -> the style attribute
No row of public.ticker_membership is inserted, updated or deleted: no name moves. Splits and moves are step 2.
"""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), '..')
TC = os.path.join(ROOT, 'deliverables/20260928/tree-cohorts')
P = json.load(open(os.path.join(TC, 'proposed-cohorts.json')))
C = json.load(open(os.path.join(TC, 'build/critique.json')))
FIT = C['parent_fit']
LABELS = sorted(P['label_verdicts'])          # the 36 cohort labels on the tree
SOURCE = 'tree-cohorts-20260928 step 1'

# R2: the five labels that become filters (tree-cohorts section 5d)
FILTERS = {'LARGE_CAP': ('cap_tranche', 'LARGE'), 'MEGA_CAP': ('cap_tranche', 'MEGA'), 'MID_CAP': ('cap_tranche', 'MID'),
           'SMALL_CAP': ('cap_tranche', 'SMALL'), 'BLUE_CHIP': ('style', 'VALUE_QUALITY')}
# R4: the merges (section 5d "becomes"), label -> the label that absorbs it. The two new targets get their own rows.
MERGES = {'PRECIOUS_METALS': 'METALS', 'AI_POWERTRAIN': 'AI_POWER', 'CRYPTO': 'CRYPTO_EQUITIES',
          'MEMORY_STORAGE': 'MEMORY_SEMICAP', 'SEMI_EQUIPMENT': 'MEMORY_SEMICAP', 'CYBER': 'SECURITY_DATA'}
NEW_TARGETS = {'MEMORY_SEMICAP': 'MEMORY & SEMI EQUIPMENT', 'SECURITY_DATA': 'SECURITY & DATA PLATFORMS'}
DISPLAY = {'METALS': 'METALS · GOLD & SILVER', 'INTL': 'WORLD'}
# splits and dissolves that wait for step 2 (the label keeps its members and its parent until then)
STEP2 = {'AI_HARDWARE': 'split into accelerators, memory & semicap, photonics, neoclouds & miners',
         'BANKS_MARKETS': 'split into money-centre banks and capital markets',
         'CRYPTO_EQUITIES': 'split into exchanges & treasuries and neoclouds & miners',
         'AI_DATACENTER': 'split into data-centre property and neoclouds & miners',
         'THEMATIC': 'dissolved into its five theme cohorts (ARKX is R1 on the mean but holds 5 of 23)', 'INTL': 'CHINA split out under MCHI',
         'AI_POWER': 'regulated utilities split out to the XLU fund cohort; the generators then hang under SEC_UTIL (R1 on today\'s 27 names picks VPU)',
         'MEGACAP_PLATFORMS': 'becomes INTERNET & CONSUMER PLATFORMS (AAPL, META, NFLX stay in MEGACAP)',
         'SECURITY_DATA': 'DDOG, MDB, SNOW, PATH join (moves)'}
SECTOR_HEADING = {'XLK': 'SEC_TECH', 'XLF': 'SEC_FIN', 'XLI': 'SEC_INDU', 'XLY': 'SEC_DISC', 'XLB': 'SEC_MATL',
                  'XLE': 'SEC_ENGY', 'XLU': 'SEC_UTIL', 'XLV': 'SEC_HLTH', 'XLC': 'SEC_COMM', 'XLP': 'SEC_STPL', 'XLRE': 'SEC_REIT'}


def proposal_parent(label):
    """The proposal's parent for a label that survives as itself (one source label, not a split)."""
    for c in P['cohorts']:
        if c['from_cohorts'] == [label] and not c['split_of']:
            return c['parent'], c['parent_reason']
    for c in P['cohorts']:                      # a merge target that keeps the label's name (METALS <- PRECIOUS_METALS)
        if label in c['from_cohorts'] and c['merged_from'] and label not in c['merged_from'] and not c['split_of']:
            return c['parent'], c['parent_reason']
    return None


def r1_parent(label):
    """R1 on the measured fit: the fund that tracked the label's mean best, if it beats the sector fund; else the heading."""
    fit = FIT[label]
    best = max(fit['candidates'], key=lambda x: x.get('corr_history') or -9) if fit['candidates'] else None
    sector = (fit.get('yardsticks') or {}).get('sector_fund') or {}
    if best and best.get('corr_history') is not None and best['corr_history'] > (sector.get('corr_history') or -9):
        return best['fund'], f"R1: {best['fund']} tracked the mean at {best['corr_history']:.3f} over {best.get('n')} sessions (sector fund {sector.get('fund')} {sector.get('corr_history')})"
    head = SECTOR_HEADING.get(sector.get('fund'), 'US_BROAD')
    return head, f"R1: no fund beat the sector fund {sector.get('fund')} ({sector.get('corr_history')}); hangs under the heading"


rows = []
for label in LABELS:
    v = P['label_verdicts'][label]
    row = {'label': label, 'display_label': DISPLAY.get(label, label.replace('_', ' ')), 'kind': 'cohort', 'parent': None,
           'parent_reason': None, 'merged_into': None, 'filter_attribute': None, 'filter_value': None,
           'rule': None, 'cohesion': v.get('cohesion'), 'null95': v.get('null95'), 'step2_pending': STEP2.get(label)}
    if label in FILTERS:
        row.update(kind='filter', rule='R2', filter_attribute=FILTERS[label][0], filter_value=FILTERS[label][1],
                   parent_reason='a filter is an attribute of a name, not a node on the tree')
    elif label in MERGES:
        row.update(kind='merged', rule='R4', merged_into=MERGES[label], parent_reason=f'merged into {MERGES[label]}')
    else:
        pp = proposal_parent(label)
        parent, why = pp if pp else r1_parent(label)
        row.update(parent=parent, parent_reason=why, rule='R1')
    rows.append(row)
for key, disp in NEW_TARGETS.items():
    c = next(c for c in P['cohorts'] if c['id'] == key)
    rows.append({'label': key, 'display_label': disp, 'kind': 'cohort', 'parent': c['parent'], 'parent_reason': c['parent_reason'],
                 'merged_into': None, 'filter_attribute': None, 'filter_value': None, 'rule': 'R1+R4', 'cohesion': None,
                 'null95': None, 'step2_pending': STEP2.get(key)})

labels = {r['label'] for r in rows}
assert all(r['merged_into'] in labels for r in rows if r['merged_into']), 'a merge points at a label with no row'
assert all(r['parent'] for r in rows if r['kind'] == 'cohort'), 'a cohort has no parent'
assert sum(r['kind'] == 'filter' for r in rows) == 5

q = lambda v: 'null' if v is None else ("'" + str(v).replace("'", "''") + "'") if isinstance(v, str) else str(v)
cols = ['label', 'display_label', 'kind', 'parent', 'parent_reason', 'merged_into', 'filter_attribute', 'filter_value', 'rule', 'cohesion', 'null95', 'step2_pending']
values = ',\n'.join('  (' + ', '.join(q(r[c]) for c in cols) + ')' for r in rows)
n = len(rows)
sql = f"""-- GENERATED by scripts/build-cohort-rules-step1.py from deliverables/20260928/tree-cohorts. Do not edit by hand.
-- COHORT RULES, STEP 1 (Alan, 28 Sep 2026: "adopt the tree-derived cohort rules in two separate steps, parents and merges first").
-- ADDITIVE: one new table. No row of public.ticker_membership, public.tickers or public.hub_favorites is touched, so no
-- name moves and no board tab changes; readers adopt the table in their own reviewed change. Splits and moves are step 2.
-- Export taken first: _archive/admission-v3-20260928/rollback/ticker_membership-before.json (1,443 rows).
-- ROLLBACK: 20260928_cohort_rules_step1_ROLLBACK.sql (drops this table only).
create table if not exists public.cohort_registry (
  label            text primary key,
  display_label    text not null,
  kind             text not null check (kind in ('cohort','merged','filter')),
  parent           text,
  parent_reason    text,
  merged_into      text references public.cohort_registry(label) deferrable initially deferred,
  filter_attribute text check (filter_attribute in ('cap_tranche','style')),
  filter_value     text,
  rule             text,
  cohesion         numeric,
  null95           numeric,
  step2_pending    text,
  source           text not null default '{SOURCE}',
  adopted_at       timestamptz not null default now(),
  check ((kind = 'cohort') = (parent is not null)),
  check ((kind = 'merged') = (merged_into is not null)),
  check ((kind = 'filter') = (filter_attribute is not null))
);
comment on table public.cohort_registry is 'Tree-derived cohort rules (tree-cohorts 28 Sep), step 1: every cohort label with its one parent (R1), the merges (R4) and the size/style labels that became filters (R2). Membership stays in ticker_membership.';
alter table public.cohort_registry enable row level security;
drop policy if exists cohort_registry_read on public.cohort_registry;
create policy cohort_registry_read on public.cohort_registry for select using (true);

begin;
set constraints all deferred;
insert into public.cohort_registry ({', '.join(cols)}) values
{values}
on conflict (label) do nothing;
commit;

do $$
declare n int; f int; m int;
begin
  select count(*) into n from public.cohort_registry where source = '{SOURCE}';
  select count(*) into f from public.cohort_registry where kind = 'filter';
  select count(*) into m from public.cohort_registry where kind = 'merged';
  if n <> {n} then raise exception 'cohort rules step 1: expected {n} rows, found %', n; end if;
  if f <> 5 then raise exception 'cohort rules step 1: expected 5 filters, found %', f; end if;
  if m <> {len(MERGES)} then raise exception 'cohort rules step 1: expected {len(MERGES)} merged labels, found %', m; end if;
end $$;
"""
rollback = """-- ROLLBACK for 20260928_cohort_rules_step1.sql: the table is new and nothing else was changed, so dropping it is the whole way back.
drop table if exists public.cohort_registry;
"""
open(os.path.join(ROOT, 'supabase/migrations/20260928_cohort_rules_step1.sql'), 'w').write(sql)
open(os.path.join(ROOT, 'supabase/migrations/20260928_cohort_rules_step1_ROLLBACK.sql'), 'w').write(rollback)
json.dump({'source': SOURCE, 'rows': rows}, open(os.path.join(ROOT, 'data/cohort-registry-step1.json'), 'w'), indent=1)
print(json.dumps({'rows': n, 'cohorts': sum(r['kind'] == 'cohort' for r in rows), 'merged': len(MERGES), 'filters': 5}))
for r in rows:
    print(f"{r['label']:18} {r['kind']:7} {str(r['parent'] or r['merged_into'] or r['filter_value']):14} {r['rule']}  {(r['step2_pending'] or '')[:60]}")
