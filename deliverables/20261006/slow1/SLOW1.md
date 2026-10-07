# SLOW1 — why the Hub and Station feel slow, measured in a browser (6 Oct 2026)

Alan, 6 Oct ~11:10 ET: "it's being very slow on the iMac, all of my shit … very, very slow. Station and Scintilla.
I get the loading button a million times … it's taking forever, this reload."

**Nothing here is live.** Two branches hold the prototypes: `hub/slow1-20261006` and `station/slow1-20261006`.

## What was done

Headless Chrome on the MacBook (never a visible window, never the iMac). Each page was opened on the live site and
left alone for 15 minutes, sampled every minute, at normal speed (1×) and with the processor slowed four times (4×)
to stand in for an older machine. Four views: the Hub's default tab, the Hub's cohort board in full screen, the
Station's default page, and the Station's sector page of 16 charts (its busiest). Every request that was not a plain
read was blocked and counted. All eight ran at the same time, so the quotes service was serving eight pages at once.

## The short answer

1. **The Hub was busy all the time doing nothing.** One small effect — the soft glow on an RSI number at an extreme —
   made the whole page re-measure and repaint itself 60 times a second for as long as it was open. That alone kept the
   Hub's main thread 16–18% busy on a fast machine and **51–55% busy on a machine four times slower**. Fixed on the
   branch with the same look: 4% and 13–14%.
2. **The quotes service is the slow answer.** Both pages ask the chart service for prices constantly (the Hub asks for
   all 590 names every 2 seconds). With eight pages open, about one call in four took longer than 1.5 seconds, they
   averaged 4–6 seconds when slow, and some never answered inside the page's 20-second limit. Alone, one call takes
   0.3–1.7 seconds. This is not fixed here; it lives in the provider.
3. **The Station keeps building new charts.** In 15 minutes it created 86 new chart documents, and each one downloaded
   the same nine script files again. Prototype on the branch stops the re-download.
4. Nothing was found growing without limit in 15 minutes. The Station's memory was still drifting up slowly at the
   end; 15 minutes is too short to clear it.

## Measurements

"Long tasks" are counted on the page's own top document. (The browser reports each long task to every pane on the
page, so adding the panes together counts each one up to twenty times; that is not done here.)

### Hub — live page (before)

| | Default tab · 1× | Default tab · 4× | Cohort board full screen · 1× | Cohort board full screen · 4× |
|---|---:|---:|---:|---:|
| Main thread busy | 16.1% | 51.2% | 17.8% | 55.3% |
| Long tasks (> 50 ms) per minute | 0.6 | 24.5 | 0.5 | 25.5 |
| Time inside long tasks, s per minute | 0.07 | 2.29 | 0.06 | 2.36 |
| Script, s per minute | 0.23 | 0.93 | 0.23 | 0.95 |
| Layout, s per minute | 1.16 | 3.70 | 0.81 | 2.44 |
| Style, s per minute | 1.19 | 3.87 | 0.57 | 1.50 |
| Paint, ms in a 20 s trace | 1116 (2402 paints) | 3270 (2368 paints) | 808 (4480 paints) | 2393 (4441 paints) |
| Layouts in a 20 s trace | 1205 | 1190 | 1797 | 1732 |
| JS heap after GC, MB: start → 5 min → 15 min (peak) | 9 → 10 → 9 (10) | 8 → 9 → 9 (11) | 9 → 11 → 10 (12) | 9 → 10 → 10 (11) |
| DOM nodes: start → end | 10132 → 10698 | 10598 → 11799 | 10261 → 10011 | 10003 → 10480 |
| Event listeners: min–max | 95–101 | 95–97 | 108–108 | 108–114 |
| Repeating timers alive: min–max | 23–23 | 23–23 | 23–23 | 23–23 |
| One-shot timers set per minute | 163 | 165 | 308 | 309 |
| WebSockets open | 2 | 2 | 2 | 2 |
| Event streams (SSE) open | 0 | 0 | 0 | 0 |
| Frames (documents) alive: min–max | 2–2 | 2–2 | 2–2 | 2–2 |
| Requests per minute | 78 | 80 | 80 | 78 |
| Requests that took > 1.5 s (15 min) | 85 of 1289 | 81 of 1321 | 82 of 1331 | 86 of 1299 |
| Slowest request | 20.1 s | 20.1 s | 20.1 s | 20.1 s |
| Non-GET requests blocked | 6 | 6 | 6 | 6 |

