#!/usr/bin/env bash
# UNIVERSE EXPANSION — 60 new names (24 gap-filling funds, 36 companies Alan named).
#
# DRY RUN IS THE DEFAULT. Nothing below writes anything until you add --confirm.
#
#   ./RUNBOOK.sh                 # print the whole plan, the request count and the timing
#   ./RUNBOOK.sh --pilot         # the same, for the 3 pilot names only
#   ./RUNBOOK.sh --confirm       # do it, batch by batch, gated on each batch's gap report
#   ./RUNBOOK.sh --pilot --confirm
#   BATCH_FROM=3 ./RUNBOOK.sh --confirm     # resume: skip the batches already done
#
# The order is the safety. A name is acquired while it is INVISIBLE (in instrument_map but not
# active, so /universe, the stream and the three count/digest pins cannot see it), and it only
# becomes visible after its own gap report passes. A half-finished run therefore leaves behind
# rows nobody can see and objects nobody reads — never a broken screen.
set -uo pipefail

CONFIRM=0; PILOT=0
for a in "$@"; do case "$a" in --confirm) CONFIRM=1;; --pilot) PILOT=1;; esac; done
BATCH_SIZE=${BATCH_SIZE:-10}
BATCH_FROM=${BATCH_FROM:-1}
MONTHS=${MONTHS:-48}                 # 48 months ≈ 200 completed weeks: what the 364 already have
CONC=${CONC:-8}                      # the concurrency the last full run used
CONC_MAX=${CONC_MAX:-8}              # pinned: the worker may NOT climb to its default 24 here
MIN_SESSIONS=${MIN_SESSIONS:-60}     # admission gate: a name with less stored history waits
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="${STATE:-$HERE/.runbook-state}"
API=${API:-https://scintilla-massive-chart-api.fly.dev}
BATCH_APP=${BATCH_APP:-scintilla-massive-stocks-batch}
STREAM_APP=${STREAM_APP:-scintilla-massive-stocks-stream}
STREAM_MACHINE=${STREAM_MACHINE:-8e7eedf7719698}
PROVIDER_DIR=${PROVIDER_DIR:-/app}   # inside the batch machine

say () { printf '%s\n' "$*"; }
hd  () { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
run () {  # every mutating command goes through here
  if [ "$CONFIRM" = 1 ]; then say "+ $*"; eval "$@"; return $?
  else say "  [dry-run] $*"; return 0; fi
}
ssh_batch () { run "flyctl ssh console -a $BATCH_APP -C \"bash -lc 'cd $PROVIDER_DIR && $1'\""; }
mark () { [ "$CONFIRM" = 1 ] && echo "$1" >> "$STATE"; return 0; }
done_already () { [ -f "$STATE" ] && grep -qx "$1" "$STATE"; }

# ---------------------------------------------------------------- the names --
NAMES_JSON="$HERE/names.json"
[ -f "$NAMES_JSON" ] || { say "FATAL: names.json is missing next to this script"; exit 2; }
read_names () { python3 -c "
import json,sys
d=json.load(open('$NAMES_JSON'))
tier=[x['ticker'] for x in d['tier1']]+[x['ticker'] for x in d['tier2']]
print(' '.join(tier))"; }
PILOT_NAMES="KRE COHR AAOI"     # one tier-1 fund, one larger company, one small company
if [ "$PILOT" = 1 ]; then ALL_NAMES="$PILOT_NAMES"; else ALL_NAMES="$(read_names)"; fi
# shellcheck disable=SC2206
NAMES=($ALL_NAMES)
TOTAL=${#NAMES[@]}

hd "WHAT THIS WILL DO"
say "names:            $TOTAL   (batches of $BATCH_SIZE, starting at batch $BATCH_FROM)"
say "history per name: $MONTHS months of 1-minute bars from Massive, plus the routine chart timeframes"
say "mode:             $([ "$CONFIRM" = 1 ] && echo 'CONFIRM — this writes' || echo 'DRY RUN — nothing is written')"
say "admission gate:   at least $MIN_SESSIONS stored sessions and ZERO unexplained missing sessions"
say ""
say "request budget (provider GETs, the number that matters for the bill and the rate limit):"
say "  1-minute history:  $TOTAL names x $MONTHS months  = $((TOTAL*MONTHS)) requests (+1 extra page for a very"
say "                     busy month; the worker follows next_url to exhaustion)"
say "  chart timeframes:  $TOTAL names x 24 routine labels = $((TOTAL*24)) requests"
say "  daily before 2003: $TOTAL names x 1-2 requests from FMP (5000-row page cap)"
say "  total:             about $((TOTAL*MONTHS + TOTAL*24 + TOTAL*2)) provider requests"
say "expected wall clock at CONC=$CONC, two shards: about $(( (TOTAL*MONTHS*3) / (CONC*2) / 60 + 1 )) minutes of pulling"
say "  (measured basis: one symbol-month is one request plus its R2 writes, ~3s each), plus about a"
say "  minute per batch for the gap report. Nothing here needs the market to be open."

hd "STEP 0 — PREFLIGHT (read-only)"
ET_H=$(TZ=America/New_York date +%H%M)
say "New York clock: $ET_H"
if [ "$ET_H" -ge 0925 ] && [ "$ET_H" -le 1615 ]; then
  say "REFUSING: the market is open. Acquisition competes with the live tail and with the stream's"
  say "serving thread — that is how a past pull made /ready and /quotes time out while ingestion was fine."
  [ "$CONFIRM" = 1 ] && exit 1
fi
if [ "$ET_H" -ge 1825 ] && [ "$ET_H" -le 2035 ]; then
  say "REFUSING: this is the settled-close window (the 18:30 ET gate). Wait for it to finish."
  [ "$CONFIRM" = 1 ] && exit 1
fi
say "before-state, read live:"
curl -fsS -m 20 -H 'Origin: https://scintillahub.ai' "$API/universe" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('  /universe count=%s sha256=%s'%(d['count'],d['universe_sha256']))" \
  || say "  /universe unreadable — stop and find out why before writing anything"
say "  Geiger readiness — it must be READY BEFORE you start, or you will not be able to tell your"
say "  new names' effect from a failure that was already there:"
GEIGER=$(curl -sS -m 20 -H 'Origin: https://scintillahub.ai' "$API/ready" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print('UNREADABLE'); raise SystemExit
g=d.get('geiger_readiness') or {}
print('%s issues=%s reasons=%s'%('READY' if g.get('geiger_ready') else 'NOT_READY',
  g.get('issue_count'), ','.join(sorted((g.get('issue_counts') or {}).keys()))))" 2>/dev/null)
say "   $GEIGER"
case "$GEIGER" in READY*) : ;; *)
  say "   REFUSING to start: Geiger is not ready yet. Every cell it checks is one name on one"
  say "   timeframe, so 60 new names add 480 more cells to a check that is already failing."
  say "   Get it green first, then come back. (Set FORCE=1 only if the coordinator decided to"
  say "   proceed knowing the readiness number will stay red.)"
  [ "$CONFIRM" = 1 ] && [ "${FORCE:-0}" != 1 ] && exit 1;; esac
say ""
say "  IN-FLIGHT CHECK — two acquisitions must never run at once:"
ssh_batch "psql \$MASSIVE_DATABASE_URL -c \"select run_tag, scope, status, heartbeat_utc from massive_control.rest_accel_run where status='running'\""

hd "STEP 1 — MIGRATION (additive, reversible)"
say "  file: migrations/0020_instrument_map_admit_state.sql   (provider repo, branch expansion/universe-expand-20260924)"
ssh_batch "psql \$MASSIVE_DATABASE_URL -f migrations/0020_instrument_map_admit_state.sql"
say "  rollback: psql -f migrations/0020_instrument_map_admit_state.rollback.sql"

# ------------------------------------------------------------------ batches --
BATCH=0
for ((i=0; i<TOTAL; i+=BATCH_SIZE)); do
  BATCH=$((BATCH+1))
  [ "$BATCH" -lt "$BATCH_FROM" ] && continue
  CHUNK=("${NAMES[@]:i:BATCH_SIZE}")
  LIST=$(IFS=,; echo "${CHUNK[*]}")
  TAG="EXPAND20260924_B${BATCH}"
  if done_already "batch:$BATCH"; then hd "BATCH $BATCH — already done, skipping"; continue; fi

  hd "BATCH $BATCH of $(( (TOTAL+BATCH_SIZE-1)/BATCH_SIZE )) — $LIST"

  say "-- 2. the names enter the map, switched OFF. Nothing on Alan's screen can see them yet."
  for s in "${CHUNK[@]}"; do
    ssh_batch "psql \$MASSIVE_DATABASE_URL -c \\\"insert into massive_stocks.instrument_map (station_symbol, massive_symbol, active, admit_state) values ('$s','$s',false,'PENDING') on conflict (station_symbol) do nothing\\\""
  done
  say "   rollback for this batch: delete from massive_stocks.instrument_map where admit_state='PENDING' and station_symbol in ($(printf "'%s'," "${CHUNK[@]}" | sed 's/,$//'));"

  say ""
  say "-- 3. pull $MONTHS months of 1-minute history. Resumable: a proven symbol-month is skipped,"
  say "      so re-running after a kill costs nothing and cannot duplicate a write."
  ssh_batch "UNIVERSE_MODE=EXPANSION_PENDING SHARD=0 SHARDS=2 MONTHS=$MONTHS CONC=$CONC CONC_MAX=$CONC_MAX RUN_TAG=$TAG node services/rest-accel/priority-shard-worker.mjs"
  ssh_batch "UNIVERSE_MODE=EXPANSION_PENDING SHARD=1 SHARDS=2 MONTHS=$MONTHS CONC=$CONC CONC_MAX=$CONC_MAX RUN_TAG=$TAG node services/rest-accel/priority-shard-worker.mjs"

  say ""
  say "-- 4. prewarm the timeframes the charts and the Geiger actually read (per-symbol objects)."
  ssh_batch "ONLY=$LIST SHARD=0 SHARDS=1 WEEKS=200 CONC=6 node services/rest-accel/provider-bars-worker.mjs"

  say ""
  say "-- 5. THE GATE: the per-name gap report. Exit 3 means at least one name is on HOLD."
  ssh_batch "SYMBOLS=$LIST MIN_SESSIONS=$MIN_SESSIONS node scripts/expansion-gap-report.mjs | tee /tmp/gap-$TAG.json"
  GAP_EXIT=$?
  if [ "$CONFIRM" = 1 ]; then
    if [ "$GAP_EXIT" != 0 ]; then
      say ""
      say "STOPPING at batch $BATCH. The gap report put at least one name on HOLD."
      say "Read /tmp/gap-$TAG.json: each held name lists its reasons in plain words."
      say "Nothing was switched on, so nothing on Alan's screen changed. Fix or drop the name,"
      say "then resume with:  BATCH_FROM=$BATCH ./RUNBOOK.sh --confirm"
      exit 3
    fi
  fi

  say ""
  say "-- 6. admit only the names that passed. This is the first step Alan can see."
  for s in "${CHUNK[@]}"; do
    ssh_batch "REPORT=/tmp/gap-$TAG.json SYMBOL=$s node scripts/expansion-admit.mjs --confirm"
  done
  say "   rollback for this batch (removes them from the screen again, keeps every object):"
  say "     update massive_stocks.instrument_map set active=false, admit_state='PENDING' where station_symbol in (...);"
  say "     and delete the membership objects normalized/massive_provider_bars_v1/_manifest/<SYM>.json"
  mark "batch:$BATCH"
done

hd "STEP 7 — RE-PIN THE THREE PLACES THAT COUNT THE UNIVERSE"
say "Read the truth from the provider FIRST — never type a count or a digest from memory:"
say "  curl -s -H 'Origin: https://scintillahub.ai' $API/universe | python3 -c \"import json,sys;d=json.load(sys.stdin);print(d['count'], d['universe_sha256'])\""
say "Then change exactly one line in each place:"
say "  1. Hub      index.html            SC_EXPECTED_EQUITY_COUNT / SC_EQUITY_UNIVERSE_DIGEST"
say "  2. Station  _provider/provider.js EXPECTED_EQUITY_UNIVERSE / ACCEPTED_UNIVERSE_SHA256"
say "  3. chart API machine env          SETTLED_EXPECTED_COUNT / SETTLED_UNIVERSE_DIGEST"
say "     flyctl secrets/env set on scintilla-massive-chart-api, then restart both machines."
say "Until all three agree, the Station throws its coherence check and quotes readiness reports a"
say "digest mismatch. Do them together, in one window."

hd "STEP 8 — THE LIVE STREAM"
say "The stream subscribes from instrument_map at boot, so the new names join at its next restart:"
run "flyctl machines restart $STREAM_MACHINE -a $STREAM_APP"
say "NOTE, measured 2026-09-20: that machine runs with BARS_1M_ENABLED=0, so it writes trades but"
say "no 1-minute bars. Restarting it does not by itself give the new names live bars — raise that"
say "with the coordinator separately; it is not part of this expansion."

hd "STEP 9 — FAVOURITES for the Claude Check names (additive)"
say "  insert into public.hub_favorites (owner_id, ticker) select '00000000-0000-0000-0000-000000000000', t"
say "  from unnest(array['AAOI','COHR','PL','LUNR','RDW','UUUU','TSEM','AMKR','NVTS','ACHR']) t"
say "  on conflict do nothing;   -- the 34 Claude Check names; see names.json for the full list"
say "  rollback: delete from public.hub_favorites where owner_id='00000000-0000-0000-0000-000000000000' and ticker in (...);"

hd "STEP 10 — VERIFY, WITH YOUR EYES AND WITH THE API"
say "  curl -s -H 'Origin: https://scintillahub.ai' $API/universe   # count = 364 + admitted names"
say "  curl -s -H 'Origin: https://scintillahub.ai' $API/ready      # geiger_ready true, issue_count 0"
say "  open the Hub: the new names have a price, a Geiger and a cohort; the old 364 are unchanged"
say "  if /ready is 503 with SOURCE_NOT_REQUESTED_THROUGH_COMPLETED_SESSION for a new name, that name"
say "  was admitted too early — set it back to PENDING and let the next acquisition finish."

hd "IF YOU NEED TO STOP EVERYTHING"
say "  flyctl machines stop \$(flyctl machines list -a $BATCH_APP --json | python3 -c \"import json,sys;print(json.load(sys.stdin)[0]['id'])\") -a $BATCH_APP"
say "  Stopping mid-batch is safe: PENDING names are invisible, and every worker skips proven work"
say "  when it restarts. Never delete an R2 object to 'clean up' — the evidence is what makes the"
say "  next attempt cheap."
