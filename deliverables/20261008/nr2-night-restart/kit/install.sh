#!/bin/bash
# install.sh - puts the night job (restart + reload) in ~/Scintilla/night-reload and builds its launcher app on THIS Mac.
# It does NOT switch the job on: nothing is copied to ~/Library/LaunchAgents and nothing is loaded. That is switch-on.sh, after Alan's go
# and a passed supervised test (supervised-test.sh).
# Safe to run again: it refreshes the scripts, keeps config.env, and keeps the launcher app (rebuilding the app would make macOS ask
# for the Accessibility permission again; pass --rebuild-app only if you mean to). A Mac that already built the 7 Oct app keeps
# that app and its permission: it runs this job just the same, and only shows the whole record in its box instead of the end of it.
set -eu
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Scintilla/night-reload"
APP="$DEST/Scintilla Night Reload.app"
OSACOMPILE=/usr/bin/osacompile; CODESIGN=/usr/bin/codesign
[ -n "${NR_TOOLS:-}" ] && { OSACOMPILE="$NR_TOOLS/osacompile"; CODESIGN="$NR_TOOLS/codesign"; }     # the tests build no real app
mkdir -p "$DEST" "$HOME/Library/Logs"
if [ "$SRC" != "$DEST" ]; then
  for f in night-reload.sh gui.applescript launcher.applescript switch-on.sh rollback.sh supervised-test.sh config.example.env; do cp "$SRC/$f" "$DEST/$f"; done
fi
chmod +x "$DEST/night-reload.sh" "$DEST/switch-on.sh" "$DEST/rollback.sh" "$DEST/supervised-test.sh"
if [ ! -f "$DEST/config.env" ]; then cp "$SRC/config.example.env" "$DEST/config.env"
elif ! grep -q '^RESTART_APPS=' "$DEST/config.env"; then
  # a config.env from the 7 Oct kit: say out loud that the restart is now on, so it can be switched off in one place
  printf '\n# added by install.sh, 8 Oct 2026 kit: the restart before the reload (see config.example.env). no = reload only.\nRESTART_APPS=yes\n' >> "$DEST/config.env"
fi
if [ ! -d "$APP" ] || [ "${1:-}" = "--rebuild-app" ]; then
  rm -rf "$APP"
  "$OSACOMPILE" -o "$APP" "$SRC/launcher.applescript"
  PB=/usr/libexec/PlistBuddy; INFO="$APP/Contents/Info.plist"
  # no Dock icon, no menu bar, never comes to the front by itself
  "$PB" -c "Add :LSUIElement bool true" "$INFO" 2>/dev/null || "$PB" -c "Set :LSUIElement true" "$INFO"
  "$PB" -c "Add :CFBundleIdentifier string com.scintilla.night-reload" "$INFO" 2>/dev/null || "$PB" -c "Set :CFBundleIdentifier com.scintilla.night-reload" "$INFO"
  "$PB" -c "Add :NSAppleEventsUsageDescription string 'Scintilla Night Reload uses System Events to reload the Station and X windows at night.'" "$INFO" 2>/dev/null \
    || "$PB" -c "Set :NSAppleEventsUsageDescription 'Scintilla Night Reload uses System Events to reload the Station and X windows at night.'" "$INFO"
  "$CODESIGN" --force --sign - "$APP"
  echo "built: $APP"
else
  echo "kept:  $APP (its permission stays valid)"
fi
sed "s#__HOME__#$HOME#g" "$SRC/com.scintilla.night-reload.plist" > "$DEST/com.scintilla.night-reload.plist.new" && mv "$DEST/com.scintilla.night-reload.plist.new" "$DEST/com.scintilla.night-reload.plist"
/usr/bin/plutil -lint "$DEST/com.scintilla.night-reload.plist" >/dev/null
cat <<MSG

Installed in $DEST. Nothing is switched on.

NEXT, with Alan, after the market close:
  1. the permission (once):  System Settings > Privacy & Security > Accessibility > + > choose "Scintilla Night Reload" in
     $DEST > switch it on.
  2. look only (closes nothing, presses nothing):   "$DEST/supervised-test.sh" --look
     The first time, macOS asks whether Scintilla Night Reload may control "System Events": click Allow.
  3. the supervised test (the real restart, now, with Alan watching):   "$DEST/supervised-test.sh"
     It first says what Alan should see if it works and if it does not, then waits for Return.
  4. only then:   "$DEST/switch-on.sh"
Back to reloading only (no app is closed any more):   "$DEST/rollback.sh" --reload-only
Off altogether:   "$DEST/rollback.sh"        Off and gone:   "$DEST/rollback.sh" --all
MSG
