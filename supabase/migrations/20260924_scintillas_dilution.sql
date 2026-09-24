-- 2026-09-24 · M59 DILUTION — a filing that hands out new shares becomes a scintilla.
--
-- WHY. Alan, 23 Sep, on Beyond Meat's 8-K: "Convertible note… I love those." A company can issue
-- new shares — convertible notes, an offering, an at-the-market programme, a private placement, or
-- notes handed back in exchange for stock. When it does, every share already held owns a little
-- less of the company. That is a signal about the company, and until now the Hub could not see it.
--
-- WHAT THIS CHANGES. ONE thing: the list of kinds public.scintillas will accept. The table, its
-- columns, its indexes, its policy and every stored row are untouched. No row is read, rewritten,
-- renamed or deleted by this migration.
--
-- WHY IT IS A CONSTRAINT REPLACEMENT AND NOT A NEW COLUMN. scintillas_kind_ck names the allowed
-- kinds in one CHECK. Adding a kind means restating that CHECK with one more name in it. The new
-- constraint is a strict SUPERSET of the old one: every row that passed before passes now, so the
-- validation scan cannot fail on existing data.
--
-- WHAT A DILUTION ROW MEANS.
--   subject     the ticker whose share count can grow
--   direction   always -1: more shares is bad news for every share already held
--   magnitude   NULL, on purpose. Every other kind's magnitude is "how far past its OWN usual" —
--               a company has no usual convertible note, so no such number exists here and none is
--               invented. The size lives in detail.pct_of_shares_out.
--   detail      the filing's own words and arithmetic: form, item numbers, accession number, the
--               SEC link, what was sold, at what price, the discount to the last close, the shares
--               it can add, the shares outstanding it is measured against, and the sentence the
--               numbers were read from — so any row can be checked against the filing by eye.
--   dedupe_key  'dilution|TICKER|<accession number>' — one row per filing, for ever. Re-running the
--               detector over the same day cannot produce a second row.
--
-- ROLLBACK (exact) — in supabase/migrations/20260924_scintillas_dilution_ROLLBACK.sql:
--     delete from public.scintillas where kind = 'dilution';
--     alter table public.scintillas drop constraint scintillas_kind_ck;
--     alter table public.scintillas add constraint scintillas_kind_ck check (kind in
--       ('price_outlier','earnings_surprise','econ_surprise','econ_imminent','sentiment_spike','breadth_thrust'));
--   The delete comes first because the narrower constraint cannot be added while dilution rows exist.
--   It removes only rows this feature wrote; nothing else in the table is read or changed.

alter table public.scintillas drop constraint if exists scintillas_kind_ck;
alter table public.scintillas add constraint scintillas_kind_ck check (kind in
  ('price_outlier','earnings_surprise','econ_surprise','econ_imminent','sentiment_spike','breadth_thrust','dilution'));

comment on constraint scintillas_kind_ck on public.scintillas is
  'The kinds of scintilla the detectors write. dilution (M59) is a filing that issues shares; its magnitude is NULL because a company has no "usual" issuance to measure against, and its size is detail.pct_of_shares_out.';
