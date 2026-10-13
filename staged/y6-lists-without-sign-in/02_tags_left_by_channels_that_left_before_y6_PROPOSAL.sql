-- Y6 PROPOSAL (13 Oct 2026) — the tags left behind by channels that left a list BEFORE Y6.      NOT APPLIED.
-- NEEDS ALAN'S WORD: it changes what a feed shows. Nothing here is run by the collector.
--
-- WHAT IT IS ABOUT.  From Y6 on, when a channel leaves an account's list the collector takes that account's tag
-- off the channel's stored videos at that moment. It does not go back over the past: before Y6 nothing ever took
-- a tag off, so the videos of every channel unfollowed earlier still carry the tag and still sit in that feed.
-- Measured on the live table, 13 Oct 04:25Z (read-only):
--     669 stored videos carry a tag whose channel is on none of that account's lists
--       666 tagged personal   (20 channels; videos published Dec 2025 – 23 Sep 2026)
--         3 tagged scintilla  ( 1 channel)
--     479 of them would be left with no tag at all; 190 keep another list's tag.
--
-- THE JUDGE IS THE SAVED LIST, and for four accounts it cannot be refreshed without a sign-in (three keep their
-- subscriptions private, one answers empty): for those, "left" means "was not on the list at the last sign-in,
-- 30 Sep". A channel followed again since then on one of those accounts is not on its saved list either — so
-- LOOK at step 1 before step 3, and leave out any channel that should stay.
-- A channel that rides with the SCINTILLA list (app_config yt_bridge_channels) counts as on it.

-- 1 · LOOK FIRST (read-only): which channels, under which account, how many videos, how recent
select t.account, v.channel_id, max(v.channel_title) as channel, count(*) as videos, max(v.published_at) as newest
  from public.youtube_videos v cross join lateral unnest(v.subscription_accounts) as t(account)
 where not exists (select 1 from public.app_config a
                    where a.key = 'yt_sub_channels_' || t.account
                      and (case when a.key like 'yt_sub_channels_%' then a.value::jsonb -> 'ids' end) ? v.channel_id)
   and not (t.account = 'scintilla' and exists (
              select 1 from public.app_config b cross join lateral jsonb_array_elements(
                       case when b.key <> 'yt_bridge_channels' then '[]'::jsonb
                            when jsonb_typeof(b.value::jsonb) = 'array' then b.value::jsonb
                            else coalesce(b.value::jsonb -> 'channels', b.value::jsonb -> 'rows', b.value::jsonb -> 'ids', '[]'::jsonb) end) e
               where b.key = 'yt_bridge_channels' and coalesce(e ->> 'channel_id', e #>> '{}') = v.channel_id))
 group by 1, 2 order by 1, 4 desc;

-- 2 · KEEP WHAT IS THERE, so that it can be put back exactly: the id and the tags of every row step 3 will touch
create table if not exists public.yt_tags_before_y6_cleanup as
select v.video_id, v.channel_id, v.subscription_accounts, now() as saved_at
  from public.youtube_videos v
 where exists (select 1 from unnest(v.subscription_accounts) as t(account)
                where not exists (select 1 from public.app_config a
                                   where a.key = 'yt_sub_channels_' || t.account
                                     and (case when a.key like 'yt_sub_channels_%' then a.value::jsonb -> 'ids' end) ? v.channel_id)
                  and not (t.account = 'scintilla' and exists (
                             select 1 from public.app_config b cross join lateral jsonb_array_elements(
                                      case when b.key <> 'yt_bridge_channels' then '[]'::jsonb
                                           when jsonb_typeof(b.value::jsonb) = 'array' then b.value::jsonb
                                           else coalesce(b.value::jsonb -> 'channels', b.value::jsonb -> 'rows', b.value::jsonb -> 'ids', '[]'::jsonb) end) e
                              where b.key = 'yt_bridge_channels' and coalesce(e ->> 'channel_id', e #>> '{}') = v.channel_id))));
-- expect "SELECT 669" (the number moves as videos arrive; it must match step 1's total)

-- 3 · TAKE THE TAGS OFF: each row keeps exactly the tags whose list still carries its channel. One column; no row deleted.
update public.youtube_videos v
   set subscription_accounts = coalesce((
         select array_agg(t.account order by t.ord)
           from unnest(v.subscription_accounts) with ordinality as t(account, ord)
          where exists (select 1 from public.app_config a
                         where a.key = 'yt_sub_channels_' || t.account
                           and (case when a.key like 'yt_sub_channels_%' then a.value::jsonb -> 'ids' end) ? v.channel_id)
             or (t.account = 'scintilla' and exists (
                   select 1 from public.app_config b cross join lateral jsonb_array_elements(
                            case when b.key <> 'yt_bridge_channels' then '[]'::jsonb
                                 when jsonb_typeof(b.value::jsonb) = 'array' then b.value::jsonb
                                 else coalesce(b.value::jsonb -> 'channels', b.value::jsonb -> 'rows', b.value::jsonb -> 'ids', '[]'::jsonb) end) e
                    where b.key = 'yt_bridge_channels' and coalesce(e ->> 'channel_id', e #>> '{}') = v.channel_id))), '{}')
 where v.video_id in (select video_id from public.yt_tags_before_y6_cleanup);
-- expect "UPDATE 669" — the same number as step 2. (Run as a SELECT on 13 Oct 04:26Z this expression changed 669 rows
-- and took 669 tags off: 479 rows left with none, 190 keeping another list's tag.)

-- ROLLBACK — every tag exactly as it was, then the keepsake table gone:
--   update public.youtube_videos v set subscription_accounts = k.subscription_accounts
--     from public.yt_tags_before_y6_cleanup k where k.video_id = v.video_id;
--   drop table public.yt_tags_before_y6_cleanup;
