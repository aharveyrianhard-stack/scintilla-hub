/* H2 (30 Sep) — "oscillators rsi is all like cropped and horrible doesnt match yesterdays rsi instructions the pink."
   The company chart asks the Station for the full six-line request (?rsi=1), which the Station (S3, 75e653c) draws as the
   Indicator Lab's RSI-only pane; and the collapsed desk view gives that pane room: the Station's panel is 26% of the frame,
   the frame was 207-229 px there (panel 40-47 px), it now keeps 300 px (panel ~72 px). EXPAND and the phone keep their sizes. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}

test("the company chart asks for the full RSI request (?rsi=1 = the Station's RSI-only pane), never the lone ?rsi=chart line", () => {
  assert.match(page, /^const CO_CHART_RSI = true;$/m);
  const src = new Function("lsGet", "coRange", "STATION_CHART_URL", "CO_CLOUDS_KEY",
    fn("coCloudsOn") + fn("coChartSrc") + "\nreturn coChartSrc;")(() => null, (r) => r || "1D", "https://station.scintillahub.ai/chart/", "k");
  const u = src("mu", "1D", true);
  assert.match(u, /[?&]rsi=1(&|$)/);
  assert.doesNotMatch(u, /rsi=chart/);
  assert.match(u, /[?&]bare=hub(&|$)/);
});

test("the collapsed desk chart keeps 300 px so the RSI panel is not squashed; EXPAND and the phone keep their own sizes", () => {
  assert.match(page, /^\.cv-chart\{min-height:300px\}$/m);
  assert.match(page, /^\.cv-main\{min-height:min-content\}$/m, "the chart's column grows to hold it (it clips its overflow)");
  assert.match(page, /^body\.co-exp \.cv-main\{min-height:0\}$/m);
  assert.match(page, /body\.co-exp \.cv-chart\{flex:1 1 auto;height:auto;min-height:0\}/, "EXPAND fills its grid cell as before");
  assert.match(page, /\.cv-chart\{flex:0 0 auto;height:400px\}/, "the phone keeps 400 px");
  /* the Station's own share: 26% of 300 px, less its 6 px gap = 72 px, above its compact eight-up wall's 66 px */
  assert.ok(Math.floor(300 * 0.26) - 6 >= 66);
});

test("the expanded view fills the dashboard's own height (never 100vh - 230 px under the desk zoom), so its bottom is not under the tapes", () => {
  /* MEASURED 1680 x 1050: main ended at 961 px, the expanded view at 1010 — the chart's dates, the RSI's floor and the LIKED
     list's last row and a half were under the tapes. The row takes what is left and the view is 100% of it. */
  assert.match(page, /^@media \(min-width:761px\)\{ body\.co-exp \.sc-body2\{flex:1 1 0\} body\.co-exp \.cv\{height:100%;min-height:400px\} \}/m);
  const at = (re) => page.search(re);
  assert.ok(at(/@media \(min-width:761px\)\{ body\.co-exp \.sc-body2/) > at(/body\.co-exp \.cv\{display:grid;[^}]*height:calc\(100vh - 230px\)/), "it overrides the old height");
  assert.match(page, /body\.co-exp \.cv\{display:flex;height:auto;min-height:0\}/, "the phone and small tablet keep their own");
});
