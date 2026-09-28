#!/bin/zsh
# L2 CHART-SPEED final before/after: live (before) vs the Station branch served locally (after); the Hub is live in both.
# Interleaved so both variants see the same chart-API weather. Headless only.
cd "${0:A:h}"
ST="/Users/alanharvey/SCINTILLA 0.5/_worktrees/station-chart-speed-20260928"
OUT=../data/final; mkdir -p $OUT
J=$(mktemp -d)
for rep in ${=REPS:-1 2 3}; do
  for sc in hubrow hubearly st8; do
    for v in before after; do
      case $sc in
        hubrow)   base='"scenario":"hub","t":"MU","how":"row","openAfterMs":15000,"watchMs":20000';;
        hubearly) base='"scenario":"hub","t":"MU","how":"early","openAfterMs":0,"watchMs":20000';;
        st8)      base='"scenario":"station","stationPath":"/deck/?scene=targets3D","watchMs":20000';;
      esac
      if [ $v = before ]; then tgt='"target":"live"'; else tgt="\"target\":\"local\",\"stationRoot\":\"$ST\""; fi
      echo "{\"name\":\"$sc-$v-$rep\",$tgt,$base,\"runs\":[\"cold\",\"warm\"]}" > $J/j.json
      node speed.mjs $J/j.json > $OUT/$sc-$v-$rep.json
      echo "done $sc $v $rep $(date +%H:%M:%S)"
    done
  done
done
