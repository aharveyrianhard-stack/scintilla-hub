/* RS1 (6 Oct 2026, rebuilt 7 Oct) — builds RS1-RSI-OWN-EXTREMES.html from the files beside it, so every number AND every
   caption on the page is read from a record and none is typed by hand (the 6 Oct captions named cells from memory and
   one was wrong):
     tools/rec-<before|after>-<1680|390>.json     what the headless browser saw on the board (with the rows in each crop);
                                                   before = the live page (origin/hub/release-20260923), after = this branch
     tools/rec-nflx-at-33-<before|after>-1680.json the same, from 6 Oct 16:44 ET, when the board still showed Netflix at 33
     tools/rec-late-scale-*.json                   the real-browser check of the late-landing-scale repair
     tools/rec-fullscreen-glow-<live|branch>.json  where the breathing copy of a number sits in the board's full-screen mode
     tools/rec-night-shares.json                   the nightly function's own handler run here, share by share
     tools/station-<before|after>-shots.json       what it saw on the Station (copied from the Station branch's harness run)
     data/rsi-own-dry-run.json                     the loader's dry run, newest finished close
     data/playbook-lines.json, -20261005.json      the index and macro lines, newest close and the 5 Oct close
     data/fmp-vs-own.json                          the board's number against the scale's own RSI, same session
   node deliverables/20261006/rs1-rsi-own-extremes/tools/build-page.mjs */
