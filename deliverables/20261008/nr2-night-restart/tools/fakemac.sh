#!/bin/bash
# fakemac.sh - a stand-in Mac for the night-restart tests (tests/nr2-night-restart.test.mjs). It never touches a real process.
#
# The "Mac" is one table, $FAKEMAC_DIR/procs.tsv, one process per line:
#   number, parent, kB in real memory, kB as Activity Monitor counts it, group, name in macOS's app list (or -), bundle id (or -),
#   kind (or -), bundle path (or -), command line, role (main | helper | shim)
# and this file answers, from that table, everything the night job asks a Mac: the process list, the memory list, the app list,
# "please quit", "open this app", "keep the screen awake", and the window helper. Every request that would change a real Mac is written
# to $FAKEMAC_DIR/calls.txt, in order, so a test can read exactly what the job did:
#   CLOSE <group>:<role> <signal>     OPEN <the arguments>     AWAKE <the arguments>     and the window helper's own lines, as they are
# How an app behaves is set in $FAKEMAC_DIR/behave, one line each:  tv=refuses | tv=slow:40 | open.tv=fail | open.tv=fail-once
#   reuse.tv=2 : at the second look at the process list TradingView has gone and its process number belongs to another program
# It is called through links named kill, open, caffeinate and gui, or as "fakemac.sh <verb> ...".
# 15 Oct 2026 - where a window is: FAKE_STATION_WHERE / FAKE_X_WHERE = reachable (default) | minimised | elsewhere | fullscreen | closed.
#   The window helper answers "windows" (Accessibility: only reachable and minimised ones) and "everywhere" (the window server: every
#   one) from that, and "activate", "unminimise" and "open -b" move it to reachable - unless FAKE_STUCK=1, when nothing moves it.
#   FAKE_CONSENT = not-asked (default) | allowed | denied; FAKE_TABS = what Brave answers when asked for its tabs (consent allowed only);
#   FAKE_BRAVE_OWN = how many windows of its own the window server shows for a Foreground Brave (default 1).
#   FAKE_CR=1 = the window helper answers "everywhere" and "tabs" with carriage returns between lines, as the real one does (NR4).
D="${FAKEMAC_DIR:?FAKEMAC_DIR is not set}"; T="$D/procs.tsv"; C="$D/calls.txt"; H="${FAKEMAC_HOME:-$D}"
verb="$(basename "$0")"; case "$verb" in fakemac.sh) verb="${1:-}"; shift ;; esac
TV="/Applications/TradingView.app"; BR="/Applications/Brave Browser.app"; CH="/Applications/Google Chrome.app"
HUB="$H/Applications/SCINTILLA.app"; YT="$H/Applications/YouTube.app"; SHIMS="$H/Applications/Brave Browser Apps.localized"
WEBAPP="/System/Volumes/Preboot/Cryptexes/App/System/Library/CoreServices/Web App.app/Contents/MacOS/Web App"
WK="/System/Library/Frameworks/WebKit.framework/Versions/A/XPCServices"
STATION_ID=com.brave.Browser.app.gdmjjlilbdmfgjomdbklfoihogfkcpbh; X_ID=com.brave.Browser.app.lodlkdfmihgonocnmddehnfgiljnadcf

