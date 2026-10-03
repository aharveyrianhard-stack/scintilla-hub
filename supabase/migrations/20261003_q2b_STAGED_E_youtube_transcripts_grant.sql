-- Q2b (3 Oct 2026) · STAGED E — a missing read grant that would hide YouTube transcripts from the YouTube sentiment scorer.
-- STATUS: NOT APPLIED (a privilege change: Alan's approval). Rollback: 20261003_q2b_STAGED_E_youtube_transcripts_grant_ROLLBACK.sql
-- MEASURED: service_role has no privilege on public.youtube_transcripts (anon/authenticated/chatbot_ro may SELECT).
-- The edge function sentiment-youtube (cron 263, every 6 h) reads it and swallows any error (`.catch(() => [])`), so a
-- refused read looks exactly like "no transcripts". Today the table holds 0 rows, so nothing is lost yet; the first
-- transcript loaded would be silently ignored. Same family as the sigma-daily grant found 28 Sep (since fixed).
grant select on public.youtube_transcripts to service_role;
