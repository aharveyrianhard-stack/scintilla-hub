#!/bin/bash
# night-reload.sh - the 4 am job on the Mac that shows the Station: first it RESTARTS the apps that fill that Mac's memory (TradingView,
# the Hub app, Brave), then it reloads the Station and X, runs the X extension again and checks that X came back.
#
# 7 Oct 2026 (the reload). Alan: "Whatever we can do to reload Scintilla Hub, and Station, and X, and Extension, the better. If that's
# the 4 a.m. job, whatever." / "I'm pretty sure you guys can find the moment where I'm not clicking and typing." / "restarting the
# Station requires restarting X and executing the extension or it won't be working."
# 8 Oct 2026 (the restart). Alan: "Brave browser is taking 1.76 gigabytes of the iMac plus another 1.02 of Brave browser helper plus a
# bunch of other ones ... the trading view, I don't have that many charts on. Why is it taking so much? ... Scintilla, 1.34 gigabytes.
# It's important that we stream like this. We talked about some restarts and quitting and starting overnight."
#
# WHAT IT DOES, in order, and only between WINDOW_START and WINDOW_END, only after IDLE_SECONDS without keyboard or mouse:
#   1. finds the Station, X and Hub WEB-APP windows of ONE browser (Brave or Chrome). A site open as an ordinary tab is never touched.
#   2. reads whether X is working now (the Station's own once-a-minute health log - the same one the page /x-health/ shows).
#   3. THE RESTART (RESTART_APPS=yes; "no" makes this job exactly the 7 Oct reload-only job):
#        - writes down how much memory each app holds;
#        - one app at a time - TradingView, then the Hub app, then Brave - asks the app to quit the ordinary way (the "please quit"
#          signal to its main process only), waits for it to be gone, opens it again the way it was open, and waits until it is back.
#          An app that will not quit is LEFT AS IT IS: nothing is ever forced. An app that does not come back gets one more try, then
#          a line for Alan, and no further app is closed that night.
#        - Brave is closed only when everything is in place to reconnect X afterwards (the plan below says "full", and X and the
#          Station could just be brought to the front), and only when Brave has no window of its own (see "how Brave runs" below).
#   4. proves it can bring X and the Station to the front BEFORE it reloads anything, so it never reloads the Station and then finds it
#      cannot reach X.
#   5. reloads each Station window (the app's own "Reload This Page" menu item - no typing), reloads X, waits for both to load,
#      presses Option+Shift+S in the X window (the X extension's shortcut; pressing it again reconnects, it never switches X off),
#      brings the Station back to the front so its X box can be seen and can report.
#   6. waits for a fresh "X is working" report. If none comes: ONE retry of the X half. If still none: one line for Alan.
#   7. puts back the app that was in front, and writes down each app's memory again - the before and after of the night.
# It never touches Chrome, never forces an app to quit, never closes a window, never touches a window that is not one of those apps.
#
# HOW THE APPS RUN ON THE iMAC (read there on 8 Oct 2026, looking only), and so how each is opened again:
#   - Brave has NO window of its own. It is started in the background by the Station's own app icon, and the Station and X are its two
#     web-app windows. So Brave is opened again by opening those web apps, in the order they were open - never by opening Brave itself,
#     which would put an empty Brave window on the screen (Brave there is not set to bring back its last pages).
#   - TradingView runs with two start-up options (--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1) that Scintilla's
#     chart tools and Alan's own "TV Launch" icon rely on. It is opened again with whatever options it was running with.
#   - the Hub is a Safari web app (~/Applications/SCINTILLA.app). It is opened again from that same icon.
#
# ITS NEIGHBOURS (read before changing any number here):
#   - the Hub's own in-page night reload (Hub index.html, "RM1 - THE NIGHT RELOAD"): 03:00-05:00, comes back where Alan left it. A plain
#     reload from outside does NOT keep his place, so the Hub page is left to its own reload unless RELOAD_HUB=yes. The RESTART of the
#     Hub app is a quit and reopen: the Hub comes back on its first screen (lists, stars, the company tab and the compare tab are kept;
#     the room and where each panel was scrolled are not). RESTART_HUB_APP=no leaves the Hub app alone.
#   - the Station's in-page night reload (branch station/rm1-memory-20261007): NOT live, and should stay off on a Mac that runs this job -
#     two reloaders would race and the second one would leave X unconnected with nobody there to reconnect it.
#   - the Station's self-update (deck/index.html, "SELF-UPDATE"): reloads the deck for a new build after two quiet minutes; untouched.
#   - the X Bridge's self-update (background.js, "the bridge keeps itself up to date"): reloads the extension only while it feeds no pane.
#     Reloading the Station opens such a moment; if the folder carries a newer bridge it loads then, and the shortcut in step 5 is exactly
#     what a freshly loaded bridge needs. A restarted Brave loads whatever is in the extension's folder.
#   - the weekly restart of the whole Mac (restart_guard.sh; on the iMac at 12:30, on the MacBook at 03:30): another hour on the iMac.
#     On a night a Mac restarts, nobody is logged in at 04:00, launchd does not run this job, and X needs Alan's Option+Shift+S in the
#     morning as it does today. Its rule - "nothing of Alan's is ever discarded, saved on his behalf, or force-quit" - is this job's too.
#   - the screen saver (ten minutes on the iMac) and display sleep: at night it is Brave's own X capture that keeps the screen awake.
#     While Brave is closed nothing does, the screen saver would start at once and swallow the shortcut, so the job holds the screen
#     awake itself (macOS's caffeinate) from the first app it closes until it ends.
#   - Alan's "TV Launch" icon: starts TradingView with the debugging option only when port 9222 does not answer. Because this job opens
#     TradingView with the options it had, that icon still finds it and leaves it alone.
#   - FineTune (sound per app): its rules go by app identity (Brave -> the Bluetooth output, the Hub app -> the built-in speaker, quiet).
#     A restart does not change an app's identity.
#   - the picture-in-picture helper (pipdodge): a floating picture-in-picture window that is open when Brave closes is gone afterwards.
#     Only a click on the Station's pop-out button can open one, so this job cannot bring it back.
#   - Brave's and TradingView's own updates: an update that was waiting is applied when the app starts again.
#   - the pattern here (several launchd times + "only inside the window" + "only when nobody touched the Mac" + --dry-run) is the one
#     restart_guard.sh already uses on this Mac; idle time is read the same way (ioreg HIDIdleTime).
#
#   night-reload.sh dry-run    look only: says what it sees and what it WOULD do tonight. Sends nothing, closes nothing, opens nothing.
#   night-reload.sh test       the real thing NOW, for a supervised test: ignores the clock, waits for TEST_IDLE_SECONDS hands-off.
#   night-reload.sh run        the nightly job (launchd). Does nothing outside the window or while the Mac is in use.
#
# Settings: config.env beside this file (see config.example.env). Log: ~/Library/Logs/scintilla-night-reload.log.
# Last result: LAST-NIGHT.txt beside this file - the first line says what happened, the lines under it give each app's memory before
# and after. A line beginning "NOTE<tab>" on stdout is shown on screen by the launcher.

set -u
MODE="${1:-dry-run}"
KIT="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="${SCINTILLA_NIGHT_RELOAD_STATE:-$KIT}"
# shellcheck disable=SC1091
[ -f "$STATE_DIR/config.env" ] && . "$STATE_DIR/config.env"

WINDOW_START="${WINDOW_START:-0400}"          # local clock, HHMM
WINDOW_END="${WINDOW_END:-0530}"
SLOT_MINUTES="${SLOT_MINUTES:-10}"            # launchd tries every this many minutes inside the window
IDLE_SECONDS="${IDLE_SECONDS:-600}"           # ten minutes without keyboard or mouse
TEST_IDLE_SECONDS="${TEST_IDLE_SECONDS:-20}"
BROWSER="${BROWSER:-auto}"                    # auto | brave | chrome
RELOAD_STATION="${RELOAD_STATION:-yes}"
RELOAD_X="${RELOAD_X:-yes}"
RELOAD_HUB="${RELOAD_HUB:-no}"                # the Hub reloads itself at night and keeps Alan's place; see the neighbours above
X_HEALTH_CLIENT="${X_HEALTH_CLIENT:-}"        # this browser's 8-character id on the X health page; guessed from that page if empty
LOAD_WAIT="${LOAD_WAIT:-25}"                  # seconds for the Station and X to load before the shortcut
HEALTH_WAIT="${HEALTH_WAIT:-240}"             # seconds to wait for a fresh "X is working" report (the Station reports once a minute)
HEALTH_POLL="${HEALTH_POLL:-20}"
HEALTH_PAGE="${HEALTH_PAGE:-https://station.scintillahub.ai/x-health/}"
LOG="${NIGHT_RELOAD_LOG:-$HOME/Library/Logs/scintilla-night-reload.log}"
GUI="${SCINTILLA_NIGHT_RELOAD_GUI:-osascript}" # osascript | none | /path/to/a/stand-in (tests)

