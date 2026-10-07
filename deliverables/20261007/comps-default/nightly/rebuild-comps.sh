#!/bin/bash
# THE NIGHTLY COMPS REBUILD — one step, from the one engine. Designed 7 Oct 2026. NOT INSTALLED: nothing schedules this file.
# Read DESIGN.md (what it does, what it touches) and ROLLBACK.md (the way back) beside it.
#
#   MODE=dry     (the default)  build tonight's files in a scratch folder, run the gate, print what would change. Publishes nothing.
#   MODE=branch                 the same, then commit ONLY the engine's data files on a branch named data/comps-<day> and send that
#                               branch to GitHub for the coordinator. A person looks and deploys; this file never deploys.
#   DRY_RUN=1 (kept as a second lock) forces MODE=dry whatever MODE says.
#
# It reads the chart API's closes and the Hub's public tables (inputs.mjs), runs the comps engine and its derived files, and
# checks them (check-artifact.mjs). No key but the Hub's public read key; no table is written; no machine on Fly is touched.
set -euo pipefail
MODE="${MODE:-dry}"; [ "${DRY_RUN:-0}" = "1" ] && MODE=dry
DAY="${DAY:-$(TZ=America/New_York date +%F)}"
HUB_REPO="${HUB_REPO:-/Users/alanharvey/SCINTILLA 0.5/_VERCEL_DEPLOY}"
LIVE_LINE="${LIVE_LINE:-origin/hub/release-20260923}"
HOME_DIR="${COMPS_NIGHTLY_HOME:-$HOME/.scintilla/comps-nightly}"
WORK="$HOME_DIR/$DAY"; WT="$WORK/hub"; LOG="$WORK/run.log"; KEEP="$HOME_DIR/last-inputs"
ENGINE_DIR="deliverables/20261007/comps-engine"; HERE_REL="deliverables/20261007/comps-default/nightly"
mkdir -p "$WORK" "$KEEP"; exec > >(tee -a "$LOG") 2>&1
say() { echo "[$(TZ=America/New_York date +%H:%M:%S) ET] $*"; }
finish() { code=$?; [ -d "$WT" ] && git -C "$HUB_REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true; say "ended with code $code (0 built · 3 close not settled · 4 a table unread · 5 the gate kept last night's files)"; exit $code; }
trap finish EXIT
say "comps rebuild for $DAY · mode $MODE"

# 0 · one run at a time; a second start leaves at once
LOCK="$HOME_DIR/lock"; if ! mkdir "$LOCK" 2>/dev/null; then say "another run holds the lock ($LOCK); leaving"; trap - EXIT; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null || true; finish' EXIT

# 1 · a clean copy of the live line — never a checkout somebody works in
git -C "$HUB_REPO" fetch -q origin
[ -d "$WT" ] && git -C "$HUB_REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true
git -C "$HUB_REPO" worktree add -q --detach "$WT" "$LIVE_LINE"
say "live line at $(git -C "$WT" rev-parse --short HEAD)"

# 2 · the inputs: the settled closes (or leave, exit 3) and the fifteen tables
#     INPUTS_FROM=<folder> is the rehearsal: saved inputs (snap/, quotes-all-raw.json) are used and nothing is read
if [ -n "${INPUTS_FROM:-}" ]; then say "rehearsal: inputs copied from $INPUTS_FROM"; rm -rf "$WORK/snap"; cp -R "$INPUTS_FROM/snap" "$WORK/snap"; cp "$INPUTS_FROM/quotes-all-raw.json" "$WORK/"; for f in geiger-year.json channels.json confluence-zones.json; do [ -f "$INPUTS_FROM/$f" ] && cp "$INPUTS_FROM/$f" "$KEEP/$f"; done
else node "$WT/$HERE_REL/inputs.mjs" --day "$DAY" --out "$WORK"; fi

# 3 · the two slow inputs are reused for up to eight days and say their own dates on every reading
for f in geiger-year.json channels.json; do
  if [ -f "$KEEP/$f" ] && [ -n "$(find "$KEEP/$f" -mtime -8 2>/dev/null)" ]; then cp "$KEEP/$f" "$WORK/$f"; else say "no $f younger than eight days: the readings carry the knockout's Geiger and no computed channel until the weekly refresh runs (DESIGN.md, 'the weekly part')"; fi
done

# 4 · the one engine, then the files every screen reads
( cd "$WORK" && CP4_ZONES="$KEEP/confluence-zones.json" node "$WT/$ENGINE_DIR/tools/engine.mjs" --today "$DAY" --out "$WT/$ENGINE_DIR/data" ) | tail -3   # the reviewed rails, when the weekly refresh left them beside the two slow inputs
node "$WT/$ENGINE_DIR/tools/build-outputs.mjs"

# 5 · the gate: shape, and no jump that no market explains, against the files that are live
OLD="$WORK/live-data"; rm -rf "$OLD"; mkdir -p "$OLD"; git -C "$WT" archive HEAD "$ENGINE_DIR/data" | tar -x -C "$OLD"
node "$WT/$HERE_REL/check-artifact.mjs" --new "$WT/$ENGINE_DIR/data" --old "$OLD/$ENGINE_DIR/data"

# 6 · only the engine's data files may have changed
OTHER="$(git -C "$WT" status --porcelain | grep -v " $ENGINE_DIR/data/" || true)"
if [ -n "$OTHER" ]; then say "files outside $ENGINE_DIR/data changed; nothing is published:"; echo "$OTHER" | head; exit 5; fi
say "$(git -C "$WT" status --porcelain | wc -l | tr -d ' ') data files differ from the live line"

# 7 · publish
if [ "$MODE" != "branch" ]; then say "dry run: nothing committed, nothing sent. Tonight's files are in $WT/$ENGINE_DIR/data until this run ends; a copy is kept in $WORK/built"; rm -rf "$WORK/built"; cp -R "$WT/$ENGINE_DIR/data" "$WORK/built"; exit 0; fi
BR="data/comps-$DAY"
git -C "$WT" switch -q -c "$BR"
git -C "$WT" add "$ENGINE_DIR/data"
git -C "$WT" commit -q -m "Comps, rebuilt on the $DAY close by the one engine (data files only; the gate passed — see the run log)"
git -C "$WT" push -q -u origin "$BR"
say "sent $BR at $(git -C "$WT" rev-parse --short HEAD). For the coordinator, after a look:"
say "  cd \"/Users/alanharvey/SCINTILLA 0.5/_deploy/hub-deploy\" && git fetch origin && git merge --ff-only origin/$BR   # then the usual deploy command"
