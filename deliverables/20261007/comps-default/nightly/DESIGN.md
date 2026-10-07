# The nightly comps rebuild — design (7 Oct 2026). Not installed.

Alan's cards and the Hub's COMPS tab read one file per company, written by the one comps engine. Today that file is a record of
one close (6 Oct). This step rebuilds it after every market close, from the same engine, so the tab, the cards, the knockout's
input and the allocation tool stay on the same night's numbers. Nothing here is switched on: the script is in the repo, the
schedule file's name ends in `.NOT-INSTALLED`, and no table, machine or deployment was touched to write it.

## What one run does (`rebuild-comps.sh`)

| step | what | stops the run when |
|---|---|---|
| 0 | takes a lock; a second start leaves at once | — |
| 1 | makes a clean copy of the live Hub line (never a folder somebody works in) | the live line cannot be fetched |
| 2 | reads the session's closes from the chart API and the fifteen public tables the engine loads (`inputs.mjs`) | fewer than 95% of the stocks report a completed close for the day (exit 3: run again later); a table cannot be read (exit 4) |
| 3 | reuses the two slow inputs — each name's Geiger year and its long-term channel — for up to eight days | never: a reading without them says so |
| 4 | runs the engine and derives the cards and the knockout's input (`engine.mjs`, `build-outputs.mjs`) | the engine fails |
| 5 | the gate (`check-artifact.mjs`): shape, and no jump that no market explains, against the files that are live | any check fails (exit 5: last night's files stay) |
| 6 | checks that only the engine's data files changed | anything else changed |
| 7 | `MODE=dry` (default): stops, keeps a copy. `MODE=branch`: commits the data files on `data/comps-<day>` and sends that branch | — |

It never deploys. A person fast-forwards the deploy folder and runs the usual deploy command. That is deliberate: Alan, 3 Oct —
"I don't want you guys to make any changes on my Hub without my approval."

## The gate, in plain words
- At least 400 names answered and 90% of them priced; each of the twelve names has a centre.
- Every name's weights add to one; low is not above high; nobody is left out for being cheap; the growth yardstick counts no
  more than the cap; every card and every knockout row carries exactly the engine's number and its "not a target" line.
- Against the files that are live: at least 95% as many names priced; and no more than a tenth of the names may have moved
  their centre by more than 25% while their price moved less than 5%. A jump like that means a table or a rule changed, not
  the market, and a person should look before it is shown.
- No check is about a level. Nothing is tuned toward a number.

## The schedule (the file `com.scintilla.comps-rebuild.plist.NOT-INSTALLED`)
Market days at 18:30 and 21:00 New York time, and 07:30 the next morning as a catch-up. Each start is a no-op once the night is
built. Measured on 7 Oct with the step's own check: 11 minutes after the bell 312 of 613 stocks reported a completed close (it built
nothing); 37 minutes after the bell 588 of 613 did (96%, enough to go on). A start right at the bell builds nothing, and the
settle check makes the time of day safe to choose loosely.

Why this Mac and launchd: the step needs no secret key (only the Hub's public read key), it needs git and node, and this Mac
already runs the estate's other local agents (`com.scintilla.capture-box`, `com.scintilla.ibkr-putcall`). launchd starts a
missed calendar job when the Mac wakes (Apple, `man launchd.plist`, StartCalendarInterval). The evening + morning pair is the
Hub's own pattern for its daily job (`supabase/migrations/20260928_sigma_daily_cron.sql`: `sigma-daily` and `sigma-daily-catchup`).

To install, when Alan says so (one person, by hand):
```
cp "deliverables/20261007/comps-default/nightly/com.scintilla.comps-rebuild.plist.NOT-INSTALLED" ~/Library/LaunchAgents/com.scintilla.comps-rebuild.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.scintilla.comps-rebuild.plist
launchctl print gui/$(id -u)/com.scintilla.comps-rebuild | head -20      # check: state = not running, 15 calendar starts
```
The read key: place the Hub's public read key in `deliverables/20261007/knockout/tools/.anon` of the main checkout (the file the
knockout's tools already use; git ignores it), or set `SB_ANON_KEY` in the plist's environment. It is never printed.

## The weekly part (not written as a schedule)
Each name's Geiger year (the percentiles of its last 250 trading days) and its computed long-term channel come from the
knockout's replay of the bars (`deliverables/20261007/knockout/tools`: `bars.py`, `bars_tail.py`, `replay_all.py`, then
`comps-engine/tools/channels.py`). They move slowly. The nightly step copies them from `~/.scintilla/comps-nightly/last-inputs/`
when they are younger than eight days. Refreshing that folder once a week is a second, heavier job and is not designed here.

## What it touches — the neighbours, each looked at
| neighbour | what happens | checked |
|---|---|---|
| The Hub's COMPS tab | reads the engine's file first; shows the new night as soon as the files are deployed | the tab prints the file's own date ("session close …") |
| The night reload (pages open 03:00–05:00 reload once) | a page left open picks up the new files the same night | the 07:30 catch-up is after it; a deploy after 05:00 is picked up the next night |
| The allocation tool | keeps the cards file with the newest card date among those it can reach (then the newest re-priced stamp, then its list's order) | from the first night the engine's cards win there by date alone. Found 7 Oct: until this round the tool had kept this morning's cards (the engine's file carried no stamp), and nine of its older tests were pinned to that file by name. The cards now carry the stamp and the fields the tool's card screens read, and those tests read the engine's cards. The tool's own copy goes stale; each card prints its date. Refreshing that copy is a separate push of the tool and is not in this step |
| The tool's rule "a stored price older than four days is not used" | stops tripping, because the card's price is last night's | — |
| The knockout page | static; reads `knockout-comps.json` only when the knockout is re-run | this step rewrites its input, not the page |
| Tests that pin the 6 Oct numbers | `tests/cp4-one-engine.test.mjs` and `tests/cp5-expensive-only.test.mjs` read the same data folder | the tests that name a 6 Oct figure skip themselves when the files are from another close; the rule tests always run |
| The deploy guard's list of changed files | must show only `deliverables/20261007/comps-engine/data/` | step 6 enforces the same thing before anything is sent |
| The chart API | about ten reads of sixty symbols once a night | read-only; the Hub's own origin header |
| The Hub's tables | about fifty paged reads once a night with the public read key | read-only; no write path exists in the script |
| The engine's one-off flags | still read from the 7 Oct knockout file (`knockout.json`) | a name whose one-off gain appears later is not flagged until the knockout is re-run — said here, not hidden |
| Repo size | about 1,000 small files change per night (one line each) | git stores them as deltas; if it grows, publish to a data branch that is squashed weekly |

## What it does not do
It does not deploy, write a table, touch a Fly machine, use a paid service, or change a rule. It does not refresh the Geiger year
or the channels (weekly part). It does not rebuild the knockout page. It was run here only as a dry run on the 6 Oct inputs.
