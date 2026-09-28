/* Writes deliverables/20260927/research-program/RESEARCH-PROGRAM.html from data/s9-research.json.
   node research/statistics/s9-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../..");
const d = JSON.parse(fs.readFileSync(path.join(here, "data/s9-research.json"), "utf8"));
const outDir = path.join(root, "deliverables/20260927/research-program"); fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "RESEARCH-PROGRAM.html");

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const f1 = (x) => x == null ? "—" : (+x).toFixed(1);
const f2 = (x) => x == null ? "—" : (+x).toFixed(2);
const sgn = (x, dp = 1) => x == null ? "—" : `<span class="${x > 0 ? "up" : x < 0 ? "dn" : ""}">${x > 0 ? "+" : ""}${(+x).toFixed(dp)}%</span>`;
const sh = (x, base) => x == null ? "—" : `<span class="${base == null ? "" : x > base ? "up" : x < base ? "dn" : ""}">${f1(x)}%</span>`;
const pc = (x) => x == null ? "—" : f1(x) + "%";
const LN = { e13: "13 EMA", e21: "21 EMA", s50: "50 SMA", s200: "200 SMA", none: "none (stayed above all four)" };
const NAME = { SPY: "SPY · S&P 500", QQQ: "QQQ · Nasdaq 100", IWM: "IWM · Russell 2000", BTCUSD: "BTC · Bitcoin (FMP, 7-day)" };
const I = d.instruments, B = d.band, LL = d.leadLag;

/* ---------- SVG helpers (monochrome; lines follow daily up = green, down = red) ---------- */
const UP = "#00FFA3", DN = "#FF2D55", INK = "#9C9CAE", GRID = "#24242E";
function svgOpen(w, h, cls = "") { return `<svg class="chart ${cls}" viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">`; }
const tx = (x, y, s, a = "start", c = INK, fs = 11) => `<text x="${x}" y="${y}" fill="${c}" font-size="${fs}" font-family="ui-monospace,Menlo,monospace" text-anchor="${a}">${esc(s)}</text>`;

/* Chart A · SPY since 2018: close (segments coloured by the day's direction), 200-day (coloured by its own direction), the swings. */
function chartSwings() {
  const C = d.chart?.spyClose ?? [], S = d.chart?.spySwings ?? []; if (!C.length) return "";
  const W = 1400, H = 420, L = 56, R = 16, T = 18, Bt = 34;
  const ys = C.map((r) => r[1]).concat(C.map((r) => r[2]).filter(Boolean));
  const y0 = Math.min(...ys) * 0.98, y1 = Math.max(...ys) * 1.02;
  const X = (i) => L + (W - L - R) * i / (C.length - 1), Y = (v) => T + (H - T - Bt) * (1 - (v - y0) / (y1 - y0));
  const byDate = new Map(C.map((r, i) => [r[0], i]));
  let s = svgOpen(W, H);
  for (let v = Math.ceil(y0 / 50) * 50; v <= y1; v += 50) s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/>` + tx(L - 6, Y(v) + 4, String(v), "end");
  for (let i = 1; i < C.length; i++) {
    if (C[i][2] && C[i - 1][2]) s += `<line x1="${X(i - 1)}" y1="${Y(C[i - 1][2])}" x2="${X(i)}" y2="${Y(C[i][2])}" stroke="${C[i][2] >= C[i - 1][2] ? UP : DN}" stroke-opacity=".45" stroke-width="1.2"/>`;
    s += `<line x1="${X(i - 1)}" y1="${Y(C[i - 1][1])}" x2="${X(i)}" y2="${Y(C[i][1])}" stroke="${C[i][1] >= C[i - 1][1] ? UP : DN}" stroke-opacity=".9" stroke-width="1"/>`;
  }
  for (let i = 1; i < S.length; i++) { const a = S[i - 1], b = S[i]; if (!byDate.has(a.d) || !byDate.has(b.d)) continue;
    s += `<line x1="${X(byDate.get(a.d))}" y1="${Y(a.p)}" x2="${X(byDate.get(b.d))}" y2="${Y(b.p)}" stroke="${b.p >= a.p ? UP : DN}" stroke-width="2.2"/>`; }
  for (const p of S) if (byDate.has(p.d)) s += `<circle cx="${X(byDate.get(p.d))}" cy="${Y(p.p)}" r="3" fill="${p.t === "L" ? DN : UP}"/>`;
  let lastYear = ""; for (let i = 0; i < C.length; i++) { const yr = C[i][0].slice(0, 4); if (yr !== lastYear) { lastYear = yr; s += tx(X(i), H - 12, yr); s += `<line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - Bt}" stroke="${GRID}"/>`; } }
  s += tx(W - R, T + 12, "SPY close · 200-day (faint) · swings from 10/10 pivots, dots = the pivots", "end");
  return s + "</svg>";
}
/* Chart B · depth vs RSI at the low, one panel per instrument. Dot colour = whether the rebound made a new high. */
function chartScatter() {
  const W = 1400, H = 300, panels = ["SPY", "QQQ", "IWM", "BTCUSD"], pw = W / 4, L = 44, T = 22, Bt = 30;
  let s = svgOpen(W, H);
  panels.forEach((sym, pi) => {
    const recs = (I[sym]?.all ?? []).filter((r) => r.rsiLow != null); const x0 = pi * pw;
    const xmin = sym === "BTCUSD" ? -85 : -50, xmax = 0, ymin = 10, ymax = 75;
    const X = (v) => x0 + L + (pw - L - 10) * (v - xmin) / (xmax - xmin), Y = (v) => T + (H - T - Bt) * (1 - (v - ymin) / (ymax - ymin));
    for (const g of [20, 30, 40, 50, 60, 70]) s += `<line x1="${x0 + L}" x2="${x0 + pw - 10}" y1="${Y(g)}" y2="${Y(g)}" stroke="${GRID}"/>` + tx(x0 + L - 4, Y(g) + 4, String(g), "end");
    for (const g of sym === "BTCUSD" ? [-80, -60, -40, -20] : [-40, -30, -20, -10]) s += tx(X(g), H - 10, g + "%", "middle");
    for (const r of recs) s += `<circle cx="${X(Math.max(xmin, r.depth))}" cy="${Y(r.rsiLow)}" r="3.2" fill="${r.newHigh ? UP : DN}" fill-opacity=".8"/>`;
    s += tx(x0 + L, 14, `${NAME[sym]} · ${recs.length} declines`, "start", "#C8C8D2", 12);
  });
  return s + "</svg>" + `<p class="q">x = depth of the decline · y = RSI(14) at the low · green = the rebound made a new high, red = it did not.</p>`;
}
/* Chart C · 200-day bands: median 60-session return by band, SPY and QQQ. */
function chartBands() {
  const W = 1400, H = 260, L = 60, T = 24, Bt = 46, syms = ["SPY", "QQQ"], bands = B.SPY.full.bands.map((b) => b.band);
  const vals = syms.flatMap((s) => B[s].full.bands.map((b) => b.med60)).filter((x) => x != null);
  const vmin = Math.min(0, ...vals) - 1, vmax = Math.max(...vals) + 1, Y = (v) => T + (H - T - Bt) * (1 - (v - vmin) / (vmax - vmin));
  const gw = (W - L - 16) / bands.length, bw = gw / 3;
  let s = svgOpen(W, H);
  for (const g of [-2, 0, 2, 4, 6]) if (g >= vmin && g <= vmax) s += `<line x1="${L}" x2="${W - 16}" y1="${Y(g)}" y2="${Y(g)}" stroke="${GRID}"/>` + tx(L - 6, Y(g) + 4, (g > 0 ? "+" : "") + g + "%", "end");
  bands.forEach((band, bi) => {
    syms.forEach((sym, si) => { const v = B[sym].full.bands[bi].med60; if (v == null) return; const x = L + bi * gw + bw * (0.5 + si);
      s += `<rect x="${x}" y="${Math.min(Y(v), Y(0))}" width="${bw - 3}" height="${Math.abs(Y(v) - Y(0))}" fill="${v >= 0 ? UP : DN}" fill-opacity="${si ? .55 : .9}"/>`;
      s += tx(x + bw / 2 - 1, Y(Math.max(v, 0)) - 4, (v > 0 ? "+" : "") + f1(v), "middle", INK, 10); });
    s += tx(L + bi * gw + gw / 2, H - 28, band.replace("more than ", ">").replace(" below", " below").replace(" above", " above"), "middle", INK, 11);
  });
  s += tx(L, 14, "Median return 60 sessions later, by distance from the 200-day: SPY solid · QQQ faint", "start", "#C8C8D2", 12);
  return s + "</svg>";
}
/* Chart D · breaking point: share of first closes below −X% that fell another 10% before reclaiming the 200-day. */
function chartBreak() {
  const W = 1400, H = 240, L = 60, T = 24, Bt = 40, rows = B.SPY.full.breaks.filter((r) => r.n >= 5), Q = B.QQQ.full.breaks.filter((r) => r.n >= 5);
  const xs = rows.map((r) => r.X), X = (v) => L + (W - L - 16) * v / 12, Y = (v) => T + (H - T - Bt) * (1 - v / 60);
  let s = svgOpen(W, H);
  for (const g of [0, 20, 40, 60]) s += `<line x1="${L}" x2="${W - 16}" y1="${Y(g)}" y2="${Y(g)}" stroke="${GRID}"/>` + tx(L - 6, Y(g) + 4, g + "%", "end");
  for (const x of xs) s += tx(X(x), H - 22, x ? "−" + x + "%" : "below", "middle");
  const path = (R, key, op) => { let p = ""; R.forEach((r, i) => { p += `${i ? "L" : "M"}${X(r.X)},${Y(r[key])}`; }); return `<path d="${p}" fill="none" stroke="${DN}" stroke-opacity="${op}" stroke-width="2"/>`; };
  s += path(rows, "another10", .95) + path(Q, "another10", .45);
  for (const r of rows) s += `<circle cx="${X(r.X)}" cy="${Y(r.another10)}" r="3" fill="${DN}"/>` + tx(X(r.X), Y(r.another10) - 8, `${f1(r.another10)}% · n ${r.n}`, "middle", INK, 10);
  s += tx(L, 14, "Share of first closes below −X% (from the 200-day) that fell at least another 10% before the close was back above the 200-day: SPY solid · QQQ faint", "start", "#C8C8D2", 12);
  return s + "</svg>";
}

