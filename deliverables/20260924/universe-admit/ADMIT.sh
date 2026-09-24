#!/usr/bin/env bash
# UNIVERSE ADMISSION — make the 60 expansion names visible everywhere at once.
#
# This supersedes step 6 onwards of ../universe-expand/RUNBOOK.sh. That runbook assumed three places
# count the universe. TEN do, and they do not fail the same way:
#
#   1 control/CANONICAL_EQUITY_UNIVERSE_20260820.json   the chart API imports it AT BUILD
#   2 provider-tail-refresh-universe.mjs constants      asserted at MODULE SCOPE -> stale = no boot
#   3 services/hot-query/boot-geiger.sh                 exits the boot on mismatch -> Geiger down
#   4 services/chart-api/fly.toml + machine env         settled identity + Geiger expected count
#   5 settled-close supervisor's universe file          stamps the previous-close artifact
#   6 provider-tail-refresh / full-rebuild UNIVERSE_FILE what acquisition walks
#   7 Hub index.html SC_EXPECTED_EQUITY_COUNT/DIGEST    SC_RANK_READY needs both
#   8 Hub SC_FMP_REFERENCE_DIGESTS                      must KEEP the old digest as well
#   9 Station EXPECTED_EQUITY_UNIVERSE/ACCEPTED_SHA256  + its own FMP reference list
#  10 supabase/functions/chat accepted identities       the desk agent's own contract
#
# DRY RUN IS THE DEFAULT. Nothing writes, deploys or restarts until you add --confirm.
#
#   ./ADMIT.sh                      # print the plan, the order, the checks and every rollback
#   ./ADMIT.sh --confirm            # do it
#   STEP_FROM=4 ./ADMIT.sh --confirm  # resume at a step
#   ./ADMIT.sh --rollback --confirm # take the names back off the screen, keep every object
#
# THE ORDER IS THE SAFETY, and it is not the order you would guess. Admitting names first is safe
# (nothing shows them yet). Restarting the Geiger before every name is active is NOT: boot-geiger
# rebuilds the universe from instrument_map and exits on a count mismatch, so a half-admitted set
# takes the Geiger down for all 424 names.
set -uo pipefail

