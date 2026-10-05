-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
-- Restores today's state (no rules; the dormant rules stay written but inactive).
begin;

alter table public."fl_invasive_ref" disable row level security;
alter table public."plant_flags" disable row level security;
alter table public."plant_library_spec" disable row level security;
alter table public."plant_master" disable row level security;
alter table public."plant_master_backup_predupe" disable row level security;
alter table public."site_marks" disable row level security;
alter table public."suppliers" disable row level security;
alter table public."urth_cache" disable row level security;
alter table public."urth_properties" disable row level security;
alter table public."urth_reviews" disable row level security;
alter table public."usable_plants" disable row level security;
commit;
