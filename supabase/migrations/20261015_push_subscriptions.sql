-- 2026-10-15 · N2 — NOTIFICATIONS THAT REACH ALAN. The table the browser's push subscription lands in, the log that
-- keeps the rate at one push a minute, the quiet window, and the three events, each as a plain sentence.
--
-- WHY. Alan, 15 Oct: "the bell icon goes from a certain number to a number higher and I barely even notice. If there's
-- any way to trigger an actual notification would be nice … something more like notification center that pops up on
-- my computer … forwarded to my notification center across devices."
--
-- WHAT THIS ADDS (additive; nothing existing is altered):
--   public.push_subscriptions  one row per device that clicked "Allow notifications" (endpoint + the two keys the
--                              browser hands out). RLS on. The anon key (what the Hub runs with) may INSERT a row and
--                              DELETE its own; it may NOT read the table, so the endpoints never travel to a browser.
--                              The service role (edge function `notify-push`) reads and prunes.
--   public.push_log            every push the estate sent or declined, with the reason. The one-a-minute rule and the
--                              de-duplication ("this transcript was already announced") both read it.
--   push_quiet_now()           true between 22:00 and 06:30 New York time (Alan's quiet window), every day.
--   push_can_send_now()        false when a push went out in the last 60 seconds, or during the quiet window.
--   news_usual_per_hour(t)     a name's usual headline rate: its headlines over the trailing 14 days / 336 hours.
--   news_bursts_now()          the names whose last-hour count is at least 3x usual (and at least 3), with the numbers.
--   push_events_pending()      the three events, as rows of (kind, key, title, body, url), newest first, excluding any
--                              key already in push_log:
--                                1. "A transcript arrived for <TICKER>" — earnings_transcript_watch.status = 'in' for a
--                                   universe name (ticker_cohorts), stored in the last 24 h.
--                                2. "<TICKER> reported: EPS <x> vs <est>" — earnings_events.eps_actual set, date within
--                                   the last 3 days (so a backfill of old quarters can never flood the phone).
--                                3. "<TICKER>: <n> headlines in the last hour (usual <u>/h)" — news_bursts_now().
--
-- NOT SCHEDULED, NOT WIRED. This migration creates objects only. No cron, no trigger, no call to the function. The
-- coordinator wires it (see deliverables/20261015/n2-news/N2-NEWS.html for the exact two lines) when Alan says so.
--
-- ROLLBACK (exact): supabase/migrations/20261015_push_subscriptions_ROLLBACK.sql
-- COST. news_usual_per_hour reads 14 days of one name's rows through the published_ts/ticker path; news_bursts_now()
-- reads the last hour (a few dozen rows) and calls it for each name seen in that hour. Never run more than once a minute.

create table if not exists public.push_subscriptions (
  endpoint    text primary key,                 -- the push service URL the browser hands out (fcm.googleapis.com / web.push.apple.com …)
  p256dh      text not null,                    -- the browser's public key (base64url), used to encrypt each payload for this device only
  auth        text not null,                    -- the browser's auth secret (base64url)
  device      text,                             -- what the person called it when allowing: "iMac Brave app", "iPhone", …
  ua          text,                             -- the browser's own description of itself, for telling devices apart
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz,                      -- the last time the push service accepted a message for it
  last_error  text,                             -- the push service's last refusal (status + first 120 chars)
  failures    int not null default 0            -- consecutive refusals; 404/410 prune the row at once
);
comment on table public.push_subscriptions is 'N2 (15 Oct 2026): one row per device that allowed Hub notifications. Written by the browser (anon insert), read by notify-push (service role) only.';

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions: a browser may add its own" on public.push_subscriptions;
create policy "push_subscriptions: a browser may add its own" on public.push_subscriptions
  for insert to anon, authenticated with check (endpoint like 'https://%' and length(p256dh) between 80 and 120 and length(auth) between 16 and 32);
drop policy if exists "push_subscriptions: a browser may remove its own" on public.push_subscriptions;
create policy "push_subscriptions: a browser may remove its own" on public.push_subscriptions
  for delete to anon, authenticated using (true);    -- a DELETE must name the endpoint (PostgREST refuses an unfiltered delete); knowing an endpoint is knowing the device
-- no select policy for anon/authenticated on purpose: the service role bypasses RLS and is the only reader
grant insert, delete on public.push_subscriptions to anon, authenticated;

create table if not exists public.push_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  kind        text not null,                    -- transcript | actual | burst | test | manual
  key         text not null,                    -- de-duplication key, e.g. transcript|MU|2026-09-23
  title       text not null,
  body        text,
  url         text,
  sent        int not null default 0,           -- subscriptions the push service accepted
  failed      int not null default 0,
  declined    text                              -- why nothing was sent: 'quiet window' | 'rate limit' | null when sent
);
create index if not exists push_log_at_idx on public.push_log (at desc);
create unique index if not exists push_log_key_sent_idx on public.push_log (key) where declined is null;   -- one announcement per key, ever
alter table public.push_log enable row level security;   -- no policies: service role only
comment on table public.push_log is 'N2 (15 Oct 2026): every push sent or declined, with the reason. The rate limit and the de-duplication read it.';

