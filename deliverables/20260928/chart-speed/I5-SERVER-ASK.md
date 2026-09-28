# For the I5 lane / coordinator — chart API server change that would help most (L2 CHART-SPEED, 28 Sep)

Not deployed, not touched: `scintilla-massive-chart-api` (image `fcal-2b7e953`, machine `844549b24e02e8`). Everything below was
measured read-only from this MacBook with `curl` and a headless browser, 28 Sep 2026 ~16:10–17:30Z.

## 1. The finding: a Geiger read freezes every other request on the chart API

| request | alone | while `/geiger` is being answered |
|---|---|---|
| `GET /universe` (2 KB) | 0.108 / 0.115 / 0.114 s | 2.11 s, 2.10 s; in a later triple 2.19 s, 4.97 s / 4.16 s / 3.36 s (a 5.1 s `/geiger`) |
| `GET /candles?symbol=MU&tf=D&limit=240` | 0.20–0.46 s | 2.41 s (finished the same moment `/geiger` did) |

- `/geiger` (the whole universe, ~10 KB) itself took 2.16, 2.40, 2.33, 5.11, 2.89 s.
- `/geiger?symbols=MU` took 2.5–2.6 s and **sometimes** froze others too (`/universe` 2.64 s and 2.98 s, finishing with it);
  `/geiger?symbols=MU&detail=1` 2.56 s.
- `/quotes` for 8 or 200 symbols did **not** freeze `/universe` (0.12 s during a 2.2 s quotes read).
- `/health` took 13.9 s and 17.3 s; `/universe` sent 1 s into it took 1.6 s (so its probe blocks too, briefly). No client calls `/health`.
- The signature in the browser: requests that start while a Geiger read is in flight all *end within milliseconds of it*
  (e.g. Station TARGETS cold: five 3D price reads 531–562 ms → 3,631–3,672 ms, `/geiger` 484 → 3,460 ms; Hub MU company view,
  cold: the ribbon and ten RSI-fan reads 288 ms → 6.3–9.2 s while `/geiger?symbols=MU` ran 238 → 6,209 ms).

Reading: a large synchronous step on the Node event loop inside the Geiger route (most likely re-reading / JSON-parsing /
hashing or validating the Equalizer artifact on every call). Counters at 16:10Z: `requests 59,923 · hits 31,285 · misses 62,238`.

## 2. The ask, in order of payoff

1. **Take the Geiger route off the event loop.** Keep the parsed, validated artifact in memory, keyed by its
   `artifact_computed_utc` / receipt sha, and rebuild it only when that changes (it is republished every ~5 min). Per-symbol and
   `detail=1` answers are then a map lookup + a small `JSON.stringify`. If a rebuild must parse a big object, do it in a
   `worker_thread` and keep serving the previous one until the new one is ready. Target: `/geiger` < 150 ms and no effect on other
   routes (re-run the table above; `/universe` during `/geiger` should stay ~0.11 s).
2. **Same for `/health`**: serve the last probe result and refresh it in the background, never inline.
3. **A batch sparkline route.** The Hub's board asks `/candles?symbol=X&tf=240&limit=13` once per row — measured 75–150 separate
   requests in the first 2 s of a Hub load, finishing 0.1–2.2 s. One `GET /sparklines?tf=240&limit=13&symbols=A,B,…` (answered from
   the same cache) would turn that into one request. The Hub change to use it is small and is not in this branch.
4. **Cache misses on derived intraday widths.** Cold RSI-fan reads of `tf=180` (3H) and `tf=6h` took 4.4 s time-to-first-byte in one
   run while `tf=240` took 0.6 s; the 1,200-entry cache held 1,021. Worth checking whether 3H/6H/8H/12H are rebuilt from 1-minute or
   1-hour bars on every miss, and whether the cache should be larger (each entry is small: 15–57 KB of JSON).

## 3. How to check it after a deploy (read-only)

```sh
A=https://scintilla-massive-chart-api.fly.dev; H="Origin: https://scintillahub.ai"
( curl -s -o /dev/null -H "$H" -w "geiger %{time_total}\n" $A/geiger & sleep 0.15; \
  curl -s -o /dev/null -H "$H" -w "universe during geiger %{time_total}\n" $A/universe & wait )
```
and the headless harness in this folder: `node tools/speed.mjs job.json` (see `tools/final.sh`).