# the restart (8 Oct 2026)
RESTART_APPS="${RESTART_APPS:-yes}"           # no = reload only: this job then does exactly what the 7 Oct job did
RESTART_TRADINGVIEW="${RESTART_TRADINGVIEW:-yes}"
RESTART_HUB_APP="${RESTART_HUB_APP:-yes}"
RESTART_BRAVE="${RESTART_BRAVE:-yes}"
TRADINGVIEW_APP="${TRADINGVIEW_APP:-/Applications/TradingView.app}"
HUB_APP="${HUB_APP:-$HOME/Applications/SCINTILLA.app}"
BRAVE_APP="${BRAVE_APP:-/Applications/Brave Browser.app}"
QUIT_WAIT="${QUIT_WAIT:-30}"                  # seconds an app normally gets to close after being asked
QUIT_PATIENCE="${QUIT_PATIENCE:-60}"          # more seconds for an app that is still closing; after that it is left as it is, never forced
OPEN_WAIT="${OPEN_WAIT:-60}"                  # seconds to wait for an app (and its window) to be back, per try
SETTLE_WAIT="${SETTLE_WAIT:-15}"              # seconds for Brave's reopened web apps to draw before the reload stage looks at them
NR_KILL="${NR_KILL:-/bin/kill}"               # these three are replaced by stand-ins in the tests, never on a real Mac
NR_OPEN="${NR_OPEN:-/usr/bin/open}"
NR_CAFFEINATE="${NR_CAFFEINATE:-/usr/bin/caffeinate}"

NOTE_TEXT=""; OWN_SPANS=""; OWN_R=""; MOVED=0; KEEP_NIGHT_OPEN=0; T_BEGIN=0; HKEY=""; HURL=""; HKNOWN=""
HUB_BIDS=""; STATION_BID=""; X_BID=""; STATION_WINDOWS=0; X_WINDOWS=0; FAMILY=""
VERBOSE=0; [ "$MODE" = run ] || VERBOSE=1
TAB="$(printf '\t')"; NL='
'
SEEN_BACK=0; RESTART_RAN=0; RESTART_LINES=""; RESTART_NOTE=""; RESTARTED=""; BRAVE_RESTARTED=0; REOPEN_OWED=""; AWAKE_PID=""; WROTE_LAST=0; LATE=""
PS_SNAP=""; REG_SNAP=""; TOP_SNAP=""; STOPPED=0; PLAN=""; WHY=""; BEFORE=""
TV_PID=""; TV_BID=""; TV_CMD=""; TV_ARGS=""; TV_PIDS=""; HUB_PID=""; HUB_BID=""; HUB_NAME=""; HUB_CMD=""; HUB_PIDS=""
BR_PID=""; BR_BID=""; BR_KIND=""; BR_CMD=""; BR_SHIMS=""; BR_PIDS=""
TV_B="0 0 0"; HUB_B="0 0 0"; BR_B="0 0 0"; SYS_B="0 0"; TV_WHY=""; HUB_WHY=""; BR_WHY=""; TV_W0=0; HUB_W0=0; X_TITLE0=""
TV_PID0=""; TV_ARGS0=""; TV_BID0=""; HUB_PID0=""; HUB_BID0=""; HUB_NAME0=""; HUB_CMD0=""; BR_PID0=""; BR_BID0=""; BR_SHIMS0=""; TV_A="0 0 0"; HUB_A="0 0 0"; BR_A="0 0 0"; SYS_A="0 0"; R1=""; R2=""

say() { printf '%s  [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$MODE" "$*" >> "$LOG" 2>/dev/null; [ "$VERBOSE" = 1 ] && printf '%s\n' "$*"; return 0; }
nap() { [ "${NR_NO_SLEEP:-0}" = 1 ] || sleep "$1"; }
when() { date '+%a %-d %b %H:%M'; }
mins() { echo $(( 10#${1:0:2} * 60 + 10#${1:2:2} )); }
clock() { echo "${1:0:2}:${1:2:2}"; }
now_hhmm() { echo "${NR_FAKE_HHMM:-$(date +%H%M)}"; }

# ---- what the Mac says, read without any permission ----------------------------------------------------------------------------------
idle_seconds() {
  if [ -n "${NR_FAKE_IDLE_CMD:-}" ]; then eval "$NR_FAKE_IDLE_CMD"; return; fi
  local s; s="$(/usr/sbin/ioreg -c IOHIDSystem -d 4 2>/dev/null | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}')"
  echo "${s:-0}"
}
screen_locked() {   # yes | no. Locked, at the login window, or the screen saver is up: keys would go to the lock screen, not to X.
  if [ -n "${NR_FAKE_LOCKED:-}" ]; then echo "$NR_FAKE_LOCKED"; return; fi
  local users; users="$(/usr/sbin/ioreg -n Root -d1 -a 2>/dev/null | /usr/bin/plutil -extract IOConsoleUsers xml1 -o - - 2>/dev/null)"
  if printf '%s' "$users" | grep -A1 'CGSSessionScreenIsLocked' | grep -q '<true/>'; then echo yes; return; fi
  if ! printf '%s' "$users" | grep -A1 'kCGSSessionOnConsoleKey' | grep -q '<true/>'; then echo yes; return; fi
  if /usr/bin/pgrep -x ScreenSaverEngine >/dev/null 2>&1; then echo yes; return; fi
  echo no
}
running_apps() {    # lines: bundle id <tab> bundle path
  if [ -n "${NR_FAKE_APPS_CMD:-}" ]; then eval "$NR_FAKE_APPS_CMD"; return; fi
  /usr/bin/lsappinfo list 2>/dev/null | awk -F'"' '/^ *bundleID=/{b=$2} /^ *bundle path=/{ if (b != "") print b "\t" $2; b="" }'
}
app_site() {        # the address a Brave/Chrome web app was installed from, e.g. https://station.scintillahub.ai/
  if [ -n "${NR_FAKE_SITE_CMD:-}" ]; then eval "$NR_FAKE_SITE_CMD"; return; fi
  /usr/libexec/PlistBuddy -c "Print :CrAppModeShortcutURL" "$1/Contents/Info.plist" 2>/dev/null
}
machine_word() {    # iMac | MacBook | Mac  (only used to guess this browser's line on the X health page)
  local n; n="${NR_FAKE_MACHINE:-$(/usr/sbin/scutil --get ComputerName 2>/dev/null) $(/usr/sbin/sysctl -n hw.model 2>/dev/null)}"
  case "$n" in *iMac*) echo iMac;; *MacBook*) echo MacBook;; *) echo Mac;; esac
}
# the four readers below are the restart's; like the ones above they only read
proc_table() {      # every process: number, the number of the process that started it, kilobytes in real memory now, its command line
  if [ -n "${NR_FAKE_PS_CMD:-}" ]; then eval "$NR_FAKE_PS_CMD"; return; fi
  /bin/ps -axww -o pid=,ppid=,rss=,command= 2>/dev/null
}
foot_table() {      # every process: number and its memory the way Activity Monitor's "Memory" column counts it (e.g. 949M)
  if [ -n "${NR_FAKE_TOP_CMD:-}" ]; then eval "$NR_FAKE_TOP_CMD"; return; fi
  /usr/bin/top -l 1 -stats pid,mem 2>/dev/null
}
app_registry() {    # every app macOS lists as running: number <tab> bundle id <tab> kind <tab> name <tab> bundle path  ("-" = none)
  if [ -n "${NR_FAKE_REGISTRY_CMD:-}" ]; then eval "$NR_FAKE_REGISTRY_CMD"; return; fi
  /usr/bin/lsappinfo list 2>/dev/null | awk '
    function out() { if (pid != "") print pid "\t" bid "\t" kind "\t" name "\t" path }
    /^ *[0-9]+\) "/ { out(); name = $0; sub(/^ *[0-9]+\) "/, "", name); sub(/" ASN:.*$/, "", name); bid = "-"; path = "-"; kind = "-"; pid = ""; next }
    /^ *bundleID="/ { bid = $0; sub(/^ *bundleID="/, "", bid); sub(/"[^"]*$/, "", bid); next }
    /^ *bundle path="/ { path = $0; sub(/^ *bundle path="/, "", path); sub(/"[^"]*$/, "", path); next }
    /^ *pid = [0-9]+/ { pid = $3; if ($0 ~ /type="/) { kind = $0; sub(/.*type="/, "", kind); sub(/".*$/, "", kind) } next }
    END { out() }'
}
sys_memory() {      # the whole Mac: "<kilobytes pushed out to disk> <percent of memory free>"
  if [ -n "${NR_FAKE_SYSMEM_CMD:-}" ]; then eval "$NR_FAKE_SYSMEM_CMD"; return; fi
  local sw fr
  sw="$(/usr/sbin/sysctl -n vm.swapusage 2>/dev/null | awk '{ for (i = 1; i < NF - 1; i++) if ($i == "used") { v = $(i + 2); n = v; gsub(/[^0-9.]/, "", n); if (v ~ /G$/) n *= 1024; printf "%d", n * 1024; exit } }')"
  fr="$(/usr/bin/memory_pressure 2>/dev/null | awk -F': *' '/free percentage/ { gsub(/[^0-9]/, "", $2); print $2; exit }')"
  echo "${sw:-0} ${fr:-0}"
}

# ---- the windows: every call goes through here, and nothing that changes a window can run in dry-run ---------------------------------
gui() {
  case "$1" in
    trusted|front|windows|find-reload) ;;
    activate|raise|reload|shortcut)
      if [ "$MODE" != run ] && [ "$MODE" != test ]; then say "  (dry run - not done: $*)"; echo dry; return 0; fi ;;
    *) echo "error:unknown verb"; return 2 ;;
  esac
  case "$GUI" in
    none) echo no-gui ;;
    osascript) /usr/bin/osascript "$KIT/gui.applescript" "$@" 2>>"$LOG" || echo "error:the window helper failed" ;;
    *) "$GUI" "$@" ;;
  esac
}
own() {             # a window action of ours. The answer is left in OWN_R (NOT printed: this must run in this shell, not in a
                    # $(...) copy of it, or the times below are lost). The times are how our own key press is told from Alan's.
  local b; b="$(date +%s)"; OWN_R="$(gui "$@")"; OWN_SPANS="$OWN_SPANS $b:$(date +%s)"; MOVED=1
}
alan_is_back() {    # true when somebody touched the keyboard or mouse after the job began and it was not the job's own key press
  [ "$MODE" = test ] && return 1
  [ "$SEEN_BACK" = 1 ] && return 0     # the restart stage already saw somebody at the Mac: for the rest of this run they are there
  local idle now last t
  idle="$(idle_seconds)"; now="$(date +%s)"; last=$(( now - idle ))
  [ "$last" -gt "$T_BEGIN" ] || return 1
  # an input that falls inside one of our own actions (one second before it began to three after it ended) is ours
  for t in $OWN_SPANS; do [ "$last" -ge $(( ${t%%:*} - 1 )) ] && [ "$last" -le $(( ${t##*:} + 3 )) ] && return 1; done
  return 0
}

# ---- is X working? the Station's own health log, read the way its public page reads it ----------------------------------------------
health_setup() {    # the address and the publishable key come from the public page at run time; kept in memory, never written or logged
  [ -n "${NR_FAKE_HEALTH_CMD:-}" ] && return 0
  local page; page="$(/usr/bin/curl -fsS --max-time 20 "$HEALTH_PAGE" 2>/dev/null)" || return 1
  HKEY="$(printf '%s' "$page" | sed -nE 's/.*const KEY = "([^"]+)".*/\1/p' | head -1)"
  HURL="$(printf '%s' "$page" | sed -nE 's/.*const URL_RPC = "([^"]+)".*/\1/p' | head -1)"
  HKNOWN="$(printf '%s' "$page" | sed -nE 's/.*const KNOWN = \{([^}]*)\}.*/\1/p' | head -1)"
  case "$HURL" in https://*.supabase.co/rest/v1/rpc/station_x_health_latest) ;; *) HURL=""; return 1 ;; esac
  [ -n "$HKEY" ]
}
guess_client() {    # "iMac · Brave" on the health page -> that line's id
  [ -n "$X_HEALTH_CLIENT" ] && return 0
  [ -n "$HKNOWN" ] && [ -n "$FAMILY" ] || return 1
  local want; want="$(machine_word) · $FAMILY"
  X_HEALTH_CLIENT="$(printf '%s' "$HKNOWN" | tr ',' '\n' | grep -F "\"$want\"" | sed -nE 's/.*"([0-9a-f]{8})".*/\1/p' | head -1)"
  [ -n "$X_HEALTH_CLIENT" ]
}
x_health() {        # $1 = "" (the last ten minutes) or a UTC time: only a report newer than that counts.
                    # prints: working | not-reporting | wrong:<why> | unknown:<why>
  if [ -n "${NR_FAKE_HEALTH_CMD:-}" ]; then eval "$NR_FAKE_HEALTH_CMD"; return; fi
  [ -n "$HURL" ] && [ -n "$HKEY" ] || { echo "unknown:the health page could not be read"; return; }
  [ -n "$X_HEALTH_CLIENT" ] || { echo "unknown:this browser's id on the health page is not set"; return; }
  # The log is asked the question itself ("is there a report from this browser, newer than T, cropped right, drawing?") and only
  # "a row came back or not" is read here - nothing depends on the order or the format of the columns.
  local q good any
  q="client=eq.${X_HEALTH_CLIENT}&select=client"; [ -n "$1" ] && q="${q}&seen_at=gt.$1"
  good="$(health_rows "${q}&region_usable=is.true&whole_frame=is.null&paints_per_min=gt.0")" || { echo "unknown:the health log did not answer"; return; }
  [ "$good" -ge 1 ] && { echo working; return; }
  any="$(health_rows "$q")" || { echo "unknown:the health log did not answer"; return; }
  [ "$any" -ge 1 ] && { echo "wrong:X is connected but its picture is not right (the whole X window, or not drawing)"; return; }
  echo not-reporting
}
health_rows() {     # how many rows the health log returns for one question; fails if it does not answer
  local out
  # a plain GET: this is a read, and the log's reader function only reads (it is the one the public health page calls)
  out="$(/usr/bin/curl -fsS --max-time 20 "${HURL}?$1" -H "apikey: ${HKEY}" -H "Authorization: Bearer ${HKEY}" -H "Accept: text/csv" 2>/dev/null)" || return 1
  printf '%s\n' "$out" | sed '1d' | grep -c . ; return 0
}
wait_for_x() {      # $1 = UTC time of the shortcut. true as soon as a newer report says X is working.
  local waited=0 h=""
  while :; do
    h="$(x_health "$1")"; [ "$h" = working ] && { say "  X reports working (after about ${waited}s)"; return 0; }
    [ "$waited" -ge "$HEALTH_WAIT" ] && { say "  no fresh working report after ${waited}s (last answer: $h)"; LAST_HEALTH="$h"; return 1; }
    nap "$HEALTH_POLL"; waited=$(( waited + HEALTH_POLL ))
    [ "$HEALTH_POLL" -gt 0 ] || waited=$(( waited + HEALTH_WAIT ))
  done
}

# ---- finding the web apps -----------------------------------------------------------------------------------------------------------
discover() {
  local line bid path site host fam role brave_station="" brave_x="" chrome_station="" chrome_x=""
  while IFS="$(printf '\t')" read -r bid path; do
    case "$bid" in com.brave.Browser*.app.*) fam=Brave ;; com.google.Chrome*.app.*) fam=Chrome ;; *) continue ;; esac
    site="$(NR_APP_PATH="$path" app_site "$path")"; host="$(printf '%s' "$site" | sed -nE 's#^https?://([^/:]+).*#\1#p')"
    case "$host" in
      station.scintillahub.ai) role=station ;;
      scintillahub.ai|www.scintillahub.ai) role=hub ;;
      x.com|www.x.com|twitter.com|www.twitter.com) role=x ;;
      *) continue ;;
    esac
    say "  found: $role = $(basename "$path" .app) ($fam web app)"
    case "$role-$fam" in
      hub-*) HUB_BIDS="$HUB_BIDS $bid" ;;
      station-Brave) brave_station="$bid" ;; x-Brave) brave_x="$bid" ;;
      station-Chrome) chrome_station="$bid" ;; x-Chrome) chrome_x="$bid" ;;
    esac
  done <<EOF
