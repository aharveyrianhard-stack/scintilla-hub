#!/bin/bash
# switch-on.sh - starts the nightly timetable on THIS Mac. Run it only after Alan's go and a passed supervised test.
set -eu
DEST="$HOME/Scintilla/night-reload"; LABEL=com.scintilla.night-reload
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
[ -d "$DEST/Scintilla Night Reload.app" ] || { echo "run install.sh first"; exit 1; }
/usr/bin/plutil -lint "$DEST/$LABEL.plist" >/dev/null
/bin/launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
cp "$DEST/$LABEL.plist" "$PLIST"
/bin/launchctl bootstrap "gui/$(id -u)" "$PLIST"
/bin/launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | grep -E '^\s*(state|program|runs) =' || true
echo "ON. First try tonight at 04:00. Switch off: $DEST/rollback.sh"