behave() { sed -n "s/^$1=//p" "$D/behave" 2>/dev/null | head -1; }
drop_group() { awk -F'\t' -v g="$1" '$5 != g' "$T" > "$T.new"; mv "$T.new" "$T"; }
drop_pid() { awk -F'\t' -v p="$1" '$1 != p' "$T" > "$T.new"; mv "$T.new" "$T"; }
newpid() { local n; n="$(cat "$D/nextpid" 2>/dev/null || echo 20000)"; echo $(( n + 1 )) > "$D/nextpid"; echo "$n"; }
row() { printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$@" >> "$T"; }
has() { awk -F'\t' -v b="$1" '$7 == b { f = 1 } END { exit f ? 0 : 1 }' "$T"; }
tick() {            # an app that is slow to close goes away after so many looks at the process list
  local f g n
  for f in "$D"/dying.*; do
    [ -e "$f" ] || continue
    g="${f##*.}"; n=$(( $(cat "$f") - 1 ))
    if [ "$n" -le 0 ]; then rm -f "$f"; drop_group "$g"; else echo "$n" > "$f"; fi
  done
}
add_tv() {          # $1 = first process number or "new", $2 = its options, $3 $4 = kB (real, Activity Monitor) of the main process
  local p="$1"; [ "$p" = new ] && p="$(newpid)"
  row "$p" 1 "$3" "$4" tv TradingView com.tradingview.tradingviewapp.desktop Foreground "$TV" "$TV/Contents/MacOS/TradingView${2:+ $2}" main
  row "$(newpid)" "$p" "$(( $3 * 3 ))" "$(( $4 * 6 ))" tv - - - - "$TV/Contents/Frameworks/TradingView Helper (Renderer).app/Contents/MacOS/TradingView Helper (Renderer) --type=renderer --user-data-dir=$H/Library/Application Support/TradingView" helper
  row "$(newpid)" "$p" "$(( $3 / 2 ))" "$(( $4 * 4 ))" tv - - - - "$TV/Contents/Frameworks/TradingView Helper.app/Contents/MacOS/TradingView Helper --type=gpu-process" helper
}
add_hub() {         # $1 = first process number or "new", $2 $3 = kB of its page process
  local p="$1"; [ "$p" = new ] && p="$(newpid)"
  row "$p" 1 15000 65000 hub SCINTILLA com.apple.Safari.WebApp.9257ED5B-FBF6-44EC-911A-8A8DD1CB2C9C Foreground "$HUB" "$WEBAPP --bundlepath $HUB --sandboxextension 361c0e4d;00;00000000;com.apple.app-sandbox.read" main
  row "$(newpid)" 1 "$2" "$3" hub "SCINTILLA Web Content" com.apple.WebKit.WebContent UIElement - "$WK/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent" helper
  row "$(newpid)" 1 10000 23000 hub "SCINTILLA Networking" com.apple.WebKit.Networking UIElement - "$WK/com.apple.WebKit.Networking.xpc/Contents/MacOS/com.apple.WebKit.Networking" helper
  row "$(newpid)" 1 23000 59000 hub "SCINTILLA Graphics and Media" com.apple.WebKit.GPU UIElement - "$WK/com.apple.WebKit.GPU.xpc/Contents/MacOS/com.apple.WebKit.GPU" helper
}
add_brave() {       # $1 = kind (BackgroundOnly = started by a web app, no window of its own), $2 $3 = kB of its biggest page process
  local p; p="$(newpid)"
  local opt=" --user-data-dir=$H/Library/Application Support/BraveSoftware/Brave-Browser --no-startup-window"; [ "$1" = BackgroundOnly ] || opt=""
  row "$p" 1 114000 190000 brave "Brave Browser" com.brave.Browser "$1" "$BR" "$BR/Contents/MacOS/Brave Browser$opt" main
  row "$(newpid)" "$p" "$2" "$3" brave - - - - "$BR/Contents/Frameworks/Brave Browser Framework.framework/Versions/154.1.96.61/Helpers/Brave Browser Helper (Renderer).app/Contents/MacOS/Brave Browser Helper (Renderer) --type=renderer --extension-process" helper
  row "$(newpid)" "$p" 77000 478000 brave "Brave Browser Helper" com.brave.Browser.helper UIElement - "$BR/Contents/Frameworks/Brave Browser Framework.framework/Versions/154.1.96.61/Helpers/Brave Browser Helper.app/Contents/MacOS/Brave Browser Helper --type=gpu-process" helper
}
add_shim() {        # $1 = the web app's name (SCINTILLA Station | X)
  local id="$STATION_ID"; [ "$1" = X ] && id="$X_ID"
  has com.brave.Browser || add_brave BackgroundOnly 90000 300000
  row "$(newpid)" 1 18000 51000 brave "$1" "$id" Foreground "$SHIMS/$1.app" "$SHIMS/$1.app/Contents/MacOS/app_mode_loader" shim
}
where_of() {        # $1 = bundle id -> where its window is now
  case "$1" in
    "$STATION_ID") [ -f "$D/where.$1" ] && cat "$D/where.$1" || echo "${FAKE_STATION_WHERE:-reachable}" ;;
    "$X_ID") [ -f "$D/where.$1" ] && cat "$D/where.$1" || echo "${FAKE_X_WHERE:-reachable}" ;;
    *) echo reachable ;;
  esac
}
move_to() { [ "${FAKE_STUCK:-0}" = 1 ] || echo "$2" > "$D/where.$1"; }
brave_kind() { awk -F'\t' '$7 == "com.brave.Browser" { print $8 }' "$T" | head -1; }

