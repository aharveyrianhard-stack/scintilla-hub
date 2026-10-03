// Builds PREVCLOSE-OWN-CLOSE.html from measure.json (the P10 measurement printed by the throw-away
// Fly machine on 3 Oct 2026 03:04Z). Plain words for Alan; the table first. node build.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const M = JSON.parse(readFileSync(new URL('./measure.json', import.meta.url)))
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const pct = (n, d) => d ? `${(n / d * 100).toFixed(1)}%` : '—'
const money = n => n >= 1000 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(Number.isInteger(n * 100) ? 2 : 4)
const t = M.totals
const sessions = M.sessions
const bySym = M.beyond_by_symbol.slice(0, 12)
const biggest = M.beyond.slice(0, 12)
const row = (label, b) => `<tr><td>${label}</td><td class="n">${b.have.toLocaleString()}</td><td class="n">${b.exact.toLocaleString()}</td><td class="n dim">${pct(b.exact, b.have)}</td><td class="n">${b.within.toLocaleString()}</td><td class="n dim">${pct(b.within, b.have)}</td><td class="n">${b.beyond.toLocaleString()}</td><td class="n dim">${pct(b.beyond, b.have)}</td></tr>`
const sessionRows = sessions.map(s => `<tr><td>${s.session_et}</td><td class="dim">${s.valid_for}</td><td class="n">${s.settled}</td><td class="n">${s.print.have}</td><td class="n">${s.print.exact}</td><td class="n">${s.print.beyond}</td><td class="n">${s.bar1600.have}</td><td class="n">${s.bar1600.exact}</td><td class="n">${s.bar1600.beyond}</td><td class="n">${s.bar1600.have ? pct(s.bar1600.beyond, s.bar1600.have) : '—'}</td></tr>`).join('')
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Previous Close From Our Own Close</title><style>
:root{color-scheme:dark;--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--line2:#383838;--ink:#cfcfcf;--ink2:#acacac;--dim:#8c8c8c;--mute:#6c6c6c;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--mono);font-size:13px;line-height:1.6;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px 90px;overflow-x:hidden}
.top{padding:18px 0 12px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.brand{font:400 12px/1.4 var(--mono);letter-spacing:.2em;color:var(--dim)}.brand b{color:var(--ink);font-weight:600}
.stamp{margin-left:auto;font:400 11px/1.5 var(--mono);color:var(--dim);letter-spacing:.06em;text-align:right}
h1{font:600 15px/1.4 var(--mono);letter-spacing:.24em;color:var(--ink);margin:26px 0 6px;text-transform:uppercase}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.22em;color:var(--ink);margin:36px 0 8px;text-transform:uppercase;border-bottom:1px solid var(--line);padding-bottom:6px}
p{margin:8px 0;max-width:860px}.lead{color:var(--ink);font-size:14px}
.big{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:14px 0}
.tile{background:var(--panel);border:1px solid var(--line);padding:12px 14px}.tile .k{font-size:11px;letter-spacing:.18em;color:var(--dim);text-transform:uppercase}.tile .v{font-size:22px;color:var(--ink);margin-top:4px}.tile .s{font-size:11px;color:var(--dim);margin-top:2px}
table{border-collapse:collapse;width:100%;margin:10px 0 4px;font-size:12px;min-width:640px}.tw{overflow-x:auto;margin:0 -16px;padding:0 16px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{color:var(--dim);font-weight:400;letter-spacing:.12em;text-transform:uppercase;font-size:11px}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.dim{color:var(--dim)}.note{font-size:11px;color:var(--dim)}
.state{display:grid;grid-template-columns:250px 1fr;gap:6px 14px;margin:10px 0}.state b{color:var(--ink);font-weight:600;letter-spacing:.08em}
.dec{background:var(--panel);border:1px solid var(--line);padding:12px 14px;margin:10px 0}.dec b{color:var(--ink)}
code{font-family:var(--mono);color:var(--ink);background:#1a1a1a;padding:0 4px}
@media(max-width:700px){.state{grid-template-columns:1fr}.wrap{padding:0 16px 60px}}
</style></head><body><div class="wrap">
<div class="top"><div class="brand"><b>SCINTILLA</b> · PREVIOUS CLOSE · P10</div><div class="stamp">2 Oct 2026, late night<br>measured ${esc(M.measured_utc.slice(0, 16).replace('T', ' '))}Z</div></div>
<h1>The previous close comes from our own close at the bell</h1>
<p class="lead">Alan asked two things at 22:50: "Does the number ever change, materially?" and "Why would we wait for them?" We measured the first before building the second.</p>

<h2>Does the number change? <small>last ${sessions.length} sessions, every name on the board</small></h2>
<p>For every name and every session we compared the close Massive finally called official (hours later) with two closes we already have at 16:00: the <b>closing auction print</b> (the one trade marked as the official closing trade) and the <b>last trade in our own 16:00 minute bar</b>.</p>
<div class="big">
<div class="tile"><div class="k">closing print = official</div><div class="v">${pct(t.print.exact, t.print.have)}</div><div class="s">${t.print.exact.toLocaleString()} of ${t.print.have.toLocaleString()} exactly · ${t.print.within} within a cent · <b>${t.print.beyond} beyond</b> (FINX, 2 Oct, 2.9¢)</div></div>
<div class="tile"><div class="k">our 16:00 bar = official</div><div class="v">${pct(t.bar1600.exact, t.bar1600.have)}</div><div class="s">${t.bar1600.exact.toLocaleString()} of ${t.bar1600.have.toLocaleString()} exactly · ${t.bar1600.within} within the cent rule · <b>${t.bar1600.beyond} beyond</b> (${pct(t.bar1600.beyond, t.bar1600.have)})</div></div>
<div class="tile"><div class="k">largest own-bar miss</div><div class="v">$${biggest[0].diff_abs.toFixed(2)}</div><div class="s">${biggest[0].symbol} ${biggest[0].session_et}: bar ${money(biggest[0].own)} vs official ${money(biggest[0].official)} (${biggest[0].diff_pct.toFixed(2)}%)</div></div>
</div>
<div class="tw"><table><thead><tr><th>what we hold at 16:00</th><th class="n">name-sessions</th><th class="n">exact</th><th class="n"></th><th class="n">within the cent rule</th><th class="n"></th><th class="n">beyond</th><th class="n"></th></tr></thead><tbody>
${row('closing auction print', t.print)}
${row('our 16:00 minute bar (last trade of that minute)', t.bar1600)}
${row('our 15:59 minute bar', t.bar1559)}
${row('own close by the P10 rule (print, else 16:00 bar, else 15:59 bar)', t.own)}
</tbody></table></div>
<p class="note">The cent rule is Alan's 24 Sep rule as the code states it: two numbers are "the same" when they differ by at most one cent, or by at most 0.05% capped at five cents. "Beyond" means a reader would see a different previous close and a different %.</p>
<p><b>The answer.</b> The official number almost never differs from the <b>closing auction print</b>: one case in ${t.print.have.toLocaleString()} (FINX, the same thin ETF P9 was written for). It very often differs from the <b>last trade of the 16:00 minute</b>: a quarter of the time, and by dollars on expensive names (${biggest.slice(0, 4).map(b => `${b.symbol} $${b.diff_abs.toFixed(2)}`).join(', ')}). So "our own close" must mean the closing print, never the minute bar.</p>
<p class="note">Two gaps the measurement also shows. The closing print was on file for only ${pct(t.print.have, t.names)} of name-sessions, because the publisher read the last 200 trades of the day and the after-hours tape pushed the 16:00 print out of reach on busy names — P10 asks for the 16:00–16:10 window instead. And our own minute bars at the close exist for only ${sessions.filter(s => s.bar1600.have).length} of ${sessions.length} sessions in the capture table, which is a separate capture question, not P10's.</p>

<h2>Session by session</h2>
<div class="tw"><table><thead><tr><th>session</th><th>serves</th><th class="n">names settled</th><th class="n">prints on file</th><th class="n">print exact</th><th class="n">print beyond</th><th class="n">16:00 bars</th><th class="n">bar exact</th><th class="n">bar beyond</th><th class="n">bar beyond %</th></tr></thead><tbody>${sessionRows}</tbody></table></div>
<p class="note">Sessions before 25 Sep carried the 364-name universe; the board grew to 590 on 28 Sep.</p>

<h2>The names most often beyond, on the 16:00 bar</h2>
<div class="tw"><table><thead><tr><th>name</th><th class="n">sessions beyond (of those with a bar)</th></tr></thead><tbody>${bySym.map(b => `<tr><td>${b.symbol}</td><td class="n">${b.sessions}</td></tr>`).join('')}</tbody></table></div>
<div class="tw"><table><thead><tr><th>largest misses</th><th>session</th><th class="n">our bar</th><th class="n">official</th><th class="n">difference</th></tr></thead><tbody>${biggest.map(b => `<tr><td>${b.symbol}</td><td class="dim">${b.session_et}</td><td class="n">${money(b.own)}</td><td class="n">${money(b.official)}</td><td class="n">$${b.diff_abs.toFixed(2)} · ${b.diff_pct.toFixed(2)}%</td></tr>`).join('')}</tbody></table></div>

<h2>What was built <small>provider branch provider/p10-own-close-first-20261002 @0496e65, pushed · tests 803 → 829, all green · nothing deployed</small></h2>
<p><b>At 16:05 ET</b>, after the closing auction prints, the robot that publishes "yesterday's close" now builds the next session's file from the closes we already hold: the closing print; if a name has none, Massive's preliminary daily number as it stands at 16:05; if neither, our own 16:00 bar (the last fallback, and because of the table above it is never used to dispute a print). Every row is marked <code>basis: OWN_CLOSE</code>, the file says <code>provisional: true</code>, the P9 checks still run (all 590 accounted for; a print that disagrees with the preliminary daily beyond the cent rule is held, as FINX was), and the file goes live at once. The board has its previous close for Monday on Friday evening.</p>
<p><b>Then Massive confirms.</b> The robot keeps checking every 15 minutes. When Massive's official daily bar for the session exists, it rebuilds from the official numbers, compares every row with the provisional one, and republishes as <code>basis: PROVIDER_CONFIRMED</code> with the time of confirmation. Where the official close differs beyond the cent rule, the official value wins and the row keeps both numbers as <code>revised</code>. A provisional file can never overwrite a confirmed one, even after a restart — the robot looks at what is published before it decides.</p>
<p><b>The 04:00 ET deadline</b> now applies only to the confirmation. An unconfirmed file is a note in the health page, never a blank board.</p>

<h2>The new states you may see</h2>
<div class="state">
<b>OWN_CLOSE</b><span>the file was built from our own closes at 16:05; provisional. The board shows its % as usual.</span>
<b>PROVIDER_CONFIRMED</b><span>Massive's official numbers have replaced the provisional ones (or were used from the start, as before P10).</span>
<b>revised</b><span>a name whose official close moved beyond the cent rule; both numbers are kept. The hover can say "close revised by the provider: 940.76 → 940.82".</span>
<b>AWAITING_PROVIDER</b><span>the file is provisional and Massive has not published the official bar yet (normal all evening).</span>
<b>UNCONFIRMED_PAST_DEADLINE</b><span>it is after 04:00 ET and Massive still has not published; the board keeps every %, the health page carries the note.</span>
<b>held</b><span>unchanged from P9: a name whose two sources disagree beyond the cent rule has no % until the official number arrives.</span>
</div>

<h2>How it reaches the live system <small>for the coordinator; the exact commands are in the provider runbook PREVCLOSE_OWN_CLOSE.md</small></h2>
<p>Reader first: the chart API image <code>p10-0496e65</code> (the old reader p9-385f2ec would refuse a file with a name we had no close for, or a print-vs-daily hold, and blank the board). Then the eight files on the publisher machine, at a closed-market hour (the update restarts it). Rollback of each step is the previous image / the P9 files. Nothing was deployed tonight.</p>

<h2>What could be wrong</h2>
<p>Massive's preliminary daily number at 16:05 could not be measured against the official one from history (nothing recorded it); the first live nights' <code>revised</code> lists are that measurement, and the runbook says where to read them. Where a name has no closing print and no preliminary daily, the 16:00 bar is used and that row is the one most likely to be revised. Our capture table had no 16:00 bars for 12 of the 20 sessions, so the bar fallback will be rarer than it looks.</p>

<h2>Decisions for Alan</h2>
<div class="dec"><b>1 · Show "provisional" on the board before Massive confirms?</b><br>Recommendation: no mark on the % itself; a small grey "own close" hover on the previous close, and the "close revised by the provider" hover only for the few revised names. The number changes materially in roughly one case per 3,000, so a loud mark would cry wolf.</div>
<div class="dec"><b>2 · Deploy the publisher this weekend?</b><br>Recommendation: yes — reader Saturday, publisher Saturday after the reader checks out, so Monday's file is built from Friday's prints at the first 16:05 after that (Monday 16:05 for Tuesday). Friday's own file for Monday cannot be built retroactively by the old publisher; it will come from Massive's official bar as today.</div>
<div class="dec"><b>3 · Keep the 16:00 bar as the last fallback at all?</b><br>Recommendation: keep it, as the last of three, never as a cross-check. A number that is right within a cent three times out of four beats a blank cell, and the confirmation step corrects it the same night.</div>
<p class="note">Sources: evidence/p10-own-close-measure-20261002.json in the provider repo (the job's full output; the beyond list is truncated at 600 of 867 rows); the measurement job scripts/p10-own-close-measure.mjs ran once on a throw-away machine of scintilla-massive-stocks-batch and that machine was destroyed.</p>
</div></body></html>
`
writeFileSync(new URL('./PREVCLOSE-OWN-CLOSE.html', import.meta.url), html)
console.log('written', html.length)
