/* C5 · builds COMPS-C5.html from the dated fixtures (so every number on the page is the one the tests pin). node report.mjs */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { conclusion, ROWS } from "./field.mjs";
import { SHORT } from "../../20261001/comps-template/cohort.mjs";
import { lineWords, SIM_MIN, LINE_MIN, SIZE_WEIGHT } from "./lines.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const NINE = ["AMZN", "NVDA", "MU", "TSM", "META", "JPM", "XOM", "COST", "LLY"], SHOT = ["AMZN", "NVDA", "MU", "JPM"];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const P0 = (v) => v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US"), X = (v) => v == null ? "—" : v.toFixed(v >= 100 ? 0 : 1) + "×", UP = (v) => v == null ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toFixed(0) + "%" + (v < 0 ? ")" : "");
const before = JSON.parse(readFileSync(path.join(HERE, "sets-before-c4-2026-10-03.json"), "utf8")).sets;
const F = Object.fromEntries(NINE.map((t) => [t, JSON.parse(readFileSync(path.join(HERE, `set-${t}-2026-10-03.json`), "utf8"))]));
const C = Object.fromEntries(NINE.map((t) => [t, conclusion(F[t].snapshot, [], F[t].estimates, F[t].today, "C")]));
const beforeWay = { AMZN: 417, NVDA: 272, MU: 3514, JPM: 302 };   // way B centres read off the C4 tab in the before shots
const setRows = NINE.map((t) => { const s = F[t].set, b = before[t]; const c = C[t], w = c.ways.find((x) => x.way === "C");
  return `<tr><td class="k">${t}</td><td>${esc(lineWords(s.own_lines))} <small>· ${esc(s.lines_source)}</small></td><td>${b.kept.map((r) => r.ticker).join(" ")}</td><td class="k">${s.kept.map((r) => r.ticker + (r.seat ? "*" : "")).join(" ")}</td><td>${s.counts.members} of ${s.counts.served}</td><td>${w && w.ok ? `${P0(w.lo)} – ${P0(w.hi)}, centre ${P0(w.mid)}` : "—"}</td><td>${P0(c.price)}</td><td class="${w && w.ok && w.upside.mid.pct >= 0 ? "up" : "dn"}">${w && w.ok ? UP(w.upside.mid.pct) : "—"}</td></tr>`; }).join("");