case "$verb" in
  init)             # the iMac as it was read on 8 Oct 2026, small numbers changed for round sums. FAKEMAC_WITHOUT leaves things out.
    mkdir -p "$D"; : > "$T"; : > "$C"; echo 20000 > "$D/nextpid"; : > "$D/behave"
    out=" ${FAKEMAC_WITHOUT:-} "
    case "$out" in *" tv "*) ;; *)
      a="--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1"; [ -n "${FAKEMAC_TV_ARGS+x}" ] && a="$FAKEMAC_TV_ARGS"
      echo 7002 > "$D/nextpid"; add_tv 7001 "$a" 61440 153600 ;; esac
    case "$out" in *" hub "*) ;; *) echo 8002 > "$D/nextpid"; add_hub 8001 210000 1434624 ;; esac
    case "$out" in *" youtube "*) ;; *)
      row 8101 1 7500 75000 youtube YouTube com.apple.Safari.WebApp.5325C376-08A8-4B6F-A3E4-402BE05137FA Foreground "$YT" "$WEBAPP --bundlepath $YT --sandboxextension 91f63ec0;00" main
      row 8102 1 101000 1002496 youtube "YouTube Web Content" com.apple.WebKit.WebContent UIElement - "$WK/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent" helper ;; esac
    case "$out" in *" brave "*) ;; *)
      echo 9001 > "$D/nextpid"; add_brave "${FAKEMAC_BRAVE_KIND:-BackgroundOnly}" 191000 1849344
      case "$out" in *" station "*) ;; *) add_shim "SCINTILLA Station" ;; esac
      case "$out" in *" x "*) ;; *) add_shim X ;; esac ;; esac
    case "$out" in *" chrome "*) ;; *)
      row 9501 1 116000 118784 chrome "Google Chrome" com.google.Chrome Foreground "$CH" "$CH/Contents/MacOS/Google Chrome" main
      row 9502 9501 86000 88064 chrome - - - - "$CH/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer) --type=renderer" helper
      row 9510 1 9000 20000 chrome SCINTILLA com.google.Chrome.app.hjliongcjdnfgpnodjphdimchcjddegd Foreground "$H/Applications/Chrome Apps.localized/SCINTILLA.app" "$H/Applications/Chrome Apps.localized/SCINTILLA.app/Contents/MacOS/app_mode_loader" shim
      if [ "${FAKEMAC_CHROME_STATION_X:-0}" = 1 ]; then
        row 9511 1 9000 20000 chrome "SCINTILLA Station" "${STATION_ID/com.brave.Browser/com.google.Chrome}" Foreground "$H/Applications/Chrome Apps.localized/SCINTILLA Station.app" "$H/Applications/Chrome Apps.localized/SCINTILLA Station.app/Contents/MacOS/app_mode_loader" shim
        row 9512 1 9000 20000 chrome X "${X_ID/com.brave.Browser/com.google.Chrome}" Foreground "$H/Applications/Chrome Apps.localized/X.app" "$H/Applications/Chrome Apps.localized/X.app/Contents/MacOS/app_mode_loader" shim
      fi ;; esac
    row 943 1 30000 60000 other Finder com.apple.finder Foreground /System/Library/CoreServices/Finder.app /System/Library/CoreServices/Finder.app/Contents/MacOS/Finder main
    echo 20000 > "$D/nextpid" ;;
  ps) tick
      n=$(( $(cat "$D/looks" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$D/looks"
      for g in tv hub brave; do      # a process number handed to another program between two looks
        if [ "$(behave "reuse.$g")" = "$n" ]; then
          awk -F'\t' -v OFS='\t' -v g="$g" '$5 == g && $11 == "main" { $5 = "other"; $6 = "-"; $7 = "-"; $8 = "-"; $9 = "-"; $10 = "/usr/libexec/somebody-else --serving"; $11 = "helper" } $5 != g' "$T" > "$T.new"; mv "$T.new" "$T"
        fi
      done
      awk -F'\t' '{ printf "%5s %5s %7s %s\n", $1, $2, $3, $10 }' "$T" ;;
  top) echo "Processes: 512 total, 3 running, 509 sleeping, 3000 threads"; echo "2026/10/08 04:00:01"; echo "Load Avg: 2.10, 2.00, 1.90"; echo "PID    MEM"
       awk -F'\t' '{ if ($4 >= 1024) printf "%-6s %dM\n", $1, $4 / 1024; else printf "%-6s %dK\n", $1, $4 }' "$T" ;;
  registry) awk -F'\t' '$7 != "-" { print $1 "\t" $7 "\t" $8 "\t" $6 "\t" $9 }' "$T" ;;
  apps) awk -F'\t' '$7 != "-" && $9 != "-" { print $7 "\t" $9 }' "$T" ;;
  sysmem) awk -F'\t' '{ s += $4 } END { printf "%d %d\n", s / 2, (s > 5242880 ? 25 : 62) }' "$T" ;;
  pop)              # answers used up one per question, the last one repeats. "sleepN" waits; "touch" = touched now; "since" = seconds since
    f="$1"; n=$(grep -c . "$f"); line="$(sed -n '1p' "$f")"; [ "$n" -gt 1 ] && sed -i '' '1d' "$f"
    case "$line" in sleep*) sleep "${line#sleep}"; line="$(sed -n '1p' "$f")"; [ "$(grep -c . "$f")" -gt 1 ] && sed -i '' '1d' "$f" ;; esac
    case "$line" in
      touch) date +%s > "$f.touched"; echo 0 ;;
      since) echo $(( $(date +%s) - $(cat "$f.touched" 2>/dev/null || date +%s) )) ;;
      *) echo "$line" ;;
    esac ;;
  kill)
    sig="${1:-}"; pid="${2:-}"
    set -- $(awk -F'\t' -v p="$pid" '$1 == p { print $5, $11 }' "$T"); g="${1:-nobody}"; role="${2:-none}"
    echo "CLOSE $g:$role $sig" >> "$C"
    [ "$sig" = -TERM ] || { echo "FORBIDDEN-SIGNAL $sig to $g:$role" >> "$C"; exit 0; }
    [ "$g" = nobody ] && exit 1
    if [ "$role" != main ]; then drop_pid "$pid"; exit 0; fi
    b="$(behave "$g")"
    case "$b" in refuses) ;; slow:*) echo "${b#slow:}" > "$D/dying.$g" ;; *) drop_group "$g" ;; esac ;;
  open)
    echo "OPEN $*" >> "$C"
    path=""; args=""; bid=""
    while [ $# -gt 0 ]; do case "$1" in -a) path="${2:-}"; shift 2 ;; -b) bid="${2:-}"; shift 2 ;; --args) shift; args="$*"; break ;; *) shift ;; esac; done
    if [ -n "$bid" ]; then      # open -b <bundle id>: a closed web app comes back with a window on this desktop
      case "$bid" in "$STATION_ID") has "$bid" || add_shim "SCINTILLA Station"; move_to "$bid" reachable ;; "$X_ID") has "$bid" || add_shim X; move_to "$bid" reachable ;; esac
      exit 0
    fi
    case "$args" in --new-window*) echo "REOPEN ${args#--new-window }" >> "$C"
      awk -F'\t' -v OFS='\t' '$7 == "com.brave.Browser" { $8 = "Foreground" } { print }' "$T" > "$T.new"; mv "$T.new" "$T"; exit 0 ;; esac
    case "$path" in "$TV") g=tv ;; "$HUB") g=hub ;; "$SHIMS/"*) g="shim" ;; "$BR") g=braveitself ;; *) g=unknown ;; esac
    k="$g"; [ "$g" = shim ] && k="$(basename "$path" .app | tr ' ' '_')"
    b="$(behave "open.$k")"
    case "$b" in fail) exit 0 ;; fail-once) grep -v "^open.$k=" "$D/behave" > "$D/behave.new"; mv "$D/behave.new" "$D/behave"; exit 0 ;; esac
    case "$g" in
      tv) has com.tradingview.tradingviewapp.desktop || add_tv new "$args" 60000 100000 ;;
      hub) has com.apple.Safari.WebApp.9257ED5B-FBF6-44EC-911A-8A8DD1CB2C9C || add_hub new 150000 300000 ;;
      shim) n="$(basename "$path" .app)"; id="$STATION_ID"; [ "$n" = X ] && id="$X_ID"; has "$id" || add_shim "$n"; echo reachable > "$D/where.$id" ;;   # a window just opened is on this desktop
      braveitself) echo "OPENED-BRAVE-ITSELF" >> "$C"; has com.brave.Browser || add_brave Foreground 90000 300000 ;;
    esac ;;
  caffeinate) echo "AWAKE $*" >> "$C" ;;
  gui)
    # 15 Oct 2026 (NR4): FAKE_CR=1 answers the way the real window helper does - its helpers' lines (windows.js, brave-tabs.js) come
    # through AppleScript's "do shell script", which ends each line with a carriage return and drops the last line end
    if [ "${FAKE_CR:-0}" = 1 ] && [ -z "${FAKE_CR_INNER:-}" ]; then
      case "${1:-}" in everywhere|tabs) FAKE_CR_INNER=1 "$0" "$@" | /usr/bin/perl -0pe 's/\n\z//; s/\n/\r/g'; exit 0 ;; esac
    fi
    echo "$*" >> "$C"
    case "${1:-}" in
      trusted) echo "${FAKE_TRUSTED:-true}" ;;
      front) echo com.apple.finder ;;
      windows)
        has "${2:-}" || { echo no-process; exit 0; }
        case "$(where_of "${2:-}")" in
          minimised) echo "Home / X	min"; exit 0 ;;      # a minimised window is listed, as minimised
          elsewhere|fullscreen|fullscreen-here|closed) exit 0 ;;   # Accessibility lists nothing
        esac
        case "$2" in
          "$X_ID") if [ -n "${FAKE_X_WINDOWS_AFTER:-}" ] && [ "$(awk -F'\t' -v b="$X_ID" '$7 == b { print $1 }' "$T")" -ge 20000 ]; then printf '%b' "$FAKE_X_WINDOWS_AFTER"; else printf '%b' "${FAKE_X_WINDOWS:-Home / X\topen\n}"; fi ;;
          com.tradingview.tradingviewapp.desktop)      # FAKE_TV_WINDOWS_AFTER (it may be empty) = what a reopened TradingView shows
            if [ -n "${FAKE_TV_WINDOWS_AFTER+x}" ] && [ "$(awk -F'\t' '$5 == "tv" && $11 == "main" { print $1 }' "$T")" -ge 20000 ]; then printf '%b' "$FAKE_TV_WINDOWS_AFTER"; else printf '%b' "${FAKE_TV_WINDOWS-Chart\topen\n}"; fi ;;
          *) printf 'SCINTILLA\topen\n' ;;
        esac ;;
      find-reload) echo "found:Reload This Page:enabled" ;;
      everywhere)
        has "${2:-}" || { echo no-process; exit 0; }
        case "${2:-}" in
          "$STATION_ID"|"$X_ID") case "$(where_of "$2")" in
            reachable) printf 'on\tnormal\t1169x685\n' ;; fullscreen-here) printf 'on\tfull\t1280x720\n' ;;
            minimised|elsewhere) printf 'off\tnormal\t1169x685\n' ;; fullscreen) printf 'off\tfull\t1280x720\n' ;;
            closed) echo none ;; esac ;;
          com.brave.Browser) if [ "$(brave_kind)" = Foreground ]; then n="${FAKE_BRAVE_OWN:-1}"; [ "$n" -ge 1 ] || { echo none; exit 0; }; i=0; while [ "$i" -lt "$n" ]; do printf 'off\tnormal\t1062x678\n'; i=$(( i + 1 )); done; else echo none; fi ;;
          *) printf 'on\tnormal\t1000x700\n' ;;
        esac ;;
      consent) echo "${FAKE_CONSENT:-not-asked}" ;;
      tabs) if [ "${FAKE_CONSENT:-not-asked}" = allowed ]; then printf '%b' "${FAKE_TABS:-}"; else echo "refused:no consent"; fi ;;
      active-tab) echo ok ;;
      unminimise) case "$(where_of "${2:-}")" in minimised) move_to "$2" reachable; echo "ok:1" ;; *) echo none ;; esac ;;
      activate)
        r=ok; case "${2:-}" in "$X_ID") r="${FAKE_ACTIVATE_X:-ok}" ;; esac
        if [ "$r" = ok ]; then case "$(where_of "${2:-}")" in elsewhere) move_to "$2" reachable ;; fullscreen) move_to "$2" fullscreen-here ;; esac; fi
        echo "$r" ;;
      raise) echo ok ;;
      reload) case "${2:-}" in "$X_ID") echo "${FAKE_RELOAD_X:-ok:menu}" ;; *) echo ok:menu ;; esac ;;
      shortcut) echo "${FAKE_SHORTCUT:-sent}" ;;
    esac ;;
  *) echo "fakemac.sh: unknown request '$verb'" >&2; exit 2 ;;
esac
