-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
-- Restores today's state (PUBLIC, anon and authenticated may execute).
begin;
grant execute on function public.scin_dispatch(text, text, integer, jsonb, text, jsonb) to public, anon, authenticated;
grant execute on function public.scin_dispatch_reap() to public, anon, authenticated;
grant execute on function public.scin_record(text, text, bigint) to public, anon, authenticated;
commit;
