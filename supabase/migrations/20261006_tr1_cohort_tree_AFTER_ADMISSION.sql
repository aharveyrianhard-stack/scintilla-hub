-- TR1 · run ONLY after the ten index funds are admitted and /universe lists them (the universe sitting's last step).
-- Writes only the two TR1 tables: marks the pending funds served and hands the spine to the fund that was waiting.
begin;
update public.cohort_tree_members set status = 'served' where status = 'pending_admission';
update public.cohort_tree set spine_fund = spine_fund_next, spine_fund_next = null where spine_fund_next is not null;
commit;
-- way back:  re-run 20261006_tr1_cohort_tree_LOAD.sql (it restores the loaded state exactly)
