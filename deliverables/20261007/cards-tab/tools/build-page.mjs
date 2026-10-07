/* CP2 (7 Oct 2026) · builds CARDS-TAB.html, the before → after page for Alan, from data/cards.json and the pictures in
   shots/. Static: nothing fetched, no script of its own. Pictures first; panels carry labels, units and numbers; every
   sentence is in PAGE SPECS at the bottom. The BACK / CLOSE pair is placed by scripts/inject-scnav.py (a slot in the header).
     node deliverables/20261007/cards-tab/tools/build-page.mjs          (from the Hub repo root) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { money, pctPlain, cents } from "../tab.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, ".."), DATA = path.join(ROOT, "data");
/* the BACK / CLOSE pair, placed exactly as scripts/inject-scnav.py places it (the slot in the header, the snippet before
   </body>), so running the injector afterwards leaves this page as it is */
const SCNAV = fs.readFileSync(path.resolve(HERE, "../../../../scripts/scnav-snippet.html"), "utf8").trim();
const J = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const doc = J("cards.json"), C = doc.cards, hub = J("hub-cashflow-2026-10-07.json").names, stated = J("data-centre-stated.json").companies, facts = J("business-facts-fmp-2026-10-07.json");
const E = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NAME = { WDC: "Western Digital", SNDK: "SanDisk", MU: "Micron", STX: "Seagate" };
const FOUR = ["WDC", "SNDK", "MU", "STX"];
const have = (f) => fs.existsSync(path.join(ROOT, "shots", f));
const pic = (f, cap, cls = "") => { if (!have(f)) throw new Error("picture missing: " + f); return `<figure class="${cls}"><a href="shots/${f}"><img src="shots/${f}" alt="${E(cap)}" loading="lazy"></a><figcaption>${E(cap)}</figcaption></figure>`; };
const dcw = (b) => (b.data_centre.share == null ? "—" : (b.data_centre.approx ? "≈" : "") + pctPlain(b.data_centre.share, b.data_centre.approx ? 0 : 1));
const dcc = (b) => (b.blend.dc_profit_per_dollar == null ? "—" : (b.blend.approx ? "≈" : "") + cents(b.blend.dc_profit_per_dollar));
const bar = (v, max) => `<i class="bar"><s style="width:${v == null || !(max > 0) ? 0 : Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%"></s></i>`;
const basisWord = (k) => (k === "fy" ? "full-year statement" : "four quarters added");

/* ---- the four names */
const mxDc = Math.max(...FOUR.map((t) => C[t].business.blend.dc_profit_per_dollar || 0)), mxCash = Math.max(...FOUR.map((t) => C[t].business.blend.cash_per_dollar || 0));
const fourTable = `<table class="t four"><thead><tr><th></th><th class="hl">DATA-CENTRE PROFIT PER $1 OF STOCK</th><th class="hl">CASH PER $1 OF STOCK</th><th>DATA-CENTRE SHARE OF REVENUE</th><th>GROSS MARGIN</th><th>OPERATING MARGIN</th><th>FREE-CASH-FLOW MARGIN</th><th>FREE-CASH-FLOW YIELD</th></tr></thead><tbody>` +
  FOUR.map((t) => { const b = C[t].business; return `<tr><td class="lab"><b>${E(NAME[t])}</b> ${t}</td><td class="hl"><b>${dcc(b)}</b>${bar(b.blend.dc_profit_per_dollar, mxDc)}</td><td class="hl"><b>${cents(b.blend.cash_per_dollar)}</b>${bar(b.blend.cash_per_dollar, mxCash)}</td><td>${dcw(b)}</td><td>${pctPlain(b.margins.gross)}</td><td>${pctPlain(b.margins.operating)}</td><td>${pctPlain(b.cash.margin)}</td><td>${pctPlain(b.cash.yield, 2)}</td></tr>`; }).join("") + "</tbody></table>";
