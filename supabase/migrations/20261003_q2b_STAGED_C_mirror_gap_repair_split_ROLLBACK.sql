-- ROLLBACK · Q2b STAGED C (3 Oct 2026): remove the four split jobs, switch cron 256 back on (it will keep failing as before).
select cron.unschedule(jobid) from cron.job where jobname in ('mirror-gap-repair-1','mirror-gap-repair-2','mirror-gap-repair-3','mirror-gap-repair-4');
select cron.alter_job(256, active := true) where exists (select 1 from cron.job where jobid = 256 and jobname = 'mirror-gap-repair-daily');
