# The knockout — how it is run

Every step reads; none writes a table, deploys, or needs a Fly key. Run from an empty scratch folder that holds
`.anon` (the Hub's public read key, the one the Hub page itself uses — a private file, never committed) and
`quotes-all-raw.json` (the settled closes of the session, one `/quotes` capture of the whole universe from the chart API).

| step | command | what it leaves in the scratch folder |
|---|---|---|
| 1 | `python3 tools/snapshot.py` | `snap/*.json` — one read of each public table, about 100 requests |
| 2 | `node tools/comps-universe.mjs` | `comps-universe.json` — the fixed comps for every company, from the snapshot |
| 3 | `python3 tools/bars.py` | `bars/*.npz` — bars for the Geiger replay (needs `symbols-to-replay.json`) |
| 4 | `python3 tools/bars_tail.py` | the newest session's intraday bars joined on |
| 5 | `python3 tools/replay_all.py` | `replay.pkl` — every name's Geiger, evening by evening, checked against the live one |
| 6 | `python3 tools/fundamentals.py` | `fundamentals.json` — growth on a clean base, revisions, cash |
| 7 | `python3 tools/timing.py` | `timing.json` — Geiger and its own year, levels, zones, cool-down closes |
| 8 | `python3 tools/knockout.py` | `data/knockout.json` beside the page — the rounds, joined |
| 9 | `python3 tools/build_page.py` then `node tools/shots.mjs` | `KNOCKOUT.html` and the pictures |

Also needed in the scratch folder: `geiger-live.json` (one read of the chart API's `/geiger` after the close) and
`confluence-20261006.json` (the confluence study's file of reviewed lines and zones).

`rounds.py` holds the rules of the three rounds and nothing else. `local-pg.mjs` answers the comps reader's table
reads from the snapshot. `geiger_replay.py` is the Geiger-history study's replay with one import line changed.
