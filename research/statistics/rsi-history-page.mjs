/* Writes deliverables/20260928/rsi-full-history/index.html from rsi-full-history.json (same folder).
   node research/statistics/rsi-history-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../..");
const dir = path.join(root, "deliverables/20260928/rsi-full-history");
const d = JSON.parse(fs.readFileSync(path.join(dir, "rsi-full-history.json"), "utf8"));
const I = d.instruments, SRC = d.sources, C = d.compare;
const KEYS = Object.keys(I).filter((k) => !I[k].missing);

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f1 = (x) => x == null ? "—" : (+x).toFixed(1), f2 = (x) => x == null ? "—" : (+x).toFixed(2);
const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const U = (k) => I[k].unit === "bp" ? " bp" : "%";
/** A signed move: green when up, red when down. */
const mv = (x, unit = "%", dp = 1) => { if (x == null) return "—"; const r = +(+x).toFixed(dp); return r === 0 ? `<span>${(0).toFixed(dp)}${unit}</span>` : `<span class="${r > 0 ? "up" : "dn"}">${r > 0 ? "+" : ""}${r.toFixed(dp)}${unit}</span>`; };
/** A share: green above the any-day share, red below. */
const shv = (x, base) => x == null ? "—" : `<span class="${base == null ? "" : x > base ? "up" : x < base ? "dn" : ""}">${f1(x)}%</span>`;
const ci = (f, unit) => f.medLo == null ? "" : `<span class="ci">${(+f.medLo).toFixed(1)} to ${(+f.medHi).toFixed(1)}</span>`;
const NAME = Object.fromEntries(KEYS.map((k) => [k, I[k].name]));

/* ---------------- headline ---------------- */
const spy = I.SPY, spx = I.SPX;
const fb = (A, h) => A.bottom.fwd[h];
const cmp = C.fullIndex, cmp3 = C.last3Index, cmpF = C.funds, cmpC = C.composite;
const pRow = (c, q) => c.table.find((r) => r.pct === q);
const headline = [
  `<b>SPY's bottom 10% is an RSI of ${f1(spy.lo10)} or lower</b> (2003–2026). SPY enters it about <b>${f1(spy.bottom.perYear)} times a year</b> and usually stays <b>${spy.bottom.lengthMed} sessions</b> (a quarter of the visits last ${f1(spy.bottom.lengthQ3)}+; the longest ${spy.bottom.lengthMax}). The longer S&P 500 index record (1928–2026) says the same: bottom 10% = ${f1(spx.lo10)} or lower, ${f1(spx.bottom.perYear)} visits a year, ${spx.bottom.lengthMed} sessions typical.`,
  `<b>What SPY did next</b> (from the close of the first day in the zone, ${fb(spy, 20).n} visits): 20 sessions later the middle result was ${mv(fb(spy, 20).med)} against ${mv(fb(spy, 20).base.med)} on any day, and it was higher ${f1(fb(spy, 20).up)}% of the time against ${f1(fb(spy, 20).base.up)}%. After 60 sessions: ${mv(fb(spy, 60).med)} against ${mv(fb(spy, 60).base.med)}. On the long S&P index record the edge is smaller: ${mv(fb(spx, 20).med)} against ${mv(fb(spx, 20).base.med)} at 20 sessions, and ${mv(fb(spx, 60).med)} against ${mv(fb(spx, 60).base.med)} at 60 — no better than any day.`,
  `<b>It usually gets a little worse first.</b> In the 20 sessions after SPY enters its bottom 10%, the lowest close was typically ${mv(spy.bottom.fwd.worst20)} below the entry (any day: ${mv(spy.baseline.worst20)}). Entering the zone is a place to start watching, not a low.`,
  `<b>Does the Nasdaq go deeper than the S&P in RSI terms? No — not over the full history either.</b> Nasdaq 100 vs S&P 500 on the same days, 1985–2026: bottom 1% ${f1(pRow(cmp, 1).b)} vs ${f1(pRow(cmp, 1).a)}, bottom 5% ${f1(pRow(cmp, 5).b)} vs ${f1(pRow(cmp, 5).a)}, bottom 10% ${f1(pRow(cmp, 10).b)} vs ${f1(pRow(cmp, 10).a)} — the same floor. At the S&P's ${cmp.lows.length} falls of 10%+, the Nasdaq 100's lowest RSI nearby went below the S&P's only ${cmp.lowsBDeeper} times. Where the Nasdaq differs is the TOP: its top 5% is ${f1(pRow(cmp, 95).b)} vs ${f1(pRow(cmp, 95).a)} (it runs hotter, it does not sink deeper). QQQ vs SPY since 2011 agrees (bottom 5% ${f1(pRow(cmpF, 5).b)} vs ${f1(pRow(cmpF, 5).a)}). The broad Nasdaq Composite is the exception: it does read lower (bottom 5% ${f1(pRow(cmpC, 5).b)} vs ${f1(pRow(cmpC, 5).a)}), all of it from before 2003 (the 1970s–80s record and the dot-com years); since 2003 the Composite and the S&P read the same.`,
  `<b>RSI divergence is rare at true pivots and, so far, not an edge on the S&P.</b> A bullish divergence (price lower low, RSI higher low, confirmed 10 sessions after the low) appeared ${spy.div.bull.count} times on SPY in 23 years and ${spx.div.bull.count} times on the S&P index since 1928. After it, the S&P index did ${mv(spx.div.bull.fwd[20].med)} in 20 sessions — against ${mv(spx.div.lowerLowNoDiv.fwd[20].med)} after lower lows WITHOUT a divergence. Bearish divergence did not mark tops: the S&P rose ${mv(spx.div.bear.fwd[20].med)} in the next 20 sessions after one. Small samples; section 4 has every instrument.`,
  (() => { const now = KEYS.map((k) => [k, I[k].now.pctFull]).filter(([, p]) => p != null).sort((a, b) => a[1] - b[1]);
    const lo = now.filter(([, p]) => p <= 20), hi = now.filter(([, p]) => p >= 80);
    return `<b>Where everything sits today</b> (close of ${spy.to}, against each one's own full history). Low: ${lo.map(([k, p]) => `${esc(I[k].name)} ${f1(I[k].now.rsi)} (bottom ${f1(p)}%)`).join(", ")}. High: ${hi.map(([k, p]) => `${esc(I[k].name)} ${f1(I[k].now.rsi)} (top ${f1(100 - p)}%)`).join(", ")}. Small caps are in their bottom 10% while the Nasdaq 100 is in its top ${f1(100 - I.NDX.now.pctFull)}%.`; })(),
];

