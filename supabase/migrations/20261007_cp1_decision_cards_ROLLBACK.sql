-- 2026-10-07 · CP1 DECISION CARDS — rollback for 20261007_cp1_decision_cards.sql.
-- Removes the two tables and their policies and nothing else. No page reads them until Alan approves the wiring, so no
-- screen goes blank. Plan fields typed into cards are lost with decision_card_plans: export them first if they matter
-- (select * from public.decision_card_plans order by set_at).
drop policy if exists decision_card_plans_insert_anon on public.decision_card_plans;
drop policy if exists decision_card_plans_read_all on public.decision_card_plans;
drop table if exists public.decision_card_plans;
drop policy if exists decision_cards_read_all on public.decision_cards;
drop table if exists public.decision_cards;