const rank = (f, w) => [...FOUR].sort((a, b) => f(C[b].business) - f(C[a].business)).map((t) => `<span><b>${E(NAME[t])}</b> ${w(C[t].business)}</span>`).join("");
const makeTable = `<table class="t"><thead><tr><th></th><th>REVENUE · 12 MONTHS</th><th>× DATA-CENTRE SHARE</th><th>= DATA-CENTRE REVENUE</th><th>× GROSS MARGIN</th><th>= DATA-CENTRE PROFIT</th><th>÷ MARKET VALUE · 6 OCT CLOSE</th><th>= PER $1 OF STOCK</th></tr></thead><tbody>` +
  FOUR.map((t) => { const b = C[t].business; return `<tr><td class="lab"><b>${E(NAME[t])}</b></td><td>${money(b.period.revenue)}</td><td>${dcw(b)}</td><td>${(b.blend.approx ? "≈" : "") + money(b.blend.dc_revenue)}</td><td>${pctPlain(b.margins.gross)}</td><td>${(b.blend.approx ? "≈" : "") + money(b.blend.dc_revenue * b.margins.gross / 100)}</td><td>${money(b.market_value)}</td><td><b>${dcc(b)}</b></td></tr>`; }).join("") + "</tbody></table>";
const cashTable = `<table class="t"><thead><tr><th></th><th>FREE CASH FLOW · 12 MONTHS</th><th>READ FROM</th><th>÷ MARKET VALUE · 6 OCT CLOSE</th><th>= PER $1 OF STOCK</th></tr></thead><tbody>` +
  FOUR.map((t) => { const b = C[t].business; return `<tr><td class="lab"><b>${E(NAME[t])}</b></td><td>${money(b.cash.fcf)}</td><td class="dim">${E(basisWord(b.cash.basis).toUpperCase())} · TO ${E(b.cash.end)}</td><td>${money(b.market_value)}</td><td><b>${cents(b.blend.cash_per_dollar)}</b></td></tr>`; }).join("") + "</tbody></table>";

/* ---- what was checked on the way */
const BRIEF = { WDC: [3.2e9, 2.3], SNDK: [11.5e9, 4.7], MU: [52.9e9, 4.5], STX: [3.3e9, 1.8] };
const readTable = `<table class="t"><thead><tr><th></th><th>QUOTED TO YOU ON 7 OCT</th><th>FMP · FULL-YEAR STATEMENT</th><th>FMP · FOUR QUARTERS ADDED</th><th>THE HUB'S OWN TABLE</th><th class="hl">ON THE CARD</th><th>YIELD ON THE CARD</th><th>WHY</th></tr></thead><tbody>` +
  FOUR.map((t) => { const b = C[t].business, k = b.cash, f = facts.companies[t], fy = f.cash[0].freeCashFlow, q4 = f.cash_ttm.freeCashFlow, h = hub[t];
    const why = t === "MU" ? "the full-year row has no capital-spending line yet (taken from the earnings release)" : t === "STX" ? "one quarter files capital spending with the wrong sign, so the quarters overstate" : t === "WDC" ? "the two readings differ by 8%; the filed full-year statement is used" : "all readings agree";
    return `<tr><td class="lab"><b>${E(NAME[t])}</b></td><td>${money(BRIEF[t][0])} · ${BRIEF[t][1]}%</td><td>${money(fy)}</td><td>${money(q4)}</td><td>${h ? money(h.free_cf) : "—"}</td><td class="hl"><b>${money(k.fcf)}</b></td><td>${pctPlain(k.yield, 2)}</td><td class="dim wrap">${E(why.toUpperCase())}</td></tr>`; }).join("") + "</tbody></table>";
const dcRows = Object.entries(C).filter(([, c]) => c.business.data_centre.share != null);
const dcTable = `<table class="t"><thead><tr><th></th><th>SHARE</th><th>TAKEN FROM</th><th>WHAT COUNTS</th></tr></thead><tbody>` +
  dcRows.map(([t, c]) => { const d = c.business.data_centre; return `<tr><td class="lab"><b>${t}</b></td><td>${dcw(c.business)}</td><td class="dim">${d.basis === "segments" ? "FMP'S OWN DATA-CENTRE LINE" : d.basis === "hand" ? "FMP'S SPLIT · NAMED BY HAND" : "THE COMPANY'S OWN WORDS"}</td><td class="dim wrap">${E((d.basis === "stated" ? d.call + " · “" + d.quote + "”" : (d.counts.length && d.share < 100 ? d.counts.join(" + ") + " · " : "") + (d.why || "") + (d.note ? " · " + d.note : "")).toUpperCase())}</td></tr>`; }).join("") + "</tbody></table>";