/* ---------- tables ---------- */
function depthTable(sym, key = "depthTable") {
  const T = I[sym]?.[key]; if (!T) return `<p>${sym}: no bars.</p>`;
  const isBtc = sym === "BTCUSD";
  return `<div class="scroll"><table><tr><th>Depth of the decline</th><th>Declines</th><th>Middle depth</th><th>Middle length (${isBtc ? "days" : "sessions"})</th><th>RSI(14) at the low<br><span class="q">middle · quarter to three-quarter</span></th><th>Own RSI percentile at the low</th><th>Lowest cloud line the wick reached</th><th>Closed below the 200-day at the low</th><th>Volume at the low ÷ 50-day</th>${isBtc ? "" : "<th>VIX at the low (middle)</th>"}<th>Rebound to the next swing high</th><th>Retraced (middle)</th><th>Rebound made a new high</th></tr>
${T.map((r) => `<tr><td><b>${r.bucket}</b></td><td>${r.n}</td><td>${r.n ? sgn(r.depthMed) : "—"}</td><td>${r.n ? n0(isBtc ? r.daysMed : r.barsMed) : "—"}</td><td>${r.n ? `${f1(r.rsiLowMed)} <span class="q">· ${f1(r.rsiLowQ1)}–${f1(r.rsiLowQ3)}</span>` : "—"}</td><td>${r.n ? pc(r.rsiPctLowMed) : "—"}</td><td>${r.n ? ["e13", "e21", "s50", "s200", "none"].filter((k) => r.lines[k] > 0).map((k) => `${LN[k].split(" (")[0]} ${f1(r.lines[k])}%`).join("<br>") : "—"}</td><td>${r.n ? pc(r.below200) : "—"}</td><td>${r.n ? f2(r.volRatioMed) : "—"}</td>${isBtc ? "" : `<td>${r.n ? f1(r.vixLowMed) : "—"}</td>`}<td>${r.n ? sgn(r.reboundMed) : "—"}</td><td>${r.n ? pc(r.retraceMed) : "—"}</td><td>${r.n ? pc(r.newHigh) : "—"}</td></tr>`).join("\n")}</table></div>`;
}
function biggestTable(sym, n = 12) {
  const rows = (I[sym]?.biggest ?? []).slice(0, n), isBtc = sym === "BTCUSD";
  return `<div class="scroll"><table><tr><th>Swing high</th><th>Swing low</th><th>Depth</th><th>${isBtc ? "Days" : "Sessions"}</th><th>RSI at the low</th><th>Own percentile</th><th>Lowest line reached</th><th>Cloud order at the high</th>${isBtc ? "" : "<th>VIX peak in the decline</th>"}<th>Rebound</th><th>Retraced</th><th>New high</th><th>Low confirmed on</th></tr>
${rows.map((r) => `<tr><td>${r.hi}</td><td><b>${r.lo}</b></td><td>${sgn(r.depth)}</td><td>${isBtc ? r.days : r.bars}</td><td>${f1(r.rsiLow)}</td><td>${r.rsiPctLow == null ? "—" : pc(r.rsiPctLow)}</td><td>${LN[r.line].split(" (")[0]}</td><td>${r.stateAtHigh ?? "—"}</td>${isBtc ? "" : `<td>${f1(r.vixMax)}</td>`}<td>${sgn(r.rebound)}</td><td>${pc(r.retrace)}</td><td>${r.newHigh == null ? "—" : r.newHigh ? '<span class="up">yes</span>' : '<span class="dn">no</span>'}</td><td>${r.confirmedAt}</td></tr>`).join("\n")}</table></div>`;
}
function leadTable(L) {
  const S = L.summary;
  return `<div class="scroll"><table><tr><th>Against SPY's low</th><th>Matched (a low within 30 days)</th><th>Turned earlier</th><th>Same day</th><th>Turned later</th><th>Middle offset (days)</th></tr>
${["QQQ", "IWM", "BTCUSD"].map((s) => `<tr><td><b>${NAME[s]}</b></td><td>${S[s].matched} of ${S[s].of}</td><td>${S[s].earlier}</td><td>${S[s].same}</td><td>${S[s].later}</td><td>${S[s].medianOffset == null ? "—" : S[s].medianOffset}</td></tr>`).join("\n")}</table></div>
<div class="scroll"><table><tr><th>SPY swing low</th><th>SPY depth</th><th>SPY RSI at the low</th><th>Line reached</th><th>VIX peak</th><th>QQQ low (days vs SPY)</th><th>IWM low (days vs SPY)</th><th>BTC low (days vs SPY)</th><th>First equity index to turn</th><th>SPY rebound</th></tr>
${L.rows.map((r) => { const o = (s) => r.others[s] ? `${r.others[s].lo} <span class="q">(${r.others[s].offset > 0 ? "+" : ""}${r.others[s].offset} · ${f1(r.others[s].depth)}%)</span>` : '<span class="q">no low within 30 days</span>';
  return `<tr><td><b>${r.lo}</b></td><td>${sgn(r.depth)}</td><td>${f1(r.rsiLow)}</td><td>${LN[r.line].split(" (")[0]}</td><td>${f1(r.vixMax)}</td><td>${o("QQQ")}</td><td>${o("IWM")}</td><td>${o("BTCUSD")}</td><td>${r.firstEquity ?? "—"}</td><td>${sgn(r.rebound)}</td></tr>`; }).join("\n")}</table></div>`;
}
function bandTable(sym, which = "full") {
  const X = B[sym][which], b = X.base;
  return `<div class="scroll"><table><tr><th>Close vs its 200-day</th><th>Days</th><th>Share of days</th><th>Up after 20</th><th>Middle 20</th><th>Up after 60</th><th>Middle 60</th><th>Worst close in the next 60 (middle)</th><th>Fell 10%+ within 60</th></tr>
<tr class="base"><td>any day · ${X.from} → ${X.to}</td><td>${n0(X.days)}</td><td>100%</td><td>${f1(b.up20)}%</td><td>${sgn(b.med20, 2)}</td><td>${f1(b.up60)}%</td><td>${sgn(b.med60, 2)}</td><td>${sgn(b.mdd60Med, 2)}</td><td></td></tr>
${X.bands.map((r) => `<tr><td><b>${r.band}</b></td><td>${n0(r.days)}</td><td>${pc(r.shareDays)}</td><td>${sh(r.up20, b.up20)}</td><td>${sgn(r.med20, 2)}</td><td>${sh(r.up60, b.up60)}</td><td>${sgn(r.med60, 2)}</td><td>${sgn(r.mdd60Med, 2)}</td><td>${pc(r.mdd60Bad)}</td></tr>`).join("\n")}</table></div>`;
}
function breakTable(sym, which = "full") {
  const X = B[sym][which];
  return `<div class="scroll"><table><tr><th>First close more than X% below the 200-day</th><th>Times</th><th>Further fall before the 200-day was reclaimed<br><span class="q">middle · worst quarter · worst</span></th><th>Fell another 5%+</th><th>Another 10%+</th><th>Another 20%+</th><th>Sessions to reclaim (middle)</th><th>Reclaimed within 60</th><th>Up 60 sessions later</th><th>Middle 60</th><th>Up 120 later</th></tr>
${X.breaks.map((r) => `<tr><td><b>${r.X === 0 ? "the first close below it" : "−" + r.X + "%"}</b></td><td>${r.n}</td><td>${r.n ? `${sgn(r.furtherMed)} <span class="q">· ${f1(r.furtherQ1)}% · ${f1(r.furtherWorst)}%</span>` : "—"}</td><td>${pc(r.another5)}</td><td>${pc(r.another10)}</td><td>${pc(r.another20)}</td><td>${r.reclaimMed == null ? "—" : n0(r.reclaimMed)}</td><td>${pc(r.reclaim60)}</td><td>${pc(r.up60)}</td><td>${sgn(r.med60, 2)}</td><td>${pc(r.up120)}</td></tr>`).join("\n")}</table></div>`;
}
function rsiLadderTable() {
  const S = d.rsiLadder.SPY, Q = d.rsiLadder.QQQ;
  return `<div class="scroll"><table><tr><th>Own percentile</th><th>SPY RSI(14) · full history (${n0(S.full.n)} days)</th><th>SPY · last 3 years</th><th>QQQ · full history (${n0(Q.full.n)} days)</th><th>QQQ · last 3 years</th></tr>
${S.full.steps.map((s, i) => `<tr><td><b>bottom ${s.pct}%</b></td><td>${f1(s.rsi)}</td><td>${f1(S.last3y.steps[i].rsi)}</td><td>${f1(Q.full.steps[i].rsi)}</td><td>${f1(Q.last3y.steps[i].rsi)}</td></tr>`).join("\n")}</table></div>`;
}
function sensTable() {
  return `<div class="scroll"><table><tr><th>Pivot window (bars each side)</th>${["SPY", "QQQ", "IWM", "BTCUSD"].map((s) => `<th>${s}: declines · middle depth · middle length · 10%+ declines</th>`).join("")}</tr>
${[5, 10, 20].map((len) => `<tr><td><b>${len}${len === 10 ? " (used here)" : ""}</b></td>${["SPY", "QQQ", "IWM", "BTCUSD"].map((s) => { const r = d.sensitivity[s][len]; return `<td>${r.declines} · ${f1(r.depthMed)}% · ${r.barsMed} · ${r.big10}</td>`; }).join("")}</tr>`).join("\n")}</table></div>`;
}

