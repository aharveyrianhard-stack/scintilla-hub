-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
--
-- WHAT: three job-plumbing functions run with the database owner's rights and can be called by anyone holding the
--       public key. scin_dispatch makes the DATABASE send a web request to any address with any headers and body.
-- CLOSES: the public key (and any signed-up user) calling them. Scheduled jobs run as the owner and keep working;
--         edge functions use the service key and keep working (granted explicitly below).
-- BREAKS: nothing found — no Hub, Station or provider page calls these three.
-- CHECK FIRST: the argument lists below match the live functions:
--   select oid::regprocedure from pg_proc where proname in ('scin_dispatch','scin_record','scin_dispatch_reap');
begin;
revoke execute on function public.scin_dispatch(text, text, integer, jsonb, text, jsonb) from public, anon, authenticated;
grant  execute on function public.scin_dispatch(text, text, integer, jsonb, text, jsonb) to service_role;
revoke execute on function public.scin_dispatch_reap() from public, anon, authenticated;
grant  execute on function public.scin_dispatch_reap() to service_role;
revoke execute on function public.scin_record(text, text, bigint) from public, anon, authenticated;
grant  execute on function public.scin_record(text, text, bigint) to service_role;
commit;
