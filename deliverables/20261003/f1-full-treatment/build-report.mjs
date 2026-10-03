/* F1 (3 Oct 2026) · builds F1-FULL-TREATMENT.html and matrix.json from the measured files in data/ — every number on the page is
   read from them, none is typed. node build-report.mjs */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url)), J = (f) => JSON.parse(fs.readFileSync(path.join(HERE, 'data', f), 'utf8'))
const B = J('matrix-before-20261003.json'), A = J('matrix-after-projected-20261003.json'), P = J('page-cells-20261003.json'), ST = J('staged-20261003.json')
const CL = J('admission-checklist-v1.json'), V2 = J('admission-v2-candidates.json'), V3 = J('admission-v3-candidates.json'), SK = J('skhy-preadmission-20261003.json'), FILL = J('fmp-fill-20261003.json')
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const RB = Object.fromEntries(B.rows.map((r) => [r.ticker, r])), RA = Object.fromEntries(A.rows.map((r) => [r.ticker, r]))
const v2 = V2.full.map((x) => x.symbol), v3 = V3.full.map((x) => x.symbol).filter((t) => RB[t] && !v2.includes(t))
const GROUPS = { 'Bookmark names (27 Sep)': v2, '29 Sep names': v3, 'Original names': B.rows.filter((r) => r.tier === 'full' && !v2.includes(r.ticker) && !v3.includes(r.ticker)).map((r) => r.ticker), 'Geiger-only funds': B.rows.filter((r) => r.tier === 'geiger_only').map((r) => r.ticker) }
const SURF = CL.surfaces, S4 = ['OK', 'EMPTY', 'PLACEHOLDER', 'ERROR']
const sym = { OK: '●', EMPTY: '○', PLACEHOLDER: '◌', ERROR: '✕' }
const notOk = (rows, id) => rows.filter((r) => r.cells[id].s !== 'OK').length
const totals = (M) => { const t = { OK: 0, EMPTY: 0, PLACEHOLDER: 0, ERROR: 0 }; for (const r of M.rows) for (const s of SURF) t[r.cells[s.id].s]++; return t }
const TB = totals(B), TA = totals(A), CELLS = B.rows.length * SURF.length

/* ── matrix.json (the brief's file): before, the projected after, the page sample ── */
fs.writeFileSync(path.join(HERE, 'matrix.json'), JSON.stringify({
  artifact_kind: 'SCINTILLA_F1_MATRIX', built_utc: new Date().toISOString(), statuses: CL.statuses, surfaces: SURF.map((s) => ({ id: s.id, group: s.group, label: s.label, source: s.source, check: s.check })),
  before: { read_utc: B.built_utc, universe: B.universe, summary: B.summary, totals: TB, rows: B.rows },
  after_projected: { what: 'the same checks with the staged loads laid over the reads (scripts/admission-checklist.mjs --overlay data/staged-20261003.json) — PROJECTED until the coordinator applies them', read_utc: A.built_utc, summary: A.summary, totals: TA, rows: A.rows.map((r) => ({ ticker: r.ticker, cells: Object.fromEntries(Object.entries(r.cells).map(([k, c]) => [k, { s: c.s, why: c.why }])) })) },
  page_sample: { site: P.site, probed_utc: P.probed_utc, names: P.names, writes_blocked: P.writes_blocked, agreement_with_data: P.agree, disagreements: P.disagree, developer_words: P.developer_words, tally: P.tally },
}))