create or replace function public.push_quiet_now() returns boolean language sql stable as $$
  select (now() at time zone 'America/New_York')::time >= time '22:00'
      or (now() at time zone 'America/New_York')::time <  time '06:30';
$$;

create or replace function public.push_can_send_now() returns boolean language sql stable as $$
  select not public.push_quiet_now()
     and not exists (select 1 from public.push_log where declined is null and at > now() - interval '60 seconds');
$$;

create or replace function public.news_usual_per_hour(t text) returns numeric language sql stable as $$
  select round(count(*)::numeric / 336, 2)
    from public.news
   where ticker = t
     and published_ts >= extract(epoch from now() - interval '14 days')::bigint
     and published_ts <  extract(epoch from now() - interval '1 hour')::bigint;
$$;

create or replace function public.news_bursts_now()
returns table (ticker text, last_hour bigint, usual numeric, ratio numeric) language sql stable as $$
  with h as (
    select n.ticker, count(*) as last_hour
      from public.news n
     where n.published_ts >= extract(epoch from now() - interval '1 hour')::bigint
       and n.ticker <> '_MARKET'
     group by n.ticker
    having count(*) >= 3
  )
  select h.ticker, h.last_hour, u.usual,
         case when u.usual > 0 then round(h.last_hour / u.usual, 1) else null end as ratio
    from h, lateral (select public.news_usual_per_hour(h.ticker) as usual) u
   where h.last_hour >= 3 * greatest(u.usual, 1)      -- 3x usual, and a usual under one an hour counts as one
   order by h.last_hour desc;
$$;

create or replace function public.push_events_pending()
returns table (kind text, key text, title text, body text, url text, at timestamptz) language sql stable as $$
  with ev as (
    -- 1. a transcript arrived for a universe name
    select 'transcript'::text as kind,
           'transcript|' || w.ticker || '|' || w.event_date::text as key,
           'A transcript arrived for ' || w.ticker as title,
           coalesce(w.stored_quarter, '') || ' earnings call, ' || to_char(w.event_date, 'Mon DD') ||
             case when w.report_time is not null then ' ' || w.report_time else '' end as body,
           'https://scintillahub.ai/#earnings' as url,
           w.stored_at as at
      from public.earnings_transcript_watch w
     where w.status = 'in'
       and w.stored_at > now() - interval '24 hours'
       and exists (select 1 from public.ticker_cohorts c where c.ticker = w.ticker)
    union all
    -- 2. an earnings actual landed
    select 'actual', 'actual|' || e.ticker || '|' || e.date::text,
           e.ticker || ' reported: EPS ' || to_char(e.eps_actual, 'FM999990.00') ||
             case when e.eps_estimate is not null then ' vs ' || to_char(e.eps_estimate, 'FM999990.00') || ' expected' else '' end,
           case when e.beat is not null then (case when e.beat then 'Beat' else 'Miss' end) ||
                case when e.surprise_pct is not null then ' by ' || to_char(abs(e.surprise_pct), 'FM990.0') || '%' else '' end
                else null end ||
             case when e.revenue_actual is not null then ' · revenue ' || to_char(e.revenue_actual / 1e9, 'FM999990.00') || 'B' else '' end,
           'https://scintillahub.ai/#past-reported',
           to_timestamp(e.updated_ts)
      from public.earnings_events e
     where e.eps_actual is not null
       and e.date >= current_date - 3
       and e.superseded_at is null
       and exists (select 1 from public.ticker_cohorts c where c.ticker = e.ticker)
    union all
    -- 3. a name's headlines in the last hour are 3x its usual
    select 'burst', 'burst|' || b.ticker || '|' || to_char(date_trunc('hour', now() at time zone 'UTC'), 'YYYY-MM-DD"T"HH24'),
           b.ticker || ': ' || b.last_hour || ' headlines in the last hour',
           'usual ' || coalesce(b.usual::text, '0') || ' an hour' || case when b.ratio is not null then ' · ' || b.ratio || 'x' else '' end,
           'https://scintillahub.ai/preview/news/#' || b.ticker,
           now()
      from public.news_bursts_now() b
  )
  select ev.kind, ev.key, ev.title, ev.body, ev.url, ev.at
    from ev
   where not exists (select 1 from public.push_log l where l.key = ev.key and l.declined is null)
   order by ev.at desc;
$$;