### Station — live page

| | Default page · 1× | Default page · 4× | Busiest page (16 charts) · 1× | Busiest page (16 charts) · 4× |
|---|---:|---:|---:|---:|
| Main thread busy | 4.4% | 15.2% | 4.6% | 15.5% |
| Long tasks (> 50 ms) per minute | 1.7 | 27.7 | 1.7 | 31.2 |
| Time inside long tasks, s per minute | 0.11 | 2.88 | 0.11 | 3.22 |
| Script, s per minute | 1.07 | 4.18 | 1.04 | 4.23 |
| Layout, s per minute | 0.16 | 0.53 | 0.20 | 0.56 |
| Style, s per minute | 0.16 | 0.47 | 0.22 | 0.57 |
| Paint, ms in a 20 s trace | 141 (358 paints) | 35 (174 paints) | 78 (195 paints) | 268 (145 paints) |
| Layouts in a 20 s trace | 420 | 123 | 345 | 310 |
| JS heap after GC, MB: start → 5 min → 15 min (peak) | 15 → 55 → 60 (73) | 15 → 55 → 69 (73) | 46 → 54 → 69 (74) | 46 → 54 → 68 (74) |
| DOM nodes: start → end | 8778 → 9171 | 8478 → 10029 | 10102 → 9872 | 9855 → 10116 |
| Event listeners: min–max | 598–970 | 588–973 | 770–992 | 768–983 |
| Repeating timers alive: min–max | 17–45 | 17–45 | 33–45 | 33–45 |
| One-shot timers set per minute | 429 | 417 | 417 | 399 |
| WebSockets open | 0 | 0 | 0 | 0 |
| Event streams (SSE) open | 0 | 0 | 0 | 0 |
| Frames (documents) alive: min–max | 6–20 | 6–20 | 14–20 | 14–20 |
| Requests per minute | 119 | 116 | 113 | 112 |
| Requests that took > 1.5 s (15 min) | 108 of 1899 | 115 of 1860 | 98 of 2026 | 93 of 2009 |
| Slowest request | 18.9 s | 18.4 s | 15.5 s | 19.1 s |
| Non-GET requests blocked | 49 | 49 | 49 | 49 |

### Hub — the branch `hub/slow1-20261006` (after)

| | Default tab · 1× | Default tab · 4× | Cohort board full screen · 1× | Cohort board full screen · 4× |
|---|---:|---:|---:|---:|
| Main thread busy | 4.1% | 14.1% | 3.6% | 12.6% |
| Long tasks (> 50 ms) per minute | 0.5 | 22.7 | 0.7 | 22.7 |
| Time inside long tasks, s per minute | 0.05 | 1.97 | 0.06 | 1.95 |
| Script, s per minute | 0.23 | 0.85 | 0.23 | 0.85 |
| Layout, s per minute | 0.15 | 0.53 | 0.09 | 0.30 |
| Style, s per minute | 0.30 | 1.02 | 0.16 | 0.48 |
| Paint, ms in a 20 s trace | 78 (184 paints) | 289 (185 paints) | 114 (3154 paints) | 239 (1534 paints) |
| Layouts in a 20 s trace | 74 | 72 | 171 | 74 |
| JS heap after GC, MB: start → 5 min → 15 min (peak) | 9 → 9 → 9 (10) | 8 → 9 → 9 (11) | 10 → 10 → 10 (11) | 9 → 10 → 10 (11) |
| DOM nodes: start → end | 17047 → 11412 | 10910 → 11344 | 10274 → 10175 | 10015 → 10204 |
| Event listeners: min–max | 95–99 | 95–97 | 108–109 | 108–108 |
| Repeating timers alive: min–max | 22–22 | 22–22 | 22–22 | 22–22 |
| One-shot timers set per minute | 164 | 162 | 310 | 307 |
| WebSockets open | 2 | 2 | 2 | 2 |
| Event streams (SSE) open | 0 | 0 | 0 | 0 |
| Frames (documents) alive: min–max | 2–2 | 2–2 | 2–2 | 2–2 |
| Requests per minute | 72 | 77 | 74 | 78 |
| Requests that took > 1.5 s (15 min) | 102 of 1198 | 102 of 1274 | 102 of 1246 | 97 of 1294 |
| Slowest request | 20.1 s | 20.2 s | 20.2 s | 20.2 s |
| Non-GET requests blocked | 6 | 6 | 6 | 6 |