/* ---------- numbers the lead quotes ---------- */
const spyT = I.SPY.depthTable, qT = I.QQQ.depthTable, bT = I.BTCUSD.depthTable;
const row = (T, b) => T.find((r) => r.bucket === b);
const s510 = row(spyT, "5–10%"), s1020 = row(spyT, "10–20%"), s35 = row(spyT, "3–5%"), s20 = row(spyT, "20%+");
const brk = (sym, X) => B[sym].full.breaks.find((r) => r.X === X);
const sB0 = brk("SPY", 0), sB5 = brk("SPY", 5), sB10 = brk("SPY", 10), qB0 = brk("QQQ", 0), qB5 = brk("QQQ", 5);
const bandBelow10 = B.SPY.full.bands[0], bandAbove25 = B.SPY.full.bands[5], base = B.SPY.full.base;
const ll = LL.min10.summary, ll5 = LL.min5.summary;
const cleanedN = Object.values(d.sources).reduce((a, s) => a + (s.cleaned?.length ?? 0), 0);

const lead = [
  `<b>In SPY, the size of a pullback tells you what the low will look like.</b> Declines of 3–5% (${s35.n} of them since 2003) bottomed with RSI(14) near ${f1(s35.rsiLowMed)}, mostly on the 21 EMA or 50 SMA, and ${f1(s35.newHigh)}% of their rebounds made a new high. Declines of 5–10% (${s510.n}) bottomed near RSI ${f1(s510.rsiLowMed)}, ${f1(s510.lines.e13)}% of them with the wick already through every cloud line (the 13 EMA was the lowest line left above the wick), and ${f1(s510.newHigh)}% of rebounds made a new high. At 10–20% (${s1020.n}) RSI at the low was ${f1(s1020.rsiLowMed)}, ${f1(s1020.below200)}% closed below the 200-day, and only ${f1(s1020.newHigh)}% of the next legs made a new high. That is the “selling too early” question in numbers: on a 3–5% pullback the next swing usually makes a new high; on a 10%+ decline it usually does not.`,
  `<b>The 200-day is not a cliff; the cliff is further down.</b> SPY's first close below its 200-day (${sB0.n} times) went on to fall a further ${f1(sB0.furtherMed)}% in the middle case and reclaimed the line in ${n0(sB0.reclaimMed)} sessions; ${f1(sB0.another10)}% fell another 10%+. The first close 5% below it (${sB5.n} times): further fall ${f1(sB5.furtherMed)}%, ${f1(sB5.another10)}% fell another 10%+, reclaim ${n0(sB5.reclaimMed)} sessions. At 10% below (${sB10.n} times): ${f1(sB10.another10)}% fell another 10%+, ${f1(sB10.another20)}% another 20%+, and reclaiming took ${n0(sB10.reclaimMed)} sessions in the middle case. QQQ (since 2011): first close below, ${qB0.n} times, further ${f1(qB0.furtherMed)}%; 5% below, ${qB5.n} times, ${f1(qB5.another10)}% fell another 10%+.`,
  `<b>Being far below the 200-day is where the wide outcomes live.</b> Days more than 10% below it (${f1(bandBelow10.shareDays)}% of SPY's days) were up 60 sessions later ${f1(bandBelow10.up60)}% of the time (any day ${f1(base.up60)}%) with a middle result of ${sgn(bandBelow10.med60, 2)}, but ${f1(bandBelow10.mdd60Bad)}% of them saw a close 10% lower within those 60 sessions. Days 2–5% above it: up ${f1(bandAbove25.up60)}%, and ${f1(bandAbove25.mdd60Bad)}% saw a 10% drop.`,
  `<b>The indexes turn together; Bitcoin turns a little earlier.</b> Of SPY's ${ll.IWM.of} declines of 10%+, IWM's low was on the same day ${ll.IWM.same} times, earlier ${ll.IWM.earlier}, later ${ll.IWM.later}. QQQ (from 2011): same day ${ll.QQQ.same} of ${ll.QQQ.matched} matched. Bitcoin (from 2013): earlier ${ll.BTCUSD.earlier}, same ${ll.BTCUSD.same}, later ${ll.BTCUSD.later}, middle offset ${ll.BTCUSD.medianOffset} days. On 5%+ declines the picture is the same (${ll5.IWM.same} of ${ll5.IWM.matched} IWM lows on the same day). “Which index turns first” is, so far, not a lead indicator on daily bars; the question moves to breadth and to the leaders.`,
  `<b>Bitcoin's swings are a different animal.</b> ${bT.find((r) => r.bucket === "20%+").n} of its ${I.BTCUSD.declines} declines since 2013 were 20% or more (middle ${f1(bT.find((r) => r.bucket === "20%+").depthMed)}%), and their rebounds made a new high only ${f1(bT.find((r) => r.bucket === "20%+").newHigh)}% of the time. Its RSI at the low is no lower than SPY's (middle ${f1(I.BTCUSD.rsiAtLowAll.med)} against ${f1(I.SPY.rsiAtLowAll.med)}), so RSI levels do not transfer between instruments; own-history percentiles do.`,
];

