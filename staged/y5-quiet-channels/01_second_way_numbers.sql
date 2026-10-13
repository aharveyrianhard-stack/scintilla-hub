-- Y5 (12 Oct 2026) — the second way's two numbers, in app_config.                NOT APPLIED. OPTIONAL.
--
-- The collector (yt-rss-sweep) reads a followed channel through its uploads list when YouTube's public feed
-- gives no answer and nothing has read the channel for more than an hour. How many it may ask is two numbers:
--   per_pass   channels in one pass                    default 6
--   per_day    calls in one Pacific day (1 unit each)  default 580
-- With NO row the defaults apply, so the function needs nothing applied to run. Apply this only to CHANGE a
-- number without a deploy; the next pass (≤ 5 min) uses it and the result row (yt_rss_result → fallback.budget)
-- says the numbers in force and "from": "app_config". The sweep reads this row and never writes it.
--
-- WHY 580 AND NOT 600. One allowance of 10,000 units a day is shared: the RADAR searches 79 × 101 = 7,979; this
-- sweep's own calls at their worst 288 × (1 + 4) = 1,440; that leaves 581. Measured on 12 Oct the sweep used about
-- 550, so 600 fits a real day with ~870 to spare — it is the worst day on paper that it overshoots, by 19.
-- If YouTube ever answers "quotaExceeded" the second way stops until midnight Pacific and says so.
--
-- Two more numbers may ride in the same row (both optional):
--   after_min    minutes a channel must be unread before the second way asks   default 60   (10 … 1440)
--   max_results  videos asked for in one call (the price is 1 unit whatever)   default 15   (1 … 50)
-- per_pass 0 or per_day 0 switches the second way OFF (the feed, the language fix and the rest carry on).
--
-- ADDITIVE: one new row. Expect "INSERT 0 1" (or "UPDATE 1" inside the upsert if the row exists).
insert into public.app_config (key, value)
values ('yt_rss_fallback', '{"per_pass":6,"per_day":580}')
on conflict (key) do update set value = excluded.value, updated_ts = now();

-- the switch, should it ever be wanted in a hurry (no deploy):
--   insert into public.app_config (key, value) values ('yt_rss_fallback', '{"per_day":0}')
--   on conflict (key) do update set value = excluded.value, updated_ts = now();
