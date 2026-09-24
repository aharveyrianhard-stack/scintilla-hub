-- Rollback for 20260924_trendoscope_events.sql. Drops only what that migration created.
drop policy if exists trendoscope_event_clusters_read on trendoscope_event_clusters;
drop policy if exists trendoscope_raw_events_read     on trendoscope_raw_events;
drop index if exists trendoscope_clusters_market_idx;
drop index if exists trendoscope_raw_events_settings_idx;
drop index if exists trendoscope_raw_events_pattern_idx;
drop index if exists trendoscope_raw_events_market_idx;
drop table if exists trendoscope_event_clusters;
drop table if exists trendoscope_raw_events;
