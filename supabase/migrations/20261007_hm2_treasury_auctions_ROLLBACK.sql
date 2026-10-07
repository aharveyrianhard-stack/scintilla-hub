-- Rollback of 20261007_hm2_treasury_auctions.sql and 20261007_hm2_treasury_auctions_cron.sql (HM2, 7 Oct 2026).
-- Written BEFORE the migration. Removes the two schedules (if they were ever created), the policy and the table.
-- Nothing else reads or depends on this table: the Hub's auctions card prints "not stored yet" when it is absent.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobname) from cron.job where jobname in ('treasury-auctions-results', 'treasury-auctions-daily');
  end if;
end $$;
drop policy if exists treasury_auctions_anon_read on public.treasury_auctions;
drop table if exists public.treasury_auctions;