const allTable = `<table class="t all"><thead><tr><th></th><th>DATA-CENTRE SHARE</th><th>GROSS</th><th>OPERATING</th><th>FREE CASH FLOW</th><th>FCF MARGIN</th><th>FCF YIELD</th><th>DATA-CENTRE PROFIT / $1</th><th>CASH / $1</th><th>SPLIT YEAR</th><th>ZONES</th><th>ESTIMATES CHECKED</th></tr></thead><tbody>` +
  Object.entries(C).map(([t, c]) => { const b = c.business, k = b.cash; return `<tr><td class="lab"><b>${t}</b></td><td>${dcw(b)}</td><td>${pctPlain(b.margins.gross)}</td><td>${pctPlain(b.margins.operating)}</td><td>${money(k.fcf)}${k.differs ? " ≠" : ""}</td><td>${pctPlain(k.margin)}</td><td>${pctPlain(k.yield, 2)}</td><td>${dcc(b)}</td><td>${cents(b.blend.cash_per_dollar)}</td><td class="dim">${b.lines ? "FY" + b.lines.fy + (b.lines.behind ? " · A YEAR BEHIND" : "") : "NO SPLIT"}</td><td>${c.zones ? c.zones.list.length : "—"}</td><td>${c.estimates_flag ? "YES" : "—"}</td></tr>`; }).join("") + "</tbody></table>";

const CSS = `:root{color-scheme:dark}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#0a0a0c;color:#c8c8cc;font:12px/1.5 ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;-webkit-font-smoothing:antialiased;padding:0 24px 60px}
a{color:#c8c8cc;text-decoration:none}
header.top{padding:16px 0 18px;border-bottom:1px solid #26262b;margin-bottom:8px}header.top .scnav{margin-bottom:16px}
.ttl{font-size:22px;letter-spacing:.2em;color:#c8c8cc;font-weight:700;line-height:1.35}
.sub{color:#8c8c92;font-size:11px;letter-spacing:.12em;margin-top:8px}
h2{font-size:12px;letter-spacing:.22em;font-weight:700;color:#c8c8cc;margin:34px 0 12px;padding-top:14px;border-top:1px solid #26262b}
.ph{font-size:11px;letter-spacing:.18em;color:#8c8c92;font-weight:700;margin-bottom:10px}
.dim{color:#8c8c92}.lab{color:#8c8c92;letter-spacing:.06em;font-size:11px;white-space:nowrap}.lab b{color:#c8c8cc;font-size:12px}
.panel{background:#111114;border:1px solid #26262b;border-radius:6px;padding:14px 16px;min-width:0;overflow-x:auto;margin-bottom:14px}
.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
.trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:start}
.phones{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,300px));gap:14px;align-items:start}
.tall{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,420px));gap:14px;align-items:start}
figure{margin:0;background:#111114;border:1px solid #26262b;border-radius:6px;padding:8px;min-width:0}
figure img{display:block;width:100%;height:auto;border-radius:3px}
figcaption{font-size:11px;letter-spacing:.14em;color:#8c8c92;padding:8px 2px 2px}
table.t{width:100%;border-collapse:collapse;margin:2px 0 4px;font-variant-numeric:tabular-nums}
table.t th{font-size:11px;font-weight:400;letter-spacing:.06em;color:#8c8c92;text-align:right;padding:4px 10px;border-bottom:1px solid #26262b;vertical-align:bottom;line-height:1.35}
table.t td{text-align:right;padding:6px 10px;border-bottom:1px solid #1a1a1e;font-size:12px;vertical-align:middle;white-space:nowrap}
table.t th:first-child,table.t td:first-child{text-align:left;padding-left:0}
table.t td.wrap{white-space:normal;text-align:left;font-size:11px;letter-spacing:.04em;min-width:220px}
table.t td b{color:#c8c8cc;font-weight:700}
table.four td{font-size:13px}table.four td.hl b{font-size:17px}
th.hl,td.hl{background:#16161a}
.bar{display:block;height:4px;background:#26262b;margin-top:4px}.bar s{display:block;height:100%;background:#3cb4c8;margin-left:auto}
.rank{display:flex;flex-wrap:wrap;gap:6px 22px;font-size:12px;margin:2px 0 4px}.rank span{white-space:nowrap}.rank b{color:#c8c8cc}
details.sc-pagespecs{margin-top:40px;border-top:1px solid #26262b;padding-top:14px;max-width:1100px}
details.sc-pagespecs summary{cursor:pointer;font-size:12px;letter-spacing:.22em;color:#8c8c92;font-weight:700}
details.sc-pagespecs h4{font-size:11px;letter-spacing:.2em;color:#c8c8cc;margin:22px 0 6px}
details.sc-pagespecs p,details.sc-pagespecs li{font:13px/1.65 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#c8c8cc;margin:0 0 8px}
details.sc-pagespecs ul,details.sc-pagespecs ol{margin:0 0 8px;padding-left:20px}
details.sc-pagespecs code{font:12px ui-monospace,Menlo,monospace;color:#c8c8cc;background:#1a1a1e;padding:1px 4px;border-radius:3px;overflow-wrap:anywhere}
details.sc-pagespecs q{color:#c8c8cc}
@media (max-width:900px){.pair,.trio{grid-template-columns:minmax(0,1fr)}body{padding:0 12px 50px}.ttl{font-size:17px;letter-spacing:.14em}table.t th,table.t td{padding:5px 6px}.panel{padding:12px}}`;

