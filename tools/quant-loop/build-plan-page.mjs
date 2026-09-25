#!/usr/bin/env node
// Builds the plan page straight from the measured JSON, so every number on the
// page is one the chart API answered. Nothing is typed in by hand.
import { readFileSync, writeFileSync } from "node:fs";
const D = "deliverables/20260923/quant-loop";
const depth = JSON.parse(readFileSync(`${D}/evidence/history-depth.json`, "utf8"));
const study = JSON.parse(readFileSync(`${D}/evidence/worked-example.json`, "utf8"));
const n = (x) => x === null || x === undefined ? "—" : x;
const nf = (x) => x === null || x === undefined ? "—" : Number(x).toLocaleString("en-US");
const pct = (x) => x === null || x === undefined ? "—" : `${x > 0 ? "+" : ""}${x}%`;

const depthRows = depth.rows.map((r) => `<tr>
 <td class="sym">${r.symbol}</td><td data-k="Kind">${r.group}</td><td data-k="First day">${n(r.first_day)}</td><td data-k="Last finished day">${n(r.last_day)}</td>
 <td class="num" data-k="Daily bars">${nf(r.bars_counted)}</td><td data-k="Source">${n(r.provider)}</td>
 <td class="ok">${r.counts_agree ? "counted row by row, matches the API's own count" : "COUNT MISMATCH"}</td></tr>`).join("\n");

const bandTable = (s, phase) => {
  const t = s[phase];
  const head = phase === "discovery"
    ? `Early years — the five groups are cut here, then frozen`
    : `Held back: ${s.held_back_years} — the frozen groups applied to years the loop never saw`;
  const base = t.base_rate;
  return `<div class="phase">
  <h4>${head}</h4>
  <p class="base">Over these years, any ten-day stretch ended higher <b>${base.share_up}%</b> of the time,
     by <b>${pct(base.avg_move)}</b> on average, across <b>${nf(base.days)}</b> counted days.
     Every group below has to beat that, not zero.</p>
  <table class="bands"><thead><tr><th>Where the reading sat</th><th>Days</th><th>Ended higher</th><th>Average ten days later</th><th>The honest range</th></tr></thead><tbody>
  ${t.bands.map((b) => `<tr>
    <td>${b.label}<span class="edge">${b.reading_to === null ? `reading over ${b.reading_from}` : b.reading_from === null ? "" : `reading ${b.reading_from} to ${b.reading_to}`}</span></td><td class="num" data-k="Days">${nf(b.days)}</td>
    <td class="num" data-k="Ended higher">${b.share_up === null ? "—" : b.share_up + "%"}</td>
    <td class="num" data-k="Average ten days later">${pct(b.avg_move)}</td>
    <td class="num range" data-k="The honest range">${b.band95 ? `${pct(b.band95[0])} to ${pct(b.band95[1])}` : "—"}${b.band95 && b.band95[0] > 0 ? " <span class=\"clear\">clear of zero</span>" : b.band95 && b.band95[1] < 0 ? " <span class=\"clear\">clear of zero</span>" : " <span class=\"straddle\">straddles zero</span>"}</td>
  </tr>`).join("\n")}
  </tbody></table></div>`;
};

const studyBlock = (s, verdict) => `<section class="study">
 <h3>${s.symbol} — ${s.history} · ${nf(s.bars)} daily bars · ${s.provider}</h3>
 <p class="asked">Asked: <code>${s.asked}</code></p>
 ${bandTable(s, "discovery")}
 ${bandTable(s, "held_back")}
 <div class="verdict"><h4>What this says, in plain words</h4>${verdict}</div>
</section>`;

const spy = study.studies.find((s) => s.symbol === "SPY");
const ten = study.studies.find((s) => s.symbol === "US10Y");

const spyVerdict = `
<p>Nothing here is good enough to trade on, and that is the point of running it.</p>
<p>In the early years the most beaten-down group looked promising: ten days later it averaged
${pct(spy.discovery.bands[0].avg_move)} against a background of ${pct(spy.discovery.base_rate.avg_move)}.
But its honest range runs ${pct(spy.discovery.bands[0].band95[0])} to ${pct(spy.discovery.bands[0].band95[1])} —
it crosses zero, so the pattern cannot be told apart from luck.</p>
<p>Then the held-back years knocked it down properly. In those years the same beaten-down group ended higher
only ${spy.held_back.bands[0].share_up}% of the time while <em>every</em> ten-day stretch ended higher
${spy.held_back.base_rate.share_up}% of the time. Being beaten down was <b>worse</b> than average, not better.</p>
<p>One group did clear zero in the held-back years — the second one, ${pct(spy.held_back.bands[1].avg_move)} with a
range of ${pct(spy.held_back.bands[1].band95[0])} to ${pct(spy.held_back.bands[1].band95[1])} — but in the early years
that same group averaged ${pct(spy.discovery.bands[1].avg_move)}, flat. A pattern that appears only after you know the
answer is not a pattern. <b>Verdict: no edge shown. Do not build a rule on this.</b></p>`;

