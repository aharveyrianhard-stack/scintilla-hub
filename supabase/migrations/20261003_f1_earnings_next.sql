-- 2026-10-03 · F1 (full Hub treatment) · EARNINGS calendar + tab: the next date FMP carries for 2 names with no future row
-- Source: FMP /stable/earnings?symbol=T, read 2026-10-03T16:14:08.827Z; none of these dates is in recovery_earnings_archive (checked 3 Oct). fmp-events will own the row from its next pass.
-- ADDITIVE (pre-approved class, F1 brief): nothing is deleted or overwritten. Rollback beside this file (_ROLLBACK).
-- Built by deliverables/20261003/f1-full-treatment/build-loads.mjs from reads taken 2026-10-03T16:19:40.557Z.
insert into public.earnings_events (ticker, date, eps_estimate, revenue_estimate, updated_ts) values
($f1$MOG.A$f1$, $f1$2026-11-20$f1$, 2.69, 1119431000, 1791044380),
($f1$NKE$f1$, $f1$2026-12-17$f1$, 0.3907, 11223350000, 1791044380)
on conflict (ticker, date) do nothing;
