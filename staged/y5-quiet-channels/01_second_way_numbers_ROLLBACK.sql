-- Y5 rollback — back to the built-in numbers (6 a pass, 580 a day). Removes only the settings row.
delete from public.app_config where key = 'yt_rss_fallback';

-- The collector's own memory (written by the function, never by hand) can be removed too when the function
-- itself is rolled back; the older function neither reads nor writes it, and the newer one starts it again empty:
--   delete from public.app_config where key = 'yt_rss_health';
