-- ROLLBACK · Q2b (3 Oct 2026) · job heartbeat ("one dead-man's switch for every job")
-- Drops exactly what supabase/migrations/20261003_job_heartbeat.sql creates on branch hub/q2b-keepalives-20261003:
--   cron job 'job-heartbeat-check-5m'                        (the checker's own schedule)
--   public.job_heartbeat_check / _collect / _judge / _ping / _status_board / _cron_prev_fire / _cron_field  (functions)
--   public.job_heartbeat, public.job_heartbeat_state, public.job_heartbeat_event   (new tables)
--   feed_alarm rows named 'job:%'   (only exist if publish_alarms was switched on; written by nothing else)
-- Nothing else is touched: cron jobs, cron_dispatch, feed_contract, ibkr_gateway_watch_config stay as they are.
--
-- Run from the linked folder, one statement at a time or as one string:
--   cd "/Users/alanharvey/SCINTILLA 0.5/_deploy/s6link" && supabase db query --linked --project-ref wadinxqplrggagkvrdag "<the lines below>"

select cron.unschedule(jobid) from cron.job where jobname = 'job-heartbeat-check-5m';
delete from public.feed_alarm where feed like 'job:%';
drop function if exists public.job_heartbeat_check(timestamptz);
drop function if exists public.job_heartbeat_judge(timestamptz);
drop function if exists public.job_heartbeat_collect();
drop function if exists public.job_heartbeat_ping(text, boolean, text, text);
drop function if exists public.job_heartbeat_status_board();
drop function if exists public.job_heartbeat_cron_prev_fire(text, timestamptz);
drop function if exists public.job_heartbeat_cron_field(text, integer, integer);
drop table if exists public.job_heartbeat_event;
drop table if exists public.job_heartbeat_state;
drop table if exists public.job_heartbeat;
