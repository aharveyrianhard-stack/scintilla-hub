-- 2026-09-24 · M45 TREE — the proposed tree, as three additive tables. NOT APPLIED by this lane.
--
-- WHY. Alan: "we need a better way of measuring the cohorts versus sectors downwards. From broad
-- market down to branching outwards." Today the same name can sit in 113 cohort labels across two
-- tables (`cohorts`, 389 rows, one label per name — and `ticker_cohorts`, 1,280 rows, many labels
-- per name), 47 of those labels are machine-made copies of the FMP industry string, and 22 cohort
-- rows name tickers the chart API cannot price. Nothing in that shape can be rolled up.
--
-- WHAT THIS ADDS. One node table (market → trunk → sector → industry, plus a branch trunk and a
-- fund trunk), one membership table, and one table of the rules the dynamic lists run. It is
-- additive: no existing table, column, view or job is changed, and no screen reads these tables
-- until a reviewed reader ships. Alan's cohorts stay exactly where they are; they are the seeds
-- the branch rules were written from, not something this migration edits or deletes.
--
-- WHAT IT DELIBERATELY DOES NOT DO. It does not store a Geiger mean, a breadth number or a price.
-- Those come from the chart API at read time (/geiger, /quotes) and would be stale the moment they
-- were copied into a table. A node's readings are computed over its members when asked for.
--
-- ROLLBACK (bottom of this file, run as one block):
--   drop table if exists public.taxonomy_list_rules;
--   drop table if exists public.taxonomy_membership;
--   drop table if exists public.taxonomy_nodes;

create table if not exists public.taxonomy_nodes (
  node_id      text primary key,
  parent_id    text references public.taxonomy_nodes(node_id) on delete restrict,
  level        text not null check (level in ('market','trunk','sector','industry','branch','family')),
  label        text not null,
  rule_version text not null default 'm45-1',
  sort_order   integer,
  created_at   timestamptz not null default now()
);
comment on table public.taxonomy_nodes is
  'M45 proposed tree. One row per node: the market, its trunks (companies, funds, instruments, branches), the sectors and industries under companies, the fund families, and the themed branches. Seeded from data/taxonomy-rules-20260924.json in the Hub repo.';

create table if not exists public.taxonomy_membership (
  node_id text not null references public.taxonomy_nodes(node_id) on delete cascade,
  ticker  text not null,
  role    text not null default 'member' check (role in ('member','seed')),
  source  text not null default 'rules:m45-1',
  primary key (node_id, ticker)
);
create index if not exists taxonomy_membership_ticker_idx on public.taxonomy_membership(ticker);
comment on table public.taxonomy_membership is
  'Which served names sit on which node. role=seed marks a name that came from one of Alan''s cohorts, so the seed can always be told apart from a name the rules placed.';

create table if not exists public.taxonomy_list_rules (
  list_id     text primary key,
  label       text not null,
  description text not null,
  predicate   jsonb not null,
  sort        jsonb not null,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.taxonomy_list_rules is
  'The dynamic lists. A list is a rule, not a saved set of tickers: it is evaluated over whatever node is open, every time the numbers change, so Alan never maintains a watchlist.';

insert into public.taxonomy_list_rules (list_id, label, description, predicate, sort) values
 ('OVERSOLD_QUALITY', 'Oversold quality',
  'Market cap at or above $20B and a Geiger composite at or below -0.35. Size stands in for quality until the fundamentals join the tree.',
  '{"all":[{"field":"market_cap","op":">=","value":20000000000},{"field":"geiger_composite","op":"<=","value":-0.35}]}',
  '{"field":"geiger_composite","dir":"asc"}'),
 ('LEADERS_PULLING_BACK', 'Leaders pulling back',
  'Geiger trend at or above +0.25 while the last completed session closed down.',
  '{"all":[{"field":"geiger_trend","op":">=","value":0.25},{"field":"chg_pct","op":"<","value":0}]}',
  '{"field":"geiger_trend","dir":"desc"}'),
 ('SCINTILLAS', 'Scintillas',
  'Moved 3% or more in the last completed session, in either direction.',
  '{"all":[{"field":"abs_chg_pct","op":">=","value":3}]}',
  '{"field":"abs_chg_pct","dir":"desc"}'),
 ('CHEAPER_GROWING_FASTER', 'Cheaper, growing faster',
  'Forward P/E below the open node''s median and forward EPS growth above it. Needs at least four names on the node carrying both numbers.',
  '{"all":[{"field":"pe_ntm","op":"<","value":{"node_median":"pe_ntm"}},{"field":"eps_growth_pct","op":">","value":{"node_median":"eps_growth_pct"}}],"min_sample":4}',
  '{"field":"pe_ntm","dir":"asc"}'),
 ('FAVOURITES_IN_RED', 'Favourites in red',
  'A name in hub_favorites that closed down in the last completed session.',
  '{"all":[{"field":"is_favourite","op":"=","value":true},{"field":"chg_pct","op":"<","value":0}]}',
  '{"field":"chg_pct","dir":"asc"}')
on conflict (list_id) do nothing;

-- ROLLBACK
-- drop table if exists public.taxonomy_list_rules;
-- drop table if exists public.taxonomy_membership;
-- drop table if exists public.taxonomy_nodes;
