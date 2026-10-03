/* U3 (2 Oct 2026) · the served-set rule, Alan's way — the page. Reads measure.json and served-set-v2.json (written by
   build.mjs) and writes SERVED-SET-V2.html: pictures first, plain words, the tables, the rule, the decisions.
   Usage: node deliverables/20261002/served-set-v2/page.mjs   (from the Hub root, after build.mjs) */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DIR = dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(readFileSync(join(DIR, "measure.json"), "utf8"));
const S = JSON.parse(readFileSync(join(DIR, "served-set-v2.json"), "utf8"));
const T = M.totals, TOL = M.tolerances, Q = M.alan_question, FS = M.floor_sensitivity;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const g = (x) => (x == null ? '<span class="mute">—</span>' : `<span class="${x > 0 ? "up" : x < 0 ? "dn" : ""}">${x > 0 ? "+" : ""}${x.toFixed(2)}</span>`);
const pct = (x) => (x == null ? "—" : x.toFixed(1) + "%");
const r2 = (x) => (x == null ? '<span class="mute">n/a</span>' : (x * 100).toFixed(0) + "%");
const num = (x) => (x == null ? '<span class="mute">—</span>' : String(x));
const cap = M.cap.filter((r) => r.rule === "cap"), eq = M.equal;
const FAMILIES = [["SECTOR", "Sector funds (the SPDR sectors and their kin)"], ["INDUSTRY", "Industry funds"], ["STYLE", "Style funds (growth, value, dividend, quality, momentum, low-vol)"], ["BROAD", "Broad funds"]];
const MONO = `font-family="SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace" font-size="11"`;

/* ── picture 1: one chart per family — covered share vs names, the Hub point (open dot) and the coverage point (filled dot) ── */
function familyChart(fam, title) {
  const rows = cap.filter((r) => r.family === fam); if (!rows.length) return "";
  const W = 1180, H = 330, left = 56, right = 340, top = 40, bottom = 36, kmax = Math.min(100, Math.max(...rows.map((r) => Math.max(r.k_close || 0, 10))) + 5);
  const x = (k) => left + (Math.min(k, kmax) / kmax) * (W - left - right), y = (s) => top + (1 - s / 100) * (H - top - bottom);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${MONO}><rect width="${W}" height="${H}" fill="#141414"/>`;
  s += `<text x="${left}" y="16" fill="#cfcfcf" font-weight="600" letter-spacing="2">${esc(title.toUpperCase())} — share of the fund's weight covered, as names are added in weight order</text>`;
  for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${left}" y1="${y(v)}" x2="${W - right}" y2="${y(v)}" stroke="#2a2a2a"/><text x="${left - 6}" y="${y(v) + 4}" fill="#8c8c8c" text-anchor="end">${v}%</text>`;
  for (const k of [1, 10, 20, 30, 40, 50, 75, 100].filter((k) => k <= kmax)) s += `<text x="${x(k)}" y="${H - 14}" fill="#8c8c8c" text-anchor="middle">${k}</text>`;
  s += `<text x="${(left + W - right) / 2}" y="${H - 2}" fill="#8c8c8c" text-anchor="middle">names, biggest first</text>`;
  rows.forEach((r, i) => {
    const pts = r.curve.filter((p) => p.k <= kmax);
    s += `<polyline fill="none" stroke="#9a9a9a" stroke-width="1" points="${pts.map((p) => x(p.k) + "," + y(p.share)).join(" ")}"/>`;
    if (r.k_live) s += `<circle cx="${x(r.k_live)}" cy="${y(r.share_live)}" r="3.5" fill="#141414" stroke="#c4c7cb" stroke-width="1.5"/>`;
    if (r.k_close) s += `<circle cx="${x(r.k_close)}" cy="${y(r.share_close)}" r="3.5" fill="#c4c7cb"/>`;
    const ly = top + 8 + i * 13; if (ly < H - bottom) s += `<text x="${W - right + 10}" y="${ly}" fill="#acacac" font-size="10">${esc(r.fund)} · Hub ${r.k_live ?? "—"} names (${pct(r.share_live)}) · covered at ${r.k_close} (${pct(r.share_close)})</text>`;
  });
  s += `<text x="${left}" y="${top - 8}" fill="#8c8c8c" font-size="10">open dot = the Hub point (live read) · filled dot = the coverage point (firm read at the close)</text>`;
  return s + "</svg>";
}

