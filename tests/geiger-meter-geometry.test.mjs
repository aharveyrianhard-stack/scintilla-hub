/* THE GEIGER TAB'S GEOMETRY (rewritten for D2, 27 Sep).
   Until D2 this file measured the two 240-degree rings of the composite meter against their viewBox. Alan, 27 Sep:
   the Geiger tab was "disgusting" except the composite bar, and "I did like the moving average thing that we had". The
   rings are gone; what this file now pins is the geometry of what replaced them:
     1. the composite is ONE bar, centred at zero, filled left (bear) or right (bull) by |composite| x 50%;
     2. the moving-average ladder ALWAYS draws all nine averages, one row each, highest level first, with the price as
        its own row exactly where it falls (the old default showed two, in a dashed box, with overlapping labels);
     3. the four cloud averages are named in the chart's cloud ink, the others are not;
     4. the timeframe table is eight rows, 2H to W, and its weights add up to the whole. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtPxIdent = (p) => "$" + (p >= 1000 ? p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2));
const kit = new Function("num", "esc", "fmtPxIdent",
  line(/^function cvSgn[^\n]*/m) + fn("gsUnavailHTML") + line(/^const GS_MA_ORDER = [^\n]*/m) + line(/^const GS_CLOUD_PAIR = [^\n]*/m) +
  line(/^const GS_CLOUD_INK = [^\n]*/m) + fn("gsCloudInk") + fn("gsLadderHTML") + line(/^const GS_TF_ROWS = [^\n]*/m) + fn("gsTfTableHTML") +
  "\nreturn { gsLadderHTML, gsTfTableHTML, GS_CLOUD_INK };")(num, esc, fmtPxIdent);
const rows = (html) => [...html.matchAll(/<div class="g2-lrow([^"]*)" role="row"><span role="cell"( style="color:([^"]+)")?>([^<]+)<\/span>/g)]
  .map((m) => ({ cls: m[1].trim(), ink: m[3] || null, name: m[4] }));
/* MU, 27 Sep (the FMP provider values the tab read) */
const MU = [["EMA 5", 1065.11], ["EMA 8", 1047.09], ["EMA 13", 1025.49], ["EMA 21", 1003.51], ["EMA 34", 982.24],
  ["SMA 50", 941.62], ["SMA 100", 935.56], ["SMA 150", 766.59], ["SMA 200", 661.10]].map(([n, v]) => ({ n, v }));

test("the ring meter is gone; the composite is one bar centred at zero", () => {
  const html = fn("geigerSummaryHTML");
  assert.doesNotMatch(html, /<svg|gs-meterwrap|A135,135|A108,108/, "no rings");
  assert.match(html, /data-gs="cgr"/, "the composite bar");
  const b = fn("buildGeigerSummary");
  assert.match(b, /const w = Math\.min\(Math\.abs\(g\), 1\) \* 50/, "filled by |composite| x 50% of the track");
  assert.match(b, /\(g >= 0 \? "left" : "right"\) \+ ":50%;width:"/, "from the centre: rightward when bull, leftward when bear");
});

test("the ladder draws all nine averages, highest first, the price in its own row where it falls", () => {
  const html = kit.gsLadderHTML(1085.02, MU, null);
  const r = rows(html);
  assert.deepEqual(r.map((x) => x.name), ["PRICE", "EMA 5", "EMA 8", "EMA 13", "EMA 21", "EMA 34", "SMA 50", "SMA 100", "SMA 150", "SMA 200"]);
  const mid = rows(kit.gsLadderHTML(950, MU, null)).map((x) => x.name);
  assert.deepEqual(mid.slice(4, 7), ["EMA 34", "PRICE", "SMA 50"], "a price between two averages sits between them");
  assert.equal(rows(kit.gsLadderHTML(500, MU, null)).pop().name, "PRICE", "below every average: last");
  /* price vs average: +1.9% above EMA 5 in green, a price under an average in red */
  assert.match(html, /EMA 5<\/span><span role="cell">\$1,065\.11<\/span><span role="cell" class="up">\+1\.9%<\/span>/);
  assert.match(kit.gsLadderHTML(950, MU, null), /EMA 5<\/span><span role="cell">\$1,065\.11<\/span><span role="cell" class="dn">−\d+\.\d%<\/span>/);
  /* never the compact two-average box, whatever the count */
  assert.doesNotMatch(page, /function gsCompactMAs|function gsTrend/);
});

