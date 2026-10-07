#!/bin/bash
# night-reload.sh - the 4 am reload of the Station, X and the X extension (and, if switched on, the Hub).
#
# 7 Oct 2026. Alan: "Whatever we can do to reload Scintilla Hub, and Station, and X, and Extension, the better. If that's the 4 a.m. job,
# whatever." / "I'm pretty sure you guys can find the moment where I'm not clicking and typing." / "restarting the Station requires
# restarting X and executing the extension or it won't be working."
#
# WHAT IT DOES, in order, and only between WINDOW_START and WINDOW_END, only after IDLE_SECONDS without keyboard or mouse:
#   1. finds the Station, X and Hub WEB-APP windows of ONE browser (Brave or Chrome). A site open as an ordinary tab is never touched.
#   2. reads whether X is working now (the Station's own once-a-minute health log - the same one the page /x-health/ shows).
#   3. proves it can bring X and the Station to the front BEFORE it reloads anything, so it never reloads the Station and then finds it
#      cannot reach X.
#   4. reloads each Station window (the app's own "Reload This Page" menu item - no typing), reloads X, waits for both to load,
#      presses Option+Shift+S in the X window (the X extension's shortcut; pressing it again reconnects, it never switches X off),
#      brings the Station back to the front so its X box can be seen and can report.
#   5. waits for a fresh "X is working" report. If none comes: ONE retry of the X half. If still none: one line for Alan.
#   6. puts back the app that was in front.
# It never quits an app, never opens one, never closes a window, never touches a window that is not one of those web apps.
#
# ITS NEIGHBOURS (read before changing any number here):
#   - the Hub's own in-page night reload (Hub index.html, "RM1 - THE NIGHT RELOAD"): 03:00-05:00, comes back where Alan left it. A plain
#     reload from outside does NOT keep his place, so the Hub is left to its own reload unless RELOAD_HUB=yes.
#   - the Station's in-page night reload (branch station/rm1-memory-20261007): NOT live, and should stay off on a Mac that runs this job -
#     two reloaders would race and the second one would leave X unconnected with nobody there to reconnect it.
#   - the Station's self-update (deck/index.html, "SELF-UPDATE"): reloads the deck for a new build after two quiet minutes; untouched.
#   - the X Bridge's self-update (background.js, "the bridge keeps itself up to date"): reloads the extension only while it feeds no pane.
#     Reloading the Station opens such a moment; if the folder carries a newer bridge it loads then, and the shortcut in step 4 is exactly
#     what a freshly loaded bridge needs.
#   - the weekly restart (~/Library/LaunchAgents/com.alan.weekly-restart.plist, 03:30): on a night the Mac restarts, nobody is logged in
#     at 04:00, launchd does not run this job, and X needs Alan's Option+Shift+S in the morning as it does today.
#   - the pattern here (several launchd times + "only inside the window" + "only when nobody touched the Mac" + --dry-run) is the one
#     restart_guard.sh already uses on this Mac; idle time is read the same way (ioreg HIDIdleTime).
#
#   night-reload.sh dry-run    look only: says what it sees and what it WOULD do tonight. Sends nothing, brings nothing to the front.
#   night-reload.sh test       the real thing NOW, for a supervised test: ignores the clock, waits for TEST_IDLE_SECONDS hands-off.
#   night-reload.sh run        the nightly job (launchd). Does nothing outside the window or while the Mac is in use.
#
# Settings: config.env beside this file (see config.example.env). Log: ~/Library/Logs/scintilla-night-reload.log.
# Last result, one line: LAST-NIGHT.txt beside this file. A line beginning "NOTE<tab>" on stdout is shown on screen by the launcher.

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

NOTE_TEXT=""; OWN_SPANS=""; OWN_R=""; MOVED=0; KEEP_NIGHT_OPEN=0; T_BEGIN=0; HKEY=""; HURL=""; HKNOWN=""
HUB_BIDS=""; STATION_BID=""; X_BID=""; STATION_WINDOWS=0; X_WINDOWS=0; FAMILY=""
VERBOSE=0; [ "$MODE" = run ] || VERBOSE=1

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

# ---- results ------------------------------------------------------------------------------------------------------------------------
result() { printf '%s - %s\n' "$(when)" "$1" > "$STATE_DIR/LAST-NIGHT.txt" 2>/dev/null; say "RESULT: $1"; }
note()   { NOTE_TEXT="Night reload, $(when): $1"; printf '%s\n' "$NOTE_TEXT" > "$STATE_DIR/LAST-NIGHT.txt" 2>/dev/null; say "NOTE FOR ALAN: $1"; }
done_for_tonight() { [ "$MODE" = run ] && : > "$STATE_DIR/.done-$(date +%Y-%m-%d)" 2>/dev/null; find "$STATE_DIR" -maxdepth 1 -name '.done-*' -mtime +7 -delete 2>/dev/null; return 0; }
finish() { [ -n "$NOTE_TEXT" ] && printf 'NOTE\t%s\n' "$NOTE_TEXT"; exit 0; }
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

if [ -n "$STATION_BID" ]; then set -- $(count_windows "$STATION_BID"); STATION_WINDOWS="$1"; STATION_MIN="$2"; say "  the Station has $STATION_WINDOWS window(s), $STATION_MIN minimised"; fi
if [ -n "$X_BID" ]; then set -- $(count_windows "$X_BID"); X_WINDOWS="$1"; X_MIN="$2"; say "  X has $X_WINDOWS window(s), $X_MIN minimised"; fi
if [ "$MODE" = dry-run ] && [ "$TRUSTED" = true ]; then
  for B in $STATION_BID $X_BID $HUB_BIDS; do say "  reload menu item in $B: $(gui find-reload "$B")"; done
fi

health_setup || say "  the X health page could not be read; X cannot be confirmed tonight"
guess_client && say "  this browser on the X health page: $X_HEALTH_CLIENT"
BEFORE="$(x_health "")"; say "X before: $BEFORE"

# ---- the plan -----------------------------------------------------------------------------------------------------------------------
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
if [ "$MODE" = dry-run ]; then
  say "TONIGHT, at the first quiet moment between $(clock "$WINDOW_START") and $(clock "$WINDOW_END"), the job would:"
  N=1
  if [ "$RELOAD_HUB" = yes ] && [ -n "$HUB_BIDS" ]; then say "  $N. reload the Hub window (it comes back on its first screen)"; N=$(( N + 1 ))
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

if [ "$RELOAD_HUB" = yes ]; then
  for B in $HUB_BIDS; do set -- $(count_windows "$B"); [ "$1" -ge 1 ] && reload_app "$B" "$1" "the Hub" && DID="$DID the Hub reloaded;"; done
fi

case "$PLAN" in
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
    elif ! reload_app "$STATION_BID" "$STATION_WINDOWS" "the Station"; then
      note "the Station could not be reloaded; X was left as it was."
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
