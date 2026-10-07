#!/bin/bash
# rollback.sh - switches the night reload off: unloads the timetable and deletes it. Nothing else on the Mac is touched.
#   rollback.sh          off (the kit stays in ~/Scintilla/night-reload, so switch-on.sh can bring it back)
#   rollback.sh --all    off, and the kit folder, its launcher app and its two logs are deleted as well
# The one thing a script cannot undo for Alan: System Settings > Privacy & Security > Accessibility > select "Scintilla Night Reload"
# > click the minus sign. (With the app deleted the entry does nothing; removing it is tidiness.)
set -u
DEST="$HOME/Scintilla/night-reload"; LABEL=com.scintilla.night-reload
/bin/launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "unloaded $LABEL" || echo "$LABEL was not loaded"
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist" && echo "deleted ~/Library/LaunchAgents/$LABEL.plist"
if [ "${1:-}" = "--all" ] && [ -n "${HOME:-}" ] && [ -d "$DEST" ]; then
  rm -rf "$DEST"; rm -f "$HOME/Library/Logs/scintilla-night-reload.log" "$HOME/Library/Logs/scintilla-night-reload.launchd.log"
  echo "deleted $DEST and its logs"
fi
/bin/launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 && echo "STILL LOADED - look again" || echo "OFF."
