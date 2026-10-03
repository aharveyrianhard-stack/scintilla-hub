-- Rollback of 20261003_u4b_mog_a_fmp_symbol.sql: empties the one field it filled (only if it still holds that value).
update public.tickers set fmp_symbol = null where ticker = 'MOG.A' and fmp_symbol = 'MOG-A';