$(running_apps)
EOF
  case "$BROWSER" in
    brave) FAMILY=Brave ;; chrome) FAMILY=Chrome ;;
    *) if [ -n "$brave_station$brave_x" ] && [ -n "$chrome_station$chrome_x" ]; then
         if [ -n "$brave_station" ] && [ -n "$brave_x" ] && { [ -z "$chrome_station" ] || [ -z "$chrome_x" ]; }; then FAMILY=Brave
         elif [ -n "$chrome_station" ] && [ -n "$chrome_x" ] && { [ -z "$brave_station" ] || [ -z "$brave_x" ]; }; then FAMILY=Chrome
         else FAMILY=both; fi
       elif [ -n "$brave_station$brave_x" ]; then FAMILY=Brave
       elif [ -n "$chrome_station$chrome_x" ]; then FAMILY=Chrome
       else FAMILY=""; fi ;;
  esac
  case "$FAMILY" in Brave) STATION_BID="$brave_station"; X_BID="$brave_x" ;; Chrome) STATION_BID="$chrome_station"; X_BID="$chrome_x" ;; esac
}
count_windows() {   # prints "<open windows> <minimised ones>" for one app
  local out; out="$(gui windows "$1")"
  case "$out" in no-gui|no-process|error:*|"") echo "0 0"; return ;; esac
  echo "$(printf '%s\n' "$out" | grep -c .) $(printf '%s\n' "$out" | grep -c "$(printf '\t')min$")"
}
count_all() {       # how many windows the Station and X have
  if [ -n "$STATION_BID" ]; then set -- $(count_windows "$STATION_BID"); STATION_WINDOWS="$1"; STATION_MIN="$2"; say "  the Station has $STATION_WINDOWS window(s), $STATION_MIN minimised"; fi
  if [ -n "$X_BID" ]; then set -- $(count_windows "$X_BID"); X_WINDOWS="$1"; X_MIN="$2"; say "  X has $X_WINDOWS window(s), $X_MIN minimised"; fi
}
make_plan() {       # what the reload stage may do, from what was found. PLAN = full | x-only | station-only | none, WHY = the reason in words
  PLAN=""; WHY=""
  if [ "$RELOAD_STATION" != yes ]; then PLAN=none; WHY="the Station reload is switched off in config.env"
  elif [ -z "$STATION_BID" ] && [ -z "$X_BID" ]; then PLAN=none; WHY="neither the Station nor X is open as a web app"
  elif [ -z "$STATION_BID" ]; then PLAN=x-only; WHY="the Station is not open here, so X is reloaded and there is nothing to connect it to"
  elif [ -z "$X_BID" ] && [ "$BEFORE" = working ]; then PLAN=none; WHY="X is working but not from an X web-app window I can find; reloading the Station could leave it unconnected"
  elif [ "$GUI" != none ] && [ $(( STATION_WINDOWS - ${STATION_MIN:-0} )) -lt 1 ]; then PLAN=none; WHY="the Station has no open window (it is minimised or closed)"
  elif [ -z "$X_BID" ]; then PLAN=station-only; WHY="X is not open as a web app and is not working now, so only the Station is reloaded"
  elif [ "$GUI" != none ] && [ "$X_WINDOWS" -ne 1 ]; then PLAN=none; WHY="X has $X_WINDOWS windows open and I cannot tell which one feeds the Station"
  elif [ "$GUI" != none ] && [ "${X_MIN:-0}" -gt 0 ]; then PLAN=none; WHY="the X window is minimised, so the shortcut cannot reach it"
  else PLAN=full; WHY="the Station and X are both open as web apps"; fi
  [ "$GUI" = none ] && [ "$STATION_WINDOWS" -eq 0 ] && STATION_WINDOWS=1
  say "plan: $PLAN - $WHY"
}

