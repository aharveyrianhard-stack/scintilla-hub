-- N1 · ROLLBACK of 05: exact. Before 05 every one of these rows was (delivered = false, channel = null),
-- and the marker text exists nowhere else, so this returns them to precisely that.
begin;
update public.feed_alerts
   set delivered = false, channel = null
 where channel = 'void — never sent (N1 2026-10-05)' and delivered is null;
commit;
-- CHECK AFTER: select count(*) from public.feed_alerts where delivered is false and channel is null;   -- 9352
