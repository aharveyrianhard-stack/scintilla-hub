/* D1 — writes eval-data.js for the evaluation board: the proposals, what each is for and where it would live, its
   thumbnail and its measured cost (screens/eval/cost.json for the earlier proposals on the live site, and
   screens/eval-d1/cost.json for this lane's mockups, run locally through the read-only proxy). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const HERE = fileURLToPath(new URL("..", import.meta.url));
const load = (p) => (existsSync(HERE + p) ? JSON.parse(readFileSync(HERE + p, "utf8")).results : []);
const cost = Object.fromEntries([...load("screens/eval/cost.json"), ...load("screens/eval-d1/cost.json")].map((r) => [r.id, r]));
const H = "/deliverables", ST = "https://station.scintillahub.ai/deliverables", ME = "/deliverables/20260926/hub-layout-tape/";
const items = [
  { id: "motion-a", group: "Geiger in motion (the board's replay)", title: "Geiger in motion · A · the same list, continuous", by: "F1 · 25 Sep", url: H + "/20260925/geiger-visuals/motion-a.html",
    for: "Replaying the board day by day: each row glides to its new rank the moment it earns it, one at a time, ranked by the column you sort on.", lives: "The dashboard board's REWIND · PLAY.", note: "F1 recommended shipping A." },
  { id: "motion-b", group: "Geiger in motion (the board's replay)", title: "Geiger in motion · B · the field", by: "F1 · 25 Sep", url: H + "/20260925/geiger-visuals/motion-b.html",
    for: "No list: every name is a dot, across = today's move in its own usual days, up = the Geiger, size = market cap, with a short tail as the day plays.", lives: "A second view behind one chip in the replay." },
  { id: "motion-c", group: "Geiger in motion (the board's replay)", title: "Geiger in motion · C · the rank river", by: "F1 · 25 Sep", url: H + "/20260925/geiger-visuals/motion-c.html",
    for: "Time runs across; each name is a line of its rank, green above zero, red below; the standings slide at the right.", lives: "A replay view for a cohort." },
  { id: "tab-a", group: "The company GEIGER tab", title: "Geiger tab · A · the ladder", by: "F1 · 25 Sep", url: H + "/20260925/geiger-visuals/tab-a.html",
    for: "The composite on top, then the eight timeframes as eight rows: weight, the rung's composite, trend and momentum ticks, RSI and Williams.", lives: "The company panel's GEIGER tab." },
  { id: "tab-b", group: "The company GEIGER tab", title: "Geiger tab · B · its own history", by: "F1 · 25 Sep", url: H + "/20260925/geiger-visuals/tab-b.html",
    for: "The composite as a line over its last 260 sessions, with two sentences on where today sits in that history.", lives: "The company panel's GEIGER tab.", note: "The stored history stops on 20 Aug." },
  { id: "tab-c", group: "The company GEIGER tab", title: "Geiger tab · C · the plane", by: "F1 · 25 Sep", url: H + "/20260925/geiger-visuals/tab-c.html",
    for: "Trend across, momentum up; the last 60 sessions as a trail and the eight timeframes as dots around today.", lives: "The company panel's GEIGER tab." },
  { id: "d1-geiger", group: "The company GEIGER tab", title: "Geiger tab · D1 · the bar you like, then the ladder", by: "D1 · 27 Sep", url: ME + "layout-a.html?t=META&tab=GEIGER", thumb: "screens/mock/a-1440-geiger.png",
    for: "Keeps the composite bar from the top left of today's tab, adds trend and momentum in the same bar, then F1's ladder redrawn in that one bar idiom. Drops the arc, the dotted ladder box, the empty MACD card and the volume gauge.", lives: "The company panel's GEIGER tab, collapsed and expanded." },
  { id: "sentiment-feed", group: "Rooms", title: "Sentiment as a feed", by: "F2 · 25 Sep", url: H + "/20260925/sentiment-feed/mockup-feed.html",
    for: "The SENTIMENT room redrawn as a feed you read in a glance, in the idiom of the keyword tracker you liked, instead of twelve stacked cards.", lives: "The SENTIMENT master tab." },
  { id: "knockout-cards", group: "Rooms", title: "Comps knockout · the cards", by: "K1 · 26 Sep", url: H + "/20260925/knockout/index.html?stage=CARDS",
    for: "A cohort's comparable companies as cards with filters, one step of the table → field → cards → three rounds → pick path.", lives: "A workshop page today; later a step of SCREENER or ALLOCATION." },
  { id: "context-lens-2", group: "Station charts", title: "Context lens · round 2 · the lens on real charts", by: "CL2 · 23 Sep", url: ST + "/20260923/context-lens-2/CONTEXT-LENS-2.html",
    for: "A small inset on each Station chart showing where the window sits in the whole history, placed in the emptiest corner, never over the price.", lives: "Every Station chart pane." },
  { id: "context-lens-3", group: "Station charts", title: "Context lens · round 3 · the bars at zoom", by: "CL3 · 26 Sep", url: ST + "/20260926/context-lens-3/CONTEXT-LENS-3.html?stage=six&bubbles=1",
    for: "In a corner of the 3-day line, the last three sessions as half-hour candles, so one glance shows the trend and this week close up.", lives: "The Station's 3-day line pages (TARGETS, SECTORS, SPY + QQQ, MAG 7)." },
  { id: "d1-station-tape", group: "Station charts", title: "Station tape · D1", by: "D1 · 27 Sep", url: ME + "station-tape.html?hide=0", thumb: "screens/mock/station-tape-1680.png",
    for: "One thin strip, like the iOS Stocks widget: the page's names with sparklines, earnings in the next N days, scintillas; it swipes left to right and hides itself.", lives: "The bottom edge of every Station page." },
  { id: "d1-layout-a", group: "The dashboard (D1)", title: "Dashboard · A · beside", by: "D1 · 27 Sep", url: ME + "layout-a.html?t=META", thumb: "screens/mock/a-1440-meta.png",
    for: "Today's grid kept; the company moves to the head of the right panel, next to the chart; one tape under the master tabs; the Geiger column takes every spare pixel.", lives: "The DASHBOARD master tab." },
  { id: "d1-layout-b", group: "The dashboard (D1)", title: "Dashboard · B · stage", by: "D1 · 27 Sep", url: ME + "layout-b.html?t=META", thumb: "screens/mock/b-1440-geiger.png",
    for: "When a name is picked the board narrows to its core columns and the company gets a stage: chart always on top, tabs under it; the tape at the bottom.", lives: "The DASHBOARD master tab." },
  { id: "d1-company-expanded", group: "The dashboard (D1)", title: "Company view · expanded · chart plus tabs", by: "D1 · 27 Sep", url: ME + "layout-a.html?t=META&view=expanded&tab=GEIGER", thumb: "screens/mock/a-1680-expanded.png",
    for: "EXPAND gives the company the whole width: the chart always on the left with a row of key numbers under it, the tabs on the right.", lives: "The dashboard's EXPAND, in both A and B." },
];
execFileSync("mkdir", ["-p", HERE + "screens/thumbs"]);
for (const i of items) {
  const src = i.thumb ? HERE + i.thumb : HERE + "screens/eval/" + i.id + ".png";
  if (!existsSync(src)) { i.thumb = null; continue; }
  const out = "screens/thumbs/" + i.id + ".jpg";
  try { execFileSync("sips", ["-Z", "900", "-s", "format", "jpeg", "-s", "formatOptions", "70", src, "--out", HERE + out], { stdio: "ignore" }); i.thumb = out; } catch (_) { i.thumb = i.thumb || null; }
  const c = cost[i.id]; if (c) { i.load = c.loadCpuS; i.steady = c.steadyCpuSPerMin; i.where = c.url && c.url.startsWith("http://127.0.0.1") ? "measured locally" : "measured on the live site"; }
}
const b = cost.blank; const baseline = b ? { load: b.loadCpuS, steady: b.steadyCpuSPerMin } : null;
const hub = cost["hub-live"]; if (hub) items.push({ id: "hub-live", group: "Reference", title: "The Hub dashboard as it is today", by: "live · 27 Sep", url: "/", thumb: existsSync(HERE + "screens/eval/hub-live.png") ? (execFileSync("sips", ["-Z", "900", "-s", "format", "jpeg", "-s", "formatOptions", "70", HERE + "screens/eval/hub-live.png", "--out", HERE + "screens/thumbs/hub-live.jpg"], { stdio: "ignore" }), "screens/thumbs/hub-live.jpg") : null,
  for: "What the dashboard costs today, as the yardstick for every card above.", lives: "scintillahub.ai", load: hub.loadCpuS, steady: hub.steadyCpuSPerMin, where: "measured on the live site" });
writeFileSync(HERE + "eval-data.js", "/* written by tools/build-eval-data.mjs — the evaluation board's cards and their measured cost */\nwindow.EVAL = " + JSON.stringify({ built_utc: new Date().toISOString(), baseline, items }, null, 1) + ";\n");
console.log("items", items.length, "with cost", items.filter((i) => i.steady != null).length, "baseline", JSON.stringify(baseline));