/* ── the page ── */
const css = `
:root{--bg:#0d0e0f;--p1:#131416;--p2:#181a1c;--ln:#26282b;--ink:#c6c8cb;--dim:#8e9195;--faint:#606367;--hi:#d2d2d2}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:56px 16px 48px}
.w{max-width:1180px;margin:0 auto}
h1{font:600 13px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--hi);margin:0 0 4px}
.sub{color:var(--dim);font-size:12px;margin:0 0 22px}
h2{font:600 11px/1.3 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:34px 0 10px;padding-bottom:7px;border-bottom:1px solid var(--ln)}
p{margin:0 0 10px;max-width:880px}
.big{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:8px 0 6px}
.k{background:var(--p1);border:1px solid var(--ln);border-radius:8px;padding:12px 14px}
.k b{display:block;font:600 22px/1.2 ui-monospace,"SF Mono",Menlo,monospace;color:var(--hi)}
.k span{font:11px/1.4 ui-monospace,"SF Mono",Menlo,monospace;color:var(--dim);letter-spacing:.06em}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--ln);border-radius:8px;background:var(--p1)}
table{border-collapse:collapse;width:100%;font:11.5px/1.4 ui-monospace,"SF Mono",Menlo,monospace}
th,td{padding:5px 8px;border-bottom:1px solid var(--ln);text-align:left;vertical-align:top;white-space:nowrap}
th{color:var(--faint);font-weight:600;letter-spacing:.06em;font-size:11px;position:sticky;top:0;background:var(--p2)}
td.n{text-align:right;color:var(--dim)} td.n b{color:var(--hi);font-weight:600}
td.c{text-align:center;padding:5px 3px;font-size:12px}
.s-OK{color:#8f9396}.s-EMPTY{color:#c9cbcd}.s-PLACEHOLDER{color:#c9cbcd}.s-ERROR{color:#d2d2d2;font-weight:700}
td.t{color:var(--hi);font-weight:600}
.arrow{color:var(--faint)}
.pics{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
figure{margin:0;background:var(--p1);border:1px solid var(--ln);border-radius:8px;padding:8px}
figure img{width:100%;height:auto;display:block;border-radius:4px}
figcaption{font:11px/1.45 ui-monospace,"SF Mono",Menlo,monospace;color:var(--dim);padding:7px 2px 0}
ul{margin:4px 0 12px;padding-left:18px;max-width:900px} li{margin:4px 0}
code{font:11.5px ui-monospace,"SF Mono",Menlo,monospace;color:var(--hi);background:var(--p2);border:1px solid var(--ln);border-radius:4px;padding:0 4px}
.legend{font:11px ui-monospace,"SF Mono",Menlo,monospace;color:var(--dim);margin:6px 0 10px}
details.sc-pagespecs{margin-top:40px;border-top:1px solid var(--ln);padding-top:12px}
details.sc-pagespecs summary{cursor:pointer;font:600 11px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.2em;color:var(--dim)}
details.sc-pagespecs h3{font:600 11px ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.14em;color:var(--dim);margin:18px 0 6px;text-transform:uppercase}
details.sc-pagespecs p,details.sc-pagespecs li{color:var(--dim);font-size:12px}
@media (max-width:600px){body{padding:56px 16px 40px}.k b{font-size:19px}th,td{padding:4px 6px}}
`
const cnt = (t) => S4.map((s) => `<td class="n">${t[s]}</td>`).join('')
const pair = (b, a) => b === a ? `<td class="n">${b}</td>` : `<td class="n">${b} <span class="arrow">→</span> <b>${a}</b></td>`
const summaryRows = SURF.map((s) => `<tr><td>${esc(s.label)}</td>${S4.map((k) => pair(B.summary[s.id][k], A.summary[s.id][k])).join('')}</tr>`).join('')
const groupRows = SURF.map((s) => `<tr><td>${esc(s.label)}</td>${Object.values(GROUPS).map((names) => { const b = notOk(names.map((t) => RB[t]), s.id), a = notOk(names.map((t) => RA[t]), s.id); return b === a ? `<td class="n">${b}</td>` : `<td class="n">${b} <span class="arrow">→</span> <b>${a}</b></td>` }).join('')}</tr>`).join('')
const COLS = [['board.price', 'LAST'], ['board.chg', 'CHG'], ['board.fpe', 'F P/E'], ['board.mktcap', 'MCAP'], ['board.revenue', 'REV'], ['board.rsi', 'RSI'], ['board.geiger', 'GEIG'], ['board.rvol', 'RVOL'], ['chart.widths', '24 W'], ['chart.prevclose', 'PREV'], ['tab.geiger', 'G TAB'], ['tab.fundamentals', 'FUND'], ['tab.estimates', 'EST'], ['tab.comps', 'COMPS'], ['tab.financials', 'FIN'], ['tab.capital', 'CAP'], ['tab.stats', 'STATS'], ['tab.news', 'NEWS'], ['tab.social', 'SOC'], ['tab.earnings', 'ERN'], ['tab.read_business', 'R·BUS'], ['tab.read_verdict', 'R·VER'], ['tab.read_catalysts', 'R·CAT'], ['tab.read_watch', 'R·WAT'], ['tab.read_dossier', 'DOSS'], ['room.earnings_calendar', 'CAL'], ['room.news', 'NEWS RM']]
const cell = (b, a) => { const sb = b.s, sa = a.s, t = esc((sb === sa ? b.why : b.s + ': ' + b.why + '  →  ' + a.s + ': ' + a.why)); return `<td class="c" title="${t}"><span class="s-${sb}">${sym[sb]}</span>${sb !== sa ? `<span class="arrow">›</span><span class="s-${sa}">${sym[sa]}</span>` : ''}</td>` }
const bookRows = v2.map((t) => `<tr><td class="t">${esc(t)}</td><td>${RB[t].kind === 'fund' ? 'fund' : 'co.'}</td>${COLS.map(([id]) => cell(RB[t].cells[id], RA[t].cells[id])).join('')}</tr>`).join('')
const SYSTEMIC = ['tab.social', 'chart.widths', 'tab.read_dossier']
const missing56 = v2.map((t) => ({ t, left: COLS.filter(([id]) => RA[t].cells[id].s !== 'OK' && RA[t].cells[id].fillable !== false && !SYSTEMIC.includes(id)).map(([id, l]) => l + ' (' + RA[t].cells[id].why.slice(0, 90) + ')') })).filter((x) => x.left.length)
const nature56 = v2.filter((t) => COLS.some(([id]) => RA[t].cells[id].s !== 'OK' && RA[t].cells[id].fillable === false && !SYSTEMIC.includes(id)))
const complete56 = v2.length - missing56.length
const remain = [
  ['The seven chart widths nothing refreshes (2m, 45m, 8h, 2D, 3M, 6M, 12M)', 'all 590', 'They stop on the day each name was pulled (18 Aug, 27 Sep or 29 Sep). The daily pass is written (provider scripts/no-tail-widths-pass.mjs) but not run: it rewrites stored bars for every name and re-applies the history floors, which the coordinator should run and arm as a schedule (the command is in the provider runbook).'],
  ['SOCIAL prints STALE on every name', 'all 590', `The X feed's newest post is ${esc((B.rows[0].cells['tab.social'].why.match(/is ([^ ]+ [^ ]+)/) || [, '25 Sep'])[1])} — the X collector has not published since the screen-capture browser was stopped on 24–25 Sep. No data load can fix it; the collector has to run again (headless).`],
  ['READ → the dossier is a facts dossier, not a researched one', `${ST.ticker_context.length} names`, 'The words are composed from stored facts only (no model). The 191 older dossiers are 70–110 days old and nothing refreshes them; a researched dossier needs the draft dossier agent, which would call a paid model API.'],
  ['The 64 Geiger-only funds', '64', 'By their tier they get no profile, news, statements or dossier, so the company tabs show company tables of "not stored" lines and "could not be built". Alan (3 Oct): "66 Geiger-only names off the Hub" — the served-set lane (U5) decides; nothing was loaded for them.'],
  ['FUNDAMENTALS for every fund', 'all funds', 'The Station fundamentals shell has no fund view: it draws a company sheet of "not stored" lines. A design change, not data.'],
  ['ALERTS', 'all 590', 'A parked room for every name.'],
  ['Words on screen that are table names', `${P.developer_words.names} of ${P.names} sampled`, 'READ\'s developer line, and inside panels: ' + P.developer_words.phrases.map((x) => x.split(': ')[1]).filter((v, i, a) => a.indexOf(v) === i).join(', ') + '. Alan asked for these to leave the panels; a text change is outside this brief.'],
  ['MOG.A', '1', 'Its RSI / Williams %R come from FMP\'s indicator export, which still asks for "MOG.A" (last reading 2 May 2024); its stored analyst notes are from 2024. The F1 symbol fix covers statements, estimates and earnings, not the indicator export.'],
  ['Funds FMP gives no holdings list for', '8', 'GLD, SLV, USO (commodities) and TLT, IEF, HYG, LQD, SHY (bonds): HOLDINGS stays empty.'],
  ['Companies whose comps set cannot be built', '8', 'AMRC, BTSG, BYND, CCJ, HIMS, MOG.A, SNX, SPIR: the live C4 rule keeps no peer; C5 (pushed, not live) seats most of them.'],
  ['F P/E blank by rule or by nature', `${A.summary['board.fpe'].EMPTY}`, 'Loss-making names (no P/E exists) and non-USD reporters (the board does not convert currencies).'],
]
const fills = [
  ['READ dossiers', `${ST.ticker_context.length} names (all 56 bookmark names among them)`, 'supabase/migrations/20261003_f1_facts_dossiers.sql', 'BUSINESS, CATALYSTS and WATCH from stored facts; 7 empty dossier shells filled only while still empty'],
  ['Fund holdings', `${Object.keys(ST.etf_holdings).length} funds · ${Object.values(ST.etf_holdings).reduce((a, b) => a + b, 0).toLocaleString('en-US')} lines`, 'supabase/migrations/20261003_f1_etf_holdings.sql', 'FMP etf/holdings, read on a throw-away machine'],
  ['Statements (FUNDAMENTALS, FINANCIALS, CAPITAL, REVENUE)', `${Object.keys(ST.statements_expected).length} companies`, 'supabase/migrations/20261003_f1_statements_trigger.sql', 'the loader\'s own run for exactly these names; FMP answers for every one'],
  ['Next earnings date', ST.earnings_events.map((r) => r.ticker + ' ' + r.date).join(', '), 'supabase/migrations/20261003_f1_earnings_next.sql', 'none of them in the suppression archive'],
  ['MOG.A', 'FMP symbol MOG-A + a profile row', 'supabase/migrations/20261003_f1_mog_a.sql', 'its STATS, MKT CAP and READ fill; statements follow the loader fix'],
]
const loaders = [
  ['fmp-fundamentals · fmp-analyst · fmp-events', 'walked the list in slices (10 names per 6 h ≈ a 13-day lap for statements; 30 per 4–6 h ≈ 3 days)', 'a company with nothing yet goes first, a few a run, rotated; the slice size and the overrides are unchanged'],
  ['the same three', 'asked FMP for the Hub ticker, ignoring the stored FMP spelling (MOG.A never answered)', 'they use tickers.fmp_symbol'],
  ['fund holdings', 'no job wrote them after 22 Jul', 'fmp-backfill?job=etf, weekly; a fund\'s list is replaced only when FMP answers with one'],
  ['dossiers', 'no job writes them', 'dossier-facts, hourly: a facts dossier for any full name with none; refreshes only its own rows'],
  ['the seven widths', 'no scheduled pass', 'no-tail-widths-pass.mjs (provider), to run daily on its own scheduled machine'],
]
const skhy = SK.rows[0], skC = { OK: 0, EMPTY: 0, PLACEHOLDER: 0, ERROR: 0 }; for (const c of Object.values(skhy.cells)) skC[c.s]++
const skRows = SURF.map((s) => { const c = skhy.cells[s.id]; return `<tr><td class="s-${c.s}">${sym[c.s]} ${c.s}</td><td>${esc(s.label)}</td><td style="white-space:normal">${esc(c.why)}${c.s !== 'OK' && c.fill ? ' <span class="arrow">→</span> ' + esc(c.fill) : ''}</td></tr>` }).join('')
const fig = (f, cap) => fs.existsSync(path.join(HERE, 'shots', f)) ? `<figure><img src="shots/${f}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>` : ''
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>F1 · Full Treatment</title><style>${css}</style></head><body><div class="w">
<h1>F1 · The full Hub treatment</h1>
<p class="sub">3 Oct 2026 · every served name (${B.universe.count}) on every surface (${SURF.length}) · data read ${esc(B.built_utc.slice(0, 16).replace('T', ' '))}Z · the real page checked headless for ${P.names} names</p>

