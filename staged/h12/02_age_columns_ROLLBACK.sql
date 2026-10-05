-- H12 02 ROLLBACK. Run only AFTER 03 and 04 are rolled back (their bodies write these columns).
-- Drops columns H12 added; nothing that existed before 5 Oct is touched.
alter table public.sector_rankings   drop column if exists as_of_oldest;
alter table public.sector_rankings   drop column if exists as_of_newest;
alter table public.sector_rankings   drop column if exists n_names;
alter table public.sector_rankings   drop column if exists n_old;
alter table public.cohort_divergence drop column if exists as_of;
alter table public.cohort_divergence drop column if exists source;
alter table public.cohort_divergence drop column if exists cohort_as_of_oldest;
alter table public.cohort_divergence drop column if exists updated_at;