The quotes service was just as slow during the second run (97–102 slow calls per page), so the gain above is the
page's own work, not a quieter network.

### What the first minute costs (one page at a time)

| | Requests | On the wire | Biggest items |
|---|---:|---:|---|
| Hub, live, 1× | 404 | 3.4 MB | quotes 988 kB in 27 calls · the page 700 kB **twice** · legacy quote table 124 calls |
| Station, live, 1× | 254 | 4.5 MB | chart pages 864 kB in 10 · YouTube player 950 kB · provider.js 327 kB in 11 copies |

## The top five costs

| # | Where | What it costs | One-line fix |
|---|---|---|---|
| 1 | Hub `index.html:215–216` (`.sc-rsi.is-xt`, `@keyframes rsi-xt`) | An animated text-shadow. 1,205 layouts and 2,402 paints in 20 s; main thread 16–18% busy at 1×, 51–55% at 4×, permanently | Breathe the opacity of a fixed copy of the number instead. **Prototyped.** |
| 2 | Hub `index.html:26795` (`SC_TICK_FAST_MS = 2000`) and `:26885` (all 590 names per call); then `patch()` at `:25961–25990` runs a whole-document lookup per name | ~1 MB a minute of quotes per open Hub; the service needs 0.3–1.7 s per answer alone and stalled up to 20 s with eight pages open; each answer then costs 590 lookups (1.2 s of every 50 s at 4× before the glow fix) | Ask for the names on screen every 2 s and the rest every 15 s; in the provider, keep the whole-universe answer for 2 s so many pages cost one computation |
| 3 | Station `deck/index.html:4042` and `:4244` (`f.src = src` — a new document per chart) with `vercel.json` (`no-store` on everything) | 86 new chart documents in 15 min; each fetches 10 files (~180 kB on the wire, ~515 kB to parse) and about six history reads (551 `/candles` calls in 15 min) | Let scripts be kept and re-checked (`no-cache`). **Prototyped.** Next step: re-point a parked chart frame by message instead of building a new document |
| 4 | Hub `index.html:27519–27550` (build-stamp check at load and every 75 s) | Downloads the whole page (2.2 MB, 700 kB on the wire) to read one line: 34 MB an hour per open Hub, and the stamp has not changed since August, so it can never fire | Remove it; the etag checks beside it already find a new build. **Prototyped.** |
| 5 | Hub `index.html:26195–26214` and `:26777` (`setInterval(pollFMP, 12000)`) | About 20 requests a minute (a quarter of the Hub's 78) to the old quote table, whose answers are refused for every stock | Ask only for the names that are not stocks |

Also seen, smaller: the Station redraws a whole chart and re-reads its pixels on every price update
(`station-shells/chart-v1/index.html:3933` → `:2408` → `_indicators/lens-placement.mjs:429`), which is most of its 24–31
long tasks a minute at 4×; the Hub sets 163–309 one-shot timers a minute, 100 of them from a 600 ms watcher at
`index.html:30786`.

## Before → after for the prototypes

**Hub, both fixes together (15-minute soak, live page vs the branch's page on the live site's data):**

| | Before | After |
|---|---:|---:|
| Default tab, main thread busy, 1× | 16.1% | 4.1% |
| Default tab, main thread busy, 4× | 51.2% | 14.1% |
| Cohort board full screen, main thread busy, 1× | 17.8% | 3.6% |
| Cohort board full screen, main thread busy, 4× | 55.3% | 12.6% |
| Layout + style, seconds per minute, default tab 1× / 4× | 2.35 / 7.57 | 0.45 / 1.55 |
| Layouts in a 20 s trace, default tab | 1,205 | 74 |
| Long tasks per minute, default tab 4× | 24.5 | 22.7 |
| Whole-page downloads | one at load + one every 75 s (700 kB each) | none after the page itself |

The glow looks the same: `shots/glow-live-peak.png` and `shots/glow-branch-peak.png` were compared at 4× zoom at the
brightest moment and at rest. Long tasks at 4× barely moved (24.5 → 22.7 a minute). The profile does not pin the remainder on one function: the largest named pieces are the quotes tick (`scProviderTick` → `patch`), the tape repaint (`renderTopTape`) and the prediction-market paint (`pmPaint`). That is not solved here.

**Station, script cache rule (local copy of the branch's files, eight charts per page, steady state):**

| | Before (`no-store`) | After (`no-cache` for scripts) |
|---|---:|---:|
| Files downloaded per page of eight charts | 80 | 8 |
| Bytes downloaded per page | 1,429 kB | 672 kB |
| Time until all eight are drawn, 1× | 200 ms | 215 ms |
| Time until all eight are drawn, 4× | 566 ms | 434 ms |

On a local server a download costs almost nothing, so the times hardly differ; the gain on a real connection is the
72 files and 757 kB not fetched for every page of charts. The chart pages themselves (86 kB each) still download.

## The "loading" Alan sees

| What shows | Where it comes from | How long it really waited |
|---|---|---|
| Station, top bar: **DATA · loading (n)** | `deck/index.html:2463` — n chart panes are waiting for history or a price; it appears with every page change or slot rotation | 13–18 times in 15 min at 1× (19–47 s in all, longest 3–20 s); 26–38 times at 4× (41–81 s, longest 4–19 s) |
| Station, top bar: **DATA · delayed (n)** | the same line — a pane's read did not come back in time and is being retried | 7 times in 15 min, 103–106 s in all, longest 35 s (second run; the first run did not look for this word). Together with "loading" the bar was not saying LIVE for about 150–190 s of the 900 (all eight pages were open at once) |
| Station, on a chart: **loading 3D** / **data delayed · retrying** | `station-shells/chart-v1/index.html:3585` and `:3547` | On a clean first load, first chart drawn at 0.8 s (1×) / 1.3 s (4×), all at 1.0 s / 1.6 s. Later waits follow the chart service: its history calls took 2.4–5.6 s on average when slow, 14 s at worst |
| Station, X pane: **asking the X source for the picture · Ns** | `station-shells/x-v2/index.html:372` | Not measured: a headless browser has no X source, so it stayed on "X SOURCE IS OFFLINE" |
| Hub, board cells: **…** | `index.html:7932` — waiting for the first price snapshot | Gone at 1.7 s (1×) / 4.1 s (4×); RSI numbers start at 1.9 s / 4.3 s |
| The browser's own loading mark, a whole reload | The Hub reloads itself when a new build ships and the page has been idle two minutes (`index.html:27605–27629`); the Station checks every three minutes (`deck/index.html:5051`) | Not observed: the harness blocks the check (it is not a plain read). On 6 Oct the Hub's page changed twice (09:15 and 11:29 ET); on 5 Oct there were 28 pushes but three versions of the page |

## What could be wrong

- This is the MacBook pretending to be slower, not the iMac. 4× is a stand-in; the iMac's graphics, memory and
  network are not imitated.
- Eight pages ran at once from one machine. That is what made the quotes service slow in these numbers; a single
  page saw 0.3–1.7 s. How many pages and test browsers were really open at 11:10 is not known.
- The Station cache rule was measured on a local server, not on Vercel.
- A headless browser paints without a real screen, so paint times are indicative; layout, style and script times
  are real.

## What was not done

- No deploy, no change to the provider, nothing on the iMac.
- Costs 2, 3 (second half) and 5 are named, not built.
- No soak longer than 15 minutes, so a slow leak on the Station is neither shown nor cleared.
- The self-reload after a release was read in the code, not watched happening.

## Files

`tools/` holds the harness (`soak.mjs` is the 15-minute run, `exp.mjs` switches one effect off at a time, `stbench.mjs`
is the Station cache bench, `net.mjs` the first-minute probe). `data/` holds the tables as JSON. `shots/` holds the
pictures looked at.