/* ---------------- tables ---------------- */
const PCTS = Array.from({ length: 19 }, (_, i) => 5 + 5 * i);
function pctTable(which) {
  let h = `<div class="scroll"><table class="big"><thead><tr><th>Instrument</th><th>Years</th>${PCTS.map((p) => `<th class="${p === 10 || p === 90 ? "hl" : ""}">${p}%</th>`).join("")}<th>Today</th><th>Today is at</th></tr></thead><tbody>`;
  let g = "";
  for (const k of KEYS) {
    const A = I[k], T = A[which];
    if (A.group !== g) { g = A.group; h += `<tr class="grp"><td colspan="${PCTS.length + 4}">${esc(g)}</td></tr>`; }
    const yrs = which === "full" ? `${A.from.slice(0, 4)}–${A.to.slice(0, 4)}` : `${A.recentFrom.slice(0, 4)}–${A.to.slice(0, 4)}`;
    const at = which === "full" ? A.now.pctFull : A.now.pct3y;
    h += `<tr><td class="nm">${esc(A.name)}</td><td>${yrs}</td>${T.steps.map((v, i) => `<td class="${PCTS[i] === 10 || PCTS[i] === 90 ? "hl" : ""}">${f1(v)}</td>`).join("")}<td>${f1(A.now.rsi)}</td><td>${at == null ? "—" : `bottom ${f1(at)}%`}</td></tr>`;
  }
  return h + "</tbody></table></div>";
}
function zoneTable(zone) {
  const H = [5, 10, 20, 60];
  let h = `<div class="scroll"><table class="big"><thead><tr><th rowspan="2">Instrument</th><th rowspan="2">Zone: RSI<br>${zone === "bottom" ? "at or below" : "at or above"}</th><th rowspan="2">Visits<br>a year</th><th rowspan="2">Typical<br>stay</th>${H.map((x) => `<th colspan="2">${x} sessions later</th>`).join("")}<th rowspan="2">Worst close<br>in next 20</th></tr><tr>${H.map(() => `<th>middle result</th><th>higher</th>`).join("")}</tr></thead><tbody>`;
  let g = "";
  for (const k of KEYS) {
    const A = I[k], Z = A[zone], u = U(k);
    if (A.group !== g) { g = A.group; h += `<tr class="grp"><td colspan="13">${esc(g)}</td></tr>`; }
    h += `<tr><td class="nm">${esc(A.name)}</td><td>${f1(zone === "bottom" ? A.lo10 : A.hi90)}</td><td>${f1(Z.perYear)}</td><td>${Z.lengthMed}</td>`;
    for (const x of H) { const f = Z.fwd[x]; h += `<td>${mv(f.med, u)}<div class="base">range ${f.medLo == null ? "—" : `${f1(f.medLo)} to ${f1(f.medHi)}`}</div><div class="base">any day ${mv(f.base.med, u)}</div></td><td>${shv(f.up, f.base.up)}<div class="base">&nbsp;</div><div class="base">any day ${f1(f.base.up)}%</div></td>`; }
    h += `<td>${mv(Z.fwd.worst20, u)}<div class="base">&nbsp;</div><div class="base">any day ${mv(A.baseline.worst20, u)}</div></td></tr>`;
  }
  return h + "</tbody></table></div>";
}
function ownTable() {
  let h = `<div class="scroll"><table><thead><tr><th>Instrument</th><th colspan="3">Bottom 10% by the fixed full-history line</th><th colspan="3">Bottom 10% of its own previous 3 years (no hindsight)</th></tr><tr><th></th><th>visits a year</th><th>20 sessions later</th><th>60 sessions later</th><th>visits a year</th><th>20 sessions later</th><th>60 sessions later</th></tr></thead><tbody>`;
  for (const k of KEYS) { const A = I[k], u = U(k);
    h += `<tr><td class="nm">${esc(A.name)}</td><td>${f1(A.bottom.perYear)}</td><td>${mv(A.bottom.fwd[20].med, u)}</td><td>${mv(A.bottom.fwd[60].med, u)}</td><td>${f1(A.bottomOwn.perYear)}</td><td>${mv(A.bottomOwn.fwd[20].med, u)}</td><td>${mv(A.bottomOwn.fwd[60].med, u)}</td></tr>`; }
  return h + "</tbody></table></div>";
}
function divTable(side) {
  const a = side === "bull" ? "bull" : "bear", b = side === "bull" ? "lowerLowNoDiv" : "higherHighNoDiv";
  const lab = side === "bull" ? ["Bullish divergence", "Lower low,<br>no divergence"] : ["Bearish divergence", "Higher high,<br>no divergence"];
  let h = `<div class="scroll"><table class="big"><thead><tr><th rowspan="2">Instrument</th><th colspan="5">${lab[0]}</th><th colspan="2">${lab[1]}</th><th rowspan="2">Any day<br>20 later</th><th rowspan="2">Check: 5/5 window<br>times · 20 later<br>(no divergence)</th></tr><tr><th>times<br>(a year)</th><th>moved by<br>confirmation</th><th>20 later<br>middle result</th><th>20 later<br>higher</th><th>60 later</th><th>times</th><th>20 later</th></tr></thead><tbody>`;
  let g = "";
  for (const k of KEYS) {
    const A = I[k], D = A.div, X = D[a], Y = D[b], u = U(k), f = X.fwd[20];
    if (A.group !== g) { g = A.group; h += `<tr class="grp"><td colspan="10">${esc(g)}</td></tr>`; }
    h += `<tr><td class="nm">${esc(A.name)}</td><td>${X.count} (${f1(X.perYear)})</td><td>${mv(X.waitCostMed, "%")}</td><td>${mv(f.med, u)}<div class="base">range ${f.medLo == null ? "—" : `${f1(f.medLo)} to ${f1(f.medHi)}`}</div></td><td>${shv(f.up, f.base.up)}</td><td>${mv(X.fwd[60].med, u)}</td><td>${Y.count}</td><td>${mv(Y.fwd[20].med, u)}</td><td>${mv(f.base.med, u)}</td><td>${D.len5[a].count} · ${mv(D.len5[a].fwd[20].med, u)} (${mv(D.len5[b].fwd[20].med, u)})</td></tr>`;
  }
  return h + "</tbody></table></div>";
}
function cmpTable(c, title) {
  return `<h3>${esc(title)} · ${c.from} to ${c.to} · ${n0(c.days)} shared days</h3><div class="scroll"><table><thead><tr><th>RSI percentile</th>${c.table.map((r) => `<th>${r.pct}%</th>`).join("")}</tr></thead><tbody>
<tr><td class="nm">${esc(c.a)}</td>${c.table.map((r) => `<td>${f1(r.a)}</td>`).join("")}</tr>
<tr><td class="nm">${esc(c.b)}</td>${c.table.map((r) => `<td class="${r.b < r.a ? "dn" : r.b > r.a ? "up" : ""}">${f1(r.b)}</td>`).join("")}</tr></tbody></table></div>
<p class="q">${esc(c.b)} lower than ${esc(c.a)} on ${f1(c.shareBLower)}% of all shared days; on the days ${esc(c.a)} sat in its own bottom 10%, ${esc(c.b)} was lower on ${f1(c.shareBLowerWhenA10)}%. At ${esc(c.a)}'s swing lows of 10%+ (${c.lows.length}), ${esc(c.b)}'s lowest RSI within 10 sessions went below ${esc(c.a)}'s ${c.lowsBDeeper} times. Colour on the second row: red = the ${esc(c.b)} value is lower (goes deeper), green = higher.</p>`;
}
function lowsTable(c) {
  const rows = c.lows.slice(-14).reverse();
  return `<div class="scroll"><table><thead><tr><th>S&P swing low</th><th>fall</th><th>S&P lowest RSI (±10 sessions)</th><th>Nasdaq 100 lowest RSI (±10 sessions)</th><th>deeper</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.low}</td><td>${mv(r.depth)}</td><td>${f1(r.rsiA)}</td><td>${f1(r.rsiB)}</td><td>${r.deeperB ? "Nasdaq" : "S&P"}</td></tr>`).join("")}</tbody></table></div>`;
}
function swingTable(A) {
  const row = (b) => `<tr><td>${b.bucket}</td><td>${b.n}</td><td>${f1(b.rsiMed)}</td><td>${f1(b.rsiQ1)} to ${f1(b.rsiQ3)}</td><td>${f1(b.rsiMin)}</td><td>${f1(b.rsiMax)}</td><td>${b.pctMed == null ? "—" : f1(b.pctMed) + "%"}</td><td>${b.barsMed ?? "—"}</td></tr>`;
  const head = (w) => `<thead><tr><th>${w}</th><th>swings</th><th>RSI (middle)</th><th>middle half</th><th>lowest</th><th>highest</th><th>percentile (middle)</th><th>sessions</th></tr></thead>`;
  return `<div class="two"><div><h4>RSI at the swing LOW, by how far it fell (${A.swings.nDowns} declines)</h4><div class="scroll"><table>${head("fall")}<tbody>${A.swings.downs.map(row).join("")}</tbody></table></div></div>