/* ---------- the research questions ---------- */
const Q = [
  { g: "A · Selling too early — when a pullback is a pullback", why: "Alan buys well and sells too early. The question is what separates a dip that makes a new high from one that does not, read at the moment he wants to sell.", qs: [
    ["A1", "Given a decline of X% from a swing high, what is the chance the next swing makes a new high — by depth, by cloud state at the high, by RSI at the low, by market state?", "3", "cheap · this page starts it (SPY, QQQ, IWM, BTC)", "Extend to leaders + sector ETFs"],
    ["A2", "In a stock, when its pullback is shallower than SPY's over the same swing, does it lead the rebound? (relative strength inside the decline)", "3", "cheap", "pivots on stock + SPY, same dates"],
    ["A3", "What does the first higher low after a swing low look like (bars, retrace %, volume) when the trend resumed vs when it failed?", "3", "medium", "swing sequence labels"],
    ["A4", "Does a break of the 21 EMA / 50 SMA after a strong run mean anything different from one inside a range? (trend strength before the break)", "2", "cheap", "cloud order + distance at the break"],
    ["A5", "How often does “momentum peeling” (RSI lower high while price makes a higher high) precede a 10%+ decline vs a 3–5% pullback?", "2", "medium", "RSI divergence at swing highs"],
  ] },
  { g: "B · Buying patience — patient, then aggressive", why: "Buying is patient until the market shows its hand, then sized up. The measurements are about what confirms a low and how much is left after confirmation.", qs: [
    ["B1", "After a swing low is CONFIRMED (10 bars later), how much of the rebound is left — by depth of the decline and by market state?", "3", "cheap · the confirmation date is in this page's tables", "already computed per decline"],
    ["B2", "Breakout definition from pivots: a close above the last swing high — what follows by cloud order, by how long the base was, by volume on the day?", "3", "medium", "swing highs + close crosses"],
    ["B3", "Low RSI (own percentile ≤ 10) while the cloud order is bullish: how deep does the pullback still go before the low? (buying too early cost)", "3", "cheap", "S8 ladder + swings"],
    ["B4", "Is a re-test of the swing low (within 3%) more common than a V? What decides it?", "2", "medium", "swing shapes"],
    ["B5", "Dynamic sizing: does the number of cloud lines reclaimed after the low (1, 2, 3, 4) grade the odds of a new high?", "2", "cheap", "cloud state along the rebound"],
  ] },
  { g: "C · Market first — the tide", why: "Rising tide lifts all boats. Every stock study is read in the market's state; the market's own swings are measured first.", qs: [
    ["C1", "Pivot-to-pivot depth, duration, RSI, cloud line and VIX at the low for SPY / QQQ / IWM / BTC — the table on this page, kept up to date", "3", "done · first cut", "re-run each month"],
    ["C2", "Who turns first: on daily bars they turn together (this page). Does breadth (% above 50/200-day) or the leaders turn first?", "3", "needs breadth history", "daily breadth capture (additive)"],
    ["C3", "The 200-day band: this page's first cut. Add the slope of the 200-day and the 50/200 order as a second dimension.", "3", "cheap", "extend bandStudy"],
    ["C4", "Volume turns: does a volume climax (volume ÷ 50-day ≥ 2) at the swing low change the rebound?", "2", "cheap", "volRatio already in the records"],
    ["C5", "Transitions: how long from a bearish cloud order (200 > 50 > 21 > 13) back to bullish, and what did price do in between?", "2", "cheap", "cloud order runs"],
  ] },
  { g: "D · Fear / greed cycles and risk between them", why: "Alan wants to trade the fear/greed cycle and manage risk between the extremes.", qs: [
    ["D1", `VIX at SPY swing lows by depth (this page: middle VIX ${f1(s510.vixLowMed)} on 5–10% declines, ${f1(s1020.vixLowMed)} on 10–20%). What VIX level, given the depth so far, marks the low?`, "3", "cheap · VIX cached 2002→", "join by date"],
    ["D2", "Put/call (Cboe PCC): does a 5-day average above 1.0 at a swing low change the rebound?", "2", "cheap · PCC cached 2006→ (27 Sep)", "join by date"],
    ["D3", "CNN Fear & Greed: below 20 at a swing low vs not — history must be captured first", "2", "history missing", "daily capture table"],
    ["D4", "Between extremes: after a greed reading (VIX < 13, F&G > 75), how deep is the next decline?", "2", "cheap for VIX", "VIX only for now"],
  ] },
  { g: "E · Leaders and rotation", why: "A few names drive most returns; studies are filtered to leaders, sector ETFs and indexes, and weighted to the present.", qs: [
    ["E1", "Leader definition test: top 10% by 6-month return with cloud order bullish — how many of the next quarter's top performers were already leaders?", "3", "medium", "needs cross-section per month"],
    ["E2", "Sector ETF oversold (own RSI percentile ≤ 10) as a filter: do its constituents' rebounds differ?", "2", "medium", "11 SPDRs + SMH, SOXX, XBI, KRE cached/available"],
    ["E3", "Defensive rotation: after selling a leader, SMH / QQQ vs cash over the next swing — how often did the sector fund beat holding cash?", "2", "cheap", "swing-aligned returns"],
    ["E4", "Cap-weighting the history: re-run A1/B1 with each episode weighted by the name's market cap at the time — do the answers change?", "2", "needs historical caps", "FMP shares outstanding history"],
  ] },
  { g: "F · Patterns (Trendoscope) and eras", why: "Named patterns need the detector's own pivots; era comparisons need long histories we do not hold.", qs: [
    ["F1", "Trendoscope pattern outcomes on indexes and leaders — blocked until the detector's libraries (or its exported events) are on this machine (research/trendoscope/MISSING-DETECTOR-SOURCES.md)", "2", "blocked", "coordinator to obtain source or event export"],
    ["F2", "AI trade vs internet / railroads / cable / dot-com: the chart API has no long index histories (IXIC, GSPC, NDX, RUT are not tracked); QQQ starts 2011 in our cache", "1", "missing data", "external long series needed"],
  ] },
];
const qTable = Q.map((g) => `<h3>${esc(g.g)}</h3><p class="q">${g.why}</p><div class="scroll"><table><tr><th>#</th><th>Question</th><th>Value to Alan (3 = highest)</th><th>Cost / state</th><th>How</th></tr>
${g.qs.map((q) => `<tr><td><b>${q[0]}</b></td><td>${q[1]}</td><td>${q[2]}</td><td>${esc(q[3])}</td><td class="q">${esc(q[4])}</td></tr>`).join("\n")}</table></div>`).join("\n");

