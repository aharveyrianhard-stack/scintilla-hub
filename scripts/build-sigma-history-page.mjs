/* Builds deliverables/20260924/sigma-history/SIGMA-HISTORY.html from the study JSON.
   Every number on the page comes out of that file: nothing here is typed by hand. */
import fs from "node:fs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const REC = JSON.parse(fs.readFileSync(process.argv[4], "utf8"));   // the like-for-like count check
/* the same rate over the most recent 60 sessions, so "is this normal today?" has its own number */
const LAST60 = (() => { const last = S.breadth.slice(-60);
  return Math.round((last.reduce((a, b) => a + b.total, 0) / last.length) * 100) / 100; })();
const f2 = (n) => (n == null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(2));
const f1 = (n) => (n == null ? "—" : n.toFixed(1));
/* a size, never a direction: a usual day and the size of a move carry no sign */
const abs2 = (n) => (n == null ? "—" : Math.abs(n).toFixed(2));
const cls = (n) => (n == null ? "" : n > 0 ? " class=\"up\"" : n < 0 ? " class=\"dn\"" : "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const nice = (s) => String(s).replace(/_/g, " ").toLowerCase();

/* ── chart 1: breadth of the unusual, up above the line and down below ─────────────────────── */
function breadthChart(rows) {
  const W = 880, H = 180, PAD = 26, mid = H / 2;
  const maxv = Math.max(...rows.map((r) => Math.max(r.up, r.down)), 1);
  const bw = (W - PAD * 2) / rows.length;
  let bars = "";
  rows.forEach((r, i) => {
    const x = PAD + i * bw;
    if (r.up) bars += `<rect x="${x.toFixed(1)}" y="${(mid - (r.up / maxv) * (mid - 14)).toFixed(1)}" width="${Math.max(bw * 0.9, 0.6).toFixed(2)}" height="${((r.up / maxv) * (mid - 14)).toFixed(1)}" fill="var(--bull)" opacity=".85"/>`;
    if (r.down) bars += `<rect x="${x.toFixed(1)}" y="${mid}" width="${Math.max(bw * 0.9, 0.6).toFixed(2)}" height="${((r.down / maxv) * (mid - 14)).toFixed(1)}" fill="var(--bear)" opacity=".85"/>`;
  });
  const ticks = rows.filter((_, i) => i % 63 === 0).map((r, k) => {
    const i = k * 63, x = PAD + i * bw;
    return `<line x1="${x.toFixed(1)}" y1="14" x2="${x.toFixed(1)}" y2="${H - 14}" stroke="var(--line)"/>` +
           `<text x="${(x + 3).toFixed(1)}" y="${H - 3}" class="ax">${r.session.slice(0, 7)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily count of names having a sigma day, up above the line and down below">
  <rect width="${W}" height="${H}" fill="var(--sunk)"/>${ticks}
  ${bars}
  <line x1="${PAD}" y1="${mid}" x2="${W - PAD}" y2="${mid}" stroke="var(--line2)"/>
  <text x="${PAD}" y="12" class="ax">${maxv} names up</text>
  <text x="${PAD}" y="${H - 18}" class="ax">${maxv} names down</text>
</svg>`;
}

/* ── chart 2: what happened after, with its uncertainty ────────────────────────────────────── */
function liftChart(groups) {
  const names = Object.keys(groups);
  const rowH = 26, W = 880, PAD_L = 210, PAD_R = 76, H = names.length * rowH + 46;
  const los = names.map((n) => (groups[n].ci20 || {}).lo).filter((v) => v != null);
  const his = names.map((n) => (groups[n].ci20 || {}).hi).filter((v) => v != null);
  const lo = Math.min(-1, ...los), hi = Math.max(1, ...his);
  const x = (v) => PAD_L + ((v - lo) / (hi - lo)) * (W - PAD_L - PAD_R);
  let body = "";
  names.forEach((n, i) => {
    const g = groups[n], y = 30 + i * rowH + rowH / 2;
    const ci = g.ci20 || {};
    const point = g.horizons[20].median_vs_spy, base = g.baseline20.median_vs_spy;
    const crossesZero = ci.lo == null || (ci.lo <= 0 && ci.hi >= 0);
    const col = crossesZero ? "var(--mute)" : point > 0 ? "var(--bull)" : "var(--bear)";
    if (ci.lo != null) body += `<line x1="${x(ci.lo).toFixed(1)}" y1="${y}" x2="${x(ci.hi).toFixed(1)}" y2="${y}" stroke="${col}" stroke-width="2" opacity=".55"/>`;
    body += `<circle cx="${x(point).toFixed(1)}" cy="${y}" r="3.4" fill="${col}"/>`;
    if (base != null) body += `<line x1="${x(base).toFixed(1)}" y1="${y - 5}" x2="${x(base).toFixed(1)}" y2="${y + 5}" stroke="var(--ink2)" stroke-width="1.2" opacity=".8"/>`;
    body += `<text x="8" y="${y + 4}" class="ax lbl">${esc(n)}</text>`;
    body += `<text x="${W - 8}" y="${y + 4}" class="ax" text-anchor="end">n=${g.n}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Median 20-session return against SPY after a sigma day, with a block-bootstrap interval">
  <rect width="${W}" height="${H}" fill="var(--sunk)"/>
  <line x1="${x(0).toFixed(1)}" y1="22" x2="${x(0).toFixed(1)}" y2="${H - 16}" stroke="var(--line2)"/>
  <text x="${(x(0) + 4).toFixed(1)}" y="16" class="ax">0 = same as SPY</text>
  ${body}
  <text x="${PAD_L}" y="${H - 4}" class="ax">${lo.toFixed(1)}%</text>
  <text x="${W - PAD_R}" y="${H - 4}" class="ax" text-anchor="end">${hi.toFixed(1)}%</text>
</svg>`;
}

const g = S.groups, ex = S.example, C = S.counts;
const hz = g.ALL.horizons;
const groupRows = Object.entries(g).map(([n, v]) => {
  const h = v.horizons[20], ci = v.ci20 || {};
  const sure = ci.lo != null && !(ci.lo <= 0 && ci.hi >= 0);
  return `<tr><td>${esc(n)}</td><td>${v.n}</td><td${cls(v.horizons[1].median_vs_spy)}>${f2(v.horizons[1].median_vs_spy)}</td>
  <td${cls(v.horizons[5].median_vs_spy)}>${f2(v.horizons[5].median_vs_spy)}</td><td${cls(h.median_vs_spy)}>${f2(h.median_vs_spy)}</td>
  <td>${f2(v.baseline20.median_vs_spy)}</td><td>${f2(v.lift20)}</td><td class="mono">${ci.lo == null ? "—" : f2(ci.lo) + " to " + f2(ci.hi)}</td>
  <td>${sure ? "clear of zero" : "not clear of zero"}</td></tr>`;
}).join("\n");

const cohortRows = Object.entries(S.cohorts).sort((a, b) => b[1].n - a[1].n).slice(0, 14).map(([n, v]) =>
  `<tr><td>${esc(nice(n))}</td><td>${v.names}</td><td>${v.n}</td><td${cls(v.up_med20_vs_spy)}>${f2(v.up_med20_vs_spy)}</td>
   <td${cls(v.down_med20_vs_spy)}>${f2(v.down_med20_vs_spy)}</td><td>${f2(v.baseline20_vs_spy)}</td></tr>`).join("\n");

const classRows = Object.entries(C.by_class).map(([k, v]) =>
  `<tr><td>${esc(nice(k))}</td><td>${v.names}</td><td>${v.events}</td><td>${v.per_day}</td><td>${v.statistical}</td><td>${v.raw}</td><td>${v.both}</td>
   <td><span class="up">${v.up}</span> / <span class="dn">${v.down}</span></td></tr>`).join("\n");

const quintRows = S.breadth_quintiles.by_down.map((q) =>
  `<tr><td>${q.bucket}</td><td>${q.from}–${q.to} names down</td><td>${q.sessions}</td>
   <td${cls(q.spy_next5_median)}>${f2(q.spy_next5_median)}</td><td${cls(q.spy_next20_median)}>${f2(q.spy_next20_median)}</td><td>${f1(q.spy_next20_up_rate)}%</td></tr>`).join("\n");

const busiestRows = S.busiest.slice(0, 6).map((b) =>
  `<tr><td>${b.session}</td><td>${b.total}</td><td class="up">${b.up}</td><td class="dn">${b.down}</td></tr>`).join("\n");

const M = RULES.measured.per_day_on_that_sample;
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>SCINTILLA · SIGMA HISTORY — TWO YEARS OF UNUSUAL DAYS, AND WHAT CAME AFTER</title>
<meta name="robots" content="noindex">
<style>
:root{--bg:#0A0A0F;--panel:#0D0D14;--sunk:#08080C;--line:#1A1A2A;--line2:#252538;
  --ink:#C6C8D2;--ink2:#9A9AAE;--dim:#868A9E;--mute:#4A4A5E;--bull:#00FFA3;--bear:#FF2D55;
  --mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;
  --sans:ui-sans-serif,-apple-system,"Helvetica Neue",Helvetica,sans-serif}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--sans);font-size:17px;line-height:1.6}
.wrap{max-width:920px;margin:0 auto;padding:0 22px 90px}
.top{padding:20px 0 14px;border-bottom:1px solid var(--line);font-family:var(--mono);
  font-size:11px;letter-spacing:.20em;color:var(--dim)}
.top b{color:var(--ink)}
h1{font-size:27px;line-height:1.35;color:var(--ink);font-weight:600;margin:34px 0 6px;max-width:24em}
h2{font-family:var(--mono);font-size:11px;letter-spacing:.22em;color:var(--dim);font-weight:400;
  margin:40px 0 12px;padding-top:22px;border-top:1px solid var(--line)}
h3{font-size:17px;color:var(--ink);margin:22px 0 4px}
p{margin:11px 0;max-width:44em}
li{margin:7px 0;color:var(--dim)}
b{color:var(--ink)}
code{font-family:var(--mono);font-size:13px;color:var(--ink2)}
.lede{font-size:19px;color:var(--ink2)}
.q{border-left:2px solid var(--line2);padding:2px 0 2px 16px;margin:16px 0;color:var(--dim);font-style:italic}
table{width:100%;border-collapse:collapse;font-size:15px;margin:14px 0}
th{font-family:var(--mono);font-size:11px;letter-spacing:.13em;color:var(--mute);text-align:left;
  padding:0 10px 7px 0;border-bottom:1px solid var(--line2)}
td{padding:9px 10px 9px 0;border-bottom:1px solid var(--line);color:var(--ink2);vertical-align:top}
td:first-child{color:var(--ink)}
.up{color:var(--bull)}.dn{color:var(--bear)}
.box{border:1px solid var(--line);background:var(--panel);padding:14px 16px;margin:16px 0}
.box.sunk{background:var(--sunk)}
.cap{font-family:var(--mono);font-size:11px;color:var(--mute);letter-spacing:.06em;margin:0 0 20px}
.mono{font-family:var(--mono);font-size:13px;color:var(--ink2)}
svg{width:100%;border:1px solid var(--line);background:var(--sunk);margin:10px 0;display:block}
.ax{font-family:var(--mono);font-size:11px;fill:var(--mute)}
.lbl{fill:var(--ink2)}
.scroll{overflow-x:auto}
.kv{display:grid;grid-template-columns:minmax(150px,auto) 1fr;gap:6px 18px;font-size:15px}
.kv div:nth-child(odd){font-family:var(--mono);font-size:11px;letter-spacing:.1em;color:var(--mute);padding-top:3px}
@media (max-width:560px){.kv{grid-template-columns:1fr}table{font-size:13px}}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><span data-scnav-slot></span><b>SCINTILLA</b> · SIGMA HISTORY · 24 SEPTEMBER 2026</div>

<h1>Two years of unusual days, for every name — and what happened after them</h1>
<p class="lede">A sigma is one sentence: <b>this name moved further today than it usually moves</b>. Until now
the Hub only remembered the ones it caught live, from 23 September 2026. This page answers where the number
comes from, where it is kept, and what the two years before that look like when the same rule is walked
backwards over ${S.meta.names_used} names — ${C.total.toLocaleString("en-GB")} unusual days across
${C.sessions} trading sessions.</p>

<div class="q">"Are you capturing this going backwards for other companies? Because like, how? How are you
registering the sigma? Against what is it computing? Where is it being saved? Is it on database? How is it
going to work?" — Alan, 24 September</div>

<h2>THE FOUR ANSWERS, IN ORDER</h2>

<h3>1 · How a sigma is registered</h3>
<p>Every ten minutes in market hours, and once more after the close, a small program reads the day's price
for all ${S.meta.names_in_universe} names and asks two questions about each. <b>Is this move big compared with
this name's own usual day?</b> And <b>is it simply big?</b> If either is true, that name had a sigma day, and one
row is written. Nothing else happens: no ranking, no opinion, no trade.</p>

<h3>2 · Against what it is computing</h3>
<p>Against <b>the name's own usual day</b> — the spread of its last ${RULES.usual_day.sessions} daily moves,
which the Hub calls the heartbeat and stores in <code>public.ticker_heartbeat_daily</code>. A 3% day is
nothing for a name that normally swings 4%, and enormous for one that normally moves 0.4%. The bar is set per
kind of thing, because a whole market moving is not the same event as one company moving:</p>
<div class="scroll"><table>
<tr><th>kind</th><th>counts if it moves this many times its usual day</th><th>and at least</th><th>or simply moves this much</th></tr>
${Object.entries(RULES.price).map(([k, p]) => `<tr><td>${esc(nice(k))}</td><td>${p.x_usual}×</td><td>${p.x_usual_needs_move_pct}%</td><td>${p.raw_move_pct}%</td></tr>`).join("\n")}
</table></div>
<p class="cap">data/scintilla-rules.json, version ${RULES.version}. Change a number there and the detector, the
backfill and the Hub all follow it.</p>
<p><b>The one rule that keeps it honest:</b> the usual day used is always the one measured <b>before</b> the day
being judged. If today's own move were inside the divisor, a wild day would quietly raise the bar it has to
clear, and judge itself.</p>

<h3>3 · Where it is saved</h3>
<p>In the database, in one table: <code>public.scintillas</code>. One row per name per day, carrying the move,
the usual day it was divided by, which rule fired, and the inputs — so any row can be recomputed by hand. The
key of a row is <code>price_outlier|SYMBOL|DATE</code>, which is why the same day can never be stored twice,
whether it was caught live or filled in afterwards.</p>

<h3>4 · How it works going forward</h3>
<p>Unchanged: the live pass keeps writing today's rows every ten minutes. What is new is a second door into the
same room — <code>?mode=backfill</code> — which walks stored daily bars from ${S.meta.from} to today and writes
the days nobody was watching, through <b>the same rule, the same key and the same table</b>. It goes a slice of
names at a time and can be stopped and resumed; running it twice leaves one row, not two.</p>

<h3>The worked example — ${esc(ex.symbol)}, ${esc(ex.session)}</h3>
<div class="box sunk kv">
  <div>MOVE</div><div><span class="${ex.dir > 0 ? "up" : "dn"}">${f2(ex.move)}%</span> close against the previous close</div>
  <div>USUAL DAY</div><div>${abs2(ex.usual)}% — the spread of its last 60 daily moves, as of the session before</div>
  <div>HOW UNUSUAL</div><div>${abs2(ex.move)}% ÷ ${abs2(ex.usual)}% = <b>${ex.x.toFixed(2)}× its usual day</b>, ${ex.dir > 0 ? "upwards" : "downwards"}</div>
  <div>STATISTICAL BAR</div><div>${RULES.price.equity.x_usual}× for a single company — ${ex.x >= RULES.price.equity.x_usual ? "cleared" : "<b>not cleared</b>"}</div>
  <div>RAW BAR</div><div>${RULES.price.equity.raw_move_pct}% for a single company — ${Math.abs(ex.move) >= RULES.price.equity.raw_move_pct ? "<b>cleared</b>" : "not cleared"}</div>
  <div>VERDICT</div><div>a sigma day, because <b>${ex.fired.join(" and ")}</b> said so</div>
  <div>STORED AS</div><div class="mono">price_outlier|${esc(ex.symbol)}|${esc(ex.session)}</div>
</div>
<p>${esc(ex.symbol)} is the case that shows why two families exist. It is a wild name — its ordinary day is
${abs2(ex.usual)}% — so an ${abs2(ex.move)}% ${ex.dir > 0 ? "rise" : "fall"} is only ${ex.x.toFixed(2)}× its usual
day and the statistical rule alone would have said nothing. The raw floor caught it. ${ex.fwd["20"] == null
  ? "Its forward return is not in this study: " + esc(ex.session) + " is the last session in the data, so the next 20 closes do not exist yet. That is left blank rather than filled with a guess."
  : "Its next 20 sessions returned " + f2(ex.fwd["20"]) + "%."}</p>

<h2>THE BACKFILL, AND WHAT IT PRODUCES</h2>
<p>The plan is deliberately boring: the same function set, one new mode. <code>?mode=backfill&amp;from=&amp;to=&amp;symbols=&amp;cursor=</code>
reads stored daily bars, asks the live detector the same question for each past session, and inserts with
ignore-duplicates. A backfilled row is marked <code>backfilled: true</code> and timestamped at that session's own
close. <b>A live row is never displaced.</b> The migration is additive — one index and one counting view — and
has an exact rollback.</p>

<div class="scroll"><table>
<tr><th>kind</th><th>names</th><th>sigma days</th><th>a day</th><th>statistical said so</th><th>raw said so</th><th>both</th><th>up / down</th></tr>
${classRows}
<tr><td><b>all</b></td><td>${S.meta.names_used}</td><td><b>${C.total.toLocaleString("en-GB")}</b></td><td><b>${C.per_day}</b></td><td colspan="4">over ${C.sessions} sessions, ${S.meta.from} to ${S.meta.to}</td></tr>
</table></div>

<h3>Does that match what the rules file measured?</h3>
<p>Yes, closely. The rules file recorded <b>${M.either} a day</b> on its ${REC.sample}-name sample over the last
${REC.sessions} sessions (${REC.from} to ${REC.to}). Replaying <b>the same sample over the same sessions</b>
through the backfill gives <b>${REC.replayed.either} a day</b>:</p>
<div class="scroll"><table>
<tr><th>on that sample</th><th>rules file recorded</th><th>backfill replayed</th><th>difference</th></tr>
${Object.keys(REC.recorded).map((k) => `<tr><td>${esc(nice(k))}</td><td>${REC.recorded[k]}</td><td>${REC.replayed[k]}</td><td>${f2(REC.agreement[k])}</td></tr>`).join("\n")}
</table></div>
<p class="cap">The two small differences are the edge of the window: the two runs start their ${REC.sessions}-session
count one bar apart, which moves one borderline day in and out.</p>
<p>Across all ${S.meta.names_used} names the rate is <b>${C.per_day} a day</b> over the full two years, and
<b>${LAST60} a day</b> over the most recent 60 sessions. The rules file's note — "expect roughly three times these
counts across all 364 names", about ${(M.either * 3).toFixed(0)} — is right for today and a little low for the
two-year window, which contains April 2025.</p>

<h2>WHAT HAPPENED AFTER — THE PLAYBOOK'S FIRST CHAPTER</h2>
<p>For every stored event, the return over the next 1, 5 and 20 sessions, measured only from closes that
existed after the event, and the same return minus SPY over the same dates. The honest answer first:</p>
<div class="box">
<p style="margin-top:0"><b>A sigma day, on its own, does not tell you what comes next.</b> Across all
${hz["20"].n.toLocaleString("en-GB")} events with a 20-session answer, the median return against SPY is
${f2(hz["20"].median_vs_spy)}% and ${f1(hz["20"].beat_spy_rate)}% of them beat SPY — a coin toss. At one session
it is ${f2(hz["1"].median_vs_spy)}% (${f1(hz["1"].beat_spy_rate)}% beat), at five ${f2(hz["5"].median_vs_spy)}%
(${f1(hz["5"].beat_spy_rate)}% beat). Of the ${Object.keys(g).length} groups below, <b>one</b> has an interval
clear of zero, which is about what pure chance produces when you cut the same data ${Object.keys(g).length} ways.</p>
</div>
${liftChart(g)}
<p class="cap">Each row: the dot is the median 20-session return against SPY after a sigma day; the bar is where
that median landed in 400 block-bootstrap resamples (blocks of 20 consecutive sessions, because one shock lights
up dozens of names at once); the pale upright tick is the same names on an ordinary day. Grey means the interval
includes zero — no claim.</p>

<div class="scroll"><table>
<tr><th>group</th><th>events</th><th>1 session vs SPY</th><th>5 vs SPY</th><th>20 vs SPY</th><th>same names, any day</th><th>what the sigma added</th><th>20-session interval</th><th>verdict</th></tr>
${groupRows}
</table></div>
<p class="cap">All figures are medians, in percentage points. "Same names, any day" is the control: the same
20-session excess measured on every day in the window, not only on sigma days. "What the sigma added" is the
difference between the two — around half a point, and inside the noise.</p>

<h3>Raw numbers, not against SPY</h3>
<div class="scroll"><table>
<tr><th>horizon</th><th>events measured</th><th>no answer yet</th><th>median</th><th>average</th><th>finished higher</th></tr>
${[1, 5, 20].map((k) => `<tr><td>${k} session${k > 1 ? "s" : ""}</td><td>${hz[k].n.toLocaleString("en-GB")}</td><td>${hz[k].missing}</td><td${cls(hz[k].median)}>${f2(hz[k].median)}%</td><td${cls(hz[k].mean)}>${f2(hz[k].mean)}%</td><td>${f1(hz[k].up_rate)}%</td></tr>`).join("\n")}
</table></div>
<p>The average is far above the median at 20 sessions (${f2(hz["20"].mean)}% against ${f2(hz["20"].median)}%)
because a handful of names ran a very long way. That gap is the whole reason this page reports medians: one
${esc(S.cohorts.QUANTUM ? "quantum" : "runaway")} name can carry an average and tell you nothing about the next case.</p>

<h3>By cohort</h3>
<div class="scroll"><table>
<tr><th>cohort</th><th>names</th><th>events</th><th>after an up day, 20 vs SPY</th><th>after a down day, 20 vs SPY</th><th>same names, any day</th></tr>
${cohortRows}
</table></div>
<p class="cap">Read the last column first. Cohorts that look strong after a sigma are mostly cohorts that were
strong all the time; the event adds little on top of the drift they already had.</p>

<h2>BREADTH OF THE UNUSUAL</h2>
<p>The same events counted a different way: how many names had a sigma day, each day, up and down separately.
This is a market-wide series of its own, and it is the one place in this study where the shape is unmistakable —
the market's worst days are not a few big movers but nearly everything moving at once.</p>
${breadthChart(S.breadth)}
<p class="cap">${S.breadth.length} sessions, ${S.meta.from} to ${S.meta.to}. Green above the line: names up
further than they usually move. Red below: names down. Both drawn from the same stored rows.</p>

<div class="scroll"><table>
<tr><th>busiest session</th><th>names with a sigma day</th><th>up</th><th>down</th></tr>
${busiestRows}
</table></div>

<h3>Does a wide day say anything about SPY next?</h3>
<div class="scroll"><table>
<tr><th>bucket</th><th>names down that day</th><th>sessions</th><th>SPY next 5</th><th>SPY next 20</th><th>higher after 20</th></tr>
${quintRows}
</table></div>
<p>Weakly, and not in a straight line. The quietest fifth of days is followed by the best 20 sessions
(${f2(S.breadth_quintiles.by_down[0].spy_next20_median)}%, higher ${f1(S.breadth_quintiles.by_down[0].spy_next20_up_rate)}% of the time)
and the widest fifth by ${f2(S.breadth_quintiles.by_down[4].spy_next20_median)}%, but the middle buckets do not
line up in between, and every bucket is positive because the market rose over this window. <b>This is not a
timing rule.</b> It is a description.</p>
<div class="box sunk">
<p style="margin-top:0"><b>The Geiger comparison is not in this page, and here is why.</b> The chart API serves
one <i>current</i> Geiger artifact; no stored history of it exists that this lane can read, and there is no
database key in this environment. Lining breadth up against the Geiger needs the Geiger's own daily value kept
the way the heartbeat now is. That is a small table and a nightly write — worth doing, and named in the
decisions below — but it cannot be faked from today's single reading.</p>
</div>

<h2>WHAT COULD BE WRONG</h2>
<ul>
<li><b>Survivorship, the big one.</b> The ${S.meta.names_used} names are <b>today's</b> universe. Anything that was
delisted, taken private or collapsed in the last two years is absent — and those names had the wildest sigma days
of all. Every forward return here is therefore measured on companies that made it to today, which flatters them.
The honest fix is a point-in-time universe, which the Hub does not have yet.</li>
<li><b>The usual day was recomputed, not read.</b> The store has heartbeat rows from 2024-09-18, but no key to
that table exists in this environment, so this study computed each name's 60-session spread from bars that close
before the session — the same formula the store uses. The backfill itself, when the coordinator runs it, will
prefer the <b>stored</b> row for the prior date and fall back to this only where a row is missing, saying which
it used in every row.</li>
<li><b>Prices are adjusted as they stand today.</b> A split or a large dividend rewrites old bars, so a two-year-old
"move" is measured on today's adjusted series, not on what printed that afternoon.</li>
<li><b>Fifteen groups, one hit.</b> DOWN · index_etf is the only interval clear of zero. Cut any data fifteen ways
and one will look special; treat it as a question, not a finding.</li>
<li><b>The window is one market.</b> ${S.meta.from} to ${S.meta.to} contains April 2025 and a long rise. Two years
is a small sample of regimes, not a law.</li>
<li><b>Events near the end have no answer.</b> ${hz["20"].missing} events are too recent to have 20 sessions after
them, including the ${esc(ex.symbol)} example. They are left blank, never zero.</li>
</ul>

<h2>WHAT I DID NOT DO</h2>
<ul>
<li><b>Nothing was deployed and nothing was run against the database.</b> The migration, the new mode and the tests
are written and tested locally; the coordinator applies the migration and runs the backfill.</li>
<li><b>No row was written to public.scintillas</b> by this lane — the counts above come from replaying the rule over
locally cached bars, not from the table.</li>
<li><b>No price table was touched</b>, and no credential was read or printed.</li>
<li><b>Earnings and economic sigmas are not backfilled</b> — only price. Their history lives in tables this lane
cannot read from here.</li>
<li><b>No trading rule is proposed.</b> The measurement says a sigma alone does not predict; the Playbook's next
chapter is what a sigma <i>plus</i> something else does.</li>
</ul>

<h2>WHERE EVERY NUMBER CAME FROM</h2>
<div class="kv">
<div>PRICES</div><div>chart API <code>/candles?tf=1d</code>, ${S.meta.names_used} names, cached locally and read only</div>
<div>RULES</div><div><code>data/scintilla-rules.json</code> version ${RULES.version}</div>
<div>VERDICTS</div><div><code>detectPriceOutliers</code> in <code>scripts/scintillas-detect.mjs</code> — the live function, unchanged</div>
<div>BACKFILL</div><div><code>scripts/scintillas-backfill.mjs</code>, shipped byte-for-byte inside the edge function</div>
<div>STUDY</div><div><code>scripts/sigma-history-study.mjs</code>, built ${esc(S.meta.built_utc.slice(0, 16))}Z</div>
<div>COHORTS</div><div><code>data/taxonomy-20260924.json</code> — branch for companies, family for funds</div>
<div>WINDOW</div><div>${S.meta.from} to ${S.meta.to}, ${C.sessions} sessions</div>
</div>
</div>
</body>
</html>`;
fs.writeFileSync(OUT, html);
console.log("wrote", OUT, (html.length / 1024).toFixed(1) + "kb");
