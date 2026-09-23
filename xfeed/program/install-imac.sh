#!/bin/zsh
# Install the X Trading-list collector PROGRAM on this Mac (meant for the iMac, 192.168.0.204).
# Run in Terminal as alanharvey:   zsh ~/Downloads/install-imac.sh     (or from the copied hub folder)
# What it does: copies the collector code + the operational ledger from the MacBook over the existing SSH,
# installs the two npm packages, installs the launchd schedule (06:30/10:30/14:30/18:30 ET), and puts the
# one-click sign-in file on the Desktop. It never copies .env.local (the publication token): step 5 is yours.
set -euo pipefail
MACBOOK="${MACBOOK:-alanharvey@192.168.0.97}"
SRC_HUB="${SRC_HUB:-/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-xfeed-program-20260922}"
SRC_RUNTIME="${SRC_RUNTIME:-/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime}"
BASE="$HOME/Scintilla-Collector"; HUB="$BASE/hub"; RUNTIME="$BASE/runtime"
PROFILE="$HOME/Library/Application Support/Scintilla/xfeed-collector-profile"
NODE="$(command -v node 2>/dev/null || true)"; [ -x "${NODE:-/nonexistent}" ] || NODE=/usr/local/bin/node
NPM="$(dirname "$NODE")/npm"
LABEL=com.alanharvey.scintilla-xfeed-collector; PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
[ -x "$NODE" ] || { echo "Node is required (found none). Install Node 22+ then rerun."; exit 1; }
echo "1/6 collector code -> $HUB"; mkdir -p "$HUB" "$RUNTIME/logs" "$HOME/Library/LaunchAgents"
rsync -a --delete --exclude .git --exclude node_modules --exclude '.env*' --exclude deliverables "$MACBOOK:\"$SRC_HUB/\"" "$HUB/"
echo "2/6 operational ledger -> $RUNTIME  (one-time move; after this the MacBook copy must not be collected into)"
rsync -a "$MACBOOK:\"$SRC_RUNTIME/\"" "$RUNTIME/"
echo "3/6 npm packages: @vercel/blob (publication) and playwright 1.62.1 (browser driver)"
( cd "$HUB" && "$NPM" install --no-audit --no-fund --silent && "$NPM" install --no-save --no-audit --no-fund --silent playwright@1.62.1 )
echo "4/6 launchd schedule"
sed -e "s#__NODE__#$NODE#g" -e "s#__HUB__#$HUB#g" -e "s#__RUNTIME__#$RUNTIME#g" -e "s#__PROFILE__#$PROFILE#g" -e "s#__HOME__#$HOME#g" "$HUB/xfeed/program/$LABEL.plist" > "$PLIST"
plutil -lint "$PLIST"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl print "gui/$(id -u)/$LABEL" | grep -E "^\s*(state|program) =" || true
echo "5/6 publication token: copy your .env.local into $HUB/ yourself. This script never does. Without it, passes finish locally and the public X Desk does not advance."
echo "6/6 sign-in file -> Desktop"
cp "$HUB/xfeed/program/Sign-in-to-X-collector.command" "$HOME/Desktop/Sign in to X (Scintilla collector).command"
chmod +x "$HOME/Desktop/Sign in to X (Scintilla collector).command"
cat <<DONE

Installed. Next:
  a) double-click "Sign in to X (Scintilla collector)" on the Desktop and sign in once;
  b) first catch-up (the feed is two weeks behind, so this one is long):
       cd "$HUB" && "$NODE" scripts/xfeed-program.mjs run --catch-up --runtime-dir "$RUNTIME" --profile "$PROFILE"
  c) then launchd runs it at 06:30, 10:30, 14:30, 18:30. Health: "$NODE" scripts/xfeed-program.mjs status --runtime-dir "$RUNTIME"
  Manual run any time:  launchctl kickstart -k gui/$(id -u)/$LABEL
  Remove:               launchctl bootout gui/$(id -u)/$LABEL && rm "$PLIST"
DONE
