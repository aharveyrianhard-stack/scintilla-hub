<!-- copied unchanged from <earlier-run-dir>/PREREGISTRATION.md (sha256 b81350379f387083b2a6411a547a2402626da333678664c68aba727e616ea1b7) at 2026-09-26T02:48:48Z, before this run produced any gate number -->
# Pre-registration — quant loop run 1 (written before any gate ran)

Written 2026-09-25 ~22:25Z, after the lake was built and before the bake-off, S1 or S2 produced a number.

## Bake-off (D7: SW-F against SW-R, US daily bars)
- **Harness:** scintilla-loop `run_real_bakeoff.py` at `loop/chartapi-run1-20260925` @ dae73cf (1be468b + chart-API reader;
  gate code, grid, registry and seeds unchanged). 46 configs (8 SW-F + 38 SW-R). B4 = B6 = 1000.
- **Split law (ratified registry, not changed):** development < 2018-01-01; walk-forward [2018-01-01, 2023-01-01);
  lockbox >= 2023-01-01 physically cropped. Note: RULEBOOK-STATS S3 says "from 2019 in the lockbox"; the ratified
  registry says 2023. The registry is used; the difference is reported, not resolved here.
- **PRIMARY universe (decides the verdict), rule fixed now:** of the 13 names, every symbol whose unbroken history
  starts before 2012-01-01 (so the shared calendar keeps >= ~6 years of development span):
  AMZN AVGO DIA IWM MU QQQ SMH SPY WMT. Shared calendar starts 2011-03-23 (QQQ after its break).
  Excluded, and why: GOOGL (history starts 2014-04-03), VST (2017-05-10), BE (2018-07-25 after the listing break),
  NBIS (2024-10-21) — the harness intersects trading calendars, so any of them would shrink every symbol's
  development span to under four years.
- **SENSITIVITY run (reported whatever it shows, never used to replace the primary):** the seven names with unbroken
  history from 2003-09-11: AMZN DIA IWM MU SMH SPY WMT.
- **Verdict rule:** the harness's own. The crown is the best development-span Sharpe among configs with >= 200 events;
  best SW-F and best SW-R are each judged G0–G6. The family bake-off answer is which family's best config ranks
  higher on the development span, plus each one's ladder. Any ladder not green G0–G6 is KILLED at its first failing
  gate. Single feed => DRAFT at best (two-feed law), whatever the gates say.
- **Start/end:** --start 2003-01-01 --end 2026-09-25.

## S1 and S2 (descriptive — no promotion, no selection)
- Symbols: the 13 names, each on its last unbroken run (same 365-day listing-break rule as the package).
- S1(a): share of days RSI(14) <= 30, per name; index rows SPY QQQ DIA IWM SMH vs the median of the 8 target names;
  interval by moving-block bootstrap on dates common to all compared series, block 20 sessions, 2,000 resamples,
  seed 20260925. Holds if the interval of (index share − median member share) is clear of zero.
- S1(b): 10th-percentile line from the prior 252 sessions (package's percentile definition), next-session reading
  counted as fired if strictly below the line; fired share must lie within 10% ± 1.96·sqrt(0.1·0.9/n).
- S2: Spearman of RSI(14) and Williams %R(14) per name, per half of its history; interval by Fisher z with an
  effective sample size n_eff = n / (1 + 2·Σ_{k=1..K} ρ_rank_x(k)·ρ_rank_y(k)), K = 50; stamp ONE-WITNESS if the
  interval's lower end is >= 0.9 (the checkup's placeholder threshold, not ratified). OS/OB states: RSI <= 30 / >= 70,
  %R <= −80 / >= −20.