/* ---------- data table ---------- */
const src = d.sources;
const DATA = [
  ["Daily bars · SPY, IWM (2003→), QQQ (2011→ in our cache: a hole of more than a year before 2011-03-23 in the Massive series), 11 sector SPDRs, SMH, DIA, 313 stocks", "chart API (Massive), cached 27 Sep in ~/Library/Application Support/scintilla/stats-cache", "have", `${cleanedN} bars with impossible wicks clamped (listed below)`],
  ["Bitcoin daily (7-day, 2010→; used from 2013)", "chart API → FMP BTCUSD", "have", "index level, no volume basis"],
  ["VIX daily (2002→)", "chart API → FMP ^VIX", "have", "cached 27 Sep"],
  ["Put/call ratio (Cboe total PCC, 2006-11 → 2026-09, 5,005 sessions)", "chart API /candles?symbol=PCC", "have (new)", "cached 27 Sep; the Hub's sentiment card still notes a 404 from 23 Sep, which is out of date"],
  ["CNN Fear & Greed history", "CNN graphdata endpoint (the Hub reads it live)", "partial", "the response carries about a year; longer history needs a daily capture table (additive) or an archive"],
  ["Report times (before open / after close)", "FMP earnings calendar `time`; Massive has no report-time field we know of", "partial", "export has 840 of 21,624; S8 inferred the rest from gaps (95% agreement). FMP key is not in this environment — get it, do not infer"],
  ["Sub-sector ETFs (SOXX, XBI, KRE, ITB, XHB, XOP, IGV, MAGS)", "chart API universe", "have (not yet cached)", "OIH, ARKK, IBIT not tracked"],
  ["Breadth (% above 50/200-day, new highs/lows)", "Hub data/breadth/history.json", "missing history", "one reading (2026-09-23). A daily capture is an additive job"],
  ["Market caps at the time (for weighting)", "meta-cohorts-caps-20260926.json = today's caps only", "partial", "historical caps need shares-outstanding history (FMP)"],
  ["Trendoscope pattern events", "the detector's Pine libraries", "missing", "not on this machine; our own pivot rule stands in"],
  ["Long index histories for era comparisons", "not on the chart API", "missing", "external series needed"],
];
const dataTable = `<div class="scroll"><table><tr><th>Data</th><th>Where it comes from</th><th>State</th><th>Note</th></tr>
${DATA.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td><b class="${r[2].startsWith("have") ? "up" : r[2].startsWith("missing") ? "dn" : ""}">${esc(r[2])}</b></td><td class="q">${esc(r[3])}</td></tr>`).join("\n")}</table></div>`;
const cleanedTable = `<details><summary>The ${cleanedN} bad prints that were clamped (date · open · high · low · close · what was fixed)</summary><div class="scroll"><table><tr><th>Instrument</th><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Fixed</th></tr>
${Object.entries(src).filter(([, s]) => s.cleaned?.length).flatMap(([sym, s]) => s.cleaned.map((c) => `<tr><td>${sym}</td><td>${c.date}</td><td>${c.o}</td><td>${c.h}</td><td>${c.l}</td><td>${c.c}</td><td>${c.fixed}</td></tr>`)).join("\n")}</table></div></details>`;

/* ---------- the execution plan ---------- */
const JOBS = [
  ["J1", "Swings for every cached instrument (16 funds + 313 stocks + sub-sector ETFs): the decline records of this page, one JSON per instrument", "Kimi", "s9-research.mjs declines() over the cache; fetch the 8 sub-sector ETFs from the chart API", "data/s9-swings/<SYM>.json; a count table", "every record has hi < lo < confirmedAt; SPY totals equal this page", "~15 min compute, no network except the 8 fetches"],
  ["J2", "A1 + B1: new-high odds by depth × cloud state at the high × market state at the low; and the rebound left after confirmation", "Opus", "J1 output", "tables + a page section", "month-clustered bootstrap intervals as in S8; both halves of history shown", "bounded: 4 dimensions, no more"],
  ["J3", "A2: stock pullback depth vs SPY's over the same swing → who rebounds first / more", "Kimi", "J1 output, SPY swings as the clock", "one table per depth bucket", "same-date alignment tested on a fixture", "no new definitions"],
  ["J4", "C3 + C4 + C5: 200-day band with slope and 50/200 order; volume climax at the low; bearish→bullish cloud transitions", "Kimi", "bandStudy() and the decline records", "three tables, SPY / QQQ / IWM", "reproduces this page's numbers before extending", "cheap"],
  ["J5", "D1 + D2: VIX and put/call (PCC) at swing lows and at swing highs; the greed side (VIX < 13) → next decline depth", "Kimi", "VIX.json, PCC.json (chart API), decline records", "tables + one chart", "PCC span reported first; nothing inferred", "cheap"],
  ["J6", "B2: breakout from pivots (close above the last swing high) — outcomes by cloud order, base length, volume", "Opus", "J1 swings", "a ladder like S8 with real trades listed", "no look-ahead test (future changed → past unchanged)", "medium"],
  ["J7", "A5: RSI lower high vs price higher high at swing highs → depth of the next decline", "Kimi", "J1 swings + RSI", "one table", "fixture test on a synthetic divergence", "cheap"],
  ["J8", "E1 + E3: leader definition test; defensive rotation into SMH/QQQ vs cash after a sale", "Opus", "J1, monthly cross-sections", "tables", "top-decile membership persistence reported with a shuffle baseline", "medium"],
  ["J9", "Data: FMP earnings-calendar report times for all 21,624 reports (needs the FMP key in the environment); compare with S8's inferred flags", "Kimi", "FMP calendar", "earnings-export-timed-v2.json + agreement table", "no inference where FMP answers", "network, keyed"],
  ["J10", "Data: daily capture of CNN Fear & Greed, breadth (% above 50/200) and PCC into additive tables, with rollback — migration only, coordinator applies", "Kimi", "Hub feeds already read live", "migration + rollback SQL, a runbook", "additive only; nothing existing changed", "small"],
  ["J11", "E4: cap-weighted re-run of J2 once historical caps exist (FMP shares outstanding × price)", "Opus", "J2 + caps", "the same tables, weighted", "unweighted and weighted side by side", "after J9/J10"],
  ["J12", "F1: Trendoscope — only when the coordinator has the libraries or an event export; otherwise stays blocked", "—", "MISSING-DETECTOR-SOURCES.md", "—", "—", "blocked"],
];
const jobsTable = `<div class="scroll"><table><tr><th>Job</th><th>What</th><th>Lane</th><th>Inputs</th><th>Output</th><th>Acceptance</th><th>Size</th></tr>
${JOBS.map((j) => `<tr><td><b>${j[0]}</b></td><td>${esc(j[1])}</td><td>${j[2]}</td><td class="q">${esc(j[3])}</td><td class="q">${esc(j[4])}</td><td class="q">${esc(j[5])}</td><td class="q">${esc(j[6])}</td></tr>`).join("\n")}</table></div>`;

/* ---------- the page ---------- */
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Research program · S9 · 27 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#B4B4C6;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#C8C8D2}h2{font-size:26px;margin:46px 0 8px;color:#C8C8D2}h3{font-size:19px;margin:26px 0 6px;color:#C8C8D2}
p,li{max-width:1080px}.q{color:#9C9CAE;font-size:13px}
ol.lead{font-size:19px;color:#C8C8D2;max-width:1120px;padding-left:24px}ol.lead li{margin:0 0 12px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1080px;color:#C8C8D2}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
tr.base td{background:#0F0F18}
details{margin:8px 0;max-width:1400px}summary{cursor:pointer;padding:6px 0;color:#C0C0CE}
.chart{display:block;background:#0B0B12;border:1px solid #1E1E28;margin:12px 0;max-width:1400px}
.up{color:#00FFA3}.dn{color:#FF2D55}
dl{max-width:1120px}dt{color:#C8C8D2;font-weight:600;margin-top:10px}dd{margin:2px 0 0 0}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table{font-size:12px}th,td{padding:5px 6px}code{overflow-wrap:anywhere}}
</style></head><body>
<h1>The research program: questions first, pivots not windows, the market first</h1>
<div class="q">S9 · 27 Sep 2026 · built ${d.generated.slice(0, 16).replace("T", " ")} UTC · research, not conclusions · price only · nothing here predicts</div>

<div class="status"><b>STATUS · the program is written and the two cheapest studies are run on real data.</b> Bars to 2026-09-25 from the chart API. Every swing is measured between confirmed pivots, never over a fixed number of days. Green and red follow direction: an up result is green, a down result is red; a share is green above its own any-day line and red below it. Bad prints in the deep history (${cleanedN} bars) were clamped and are listed in section 3.</div>

<h2>What the two first studies say</h2>
<ol class="lead">${lead.map((l) => `<li>${l}</li>`).join("\n")}</ol>

<h2>1 · The research questions, ranked by value to the execution problem</h2>
<p>Alan's words: “What would a statistician be doing right now? Research, data analysis — not conclusions to test.” Each group opens with why it matters to how he trades, then the questions in order of value. “Cheap” means it runs from the cached bars with the code on this branch.</p>
${qTable}

<h2>2 · Exact measurement definitions</h2>
<dl>
<dt>Pivot</dt><dd>Symmetric window on the wick, 10 bars each side (the Pivot Atom's WIN default and the S/R engine's window; TradingView's pivothigh/pivotlow with left = right = 10). A pivot high has a high strictly above the 10 highs before it and at or above the 10 after it; a pivot low mirrors it. It is only <b>known 10 bars later</b>, and every study that “acts” on a pivot acts from that later date (the “low confirmed on” column). Windows of 5 and 20 are shown as a sensitivity row; the counts change, the big declines do not.</dd>
<dt>Swing</dt><dd>Pivots in time order, forced to alternate: two highs in a row keep the higher, two lows the lower. Each leg's end is then moved to the true extreme between its neighbours. A <b>decline</b> runs swing high → swing low; its <b>rebound</b> is the next leg up. Depth = low ÷ high − 1. Duration = sessions (calendar days for Bitcoin, which trades every day). Retraced = the rebound's gain as a share of the decline; “new high” = the rebound's swing high above the decline's swing high.</dd>
<dt>RSI</dt><dd>RSI(14), Wilder's smoothing, on closes (rulebook I-8: 100 when there are no down days). Read at the swing-low bar's close, and the lowest reading inside the decline. <b>Own percentile</b>: the reading ranked against the instrument's own previous 3 years (756 readings, at least 250), today never inside its own sample. Section 4 gives the percentile → value ladder for SPY and QQQ in 5% steps.</dd>
<dt>Cloud lines and cloud state (the Station vocabulary)</dt><dd>Lines exactly as station-clouds.js draws them: 13 and 21 EMA (weight 2/(n+1), seeded at the first close, hidden for the first 60 sessions), 50 and 200 SMA. <b>Order</b> = the four lines listed from highest to lowest price; “bull order” = 13 > 21 > 50 > 200, “bear order” = 200 > 50 > 21 > 13, anything else = mixed. The Station's three flags: f = 13 EMA ≥ 21 EMA, m = 21 EMA ≥ 50 SMA, o = 50 SMA ≥ 200 SMA. <b>Crossing</b> = a flag changes between two sessions. <b>Price position</b> = above all four lines / between / below all four. <b>Line reached</b> at a swing low = the lowest-priced line whose value the wick touched or pierced (“13 EMA” therefore means the wick went through every line and the 13 EMA was the lowest of them; “none” = the low stayed above all four).</dd>
<dt>The 200-day band</dt><dd>d = close ÷ 200 SMA − 1, in %. Bands: more than 10% below, 5–10% below, 2–5% below, 0–2% below, 0–2% above, 2–5% above, 5–10% above, more than 10% above. <b>Breaking point</b>: the first close more than X% below (the previous close was not), followed until a close is back above the 200-day. “Further fall” = the lowest close in that stretch ÷ the entry close − 1. Forward returns are close to close, 20 / 60 / 120 sessions, price only.</dd>
<dt>Leader</dt><dd>Proposed, to be tested in J8: in a month's cross-section of our universe, the top 10% by 6-month return whose cloud order is bull order on that day. A study “filtered to leaders” keeps only episodes where the name was a leader at the swing high. The test is whether leadership persists (share still in the top decile a quarter later, against a shuffle).</dd>
<dt>Recency and market-cap weighting</dt><dd>Every table shows full history and a recent column (from 2015 in section 4; last 5 years / last 250 episodes in the S8 ladder). Cap weighting: each episode weighted by the name's market cap at the time ÷ the universe's total cap that month, so NVDA in 2025 counts more than NVDA in 2005. Today's caps exist (meta-cohorts-caps-20260926.json); historical caps do not yet (section 3).</dd>
<dt>Market state</dt><dd>At any date: SPY above / below its 200-day; SPY's own RSI percentile bucket; SPY's cloud order. Stock studies are split by it, as in S8.</dd>
</dl>

<h2>3 · Data each question needs — have / missing</h2>
${dataTable}
${cleanedTable}

<h2>4 · Proof of method — the two cheapest studies, run now</h2>
<h3>4a · Pivot-to-pivot declines and rebounds: SPY, QQQ, IWM, Bitcoin</h3>
<p class="q">Sources: ${["SPY", "QQQ", "IWM", "BTCUSD"].map((s) => `${s} ${src[s].provider} ${src[s].from} → ${src[s].to} (${n0(src[s].bars)} bars${src[s].cleaned.length ? `, ${src[s].cleaned.length} clamped` : ""})`).join(" · ")} · VIX ${src.VIX.from} → ${src.VIX.to}.</p>
${chartSwings()}
<p class="q">SPY since 2018: the close, coloured by each day's direction; the 200-day, faint, coloured by its own direction; the swings in bold with a dot at every pivot.</p>
${["SPY", "QQQ", "IWM", "BTCUSD"].map((s) => `<h3>${NAME[s]} — every decline since ${src[s].from.slice(0, 4)}, by depth</h3>${depthTable(s)}<details><summary>${s} since 2015 only</summary>${depthTable(s, "depthTable2015")}</details><details><summary>${s}: the ${Math.min(12, I[s].biggest.length)} deepest declines, one line each</summary>${biggestTable(s)}</details>`).join("\n")}
${chartScatter()}
<h3>Which index turned first</h3>
<p>For each SPY decline of 10% or more, the nearest swing low of the other three within 30 days. A negative offset means the other instrument's low came first.</p>
${leadTable(LL.min10)}
<details><summary>The same for SPY declines of 5% or more (summary only)</summary>${`<div class="scroll"><table><tr><th>Against SPY's low</th><th>Matched</th><th>Earlier</th><th>Same day</th><th>Later</th><th>Middle offset</th></tr>${["QQQ", "IWM", "BTCUSD"].map((s) => `<tr><td>${NAME[s]}</td><td>${ll5[s].matched} of ${ll5[s].of}</td><td>${ll5[s].earlier}</td><td>${ll5[s].same}</td><td>${ll5[s].later}</td><td>${ll5[s].medianOffset}</td></tr>`).join("")}</table></div>`}</details>
<h3>How much the pivot window matters</h3>
${sensTable()}
<h3>SPY and QQQ: which RSI value is “bottom X%”</h3>
${rsiLadderTable()}