/* ── picture 2: the equal-weight funds — covered share before the overlap rule (grey), after it (light), final (outline) ── */
function equalChart() {
  const rows = eq.slice().sort((a, b) => b.final.share - a.final.share);
  const W = 1180, left = 90, right = 300, rowH = 18, top = 44, H = top + rows.length * rowH + 30;
  const x = (v) => left + (Math.min(v, 100) / 100) * (W - left - right);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${MONO}><rect width="${W}" height="${H}" fill="#141414"/>`;
  s += `<text x="${left}" y="16" fill="#cfcfcf" font-weight="600" letter-spacing="2">EQUAL-WEIGHT AND VERY BROAD FUNDS — share of weight covered: by the cap pass (grey) · after the overlap rule (light) · final, every addition in (outline)</text>`;
  for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${x(v)}" y1="${top - 8}" x2="${x(v)}" y2="${H - 24}" stroke="#2a2a2a"/><text x="${x(v)}" y="${top - 14}" fill="#8c8c8c" text-anchor="middle">${v}%</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    s += `<text x="${left - 8}" y="${y + 12}" fill="#cfcfcf" text-anchor="end">${esc(r.fund)}</text>`;
    s += `<rect x="${left}" y="${y + 2}" width="${Math.max(0, x(r.final.share) - left)}" height="13" fill="none" stroke="#c4c7cb" stroke-dasharray="2 2"/>`;
    s += `<rect x="${left}" y="${y + 2}" width="${Math.max(0, x(r.after.share) - left)}" height="13" fill="#c4c7cb"/>`;
    s += `<rect x="${left}" y="${y + 2}" width="${Math.max(0, x(r.before.share) - left)}" height="13" fill="#5a5a5a"/>`;
    s += `<text x="${W - right + 8}" y="${y + 12}" fill="#acacac" font-size="10">${r.before.count} names → +${r.added_count} → ${r.final.count} of ${r.n} · ${pct(r.final.share)}</text>`;
  });
  return s + "</svg>";
}

/* ── picture 3: the SPDR funds — Hub names today against the Hub point ── */
function spdrChart() {
  const rows = M.spdr.slice().sort((a, b) => b.hub_today - a.hub_today);
  const W = 1180, left = 70, right = 330, rowH = 18, top = 44, H = top + rows.length * rowH + 30, max = Math.max(...rows.map((r) => r.hub_today), 50);
  const x = (v) => left + (Math.min(v, max) / max) * (W - left - right);
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ${MONO}><rect width="${W}" height="${H}" fill="#141414"/>`;
  s += `<text x="${left}" y="16" fill="#cfcfcf" font-weight="600" letter-spacing="2">STATE STREET (SPDR) FUNDS — names on the Hub today (grey) against the Hub point (light): the overhang could move off the Hub</text>`;
  for (const v of [0, 50, 100, 150, 200, 250, 300].filter((v) => v <= max)) s += `<line x1="${x(v)}" y1="${top - 8}" x2="${x(v)}" y2="${H - 24}" stroke="#2a2a2a"/><text x="${x(v)}" y="${top - 14}" fill="#8c8c8c" text-anchor="middle">${v}</text>`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    s += `<text x="${left - 8}" y="${y + 12}" fill="#cfcfcf" text-anchor="end">${esc(r.fund)}</text>`;
    s += `<rect x="${left}" y="${y + 2}" width="${Math.max(0, x(r.hub_today) - left)}" height="13" fill="#5a5a5a"/>`;
    if (r.hub_point != null) s += `<rect x="${left}" y="${y + 2}" width="${Math.max(0, x(r.hub_point) - left)}" height="13" fill="#c4c7cb"/>`;
    s += `<text x="${W - right + 8}" y="${y + 12}" fill="#acacac" font-size="10">${r.hub_today} today · Hub point ${r.hub_point ?? "overlap rule"} · ${r.beyond_point} beyond · ${r.movable_off_hub} could move off (${r.stay_for_another_reason} stay: another fund or a list)</text>`;
  });
  return s + "</svg>";
}