# ---- results ------------------------------------------------------------------------------------------------------------------------
result() { printf '%s - %s\n' "$(when)" "$1" > "$STATE_DIR/LAST-NIGHT.txt" 2>/dev/null; WROTE_LAST=1; say "RESULT: $1"; }
note()   { NOTE_TEXT="Night reload, $(when): $1"; printf '%s\n' "$NOTE_TEXT" > "$STATE_DIR/LAST-NIGHT.txt" 2>/dev/null; WROTE_LAST=1; say "NOTE FOR ALAN: $1"; }
done_for_tonight() {
  [ "$MODE" = run ] && : > "$STATE_DIR/.done-$(date +%Y-%m-%d)" 2>/dev/null
  find "$STATE_DIR" -maxdepth 1 \( -name '.done-*' -o -name '.restarted-*' \) -mtime +7 -delete 2>/dev/null; return 0
}
finish() {
  restart_wrapup
  if [ -n "$RESTART_NOTE" ]; then
    if [ -n "$NOTE_TEXT" ]; then NOTE_TEXT="$NOTE_TEXT Also: $RESTART_NOTE"; else NOTE_TEXT="Night restart, $(when): $RESTART_NOTE"; fi
  fi
  [ -n "$NOTE_TEXT" ] && printf 'NOTE\t%s\n' "$NOTE_TEXT"; exit 0
}
last_slot() { [ $(( $(mins "$(now_hhmm)") + SLOT_MINUTES )) -ge "$(mins "$WINDOW_END")" ]; }

# ---- the reloads --------------------------------------------------------------------------------------------------------------------
reload_app() {      # $1 = bundle id, $2 = how many windows, $3 = what to call it. The app must already be provably reachable.
  local i=1 r
  own activate "$1"; r="$OWN_R"; [ "$r" = ok ] || { say "  could not bring $3 to the front ($r) - not reloaded"; return 1; }
  while [ "$i" -le "$2" ]; do
    if [ "$2" -gt 1 ]; then own raise "$1" "$i"; r="$OWN_R"; [ "$r" = ok ] || { say "  $3 window $i could not be raised ($r) - skipped"; i=$(( i + 1 )); continue; }; fi
    own reload "$1"; r="$OWN_R"
    case "$r" in ok*) say "  reloaded $3 window $i ($r)" ;; *) say "  $3 window $i was NOT reloaded ($r)"; return 1 ;; esac
    i=$(( i + 1 ))
  done
  return 0
}
connect_x() {       # reload X, wait, press the shortcut in X, bring the Station forward, wait for a working report
  local r t
  XR="X not reloaded (switched off in config.env)"
  if [ "$RELOAD_X" = yes ]; then
    if reload_app "$X_BID" 1 X; then XR="X reloaded"; else XR="X NOT reloaded"; say "  X was not reloaded; going on to the shortcut, which is what reconnects it"; fi
  fi
  say "  waiting ${LOAD_WAIT}s for the pages to load"; nap "$LOAD_WAIT"
  alan_is_back && { STOPPED=1; return 1; }
  own activate "$X_BID"; r="$OWN_R"; [ "$r" = ok ] || { say "  could not bring X to the front for the shortcut ($r)"; return 1; }
  t="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  own shortcut "$X_BID"; r="$OWN_R"
  [ "$r" = sent ] || { say "  the shortcut was NOT sent ($r)"; return 1; }
  say "  Option+Shift+S sent to the X window"
  own activate "$STATION_BID"; r="$OWN_R"; [ "$r" = ok ] || say "  could not bring the Station back to the front ($r); its X box may be hidden and unable to report"
  wait_for_x "$t"
}