<h3>4b · The 200-day band: SPY and QQQ</h3>
${chartBands()}
<h3>SPY · every day by its distance from the 200-day (${B.SPY.full.from} → ${B.SPY.full.to})</h3>${bandTable("SPY")}
<details><summary>SPY since 2010</summary>${bandTable("SPY", "since2010")}</details>
<h3>QQQ · the same (${B.QQQ.full.from} → ${B.QQQ.full.to})</h3>${bandTable("QQQ")}
<h3>Is there a breaking point below the 200-day?</h3>
${chartBreak()}
<h3>SPY · the first close more than X% below its 200-day</h3>${breakTable("SPY")}
<details><summary>SPY since 2010</summary>${breakTable("SPY", "since2010")}</details>
<h3>QQQ · the same</h3>${breakTable("QQQ")}
<p>Reading it: the further fall grows with X, but not in a step — there is no single level where the odds of another 10% jump. What does change is the time back above the line: a few sessions from the first close below, months from 10% below. The three 15%-below cases are 2008 twice and 2020 once.</p>

<h2>5 · The execution plan — bounded jobs for the Opus / Kimi lanes</h2>
<p>Each job reads the cached bars and the code on this branch (<code>research/statistics/s9-research.mjs</code>), writes one JSON and one page section, adds a fixture test, and ends with headless screenshots at 1680 and 390. No job pushes, deploys or writes to a database; migrations are written with their rollback for the coordinator. Kimi takes the mechanical re-runs and data jobs; Opus takes the studies that need a new definition or a judgement about what to show.</p>
${jobsTable}

