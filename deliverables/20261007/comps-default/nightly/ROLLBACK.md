# The nightly comps rebuild — the way back (written before anything is installed)

Nothing is installed today, so today there is nothing to roll back. These are the steps for the day it is.

## 1 · Stop the schedule (one minute; nothing else changes)
```
launchctl bootout gui/$(id -u)/com.scintilla.comps-rebuild
rm ~/Library/LaunchAgents/com.scintilla.comps-rebuild.plist
launchctl print gui/$(id -u)/com.scintilla.comps-rebuild 2>&1 | head -1     # must say it could not find the service
```
A run that is in the middle of building finishes or is stopped with `pkill -f rebuild-comps.sh`; it publishes nothing unless
it reaches its last step, and its lock is the folder `~/.scintilla/comps-nightly/lock` (remove it if a stopped run left it).

## 2 · One bad night that was already deployed
The step only ever sends a branch named `data/comps-<day>` holding data files. If the coordinator merged and deployed one and
it is wrong, put last night's files back — either way takes the Hub to exactly what it showed before:
```
cd "/Users/alanharvey/SCINTILLA 0.5/_deploy/hub-deploy"
git log --oneline -3 -- deliverables/20261007/comps-engine/data           # the night's commit and the one before it
git revert --no-edit <the night's commit>                                 # or: vercel promote <the deployment before it>
# then the usual deploy command, and the check: the tab's own line "session close <day>" shows the earlier day
```
Only files under `deliverables/20261007/comps-engine/data/` change; the page, the rules and every other room are untouched.

## 3 · A night that was never deployed
Delete its branch: `git push origin --delete data/comps-<day>`. Nothing was live.

## 4 · Back to the rules of the afternoon of 7 Oct (before this round)
The engine's configuration is one line each:
- outliers two-sided again: `expensiveOnly: false` in `CP5_ALL` (`deliverables/20261005/comps-c6/outliers.mjs`);
- the cap at 40: `CP5_CAP = 40` (the same file), or run the engine with `--cap 40` / `--cap none`;
- no line seats: `lineSeats: false` in `CP5_LINES_ON` (`deliverables/20261003/comps-c5/lines.mjs`) and in `CP5_ALL`;
then `node deliverables/20261007/comps-engine/tools/engine.mjs` from the inputs folder and `node …/tools/build-outputs.mjs`.
The afternoon's own numbers for every name are kept in `comps-engine/data/before-outlier-and-cap-fix.json` to check against.
The comps tab that is live on the Hub today reads none of these switches (`LIVE_FX` is unchanged).

## 5 · Remove every trace
`rm -rf ~/.scintilla/comps-nightly` (run logs, scratch inputs, the lock). No table, bucket, machine or secret was created.
