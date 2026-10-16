# How the RADAR comps page was made (15 Oct 2026)

Read-only throughout: nothing deployed, no table written, no schedule set. Headless, from a local serve of this branch's files; the database is the live one, read the Hub's own way (GET).

| step | script | what it does | network |
|---|---|---|---|
| 1 | `read-lists.mjs`, `read-db.mjs` (`sb.mjs`) | the RADAR list, profiles, tags, home cohorts, FMP peers, the served universe, the analyst targets (the allocation tool's rule) | database, GET only |
| 2 | `drive.mjs` | serves this repository on 127.0.0.1, opens the Hub, and for each name reads the live COMPS tab's state and mounts the four-switch tab (deliverables/20261001/comps-table-first) once per switch; every non-GET answered locally and counted | database and the quotes API, GET only |
| 3 | `build.mjs` | the analysis: centres, midpoints, distances, the peer-set test, the method-break flags; writes `RADAR-COMPS.json` and `reads/` | none |
| 4 | `page.mjs`, `shots.mjs` | the page and its pictures (file://, every network request blocked) | none |

The scripts point at a session scratch folder (`S`) and the output folder (`OUT`); the reads they ran on are in `reads/`. The anon key is read from `index.html` at run time and never printed or stored.
