-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
-- Restores the state after 03 (readable by anyone).
begin;
create policy q4_public_read on public."data_location_registry" for select to anon, authenticated using (true);
create policy q4_public_read on public."edge_function_inventory" for select to anon, authenticated using (true);
create policy q4_public_read on public."estate_identity" for select to anon, authenticated using (true);
create policy q4_public_read on public."fmp_streaming_notes" for select to anon, authenticated using (true);
create policy q4_public_read on public."geiger_rollback_20260815" for select to anon, authenticated using (true);
create policy q4_public_read on public."known_open_items" for select to anon, authenticated using (true);
create policy q4_public_read on public."preflight_log" for select to anon, authenticated using (true);
create policy q4_public_read on public."relay_escalations" for select to anon, authenticated using (true);
create policy q4_public_read on public."relay_inbox" for select to anon, authenticated using (true);
create policy q4_public_read on public."relay_orders" for select to anon, authenticated using (true);
create policy q4_public_read on public."rule_enforcement" for select to anon, authenticated using (true);
create policy q4_public_read on public."scin_consolidation_plan" for select to anon, authenticated using (true);
create policy q4_public_read on public."scin_data_stores" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_blockers" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_findings" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_fmp_ledger" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_fmp_research_map" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_function_rollback" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_lane_topology" for select to anon, authenticated using (true);
create policy q4_public_read on public."sprint_volume_deps" for select to anon, authenticated using (true);
commit;
