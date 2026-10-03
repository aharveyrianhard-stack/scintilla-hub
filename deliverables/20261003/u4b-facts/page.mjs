/* U4b (3 Oct 2026) · the page. Reads audit.json, facts.json and data/ (written by build.mjs, comps-counts.mjs, skhy-dryrun.mjs)
   and writes U4B-FACTS.html: the audit's red cells first, then SK Hynix, then the facts table (sortable). Plain words;
   every explanation sits in PAGE SPECS at the bottom.
   Usage: node deliverables/20261003/u4b-facts/page.mjs   (from the Hub root, after build.mjs and skhy-dryrun.mjs) */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DIR = dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(readFileSync(join(DIR, p), "utf8"));
const A = J("audit.json"), F = J("facts.json"), SK = J("data/skhy-probe-20261003.json"), SD = J("data/skhy-dryrun-20261003.json"), UNI = J("data/universe-20261003.json");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MONO = `font-family="SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace" font-size="11"`;
const CHECKS = [["bars", "BARS · 24 widths"], ["geiger", "GEIGER · 7 rungs"], ["prev_close", "SETTLED CLOSE"], ["profile", "PROFILE ROW"], ["facts", "STATEMENTS · ESTIMATES"], ["comps", "COMPS"], ["news", "NEWS"], ["cohort", "COHORT"], ["history", "HISTORY IS ITS OWN"]];
const COL = { GREEN: "#2f6b3a", AMBER: "#8a6d1f", RED: "#a23a3d" };
const rows = A.rows, C = A.counts;
const nRed = (r) => Object.values(r.checks).filter((x) => x.v === "RED").length;

/* ── picture 1: every admitted name × every check ── */
function grid() {
  const order = rows.slice().sort((a, b) => (a.batch || "").localeCompare(b.batch || "") || a.ticker.localeCompare(b.ticker));
  const cols = 4, per = Math.ceil(order.length / cols), cw = 13, ch = 11, labW = 62, blockW = labW + CHECKS.length * cw + 34, top = 70;
  const W = cols * blockW + 20, H = top + per * ch + 20;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${MONO}><rect width="${W}" height="${H}" fill="#141414"/>`;
  s += `<text x="10" y="16" fill="#cfcfcf" font-weight="600" letter-spacing="1" font-size="10">THE ${rows.length} NAMES ADMITTED SINCE 24 SEP × THE ${CHECKS.length} CHECKS — red · amber · green</text>`;
  for (let c = 0; c < cols; c++) CHECKS.forEach(([k], i) => { const x = 10 + c * blockW + labW + i * cw + 5; s += `<text transform="translate(${x},${top - 6}) rotate(-60)" fill="#8c8c8c" font-size="8.5">${esc(k.replace("prev_close", "close"))}</text>`; });
  order.forEach((r, i) => {
    const c = Math.floor(i / per), y = top + (i % per) * ch, x0 = 10 + c * blockW;
    s += `<text x="${x0 + labW - 4}" y="${y + 9}" fill="${r.claude_check ? "#e6e6e6" : "#9a9a9a"}" text-anchor="end" font-size="9"${r.claude_check ? ' font-weight="700"' : ""}>${esc(r.ticker)}</text>`;
    CHECKS.forEach(([k], j) => { const v = r.checks[k].v; s += `<rect x="${x0 + labW + j * cw}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" fill="${COL[v]}"><title>${esc(r.ticker + " · " + k + ": " + r.checks[k].why)}</title></rect>`; });
    if (i % per === 0 || r.batch !== order[i - 1].batch) s += `<text x="${x0 + labW + CHECKS.length * cw + 4}" y="${y + 9}" fill="#6a6a6a" font-size="8">${esc((r.batch || "").slice(5))}</text>`;
  });
  return s + `<text x="10" y="${H - 6}" fill="#8c8c8c" font-size="9.5">bold names = from Alan's X bookmark folder CLAUDE CHECK · grouped by the day they were admitted (24 Sep pull · 27 Sep Geiger-only · 28 Sep v3) · hover a cell for its words</text></svg>`;
}

