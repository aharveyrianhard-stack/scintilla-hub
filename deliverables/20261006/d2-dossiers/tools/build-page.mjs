// D2 · builds D2-DOSSIERS.html from data/dry-run-20261006.json (nothing typed by hand but the fixed sentences below).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url)), r = JSON.parse(fs.readFileSync(path.join(here, '../data/dry-run-20261006.json'), 'utf8'))
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
const TEN = ['IYJ', 'RSPN', 'VIS', 'VNQ', 'XOP', 'AGG', 'US10Y', 'US2S10S', 'US2Y', 'GCUSD'], B = r.stages.B
const card = (t) => { const d = B.texts[t]; return `<section class="c"><h3>${t}</h3>${[['BUSINESS', d.business_now], ['CATALYSTS', d.catalysts], ['WATCH', d.watch_notes]].map(([k, v]) => `<h4>${k}</h4>${v ? v.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('') : '<p class="dim">(nothing to state — the tab stays empty rather than guess)</p>'}`).join('')}</section>` }
const shot = (f, cap) => `<figure><img src="shots/${f}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D2 · A dossier for every name</title><style>
:root{--bg:#0d0e0f;--p1:#131416;--ln:#26282b;--ink:#c6c8cb;--dim:#8e9195;--hi:#d2d2d2}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:56px 16px 48px}
.w{max-width:1180px;margin:0 auto}h1{font:600 20px/1.3 ui-monospace,Menlo,monospace;color:var(--hi);letter-spacing:.06em;margin:0 0 6px}
h2{font:600 12px/1.3 ui-monospace,Menlo,monospace;color:var(--dim);letter-spacing:.14em;text-transform:uppercase;margin:34px 0 10px;border-top:1px solid var(--ln);padding-top:16px}
h3{font:600 14px ui-monospace,Menlo,monospace;color:var(--hi);margin:0 0 6px}h4{font:600 11px ui-monospace,Menlo,monospace;color:var(--dim);letter-spacing:.12em;margin:10px 0 2px}
p{margin:4px 0}.dim{color:var(--dim)}.big{font:600 26px ui-monospace,Menlo,monospace;color:var(--hi)}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.c{background:var(--p1);border:1px solid var(--ln);padding:12px 14px}
figure{margin:0;background:var(--p1);border:1px solid var(--ln)}img{display:block;width:100%;height:auto}figcaption{padding:8px 10px;color:var(--dim);font-size:12px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--ln);padding:6px 8px;text-align:left;vertical-align:top;font-size:12px}th{color:var(--dim);font-weight:600}
code{font:12px ui-monospace,Menlo,monospace;color:var(--hi);word-break:break-all}ol{padding-left:20px}details{margin-top:34px;border-top:1px solid var(--ln);padding-top:12px}summary{font:600 12px ui-monospace,Menlo,monospace;color:var(--dim);letter-spacing:.14em;cursor:pointer}
</style></head><body><div class="w">
<h1>D2 · A DOSSIER FOR EVERY NAME</h1>
<p class="dim">6 Oct 2026 · nothing is live yet — this is the proposal, with the pictures of what READ will say.</p>
<p class="big">${B.before} names without a dossier → ${B.after}</p>
<p>Of ${r.active} active names, ${B.before} opened READ on a developer sentence. After the change every one has plain words: ${Object.entries(B.inserted_by_class).map(([k, v]) => v + ' ' + ({ etf: 'funds', future: 'futures', index: 'Treasury yields (Cboe)', rate: 'Treasury series (2-year, 2s10s)' }[k] || k)).join(' · ')}.</p>
<h2>Pictures — the live page, before and after</h2>
<div class="g">${[['preview-IYJ-before-BUSINESS-1680.png', 'BEFORE · IYJ (a sister fund of XLI) · READ shows the developer sentence'], ['preview-IYJ-after-BUSINESS-1680.png', 'AFTER · IYJ · what the fund is, its ten largest holdings, its sector mix'], ['preview-RSPN-after-BUSINESS-1680.png', 'AFTER · RSPN (equal-weight industrials)'], ['preview-US10Y-before-BUSINESS-1680.png', 'BEFORE · US10Y'], ['preview-US10Y-after-BUSINESS-1680.png', 'AFTER · US10Y · what the 10-year yield is'], ['preview-US10Y-after-WATCH-1680.png', 'AFTER · US10Y · WATCH · its range over the last 12 months'], ['preview-GCUSD-after-BUSINESS-1680.png', 'AFTER · GCUSD · gold: the contract and the session'], ['preview-GCUSD-after-WATCH-1680.png', 'AFTER · GCUSD · WATCH · its range']].map((x) => shot(...x)).join('')}</div>
<h2>Phone (390 wide)</h2><div class="g">${[['preview-IYJ-after-BUSINESS-390.png', 'IYJ · BUSINESS'], ['preview-US10Y-after-WATCH-390.png', 'US10Y · WATCH']].map((x) => shot(...x)).join('')}</div>
<h2>Why they were missing</h2><table><tr><th>Class</th><th>Count</th><th>Why</th></tr>
<tr><td>Funds</td><td>64</td><td>Admitted on 27 Sep as “Geiger only”. The job that writes dossiers and the job that loads fund holdings both walked the full-treatment list only, so these funds had no holdings, no fees, no description — and no dossier.</td></tr>
<tr><td>Futures (gold, silver)</td><td>2</td><td>Not on the full-treatment list, and there is no company profile to write from: the writer had nothing to say.</td></tr>
<tr><td>Treasury series (3-month, 2-, 5-, 10-, 30-year, 2s10s)</td><td>6</td><td>Same: not on the list, and a yield has no profile at the data provider.</td></tr></table>
<h2>Ten sample dossiers (exactly what the job would write)</h2><div class="g">${TEN.map(card).join('')}</div>
<h2>Where each sentence comes from</h2><table>
<tr><th>Fund: name, manager, assets, expense ratio, number of holdings, listing date, description, sector mix</th><td>The data provider (FMP), stored in the Hub’s fund table. Read on 6 Oct for all 64 funds: every one answered.</td></tr>
<tr><th>Fund: largest holdings and weights</th><td>The provider’s holdings list, the ten largest lines.</td></tr>
<tr><th>Fund: holdings reporting soon</th><td>The Hub’s own earnings calendar, for those ten lines.</td></tr>
<tr><th>Range (“traded between …”)</th><td>Daily bars from the Hub’s chart service; for the 2-year yield and the 2s10s, the US Treasury’s daily yield curve the Hub already stores.</td></tr>
<tr><th>What a yield, future or coin is; its contract; its trading hours</th><td>Fixed sentences written once and reviewed (in the code, with no number in them). No model writes anything.</td></tr></table>
<h2>What could be wrong</h2><ul>
<li>AGG (a bond fund): the provider lists its 13,000 bonds without symbols, so the Hub stores no holdings for it — its dossier has the description, fees and size, no “largest holdings”. DBC (commodities) shows its two cash holdings.</li>
<li>The provider writes “IShares” with a capital I; the words are shown as the provider gives them.</li>
<li>The “what moves it” lines for rates, metals and futures are general descriptions, not dated events.</li>
<li>The fixed descriptions for the names that already have a hand-written dossier (BTC, ES, VIX …) are not used: a real dossier is never replaced.</li></ul>
<h2>What was not done</h2><ul><li>Nothing deployed, nothing written to the database. The pictures are the live page with the proposed words handed to it for one read.</li><li>The next dated events for rates (Fed meetings, CPI) are not added to CATALYSTS yet.</li><li>The 36 funds that already have an automatic dossier will also gain the longer holdings list and the sector mix when the job refreshes them — not pictured here.</li></ul>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Dry run: the function’s real code run in memory on a read-only copy of the database (${esc(r.snapshot_utc)}) and the provider’s answers for the 64 funds (${esc(r.fmp_read_utc)}). Stage A (before the fund facts are loaded): ${r.stages.A.before} → ${r.stages.A.after}; the funds then say “its holdings, fees and size have not been loaded yet”. Stage B (after): ${B.before} → ${B.after}, shortest text ${B.shortest_business[0][1]} characters (${B.shortest_business[0][0]}), ${B.with_range} of 72 carry a range line, real dossiers untouched: ${B.real_dossiers_untouched}. Runs needed at 60 names a run: 2.</p>
<p>Deploy steps for the coordinator, in order:</p><ol>
<li><code>supabase functions deploy fmp-backfill --project-ref wadinxqplrggagkvrdag --no-verify-jwt</code> and <code>supabase functions deploy dossier-facts --project-ref wadinxqplrggagkvrdag --no-verify-jwt</code> (both import <code>_shared/</code>; keep the flags the live versions were deployed with).</li>
<li>Load the fund facts: <code>curl -X POST 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-backfill?job=etf&sym=AGG,DBC,IAI,IAK,IAT,IBB,IDU,IEO,IEZ,IGM,IHE,IHF,IJR,IPAY,ITOT,IWV'</code> then the same for the next groups of 16 (list: data/fmp-fund-read-20261006.json). Groups keep each call short; VT, VXUS and ITOT carry 2,500–9,500 lines each.</li>
<li>Dry check: <code>curl 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/dossier-facts?dry=1&sym=IYJ,US10Y,GCUSD,US2S10S'</code> — compare with the samples above.</li>
<li>Write: <code>curl -X POST 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/dossier-facts'</code> twice (60 names a run), or wait two hourly runs (cron 293, :52).</li>
<li>Count: <code>select count(*) from tickers t left join ticker_context c using(ticker) where t.active and length(coalesce(c.business_now,''))&lt;40</code> → 0.</li></ol>
<p>Way back: <code>delete from read_blocks where section in ('business','catalysts','watch') and ticker in (…the 72…)</code>; <code>delete from ticker_context where enrich_sources='FACTS:f1-v1' and ticker in (…the 72…)</code>; redeploy the two functions from <code>origin/hub/f1-full-treatment-20261003</code>. The fund facts (etf_info / etf_holdings rows for the 64) can stay or be deleted by ticker.</p>
<p>Neighbours checked: read-engine (reads the same three columns every 10 minutes — unchanged), the READ tab’s date label (shows “DOSSIER · AS OF” the write time — seen in the pictures), FINANCIALS → HOLDINGS for the 64 funds (will fill from the same load), the provider budget (66 more funds × 2 calls, once a week), the chart service (up to 60 GETs of 260 daily bars per hourly run).</p>
</details></div></body></html>`
fs.writeFileSync(path.join(here, '../D2-DOSSIERS.html'), html); console.log('written', html.length)