# ---- the restart (8 Oct 2026) -------------------------------------------------------------------------------------------------------
# Nothing below can run in a dry run: close_main and the open_* functions refuse unless the mode is run or test.
gb() { awk -v k="${1:-0}" 'BEGIN { printf "%.2f GB", k / 1048576 }'; }
remark() { RESTART_LINES="$RESTART_LINES$1$NL"; say "  $1"; }
tell_alan() { RESTART_NOTE="${RESTART_NOTE:+$RESTART_NOTE }$1"; say "NOTE FOR ALAN: $1"; }
reg_by_path() {     # $1 = bundle path -> "number<tab>bundle id<tab>kind<tab>name" of the app running from there, or nothing
  printf '%s\n' "$REG_SNAP" | awk -F'\t' -v p="$1" '$5 == p && !f { print $1 "\t" $2 "\t" $3 "\t" $4; f = 1 }'
}
cmd_of() {          # $1 = process number -> its command line, from the process table read last
  printf '%s\n' "$PS_SNAP" | awk -v p="$1" '$1 == p && !f { sub(/^ *[0-9]+ +[0-9]+ +[0-9]+ +/, ""); print; f = 1 }'
}
family_of() {       # $1 = process number -> that process and every process it started (its helpers), one number per line
  printf '%s\n' "$PS_SNAP" | awk -v root="$1" '$1 ~ /^[0-9]+$/ { pp[$1] = $2 }
    END { for (p in pp) { q = p; n = 0; while (q != "" && q + 0 > 1 && n < 64) { if (q + 0 == root + 0) { print p; break } q = pp[q]; n++ } } }'
}
kb_of() {           # stdin: process numbers -> "<kilobytes as Activity Monitor counts them> <kilobytes in real memory now> <how many processes>"
  local pids; pids="$(cat)"
  { printf '%s\n' "$pids" | sed 's/^/P /'; printf '%s\n' "$PS_SNAP" | sed 's/^/S /'; printf '%s\n' "$TOP_SNAP" | sed 's/^/T /'; } | awk '
    function kb(v,  n, u) { n = v; gsub(/[^0-9.]/, "", n); u = v; gsub(/[0-9.+-]/, "", u)
      if (u == "K") return n; if (u == "M") return n * 1024; if (u == "G") return n * 1048576; if (u == "T") return n * 1073741824; return n / 1024 }
    $1 == "P" && $2 ~ /^[0-9]+$/ && !($2 in want) { want[$2] = 1; n++ }
    $1 == "S" && ($2 in want) { rss += $4 }
    $1 == "T" && NF == 3 && $3 ~ /^[0-9.]+[BKMGT][+-]?$/ { p = $2; gsub(/[^0-9]/, "", p); if (p in want) foot += kb($3) }
    END { printf "%d %d %d\n", foot, rss, n }'
}
look_at_apps() {    # which of the three apps is running, and which processes belong to each. Reads only.
  local row
  PS_SNAP="$(proc_table)"; REG_SNAP="$(app_registry)"
  TV_PID=""; TV_BID=""; TV_CMD=""; TV_ARGS=""; TV_PIDS=""
  row="$(reg_by_path "$TRADINGVIEW_APP")"
  if [ -n "$row" ]; then
    TV_PID="$(printf '%s' "$row" | cut -f1)"; TV_BID="$(printf '%s' "$row" | cut -f2)"; TV_CMD="$(cmd_of "$TV_PID")"
    # the list of apps and the list of processes must agree that this is TradingView's main process, or it is not touched
    case "$TV_CMD" in "$TRADINGVIEW_APP/Contents/MacOS/"*" --type="*) TV_PID="" ;; "$TRADINGVIEW_APP/Contents/MacOS/"*) ;; *) TV_PID="" ;; esac
  fi
  if [ -n "$TV_PID" ]; then
    row="${TV_CMD#"$TRADINGVIEW_APP/Contents/MacOS/"}"
    case "$row" in *" --"*) TV_ARGS="--${row#* --}" ;; esac      # the options it was started with, to start it the same way again
    TV_PIDS="$(family_of "$TV_PID")"
  fi
  HUB_PID=""; HUB_BID=""; HUB_NAME=""; HUB_CMD=""; HUB_PIDS=""
  row="$(reg_by_path "$HUB_APP")"
  if [ -n "$row" ]; then
    HUB_PID="$(printf '%s' "$row" | cut -f1)"; HUB_BID="$(printf '%s' "$row" | cut -f2)"; HUB_NAME="$(printf '%s' "$row" | cut -f4)"; HUB_CMD="$(cmd_of "$HUB_PID")"
    case "$HUB_CMD " in *" --bundlepath $HUB_APP "*) ;; *) HUB_PID="" ;; esac
  fi
  if [ -n "$HUB_PID" ]; then
    # a Safari web app's page, network and picture helpers are started by macOS, not by the app; macOS lists them under the app's name
    HUB_PIDS="$HUB_PID$NL$(printf '%s\n' "$REG_SNAP" | awk -F'\t' -v n="$HUB_NAME" '
      $2 ~ /^com\.apple\.WebKit\./ && index($4, n " ") == 1 { r = substr($4, length(n) + 2); if (r ~ /^(Web Content|Networking|Graphics and Media|Service Worker)/) print $1 }')"
  fi
  BR_PID=""; BR_BID=""; BR_KIND=""; BR_CMD=""; BR_SHIMS=""; BR_PIDS=""
  row="$(reg_by_path "$BRAVE_APP")"
  if [ -n "$row" ]; then
    BR_PID="$(printf '%s' "$row" | cut -f1)"; BR_BID="$(printf '%s' "$row" | cut -f2)"; BR_KIND="$(printf '%s' "$row" | cut -f3)"; BR_CMD="$(cmd_of "$BR_PID")"
    case "$BR_CMD" in "$BRAVE_APP/Contents/MacOS/"*" --type="*) BR_PID="" ;; "$BRAVE_APP/Contents/MacOS/"*) ;; *) BR_PID="" ;; esac
  fi
  if [ -n "$BR_PID" ]; then
    # Brave's web apps (the Station, X): each has its own small app, started by macOS; in the order they were opened
    BR_SHIMS="$(printf '%s\n' "$REG_SNAP" | awk -F'\t' -v b="$BR_BID" 'index($2, b ".app.") == 1 && $5 != "-" { print $1 "\t" $2 "\t" $4 "\t" $5 }')"
    BR_PIDS="$(family_of "$BR_PID")$NL$(printf '%s\n' "$BR_SHIMS" | cut -f1)"
  fi
}
measure() {         # $1 = B (before) or A (after): each app's memory, and the whole Mac's, read at one moment
  local t h b
  look_at_apps; TOP_SNAP="$(foot_table)"
  t="$(printf '%s\n' "$TV_PIDS" | kb_of)"; h="$(printf '%s\n' "$HUB_PIDS" | kb_of)"; b="$(printf '%s\n' "$BR_PIDS" | kb_of)"
  if [ "$1" = B ]; then TV_B="$t"; HUB_B="$h"; BR_B="$b"; SYS_B="$(sys_memory)"; else TV_A="$t"; HUB_A="$h"; BR_A="$b"; SYS_A="$(sys_memory)"; fi
}
shim_names() { printf '%s\n' "$1" | cut -f3 | grep . | tr '\n' ',' | sed 's/,$//; s/,/, /g'; }
decide() {          # which apps may be restarted, and in words why not. Needs look_at_apps and (for Brave) the plan.
  TV_WHY=""; HUB_WHY=""; BR_WHY=""
  if [ "$RESTART_TRADINGVIEW" != yes ]; then TV_WHY="switched off in config.env"
  elif [ -z "$TV_PID" ]; then TV_WHY="it is not running"
  elif already_tried tv; then TV_WHY="already done tonight"; fi
  if [ "$RESTART_HUB_APP" != yes ]; then HUB_WHY="switched off in config.env"
  elif [ -z "$HUB_PID" ]; then HUB_WHY="it is not running"
  elif already_tried hub; then HUB_WHY="already done tonight"; fi
  if [ "$RESTART_BRAVE" != yes ]; then BR_WHY="switched off in config.env"
  elif [ -z "$BR_PID" ]; then BR_WHY="it is not running"
  elif already_tried brave; then BR_WHY="already done tonight"
  elif [ "$BR_KIND" != BackgroundOnly ]; then BR_WHY="Brave has a window of its own open, and Brave on this Mac is not set to bring its pages back"
  elif [ -z "$BR_SHIMS" ]; then BR_WHY="none of its web apps is open"
  elif [ "$PLAN" != full ]; then BR_WHY="after a restart X must be reconnected, and tonight that cannot be done ($WHY)"; fi
}
RESTART_STAMP="$STATE_DIR/.restarted-$(date +%Y-%m-%d)"
already_tried() { [ "$MODE" = run ] && [ -f "$RESTART_STAMP" ] && grep -qx "$1" "$RESTART_STAMP" 2>/dev/null; }
mark_tried() { [ "$MODE" = run ] && echo "$1" >> "$RESTART_STAMP" 2>/dev/null; return 0; }
may_change() { [ "$MODE" = run ] || [ "$MODE" = test ]; }
standins_ok() {     # the tests replace the Mac with stand-ins. A Mac that is only half replaced must never reach a real app.
  local some=0
  [ -n "${NR_FAKE_APPS_CMD:-}${NR_FAKE_IDLE_CMD:-}${NR_FAKE_HHMM:-}${NR_FAKE_LOCKED:-}${NR_FAKE_HEALTH_CMD:-}${NR_FAKE_PS_CMD:-}${NR_FAKE_REGISTRY_CMD:-}${NR_FAKE_TOP_CMD:-}" ] && some=1
  [ "${NR_NO_SLEEP:-0}" = 1 ] && some=1
  [ "$GUI" = osascript ] || some=1
  [ "$some" = 0 ] && return 0
  [ -n "${NR_FAKE_PS_CMD:-}" ] && [ -n "${NR_FAKE_REGISTRY_CMD:-}" ] && [ -n "${NR_FAKE_TOP_CMD:-}" ] && [ "$NR_KILL" != /bin/kill ] && [ "$NR_OPEN" != /usr/bin/open ] && [ "$NR_CAFFEINATE" != /usr/bin/caffeinate ]
}
quiet_enough() {    # may an app still be closed? Not once somebody has come back, and (nightly job) not outside the night window.
  if alan_is_back; then SEEN_BACK=1; say "  somebody is at the Mac - no app is closed"; return 1; fi
  if [ "$MODE" = run ]; then
    local h; h="$(now_hhmm)"
    if [ "$h" -lt "$WINDOW_START" ] || [ "$h" -ge "$WINDOW_END" ]; then say "  it is $(clock "$h"), outside the night window - no app is closed"; return 1; fi
  fi
  return 0
}
close_main() {      # $1 = process number, $2 = what to call it, $3 = how its command line began when it was looked at (may be empty).
                    # The ONLY place an app is asked to end: the ordinary "please quit" signal (TERM), to the one main process.
                    # There is no stronger signal anywhere in this file.
  may_change || { say "  (dry run - not done: ask $2 to close)"; return 1; }
  local c; c="$(proc_table | awk -v p="$1" '$1 == p && !f { sub(/^ *[0-9]+ +[0-9]+ +[0-9]+ +/, ""); print; f = 1 }')"
  case "$c" in
    "") say "  $2: its process ($1) is no longer there"; return 1 ;;
    *"Google Chrome"*) say "  REFUSED: process $1 is Chrome, and this job never closes Chrome"; return 1 ;;
  esac
  # a process number can be given to another program once its owner has gone: ask only the program that was looked at
  if [ -n "${3:-}" ]; then case "$c" in "$3"*) ;; *) say "  REFUSED: process $1 is no longer $2 - not touched"; return 1 ;; esac; fi
  [ "$1" -gt 1 ] 2>/dev/null || return 1
  "$NR_KILL" -TERM "$1" 2>>"$LOG"
}
still_there() {     # $1 = process number, $2 = how its command line begins: is that same process still running?
  proc_table | NR_PRE="$2" awk -v p="$1" '$1 == p { sub(/^ *[0-9]+ +[0-9]+ +[0-9]+ +/, ""); if (index($0, ENVIRON["NR_PRE"]) == 1) f = 1 } END { exit f ? 0 : 1 }'
}
wait_closed() {     # $1 = what to call it, $2 = process number, $3 = how its command line begins. 0 = gone, 1 = still there at the end
  local w=0
  while still_there "$2" "$3"; do
    if [ "$w" -ge $(( QUIT_WAIT + QUIT_PATIENCE )) ]; then say "  $1 is still open ${w}s after being asked to close - it is left as it is; nothing is forced"; return 1; fi
    [ "$w" -eq "$QUIT_WAIT" ] && say "  $1 is still closing after ${QUIT_WAIT}s - giving it up to ${QUIT_PATIENCE}s more"
    nap 1; w=$(( w + 1 ))
  done
  say "  $1 has closed (about ${w}s)"; return 0
}
wait_running() {    # $1 = bundle path. 0 as soon as macOS lists an app running from there, 1 after OPEN_WAIT seconds without it
  local w=0
  while :; do
    REG_SNAP="$(app_registry)"; [ -n "$(reg_by_path "$1")" ] && return 0
    [ "$w" -ge "$OPEN_WAIT" ] && return 1
    nap 1; w=$(( w + 1 ))
  done
}
wait_unlisted() {   # $1 = bundle path. An app that has just gone can stay on macOS's list of running apps for a moment, and "open" would
                    # then only point at the one that is going instead of starting a new one. Waits (at most ten seconds) until it is off the list.
  local w=0
  while :; do
    REG_SNAP="$(app_registry)"; [ -z "$(reg_by_path "$1")" ] && return 0
    [ "$w" -ge 10 ] && { say "  macOS still lists it as running after ${w}s - opening it anyway"; return 0; }
    nap 1; w=$(( w + 1 ))
  done
}
wait_window() {     # $1 = bundle id. Waits (at most OPEN_WAIT seconds) until that app shows a window. Looks only.
  local w=0
  [ "$GUI" = none ] && return 0
  while :; do
    set -- "$1" $(count_windows "$1"); [ "${2:-0}" -ge 1 ] && return 0
    [ "$w" -ge "$OPEN_WAIT" ] && return 1
    nap 2; w=$(( w + 2 ))
  done
}
open_tradingview() { # with the same start-up options it was running with
  may_change || return 1
  local a=() s="$TV_ARGS0"
  if [ -n "$s" ]; then
    s="${s#--}"
    while :; do case "$s" in *" --"*) a+=("--${s%% --*}"); s="${s#* --}" ;; *) a+=("--$s"); break ;; esac; done
    "$NR_OPEN" -g -a "$TRADINGVIEW_APP" --args "${a[@]}" 2>>"$LOG"
  else "$NR_OPEN" -g -a "$TRADINGVIEW_APP" 2>>"$LOG"; fi
}
open_hub() { may_change || return 1; "$NR_OPEN" -g -a "$HUB_APP" 2>>"$LOG"; }
open_brave() {      # Brave's web apps, in the order they were open; the first one starts Brave underneath, as it does by hand
  may_change || return 1
  local pid bid name path
  while IFS="$TAB" read -r pid bid name path; do
    [ -n "$path" ] || continue
    "$NR_OPEN" -g -a "$path" 2>>"$LOG"; say "  opened $name"
    wait_running "$path" || say "  $name is not listed as running after ${OPEN_WAIT}s"
  done <<EOF
$BR_SHIMS0
EOF
}
tv_back() { wait_running "$TRADINGVIEW_APP"; }
hub_back() { wait_running "$HUB_APP"; }
brave_back() {
  local pid bid name path all=0
  wait_running "$BRAVE_APP" || all=1
  while IFS="$TAB" read -r pid bid name path; do [ -n "$path" ] || continue; [ -n "$(reg_by_path "$path")" ] || wait_running "$path" || all=1; done <<EOF
$BR_SHIMS0
EOF
  return "$all"
}
restart_one() {     # $1 = short name, $2 = what to call it, $3 = its main process, $4 = how its command line begins,
                    # $5 = the function that opens it again, $6 = the function that says whether it is back, $7 = its bundle path
                    # returns 0 = go on to the next app; 1 = stopped before closing it (somebody came back, or the window ended);
                    # 2 = it was closed and did not come back. After 1 or 2 no further app is closed tonight.
  quiet_enough || return 1
  say "restart: $2"
  mark_tried "$1"
  REOPEN_OWED="$5"
  if ! close_main "$3" "$2" "$4"; then REOPEN_OWED=""; set_why "$1" "it could not be asked to close"; remark "$2 could not be asked to close and was left as it was."; return 0; fi
  say "  asked $2 to close (its main process, $3); it normally takes a few seconds, and it gets ${QUIT_WAIT}s"
  if ! wait_closed "$2" "$3" "$4"; then
    REOPEN_OWED=""; LATE="$LATE $1"; set_why "$1" "it did not close when asked"
    tell_alan "$2 did not close when it was asked to, so it was not restarted. Nothing was forced; it was left as it was."
    return 0
  fi
  if [ "$1" = brave ]; then lingering_shims; fi
  wait_unlisted "$7"
  "$5"
  if "$6"; then say "  $2 is open again"
  else
    say "  $2 is not back after ${OPEN_WAIT}s - one more try"
    "$5"
    if "$6"; then say "  $2 is open again (second try)"
    else
      REOPEN_OWED=""; set_why "$1" "it was closed and did not open again"
      tell_alan "$2 was closed for its nightly restart and did not open again after two tries. Please open it by hand. No other app was closed after that."
      return 2
    fi
  fi
  REOPEN_OWED=""; RESTARTED="${RESTARTED:+$RESTARTED, }$2"
  return 0
}
set_why() { case "$1" in tv) TV_WHY="$2" ;; hub) HUB_WHY="$2" ;; brave) BR_WHY="$2" ;; esac; }
why_if_none() { case "$1" in tv) [ -n "$TV_WHY" ] || TV_WHY="$2" ;; hub) [ -n "$HUB_WHY" ] || HUB_WHY="$2" ;; brave) [ -n "$BR_WHY" ] || BR_WHY="$2" ;; esac; return 0; }
lingering_shims() { # Brave's web-app icons end by themselves when Brave ends. One that is still listed ten seconds later is asked to end too.
  local w=0 pid bid name path left
  while :; do
    REG_SNAP="$(app_registry)"; left="$(printf '%s\n' "$REG_SNAP" | awk -F'\t' -v b="$BR_BID0" 'index($2, b ".app.") == 1 { print $1 "\t" $4 }')"
    [ -z "$left" ] && return 0
    [ "$w" -ge 10 ] && break
    nap 1; w=$(( w + 1 ))
  done
  while IFS="$TAB" read -r pid name; do
    [ -n "$pid" ] || continue
    say "  Brave has closed but its web app \"$name\" is still listed - asking it to close too"; close_main "$pid" "$name"
  done <<EOF
$left
EOF
  nap 3
}
start_awake() {     # see "the screen saver" among the neighbours: it ends by itself after 30 minutes whatever happens to this job
  [ -n "$AWAKE_PID" ] && return 0
  may_change || return 0
  "$NR_CAFFEINATE" -d -t 1800 >/dev/null 2>&1 &
  AWAKE_PID=$!; say "  holding the screen awake while apps are closed and opened"
}
stop_awake() { [ -n "$AWAKE_PID" ] && kill "$AWAKE_PID" 2>/dev/null; AWAKE_PID=""; return 0; }
x_title() {         # the name of the X window, without the "(3) " count X puts in front of it
  gui windows "$X_BID" | head -1 | cut -f1 | sed -E 's/^\([0-9+]+\) *//'
}
restart_preview() { # dry run: what the restart would do tonight. Reads only.
  [ "$RESTART_APPS" = yes ] || { say "restart: switched off in config.env (RESTART_APPS=no) - this job only reloads"; return 0; }
  measure B; decide
  set -- $TV_B
  if [ -z "$TV_PID" ]; then say "restart: TradingView is not running - it would be left alone (never started by this job)"
  elif [ -n "$TV_WHY" ]; then say "restart: TradingView would NOT be restarted: $TV_WHY"
  else say "restart: TradingView is running ($3 processes, $(gb "$1")) - it would be asked to close and opened again${TV_ARGS:+ with the start-up options it has now: $TV_ARGS}"; fi
  set -- $HUB_B
  if [ -z "$HUB_PID" ]; then say "restart: the Hub app is not running - it would be left alone"
  elif [ -n "$HUB_WHY" ]; then say "restart: the Hub app would NOT be restarted: $HUB_WHY"
  else say "restart: the Hub app \"$HUB_NAME\" is running ($3 processes, $(gb "$1")) - it would be closed and opened again (it comes back on its first screen)"; fi
  set -- $BR_B
  if [ -z "$BR_PID" ]; then say "restart: Brave is not running - it would be left alone"
  elif [ -n "$BR_WHY" ]; then say "restart: Brave would NOT be restarted: $BR_WHY"
  else say "restart: Brave is running in the background with these web apps: $(shim_names "$BR_SHIMS") ($3 processes, $(gb "$1")) - it would be closed and those web apps opened again, in that order"; fi
  set -- $SYS_B; say "restart: the whole Mac now - $(gb "$1") of memory pushed out to disk, $2% of memory free"
}
restart_stage() {   # the real thing. Called once per run, after every check the reload stage makes and before it reloads anything.
  [ "$RESTART_APPS" = yes ] || return 0
  may_change || return 0
  if ! standins_ok; then say "restart: NOT done - this is a test with stand-ins, and the stand-ins for closing and opening apps are missing"; return 0; fi
  say "restart: looking at TradingView, the Hub app and Brave"
  measure B; decide
  TV_PID0="$TV_PID"; TV_ARGS0="$TV_ARGS"; TV_BID0="$TV_BID"; HUB_PID0="$HUB_PID"; HUB_BID0="$HUB_BID"; HUB_NAME0="$HUB_NAME"; HUB_CMD0="$HUB_CMD"; BR_PID0="$BR_PID"; BR_BID0="$BR_BID"; BR_SHIMS0="$BR_SHIMS"
  set -- $TV_B; say "  memory before - TradingView: $(gb "$1") as Activity Monitor counts it ($(gb "$2") in real memory now), $3 processes${TV_WHY:+ - not restarted: $TV_WHY}"
  set -- $HUB_B; say "  memory before - the Hub app: $(gb "$1") as Activity Monitor counts it ($(gb "$2") in real memory now), $3 processes${HUB_WHY:+ - not restarted: $HUB_WHY}"
  set -- $BR_B; say "  memory before - Brave with its web apps: $(gb "$1") as Activity Monitor counts it ($(gb "$2") in real memory now), $3 processes${BR_WHY:+ - not restarted: $BR_WHY}"
  set -- $SYS_B; say "  memory before - the whole Mac: $(gb "$1") pushed out to disk, $2% free"
  RESTART_RAN=1
  [ -z "$TV_WHY" ] && [ -n "$TV_BID0" ] && { set -- $(count_windows "$TV_BID0"); TV_W0="$1"; }
  [ -z "$HUB_WHY" ] && [ -n "$HUB_BID0" ] && { set -- $(count_windows "$HUB_BID0"); HUB_W0="$1"; }
  if [ -z "$BR_WHY" ]; then
    # Brave feeds X. Reach X and the Station BEFORE Brave is closed: if they cannot be brought forward now, X could not be reconnected.
    X_TITLE0="$(x_title)"
    own activate "$X_BID"; R1="$OWN_R"; own activate "$STATION_BID"; R2="$OWN_R"
    if [ "$R1" != ok ] || [ "$R2" != ok ]; then BR_WHY="X and the Station could not be brought to the front (X: $R1, Station: $R2), so X could not be reconnected afterwards"; fi
  fi
  [ -n "$BR_WHY" ] && [ -n "$BR_PID0" ] && say "  Brave is not restarted tonight: $BR_WHY"
  if [ -n "$TV_WHY" ] && [ -n "$HUB_WHY" ] && [ -n "$BR_WHY" ]; then say "restart: nothing to restart tonight"; return 0; fi
  quiet_enough || return 0
  start_awake
  local rc=0 tried=""
  if [ -z "$TV_WHY" ]; then
    [ -n "$TV_ARGS0" ] && say "  TradingView is running with these start-up options, and is opened again with the same: $TV_ARGS0"
    tried="$tried tv"; restart_one tv TradingView "$TV_PID0" "$TRADINGVIEW_APP/Contents/MacOS/" open_tradingview tv_back "$TRADINGVIEW_APP"; rc=$?
  fi
  if [ "$rc" = 0 ] && [ -z "$HUB_WHY" ]; then
    tried="$tried hub"; restart_one hub "the Hub app" "$HUB_PID0" "$HUB_CMD0" open_hub hub_back "$HUB_APP"; rc=$?
  fi
  if [ "$rc" = 0 ] && [ -z "$BR_WHY" ]; then
    say "  Brave has no window of its own; it is opened again through its web apps: $(shim_names "$BR_SHIMS0")"
    tried="$tried brave"; restart_one brave Brave "$BR_PID0" "$BRAVE_APP/Contents/MacOS/" open_brave brave_back "$BRAVE_APP"; rc=$?
    case ", $RESTARTED," in *", Brave,"*) BRAVE_RESTARTED=1 ;; esac
    [ "$rc" = 2 ] && BRAVE_RESTARTED=1     # closed and not fully back: the reload stage must still look again
  fi
  if [ "$rc" != 0 ]; then                  # what was not reached, said in words for the morning lines
    local k w="somebody came back to the Mac, or the night window ended"
    [ "$rc" = 2 ] && w="an app before it did not open again, so nothing more was closed"
    for k in tv hub brave; do case " $tried " in *" $k "*) ;; *) why_if_none "$k" "$w" ;; esac; done
    [ "$rc" = 1 ] && why_if_none "${tried##* }" "$w"      # the one it stopped at was not closed either
  fi
  [ -n "$RESTARTED" ] && DID="$DID restarted: $RESTARTED;"
  return 0
}
after_brave() {     # Brave is new: its web apps have the same names but new windows, and X is certainly not connected
  [ "$BRAVE_RESTARTED" = 1 ] || return 0
  say "looking again, now that Brave has been restarted"
  HUB_BIDS=""; STATION_BID=""; X_BID=""; STATION_WINDOWS=0; X_WINDOWS=0; STATION_MIN=0; X_MIN=0; FAMILY=""
  discover
  [ -n "$STATION_BID" ] && { wait_window "$STATION_BID" || say "  the Station shows no window yet"; }
  [ -n "$X_BID" ] && { wait_window "$X_BID" || say "  X shows no window yet"; }
  say "  giving the reopened pages ${SETTLE_WAIT}s to draw"; nap "$SETTLE_WAIT"
  count_all; BEFORE=not-reporting; make_plan
  if [ -n "$X_BID" ] && [ -n "$X_TITLE0" ]; then
    local t; t="$(x_title)"
    [ -n "$t" ] && [ "$t" != "$X_TITLE0" ] && remark "X came back on its opening page (\"$t\"); before the restart its window was called \"$X_TITLE0\"."
  fi
  if [ "$(screen_locked)" = yes ]; then
    PLAN=none; WHY="the screen locked itself, or the screen saver came up, while Brave was restarting"
    tell_alan "Brave was restarted, and then the screen was locked or showing the screen saver, so X could not be reconnected. Click the X window and press Option+Shift+S."
  fi
}
mem_line() {        # $1 = what to call it, $2 = "a b n" before, $3 = the same after, $4 = why it was not restarted, or nothing
  local n="$1" r="$4"; set -- $2 $3
  printf '%s: %s before, %s after (in real memory at those moments: %s, then %s)%s\n' "$n" "$(gb "$1")" "$(gb "$4")" "$(gb "$2")" "$(gb "$5")" "${r:+ - not restarted: $r}"
}
restart_wrapup() {  # at the very end of the job: nothing left closed, the memory after, and the lines for the morning
  [ "$RESTART_RAN" = 1 ] || return 0
  RESTART_RAN=2
  local k pid pre fn back what lines s
  for k in $LATE; do      # an app that had not closed when the patience ran out: if it has closed since, it is opened again now
    case "$k" in
      tv) pid="$TV_PID0"; pre="$TRADINGVIEW_APP/Contents/MacOS/"; fn=open_tradingview; back=tv_back; what=TradingView ;;
      hub) pid="$HUB_PID0"; pre="$HUB_CMD0"; fn=open_hub; back=hub_back; what="the Hub app" ;;
      brave) pid="$BR_PID0"; pre="$BRAVE_APP/Contents/MacOS/"; fn=open_brave; back=brave_back; what=Brave ;;
      *) continue ;;
    esac
    still_there "$pid" "$pre" && continue
    say "  $what has closed after all - opening it again"; "$fn"
    if "$back"; then tell_alan "$what closed late and was opened again."; else tell_alan "$what closed late and did not open again. Please open it by hand."; fi
    [ "$k" = brave ] && tell_alan "X is not connected: click the X window and press Option+Shift+S."
  done
  measure A
  if [ "$GUI" != none ]; then
    case ", $RESTARTED," in *", TradingView,"*) set -- $(count_windows "$TV_BID0"); [ "$TV_W0" -ge 1 ] && [ "$1" -lt 1 ] && tell_alan "TradingView is running again but shows no window." ;; esac
    case ", $RESTARTED," in *", the Hub app,"*) set -- $(count_windows "$HUB_BID0"); [ "$HUB_W0" -ge 1 ] && [ "$1" -lt 1 ] && tell_alan "The Hub app is running again but shows no window." ;; esac
  fi
  set -- $SYS_B $SYS_A
  lines="Memory before and after the restart, as Activity Monitor counts it:$NL$(mem_line TradingView "$TV_B" "$TV_A" "$TV_WHY")$NL$(mem_line "The Hub app" "$HUB_B" "$HUB_A" "$HUB_WHY")$NL$(mem_line "Brave with the Station and X" "$BR_B" "$BR_A" "$BR_WHY")${NL}The whole Mac: $(gb "$1") of memory pushed out to disk before, $(gb "$3") after; $2% of memory free before, $4% after"
  if [ "$WROTE_LAST" != 1 ]; then
    s="no app was restarted"; [ -n "$RESTARTED" ] && s="restarted: $RESTARTED"
    printf '%s - %s\n' "$(when)" "$s" > "$STATE_DIR/LAST-NIGHT.txt" 2>/dev/null
  fi
  { [ -n "$RESTART_NOTE" ] && printf 'For Alan: %s\n' "$RESTART_NOTE"; printf '%s' "$RESTART_LINES"; printf '%s\n' "$lines"; } >> "$STATE_DIR/LAST-NIGHT.txt" 2>/dev/null
  printf '%s\n' "$lines" | while IFS= read -r s; do say "$s"; done
  stop_awake
}
on_exit() {         # whatever ends this job, an app it closed is not left closed, and the screen is given back to its own timers
  if [ -n "$REOPEN_OWED" ]; then say "the job is ending while an app it closed is still closed - opening it again"; "$REOPEN_OWED" >/dev/null 2>&1; fi
  stop_awake
}
trap on_exit EXIT
trap 'exit 1' HUP INT TERM