const mu = stated.MU, stx = stated.STX, W = C.WDC.business, S = C.SNDK.business, M = C.MU.business, X = C.STX.business;
const SPECS = `<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<h4>WHAT THIS PAGE SHOWS</h4>
<p>You asked on 7 Oct where the segment and margin data should live when you open a name on the dashboard — "in pie charts" — and how to blend a company with more data-centre revenue against one with a fatter margin. This is the answer, built on a branch: a new <b>CARDS</b> tab in the company view, beside COMPS, that shows the decision card for the name, with the business at the top.</p>
<p><b>Nothing here is live.</b> The Hub you use is unchanged. The pictures were taken from this branch running in a hidden test browser against the live data; you decide whether it goes on.</p>
<p>The card, top to bottom: the business (two pies, five figures, the blend, the same business side by side), then fundamentals (growth, the estimates with a flag line on top, the comps range), technicals, the levels (confluence zones, nearest first), risk, and your plan. It lays out facts and levels; it never says buy or sell.</p>

<h4>THE BLEND — THE ANSWER TO YOUR QUESTION</h4>
<p>Both figures are in the same unit: cents a year for every dollar of the stock.</p>
<ul>
<li><b>Data-centre profit per dollar of stock</b> = data-centre share × revenue × gross margin ÷ market value. It asks: for each dollar I pay for this stock, how many cents of gross profit come from the data centre?</li>
<li><b>Cash per dollar of stock</b> = free cash flow ÷ market value. This is the free-cash-flow yield, written in cents so the two sit side by side.</li>
</ul>
<p>Western Digital sells ${pctPlain(W.data_centre.share)} of its revenue to data centres at a ${pctPlain(W.margins.gross)} gross margin; SanDisk only ${pctPlain(S.data_centre.share)}, but at ${pctPlain(S.margins.gross)}. Put through the blend, a dollar of Western Digital buys ${cents(W.blend.dc_profit_per_dollar)} of data-centre profit and ${cents(W.blend.cash_per_dollar)} of cash; a dollar of SanDisk buys ${cents(S.blend.dc_profit_per_dollar)} of data-centre profit and ${cents(S.blend.cash_per_dollar)} of cash. So Western Digital is the purer data-centre holding per dollar, and SanDisk throws off nearly twice the cash per dollar. Micron comes out highest on data-centre profit per dollar (about ${cents(M.blend.dc_profit_per_dollar)}) and close to SanDisk on cash (${cents(M.blend.cash_per_dollar)}); Seagate is lowest on cash (${cents(X.blend.cash_per_dollar)}).</p>
<p><b>The one thing to keep in mind:</b> companies do not report a margin for each segment, so the company's own gross margin is applied to its data-centre revenue. If a company's data-centre lines earn more than its average, its figure here is too low; if they earn less, too high. The card says this when you rest the pointer on the figure.</p>

<h4>WHERE EACH NUMBER COMES FROM</h4>
<ul>
<li><b>The pies</b>: FMP's revenue split by business line and by region, the latest fiscal year, read on 7 Oct for the 26 names that have a card. Labels are put into plain words; FMP's own label shows when you rest the pointer on a slice. The cyan slice is data-centre revenue.</li>
<li><b>Gross margin, operating margin, free cash flow</b>: FMP's income and cash-flow statements for the last twelve months — the full-year statement when the year has just ended (all four names here), otherwise the last four quarters added.</li>
<li><b>Market value</b>: FMP's figure at the 6 Oct close, the same close the card is priced at.</li>
<li><b>Micron's and Seagate's data-centre share (the ≈ sign)</b>: FMP's split has no data-centre line for them — Micron is split into DRAM and NAND, Seagate is not split at all. So the share is the company's own statement on its earnings call, read from the calls the Hub already stores, and marked approximate. Micron, ${E(mu.call)}: <q>${E(mu.quote)}</q> (those are its mobile-and-PC unit and its cars-and-industrial unit) — so a little over 60%; the two quarters before, its two data-centre units added to ${mu.earlier.slice(0, 2).map((e) => e.share + "%").join(" and ")}. Seagate, ${E(stx.call)}: <q>${E(stx.quote)}</q></li>
<li><b>The levels</b>: the confluence zones computed on 6 Oct — two or more levels within 1% of each other, counting the reviewed lines (named exactly as the Lab labels them) and the 21, 50, 100 and 200-day averages. Nearest to the price first.</li>
<li><b>The estimates flag line</b>: from the estimates-against-guidance study of 6 Oct, for the six names it covered (Alphabet, Amazon, Western Digital, Seagate, Micron, Lam Research). Three checks: a one-off inside this year's earnings; next quarter's estimate against the company's own guidance; how many analysts stand behind next year.</li>
<li><b>Everything else on the card</b> (growth, the comps range, technicals, risk, your plan) is the decision card built on 6 Oct, unchanged.</li>
</ul>

<h4>WHAT COULD BE WRONG</h4>
<ul>
<li><b>Free cash flow has two answers at FMP for three of the four names, and the card differs from what you were quoted for two of them (Western Digital and Seagate).</b> The figures quoted to you were FMP's four quarters added. FMP's filed full-year statement for the same twelve months disagrees for Western Digital (${money(facts.companies.WDC.cash[0].freeCashFlow)} against ${money(facts.companies.WDC.cash_ttm.freeCashFlow)}), Micron and Seagate. The card uses the filed full-year statement, except where that row is incomplete: Micron's has no capital-spending line yet, so its four quarters are used (${money(M.cash.fcf)}, the figure you were given). For Seagate one quarter files capital spending with the wrong sign, which makes the four quarters too high (${money(facts.companies.STX.cash_ttm.freeCashFlow)}); the statement's ${money(X.cash.fcf)} is used. Where the two disagree by more than 5% the card shows a ≠ and both numbers. I could not check either against the companies' own filings. If you would rather have the four quarters throughout, as you were quoted, it is one rule to change.</li>
<li><b>The Hub's own financials table has Micron's newest year without its capital spending</b>, so it shows free cash flow of ${money(hub.MU.free_cf)} — the whole cash from operations. The card does not use that table, but the FINANCIALS tab does. Not fixed here.</li>
<li><b>Micron's pies are a year behind.</b> FMP has not yet split fiscal 2026 (the year to 3 Sep); the pies show fiscal 2025 and say so, while the margins and cash are fiscal 2026.</li>
<li><b>The ≈ shares are a quarter's statement applied to a year.</b> Micron's "a little over 60%" is for the quarter to ${E(mu.covers)}; its last quarter's call, as stored, is questions and answers only and gives no figure. Seagate's 80% is for the quarter to ${E(stx.covers)}; the Hub does not hold its July call.</li>
<li><b>"Data centre" is read from labels.</b> For seven names it is named by hand, each with its reason on the card (Western Digital's line is called "Cloud"; Amazon's and Alphabet's cloud businesses are counted; Equinix, Digital Realty and CoreWeave are counted whole). Coherent's line is "data centre and communications" together, so its share is on the high side — said on its card.</li>
<li><b>Some of FMP's splits do not add up to the year's revenue</b> (Western Digital's regions add to 92%; the banks' to about two-thirds, because a bank's segments are on a different revenue basis). The pie says how much it covers.</li>
<li><b>Banks and landlords show no margin or cash figures</b> — those are not how they are measured — so JPMorgan, Bank of America, Equinix, Digital Realty and Iron Mountain have pies but empty chips.</li>
<li><b>The card is one day's.</b> It is read from a dated file built from the 6 Oct close. Nothing refreshes it until the daily job exists.</li>
</ul>

<h4>WHAT WAS NOT DONE</h4>
<ul>
<li>Nothing was deployed and no table was written. The reader for the cards table is in place behind a switch that is off; the table itself is still only a proposal.</li>
<li>Only the 26 names that already had a decision card have one. Any other name shows "no decision card yet" and the list of names that do.</li>
<li>The estimates flag covers six names; the other twenty say "not yet checked".</li>
<li>The flag line shows on the card. The study that produced it drew it at the top of the ESTIMATES tab; that is built too, behind a switch that is <b>off</b>, so the ESTIMATES tab on this branch is exactly as it was. The picture above shows it switched on.</li>
<li>Fourteen of the 26 names have no reviewed lines, so they have no zones.</li>
<li>The plan fields cannot be typed into yet; they show what you said on 6 Oct for Micron and are empty elsewhere.</li>
<li>One side effect to know: adding a tab moves the number keys. CARDS takes 5; FINANCIALS, STATS, NEWS and SOCIAL each move up one; EARNINGS moves from 9 to 0 and READ from 0 to the minus key. On a wide screen READ now sits just past the right edge of the tab row, which scrolls.</li>
</ul>

<h4>HOW IT WAS CHECKED</h4>
<p>Pictures at 1680 wide and at phone width (390), taken in a hidden browser from this branch under the Hub's own address, with the live database and chart service; every attempt to write was blocked and counted (none was made). The full test suite: the same seven failures as the commit this branch starts from — the five known ones and two that depend on today's date — and 29 new checks, all passing. The FMP figures were read on three short-lived machines on Fly, each created, used and removed inside this run; no key was printed or stored.</p>

<h4>THREE CALLS FOR YOU</h4>
<ol>
<li><b>Put the CARDS tab on the Hub?</b> Recommendation: yes, as it is, beside COMPS — it is read-only and changes nothing else.</li>
<li><b>Keep the ≈ figures for Micron and Seagate (the companies' own words), or leave them blank until FMP splits them?</b> Recommendation: keep them, marked as they are — a blank would hide the name you care about most.</li>
<li><b>Show the estimates flag line at the top of the ESTIMATES tab as well?</b> Recommendation: yes, switch it on with the tab — that is the screen where Alphabet's "(26%)" is read, and the line says on the spot that it is +30% on the clean base.</li>
</ol>
</details>`;

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>The decision card in the company view · the business in pies</title>
<style>${CSS}</style></head><body>
<header class="top"><span data-scnav-slot></span><div class="ttl">THE DECISION CARD IN THE COMPANY VIEW · THE BUSINESS IN PIES</div><div class="sub">7 OCT 2026 · A BRANCH · NOTHING IS LIVE · 26 NAMES · PRICES AT THE 6 OCT CLOSE</div></header>

