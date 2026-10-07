-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
--
-- WHAT: 11 Urth (landscaping) tables live in this database with no rules: client properties with names,
--       addresses and map coordinates; supplier contacts with emails and phones; the plant library.
--       Some already carry rules that were written but never switched on (17 dormant rules). Switching rules
--       on makes those take effect as their author meant, and adds a read rule where none exists.
-- CLOSES: writes to the plant library and its flags; deletes on site_marks and urth_cache.
-- STAYS OPEN (because a dormant rule says so): urth_properties and usable_plants — full write for the public key;
--       suppliers — full write for everyone; urth_cache and site_marks — add and change; urth_reviews — add.
--       Tightening those needs to know how the Urth tools sign in. That is a separate decision.
-- BREAKS: an Urth tool that writes plant_master / plant_flags / fl_invasive_ref / plant_library_spec with the
--         public key. No Scintilla code touches these tables; the Urth tools were not in scope for this audit.
begin;
alter table public."fl_invasive_ref" enable row level security;
alter table public."plant_flags" enable row level security;
alter table public."plant_library_spec" enable row level security;
alter table public."plant_master" enable row level security;
alter table public."plant_master_backup_predupe" enable row level security;
alter table public."site_marks" enable row level security;
alter table public."suppliers" enable row level security;
alter table public."urth_cache" enable row level security;
alter table public."urth_properties" enable row level security;
alter table public."urth_reviews" enable row level security;
alter table public."usable_plants" enable row level security;

commit;
