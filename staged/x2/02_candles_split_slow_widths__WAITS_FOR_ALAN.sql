-- X2 (SCI-67) · STAGED, NOT APPLIED · WAITS FOR ALAN (it changes how fresh some crypto bars are) · 5 Oct 2026
-- WHAT: split cron 53 (crypto-candles-1m) in two.
--   cron 53 keeps running every minute but asks Coinbase only for the 1-minute candles (g=60)
--     -> writes the 1m and 3m bars.
--   a new job crypto-candles-5m runs every 5 minutes (minute 4, 9, 14 ...) and asks for the
--     5-minute, 15-minute and hourly candles (g=300,900,3600)
--     -> writes the 5m, 10m, 15m, 30m, 1h, 2h, 3h, 4h bars.
-- WHY [MEASURED 5 Oct, 300 runs]: every minute the job downloads 20,218 candles in 36 Coinbase calls
--   and writes 286 rows. 27 of the 36 calls fetch 5m/15m/1h candles whose readers run every 5 minutes
--   or slower (ribbon-5m */5, ribbon-10m, ribbon-15m, ribbon-30m, ribbon-1h, 2h, 3h, 4h; the Hub board
--   reads 1h and 4h on page load).
-- SAVING [DERIVED from the measured run counts]: Coinbase calls 51,840 -> 20,736 a day (-31,104);
--   row writes about 286 -> about 104 a minute (about -262,000 a day).
-- COST: the 5m-and-wider crypto bars can be up to 5 minutes old instead of up to 1 minute. Prices are
--   not affected (the Hub ticks crypto from Coinbase's socket; live_quotes still updates every minute;
--   the ribbon job patches the newest close with the live price).
-- LIVENESS RULE (Alan, 3 Oct: "a little bit wrong rather than a little bit old"): this makes eight
--   crypto widths slightly older to save load that costs no money (Coinbase's public feed is free).
--   RECOMMENDATION: do not apply unless the database needs the room. Staged so it is one command if wanted.
-- NEIGHBOURS: (1) minute 4-59/5 is chosen so the fresh bars land one minute BEFORE ribbon-5m (*/5);
--   (2) job_heartbeat: job_heartbeat_collect() gives every cron job a row by itself (read 5 Oct:
--       "a job created tomorrow is watched tomorrow"), so the new job is watched without a manual step;
--   (3) geiger_for_user (a saved Equalizer may weight short widths) keeps working, on bars <= 5 min old;
--   (4) the crypto-candles function is unchanged (v10): with g=60 it derives only 3m, with
--       g=300,900,3600 it derives 10m, 30m, 2h, 3h, 4h - the same eleven widths as today in total;
--   (5) the bearer inside cron 53's command is copied inside the database by replace() - it is never
--       printed, and it is not in this file.
-- DRY CHECK (read-only, 5 Oct): the URL anchor occurs exactly twice, the job name once, no job named
--   crypto-candles-5m exists.
-- ROLLBACK: 02_candles_split_slow_widths_ROLLBACK.sql
do $x2$
declare
  c text;
  u_all  constant text := $m$crypto-candles?g=60,300,900,3600'$m$;
  u_fast constant text := $m$crypto-candles?g=60'$m$;
  u_slow constant text := $m$crypto-candles?g=300,900,3600'$m$;
begin
  select command into c from cron.job where jobid = 53 and jobname = 'crypto-candles-1m';
  if c is null then raise exception 'X2-02: cron 53 crypto-candles-1m not found'; end if;
  if (length(c) - length(replace(c, u_all, ''))) / length(u_all) <> 2 then
    raise exception 'X2-02: the command changed since 5 Oct - read it again before applying'; end if;
  if exists (select 1 from cron.job where jobname = 'crypto-candles-5m') then
    raise exception 'X2-02: crypto-candles-5m already exists'; end if;
  perform cron.schedule('crypto-candles-5m', '4-59/5 * * * *',
                        replace(replace(c, 'crypto-candles-1m', 'crypto-candles-5m'), u_all, u_slow));
  perform cron.alter_job(job_id := 53, command := replace(c, u_all, u_fast));
end
$x2$;
-- CHECK AFTER (10 minutes): newest bar per width for BTCUSD is no older than its width + 5 minutes:
--   select tf, to_timestamp(max(timestamp)) from ohlcv_history
--   where ticker='BTCUSD' and source='COINBASE' group by tf order by tf;
