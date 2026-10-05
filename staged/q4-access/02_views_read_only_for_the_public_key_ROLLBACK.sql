-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
-- Restores today's state.
begin;
grant insert, update, delete, truncate on
  public."all_tickers",
  public."classification_compare",
  public."cohorts",
  public."coldstore_current",
  public."current_rules",
  public."data_audit_current",
  public."data_health",
  public."econ_dashboard",
  public."econ_series_health",
  public."fan_cohort_daily",
  public."fmp_usage_now",
  public."macro_feed_health",
  public."minute_coverage",
  public."ohlcv_daily_adj",
  public."ohlcv_dedup",
  public."pivot_union",
  public."plant_library",
  public."plant_library_mv",
  public."scin_1min_map",
  public."scin_coverage_by_tf",
  public."series_health",
  public."series_stats",
  public."station_coverage",
  public."stream_health",
  public."stream_health_recent",
  public."ticker_classification",
  public."ticker_cohorts",
  public."ticker_groups",
  public."ts_chart_lines_current",
  public."ts_chart_pivots_current",
  public."tzfix_progress",
  public."v_fundamentals_coverage",
  public."v_fundamentals_universe",
  public."v_rollup_freshness",
  public."youtube_feed"
to anon, authenticated;
commit;
