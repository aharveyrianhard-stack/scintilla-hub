-- H12 02 (5 Oct 2026) — ADDITIVE: nullable columns only, no value changed, no row deleted.
-- Rollback: 02_age_columns_ROLLBACK.sql. Apply BEFORE 03 and 04.
--
-- WHY: neither table can say how old the readings behind a row are. sector_rankings.updated_at is the
-- time the row was WRITTEN (2 Oct 21:15Z on rows built from 24 Aug stock readings); cohort_divergence
-- has no time column at all. Every reader names its columns (checked 5 Oct: Hub allocation, read-engine,
-- Station analytics / heat / allocation-module / sector-rotation), so new columns reach no screen until a
-- reader asks for them.
alter table public.sector_rankings   add column if not exists as_of_oldest timestamptz;
alter table public.sector_rankings   add column if not exists as_of_newest timestamptz;
alter table public.sector_rankings   add column if not exists n_names integer;
alter table public.sector_rankings   add column if not exists n_old integer;
alter table public.cohort_divergence add column if not exists as_of timestamptz;
alter table public.cohort_divergence add column if not exists source text;
alter table public.cohort_divergence add column if not exists cohort_as_of_oldest timestamptz;
alter table public.cohort_divergence add column if not exists updated_at timestamptz;
comment on column public.sector_rankings.as_of_oldest is 'Oldest member reading behind this score (H12).';
comment on column public.sector_rankings.as_of_newest is 'Newest member reading behind this score (H12).';
comment on column public.sector_rankings.n_names is 'Members averaged (H12).';
comment on column public.sector_rankings.n_old is 'Members whose reading is more than 4 days older than the row''s date (H12).';
comment on column public.cohort_divergence.as_of is 'When this name''s Geiger was computed (H12).';
comment on column public.cohort_divergence.source is 'CHART_API_GEIGER | CHART_API_GEIGER_CARRIED | COMPOSITE_STAGED (H12).';
comment on column public.cohort_divergence.cohort_as_of_oldest is 'Oldest reading in this name''s cohort mean (H12).';
comment on column public.cohort_divergence.updated_at is 'When this row was last recomputed (H12).';
