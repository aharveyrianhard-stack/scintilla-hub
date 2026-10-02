#!/usr/bin/env node
/* U1 · builds UNIVERSE-STANDARD.html, agreement-ladder.html, agreement-3d.html and universe-standard.v1.json from
   derived-20261001.json (node derive.mjs first). Static pages: no fetch, no key, nothing live. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(readFileSync(join(HERE, "derived-20261001.json"), "utf8"));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (v) => v == null ? "—" : v >= 1e12 ? "$" + (v / 1e12).toFixed(2) + " T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(0) + " B" : "$" + (v / 1e6).toFixed(0) + " M";
const pct = (v) => v == null ? "—" : (v < 0 ? "(" + Math.abs(v).toFixed(1) + "%)" : v.toFixed(1) + "%");
const num = (v, d = 2) => v == null ? "—" : (+v).toFixed(d);
const sgn = (v) => v == null ? "" : v > 0 ? "up" : v < 0 ? "dn" : "";
const SIX = D.six, CS = D.comp_sets, EX = D.examples, A = D.authorities, DR = D.dry_run, COV = D.coverage;

/* ---------- styles (the board's tokens: greys whose channels differ by ≤24, nothing above 210; green/red for direction only) ---------- */
const CSS = `
:root{color-scheme:dark;--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--line2:#383838;--ink:#cfcfcf;--ink2:#acacac;--dim:#8c8c8c;--mute:#6c6c6c;--up:#4fae6a;--dn:#d0554a;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--mono);font-size:13px;line-height:1.6;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:0 20px 90px;overflow-x:hidden}
.top{padding:18px 0 12px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.brand{font:400 12px/1.4 var(--mono);letter-spacing:.2em;color:var(--dim)}.brand b{color:var(--ink);font-weight:600}
.stamp{margin-left:auto;font:400 11px/1.5 var(--mono);color:var(--dim);letter-spacing:.06em;text-align:right}
.proposed{display:inline-block;border:1px solid var(--line2);padding:1px 8px;font-size:10px;letter-spacing:.2em;color:var(--ink);margin-left:8px;vertical-align:middle}
h1{font:600 15px/1.4 var(--mono);letter-spacing:.24em;color:var(--ink);margin:26px 0 6px;text-transform:uppercase}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.22em;color:var(--ink);margin:36px 0 8px;text-transform:uppercase;border-bottom:1px solid var(--line);padding-bottom:6px}
h2 small{font-weight:400;letter-spacing:.06em;color:var(--dim);text-transform:none;margin-left:10px;font-size:12px}
h3{font:600 12px/1.4 var(--mono);letter-spacing:.14em;color:var(--ink);margin:22px 0 6px;text-transform:uppercase}
.panel{border:1px solid var(--line);background:var(--panel);margin:10px 0}
.words{padding:12px 16px 14px;font-size:12.5px;line-height:1.7}.words b{color:var(--ink);font-weight:600}
.words ul,.words ol{margin:4px 0 8px;padding-left:22px}.words li{margin:5px 0}.words li::marker{color:var(--mute)}
.words q{quotes:"\\201C" "\\201D";color:var(--ink)}.up{color:var(--up)}.dn{color:var(--dn)}code{font-size:12px;color:var(--ink)}
.lead{font-size:13.5px;color:var(--ink);max-width:1000px}
.tiles{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.tile{border:1px solid var(--line);background:var(--panel);padding:8px 14px;min-width:120px}
.tile b{display:block;font-size:22px;color:var(--ink);font-variant-numeric:tabular-nums;font-weight:600}.tile span{font-size:10px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase}
table.t{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
table.t th,table.t td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
table.t th{font:400 10px/1.4 var(--mono);letter-spacing:.14em;color:var(--mute);text-transform:uppercase;white-space:nowrap}
table.t td{color:var(--ink2)}table.t td.k,table.t th.k{color:var(--ink)}table.t td.r,table.t th.r{text-align:right;white-space:nowrap}
table.t tr.kept td{background:#181818}table.t tr.me td{color:var(--ink);background:#1a1a1a}
.tw{overflow-x:auto;padding:0 16px 10px}
.tag{display:inline-block;border:1px solid var(--line2);padding:0 6px;font-size:10px;letter-spacing:.12em;color:var(--ink2);margin-right:4px;white-space:nowrap}
.tag.on{color:var(--ink);border-color:var(--ink2)}.tag.off{color:var(--mute);border-color:var(--line)}
.st-table{color:var(--ink)}.st-job{color:var(--ink2)}.st-new{color:var(--dim)}
.shot{padding:12px 16px 14px}.shot img{display:block;width:100%;height:auto;border:1px solid var(--line2)}
.shot .clip{max-height:900px;overflow:hidden;border:1px solid var(--line2)}.shot .clip img{border:0}.shot .clip.phone{width:390px;max-width:100%}
.shot small{display:block;margin-top:6px;font-size:11px;color:var(--dim)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0}.two > div + div{border-left:1px solid var(--line)}
.three{display:grid;grid-template-columns:repeat(3,1fr)}.three > div + div{border-left:1px solid var(--line)}
.ladder{display:grid;grid-template-columns:72px repeat(4,56px) 1fr 100px 190px;gap:0;font-size:12px;align-items:center}
.ladder .c-verdict{white-space:normal;line-height:1.3}.ladder .short{display:none}
.ladder > div{padding:4px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
.ladder .h{font-size:10px;letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.ladder .dot{width:10px;height:10px;border-radius:50%;display:inline-block;border:1px solid var(--line2)}
.ladder .dot.on{background:var(--ink);border-color:var(--ink)}
.ladder .band{background:#181818;color:var(--ink)}.ladder .band-edge{border-top:1px solid var(--ink2)}
.ladder .bar{height:6px;background:var(--line2);display:inline-block;vertical-align:middle}
.svgwrap{padding:12px 16px}.svgwrap svg{width:100%;height:auto;display:block}
.epic{border:1px solid var(--line);background:var(--panel);margin:8px 0;padding:10px 14px}.epic b{color:var(--ink)}
.epic .m{font-size:11px;color:var(--dim);letter-spacing:.08em}.est{display:inline-block;border:1px solid var(--line2);padding:0 6px;font-size:10px;letter-spacing:.14em;color:var(--dim)}
.dec{border:1px solid var(--line2);background:var(--panel);margin:8px 0;padding:10px 14px}.dec b{color:var(--ink)}
.toc{columns:2;column-gap:30px;font-size:12px;padding:10px 16px}.toc a{color:var(--ink2);text-decoration:none;display:block;padding:2px 0}.toc a:hover{color:var(--ink)}
@media(max-width:760px){.wrap{padding:0 12px 60px}.two,.three{grid-template-columns:1fr}.two > div + div,.three > div + div{border-left:0;border-top:1px solid var(--line)}.stamp{margin-left:0;text-align:left}.toc{columns:1}.ladder{grid-template-columns:54px repeat(4,28px) 58px 1fr;font-size:11px}.ladder > div{padding:4px 4px}.ladder .c-mv{display:none}.ladder .c-close .bar{display:none}.ladder .short{display:inline}.ladder .long{display:none}table.t{min-width:720px}.tiles .tile{min-width:92px}.svgwrap{overflow-x:auto}.svgwrap svg{min-width:720px}}
`;

/* ---------- the agreement ladder (LRCX) ---------- */
function ladderHTML(T, { full = false } = {}) {
  const s = CS[T], rows = full ? s.ladder : s.ladder.filter((r) => r.n_votes >= 2 || r.kept).slice(0, 34);
  const kept = new Set(s.standard.kept.map((k) => k.ticker));
  const cols = ["FMP", "MASSIVE", "INDUSTRY", "FUND"];
  let h = `<div class="ladder"><div class="h c-name">name</div>${cols.map((c) => `<div class="h c-dot"><span class="long">${c === "INDUSTRY" ? "IND" : c === "MASSIVE" ? "MASS" : c}</span><span class="short">${c[0]}</span></div>`).join("")}<div class="h c-close"><span class="long">closeness (size ratio; nearer is better)</span><span class="short">ratio</span></div><div class="h c-mv">market value</div><div class="h c-verdict">verdict</div>`;
  let lastVotes = null;
  for (const r of rows) {
    const edge = lastVotes != null && r.n_votes !== lastVotes ? " band-edge" : ""; lastVotes = r.n_votes;
    const inBand = kept.has(r.ticker) ? " band" : "";
    const w = r.closeness == null ? 0 : Math.max(4, 120 * (1 - Math.min(r.closeness, 1.3) / 1.3));
    const verdict = kept.has(r.ticker) ? "KEPT · " + s.standard.kept.find((k) => k.ticker === r.ticker).rank : !r.served ? "not served" : (s.standard.dropped.find((d) => d.ticker === r.ticker)?.why || "").replace(/ —.*$/, "").replace("other industry by the authority", "other industry");
    h += `<div class="k c-name${inBand}${edge}">${r.ticker}</div>${cols.map((c) => `<div class="c-dot${inBand}${edge}"><span class="dot${r.votes[c] ? " on" : ""}"></span></div>`).join("")}<div class="c-close${inBand}${edge}"><span class="bar" style="width:${w}px"></span> <span style="color:var(--dim);font-size:11px">${r.ratio == null ? "—" : r.ratio.toFixed(2) + "×"}</span></div><div class="r c-mv${inBand}${edge}">${money(r.market_cap)}</div><div class="c-verdict${inBand}${edge}" style="font-size:11px;color:var(--dim)">${esc(verdict)}</div>`;
  }
  h += `</div>`;
  return h;
}

