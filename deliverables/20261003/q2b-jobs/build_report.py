#!/usr/bin/env python3
"""Q2b report (3 Oct 2026): writes Q2B-JOBS.html from jobs.json so the table never drifts from the register."""
import json, os, html

HERE = os.path.dirname(os.path.abspath(__file__))
reg = json.load(open(os.path.join(HERE, 'jobs.json')))
E = html.escape
c = reg['counts']; v = c['verdicts']

def table():
    order = {'FAILING': 0, 'DEAD 6 DAYS': 0, 'SILENT': 1, 'FLAKY': 2, 'NOT YET RUNNING': 3, 'NOT YET RUN': 3, 'ON TIME': 4, 'SWITCHED OFF': 5}
    rows = sorted(reg['jobs'], key=lambda r: (order.get(r['status'], 9), r['where'], r['job']))
    out = []
    for r in rows:
        st = r['status']; cls = 'bad' if st in ('FAILING', 'DEAD 6 DAYS', 'SILENT') else 'warn' if st in ('FLAKY', 'NOT YET RUNNING', 'NOT YET RUN') else 'off' if st == 'SWITCHED OFF' else 'ok'
        out.append('<tr class="%s"><td><b>%s</b>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
            cls, E(r['job']), ('<br><span class="dim">' + E(r['part']) + '</span>') if r.get('part') else '',
            E(r['what'] or ''), E(r['cadence_utc'] or ''), E(str(r.get('last_success_measured') or '—')), E(st),
            E(r['verdict']) + ((' · ' + E(r['staged_fix'])) if r.get('staged_fix') else ''),
            E(' '.join(r['findings'])) or '<span class="dim">—</span>'))
    return '\n'.join(out)

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Q2B Jobs Audit</title>
<style>
:root{{--bg:#0b0c0d;--panel:#141517;--line:#2a2c2f;--dim:#7d8186;--text:#b9bcc0;--hi:#d2d2d2;--up:#3fae6a;--down:#d0504a}}
*{{box-sizing:border-box}} html,body{{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif}}
.wrap{{max-width:1120px;margin:0 auto;padding:56px 16px 48px}}
h1{{color:var(--hi);font-size:30px;margin:6px 0 4px}} h2{{color:var(--hi);font-size:20px;margin:34px 0 8px;border-top:1px solid var(--line);padding-top:18px}}
h3{{color:var(--hi);font-size:16px;margin:18px 0 4px}}
.mono{{font:600 11px/1.4 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}}
.dim{{color:var(--dim);font-size:12px}} code{{font:12px ui-monospace,Menlo,monospace;color:var(--hi);overflow-wrap:anywhere;word-break:break-word}} p,li{{overflow-wrap:anywhere}} a{{color:var(--hi)}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px;margin:12px 0}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:12px}}
.card b{{display:block;color:var(--hi);font-size:26px}}
.red{{border-left:3px solid var(--down)}} .green{{border-left:3px solid var(--up)}}
ul{{padding-left:20px}} li{{margin:5px 0}}
img{{max-width:100%;border:1px solid var(--line);border-radius:4px}}
.tw{{overflow-x:auto;border:1px solid var(--line);border-radius:4px}}
table{{border-collapse:collapse;width:100%;font-size:12px;min-width:980px;table-layout:fixed}} td{{overflow-wrap:anywhere}} th,td{{text-align:left;vertical-align:top;padding:6px 8px;border-top:1px solid var(--line)}}
th{{position:sticky;top:0;background:var(--panel);color:var(--dim);font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}}
tr.bad td:nth-child(5){{color:var(--down);font-weight:600}} tr.ok td:nth-child(5){{color:var(--up)}} tr.off td{{color:var(--dim)}}
details.sc-pagespecs{{margin-top:28px;border-top:1px solid var(--line);padding-top:10px;color:var(--dim);font-size:13px}}
details.sc-pagespecs summary{{cursor:pointer;font:600 11px ui-monospace,Menlo,monospace;letter-spacing:.16em}}
</style></head><body><div class="wrap">
<div class="mono">Q2b · keeping the data honest, part 2 · 3 Oct 2026 · measured 11:00–11:30 ET, read-only</div>
<h1>Every job that must run on time, checked</h1>
<p>Scintilla has <b>{c['jobs']}</b> things that are supposed to run by themselves: <b>{c['pg_cron']}</b> timers inside the database ({c['pg_cron_active']} switched on), <b>{c['fly']}</b> machines on Fly, and <b>{c['macbook_launchd']}</b> jobs on the MacBook.
I looked at what each one actually did, not what it reported. <b>8 are failing or silently doing nothing right now</b>, and until today nothing would have told you about any of them.
Nothing was changed on the live system by this lane. Every fix is written down, tested on a throw-away copy of the database, and waiting for your yes.</p>

