#!/usr/bin/env python3
"""Q2b status page data (3 Oct 2026). Reads the measured register (../q2b-jobs/jobs.json + evidence) and, when it exists,
Q2a's night verdict, and writes status-snapshot.json: one line per part in plain words — green / red, and since when.
Read-only: it never touches the database, Fly or R2. Re-run after refreshing the evidence."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(HERE, '..', 'q2b-jobs')
jobs = {j['job']: j for j in json.load(open(os.path.join(REG, 'jobs.json')))['jobs']}
geiger = json.load(open(os.path.join(REG, 'evidence', 'geiger_now.json')))
verdict_path = os.path.join(HERE, '..', 'q2a-rules', 'nightly-verdict-latest.json')
verdict = json.load(open(verdict_path)) if os.path.exists(verdict_path) else None

G, R, A, N = 'green', 'red', 'amber', 'grey'
def item(name, state, line, since=None, job=None):
    return {'name': name, 'state': state, 'line': line, 'since': since, 'job': job}

parts = [
 {'part': 'Charts and prices', 'items': [
   item('The doorman (chart API, 2 machines)', G, 'Answering; both machines report ready.', None, 'fly:chart-api (2 machines)'),
   item('The gatekeeper at the bar door (bar service)', G, 'Running on the 09:00 ET image; relative volume written after Friday\'s close.', None, 'fly:provider-bar-service'),
   item('The stream listener', G, 'Beating every 30 seconds; marked minutes through Friday 19:59 ET (market closed since).', None, 'fly:market-stream'),
   item('Friday evening intraday bars', A, 'From about 16:20 to 20:00 ET Friday the extended-hours bars were reported behind. Handed to Q2a. The warning is still showing because it only clears during market hours.', 'Fri 2 Oct 16:20 ET', 'provider-frame-currentness-check'),
 ]},
 {'part': 'The Geiger', 'items': [
   item('The 4-minute Geiger robot', G, f"Published {geiger['returned']} of {geiger['requested']} names, {geiger['rungs']:,} rungs, {geiger['label']} (last at {geiger['computed_utc'][11:16]} UTC).", None, 'fly:geiger-publisher'),
   item('This morning\'s hold', A, 'From 06:13 to 08:57 ET it refused 42 times in a row and the Hub kept showing the last full reading. Nothing alarmed. Q2a owns the cause.', 'Sat 3 Oct 06:13 ET (over by 09:01)', 'fly:geiger-publisher'),
   item('The closing-bell clerk', G, 'Waiting: there is no trading session today.', None, 'fly:settled-close-supervisor'),
   item('The scout and the seven-rung scout', G, 'Both fired on their minute this hour; Friday\'s readings were written at 20:17 and 20:21 ET.', None, 'fly:scout-geiger-nightly'),
   item('The fan clerk (REWIND)', G, 'Fired on time; 586 of 590 names have a row for each day since 29 Sep (4 a day are missing, which its rule allows; sent to Q2a).', None, 'fly:provider-fan-daily-hourly-i5'),
 ]},
 {'part': 'Night work', 'items': [
   item('The night copyist (long chart histories)', G, 'Friday night\'s pass refreshed the long copies; today it skips (weekend).', None, 'fly:provider-tail-scheduled-hourly-i5'),
   item('The night watchman (second opinion)', N, 'Not running yet. It is built on Q2a\'s branch and will report here once Alan approves it.', None, 'fly:nightly-verdict'),
   item('The backup clerks', G, 'All three nightly copies ran; the backup check found 4 tables short. The worst is the REWIND history, missing 1,080,400 of 1,230,600 rows in the backup.', None, 'mirror-audit-nightly'),
   item('The backup repairman', R, 'Has not sent a single repair in at least 14 nights. Its own pauses are longer than the database allows, so every run is cancelled and undone. Fix written, waiting for Alan.', 'at least Sun 20 Sep', 'mirror-gap-repair-daily'),
 ]},
 {'part': 'News, mood and X', 'items': [
   item('The news wire', G, 'New headlines every minute.', None, 'news-feed-1m'),
   item('The news-mood reader', A, 'On the :40 run in 4 of the last 6 hours, it could not read the news table. The :50 run caught up. Nothing recorded these errors until today.', 'today 06:40 ET (earlier not kept)', 'sentiment-news-10m'),
   item('The X-feed collector (MacBook)', R, 'Dead. Its program folder was deleted on 28 Sep, so it cannot start, and nobody was told. The newest X post we hold is from 27 Sep.', 'last good publish Fri 25 Sep 16:31 ET', 'mac:com.alanharvey.scintilla-xfeed-collector'),
   item('The X-mood reader', R, 'It reports success every 2 hours but has had nothing to read since 28 Sep, because its source is the dead collector.', 'Mon 28 Sep', 'sentiment-x-2h'),
   item('The YouTube scouts', G, 'Videos refreshed this hour.', None, 'yt-rss-sweep-5m'),
 ]},
 {'part': 'Board numbers', 'items': [
   item('The statistics clerk (STATS)', R, 'Only 6 to 26% of its runs reach the function since 28 Sep. They fire at :00 and :30 together with about 20 other jobs, and are cut off after 5 seconds. Fix written: move it to :13 and :43.', 'Mon 28 Sep', 'stats-engine-30m'),
   item('The daily ribbon painter', R, '23 to 35% of its runs get through since 29 Sep, for the same reason (the quarter-hour rush). The ribbons are still fresh, because about one run in four lands.', 'Tue 29 Sep', 'ribbon-d-3m'),
   item('Put/call (IB, MacBook)', G, 'The counter is running; Friday\'s last minute arrived at 15:59 ET. Market closed.', None, 'mac:com.scintilla.ibkr-putcall'),
   item('Prediction markets, analysts, dilution, lock-ups, sigma', G, 'Every nightly reader wrote its table on its last scheduled night.', None, 'prediction-markets'),
 ]},
 {'part': 'The watchers', 'items': [
   item('The dead-man\'s switch (job heartbeat)', A, 'Watching 150 jobs every 5 minutes, but its alarms are off. It went live this morning before the "nothing without Alan" rule. Keeping it, and switching its alarms on, both need Alan\'s yes.', 'Sat 3 Oct 10:48 ET', 'job-heartbeat-check-5m'),
   item('The old alert writer', R, '9,352 alerts stored and none ever delivered. Nothing new since 18 Sep.', 'Fri 18 Sep', 'feed-alerts-5m'),
   item('Weekend warnings', A, 'Three warnings are stuck on red until Monday: two froze when their market-hours window closed, and one cannot tell a weekend from an outage.', 'Fri 2 Oct 16:05 ET', 'putcall-minute-session-check'),
 ]},
]
if verdict:
    parts[2]['items'][1] = item('The night watchman (second opinion)', {'GREEN': G, 'AMBER': A, 'RED': R}.get(verdict.get('verdict'), N),
                                verdict.get('summary', ''), verdict.get('since_utc'), 'fly:nightly-verdict')

broken = [i for p in parts for i in p['items'] if i['state'] == R]
doc = {'schema': 'scintilla.q2b.status_snapshot.v1', 'measured': '3 Oct 2026, 11:00–11:30 ET (read-only)',
       'headline': (f"{len(broken)} things are broken right now" if broken else 'Nothing is broken right now'),
       'broken': [{'name': i['name'], 'since': i['since']} for i in broken], 'parts': parts,
       'verdict_source': 'deliverables/20261003/q2a-rules/verdict-format.json (agreed; not yet running)'}
json.dump(doc, open(os.path.join(HERE, 'status-snapshot.json'), 'w'), indent=1)
print(doc['headline'], [b['name'] for b in doc['broken']])

# embed the snapshot into the page between the markers (the page stays self-contained)
import re
page = os.path.join(HERE, 'index.html')
html = open(page).read()
blob = json.dumps(doc).replace('</', '<\\/')
html = re.sub(r'(<script id="snapshot" type="application/json">)(.*?)(</script>)', lambda m: m.group(1) + blob + m.group(3), html, flags=re.S)
open(page, 'w').write(html)