# =====================================================================================================================================
case "$MODE" in run|test|dry-run) ;; *) echo "usage: night-reload.sh dry-run | test | run"; exit 2 ;; esac
mkdir -p "$(dirname "$LOG")" "$STATE_DIR" 2>/dev/null
HHMM="$(now_hhmm)"; IN_WINDOW=no
[ "$HHMM" -ge "$WINDOW_START" ] && [ "$HHMM" -lt "$WINDOW_END" ] && IN_WINDOW=yes
NEED="$IDLE_SECONDS"; [ "$MODE" = test ] && NEED="$TEST_IDLE_SECONDS"

if [ "$MODE" = run ]; then
  # launchd runs a missed time the moment a sleeping Mac wakes - often because Alan woke it. Outside the window: nothing, ever.
  [ "$IN_WINDOW" = yes ] || { say "outside the night window $(clock "$WINDOW_START")-$(clock "$WINDOW_END") (it is $(clock "$HHMM")) - nothing done"; exit 0; }
  [ -e "$STATE_DIR/.done-$(date +%Y-%m-%d)" ] && exit 0
  IDLE="$(idle_seconds)"
  if [ "$IDLE" -lt "$NEED" ]; then
    say "the Mac is in use (last touched $(( IDLE / 60 )) min ago, needs $(( NEED / 60 ))) - nothing done; next try in ${SLOT_MINUTES} min"
    last_slot && result "not done tonight: the Mac was in use until the end of the window ($(clock "$WINDOW_END"))"
    exit 0
  fi