<div><h4>RSI at the swing HIGH, by how far it rose (${A.swings.nUps} rises)</h4><div class="scroll"><table>${head("rise")}<tbody>${A.swings.ups.map(row).join("")}</tbody></table></div></div></div>`;
}
function recentTable(A) {
  const u = U(A.key);
  const z = (Z, w) => Z.recent.slice().reverse().map((e) => `<tr><td>${w}</td><td>${e.start}</td><td>${e.length}</td><td>${f1(e.rsiAtEntry)}</td><td>${mv(e.f20, u)}</td><td>${mv(e.f60, u)}</td></tr>`).join("");
  const dv = (list, w) => list.slice().reverse().map((x) => `<tr><td>${w}</td><td>${x.d1} → ${x.d2}</td><td>${f2(x.p1)} → ${f2(x.p2)}</td><td>${f1(x.rsi1)} → ${f1(x.rsi2)}</td><td>${x.dConf}</td></tr>`).join("");
  return `<div class="two"><div><h4>Latest zone visits</h4><div class="scroll"><table><thead><tr><th>zone</th><th>entered</th><th>stayed</th><th>RSI</th><th>20 later</th><th>60 later</th></tr></thead><tbody>${z(A.bottom, "bottom 10%")}${z(A.top, "top 10%")}</tbody></table></div></div>