<h2>BEFORE → AFTER · THE COMPANY VIEW AT 1680</h2>
<div class="pair">${pic("before-WDC-1680.png", "BEFORE · TEN TABS · COMPS OPEN")}${pic("after-WDC-1680.png", "AFTER · THE CARDS TAB, BESIDE COMPS · WESTERN DIGITAL")}</div>

<h2>THE BLEND · WESTERN DIGITAL, SANDISK, MICRON AND SEAGATE SIDE BY SIDE</h2>
<div class="panel"><div class="ph">FISCAL YEARS TO JUL / SEP 2026 · MARKET VALUE AT THE 6 OCT CLOSE · ≈ THE COMPANY'S OWN WORDS, NOT FMP'S SPLIT</div>${fourTable}</div>
<div class="pair"><div class="panel"><div class="ph">DATA-CENTRE PROFIT PER $1 OF STOCK · MOST FIRST</div><div class="rank">${rank((b) => b.blend.dc_profit_per_dollar, dcc)}</div></div>
<div class="panel"><div class="ph">CASH PER $1 OF STOCK · MOST FIRST</div><div class="rank">${rank((b) => b.blend.cash_per_dollar, (b) => cents(b.blend.cash_per_dollar))}</div></div></div>
<div class="panel"><div class="ph">HOW THE DATA-CENTRE FIGURE IS MADE</div>${makeTable}</div>
<div class="panel"><div class="ph">HOW THE CASH FIGURE IS MADE</div>${cashTable}</div>

