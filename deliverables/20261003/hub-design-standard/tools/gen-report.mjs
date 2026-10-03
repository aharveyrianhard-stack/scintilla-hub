/* V1 — writes HUB-DESIGN-STANDARD.html from the walks' measurements: the before/after pairs first, then the sheet in plain words. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.join(HERE, "..");
const sheet = JSON.parse(fs.readFileSync(path.join(D, "hub-design-standard.json"), "utf8"));
const load = (f) => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const count = (d) => {
  const roles = {}, panels = new Set(), dividers = new Set(), buttons = new Set();
  for (const r of d.results) {
    for (const t of r.text) (roles[t.role] ||= new Set()).add(`${t.fs}/${t.fw}/${t.ls}`);
    for (const p of r.panels) panels.add(`${p.bg}·${p.border}·${p.radius}·${p.shadow}`);
    for (const p of r.dividers) dividers.add(p.line);
    for (const b of r.buttons) buttons.add(`${b.fs}/${b.fw}/${b.ls}·${b.border}·${b.radius}·${b.bg}`);
  }
  const out = {}; for (const [k, v] of Object.entries(roles)) out[k] = v.size;
  return { ...out, "panel surface": panels.size, divider: dividers.size, button: buttons.size };
};
const B = load("measure-before-1680.json"), A = load("measure-after-1680.json"), B2 = load("measure-before-1920.json"), A2 = load("measure-after-1920.json");
const cb = count(B), ca = count(A), cb2 = count(B2), ca2 = count(A2);
const ROLES = ["page title", "section header", "tab", "table header", "body", "number", "footnote", "panel surface", "divider", "button"];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const NAMES = { dashboard: "DASHBOARD — the board and the map", "company-geiger": "Company view · GEIGER", "company-fundamentals": "Company view · FUNDAMENTALS", "company-estimates": "Company view · ESTIMATES", "company-comps": "Company view · COMPS",
  "company-financials": "Company view · FINANCIALS", "company-stats": "Company view · STATS", "company-news": "Company view · NEWS", "company-social": "Company view · SOCIAL", "company-events": "Company view · EARNINGS", "company-read": "Company view · READ",
  "company-expand": "Company view · EXPAND", news: "NEWS", social: "SOCIAL", sentiment: "SENTIMENT", "sentiment-prediction": "SENTIMENT · PREDICTION MARKETS", alerts: "ALERTS", screener: "SCREENER", events: "EARNINGS", usual: "USUAL DAY", economic: "ECONOMIC", allocation: "ALLOCATION (its own page)", tree: "TREE (its own page)" };
const splitB = B.results.find((r) => r.surface === "company-geiger").split, splitA = A.results.find((r) => r.surface === "company-geiger").split;
const pairs = A.results.map((r) => r.surface).filter((s) => fs.existsSync(path.join(D, "shots", "before", `${s}-1680.png`))).map((s) =>
  `<figure><figcaption>${esc(NAMES[s] || s)}</figcaption><div class="pair"><a href="shots/before/${s}-1680.png"><img loading="lazy" src="shots/before/${s}-1680.png" alt="${esc(s)} before"><span>BEFORE · live 9d2b1ca</span></a><a href="shots/after/${s}-1680.png"><img loading="lazy" src="shots/after/${s}-1680.png" alt="${esc(s)} after"><span>AFTER · this branch</span></a></div></figure>`).join("\n");
const row = (k) => `<tr><td>${esc(k)}</td><td>${cb[k] ?? "—"}</td><td>${ca[k] ?? "—"}</td><td>${cb2[k] ?? "—"}</td><td>${ca2[k] ?? "—"}</td></tr>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Hub's visual standard — V1, 3 Oct 2026</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#0A0A0F;--surface:#0F0F1A;--line:#1A1A2A;--ink:#F2F2F8;--ink2:#C6C8DE;--ink3:#9A9AB6;--dim:#868AAA;--cy:#00D4FF}
body{margin:0;background:var(--bg);color:var(--ink2);font:13px/1.55 "SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;padding:28px 24px 60px}
h1{font-size:15px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink);margin:0 0 6px}
h2{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink3);margin:34px 0 10px;font-weight:700}
p{max-width:92ch}
.lead{color:var(--ink3)}
figure{margin:0 0 22px}
figcaption{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);margin:0 0 6px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pair a{display:block;background:var(--surface);border:.8px solid rgba(0,212,255,.34);box-shadow:inset 0 0 22px rgba(0,212,255,.05);padding:6px;text-decoration:none;color:var(--ink3)}
.pair img{width:100%;height:auto;display:block}
.pair span{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;padding:6px 2px 0}
table{border-collapse:collapse;margin:8px 0 14px}
td,th{border-bottom:.8px solid var(--line);padding:5px 14px 5px 0;text-align:left;font-size:12px;vertical-align:top}
th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);font-weight:400}
td:nth-child(n+2){font-variant-numeric:tabular-nums}
code{color:var(--ink);font-size:12px}
.box{background:var(--surface);border:.8px solid rgba(0,212,255,.34);box-shadow:inset 0 0 22px rgba(0,212,255,.05);padding:12px 14px;margin:8px 0 18px;max-width:100ch}
.tok{font-size:11px;white-space:pre-wrap;color:var(--ink3)}
ul{padding-left:18px}li{margin:3px 0}
@media (max-width:800px){.pair{grid-template-columns:1fr}body{padding:16px}}
</style></head><body>
<h1>The Hub's visual standard</h1>
<p class="lead">V1 · 3 October 2026 · a consistency pass, not a redesign. Alan: "things are pretty great on the Hub, actually." The look stays — monochrome black, the cyan accent, the letter-spaced uppercase labels — and it is now the same everywhere. Every picture here is the real page in a headless browser at 1680 × 1050: left is the live Hub (9d2b1ca), right is this branch.</p>

<h2>The four things Alan named</h2>
<div class="box"><ul>
<li><b>Master tabs.</b> ALLOCATION, STATION and TREE were links, so they sat left in their cell and were underlined. They now sit centred with no underline, exactly like DASHBOARD and NEWS. They still open their pages.</li>
<li><b>The chart toolbar.</b> ◂ BOARD · COHORT ▾ · 1h 4h 1D 3D 1W · CLOUDS · EXPAND were boxed buttons. They are now plain uppercase words in the company tabs' style, the active one marked the same way (cyan with an underline), same height and font. Every function is unchanged.</li>
<li><b>Half and half.</b> The chart and the tab area under it now split the company panel 50/50 (${splitA.chart} / ${splitA.side} px of ${splitA.cv} at 1680 × 1050; before it was ${splitB.chart} / ${splitB.side} of ${splitB.cv}). EXPAND keeps doing what it does.</li>
<li><b>Page specs.</b> Explanatory sentences ("57 tickers · usual day…", "RVOL: battery = …", the source cards, the legends, the SENTIMENT room's paragraphs) left the content and sit in one closed <code>PAGE SPECS</code> line at the bottom of their tab or page, in the footer font. Numbers, units and labels stayed. The comps and analysts tabs are written by their own lanes and use the same component.</li>
</ul></div>

<h2>Before and after — every surface, 1680 × 1050</h2>
${pairs}

<h2>How many different styles each role had — before → after</h2>
<p class="lead">Counted from the browser's computed styles over all ${A.results.length} surfaces: a "style" is one distinct size + weight + letter-spacing (for text), or one distinct background + border + corner + glow (for panels). Lower is more consistent.</p>
<table><thead><tr><th>role</th><th>before · 1680</th><th>after · 1680</th><th>before · 1920</th><th>after · 1920</th></tr></thead><tbody>
${ROLES.map(row).join("\n")}
</tbody></table>
<p class="lead">Why body and number are still high: the ESTIMATES and COMPS tabs are owned by two other lanes running today (their content was not touched), the ALLOCATION and TREE pages carry their own sheets, and many one-off readouts (pills, chips, sparkline labels) keep their own sizes. The tab count of 2 is the board's cohort strip (below).</p>

<h2>The sheet, in plain words</h2>
<div class="box">
<p><b>Type.</b> One font (the Hub's mono). Six sizes and no more: 9 for the micro marks, <b>10 for every tab, section header, table header and footnote</b>, <b>11 for body text and numbers</b>, 13 for lead numbers, 15 for the name and the price, 20 for the ticker and the wordmark.</p>
<p><b>Headers</b> are 10px, bold, spaced .18em, uppercase, in the third grey. <b>Tabs</b> are 10px, regular, spaced .18em, uppercase, dim; brighter on hover; the open one is cyan with a 2px underline — on the master tabs, the company tabs and the chart toolbar alike. <b>Table headers</b> are 10px, spaced .12em, uppercase. <b>Footnotes and page specs</b> are 10px, spaced .04em, third grey.</p>
<p><b>Surfaces.</b> The page is plain black. Every boxed panel takes the treatment Alan liked on the EARNINGS / ECONOMIC tape box: its slightly blue hue, the cyan hairline, the faint inner glow, square corners. One divider line inside panels. Boxed buttons that are not tabs get the same hairline, no fill.</p>
<p class="tok">${esc(sheet.css_tokens)}</p>
<p class="lead">The sheet lives in <code>hub-design-standard.json</code> beside this page and on the Hub as <code>&lt;style id="sc-design-standard-20261003"&gt;</code>, last in the cascade.</p>
</div>

<h2>What could not be made consistent (and why)</h2>
<div class="box"><ul>
<li><b>The board's cohort strip.</b> Sixteen cohort tabs sit in a 725px host at 1680. At the sheet's tab size they run 260px past it (measured), and 7px is the only size that fits at 1440 too. It keeps its small size for now. <i>Recommendation:</i> a second row for the strip, or a COHORT ▾ chooser like the company view's.</li>
<li><b>The board's column headers.</b> MKT CAP and REVENUE live in 42 and 47px tracks; at 10px they clip, so the board header stays at 9px. <i>Recommendation:</i> widen those two tracks when the board is next touched.</li>
<li><b>The ESTIMATES and COMPS tabs, ALLOCATION and TREE.</b> Other lanes own the first two today; the last two are their own pages with their own sheets. They were measured, not changed.</li>
</ul></div>

<h2>What was checked</h2>
<div class="box"><ul>
<li>Headless only; nothing deployed; every write request from the test browser was answered locally (${A.writes.length} blocked on the after walk, ${B.writes.length} before).</li>
<li>Hub tests: ${esc("1853 pass, 6 fail")} — the 5 known failures on live plus the REGIME flake, which passes alone. The new test <code>tests/v1-design-standard-20261003.test.mjs</code> checks the master tabs and the chart toolbar carry the sheet's tab class and the company panel splits 50/50.</li>
<li>Measurements: <code>measure-before-1680.json</code>, <code>measure-after-1680.json</code>, and the same at 1920; the walker is <code>tools/walk.mjs</code>, the counter <code>tools/count.mjs</code>.</li>
</ul></div>
</body></html>`;
fs.writeFileSync(path.join(D, "HUB-DESIGN-STANDARD.html"), html);
console.log("report written", pairs.split("<figure>").length - 1, "pairs", JSON.stringify({ cb, ca }));
