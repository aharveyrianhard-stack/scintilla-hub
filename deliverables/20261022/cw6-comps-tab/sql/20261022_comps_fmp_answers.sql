-- CW6 (22 Oct 2026) · public.comps_fmp_answers — FMP's answers for the Hub's COMPS tab, one row per company and FMP path.
-- PROPOSED FOR THE COORDINATOR. NOT APPLIED by the lane (no database writes).
--
-- Why: the COMPS tab prices every name on FMP's own answers (CW3's method). A browser cannot read the fmp-proxy edge
-- function (measured 22 Oct 2026: neither its GET nor its OPTIONS answer carries Access-Control-Allow-Origin), so the
-- answers are fetched server-side and served. Today they are served as files (deliverables/20261022/cw6-comps-tab/store/,
-- filled by tools/fill_store.py through fmp-proxy). With this table applied and filled on a schedule, the tab reads the
-- table first (sources.mjs fromStore) and the files only where the table has no row, so the figures stay fresh without
-- a commit.
--
-- Shape: exactly what tools/fill_store.py keeps per answer ({status, fetched_utc, data}), keyed by ticker and path.
-- Writer: the service role only (a job calling fmp-proxy or FMP's /stable/ API: analyst-estimates annual 6,
-- income-statement-ttm, balance-sheet-statement quarter 1, batch-quote, profile, and for the reviewed names
-- price-target-consensus, price-target-summary, cash-flow-statement quarter 4, shares-float, stock-peers).
-- Reader: anon (the Hub's public key), SELECT only.

create table if not exists public.comps_fmp_answers (
  ticker     text        not null,
  path       text        not null,
  params     jsonb       not null default '{}'::jsonb,
  status     integer     not null,
  fetched_at timestamptz not null default now(),
  data       jsonb,
  primary key (ticker, path)
);

comment on table public.comps_fmp_answers is 'CW6 · FMP answers for the COMPS tab (one row per ticker and FMP /stable/ path), written by the service role, read by anon';

alter table public.comps_fmp_answers enable row level security;

drop policy if exists comps_fmp_answers_read on public.comps_fmp_answers;
create policy comps_fmp_answers_read on public.comps_fmp_answers for select to anon, authenticated using (true);

grant select on public.comps_fmp_answers to anon, authenticated;
revoke insert, update, delete on public.comps_fmp_answers from anon, authenticated;

create index if not exists comps_fmp_answers_fetched_at_idx on public.comps_fmp_answers (fetched_at);
