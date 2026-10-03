-- Q2b (3 Oct 2026) · STAGED D — make 27 HTTP jobs record their REAL answer (not just "queued").
-- STATUS: NOT APPLIED (Alan's approval). Rollback: 20261003_q2b_STAGED_D_record_real_http_answers_ROLLBACK.sql
--
-- WHY. pg_cron marks a net.http_* job "succeeded" the moment the request is QUEUED; the answer (200, 500, timeout) lands
-- later in net._http_response and is deleted after 6 hours (pg_net ttl). 45 jobs already go through
-- scin_record(jobname, url, request_id) -> public.cron_dispatch, and scin_dispatch_reap (cron 207, every 2 min) copies the
-- real status there. 29 active jobs created since mid-August call net.http_* directly, so their failures vanish after
-- 6 h. Measured 3 Oct: sentiment-news-10m answered 500 "read news" 4 times in 6 h and nothing recorded it.
-- THE CHANGE. Each listed job's command becomes  select scin_record('<jobname>', '<function url>', <the same net.http_* call>)
-- — the call itself (URL, headers, body, timeout, its WHERE condition) is unchanged, character for character.
-- The rewrite runs INSIDE the database, so the bearer each command carries never leaves it; the originals are saved first
-- in scin_archive.q2b_cron_command_backup_20261003 (scin_archive is not reachable through the API).
-- NOT INCLUDED: 255 mirror-state-tables-daily (several calls in one command; works) and 256 (STAGED C replaces it).
-- PRACTICE: Prometheus/SRE — record the outcome of every run where the checker can read it; Supabase's own scheduling
-- guide uses pg_cron + pg_net and reads net._http_response for the result.
-- TESTED 3 Oct: every rewritten command passes EXPLAIN on the live database inside a READ ONLY transaction (27/27 parse
-- and plan; nothing executed) — see deliverables/20261003/q2b-jobs/sqltest/explain-D.sql.

do $$
declare r record; inner_call text; cond text; url text; newcmd text; n int := 0;
  targets int[] := array[18,220,221,222,223,227,228,232,261,262,263,264,266,267,268,270,271,272,278,279,280,281,282,283,284,285,286];
begin
  create table if not exists scin_archive.q2b_cron_command_backup_20261003 (
    jobid bigint primary key, jobname text not null, schedule text, command text not null, saved_at timestamptz not null default now());
  revoke all on scin_archive.q2b_cron_command_backup_20261003 from public, anon, authenticated;
  for r in select jobid, jobname, schedule, command from cron.job where jobid = any(targets) and command !~* 'scin_record' loop
    insert into scin_archive.q2b_cron_command_backup_20261003 (jobid, jobname, schedule, command)
    values (r.jobid, r.jobname, r.schedule, r.command) on conflict (jobid) do nothing;
    url := (regexp_match(r.command, '(https://[a-z0-9.-]+/functions/v1/[A-Za-z0-9_-]+)'))[1];
    -- one statement only: select net.http_xxx( ... ) [where <condition>] [;]
    if (regexp_replace(regexp_replace(r.command, '^\s+|\s+$', '', 'g'), ';\s*$', '')) ~ ';' then raise notice 'skip % (more than one statement)', r.jobid; continue; end if;
    inner_call := (regexp_match(regexp_replace(r.command, '^\s+|\s+$', '', 'g'), '^select\s+(net\.http_(?:post|get)\(.*\))\s*(?:where\s+(.*?))?\s*;?\s*$', 'is'))[1];
    cond       := (regexp_match(regexp_replace(r.command, '^\s+|\s+$', '', 'g'), '^select\s+(net\.http_(?:post|get)\(.*\))\s*(?:where\s+(.*?))?\s*;?\s*$', 'is'))[2];
    if inner_call is null or url is null then raise notice 'skip % (shape not recognised)', r.jobid; continue; end if;
    newcmd := 'select scin_record(' || quote_literal(r.jobname) || ', ' || quote_literal(url) || ', ' || inner_call || ')'
              || coalesce(' where ' || cond, '');
    execute 'explain ' || newcmd;   -- refuse to install a command that does not parse and plan
    perform cron.alter_job(r.jobid, command := newcmd);
    n := n + 1;
  end loop;
  raise notice 'rewrote % job commands', n;
end $$;
-- CHECK (no bearer printed): select jobid, jobname, command ~* 'scin_record' wrapped from cron.job where jobid in (18,220,221,222,223,227,228,232,261,262,263,264,266,267,268,270,271,272,278,279,280,281,282,283,284,285,286);
--        then in 10 min: select jobname, outcome, status_code from cron_dispatch where jobname in ('sentiment-news-10m','sentiment-news-backfill','prediction-markets') order by id desc limit 6;