const capTable = (fam) => `<table><thead><tr><th>fund</th><th>names in fund</th><th>on Hub today</th><th>Hub point</th><th>share at Hub point</th><th>coverage point</th><th>share covered</th><th>Geiger gap at coverage</th><th>draws</th><th>daily moves explained</th><th>fund's own Geiger vs all-names blend</th></tr></thead><tbody>${cap.filter((r) => r.family === fam).sort((a, b) => a.fund < b.fund ? -1 : 1).map((r) => `<tr><td><b>${esc(r.fund)}</b> <span class="dim">${esc(r.label)}</span></td><td>${r.n}</td><td>${r.hub_today}</td><td>${num(r.k_live)}</td><td>${pct(r.share_live)}</td><td>${num(r.k_close)}</td><td>${pct(r.share_close)}</td><td>${g(r.at_close && r.at_close.diff)}</td><td>${r.at_close ? r.at_close.pass + "/" + r.at_close.of : "—"}</td><td>${r.at_close ? r2(r.at_close.r2) : "—"}${r.at_close && r.at_close.r2 == null && r.at_close.r2_thin != null ? ` <span class="mute">(thin: ${(r.at_close.r2_thin * 100).toFixed(0)}% on ${(r.at_close.returns_share * 100).toFixed(0)}% of the weight)</span>` : ""}</td><td>${g(r.fund_own_geiger)} vs ${g(r.all_names_blend)}</td></tr>`).join("")}</tbody></table>`;
const overlapRows = M.cap.filter((r) => r.rule === "overlap");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Served set v2</title>
<style>
:root{--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--ink:#cfcfcf;--dim:#8c8c8c;--mute:#5a5a5a;--hi:#c4c7cb;--up:#3fb950;--dn:#e5484d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,Inter,Helvetica,Arial,sans-serif;padding:0 16px 60px}
main{max-width:1200px;margin:0 auto}h1{font-size:22px;font-weight:600;margin:28px 0 6px}h2{font-size:15px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin:38px 0 10px;font-weight:600}h3{font-size:14px;color:var(--ink);margin:22px 0 6px}
p{max-width:900px}.lead{font-size:16px;color:#dcdcdc}.panel{background:var(--panel);border:1px solid var(--line);padding:10px;overflow-x:auto}svg{width:100%;height:auto;display:block;min-width:720px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}.tile{background:var(--panel);border:1px solid var(--line);padding:12px}.tile .n{font-size:26px;font-weight:600;font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace}.tile .l{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--dim)}
table{border-collapse:collapse;width:100%;font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace;font-size:11.5px;margin:8px 0 18px}th,td{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap}th{color:var(--dim);font-weight:500;letter-spacing:1px;text-transform:uppercase;font-size:10px}
.wrap{overflow-x:auto}.dim{color:var(--dim)}.mute{color:var(--mute)}.up{color:var(--up)}.dn{color:var(--dn)}.note{font-size:12.5px;color:var(--dim)}.names{font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.9;word-break:break-word}
ol,ul{max-width:900px}li{margin:6px 0}.box{border:1px solid var(--line);background:var(--panel);padding:12px 16px;margin:12px 0;max-width:900px}
</style></head><body><main>
<h1>The served set, redone Alan's way — a proposal with measurements</h1>
<p class="note">U3 · 2 Oct 2026 · built ${esc(S.built_utc)} · PROPOSED: nothing is admitted or removed, no table, universe, Hub page or job is touched. The coordinator runs any admission at a closed-market sitting with Alan's word.</p>

<p class="lead"><b>The rule in one paragraph.</b> For a fund that weights by size (the sector SPDRs, QQQ, SMH, IGV, …) we add its names biggest first and, at every count, ask two questions: does the Geiger blend of those names sit within ±${TOL.geiger_close} of the blend of all its names (on the close reading and on ${Math.round(TOL.pass_share * 100)}% of ${M.draws.length} other draws), and do their daily moves explain ${Math.round(TOL.returns_r2_close * 100)}% of the fund's own daily moves over ${TOL.return_days} sessions? The first count from which both stay true is the <b>coverage point</b>; the share of the fund's weight at that count is the statistically relevant share — measured, not chosen. The same test at a looser live tolerance (±${TOL.geiger_live}, ${Math.round(TOL.returns_r2_live * 100)}%) gives the <b>Hub point</b>: those names are read live on the Hub, the rest of the covered set is blended off-Hub at the close. Equal-weight funds (RSP, QQEW, the SPDR industry funds) and IWM get no cap rule: we measure how much of each the chosen names already cover, then add only names that live in other funds too, most other homes first, until the blend tracks the fund with at least ${TOL.equal_weight_share_floor}% of its weight in or ten more names would add under one point. RADAR / FAVORITES / LIKED are always on the Hub. Cohorts are not a rule. No cap per fund, no names-per-fund headline.</p>

<div class="tiles">
<div class="tile"><div class="n">${T.hub_names}</div><div class="l">names on the Hub (live)</div></div>
<div class="tile"><div class="n">${T.offhub_names}</div><div class="l">names off-Hub (blended at the close)</div></div>
<div class="tile"><div class="n">${T.funds_on_hub}</div><div class="l">funds on the Hub (their own line stays)</div></div>
<div class="tile"><div class="n">${T.hub_lines}</div><div class="l">Hub lines · today ${T.today_lines}</div></div>
<div class="tile"><div class="n">${T.out}</div><div class="l">today's names that leave the live Hub (${T.out_to_offhub} to off-Hub, ${T.out_gone} off the blend)</div></div>
<div class="tile"><div class="n">${T.in}</div><div class="l">names that join the Hub</div></div>
</div>
<p class="note">Against U2 (574 lines · 95 out · 77 in): this proposal reads <b>${T.hub_lines} lines · ${T.out} out · ${T.in} in</b>. The Hub grows because the equal-weight funds were nearly uncovered (KRE 3%, KBE 9%, XRT 16%, XPH 16% of their weight today) and because the lists alone hold ${T.hub_from_lists_only} names no fund needs. ${T.unjudged} of today's names (${esc(S.unjudged.join(", "))}) are held by no fund with a holdings file and are kept, not judged.</p>

<h2 id="s1">1 · Alan's question: with the earlier result (95 out, 77 in), is RSP covered? How much of IWM?</h2>
<div class="box">
<p><b>RSP — no, not firmly.</b> U2's 574 set holds ${Q.rsp_under_u2.count} of RSP's ${Q.rsp_under_u2.of} names, ${pct(Q.rsp_under_u2.share)} of its weight. Their Geiger blend sits ${g(Q.rsp_under_u2.diff)} from the all-names blend (inside ±${TOL.geiger_close}, on ${Q.rsp_under_u2.pass}/${Q.rsp_under_u2.draws} draws), but their daily moves explain only ${r2(Q.rsp_under_u2.r2)} of RSP's — the other half of the fund moves on its own. Today's Hub does a little better (${Q.rsp_today.count} names, ${pct(Q.rsp_today.share)}, ${r2(Q.rsp_today.r2)} of daily moves). This proposal adds ${eq.find((r) => r.fund === "RSP").added_count} RSP names by the overlap rule and ends at ${Q.rsp_under_u3_all.count} names, ${pct(Q.rsp_under_u3_all.share)} of the weight, Geiger gap ${g(Q.rsp_under_u3_all.diff)} on ${Q.rsp_under_u3_all.pass}/${Q.rsp_under_u3_all.draws} draws (the returns test cannot be read there: the chart API has daily bars only for the tracked universe, so ${(100 * (1 - Q.rsp_under_u3_all.returns_share)).toFixed(0)}% of that weight has no returns yet — see "what could be wrong").</p>
<p><b>IWM — a sliver.</b> U2's set holds ${Q.iwm_under_u2.count} of IWM's ${Q.iwm_under_u2.of} names, ${pct(Q.iwm_under_u2.share)} of its weight; today's Hub ${Q.iwm_today.count} names, ${pct(Q.iwm_today.share)}. This proposal reaches ${Q.iwm_under_u3_all.count} names and ${pct(Q.iwm_under_u3_all.share)} of IWM's weight (Geiger gap ${g(Q.iwm_under_u3_all.diff)} on ${Q.iwm_under_u3_all.pass}/${Q.iwm_under_u3_all.draws} draws) and stops because the next ten names would add under one point. IWM's line on the Hub, read on its own price, stays the honest read of small caps; the blend is a window, not a copy.</p>
</div>

<h2 id="s2">2 · The cap-weighted funds — one chart per family</h2>
<p>Each line is one fund: how much of its weight the biggest k names carry. The open dot is the Hub point, the filled dot the coverage point. Where the dots sit decides the share — different for every fund, as Alan asked (XLK's six biggest names carry ${pct(cap.find((r) => r.fund === "XLK").share_live)} and are its Hub point; XLI needs ${cap.find((r) => r.fund === "XLI").k_live} names for ${pct(cap.find((r) => r.fund === "XLI").share_live)}).</p>
${FAMILIES.map(([fam, title]) => cap.some((r) => r.family === fam) ? `<h3>${esc(title)}</h3><div class="panel">${familyChart(fam, title)}</div><div class="wrap">${capTable(fam)}</div>` : "").join("")}
<p class="note">"Geiger gap at coverage" = the top-k blend minus the all-names blend on the 1 Oct close reading. "Draws" = on how many of the ${M.draws.length} extra readings (seven rungs of that close, five daily closes) the gap stayed inside ±${TOL.geiger_close}. "Daily moves explained" = the share of the fund's day-to-day return the blend reproduces over the last ${TOL.return_days} sessions (n/a where names carrying more than 20% of the weight have no daily bars). The last column shows the fund's own Geiger (read on the fund's price) beside the all-names blend: they differ on every fund — see "what could be wrong".</p>
<h3>Funds the cap pass could not cover inside 100 names — sent to the overlap rule</h3>
<div class="wrap"><table><thead><tr><th>fund</th><th>names in fund</th><th>coverage point found</th><th>why it goes to the overlap rule</th></tr></thead><tbody>${M.to_overlap.map((o) => { const r = M.cap.find((c) => c.fund === o.fund); return `<tr><td><b>${esc(o.fund)}</b></td><td>${r ? r.n : (eq.find((e) => e.fund === o.fund) || {}).n}</td><td>${r && r.k_close ? r.k_close + " names · " + pct(r.share_close) : "—"}</td><td>${esc(o.why)}</td></tr>`; }).join("")}</tbody></table></div>

<h2 id="s3">3 · The equal-weight and very broad funds — the overlap rule</h2>
<div class="panel">${equalChart()}</div>
<div class="wrap"><table><thead><tr><th>fund</th><th>names</th><th>covered by the cap pass</th><th>added by the overlap rule</th><th>after</th><th>final (every addition in)</th><th>Geiger gap · draws</th><th>daily moves explained</th><th>stopped because</th></tr></thead><tbody>${eq.slice().sort((a, b) => a.fund < b.fund ? -1 : 1).map((r) => `<tr><td><b>${esc(r.fund)}</b> <span class="dim">${esc(r.label)}</span></td><td>${r.n}</td><td>${r.before.count} · ${pct(r.before.share)}</td><td>${r.added_count}</td><td>${r.after.count} · ${pct(r.after.share)}</td><td>${r.final.count} · ${pct(r.final.share)}</td><td>${g(r.final.diff)} · ${r.final.pass}/${r.final.of}</td><td>${r2(r.final.r2)}</td><td class="dim">${esc(r.stopped_because)}</td></tr>`).join("")}</tbody></table></div>
<p class="note">"Live in most other places" is counted over our 51 funds with holdings, leaving out the total-market funds (VTI, ITOT, IWV, VT, VXUS) that hold everything. A name held by no other fund is never added. The floor of ${TOL.equal_weight_share_floor}% is the builder's: without it a handful of names could pass the Geiger test for an equal-weight fund. The same pass under other floors: none → ${FS[0].hub_lines} Hub lines (+${FS[0].added} names), 30% → ${FS[30].hub_lines} (+${FS[30].added}), 50% → ${FS[50].hub_lines} (+${FS[50].added}).</p>
<h3>What the overlap rule adds, per fund</h3>
<div class="names">${eq.filter((r) => r.added_count).map((r) => `<b>${esc(r.fund)}</b> (+${r.added_count}): ${esc(r.added.join(" "))}<br>`).join("")}</div>

<h2 id="s4">4 · State Street — where the Hub is over-served</h2>
<p>Alan: "maybe in the State Street ones; a lot of that could migrate off Hub." Per SPDR fund: the names on the Hub today that are held by the fund, the Hub point, and the overhang. A name in the overhang moves off the Hub only if no other fund's Hub point and no list keeps it — that is the "could move off" count.</p>
<div class="panel">${spdrChart()}</div>
<div class="wrap"><table><thead><tr><th>fund</th><th>rule</th><th>names</th><th>on Hub today</th><th>Hub point</th><th>share at Hub point</th><th>beyond the point</th><th>could move off the Hub</th><th>stay (another fund or a list)</th><th>the names that could move</th></tr></thead><tbody>${M.spdr.slice().sort((a, b) => b.movable_off_hub - a.movable_off_hub).map((r) => `<tr><td><b>${esc(r.fund)}</b> <span class="dim">${esc(r.label)}</span></td><td>${r.rule}</td><td>${r.n}</td><td>${r.hub_today}</td><td>${num(r.hub_point)}</td><td>${pct(r.share_at_hub_point)}</td><td>${r.beyond_point}</td><td><b>${r.movable_off_hub}</b></td><td>${r.stay_for_another_reason}</td><td class="dim">${esc(r.movable.slice(0, 14).join(" "))}${r.movable.length > 14 ? " …" : ""}</td></tr>`).join("")}</tbody></table></div>
<p class="note">SPY is the big one: ${M.spdr.find((r) => r.fund === "SPY").hub_today} of its names are on the Hub today; SPY went to the overlap rule (its coverage point needs ${M.cap.find((r) => r.fund === "SPY").k_close} names), and ${M.spdr.find((r) => r.fund === "SPY").movable_off_hub} of them are kept by nothing else. For the sector SPDRs the overhang is real but smaller: XLU ${M.spdr.find((r) => r.fund === "XLU").movable_off_hub}, XLI ${M.spdr.find((r) => r.fund === "XLI").movable_off_hub}, XLF ${M.spdr.find((r) => r.fund === "XLF").movable_off_hub}. Most XLK and XLV names beyond the point stay because QQQ, SMH, IBB or a list wants them.</p>

<h2 id="s5">5 · Totals, and the lists</h2>
<div class="wrap"><table><thead><tr><th></th><th>today</th><th>U2 (2 Oct afternoon)</th><th>this proposal</th></tr></thead><tbody>
<tr><td>Hub lines</td><td>${T.today_lines}</td><td>${T.u2.lines}</td><td><b>${T.hub_lines}</b> = ${T.hub_names} names + ${T.funds_on_hub} funds + ${T.unjudged} not judged</td></tr>
<tr><td>names on the Hub</td><td>${T.today_names}</td><td>${T.u2.names}</td><td><b>${T.hub_names}</b> (${T.hub_from_cap} from a cap-weighted fund's Hub point · ${T.hub_from_overlap} touched by the overlap rule · ${T.hub_from_lists_only} only because of a list)</td></tr>
<tr><td>names off-Hub (blended at the close)</td><td>0</td><td>—</td><td><b>${T.offhub_names}</b></td></tr>
<tr><td>out of the live Hub</td><td>—</td><td>${T.u2.out}</td><td><b>${T.out}</b> (${T.out_to_offhub} move to off-Hub, ${T.out_gone} leave the blend)</td></tr>
<tr><td>into the Hub</td><td>—</td><td>${T.u2.in}</td><td><b>${T.in}</b></td></tr>
</tbody></table></div>
<h3>Out of the live Hub (${S.out.length})</h3><div class="names">${S.out.map((r) => `${esc(r.ticker)}${S.offhub.some((o) => o.ticker === r.ticker) ? '<span class="mute">°</span>' : ""}`).join(" ")}</div><p class="note">° = goes to off-Hub (still in a fund's blend at the close). The rest leave the blend; their own Geiger stays in the nightly seven-rung close.</p>
<h3>Into the Hub (${S.in.length})</h3><div class="names">${S.in.map((r) => esc(r.ticker)).join(" ")}</div>
<h3>Off-Hub, blended at the close (${S.offhub.length})</h3><div class="names">${S.offhub.map((r) => esc(r.ticker)).join(" ")}</div>

<h2 id="s6">6 · Where every number comes from</h2>
<ul>
<li>Fund holdings and weights: the FMP holdings file of ${esc(S.sources.holdings)} the tree uses (51 of 138 tree funds). No fund was fetched anew.</li>
<li>Geiger readings: the seven-rung close run as of ${esc(S.sources.seven.as_of)} (main reading and its seven rungs) and the daily three-rung closes of ${esc(S.sources.daily_three_rung.join(", "))} — ${M.draws.length} draws in all.</li>
<li>Daily closes: the chart API, ${S.sources.closes.symbols} symbols, ${esc(S.sources.closes.first)} → ${esc(S.sources.closes.last)}; it serves the tracked universe only, so ${S.sources.closes.missing} requested symbols had none.</li>
<li>The lists: LIKED (hub_favorites, 141), FAVORITES (57) and RADAR (17) from station_lists, read-only. Today's universe: the chart API, 590.</li>
<li>Nothing was written: no table, no universe, no Hub page, no job. Headless screenshots only.</li>
</ul>

<h2 id="s7">7 · What could be wrong</h2>
<ol>${M.limits.map((l) => `<li>${esc(l)}</li>`).join("")}
<li>XLB's returns fit is negative even with all 25 names in; its candle series from the chart API ends near $49 and may be another instrument's. Its Geiger side is clean; the fund went to the overlap rule on the returns side and should be re-checked once the series is confirmed.</li>
<li>The equal-weight funds are mostly judged on the Geiger side alone (their names have no daily bars yet). One Fly job (${esc("fmp-batch-eod.mjs")} beside this page) fetches the missing closes from FMP's batch end-of-day route so the returns test can speak for them too.</li>
<li>Readings are one close (1 Oct). The points will move a little from day to day; the rule is meant to be re-measured nightly and a name should change side only after it has held for several closes (U2's guard).</li>
</ol>

<h2 id="s8">8 · Decisions for Alan</h2>
<ol>
<li><b>The error.</b> ±${TOL.geiger_close} on the Geiger and ${Math.round(TOL.returns_r2_close * 100)}% of daily moves explained at the close; ±${TOL.geiger_live} and ${Math.round(TOL.returns_r2_live * 100)}% live. Recommendation: accept — a tenth of the −1…+1 scale is the size of change the Hub colours, and nine-tenths of the daily move is where a blend stops being a proxy and starts being the fund.</li>
<li><b>The equal-weight floor.</b> With Alan's words alone the Hub would read ${FS[0].hub_lines} lines; with a 30% floor ${FS[30].hub_lines}; with 50% ${FS[50].hub_lines}. Recommendation: 30% — the SPDR industry funds are at 3–16% today, which is no read at all, and 50% would put most of MDY on the Hub.</li>
<li><b>The Geiger yardstick.</b> Measured literally, the fund's own Geiger sits far from the blend of all its names on every fund (XLK +0.86 vs +1.28). Recommendation: keep the all-names blend as the Geiger target and the fund's own price as the returns target, and show the fund's own Geiger beside the blend on the Hub as the check — never as the same number.</li>
</ol>
</main></body></html>`;
writeFileSync(join(DIR, "SERVED-SET-V2.html"), html);
console.log("wrote SERVED-SET-V2.html", html.length, "bytes");
