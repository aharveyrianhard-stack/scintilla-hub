-- X2 (SCI-67) · ROLLBACK of 01_cron61_quote_timeout_15s.sql · puts cron 61 back on pg_net's default 5 s.
do $x2$
declare
  c text;
  a constant text := $m$headers:='{"Content-Type":"application/json"}'::jsonb)$m$;
  b constant text := $m$headers:='{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds:=15000)$m$;
begin
  select command into c from cron.job where jobid = 61 and jobname = 'crypto-coinbase-1m';
  if c is null then raise exception 'X2-01 rollback: cron 61 not found'; end if;
  if position(b in c) = 0 then raise exception 'X2-01 rollback: the 15 s timeout is not there - nothing to undo'; end if;
  perform cron.alter_job(job_id := 61, command := replace(c, b, a));
end
$x2$;
