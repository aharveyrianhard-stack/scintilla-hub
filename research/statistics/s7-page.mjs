/* Writes deliverables/20260927/entry-confluence/ENTRY-CONFLUENCE.html from data/s7-entries.json.
   node research/statistics/s7-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const d = JSON.parse(fs.readFileSync(path.join(here, "data/s7-entries.json"), "utf8"));
const outDir = path.join(root, "deliverables/20260927/entry-confluence");
const outFile = path.join(outDir, "ENTRY-CONFLUENCE.html");

const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const f1 = (x) => x == null ? "—" : x.toFixed(1);
const dir = (x, mid = 0) => x == null ? "" : x > mid ? "up" : x < mid ? "dn" : "";
const pct = (x) => x == null ? "—" : `<span class="${dir(x)}">${x > 0 ? "+" : ""}${x.toFixed(2)}%</span>`;
const share = (x) => x == null ? "—" : `<span class="${dir(x, 50)}">${x.toFixed(1)}%</span>`;
const ci = (c) => c[0] == null ? "" : `<span class="dim"> (${f1(c[0])}–${f1(c[1])})</span>`;
const label = Object.fromEntries(d.triggers.map((t) => [t.key, t.label]));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const base = d.rows[0];
const singles = d.rows.filter((r) => r.size === 1);
const multi = d.rows.filter((r) => r.size >= 2);
const top = multi.filter((r) => r.report.discover.trades >= d.min_trades).sort((a, b) => b.report.discover.share_up - a.report.discover.share_up).slice(0, 15);
const bestAll = multi.filter((r) => r.report.all.trades >= d.min_trades).sort((a, b) => b.report.all.share_up - a.report.all.share_up)[0];
const ordShares = singles.map((r) => r.ordinary.all.share_up), gaps = singles.map((r) => r.report.all.share_up - r.ordinary.all.share_up);
const gapBest = bestAll.report.all.share_up - bestAll.ordinary.all.share_up;
const smallHeld = d.confluence.small_samples_at65.filter((r) => r.confirm.share_up >= 65).length;
const heldUpTop = top.filter((r) => r.report.confirm.share_up >= r.report.discover.share_up - 2).length;

const singleRow = (r) => { const a = r.report.all, o = r.ordinary.all;
  return `<tr><td><b>${esc(r.key)}</b><br><span class="dim">${esc(label[r.key] || "enter at the window's first close, the S6 way")}</span></td>
<td>${n0(a.trades)}<br><span class="dim">${f1(a.fire_rate)}% of windows</span></td><td>${share(a.share_up)}${ci(a.ci95)}</td><td>${pct(a.median)}<br><span class="dim">${pct(a.q25)} to ${pct(a.q75)}</span></td>
<td>${f1(a.median_usual_days)}</td><td>${a.median_held}</td><td>${share(a.same_reports_window_start.share_up)}<br><span class="dim">${pct(a.same_reports_window_start.median)}</span></td>
<td>${share(o.share_up)}<br><span class="dim">${pct(o.median)} · ${n0(o.trades)}</span></td><td>${share(a.to_report_close.share_up)} · ${pct(a.to_report_close.median)}</td><td>${share(a.to_five_after.share_up)} · ${pct(a.to_five_after.median)}</td></tr>`; };
const splitRow = (r) => { const a = r.report.discover, b = r.report.confirm, o = r.ordinary.confirm;
  return `<tr><td><b>${esc(r.key)}</b></td><td>${n0(a.trades)}</td><td>${share(a.share_up)}${ci(a.ci95)}</td><td>${pct(a.median)}</td><td>${n0(b.trades)}</td><td>${share(b.share_up)}${ci(b.ci95)}</td><td>${pct(b.median)}</td><td>${share(o.share_up)} · ${pct(o.median)}</td></tr>`; };
const smallRows = d.confluence.small_samples_at65.map((r) => `<tr><td><b>${esc(r.key)}</b></td><td>${n0(r.discover.trades)}</td><td>${share(r.discover.share_up)}</td><td>${n0(r.confirm.trades)}</td><td>${share(r.confirm.share_up)}</td></tr>`).join("");
const promoted = (thr) => d.confluence[`at${thr}`];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>A better entry before the report · S7 · 27 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#A0A0B4;font:18px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#C0C0D2}h2{font-size:26px;margin:44px 0 8px;color:#C0C0D2}h3{font-size:20px;margin:24px 0 6px;color:#C0C0D2}
p,li{max-width:1050px}.lead{font-size:21px;color:#C0C0D2}.dim{color:#8A8A9E}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1050px;color:#C0C0D2}
code,pre{font:14px ui-monospace,Menlo,monospace;color:#B4B4C8}pre{background:#0E0E16;border:1px solid #22222C;padding:12px 14px;overflow-x:auto;max-width:1050px;white-space:pre-wrap;word-break:break-word}
.scroll{overflow-x:auto;max-width:100%}.hint{display:none;font:13px ui-monospace,Menlo,monospace;color:#8A8A9E}
table{border-collapse:collapse;font-size:15px;margin:10px 0}th,td{border:1px solid #22222C;padding:7px 10px;text-align:left;vertical-align:top}th{color:#8A8A9E;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
tr.base td{background:#0E0E16}
.up{color:#00FFA3}.dn{color:#FF2D55}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}.hint{display:block}table{font-size:13px}th,td{padding:5px 7px}code{overflow-wrap:anywhere}}
</style></head><body>
<span data-scnav-slot></span><h1>Does a better entry before the report raise the odds?</h1>
<p class="lead">Not by much. Waiting inside the 20 sessions for an RSI low, an average, a level, a drawdown or a channel rail — alone or two or three together — did not lift the share of winning trades to 65%. The best rule with at least ${d.min_trades} trades reached ${f1(bestAll.report.all.share_up)}%. What a trigger does do is pick a better price on the reports where it fires.</p>
<div class="status"><b>STATUS · built and measured on real data.</b> ${n0(d.names)} names, ${n0(d.report_windows)} past reports, ${n0(d.ordinary_windows)} ordinary windows for comparison, ${d.combos_tested} rules tried. No pair or triple reached 65% (or 70%) up with at least ${d.min_trades} trades on the discover years. Nothing here predicts; it says what happened, how often, how big, and on how many trades.</div>

<h2>How a trade is modelled</h2>
<p>Alan asked how entry and exit work, since “price is higher” is not a trade. Here is the whole rule:</p>
<ul>
<li><b>The window.</b> The 20 sessions before the first session that trades on the report (S6's definition: before the open → that day, after the close → the next day).</li>
<li><b>Entry.</b> At the <b>close</b> of the <b>first</b> session in the window where the trigger is true. The window start is one of the candidates, so the S6 number is the trigger “always true”. If the trigger never fires, there is no trade for that report.</li>
<li><b>Exit (main).</b> The last close before the report — no report risk is held.</li>
<li><b>Exit (other two).</b> The close of the report session, and the close five sessions after it.</li>
<li><b>“Up”</b> means the exit close is above the entry close. No costs, no slippage, no stop.</li>
<li><b>Pairs and triples</b> mean every part is true <i>on the same session</i>.</li>
<li><b>Everything is read from bars up to the entry close.</b> A pivot counts only after the 10 (or 9) bars that confirm it have closed.</li>
</ul>

<h2>The triggers</h2>
<p>All thresholds are per name, from its own history, never a number shared by every stock.</p>
<table>
<tr><th>Trigger</th><th>Exact rule</th></tr>
<tr><td>rsi&lt;20 / &lt;30 / &lt;40</td><td>RSI(14) today, as a percentile of the name's own previous 756 sessions (3 years; needs 250 readings), below 20 / 30 / 40.</td></tr>
<tr><td>ma20 / ma50 / ma100 / ma200</td><td>The day's low is within 1% of the simple average (either side) and the close is above it.</td></tr>
<tr><td>dd1 / dd2 / dd3</td><td>H = highest high of the last 60 sessions, n = sessions since that high (at least 1). Drop = close ÷ H − 1. <b>Scaled drop = drop ÷ (usual day × √n)</b>, where the usual day is the 60-session spread of daily moves. Fires when the scaled drop is −1, −2 or −3 or worse. A stock that usually moves 2% a day, 9 sessions after its high, needs a drop of 6% for dd1 (2% × √9 × 1) and 12% for dd2.</td></tr>
<tr><td>level</td><td>A pivot high or pivot low (10 bars each side, the window of the S/R Pivot atom) from the last 120 sessions. Fires when the low is within 1% of it and the close is above it.</td></tr>
<tr><td>rail</td><td>The lower rail of a parallel channel, drawn the way Alan's Pine script draws it (below). Fires when a valid, unbroken channel exists, the low is within 1% of the lower rail and the close is on or above it.</td></tr>
</table>

<h2>One trigger at a time</h2>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table>
<tr><th>Trigger</th><th>Trades</th><th>Share up (95% range)</th><th>Middle return<br>25% to 75%</th><th>Usual days</th><th>Held (sessions)</th><th>Same reports, entered at window start</th><th>Ordinary windows, same trigger</th><th>Out at report close</th><th>Out 5 sessions after</th></tr>
<tr class="base">${singleRow(base).slice(4)}
${singles.map(singleRow).join("\n")}
</table></div>
<h3>How to read it</h3>
<ul>
<li><b>Share up hardly moves.</b> Entering at the window start won ${f1(base.report.all.share_up)}% of the time. Every single trigger lands between ${f1(Math.min(...singles.map((r) => r.report.all.share_up)))}% and ${f1(Math.max(...singles.map((r) => r.report.all.share_up)))}%. The middle return is <i>smaller</i> for every trigger, partly because the trade is held fewer sessions.</li>
<li><b>But on the reports where it fires, the trigger's price is better.</b> Take rsi&lt;20: on those same reports, entering at the window start won only ${f1(singles.find((r) => r.key === "rsi<20").report.all.same_reports_window_start.share_up)}% of the time; waiting for the RSI low won ${f1(singles.find((r) => r.key === "rsi<20").report.all.share_up)}%. That is a better entry on a worse set of reports — the ones that sold off first. It does not beat simply buying at the start of every window.</li>
<li><b>The report still matters.</b> The same trigger on ordinary, report-free windows wins ${f1(Math.min(...ordShares))}% to ${f1(Math.max(...ordShares))}% of the time, ${f1(Math.min(...gaps))} to ${f1(Math.max(...gaps))} points less (window start: ${f1(base.report.all.share_up - base.ordinary.all.share_up)} points). That gap is roughly the same with or without the trigger.</li>
<li><b>Holding through the report</b>: from the window start, out at the report close won ${f1(base.report.all.to_report_close.share_up)}% (middle ${pct(base.report.all.to_report_close.median)}), out five sessions after won ${f1(base.report.all.to_five_after.share_up)}% (middle ${pct(base.report.all.to_five_after.median)}), against ${f1(base.report.all.share_up)}% out before the report.</li>
</ul>

<h2>Two and three together (the confluence screen)</h2>
<p>${d.combos_tested - singles.length} pairs and triples were tried, each from different families (two RSI levels together say nothing new). To stop us fooling ourselves with that many tries, rules were <b>chosen on ${esc(d.split.discover)}</b> and then <b>read, untouched, on ${esc(d.split.confirm)}</b>.</p>
<div class="status">Reaching 65% up with at least ${d.min_trades} trades on the discover years: <b>${promoted(65).length ? promoted(65).map((r) => esc(r.key)).join(", ") : "none"}</b>. Reaching 70%: <b>${promoted(70).length ? promoted(70).map((r) => esc(r.key)).join(", ") : "none"}</b>. Over all years together, 65%: <b>${d.confluence.all_period_at65.length ? d.confluence.all_period_at65.join(", ") : "none"}</b>.</div>
<h3>The 15 best on the discover years, and what they did afterwards</h3>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table>
<tr><th>Rule</th><th>Discover trades</th><th>Discover share up</th><th>Discover middle</th><th>Confirm trades</th><th>Confirm share up</th><th>Confirm middle</th><th>Ordinary windows, confirm years</th></tr>
${top.map(splitRow).join("\n")}
</table></div>
<p>${heldUpTop} of these 15 kept their discover share (within 2 points) on the confirm years. The strongest, <b>${esc(bestAll.key)}</b> (${esc(bestAll.parts.map((p) => label[p]).join(" + "))}), won ${f1(bestAll.report.all.share_up)}% over all years on ${n0(bestAll.report.all.trades)} trades, against ${f1(bestAll.ordinary.all.share_up)}% for the same rule on ordinary windows. That ${f1(gapBest)}-point gap to ordinary windows is the most interesting line on this page, but it is still under 65%, and ${f1(bestAll.report.all.fire_rate)}% of reports produce the trade.</p>
<h3>Rules that looked great on too few trades</h3>
<p>These cleared 65% on the discover years with 50 to ${d.min_trades - 1} trades. They are shown so nothing is hidden. ${smallHeld} of ${d.confluence.small_samples_at65.length} stayed at 65% or more on the confirm years.</p>
<table><tr><th>Rule</th><th>Discover trades</th><th>Discover share up</th><th>Confirm trades</th><th>Confirm share up</th></tr>${smallRows || '<tr><td colspan="5">none</td></tr>'}</table>

<h2>The parallel channels</h2>
<p>Alan's script is <code>INDICATOR_LAB/SCINTILLA_Parallel_Channels_Additive_Stack_V1.pine</code> (read, not changed). It stacks four channel methods. The one ported here is <b>method A, “APCh · Auto Parallel Channels (HTF)”</b>, because it is the plain “two pivot highs, two pivot lows → two rails” construction:</p>
<ul>
<li>a pivot high or low needs 9 bars on each side (the script's default);</li>
<li>the upper rail runs through the two most recent pivot highs, the lower rail through the two most recent pivot lows;</li>
<li>the pair counts as a channel only if its width changes by less than 35% over one upper-rail span (the script's “width-drift tolerance”, strict);</li>
<li>a close above the upper rail or below the lower rail breaks it until the next pivot appears.</li>
</ul>
<p><b>Differences from the Pine:</b> the slope is per trading session rather than per clock second (so weekends add no slope), and only the daily copy is used (the script also draws 4-hour and weekly copies). Methods B, C and D of the stack were not ported. Three hand-worked channels are in the tests: a rising parallel channel (slope 0.5 a bar, width 7), a pair whose rails spread too fast (rejected), and a close under the lower rail that breaks the channel until the next pivot.</p>

<h2>Where each number comes from</h2>
<table>
<tr><th>Number</th><th>Source</th></tr>
<tr><td>Prices</td><td>The chart API's daily bars (<code>/candles?tf=D&amp;limit=6000</code>), fetched once on 27 Sep and cached outside the repo. ${n0(d.missing_bars.length)} listed names had no usable bars: ${esc(d.missing_bars.join(", "))}.</td></tr>
<tr><td>Which reports</td><td><code>research/statistics/data/earnings-export-with-estimates-20260926.json</code> (already exported; read only), measured by the unchanged S6 code (<code>runupStudy</code>). The count is ${n0(d.report_windows)} here against 19,382 in S6b, because the bars were fetched again a day later and a few names gained history.</td></tr>
<tr><td>Triggers, trades</td><td><code>research/statistics/entries.mjs</code>, run by <code>research/statistics/s7-entries.mjs</code>; output <code>research/statistics/data/s7-entries.json</code>. Checked in <code>tests/statistics-s7-entries.test.mjs</code>.</td></tr>
<tr><td>95% range</td><td>Wilson interval on the share up, treating trades as independent (they are not — see below).</td></tr>
</table>

<h2>What could be wrong</h2>
<ul>
<li><b>Survivors only.</b> Today's names. Companies that fell out of the list are missing, which flatters every row, the baseline included.</li>
<li><b>Trades are not independent.</b> Many names report in the same weeks and move with the market, so the true uncertainty is wider than the ranges shown.</li>
<li><b>Held-for differs.</b> A trade that enters later is held fewer sessions, which by itself pulls the middle return toward zero.</li>
<li><b>Ordinary windows overlap</b> (a new one every 5 sessions) and start only between a name's first and last listed report.</li>
<li><b>Choices were mine.</b> 1% touch band, 10-bar pivots for levels, 120-session lookback, 60-session high, √n scaling. Other choices give other numbers; the discover/confirm split is the guard.</li>
<li><b>The channel port</b> matches the Pine's logic, not a TradingView screen; it was not compared line-by-line against a live chart.</li>
</ul>

<h2>What was not done</h2>
<ul>
<li>No push, no deploy, no database write. Nothing on the Hub changed.</li>
<li>No stops, targets, position sizes or costs.</li>
<li>Resistance as a short entry was not tested; every trade here is long.</li>
<li>Channel methods B, C and D and the 4-hour / weekly copies were not ported.</li>
</ul>
<p class="dim">Built ${esc(d.built_utc)} · branch hub/stats-s7-20260927.</p>
</body></html>
`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log(outFile);
