-- M70 (24 Sep 2026) — a nullable note on each calendar row saying whether its three numbers agreed on a
-- scale. ADDITIVE: one nullable column, no default, no backfill, no existing value touched.
-- It is only useful once the fmp-economic loader writes it (see fmp-economic-PROPOSAL.md); until then it
-- stays null and nothing reads it. econ_calendar_unified computes the same verdict without it.
alter table public.econ_calendar add column if not exists unit_rule text;
comment on column public.econ_calendar.unit_rule is
  'M70: "as supplied" | "rescaled to <field>" | "ambiguous" - the same-scale trio verdict for this row. The actual/estimate/previous values are always the supplier''s own.';
-- ROLLBACK
-- alter table public.econ_calendar drop column if exists unit_rule;
