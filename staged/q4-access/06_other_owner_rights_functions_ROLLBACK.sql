-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
-- Restores today's effect (PUBLIC, the public key and signed-in users may execute). job_heartbeat_* had no explicit list
-- before (PUBLIC by default); the grants below give the same result.
begin;
grant execute on function public.dedup_ohlcv() to public, anon, authenticated;
grant execute on function public.job_health_audit() to public, anon, authenticated;
grant execute on function public.job_heartbeat_check(timestamp with time zone) to public, anon, authenticated;
grant execute on function public.job_heartbeat_collect() to public, anon, authenticated;
grant execute on function public.job_heartbeat_judge(timestamp with time zone) to public, anon, authenticated;
grant execute on function public.log_fmp(text, integer, integer, integer, integer) to public, anon, authenticated;
grant execute on function public.scin_continuity_scan(text) to public, anon, authenticated;
grant execute on function public.scin_refresh_deep1m_coverage() to public, anon, authenticated;
grant execute on function public.scin_refresh_fundamentals_derived() to public, anon, authenticated;
grant execute on function public.scin_snapshot_composite() to public, anon, authenticated;
commit;
