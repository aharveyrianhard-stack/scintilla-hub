-- X2 (SCI-67) · ROLLBACK of 02_candles_split_slow_widths__WAITS_FOR_ALAN.sql
-- Removes crypto-candles-5m and gives cron 53 its four candle sizes back, every minute, as on 5 Oct.
do $x2$
declare
  c text;
  u_all  constant text := $m$crypto-candles?g=60,300,900,3600'$m$;
  u_fast constant text := $m$crypto-candles?g=60'$m$;
begin
  if exists (select 1 from cron.job where jobname = 'crypto-candles-5m') then
    perform cron.unschedule('crypto-candles-5m');
  end if;
  select command into c from cron.job where jobid = 53 and jobname = 'crypto-candles-1m';
  if c is null then raise exception 'X2-02 rollback: cron 53 not found'; end if;
  if position(u_all in c) > 0 then return; end if;            -- already the original command
  if position(u_fast in c) = 0 then raise exception 'X2-02 rollback: unexpected command - read it'; end if;
  perform cron.alter_job(job_id := 53, command := replace(c, u_fast, u_all));
end
$x2$;
