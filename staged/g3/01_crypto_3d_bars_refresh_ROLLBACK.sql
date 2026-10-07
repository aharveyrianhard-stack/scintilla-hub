-- G3 · ROLLBACK of 01_crypto_3d_bars_refresh.sql: stops the nightly job and removes the function.
-- The 3-day bars written since stay in ohlcv_history (they are real folds of real daily bars; deleting price rows
-- needs Alan). To remove them as well, Alan's word first, then:
--   delete from ohlcv_history where tf='3D' and source='resampled:D' and "timestamp" > 1786147200  -- after 8 Aug 2026
--     and ticker in (select ticker from tickers where type='crypto');
do $g3$
begin
  if not exists (select 1 from cron.job where jobname = 'crypto-3d-bars-nightly') then
    raise exception 'G3-01 rollback: crypto-3d-bars-nightly is not scheduled - nothing to undo';
  end if;
  perform cron.unschedule('crypto-3d-bars-nightly');
end
$g3$;
drop function if exists public.scin_refresh_3d_from_daily();
