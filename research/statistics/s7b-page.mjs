/* Writes deliverables/20260927/between-reports/BETWEEN-REPORTS.html from data/s7b-between.json.
   node research/statistics/s7b-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const d = JSON.parse(fs.readFileSync(path.join(here, "data/s7b-between.json"), "utf8"));
const outDir = path.join(root, "deliverables/20260927/between-reports");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "BETWEEN-REPORTS.html");

const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const f1 = (x) => x == null ? "—" : x.toFixed(1);
const f2 = (x) => x == null ? "—" : x.toFixed(2);
const dir = (x, mid = 0) => x == null ? "" : x > mid ? "up" : x < mid ? "dn" : "";
const pct = (x) => x == null ? "—" : `<span class="${dir(x)}">${x > 0 ? "+" : ""}${x.toFixed(2)}%</span>`;
const share = (x) => x == null ? "—" : `<span class="${dir(x, 50)}">${x.toFixed(1)}%</span>`;
const down = (x) => x == null ? "—" : `<span class="${dir(50, x)}">${x.toFixed(1)}%</span>`;   // share DOWN: above half is red
const ci = (c) => c?.[0] == null ? "" : `<span class="dim"> (${f1(c[0])}–${f1(c[1])})</span>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const lab = Object.fromEntries(d.factors.map((f) => [f.key, f.label])); lab.cloud = "Station cloud colours (13E≥21E, 21E≥50S, 50S≥200S)";
const plain = (key) => key.split(" + ").map((p) => { const [f] = p.split(" "); return `${esc(p)}<br><span class="dim">${esc(lab[f] || "")}</span>`; }).join("<br>");
const bar = (lift) => lift == null ? "" : `<span class="bar" title="lift ${f2(lift)}"><i style="width:${Math.min(lift, 4) / 4 * 100}%"></i></span>`;
const S = d.stretch_facts, base = d.rows[0], H = d.hindsight;

/* summary: for each factor, the bin with the highest lift at the hindsight low (among bins with ≥ 2% of ordinary sessions) */
const factorsAll = [...d.factors.map((f) => f.key), "cloud"];
const summaryRows = factorsAll.map((k) => {
  const L = d.lifts.all[k]; const cand = L.rows.filter((r) => r.ordinary >= 2);
  const top = [...cand].sort((a, b) => b.lift_best - a.lift_best)[0], topHigh = [...cand].sort((a, b) => b.lift_swingHigh - a.lift_swingHigh)[0];
  const m = d.medians[k];
  return `<tr><td><b>${esc(k)}</b><br><span class="dim">${esc(lab[k])}</span></td>
<td>${m ? f2(m.at_best_low) : "—"}<br><span class="dim">${m ? `${f2(m.best_q25)} to ${f2(m.best_q75)}` : ""}</span></td><td>${m ? f2(m.ordinary) : "—"}</td>
<td>${esc(top.bin)}<br><span class="dim">${f1(top.best)}% of lows · ${f1(top.ordinary)}% of days</span></td><td>${bar(top.lift_best)} ${f2(top.lift_best)}×</td>
<td>${f2(top.lift_swingLow)}×</td><td>${esc(topHigh.bin)} · ${f2(topHigh.lift_swingHigh)}×</td></tr>`;
}).join("");
const liftDetail = factorsAll.map((k) => { const L = d.lifts.all[k], D = d.lifts.discover[k], C = d.lifts.confirm[k];
  return `<details><summary><b>${esc(k)}</b> — ${esc(lab[k])} <span class="dim">(${n0(L.totals.ordinary)} ordinary closes, ${n0(L.totals.best)} hindsight lows, ${n0(L.totals.swingLow)} swing lows, ${n0(L.totals.swingHigh)} swing highs with a value)</span></summary>
<div class="scroll"><table><tr><th>Value</th><th>Ordinary closes</th><th>Hindsight lows</th><th>Lift at the hindsight low</th><th>2003–16 · 2017→</th><th>Swing lows · lift</th><th>Swing highs · lift</th></tr>
${L.rows.map((r, i) => `<tr><td>${esc(r.bin)}</td><td>${f1(r.ordinary)}%</td><td>${f1(r.best)}%</td><td>${bar(r.lift_best)} ${f2(r.lift_best)}×</td><td>${f2(D.rows[i].lift_best)}× · ${f2(C.rows[i].lift_best)}×</td><td>${f1(r.swingLow)}% · ${f2(r.lift_swingLow)}×</td><td>${f1(r.swingHigh)}% · ${f2(r.lift_swingHigh)}×</td></tr>`).join("")}
</table></div></details>`; }).join("\n");

