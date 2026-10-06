-- Y4 (6 Oct 2026) — Market Signal back on the SCINTILLA channel list.            NOT APPLIED. The coordinator applies it.
--
-- Alan: "Market Signal posted 11 hours ago — Micron, WDC, Seagate — I don't see it on the grid."
-- Measured 6 Oct 13:20Z: the channel UCLSjYYwAX9cJKSxbUChPNKQ ("Market Signal") was last collected on 10 Sep
-- (its newest row in youtube_videos is 9 Sep); YouTube's public feed for it lists 15 videos since 18 Sep, the
-- newest "Micron, WDC & Seagate - Wall Street May Be Getting This Wrong" (6 Oct 01:43Z); none is in the table, and
-- the collector reported rss_failed 0 — so the channel is in no list the collector reads.
--
-- ADDITIVE: one channel id appended to the saved list (app_config.yt_sub_channels_scintilla, the JSON
-- {"ids":[…],"ts":…} the collector reads every pass). Nothing is removed or reordered. The next pass (≤ 5 min)
-- reads the channel's feed and writes its 15 videos. Expect "UPDATE 1"; "UPDATE 0" means the id is already
-- there or the row is absent (then use the Station's own Subscribe door instead — see the report).
update public.app_config
set value = jsonb_set(value::jsonb, '{ids}', (value::jsonb -> 'ids') || '["UCLSjYYwAX9cJKSxbUChPNKQ"]'::jsonb)::text
where key = 'yt_sub_channels_scintilla'
  and coalesce(value, '') <> ''
  and jsonb_typeof(value::jsonb -> 'ids') = 'array'
  and not ((value::jsonb -> 'ids') ? 'UCLSjYYwAX9cJKSxbUChPNKQ');

insert into public.yt_sub_log (channel_id, channel_title, action)
select 'UCLSjYYwAX9cJKSxbUChPNKQ', 'Market Signal', 'feed_sub:scintilla'
where not exists (select 1 from public.yt_sub_log where channel_id = 'UCLSjYYwAX9cJKSxbUChPNKQ' and action = 'feed_sub:scintilla');