<h2>THE SAME FOUR ON THEIR CARDS</h2>
<div class="pair">${pic("after-MU-1680.png", "MICRON · ≈ FROM ITS OWN CALL · PIES A YEAR BEHIND, SAID")}${pic("after-STX-1680.png", "SEAGATE · NO SPLIT BY BUSINESS LINE IN FMP, SAID")}</div>

<h2>THE WHOLE CARD, TOP TO BOTTOM</h2>
<div class="tall">${pic("after-WDC-full-1680.png", "WESTERN DIGITAL")}${pic("after-MU-full-1680.png", "MICRON · WITH YOUR PLAN OF 6 OCT")}${pic("after-SNDK-full-1680.png", "SANDISK")}${pic("after-STX-full-1680.png", "SEAGATE")}</div>

<h2>PART BY PART</h2>
<div class="pair">${pic("after-MU-levels-1680.png", "LEVELS · MICRON'S ZONES, NEAREST FIRST, BY THE LAB'S LABELS")}${pic("after-GOOGL-fundamentals-1680.png", "THE ESTIMATES FLAG LINE · ALPHABET · ONE-OFF IN THIS YEAR")}</div>
<div class="trio">${pic("afterdefault-WDC-1680.png", "BEFORE YOU PRESS EXPAND · THE CARD IN THE SMALL PANEL")}${pic("after-JPM-1680.png", "A BANK · PIES, NO MARGIN OR CASH FIGURES")}${pic("after-TSLA-1680.png", "A NAME WITH NO CARD YET")}</div>