<div><h4>Latest divergences (pivot → pivot)</h4><div class="scroll"><table><thead><tr><th>kind</th><th>pivots</th><th>price</th><th>RSI</th><th>known on</th></tr></thead><tbody>${dv(A.div.bullRecent, "bullish")}${dv(A.div.bearRecent, "bearish")}</tbody></table></div></div></div>`;
}
const cards = KEYS.map((k) => { const A = I[k], S = SRC[k];
  return `<section class="card" id="c-${k}" data-k="${k}"><h3>${esc(A.name)} <span class="q">· ${A.from} to ${A.to} · ${n0(A.sessions)} sessions · today RSI ${f1(A.now.rsi)}, bottom ${f1(A.now.pctFull)}% of its history</span></h3>
<div class="tog"><button data-m="recent" class="on">last 3 years (every day)</button><button data-m="full">full history${A.chart.step > 1 ? ` (every ${A.chart.step}th day)` : ""}</button></div>
<div class="chartbox" id="ch-${k}"></div>
${swingTable(A)}${recentTable(A)}
<p class="q">Source: ${esc(S.via)} · ${esc(S.provider)} ${esc(S.providerSymbol)} · ${esc(S.basis)}${S.cleaned.length ? ` · ${S.cleaned.length} impossible wick${S.cleaned.length > 1 ? "s" : ""} clamped (${S.cleaned.map((c) => c.date).join(", ")})` : ""}${S.dropped ? ` · ${esc(S.holeNote)}` : ""}${S.onlyCloseBars ? ` · ${n0(S.onlyCloseBars)} early bars carry only a close (no high/low), so early pivots are close-based` : ""}${S.weekendDropped.length ? ` · ${S.weekendDropped.length} weekend prints dropped` : ""}.</p></section>`; }).join("\n");

/* chart payload: only what the charts need */
const CH = Object.fromEntries(KEYS.map((k) => [k, { recent: I[k].chart.recent, full: I[k].chart.full, lo: I[k].lo10, hi: I[k].hi90, bs: I[k].bottom.starts, ts: I[k].top.starts, bd: I[k].div.bullDates, xd: I[k].div.bearDates, unit: I[k].unit }]));
const cleanedAll = Object.entries(SRC).flatMap(([k, s]) => s.cleaned.map((c) => `${k} ${c.date} (${c.fixed} ${c.fixed.includes("low") ? c.l : c.h} against a close of ${c.c})`));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RSI Full History</title>
<style>
:root{--bg:#07070C;--ink:#B4B4C6;--hi:#C8C8D2;--dim:#9C9CAE;--line:#24242E;--panel:#0B0B12;--up:#00FFA3;--dn:#FF2D55}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px}
main{max-width:1640px}
h1{font-size:34px;margin:0 0 6px;color:var(--hi)}h2{font-size:26px;margin:48px 0 8px;color:var(--hi)}h3{font-size:20px;margin:26px 0 6px;color:var(--hi)}h4{font-size:15px;margin:16px 0 4px;color:var(--hi);font-family:ui-monospace,Menlo,monospace}
p,li{max-width:1120px}.q{color:var(--dim);font-size:13px;font-weight:400}
ol.lead{font-size:19px;color:var(--hi);max-width:1240px;padding-left:24px}ol.lead li{margin:0 0 14px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1240px;color:var(--hi)}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid var(--line);padding:6px 9px;text-align:right;vertical-align:top;white-space:nowrap}
th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace;text-align:center}
td.nm{text-align:left;color:var(--hi);position:sticky;left:0;background:var(--bg);z-index:1}table.big{font-size:15px}
tr.grp td{background:#0F0F18;color:var(--dim);font-family:ui-monospace,Menlo,monospace;font-size:12px;text-align:left;letter-spacing:.06em;text-transform:uppercase}
th.hl,td.hl{background:#12121C;color:var(--hi);font-weight:600}
.base{color:var(--dim);font-size:11px}.ci{color:var(--dim);font-size:12px}
.up{color:var(--up)}.dn{color:var(--dn)}
.card{border-top:1px solid var(--line);padding:6px 0 18px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:24px}.two>div{min-width:0}
.tog button{background:#12121C;color:var(--ink);border:1px solid #2A2A36;font:13px ui-monospace,Menlo,monospace;padding:6px 12px;cursor:pointer;margin-right:6px}.tog button.on{border-color:#8A8A9E;color:var(--hi)}
.chartbox{width:100%}.chartbox svg{display:block;width:100%;height:auto;background:var(--panel);border:1px solid #1E1E28;margin:10px 0}
.pick{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.pick a{font:13px ui-monospace,Menlo,monospace;color:var(--ink);border:1px solid #2A2A36;padding:4px 9px;text-decoration:none}
dl{max-width:1180px}dt{color:var(--hi);font-weight:600;margin-top:12px}dd{margin:2px 0 0 0}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
@media(max-width:700px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table,table.big{font-size:12px}th,td{padding:5px 6px}.two{grid-template-columns:1fr}code{overflow-wrap:anywhere}}
</style></head><body><main>
<h1>RSI on the full history: S&P to 1928, Nasdaq, VIX, oil, gold and the rest</h1>
<div class="q">Statistics · 28 Sep 2026 · built ${d.generated.slice(0, 16).replace("T", " ")} UTC · RSI(14), Wilder, daily closes · data to ${spy.to} · research, not rules · nothing here predicts</div>
<div class="status"><b>STATUS · every table below is computed from real daily bars; ${KEYS.length} instruments.</b> Green means up, red means down. A share (“higher”) is green when it beats the same share on any day and red when it falls short. “Middle result” is the median: half the cases did better, half worse. The “90% range” shows how sure the middle result is; if the any-day number sits inside that range, the difference may be luck.</div>

<h2>The answers you asked for</h2>
<ol class="lead">${headline.map((l) => `<li>${l}</li>`).join("\n")}</ol>

<h2>1 · What RSI number is “bottom X%”? Full history</h2>
<p>Read across: for SPY, 10% of all days since 2003 closed with an RSI at or below the number under “10%”. The 10% and 90% columns are highlighted because sections 2 and 3 use them. “Today is at” = where the latest reading (${spy.to}) sits in that instrument's own history.</p>
${pctTable("full")}
<h2>1b · The same table, last 3 years only</h2>
<p>756 sessions (Bitcoin: 1,095 calendar days). Compare a row with the one above to see whether the recent market sits higher or lower than its long history.</p>
${pctTable("recent")}

<h2>2 · Visits to the bottom 10%, and what price did next</h2>
<p>A visit starts on the first close at or below the bottom-10% line and ends on the last close there; coming back within 5 sessions counts as the same visit. Price results are close to close from the first day of the visit. Yields (US 10-year) are in basis points (100 bp = 1 percentage point).</p>
${zoneTable("bottom")}
<h2>3 · Visits to the top 10%, and what price did next</h2>
${zoneTable("top")}
<h3>Check without hindsight</h3>
<p>The fixed lines above are set from the whole history, which nobody knew at the time. This check uses only what was known each day: the RSI was in the bottom 10% of its own previous 3 years.</p>
${ownTable()}

<h2>4 · RSI divergence at confirmed pivots</h2>
<p><b>Bullish divergence:</b> price makes a swing low below the previous swing low (within 60 sessions), but RSI at the new low is higher than at the old one. <b>Bearish:</b> price makes a higher swing high while RSI makes a lower one. A swing low is only known <b>10 sessions later</b> (it needs 10 higher lows on each side), so every result starts from the close on that confirmation day, and “price already moved by confirmation” shows how far price had bounced (or fell) from the pivot by then. The comparison that matters is the next column pair: the same kind of pivot WITHOUT a divergence.</p>
<h3>Bullish</h3>${divTable("bull")}
<h3>Bearish</h3>${divTable("bear")}

<h2>5 · Nasdaq against the S&P, in RSI terms</h2>
${cmpTable(C.fullIndex, "Nasdaq 100 index vs S&P 500 index, full shared history")}
${cmpTable(C.since2003Index, "Same two indexes, since SPY's history starts")}
${cmpTable(C.last3Index, "Same two indexes, last 3 years")}
${cmpTable(C.funds, "QQQ vs SPY (the funds)")}
${cmpTable(C.composite, "Nasdaq Composite vs S&P 500 index")}
<h3>The S&P's latest falls of 10%+, side by side</h3>${lowsTable(C.fullIndex)}

<h2>6 · Every instrument: chart and swing tables</h2>
<p>Top: closing price (log scale), each day's segment green if it closed up and red if down. Bottom: RSI(14); the dashed green line is the bottom-10% line, the dashed red line the top-10% line (full history). Triangles mark the first day of each visit: ▲ green under the RSI = bottom 10%, ▼ red over it = top 10%. Rings on the price mark divergence pivots: green = bullish, red = bearish.</p>
<div class="pick">${KEYS.map((k) => `<a href="#c-${k}">${esc(I[k].name)}</a>`).join("")}</div>
${cards}

<h2>7 · How this was done, and what could be wrong</h2>
<dl>
<dt>RSI</dt><dd>RSI(14) with Wilder's smoothing on daily closes (the same arithmetic the Hub and the S7–S9 studies use, <code>research/statistics/stats.mjs</code>). The first 14 sessions of each history have no RSI.</dd>
<dt>Where the prices come from</dt><dd>SPY, QQQ, IWM, DIA, TLT: the chart API's daily bars (Massive), split-adjusted, 2003 on. VIX, oil (WTI), gold, silver, Bitcoin, the dollar index and the 10-year yield: the chart API's full FMP history. S&P 500 index (1928 on), Nasdaq 100 (1985 on), Nasdaq Composite (1971 on), Russell 2000 (1987 on), Dow (1985 on): FMP's index history, fetched on 28 Sep from inside the Fly bar-service machine (the key never left Fly). All saved outside the repo in <code>stats-cache/daily-bars-rsi/</code>.</dd>
<dt>Pivots and swings</dt><dd>S9's rule: a swing low has a low below the 10 bars before it and at or below the 10 after it (a high mirrors it). Section 6's swing tables use the S9 swings (alternating, each end moved to the true extreme), which is descriptive. Section 4 uses only raw confirmed pivots and acts 10 sessions later — no look-ahead. A 5/5 window is shown as a check.</dd>
<dt>The 90% range</dt><dd>Month-clustered bootstrap: the visits are grouped by the calendar month they started in, whole months are drawn at random with replacement 2,000 times (fixed seed), and the middle result is recomputed each time. The range is the 5th to 95th of those. It is shown for the signal only; the any-day number rests on thousands of days and is treated as fixed.</dd>
<dt>What could be wrong</dt><dd><ul>
<li><b>Hindsight in the lines.</b> The bottom-10% and top-10% lines are set from the full history. The no-hindsight check (end of section 3) is the honest version; its edges are smaller.</li>
<li><b>Overlap.</b> 60-session results from visits a month apart share most of their days, so they are not independent. The month clustering handles part of that, not all; treat 60-session ranges as too narrow.</li>
<li><b>Old data.</b> Before about 1983 the S&P index (and before 1985 the Composite) has closes only, no highs or lows; RSI is fine (it uses closes) but early pivots are close-based. The Nasdaq Composite's lower RSI floor comes from before 2003: at the S&P's 10%+ falls before 1985 the Composite went deeper 18 times out of 20, and since 2003 the two floors match.</li>
<li><b>Bad prints.</b> ${cleanedAll.length} impossible wicks were clamped to the bar's body (the 14 S9 listed plus oil's negative April 2020 low): ${esc(cleanedAll.join("; "))}. VIX is exempt: its 50%+ intraday spikes are real (5 Aug 2024). One VIX low (10 Oct 2008, 28.13) looks wrong but is left as served; it only affects VIX pivots, not RSI.</li>
<li><b>QQQ's hole.</b> The chart API has no QQQ bars from Dec 2004 to Mar 2011, so QQQ starts in 2011; the Nasdaq 100 index covers 1985 on.</li>
<li><b>Weekend prints.</b> The chart API serves Sunday bars for the dollar, oil, gold and silver since late 2024 (extra bars on days with no session). They were dropped here; the Station may still draw them.</li>
<li><b>Prices only.</b> No dividends. Oil is FMP's continuous front contract (roll jumps included).</li>
<li><b>Small samples.</b> Divergences at 10/10 pivots are rare (a handful a year at most); read the 90% range before the middle result.</li>
</ul></dd>
<dt>What was not done</dt><dd><ul>
<li>No buy or sell rule is proposed. Nothing here is back-tested as a strategy.</li>
<li>Hidden divergence (price higher low, RSI lower low) and divergence on weekly bars were not measured.</li>
<li>Weighting by recency or market cap (Alan's 27 Sep note) is not applied; every year counts the same.</li>
<li>Pre-1928 S&P, put/call, CNN Fear & Greed and VIX term structure are not in this study.</li>
<li>No database write, no deploy. The page is on the branch for the coordinator.</li>
</ul></dd>
<dt>Files</dt><dd><code>research/statistics/rsi-history.mjs</code> (the engine), <code>research/statistics/rsi-history-page.mjs</code> (this page), <code>tests/statistics-rsi-history.test.mjs</code>, and the full numbers in <code>rsi-full-history.json</code> next to this page.</dd>
</dl>
</main>
<script>
const CH=${JSON.stringify(CH)};
const UP="#00FFA3",DN="#FF2D55",INK="#9C9CAE",GRID="#24242E";
function t(x,y,s,a,c,fs){return '<text x="'+x+'" y="'+y+'" fill="'+(c||INK)+'" font-size="'+(fs||12)+'" font-family="ui-monospace,Menlo,monospace" text-anchor="'+(a||"start")+'">'+s+'</text>';}
function draw(k,mode){
  const D=CH[k],rows=D[mode],n=rows.length; if(!n) return;
  const box=document.getElementById("ch-"+k), cw=box.clientWidth||1560, W=Math.max(340,Math.min(1600,cw)), ph=W<700;
  const H=ph?400:560,L=ph?46:64,R=ph?8:18,T=16,PH=ph?210:330,G=26,RH=H-T-PH-G-30,Bt=H-30;
  const ps=rows.map(r=>r[1]).filter(v=>v!=null), pos=ps.every(v=>v>0), lg=v=>pos?Math.log(v):v;
  let y0=Math.min(...ps.map(lg)),y1=Math.max(...ps.map(lg)); const pad=(y1-y0)*0.04||1; y0-=pad; y1+=pad;
  const X=i=>L+(W-L-R)*i/Math.max(1,n-1), YP=v=>T+PH*(1-(lg(v)-y0)/(y1-y0)), rt=T+PH+G, YR=v=>rt+RH*(1-v/100);
  let s='<svg viewBox="0 0 '+W+' '+H+'" role="img">';
  // price grid
  const ticks=[]; const A0=pos?Math.exp(y0):y0,B0=pos?Math.exp(y1):y1;
  if(pos&&B0/A0>6){const e=Math.pow(10,Math.floor(Math.log10(A0)));for(let p=e;p<=B0*10;p*=10)for(const m of [1,2,5]){const v=m*p;if(v>=A0&&v<=B0)ticks.push(v);}}
  else {const raw=(B0-A0)/6,mag=Math.pow(10,Math.floor(Math.log10(raw))),st=[1,2,2.5,5,10].map(m=>m*mag).find(x=>x>=raw);for(let v=Math.ceil(A0/st)*st;v<=B0;v+=st)ticks.push(+v.toFixed(6));}
  ticks.sort((a,b)=>a-b).forEach(v=>{s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+YP(v)+'" y2="'+YP(v)+'" stroke="'+GRID+'"/>'+t(L-6,YP(v)+4,v>=100?Math.round(v).toLocaleString("en-US"):(+v.toFixed(2)),"end");});
  // year marks
  const span=(Date.parse(rows[n-1][0])-Date.parse(rows[0][0]))/31557600000, ppy=(W-L-R)/Math.max(0.5,span), every=[1,2,5,10,20,25].find(e=>e*ppy>=46)||25;
  let ly="";
  for(let i=0;i<n;i++){const y=rows[i][0].slice(0,4);if(y!==ly){ly=y;if(+y%every===0&&!(i===0&&rows[0][0].slice(5,7)!=="01")){s+='<line x1="'+X(i)+'" x2="'+X(i)+'" y1="'+T+'" y2="'+(rt+RH)+'" stroke="'+GRID+'"/>'+t(X(i)+3,Bt+18,y);}}}
  // price, coloured by direction
  for(let i=1;i<n;i++){const a=rows[i-1][1],b=rows[i][1];if(a==null||b==null)continue;s+='<line x1="'+X(i-1).toFixed(1)+'" y1="'+YP(a).toFixed(1)+'" x2="'+X(i).toFixed(1)+'" y2="'+YP(b).toFixed(1)+'" stroke="'+(b>=a?UP:DN)+'" stroke-width="'+(mode==="full"?1.8:1.3)+'"/>';}
  // RSI panel
  [30,50,70].forEach(v=>{s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+YR(v)+'" y2="'+YR(v)+'" stroke="'+GRID+'"/>'+t(L-6,YR(v)+4,v,"end");});
  s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+YR(D.lo)+'" y2="'+YR(D.lo)+'" stroke="'+UP+'" stroke-dasharray="6 5" stroke-width="1.3"/>'+t(W-R-4,YR(D.lo)+15,"bottom 10% · "+D.lo,"end",UP,13);
  s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+YR(D.hi)+'" y2="'+YR(D.hi)+'" stroke="'+DN+'" stroke-dasharray="6 5" stroke-width="1.3"/>'+t(W-R-4,YR(D.hi)-6,"top 10% · "+D.hi,"end",DN,13);
  for(let i=1;i<n;i++){const a=rows[i-1][2],b=rows[i][2];if(a==null||b==null)continue;s+='<line x1="'+X(i-1).toFixed(1)+'" y1="'+YR(a).toFixed(1)+'" x2="'+X(i).toFixed(1)+'" y2="'+YR(b).toFixed(1)+'" stroke="'+(b>=a?UP:DN)+'" stroke-width="1.1"/>';}
  // markers: map a date to the nearest row at or after it
  const dates=rows.map(r=>r[0]); const at=d=>{let lo=0,hi=n-1;if(d<dates[0]||d>dates[n-1])return -1;while(lo<hi){const m=(lo+hi)>>1;if(dates[m]<d)lo=m+1;else hi=m;}return lo;};
  D.bs.forEach(d=>{const i=at(d);if(i<0)return;const x=X(i),y=rt+RH+2;s+='<path d="M'+x+' '+(y-9)+' L'+(x-5)+' '+y+' L'+(x+5)+' '+y+' Z" fill="'+UP+'"/>';});
  D.ts.forEach(d=>{const i=at(d);if(i<0)return;const x=X(i),y=rt-2;s+='<path d="M'+x+' '+(y+9)+' L'+(x-5)+' '+y+' L'+(x+5)+' '+y+' Z" fill="'+DN+'"/>';});
  const ring=(pair,c)=>{const i=at(pair[0]);if(i<0||rows[i][1]==null)return;s+='<circle cx="'+X(i)+'" cy="'+YP(rows[i][1])+'" r="'+(mode==="full"?3.5:7)+'" fill="none" stroke="'+c+'" stroke-width="'+(mode==="full"?1.2:2)+'"/>';};
  D.bd.forEach(p=>ring(p,UP)); D.xd.forEach(p=>ring(p,DN));
  s+=t(L+4,T+14,(D.unit==="bp"?"yield %":k==="VIX"||k==="DXY"?"level":"price")+(pos?" (log)":"")+" · "+rows[0][0]+" to "+rows[n-1][0],"start","#C8C8D2",13)+t(L+4,rt+RH-6,"RSI(14)","start","#C8C8D2",13);
  document.getElementById("ch-"+k).innerHTML=s+"</svg>";
}
const MODE={};
document.querySelectorAll(".card").forEach(c=>{const k=c.dataset.k;MODE[k]="recent";draw(k,"recent");c.querySelectorAll(".tog button").forEach(b=>b.onclick=()=>{c.querySelectorAll(".tog button").forEach(x=>x.classList.toggle("on",x===b));MODE[k]=b.dataset.m;draw(k,MODE[k]);});});
let rz;addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>Object.keys(MODE).forEach(k=>draw(k,MODE[k])),200);});
</script>
</body></html>`;
fs.writeFileSync(path.join(dir, "index.html"), html);
console.log(`wrote ${path.join(dir, "index.html")} (${(html.length / 1024).toFixed(0)} KB)`);
