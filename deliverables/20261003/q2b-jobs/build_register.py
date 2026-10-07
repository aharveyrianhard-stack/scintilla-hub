#!/usr/bin/env python3
"""Q2b (3 Oct 2026): build jobs.json — one row per job that must run on time — from the measured evidence in ./evidence.
Evidence was read read-only on 3 Oct 2026 ~15:00Z (Supabase: cron.job, cron.job_run_details, cron_dispatch, output tables;
Fly: machines list + the scheduled machines' own final log lines; MacBook: launchctl). No command text or key is stored."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
EV = os.path.join(HERE, 'evidence')
load = lambda f: json.load(open(os.path.join(EV, f)))
cron = load('cron_jobs_sanitised.json')
runs = {r['jobid']: r for r in load('runs72.json')}
disp = {r['jobname']: r for r in load('dispatch24.json')}
board = {r['job']: r for r in load('board.json')}
MEASURED_AT = '2026-10-03T15:00Z'

REF = {
  'hc': 'healthchecks.io docs — period + grace, alert on state change (https://healthchecks.io/docs/)',
  'prom': 'Prometheus instrumentation — "The key metric of a batch job is the last time it succeeded" (https://prometheus.io/docs/practices/instrumentation/#batch-jobs)',
  'sre': 'Google SRE, Monitoring Distributed Systems — "Every page should be actionable" (https://sre.google/sre-book/monitoring-distributed-systems/)',
  'pgnet': 'pg_net README — requests queued, answered later in net._http_response, ttl 6 h, default timeout 5000 ms (https://github.com/supabase/pg_net)',
  'pgcron': 'pg_cron README — job_run_details status/return_message; purge it yourself (https://github.com/citusdata/pg_cron)',
  'sbcron': 'Supabase, Scheduling Edge Functions — pg_cron + pg_net, token in Vault (https://supabase.com/docs/guides/functions/schedule-functions)',
  'pgtimeout': 'PostgreSQL statement_timeout — applied per statement since PG13 (https://www.postgresql.org/docs/current/runtime-config-client.html)',
  'airflow': 'Airflow best practices — tasks are transactions, idempotent, never incomplete results (https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html)',
  'flysched': 'Fly docs, fly machine run — --schedule starts the Machine on a "fuzzy" hourly/daily cycle; restart no/always/on-fail (https://docs.fly.io/machines/flyctl/fly-machine-run)',
  'promfor': 'Prometheus alerting rules — `for` (pending) and keep_firing_for (https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)',
  'dagster': 'Dagster freshness checks — an asset overdue for refresh is a failed check (https://docs.dagster.io/examples/best-practices/asset-health-monitoring)',
}

# Plain words for the jobs that matter most (the rest get a rule-based sentence from what they call).
NOTE = {
  'news-feed-1m': ('the news wire', 'Every minute pulls new headlines into the news table the Hub tape reads.', 'public.news', 'Hub news tape'),
  'health-monitor-5m': ('the old health monitor', 'Every 5 min checks feed ages and writes feed_health.', 'public.feed_health', 'nobody alarms on it'),
  'ribbon-d-3m': ('the daily ribbon painter', 'Every 15 min recomputes the daily ribbon (trend bands) for every stock.', 'public.ribbon_signals (tf=D)', 'Hub ribbons / board'),
  'stats-engine-30m': ('the statistics clerk', 'Every 30 min recomputes z-scores and percentiles per stock.', 'public.statistics (has no time column)', 'Hub STATS'),
  'audit-engine-15m': ('the old auditor', 'Every 15 min runs the audit-engine checks.', 'audit tables', 'unclear'),
  'mirror-gap-repair-daily': ('the backup repairman', 'Nightly 05:30 UTC should re-send ribbon_signals and ohlcv_history to the R2 backup.', 'R2 backup (nothing — never runs)', 'the backup'),
  'mirror-tables-r2-1': ('the backup clerk (1)', 'Nightly copies database tables to the R2 backup, chunk 1.', 'R2 tables/ + mirror_progress', 'disaster recovery'),
  'mirror-tables-r2-2': ('the backup clerk (2)', 'Nightly copies database tables to the R2 backup, chunk 2.', 'R2 tables/ + mirror_progress', 'disaster recovery'),
  'mirror-tables-r2-3': ('the backup clerk (3)', 'Nightly copies database tables to the R2 backup, chunk 3.', 'R2 tables/ + mirror_progress', 'disaster recovery'),
  'mirror-audit-nightly': ('the backup inspector', 'Nightly compares each backed-up table with the database (rows, columns, a sample).', 'public.mirror_audit', 'nobody alarms on it'),
  'mirror-state-tables-daily': ('the state-table copier', 'Nightly copies small live-state tables to R2.', 'R2', 'disaster recovery'),
  'sentiment-news-10m': ('the news-mood reader', 'Every 10 min scores new headlines for mood per stock.', 'news_headline_sentiment, sentiment_ticker_daily', 'Hub sentiment'),
  'sentiment-news-backfill': ('the news-mood back-filler', 'Every 5 min scores older headlines (finished; answers "finished").', 'sentiment_backfill_state', 'Hub sentiment history'),
  'sentiment-youtube-6h': ('the YouTube-mood reader', 'Every 6 h scores YouTube videos per stock (titles; transcripts if readable).', 'youtube_video_sentiment', 'Hub sentiment'),
  'sentiment-x-2h': ('the X-mood reader', 'Every 2 h scores new X posts from the X-feed collector.', 'x_post_sentiment (last 28 Sep)', 'Hub sentiment'),
  'scintillas-detect-intraday': ('the spark spotter', 'Every 10 min in session finds unusual moves ("scintillas").', 'public.scintillas', 'Hub TODAY\'S SCINTILLAS tape'),
  'scintillas-detect-session': ('the spark spotter (close)', 'After the close records the session\'s scintillas.', 'public.scintillas', 'Hub tape'),
  'heartbeat-daily': ('the ticker pulse clerk', 'After the close writes each stock\'s daily pulse.', 'ticker_heartbeat_daily', 'Hub'),
  'putcall-aggregate-minute': ('the put/call adder', 'Every minute in session turns IBKR option volume into the put/call minute.', 'ibkr_putcall_minute', 'Hub put/call'),
  'putcall-aggregate-close': ('the put/call closer', 'After the close writes the day\'s put/call.', 'putcall_daily', 'Hub'),
  'putcall-vs-cboe-morning': ('the put/call cross-checker', 'Each morning compares our put/call with Cboe\'s.', 'putcall_vs_cboe', 'coordinator'),
  'putcall-minute-session-check': ('the put/call watch', 'Every 5 min in session raises an alarm if no put/call minute arrived.', 'feed_alarm ibkr_putcall_session', 'alarm route'),
  'provider-frame-currentness-check': ('the intraday watch', 'Every 5 min asks the chart API whether intraday frames are current; alarms + ntfy on change.', 'feed_alarm provider_intraday_frames', 'Alan by ntfy'),
  'ibkr-gateway-watch-1m': ('the gateway watch', 'Every minute checks the IB Gateway feed is alive; ntfy on change.', 'ibkr_gateway_watch_log', 'Alan by ntfy'),
  'prediction-markets': ('the odds reader', 'Every 15 min on weekdays (hourly otherwise) reads Polymarket odds.', 'prediction_market_snapshots/runs', 'Hub PREDICTION MARKETS'),
  'sigma-daily': ('the sigma counter', 'After the close adds the day\'s sigma events.', 'sigma_events_daily, sigma_day_counts', 'Hub'),
  'sigma-daily-catchup': ('the sigma counter (catch-up)', 'Next morning fills any missed sigma day.', 'sigma tables', 'Hub'),
  'analyst-revisions-nightly': ('the analyst-notes reader', 'Nightly reads new analyst target/rating notes.', 'analyst_target_news, price_target_summary_daily', 'Hub ESTIMATES'),
  'analyst-revisions-morning': ('the analyst-notes reader (morning)', 'Weekday mornings reads overnight notes.', 'analyst_target_news', 'Hub'),
  'analyst-estimates-daily': ('the estimates keeper', 'Nightly saves the day\'s EPS/revenue estimates so history exists.', 'analyst_estimates_daily', 'Hub ESTIMATES'),
  'offering-watch-nightly': ('the dilution watch', 'Nightly reads new share-offering filings from the SEC.', 'offering_filings', 'Hub CAPITAL & DILUTION'),
  'offering-watch-morning': ('the dilution watch (morning)', 'Weekday mornings reads overnight filings.', 'offering_filings', 'Hub'),
  'unlock-watch-nightly': ('the lock-up watch', 'Nightly checks IPO lock-up dates.', 'ipo_lockups', 'Hub EARNINGS'),
  'youtube-feed-20m': ('the YouTube scout', 'Every 20 min searches for new videos.', 'youtube_videos', 'Hub/Station YouTube'),
  'yt-rss-sweep-5m': ('the YouTube RSS sweeper', 'Every 5 min reads subscribed channels\' feeds.', 'youtube_videos', 'Hub/Station YouTube'),
  'dispatch-reap-2m': ('the switchboard recorder', 'Every 2 min copies each recorded HTTP job\'s real answer (200/500/timeout) into cron_dispatch.', 'public.cron_dispatch', 'the heartbeat checker'),
  'purge-cron-history-daily': ('the shredder', 'Daily deletes pg_cron run history older than 14 days.', 'cron.job_run_details', '—'),
  'purge-cron-dispatch-daily': ('the shredder (answers)', 'Daily deletes recorded answers older than 14 days.', 'cron_dispatch', '—'),
  'feed-watchdog-10m': ('the freshness watchdog', 'Every 10 min compares each feed table\'s newest row with its allowed age; writes feed_alarm.', 'feed_alarm', 'Hub alarm list'),
  'feed-alerts-5m': ('the old alert writer', 'Every 5 min writes feed_alerts rows — 9,352 stored, 0 ever delivered, nothing new since 18 Sep.', 'feed_alerts', 'nobody'),
  'guardrail-jobhealth-30m': ('the old job auditor', 'Every 30 min looks for >= 3 failures of one job inside an hour (blind to nightly jobs); 0 rows in 7 days.', 'guardrail_log', 'nobody'),
  'overnight-audit-30m': ('the overnight auditor', 'Every 30 min appends an audit row (93,423 rows so far).', 'overnight_audit', 'unclear'),
  'proof-check-nightly': ('the proof checker', 'Nightly runs the desk proof checks.', 'proof_checks, desk_status', 'Station desk'),
  'job-heartbeat-check-5m': ('the dead-man\'s switch', 'Every 5 min judges every job ON TIME / LATE / FAILING from its runs and real answers (alarms off).', 'job_heartbeat (+ feed_alarm when switched on)', 'status page; Alan by ntfy once approved'),
  'fan-daily-refresh': ('the fan clerk (SQL side)', 'After the close writes non-equity fan rows (equities come from the Fly fan clerk).', 'geiger_trend_20260814 (fan_daily view)', 'Hub REWIND'),
  'geiger-1m': ('the old SQL Geiger', 'Every minute recomputes the database-side Geiger.', 'composite tables', 'legacy readers'),
  'vacuum-ohlcv-hourly': ('the janitor', 'Hourly at :40 tidies the big price table (~10 s).', '—', '—'),
  'history-extend': ('the history extender', 'Every 2 min overnight extends stored daily history.', 'ohlcv_history', 'legacy daily reads'),
  'rebuild-thin-dates': ('the thin-day fixer', 'Hourly overnight rebuilds days with too few rows (still retrying Labor Day 7 Sep).', 'ohlcv_history', 'legacy'),
}

def cron_row(j):
    name = j['jobname']; r = runs.get(j['jobid'], {}); d = disp.get(name); b = board.get(name, {})
    part, what, writes, reader = NOTE.get(name, (None, None, None, None))
    if not what:
        what = ('Calls ' + j['calls'] + ' on schedule ' + j['schedule_utc'] + ' (UTC).')
    status, findings, verdict, refs, fix = 'ON TIME', [], 'KEEP', ['pgcron'], None
    if not j['active']:
        status, verdict = 'SWITCHED OFF', 'REMOVE'
        findings.append('Inactive; definition kept. Deleting it is Alan\'s call (destructive), so it stays listed as REMOVE-after-approval.')
        refs = ['sre']
    if j['kind'] == 'http':
        refs = ['pgnet', 'sbcron']
        if j['active'] and not j['records_real_answer']:
            verdict = 'CHANGE'; fix = 'STAGED D' if j['statements'] == 1 else None
            findings.append('Its real HTTP answer is not recorded: pg_cron says "succeeded" when the request is only queued; the answer is deleted after 6 h.')
        if j['key_in_command'] != 'none':
            findings.append('Carries the public anon key inside the command; Supabase recommends Vault (low risk: the same key ships in the Hub page).')
    if d:
        ok = float(d['ok_pct'] or 0)
        if ok < 95:
            status = 'FAILING' if ok < 50 else 'FLAKY'; verdict = 'CHANGE'; fix = 'STAGED B'; refs = ['pgnet', 'hc']
            findings.append(f"Real answers 24 h: {d['ok']} of {d['dispatches_24h']} OK ({d['ok_pct']}%), {d['timeout']} never connected (5 s / 120 s wait ran out at the busy quarter-hour).")
    if r.get('nf'):
        status = 'FAILING'; verdict = 'CHANGE'; refs = ['pgtimeout', 'airflow']
        findings.append(f"pg_cron failed {r['nf']} of {r['n']} runs in 72 h: {(r.get('msg') or '').strip()[:120]}")
        if name == 'mirror-gap-repair-daily':
            fix = 'STAGED C'; findings.append('Failed on all 14 nights pg_cron remembers (20 Sep - 3 Oct): pg_sleep(160) > the 120 s statement limit; the rollback discards its queued requests, so nothing is ever sent.')
    if name == 'sentiment-news-10m':
        status = 'FLAKY'; verdict = 'CHANGE'; fix = 'STAGED D + B (vacuum moved)'
        findings.append('Answered 500 "read news" on its :40 run in 4 of the last 6 hours (10:40 12:40 13:40 14:40Z); unrecorded until now. :40 is when the hourly vacuum runs.')
    if name == 'sentiment-x-2h':
        status = 'SILENT'; verdict = 'CHANGE'
        findings.append('Answers 200 every 2 h but has had nothing to score since 28 Sep 20:40Z: its source, the MacBook X-feed collector, is dead (see mac:xfeed).')
    if name in ('feed-alerts-5m', 'guardrail-jobhealth-30m'):
        verdict = 'REPLACE'; refs = ['sre', 'hc']
        findings.append('A watcher nobody hears: replace with the one dead-man\'s switch (job-heartbeat-check-5m) + feed_alarm/ntfy.')
    if name in ('health-monitor-5m', 'audit-engine-15m', 'overnight-audit-30m'):
        findings.append('One of seven overlapping watchers; fold into the heartbeat + feed_alarm route once its reader is known (Alan\'s call).')
    if name in ('putcall-minute-session-check', 'provider-frame-currentness-check'):
        verdict = 'CHANGE'; refs = ['promfor', 'sre']
        findings.append('Its alarm freezes RED when the session window closes and stays red all weekend (open on 3 Oct since Fri 16:05 / 16:20 ET); it should resolve or read "unknown" outside the window.')
    if name == 'job-heartbeat-check-5m':
        verdict = 'KEEP'; refs = ['hc', 'prom', 'sre']
        findings.append('Applied live 14:48Z 3 Oct by the first Q2b run BEFORE the brief changed to staged-only; alarms off, no message sent. Its alarm path has a key bug (feed_alarm -> feed_contract) that STAGED A fixes. Needs Alan\'s approval to stay.')
    if name == 'rebuild-thin-dates':
        findings.append('Still retries 2026-09-07 (Labor Day) every hour overnight — calendar-blind (hand to Q2a).')
    lr = r.get('last_ok') or (d or {}).get('last_success')
    if j['active'] and not r.get('last_run') and not d and status == 'ON TIME':
        if j['jobid'] in (282, 284, 286):
            status = 'NOT YET RUN'; findings.append('Created 2 Oct after its slot; its first scheduled run is still ahead.')
        else:
            findings.append('Weekly: its last run is older than the 72 h measured.')
    return {
      'job': name, 'where': 'Supabase pg_cron', 'id': j['jobid'], 'part': part, 'what': what, 'cadence_utc': j['schedule_utc'],
      'calls': j['calls'], 'writes': writes, 'read_by': reader, 'active': j['active'],
      'last_success_measured': lr, 'last_run': r.get('last_run'),
      'how_failure_shows_today': ('cron_dispatch real answer (seen by the heartbeat)' if j['records_real_answer'] else
                                  'pg_cron "succeeded" = only queued; the answer vanishes in 6 h' if j['kind'] == 'http' else
                                  'cron.job_run_details status (14 days kept)'),
      'how_we_would_know_it_stopped': 'job_heartbeat row ' + repr(name) + ' turns LATE/FAILING (alarms off until STAGED A)',
      'heartbeat_status_now': b.get('status'), 'status': status, 'verdict': verdict, 'staged_fix': fix,
      'references': [REF[k] for k in refs], 'findings': findings,
    }

rows = [cron_row(j) for j in cron]

def other(job, where, part, what, cadence, writes, reader, last, shows, know, status, verdict, refs, findings, fix=None):
    return {'job': job, 'where': where, 'id': None, 'part': part, 'what': what, 'cadence_utc': cadence, 'calls': None,
            'writes': writes, 'read_by': reader, 'active': True, 'last_success_measured': last, 'last_run': last,
            'how_failure_shows_today': shows, 'how_we_would_know_it_stopped': know, 'heartbeat_status_now': board.get(job, {}).get('status'),
            'status': status, 'verdict': verdict, 'staged_fix': fix, 'references': [REF[k] for k in refs], 'findings': findings}

FLY_PING = 'job_heartbeat ping at every exit (provider branch provider/q2b-keepalives-20261003, not deployed) -> LATE after period + grace'
rows += [
  other('fly:provider-tail-scheduled-hourly-i5', 'Fly scintilla-massive-stocks-batch 784eee5efe2978', 'the night copyist',
        'Hourly (fuzzy, ~:43); after 20:15 ET on session days rewrites the long (>400-bar) histories for 17 frames.', 'fly hourly',
        'R2 full intraday copies', 'chart API /candles limit>400', '2026-10-03T14:43:01Z SKIP_WEEKEND (fired on its minute; Friday night pass proven by the 1st Q2b run: full copies refreshed 00:43Z)',
        'only its own Fly log (last ~100 lines)', FLY_PING, 'ON TIME', 'CHANGE', ['flysched', 'hc'],
        ['Fires on time today. Its only failure trace is a log Fly keeps for ~100 lines; 29 Sep a --skip-start update silenced it for 70 min and nobody was told.'], 'provider fb7676b'),
  other('fly:provider-fan-daily-hourly-i5', 'Fly scintilla-massive-stocks-batch 28655523f971e8', 'the fan clerk',
        'Hourly (~:50); after 16:30 ET writes each stock\'s daily fan row (Hub REWIND).', 'fly hourly', 'geiger_trend_20260814 via publish_provider_fan_daily_v1', 'Hub REWIND',
        '2026-10-03T14:50:09Z NOTHING_TO_DO', 'own log only', FLY_PING, 'ON TIME', 'CHANGE', ['flysched', 'hc', 'dagster'],
        ['Accepts 586 of 590 names per session as complete (its threshold is 531): 4 names a day have no fan row since 29 Sep (rule -> Q2a).'], 'provider fb7676b'),
  other('fly:scout-geiger-nightly', 'Fly scintilla-massive-stocks-batch 185777d7a27018', 'the scout',
        'Hourly (~:21); after 20:15 ET computes the off-Hub Geiger for ~5,600 names once per session.', 'fly hourly', 'massive_stocks.scout_geiger_daily + R2', 'chart API /v1/scout-geiger, market map',
        '2026-10-03T14:21:01Z NOTHING_MISSING (newest session 2026-10-02, written 00:21Z)', 'own log only', FLY_PING, 'ON TIME', 'CHANGE', ['flysched', 'hc'],
        ['1 Oct it was a day stale after a --skip-start update; nobody was told.'], 'provider fb7676b'),
  other('fly:scout-geiger-seven-hourly', 'Fly scintilla-massive-stocks-batch 28744406b95608', 'the seven-rung scout',
        'Hourly (~:17); works in the 16 and 20 ET hours: the seven-rung off-Hub Geiger.', 'fly hourly', 'massive_stocks.scout_geiger_seven + R2', 'off-Hub Geiger views',
        '2026-10-03T14:17:01Z NOT_A_SESSION_DAY (last write 00:17Z)', 'own log only; a degraded run is skipped and still exits 0', FLY_PING, 'ON TIME', 'CHANGE', ['flysched', 'hc', 'airflow'],
        ['A degraded run is deliberately not written but exits 0 — invisible. The ping now names it SKIPPED_DEGRADED.'], 'provider fb7676b'),
  other('fly:geiger-publisher', 'Fly scintilla-massive-stocks-batch 820229b7795798 (boot-geiger.sh)', 'the 4-minute Geiger robot',
        'Always on; every ~4 min reads 590 names x 7 rungs from the chart API and publishes the Geiger the Hub shows.', 'continuous, restart always',
        'R2 candidate_geiger_v1', 'Hub board, Station chips', 'chart API /geiger computed 2026-10-03T14:56:34Z, VERIFIED, 590/590, 4,130 rungs',
        'refuses to publish -> the Hub silently holds the last reading (06:13-08:57 ET today, 42 cycles; Q2a owns the cause); its log is in /tmp and dies with a restart',
        'Q1 /v1/integrity (Geiger not ready / held) -> feed_alarm + ntfy', 'ON TIME', 'CHANGE', ['sre', 'prom'],
        ['Held for 2 h 44 min this morning with no alarm. Its log was not read by this lane (a prior permission denial is respected); judged from its published output only.']),
  other('fly:settled-close-supervisor', 'inside 820229b7795798 (injected files)', 'the closing-bell clerk',
        'Always on; after 16:05 ET builds the next session\'s previous-close file and confirms it with Massive.', 'continuous',
        'R2 settled close artifacts', 'chart API previous close', 'chart API /health previous_close_publication: NO_PRICE_SESSION (Saturday; correct)',
        'chart API /health only', 'Q1 /v1/integrity (previous-close file late)', 'ON TIME', 'KEEP', ['sre'], ['Runs as injected files on the Geiger machine: a restart from a different image silently drops it.']),
  other('fly:provider-bar-service', 'Fly scintilla-massive-stocks-batch 82d1d96a326548', 'the gatekeeper at the bar door',
        'Always on; fetches and stores bars, refreshes intraday frames each minute, and (child process) writes relative volume.', 'continuous, restart always',
        'R2 bars + board_volume', 'chart API', 'restarted 13:00Z (p11 image); board_volume newest 2026-10-03 00:00Z',
        '/metrics on the private network only', 'Q1 /v1/integrity + Q2a named-cause counters', 'ON TIME', 'KEEP', ['sre', 'prom'],
        ['Friday 16:20-20:00 ET intraday frames were reported BEHIND for ~4 h (feed_alarm provider_intraday_frames) — hand to Q2a.']),
  other('fly:market-stream', 'Fly scintilla-massive-stocks-stream 8e7eedf7719698', 'the stream listener',
        'Always on; listens to the live trade stream and marks which minutes need new bars (frame-due producer).', 'continuous, restart on-failure',
        'R2 frame-due markers + watermark; massive_control.service_heartbeat every 30 s', 'chart API', 'service_heartbeat 2026-10-03T15:08:39Z (120 beats in the last hour); watermark through Fri 19:59 ET',
        'boots DISARMED silently without its two variables (23 Sep)', 'STAGED A folds its 30-s heartbeat into job_heartbeat', 'ON TIME', 'CHANGE', ['hc', 'prom'], [], 'STAGED A'),
  other('fly:chart-api (2 machines)', 'Fly scintilla-massive-chart-api 811d65df4e6e08, 844549b24e02e8', 'the doorman',
        'Always on; serves bars, Geiger, previous close to the Hub and Station.', 'continuous, /live 15 s + /traffic-ready 30 s checks',
        '—', 'Hub, Station', '/health ready=true on both 3 Oct ~15:00Z', 'Fly health checks restart it', 'Fly checks + Q1 /v1/integrity', 'ON TIME', 'KEEP', ['sre'], []),
  other('fly:nightly-verdict', 'Fly (Q2a, not yet scheduled)', 'the night watchman',
        'Each night checks every close and Geiger cell against Massive and FMP; one verdict file with named causes.', 'nightly (to be scheduled)',
        'R2 control/nightly_verdict_v1/', 'status page; Q1 integrity alarm', None, 'not running yet', 'STAGED A seeds its heartbeat row (dead-man) — Q1 alarms on what it says',
        'NOT YET RUNNING', 'KEEP', ['hc', 'dagster'], ['Format agreed through deliverables/20261003/q2a-rules/verdict-format.json; reply in q2b-jobs/verdict-intake.json.'], 'STAGED A'),
  other('mac:com.alanharvey.scintilla-xfeed-collector', 'MacBook launchd', 'the X-feed collector',
        'Nine times a day reads Alan\'s X timeline in a hidden browser and publishes the feed.', '06:30 08:30 10:30 12:30 14:30 16:30 18:30 21:00 23:30 local',
        'X feed + x posts', 'Hub X feed, sentiment-x', 'last good publish 25 Sep 20:31Z; newest captured post 27 Sep 16:29Z',
        'launchd exit 78 (its program folder _worktrees/hub-xfeed-program-20260922 was deleted 28 Sep) — nobody is told',
        'heartbeat row reads LATE since 25 Sep (alarms off)', 'DEAD 6 DAYS', 'CHANGE', ['hc', 'sre'],
        ['Re-point the launchd job at a kept copy of xfeed-program.mjs (or retire it) — Alan\'s call; until then sentiment-x has nothing to read.']),
  other('mac:com.scintilla.ibkr-putcall', 'MacBook launchd (KeepAlive)', 'the put/call counter',
        'Runs all the time; counts option volume at IB and sends the put/call minute.', 'continuous', 'ibkr_option_volume -> ibkr_putcall_minute', 'Hub put/call',
        'running (pid up 2 h 15 min at 15:05Z); last put/call minute Fri 19:59Z', 'launchd restarts it (last exit 2); MOG.A asked every pass and refused', 'cron 273 in session; heartbeat row NEW (no ping)', 'ON TIME', 'KEEP', ['sre'],
        ['Fri 2 Oct the in-session watch reported no put/call minute for 56 min at 16:05 ET (alarm still open).']),
  other('mac:ai.scintilla.tradingview-mcp', 'MacBook launchd (RunAtLoad)', 'the TradingView bridge',
        'Starts TradingView with a debugging port at login.', 'at login', '—', 'desk tools', 'last exit 0', 'none', 'not watched (not a data job)', 'ON TIME', 'KEEP', ['sre'], []),
]

counts = {}
for r in rows: counts[r['verdict']] = counts.get(r['verdict'], 0) + 1
bad = [r['job'] for r in rows if r['status'] in ('FAILING', 'FLAKY', 'SILENT', 'DEAD 6 DAYS')]
doc = {'schema': 'scintilla.q2b.job_register.v1', 'measured_at': MEASURED_AT,
       'how_measured': 'read-only: cron.job + job_run_details (72 h) + cron_dispatch (24 h) + net._http_response (6 h) + output-table newest rows; Fly machines list + each scheduled machine\'s final log line; launchctl. Commands and keys are not stored.',
       'counts': {'jobs': len(rows), 'pg_cron': len(cron), 'pg_cron_active': sum(1 for j in cron if j['active']),
                  'fly': sum(1 for r in rows if r['job'].startswith('fly:')), 'macbook_launchd': sum(1 for r in rows if r['job'].startswith('mac:')),
                  'verdicts': counts, 'late_or_failing_now': bad},
       'references': REF, 'jobs': rows}
json.dump(doc, open(os.path.join(HERE, 'jobs.json'), 'w'), indent=1)
print(json.dumps(doc['counts'], indent=1))