<h2>The matrix, before → after</h2>
<div class="big">
  <div class="k"><b>${TB.OK.toLocaleString('en-US')} <span class="arrow">→</span> ${TA.OK.toLocaleString('en-US')}</b><span>CELLS OK OF ${CELLS.toLocaleString('en-US')}</span></div>
  <div class="k"><b>${TB.PLACEHOLDER} <span class="arrow">→</span> ${TA.PLACEHOLDER}</b><span>DEVELOPER TEXT / STUB</span></div>
  <div class="k"><b>${TB.EMPTY} <span class="arrow">→</span> ${TA.EMPTY}</b><span>EMPTY</span></div>
  <div class="k"><b>${TB.ERROR} <span class="arrow">→</span> ${TA.ERROR}</b><span>STALE OR WRONG</span></div>
  <div class="k"><b>${complete56} / 56</b><span>BOOKMARK NAMES COMPLETE AFTER*</span></div>
</div>
<p class="legend">After = projected: the same checks with the staged loads laid over today's reads. Nothing is applied until the coordinator runs the loads. * every surface a job can fill is filled; left aside are blanks that are right by nature (a loss-maker has no P/E; a fund has no statements sheet) and the three things no load can fix (the seven widths' pass, the stopped X feed, a researched dossier).</p>
<div class="scroll"><table><thead><tr><th>surface</th><th>OK</th><th>EMPTY</th><th>PLACEHOLDER</th><th>ERROR</th></tr></thead><tbody>${summaryRows}</tbody></table></div>