CONFIRM=0; ROLLBACK=0
for a in "$@"; do case "$a" in --confirm) CONFIRM=1;; --rollback) ROLLBACK=1;; esac; done
STEP_FROM=${STEP_FROM:-0}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT=${REPORT:-$HOME/AlanOS/Operating\ System/workspaces/scintilla/handoffs/expansion-gap-20260924.json}
PROVIDER_REPO=${PROVIDER_REPO:-$HOME/SCINTILLA\ 0.5/_worktrees/universe-admit-20260924}
API=${API:-https://scintilla-massive-chart-api.fly.dev}
ORIGIN=${ORIGIN:-https://scintillahub.ai}
CHART_APP=${CHART_APP:-scintilla-massive-chart-api}
BATCH_APP=${BATCH_APP:-scintilla-massive-stocks-batch}
STREAM_APP=${STREAM_APP:-scintilla-massive-stocks-stream}
STREAM_MACHINE=${STREAM_MACHINE:-8e7eedf7719698}
GEIGER_MACHINE=${GEIGER_MACHINE:-820229b7795798}          # SERVICE=geiger-runner: boot-geiger + settled supervisor
CHART_MACHINES=${CHART_MACHINES:-"811d65df4e6e08 844549b24e02e8"}
# The images running BEFORE this admission, read 2026-09-24 01:5xZ. These are the rollback targets.
CHART_IMAGE_BEFORE=${CHART_IMAGE_BEFORE:-registry.fly.io/scintilla-massive-chart-api:putcall-parts-3057e57}
BATCH_IMAGE_BEFORE=${BATCH_IMAGE_BEFORE:-registry.fly.io/scintilla-massive-stocks-batch:geiger-maintenance}
OLD_COUNT=364
OLD_DIGEST=ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3

say () { printf '%s\n' "$*"; }
hd  () { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }
run () { if [ "$CONFIRM" = 1 ]; then say "+ $*"; eval "$@"; return $?; else say "  [dry-run] $*"; return 0; fi; }
skip() { [ "$1" -lt "$STEP_FROM" ]; }
api () { curl -fsS -H "Origin: $ORIGIN" "$API$1"; }

read_names () { python3 -c "
import json;d=json.load(open('$HERE/../universe-expand/names.json'))
print(' '.join([x['ticker'] for x in d['tier1']]+[x['ticker'] for x in d['tier2']]))"; }

# ---------------------------------------------------------------------------- rollback, whole-run --
if [ "$ROLLBACK" = 1 ]; then
  hd "ROLLBACK — every step, in reverse. No object, bar, receipt or report is destroyed."
  say "1. take the names off the screen (map row inactive + membership object removed):"
  for s in $(read_names); do
    run "flyctl ssh console -a $BATCH_APP -C \"bash -lc 'cd /app && SYMBOL=$s node scripts/expansion-admit.mjs --rollback --confirm'\""
  done
  say "2. put the pins back (all ten, together — the same rule as forwards):"
  note "chart API:  flyctl deploy -a $CHART_APP --image $CHART_IMAGE_BEFORE"
  note "batch app:  flyctl deploy -a $BATCH_APP --image $BATCH_IMAGE_BEFORE   # restores boot-geiger's $OLD_COUNT pin"
  note "chart env:  flyctl secrets set SETTLED_EXPECTED_COUNT=$OLD_COUNT SETTLED_UNIVERSE_DIGEST=$OLD_DIGEST GEIGER_EXPECTED_COUNT=$OLD_COUNT -a $CHART_APP"
  note "Hub:        revert hub/universe-admit-20260924 and redeploy; Station: revert station/universe-admit-20260924"
  say "3. database (only the rows the migration added):"
  note "psql -f supabase/migrations/20260924_universe_admit_membership_ROLLBACK.sql"
  say "4. within one supervisor tick (<=15 min) the settled artifact for the current session is"
  say "   republished under the $OLD_COUNT identity, and the day-change column returns."
  say ""
  say "WHAT ROLLBACK DOES NOT DO: it does not delete a single acquired bar, receipt or gap report."
  say "A rolled-back name is hidden and re-admittable, and the next attempt costs no provider calls."
  exit 0
fi

hd "WHEN TO RUN THIS — Thursday 24 Sep, 16:15 to 18:25 ET, and why those two times"
say "16:15 ET  the daily bar for today is closed and the gap reports are final. Before this, a report"
say "          can still change under you."
say "18:25 ET  the LAST safe minute. At 18:30 ET (GEIGER_COMPLETED_SESSION_AFTER_ET) the session the"
say "          Geiger requires moves from Wednesday 23 Sep to Thursday 24 Sep. The new names have"
say "          history through Wednesday, so inside the window their rungs are already complete."
say "          After 18:30 every one of the 424 names needs Thursday's session in all 8 rungs, and the"
say "          hourly tail machine has not started since 2026-09-10 — so crossing 18:30 without a tail"
say "          run turns /ready into a 503 and the Geiger into 'awaiting data' for EVERY name."
say ""
say "THE ONE THING THAT DECIDES FRIDAY MORNING: the settled previous-close artifact for Friday's"
say "session is built by the supervisor inside machine $GEIGER_MACHINE, from the canonical file baked"
say "into THAT image, and it is stamped with that file's digest. So the batch app must be deployed"
say "(step 3) before Friday's artifact is built, or Friday opens with an artifact the chart API"
say "refuses and a blank day-change column for all 424 names."

# ------------------------------------------------------------------------------------- step 0 --
if ! skip 0; then
hd "STEP 0 — PREFLIGHT (read-only, changes nothing)"
say "  the gap report, and that every name in it passed:"
run "python3 -c \"
import json,sys
r=json.load(open('$REPORT'))
rows=r.get('symbols',[])
held=[x['symbol'] for x in rows if not x.get('pass')]
print('report built', r.get('built_utc'), '| names', len(rows), '| PASS', len(rows)-len(held))
print('HELD:', held or 'none')
sys.exit(1 if held else 0)\""
note "a HELD name is not a blocker for the others: admit the rest, leave it hidden, fix it later."
say "  the universe as served right now (never type these from memory):"
run "api /universe | python3 -c \"import json,sys;d=json.load(sys.stdin);print('now', d['count'], d['universe_sha256'])\""
say "  nothing in flight that writes bars, on either app:"
run "flyctl machines list -a $BATCH_APP | grep -E 'provider-tail|started' || true"
say "  the machines this admission touches, and the images to roll back to:"
run "flyctl machines list -a $CHART_APP"
run "flyctl machines list -a $BATCH_APP | grep -E '$GEIGER_MACHINE|bar-service'"
fi

# ------------------------------------------------------------------------------------- step 1 --
if ! skip 1; then
hd "STEP 1 — DERIVE the new canonical file and every in-repo pin (local, no writes to anything live)"
run "cd '$PROVIDER_REPO' && node scripts/build-canonical-universe.mjs --report '$REPORT' --write"
say "  then prove the ten places agree, offline, before anything is deployed:"
run "cd '$PROVIDER_REPO' && node --test tests/universe-admit-pins.test.mjs"
note "if the count or digest differs from the committed branch, the gap report held a name back."
note "that is fine: commit the rebuilt file and pins, then continue. Never hand-edit either."
say "  ROLLBACK: git checkout the branch's committed state. Nothing live has changed yet."
fi

# ------------------------------------------------------------------------------------- step 2 --
if ! skip 2; then
hd "STEP 2 — ADMIT THE NAMES (map row active + membership object). Still invisible to Alan."
say "  the report has to be INSIDE the machine, and it has to be the same one preflight read:"
run "flyctl ssh console -a $BATCH_APP -C \"bash -lc 'cd /app && node scripts/expansion-gap-report.mjs > /tmp/gap-admit.json && python3 -c \\\"import json;d=json.load(open(\\\\\\\"/tmp/gap-admit.json\\\\\\\"));print(d[\\\\\\\"built_utc\\\\\\\"], len(d[\\\\\\\"symbols\\\\\\\"]))\\\"'\""
note "compare that built_utc with the coordinator's copy at the handoff path. If they differ, read the"
note "machine's copy before admitting anything: the report on the machine is the one admission obeys."
say "  one name at a time, each refused unless its own report says PASS:"
for s in $(read_names); do
  run "flyctl ssh console -a $BATCH_APP -C \"bash -lc 'cd /app && REPORT=/tmp/gap-admit.json SYMBOL=$s node scripts/expansion-admit.mjs --confirm'\""
done
say "  CHECK, and it must be exact before step 3 — the Geiger boot dies on a mismatch:"
run "flyctl ssh console -a $BATCH_APP -C \"bash -lc 'cd /app && node scripts/expansion-sql.mjs hidden'\""
note "expect: the hidden set is now EMPTY (every name admitted), or exactly the names the report held."
note "each admit prints state=ADMITTED_NOW or ALREADY_ADMITTED and exits 0. Any other state exits 5:"
note "ABSENT_FROM_MAP means a typo, SHELVED means it was withdrawn, STILL_HIDDEN means the update"
note "matched nothing. None of those are live, and none of them are safe to ignore."
say "  ROLLBACK (per name, keeps every object):"
note "SYMBOL=<SYM> node scripts/expansion-admit.mjs --rollback --confirm"
fi

# ------------------------------------------------------------------------------------- step 3 --
if ! skip 3; then
hd "STEP 3 — DEPLOY THE BATCH APP: the canonical file, boot-geiger's pins, the settled universe"
say "  this is the deploy that moves places 1, 2, 5 and 6 at once, because they are all files in"
say "  that image. Deploying restarts $GEIGER_MACHINE, which re-runs boot-geiger."
run "cd '$PROVIDER_REPO' && flyctl deploy -a $BATCH_APP --build-arg CODE_COMMIT=\$(git rev-parse HEAD)"
say "  CHECK: the boot must print the new identity, or the Geiger never starts:"
run "flyctl logs -a $BATCH_APP -i $GEIGER_MACHINE | grep -m1 geiger_universe_rebuilt"
note "expect tickers = the new count and digest = the new digest. 'geiger universe identity mismatch'"
note "means step 2 is incomplete: finish admitting, then restart the machine. Do not edit the pin."
say "  CHECK: the settled supervisor came back up beside it:"
run "flyctl ssh console -a $BATCH_APP -C 'tail -3 /tmp/settled_close_supervisor.log'"
say "  ROLLBACK: flyctl deploy -a $BATCH_APP --image $BATCH_IMAGE_BEFORE"
fi

# ------------------------------------------------------------------------------------- step 4 --
if ! skip 4; then
hd "STEP 4 — DEPLOY THE CHART API (its /universe is the file baked into the image, not the database)"
run "cd '$PROVIDER_REPO' && flyctl deploy -a $CHART_APP --config services/chart-api/fly.toml --build-arg GIT_COMMIT=\$(git rev-parse HEAD)"
note "fly.toml carries SETTLED_EXPECTED_COUNT, SETTLED_UNIVERSE_DIGEST and, new in this release,"
note "GEIGER_EXPECTED_COUNT — which was absent from the manifest and from both machines, so the code"
note "default silently decided whether /ready could ever be green."
say "  CHECK BOTH MACHINES. They alternate, and one has done every on-demand refresh so far:"
for m in $CHART_MACHINES; do
  run "api /universe | python3 -c \"import json,sys;d=json.load(sys.stdin);print(d['count'], d['universe_sha256'], d['identity']['git_commit'][:8])\""
done
note "repeat until both machine ids have answered with the new count AND the new digest."
say "  ROLLBACK: flyctl deploy -a $CHART_APP --image $CHART_IMAGE_BEFORE"
fi

# ------------------------------------------------------------------------------------- step 5 --
if ! skip 5; then
hd "STEP 5 — THE DAY-CHANGE COLUMN: the settled artifact must be re-stamped for TODAY's session"
say "  today's artifact was built under the old identity, so from step 4 the reader refuses it and"
say "  every percentage goes blank until it is republished. The supervisor does that BY ITSELF within"
say "  one tick (<=15 minutes): its readiness probe compares the artifact's digest with the canonical"
say "  file's, sees a mismatch, and rebuilds for the current ET day."
say "  CHECK (wait for it, do not skip ahead):"
run "api /ready | python3 -c \"
import json,sys
d=json.load(sys.stdin)
print('denominator_ready', d.get('denominator_ready'))
print('settled', json.dumps(d.get('settled_overlay'))[:300])
print('quotes', json.dumps(d.get('quotes_readiness',{}).get('per_session'))[:300])\""
note "expect denominator_ready true and universe_identity MATCH for today's session."
note "IF IT DOES NOT COME BACK: a new name has no daily close for the prior session AND no named"
note "absence, which is the only way the candidate refuses promotion. Read the supervisor log; the"
note "fix is to roll that one name back (step 2's rollback) and let the rest stand."
say "  MANUAL PATH, only if the supervisor is not running:"
note "node services/stocks-ops/settled-close-one-shot.mjs <prior session ET>   # builds the candidate"
note "then settled-close-promote.mjs with SETTLED_VALID_FOR_ET=<today ET> and the expected sha256."
say "  ROLLBACK: reverting step 4 restores the old expectation; the artifact itself is per-session and"
say "  immutable, so nothing has to be deleted."
fi

# ------------------------------------------------------------------------------------- step 6 --
if ! skip 6; then
hd "STEP 6 — THE GEIGER over the new universe"
run "api /ready | python3 -c \"
import json,sys
d=json.load(sys.stdin); g=d.get('geiger_readiness',{})
print('geiger_ready', g.get('ready'), '| expected', g.get('expected_universe_count'), '| observed', g.get('observed_universe_count'))
print('issues', json.dumps(g.get('issue_counts'))[:300])\""
run "api /geiger | python3 -c \"
import json,sys
d=json.load(sys.stdin)
print('symbols', len(d.get('symbols',{})), '| blocking', d.get('verification',{}).get('blocking_issue_count'))\""
note "expect blocking_issue_count 0 and symbols = the new count."
note "SOURCE_NOT_REQUESTED_THROUGH_COMPLETED_SESSION for a NEW name means it was admitted before its"
note "acquisition finished: roll that name back, let the tail finish, admit it in the next window."
note "The SAME issue for an OLD name means the tail has not run for the current session — that is the"
note "dead hourly machine, not this admission, and it is the coordinator's separate blocker."
say "  ROLLBACK: steps 3 and 4's image rollbacks restore the old expected count."
fi

# ------------------------------------------------------------------------------------- step 7 --
if ! skip 7; then
hd "STEP 7 — HUB and STATION (places 7, 8, 9, 10)"
note "merge hub/universe-admit-20260924 and station/universe-admit-20260924, then deploy from GitHub."
note "the Hub keeps the OLD digest accepted for FMP reference rows (SC_FMP_REFERENCE_DIGESTS) and so"
note "does the Station: every FMP indicator row in the table today carries the old identity, and"
note "dropping it would blank the RSI column for the 364 names that already worked."
note "the chat edge function's accepted-identity list moves with them (supabase/functions/chat)."
say "  CHECK, headless only — never open a browser in front of Alan:"
note "node tests/tools/headless-load.mjs https://scintillahub.ai   # or the lane's usual harness"
note "expect: SC_RANK_READY true, the board ranks, the new names have a price and a Geiger,"
note "and the Station's indicator panel does not throw 'snapshot incoherent'."
say "  ROLLBACK: revert the two branches and redeploy. Each is one line of pins."
fi

# ------------------------------------------------------------------------------------- step 8 --
if ! skip 8; then
hd "STEP 8 — WHERE THE NEW NAMES BELONG (cohorts) and WHICH ONES ALAN STARTS ON (favourites)"
run "psql \"\$SUPABASE_DB_URL\" -f '$HERE/../../../supabase/migrations/20260924_universe_admit_membership.sql'"
note "60 membership rows + 34 Claude Check favourites, all guarded by NOT EXISTS, so re-running is safe."
note "the 24 funds carry SECTOR_AND_THEME_FUNDS, which the Hub does not declare as a tab: they show on"
note "ALL, in search and on their own page, but get no cohort tab until Alan asks for one."
say "  ROLLBACK: psql -f supabase/migrations/20260924_universe_admit_membership_ROLLBACK.sql"
fi

# ------------------------------------------------------------------------------------- step 9 --
if ! skip 9; then
hd "STEP 9 — THE LIVE STREAM (it subscribes from instrument_map at boot)"
run "flyctl machines restart $STREAM_MACHINE -a $STREAM_APP"
note "MEASURED 2026-09-20 and still true: this machine runs with BARS_1M_ENABLED=0, so it writes"
note "trades and NO 1-minute bars. Restarting it does not give the new names live bars. That is a"
note "separate blocker and it is not fixed by this admission."
say "  ROLLBACK: restart it again; it reads whatever instrument_map says at that moment."
fi

# ------------------------------------------------------------------------------------ step 10 --
if ! skip 10; then
hd "STEP 10 — WHAT ALAN SHOULD SEE ON FRIDAY MORNING (check it before you go to bed)"
run "api /universe | python3 -c \"import json,sys;d=json.load(sys.stdin);print('universe', d['count'], d['universe_sha256'])\""
run "api /ready | python3 -c \"
import json,sys
d=json.load(sys.stdin)
print('ready', d.get('ready'), '| geiger', d.get('geiger_ready'), '| denominator', d.get('denominator_ready'))\""
say "  and by eye, headless: the board ranks, the old 364 are unchanged, the 60 new names have a"
say "  price, a day change, a Geiger and a cohort or ALL placement, and the 34 Claude Check names are"
say "  starred on the FAV tab, which is the tab the board opens on."
fi

hd "IF ANYTHING IS WRONG AND YOU NEED TO STOP"
say "  ./ADMIT.sh --rollback --confirm     # names off the screen, every object kept"
say "  then the two image rollbacks above. Stopping half-way is safe in only one direction: names may"
say "  be admitted with the pins still old (nothing shows them), never pins moved with names missing."
