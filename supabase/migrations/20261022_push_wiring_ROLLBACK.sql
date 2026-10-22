-- 2026-10-22 · undo the wiring (the tables stay; 20261015_push_subscriptions_ROLLBACK.sql removes them and needs
-- `drop function if exists public.push_followed();` too).
select cron.unschedule('notify-push-events');
drop function if exists public.push_cron_key_ok(text);
delete from vault.secrets where name = 'scintilla_functions_key';
-- and redeploy notify-push v1 (git show b0528dd:supabase/functions/notify-push/index.ts) if the Vault check must go.
