<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chart Speed</title><style>
:root{--bg:#0B0B0E;--panel:#121216;--line:#2B2B31;--ink:#CFCFD2;--ink2:#A8A8AE;--dim:#8A8A92}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 ui-monospace,Menlo,monospace}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}h1{font-size:22px;letter-spacing:.08em;margin:6px 0 4px}
h2{font-size:15px;letter-spacing:.12em;color:var(--ink2);border-bottom:.5px solid var(--line);padding-bottom:6px;margin:34px 0 12px}
h3{font-size:13px;letter-spacing:.1em;color:var(--dim);margin:22px 0 8px}.kick{font-size:11px;letter-spacing:.16em;color:var(--dim)}
p,li{color:var(--ink2)}b{color:var(--ink)}.lead{font-size:15px;color:var(--ink)}
.box{background:var(--panel);border:.5px solid var(--line);border-radius:3px;padding:12px 16px;margin:12px 0}
table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:.5px solid #1E1E23;padding:6px 8px;text-align:left;vertical-align:top}
th{color:var(--dim);font-weight:600;letter-spacing:.08em}.d{color:var(--dim)}.table-wrap{overflow-x:auto}
.pair{display:grid;grid-template-columns:1fr;gap:12px}.pair svg{min-width:1000px}.pair>div{overflow-x:auto}
.pair h3{margin-top:4px}svg text{font-family:ui-monospace,Menlo,monospace}
figure{margin:0;background:var(--panel);border:.5px solid var(--line);border-radius:3px;padding:6px}
figure img{width:100%;display:block}figcaption{font-size:11px;color:var(--dim);padding:6px 2px 0}
.shots{display:grid;grid-template-columns:2fr 1fr;gap:12px}@media(max-width:900px){.shots{grid-template-columns:1fr}}
code{color:var(--ink);font-size:12px}
</style></head><body><main>
<div class="kick">SCINTILLA · L2 CHART-SPEED · MON 28 SEP 2026 · STATION BRANCH station/chart-speed-20260928 (on live 64124b6) · HUB BRANCH candidate/chart-speed-20260928 · NOT DEPLOYED (the coordinator deploys)</div>
<span data-scnav-slot></span><h1>Why the chart took nine seconds, and what changed</h1>
{{txt.lead}}

<h2>1 · The main reason, in plain words</h2>
{{txt.reason}}

<h2>2 · What I changed (the Station chart and the Station wall; nothing on the Hub itself)</h2>
{{txt.changes}}

<h2>3 · Before and after — Hub company view, MU, opened from a board row (page settled 15 s)</h2>
<p>Times are seconds after the click, measured in a headless browser at 1680 wide. BEFORE is the live Station inside the live Hub;
AFTER is this branch's Station inside the same live Hub, measured right after, three times each, alternating. Cold = a brand-new
browser (nothing cached); warm = the same browser reloaded.</p>
{{hubrow.table}}
<h3>Waterfall — cold (a typical run of the three: every chart-API request, left = when it was sent, right = when it finished)</h3>
<div class="pair"><div><h3>BEFORE · {{hubrow.src_before_cold}}</h3>{{hubrow.wf_before_cold}}</div><div><h3>AFTER · {{hubrow.src_after_cold}}</h3>{{hubrow.wf_after_cold}}</div></div>
<h3>Waterfall — warm</h3>
<div class="pair"><div><h3>BEFORE</h3>{{hubrow.wf_before_warm}}</div><div><h3>AFTER</h3>{{hubrow.wf_after_warm}}</div></div>
<p class="d">Bright bars are Geiger reads; light-grey bars are the ownership check (/universe); mid-grey are candles (price, clouds, fan); dark are quotes. Hover a bar for its address, times and size.</p>

<h2>4 · Before and after — Hub company view, MU, opened in the first second after the page loads</h2>
{{hubearly.table}}
<div class="pair"><div><h3>BEFORE · cold</h3>{{hubearly.wf_before_cold}}</div><div><h3>AFTER · cold</h3>{{hubearly.wf_after_cold}}</div></div>

<h2>5 · Before and after — Station TARGETS page (eight 3-day charts)</h2>
{{st8.table}}
<div class="pair"><div><h3>BEFORE · cold</h3>{{st8.wf_before_cold}}</div><div><h3>AFTER · cold</h3>{{st8.wf_after_cold}}</div></div>
<div class="pair"><div><h3>BEFORE · warm</h3>{{st8.wf_before_warm}}</div><div><h3>AFTER · warm</h3>{{st8.wf_after_warm}}</div></div>

<h2>6 · The suspects on the list, confirmed or ruled out</h2>
{{txt.factors}}

<h2>7 · The server change that would help most (for the I5 lane — not done here)</h2>
{{txt.server}}

<h2>8 · Screenshots (headless, after the change)</h2>
{{txt.shots}}

<h2>9 · Where each number comes from · what could be wrong · what I did not do</h2>
{{txt.caveats}}
</main>
</body></html>
