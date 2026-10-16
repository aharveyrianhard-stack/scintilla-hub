-- 2026-10-15 · N2 — ROLLBACK for 20261015_push_subscriptions.sql (written before the migration, as the house does).
-- Removes everything that migration adds and nothing else. Nothing in the Hub reads these objects today, so dropping
-- them cannot blank a room. Subscriptions already stored are lost with the table: every device then needs its one
-- "Allow notifications" click again (Alan's click, on each device).
drop function if exists public.push_events_pending();
drop function if exists public.push_quiet_now();
drop function if exists public.push_can_send_now();
drop function if exists public.news_usual_per_hour(text);
drop function if exists public.news_bursts_now();
drop table if exists public.push_log;
drop table if exists public.push_subscriptions;