const poolRows = d.pool.map((p) => `<tr><td><b>${esc(p.key)}</b><br><span class="dim">${esc(lab[p.factor] || "")}</span></td><td>${f1(p.cover)}%</td><td>${bar(p.lift_best)} ${f2(p.lift_best)}×</td><td>${f2(p.lift_swingLow)}×</td></tr>`).join("");
const rowOf = (k) => d.rows.find((r) => r.key === k);
const flagged = d.flagged.at65.map(rowOf).sort((a, b) => b.confirm.share_up - a.confirm.share_up);
const flagRows = flagged.map((r) => { const cd = r.clustering.discover, cc = r.clustering.confirm;
  return `<tr><td>${plain(r.key)}</td><td>${n0(r.discover.trades)}<br>${share(r.discover.share_up)}${ci(r.discover.ci95)}</td><td>${n0(r.confirm.trades)}<br>${share(r.confirm.share_up)}${ci(r.confirm.ci95)}</td>
<td>${pct(r.all.median)}<br><span class="dim">${pct(r.all.q25)} to ${pct(r.all.q75)}</span></td><td>${n0(cd.entry_months)} · ${n0(cc.entry_months)}</td><td>${f1(cd.top3_months_pct)}% · ${f1(cc.top3_months_pct)}%</td>
<td>${share(cd.share_up_month_weighted)} · ${share(cc.share_up_month_weighted)}</td><td>${share(r.all.to_report_close.share_up)} · ${pct(r.all.to_report_close.median)}</td><td>${share(r.all.to_five_after.share_up)} · ${pct(r.all.to_five_after.median)}</td></tr>`; }).join("");
const topRows = d.chosen_on_discover.map((c) => { const r = rowOf(c.key);
  return `<tr><td>${plain(r.key)}</td><td>${n0(r.discover.trades)}</td><td>${share(r.discover.share_up)}</td><td>${n0(r.confirm.trades)}</td><td>${share(r.confirm.share_up)}${ci(r.confirm.ci95)}</td><td>${pct(r.confirm.median)}</td><td>${n0(r.clustering.confirm.entry_months)}</td></tr>`; }).join("");
const singles = d.rows.filter((r) => r.size <= 1);
const singleRows = singles.map((r) => `<tr${r.size ? "" : ' class="base"'}><td>${r.size ? plain(r.key) : `<b>${esc(r.key)}</b>`}</td><td>${n0(r.all.trades)}<br><span class="dim">${f1(r.all.fire_rate)}% of stretches</span></td>
<td>${share(r.discover.share_up)}</td><td>${share(r.confirm.share_up)}</td><td>${pct(r.all.median)}</td><td>${r.all.median_held}</td><td>${share(r.all.same_stretches_from_start.share_up)}</td><td>${share(r.all.to_report_close.share_up)} · ${pct(r.all.to_report_close.median)}</td><td>${share(r.all.to_five_after.share_up)} · ${pct(r.all.to_five_after.median)}</td></tr>`).join("");