fi

say "---- $(when) - $MODE ----"
[ "$MODE" = dry-run ] && say "DRY RUN: this only looks. Nothing is reloaded, no key is sent, no window is brought to the front."
if [ "$MODE" != run ]; then
  say "clock: it is $(clock "$HHMM"); the nightly job acts only between $(clock "$WINDOW_START") and $(clock "$WINDOW_END") $([ "$IN_WINDOW" = yes ] && echo '(inside now)' || echo '(outside now)')"
  say "keyboard and mouse: last touched $(idle_seconds)s ago; the nightly job needs ${IDLE_SECONDS}s"
fi
if [ "$MODE" = test ]; then
  say "TEST: take your hands off the keyboard and mouse for ${NEED} seconds..."
  W=0; while [ "$(idle_seconds)" -lt "$NEED" ]; do nap 2; W=$(( W + 2 )); [ "$W" -ge 180 ] && { say "hands were never off for ${NEED}s in three minutes - test not run"; finish; }; done
fi

LOCKED="$(screen_locked)"
if [ "$LOCKED" = yes ]; then
  say "the screen is locked (or the screen saver is up): a key press would go to the lock screen, so nothing can be reloaded safely"
  if [ "$MODE" = run ]; then last_slot && { note "nothing was reloaded because the screen stayed locked until $(clock "$WINDOW_END")."; done_for_tonight; }; finish; fi
  [ "$MODE" = test ] && finish
