-- ROLLBACK for 20261002_prediction_topic_proposals.sql (P2, 2 Oct 2026). Removes only what P2 added.
-- The collector, its tables, topics.json and cron 278 are not touched. If the edge function was deployed, it is
-- removed separately:  supabase functions delete prediction-topic-proposals --project-ref wadinxqplrggagkvrdag
drop table if exists public.prediction_topic_proposals;
