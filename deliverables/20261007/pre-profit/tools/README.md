# The pre-profit shelf and debt in the knockout — how it is run

Nothing here writes a table, deploys, or runs on a schedule. Every step but one reads public data or files; that one
(step 2) needs the vendor key, which lives only on Fly — read `data/keyed-pull.json` before running it again.

Run from an empty scratch folder that already holds the knockout's own inputs (its README, steps 1–7): `snap/*.json`,
`comps-universe.json`, `fundamentals.json`, `quotes-all-raw.json`, and its `bars/` folder (named by `KO1_BARS`).

| step | command | what it leaves in the scratch folder |
|---|---|---|
| 1 | — | the knockout's inputs, copied in; `python3 ../knockout/tools/knockout.py` from a copy must give the committed `knockout.json` back |
| 2 | `TICKERS=… QUARTERS=32 node pp1_fetch_fmp.mjs` on a throw-away machine, then `ONLY=calls CALLS=2` for the shelf candidates | `fmp-statements.json`, `fmp-calls.json` (unpacked from what the machine prints; never committed) |
| 3 | `python3 tools/sec_facts.py` (tickers in `sec/want.json`) | `sec/<T>.json` — cover shares, convertibles, shares left out of diluted EPS, leases, sales under contract |
| 4 | `python3 tools/sec_cover.py T1 T2 …` | `sec/cover-text.json` — the cover count for companies with more than one share class |
| 5 | `python3 tools/capex_calls.py` | `capex-calls.json` — sentences that announce capital spending; a person then marks `data/capex-announced.json` |
| 6 | `KO1_BARS=<bars> python3 tools/history.py` | `history.json` — the test on four past Octobers |
| 7 | `python3 tools/assemble.py` | `data/pre-profit.json` beside the page — the shelf scored, the knockout run again with the debt reading |
| 8 | `python3 tools/build_page.py` then `node tools/shots.mjs` | `PRE-PROFIT.html` and the pictures |

`model.py` holds the rules and nothing else: who is on the shelf, each reading, the score, the debt load, the debate.
`rules-cli.py` lets the Hub's tests call them. `page-specs.frag` is the words at the foot of the page, with every figure
filled from the data when the page is built. `page-extra.css` adds to the knockout page's own sheet, which is read, not copied.

Step 4 uses the estimates-path study's filing reader as it is (provider branch `provider/np1-estimates-path-20261006`,
`services/estimates-path/ep_filings.py`); point `NP1_FILINGS_DIR` at that folder.

The knockout's rules (`../knockout/tools/rounds.py`) are imported and not changed. With every debt load set to nothing,
`model.debate` returns the knockout's own order and finalists in all 63 branches; `tests/pp1-pre-profit.test.mjs` holds that.
