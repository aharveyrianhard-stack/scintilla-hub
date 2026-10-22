# CW6 · the new comps inside the Hub's COMPS tab (22 Oct 2026)

The COMPS tab on the company page now runs the CW3 method for any name: peers chosen by business, next-twelve-months
multiples, the football field, analysts low · median · high, the verdict in words. Names CW3 (RADAR, 19 Oct) and CW4
(Dow 30, 20 Oct) reviewed open on their own peer sets; the memory names carry CW5's through-the-cycle line; any other
name gets C5's business-lines set and says how sound it is. The 1 Oct four switches are folded beneath as "the broad
set", never averaged with the tight set.

## Files

| file | what it is |
|---|---|
| `tab.mjs` | the tab (DOM). `mountCompsTab(root, opts)`, the same call the Hub made to C5; `index.html` now imports this file |
| `engine.mjs` | the arithmetic, pure: CW3's `compute.py` ported line for line, CW4's rules for its names, CW6's additions |
| `sources.mjs` | where numbers come from: the FMP answer store (files, or `public.comps_fmp_answers` once applied), the Hub's tables, live US prices from the chart API |
| `sets.json` | the reviewed peer sets (48 names: 23 RADAR, 30 Dow, 5 on both), reasons, the dated hand-written reads, Alan's 20 Oct notes |
| `cycle.json` | CW5's ten years of monthly multiples for the seven memory makers (sorted, so today's multiple is placed at today's price) |
| `store/` | FMP's answers for the 249 companies on the reviewed sets, fetched through fmp-proxy 22 Oct 18:06–18:08 UTC (865 GET calls, all 200) |
| `CHECK.md`, `CHECK.json` | the check against CW3's `COMPS-RADAR.json` |
| `pictures/` | the tab at 1680 × 1050 and 2560 × 1440: MU, NVDA, IREN, SHOP, BE, AAPL (Dow), LRCX (on no list); `-full` = the whole tab, folds open |
| `sql/` | `public.comps_fmp_answers` + rollback, **proposed, not applied** |
| `tools/` | `build_data.py` (sets and cycle from the three branches), `fill_store.py` (the store), `check.mjs`, `shots.mjs` |

## Why the browser reads files, not fmp-proxy

Measured 22 Oct 2026: fmp-proxy's GET and OPTIONS answers carry no `Access-Control-Allow-Origin` header, so a page on
scintillahub.ai cannot read it (the request may even run and be logged, but the browser refuses the answer). The store
is therefore filled server-side by `tools/fill_store.py` through the same door and served as files; the tab makes **no
FMP call**. Two ways to keep it fresh, both for the coordinator: apply `sql/20261022_comps_fmp_answers.sql` and run the
fill on a schedule into the table (the tab reads the table first), or add a CORS header for scintillahub.ai to fmp-proxy
(its source is not in this repository). Re-running `python3 tools/fill_store.py . 950` refreshes the files (about 860
calls of the shared 3,000 a day).

## Calls for one opened name (measured headless, 22 Oct)

A reviewed name: 8–9 file reads (the name, its peers, the FX file), 13–18 Hub table reads (one failing read of the
not-yet-applied `comps_fmp_answers` table, the broad set's tags, cohorts and figures), 2 chart-API price reads, **0 FMP
calls**. A name on no list (LRCX): 35 table reads (C5's universe, named peers and figures, then the broad set), 2 price
reads, 0 FMP calls.

## Rules added on 22 Oct (all printed in the tab's PAGE SPECS)

- The ±10× size band applies to every set (a control on the card: ±3 · ±10 · ±30 · off); when it changes a set, the
  read without it is printed under the verdict.
- A set with fewer than four peers carrying figures is thin: greyed, no single upside.
- The farthest peer on each priced row is set aside and the median re-taken; 15% or more is printed in red.
- P/S and P/S ÷ growth are columns, never priced rows, so the centre stays CW3's.
- On the business-lines set (names no lane reviewed), when its centre and the tag sets' centres sit more than 40% apart
  the card refuses a single upside.
- Loss-makers are priced on sales (EV/sales NTM; trailing when no estimate, labelled), EV/gross profit and positive NTM
  EBITDA only, with the runway beside them; never a P/E or PEG on a negative figure.
