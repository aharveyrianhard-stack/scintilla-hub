-- X2 (SCI-67) · STAGED, NOT APPLIED · 5 Oct 2026
-- WHAT: give cron 61 (crypto-coinbase-1m) 15 seconds to hear its answer instead of pg_net's default 5.
-- WHY [MEASURED 5 Oct 21:36Z]: the function makes 18 calls to Coinbase one after another and answers
--   in about 3-4 s (median 3.20 s). The job's command names no timeout, so pg_net gives up at 5,000 ms
--   (pg_net README: default timeout_milliseconds = 5000). 104 of 10,080 runs in 7 days (1.03 %) were
--   marked "timeout" although the function finished and wrote its 9 prices. Those marks are false
--   errors in cron_dispatch and in job_heartbeat.last_detail.
-- EFFECT ON WHAT THE HUB SHOWS: none. Same job, same minute, same rows.
-- NEIGHBOURS CHECKED: dispatch-reap-2m (cron 207) only records answers; job_heartbeat row
--   'crypto-coinbase-1m' fail_after 3 / grace 15 min - unchanged; 15 s is well under the 60 s cadence,
--   so two runs never overlap; no credential is in this command (it carries only a Content-Type).
-- DRY CHECK (read-only, 5 Oct): anchor found exactly once; no timeout present.
-- ROLLBACK: 01_cron61_quote_timeout_15s_ROLLBACK.sql
do $x2$
declare
  c text;
  a constant text := $m$headers:='{"Content-Type":"application/json"}'::jsonb)$m$;
  b constant text := $m$headers:='{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds:=15000)$m$;
begin
  select command into c from cron.job where jobid = 61 and jobname = 'crypto-coinbase-1m';
  if c is null then raise exception 'X2-01: cron 61 crypto-coinbase-1m not found'; end if;
  if position('timeout_milliseconds' in c) > 0 then raise exception 'X2-01: a timeout is already set - nothing to do'; end if;
  if position(a in c) = 0 then raise exception 'X2-01: the command changed since 5 Oct - read it again before applying'; end if;
  perform cron.alter_job(job_id := 61, command := replace(c, a, b));
end
$x2$;
-- CHECK AFTER: select position('timeout_milliseconds:=15000' in command) > 0 from cron.job where jobid = 61;
--   then, an hour later: select count(*) filter (where timed_out) from cron_dispatch
--   where jobname='crypto-coinbase-1m' and dispatched_at > now() - interval '1 hour';   -- expect 0