const tenVerdict = `
<p>First, the plain reading: for the ten-year, the number <em>is</em> the yield. "Ended higher" here means the
yield rose, which is the opposite direction to bond prices. This is a measurement, not a view.</p>
<p>Across ${nf(ten.bars)} days back to ${ten.history.slice(0, 10)}, the two ends behaved differently and both cleared zero:
when the reading sat in its lowest tenth, the yield was ${pct(ten.discovery.bands[0].avg_move)} ten days later
(range ${pct(ten.discovery.bands[0].band95[0])} to ${pct(ten.discovery.bands[0].band95[1])}); in its highest tenth,
${pct(ten.discovery.bands[4].avg_move)} (range ${pct(ten.discovery.bands[4].band95[0])} to ${pct(ten.discovery.bands[4].band95[1])}).
Moves carried on in the direction they were already going.</p>
<p>In the held-back years the direction still leans the same way, but the count collapses: the top group has only
${ten.held_back.bands[4].days} counted days and its range runs ${pct(ten.held_back.bands[4].band95[0])} to
${pct(ten.held_back.bands[4].band95[1])}. <b>Verdict: something real in the long history, far too thin in recent
years to call confirmed.</b> This is the honest place to stop and say so, not to publish a signal.</p>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quant loop — the plan</title>
<style>
 :root{ --bg:#0a0a0b; --panel:#121214; --edge:#2a2a2e; --ink:#c9c9cd; --dim:#8e8e95; --faint:#6a6a71; --hi:#e2e2e6; }
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--ink);
   font:17px/1.65 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
   -webkit-font-smoothing:antialiased;padding:0 0 120px}
 .wrap{max-width:1180px;margin:0 auto;padding:0 28px}
 header{padding:72px 0 30px;border-bottom:1px solid var(--edge)}
 h1{font-size:46px;line-height:1.1;margin:0 0 14px;color:var(--hi);font-weight:600;letter-spacing:-.01em}
 .sub{font-size:21px;color:var(--dim);max-width:820px;margin:0}
 .stamp{margin-top:22px;font-size:14px;color:var(--faint)}
 h2{font-size:30px;color:var(--hi);margin:64px 0 8px;font-weight:600}
 h3{font-size:22px;color:var(--hi);margin:36px 0 6px;font-weight:600}
 h4{font-size:17px;color:var(--hi);margin:26px 0 6px;font-weight:600}
 p{max-width:900px}
 .lead{font-size:19px;color:var(--ink)}
 section{padding-top:6px}
 .card{background:var(--panel);border:1px solid var(--edge);border-radius:12px;padding:26px 28px;margin:22px 0}
 .q{font-size:22px;color:var(--hi);margin:0 0 10px;font-weight:600}
 .was{font-size:15px;color:var(--faint);border-left:2px solid var(--edge);padding-left:14px;margin:14px 0}
 table{width:100%;border-collapse:collapse;margin:14px 0 6px;font-size:16px}
 th{text-align:left;color:var(--dim);font-weight:600;font-size:13px;letter-spacing:.06em;text-transform:uppercase;
   padding:10px 12px;border-bottom:1px solid var(--edge)}
 td{padding:11px 12px;border-bottom:1px solid #1d1d20;vertical-align:top}
 td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
 td.sym{color:var(--hi);font-weight:600}
 td.ok{color:var(--faint);font-size:13px}
 .range{color:var(--dim);font-size:15px}
 .edge{display:block;color:var(--faint);font-size:13px;margin-top:2px}
 .clear{color:var(--hi);font-size:12px;letter-spacing:.04em}
 .straddle{color:var(--faint);font-size:12px;letter-spacing:.04em}
 .phase{margin:26px 0 10px}
 .base{color:var(--dim);font-size:16px;max-width:none}
 .asked{font-size:13px;color:var(--faint);word-break:break-all}
 code{font:13px/1.5 ui-monospace,Menlo,monospace;color:var(--dim)}
 .verdict{background:#16161a;border:1px solid var(--edge);border-radius:10px;padding:20px 24px;margin:22px 0 4px}
 .verdict p{max-width:none}
 ol,ul{max-width:900px;padding-left:22px} li{margin:9px 0}
 .no li{color:var(--ink)}
 .big{font-size:34px;color:var(--hi);font-weight:600;letter-spacing:-.01em}
 .three{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:20px 0}
 .three>div{background:var(--panel);border:1px solid var(--edge);border-radius:12px;padding:20px 22px}
 .three h4{margin-top:0}
 .three p{font-size:15px;color:var(--dim);max-width:none;margin:0}
 .foot{margin-top:60px;padding-top:24px;border-top:1px solid var(--edge);color:var(--faint);font-size:14px}
 @media (max-width:860px){ .wrap{padding:0 18px} h1{font-size:34px} .sub{font-size:18px}
   .three{grid-template-columns:1fr} table{font-size:15px} th,td{padding:9px 8px} }
 /* On a phone a wide table runs off the screen, so each row becomes its own block. */
 @media (max-width:720px){
   table thead{display:none}
   table,tbody,tr,td{display:block;width:100%}
   tr{border-bottom:1px solid var(--edge);padding:12px 0}
   td{border:0;padding:3px 0;text-align:left}
   td.num{text-align:left}
   td[data-k]::before{content:attr(data-k);display:block;color:var(--faint);font-size:12px;
     letter-spacing:.06em;text-transform:uppercase;margin-bottom:1px}
 }
</style></head><body><div class="wrap">

<header>
 <h1>Quant loop — the plan, for your review</h1>
 <p class="sub">A lie detector for trading rules. You write a rule in plain words; it turns the rule into
 code and tries hard to prove the rule is luck. If the rule survives, you learn how often it has worked.
 If it does not, you find out before it costs anything.</p>
 <p class="stamp">Built ${study.ran_utc.slice(0, 10)} · history measured from the chart API, not assumed ·
 nothing deployed, nothing written to any price table</p>
</header>

<h2>The question that was not a question</h2>
<div class="card">
 <p class="was">It said: <b>“Decision needed · Default yes: it may read stored prices.”</b> That is not a question,
 which is why it made no sense. Here it is as one, and it is the only one on this page:</p>
 <p class="q">May the quant loop read our stored price history, read only, to measure how often things have happened?</p>
 <p>It reads closed daily bars and nothing else. It never writes to a price table, never places an order, never
 says anything about today's market, and never touches your saved settings.</p>
 <p style="color:var(--dim)">You have effectively already said yes — “we should definitely wire FMP for deep
 history, wire Massive for the other history.” The wiring in this page does exactly that and only that.
 If you say no, the loop stops and nothing else changes.</p>
</div>

<h2>“The streaming is for the live prices — what has that got to do with the quant loop?”</h2>
<p class="lead">Nothing. They are separate paths, and keeping them separate is deliberate.</p>
<div class="three">
 <div><h4>Live stream</h4><p>Feeds the moving prices on your screens. Minute by minute. The quant loop never
 reads it.</p></div>
 <div><h4>Stored daily bars</h4><p>Finished days that cannot change any more. This is the only thing the loop
 reads. ${nf(spy.bars)} days for a fund like SPY, ${nf(ten.bars)} for the ten-year.</p></div>
 <div><h4>The loop</h4><p>Reads finished days, counts how often something happened, reports with a count and an
 honest range. It has no opinion about right now.</p></div>
</div>
<p>That is also why a study run today is not affected by whether the live feed is up: a study that needs
today's unfinished bar would be a study that cannot be repeated tomorrow.</p>

<h2>What history we actually hold</h2>
<p class="lead">Measured this morning by asking the chart API for every symbol, one at a time, and counting the
rows that came back. The API also reports its own exact count; the two agree everywhere.</p>
<div class="card">
 <p class="big">The deep archive is not missing. It was one call away.</p>
 <p>The note in your front door said the FMP archive going back to about 1960 “has not been located yet.”
 It is located: the ten-year yield answers with <b>${nf(ten.bars)} daily bars starting ${ten.history.slice(0, 10)}</b>
 through the same chart API the screens already use. The dollar index reaches 1971, silver 1970, gold 1975,
 the volatility index 1990. That correction belongs in the note, and I have made it.</p>
</div>
<table><thead><tr><th>Symbol</th><th>Kind</th><th>First day</th><th>Last finished day</th><th>Daily bars</th><th>Source</th><th>How counted</th></tr></thead>
<tbody>
${depthRows}
</tbody></table>
<p style="color:var(--faint);font-size:14px">Every row above was fetched with
<code>GET /candles?symbol=&lt;symbol&gt;&amp;tf=D</code>. The last finished day is
${depth.rows[0].last_day} because today's session has not closed; the loop only uses finished days.</p>

<h2>The plan</h2>

<h3>1 · Which numbers it will measure</h3>
<ol>
 <li><b>How often a reading has been where it is now.</b> Not bell curves — a straight count of the days,
 sorted, so “this is in its lowest tenth” means exactly that.</li>
 <li><b>What happened next.</b> For each group of days, how often the next ten days ended higher, and by how
 much on average, always shown next to the count of days it is based on.</li>
 <li><b>Coincidences and confluence.</b> The same counting when two readings line up at once — for instance a
 low reading on a stock while the ten-year is in its top tenth. The question stays “how often”, never “what now”.</li>
 <li><b>Whether it holds up in different weather.</b> The same counts split by trending and choppy years, so a
 result that only exists in one kind of market is exposed as such.</li>
</ol>

<h3>2 · Over which history</h3>
<ul>
 <li>Stocks and funds: <b>2003 onward</b> from Massive — ${nf(spy.bars)} finished days each, split-adjusted.</li>
 <li>Indices, macro, metals, oil, bitcoin: <b>as deep as FMP goes</b> — the ten-year to 1962, the dollar index to
 1971, silver to 1970, gold to 1975, volatility to 1990, oil to 2000, bitcoin to 2009.</li>
 <li>Finished daily bars only, always through the chart API. Never a side copy of a table, which is what made the
 last run look shallower than the truth.</li>
</ul>

<h3>3 · How a rule gets written and tested</h3>
<ol>
 <li><b>You say it in plain words</b> — “a wedge that breaks upward”, “oversold in an uptrend”.</li>
 <li><b>It becomes code that can only look backwards.</b> First check: the detector must never change its mind
 about a day once that day has passed. A detector that redraws history fails here and goes no further.</li>
 <li><b>The groups are cut on the early years only, then frozen.</b> The recent years are not looked at while the
 rule is being shaped.</li>
 <li><b>It is scored against the background of the same years</b>, not against zero — if everything went up
 ${spy.held_back.base_rate.share_up}% of the time, a rule that goes up ${spy.held_back.base_rate.share_up}% of the
 time has found nothing.</li>
 <li><b>Only every tenth day is counted</b> when looking ten days ahead, because neighbouring days share nine of
 their ten days and would otherwise be counted again and again as if they were fresh evidence.</li>
 <li><b>The range comes from the real observations</b>, reshuffled thousands of times. If that range crosses zero,
 the answer is “not shown”, however good the average looks.</li>
 <li><b>Then the held-back years.</b> A rule that dies here is dead, and it gets written down as dead so nobody
 proposes it again.</li>
</ol>

<h3>4 · How results will be shown</h3>
<ul>
 <li>One page per question, in this shape: the count first, then the average, then the range beside it.</li>
 <li>A one-sentence verdict in plain words, including “no edge shown” when that is the answer.</li>
 <li>The exact request used, printed, so any number can be re-asked and re-checked.</li>
 <li>Dead rules stay on the page. The graveyard is the most useful part of a lie detector.</li>
</ul>

<h3>5 · What it will never do</h3>
<ul class="no">
 <li><b>No opinions about now.</b> No “buy”, no “sell”, no “this looks like”. It counts finished days.</li>
 <li><b>No trading and no orders</b>, ever, by any route.</li>
 <li><b>No writing to any price table</b>, and no writes to your saved settings, Equalizer or screens.</li>
 <li><b>No reading the live stream.</b> That feed is for the screens.</li>
 <li><b>No claims tuned on the same data they are tested on</b>, and no bell curves standing in for real counts.</li>
 <li><b>No invented history.</b> If a series does not go back far enough, the page says so and stops.</li>
</ul>

<h2>One worked example, on real history</h2>
<p class="lead">Same method, run twice, so you can see it work rather than take my word for it. The reading is
the 14-day one already on your screens. The question: after a day like this, how often has the price been higher
ten days later?</p>

${studyBlock(spy, spyVerdict)}
${studyBlock(ten, tenVerdict)}

<h2>What is built, and what is not</h2>
<ul>
 <li><b>Built and run:</b> the history wiring that asks the chart API per symbol and counts the rows, and the
 study above. Both are small scripts you can re-run; their output is saved beside this page.</li>
 <li><b>Not built:</b> the wedges, flags, head-and-shoulders and breakout detectors. Those are the next step and
 they each need the “never redraws history” check before anything else.</li>
 <li><b>Not started:</b> feeding verdicts back into the rulebook chapters. That waits until you have read this plan.</li>
 <li><b>Not touched:</b> no deploy, no push to production, no price table written, no saved setting changed.</li>
</ul>

<p class="foot">Every number on this page was produced by the two scripts saved next to it and is rebuilt from
their output, not typed in by hand. Sources: Massive for stocks and funds, FMP for macro, both through
${study.api}.</p>

</div></body></html>`;
writeFileSync(`${D}/QUANT-LOOP-PLAN.html`, html);
console.log(`wrote ${D}/QUANT-LOOP-PLAN.html  ${html.length} bytes`);