<div class="cards">
 <div class="card red"><b>8</b>failing or silent today</div>
 <div class="card"><b>{v.get('KEEP',0)} · {v.get('CHANGE',0)} · {v.get('REPLACE',0)} · {v.get('REMOVE',0)}</b>keep · change · replace · remove</div>
 <div class="card green"><b>11 / 11</b>staged fixes + rollbacks pass on a test database</div>
 <div class="card green"><b>845 / 845</b>provider tests pass with the Fly heartbeat</div>
</div>

<h2>1 · Before anything else: one change is already live, and it should not be</h2>
<p>The first Q2b run (10:27 ET) was started under the earlier brief. At <b>10:48 ET</b> it put the <b>dead-man's switch</b> live: three new tables and a checker that runs every 5 minutes. A dead-man's switch is a watcher that raises the alarm when a job goes quiet. This happened <b>before</b> your 11:00 rule ("no changes on my Hub without my approval"). Its alarms are <b>off</b>: it has sent no message (<code>last_push_at</code> is empty) and writes only its own tables. I did not touch it.
Two choices for you: keep it as it is (recommended; it is what this page's verdicts came from), or remove it with one file: <code>supabase/migrations/20261003_job_heartbeat_ROLLBACK.sql</code>.
While testing it I found a flaw. If its alarms were switched on as it stands, the first red job would make every check fail. Fix A below corrects that.</p>

<h2>2 · What was late or silently failing today</h2>
<p>The characters, so the rest reads easily: <b>the 4-minute Geiger robot</b> publishes the Geiger. <b>The gatekeeper at the bar door</b> fetches prices. <b>The night copyist</b> rewrites long chart histories. <b>The night watchman</b> is Q2a's nightly second opinion. <b>The backup clerks</b> copy the database to R2 each night. <b>The switchboard recorder</b> writes down what every web call really answered.</p>
<ul>
<li><b>The backup repairman never works</b> (<code>mirror-gap-repair-daily</code>). It failed on all 14 nights the database still remembers. Its own pauses (160 s) are longer than the database allows (120 s), so every run is cancelled. The cancel also undoes the four repair calls it had lined up, so not one was ever sent. <i>Fix C.</i></li>
<li><b>The statistics clerk and the daily ribbon painter mostly do not get through.</b> Since 28 and 29 Sep only 6–35% of their calls reach the function. The cause is the quarter-hour rush. At :00, :15, :30 and :45 about 20 timers fire at once, and these two give up after 5 seconds, before they have even connected. Measured over 24 hours: 9.3% of calls at those minutes never got an answer, against 0.3% at any other minute. <i>Fix B moves them to quiet minutes.</i></li>
<li><b>The X-feed collector on the MacBook has been dead for 6 days.</b> Its program folder was deleted on 28 Sep. The Mac tries to start it 9 times a day, fails (exit 78), and tells nobody. The newest X post we hold is from 27 Sep. <b>The X-mood reader</b> reports "success" every 2 hours, but has had nothing to read since 28 Sep.</li>
<li><b>The news-mood reader</b> got a 500 error on its :40 run in 4 of the last 6 hours. The run 10 minutes later caught up. Nothing recorded these errors: this job is one of 29 web timers whose real answer is thrown away after 6 hours. <i>Fix D keeps the answer; Fix B tests the likely cause (the :40 clean-up).</i></li>
<li><b>The old alert writer has 9,352 alerts and delivered none</b>, and has written nothing since 18 Sep. <b>The old job auditor</b> only notices 3 failures inside one hour, so a nightly job can fail forever without it seeing.</li>
<li><b>Three warnings are stuck on red all weekend.</b> Two froze when the market closed. The third (put/call freshness, 18 h) cannot tell a weekend from an outage.</li>
<li>Seen and handed on, not mine: Geiger held 06:13–08:57 ET with no alarm. Friday 16:20–20:00 ET extended-hours bars were reported behind. The fan clerk accepts 586 of 590 names a day. A Labor Day retry is still running hourly. All of these go to Q2a.</li>
<li>Working well: all four hourly Fly jobs fired on their minute this hour. The Geiger is VERIFIED 590/590. The stream beats every 30 s. Every nightly reader (analysts, dilution, lock-ups, sigma, odds) wrote its table on its last night. The sigma grant found missing on 28 Sep is now in place.</li>
</ul>

<h2>3 · The status page (mock, not linked from the Hub)</h2>
<p><code>deliverables/20261003/status/index.html</code> answers one question: is anything broken right now, and since when. It shows green or red per part in plain words.</p>
<img src="shots/status-1680.png" alt="Status page at 1680 px wide">
<p class="dim">Headless capture, 1680 px wide (390 px phone capture: <code>shots/status-390.png</code>, one column, no sideways scroll). What it shows: the headline "6 things are broken right now", six red items with their dates, and six panels: charts, Geiger, night work, news and X, board numbers, watchers.</p>

<h2>4 · What public practice says, and what we adopt</h2>
<ul>
<li><b>Dead-man's switch.</b> <a href="https://healthchecks.io/docs/">healthchecks.io</a> (open source) gives every job a <i>period</i> and a <i>grace</i>. It is "late" when a success is due and has not come, "down" after the grace, and it alerts only on a change of state. Prometheus: <a href="https://prometheus.io/docs/practices/instrumentation/#batch-jobs">"The key metric of a batch job is the last time it succeeded."</a> → <b>adopted</b>: one heartbeat row per job, LATE / FAILING with a named cause, one message per change.</li>
<li><b>Alarm on symptoms, and only alarms someone acts on.</b> <a href="https://sre.google/sre-book/monitoring-distributed-systems/">Google SRE</a>: "what's broken, and why?"; "Every page should be actionable". → the 7 overlapping old watchers fold into one route. An alarm that cannot be acted on (weekend reds) is a bug.</li>
<li><b>Wait before alarming; stop cleanly.</b> <a href="https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/">Prometheus <code>for</code> / <code>keep_firing_for</code></a> → jobs that fire more than hourly need 3 failures in a row before FAILING; window watchers must resolve when their window closes.</li>
<li><b>Scheduled web calls from the database.</b> <a href="https://supabase.com/docs/guides/functions/schedule-functions">Supabase</a> recommends pg_cron + pg_net with the token kept in Vault. <a href="https://github.com/supabase/pg_net">pg_net</a> queues each request and keeps the answer only 6 hours, with a 5-second default wait. <a href="https://github.com/citusdata/pg_cron">pg_cron</a> "succeeded" for a web call only means the request was queued. → <b>Fix D</b>: record every real answer. Vault: <b>later</b>. The 46 jobs that carry a key carry the public anon key, which already ships inside the Hub page; none carries a service key.</li>
<li><b>Tasks are transactions.</b> <a href="https://airflow.apache.org/docs/apache-airflow/stable/best-practices.html">Airflow</a>: "never produce incomplete results"; retries need idempotent tasks. Dagster's <a href="https://docs.dagster.io/examples/best-practices/asset-health-monitoring">freshness checks</a> judge the output, not the run. → the seven-rung scout's skipped-because-degraded run is now named, not passed as success. → <b>Fix C</b> makes one call per job, with no sleeping inside a transaction (<a href="https://www.postgresql.org/docs/current/runtime-config-client.html">PostgreSQL statement_timeout</a> applies to each statement).</li>
<li><b>Fly scheduled machines</b> are <a href="https://docs.fly.io/machines/flyctl/fly-machine-run">"fuzzy" hourly/daily</a>, with restart no / always / on-fail. → KEEP them, but each must ping when it ends, because silence is the alarm. Two of them went quiet for a day after a <code>--skip-start</code> update (29 Sep–1 Oct) and nobody was told.</li>
</ul>

<h2>5 · The adopt-list: built, tested, staged (nothing applied)</h2>
<ul>
<li><b>Fly heartbeat</b>: provider branch <code>provider/q2b-keepalives-20261003</code> @ <code>fb7676b</code>. The four hourly jobs ping at every exit. The ping never throws and never changes an exit code. Tests 845/845. Ships only with a new batch image after your yes; rollback = the previous image.</li>
<li><b>A</b> alarms on + the night watchman's row + the stream's own heartbeat + the alarm-key fix + the weekend-proof put/call contract: <code>supabase/migrations/20261003_q2b_STAGED_A_heartbeat_alarms_on.sql</code> (rollback <code>…_ROLLBACK.sql</code>).</li>
<li><b>B</b> four jobs off the quarter-hour rush, plus the :40 clean-up moved to :43: <code>…_STAGED_B_stagger_busy_minutes.sql</code> (+ rollback).</li>
<li><b>C</b> the backup repairman split into four single calls, the old one switched off (kept): <code>…_STAGED_C_mirror_gap_repair_split.sql</code> (+ rollback). Note: this starts four backup calls a night that have not run for at least 2 weeks.</li>
<li><b>D</b> 27 web timers keep their real answer. The rewrite happens inside the database, so no key leaves it, and the originals are backed up. Proven on the live database in read-only mode: 27/27 parse: <code>…_STAGED_D_record_real_http_answers.sql</code> (+ rollback).</li>
<li><b>E</b> one missing read grant (YouTube transcripts; the reader hides the refusal): <code>…_STAGED_E_youtube_transcripts_grant.sql</code> (+ rollback).</li>
<li>Test harness: <code>sqltest/run.mjs</code> applies the live migration, proves the alarm-key bug, then applies each staged file and its rollback: <b>11/11</b>.</li>
<li>Agreed with Q2a: <code>verdict-intake.json</code>. The night watchman pings once a night. This heartbeat alarms if it did not run; Q1's integrity check alarms on what it says. One fault never rings twice.</li>
</ul>

<h2>6 · The register ({c['jobs']} jobs)</h2>
<p class="dim">Full data with references per job: <code>jobs.json</code>. Times are UTC unless marked. "Last success" comes from the database's run history, the recorded answers, or the job's own last log line.</p>
<div class="tw"><table><colgroup><col style="width:14%"><col style="width:22%"><col style="width:9%"><col style="width:12%"><col style="width:7%"><col style="width:9%"><col style="width:27%"></colgroup><thead><tr><th>Job</th><th>What it does</th><th>When (UTC)</th><th>Last success (measured)</th><th>Now</th><th>Verdict · fix</th><th>Found</th></tr></thead><tbody>
{table()}
</tbody></table></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>How measured (read-only, 3 Oct 11:00–11:30 ET): database job list and 72-hour run history; recorded web answers (24 h) and raw answers (6 h); the newest row in each job's output table; Fly machine list and each scheduled machine's last log line; the MacBook's launchd list. Keys and command text were masked inside the database and are not stored anywhere in this folder.</p>
<p>Not done: nothing applied or deployed (by rule). The Geiger publisher's own log was not read (a permission refused to an earlier run is respected). Its health is judged from what it publishes. The 28 switched-off timers are marked REMOVE as a recommendation only; deleting them is your call. Vault for tokens: planned, not staged.</p>
<p>What could be wrong: "since" dates are the oldest the systems remember (14 days of run history; 6 hours of raw answers), so a fault may be older. The :40 news errors are linked to the clean-up job by timing only; Fix B is the test.</p>
</details>
</div></body></html>"""
open(os.path.join(HERE, 'Q2B-JOBS.html'), 'w').write(page)
print('wrote Q2B-JOBS.html', len(page))
