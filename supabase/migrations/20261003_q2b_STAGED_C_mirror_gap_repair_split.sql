-- Q2b (3 Oct 2026) · STAGED C — the nightly backup gap repair has never run: split it so it can.
-- STATUS: NOT APPLIED (Alan's approval). Rollback: 20261003_q2b_STAGED_C_mirror_gap_repair_split_ROLLBACK.sql
--
-- MEASURED: cron 256 'mirror-gap-repair-daily' (05:30 UTC) failed on all 14 nights pg_cron still remembers (20 Sep -> 3 Oct),
-- each after ~140 s: "canceling statement due to statement timeout". Its command is four net.http_get calls separated by
-- pg_sleep(20), pg_sleep(160), pg_sleep(160) = 340 s of sleeping, while the server's statement_timeout is 120 s.
-- pg_cron sends the whole command as ONE query, which PostgreSQL runs as one transaction and times as one statement
-- (postgresql.org/docs/current/protocol-flow.html "Multiple Statements in a Simple Query"; runtime-config-client
-- statement_timeout). When it is cancelled the transaction rolls back — and pg_net's queued requests roll back with it
-- (pg_net queues inside the caller's transaction; github.com/supabase/pg_net). So not one of the four repair calls has
-- been sent in at least 14 nights, and pg_cron's "failed" was the only trace.
--
-- FIX: one job per call, at the same spacing (0 s, ~1 min, ~3 min, ~6 min), each recording its real HTTP answer through
-- scin_record (cron_dispatch, read by the heartbeat). The old job is switched OFF (definition kept), not deleted.
-- NOTE FOR ALAN: switching this on starts four backup-repair calls a night that have not run for >= 2 weeks
-- (table-to-r2 for ribbon_signals and three passes of ohlcv_history; writes only to the R2 backup).

select cron.alter_job(256, active := false) where exists (select 1 from cron.job where jobid = 256 and jobname = 'mirror-gap-repair-daily');
select cron.schedule('mirror-gap-repair-1', '30 5 * * *',
  $c$select scin_record('mirror-gap-repair-1', 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ribbon_signals', net.http_get('https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ribbon_signals&pause=250','{}'::jsonb,'{}'::jsonb,240000))$c$);
select cron.schedule('mirror-gap-repair-2', '31 5 * * *',
  $c$select scin_record('mirror-gap-repair-2', 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ohlcv_history', net.http_get('https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ohlcv_history&pause=250','{}'::jsonb,'{}'::jsonb,240000))$c$);
select cron.schedule('mirror-gap-repair-3', '33 5 * * *',
  $c$select scin_record('mirror-gap-repair-3', 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ohlcv_history', net.http_get('https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ohlcv_history&pause=250','{}'::jsonb,'{}'::jsonb,240000))$c$);
select cron.schedule('mirror-gap-repair-4', '36 5 * * *',
  $c$select scin_record('mirror-gap-repair-4', 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ohlcv_history', net.http_get('https://wadinxqplrggagkvrdag.supabase.co/functions/v1/table-to-r2?table=ohlcv_history&pause=250','{}'::jsonb,'{}'::jsonb,240000))$c$);
-- CHECK tomorrow 05:45 UTC: select jobname, outcome, status_code from cron_dispatch where jobname like 'mirror-gap-repair-%' order by id desc limit 4;
