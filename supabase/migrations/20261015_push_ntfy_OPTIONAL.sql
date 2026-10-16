-- 2026-10-15 · N2 — ROUTE (b), OPTIONAL: the same three sentences by ntfy.sh instead of (or beside) Web Push.
-- NOT APPLIED. Written so the comparison in deliverables/20261015/n2-news/N2-NEWS.html is runnable, not a sketch.
--
-- WHAT A THIRD PARTY SEES. ntfy.sh (a public, open-source relay in Germany, free, no account) receives and keeps for 12 h:
-- the topic name, the title, the body and the click URL of every message — i.e. "MU: 5 headlines in the last hour",
-- "NVDA reported: EPS 1.05 vs 1.01 expected", "A transcript arrived for TSM" — plus the database's IP. Anyone who
-- knows the topic name can read the stream, so the topic is a long random secret held in Vault, never in this file.
-- The Hub's own Web Push route (notify-push) sends every payload encrypted to the device; Google's and Apple's push
-- services carry bytes they cannot read. That difference is why Web Push is the recommended route.
--
-- SETUP (coordinator, once, value never in git):  select vault.create_secret('<a long random topic>', 'scintilla_ntfy_topic');
-- DEVICES: the ntfy app (iOS App Store / Mac: the web app at ntfy.sh, or the Android/desktop apps), subscribe to the topic.
-- ROLLBACK (exact):  drop function if exists public.push_ntfy(text, text, text, text);
--                    select cron.unschedule('push-ntfy-events') where exists (select 1 from cron.job where jobname = 'push-ntfy-events');
create extension if not exists pg_net;

create or replace function public.push_ntfy(title text, body text, url text default null, priority text default 'default')
returns bigint language plpgsql as $$
declare topic text; rid bigint;
begin
  select decrypted_secret into topic from vault.decrypted_secrets where name = 'scintilla_ntfy_topic';
  if topic is null then raise exception 'scintilla_ntfy_topic is not in Vault'; end if;
  select net.http_post(
    url     := 'https://ntfy.sh/' || topic,
    headers := jsonb_build_object('Title', title, 'Priority', priority, 'Click', coalesce(url, 'https://scintillahub.ai/'), 'Tags', 'bell'),
    body    := coalesce(body, '')::jsonb,          -- pg_net sends jsonb; a bare string body is sent as its JSON text
    timeout_milliseconds := 8000) into rid;
  return rid;
end $$;

-- THE SAME RULES AS WEB PUSH, THE SAME SENTENCES: one a minute, the quiet window, one announcement per key — all through
-- push_log, exactly as notify-push does, so the two routes can never both announce the same event.
-- To wire (NOT done):  select cron.schedule('push-ntfy-events', '* * * * *', $$
--   with ev as (select * from public.push_events_pending() limit 1)
--   insert into public.push_log (kind, key, title, body, url, sent, declined)
--   select ev.kind, ev.key, ev.title, ev.body, ev.url,
--          case when public.push_can_send_now() then 1 else 0 end,
--          case when public.push_quiet_now() then 'quiet window' when not public.push_can_send_now() then 'rate limit' end
--     from ev where public.push_can_send_now() and public.push_ntfy(ev.title, ev.body, ev.url) is not null;
-- $$);