import fs from "node:fs";
const here = new URL("../", import.meta.url);
const J = (p) => JSON.parse(fs.readFileSync(new URL(p, here), "utf8"));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const b16 = J("tools/rec-before-1680.json"), a16 = J("tools/rec-after-1680.json"), b39 = J("tools/rec-before-390.json"), a39 = J("tools/rec-after-390.json");
const ob = J("tools/rec-nflx-at-33-before-1680.json"), oa = J("tools/rec-nflx-at-33-after-1680.json");
const lateNew = J("tools/rec-late-scale-fixed.json"), lateOld = J("tools/rec-late-scale-6oct-0cad2f8.json");
const fsLive = J("tools/rec-fullscreen-glow-live.json"), fsNew = J("tools/rec-fullscreen-glow-branch.json");
const ns = J("tools/rec-night-shares.json");
const sec = (ms) => (ms / 1000).toFixed(1);
const sb = J("tools/station-before-shots.json"), sa = J("tools/station-after-shots.json");
const dry = J("data/rsi-own-dry-run.json"), pb = J("data/playbook-lines.json"), pb5 = J("data/playbook-lines-20261005.json"), cmp = J("data/fmp-vs-own.json");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayWords = (iso) => +iso.slice(8, 10) + " " + MON[+iso.slice(5, 7) - 1];
const et = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) + " ET";
const asOf = Object.keys(dry.summary.as_of)[0], closeWords = dayWords(asOf) + " close";
const el = dry.rows.filter((r) => r.eligible), by = Object.fromEntries(dry.rows.map((r) => [r.ticker, r]));
const oldGlow = el.filter((r) => r.rsi <= 30 || r.rsi >= 70), newGlow = el.filter((r) => r.pct <= 10 || r.pct >= 90);
const stop = oldGlow.filter((r) => !(r.pct <= 10 || r.pct >= 90)), start = newGlow.filter((r) => !(r.rsi <= 30 || r.rsi >= 70));
const p10s = el.map((r) => r.p10).sort((x, y) => x - y), p90s = el.map((r) => r.p90).sort((x, y) => x - y), mid = (s) => s[Math.floor((s.length - 1) / 2)];
const N = by.NFLX, C = (rec, t) => (rec.cells && rec.cells[t]) || {};
const sw = (c) => `<i class="sw" style="background:${esc(c || "transparent")}"></i>`;
const st = (rec, name) => rec.shots.find((s) => s.name === name) || {};
const chip = (rec, name) => (st(rec, name).pane || {}).chip || {};
const ownLine = (c) => (c.data_own || c.title || "").split(" · ")[0];
const list = (xs) => (xs.length ? xs.join(", ") : "none");
/* what a crop shows, read from the record */
const cropB = Object.fromEntries((b16.crop_rows || []).map((r) => [r.t, r])), cropA = Object.fromEntries((a16.crop_rows || []).map((r) => [r.t, r]));
const breathesB = (b16.crop_rows || []).filter((r) => r.breathes).map((r) => r.t + " " + r.rsi);
const newly = (a16.crop_rows || []).filter((r) => r.breathes && cropB[r.t] && !cropB[r.t].breathes).map((r) => r.t + " " + r.rsi);
const stopped = (b16.crop_rows || []).filter((r) => r.breathes && cropA[r.t] && !cropA[r.t].breathes).map((r) => r.t + " " + r.rsi);
const phB = Object.fromEntries((b39.crop_rows || []).map((r) => [r.t, r]));
const phNew = (a39.crop_rows || []).filter((r) => r.breathes && phB[r.t] && !phB[r.t].breathes).map((r) => r.t + " " + r.rsi);
const note = (t) => { const y = C(a16, t), r = by[t]; if (!r) return ""; if (!r.eligible) return "listed under a year ago: unchanged"; return y.breathes ? (r.pct <= 10 ? "inside its own bottom tenth" : "inside its own top tenth") : Math.abs(r.pct - 50) < 8 ? "near its own middle" : ""; };
const cellRow = (t, extra) => { const x = C(b16, t), y = C(a16, t); return `<tr><td class="k">${t}</td><td>${sw(x.color)}${esc(x.text)}${x.breathes ? " · breathes" : ""}</td><td>${sw(y.color)}${esc(y.text)}${y.breathes ? " · breathes" : ""}</td><td>${esc(ownLine(y))}</td><td>${esc(extra || note(t))}</td></tr>`; };
const young = dry.rows.filter((r) => !r.eligible);
const pbBy = (set, t) => set.rows.find((r) => r.t === t) || {};
const f1 = (x) => (x == null ? "—" : Number(x).toFixed(1));
const f2 = (x) => (x == null ? "—" : Number(x).toFixed(2));
const nth = (n) => { const k = Math.round(n), t = k % 100; return k + (t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][k % 10]); };
const recon = (t, c) => { const x = pbBy(pb5, t); return `<tr><td class="k">${t}</td><td>${c.rsi} · ${nth(c.pct)} · ${c.p10} · ${c.p90} · ${c.low}</td><td>${f2(x.rsi)} · ${nth(x.pct)} · ${f1(x.p10)} · ${f1(x.p90)} · ${x.last_pullback ? f1(x.last_pullback.rsi_low) : "—"}</td></tr>`; };
const lines = (set) => set.lines.map((l) => { const i = l.indexOf(" — "); return `<p><b>${esc(l.slice(0, i))}</b>${esc(l.slice(i))}</p>`; }).join("\n");
const sumS = (r, f) => r.shots.reduce((n, s) => n + f(s), 0);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow">
<title>SCINTILLA · RS1 · RSI BY EACH NAME'S OWN EXTREMES · 6 OCT</title>
<style>
:root{color-scheme:dark;--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--line2:#363636;--ink:#cfcfcf;--ink2:#acacac;--dim:#8c8c8c;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2)}
body{font-family:var(--mono);font-size:13px;line-height:1.6;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px 80px;overflow-x:hidden}
header{padding:16px 0 12px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
h1{font:600 13px/1.4 var(--mono);letter-spacing:.2em;color:var(--ink);margin:0}
.stamp{margin-left:auto;font:400 11px/1.5 var(--mono);color:var(--dim);text-align:right}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.22em;color:var(--ink);margin:30px 0 8px;text-transform:uppercase}
.panel{border:1px solid var(--line);background:var(--panel);margin-bottom:8px}
.words{padding:12px 16px 14px;font-size:12.5px}.words b{color:var(--ink);font-weight:600}.words p{margin:6px 0}
.words ul{margin:4px 0 8px;padding-left:20px}.words li{margin:5px 0}.words code{font-size:12px;color:var(--ink)}
.shot{padding:12px 16px 14px}.shot img{display:block;width:100%;height:auto;border:1px solid var(--line2)}
.shot small{display:block;margin:6px 0 12px;font-size:11px;color:var(--dim)}
.shot .lbl{font:600 11px/1.4 var(--mono);letter-spacing:.18em;color:var(--ink);margin:0 0 6px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two.ph img{max-width:390px}
table.t{width:100%;border-collapse:collapse;font-size:12px}
table.t th,table.t td{padding:5px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
table.t th{font:400 11px/1.4 var(--mono);letter-spacing:.14em;color:var(--dim);text-transform:uppercase}table.t td.k{color:var(--ink)}
.tw{overflow-x:auto;padding:0 16px 10px}
.sw{display:inline-block;width:11px;height:11px;margin-right:7px;vertical-align:-1px;border:1px solid var(--line2)}
.lines p{margin:0 0 10px;font-size:12.5px}.lines p b{color:var(--ink);font-weight:600}
details.sc-pagespecs{border:1px solid var(--line);background:var(--panel);margin:24px 0 8px}
details.sc-pagespecs>summary{padding:8px 16px;cursor:pointer;font:400 11px/1.4 var(--mono);letter-spacing:.16em;color:var(--dim)}
@media(max-width:760px){.wrap{padding:0 12px 60px}.two{grid-template-columns:1fr}.stamp{margin-left:0;text-align:left}}
</style></head><body><div class="wrap">
<header><span data-scnav-slot></span><h1>RS1 · RSI COLOURED BY EACH NAME'S OWN EXTREMES</h1><span class="stamp">6 Oct 2026 · checked, repaired and re-photographed ${esc(et(a16.at))} · preview only · nothing is live · branches hub/rs1-rsi-own-extremes-20261006 and station/rs1-rsi-own-extremes-20261006</span></header>

<h2>The number you flagged — Netflix at 33, before then after</h2>
<div class="panel shot">
  <p class="lbl">BEFORE (the Hub as it was live, ${esc(et(ob.at))})</p>
  <img src="pictures/nflx-at-33-before-1680.png" alt="Before: the board rows around NFLX when it read 33">
  <small>NFLX reads ${esc(C(ob, "NFLX").text)} in a medium green and does not breathe. The cells that breathe are the ones at 30 or lower: GS 30, BNY 26, NOC 24, KKR 29, XPEV 30, MCD 27.</small>
  <p class="lbl">AFTER (this branch, ${esc(et(oa.at))}; the glow is photographed at its brightest)</p>
  <img src="pictures/nflx-at-33-after-1680.png" alt="After: the same rows, coloured by each name's own two years">
  <small>NFLX ${esc(C(oa, "NFLX").text)} is a deeper green (${esc(C(oa, "NFLX").color)} against ${esc(C(ob, "NFLX").color)} before) and still does not breathe: "${esc(ownLine(C(oa, "NFLX")))}", and its own bottom tenth starts at ${Math.round(N.p10)}. GE 33 and KGC 32 now breathe: for those two names the same kind of number IS inside their own bottom tenth. These two pictures are from the 6 Oct build of the branch; none of the 7 Oct repairs changes the colour or the breath of a cell in them.</small>
</div>

<h2>The same rows today, 1680 wide — before then after</h2>
<div class="panel shot">
  <p class="lbl">BEFORE (the Hub as it is live, ${esc(et(b16.at))})</p>
  <img src="pictures/before-1680-nflx-rows.png" alt="Before: the board rows around NFLX">
  <small>The board now shows the ${esc(closeWords)}: NFLX reads ${esc(C(b16, "NFLX").text)} and does not breathe. Breathing in this crop: ${esc(list(breathesB))}.</small>
  <p class="lbl">AFTER (this branch, same minute)</p>
  <img src="pictures/after-1680-nflx-rows.png" alt="After: the same rows, coloured by each name's own two years">
  <small>NFLX ${esc(C(a16, "NFLX").text)}: ${esc(C(a16, "NFLX").color)} against ${esc(C(b16, "NFLX").color)} before — "${esc(ownLine(C(a16, "NFLX")))}". Newly breathing in this crop: ${esc(list(newly))}. Stopped breathing: ${esc(list(stopped))}.</small>
</div>

<h2>The whole screen, sorted by RSI lowest first — before, then after</h2>
<div class="panel shot">
  <p class="lbl">BEFORE</p><img src="pictures/before-1680-sorted-rsi-lowest.png" alt="Before: the Hub sorted by RSI, lowest first">
  <p class="lbl">AFTER</p><img src="pictures/after-1680-sorted-rsi-lowest.png" alt="After: the Hub sorted by RSI, lowest first">
  <small>Nothing else on the page moved: same header, tapes, map, columns and row heights. At the very bottom of the RSI range the two rules agree, so these two pictures look alike. Over the whole ALL list ${b16.board.breathing} RSI cells breathed before and ${a16.board.breathing} breathe after (of ${a16.board.rsi_cells_with_a_number} with a number).</small>
</div>

<h2>Phone, 390 wide — before, then after</h2>
<div class="panel shot"><div class="two ph">
  <div><p class="lbl">BEFORE</p><img src="pictures/before-390-screen-nflx.png" alt="Before, phone"></div>
  <div><p class="lbl">AFTER</p><img src="pictures/after-390-screen-nflx.png" alt="After, phone"></div>
</div><small>The phone keeps its RSI column. Newly breathing among the rows in view: ${esc(list(phNew))}. A phone has no hover, so the same sentence is in the panel a tap on the cell opens.</small></div>

<h2>Found on the way — full-screen board: a breathing number was drawn twice</h2>
<div class="panel shot"><div class="two">
  <div><p class="lbl">LIVE HUB TODAY · full-screen board</p><img src="pictures/fullscreen-glow-live-fullscreen.png" alt="Live, full-screen board: the breathing copy sits left of the number, so it reads 72 72"></div>
  <div><p class="lbl">THIS BRANCH · full-screen board</p><img src="pictures/fullscreen-glow-branch-fullscreen.png" alt="Branch, full-screen board: one number with its glow"></div>
</div><small>${esc(fsLive.fullscreen.t)} ${esc(fsLive.fullscreen.text)}, enlarged three times, the breath frozen at its brightest. On the live Hub the glowing copy sits ${Math.abs(fsLive.fullscreen.copy_offset_px)} px to the left of its number in full-screen mode; on this branch ${Math.abs(fsNew.fullscreen.copy_offset_px)} px. The ordinary board was never affected (${Math.abs(fsLive.normal.copy_offset_px)} px on both).</small></div>

<h2>The hover (a browser tooltip never shows in a headless picture, so it is quoted from the page)</h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Name</th><th>Before</th><th>After</th><th>Hover, after</th><th></th></tr></thead><tbody>
${cellRow("NFLX", "the name you flagged")}
${cellRow("TLT")}
${cellRow("TSM")}
${cellRow("SPY")}
${cellRow("QQQ")}
${cellRow("IWM")}
${cellRow("MU")}
${cellRow("CBRS")}
${cellRow("VIX", "see the second call")}
${cellRow("US10Y", "see the second call")}
${cellRow("GCUSD", "see the second call")}
</tbody></table></div></div>

<h2>Station — the chart's RSI chip and the /geiger row, before then after</h2>
<div class="panel shot">
  <div class="two">
    <div><p class="lbl">BEFORE · TLT chart</p><img src="pictures/station-before-chart-TLT-1D-chip.png" alt="Station before: the RSI D chip is pink"></div>
    <div><p class="lbl">AFTER · TLT chart</p><img src="pictures/station-after-chart-TLT-1D-chip.png" alt="Station after: the RSI D chip is green with an edge"></div>
  </div>
  <small>The chip was always pink. After, "${esc(chip(sa, "chart-TLT-1D").text)}" is full green with a steady glow and an edge: ${esc((chip(sa, "chart-TLT-1D").title || "").split(" · ")[0])}. The Williams chip beside it and every line are untouched.</small>
  <div class="two">
    <div><p class="lbl">BEFORE · NFLX chart</p><img src="pictures/station-before-chart-NFLX-1D-chip.png" alt="Station before: NFLX chip pink"></div>
    <div><p class="lbl">AFTER · NFLX chart</p><img src="pictures/station-after-chart-NFLX-1D-chip.png" alt="Station after: NFLX chip tinted green"></div>
  </div>
  <small>Netflix on the Station reads ${esc(chip(sa, "chart-NFLX-1D").text)}, the same reading the Hub board rounds to ${esc(C(a16, "NFLX").text)}. Hover on the chip: "${esc((chip(sa, "chart-NFLX-1D").title || "").split(" · ")[0])}" — the Station works its own scale out in the browser and lands on the same sentence as the Hub.</small>
  <div class="two">
    <div><p class="lbl">AFTER · TSM, on a 4-hour chart</p><img src="pictures/station-after-chart-TSM-4h-chip.png" alt="Station after: TSM chip red with an edge"></div>
    <div><p class="lbl">&nbsp;</p><small>${esc((chip(sa, "chart-TSM-4h").title || "").split(" · ")[0])}: full red, a steady glow, an edge.</small></div>
  </div>
  <p class="lbl">AFTER · the whole NFLX pane (nothing else changed)</p>
  <img src="pictures/station-after-chart-NFLX-1D.png" alt="Station after: the whole NFLX chart pane">
  <div class="two">
    <div><p class="lbl">BEFORE · /geiger, NFLX</p><img src="pictures/station-before-geiger-NFLX-rsi-row.png" alt="Station geiger before: marks at 30 and 70, purple"></div>
    <div><p class="lbl">AFTER · /geiger, NFLX</p><img src="pictures/station-after-geiger-NFLX-rsi-row.png" alt="Station geiger after: marks at the name's own 10th and 90th"></div>
  </div>
  <small>This row was the one Station place that judged by the textbook 30 / 70: NFLX at ${esc((st(sb, "geiger-NFLX").geiger || {}).value)} was plain purple with marks at 30 and 70. After, the marks sit at Netflix's own 10th and 90th (${esc((st(sa, "geiger-NFLX").geiger || {}).marks ? st(sa, "geiger-NFLX").geiger.marks.map((m) => m.split(" @")[0]).join(" and ") : "")}), the dot and the number take the tint, and the row's hover says "${esc((st(sa, "geiger-NFLX").geiger || {}).hover)}".</small>
</div>

<h2>The index and macro lines — each one's RSI against its own two years, at the ${esc(closeWords)}</h2>
<div class="panel words lines">
${lines(pb)}
</div>

<h2>What was measured</h2>
<div class="panel"><div class="tw"><table class="t"><thead><tr><th>Check</th><th>Before</th><th>After</th></tr></thead><tbody>
<tr><td class="k">NFLX at ${esc(C(a16, "NFLX").text)} today, colour</td><td>${sw(C(b16, "NFLX").color)}${esc(C(b16, "NFLX").color)}</td><td>${sw(C(a16, "NFLX").color)}${esc(C(a16, "NFLX").color)}</td></tr>
<tr><td class="k">NFLX at 33 on 6 Oct, colour</td><td>${sw(C(ob, "NFLX").color)}${esc(C(ob, "NFLX").color)}</td><td>${sw(C(oa, "NFLX").color)}${esc(C(oa, "NFLX").color)}</td></tr>
<tr><td class="k">RSI cells that breathe, ALL list (1680 / 390)</td><td>${b16.board.breathing} / ${b39.board.breathing}</td><td>${a16.board.breathing} / ${a39.board.breathing}</td></tr>
<tr><td class="k">Every cell's colour and breath against the rule for the number it shows (1680 / 390)</td><td>—</td><td>${a16.disagreements.length} / ${a39.disagreements.length} disagreements in ${a16.board.rsi_cells_with_a_number} cells</td></tr>
<tr><td class="k">Names that breathe, every served name, ${esc(closeWords)}</td><td>${oldGlow.length} of ${el.length} (30 or lower: ${el.filter((r) => r.rsi <= 30).length} · 70 or higher: ${el.filter((r) => r.rsi >= 70).length})</td><td>${newGlow.length} of ${el.length} (own bottom tenth: ${el.filter((r) => r.pct <= 10).length} · own top tenth: ${el.filter((r) => r.pct >= 90).length})</td></tr>
<tr><td class="k">Start breathing (in their own tenth, but between 30 and 70)</td><td colspan="2">${start.length} names</td></tr>
<tr><td class="k">Stop breathing (70 or higher, but not in their own top tenth)</td><td colspan="2">${stop.map((r) => r.ticker + " " + Math.round(r.rsi)).join(", ") || "none"}</td></tr>
<tr><td class="k">Cells carrying the own-scale hover</td><td>${b16.board.with_own_scale_hover}</td><td>${a16.board.with_own_scale_hover} of ${a16.board.rsi_cells_with_a_number}</td></tr>
<tr><td class="k">Where a name's own bottom tenth starts</td><td>30 for every name</td><td>between ${Math.round(p10s[0])} and ${Math.round(p10s[p10s.length - 1])}, typically ${Math.round(mid(p10s))}; above 30 for ${el.filter((r) => r.p10 > 30).length} of ${el.length} names</td></tr>
<tr><td class="k">Where a name's own top tenth starts</td><td>70 for every name</td><td>between ${Math.round(p90s[0])} and ${Math.round(p90s[p90s.length - 1])}, typically ${Math.round(mid(p90s))}; below 70 for ${el.filter((r) => r.p90 < 70).length} of ${el.length} names</td></tr>
<tr><td class="k">Names with a scale / too young / no bars</td><td>—</td><td>${el.length} / ${young.length} (${young.map((r) => r.ticker).join(", ")}) / ${dry.skipped.length} (${dry.skipped.map((s) => s.symbol).join(", ")})</td></tr>
<tr><td class="k">A name outside the list on screen, searched, whose scale arrives after its number (${esc(lateNew.name)} ${esc((lateNew.number_first || {}).text)})</td><td>6 Oct build: stays ${sw((lateOld.after_its_scale_landed || {}).color)}${esc((lateOld.after_its_scale_landed || {}).color)}, ${(lateOld.after_its_scale_landed || {}).breathes ? "breathes" : "no breath"}, no hover line</td><td>now: ${sw((lateNew.after_its_scale_landed || {}).color)}${esc((lateNew.after_its_scale_landed || {}).color)}, ${(lateNew.after_its_scale_landed || {}).breathes ? "breathes" : "no breath"}, "${esc((lateNew.after_its_scale_landed || {}).own_line)}"</td></tr>
<tr><td class="k">Full-screen board: how far the breathing copy sits from its number (${esc(fsLive.fullscreen.t)} ${esc(fsLive.fullscreen.text)})</td><td>${Math.abs(fsLive.fullscreen.copy_offset_px)} px to the left — reads "${esc(fsLive.fullscreen.text)} ${esc(fsLive.fullscreen.text)}" (live Hub today)</td><td>${Math.abs(fsNew.fullscreen.copy_offset_px)} px</td></tr>
<tr><td class="k">The nightly job, run here against a stand-in database: CPU one call uses (the platform allows ${sec(ns.platform_cpu_allowance_ms)} s a call; this Mac is faster than the platform)</td><td>the whole night in one call, as scheduled on 6 Oct: 0.8 to 1.8 s over six runs (the recorded run: ${sec(ns.cpu.whole_night_ms)} s, and ${sec(ns.cpu.whole_night_cold_ms)} s as the first call of a fresh start)</td><td>one of ${ns.shares} shares: ${sec(Math.min(...ns.cpu.a_share_ms))} to ${sec(Math.max(...ns.cpu.a_share_ms))} s</td></tr>
<tr><td class="k">The ${ns.shares} shares together</td><td>—</td><td>${ns.cover.names_listed} names, ${ns.cover.rows_written_across_shares} rows, ${ns.cover.a_name_in_two_shares ? "A NAME IN TWO SHARES" : "no name twice"}; a dry call made ${ns.dry_share.database_writes.length} writes; a refused write left ${ns.refused_second_write.rows_saved_before_the_refusal} rows already saved</td></tr>
<tr><td class="k">Station chart: daily-bar requests per pane (NFLX, 1D)</td><td>${esc((st(sb, "chart-NFLX-1D").daily_requests || []).join(" · "))}</td><td>${esc((st(sa, "chart-NFLX-1D").daily_requests || []).join(" · "))}</td></tr>
<tr><td class="k">Station chart: reads of the database</td><td>${sumS(sb, (s) => s.own_table_reads_from_chart_page || 0)}</td><td>${sumS(sa, (s) => s.own_table_reads_from_chart_page || 0)}</td></tr>
<tr><td class="k">Page errors · writes attempted by the test browser (Hub, four runs)</td><td>${b16.page_errors + b39.page_errors} · ${b16.writes_attempted + b39.writes_attempted}</td><td>${a16.page_errors + a39.page_errors} · ${a16.writes_attempted + a39.writes_attempted}</td></tr>
<tr><td class="k">Page errors · writes attempted (Station, nine pages each)</td><td>${sumS(sb, (s) => s.errors.length)} · ${sumS(sb, (s) => s.blocked_writes)}</td><td>${sumS(sa, (s) => s.errors.length)} · ${sumS(sa, (s) => s.blocked_writes)}</td></tr>
</tbody></table></div></div>

<h2>Three calls for you</h2>
<div class="panel words">
<p><b>1 · About twice as many cells breathe.</b> You asked for the breath at each name's own extremes instead of 30 / 70. By definition every name spends a tenth of its days in its own bottom tenth and a tenth in its top tenth, so on an ordinary day about one RSI cell in five breathes; under 30 / 70 it is about one in ten (${oldGlow.length} names at the ${esc(closeWords)}, ${newGlow.length} with the own rule). <b>Recommended:</b> ship it as you asked and look at the board for a day. If it is too busy, the breath can be kept for the rarer own 5th / 95th (about one cell in ten) while the colour stays as it is — a one-number change.</p>
<p><b>2 · VIX, the ten-year, the dollar, oil and gold are showing a two-week-old RSI on the live Hub.</b> Those five cells are filled from a file built on 23 Sep, so the live Hub reads VIX ${esc(C(b16, "VIX").text)}, ten-year ${esc(C(b16, "US10Y").text)}, dollar ${esc(C(b16, "DXUSD").text)}, gold ${esc(C(b16, "GCUSD").text)}; at the ${esc(closeWords)} they were ${esc(C(a16, "VIX").text)}, ${esc(C(a16, "US10Y").text)}, ${esc(C(a16, "DXUSD").text)} and ${esc(C(a16, "GCUSD").text)}. This branch fills them from the new nightly table, so they stay current. A high reading is coloured red for these too, although for VIX and yields "high" is not the same kind of news as for a stock. <b>Recommended:</b> take the fresh numbers; keep one colour rule for now and decide the direction for VIX and yields when you look at them on the board.</p>
<p><b>3 · Three places still use a fixed RSI line and were left alone.</b> The ALLOCATION page's OVERSOLD search (your dial, RSI 40 or lower), the Station's /ranks and /reflow pages (coloured by rank across names, highest green) and the Station detail view's "bands 30 · 70". Changing the search changes which names it proposes, so it is not a recolour. <b>Recommended:</b> leave them; move the OVERSOLD search to each name's own bottom tenth as its own piece of work if you want it.</p>
</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div class="words">
<p><b>What it shows.</b> The Hub board's RSI column and the Station's two daily-RSI readouts, coloured by where each name's number sits in that name's own last two years instead of on one 30 / 70 ruler. Same palette as before: neutral at the name's own middle, full green at its own 10th percentile or lower, full red at its own 90th or higher; the breathing glow at those own extremes; a hover such as "${esc(ownLine(C(a16, "NFLX")))}" (the same line is in the panel a tap opens, because a phone has no hover).</p>
<p><b>Where each number comes from.</b></p><ul>
<li><b>The number in the cell</b> is unchanged: the stored daily RSI(14) the board already printed (FMP's, last settled close).</li>
<li><b>The name's own scale</b> is a new nightly table, <code>public.rsi_own_percentiles</code>: for each name, the RSI value at every percentile 0..100 of the two calendar years of finished daily sessions before the newest close. It is computed from the chart API's daily bars with Wilder's RSI(14). That is the same measure as the number in the cell: on the ${cmp.same_session_pairs} names where both described the ${esc(dayWords(cmp.session))} close, ${cmp.within_0_05} were within 0.05 of each other (median gap ${cmp.gap_median.toFixed(2)}, largest ${cmp.gap_max.toFixed(2)}; measured ${esc(et(cmp.made))}).</li>
<li><b>"Lower than 76%"</b> is 100 minus the percentile of the number on that grid. The window is the sessions BEFORE the close being read ("prior observations only", the rule the research pages use). A name with more than one year but less than two says how long its window really is ("last 18 months").</li>
<li><b>Under one year of history</b> (${young.map((r) => r.ticker).join(", ")}): no own scale; the cell keeps the 30 / 70 colouring and its hover says so.</li>
<li><b>The Station chart</b> does not read the database (it never has). It builds the same scale in the browser from the daily bars it already loads, with the same rule; the tests run the Station's code against the Hub loader's rows so the two cannot drift. Its long daily read is longer: ${esc((st(sb, "chart-NFLX-1D").daily_requests || []).join(" · "))} before, ${esc((st(sa, "chart-NFLX-1D").daily_requests || []).join(" · "))} after — the same number of requests.</li>
<li><b>The index and macro lines.</b> Same ruler. A pullback is the swing rule the research pages use: from a swing high to the next swing low (a swing point is a bar beyond the 10 bars on each side); its RSI low is the lowest daily RSI in between; only pullbacks whose low falls inside the two-year window count.</li></ul>
<p><b>The coordinator's 5 Oct numbers, checked.</b> RSI · percentile · own 10th · own 90th · last pullback low:</p>
<div class="tw" style="padding:0 0 6px"><table class="t"><thead><tr><th></th><th>Coordinator</th><th>This branch, 5 Oct close</th></tr></thead><tbody>
${recon("SPY", { rsi: "58.8", pct: 56, p10: "41.6", p90: "70.0", low: "41.8" })}
${recon("QQQ", { rsi: "68.4", pct: 81, p10: "41.3", p90: "71.4", low: "44.0" })}
</tbody></table></div>
<p>The RSI, the 10th and the last pullback low agree (68.45 is the 68.4 quoted). The percentile and the 90th differ because of where the RSI calculation was started: begun at the first bar of a two-year read, its first weeks are not yet settled and sit inside the sample; that way of counting gives SPY 56th with a 90th of 70.0 and QQQ 82nd with a 90th of 71.1 (checked on 7 Oct). Begun years earlier, so every day in the window is the RSI a chart would have shown that day, the same two years give the right-hand column. The table uses the settled one.</p>
<p><b>The AFTER pictures need a table that is not in the database yet.</b> The migration is written and not applied. For the pictures, the one read of that table was answered from the loader's dry run (${dry.rows.length} rows from the live chart API, all as of the ${esc(closeWords)}) in the shape the database would send; every other read was live. Before the table exists the page asks once, gets "not found", and stays on 30 / 70 for that page load — so the code is safe to ship first.</p>
<p><b>Checked and repaired on 7 Oct</b> (the 6 Oct session ran out of capacity during its own review, before reading what the review found). Both branches carry everything live has: the Station's 6 Oct evening work, and the Hub's compare-on-one-screen work that went live at 01:57 ET while this was being checked — the pictures on this page were taken after that, against that live page.</p><ul>
<li><b>"The lowest reading" was said of a name that had been lower.</b> A reading a hair inside a name's range rounded to exactly 0 or 100 (Corteva: 6.4 against a lowest day of 5.7). 0 and 100 are now kept for the true ends; in today's pictures it reads "${esc(((a16.top_rows_lowest_rsi || []).find((r) => r.t === "CTVA") || {}).hover ? (a16.top_rows_lowest_rsi.find((r) => r.t === "CTVA").hover.split(" · ")[0]) : "lower than 99%")}". One stored number in ${dry.rows.length} changes.</li>
<li><b>A searched name outside the list on screen kept the 30 / 70 colour</b> when its own scale arrived after its number, until the next board refresh. Reproduced in a headless browser on the 6 Oct build and gone on this one (the row in the table above).</li>
<li><b>The nightly job asked for the whole night in one call and wrote everything in one write after the last name.</b> The platform allows a call ${sec(ns.platform_cpu_allowance_ms)} seconds of CPU; run here, on a faster machine than the platform's, that one call used between 0.8 and 1.8 s over six runs — so on the platform's slower cores it would very likely have been cut off each night, and a cut pass wrote nothing. The night is now ${ns.shares} calls a minute apart, each a sixth of the names (${sec(Math.max(...ns.cpu.a_share_ms))} s at most in the recorded run here, and half the volume of a nightly job that already runs clean), and each saves every 40 names. It also reads 900 daily bars a name instead of 1,300: a third fewer bytes, and every one of the ${dry.rows.length} stored scales is identical to two decimals either way (compared on the 5 Oct close).</li>
<li><b>The loader ended "successfully" with nothing loaded</b> when the chart API refused every name, and a name typed twice would have made the database refuse the whole write. Both closed.</li>
<li><b>In the board's full-screen mode a breathing number was drawn twice</b> ("${esc(fsLive.fullscreen.text)} ${esc(fsLive.fullscreen.text)}"): the glowing copy was centred in a cell that mode aligns to the right. This is on the live Hub today (it came with the 6 Oct change that made the breath cheap) and would have shown twice as often with twice as many cells breathing. The copy now follows the number. One word in one style rule; the coordinator can leave it out without touching anything else.</li>
<li><b>Two of the index lines disagreed with the board by one point</b> (the dollar read 68 in its line and 67 on the board) because the line was rounded twice. Rounded once now; every line above matches its cell.</li></ul>
<p><b>What could be wrong.</b></p><ul>
<li><b>The nightly job has still not run on the platform.</b> Its own code was run here against a stand-in for the database (${ns.shares} shares, ${ns.cover.rows_written_across_shares} rows, nothing sent anywhere), and a share is sized at half of a job that runs clean there — but that is a sizing, not a run. Before the schedule is applied the deployed function should be called once with <code>?dry=1&amp;part=1&amp;of=${ns.shares}</code>; if the platform still cuts it off, one number in the schedule file makes it twelve shares. This is written at the top of that file.</li>
<li><b>The newest daily bar of the macro series was still moving a day later.</b> Read on 6 Oct at about 16:20 ET and again on 7 Oct at about 01:30 ET, the 5 Oct reading differed for seven of them (the dollar 72.3 to 74.2, gold 34.5 to 33.5, Bitcoin 65.1 to 64.5, three yields); no stock or fund differed. The job is scheduled for 19:30 ET and again for 07:30 ET; the morning pass would pick a later bar up. One observation, not a measured rule.</li>
<li><b>Corteva's RSI of ${Math.round((by.CTVA || {}).rsi)} is a data artefact</b>: its daily closes step from 77.65 on 30 Sep to 12.57 on 1 Oct on twenty times its usual volume, which looks like a corporate action the history was not adjusted for. It will read as the deepest green on the board until that history is corrected. Not this lane's to fix.</li>
<li>${dry.skipped.map((s) => s.symbol).join(" and ")} have no row: the chart API answers "provider published no daily aggregate" for them. They keep 30 / 70.</li>
<li>The scale is finished sessions; the Station chip includes today's forming bar during the session. The chip's percentile is then "today so far against the days before".</li>
</ul>
<p><b>What was not done.</b> Nothing is deployed, the table is not created, the nightly job is not scheduled, no row is written. The ALLOCATION search, /ranks, /reflow and the Station detail view were left as they are (third call). The lines above are not on the live Hub page: they are here and in the return. No own 10th / 90th guide lines were drawn on the Station's oscillator pane (its look is the Indicator Lab's and its guides are pinned). The Station side had no second reader: its review did not finish on 6 Oct and on 7 Oct it was read by the same session that repaired the Hub side.</p>
<p><b>For the coordinator.</b> Apply <code>supabase/migrations/20261006_rsi_own_percentiles.sql</code> (rollback beside it) · dry run: <code>node scripts/rsi-own-load.mjs --dry</code> · load: the same without <code>--dry</code> and with the two environment keys, or <code>data/rsi-own-load.sql</code> (${dry.rows.length} names, ${esc(closeWords)}) · nightly: deploy <code>supabase/functions/rsi-own-daily</code>, call it once with <code>?dry=1&amp;part=1&amp;of=${ns.shares}</code>, then <code>20261006_rsi_own_daily_cron.sql</code> (${ns.shares * 2} jobs: ${ns.shares} at 19:30–19:35 ET, ${ns.shares} at 07:30–07:35 ET; its rollback removes them all).</p>
<p><b>Tests.</b> Hub <code>tests/rsi-own-extremes.test.mjs</code> (19) and the re-pinned glow test; Station <code>tests/station-rs1-rsi-own-20261006.test.mjs</code> (8). Run on 7 Oct against live: the Hub fails the same 7 tests on this branch as on live (2,018 tests here, 1,999 live, after live took the compare-on-one-screen work at 01:57 ET and it was merged in), the Station the same 18 (1,028 here, 1,020 live).</p>
<p><b>The same lines at the 5 Oct close</b> (the day of the coordinator's numbers; recomputed 7 Oct with the provider's settled bars):</p>
<div class="lines">
${lines(pb5)}
</div>
</div></details>
</div></body></html>
`;
fs.writeFileSync(new URL("RS1-RSI-OWN-EXTREMES.html", here), html);
console.log("page written", html.length, "chars");
