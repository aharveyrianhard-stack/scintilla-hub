-- E1 (15 Oct 2026) · COLLECTOR HOURS — the earnings sweep must cover Asian and European reporting hours.
-- NOT APPLIED by the lane. For the coordinator to run in the Supabase SQL editor (project wadinxqplrggagkvrdag), one statement.
--
-- MEASURED 15 Oct: cron.job 182 "earnings-sweep-generic" runs  */10 10-16,20-23,0-4 * * *  (UTC).
-- Nothing runs 05:00–09:59 UTC = 01:00–05:59 ET. TSMC publishes ~13:30 Taipei = 01:30 ET = 05:30 UTC; ASML/SAP at
-- 07:00 CEST = 01:00 ET = 05:00 UTC. Both fall in the hole, so an Asian or European report could only be caught from 06:00 ET.
-- (TSM's Q3 row carried eps_actual 4.60 by 07:10 ET — the first pass after the hole.)
--
-- THE CHANGE: run the same job on the same ten-minute cadence through the hole as well — 00:00–16:59 and 20:00–23:59 UTC.
-- The 17:00–19:59 UTC pause (13:00–15:59 ET, the US session, no reports) is kept.

select cron.alter_job(182, schedule := '*/10 0-16,20-23 * * *');

-- ROLLBACK (exactly the schedule measured on 15 Oct):
-- select cron.alter_job(182, schedule := '*/10 10-16,20-23,0-4 * * *');

-- VERIFY, read-only:
-- select jobid, jobname, schedule, active from cron.job where jobid = 182;

-- ⚠ THE CRON ALONE DOES NOT CATCH TSMC. The deployed function earnings-sweep (v14, 18 Sep) gates every row by a report window in
-- New York time: BMO rows are processed only 06:00–11:59 ET, AMC rows 16:00–23:59 ET (today) or 00:00–02:59 ET (yesterday's).
-- At 01:30 ET a BMO row is "off-window" and the run is idle. The function change that goes WITH this schedule is in
-- earnings-sweep-window.patch.md beside this file (a deploy — not the lane's to make).