const reasons = NINE.map((t) => { const s = F[t].set; return `<p><b>${t}</b> — ${s.kept.map((r) => `<b>${r.ticker}</b> ${esc(r.why)}${r.seat ? " (seat: " + esc(r.seat) + ")" : ""}, size ${r.ratio >= 1 ? "×" + r.ratio.toFixed(1) : "÷" + (1 / r.ratio).toFixed(1)}${r.sources.length ? ", named by " + r.sources.map((x) => x === "MASSIVE" ? "Massive" : "FMP").join(" and ") : ""} [${esc(r.line_source)}]`).join("; ")}. Named but not in: ${s.named_not_in.filter((d) => !/not served|same company/.test(d.why)).map((d) => `${d.ticker} (${esc(d.why)})`).join(", ") || "none"}${s.named_not_in.filter((d) => /not served/.test(d.why)).length ? `; ${s.named_not_in.filter((d) => /not served/.test(d.why)).length} not served on the Hub` : ""}.</p>`; }).join("");
const outliers = NINE.map((t) => { const o = C[t].outliers; return `<tr><td class="k">${t}</td><td>${o.length ? o.map((x) => `${x.ticker} ${X(x.multiple)} on ${SHORT[x.key]} (${Math.abs(x.z).toFixed(1)} MAD ${x.side === "high" ? "above" : "below"})`).join(" · ") : "none"}</td></tr>`; }).join("");
const weights = NINE.map((t) => { const m = C[t].measureWeights; return `<tr><td class="k">${t}</td><td>${esc(m.cls)}</td>${ROWS.map((k) => `<td>${Math.round(m.weights[k] * 100)}%</td>`).join("")}<td>${C[t].peerWeights.rows.length} rows</td></tr>`; }).join("");
const peg = NINE.map((t) => { const r = C[t].rows.find((x) => x.key === "peg"); return `<tr><td class="k">${t}</td><td>${r.own.multiple != null ? r.own.multiple.toFixed(2) + "×" : "—"}</td><td>${r.figure.growth != null ? r.figure.growth.toFixed(1) + "%" : "—"}</td><td>${esc(r.figure.growth_basis || "—")}</td><td>${r.n}</td></tr>`; }).join("");
const shots = SHOT.map((t) => `<h2>${t} <small>before (C4, 3 Oct 10:10 ET) · after (C5) · 1680 × 1050, headless</small></h2>
<div class="panel two"><div class="shot"><div class="clip"><img src="shots/before/${t}-1680.png" alt="${t} before"></div><small>Before: ${before[t].kept.map((r) => r.ticker).join(" ")} · way B centre $${beforeWay[t].toLocaleString("en-US")}</small></div><div class="shot"><div class="clip"><img src="shots/after/${t}-1680.png" alt="${t} after"></div><small>After: ${F[t].set.kept.map((r) => r.ticker).join(" ")}</small></div></div>
<div class="panel two"><div class="shot"><div class="clip"><img src="shots/after/${t}-range-1680.png" alt="${t} the range"></div><small>The range, way C: one band, the centre, the midpoint, today's price, WEIGH A / B / C.</small></div><div class="shot"><div class="clip"><img src="shots/after/${t}-field-1680.png" alt="${t} the field"></div><small>The field: cyan bars, the outliers hollow at the edge with their value.</small></div></div>`).join("");
const A = C.AMZN, Aw = A.ways.find((w) => w.way === "C");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · COMPS · C5 · BUSINESS FIRST · 3 OCT</title>
<style>
:root{color-scheme:dark;--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--line2:#363636;--ink:#cfcfcf;--ink2:#acacac;--dim:#8c8c8c;--mute:#6c6c6c;--up:#4fae6a;--dn:#d0554a;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--mono);font-size:13px;line-height:1.55;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px 80px;overflow-x:hidden}
.top{padding:16px 0 12px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.brand{font:400 12px/1.4 var(--mono);letter-spacing:.2em;color:var(--dim)}.brand b{color:var(--ink);font-weight:600}
.stamp{margin-left:auto;font:400 11px/1.5 var(--mono);color:var(--dim);letter-spacing:.06em;text-align:right}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.22em;color:var(--ink);margin:30px 0 8px;text-transform:uppercase}
h2 small{font-weight:400;letter-spacing:.06em;color:var(--dim);text-transform:none;margin-left:10px;font-size:12px}
.panel{border:1px solid var(--line);background:var(--panel);margin-bottom:8px}
.words{padding:12px 16px 14px;font-size:12.5px;line-height:1.65}.words b{color:var(--ink);font-weight:600}.words p{margin:6px 0}
.words ul,.words ol{margin:4px 0 8px;padding-left:20px}.words li{margin:5px 0}
.up{color:var(--up)}.dn{color:var(--dn)}.words code{font-size:12px;color:var(--ink)}
table.t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
table.t th,table.t td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap;vertical-align:top}
table.t th{font:400 10px/1.4 var(--mono);letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
table.t td{color:var(--ink2)}table.t td.k{color:var(--ink)}table.t td small{color:var(--mute)}
.tw{overflow-x:auto;padding:0 16px 10px}
.shot{padding:12px 16px 14px}.shot img{display:block;width:100%;height:auto}
.shot .clip{max-height:900px;overflow:hidden;border:1px solid var(--line2)}
.shot small{display:block;margin-top:6px;font-size:11px;color:var(--dim)}
.two{display:grid;grid-template-columns:1fr 1fr}.two > div + div{border-left:1px solid var(--line)}
@media(max-width:760px){.wrap{padding:0 12px 60px}.two{grid-template-columns:1fr}.two > div + div{border-left:0;border-top:1px solid var(--line)}.stamp{margin-left:0;text-align:left}}
</style></head>
<body><div class="wrap">
<div class="top"><span class="brand"><b>SCINTILLA</b> · COMPS · C5 · BUSINESS FIRST, SIZE SECOND · OUTLIERS CAUGHT · THE PRICE FROM THE WHOLE FIELD</span><span data-scnav-slot></span><span class="stamp">C5 · 3 Oct 2026 · branch hub/c5-comps-method-20261003 · not deployed</span></div>

<h2>In one paragraph</h2>
<div class="panel"><div class="words">
<p><b>Amazon no longer sits with the mega caps.</b> Before, the set was built by industry label and a size band, so AMZN's ten were ${before.AMZN.kept.map((r) => r.ticker).join(", ")} — SpaceX, Micron and Tesla in, Alibaba and JD out. Now the set is built from <b>what each company actually sells</b>: FMP's revenue-by-segment, read on Fly for the 455 served companies, gives Amazon e-commerce ${Math.round(F.AMZN.set.own_lines.lines["e-commerce"] * 100)}%, cloud ${Math.round(F.AMZN.set.own_lines.lines.cloud * 100)}%, advertising ${Math.round(F.AMZN.set.own_lines.lines.advertising * 100)}%; a peer is in when at least ${Math.round(SIM_MIN * 100)} cents of every revenue dollar sit in a business it shares with the company, size is only a small tie-breaker (never a gate), and every business the company has at ${Math.round(LINE_MIN * 100)}% or more seats its two best peers. AMZN's twelve are now ${F.AMZN.set.kept.map((r) => r.ticker).join(", ")}. The system catches outliers by itself (a peer more than 3 MAD from the pack on a log scale, per measure — ARM at 317× P/E, Gilead at 273× EV/EBITDA, PDD at 1.2× P/E), keeps them out of the centre and off the scale, and lets Alan keep one with a click. The price is no longer "the middle of six medians": every peer's implied price on every measure is a point, weighted by a stated measure weight and a stated peer weight; the centre is the weighted median of all of them, and the midpoint is printed beside it so the two are never confused. PEG is computed from forward consensus growth (AMZN: ${C.AMZN.rows.find((r) => r.key === "peg").figure.growth.toFixed(1)}% a year to FY2029, PEG ${C.AMZN.rows.find((r) => r.key === "peg").own.multiple.toFixed(2)}×). Every explanatory sentence moved into PAGE SPECS at the bottom of the tab.</p>
</div></div>

${shots}

<h2>The nine test names <small>before → after · the fixtures of 3 Oct, ~10:30 ET</small></h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Company</th><th>Its businesses</th><th>Before (C4 rule)</th><th>After (C5 rule) · * = a seat</th><th>Members</th><th>Way C · low – high, centre</th><th>Price</th><th>To the centre</th></tr></thead><tbody>${setRows}</tbody></table></div></div>

<h2>Every peer with its reason</h2>
<div class="panel"><div class="words">${reasons}</div></div>

<h2>Outliers caught <small>median ± 3·MAD on the log of the multiples, at least five peers on the measure</small></h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Company</th><th>Candidates for elimination (out of the centre and off the scale by default; one click keeps one)</th></tr></thead><tbody>${outliers}</tbody></table></div></div>

<h2>The weights <small>sector prior × coverage × fit, measured in each set; peers matched on the fundamental rows</small></h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Company</th><th>Prior</th>${ROWS.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Peer match on</th></tr></thead><tbody>${weights}</tbody></table></div>
<div class="words"><p>The prior is C3's practitioner table (Damodaran's relative-valuation notes; Koller et al.; Liu–Nissim–Thomas: forward earnings first, then trailing earnings, then cash-flow, then sales; EV multiples mean little for a bank). Coverage is the share of the peers carrying the multiple. Fit is 1 ÷ (1 + the median pricing error of the measure inside the set). Nothing better is measured yet; when a history of which measure explained this industry's prices exists, it replaces the prior. The ten fundamental rows enter as peer weights: a peer whose growth, margins, balance sheet and capex sit near the company's in percentile rank counts more (weight = exp(−½ (gap ÷ 0.5)²), equal weight per row).</p></div></div>

<h2>PEG from forward growth</h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Company</th><th>PEG</th><th>Growth, % a year</th><th>From → to</th><th>Peers with a PEG</th></tr></thead><tbody>${peg}</tbody></table></div>
<div class="words"><p>Growth is the compound annual rate from trailing EPS to the FMP consensus three fiscal years out, the same analyst_estimates rows the ESTIMATES tab draws; consensus to consensus for a foreign filer whose statements are not in dollars (TSM). AMZN's FY2027 consensus (10.63) sits below FY2026 (12.77), which is why the old year-over-year rule said "EPS is not expected to grow" — the three-year path grows ${C.AMZN.rows.find((r) => r.key === "peg").figure.growth.toFixed(1)}% a year. COST shows "—": its three-year consensus is flat.</p></div></div>

<h2>The range: what 417 was, and what the centre is now</h2>
<div class="panel"><div class="words">
<p>On the old tab AMZN read "centre $417, low $319, high $823": 417 was the median of the six measure medians, and nothing said so. Now the label says what the centre is — <b>CENTRE · WEIGHTED MEDIAN</b> on way C, <b>CENTRE · MEDIAN OF THE MEDIANS</b> on A and B — and the midpoint of low and high is printed beside it. On the 3 Oct fixture AMZN way C reads ${P0(Aw.lo)} – ${P0(Aw.hi)}, centre ${P0(Aw.mid)}, midpoint ${P0(Aw.midpoint)}, ${UP(Aw.upside.mid.pct)} to the centre from ${P0(A.price)}. The band is one bold cyan gradient with the centre line, today's price as a white marker, low and high at the ends; WEIGH A / B / C sits beside it with the minimized field (the same sixteen rows, small). On the Hub's company pane at 1680 wide the pane is 454 px, so the minimized field wraps under the band; on a wider pane it sits beside it.</p>
</div></div>

<h2>Where each number comes from</h2>
<div class="panel"><div class="words"><ul>
<li><b>Revenue segments:</b> FMP <code>/stable/revenue-product-segmentation</code> and <code>revenue-geographic-segmentation</code>, latest fiscal year, pulled on Fly on 3 Oct for the 455 served companies (416 carry product lines) into <code>segments-2026-10-03.json</code>. The job <code>scripts/revenue-segments-sync.mjs</code> prints the same rows; migration <code>20261003_revenue_segments.sql</code> (with its rollback) adds <code>public.revenue_segments</code>; the tab reads the table when it is loaded and the file until then.</li>
<li><b>Industries, market values, FMP peers, Massive related:</b> C4's reads (company_profile, ticker_industry, fmp_peers, peer_sources).</li>
<li><b>Figures:</b> C3's reader — fundamentals, analyst_estimates, fundamentals_history, cashflow_history, balance_history; prices from the chart API; foreign filers converted from filer_currency and fx_rates.</li>
<li><b>Edits:</b> public.comps_decisions, one dated row per switch, latest wins, shared by every screen; kept outliers are rows with off = false and a reason beginning "keep".</li>
</ul></div></div>

<h2>What could be wrong · what was not done</h2>
<div class="panel"><div class="words"><ul>
<li>The keyword dictionary that moves segment revenue between lines is short and stated; a segment it does not know stays on the industry line. Segment names are FMP's and vary by filer (JD's segments carry no business rows, so JD is e-commerce by hand rule).</li>
<li>Hand rules cover 30 names whose FMP industry misleads (AMZN, BABA, JD, PDD, MELI as e-commerce; META as advertising; TSM and GFS as foundry; SNDK as memory; V, MA, PYPL as payments…). They are listed in <code>lines.mjs</code> and say "hand" on the row.</li>
<li>COST prices on P/E only: its fundamentals_history rows carry no revenue, net debt or share count on the Hub — a data gap, not a method gap.</li>
<li>Non-US names (BABA, JD, PDD, MELI) show multiples that the outlier rule often flags (PDD at 1.2× P/E): a sign their converted EPS or price needs a look.</li>
<li>Phone-width shots (390) were not taken this round; the tab keeps C4's narrow layout and the pane at 1680 already runs in that mode.</li>
<li>The <code>sc-pagespecs</code> component is emitted as markup; V1's global style is not on this branch yet, so the tab carries a fallback style scoped to itself.</li>
</ul></div></div>
</div></body></html>`;
writeFileSync(path.join(HERE, "COMPS-C5.html"), html);
console.log("COMPS-C5.html written", html.length);