<h2>What could be wrong</h2>
<ul>
<li><b>Bars.</b> Split-adjusted, not dividend-adjusted: fund returns are understated by the yield. The chart API's deep history carried ${cleanedN} impossible wicks; they were clamped to the body, but softer errors would pass the screen. QQQ's history before 2011-03-23 is dropped because the series has a hole of more than a year there.</li>
<li><b>Pivots are late.</b> A swing low is known 10 bars after it; the tables describe what the lows looked like, not what could be bought at them. B1 measures what is left after confirmation.</li>
<li><b>Few big events.</b> SPY has ${I.SPY.biggest.length} declines of 10%+ and ${s20.n} of 20%+ since 2003; the 20%+ rows are four episodes, not a distribution.</li>
<li><b>Bitcoin</b> is an FMP index level traded seven days a week; its 2013–2014 prints are thin, and one wick was clamped.</li>
<li><b>Same-day lows</b> partly reflect that the three funds are the same market on the same news; “first to turn” needs intraday or breadth data to mean more.</li>
<li><b>Nothing here is a rule.</b> These are descriptions of the past; the questions in section 1 are what to research next.</li>
</ul>
<h2>What was not done</h2>
<ul>
<li>No stock, sector-ETF or leader study yet (J1–J8). No Trendoscope pattern study (blocked on the detector's libraries). No fear/greed or put/call join (D2/D3), though PCC was found on the chart API on 27 Sep. No report-time fetch from FMP (no key in this environment). No historical market caps. Nothing pushed, deployed or written to a database.</li>
</ul>
<p class="q">Code: <code>research/statistics/s9-research.mjs</code> (the measurements), <code>research/statistics/s9-page.mjs</code> (this page), <code>research/statistics/data/s9-research.json</code> (every number on this page), tests in <code>tests/statistics-s9-research.test.mjs</code>.</p>
</body></html>`;
fs.writeFileSync(outFile, html);
console.log(`wrote ${outFile} (${(html.length / 1024).toFixed(0)} KB)`);
