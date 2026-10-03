-- A4 (3 Oct 2026) · analyst targets you can trust: quarantine, don't delete.
-- Additive only: three NEW nullable columns on public.analyst_target_news. No row is deleted, no existing value is changed.
-- Rollback (written first): supabase/migrations/20261003_analyst_target_news_quality_ROLLBACK.sql
--
--   quality             'ok' | 'quarantine' — set by supabase/functions/analyst-revisions/quality.ts (the one rule set), filled for
--                       the stored rows by deliverables/20261003/a4-analyst-quality/tools/classify.mjs and, once Alan approves the
--                       collector change, on the way in. NULL = not classified yet (a row the live collector stored after the fill).
--   quality_reason      the named causes, ';'-joined: hard ones first (not_about_target, not_about_rating, firm_mismatch(<firm>),
--                       number_mismatch($X), price_not_this_stock, target_vs_price(xR), jump_vs_firm_prior(xR), duplicate), then
--                       soft notes kept for reading (roundup, firm_unverified, headline_confirms, split_mismatch(fmp A → B)).
--   adj_target_checked  TARGET rows: the target ÷ the splits after the note (public.splits) — FMP's adj_target lags recent splits
--                       (MNST 2:1 11 Aug 2026, APH 2:1 3 Sep 2026 …); this is the number a reader should compare with today's price.
--
-- Readers that want clean rows: quality is distinct from 'quarantine'. The live Hub does not read these columns (Alan's approval
-- first); only branch hub/a3-analysts-tab-20261003 does. Read access follows the table's existing grant/policy (anon SELECT).

alter table public.analyst_target_news
  add column if not exists quality text check (quality in ('ok', 'quarantine')),
  add column if not exists quality_reason text,
  add column if not exists adj_target_checked numeric;

comment on column public.analyst_target_news.quality is
  'A4 (3 Oct 2026): ok | quarantine — supabase/functions/analyst-revisions/quality.ts. NULL = not classified yet. Rows are never deleted.';
comment on column public.analyst_target_news.quality_reason is
  'A4 (3 Oct 2026): the named causes, ;-joined (hard causes first, then soft notes).';
comment on column public.analyst_target_news.adj_target_checked is
  'A4 (3 Oct 2026): TARGET rows — target ÷ the splits after the note (public.splits); FMP adj_target lags recent splits.';
