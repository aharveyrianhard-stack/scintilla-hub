-- Y6 rollback of the day's number — back to the row that was in force on 12 Oct 2026 beside the stopgap.
insert into public.app_config (key, value)
values ('yt_rss_fallback', '{"per_pass":6,"per_day":450}')
on conflict (key) do update set value = excluded.value, updated_ts = now();

-- To go back to the built-in numbers instead (6 a pass, 580 a day):
--   delete from public.app_config where key = 'yt_rss_fallback';
