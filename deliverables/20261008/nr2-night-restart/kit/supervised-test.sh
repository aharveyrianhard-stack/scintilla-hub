#!/bin/bash
# supervised-test.sh - the night restart, once, NOW, with Alan watching. For the coordinator to run on the Mac that shows the Station,
# after the market close. It first says what Alan should see if it works and if it does not, waits for Return, and then starts the
# small app "Scintilla Night Reload" in its test mode - the same job the 4 am timetable runs, except that it ignores the clock and
# waits for 20 quiet seconds instead of ten quiet minutes.
#
#   supervised-test.sh            say what will happen, wait for Return, then do the restart now
#   supervised-test.sh --explain  only say what Alan should see; do nothing
#   supervised-test.sh --look     look only: the job says what it sees and what it would do. Closes nothing, presses nothing.
#   supervised-test.sh --yes      do not wait for Return
#   supervised-test.sh --where    15 Oct 2026: look only - where are the Station's, X's and Brave's own windows right now, as the job
#                                 sees them (this desktop, another desktop, full screen, minimised, closed), and may the launcher
#                                 read Brave's tabs? Nothing is moved.
#   supervised-test.sh --consent  the ONE click: makes macOS ask whether "Scintilla Night Reload" may control Brave Browser. Alan
#                                 clicks Allow. After that the job reads Brave's tabs from Brave itself and can put the active tab back.
set -u
DEST="$HOME/Scintilla/night-reload"; APP="$DEST/Scintilla Night Reload.app"; LAST="$DEST/LAST-NIGHT.txt"
LOG="$HOME/Library/Logs/scintilla-night-reload.log"

explain() { cat <<'TEXT'
THE NIGHT RESTART - the supervised test (15 Oct 2026: the windows wherever they are, and Brave's own windows too)

This does now, once, what the 4 am job will do every night: it closes TradingView, the Hub and Brave one after the other,
opens each again the way it was, then reloads the Station and X and reconnects X. It takes about three to five minutes.
When it starts, take your hands off the keyboard and mouse and keep them off until the box at the end.

SET UP FIRST, so the test proves the 15 Oct change: put the Station in native full screen (the green button, or
Control+Command+F), and put X on ANOTHER desktop (Mission Control, drag it to a second desktop), and leave a Brave window of your
own open with a YouTube tab in it. Then swipe to a desktop where neither the Station nor X is showing, and start.

WHAT YOU SHOULD SEE IF IT WORKS
  1. For about 20 seconds nothing happens. It is making sure nobody is typing.
  2. The desktop switches by itself: to the one with X, then to the Station's full-screen desktop, as the job finds each window
     wherever it is. The log line for each says where it was ("on another desktop", "in native full screen"). It then checks it
     can reach both before it closes anything.
  3. TradingView closes. A few seconds later it opens again, with the same charts.
  4. The Hub (the app called SCINTILLA) closes and opens again. It comes back on its first screen, not where you left it.
     Your lists, your stars, the company tab and the compare tab are kept.
  5. The Station and X close together, and so does your own Brave window - that is Brave closing. The Station opens again,
     then X, then your own window with the same tabs in the same order (the YouTube tab comes back as the same video; YouTube
     itself brings it back near where it was if you are signed in). The Station and X come back as ordinary windows, not full
     screen and not on another desktop.
  6. The Station reloads once more, X reloads once more, and about half a minute to two minutes later the X box in the Station
     fills again by itself. Nobody presses Option+Shift+S: the job does.
  7. The app that was in front at the start is put back in front.
  8. A box titled "Scintilla night reload - test" appears with the end of the record: it says "X confirmed working"
     and gives three lines, one for each app, with its memory before and after, then Brave's biggest parts. Click OK.
Chrome, the YouTube app and every other app stay exactly as they are.

IF IT DOES NOT WORK - what you would see, and what to do
  - Nothing happens for three minutes, then "hands were never off": somebody kept touching the Mac. Nothing was closed.
    Run it again, hands off the keyboard and mouse.
  - A box says macOS did not let "Scintilla Night Reload" look at windows: its switch is off. Nothing was closed.
    System Settings > Privacy & Security > Device Control and Data Access > switch on "Scintilla Night Reload", then run it again.
  - An app closed and did not come back: the box names it. Open it from the Dock as usual. No other app was closed after it.
  - An app did not close: the box names it. It may be asking a question (unsaved changes, for example) - answer it.
    Nothing was forced, and the app is as it was.
  - The Station and X are back but the X box stays dark: click the X window and press Option+Shift+S, as you do today.
    The box says so as well.
  - The box says the Station or X "could not be reached" and names where it was (another desktop, full screen, minimised,
    closed): the job found the window but could not bring it within reach. Say which word it used.
  - Brave was not restarted and the box says its windows "could not be read": run this script with --consent, click Allow,
    and run the test again. Nothing was lost: Brave was left as it was.
  - Your own Brave window came back without a tab, or with the wrong tab in front: say which. The tabs the job wrote down are
    in ~/Scintilla/night-reload/LAST-BRAVE-WINDOWS.txt.
  - TradingView comes back without its charts, the sound comes out of the wrong speaker, or X is on another page than
    before: say so. Each app's restart can be switched off by itself, and the rest keeps working.
Nothing needs undoing after a test: every app that was closed is open again.
To stop the nightly restart for good and keep the nightly reload:  ~/Scintilla/night-reload/rollback.sh --reload-only
TEXT
}

case "${1:-}" in
  --explain) explain; exit 0 ;;
  ""|--yes|--look|--where|--consent) ;;
  *) echo "usage: supervised-test.sh [--explain | --look | --where | --consent | --yes]"; exit 2 ;;