<h2>AN OPTION, BUILT AND SWITCHED OFF · THE SAME FLAG LINE ON THE ESTIMATES TAB</h2>
<div class="pair">${pic("option-GOOGL-estimates-flag-1680.png", "THE ESTIMATES TAB WITH THE LINE ON · ALPHABET · OFF ON THE BRANCH")}<div class="panel"><div class="ph">AS THE BRANCH STANDS</div><table class="t"><tbody><tr><td class="lab">ON THE CARD</td><td><b>ON</b></td></tr><tr><td class="lab">ON THE ESTIMATES TAB</td><td><b>OFF</b> · ONE SWITCH</td></tr><tr><td class="lab">NAMES IT WOULD SHOW FOR</td><td>6 · GOOGL AMZN WDC STX MU LRCX</td></tr><tr><td class="lab">EVERY OTHER NAME</td><td>NOTHING ADDED</td></tr></tbody></table></div></div>

<h2>BEFORE → AFTER · PHONE, 390 WIDE</h2>
<div class="phones">${pic("before-WDC-390.png", "BEFORE")}${pic("after-WDC-390.png", "AFTER · AS IT OPENS")}${pic("after-WDC-full-390.png", "AFTER · THE WHOLE CARD")}${pic("after-MU-full-390.png", "MICRON · THE WHOLE CARD")}</div>

<h2>CHECKED ON THE WAY</h2>
<div class="panel"><div class="ph">FREE CASH FLOW · FOUR READINGS OF THE SAME TWELVE MONTHS</div>${readTable}</div>
<div class="panel"><div class="ph">DATA-CENTRE SHARE · WHERE EACH ONE COMES FROM · ${dcRows.length} OF 26 NAMES HAVE ONE</div>${dcTable}</div>
<div class="panel"><div class="ph">ALL 26 CARDS · THE BUSINESS ROW</div>${allTable}</div>

${SPECS}
${SCNAV}
</body></html>
`;
fs.writeFileSync(path.join(ROOT, "CARDS-TAB.html"), html);
console.log("CARDS-TAB.html", html.length, "chars ·", (html.match(/<figure/g) || []).length, "pictures");