/* ---------- the 3D form (LRCX): the company at the centre; height = votes; radius = closeness; inner ring = kept ---------- */
function threeDSVG(T) {
  const s = CS[T], kept = new Set(s.standard.kept.map((k) => k.ticker));
  const W = 1240, H = 640, cx = 560, cy = 420, rx = 380, ry = 118, lift = 92;   // 2 Oct: wider, so the ring labels on the right fit whole            // four levels stacked: votes 1 (bottom) … 4 (top)
  const lvlY = (v) => cy - (v - 1) * lift;
  const rows = s.ladder.filter((r) => r.served && r.closeness != null);
  // angle by the source signature so the same kind of agreement sits on the same side; spread inside the sector by rank
  const sig = (r) => ["FMP", "MASSIVE", "INDUSTRY", "FUND"].map((k) => (r.votes[k] ? 1 : 0)).join("");
  const groups = {}; for (const r of rows) (groups[sig(r)] ||= []).push(r);
  const sigs = Object.keys(groups).sort();
  const pos = {};
  sigs.forEach((g, gi) => { const a0 = (gi / sigs.length) * Math.PI * 2, span = (Math.PI * 2) / sigs.length; groups[g].forEach((r, i) => { pos[r.ticker] = a0 + span * ((i + 0.5) / groups[g].length); }); });
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="SF Mono, Menlo, monospace" font-size="11">`;
  svg += `<rect width="${W}" height="${H}" fill="#0e0e0e"/>`;
  // levels, drawn back to front
  for (const v of [1, 2, 3, 4]) {
    const y = lvlY(v);
    svg += `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="#2a2a2a" stroke-width="1"/>`;
    svg += `<ellipse cx="${cx}" cy="${y}" rx="${rx * 0.32}" ry="${ry * 0.32}" fill="none" stroke="#383838" stroke-width="1" stroke-dasharray="3 3"/>`;
    // 2 Oct (Alan: "more labels on what each ring is"): every ring says what it is where it is drawn
    svg += `<text x="${cx + rx + 10}" y="${y + 4}" fill="#acacac" letter-spacing="2">${v === 1 ? "1 SOURCE NAMES IT" : v + " SOURCES AGREE"}</text>`;
    svg += `<text x="${cx + rx + 10}" y="${y + 17}" fill="#6c6c6c" font-size="9.5" letter-spacing="1">${{ 4: "all four: peer list, related, same industry, shared fund", 3: "three of the four", 2: "two of the four", 1: "one source only" }[v]}</text>`;
    svg += `<text x="${cx - rx - 10}" y="${y + 4}" text-anchor="end" fill="#6c6c6c" font-size="10" letter-spacing="1">${v === 4 ? "TOP RING" : v === 1 ? "BOTTOM RING" : ""}</text>`;
  }
  svg += `<text x="${cx + rx * 0.32 + 40}" y="${lvlY(4) + ry * 0.32 + 14}" fill="#8c8c8c" font-size="10" letter-spacing="2">DASHED RING = THE SIZE BAND</text><text x="${cx + rx * 0.32 + 40}" y="${lvlY(4) + ry * 0.32 + 27}" fill="#6c6c6c" font-size="9.5" letter-spacing="1">÷10 … ×10 of ${T}'s market value (${money(s.market_cap)}); outside it, dropped</text>`;
  svg += `<text x="${cx - rx * 0.32 - 40}" y="${lvlY(4) - ry * 0.32 - 18}" text-anchor="end" fill="#cfcfcf" font-size="10" letter-spacing="2">BRIGHT DOTS = THE ${s.standard.kept.length} KEPT</text><text x="${cx - rx * 0.32 - 40}" y="${lvlY(4) - ry * 0.32 - 5}" text-anchor="end" fill="#6c6c6c" font-size="9.5" letter-spacing="1">the nearest ${s.standard.kept.length} in size of those that pass</text>`;
  // the spine
  svg += `<line x1="${cx}" y1="${lvlY(4) - 60}" x2="${cx}" y2="${cy + 10}" stroke="#383838" stroke-width="1"/>`;
  // candidates: radius by closeness (nearer in size → nearer the centre), capped at the rim
  const keptRank = Object.fromEntries(s.standard.kept.map((k) => [k.ticker, k.rank]));
  const nk = s.standard.kept.length;
  const pts = rows.map((r) => { const v = r.n_votes, y0 = lvlY(v), c = Math.min(r.closeness, 1.3) / 1.3; const k = kept.has(r.ticker); const rad = k ? 0.14 + 0.16 * c : 0.36 + 0.62 * c; const a = k ? -Math.PI / 2 + ((keptRank[r.ticker] - 1) / nk) * Math.PI * 2 : pos[r.ticker]; return { r, a, k, x: cx + Math.cos(a) * rx * rad, y: y0 + Math.sin(a) * ry * rad, front: Math.sin(a) > 0 }; });
  pts.sort((p, q) => (p.y - q.y));
  for (const p of pts) {
    const k = kept.has(p.r.ticker), f = k ? "#cfcfcf" : p.r.n_votes >= 3 ? "#8c8c8c" : "#4a4a4a";
    svg += `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${(p.y + 4).toFixed(1)}" stroke="${f}" stroke-width="1"/>`;
    svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${k ? 5 : 3.5}" fill="${f}"/>`;
    if (k) { const lx = p.x + Math.cos(p.a) * 22, ly = p.y + Math.sin(p.a) * 14 + 4, anchor = Math.cos(p.a) < -0.3 ? "end" : Math.cos(p.a) > 0.3 ? "start" : "middle"; svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" fill="#cfcfcf" font-size="11">${p.r.ticker}</text>`; }
    else if (p.r.n_votes >= 3) svg += `<text x="${(p.x + 7).toFixed(1)}" y="${(p.y - 5).toFixed(1)}" fill="#8c8c8c" font-size="10">${p.r.ticker}</text>`;
  }
  // the company at the top of the spine
  svg += `<circle cx="${cx}" cy="${lvlY(4) - 60}" r="9" fill="#0e0e0e" stroke="#cfcfcf" stroke-width="2"/><text x="${cx + 14}" y="${lvlY(4) - 56}" fill="#cfcfcf" font-size="13" font-weight="600">${T}</text><text x="${cx + 14}" y="${lvlY(4) - 42}" fill="#8c8c8c" font-size="10">${esc(s.industry)} · SIC ${s.sic || "—"} · ${money(s.market_cap)}</text>`;
  svg += `<text x="24" y="22" fill="#acacac" font-size="10" letter-spacing="2">THE FOUR SOURCES</text><text x="24" y="37" fill="#8c8c8c" font-size="10">FMP's peer list · Massive's related companies · the same industry (by the authority, FMP) · a shared industry fund</text>`;
  // legend
  svg += `<g transform="translate(24,${H - 70})" fill="#8c8c8c" font-size="10" letter-spacing="1"><text y="0">UP = MORE SOURCES AGREE (four rings: one source at the bottom, all four at the top)</text><text y="16">IN = NEARER IN MARKET VALUE (the dashed ring is the size band: ÷10 … ×10 of the company)</text><text y="32">AROUND = THE KIND OF AGREEMENT (names the same sources name sit on the same side)</text><text y="48">BRIGHT = THE ${s.standard.kept.length} KEPT (of ${rows.length} served candidates) · MID = 3 SOURCES, NOT KEPT · DARK = THE REST</text></g>`;
  svg += `</svg>`;
  return svg;
}

/* ---------- the four plain lines above the cone and the ladder (2 Oct, Alan: "it's the eliminations of comps. I'd like a little bit of description of that") ---------- */
function fourLines(T) {
  const s = CS[T], c = s.standard.counts, kept = s.standard.kept;
  const tooBig = s.standard.dropped.filter((d) => /too (big|small)/.test(d.why)).length, otherInd = s.standard.dropped.filter((d) => /other industry/.test(d.why)).length, beyond = s.standard.dropped.filter((d) => /beyond the nearest/.test(d.why)).length;
  return `<div class="panel"><div class="words"><ol style="margin:0;padding-left:22px">
<li><b>What goes in.</b> Every name any of four sources offers for ${T}: FMP's peer list, Massive's related companies, every served name in the same industry (${esc(s.industry)}, by the authority), and every served holding of an industry fund that holds ${T}. ${c.candidates} candidates; ${c.served} of them served.</li>
<li><b>What each ring removes.</b> A name rises one ring for each source that names it, so the top ring is where all four agree. Then the cuts: a name outside ${T}'s industry by the authority is dropped whatever its votes (${otherInd} here; a fund vote alone does not make a peer), a name outside the size band — more than ten times bigger or smaller than ${T} — is dropped (${tooBig} here, the dashed ring), and of the ${c.in_band} that pass, only the nearest ${c.kept} in size stay, ranked by votes then closeness (${beyond} beyond the nearest ${c.kept}).</li>
<li><b>What is left.</b> ${kept.length} names, the bright dots: ${kept.map((k) => `${k.ticker} (${k.votes})`).join(", ")} — the number is how many of the four sources name it.</li>
<li><b>Why.</b> A comp set should be names that several independent sources agree are alike, in the same business, of a comparable size — not one provider's list, and not every name in a sector. The rings show where the sources agree and where they do not, and what the cuts take away.</li>
</ol></div></div>`;
}

/* ---------- a worked comp set ---------- */
function setHTML(T) {
  const s = CS[T], st = s.standard;
  const vote = (r, k) => r.sources.includes(k) ? `<span class="tag on">${k === "INDUSTRY" ? "IND" : k}</span>` : `<span class="tag off">${k === "INDUSTRY" ? "IND" : k}</span>`;
  let h = `<h3>${T} · ${esc(s.name)}</h3><div class="panel"><div class="words">`;
  h += `<b>The record says:</b> industry <b>${esc(s.industry)}</b> (FMP), SIC <b>${s.sic || "none on Massive"}</b>${s.sic_description ? " " + esc(s.sic_description.toLowerCase()) : ""}, market value <b>${money(s.market_cap)}</b>, industry funds <b>${s.my_funds.join(", ") || "none"}</b>. FMP names ${s.sources.fmp.length} peers (${s.sources.fmp.join(", ") || "none"}); Massive names ${s.sources.massive.length} (${s.sources.massive.join(", ") || (s.sources.massive_state === "probed: Massive names none" ? "none — Massive has no related list for " + T : "not probed")}); the screener answers <b>${s.screener ? s.screener.total : "—"}</b> listed companies over $2 B in ${esc(s.industry)}, of which ${s.screener ? s.screener.served.length : "—"} are served on the Hub${s.screener && s.screener.unserved.length ? " and " + s.screener.unserved.length + " are not (" + s.screener.unserved.slice(0, 8).join(", ") + (s.screener.unserved.length > 8 ? "…" : "") + ")" : ""}.<br>`;
  h += `<b>Candidates ${st.counts.candidates}</b> → served ${st.counts.served} → same industry by the authority ${st.counts.same_industry_by_authority} → inside the band ${st.band_used}${st.band_widened ? " <b>(widened: fewer than 5 survived ×10)</b>" : ""} ${st.counts.in_band} → <b>kept ${st.counts.kept}</b>. C4's rule as built keeps ${s.counts.kept}; the difference: ${st.differs_from_c4.c4_only.length ? "C4 also keeps " + st.differs_from_c4.c4_only.join(", ") + " (in by a shared fund, not by industry)" : "none on the C4 side"}${st.differs_from_c4.standard_only.length ? "; the standard adds " + st.differs_from_c4.standard_only.join(", ") + " (more votes rank first)" : ""}.</div>`;
  h += `<div class="tw"><table class="t"><tr><th>#</th><th>kept</th><th>votes</th><th>FMP</th><th>Massive</th><th>industry</th><th>fund</th><th class="r">market value</th><th class="r">× the company</th><th>same SIC</th></tr>`;
  for (const k of st.kept) h += `<tr class="kept"><td class="r">${k.rank}</td><td class="k">${k.ticker}</td><td class="r">${k.votes}</td><td>${vote(k, "FMP")}</td><td>${vote(k, "MASSIVE")}</td><td>${vote(k, "INDUSTRY")}</td><td>${vote(k, "FUND")}</td><td class="r">${money(k.market_cap)}</td><td class="r">${k.ratio == null ? "—" : k.ratio.toFixed(2)}</td><td>${k.same_sic ? "yes" : s.sic && k.sic ? "no (" + k.sic + ")" : "—"}</td></tr>`;
  h += `</table></div>`;
  const dropped = st.dropped.filter((d) => d.votes >= 2 || /not served/.test(d.why)).slice(0, 18);
  h += `<div class="tw"><table class="t"><tr><th>dropped (2+ votes, or named but not served)</th><th>votes</th><th>why</th></tr>${dropped.map((d) => `<tr><td class="k">${d.ticker}</td><td class="r">${d.votes}</td><td>${esc(d.why)}</td></tr>`).join("")}${st.dropped.length > dropped.length ? `<tr><td colspan="3" style="color:var(--dim)">… and ${st.dropped.length - dropped.length} more with one vote (the full list is in derived-20261001.json → comp_sets.${T}.standard.dropped)</td></tr>` : ""}</table></div></div>`;
  return h;
}

/* ---------- a worked placement record ---------- */
function recordHTML(T) {
  const r = EX[T], st = (s) => `<span class="${/TABLE/.test(s) ? "st-table" : /JOB/.test(s) ? "st-job" : "st-new"}">${esc(s)}</span>`;
  const sc = r.readings.scout_three_rung, hg = r.readings.hub_geiger;
  return `<div class="tw"><table class="t"><tr><th colspan="3" class="k">${T} · ${esc(r.identity.name)} · as of ${r.as_of}</th></tr>
<tr><td class="k">identity</td><td>${esc(r.identity.exchange)} (${esc(r.identity.primary_exchange_mic || "—")}) · ${esc(r.identity.country)} · ${r.identity.is_adr ? "ADR" : "not an ADR"} · listed in ${r.identity.listing_currency} · statements in ${r.identity.statement_currency || "— (no filer row yet)"}${r.identity.statement_date ? " to " + r.identity.statement_date : ""} · CIK ${r.identity.cik || "—"}</td><td>${st(r.identity._status.name)} / ${st(r.identity._status.statement_currency)}</td></tr>
<tr><td class="k">classification</td><td>SIC <b>${r.classification.sic_code || "none"}</b> ${esc((r.classification.sic_description || "").toLowerCase())} · FMP ${esc(r.classification.fmp_sector)} › <b>${esc(r.classification.fmp_industry)}</b> · GICS-style ${esc(r.classification.gics_industry || "—")}</td><td>${st(r.classification._status.sic_code)} / ${st(r.classification._status.fmp_industry)}</td></tr>
<tr><td class="k">size</td><td><b>${money(r.size.market_value_usd)}</b> (${esc(r.size.source)}, ${r.size.date}) · FMP says ${money(r.size.check_fmp_market_cap)}${r.size.disagreement_pct != null ? " · gap " + pct(r.size.disagreement_pct) : ""}</td><td>${st(r.size._status.market_value_usd)}</td></tr>
<tr><td class="k">membership</td><td>${r.membership.funds.length} funds: ${r.membership.funds.slice(0, 10).map((f) => f.fund + " " + f.weight_pct.toFixed(2) + "%").join(" · ")}${r.membership.funds.length > 10 ? " · …" : ""} (FMP holdings, 26 Sep)</td><td>${st("IN A TABLE TODAY")}</td></tr>
<tr><td class="k">relations</td><td>FMP peers in order: ${r.relations.fmp_peers.join(", ") || "none"}<br>Massive related in order: ${r.relations.massive_related ? r.relations.massive_related.join(", ") || "none (Massive has no list)" : "not probed"}</td><td>${st(r.relations._status.fmp_peers)} / ${st(r.relations._status.massive_related)}</td></tr>
<tr><td class="k">readings</td><td>three-rung scout at the ${sc ? sc.last_session : "—"} close: <span class="${sgn(sc && sc.composite)}">${sc ? num(sc.composite, 3) : "—"}</span> (trend ${sc ? num(sc.trend, 2) : "—"}, momentum ${sc ? num(sc.momentum, 2) : "—"}) · Hub Geiger now (seven rungs, intraday): <span class="${sgn(hg && hg.composite)}">${hg ? num(hg.composite, 3) : "—"}</span> · seven-rung close: <i>after P8</i></td><td>${st("IN A TABLE TODAY")} / ${st("P8")}</td></tr>
<tr><td class="k">comps measures</td><td>16 in USD: ${r.comps_measures_usd.keys.join(", ")} · ${esc(r.comps_measures_usd.fx)}</td><td>${st("ONE JOB AWAY")}</td></tr>
<tr><td class="k">board tag · tree home</td><td>board says <b>${r.board_tag || "—"}</b> · tree home ${r.tree ? r.tree.home.replace(/^(COHORT|PROPOSED|FUNDSET|NONE)_?/, "") + " (" + r.tree.home_kind + ", " + r.tree.home_rule + ")" : "—"} · also in ${r.tree && r.tree.also_in.length ? r.tree.also_in.map((a) => a.replace(/^(COHORT|PROPOSED|FUNDSET)_/, "")).join(", ") : "—"} · filters ${r.tree && r.tree.filters.length ? r.tree.filters.join(", ") : "—"}</td><td>${st("IN A TABLE TODAY")}</td></tr>
</table></div>`;
}

/* ---------- the page ---------- */
const shot = (f, cap, clip = true, phone = false) => existsSync(join(HERE, "shots", f)) ? `<div class="shot"><div class="clip${phone ? " phone" : ""}"${clip ? "" : ' style="max-height:none"'}><img src="shots/${f}" alt="${esc(cap)}"></div><small>${esc(cap)} — shots/${f}</small></div>` : `<div class="shot"><small>(shot not taken yet) ${esc(cap)}</small></div>`;
const m = DR.cohorts_measured || [], ig = DR.industry_groups || [], mv = DR.moves || [];
const adoptedM = m.filter((x) => x.kind === "adopted"), proposedM = m.filter((x) => x.kind === "proposed"), fundM = m.filter((x) => x.kind === "fundset"), noneM = m.filter((x) => x.kind === "none");
const cohortRow = (x) => `<tr><td class="k">${esc(x.label)}</td><td>${x.kind}</td><td>${esc((x.parent || "").replace(/^(SEC_|US_)/, ""))}</td><td class="r">${x.n_members}</td><td class="r">${x.cohesion == null ? "—" : num(x.cohesion)}</td><td class="r">${x.null95 == null ? "—" : num(x.null95)}</td><td>${x.verdict}</td><td class="r ${sgn(x.scout_today && x.scout_today.mean)}">${x.scout_today ? num(x.scout_today.mean) : "—"}</td><td class="r">${x.scout_today ? `<span class="up">▲${x.scout_today.up}</span> <span class="dn">▼${x.scout_today.down}</span>` : "—"}</td><td class="r">${x.scout_today ? Math.round(x.scout_today.same_sign_share * 100) + "%" : "—"}</td></tr>`;
const discl = A.industry_disagreements;
const pick = (ts) => ts.map((t) => discl.find((r) => r.ticker === t)).filter(Boolean);
const twenty = pick(["LRCX", "KLAC", "QCOM", "AMAT", "XOM", "COP", "CEG", "NEE", "MSFT", "CRM", "PANW", "MSTR", "COIN", "AAPL", "AMZN", "HON", "GE", "FSLR", "CLF", "UBER"]);
const nee = A.industry_groups["Regulated Electric"] || [];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Universe Standard</title><meta name="description" content="The Scintilla universe standard: one placement record per company, from which the tree, the cohorts and the comp sets are derived. Proposed 1 Oct 2026."><style>${CSS}</style></head><body><div class="wrap">
<div class="top"><div data-scnav-slot></div><div class="brand"><b>SCINTILLA</b> · THE UNIVERSE STANDARD <span class="proposed">PROPOSED</span></div><div class="stamp">U1 · 1 Oct 2026 · branch hub/universe-standard-20261001 · a design, not a change: nothing deployed, no table touched</div></div>

<h1>One placement record per company. The tree, the cohorts and the comp sets are read from it.</h1>
<div class="panel"><div class="words lead">Alan, 1 Oct: <q>neither the top or the bottom rules right now. Nothing rules… Everything to match: comp set to tree to cohort… standardize once and for all everything.</q><br><br>
The question the standard answers is <b>which companies belong together, by which rule, from which source</b>. It is answered once, below, in numbered rules, and three consumers read the answer instead of guessing: the <b>market tree</b> (its structure and its bottom levels), the <b>cohorts</b> (proposed by the rule, adopted by Alan) and the <b>comp sets</b> (one per company). Today each guesses on its own: the tree's upper levels come from fund holdings (FMP, 26 Sep, 51 industry funds among 138), the cohort level from the 28 Sep co-movement proposal (rules R1–R8), and the comps from a cohort tag or, since C4 this morning, from a four-source rule that treats a shared fund as "same industry". Every number on this page is read from a dated source named beside it; every rule is stated so it can be disagreed with. The machine copy is <code>universe-standard.v1.json</code>, marked PROPOSED.</div></div>

<div class="toc panel"><a href="#s1">1 · The placement record</a><a href="#s2">2 · Authorities, chosen and named</a><a href="#s3">3 · The tree, derived</a><a href="#s4">4 · Cohorts, derived then adopted (dry run)</a><a href="#s5">5 · Comp sets, derived (six worked)</a><a href="#s6">6 · The agreement view, flat and 3D</a><a href="#s7">7 · The screener on top</a><a href="#s8">8 · What this does to the Hub</a><a href="#s9">9 · The implementation queue</a><a href="#s10">10 · Decisions for Alan</a><a href="#s11">11 · Proof, doubts, what was not done</a></div>

<h2 id="s1">1 · The placement record <small>one per instrument, refreshed nightly after the close</small></h2>
<div class="panel"><div class="words">
<b>1.1</b> Every instrument the Hub serves or the tree lists (the 590 today: ${COV.served_names} companies and ${COV.served_funds} funds) gets one record, keyed by ticker, stamped <code>as_of</code> with the session it describes. The record is rebuilt every night after the close by one job and never edited by hand. A consumer that needs a fact about a company reads the record; nothing else is a source.<br>
<b>1.2</b> The record has eight parts. For each field the table says who provides it, and whether it is <span class="st-table">IN A TABLE TODAY</span>, <span class="st-job">ONE JOB AWAY</span> (a provider route already probed, no table yet) or <span class="st-new">NEW</span>.</div>
<div class="tw"><table class="t"><tr><th>part</th><th>fields</th><th>provider · route</th><th>where it is today</th><th>status</th></tr>
<tr><td class="k">identity</td><td>name, exchange (and the MIC), country, ADR flag, listing currency, statement currency and statement date, CIK</td><td>FMP /stable/profile; Massive /v3/reference/tickers (MIC, locale, CIK); FMP income statement (statement currency)</td><td>public.company_profile (${D.sources.profile_count} rows); public.filer_currency (${D.sources.filer_rows} rows, the non-USD filers plus 25 USD)</td><td><span class="st-table">IN A TABLE</span>; statement currency for the other ${COV.served_names - COV.with_filer_currency} names <span class="st-job">ONE JOB AWAY</span> (the fx-filer job, widened)</td></tr>
<tr><td class="k">classification</td><td><b>SIC code and description</b> (the SEC's code, served by Massive); FMP sector and industry</td><td>Massive /v3/reference/tickers → sic_code, sic_description; FMP /stable/profile → sector, industry</td><td>FMP industry on company_profile (${COV.profile_industries} industries across the served names). SIC: probed for ${A.probed} names on 1 Oct; C4's migration <code>20261001_peer_sources.sql</code> adds <code>ticker_industry</code> for it</td><td>FMP <span class="st-table">IN A TABLE</span> · SIC <span class="st-job">ONE JOB AWAY</span></td></tr>
<tr><td class="k">size</td><td>market value in USD, its source and date; the other provider's figure as a check</td><td>Massive reference market_cap (all share classes); FMP profile marketCap</td><td>FMP's on company_profile; Massive's probed for ${A.probed}</td><td>FMP <span class="st-table">IN A TABLE</span> · Massive <span class="st-job">ONE JOB AWAY</span> (same job as the SIC)</td></tr>
<tr><td class="k">membership</td><td>every fund on the tree holding it, with weight, source and date</td><td>FMP holdings (etf-holdings), the 138 tree funds</td><td>tree.json held_by (${Object.keys(D.tree).length ? "476 names" : ""}, 26 Sep); the market-map build reads it</td><td><span class="st-table">IN A FILE</span>, refreshed by the map build; <span class="st-new">NEW</span> as a table (fund_membership)</td></tr>
<tr><td class="k">relations</td><td>FMP peers in FMP's order; Massive related companies in Massive's order</td><td>FMP /stable/stock-peers; Massive /v1/related-companies</td><td>public.fmp_peers (${D.sources.fmp_peers_rows} rows, ${D.sources.fmp_peers_companies} companies, loaded 1 Oct); Massive related probed for the six worked names</td><td>FMP <span class="st-table">IN A TABLE</span> · Massive <span class="st-job">ONE JOB AWAY</span> (C4's peer_sources job)</td></tr>
<tr><td class="k">readings</td><td>the off-Hub Geiger at the close (seven rungs after P8; three today), trend and momentum; the Hub Geiger where the Hub serves the name</td><td>chart API /v1/scout-geiger (massive_stocks.scout_geiger_daily, nightly); /geiger (live, 590)</td><td>scout: ${COV.with_scout} of the 590 (as of ${D.sources.scout.as_of}); Hub: ${COV.with_hub_geiger}</td><td>three-rung <span class="st-table">IN A TABLE</span> · seven-rung <span class="st-job">P8</span> (built, not applied: table 0025, R2 v2, the route prefers it)</td></tr>
<tr><td class="k">comps measures</td><td>the 16 measures in USD at the statement-date rate: P/E trailing and forward, EV/EBITDA, EV/sales, P/S, PEG, revenue growth TTM and next FY, EPS growth next FY, gross, operating and FCF margins, net debt/EBITDA, capex/revenue, capex growth, new revenue per capex dollar</td><td>FMP statements and estimates, through C3's reader (deliverables/20261001/comps-template/cohort.mjs); fx from public.fx_rates (${5347} rows) at filer_currency.statement_date</td><td>computed on demand by the COMPS tab today</td><td><span class="st-job">ONE JOB AWAY</span>: the nightly job stores what the tab computes, so the screener and the tree can read it without a browser</td></tr>
<tr><td class="k">provenance</td><td>per part: source route, fetched_at; record-level as_of; a hash of the inputs</td><td>—</td><td>scattered (updated_ts on the profile, fetched_at on the peers, as_of on the holdings)</td><td><span class="st-new">NEW</span></td></tr>
</table></div>
<div class="words"><b>1.3 What is already there, in numbers (the 590, 1 Oct):</b></div>
<div class="tiles" style="padding:0 16px 12px"><div class="tile"><b>${COV.with_profile}</b><span>profiles of 590</span></div><div class="tile"><b>${COV.with_fmp_industry}</b><span>FMP industry of ${COV.served_names}</span></div><div class="tile"><b>${COV.with_market_cap}</b><span>market value</span></div><div class="tile"><b>${COV.with_fmp_peers}</b><span>FMP peer lists</span></div><div class="tile"><b>${COV.with_sic_probed}</b><span>SIC probed today</span></div><div class="tile"><b>${COV.with_fund_membership}</b><span>in ≥1 tree fund</span></div><div class="tile"><b>${COV.with_scout}</b><span>scout reading</span></div><div class="tile"><b>${COV.with_hub_geiger}</b><span>Hub Geiger</span></div><div class="tile"><b>${COV.with_filer_currency}</b><span>filer currency rows</span></div></div>
<div class="words"><b>1.4 Six worked records</b> (the fields as they would be stored tonight; the six names Alan asked for). Grey status words: <span class="st-table">in a table</span>, <span class="st-job">one job away</span>, <span class="st-new">new</span>.</div>
${SIX.map(recordHTML).join("")}
</div>

<h2 id="s2">2 · Authorities, chosen and named <small>"industry classification provided by who? so it's not a judgment"</small></h2>
<div class="panel"><div class="words">
<b>2.1 The rule for authorities.</b> Where two providers give the same fact, one is the <b>authority</b> (the consumers test against it) and the other is the <b>tag</b> (shown beside it, used to break ties, and flagged when it disagrees). The choice is written here, once, with the reason; it is not re-decided per page.</div>
<div class="tw"><table class="t"><tr><th>field</th><th>authority</th><th>tag / check</th><th>why</th></tr>
<tr><td class="k">industry</td><td><b>FMP industry</b> (proposed; see decision 1)</td><td><b>SIC code + description</b> (Massive, from the SEC), printed on every name on the tree; same SIC ranks a peer closer; SIC is the fallback where FMP has no industry</td><td>Both are providers, neither is our judgment. FMP's label is complete on the 590 and finer where it matters for comps (Regulated Electric vs Independent Power Producers; Software-Infrastructure vs Software-Application; Semiconductors vs Solar). The SIC is the regulator's code and is objective, but it is coarse (4911 ELECTRIC SERVICES holds NEE, SO, AEP, D <i>and</i> CEG, VST, OKLO; 7372 holds MSFT, ORCL, PLTR, CRWD <i>and</i> CRM, NOW, SNOW, DDOG; 3674 holds NVDA <i>and</i> FSLR, ENPH) and it is missing for foreign filers (${A.sic_missing.join(", ")} of the ${A.probed} probed have none). FMP's own blind spot runs the other way: it files LRCX, KLAC and AMAT as "Semiconductors" with NVDA and MU, where the SIC separates the equipment makers (3559, 3827) from the chip makers (3674). Hence: FMP rules, SIC breaks ties.</td></tr>
<tr><td class="k">market value</td><td><b>Massive reference market_cap</b> (all share classes, refreshed daily)</td><td>FMP profile marketCap; a gap over 5% is flagged on the record</td><td>They agree within 1% for ${A.mcap_within_1pct} of ${A.mcap_compared} compared. Where they do not, Massive counts every share class and FMP one: MSTR ${pct(A.mcap_disagreements.find((x) => x.ticker === "MSTR")?.mcap_gap_pct)}, SMR ${pct(A.mcap_disagreements.find((x) => x.ticker === "SMR")?.mcap_gap_pct)}, RKLB ${pct(A.mcap_disagreements.find((x) => x.ticker === "RKLB")?.mcap_gap_pct)}. Alan: <q>market cap, for me, is a very important measurement of the comp set</q>, so the figure that counts the whole company rules. Until the Massive job runs, FMP's stands in and the record says so.</td></tr>
<tr><td class="k">holdings</td><td><b>FMP etf-holdings</b></td><td>— (one provider; Massive has no holdings route on this plan)</td><td>The only source on hand; dated 26 Sep; the job refreshes it with the record.</td></tr>
<tr><td class="k">peers</td><td><b>neither</b>: both are votes</td><td>FMP's order and Massive's order are kept as given</td><td>Alan: <q>FMP's are not great, but we should use them as a starting point. And then we should check what Massive gives us.</q> A peer list is an opinion; the standard counts opinions (section 5) rather than crowning one.</td></tr>
<tr><td class="k">readings</td><td><b>the off-Hub Geiger at the close</b> (seven rungs, P8) for the tree, the cohorts and the comps</td><td>the Hub Geiger, live, on the 590</td><td>Alan: <q>I would do it at market close every day, the seven timeframe version… I can live with the tree showing information to daily close.</q> Today's three-rung scout against the Hub's live reading: median gap ${D.geiger_vs_scout.median_gap}, 90th percentile ${D.geiger_vs_scout.p90_gap}, same sign for ${D.geiger_vs_scout.sign_agree} of ${D.geiger_vs_scout.names} — that gap is both the missing rungs and the clock, which is why P8 (seven rungs at the close) is the dependency of section 4 and not of this design.</td></tr>
</table></div>
<div class="words"><b>2.2 Real disagreements, industry: twenty served names where FMP's industry and the SIC code tell different stories</b> (from the ${A.probed} names probed on 1 Oct; the full list of ${discl.length} many-to-many cases is in derived-20261001.json → authorities).</div>
<div class="tw"><table class="t"><tr><th>name</th><th>FMP industry</th><th>SIC</th><th>SIC description</th><th>what it means for "same industry"</th></tr>
${twenty.map((r) => `<tr><td class="k">${r.ticker}</td><td>${esc(r.fmp_industry)}</td><td>${r.sic}</td><td>${esc(r.sic_description)}</td><td style="color:var(--dim)">${esc(r.note)}</td></tr>`).join("")}
</table></div>
<div class="words"><b>2.3 Real disagreements, market value</b> (gap of 2% or more, ${A.mcap_disagreements.length} of ${A.mcap_compared}):</div>
<div class="tw"><table class="t"><tr><th>name</th><th class="r">FMP</th><th class="r">Massive</th><th class="r">gap</th></tr>${A.mcap_disagreements.map((r) => `<tr><td class="k">${r.ticker}</td><td class="r">${money(r.fmp_mcap)}</td><td class="r">${money(r.massive_mcap)}</td><td class="r">${pct(r.mcap_gap_pct)}</td></tr>`).join("")}</table></div>
</div>

<h2 id="s3">3 · The tree, derived <small>L0 market → L1 asset class / region → L2 sector → L3 industry fund(s) → L4 cohort → L5 names</small></h2>
<div class="panel"><div class="words">
<b>3.1 The levels and where each comes from.</b> The tree is not typed; it is read from the records. What the SIC code adds at each level is said in the last column (Alan: <q>the tree should show SEC SIC codes</q>).</div>
<div class="tw"><table class="t"><tr><th>level</th><th>node</th><th>derived from</th><th>today</th><th>what the SIC adds</th></tr>
<tr><td class="k">L0</td><td>The market</td><td>fixed</td><td>same</td><td>—</td></tr>
<tr><td class="k">L1</td><td>asset class / region: US stocks, world, crypto, macro, fixed income…</td><td>identity.country and the fund's role (broad, region, macro); the r3 headings</td><td>same (the r3 heading list, 23 headings)</td><td>—</td></tr>
<tr><td class="k">L2</td><td>sector: the 11 sector headings with their sector fund (XLK, XLF, XLE…)</td><td>classification.fmp_sector; the sector fund's holdings confirm it</td><td>same</td><td>the SIC division (the first two digits: 36 electronic equipment, 73 business services, 60 banks) printed on the heading as a check</td></tr>
<tr><td class="k">L3</td><td>industry fund(s): SMH, IGV, XOP, KRE, ITA… (a fund that holds ≤ 60 served names)</td><td>membership.funds, broad and style funds excluded (C4's list)</td><td>same funds (${D.tree.levels.funds} funds on the tree); the holdings blend bar</td><td>the SIC codes its holdings carry, counted (SMH: 3674 × 14, 3559, 3827…) so a fund that mixes industries says so</td></tr>
<tr><td class="k">L4</td><td>cohort: ADOPTED, PROPOSED, FUND SET or NONE YET</td><td>section 4's rule: shared industry ∩ shared funds ∩ co-movement; adoption by Alan</td><td>${D.tree.cohorts} adopted + ${D.tree.proposed_cohorts} proposed + ${D.tree.fund_sets} fund sets + ${D.tree.pseudo_cohorts} none-yet lines</td><td>the cohort's majority SIC and the odd ones out, on the card ("8 of 10 are 3674; LRCX is 3559, KLAC 3827")</td></tr>
<tr><td class="k">L5</td><td>names</td><td>the record</td><td>${D.tree.names} names</td><td>"SIC 3559 · special industry machinery" under the name, with FMP's industry beside it; a disagreement flag when they do not match (section 2.2)</td></tr>
</table></div>
<div class="words">
<b>3.2 The home-path rule.</b> Every name sits on the tree exactly once (its <b>home</b>) and is linked to every other place it belongs (<b>also in</b>). Proposed home rule, in order: (1) the ADOPTED cohort that claims it; if several, the one whose industry (by the authority) matches the name's — then the smallest; (2) else the PROPOSED cohort that claims it; (3) else the FUND SET of the industry fund that holds it at the highest weight; (4) else the sector heading's NONE YET line. Theme beats size (the coordinator's 30 Sep call stands: MEGACAP is "also in", never home, for a name an industry cohort claims). The change from today: step (1) adds the industry test, so NVDA's home is decided by its SIC/FMP industry (Semiconductors → AI ACCELERATORS under SMH) and not only by cohort size.<br>
<b>3.3 "Also in" edges.</b> Three kinds, each drawn differently in the 3D area view: another cohort (adopted or proposed), a fund set, and — new — a <b>comp-set edge</b>: the name is in another company's kept set (section 5). That is Alan's <q>it makes the tree 3D and it shows you the comparable companies</q>: at the name level the comp-set edges are the 3D.<br>
<b>3.4 What stays, what changes.</b> Stays: the r3 heading list, the 138 funds and their holdings, the four cohort kinds and their counts strip, the canvas / 3D-area / outline views (T3), the finder. Changes: (a) the cohort level is rebuilt from the record by the rule, nightly, instead of from the 28 Sep member lists; (b) every name and fund prints its SIC; (c) the home rule gains the industry test; (d) comp-set edges join the also-in ring; (e) the bars read the seven-rung close Geiger from the record (today: the live /geiger for 590 and the three-rung scout for the rest).</div></div>

<h2 id="s4">4 · Cohorts, derived then adopted <small>the rule, the names, the states, and a dry run on the 590 — PROVISIONAL until P8 lands</small></h2>
<div class="panel"><div class="words">
<b>4.1 The proposal rule.</b> A candidate cohort is a set of served names that (a) share an industry by the authority (same FMP industry, or the same SIC code where FMP's label spans several), (b) share at least one industry fund (half or more of the set held by it), and (c) move together: the mean pair correlation of their daily close-Geiger readings over the last N sessions is above the 95th point of 200 random draws of the same size from the 590 (the 28 Sep rule R2, now on the Geiger series rather than on prices). A set that fails (c) is an industry, not a cohort, and stays a filter. N is decision 4 (proposed: 60 sessions, re-measured nightly; 750 for the adoption check, as the proposal used).<br>
<b>4.2 The naming rule.</b> A cohort's id is upper snake case; its label is the industry fund's theme in plain words where one fund parents it (SMH → "AI ACCELERATORS" stays, since Alan named it), else the SIC description in plain words ("REGULATED ELECTRIC", "MONEY CENTER BANKS"), at most three words, never a vendor's label verbatim. A split keeps the parent's first word ("AI POWER · GENERATORS", "AI POWER · REGULATED").<br>
<b>4.3 The states.</b> <b>ADOPTED</b> (in public.cohort_registry, Alan's call); <b>PROPOSED</b> (passes the rule tonight, not adopted); <b>FUND SET</b> (an industry fund's served holdings, automatic, R8); <b>NONE YET</b> (a served name no set claims). A PROPOSED cohort that passes the rule on 20 consecutive nights is put to Alan with its numbers; one that fails on 20 consecutive nights is withdrawn; nothing is adopted or dissolved by itself (R5).<br>
<b>4.4 The step-2 move list</b> is produced the same way every night: a name is listed as a MOVE when another cohort's mean tracked it better than its own (leave-one-out) by 0.10 or more. Alan decides.<br>
<b>4.5 The dry run, tonight.</b> P8's seven-rung close series does not exist yet (table 0025 is written, not applied), and the three-rung scout has only a few nights in its table. So this dry run measures co-movement on <b>60 sessions of daily close returns</b> (${DR.first_session} → ${DR.last_session}, from the chart API, ${DR.names_with_returns} names with a full series) as the stand-in for the Geiger series, and reads <b>today's three-rung scout</b> (as of the ${DR.scout_as_of} close) for the one-day agreement: the cohort's mean, its ▲/▼ count and the share of members on the mean's side. Both are flagged provisional: the real rule runs on the seven-rung close readings once P8 is live and has accumulated N nights.</div>
<div class="tiles" style="padding:0 16px 12px"><div class="tile"><b>${DR.counts.cohorts}</b><span>cohort nodes measured</span></div><div class="tile"><b>${DR.counts.cohesive}</b><span>cohesive</span></div><div class="tile"><b>${DR.counts.not_above_random}</b><span>not above random</span></div><div class="tile"><b>${DR.counts.too_few}</b><span>too few served (&lt;2)</span></div><div class="tile"><b>${DR.counts.industry_groups}</b><span>industry groups ≥4 names</span></div><div class="tile"><b>${DR.counts.industry_cohesive}</b><span>of them cohesive</span></div><div class="tile"><b>${DR.counts.moves}</b><span>moves flagged (≥0.10)</span></div></div>
<div class="words"><b>4.5a The adopted cohorts, measured</b> (60-session cohesion against the random line; the scout's one-day agreement on the right).</div>
<div class="tw"><table class="t"><tr><th>cohort</th><th>kind</th><th>parent</th><th class="r">served</th><th class="r">cohesion</th><th class="r">random 95th</th><th>verdict</th><th class="r">scout mean</th><th class="r">▲ ▼</th><th class="r">on the mean's side</th></tr>${adoptedM.map(cohortRow).join("")}</table></div>
<div class="words"><b>4.5b The proposed cohorts and the fund sets with enough served names</b> (the rest are "too few": ${fundM.filter((x) => x.verdict === "too few").length} fund sets have fewer than two served names with a full series).</div>
<div class="tw"><table class="t"><tr><th>cohort</th><th>kind</th><th>parent</th><th class="r">served</th><th class="r">cohesion</th><th class="r">random 95th</th><th>verdict</th><th class="r">scout mean</th><th class="r">▲ ▼</th><th class="r">on the mean's side</th></tr>${[...proposedM, ...fundM.filter((x) => x.verdict !== "too few"), ...noneM.filter((x) => x.n_members >= 4)].map(cohortRow).join("")}</table></div>
<div class="words"><b>4.5c What the rule itself proposes</b> — every FMP industry with four or more served names, measured the same way, with the industry funds that hold half of it and the adopted cohort it overlaps. This is the "shared industry ∩ shared funds" half of the rule run on today's record; the co-movement half is the stand-in. Read it as: an industry group that is cohesive and overlaps no adopted cohort is a PROPOSED cohort candidate (${ig.filter((g) => g.verdict === "COHESIVE" && !g.adopted_overlap.length).length} of them tonight); one that overlaps an adopted cohort by most of its members confirms that cohort's membership and lists the missing names.</div>
<div class="tw"><table class="t"><tr><th>industry (FMP)</th><th>SIC codes seen</th><th class="r">n</th><th class="r">cohesion</th><th class="r">random 95th</th><th>verdict</th><th>industry funds (≥ half held)</th><th>overlaps adopted</th><th class="r">scout mean</th><th class="r">▲ ▼</th></tr>${ig.map((g) => `<tr><td class="k">${esc(g.industry)}</td><td>${g.sic_codes.join(", ") || "—"}</td><td class="r">${g.n}</td><td class="r">${num(g.cohesion)}</td><td class="r">${num(g.null95)}</td><td>${g.verdict}</td><td>${g.shared_funds.join(", ") || "none"}</td><td>${g.adopted_overlap.map((a) => a.id.replace("COHORT_", "") + " (" + a.shared + ")").join(", ") || "<span style='color:var(--dim)'>none → candidate</span>"}</td><td class="r ${sgn(g.scout_today && g.scout_today.mean)}">${g.scout_today ? num(g.scout_today.mean) : "—"}</td><td class="r">${g.scout_today ? `<span class="up">▲${g.scout_today.up}</span> <span class="dn">▼${g.scout_today.down}</span>` : "—"}</td></tr>`).join("")}</table></div>
<div class="words"><b>4.5d The step-2 move list, dry run</b> (leave-one-out on the adopted cohorts, 60 sessions; the top ${Math.min(25, mv.length)} of ${mv.length}; the board's tag beside each). Nothing moves; Alan decides.</div>
<div class="tw"><table class="t"><tr><th>name</th><th>home cohort</th><th class="r">tracks home</th><th>tracks better</th><th class="r">at</th><th class="r">gain</th><th>board says</th></tr>${mv.slice(0, 25).map((x) => `<tr><td class="k">${x.ticker}</td><td>${esc(x.home)}</td><td class="r">${num(x.home_corr)}</td><td>${esc(x.better)}</td><td class="r">${num(x.better_corr)}</td><td class="r">${num(x.gain)}</td><td>${x.board || "—"}</td></tr>`).join("")}</table></div>
<div class="words" style="color:var(--dim)">Provisional, stated plainly: 60 sessions of returns is a short window and a different series from the Geiger; a cohort of three has a random line of ${num(m.find((x) => x.n_members === 3 && x.null95)?.null95)} and clears it easily; the proposal's 750-session numbers (cohesion in the registry rows) remain the adoption record until P8 has run for N nights.</div>
</div>

<h2 id="s5">5 · Comp sets, derived <small>candidates → the authority's industry → the size band → votes, then closeness → the nearest N → the operator on top → outliers later</small></h2>
<div class="panel"><div class="words">
<b>5.1 The rule, stated once.</b><br>
<b>candidates</b> = FMP peers ∪ Massive related ∪ same industry by the authority (the screener; today the served names of the same FMP industry, tomorrow FMP's company-screener so unserved names appear too) ∪ the served holdings of the industry funds that hold the company. Each candidate carries the sources that named it: its <b>votes</b>, 1 to 4.<br>
<b>keep</b> = same industry by the authority (FMP industry equal, or the same SIC code) <b>and</b> market value inside the band. <b>A shared fund is a vote, never an industry match</b> — this is the one place the standard departs from C4's rule as built (which let XLF hand JPM the peers BRK-B, V and MA). <b>Band default ×10</b> (own ÷ 10 ≤ peer ≤ own × 10), visible; ×3, ×30 and "any" one click away. <b>Thin-set rule:</b> if fewer than 5 survive at ×10 the band widens one step and the tab says so — the giants (MSFT at $3.8 T) and the thin industries (JPM: four served diversified banks) are where this fires.<br>
<b>rank</b> = votes, most first; then closeness, |log10(peer ÷ own market value)|, nearest first; then ticker. <b>N default 10</b>, 6 to 15 on a control.<br>
<b>the operator on top</b>: public.comps_decisions keeps a name switched off or back on, by company; a switched-off peer stays in the list, greyed, out of the medians.<br>
<b>outliers later</b>: per measure, a peer beyond 1.5 × IQR from the peers' middle half is <b>flagged</b> (the July spec §1), never removed by the rule. Alan: <q>let's not get narrowed down on the outliers just yet.</q><br>
<b>5.2 The six, worked.</b> Each table is the standard's selection on today's record; the counts line shows every step, and the difference from C4's set as built is said in words. Massive's related list was probed for all six on 1 Oct (TSM: Massive has none). The screener line is FMP's company-screener answer, probed live for the four industries.</div>
${SIX.map(setHTML).join("")}
<div class="words"><b>5.3 What the six say about the rule.</b> (1) Where the industry is deep on the Hub (semiconductors: LRCX, TSM, MU), the four sources agree on the core and the rule returns ten peers that any analyst would recognise; the only real argument is the equipment makers versus the chip makers, which the SIC settles (LRCX's same-SIC peer is AMAT — the record says so). (2) Where the company is a giant (MSFT), ×10 leaves only ORCL and PLTR in the industry; the band widens to ×30 and the set becomes the large software names — honest, and visibly so. C4's set for MSFT (GOOGL, AAPL, AMZN, NVDA, META, TSLA…) was the XLK fund speaking, not the industry. (3) Where the industry is thin on the Hub (JPM: four diversified banks; XOM: two integrated majors), the rule returns ${CS.JPM.standard.counts.kept} and ${CS.XOM.standard.counts.kept} and says so; the screener names the rest (${CS.JPM.screener.unserved.slice(0, 5).join(", ")}; ${CS.XOM.screener.unserved.slice(0, 4).join(", ")}) and they have no figures until admitted — decision 2 in C4, repeated here. The thin-set rule does not reach into a neighbouring industry by itself; XOM gets COP only because COP's SIC (2911) is XOM's.</div>
</div>

<h2 id="s6">6 · The agreement view <small>"a 3D, up to down, where we visualize where they agree and where they don't, and what we would do about it"</small></h2>
<div class="panel"><div class="words">
<b>6.1 Flat: the agreement ladder.</b> Rows are candidates sorted by votes (four at the top), then by closeness; the four columns are the sources, a filled dot is a vote; the closeness bar is longer the nearer the candidate is in market value; the shaded band is the kept set, and the verdict column says what happened to each. The eye reads it top-down: everything the four agree on, then the three, then where it thins out. For LRCX: ${CS.LRCX.agreement.four.join(", ")} carry four votes; ${CS.LRCX.agreement.three.join(", ")} three. What we would do about it: a four-vote name outside the band (${CS.LRCX.ladder.filter((r) => r.n_votes === 4 && !CS.LRCX.standard.kept.some((k) => k.ticker === r.ticker)).map((r) => r.ticker).join(", ") || "none for LRCX"}) is the first thing to look at when the band is widened; a one-vote name inside the band is the first to switch off.</div>
<div class="tw">${ladderHTML("LRCX")}</div>
<div class="words"><b>6.2 The 3D form.</b> The company sits on the spine; four rings stack up (one vote at the bottom, four at the top); a candidate is placed <b>up</b> by its votes, <b>in</b> by its closeness in market value, and <b>around</b> by the kind of agreement (each source signature keeps its own side, so "FMP and Massive agree" names sit together, "industry and fund only" names on another side). The kept set is the bright inner ring. In the tree's 3D area view this is what a name lifts into when clicked: its comp cloud, and from any peer, that peer's own. Static mock below, built from the same LRCX data; standalone copies for the two mocks: <code>agreement-ladder.html</code>, <code>agreement-3d.html</code>.</div>
<div class="svgwrap">${threeDSVG("LRCX")}</div>
</div>

<h2 id="s7">7 · The screener on top <small>the same record, asked a question</small></h2>
<div class="panel"><div class="words">
<b>7.1</b> A screen is a filter over the placement records, nothing more: industry (by the authority, or by SIC), size band, country, ADR yes/no, fund membership, a comps measure range (P/E under 20, FCF margin over 15%), a Geiger range (close reading above +0.5), a cohort state. Because the record holds the 16 measures in USD and the close Geiger, no screen needs a provider call or a browser computation; it is a SELECT over one table.<br>
<b>7.2 For the Hub's SCREENER tab:</b> the tab lists the filters above as controls, shows the matching names with their SIC, industry, size, Geiger and the chosen measures, and can hand the result to the comps tab as a candidate list ("use as comp set") or to the tree as a highlight. <b>For comps:</b> the fourth source (same industry) <i>is</i> a screen — industry = the company's, size inside the band — so the comps rule and the screener share the one function, and "what the screener adds" (unserved names) is visible in the comps candidates as "named, not served".<br>
<b>7.3 Unserved names.</b> A screen over FMP's company-screener (live, keyed, on Fly) returns names the Hub does not serve; the standard records them as placement records too (identity, classification, size only) with <code>served:false</code>, so the tree can show "also in this industry: 10 more, not served" and admission has a list to work from.</div></div>

<h2 id="s8">8 · What this does to the Hub <small>a candid list, for discussion — not a change</small></h2>
<div class="panel"><div class="words">Alan: <q>if the off-hub Geiger at daily close is good enough, I think a lot can go there… Hub could be streamlined a little bit.</q> The test applied to each surface: does it need a reading newer than the last close? If not, it can read the record on the tree / analytics layer.</div>
<div class="tw"><table class="t"><tr><th>surface</th><th>needs</th><th>where it could live</th><th>duplicated today?</th></tr>
<tr><td class="k">Cohort boards (DASHBOARD › COHORT tabs, the 17 board tags)</td><td>daily close Geiger per name; the cohort's mean</td><td>the tree / analytics layer, reading the record; the Hub keeps the board for served names only, with the live Geiger</td><td>yes: the board's cohort tag (tickers.cohort) and the registry are two lists; the tree's L4 would be the one</td></tr>
<tr><td class="k">Universe-wide Geiger (MAP, the market map, the tree's bars)</td><td>daily close, all 5,600 names</td><td>already off the Hub (/v1/scout-geiger); the tree reads it</td><td>partly: the market map and the tree each read the route and blend it with /geiger</td></tr>
<tr><td class="k">COMPS tab</td><td>statements, the peer rule, the close price for the upside; the live price only for the one overlay</td><td>the record (16 measures nightly) + the rule; the Hub tab becomes a reader with the operator's switches</td><td>yes: C3, C3b and C4 each compute the measures in the browser from the same tables</td></tr>
<tr><td class="k">SCREENER tab</td><td>the record</td><td>the analytics layer; the Hub tab is a view of it</td><td>today the tab is a stub</td></tr>
<tr><td class="k">ROTATION / RELATIVE / breadth</td><td>daily close series</td><td>the analytics layer (sigma history, breadth history already run nightly)</td><td>partly: breadth has its own history table; rotation reads sector funds live</td></tr>
<tr><td class="k">STATS (the statistician, the pullback playbook)</td><td>daily and intraday history, point in time</td><td>already off the Hub (provider jobs); the Hub shows the result</td><td>no</td></tr>
<tr><td class="k"><b>stays live on the Hub</b>: the served names' board (live Geiger, RVOL, price and daily change in the header), Station charts and the company chart with the lens, alerts, scintillas, the tapes (EARNINGS / ECONOMIC), news and social, the X feed, the YouTube feed</td><td>intraday bars, live quotes, events as they land</td><td>the Hub</td><td>—</td></tr>
</table></div>
<div class="words"><b>8.1 The proposal in one line:</b> the Hub keeps everything that moves during the session; the tree / analytics layer owns everything that is true at the close — and the placement record is where the two meet, because the Hub's company pages read the same record for identity, SIC, size, comps and the close Geiger that the tree reads. What moves off first is decision 5.</div></div>

<h2 id="s9">9 · The implementation queue <small>epics in order; every effort figure is an [ESTIMATE]</small></h2>
<div class="epic"><b>E1 · The placement record and its nightly job</b> <span class="m">· owner: an Opus data lane; the coordinator applies the migration and runs the keyed job on Fly · <span class="est">[ESTIMATE] 1 lane-day build, 1 day soak</span></span><br>
Migration (additive): <code>public.placement_record</code> (one row per ticker per as_of: the eight parts as columns and JSONB for lists; indexes on ticker, as_of, sic_code, fmp_industry) plus <code>public.fund_membership</code> (ticker, fund, weight_pct, as_of). Rollback: drop the two tables. Job: <code>scripts/placement-record-nightly.mjs</code> on Fly after 20:00 ET — reads FMP profile, Massive reference (SIC, market cap), FMP peers (existing job), Massive related (C4's job), FMP holdings for the 138 funds, filer currency + fx, the scout route, and C3's reader for the 16 measures; prints JSON lines; the coordinator loads them (as fx_rates was) until a Fly app holds a write key. <b>Acceptance:</b> 590 rows for the session; every field group has source and fetched_at; the six worked records on this page reproduce from the table; a second run for the same as_of is a no-op. <b>Dependency:</b> C4's <code>20261001_peer_sources.sql</code> applied (or folded into this migration). <b>Kimi:</b> the no-network validator that checks a day's rows for completeness and prints the coverage tiles.</div>
<div class="epic"><b>E2 · The authority tags on the tree</b> <span class="m">· owner: an Opus page lane · <span class="est">[ESTIMATE] half a lane-day</span></span><br>
The tree reads SIC, FMP industry, size and the disagreement flag from the record for every name and fund; the card shows the majority SIC per cohort and fund. <b>Acceptance:</b> headless shots at 1680/390 with "SIC 3559 · special industry machinery" under LRCX; the disagreement flag on the twenty names of section 2.2. Rollback: the tree reads tree.json as today. Depends on E1.</div>
<div class="epic"><b>E3 · The comps rule reads the record</b> <span class="m">· owner: the C4 lane (Opus) · <span class="est">[ESTIMATE] half a lane-day</span></span><br>
peers.mjs takes its profiles, SIC, peers and related from the record; the fund-is-a-vote change (5.1) and the thin-set rule land; the counts line and the ladder (6.1) appear on the tab; outlier flags per measure (IQR) as chips only. <b>Acceptance:</b> the six sets of section 5 reproduce from the table; C4's tests pass; shots. Rollback: the C4 branch as merged. Depends on E1.</div>
<div class="epic"><b>E4 · P8 lands: the seven-rung close Geiger in the record</b> <span class="m">· owner: the coordinator (apply 0025, first write, the 20:00 schedule, deploy the route) · <span class="est">[ESTIMATE] 1 hour of coordinator time, then 20 nights of accumulation</span></span><br>
<b>Acceptance:</b> /v1/scout-geiger rows say "seven" for the 590; the record's readings part carries them; P8's own acceptance (match the Hub on the 590 at the close) is Alan's. Rollback: P8's runbook. Nothing in E1–E3 waits for it.</div>
<div class="epic"><b>E5 · The cohort rule, nightly, with the move list</b> <span class="m">· owner: an Opus data lane; Kimi for the pure co-movement module (no network: returns in, cohesion and null line out, with tests) · <span class="est">[ESTIMATE] 1 lane-day; live after E4 + N nights</span></span><br>
<code>public.cohort_proposals</code> (as_of, cohort id, state, members, cohesion, null95, parent fund, SIC majority) and <code>public.cohort_moves</code>; the registry stays Alan's. The tree's L4 reads proposals for PROPOSED and the registry for ADOPTED. <b>Acceptance:</b> the dry-run tables of section 4 reproduce on the Geiger series; a 20-night streak promotes to "put to Alan"; no row of the registry changes. Rollback: drop the two tables; the tree falls back to tree.json. Depends on E1 and E4.</div>
<div class="epic"><b>E6 · The screener over the record</b> <span class="m">· owner: an Opus page lane · <span class="est">[ESTIMATE] 1 lane-day</span></span><br>
The SCREENER tab as a filter form over placement_record (industry, SIC, size, country, ADR, fund, measure ranges, Geiger range, cohort state) with "use as comp set" and "show on the tree". Unserved names from FMP's company-screener stored as served:false records by the nightly job. <b>Acceptance:</b> a screen "Semiconductors, $100 B–$1 T, FCF margin > 20%" answers from the table in under a second; shots. Depends on E1.</div>
<div class="epic"><b>E7 · The comp-set edges in the tree's 3D area, and the 3D agreement view</b> <span class="m">· owner: the tree lane (Opus) · <span class="est">[ESTIMATE] 1–2 lane-days</span></span><br>
A name's area view adds its kept set as edges; a peer's click lifts that peer's set; the 3D agreement form of 6.2 is the name-level view. <b>Acceptance:</b> LRCX lifted shows its ten with their votes; shots at 1680/390; label-to-ball proof as T3/T4. Depends on E1, E3.</div>
<div class="epic"><b>E8 · Hub streamlining (discussion first)</b> <span class="m">· owner: Alan with the coordinator · <span class="est">[ESTIMATE] no build until decided</span></span><br>
Decision 5 picks the first surface to move; each move is its own lane with a before/after and a rollback (the Hub tab stays, hidden behind a flag, for a week).</div>

<h2 id="s10">10 · Decisions for Alan <small>at most five, each with a recommendation</small></h2>
<div class="dec"><b>1 · The industry authority.</b> FMP industry rules and the SIC is the tag and tie-breaker (as written in 2.1), or the SIC rules and FMP is the tag. <b>Recommendation: FMP rules, SIC tags.</b> FMP is complete on the 590 and finer where comps care (regulated vs generators; infrastructure vs application software); the SIC is coarse and missing for TSM, ARM, ASML, CCJ. Either way both are printed on every name and a disagreement is flagged, so the choice changes the comps rule's "same industry" test, not what Alan sees.</div>
<div class="dec"><b>2 · The size band and N.</b> ×10 and 10, with the thin-set widening (×30, then any, said on the tab), or ×3 and 8 for a tighter set. <b>Recommendation: ×10 and 10 as defaults, ×3 one click away</b>, and admit the unserved names the screener puts forward for thin industries (JPM's HSBC, RY, TD; XOM's SHEL, TTE, BP) so the band does not have to widen to fill a set.</div>
<div class="dec"><b>3 · The home-path rule.</b> Adopted > proposed > fund set > none, with the industry test added at the first step (3.2), or the pure smallest-cohort rule as today. <b>Recommendation: add the industry test.</b> It makes a home explainable in the record's own terms ("home because same industry and adopted"), and it is what keeps NVDA under SMH rather than under a size bucket.</div>
<div class="dec"><b>4 · The co-movement window.</b> 60 sessions re-measured nightly (quick to react, noisier) or 250 (a year, steadier), with 750 kept for the adoption check. <b>Recommendation: 60 for the nightly proposal and move list, 250 for "put to Alan", 750 as the adoption record</b> — three windows, each with a job, none decided by one number.</div>
<div class="dec"><b>5 · What moves off the Hub first.</b> The cohort boards, the comps computation, or the screener. <b>Recommendation: the comps computation first</b> (E1 + E3): it is the most duplicated today (three lanes computing the same 16 measures in the browser), it needs nothing live but the price overlay, and it is what the tree's 3D name level will read. The cohort boards stay until P8 has run for N nights and Alan has judged the close Geiger.</div>

<h2 id="s11">11 · Proof, doubts, what was not done</h2>
<div class="panel"><div class="words"><b>Screens</b> (headless Chromium via playwright-core, no visible window, closed afterwards; static pages, no API call):</div>
${shot("standard-1680.png", "1680 · the standard: the header, the record table and the first worked record")}
${shot("standard-s5-1680.png", "1680 · section 5: LRCX worked — the counts line, the ten kept with their votes, the dropped names")}
<div class="two"><div>${shot("ladder-1680.png", "1680 · the agreement ladder for LRCX (standalone mock)", false)}</div><div>${shot("3d-1680.png", "1680 · the 3D form for LRCX (standalone mock)", false)}</div></div>
<div class="three"><div>${shot("standard-390.png", "390 · the standard on a phone: tiles wrap, tables scroll inside their box", true, true)}</div><div>${shot("ladder-390.png", "390 · the ladder on a phone", true, true)}</div><div>${shot("3d-390.png", "390 · the 3D form on a phone", true, true)}</div></div>
<div class="words"><b>What I saw</b> is written in the return (the lane's final message), shot by shot.</div>
<div class="words"><b>What could be wrong.</b>
<ul>
<li>The SIC and Massive market value are a 1 Oct probe for ${A.probed} names, not a table; the disagreement counts are on those ${A.probed}, not the 590. The job in E1 makes it the 590.</li>
<li>Massive's related list was probed for the six only; for every other name the ladder would have three columns tonight. Massive repeats names in its list (LRCX: AMAT and KLAC twice) — de-duplicated here, order kept.</li>
<li>The dry run's co-movement is 60 sessions of close returns, not the Geiger series, and the one-day scout agreement is one day. Section 4 says so in every table; nothing in it is an adoption.</li>
<li>"Same industry" leans on FMP's label; where FMP is wrong the SIC tie-break helps only inside the industry. The standard's thin-set rule widens the band, never the industry.</li>
<li>The fund list and holdings are the 26 Sep file; the record job refreshes them.</li>
<li>The random line for a cohort of two or three is high (0.54, 0.40) and the verdict "COHESIVE" for a pair means little; the table shows n beside every verdict.</li>
<li>C4's rule (peers-c4.mjs) is copied unchanged from an unmerged branch; if C4 changes before merge, the "as built" column here is of its 1 Oct state (commit dae8245).</li>
</ul>
<b>What was not done.</b> No deploy, no push, no table written, no schedule, no credential printed (the Fly probe printed values only). No migration SQL written here: E1's table design is stated in words and the coordinator's lane writes it with its rollback. The seven-rung Geiger was not run (P8's is on its branch, un-applied). No visible browser. The tree, the comps tab and the market map were not changed.</div>
<div class="words"><b>Files.</b> <code>UNIVERSE-STANDARD.html</code> (this page) · <code>universe-standard.v1.json</code> (the machine copy, PROPOSED) · <code>derive.mjs</code> (the derivations; <code>node derive.mjs --closes &lt;file&gt;</code>) · <code>derived-20261001.json</code> (its output: records, authorities, the six sets, the dry run) · <code>peers-c4.mjs</code> (C4's rule, unchanged) · <code>build-page.mjs</code> · <code>agreement-ladder.html</code>, <code>agreement-3d.html</code> (the two mocks) · <code>data/</code> (the dated snapshots the derivations read) · <code>shots/</code> · <code>tests/universe-standard.test.mjs</code>.</div>
</div>
</div></body></html>`;
writeFileSync(join(HERE, "UNIVERSE-STANDARD.html"), html);

/* ---------- the two standalone mocks ---------- */
const mockHead = (title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${CSS}</style></head><body><div class="wrap">`;
writeFileSync(join(HERE, "agreement-ladder.html"), `${mockHead("Agreement Ladder")}<div class="top"><div data-scnav-slot></div><div class="brand"><b>SCINTILLA</b> · COMPS · THE AGREEMENT LADDER · LRCX <span class="proposed">MOCK</span></div><div class="stamp">rows = candidates by votes then closeness · columns = the four sources · the shaded band = the kept set · 1 Oct 2026, real data</div></div>${fourLines("LRCX")}<div class="panel"><div class="tw" style="padding-top:10px">${ladderHTML("LRCX", { full: true })}</div></div></div></body></html>`);
writeFileSync(join(HERE, "agreement-3d.html"), `${mockHead("Agreement 3D")}<div class="top"><div data-scnav-slot></div><div class="brand"><b>SCINTILLA</b> · COMPS · THE AGREEMENT VIEW, 3D · LRCX <span class="proposed">MOCK</span></div><div class="stamp">up = how many sources agree · in = closeness in market value · around = the kind of agreement · the bright dots = the kept set · 1 Oct 2026, real data</div></div>${fourLines("LRCX")}<div class="panel"><div class="svgwrap">${threeDSVG("LRCX")}</div></div></div></body></html>`);

/* ---------- the machine copy ---------- */
const std = {
  artifact_kind: "SCINTILLA_UNIVERSE_STANDARD", version: "1.0.0", status: "PROPOSED", proposed_utc: D.built_utc, proposed_by: "U1 lane (Fable · Urth), 1 Oct 2026", decided_by: "Alan — not yet",
  question: "Which companies belong together, by which rule, from which source — answered once; read by the tree, the cohorts and the comp sets.",
  placement_record: {
    key: ["ticker", "as_of"], refreshed: "nightly after the close (after 20:00 ET), one job, never edited by hand",
    parts: {
      identity: { fields: ["name", "exchange", "primary_exchange_mic", "country", "is_adr", "listing_currency", "statement_currency", "statement_date", "cik"], sources: { profile: "FMP /stable/profile", reference: "Massive /v3/reference/tickers", statement: "FMP /stable/income-statement" }, status: { today: "public.company_profile, public.filer_currency (36)", gap: "statement currency for the other served names: one job away" } },
      classification: { fields: ["sic_code", "sic_description", "fmp_sector", "fmp_industry"], sources: { sic: "Massive /v3/reference/tickers (the SEC's code)", fmp: "FMP /stable/profile" }, status: { today: "FMP on company_profile", gap: "SIC: one job away (C4's ticker_industry migration)" } },
      size: { fields: ["market_value_usd", "source", "date", "check_other_provider", "disagreement_pct"], authority: "Massive reference market_cap (all share classes)", check: "FMP profile marketCap; flag when the gap ≥ 5%", status: "FMP in a table; Massive one job away" },
      membership: { fields: ["funds[] {fund, weight_pct, source, as_of}"], source: "FMP etf-holdings for the 138 tree funds", status: "in tree.json (26 Sep); a table is new" },
      relations: { fields: ["fmp_peers[] in FMP's order", "massive_related[] in Massive's order"], sources: { fmp: "FMP /stable/stock-peers → public.fmp_peers", massive: "Massive /v1/related-companies → public.peer_sources (C4 job)" }, status: "FMP in a table; Massive one job away" },
      readings: { fields: ["close_geiger {composite, trend, momentum, rungs}", "hub_geiger where served"], source: "chart API /v1/scout-geiger (seven rungs after P8; three today); /geiger", status: "three-rung in a table; seven-rung is P8 (built, not applied)" },
      comps_measures_usd: { fields: ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg", "rev_g_ttm", "rev_g_fy", "eps_g_fy", "gm", "om", "fcfm", "nd_ebitda", "capex_rev", "capex_g", "rev_per_capex"], basis: "USD at the statement-date rate (public.fx_rates at filer_currency.statement_date)", source: "C3's reader (deliverables/20261001/comps-template/cohort.mjs)", status: "computed on demand today; stored nightly: one job away" },
      provenance: { fields: ["per part: source, fetched_at", "as_of", "inputs_sha256"], status: "new" },
    },
    served_false_records: "names the screener returns that the Hub does not serve get identity, classification and size only, served:false",
  },
  authorities: {
    industry: { authority: "FMP industry", tag: "SIC code + description (Massive / SEC)", tie_break: "same SIC ranks a peer closer; SIC is the fallback where FMP has no industry", disagreement_flag: true, decision: 1, recommendation: "FMP rules, SIC tags" },
    market_value: { authority: "Massive reference market_cap (all share classes)", check: "FMP profile marketCap", flag_when_gap_pct_at_least: 5, standin_until_job: "FMP" },
    holdings: { authority: "FMP etf-holdings", check: null },
    peers: { authority: null, rule: "both are votes; orders kept" },
    readings: { authority: "the off-Hub Geiger at the close, seven rungs (P8)", check: "the Hub Geiger, live, 590" },
  },
  tree: {
    levels: ["L0 market", "L1 asset class / region", "L2 sector (sector fund)", "L3 industry fund(s) (≤ 60 served holdings; broad and style funds excluded)", "L4 cohort (ADOPTED | PROPOSED | FUND SET | NONE YET)", "L5 names"],
    sic_on_the_tree: { L2: "SIC division (first two digits) as a check on the heading", L3: "the fund's holdings' SIC codes, counted", L4: "majority SIC and the odd ones out on the card", L5: "SIC code + description under every name; FMP industry beside it; disagreement flag" },
    home_path_rule: ["1 the ADOPTED cohort that claims it; if several, the one whose industry (by the authority) matches, then the smallest", "2 else the PROPOSED cohort that claims it", "3 else the FUND SET of the industry fund holding it at the highest weight", "4 else the sector heading's NONE YET line", "theme beats size: a size cohort (MEGACAP) is 'also in', never home, when an industry cohort claims the name"],
    also_in_edges: ["other cohort (adopted or proposed)", "fund set", "comp-set edge: the name is in another company's kept set (new)"],
    decision: 3,
  },
  cohorts: {
    proposal_rule: { shared_industry: "same FMP industry, or the same SIC code where FMP's label spans several", shared_funds: "at least one industry fund holds ≥ half of the set", co_movement: "mean pair correlation of the close-Geiger readings over N sessions above the 95th point of 200 random draws of the same size from the served universe", windows: { nightly_proposal_and_moves: 60, put_to_alan: 250, adoption_record: 750 }, decision: 4 },
    naming_rule: "upper snake id; label = the parenting fund's theme in plain words where Alan named it, else the SIC description in plain words; ≤ 3 words; never a vendor label verbatim; a split keeps the parent's first word",
    states: ["ADOPTED (public.cohort_registry, Alan)", "PROPOSED (passes the rule tonight)", "FUND SET (an industry fund's served holdings, automatic)", "NONE YET"],
    promotion: "20 consecutive passing nights → put to Alan; 20 failing → withdrawn; nothing adopts or dissolves itself (R5)",
    move_rule: "leave-one-out: another cohort's mean tracks the name better than its own by ≥ 0.10 → listed; Alan decides",
    dry_run_1oct: { provisional: true, stand_in: "60 sessions of daily close returns (chart API) + today's three-rung scout for the one-day agreement", counts: DR.counts, window: [DR.first_session, DR.last_session] },
    dependency: "P8 (seven-rung close Geiger) for the co-movement half",
  },
  comp_sets: {
    candidates: ["FMP peers", "Massive related", "same industry by the authority (the screener; served names today)", "served holdings of the industry funds that hold the company"],
    keep: { same_industry: "FMP industry equal, or the same SIC code", fund_is: "a vote, never an industry match (departs from C4 as built)", band_default: 10, band_options: [3, 10, 30, "any"], thin_set_rule: "fewer than 5 survive at ×10 → widen one step, say so" },
    rank: ["votes desc", "closeness |log10(peer ÷ own market value)| asc", "ticker"], n_default: 10, n_options: [6, 8, 10, 12, 15],
    operator: "public.comps_decisions on top; a switched-off peer stays listed, greyed, out of the medians",
    outliers: "per measure, beyond 1.5 × IQR of the peers' middle half → flag only (July spec §1); never removed by the rule",
    worked: Object.fromEntries(SIX.map((t) => [t, { industry: CS[t].industry, sic: CS[t].sic, band_used: CS[t].standard.band_used, counts: CS[t].standard.counts, kept: CS[t].standard.kept.map((k) => k.ticker), c4_as_built: CS[t].kept.map((k) => k.ticker) }])),
    decision: 2,
  },
  agreement_view: { flat: "rows = candidates by votes then closeness; columns = the four sources; the kept band shaded; a verdict per row", three_d: "the company on the spine; rings by votes (1 bottom … 4 top); radius = closeness; angle = the source signature; the kept set = the bright inner ring; in the tree's 3D area a name lifts into its comp cloud", mocks: ["agreement-ladder.html", "agreement-3d.html"] },
  screener: { rule: "a filter over placement records: industry/SIC, size band, country, ADR, fund, measure ranges, Geiger range, cohort state; no provider call", hub_tab: "the SCREENER tab is a view of it, with 'use as comp set' and 'show on the tree'", comps: "the fourth comps source is this screen with industry = the company's and size inside the band" },
  hub: { could_move_to_the_tree_layer: ["cohort boards", "universe-wide Geiger (already off)", "comps computation", "screener", "rotation / relative / breadth"], stays_live: ["served names' board", "Station charts and the company chart", "alerts", "scintillas", "tapes", "news, social, X and YouTube feeds"], decision: 5, recommendation: "the comps computation first" },
  queue: ["E1 placement record + nightly job", "E2 authority tags on the tree", "E3 comps rule reads the record", "E4 P8 lands", "E5 cohort rule nightly + moves", "E6 screener over the record", "E7 comp-set edges + 3D agreement in the tree", "E8 Hub streamlining (discussion first)"],
  decisions_open: [1, 2, 3, 4, 5],
  sources_read: D.sources,
};
writeFileSync(join(HERE, "universe-standard.v1.json"), JSON.stringify(std, null, 1));
console.log("wrote UNIVERSE-STANDARD.html, agreement-ladder.html, agreement-3d.html, universe-standard.v1.json");