esac
if [ ! -d "$APP" ] || [ ! -f "$DEST/night-reload.sh" ]; then
  echo "The kit is not installed on this Mac ($DEST is missing its files). Run install.sh first."; exit 1
fi
# --where and --consent go through the launcher app, because the permissions (Accessibility, Automation) belong to that app, not to
# a Terminal. The launcher runs the job in dry-run, which looks only; --consent first asks the question that makes macOS show its dialog.
if [ "${1:-}" = "--where" ] || [ "${1:-}" = "--consent" ]; then
  if [ "${1:-}" = "--consent" ]; then
    echo "THE ONE CLICK: macOS will ask whether \"Scintilla Night Reload\" may control \"Brave Browser\". Alan clicks Allow."
    echo "Brave must be running. Nothing in Brave changes; the question only counts its windows."
    /usr/bin/open -W -a "$APP" --env SCINTILLA_NIGHT_RELOAD_ASK_CONSENT=com.brave.Browser || { echo "The small app could not be started."; exit 1; }
  fi
  echo "WHERE THE WINDOWS ARE, as the job sees them (look only; nothing is moved):"
  LOOK_FROM=0; [ -f "$LOG" ] && LOOK_FROM="$(wc -l < "$LOG" | tr -d ' ')"
  /usr/bin/open -W -a "$APP" || { echo "The small app could not be started."; exit 1; }
  [ -f "$LOG" ] && tail -n +"$(( LOOK_FROM + 1 ))" "$LOG" | sed 's/^[0-9-]* [0-9:]*  \[dry-run\] //' | grep -E "window|Brave's own|consent|desktop|full screen|minimised|closed|permission" 
  exit 0
fi

if [ "${1:-}" = "--look" ]; then
  echo "LOOK ONLY: the job says what it sees and what it would do tonight. It closes nothing and presses nothing."
  echo "A box shows the end of that; click OK on it, and all of it is printed here."
  LOOK_FROM=0; [ -f "$LOG" ] && LOOK_FROM="$(wc -l < "$LOG" | tr -d ' ')"
  /usr/bin/open -W -a "$APP" || { echo "The small app could not be started."; exit 1; }
  echo
  [ -f "$LOG" ] && tail -n +"$(( LOOK_FROM + 1 ))" "$LOG" | sed 's/^[0-9-]* [0-9:]*  \[dry-run\] //'
  exit 0
fi

explain
echo
if [ "${1:-}" != "--yes" ]; then
  printf 'Press Return to start the restart now, or Control-C to leave everything as it is: '
  read -r _ || { echo; echo "Not started."; exit 1; }
fi
BEFORE_LINES=0; [ -f "$LOG" ] && BEFORE_LINES="$(wc -l < "$LOG" | tr -d ' ')"
[ -f "$LAST" ] && mv "$LAST" "$LAST.before-test"      # the last night's lines are kept beside it, not thrown away
echo "Started $(date '+%H:%M:%S'). Hands off the keyboard and mouse now. This command waits until you click OK on the box at the end."
/usr/bin/open -W -a "$APP" --env SCINTILLA_NIGHT_RELOAD_MODE=test || { echo "The small app could not be started. Nothing was closed."; exit 1; }
echo "Ended $(date '+%H:%M:%S')."
echo
if [ ! -s "$LAST" ]; then
  echo "RESULT: NOTHING WAS DONE. The job stopped before it closed or reloaded anything. Its record:"
  [ -f "$LOG" ] && tail -n +"$(( BEFORE_LINES + 1 ))" "$LOG" | sed 's/^[0-9-]* [0-9:]*  \[test\] /  /' | tail -15
  exit 1
fi
echo "WHAT THE JOB WROTE DOWN ($LAST):"
sed 's/^/  /' "$LAST"
echo
FIRST="$(head -1 "$LAST")"
if grep -q '^For Alan:' "$LAST" || printf '%s' "$FIRST" | grep -q '^Night re'; then
  echo "RESULT: LOOK AGAIN. Something did not go as planned - the line above that begins 'For Alan:' or 'Night reload' says what, and what to do."
  exit 1
fi
case "$FIRST" in
  *"restarted:"*"X confirmed working"*)
    echo "RESULT: IT WORKED. The apps named after 'restarted:' were closed and opened again, and X is confirmed working."
    echo "Check with your own eyes: TradingView has its charts, the Hub is open, the X box in the Station is moving."
    echo "If Alan says go:  $DEST/switch-on.sh   (the first night run is at 04:00)" ;;
  *"X confirmed working"*)
    echo "RESULT: X IS WORKING, BUT NO APP WAS RESTARTED. The lines above say why for each app (not running, switched off, or not possible today)."
    exit 1 ;;
  *)
    echo "RESULT: LOOK AGAIN. The first line above is what happened; X was not confirmed working."
    exit 1 ;;
esac