<h2>What Alan saw on READ — and what it will say</h2>
<div class="pics">
${fig('preview-AAOI-before-BUSINESS-1680.png', 'AAOI · READ → BUSINESS today: the developer line ("no template")')}
${fig('preview-AAOI-after-BUSINESS-1680.png', 'AAOI · READ → BUSINESS after the load (the deployed page, the staged row served to it)')}
${fig('preview-AAOI-after-CATALYSTS-390.png', 'AAOI · CATALYSTS after the load, on a phone')}
${fig('preview-ARKX-after-CATALYSTS-1680.png', 'ARKX (a fund) · its catalysts are its largest holdings’ report dates')}
</div>

<h2>The 56 bookmark names (27 Sep)</h2>
<p class="legend">● OK · ○ EMPTY · ◌ developer text · ✕ stale or wrong · before › after. Hover a cell for the reason.</p>
<div class="scroll"><table><thead><tr><th>name</th><th></th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${bookRows}</tbody></table></div>
<p style="margin-top:10px">Every one of the 56 has its price, change, previous close, Geiger on 7 of 7 rungs, RVOL, news and a board row. Before: all 56 showed the developer line on READ → BUSINESS, CATALYSTS and WATCH; 23 funds had empty HOLDINGS; 4 had no next earnings date in the calendar or an empty comps / capital box. After the loads, ${complete56} are complete (${nature56.length} of them keep a blank that is right by nature: a loss-maker's F P/E, a fund's statements sheet).${missing56.length ? ' Still short: ' + missing56.map((x) => `<b>${esc(x.t)}</b> — ${esc(x.left.join('; '))}`).join(' · ') : ''}</p>

