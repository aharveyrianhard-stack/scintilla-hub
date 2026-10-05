-- N1 · 5 Oct 2026 · STAGED — NOT APPLIED. WAITS FOR ALAN: it overwrites two columns on 9,352 rows and
--       changes what the Station ALERTS panel prints (the words "· undelivered" go; "· void — never sent" appear).
--
-- WHAT: feed_alerts holds 9,352 rows, ids 1 → 9383, fired 18 Jun 13:38Z → 18 Sep 05:40Z, every one with
--       delivered = false and channel = null. "Undelivered" means only that: the column's default was never
--       changed, because no sender was ever built. They are old "feed X DOWN — stale N min" lines
--       (fundamentals 2,745 · equity_price 2,507 · analysts 1,367 · news 1,065 · events 1,041 · economic 352 ·
--       composite 144 · ribbon 116 · crypto_price 15). Nothing will ever deliver them.
-- THIS FILE: says so on the rows, without claiming a delivery that never happened:
--       delivered = NULL (neither sent nor waiting) and channel = a marker that names this change.
--       No row is removed; feed, status, age, message and time are untouched.
-- BREAKS: nothing. Any count of "delivered = false" drops from 9,352 to 0.
begin;
do $$
declare n bigint;
begin
  select count(*) into n from public.feed_alerts
   where delivered is false and channel is null and id <= 9383 and fired_ts < '2026-09-19T00:00:00Z';
  if n <> 9352 then raise exception 'expected 9,352 rows, found % — re-measure before applying', n; end if;
end $$;
update public.feed_alerts
   set delivered = null, channel = 'void — never sent (N1 2026-10-05)'
 where delivered is false and channel is null and id <= 9383 and fired_ts < '2026-09-19T00:00:00Z';
commit;
-- CHECK AFTER (read-only):
--   select delivered, channel, count(*) from public.feed_alerts group by 1, 2;   -- one line: null · void… · 9352
