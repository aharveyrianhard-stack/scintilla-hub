-- G3 · STAGED, NOT APPLIED · 5 Oct 2026 · 3-day bars for the nine coins are made again, every night
-- WHAT: a small function that folds each coin's daily bars into 3-day bars with the SAME database function that made
--   the existing ones (public.scin_resample_tf, source label 'resampled:D', buckets anchored on Mon 3 Jan 2000 UTC),
--   one first run that fills 11 Aug -> today, and a nightly job at 02:30 UTC - four minutes before the 3-day ribbon
--   job (cron 109, 02:34 UTC) reads them.
-- WHY [MEASURED 5 Oct 23:25Z]: every coin's newest 3-day bar is 8 Aug 2026. All of them were written in one batch on
--   11 Aug 19:51-20:04 UTC by scin_resample_tf, run by hand during the August backfill. No job ever made 3-day bars:
--   cron.job has none, and the only other writer (procedure rebuild_multiday_all, source 'DRV', last ran 29 Jun) is
--   not scheduled either. So nothing "died" on 8 Aug - nothing was ever set to repeat. The ribbon job still reads
--   those bars every night, pastes today's price onto the 8 Aug bar and stamps the reading as today's (weight 2.58).
-- WHY THIS AND NOT "aggregate daily x3 inside the ribbon job": the ribbon job is an edge function shared by all 600
--   names; changing it needs a deploy. This uses what already exists and is how the weekly bars are kept (cron 60
--   rebuild_weekly folds daily into weekly in the same table).
-- EFFECT ON WHAT THE HUB SHOWS: yes - the coins' 3-day reading, and through it their Geiger, from the next 02:34 UTC
--   ribbon run (dry run 5 Oct 23:30Z: BTC 3-day reading 0.96 -> 0.78). NEEDS ALAN'S WORD (3 Oct rule).
-- WRITES: rows of tf '3D' for the 9 coins in ohlcv_history (new rows for 11 Aug onward; the buckets since 30 Jun are
--   re-folded from the same daily bars, same values unless a daily bar was corrected since). No row is deleted.
--   A 3-day bar appears once its bucket holds 2 daily bars (scin_resample_tf's own floor), so the newest bar is at
--   most 4 days old at its start - inside the "two bar-lengths" freshness rule of file 03.
-- NEIGHBOURS CHECKED: cron 54 (hourly daily candles for coins, :23) feeds this; cron 109 ribbon-3d reads it at
--   02:34; cron 60 rebuild_weekly touches tf 'W' only; rebuild_multiday_all (unscheduled) would delete tf '3D' rows
--   if ever run by hand - do not run it; scin_resample_tf never overwrites a non-'resampled:' bar (the 122 'DRV'
--   bars to 27 Jun stay); the window start is cut on a bucket edge so no bucket is folded from part of its days.
-- ROLLBACK: 01_crypto_3d_bars_refresh_ROLLBACK.sql
do $g3$
begin
  if exists (select 1 from cron.job where jobname = 'crypto-3d-bars-nightly') then
    raise exception 'G3-01: crypto-3d-bars-nightly is already scheduled - nothing to do';
  end if;
  if to_regprocedure('public.scin_resample_tf(text,text,text,bigint)') is null then
    raise exception 'G3-01: public.scin_resample_tf(text,text,text,bigint) not found - read the database again before applying';
  end if;
end
$g3$;

create or replace function public.scin_refresh_3d_from_daily()
 returns integer
 language plpgsql
 set search_path to 'public'
as $fn$
declare
  t text;
  n integer := 0;
  -- start 120 days back, moved down to a 3-day bucket edge (same anchor as scin_resample_tf)
  p_from bigint := extract(epoch from (date '2000-01-03'
                     + ((((current_date - 120) - date '2000-01-03') / 3) * 3) * interval '1 day'))::bigint;
begin
  for t in select ticker from public.tickers where active and type = 'crypto' order by ticker loop
    n := n + public.scin_resample_tf(t, 'D', '3D', p_from);
  end loop;
  return n;
end
$fn$;
revoke all on function public.scin_refresh_3d_from_daily() from public, anon, authenticated;

select public.scin_refresh_3d_from_daily() as bars_written_first_fill;
select cron.schedule('crypto-3d-bars-nightly', '30 2 * * *', 'select public.scin_refresh_3d_from_daily()');
-- CHECK AFTER: select ticker, to_timestamp(max("timestamp"))::date from ohlcv_history
--   where tf='3D' and ticker in (select ticker from tickers where active and type='crypto') group by 1;  -- expect within 4 days of today
