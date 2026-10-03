-- Q2b (3 Oct 2026) · STAGED B — move four HTTP jobs off the minutes where every job fires at once.
-- STATUS: NOT APPLIED (Alan's approval). Rollback: 20261003_q2b_STAGED_B_stagger_busy_minutes_ROLLBACK.sql
--
-- MEASURED (cron_dispatch, 24 h to 3 Oct 15:00Z): of 1,804 calls fired at :00/:15/:30/:45, 168 never got an answer
-- (9.3%); of 10,292 calls at any other minute, 30 (0.3%). Every one of those "timeouts" spent its whole time before
-- connecting ("DNS time 5000 ms") — the request never reached the function. Expected HTTP calls per hour by minute:
-- :00 22, :30 21, :40 17, :20 16, :10 15, :50 15 … :01 4, :13 4, :43 4.
--   stats-engine-30m   48 calls, 7 answered (15%)  — pg_net default 5 s wait, fires at :00/:30
--   ribbon-d-3m        96 calls, 22 answered (23%) — default 5 s wait, fires at :00/:15/:30/:45
--   audit-engine-15m   96 calls, 77 answered (80%) — 120 s wait, still cut off at the quarter hours
--   health-monitor-5m 288 calls, 261 answered (91%)
-- A fifth move tests one hypothesis: sentiment-news-10m's read of `news` answered 500 on its :40 run in 4 of the last
-- 6 hours (10:40 12:40 13:40 14:40Z; every other minute fine), and :40 is when `vacuum (analyze) ohlcv_history` runs
-- (cron 236, ~10 s). Moving the vacuum to :43 (no sentiment run then) shows within a day whether that is the cause.
--
-- PRACTICE: spread scheduled work off the top of the hour (GitHub Actions docs warn of high load at the start of every hour;
-- Fly's own --schedule is deliberately "fuzzy" for the same reason, docs.fly.io/machines/flyctl/fly-machine-run); healthchecks.io judges by the schedule, so the heartbeat
-- (job_heartbeat.collect reads cron.job each tick) follows the new minutes with no change.
-- NEIGHBOURS checked: nothing reads these outputs at a fixed minute (ribbon_signals, statistics, feed_health are read on
-- demand); the heartbeat re-reads schedules; no other job depends on their order.

select cron.alter_job(7,   schedule := '1-59/15 * * * *') where exists (select 1 from cron.job where jobid = 7   and jobname = 'ribbon-d-3m'       and schedule = '*/15 * * * *');
select cron.alter_job(28,  schedule := '13,43 * * * *')   where exists (select 1 from cron.job where jobid = 28  and jobname = 'stats-engine-30m'  and schedule = '*/30 * * * *');
select cron.alter_job(62,  schedule := '2-59/15 * * * *') where exists (select 1 from cron.job where jobid = 62  and jobname = 'audit-engine-15m'  and schedule = '*/15 * * * *');
select cron.alter_job(8,   schedule := '3-59/5 * * * *')  where exists (select 1 from cron.job where jobid = 8   and jobname = 'health-monitor-5m' and schedule = '*/5 * * * *');
select cron.alter_job(236, schedule := '43 * * * *')      where exists (select 1 from cron.job where jobid = 236 and jobname = 'vacuum-ohlcv-hourly' and schedule = '40 * * * *');

-- CHECK after a day: select * from cron_dispatch_health where jobname in ('ribbon-d-3m','stats-engine-30m','audit-engine-15m','health-monitor-5m');
