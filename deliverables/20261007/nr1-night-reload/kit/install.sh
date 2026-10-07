#!/bin/bash
# install.sh - puts the night reload in ~/Scintilla/night-reload and builds its launcher app on THIS Mac.
# It does NOT switch the job on: nothing is copied to ~/Library/LaunchAgents and nothing is loaded. That is switch-on.sh, after Alan's go.
# Safe to run again: it refreshes the scripts, keeps config.env, and keeps the launcher app (rebuilding the app would make macOS ask
# for the Accessibility permission again; pass --rebuild-app only if you mean to).
set -eu
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Scintilla/night-reload"
APP="$DEST/Scintilla Night Reload.app"
mkdir -p "$DEST" "$HOME/Library/Logs"
for f in night-reload.sh gui.applescript launcher.applescript switch-on.sh rollback.sh config.example.env; do cp "$SRC/$f" "$DEST/$f"; done
chmod +x "$DEST/night-reload.sh" "$DEST/switch-on.sh" "$DEST/rollback.sh"
[ -f "$DEST/config.env" ] || cp "$SRC/config.example.env" "$DEST/config.env"
if [ ! -d "$APP" ] || [ "${1:-}" = "--rebuild-app" ]; then
  rm -rf "$APP"
  /usr/bin/osacompile -o "$APP" "$SRC/launcher.applescript"
  PB=/usr/libexec/PlistBuddy; INFO="$APP/Contents/Info.plist"
  # no Dock icon, no menu bar, never comes to the front by itself
  "$PB" -c "Add :LSUIElement bool true" "$INFO" 2>/dev/null || "$PB" -c "Set :LSUIElement true" "$INFO"
  "$PB" -c "Add :CFBundleIdentifier string com.scintilla.night-reload" "$INFO" 2>/dev/null || "$PB" -c "Set :CFBundleIdentifier com.scintilla.night-reload" "$INFO"
  "$PB" -c "Add :NSAppleEventsUsageDescription string 'Scintilla Night Reload uses System Events to reload the Station and X windows at night.'" "$INFO" 2>/dev/null \
    || "$PB" -c "Set :NSAppleEventsUsageDescription 'Scintilla Night Reload uses System Events to reload the Station and X windows at night.'" "$INFO"
  /usr/bin/codesign --force --sign - "$APP"
  echo "built: $APP"
else
  echo "kept:  $APP (its permission stays valid)"
fi
sed "s#__HOME__#$HOME#g" "$SRC/com.scintilla.night-reload.plist" > "$DEST/com.scintilla.night-reload.plist"
/usr/bin/plutil -lint "$DEST/com.scintilla.night-reload.plist" >/dev/null
cat <<MSG

Installed in $DEST. Nothing is switched on.

NEXT, with Alan:
  1. the permission (once):  System Settings > Privacy & Security > Accessibility > + > choose "Scintilla Night Reload" in
     $DEST > switch it on.
  2. a dry run (looks, sends nothing):   open "$APP"
     The first time, macOS asks whether Scintilla Night Reload may control "System Events": click Allow.
  3. the supervised test (the real thing, now):   open "$APP" --env SCINTILLA_NIGHT_RELOAD_MODE=test
  4. only then:   "$DEST/switch-on.sh"
Undo everything:  "$DEST/rollback.sh" --all
MSG
