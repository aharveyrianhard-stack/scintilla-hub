-- Trendoscope statistical evaluation: additive storage for Phase 0/1.
-- ADDITIVE ONLY: two new tables, no change to any existing table, no price table touched.
-- The coordinator applies this; this session does not run migrations.
--
-- Raw events are immutable and are NEVER deduplicated (packet §3, §7). Clustering lives in the
-- derived table and always preserves member provenance.

create table if not exists trendoscope_raw_events (
  event_id                text primary key,
  detector_family         text not null,
  detector_source_sha256  text not null,
  library_versions        jsonb not null,
  settings                jsonb not null,
  settings_sha256         text not null,
  capture_run_id          text not null,
  extractor_version       text not null,
  symbol                  text not null,
  feed                    text not null,
  exchange                text,
  asset_class             text not null check (asset_class in ('equity','etf','futures','crypto','fx','other')),
  source_timeframe        text not null,
  session_mode            text not null,
  timezone                text not null,
  adjustment_mode         text not null,
  price_scale             text not null check (price_scale in ('linear','log')),
  tick_size               double precision,
  pattern_type_id         integer not null check (pattern_type_id between 1 and 13),
  pattern_name            text not null,
  shape_group             text not null check (shape_group in ('channel','wedge','triangle')),
  direction_family        text not null check (direction_family in ('rising','falling','non_directional')),
  formation_dynamics      text not null check (formation_dynamics in ('parallel','expanding','contracting')),
  zigzag_lane             integer check (zigzag_lane between 1 and 4),
  zigzag_level            integer,
  pivot_count             integer not null check (pivot_count in (5,6)),
  pivots                  jsonb not null,
  upper_rail              jsonb not null,
  lower_rail              jsonb not null,
  formation_start_index   integer not null,
  formation_start_epoch   bigint  not null,
  formation_end_index     integer not null,
  formation_end_epoch     bigint  not null,
  confirmed_at_index      integer not null,
  confirmed_at_epoch      bigint  not null,
  first_observed_at       bigint  not null,
  last_observed_at        bigint,
  coordinate_status       text not null check (coordinate_status in ('resolved','partial','unresolved')),
  missing_reason          text,
  raw_primitive_evidence  jsonb,
  inserted_at             timestamptz not null default now(),
  -- confirmation is never backdated to an anchor (packet §6.2, §11)
  constraint trendoscope_confirmation_not_backdated check (confirmed_at_epoch >= formation_end_epoch),
  constraint trendoscope_missing_reason_required check (coordinate_status = 'resolved' or missing_reason is not null)
);
create index if not exists trendoscope_raw_events_market_idx
  on trendoscope_raw_events (symbol, source_timeframe, session_mode, confirmed_at_epoch);
create index if not exists trendoscope_raw_events_pattern_idx
  on trendoscope_raw_events (pattern_type_id, shape_group, confirmed_at_epoch);
create index if not exists trendoscope_raw_events_settings_idx
  on trendoscope_raw_events (settings_sha256, detector_source_sha256);

create table if not exists trendoscope_event_clusters (
  pattern_cluster_id      text primary key,
  cluster_rule_version    text not null,
  symbol                  text not null,
  feed                    text not null,
  source_timeframe        text not null,
  session_mode            text not null,
  adjustment_mode         text not null,
  price_scale             text not null,
  shape_group             text not null,
  member_event_ids        text[] not null,
  member_count            integer not null check (member_count >= 1),
  exact_identity_count    integer not null,
  representative_event_id text not null references trendoscope_raw_events(event_id),
  cluster_weight          numeric not null default 1,
  members_provenance      jsonb not null,
  transform_version       text not null,
  derived_features        jsonb,
  built_at                timestamptz not null default now()
);
create index if not exists trendoscope_clusters_market_idx
  on trendoscope_event_clusters (symbol, source_timeframe, session_mode, shape_group);

-- Read-only exposure, consistent with the rest of the estate: RLS on, select only.
alter table trendoscope_raw_events      enable row level security;
alter table trendoscope_event_clusters  enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'trendoscope_raw_events' and policyname = 'trendoscope_raw_events_read') then
    create policy trendoscope_raw_events_read on trendoscope_raw_events for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'trendoscope_event_clusters' and policyname = 'trendoscope_event_clusters_read') then
    create policy trendoscope_event_clusters_read on trendoscope_event_clusters for select using (true);
  end if;
end $$;
