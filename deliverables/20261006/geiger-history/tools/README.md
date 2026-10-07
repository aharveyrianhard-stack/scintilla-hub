# GH1 tools — order of the run (all read-only; public reads only, no key in any file)
1. `syms.py` — the 192 names and funds in scope (CO1's AI / semis / memory / power / REIT cohorts + index, sector and theme funds).
2. `dl_full.py` — every rung's bars per name from the chart API, at full depth (the API holds them back to Sept 2003).
3. `gh1_replay.py` (+ `recon_g2.py`, G2's port of the publisher's rung maths, unchanged) — the seven-rung Geiger per session with the
   publisher's own bar rules (finished bars only; each name's own 3-day calendar). `build_series.py` runs it for every name.
4. `validate_live.py`, `validate_stored.py` — the replay against the Hub's live Geiger (23:41 ET, 6 Oct) and against the rows the Hub
   stored on the evenings of 5 and 6 Oct. `lattice_survey.py` — which 3-day calendar the provider serves for each of the Hub's 590 names.
5. `build_data.py` → the stored series, the own-history percentiles and the answers; `build_fund.py` (+ `sb.py`, a read-only helper
   that uses the public read key the Hub page ships and never prints it) → forward P/E and growth at the seven dates.
6. `dl_base.py`, `pine_port.py`, `pine_check.py` — the Pine oscillator's formula written out in Python and run on the same bars as the
   replay (a daily chart); `pine_check_intraday.py` — the same on a 30-minute extended-hours chart, bar by bar, against the Hub's live
   rule worked out separately from the provider's 3h to 12h bars; `pine_compile_check.py` — a compile-only check against TradingView's public compiler as Guest (nothing saved, nothing installed).
   `pine-port.mjs` is the same state machine in JS for `tests/gh1-geiger-history.test.mjs`.
7. `build_page.py` → `GEIGER-HISTORY.html` and `data/gh1-data.json`; then `python3 scripts/inject-scnav.py`; `shot.mjs` → `shots/`.
Paths inside the scripts point at the lane's scratch folder; they are kept as the record of what ran. Raw bars are not committed.
