-- ROLLBACK · Q2b STAGED B (3 Oct 2026): the five schedules as they were on 3 Oct.
select cron.alter_job(7,   schedule := '*/15 * * * *') where exists (select 1 from cron.job where jobid = 7   and jobname = 'ribbon-d-3m');
select cron.alter_job(28,  schedule := '*/30 * * * *') where exists (select 1 from cron.job where jobid = 28  and jobname = 'stats-engine-30m');
select cron.alter_job(62,  schedule := '*/15 * * * *') where exists (select 1 from cron.job where jobid = 62  and jobname = 'audit-engine-15m');
select cron.alter_job(8,   schedule := '*/5 * * * *')  where exists (select 1 from cron.job where jobid = 8   and jobname = 'health-monitor-5m');
select cron.alter_job(236, schedule := '40 * * * *')   where exists (select 1 from cron.job where jobid = 236 and jobname = 'vacuum-ohlcv-hourly');
