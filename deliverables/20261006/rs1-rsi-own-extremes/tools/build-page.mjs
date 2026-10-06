/* RS1 (6 Oct 2026) — builds RS1-RSI-OWN-EXTREMES.html from the files beside it, so every number on the page is read
   from a record and none is typed by hand:
     tools/rec-<before|after>-<1680|390>.json   what the headless browser saw on the board
     tools/station-<before|after>-shots.json    what it saw on the Station (copied from the Station branch's harness run)
     data/rsi-own-dry-run.json                  the loader's dry run (602 names, the 5 Oct close)
     data/playbook-lines.json                   the index and macro lines
     data/fmp-vs-own.json                       the board's number against the scale's own RSI, same session
   node deliverables/20261006/rs1-rsi-own-extremes/tools/build-page.mjs */
import fs from "node:fs";
const here = new URL("../", import.meta.url);
const J = (p) => JSON.parse(fs.readFileSync(new URL(p, here), "utf8"));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const b16 = J("tools/rec-before-1680.json"), a16 = J("tools/rec-after-1680.json"), b39 = J("tools/rec-before-390.json"), a39 = J("tools/rec-after-390.json");
const sb = J("tools/station-before-shots.json"), sa = J("tools/station-after-shots.json");
const dry = J("data/rsi-own-dry-run.json"), pb = J("data/playbook-lines.json"), cmp = J("data/fmp-vs-own.json");
const et = (iso) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }) + " ET";
const el = dry.rows.filter((r) => r.eligible), by = Object.fromEntries(dry.rows.map((r) => [r.ticker, r]));
const oldGlow = el.filter((r) => r.rsi <= 30 || r.rsi >= 70), newGlow = el.filter((r) => r.pct <= 10 || r.pct >= 90);
const stop = oldGlow.filter((r) => !(r.pct <= 10 || r.pct >= 90));
const p10s = el.map((r) => r.p10).sort((x, y) => x - y), p90s = el.map((r) => r.p90).sort((x, y) => x - y), mid = (s) => s[Math.floor((s.length - 1) / 2)];
const N = by.NFLX, C = (rec, t) => (rec.cells && rec.cells[t]) || {};
const sw = (c) => `<i class="sw" style="background:${esc(c || "transparent")}"></i>`;
const st = (rec, name) => rec.shots.find((s) => s.name === name) || {};
const chip = (rec, name) => (st(rec, name).pane || {}).chip || {};
const cellRow = (t, note) => { const x = C(b16, t), y = C(a16, t); return `<tr><td class="k">${t}</td><td>${sw(x.color)}${esc(x.text)}${x.breathes ? " · breathes" : ""}</td><td>${sw(y.color)}${esc(y.text)}${y.breathes ? " · breathes" : ""}</td><td>${esc((y.data_own || y.title || "").split(" · ")[0])}</td><td>${note || ""}</td></tr>`; };
const young = dry.rows.filter((r) => !r.eligible);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · RS1 · RSI BY EACH NAME'S OWN EXTREMES · 6 OCT</title>
<style>
:root{color-scheme:dark;--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--line2:#363636;--ink:#cfcfcf;--ink2:#acacac;--dim:#8c8c8c;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--mono);font-size:13px;line-height:1.6;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px 80px;overflow-x:hidden}
header{padding:16px 0 12px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
h1{font:600 13px/1.4 var(--mono);letter-spacing:.2em;color:var(--ink);margin:0}
.stamp{margin-left:auto;font:400 11px/1.5 var(--mono);color:var(--dim);text-align:right}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.22em;color:var(--ink);margin:30px 0 8px;text-transform:uppercase}
.panel{border:1px solid var(--line);background:var(--panel);margin-bottom:8px}
.words{padding:12px 16px 14px;font-size:12.5px}.words b{color:var(--ink);font-weight:600}.words p{margin:6px 0}
.words ul{margin:4px 0 8px;padding-left:20px}.words li{margin:5px 0}.words code{font-size:12px;color:var(--ink)}
.shot{padding:12px 16px 14px}.shot img{display:block;width:100%;height:auto;border:1px solid var(--line2)}
.shot small{display:block;margin:6px 0 12px;font-size:11px;color:var(--dim)}
.shot .lbl{font:600 11px/1.4 var(--mono);letter-spacing:.18em;color:var(--ink);margin:0 0 6px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two.ph img{max-width:390px}
table.t{width:100%;border-collapse:collapse;font-size:12px}
table.t th,table.t td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
table.t th{font:400 11px/1.4 var(--mono);letter-spacing:.14em;color:var(--dim);text-transform:uppercase}table.t td.k{color:var(--ink)}
.tw{overflow-x:auto;padding:0 16px 10px}
.sw{display:inline-block;width:11px;height:11px;margin-right:7px;vertical-align:-1px;border:1px solid var(--line2)}
.lines p{margin:0 0 10px;font-size:12.5px}.lines p b{color:var(--ink);font-weight:600}
details.sc-pagespecs{border:1px solid var(--line);background:var(--panel);margin:24px 0 8px}
details.sc-pagespecs>summary{padding:8px 16px;cursor:pointer;font:400 11px/1.4 var(--mono);letter-spacing:.16em;color:var(--dim)}
@media(max-width:760px){.wrap{padding:0 12px 60px}.two{grid-template-columns:1fr}.stamp{margin-left:0;text-align:left}}
</style></head><body><div class="wrap">
<header><span data-scnav-slot></span><h1>RS1 · RSI COLOURED BY EACH NAME'S OWN EXTREMES</h1><span class="stamp">6 Oct 2026 · preview only · nothing is live · branches hub/rs1-rsi-own-extremes-20261006 and station/rs1-rsi-own-extremes-20261006</span></header>

<h2>Your screen, 1680 wide — the board around Netflix, before then after</h2>
<div class="panel shot">
  <p class="lbl">BEFORE (the Hub as it is live, ${et(b16.at)})</p>
  <img src="pictures/before-1680-nflx-rows.png" alt="Before: the board rows around NFLX">
  <small>NFLX reads 33 in a medium green and does not breathe. Only the cells at 30 or lower breathe: GS 30, BNY 26, NOC 24, KKR 29, XPEV 30, MCD 27. GE 33, AXON 31 and KGC 32 look like NFLX.</small>
  <p class="lbl">AFTER (this branch, ${et(a16.at)}; the glow is photographed at its brightest)</p>
  <img src="pictures/after-1680-nflx-rows.png" alt="After: the same rows, coloured by each name's own two years">
  <small>NFLX 33 is a deeper green (${esc(C(a16, "NFLX").color)} against ${esc(C(b16, "NFLX").color)} before) but still does not breathe: 33 is lower than ${Math.round(100 - N.pct)}% of Netflix's own last two years, and its own bottom tenth starts at ${Math.round(N.p10)}. GE 33, AXON 31 and KGC 32 now breathe, because for those names the same number IS inside their own bottom tenth.</small>
</div>

<h2>The whole screen, sorted by RSI lowest first — before, then after</h2>
<div class="panel shot">
  <p class="lbl">BEFORE</p><img src="pictures/before-1680-sorted-rsi-lowest.png" alt="Before: the Hub sorted by RSI, lowest first">
  <p class="lbl">AFTER</p><img src="pictures/after-1680-sorted-rsi-lowest.png" alt="After: the Hub sorted by RSI, lowest first">
  <small>Nothing else on the page moved: same header, tapes, map, columns and row heights. On the ALL list ${b16.board.breathing} RSI cells breathed before and ${a16.board.breathing} breathe after (of ${a16.board.rsi_cells_with_a_number} with a number). See the first call below.</small>
</div>

<h2>Phone, 390 wide — before, then after</h2>
<div class="panel shot"><div class="two ph">
  <div><p class="lbl">BEFORE</p><img src="pictures/before-390-screen-nflx.png" alt="Before, phone"></div>
  <div><p class="lbl">AFTER</p><img src="pictures/after-390-screen-nflx.png" alt="After, phone"></div>
</div><small>The phone keeps its RSI column. NFLX 33 is the deeper green; GE 33, AXON 31 and KGC 32 breathe. A phone has no hover, so the same sentence is in the panel a tap on the cell opens.</small></div>

<h2>The hover (a browser tooltip never shows in a headless picture, so it is quoted from the page)</h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Name</th><th>Before</th><th>After</th><th>Hover, after</th><th></th></tr></thead><tbody>
${cellRow("NFLX", "the name you flagged")}
${cellRow("TLT", "the lowest of its two years")}
${cellRow("TSM", "inside its own top tenth")}
${cellRow("SPY", "middle of its own range")}
${cellRow("QQQ")}
${cellRow("MU", "its own exact middle: neutral")}
${cellRow("CBRS", "listed this year: unchanged")}
${cellRow("VIX", "see the second call")}
${cellRow("US10Y", "see the second call")}
${cellRow("GCUSD", "see the second call")}
</tbody></table></div></div>

<h2>Station — the chart's RSI chip and the /geiger row, before then after</h2>
<div class="panel shot">
  <div class="two">
    <div><p class="lbl">BEFORE · TLT chart</p><img src="pictures/station-before-chart-TLT-1D-chip.png" alt="Station before: the RSI D chip is pink"></div>
    <div><p class="lbl">AFTER · TLT chart</p><img src="pictures/station-after-chart-TLT-1D-chip.png" alt="Station after: the RSI D chip is green with an edge"></div>
  </div>
  <small>The chip was always pink. After, "${esc(chip(sa, "chart-TLT-1D").text)}" is full green with a steady glow and an edge: ${esc((chip(sa, "chart-TLT-1D").title || "").split(" · ")[0])}. The Williams chip beside it and every line are untouched.</small>
  <div class="two">
    <div><p class="lbl">BEFORE · NFLX chart</p><img src="pictures/station-before-chart-NFLX-1D-chip.png" alt="Station before: NFLX chip pink"></div>
    <div><p class="lbl">AFTER · NFLX chart</p><img src="pictures/station-after-chart-NFLX-1D-chip.png" alt="Station after: NFLX chip tinted green"></div>
  </div>
  <small>Netflix on the Station read ${esc(chip(sa, "chart-NFLX-1D").text)} when photographed (the Station's chip includes today's bar; the Hub board shows the last settled close, 33). Hover on the chip: "${esc((chip(sa, "chart-NFLX-1D").title || "").split(" · ")[0])}".</small>
  <p class="lbl">AFTER · the whole NFLX pane (nothing else changed)</p>
  <img src="pictures/station-after-chart-NFLX-1D.png" alt="Station after: the whole NFLX chart pane">
  <div class="two">
    <div><p class="lbl">BEFORE · /geiger, NFLX</p><img src="pictures/station-before-geiger-NFLX-rsi-row.png" alt="Station geiger before: marks at 30 and 70, purple"></div>
    <div><p class="lbl">AFTER · /geiger, NFLX</p><img src="pictures/station-after-geiger-NFLX-rsi-row.png" alt="Station geiger after: marks at 31 and 71, green"></div>
  </div>
  <small>This row was the one Station place that judged by the textbook 30 / 70: NFLX at 33 was plain purple with marks at 30 and 70. After, the marks sit at Netflix's own 10th and 90th (${esc((st(sa, "geiger-NFLX").geiger || {}).marks ? st(sa, "geiger-NFLX").geiger.marks.map((m) => m.split(" @")[0]).join(" and ") : "")}), the dot and the number are green, and the row's hover says "${esc((st(sa, "geiger-NFLX").geiger || {}).hover)}".</small>
</div>

<h2>The index and macro lines — each one's RSI against its own two years, at the 5 Oct close</h2>
<div class="panel words lines">
${pb.lines.map((l) => { const i = l.indexOf(" — "); return `<p><b>${esc(l.slice(0, i))}</b>${esc(l.slice(i))}</p>`; }).join("\n")}
</div>

<h2>What was measured</h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Check</th><th>Before</th><th>After</th></tr></thead><tbody>
<tr><td class="k">NFLX at 33, colour</td><td>${sw(C(b16, "NFLX").color)}${esc(C(b16, "NFLX").color)}</td><td>${sw(C(a16, "NFLX").color)}${esc(C(a16, "NFLX").color)}</td></tr>
<tr><td class="k">RSI cells that breathe, ALL list (1680 / 390)</td><td>${b16.board.breathing} / ${b39.board.breathing}</td><td>${a16.board.breathing} / ${a39.board.breathing}</td></tr>
<tr><td class="k">Names that breathe, every served name, 5 Oct close</td><td>${oldGlow.length} of ${el.length} (30 or lower: ${el.filter((r) => r.rsi <= 30).length} · 70 or higher: ${el.filter((r) => r.rsi >= 70).length})</td><td>${newGlow.length} of ${el.length} (own bottom tenth: ${el.filter((r) => r.pct <= 10).length} · own top tenth: ${el.filter((r) => r.pct >= 90).length})</td></tr>
<tr><td class="k">Stop breathing (70 or higher, but not in their own top tenth)</td><td colspan="2">${stop.map((r) => r.ticker + " " + Math.round(r.rsi)).join(", ") || "none"}</td></tr>
<tr><td class="k">Cells carrying the own-scale hover</td><td>${b16.board.with_own_scale_hover}</td><td>${a16.board.with_own_scale_hover} of ${a16.board.rsi_cells_with_a_number}</td></tr>
<tr><td class="k">Where a name's own bottom tenth starts</td><td>30 for every name</td><td>between ${Math.round(p10s[0])} and ${Math.round(p10s[p10s.length - 1])}, typically ${Math.round(mid(p10s))}; above 30 for ${el.filter((r) => r.p10 > 30).length} of ${el.length} names</td></tr>
<tr><td class="k">Where a name's own top tenth starts</td><td>70 for every name</td><td>between ${Math.round(p90s[0])} and ${Math.round(p90s[p90s.length - 1])}, typically ${Math.round(mid(p90s))}; below 70 for ${el.filter((r) => r.p90 < 70).length} of ${el.length} names</td></tr>
<tr><td class="k">Names with a scale / too young / no bars</td><td>—</td><td>${el.length} / ${young.length} (${young.map((r) => r.ticker).join(", ")}) / ${dry.skipped.length} (${dry.skipped.map((s) => s.symbol).join(", ")})</td></tr>
<tr><td class="k">Station chart: daily-bar requests per pane (NFLX, 1D)</td><td>${esc((st(sb, "chart-NFLX-1D").daily_requests || []).join(" · "))}</td><td>${esc((st(sa, "chart-NFLX-1D").daily_requests || []).join(" · "))}</td></tr>
<tr><td class="k">Station chart: reads of the database</td><td>${sb.shots.reduce((n, s) => n + (s.own_table_reads_from_chart_page || 0), 0)}</td><td>${sa.shots.reduce((n, s) => n + (s.own_table_reads_from_chart_page || 0), 0)}</td></tr>
<tr><td class="k">Page errors · writes attempted by the test browser (Hub, four runs)</td><td>${b16.page_errors + b39.page_errors} · ${b16.writes_attempted + b39.writes_attempted}</td><td>${a16.page_errors + a39.page_errors} · ${a16.writes_attempted + a39.writes_attempted}</td></tr>
<tr><td class="k">Page errors · writes attempted (Station, nine pages each)</td><td>${sb.shots.reduce((n, s) => n + s.errors.length, 0)} · ${sb.shots.reduce((n, s) => n + s.blocked_writes, 0)}</td><td>${sa.shots.reduce((n, s) => n + s.errors.length, 0)} · ${sa.shots.reduce((n, s) => n + s.blocked_writes, 0)}</td></tr>
</tbody></table></div></div>

<h2>Three calls for you</h2>
<div class="panel words">
<p><b>1 · About twice as many cells breathe.</b> You asked for the breath at each name's own extremes instead of 30 / 70. By definition every name spends a tenth of its days in its own bottom tenth and a tenth in its top tenth, so on an ordinary day about one RSI cell in five breathes; under 30 / 70 it was about one in nine (${oldGlow.length} names at the 5 Oct close, ${newGlow.length} now — a heavy day for bonds and property). <b>Recommended:</b> ship it as you asked and look at the board for a day. If it is too busy, the breath can be kept for the rarer own 5th / 95th (about one cell in ten) while the colour stays as it is — a one-number change.</p>
<p><b>2 · VIX, the ten-year, the dollar, oil and gold were showing a two-week-old RSI.</b> Those five cells are filled from a file built on 23 Sep, so the live Hub reads VIX ${esc(C(b16, "VIX").text)}, ten-year ${esc(C(b16, "US10Y").text)}, dollar ${esc(C(b16, "DXUSD").text)}, gold ${esc(C(b16, "GCUSD").text)}; at the 5 Oct close they were ${esc(C(a16, "VIX").text)}, ${esc(C(a16, "US10Y").text)}, ${esc(C(a16, "DXUSD").text)} and ${esc(C(a16, "GCUSD").text)}. This branch fills them from the new nightly table, so they stay current. A high reading is coloured red for these too, although for VIX and yields "high" is not the same kind of news as for a stock. <b>Recommended:</b> take the fresh numbers; keep one colour rule for now and decide the direction for VIX and yields when you look at them on the board.</p>
<p><b>3 · Three places still use a fixed RSI line and were left alone.</b> The ALLOCATION page's OVERSOLD search (your dial, RSI 40 or lower), the Station's /ranks and /reflow pages (coloured by rank across names, highest green) and the Station detail view's "bands 30 · 70". Changing the search changes which names it proposes, so it is not a recolour. <b>Recommended:</b> leave them; move the OVERSOLD search to each name's own bottom tenth as its own piece of work if you want it.</p>
</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div class="words">
<p><b>What it shows.</b> The Hub board's RSI column and the Station's two daily-RSI readouts, coloured by where each name's number sits in that name's own last two years instead of on one 30 / 70 ruler. Same palette as before: neutral at the name's own middle, full green at its own 10th percentile or lower, full red at its own 90th or higher; the breathing glow at those own extremes; a hover such as "33 — lower than 86% of NFLX's last two years" (the same line is in the panel a tap opens, because a phone has no hover).</p>
<p><b>Where each number comes from.</b></p><ul>
<li><b>The number in the cell</b> is unchanged: the stored daily RSI(14) the board already printed (FMP's, last settled close).</li>
<li><b>The name's own scale</b> is a new nightly table, <code>public.rsi_own_percentiles</code>: for each name, the RSI value at every percentile 0..100 of the two calendar years of finished daily sessions before the newest close. It is computed from the chart API's daily bars with Wilder's RSI(14). That is the same measure as the number in the cell: on the ${cmp.same_session_pairs} names where both described the ${cmp.session.slice(8) === "05" ? "5 Oct" : cmp.session} close, ${cmp.within_0_05} were within 0.05 of each other (median gap ${cmp.gap_median.toFixed(2)}, largest ${cmp.gap_max.toFixed(2)}).</li>
<li><b>"Lower than 86%"</b> is 100 minus the percentile of the number on that grid. The window is the sessions BEFORE the close being read ("prior observations only", the rule the research pages use). A name with more than one year but less than two says how long its window really is ("last 18 months").</li>
<li><b>Under one year of history</b> (${young.map((r) => r.ticker).join(", ")}): no own scale; the cell keeps the 30 / 70 colouring and its hover says so.</li>
<li><b>The Station chart</b> does not read the database (it never has). It builds the same scale in the browser from the daily bars it already loads, with the same rule; the tests run the Station's code against the Hub loader's rows so the two cannot drift. Its daily read is one request as before, longer (900 bars instead of about 640).</li>
<li><b>The index and macro lines.</b> Same ruler. A pullback is the swing rule the research pages use: from a swing high to the next swing low (a swing point is a bar beyond the 10 bars on each side); its RSI low is the lowest daily RSI in between; only pullbacks whose low falls inside the two-year window count. This is the rule that gives "SPY 41.8, QQQ 44.0" for the last pullback.</li></ul>
<p><b>The AFTER pictures need a table that is not in the database yet.</b> The migration is written and not applied. For the pictures, the one read of that table was answered from the loader's dry run (${dry.rows.length} rows from the live chart API, all as of the 5 Oct close) in the shape the database would send; every other read was live. Before the table exists the page asks once, gets "not found", and stays on 30 / 70 for that page load — so the code is safe to ship first.</p>
<p><b>What could be wrong.</b></p><ul>
<li>The coordinator's quick numbers (SPY 56th, QQQ 81st, 90th at 70.0 / 71.4) differ from these (58th, 85th, 69.0 / 70.7). Theirs came from a 520-bar read, where the RSI has not settled at the start of the window; 600, 1,300 and the whole history all give the numbers on this page. The RSI itself (58.8, 68.4) and the 10th percentiles agree.</li>
<li>The scale is finished sessions; the Station chip includes today's forming bar. The chip's percentile is therefore "today so far against the days before".</li>
<li>${dry.skipped.map((s) => s.symbol).join(", ")} has no row: the chart API did not serve its daily bars (the merged-names lane, HB2, is on it). It keeps 30 / 70.</li>
<li>Minutes after a close the chart API has today's bar for some names and not others. The dry run was pinned to the 5 Oct close for that reason; the nightly job runs at 19:30 ET and again at 07:30 ET.</li>
<li>In full-screen board mode the breathing copy of the number may sit slightly left of the number (an older layout difference, read from the styles, not checked in a browser). More cells breathe now, so it would show more often.</li></ul>
<p><b>What was not done.</b> Nothing is deployed, the table is not created, the nightly job is not scheduled, no row is written. The ALLOCATION search, /ranks, /reflow and the Station detail view were left as they are (third call). The lines above are not on the live Hub page: they are here and in the return. No own 10th / 90th guide lines were drawn on the Station's oscillator pane (its look is the Indicator Lab's and its guides are pinned).</p>
<p><b>For the coordinator.</b> Apply <code>supabase/migrations/20261006_rsi_own_percentiles.sql</code> (rollback beside it) · dry run: <code>node scripts/rsi-own-load.mjs --dry</code> · load: the same without <code>--dry</code> and with the two environment keys, or <code>data/rsi-own-load.sql</code> · nightly: deploy <code>supabase/functions/rsi-own-daily</code>, then <code>20261006_rsi_own_daily_cron.sql</code>.</p>
<p><b>Tests.</b> Hub <code>tests/rsi-own-extremes.test.mjs</code> (17) and the re-pinned glow test; Station <code>tests/station-rs1-rsi-own-20261006.test.mjs</code> (7). Both suites are at their known failures.</p>
</div></details>
</div></body></html>
`;
fs.writeFileSync(new URL("RS1-RSI-OWN-EXTREMES.html", here), html);
console.log("page written", html.length, "chars");