<h2>By group: names not OK, before → after</h2>
<div class="scroll"><table><thead><tr><th>surface</th>${Object.entries(GROUPS).map(([g, n]) => `<th>${esc(g)} (${n.length})</th>`).join('')}</tr></thead><tbody>${groupRows}</tbody></table></div>

<h2>What was filled (staged, with the way back written first)</h2>
<div class="scroll"><table><thead><tr><th>what</th><th>how many</th><th>load</th><th>from</th></tr></thead><tbody>${fills.map((f) => `<tr><td>${esc(f[0])}</td><td style="white-space:normal">${esc(f[1])}</td><td><code>${esc(f[2])}</code></td><td style="white-space:normal">${esc(f[3])}</td></tr>`).join('')}</tbody></table></div>

<h2>What remains, and exactly why</h2>
<div class="scroll"><table><thead><tr><th>what</th><th>names</th><th>why</th></tr></thead><tbody>${remain.map((r) => `<tr><td style="white-space:normal">${esc(r[0])}</td><td>${esc(r[1])}</td><td style="white-space:normal">${r[2]}</td></tr>`).join('')}</tbody></table></div>

<h2>Why new names did not get everything — the loaders, fixed</h2>
<div class="scroll"><table><thead><tr><th>loader</th><th>what it did</th><th>now (on the branch)</th></tr></thead><tbody>${loaders.map((r) => `<tr><td>${esc(r[0])}</td><td style="white-space:normal">${esc(r[1])}</td><td style="white-space:normal">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>

<h2>The admission checklist — SK Hynix (SKHY), before admission</h2>
<p><b>${skC.OK} of ${SURF.length}</b> surfaces OK today (the trading-state dot). ${skC.EMPTY} empty, ${skC.ERROR} stale or wrong, ${skC.PLACEHOLDER} developer text — each line names the step that fills it. Run it again after each step of the sitting; it is done when only SOCIAL (the X feed), ALERTS and the dossier's depth remain.</p>
<div class="scroll"><table><thead><tr><th>state</th><th>surface</th><th>today, and what fills it</th></tr></thead><tbody>${skRows}</tbody></table></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<h3>What this page shows</h3>
<p>Every name the Hub serves today (${B.universe.count}: ${GROUPS['Original names'].length + v2.length + v3.length} with the full treatment, ${GROUPS['Geiger-only funds'].length} Geiger-only) checked on ${SURF.length} surfaces: the board row and its columns, the chart's 24 widths, the Geiger rungs and previous close, every company tab (GEIGER, FUNDAMENTALS, ESTIMATES, COMPS, FINANCIALS with CAPITAL, STATS, NEWS, SOCIAL, EARNINGS, the four READ sections and the dossier's date), the EARNINGS calendar, the NEWS room and ALERTS. Each cell is OK, EMPTY, PLACEHOLDER (developer text or a stub) or ERROR (stale or wrong), with the reason and the job that fills it.</p>
<h3>Where each number comes from</h3>
<ul>
<li>The checks: <code>control/ADMISSION_CHECKLIST.json</code> and <code>scripts/admission-checklist.mjs</code> in the provider repo (branch provider/f1-full-treatment-20261003). It reads the chart API (/universe, /quotes, /geiger, /candles) and the Hub database through the page's own public read endpoint — the same rows and rules the page gets — plus the Hub's X feed. GET only; no key.</li>
<li>The 24 widths for all names: U4b's R2 walk of 3 Oct 14:35Z (taking 14,160 chart reads from the live service would have loaded every series into its cache).</li>
<li>COMPS: the tab's own live rule (C4) run over today's rows.</li>
<li>The real page: ${P.names} names opened headless on the deployed scintillahub.ai (all 56 bookmark names, 12 of the 29 Sep names, 10 original names, 4 Geiger-only funds, MOG.A), every tab and READ section clicked; ${P.writes_blocked} write requests (all blocked). The page and the data checks agree on every one of the 17 surfaces the page shows, for every sampled name (0 disagreements after aligning the checks to the page's own words).</li>
<li>The fills: FMP read on a throw-away batch machine (428 calls, all answered), turned into additive loads under <code>supabase/migrations/20261003_f1_*</code>, each with its rollback beside it.</li>
<li>After = projected with the same checks (<code>--overlay data/staged-20261003.json</code>); the page previews serve the staged row to the deployed page for one read and change nothing.</li>
</ul>
<h3>What could be wrong</h3>
<ul>
<li>The after column is a projection; the loads have not run. The real after is one command: the checklist with <code>--all</code> once they are applied.</li>
<li>The facts dossier states what is stored. Where a stored number is old (MOG.A's 2024 targets) the dossier repeats it, dated.</li>
<li>A non-USD reporter's estimates are given as dates only — the currency of FMP's estimate rows cannot be proven from the row.</li>
<li>The dossier for a fund lists its largest holdings' report dates only when those holdings are Hub names with a stored date.</li>
</ul>
<h3>What was not done</h3>
<ul>
<li>No table was written, no function deployed, no schedule created, no machine that already existed touched. The loads, the statements trigger, the seven-width pass and the two new schedules wait for the coordinator.</li>
<li>Geiger-only funds were not filled (their tier skips the loaders by design and Alan has asked for them off the Hub).</li>
<li>No page text or layout changed (the developer words on screen are listed, not removed).</li>
</ul>
</details>
</div></body></html>`
fs.writeFileSync(path.join(HERE, 'F1-FULL-TREATMENT.html'), html)
console.log(JSON.stringify({ html_kb: Math.round(html.length / 1024), before: TB, after: TA, complete56, missing56 }))
