-- Y4 rollback — takes Market Signal off the SCINTILLA channel list again. Videos already collected stay in
-- youtube_videos (remove them only on Alan's word):  delete from public.youtube_videos where channel_id = 'UCLSjYYwAX9cJKSxbUChPNKQ' and updated_ts >= <the apply time>;
update public.app_config
set value = jsonb_set(value::jsonb, '{ids}', coalesce((select jsonb_agg(x) from jsonb_array_elements(value::jsonb -> 'ids') x where x <> '"UCLSjYYwAX9cJKSxbUChPNKQ"'::jsonb), '[]'::jsonb))::text
where key = 'yt_sub_channels_scintilla' and coalesce(value, '') <> '' and (value::jsonb -> 'ids') ? 'UCLSjYYwAX9cJKSxbUChPNKQ';
delete from public.yt_sub_log where channel_id = 'UCLSjYYwAX9cJKSxbUChPNKQ' and action = 'feed_sub:scintilla' and channel_title = 'Market Signal';
