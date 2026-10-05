-- N1 · 5 Oct 2026 · STAGED — NOT APPLIED. The coordinator applies. NOT RECOMMENDED YET — read BREAKS.
--
-- WHAT: cron 129 'feed-alerts-5m' runs public.check_feed_alerts() every 5 minutes (288 runs a day, all
--       "succeeded"). For each of the 10 feeds in feed_health that reads RED it writes one row into
--       feed_alerts, at most one per feed per 30 minutes. Nothing has read RED since 18 Sep 05:40Z, so it
--       has written nothing for 17 days. It never sends anything anywhere: no code sets delivered or channel.
-- THIS FILE: switches the job off the way 29 other jobs are switched off (active = false). The job row, its
--       history and the function stay. The dead-man's switch then reads PAUSED "switched off at the source"
--       for it — no LATE alarm, no message to Alan (job_heartbeat_judge, measured on the 29 paused jobs).
-- BREAKS: the Station ALERTS panel (alerts/index.html, FEED HEALTH section) is the one reader of
--       feed_alerts. It already shows "STALE"; with the writer off it can never show a new RED row.
--       The newer alarm route (feed_alarm, 13 feeds) does NOT watch news, fundamentals, analysts, events,
--       economic, ribbon or crypto_price under those names — so for those seven this writer is the only
--       record that one went RED. Stop it once they have a contract in feed_alarm, not before.
begin;
do $$
begin
  if not exists (select 1 from cron.job where jobid = 129 and jobname = 'feed-alerts-5m'
                 and command = 'select public.check_feed_alerts()') then
    raise exception 'cron 129 is not the measured feed-alerts-5m job — do not apply';
  end if;
end $$;
select cron.alter_job(129, active := false);
commit;
-- CHECK AFTER (read-only), ten minutes later:
--   select active from cron.job where jobid = 129;                                   -- false
--   select status, status_note from public.job_heartbeat where job = 'feed-alerts-5m';   -- PAUSED
