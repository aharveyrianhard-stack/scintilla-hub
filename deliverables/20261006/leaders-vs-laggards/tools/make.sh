#!/bin/sh
# LD1 · rebuild the page from the saved pieces, in order. Run from the repo root. Nothing here fetches anything.
#   sh deliverables/20261006/leaders-vs-laggards/tools/make.sh [journal.jsonl ...]
# With journal paths it first re-collects the research records; without, it uses data/ as committed.
set -e
T=deliverables/20261006/leaders-vs-laggards/tools
[ "$#" -gt 0 ] && python3 $T/collect.py "$@"
python3 $T/build.py
python3 $T/digest.py
python3 $T/opinion.py > /dev/null
python3 $T/render.py
# the BACK / CLOSE pair: the tool rewrites older pages too, so every other page it touched is put back
python3 scripts/inject-scnav.py | grep leaders-vs-laggards || true
git status --short | grep -E '^ M' | awk '{print $2}' | grep -v leaders-vs-laggards | xargs git checkout -- 2>/dev/null || true
node $T/shots.mjs