test("a missing average keeps its row and says so; no averages at all says why; nothing yet says it is reading", () => {
  const r = rows(kit.gsLadderHTML(100, MU.filter((m) => m.n !== "SMA 150"), null));
  assert.equal(r.length, 10);
  assert.match(kit.gsLadderHTML(100, MU.filter((m) => m.n !== "SMA 150"), null), /SMA 150<\/span><span role="cell">—<\/span><span role="cell">not served/);
  assert.match(kit.gsLadderHTML(100, [], { why: "moving-average source not current" }), /unavailable[\s\S]*moving-average source not current/);
  assert.match(kit.gsLadderHTML(100, null, null), /reading the nine averages/);
});

test("the four cloud averages carry the chart's cloud ink: blue while the pair is stacked bullish, pink while bearish", () => {
  const { bull, bear } = kit.GS_CLOUD_INK;
  assert.deepEqual([bull, bear], ["#5C7BFF", "#FF00A8"], "the Station chart's CLOUD_LABEL_INK");
  const ink = (mas) => Object.fromEntries(rows(kit.gsLadderHTML(1000, mas, null)).map((x) => [x.name, x.ink]));
  const up = ink(MU);
  assert.deepEqual([up["EMA 13"], up["EMA 21"], up["SMA 50"], up["SMA 200"]], [bull, bull, bull, bull]);
  for (const n of ["EMA 5", "EMA 8", "EMA 34", "SMA 100", "SMA 150"]) assert.equal(up[n], null, n + " is not a cloud line");
  const down = ink(MU.map((m) => m.n === "EMA 13" ? { n: m.n, v: 900 } : m.n === "SMA 200" ? { n: m.n, v: 2000 } : m));
  assert.deepEqual([down["EMA 13"], down["EMA 21"], down["SMA 50"], down["SMA 200"]], [bear, bear, bear, bear]);
});

test("the timeframe table is eight rows, 2H to W, and the weights add up to the whole", () => {
  const detail = JSON.parse('{"12h":{"eq_weight":3.172702,"trend_signed":1,"momentum_signed":0.3,"tf_composite":0.74},"1d":{"eq_weight":3.178477,"trend_signed":1,"momentum_signed":0.44,"tf_composite":0.83},' +
    '"1w":{"eq_weight":0.987499,"trend_signed":1,"momentum_signed":0.3,"tf_composite":0.7},"2h":{"eq_weight":0.391534,"trend_signed":1,"momentum_signed":0.33,"tf_composite":0.66},' +
    '"3d":{"eq_weight":2.576738,"trend_signed":1,"momentum_signed":0.33,"tf_composite":0.83},"3h":{"eq_weight":1.235817,"trend_signed":1,"momentum_signed":0.39,"tf_composite":0.7},' +
    '"4h":{"eq_weight":2.278755,"trend_signed":1,"momentum_signed":0.449767,"tf_composite":0.724884},"6h":{"eq_weight":3.178477,"trend_signed":-0.2,"momentum_signed":0.44,"tf_composite":0.72}}');
  const html = kit.gsTfTableHTML(detail);
  const tr = [...html.matchAll(/<div class="g2-trow( is-absent)?" role="row"><span role="cell">([^<]+)<\/span><span role="cell"[^>]*>([^<]+)<\/span>/g)];
  assert.deepEqual(tr.map((m) => m[2]), ["2H", "3H", "4H", "6H", "12H", "D", "3D", "W"]);
  const pct = tr.map((m) => parseInt(m[3], 10));
  assert.ok(Math.abs(pct.reduce((a, b) => a + b, 0) - 100) <= 2, "weights are shares of the whole (rounded)");
  assert.match(html, /4H<\/span><span role="cell" title="weight 2\.28">13%<\/span><span role="cell" class="up">\+1\.00<\/span><span role="cell" class="up">\+0\.45<\/span><span role="cell" class="up">\+0\.72<\/span>/);
  assert.match(html, /6H<\/span><span role="cell"[^>]*>19%<\/span><span role="cell" class="dn">−0\.20<\/span>/, "a negative reading is red");
  assert.match(kit.gsTfTableHTML({}), /did not answer/, "no detail: says so");
  assert.match(kit.gsTfTableHTML(null), /reading the timeframes/);
});
