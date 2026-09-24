# Detailed indicators: review and statistical handoff
24 September 2026 · Indicator Lab · review build, not database deployment

## What can be reviewed now
- Combined: one price chart, one normalized oscillator pane. RSI14 and stochastic K on by default; shifted Williams optional.
- Separate: one price chart with separate RSI, Williams and stochastic panes.
- Full study: the separate view plus daily MACD 12/26/9 and displayed-bar volume/RVOL20.
- Persistent geometry: a frozen real-MCP BTC capture with 12 four-hour and 12 daily original rails drawn together. Display may change between 4H, daily and weekly without recalculating the detections.
- Source-timeframe buttons select 3H, 4H, 6H, 8H, 12H, D, 2D, 3D, W, 2W. Longer contexts get greater line weight. Price/panes share one horizontal viewport.
- Optional RSI signal band is the middle 50% of the selected RSI SMA14 signals. This is a visual experiment, not proven attraction. It defaults off. The fixed 50 reference is separate.
- Williams +100 and raw stochastic range position are mathematically identical at the same window. The displayed K is SMA3 of that position, D is SMA3 of K. Never count these as three independent confirmations.
- Source computations use provider-native candles; each completed value appears at the next supplied source-bar open. Final unconfirmed source bar withheld. No shorter lookback substitutes for a longer source timeframe.
- Provider envelope export preserves source identity, session/adjustment metadata and timestamps. No database indicator values are claimed here.

## How lines carry across timeframes
Detect separately on each selected source timeframe. Store those detections and their original anchors once. Changing displayed candles must only change projection/rendering, never rerun detection on the display timeframe.

A line record needs: stable ID, instrument and exchange; detector/library version and configuration hash; source timeframe; timezone/session and price adjustment; anchor prices, timestamps and native source-bar indices; original coordinate mode (bar time versus bar index); linear/log price basis; source-bar duration and actual trading-time coverage; boundary role; parent pattern/pivot IDs when known; first-seen and confirmed-at times; revision/supersession history; lifecycle (active, ended, continued, retired); and capture/computation provenance.

Keep original segments and continuations distinct. A geometric endpoint is NOT automatically a confirmed break. Retiring a drawing on TradingView is NOT a reason to delete its registry record. Keep revisions; don't silently rewrite the past. An old continued rail remains screenable with its lifecycle tag.

For equities, reconstruct source bar indices using the actual session calendar. Never convert a bar-index slope into elapsed wall-clock hours across weekends. Time-coordinate lines must preserve their native coordinate rule, not silently switch to bar-index slopes. This prototype uses 24/7 BTC for the first transport check; it is not an equity-session proof.

The capture currently has 136 four-hour / 80 daily primitives. Only 24 / 24 primitives have resolvable endpoints, of which 12 / 12 are original solid rails. The other 112 / 56 remain in raw evidence, not guessed into the display. Confirmation times and parent pattern identities are unknown. This capture cannot support unbiased event backtests.

## Screening contract
For each retained upper/lower rail at the current confirmed source observation:
- boundary price;
- signed required price move: 100 * (boundary - price) / price;
- near-boundary flag with explicit tolerance (review default 0.25%);
- original versus continuation;
- source timeframe and duration;
- first-seen/confirmed time, when genuinely available.

Nearest upper/lower means original boundary ROLE, not necessarily above/below current price. Preserve that role after a break. A changing nearest line must not masquerade as a price crossover event. Break/retest statistics need a fixed line ID and forward observations.

The local ACP Screening Review V4 exposes ten numeric plots plus two alert conditions with no extra request calls. It compiled via MCP with zero errors and one consistency warning, also present in its unmodified base. It has NOT been applied to a saved TradingView chart or tested against a Pine Screener watchlist.

Pine Screener is an intermediate test surface, not the all-timeframe registry. Its official restrictions include 500 bars, up to five request calls, and a limited timeframe list (including 4H, daily, weekly, not the entire ten-context fan). Use native-timeframe numeric outputs for initial screening. Source: https://www.tradingview.com/support/solutions/43000742436-tradingview-pine-screener-key-features-and-requirements/

## Statistical analysis request
Keep all detector outputs, including flags/pennants and head-and-shoulders, with family and version tags. A preceding impulse is a distinguishing feature to measure, not an excuse to discard a pattern Alan wants to study.

1. Reproduce detector anchors, selected pivot sequence and confirmation timing on identical candles/settings before studying performance.
2. Start observations at confirmed/first-seen time, never at the earlier anchor date. Keep live revisions to quantify repainting.
3. Group overlapping detections by shared anchors and price-time overlap, retaining child IDs. Do not delete evidence or count duplicate patterns as independent samples.
4. Separate upper touch, lower touch, continued-rail touch, break and retest events. Pre-register tolerance and event definitions.
5. Report subsequent returns, maximum favorable/adverse excursion, touch/retest frequency and time-to-event over stated horizons; benchmark against matched non-event observations.
6. Compare one-timeframe versus multi-timeframe agreement, controlling for duration, volatility, overlapping candles, instrument and regime. Agreement is a hypothesis, NOT automatic stronger evidence.
7. Use chronological holdouts, purge overlapping events across split boundaries, report counts and uncertainty, and show sensitivity to costs and parameter choices.
8. Report missing history, unresolved anchors and unknown confirmation times. Exclude those from causal event claims rather than filling them in.

## Checks and remaining boundary
62 automated checks passed: 54 existing cloud/proxy/render math checks, seven new oscillator/geometry tests and one mocked DOM/canvas execution test covering all four templates. The latter is not browser visual acceptance.
20 live provider requests (SPY and AAPL across ten source contexts) returned valid envelopes; RSI/range outputs stayed in bounds. This checks availability and numeric sanity, not independent TradingView parity.
New geometry anchors reproduce their extracted endpoint prices within 1e-7. The exact TradingView chart was restored to four hours after the daily capture.
Native Chrome control was unavailable in this connection (only the in-app browser was listed). The mandated managed-group browser check was therefore not performed. No user tabs were altered for workshop testing.
Pending: real-browser visual/interaction acceptance, oscillator MCP value parity, equity-session geometry transport, live registry ingestion/computation, parallel-channel multi-timeframe capture, and Pine Screener end-to-end watchlist run. No new Station production integration or statistical strength claim.
