#!/bin/zsh
# Sign in to X (Scintilla collector) — the one human step, one click, one time.
# Opens the collector's OWN Chrome profile on x.com/login. Your everyday Chrome, its
# windows and sign-ins are untouched. Nothing here reads, exports or copies cookies.
HUB="${SCINTILLA_XFEED_HUB:-$HOME/Scintilla-Collector/hub}"
RUNTIME="${SCINTILLA_XFEED_RUNTIME:-$HOME/Scintilla-Collector/runtime}"
PROFILE="${SCINTILLA_XFEED_PROFILE:-$HOME/Library/Application Support/Scintilla/xfeed-collector-profile}"
NODE="$(command -v node 2>/dev/null || true)"; [ -x "${NODE:-/nonexistent}" ] || NODE=/usr/local/bin/node
if [ -f "$HUB/scripts/xfeed-program.mjs" ] && [ -x "$NODE" ]; then
  cd "$HUB" && exec "$NODE" scripts/xfeed-program.mjs sign-in --profile "$PROFILE" --runtime-dir "$RUNTIME"
fi
# Program not installed yet: plain Chrome on the same profile directory does the same job.
mkdir -p "$PROFILE"
CHROME="/Applications/Google Chrome.app"; [ -d "$CHROME" ] || CHROME="/Applications/Chrome.app"
echo "Opening the collector profile ($PROFILE) in $CHROME. Sign in to X there, then close that window."
open -na "$CHROME" --args --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check "https://x.com/login"
