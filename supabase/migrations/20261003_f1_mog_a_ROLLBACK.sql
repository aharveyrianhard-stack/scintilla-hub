-- Rollback of 20261003_f1_mog_a.sql (MOG.A had no company_profile row and an empty fmp_symbol before it).
delete from public.company_profile where ticker = 'MOG.A';
update public.tickers set fmp_symbol = null where ticker = 'MOG.A' and fmp_symbol = 'MOG-A';
