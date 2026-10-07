-- HM2 (7 Oct 2026) · the two schedules that keep public.treasury_auctions current. STAGED: apply only after the
-- function is deployed (supabase functions deploy treasury-auctions --no-verify-jwt --project-ref wadinxqplrggagkvrdag).
-- Same shape as the treasury-curve jobs (scin_record + net.http_post, no token: the function reads a free source and
-- writes one table by name with its own service role).
--   treasury-auctions-results  every 5 min 17:00-17:55Z Mon-Fri = 13:00-13:55 ET in summer (12:00-12:55 ET in winter —
--                              the 18Z hour is covered too) — the result lands about three minutes after the deadline.
--   treasury-auctions-daily    12:10Z Mon-Fri — new announcements (sizes) and anything a results run missed.
-- NEIGHBOURS CHECKED: no other job writes this table; treasury-curve-daily (08:35Z) and treasury-curve-evening
-- (21-23Z) write treasury_rates only; fmp-economic (05:47/17:47Z, hourly :05) writes econ_calendar only. The 17:47Z
-- fmp-economic run and a 17:45Z auctions run are two different functions on two different sources.
-- Rollback: 20261007_hm2_treasury_auctions_ROLLBACK.sql (unschedules both).
select cron.schedule('treasury-auctions-results', '*/5 17-18 * * 1-5', $$
  select scin_record('treasury-auctions-results', 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/treasury-auctions',
    net.http_post(url := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/treasury-auctions?days=10',
                  headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 60000))
$$);
select cron.schedule('treasury-auctions-daily', '10 12 * * 1-5', $$
  select scin_record('treasury-auctions-daily', 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/treasury-auctions',
    net.http_post(url := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/treasury-auctions?days=45',
                  headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 60000))
$$);
