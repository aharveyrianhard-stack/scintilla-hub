# NQ1 tools — order of the run (all read-only; public reads only, no key in any file)
1. `dl_bars.py`, `dl_intra.py` — daily, weekly and four intraday timeframes per name from the chart API.
2. `geiger7.py` (+ `recon_g2.py`, the sector study's replay, unchanged) — seven-rung Geiger per session, own-year percentile.
3. `growth_all.py` — next-twelve-month revenue and earnings growth from the analyst estimates table (needs a local dump of the Hub's public tables).
4. `comps-run.mjs` — the Hub's comps code (C5 set, C6b outliers, band) headless per name; reads the Hub's public read key from a private file that is not committed.
5. `build_data.py` → `data/nq1-data.json`; `build_page.py` → `WORKSHOP-QUEUE.html` and `REVIEW-QUEUE-20261006.json`; then `python3 scripts/inject-scnav.py`; `shot.mjs` → `shots/`.
Paths inside the scripts point at the lane's scratch folder and sibling worktrees; they are kept as the record of what ran.