/* ── picture 2: SKHY's premium over the Korean line, per session ── */
function premiumChart() {
  const p = SK.premium.rows.filter(([, a, k, f]) => a && k && f).map(([d, a, k, f]) => [d, a / (k * f / 10) - 1]);
  const W = 1180, H = 260, l = 56, r = 20, t = 34, b = 30, max = 0.7;
  const x = (i) => l + (i / (p.length - 1)) * (W - l - r), y = (v) => t + (1 - v / max) * (H - t - b);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${MONO}><rect width="${W}" height="${H}" fill="#141414"/>`;
  s += `<text x="${l}" y="18" fill="#cfcfcf" font-weight="600" letter-spacing="2">SKHY OVER THE KOREAN LINE — SKHY close ÷ (000660.KS close × KRWUSD ÷ 10), per session since the listing</text>`;
  for (const v of [0, 0.2, 0.4, 0.6]) s += `<line x1="${l}" y1="${y(v)}" x2="${W - r}" y2="${y(v)}" stroke="#2a2a2a"/><text x="${l - 6}" y="${y(v) + 4}" fill="#8c8c8c" text-anchor="end">+${Math.round(v * 100)}%</text>`;
  p.forEach(([d], i) => { if (i % 8 === 0 || i === p.length - 1) s += `<text x="${x(i)}" y="${H - 10}" fill="#8c8c8c" text-anchor="middle">${d.slice(5)}</text>`; });
  for (let i = 1; i < p.length; i++) s += `<line x1="${x(i - 1)}" y1="${y(p[i - 1][1])}" x2="${x(i)}" y2="${y(p[i][1])}" stroke="${p[i][1] >= p[i - 1][1] ? "#3fb950" : "#e5484d"}" stroke-width="1.6"/>`;
  const last = p[p.length - 1];
  s += `<circle cx="${x(p.length - 1)}" cy="${y(last[1])}" r="3.5" fill="#c4c7cb"/><text x="${x(p.length - 1) - 8}" y="${y(last[1]) - 8}" fill="#e6e6e6" text-anchor="end">${last[0]} · +${Math.round(last[1] * 100)}%</text>`;
  return s + "</svg>";
}

/* ── the red cells, check by check, with the exact step that fixes each ── */
const FIX = {
  bars: "Estate-wide, not admission-specific: 2m, 45m, 8h, 2D, 3M, 6M and 12M have no fast-path copy and no scheduled pass rewrites them (only 1D refreshes when read). Staged: one bar-worker run limited to those seven widths, then the history cut (runbook B1). It lasts a day unless the widths join a scheduled pass — a schedule rule for the bars-rules lane.",
  facts: "The statements loader takes 10 names every 6 hours (a lap of 524 names is ~13 days); these v3 companies are still in the queue. Staged: seven one-off calls of 10 names (runbook B2). MOG.A also needs the loader to read its FMP symbol.",
  profile: "The 64 Geiger-only funds sit outside the loaders' list (fmp_full_universe takes role 'full' only) — the tier's own rule. FMP has a profile for every one (checked 3 Oct). Staged: one profile call per fund (runbook B3). MOG.A: FMP calls it MOG-A — staged migration fills tickers.fmp_symbol, then one profile call.",
  news: "Same gate as the profile row. FMP has news for 62 of the 66 (IYJ, RSPC, RSPM, RSPR: none). Staged: one news call per fund (runbook B4). Whether Geiger-only names should get news on a schedule is a rule for U5 / Alan.",
  comps: "C4 (live) keeps only same-industry names inside ÷10…×10 of the company's value; AMRC, BTSG, SNX and SPIR have no served company in their industry. C5 (pushed, not live) fills them: 12, 8, 12, 12. MOG.A has no profile (see PROFILE).",
};
const redByCheck = Object.entries(C.red_by_check).sort((a, b) => b[1] - a[1]);
const worst = rows.slice().sort((a, b) => nRed(b) - nRed(a) || a.ticker.localeCompare(b.ticker));
const worstFive = [worst.find((r) => r.ticker === "MOG.A"), worst.find((r) => r.ticker === "AMRC"), worst.find((r) => r.ticker === "BTSG"), worst.find((r) => r.ticker === "IBB"), worst.find((r) => r.ticker === "SNX")].filter(Boolean);
const cell = (x) => `<td class="c ${x.v.toLowerCase()}" title="${esc(x.why)}">${esc(x.v === "GREEN" ? "ok" : x.why.length > 46 ? x.why.slice(0, 44) + "…" : x.why)}</td>`;
const auditRow = (r) => `<tr><td><b>${esc(r.ticker)}</b>${r.claude_check ? ' <span class="tag">bookmark</span>' : ""}</td><td class="dim">${esc((r.name || "").slice(0, 28))}</td><td class="dim">${esc(r.kind)}</td><td class="dim">${esc((r.batch || "").slice(5))} ${esc(r.tier === "GEIGER-ONLY" ? "· G-only" : "")}</td>${CHECKS.map(([k]) => cell(r.checks[k])).join("")}</tr>`;
const auditHead = `<tr><th>name</th><th></th><th>kind</th><th>admitted</th>${CHECKS.map(([, l]) => `<th>${esc(l)}</th>`).join("")}</tr>`;
const book = rows.filter((r) => r.claude_check);

