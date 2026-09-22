import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../prototypes/indicator-lab/index.html", import.meta.url), "utf8");

test("channel and diagonal review surfaces are all linked once", () => {
  for (const url of [
    "https://www.tradingview.com/chart/99awrQQB/",
    "https://www.tradingview.com/chart/XMhDLRjG/",
    "https://www.tradingview.com/chart/LmUGaNim/",
  ]) {
    assert.equal(page.split(url).length - 1, 1, url);
  }
});

test("method provenance links and the exact saved split remain explicit", () => {
  for (const url of [
    "https://www.tradingview.com/script/WZ8B1FIW-Auto-Chart-Patterns-Trendoscope/",
    "https://www.tradingview.com/script/PpPsTrnJ-Auto-Parallel-Channel-Trend-Reversal-Tracker/",
    "https://www.tradingview.com/script/Lytlc97U-Auto-Parallel-Channels/",
    "https://www.tradingview.com/script/YMQcZAVD-Auto-Parallel-Channels-HTF/",
    "https://www.tradingview.com/script/BIWG0mAw-Auto-Channel-Detector/",
  ]) assert.match(page, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(page, /Auto Parallel Channel confirmed\/history plus developing/);
  assert.match(page, /SCINTILLA APC lower-primary plus upper-primary offsets/);
  assert.match(page, /TradeSymbiotic APCh HTF/);
  assert.match(page, /SCINTILLA APC independently fitted dual rails/);
  assert.match(page, /sunnywilson93 Auto Channel Detector v7/);
  assert.match(page, /the four shared-slope lanes above are off/);
  assert.match(page, /no method was deleted, fused with Trendoscope or allowed to import pivots into it/i);
});

test("licensing and protected-source boundaries are not blurred", () => {
  assert.match(page, /CC BY-NC-SA 4\.0/);
  assert.match(page, /not a new detector or blanket permission for commercial Station use/);
  assert.match(page, /not a clone of the protected pivot search, scoring, touch accounting or lifecycle/);
  assert.match(page, /SCINTILLA_Parallel_Channels_Additive_Stack_V1\.pine/);
});

test("the registry records the current workshop and RSI candidate exactly", () => {
  assert.match(page, /https:\/\/scintilla-widgets-cfntmj6bw-aharveyrianhard-8432s-projects\.vercel\.app\/chart-workshop\//);
  assert.match(page, /EMA8 is the quieter step below EMA13: width <code>0\.6<\/code>, indigo opacity <code>20%<\/code>, pink opacity <code>8%<\/code>/);
  assert.match(page, /The V2 source is local and paste-ready; it has not been applied to the saved TradingView chart/);
  for (const zone of ["68–72", "48.5–51.5", "28–32"]) assert.match(page, new RegExp(zone));
  assert.match(page, /32 \/ 32 focused tests passed/);
  assert.match(page, /pine_check<\/code>: 0 errors \/ 0 warnings/);
});

test("the registry distinguishes live MCP evidence from older extraction checks", () => {
  assert.match(page, /<code>99awrQQB<\/code> is <code>CDP_CONNECTED<\/code>/);
  assert.match(page, /reads <code>BTCUSD<\/code> on <code>4h<\/code> and 108 V2 line objects/);
  assert.match(page, /Earlier reads matched 126 completed candle timestamps/);
  assert.match(page, /other 32 remain explicitly unresolved/);
});

test("the geometry history ceilings remain explicit", () => {
  assert.match(page, /diagonal <code>calc_bars_count<\/code> and retained detection state are separate limits/);
  assert.match(page, /channel B archive <code>10 \/ 40<\/code>/);
  assert.match(page, /channel D archive <code>20 \/ 80<\/code>/);
  assert.match(page, /combined object budget <code>474 \/ 500<\/code>/);
  assert.match(page, /audited candidate compiles at 0 errors \/ 0 warnings/);
});