fi

discover
[ -n "$HUB_BIDS$STATION_BID$X_BID" ] || say "  no Hub, Station or X web-app window of Brave or Chrome is open on this Mac"
if [ "$FAMILY" = both ]; then
  say "both Brave and Chrome have the Station and X open; set BROWSER=brave or BROWSER=chrome in config.env"
  [ "$MODE" = run ] && { note "nothing was reloaded: the Station and X are open in both Brave and Chrome and I was not told which to use."; done_for_tonight; }
  finish
fi

TRUSTED="$(gui trusted)"
case "$TRUSTED" in
  true) say "permission: 'Scintilla Night Reload' is allowed to control the Mac (Accessibility) - good" ;;
  no-gui) say "permission: not checked (window helper switched off for this run)" ;;
  *) say "permission: MISSING - System Settings > Privacy & Security > Accessibility > switch on 'Scintilla Night Reload' ($TRUSTED)"
     if [ "$MODE" != dry-run ]; then
       note "nothing was reloaded: macOS did not let 'Scintilla Night Reload' look at windows. Check its switch in System Settings > Privacy & Security > Accessibility (and under Automation, 'System Events')."; done_for_tonight; finish
     fi ;;
esac

count_all
if [ "$MODE" = dry-run ] && [ "$TRUSTED" = true ]; then
  for B in $STATION_BID $X_BID $HUB_BIDS; do say "  reload menu item in $B: $(gui find-reload "$B")"; done
fi

health_setup || say "  the X health page could not be read; X cannot be confirmed tonight"
guess_client && say "  this browser on the X health page: $X_HEALTH_CLIENT"
BEFORE="$(x_health "")"; say "X before: $BEFORE"

# ---- the plan -----------------------------------------------------------------------------------------------------------------------
make_plan
if [ "$MODE" = dry-run ]; then
  restart_preview
  say "TONIGHT, at the first quiet moment between $(clock "$WINDOW_START") and $(clock "$WINDOW_END"), the job would:"
  N=1
  if [ "$RESTART_APPS" = yes ]; then
    [ -n "$TV_PID" ] && [ -z "$TV_WHY" ] && { say "  $N. close TradingView and open it again"; N=$(( N + 1 )); }
    [ -n "$HUB_PID" ] && [ -z "$HUB_WHY" ] && { say "  $N. close the Hub app and open it again"; N=$(( N + 1 )); }
    [ -n "$BR_PID" ] && [ -z "$BR_WHY" ] && { say "  $N. check it can bring X and the Station to the front, then close Brave and open its web apps again ($(shim_names "$BR_SHIMS"))"; N=$(( N + 1 )); }
  fi
  if [ "$RELOAD_HUB" = yes ] && [ -n "$HUB_BIDS" ]; then say "  $N. reload the Hub window (it comes back on its first screen)"; N=$(( N + 1 ))
  elif [ "$RESTART_APPS" = yes ] && [ -n "$HUB_PID" ] && [ -z "$HUB_WHY" ]; then say "  -  not reload the Hub as well: closing and opening its app is its fresh start (it comes back on its first screen, not where you left it)"
  else say "  -  leave the Hub alone: it reloads itself between 03:00 and 05:00 and comes back where you left it"; fi
  case "$PLAN" in
    full) say "  $N. check it can bring X and the Station to the front"; say "  $(( N + 1 )). reload the Station ($STATION_WINDOWS window(s))"
          say "  $(( N + 2 )). reload X, wait ${LOAD_WAIT}s, press Option+Shift+S in the X window"
          say "  $(( N + 3 )). bring the Station forward and wait up to ${HEALTH_WAIT}s for X to report working; one retry; a note for you if it does not"
          say "  $(( N + 4 )). put back the app that was in front" ;;
    x-only) say "  $N. reload X" ;;
    station-only) say "  $N. reload the Station" ;;
    none) say "  -  leave the Station and X alone: $WHY" ;;
  esac
  say "Full log: $LOG"
  finish
fi

# ---- the real thing -----------------------------------------------------------------------------------------------------------------
if [ "$MODE" = run ] && [ "$(idle_seconds)" -lt "$NEED" ]; then say "somebody touched the Mac while I was looking - nothing done; next try in ${SLOT_MINUTES} min"; finish; fi
T_BEGIN="$(date +%s)"; STOPPED=0; LAST_HEALTH=""; DID=""; XR=""
FRONT="$(gui front)"; say "in front before: $FRONT"

restart_stage
after_brave
if [ "$SEEN_BACK" = 1 ] && [ "$BRAVE_RESTARTED" != 1 ]; then
  # the restart stopped because somebody came back, and Brave was not touched: X is as it was, so nothing is reloaded under their hands
  say "somebody is at the Mac - nothing is reloaded now; next try in ${SLOT_MINUTES} min"
  KEEP_NIGHT_OPEN=1; PLAN=skip; result "$DID stopped: somebody came back to the Mac"
fi

if [ "$RELOAD_HUB" = yes ] && [ "$PLAN" != skip ]; then
  for B in $HUB_BIDS; do set -- $(count_windows "$B"); [ "$1" -ge 1 ] && reload_app "$B" "$1" "the Hub" && DID="$DID the Hub reloaded;"; done
fi

case "$PLAN" in
  skip) ;;
  none) [ -z "$DID" ] && DID=" nothing reloaded:"; OUTCOME="$DID $WHY"
        case "$WHY" in *"cannot tell which"*|*minimised*|*"I can find"*) note "the Station and X were not reloaded: $WHY." ;; *) result "$OUTCOME" ;; esac ;;
  x-only) if reload_app "$X_BID" 1 X; then result "$DID X reloaded; $WHY"; else result "$DID X could not be reloaded (see the log); $WHY"; fi ;;
  station-only) if reload_app "$STATION_BID" "$STATION_WINDOWS" "the Station"; then result "$DID the Station reloaded; $WHY"; else result "$DID the Station could not be reloaded (see the log); $WHY"; fi ;;
  full)
    # reach both BEFORE reloading either: after this point the Station is reloaded and X must be reconnected
    own activate "$X_BID"; R1="$OWN_R"; own activate "$STATION_BID"; R2="$OWN_R"
    if [ "$R1" != ok ] || [ "$R2" != ok ]; then
      note "the Station and X were not reloaded: I could not bring them to the front (X: $R1, Station: $R2)."
    elif alan_is_back; then say "somebody came back before anything was reloaded - stopping; next try in ${SLOT_MINUTES} min"; KEEP_NIGHT_OPEN=1; result "$DID stopped before reloading the Station: somebody came back"
      [ "$BRAVE_RESTARTED" = 1 ] && tell_alan "Brave was restarted and somebody came back to the Mac before X was reconnected. Click the X window and press Option+Shift+S (the job also tries again at the next quiet moment before $(clock "$WINDOW_END"))."
    elif ! reload_app "$STATION_BID" "$STATION_WINDOWS" "the Station"; then
      note "the Station could not be reloaded; X was left as it was."
      [ "$BRAVE_RESTARTED" = 1 ] && tell_alan "Brave was restarted, so X is not connected: click the X window and press Option+Shift+S."
    else
      DID="$DID the Station reloaded;"
      if connect_x; then result "$DID $XR, the extension run, X confirmed working (first try)"
      elif [ "$STOPPED" = 1 ]; then
        say "somebody came back after the Station was reloaded - no more key presses; watching whether X returns by itself"
        if wait_for_x "$(date -u -r "$T_BEGIN" +%Y-%m-%dT%H:%M:%SZ)"; then result "$DID stopped when somebody came back; X is working"
        else note "I stopped when somebody came back, after reloading the Station. X is not showing: click the X window and press Option+Shift+S."; fi
      else
        say "X did not come back - one retry of the X half"
        if alan_is_back; then note "the Station was reloaded but X did not come back, and I did not retry because somebody was at the Mac. Click the X window and press Option+Shift+S."
        elif connect_x; then result "$DID $XR, the extension run, X confirmed working (second try)"
        else note "the Station and X were reloaded but X did not come back after two tries (${LAST_HEALTH:-no report}). Click the X window and press Option+Shift+S."; fi
      fi
    fi ;;
esac

# only if this job moved something to the front, and never under the hands of somebody who has come back
if [ "$MOVED" = 1 ] && [ -n "$FRONT" ] && [ "$STOPPED" != 1 ] && ! alan_is_back; then
  case "$FRONT" in no-gui|dry|error:*) ;; *) own activate "$FRONT"; R="$OWN_R"; say "put back in front: $FRONT ($R)" ;; esac
fi
[ "$KEEP_NIGHT_OPEN" = 1 ] || done_for_tonight
finish