const snRows = d.sell_the_news.filter((s) => !s.missing).map((s) => `<tr${s.ticker === "NVDA" ? ' class="base"' : ""}><td><b>${esc(s.ticker)}</b><br><span class="dim">${s.cap_rank ? `#${s.cap_rank} by size` : ""}${s.target ? `${s.cap_rank ? " · " : ""}Station target` : ""}</span></td>
<td>${s.all.reports}</td><td>${down(s.all.news5_down)} → ${down(s.last8.news5_down)}</td><td>${pct(s.all.news5_median)} → ${pct(s.last8.news5_median)}</td><td>${down(s.all.day_down)} → ${down(s.last8.day_down)}</td><td>${down(s.all.after5_down)} → ${down(s.last8.after5_down)}</td></tr>`).join("");
const big = d.sell_the_news.filter((s) => !s.missing && s.cap_rank);
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const bigAll = avg(big.map((s) => s.all.news5_down)), bigLast = avg(big.map((s) => s.last8.news5_down));
const moreDown = big.filter((s) => s.last8.news5_down > s.all.news5_down).length;
const nv = d.sell_the_news.find((s) => s.ticker === "NVDA");
const nvDown = nv.last8_rows.filter((r) => r.news5 < 0).length;
const bestFlag = flagged[0];
const minMonths = Math.min(...flagged.map((r) => r.clustering.confirm.entry_months)), maxMonths = Math.max(...flagged.map((r) => r.clustering.confirm.entry_months));
const withSPY = flagged.filter((r) => r.key.includes("spy_pct")).length, withSince = flagged.filter((r) => r.key.includes("since")).length;
const pDown = bigAll / 100, choose = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
const p6of8 = [6, 7, 8].reduce((a, k) => a + choose(8, k) * pDown ** k * (1 - pDown) ** (8 - k), 0);
const sixOf8 = big.filter((s) => s.last8.news5_down >= 75).map((s) => s.ticker);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Between two reports · S7b · 27 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#A0A0B4;font:18px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#C0C0D2}h2{font-size:26px;margin:44px 0 8px;color:#C0C0D2}h3{font-size:20px;margin:24px 0 6px;color:#C0C0D2}
p,li{max-width:1050px}.lead{font-size:21px;color:#C0C0D2}.dim{color:#8A8A9E}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1050px;color:#C0C0D2}
code{font:14px ui-monospace,Menlo,monospace;color:#B4B4C8}
.scroll{overflow-x:auto;max-width:100%}.hint{display:none;font:13px ui-monospace,Menlo,monospace;color:#8A8A9E}
table{border-collapse:collapse;font-size:15px;margin:10px 0}th,td{border:1px solid #22222C;padding:7px 10px;text-align:left;vertical-align:top}th{color:#8A8A9E;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
tr.base td{background:#0E0E16}
details{margin:6px 0;max-width:1200px}summary{cursor:pointer;padding:6px 0;color:#B4B4C8}
.bar{display:inline-block;width:70px;height:8px;background:#16161E;border-radius:4px;vertical-align:middle;margin-right:6px}.bar i{display:block;height:8px;background:#70707E;border-radius:4px}
.up{color:#00FFA3}.dn{color:#FF2D55}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}.hint{display:block}table{font-size:13px}th,td{padding:5px 7px}code{overflow-wrap:anywhere}.bar{width:40px}}
</style></head><body>
<span data-scnav-slot></span><h1>Between two reports: what was true at the real lows</h1>
<p class="lead">This time the data picked the conditions. At the lowest close before each run into a report, a few things kept showing up. The stock's RSI was at the bottom of its own range. The close sat 3 or more usual days under its 13- or 21-day EMA. SPY was oversold too. And, surprisingly often, it was the first two sessions after the previous report. Rules built from these reached 65% winners in both halves of history (${d.flagged.at65.length} of them). None reached 70%. They also fire in only a few dozen market sell-offs.</p>
<div class="status"><b>STATUS · built and measured on real data.</b> ${n0(d.names)} names, ${n0(d.stretches)} stretches between two reports, 2003 to Sep 2026. ${d.combos_tested} rules were tried. The rules were chosen on 2003–2016 and then checked, untouched, on 2017 onward. <b>≥ 65% with ≥ ${d.min_trades} trades in both halves: ${d.flagged.at65.length}. ≥ 70%: ${d.flagged.at70.length}.</b> Nothing here predicts. It says what happened, how often, how big, and on how many trades.</div>

<h2>1 · The stretch between two reports</h2>
<ul>
<li><b>A stretch</b> runs from the first close after report k's news session to the last close before report k+1's news session. The news session is the first session that trades on the report (S6's rule: a report before the open → that day; after the close → the next day). A stretch is kept when it holds 20 to 90 closes. A longer gap means a report is missing from our list.</li>
<li>Only names with at least 8 listed reports in their own price history count. The history starts after the name's last hole of more than a year, which is the S6 rule.</li>
<li>A typical stretch holds <b>${S.median_len} sessions</b>. Buying the first close after a report and selling at the last close before the next one was up <b>${share(S.start_to_exit_up)}</b> of the time, with a middle return of <b>${pct(S.median_start_to_exit)}</b>. That is the benchmark every rule below has to beat.</li>
<li><b>The best entry in hindsight</b> is the lowest close of the stretch. It comes a median of <b>${S.median_best_since} sessions</b> after the report (half of them fall between ${f1(S.best_since_q25)} and ${f1(S.best_since_q75)}). From there to the last close before the report, the middle gain was <b>${pct(S.median_best_to_exit)}</b>. Holding through the report added little: ${pct(S.median_best_to_report_close)} to the report close, ${pct(S.median_best_to_after5)} five sessions later.</li>
<li><b>Swing lows and highs</b> are every low (or high) that is the extreme of the 5 sessions on each side of it. There are ${n0(d.lifts.all.since.totals.swingLow)} swing lows and ${n0(d.lifts.all.since.totals.swingHigh)} swing highs.</li>
</ul>
<p>The lows and highs are picked with hindsight on purpose: they mark where the turn really came. <b>Every factor, though, is read only from the bars up to that close</b>, so it is something you could have seen on the day.</p>

<h2>2 · What was true at the lows — the factors</h2>
<table>
<tr><th>Factor</th><th>How it is read (all from that close and earlier)</th></tr>
<tr><td>rsi · rsi_pct</td><td>RSI(14), Wilder's method. Also that RSI as a percentile of the name's own previous 756 sessions (3 years; at least 250 readings needed).</td></tr>
<tr><td>d13 · d21 · d50 · d200</td><td>The close compared with the Station's cloud lines: the 13- and 21-day EMA and the 50- and 200-day simple average. The EMAs are computed exactly as <code>station-clouds.js</code> does: started at the first close, weight 2/(n+1), not used for the first 60 sessions. Each distance is given in % and in <b>usual days</b> (the % distance ÷ the 60-session spread of daily moves).</td></tr>
<tr><td>cloud</td><td>The three cloud colours: is the 13E ≥ 21E, the 21E ≥ 50S, the 50S ≥ 200S? Written as three signs; <code>--+</code> means the two fast clouds are red and the slow one is green.</td></tr>
<tr><td>chan_pos</td><td>Where the close sits in the parallel channel: 0 = lower rail, 1 = upper rail, below 0 or above 1 = outside it. The channel is S7's port of your Pine APCh (method A, pivot 9, strict width check). It only counts when that channel is valid, which is ${f1(100 * d.lifts.all.chan_pos.totals.ordinary / d.lifts.all.since.totals.ordinary)}% of the closes.</td></tr>
<tr><td>reg_pos</td><td><b>An addition:</b> the same 0-to-1 reading in a straight-line channel fitted through the last 63 closes, with rails at ±2 times the scatter around the line. It is always there once 63 closes exist.</td></tr>
<tr><td>dd_ud</td><td>How far the close is below the highest high of the last 60 sessions, in usual days.</td></tr>
<tr><td>since</td><td>Sessions since the last report's news session (1 = the first close after it).</td></tr>
<tr><td>spy_pct</td><td>SPY's own RSI percentile on the same date — the market's state.</td></tr>
</table>
<p><b>Lift</b> is how much more often a value shows up at a low than on an ordinary day. An ordinary day here means any close of any stretch. Example: if 5% of ordinary closes have an own-RSI percentile under 5, but 38% of the hindsight lows do, the lift is about 7×. A lift of 1× means the value tells you nothing.</p>

<h3>The summary: one row per factor</h3>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table>
<tr><th>Factor</th><th>Middle value at the hindsight low (25% to 75%)</th><th>Middle value, ordinary closes</th><th>Value with the biggest lift at the low</th><th>Lift at the hindsight low</th><th>Same value, lift at swing lows</th><th>Biggest lift at swing HIGHS</th></tr>
${summaryRows}
</table></div>
<p><b>What the data says:</b></p>
<ul>
<li><b>The strongest signs of a low</b> were an RSI at the very bottom of the stock's own 3-year range, a close 3 or more usual days under the 13- or 21-day EMA, a close under the straight-line channel, and SPY oversold. Each showed up roughly 4 to 8 times more often at the hindsight low than on an ordinary day.</li>
<li><b>Swing highs are the mirror image:</b> own RSI at the top of its range, a close above the straight-line channel, and a close within one usual day of the 60-session high.</li>
<li><b>The first two sessions after a report</b> are the hindsight low ${f1(d.lifts.all.since.rows[0].best)}% of the time, against ${f1(d.lifts.all.since.rows[0].ordinary)}% of the days. That is the post-report drop. At ordinary swing lows the early sessions are <i>not</i> special (lift ${f2(d.lifts.all.since.rows[0].lift_swingLow)}×). So this is about the stretch's single deepest point, not about turns in general.</li>
<li><b>The clouds:</b> the lows sit mostly under red fast clouds (<code>--+</code>, <code>---</code>, about 2×). Under all-green clouds (<code>+++</code>) a hindsight low shows up at 0.4×, less than half as often as on an ordinary day.</li>
<li><b>The parallel channel</b> tells the same story more weakly than the straight-line channel. Below the lower rail the lift is ${f2(d.lifts.all.chan_pos.rows[0].lift_best)}×, against ${f2(d.lifts.all.reg_pos.rows[0].lift_best)}× below the straight-line channel. Part of the reason is that it exists on fewer days.</li>
</ul>
<h3>Every factor in full (all years; the discover and confirm lifts sit side by side)</h3>
${liftDetail}

<h2>3 · Rules the data suggested, and how they traded</h2>
<p><b>How the rules were found.</b> Every “below X” and “at or above X” cut of every factor, and every cloud state, was scored by its lift at the hindsight low. <b>Only 2003–2016 was used for this.</b> A cut had to cover between 3% and 50% of ordinary closes. The 12 with the biggest lift (at most two from any one family, such as the two short EMAs) form the pool. The trade is:</p>
<ul>
<li><b>Entry</b> at the close of the <b>first</b> session in the stretch where every part of the rule is true on that same session. If that never happens, there is no trade.</li>
<li><b>Exit (main)</b> at the last close before the report — no report risk is held. <b>Other exits:</b> the report session's close, and the close five sessions after it (to see “sell the news”).</li>
<li>“Up” means the exit close is above the entry close. No costs, no slippage, no stop.</li>
</ul>
<table><tr><th>Condition found</th><th>Share of ordinary closes</th><th>Lift at the hindsight low (2003–16)</th><th>Lift at swing lows</th></tr>${poolRows}</table>
<p>That gives ${d.pool.length} single rules, plus every pair and triple drawn from different families: ${d.combos_tested} in all.</p>

<h3>Flagged: ≥ 65% up with ≥ ${d.min_trades} trades in both 2003–2016 and 2017 onward</h3>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table>
<tr><th>Rule</th><th>2003–16 trades · share up</th><th>2017→ trades · share up</th><th>Middle return, all years (25% to 75%)</th><th>Distinct entry months (03–16 · 17→)</th><th>Trades in the 3 busiest months</th><th>Share up if every month counts once</th><th>Out at report close</th><th>Out 5 sessions after</th></tr>
${flagRows}
</table></div>
<p><b>How to read it — and why the flags need care:</b></p>
<ul>
<li>${withSPY === flagged.length ? "Every one" : `${withSPY}`} of the ${flagged.length} flagged rules needs <b>SPY oversold</b> (its RSI in its own bottom 10%), and ${withSince} of them also need the <b>first two sessions after a report</b>. In practice that means: buy a name that sold off on its report while the whole market is washed out, and hold until the next report.</li>
<li>Because the market has to be oversold, the trades bunch on the same few weeks: Aug 2011, Oct 2008, Oct 2018, May 2022, Oct 2023. From 2017 onward each flagged rule enters in only <b>${minMonths} to ${maxMonths} distinct months</b>. Its three busiest months carry up to 42% of its trades. So a “200-trade” rule is really a few dozen market episodes. The ± range in the table treats every trade as independent, so it is too narrow.</li>
<li>If every month counts once, the flagged rules still win 62% to 71% of the time from 2017 onward. The pattern held across both halves. But it is thin, and <b>none reached 70% in the later half</b>. The best, <code>${esc(bestFlag.key)}</code>, went from ${f1(bestFlag.discover.share_up)}% (2003–16) to ${f1(bestFlag.confirm.share_up)}% (2017→).</li>
<li>Holding through the report changed little for these rules (the last two columns).</li>
</ul>

<h3>The 20 best on 2003–2016, and what they did afterwards</h3>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table><tr><th>Rule</th><th>2003–16 trades</th><th>2003–16 share up</th><th>2017→ trades</th><th>2017→ share up</th><th>2017→ middle</th><th>2017→ entry months</th></tr>${topRows}</table></div>
<p>Every one of the 20 lost ground from the first half to the second. That is the usual sign that part of the first-half number was luck. It is exactly why the rules were chosen on one half and read on the other.</p>

<h3>One condition at a time (and the benchmark)</h3>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table><tr><th>Rule</th><th>Trades</th><th>2003–16 share up</th><th>2017→ share up</th><th>Middle return</th><th>Held (sessions)</th><th>Same stretches, bought at the start</th><th>Out at report close</th><th>Out 5 sessions after</th></tr>${singleRows}</table></div>
<p>For comparison, the <b>perfect hindsight entry</b> (the lowest close) wins ${f1(H.all.share_up)}% with a middle return of ${pct(H.all.median)}. That is the ceiling no rule can reach.</p>

<h2 id="sell-the-news">4 · Sell the news — Alan's NVIDIA observation, measured</h2>
<p>For the 30 largest names we hold (by market cap in the 26 Sep export) and the eight Station targets, the table gives the share of reports followed by a <b>drop</b>. The last 8 reports sit beside all history. The main measure is the move from the last close before the report to the close of the 4th session after the news session, which is the news day plus the next 4 sessions. Red means more than half fell.</p>
<p><b>NVIDIA:</b> ${nvDown} of its last 8 reports were followed by a drop over those 5 sessions (${f1(nv.last8.news5_down)}%). Over its whole history the rate is ${f1(nv.all.news5_down)}%, across ${nv.all.reports} reports. The news day alone fell ${f1(nv.last8.day_down)}% of the time over its last 8 reports, against ${f1(nv.all.day_down)}% over all its history. So the observation holds. <b>Across the 30 largest</b>, the average share that fell was ${f1(bigAll)}% over all history and ${f1(bigLast)}% over the last 8 reports. ${moreDown} of the 30 fell more often lately. Eight reports is a small sample. If each report fell with the average chance of ${f1(bigAll)}%, 6 or more drops out of 8 would happen about 1 time in ${Math.round(1 / p6of8)}. Among these 30 names it happened ${sixOf8.length} times (${sixOf8.join(", ")}), roughly what chance alone would give (${f1(30 * p6of8)}). So NVIDIA's recent run is real, but on its own it is not proof of a lasting habit.</p>
<p class="hint">swipe the table sideways →</p>
<div class="scroll"><table><tr><th>Name</th><th>Reports</th><th>Fell over news day + 4 · all → last 8</th><th>Middle move · all → last 8</th><th>News day fell · all → last 8</th><th>Fell in the 5 sessions after the news day · all → last 8</th></tr>${snRows}</table></div>
<p class="dim">GOOG and GOOGL are the same company and are both listed. NBIS has only ${d.sell_the_news.find((s) => s.ticker === "NBIS")?.all.reports ?? "—"} reports, so its “last 8” is its whole history.</p>

<h2>Where each number comes from</h2>
<ul>
<li><b>Prices:</b> the finished daily bars that the chart API (<code>scintilla-massive-chart-api.fly.dev</code>) served on 27 Sep. S7 saved them, and this study reused that same bar cache (332 files, including SPY). Nothing was fetched again and nothing was written to any database.</li>
<li><b>Report dates and times:</b> <code>research/statistics/data/earnings-export-with-estimates-20260926.json</code>, the same export S6 and S7 used. <b>Sizes:</b> <code>meta-cohorts-caps-20260926.json</code>.</li>
<li><b>Code:</b> <code>research/statistics/between.mjs</code> (the factors and rules), <code>s7b-between.mjs</code> (the run), <code>s7b-page.mjs</code> (this page). Every number above is in <code>research/statistics/data/s7b-between.json</code>. Tests with fixtures: <code>tests/statistics-s7b-between.test.mjs</code>. One of them changes the future bars and checks that no earlier reading moves.</li>
</ul>

<h2>What could be wrong</h2>
<ul>
<li><b>Survivors only:</b> these are today's names. Companies that fell apart are missing, which flatters “buy the low”.</li>
<li><b>Bunching on the same dates:</b> this matters most for the flagged rules (see above). The 95% ranges are too narrow.</li>
<li><b>Many tries:</b> ${d.combos_tested} rules were tried. The split into two halves is the guard against luck, and every top rule slipped in the second half.</li>
<li><b>Report dates:</b> a report missing from the export merges two stretches into one. Stretches over 90 sessions are dropped for that reason. A report with no time is treated as after the close.</li>
<li><b>The parallel channel</b> is a port of your Pine script onto daily bars, counted in sessions rather than clock time. It is not a pixel copy of TradingView's drawing.</li>
<li><b>“The lowest close” and the swing points</b> use later bars by design. The <i>rules</i> never do: they enter at the first close where the condition is visible.</li>
</ul>

<h2>What I did not do</h2>
<ul>
<li>No push, no deploy, no database write, no paid model call. The bars were not fetched again.</li>
<li>No costs, slippage, stops or position sizing. No test of rules within a single name — everything is pooled across names.</li>
<li>S7's channel code was not changed; I used it as it is. The straight-line channel is added alongside it, not in place of it.</li>
</ul>
<p class="dim">Built ${esc(d.built_utc.slice(0, 16).replace("T", " "))} UTC · branch hub/stats-s7b-20260927</p>
</body></html>
`;
fs.writeFileSync(outFile, html);
console.log(outFile, html.length);
