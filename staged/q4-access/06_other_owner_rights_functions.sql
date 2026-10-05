-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
--
-- WHAT: 10 more functions run with the owner's rights and are callable with the public key. They rebuild,
--       de-duplicate or log (dedup_ohlcv deletes duplicate price bars; log_fmp writes the bandwidth log;
--       job_heartbeat_* run the job watchdog). None hands out data, but anyone can trigger them.
-- LEFT ALONE on purpose: autoconfirm_new_user, geiger_for_user, job_heartbeat_status_board, plant_library_refresh, scin_daily_span, scin_preflight, station_x_health_latest (a page calls it, it only reads, or it belongs to the Urth tools).
-- CLOSES: the public key triggering maintenance. BREAKS: nothing found in page code; jobs run as the owner.
-- CHECK FIRST: select oid::regprocedure from pg_proc where prosecdef and pronamespace='public'::regnamespace;
begin;
revoke execute on function public.dedup_ohlcv() from public, anon, authenticated;
grant  execute on function public.dedup_ohlcv() to service_role;
revoke execute on function public.job_health_audit() from public, anon, authenticated;
grant  execute on function public.job_health_audit() to service_role;
revoke execute on function public.job_heartbeat_check(timestamp with time zone) from public, anon, authenticated;
grant  execute on function public.job_heartbeat_check(timestamp with time zone) to service_role;
revoke execute on function public.job_heartbeat_collect() from public, anon, authenticated;
grant  execute on function public.job_heartbeat_collect() to service_role;
revoke execute on function public.job_heartbeat_judge(timestamp with time zone) from public, anon, authenticated;
grant  execute on function public.job_heartbeat_judge(timestamp with time zone) to service_role;
revoke execute on function public.log_fmp(text, integer, integer, integer, integer) from public, anon, authenticated;
grant  execute on function public.log_fmp(text, integer, integer, integer, integer) to service_role;
revoke execute on function public.scin_continuity_scan(text) from public, anon, authenticated;
grant  execute on function public.scin_continuity_scan(text) to service_role;
revoke execute on function public.scin_refresh_deep1m_coverage() from public, anon, authenticated;
grant  execute on function public.scin_refresh_deep1m_coverage() to service_role;
revoke execute on function public.scin_refresh_fundamentals_derived() from public, anon, authenticated;
grant  execute on function public.scin_refresh_fundamentals_derived() to service_role;
revoke execute on function public.scin_snapshot_composite() from public, anon, authenticated;
grant  execute on function public.scin_snapshot_composite() to service_role;
commit;
