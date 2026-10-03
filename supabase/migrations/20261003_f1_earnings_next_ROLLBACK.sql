-- Rollback of 20261003_f1_earnings_next.sql: removes exactly the (ticker, date) rows it added, only while no actual has arrived on them.
delete from public.earnings_events where ticker = $f1$MOG.A$f1$ and date = $f1$2026-11-20$f1$ and eps_actual is null;
delete from public.earnings_events where ticker = $f1$NKE$f1$ and date = $f1$2026-12-17$f1$ and eps_actual is null;
