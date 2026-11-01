#!/bin/bash
# updates the app in place on both Macs. No bootout and bootstrap: re-registering a launch agent is what makes macOS post "Background Items Added".
I=(-i "$HOME/.ssh/id_imac" -o ConnectTimeout=8 -o BatchMode=yes); H=alanharvey@192.168.0.204; D="/Users/alanharvey/SCINTILLA 0.5/_worktrees/notify-switchboard-20261101/scripts/scintilla-mac"
rsync -a --delete "$D/build/Scintilla.app/" "$HOME/Applications/Scintilla.app/" && launchctl kickstart -k gui/501/com.scintilla.notify; sleep 3; pgrep -x Scintilla >/dev/null || launchctl kickstart gui/501/com.scintilla.notify; sleep 2; pgrep -x Scintilla >/dev/null && echo macbook-running
rsync -a --delete -e "ssh ${I[*]}" "$D/build/Scintilla.app/" "$H:Applications/Scintilla.app/" && ssh "${I[@]}" $H 'launchctl kickstart -k gui/501/com.scintilla.notify; sleep 3; pgrep -x Scintilla >/dev/null || launchctl kickstart gui/501/com.scintilla.notify; sleep 2; pgrep -x Scintilla >/dev/null && echo imac-running'