/* ── SK Hynix ── */
const M = SK.skhy.massive, P = SK.skhy.fmp, cur = SD.currency;
const srcRows = [
  ["Bars on every width", `Massive: 1m … 1M all answer (59 daily bars, 13 Jul → 2 Oct)`, "not in Massive · FMP daily since 2006 and intraday on Seoul hours, in won"],
  ["Live price and the previous close", `Massive stream and snapshot (close 195.13, previous 193.50) · FMP quote`, "FMP quote, in won (1,841,000)"],
  ["Statements", `FMP, in won, per ADS (${(P.income_q_SKHY.rows[0].weightedAverageShsOutDil / 1e6).toFixed(1)} M shares = 10 × the Korean count)`, "FMP, in won, per share"],
  ["Analyst estimates", `FMP: ${P.estimates_SKHY.rows.find((r) => r.date.startsWith("2026")).numAnalystsEps} analysts on EPS`, `FMP: ${P.estimates_000660_KS.rows.find((r) => r.date.startsWith("2026")).numAnalystsEps} analysts on EPS`],
  ["Price targets", `consensus $${P.targets_SKHY.row.targetConsensus} (low ${P.targets_SKHY.row.targetLow}, high ${P.targets_SKHY.row.targetHigh})`, "none"],
  ["News", `Massive ${M.news.n} (since ${M.news.oldest.slice(0, 10)}) · FMP ${P.news_SKHY.n}`, "none"],
  ["Peers from the providers", "none from FMP, none from Massive", "ten Korean lines (FMP)"],
];
const skhyHTML = `
<div class="box"><p><b>The line to admit is SKHY</b> — SK hynix's American Depositary Shares on Nasdaq, listed 10 Jul 2026. Ten ADSs are one common share of the Korean line 000660 (SEC prospectus, July 2026). SKHY is the only listing that gives bars on all 24 widths, the live price and the settled close in the Hub's provider (Massive), in dollars, on US hours. The Korean line is not in Massive at all; FMP carries it in won on Seoul hours.</p>
<p><b>Not yet admissible:</b> the admission rule asks for 60 stored sessions; SKHY had <b>59 at the 2 Oct close</b>. It reaches 60 at the Monday 5 Oct close, so the earliest sitting is after midnight ET going into Tue 6 Oct, or the weekend of 10 Oct.</p>
<p><b>Dry run against today's live set</b> (590 names · ${esc(UNI.universe_sha256.slice(0, 8))}…): <b>591 names · d9eef302… · scope 6351e351b29bd7b045eab5d0</b>, 13 pin rewrites, nothing written. Every pin on the provider and Hub code lines agrees with today's 590 (the builder's audit: 29 pins, no typed copy).</p></div>
<div class="panel">${premiumChart()}</div>
<p>At ten ADSs a share, SKHY closed <b>${Math.round(cur.premium_vs_korean_line.last[1] * 100)}% above</b> the Korean line on 2 Oct; over its ${cur.premium_vs_korean_line.sessions} sessions the gap ran from ${Math.round(cur.premium_vs_korean_line.min[1] * 100)}% (${cur.premium_vs_korean_line.min[0]}) to ${Math.round(cur.premium_vs_korean_line.max[1] * 100)}% (${cur.premium_vs_korean_line.max[0]}). Any multiple the Hub prints on the SKHY price carries that premium.</p>
<div class="wrap"><table><thead><tr><th>what the Hub needs</th><th>SKHY (Nasdaq, dollars)</th><th>000660.KS (Korea, won)</th></tr></thead><tbody>${srcRows.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="dim">${esc(c)}</td></tr>`).join("")}</tbody></table></div>
<h3>Currency — the way the Hub already handles TSM, ASML and BABA</h3>
<p>One row in the foreign-filer table (reported in <b>KRW</b>, listed in <b>USD</b>, an ADR, ${(cur.filer_currency_row.shares_dil / 1e9).toFixed(2)} bn ADS-equivalent shares) and a new <b>KRWUSD</b> daily series in the rates table. Today that table carries CAD, CNY, EUR, GBP and TWD only. FMP serves KRWUSD daily since Jan 2023; on 2 Oct it was ${cur.krwusd_newest.price}. Q2 2026 EPS per ADS: ${cur.eps_q2_2026_per_ads.krw.toLocaleString("en-US")} won ≈ $${cur.eps_q2_2026_per_ads.usd}.</p>
<h3>Comps on the day it is admitted (dry run over today's companies)</h3>
<div class="wrap"><table><thead><tr><th>rule</th><th>SKHY's own set</th><th>companies whose set would keep SKHY</th></tr></thead><tbody>
<tr><td>C4 (live)</td><td>${esc(SD.c4.set.map((r) => r[0]).join(" "))}</td><td>${esc(SD.c4.taken_by.join(" "))}</td></tr>
<tr><td>C5 (pushed)</td><td>${esc(SD.c5.set.map((r) => r[0]).join(" "))}</td><td>${esc(SD.c5.taken_by.join(" "))}</td></tr></tbody></table></div>
<p>Under C5, SKHY's own set has no memory company: C5 has no revenue split for SKHY yet, so it sits on the plain "semiconductors" line. Pulling its revenue segments is one of the admission's steps.</p>
<h3>Every step, in order (the runbook)</h3>
<ol><li><b>Prep, invisible</b> (after the 5 Oct close): a hidden row → the bar pull on all widths and the deep daily → the history-cut dry run (a new string, no earlier holder) → the gap report (must say PASS at 60) → the builder with SKHY's candidate file → one image pair → the settled-close preflight (its after-hours print is the kind that tripped FINX on 24 Sep).</li>
<li><b>The sitting</b>, market closed, one sitting or nothing: admit → the Geiger runner with <b>all eight</b> files that machine has injected at boot (two more machines than the 28 Sep runbook named carry the universe or scope; one named there no longer exists) → the chart API → the bar service and the three hourly machines (re-armed, never paused) → the stream's scope → the Hub row, the currency row and the KRWUSD series → the Hub pins (keeping the old digests for the RSI column) → SKHY's statements, profile, estimates and revenue segments → three minutes of the next session watched.</li>
<li>Each step's read-back and rollback: provider branch, runbooks/U4B_SKHY_ADMISSION_AND_STAGED_FIXES_20261003.md.</li></ol>`;

/* ── the facts table ── */
const fr = F.rows;
const lst = (r) => r.lists.map((l) => l[0]).join("");
const tc = (r) => r.cohorts.tree.map((c) => c.id + (c.kind === "adopted" ? "" : "*")).join(" ");
const factRow = (r) => {
  const d = r.daily;
  return `<tr><td><b>${esc(r.ticker)}</b></td><td class="dim">${esc((r.name || "").slice(0, 26))}</td><td>${esc(r.kind === "fund" ? "fund" : "co")}</td><td>${esc(r.today === "not served" ? "—" : r.today === "GEIGER-ONLY" ? "G-only" : "full")}</td><td class="dim">${esc(r.admitted ? (r.admitted.startsWith("2026") ? r.admitted.slice(5) : "364") : "")}</td><td>${esc(r.u3 || "")}</td><td>${esc(lst(r))}</td>` +
    `<td data-v="${r.hub_point_funds.length}" title="${esc(r.hub_point_funds.join(" "))}">${r.hub_point_funds.length || ""}</td><td data-v="${r.coverage_funds.length}" title="${esc(r.coverage_funds.join(" "))}">${r.coverage_funds.length || ""}</td>` +
    `<td class="dim" title="${esc(tc(r))}">${esc(tc(r).slice(0, 30))}</td><td class="dim">${esc(r.cohorts.board_home || "")}</td>` +
    `<td data-v="${r.comps_c4_peer_of}">${r.comps_c4_peer_of}</td><td data-v="${r.comps_c5_peer_of ?? -1}">${r.comps_c5_peer_of ?? ""}</td>` +
    `<td data-v="${d ? d.bars : 0}">${d ? d.bars : '<span class="mute">none</span>'}</td><td class="dim">${d ? esc(d.first) : ""}</td>` +
    `<td data-v="${r.statements ? r.statements.quarters : 0}">${r.statements ? r.statements.quarters : ""}</td><td class="dim">${r.estimates ? esc(String(r.estimates.through).slice(0, 4)) : ""}</td>` +
    `<td data-v="${r.news.d30}">${r.news.d30 || ""}</td><td data-v="${r.geiger ? r.geiger.composite : r.scout_geiger ? -9 : -99}">${r.geiger ? r.geiger.composite.toFixed(2) : r.scout_geiger ? '<span class="dim">scout</span>' : ""}</td></tr>`;
};
const factHead = ["ticker", "name", "kind", "today", "admitted", "U3", "lists", "Hub-point funds", "coverage funds", "tree cohorts", "board home", "C4 peer of", "C5 peer of", "daily bars", "first bar", "statements (q)", "estimates to", "news 30d", "Geiger"];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>U4b · admission audit and facts</title>
<style>
:root{--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--ink:#cfcfcf;--dim:#8c8c8c;--mute:#5a5a5a;--hi:#c4c7cb;--up:#3fb950;--dn:#e5484d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,Inter,Helvetica,Arial,sans-serif;padding:0 16px 60px}
main{max-width:1240px;margin:0 auto}h1{font-size:22px;font-weight:600;margin:28px 0 6px}h2{font-size:15px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin:38px 0 10px;font-weight:600}h3{font-size:14px;margin:22px 0 6px}
p{max-width:920px}.panel{background:var(--panel);border:1px solid var(--line);padding:10px;overflow-x:auto}svg{width:100%;height:auto;display:block;min-width:720px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}.tile{background:var(--panel);border:1px solid var(--line);padding:12px}.tile .n{font-size:26px;font-weight:600;font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace}.tile .l{font-size:11.5px;color:var(--dim)}
.tile.red .n{color:#e5484d}.tile.green .n{color:#3fb950}
table{border-collapse:collapse;width:100%;font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace;font-size:11.5px;margin:8px 0 18px}th,td{border-bottom:1px solid var(--line);padding:4px 7px;text-align:left;white-space:nowrap}th{color:var(--dim);font-weight:500;letter-spacing:1px;text-transform:uppercase;font-size:11px}
#facts th{cursor:pointer;position:sticky;top:0;background:var(--bg)}#facts th:hover{color:var(--ink)}
td.c{font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis}td.c.green{color:#3fb950}td.c.amber{color:#d29922}td.c.red{color:#e5484d;font-weight:600}
.wrap{overflow-x:auto;max-width:100%}details{max-width:100%;overflow:hidden}.dim{color:var(--dim)}.mute{color:var(--mute)}.tag{font-size:11px;color:#bdbdbd;border:1px solid #3a3a3a;padding:0 4px}
.box{border:1px solid var(--line);background:var(--panel);padding:12px 16px;margin:12px 0;max-width:920px}ol,ul{max-width:920px}li{margin:6px 0;overflow-wrap:anywhere}p{overflow-wrap:anywhere}
input#q{background:var(--panel);border:1px solid var(--line);color:var(--ink);font:12px SF Mono,ui-monospace,Menlo,monospace;padding:6px 8px;width:260px;max-width:100%}
details.sc-pagespecs{margin-top:44px;border-top:1px solid var(--line);padding-top:10px;color:var(--dim);font-size:12.5px}details.sc-pagespecs summary{cursor:pointer;letter-spacing:2px;font-size:11px}
</style></head><body><main>
<h1>The names admitted since 24 Sep — audited · SK Hynix prepared · the facts table</h1>
<p class="dim">U4b · 3 Oct 2026 · facts only: nothing admitted, removed or written live; nothing proposed for removal.</p>

<div class="tiles">
<div class="tile"><div class="n">${rows.length}</div><div class="l">names admitted since 24 Sep, audited</div></div>
<div class="tile red"><div class="n">${C.red_cells}</div><div class="l">red cells · on ${C.names_with_red} names</div></div>
<div class="tile green"><div class="n">${rows.filter((r) => r.checks.geiger.v === "GREEN").length}/${rows.length}</div><div class="l">Geiger on all 7 rungs</div></div>
<div class="tile green"><div class="n">${rows.filter((r) => r.checks.prev_close.v === "GREEN").length}/${rows.length}</div><div class="l">settled, confirmed previous close</div></div>
<div class="tile"><div class="n">${book.length}</div><div class="l">from the CLAUDE CHECK bookmarks · ${book.filter((r) => nRed(r) === 1).length} red only on the shared bar widths</div></div>
<div class="tile"><div class="n">${fr.length}</div><div class="l">names in the facts table (590 + 242 + 83)</div></div>
</div>

<h2 id="red">1 · The red cells first</h2>
<div class="panel">${grid()}</div>
<div class="wrap"><table><thead><tr><th>check</th><th>red cells</th><th>why, and the exact step that fixes it</th></tr></thead><tbody>
${redByCheck.map(([k, n]) => `<tr><td><b>${esc(CHECKS.find((c) => c[0] === k)[1])}</b></td><td>${n}</td><td style="white-space:normal;max-width:820px">${esc(FIX[k] || "")}</td></tr>`).join("")}
<tr><td><b>GEIGER · SETTLED CLOSE · COHORT · HISTORY</b></td><td>0</td><td style="white-space:normal">every admitted name has 7/7 rungs, a confirmed settled close, a place on the tree, and history that starts no earlier than its own listing (the 28 Sep floors held)</td></tr>
</tbody></table></div>
<h3>The worst five</h3>
<div class="wrap"><table><thead>${auditHead}</thead><tbody>${worstFive.map(auditRow).join("")}</tbody></table></div>
<p>MOG.A has the most red (4 of 9): FMP knows it only as MOG-A, so it has no profile, no statements and no comps. AMRC, BTSG and SNX lack statements and have an empty comps set under today's rule. IBB stands for the 64 Geiger-only funds, all alike: no profile, no news.</p>
<h3>The CLAUDE CHECK bookmarks (${book.length} admitted; CLSK, SIVE, TMRC held)</h3>
<div class="wrap"><table><thead>${auditHead}</thead><tbody>${book.map(auditRow).join("")}</tbody></table></div>
<p>${book.filter((r) => nRed(r) === 1).length} of the ${book.length} are red only on the seven bar widths every name shares. Six have a thin comps set (CRML, SERV, SIDU, SPIR, TECK, UUUU). Held at admission and still out: CLSK (one session missing, 24 and 28 Sep), SIVE (no Massive data), TMRC (a thin OTC line).</p>
<details><summary class="dim" style="cursor:pointer">All ${rows.length} admitted names, every check</summary>
<div class="wrap"><table><thead>${auditHead}</thead><tbody>${worst.map(auditRow).join("")}</tbody></table></div></details>

<h2 id="skhy">2 · SK Hynix — a proper admission, prepared</h2>
${skhyHTML}

<h2 id="facts-h">3 · The facts table — ${fr.length} names, no recommendation</h2>
<p>Today's ${UNI.count}, U3's ${F.scope.u3_in} candidates in, and U3's ${F.scope.u3_offhub} off-Hub names. Click a heading to sort; type to filter.</p>
<p><input id="q" placeholder="filter: ticker, list, cohort…" aria-label="filter the facts table"> <span id="qn" class="dim"></span></p>
<div class="wrap" style="max-height:80vh;overflow:auto"><table id="facts"><thead><tr>${factHead.map((h, i) => `<th data-i="${i}"${h === "lists" ? ' title="L = LIKED · F = FAVORITES · R = RADAR"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${fr.map(factRow).join("")}</tbody></table></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page is.</b> U4b, 3 Oct 2026. Item 1: SK Hynix's admission, prepared and not applied. Item 2: an audit of the 226 names admitted since 24 Sep: v2's 56 (pulled 24 Sep, live 27 Sep), the 66 Geiger-only names (27 Sep) and v3's 104 (live 29 Sep, the move to 590). Item 3: the facts per name. Nothing is cut and nothing is proposed for removal. U5 designs the served set, and Alan agrees before anything moves.</p>
<p><b>Where each number comes from</b> (all read-only, Sat 3 Oct 14:29–14:55Z):</p><ul>
<li>BARS: a walk of every stored bar object on a throw-away Fly machine. It reads the fast-path copy a chart of up to 400 candles uses, and the head of the full copy. "Fresh" means the newest bar belongs to the 2 Oct session (the week of 27 Sep for 1W, October for 1M, and so on). Widths with no fast-path copy are judged by the end of the window they were last pulled for.</li>
<li>GEIGER: the chart API's /geiger (computed 3 Oct 14:28Z): 590 names, 7 rungs each, 0 stale cells. SETTLED CLOSE: the chart API's /quotes for all 590 (589 provider-confirmed; BRK-B settled from the daily bar, not an admitted name).</li>
<li>PROFILE, STATEMENTS, ESTIMATES, NEWS, COHORTS, LISTS: the Hub database: company_profile, fundamentals, fundamentals_history, analyst_estimates, news (last 30 days), tickers, ticker_membership, hub_favorites (LIKED), station_lists (FAVORITES, RADAR). Tree cohorts come from deliverables/20260929/tree-map/tree.json; an asterisk marks a proposed, fund-set or pseudo cohort.</li>
<li>COMPS: C4's rule (live) and C5's rule (hub/c5-comps-method-20261003 @${esc((J("data/comps-counts-20261003.json").c5 || {}).sha || "—")}), run over today's rows for every served company. "Peer of" = how many of those sets keep the name. The run reproduces C5's own published AMZN and MU sets exactly.</li>
<li>FUNDS: U3's served-set-v2.json. "Hub-point funds" are the funds whose live-tolerance Hub point counts the name; "coverage funds" are those whose close-tolerance coverage point counts it on the off-Hub side.</li>
<li>COLUMN KEYS: lists L = LIKED, F = FAVORITES, R = RADAR · today: full / G-only (computed, not shown on the board) / — (not served) · admitted: 364 = served before 24 Sep, else the admission date · U3: hub / offhub / in / out / unjudged / "kept as is" (served today, not judged by U3) · Geiger: today's composite, "scout" = only the nightly scout Geiger has it · statements (q) = quarters of statements held · estimates to = the last fiscal year with a consensus.</li>
<li>DAILY BARS: the deepest stored daily object (Massive deep_v1). "none" = never pulled. SK HYNIX: Massive and FMP read on a throw-away Fly machine; the ADS ratio comes from SK hynix's SEC Form 424B4 (July 2026).</li></ul>
<p><b>What could be wrong.</b> The bar-freshness walk ran on a Saturday, so "fresh" means "through Friday's session". The news count reads the Hub's news table only (Google, FMP and Investing feeds), not Massive's news. "Peer of" counts only the sets of the 453 served companies; the 242 candidates would change it once served. U3's fund columns come from holdings dated 26 Sep. The premium uses same-calendar-date closes, and Seoul closes about 13 hours before New York.</p>
<p><b>Not done here.</b> No staged job was run; each is written out in the provider runbook with its read-back and rollback. Nothing was deployed. No list, table, universe or machine was changed. Generated by build.mjs, comps-counts.mjs, skhy-dryrun.mjs and page.mjs in this folder.</p>
</details>
</main>
<script>
(() => {
  const t = document.getElementById("facts"), tb = t.tBodies[0], q = document.getElementById("q"), qn = document.getElementById("qn");
  const key = (td) => { const v = td.getAttribute("data-v"); return v != null && v !== "" ? +v : td.textContent.trim().toLowerCase(); };
  let last = -1, dir = 1;
  t.tHead.addEventListener("click", (e) => { const th = e.target.closest("th"); if (!th) return; const i = +th.dataset.i; dir = i === last ? -dir : (th.textContent.match(/peer|bars|news|Geiger|funds|statements/i) ? -1 : 1); last = i;
    const rs = [...tb.rows]; rs.sort((a, b) => { const x = key(a.cells[i]), y = key(b.cells[i]); return (x > y ? 1 : x < y ? -1 : 0) * dir; }); for (const r of rs) tb.appendChild(r); });
  const f = () => { const s = q.value.trim().toLowerCase(); let n = 0; for (const r of tb.rows) { const on = !s || r.textContent.toLowerCase().includes(s); r.style.display = on ? "" : "none"; if (on) n++; } qn.textContent = n + " shown"; };
  q.addEventListener("input", f); f();
})();
</script>
</body></html>`;
writeFileSync(join(DIR, "U4B-FACTS.html"), html);
console.log("U4B-FACTS.html", html.length, "bytes");
