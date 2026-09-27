-- 2026-09-27 · ADMISSION V2 — the tier, as one column, and the list the FMP loaders walk.
--
-- WHY. Until today one switch (active) meant everything at once: priced, scored, on the board, and
-- fed by every FMP loader. Alan (27 Sep): the map's tradable parents "don't need analysts or
-- financials; they need the Geiger, and full daily history". So a name can now be:
--   role = 'full'         the Hub treatment (board, fundamentals, estimates, news). Every existing row.
--   role = 'geiger_only'  computed (bars, Geiger, settled close) and shown only where Alan asks
--                         (LIKED / FAVORITES / RADAR, search, the company page) — never on ALL or a
--                         cohort tab, and skipped by the FMP loaders.
-- A geiger-only row stays active = true, type 'etf': the Station compares the chart API's list with
-- the active equity rows name by name, so it must still see them.
--
-- ADDITIVE ONLY (pre-approved class): a new column with a default that fills every existing row with
-- 'full' (so nothing changes for the 389 rows), a check constraint, and one new view. No existing
-- row, view, job or price changes. Rollback: 20260927_admission_v2_role_ROLLBACK.sql.
--
-- THE HIDDEN GATE, CLOSED. fmp-fundamentals, fmp-events, news-feed, mcap-refresh and fmp-backfill
-- picked their names from composite_staged (tf D), a legacy table frozen at 386 names since 24 Aug
-- (measured 27 Sep: 386 distinct tickers). A new name never reaches it, so it would never get
-- fundamentals, events, news or a market cap. They now read fmp_full_universe, as fmp-analyst v9
-- already read public.tickers.
alter table public.tickers add column if not exists role text not null default 'full';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickers_role_check') then
    alter table public.tickers add constraint tickers_role_check check (role in ('full', 'geiger_only'));
  end if;
end $$;

-- The one list every FMP loader walks: active, full-treatment, equity or fund, no crypto/future/
-- index/rate, no *USD pairs (the same exclusions fmp-analyst v9 applies in code).
create or replace view public.fmp_full_universe as
  select ticker
    from public.tickers
   where active = true
     and role = 'full'
     and (type is null or type not in ('crypto', 'future', 'index', 'rate'))
     and ticker not like '%USD'
   order by ticker;

grant select on public.fmp_full_universe to service_role;

-- PROOF: every existing row is 'full', and the loader list is the 364 served names plus nothing else.
do $$
declare g int; n int;
begin
  select count(*) into g from public.tickers where role <> 'full';
  select count(*) into n from public.fmp_full_universe;
  raise notice 'admission v2 role: % non-full rows, fmp_full_universe = % names', g, n;
end $$;
