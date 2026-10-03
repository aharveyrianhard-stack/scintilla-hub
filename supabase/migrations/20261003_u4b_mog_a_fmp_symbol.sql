-- U4b (3 Oct 2026) · STAGED, NOT APPLIED. Fills one EMPTY field from a stated source (additive, pre-approved class):
-- public.tickers.fmp_symbol for MOG.A (Moog Inc. Class A, admitted 29 Sep in v3). FMP knows the line only as 'MOG-A'
-- (/stable/profile?symbol=MOG-A → Moog Inc., NYSE, USD; 'MOG.A' and 'MOGA' return no row — read 3 Oct on a throw-away
-- Fly machine). fmp-backfill (job=profile) asks FMP for tickers.fmp_symbol when one is set, so after this row the
-- profile call `fmp-backfill?job=profile&sym=MOG.A` writes company_profile for MOG.A. fmp-fundamentals does NOT read
-- fmp_symbol yet (its statements need a code change). Rollback: 20261003_u4b_mog_a_fmp_symbol_ROLLBACK.sql.
do $$
declare n int;
begin
  update public.tickers set fmp_symbol = 'MOG-A'
   where ticker = 'MOG.A' and fmp_symbol is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'expected to fill exactly one empty fmp_symbol for MOG.A, filled %', n; end if;
end $$;
