#!/bin/bash
# rollback.sh - the ways back. Nothing else on the Mac is touched, and no app is closed or opened by any of them.
#   rollback.sh --reload-only   the 4 am job stops closing apps and goes back to what it did on 7 Oct: reload the Station and X,
#                               run the X extension, check X. The timetable stays as it is. (It writes RESTART_APPS=no in config.env.)
#   rollback.sh --restart-on    the opposite: the restart before the reload is switched on again.
#   rollback.sh                 off: unloads the timetable and deletes it (the kit stays in ~/Scintilla/night-reload, so switch-on.sh
#                               can bring it back)
#   rollback.sh --all           off, and the kit folder, its launcher app and its two logs are deleted as well
# The one thing a script cannot undo for Alan: System Settings > Privacy & Security > Accessibility > select "Scintilla Night Reload"
# > click the minus sign. (With the app deleted the entry does nothing; removing it is tidiness.)
set -u
DEST="$HOME/Scintilla/night-reload"; LABEL=com.scintilla.night-reload; CONF="$DEST/config.env"
LAUNCHCTL=/bin/launchctl; [ -n "${NR_TOOLS:-}" ] && LAUNCHCTL="$NR_TOOLS/launchctl"                  # the tests load and unload nothing
restart_switch() {  # $1 = yes | no
  [ -d "$DEST" ] || { echo "nothing is installed in $DEST"; exit 1; }
  touch "$CONF"
  if grep -q '^RESTART_APPS=' "$CONF"; then /usr/bin/sed -i '' "s/^RESTART_APPS=.*/RESTART_APPS=$1/" "$CONF"; else printf '\nRESTART_APPS=%s\n' "$1" >> "$CONF"; fi
  grep -q "^RESTART_APPS=$1\$" "$CONF" || { echo "could not write RESTART_APPS=$1 in $CONF - look again"; exit 1; }
}
case "${1:-}" in
  --reload-only)
    restart_switch no
    echo "Done. From tonight the 4 am job no longer closes any app: it reloads the Station and X and reconnects X, as it did on 7 Oct."
    echo "The timetable was not touched. To switch the restart back on: $DEST/rollback.sh --restart-on"
    exit 0 ;;
  --restart-on)
    restart_switch yes
    echo "Done. From tonight the 4 am job closes and reopens TradingView, the Hub app and Brave before it reloads the Station and X."
    exit 0 ;;
  ""|--all) ;;
  *) echo "usage: rollback.sh [--reload-only | --restart-on | --all]"; exit 2 ;;
esac
"$LAUNCHCTL" bootout "gui/$(id -u)/$LABEL" 2>/dev/null && echo "unloaded $LABEL" || echo "$LABEL was not loaded"
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist" && echo "deleted ~/Library/LaunchAgents/$LABEL.plist"
if [ "${1:-}" = "--all" ] && [ -n "${HOME:-}" ] && [ -d "$DEST" ]; then
  rm -rf "$DEST"; rm -f "$HOME/Library/Logs/scintilla-night-reload.log" "$HOME/Library/Logs/scintilla-night-reload.launchd.log"
  echo "deleted $DEST and its logs"
fi
"$LAUNCHCTL" print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 && echo "STILL LOADED - look again" || echo "OFF."
