/* Writes deliverables/20260928/market-regime/MARKET-REGIME.html (+ regime.json copy) from data/regime-20260928.json.
   node research/statistics/regime/regime-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../../..");
const D = JSON.parse(fs.readFileSync(path.join(here, "../data/regime-20260928.json"), "utf8"));
const outDir = path.join(root, "deliverables/20260928/market-regime"); fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(here, "../data/regime-20260928.json"), path.join(outDir, "regime.json"));

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const f1 = (x) => x == null ? "—" : (+x).toFixed(1), f2 = (x) => x == null ? "—" : (+x).toFixed(2), f3 = (x) => x == null ? "—" : (+x).toFixed(3);
const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const cls = (x, base = 0) => x == null ? "" : x > base ? "up" : x < base ? "dn" : "";
const pct = (x, dp = 1) => x == null ? "—" : `<span class="${cls(x)}">${x > 0 ? "+" : ""}${(+x).toFixed(dp)}%</span>`;
const ci = (s) => s?.ci ? `<span class="ci">${s.ci[0] > 0 ? "+" : ""}${f2(s.ci[0])} to ${s.ci[1] > 0 ? "+" : ""}${f2(s.ci[1])}</span>` : "—";
const VS = { above: `<span class="up">better than usual</span>`, below: `<span class="dn">worse than usual</span>`, overlaps: `<span class="mut">not different</span>` };
const vs = (v) => v ? VS[v] : "—";
const date = (d) => { if (!d) return "—"; const [y, m, dd] = d.split("-"); return `${+dd} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1]} ${y}`; };
const ordinal = (x) => x == null ? "—" : x < 1 ? "<1st" : `${Math.round(x)}${["th","st","nd","rd"][(Math.round(x) % 100 > 10 && Math.round(x) % 100 < 14) ? 0 : Math.min(Math.round(x) % 10, 4) > 3 ? 0 : Math.round(x) % 10] || "th"}`;

/* ---------- SVG helpers: dark panel, mono labels; every data line follows its own direction (up green, down red) ---------- */
const UP = "#00FFA3", DN = "#FF2D55", INK = "#A8A8BA", DIM = "#6E6E80", GRID = "#1F1F29", REF = "#7A7A8C";
const T = (x, y, s, a = "start", c = INK, fs = 12, w = 400) => `<text x="${x}" y="${y}" fill="${c}" font-size="${fs}" font-weight="${w}" font-family="ui-monospace,Menlo,monospace" text-anchor="${a}">${esc(s)}</text>`;
function lineChart(series, { W = 1400, H = 360, title = "", refs = [], marks = [], yfmt = (v) => f2(v), log = false, subtitle = "" } = {}) {
  if (!series?.length) return "";
  const Lm = 64, R = 18, Tp = 40, B = 30;
  const vals = series.map((p) => p[1]).concat(refs.map((r) => r.v));
  let y0 = Math.min(...vals), y1 = Math.max(...vals); const pad = (y1 - y0) * 0.06; y0 -= pad; y1 += pad;
  const tv = (v) => log ? Math.log(v) : v; const Y0 = tv(y0), Y1 = tv(y1);
  const X = (i) => Lm + (W - Lm - R) * i / (series.length - 1), Y = (v) => Tp + (H - Tp - B) * (1 - (tv(v) - Y0) / (Y1 - Y0));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`;
  const step = niceStep(y1 - y0); for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) s += `<line x1="${Lm}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/>` + T(Lm - 8, Y(v) + 4, yfmt(v), "end", DIM, 11);
  let ly = ""; const every = series.length > 700 ? 2 : 1;
  for (let i = 0; i < series.length; i++) { const yr = series[i][0].slice(0, 4); if (yr !== ly) { if (+yr % every === 0 || series.length < 300) { s += `<line x1="${X(i)}" x2="${X(i)}" y1="${Tp}" y2="${H - B}" stroke="${GRID}"/>` + T(X(i) + 3, H - 10, yr, "start", DIM, 11); } ly = yr; } }
  for (const r of refs) s += `<line x1="${Lm}" x2="${W - R}" y1="${Y(r.v)}" y2="${Y(r.v)}" stroke="${REF}" stroke-dasharray="6 5" stroke-width="1.3"/>` + T(W - R - 4, Y(r.v) - 6, r.label, "end", "#C4C4D0", 12, 600);
  for (let i = 1; i < series.length; i++) s += `<line x1="${X(i - 1).toFixed(1)}" y1="${Y(series[i - 1][1]).toFixed(1)}" x2="${X(i).toFixed(1)}" y2="${Y(series[i][1]).toFixed(1)}" stroke="${series[i][1] >= series[i - 1][1] ? UP : DN}" stroke-width="1.6"/>`;
  const idx = new Map(series.map((p, i) => [p[0], i]));
  const near = (d) => { if (idx.has(d)) return idx.get(d); let k = series.findIndex((p) => p[0] >= d); return k < 0 ? null : k; };
  for (const m of marks) { const k = near(m.d); if (k == null) continue; const cx = X(k), cy = Y(series[k][1]);
    s += m.shape === "tri" ? `<path d="M${cx - 6},${cy - (m.up ? -12 : 12)} L${cx + 6},${cy - (m.up ? -12 : 12)} L${cx},${cy - (m.up ? -3 : 3)} Z" fill="${m.up ? UP : DN}"><title>${esc(m.tip)}</title></path>`
      : `<circle cx="${cx}" cy="${cy}" r="5" fill="${m.up ? UP : DN}" stroke="#07070C" stroke-width="2"><title>${esc(m.tip)}</title></circle>`; }
  const lastV = series.at(-1)[1]; s += `<circle cx="${X(series.length - 1)}" cy="${Y(lastV)}" r="4.5" fill="#D2D2D2"/>` + T(X(series.length - 1) - 8, Y(lastV) - 9, `now ${yfmt(lastV)}`, "end", "#D2D2D2", 12, 600);
  s += T(Lm, 22, title, "start", "#D2D2D2", 15, 600); if (subtitle) s += T(W - R, 22, subtitle, "end", INK, 12);
  return s + "</svg>";
}
function niceStep(range) { const raw = range / 6, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
function barChart(items, { W = 1400, H = 300, title = "", base = null, baseLabel = "", ymin = null, ymax = null } = {}) {
  const Lm = 56, R = 16, Tp = 40, B = 34, n = items.length, bw = (W - Lm - R) / n;
  const all = items.flatMap((x) => [x.v, ...(x.ci ?? [])]).filter((x) => x != null).concat(base != null ? [base] : [], [0]);
  let y0 = ymin ?? Math.min(...all), y1 = ymax ?? Math.max(...all); const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
  const Y = (v) => Tp + (H - Tp - B) * (1 - (v - y0) / (y1 - y0));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">`;
  const step = niceStep(y1 - y0); for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) s += `<line x1="${Lm}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRID}"/>` + T(Lm - 8, Y(v) + 4, (v > 0 ? "+" : "") + (+v.toFixed(2)) + "%", "end", DIM, 11);
  s += `<line x1="${Lm}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#34343F"/>`;
  items.forEach((it, i) => { const x = Lm + i * bw + bw * 0.2, w = bw * 0.6; if (it.v == null) return; const y = Math.min(Y(it.v), Y(0)), h = Math.max(2, Math.abs(Y(it.v) - Y(0)));
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${it.v >= 0 ? UP : DN}" fill-opacity=".78"><title>${esc(it.tip ?? "")}</title></rect>`;
    if (it.ci) s += `<line x1="${x + w / 2}" x2="${x + w / 2}" y1="${Y(it.ci[0])}" y2="${Y(it.ci[1])}" stroke="#D2D2D2" stroke-width="2"/><line x1="${x + w / 2 - 7}" x2="${x + w / 2 + 7}" y1="${Y(it.ci[0])}" y2="${Y(it.ci[0])}" stroke="#D2D2D2" stroke-width="2"/><line x1="${x + w / 2 - 7}" x2="${x + w / 2 + 7}" y1="${Y(it.ci[1])}" y2="${Y(it.ci[1])}" stroke="#D2D2D2" stroke-width="2"/>`;
    s += T(x + w / 2, H - 12, it.label, "middle", "#C4C4D0", 12, 600); });
  if (base != null) s += `<line x1="${Lm}" x2="${W - R}" y1="${Y(base)}" y2="${Y(base)}" stroke="${REF}" stroke-dasharray="6 5" stroke-width="1.3"/>` + T(W - R - 4, Y(base) - 6, baseLabel, "end", "#C4C4D0", 12, 600);
  s += T(Lm, 22, title, "start", "#D2D2D2", 15, 600);
  return s + "</svg>";
}

/* ---------- the numbers the text quotes ---------- */
const P = D.pairs.filter((p) => !p.missing), pair = (ew) => P.find((p) => p.ew === ew);
const rsp = pair("RSP"), V = D.vix, CR = D.credit, M = D.macro, S = D.season, F = D.fed, O = D.odds;
const kOct = O.kalshi.find((e) => e.decision === "2026-10-28"), kDec = O.kalshi.find((e) => e.decision === "2026-12-09");
const pOct = O.polymarket.find((e) => /October/.test(e.title)), pDec = O.polymarket.find((e) => /December/.test(e.title));
const kHike = (e) => e?.markets.find((m) => m.outcome === "Hike 25bps"), pHike = (e) => e?.markets.find((m) => m.outcome === "25 bps increase");
const kHold = (e) => e?.markets.find((m) => m.outcome === "Fed maintains rate"), pHold = (e) => e?.markets.find((m) => m.outcome === "No change");
const th = M.thesis, th90 = M.thesis1990;
const sepAll = S.months.all.by[8], sep30 = S.months.last30y.by[8];
const lowRich = P.filter((p) => p.now.levelPctAll != null && p.now.levelPctAll <= 5 && !p.closed).map((p) => p.ew + "/" + p.cw);
const lead = [
  `<b>Equal weight is at or near its weakest ever against cap weight</b> in ${lowRich.length} of the live pairs (${lowRich.join(", ")}) — the ratio sits in the bottom 5% of its own history. RSP/SPY is at the ${ordinal(rsp.now.levelPctAll)} percentile of 23 years. What followed past stretches this far below the ratio's own 200-day average was <b>mixed</b>: for RSP/SPY the ratio a year later was up in ${f1(rsp.lowsSummary.ratio252.up)}% of ${rsp.lowsSummary.ratio252.n} cases (median ${f1(rsp.lowsSummary.ratio252.median)}%). A low reading has not, by itself, meant equal weight catches up.`,
  `<b>The VIX curve is calm, not inverted.</b> VIX ${f2(V.now.vix)} ÷ 3-month VIX ${f2(V.now.vix3m)} = ${f3(V.now.ratio)} (inverted means above 1.0). It was inverted on ${f1(V.invertedPct)}% of days since ${V.from.slice(0, 4)}, last on ${date(V.now.lastInverted)}. ${V.lows.nearInversion} of ${V.lows.n} S&P swing lows of 5% or more came during or just after an inversion — against ${f1(V.lows.chanceCoverage)}% expected by chance. SPY's returns after inverted days were higher on average but the range is too wide to call it different.`,
  `<b>Credit is not stressed.</b> Junk bonds vs investment grade (HYG ÷ LQD, with interest) is ${f1(-CR[0].now.fromAllTimeHigh)}% off its all-time high. In the ${CR[0].leadSummary.n} S&P drops of 7% or more since 2007, this ratio peaked before the S&P top in ${CR[0].leadSummary.peakedFirst} (median ${CR[0].leadSummary.medianPeakLead} sessions earlier) — by chance the same measurement shows it "first" ${f1(CR[0].leadSummary.placebo.peakedFirstPct)}% of the time.`,
  `<b>Alan's thesis, measured (not assumed) — the answer depends on the era.</b> S&P days 5–10% below their 1-year high while the 10-year yield sat in the top third of its own last decade: a year later the S&P averaged ${pct(th.pullback5to10.highYield[252].mean)} since 1971 (${vs(th.pullback5to10.highYield[252].vs)}) against ${pct(th.pullback5to10.lowYield[252].mean)} with low yields — but since 1990 ${pct(th90.pullback5to10.highYield[252].mean)} against ${pct(th90.pullback5to10.lowYield[252].mean)} (ranges overlap). In 10–20% pullbacks since 1990, high yields came with ${pct(th90.pullback10to20.highYield[252].mean)} vs ${pct(th90.pullback10to20.lowYield[252].mean)} (only ${th90.pullback10to20.highYield[252].months} months of episodes). So: supported since 1990, not in the full record, and never by a wide, certain margin. "Overbought is overbought regardless of the story": overbought days (RSI ≥ 70) with yields <b>rising</b> were followed by ${pct(th.overbought.yieldRising[63].mean)} over 63 sessions vs ${pct(th.overbought.yieldFalling[63].mean)} with yields falling (1971→) — the story did matter there; since 1990 the two (${pct(th90.overbought.yieldRising[63].mean)} vs ${pct(th90.overbought.yieldFalling[63].mean)}) are not clearly different, which fits the thesis.`,
  `<b>Today's backdrop:</b> 10-year yield ${f2(M.now.y10)}%, above its 200-day average (${f2(M.now.y10Avg200)}%) and at the ${ordinal(M.now.y10Pct10y)} percentile of the last 10 years; dollar ${f2(M.now.dxy)}, above its 200-day. Since 1971, "yield up + dollar up" was the weakest of the four combinations for the S&P over the next 63 sessions (${pct(M.regimes["yield up · dollar up"][63].mean)} vs ${pct(M.base[63].mean)} for all days).`,
  `<b>September is the one month with a real negative record</b> (1928→: average ${pct(sepAll.mean)}, up ${f1(sepAll.up)}% of years; 90% range of the average ${ci(sepAll)}); over the last 30 years its range includes zero. Option-expiry weeks and pre-holiday sessions have small positive averages; the week after expiry is flat.`,
  `<b>The Fed:</b> both prediction markets price a <b>25 bp hike on 28 Oct</b> — Kalshi ${f1(100 * kHike(kOct)?.last)}%, Polymarket ${f1(100 * pHike(pOct)?.yes)}% (hold: ${f1(100 * kHold(kOct)?.last)}% / ${f1(100 * pHold(pOct)?.yes)}%). Since 1994 the S&P rose on decision days more than on ordinary days (${pct(F.windows.day.meetings.mean, 2)} vs ${pct(F.windows.day.anyWindow.mean, 2)}); in the 2013→ hikes the day after the decision averaged ${pct(F.windows.next1.byType2013.hike.mean, 2)} (${F.windows.next1.byType2013.hike.n} hikes).`,
];

/* ---------- 1 · equal vs cap ---------- */
const pairRow = (p) => p.missing ? `<tr><td>${esc(p.label)}</td><td>${p.ew}/${p.cw}</td><td colspan="9">not enough overlapping history</td></tr>` :
  `<tr${p.closed ? ' class="closed"' : ""}><td>${esc(p.label)}${p.closed ? " <span class=\"mut\">(fund closed)</span>" : ""}</td><td><b>${p.ew}</b> ÷ ${p.cw}</td><td>${p.from.slice(0, 4)}–${p.closed ? p.to.slice(0, 7) : "now"}</td>
  <td class="${p.now.levelPctAll <= 10 ? "dn" : p.now.levelPctAll >= 90 ? "up" : ""}"><b>${ordinal(p.now.levelPctAll)}</b></td><td>${ordinal(p.now.levelPct3y)}</td><td>${pct(p.now.stretch)}</td><td>${pct(p.now.change252)}</td>
  <td>${p.lowsSummary.ratio252.n} · ${pct(p.lowsSummary.ratio252.median)} · ${f1(p.lowsSummary.ratio252.up)}% up</td><td>${p.highsSummary.ratio252.n} · ${pct(p.highsSummary.ratio252.median)} · ${f1(p.highsSummary.ratio252.up)}% up</td><td>${pct(p.baseline.ratio252.median)}</td></tr>`;
const pairTable = `<div class="scroll"><table><tr><th>Market</th><th>Equal ÷ cap</th><th>History</th><th>Ratio today vs all its history (percentile)</th><th>vs last 3 years</th><th>Ratio vs its own 200-day avg</th><th>Ratio, last 1 year</th><th>After "far below its 200-day" (bottom 5%): cases · ratio 1 year later (median) · share up</th><th>After "far above" (top 5%)</th><th>Any day: ratio 1 year later (median)</th></tr>${D.pairs.map(pairRow).join("")}</table></div>`;
const pairCharts = P.map((p) => `<div class="cell">${lineChart(p.weekly, { W: 700, H: 250, title: `${p.ew} ÷ ${p.cw} · ${p.label}`, subtitle: `${ordinal(p.now.levelPctAll)} pct`, yfmt: (v) => v.toFixed(v < 1 ? 3 : 2),
  marks: [...p.lows.map((e) => ({ d: e.d, up: false, tip: `${e.d}: ${e.stretch}% below its 200-day → ratio ${e.ratio252 ?? "n/a"}% a year later` })), ...p.highs.map((e) => ({ d: e.d, up: true, tip: `${e.d}: ${e.stretch}% above its 200-day → ratio ${e.ratio252 ?? "n/a"}% a year later` }))] })}</div>`).join("");

/* ---------- 2 · VIX term structure ---------- */
const hz = [5, 21, 63, 126];
const vixTable = `<div class="scroll"><table><tr><th>SPY, next …</th>${hz.map((h) => `<th>${h} sessions</th>`).join("")}</tr>
${[["all days", "all"], ["days the curve was inverted (VIX above 3-month VIX)", "inverted"], ["days it was deeply inverted (ratio ≥ 1.10)", "deep"], ["days in normal contango", "contango"]].map(([lab, k]) =>
  `<tr${k === "all" ? ' class="base"' : ""}><td>${lab}</td>${hz.map((h) => { const s = V.fwd[h][k]; return `<td>${pct(s.mean, 2)} avg · ${f1(s.up)}% up<br>${ci(s)} <span class="mut">(${n0(s.n)} days, ${s.months} months)</span></td>`; }).join("")}</tr>`).join("")}
<tr><td>inverted vs all days</td>${hz.map((h) => `<td>${vs(V.fwd[h].invertedVsAll)}</td>`).join("")}</tr></table></div>`;
const epTop = [...V.episodes].sort((a, b) => b.peak - a.peak).slice(0, 14);
const epTable = `<div class="scroll"><table><tr><th>Inversion began</th><th>Ended</th><th>Sessions</th><th>Peak ratio</th><th>SPY below its 1-year high</th><th>SPY RSI(14)</th><th>SPY swing low nearby</th><th>SPY next 63</th><th>next 126</th></tr>
${epTop.map((e) => `<tr><td>${date(e.start)}</td><td>${date(e.end)}</td><td>${e.sessions}</td><td class="dn">${f2(e.peak)}</td><td>${pct(e.spyDrawdown)}</td><td>${f1(e.spyRsi)}</td><td>${e.swingLowNear ? `${date(e.swingLowNear.d)} (${f1(e.swingLowNear.depth)}%)` : "—"}</td><td>${pct(e.fwd63)}</td><td>${pct(e.fwd126)}</td></tr>`).join("")}</table></div>`;
const years = Object.entries(V.byYear);
const vixYears = barChart(years.map(([y, v]) => ({ label: "'" + y.slice(2), v: -v, tip: `${y}: inverted ${v}% of days` })), { W: 1400, H: 240, title: "Share of days the VIX curve was inverted, each year (drawn downward = stress)", ymin: -Math.max(...years.map(([, v]) => v)) * 1.05, ymax: 0 })
  .replace(/>([+-]?[\d.]+)%<\/text>/g, (m, v) => `>${Math.abs(+v)}%</text>`);

/* ---------- 3 · credit ---------- */
const spySw = CR[0].leadLag;
const creditCharts = CR.map((c) => lineChart(c.weekly, { W: 1400, H: 330, title: c.name, subtitle: `now ${f1(c.now.fromAllTimeHigh)}% from its high · triangles = S&P tops (green) and bottoms (red) of 7%+ drops`, yfmt: (v) => v.toFixed(3),
  marks: spySw.flatMap((x) => [{ d: x.spyHigh, up: true, shape: "tri", tip: `S&P top ${x.spyHigh} (drop ${x.spyDepth}%)` }, { d: x.spyLow, up: false, shape: "tri", tip: `S&P bottom ${x.spyLow}` }]) })).join("");
const ddTable = (c) => `<table><tr><th>Ratio peak</th><th>Trough</th><th>Depth</th><th>Sessions down</th><th>Back at the peak</th></tr>${c.drawdowns.slice(0, 8).map((x) => `<tr><td>${date(x.peak)}</td><td>${date(x.trough)}</td><td class="dn">${f1(x.depth)}%</td><td>${x.sessionsDown}</td><td>${x.recovered ? date(x.recovered) : "not yet"}</td></tr>`).join("")}</table>`;
const leadTable = `<div class="scroll"><table><tr><th>Ratio</th><th>S&P drops of 7%+</th><th>Ratio peaked BEFORE the S&P top</th><th>median lead (sessions)</th><th>by chance: "before" share · median</th><th>Ratio bottomed AFTER the S&P bottom</th><th>median lag</th><th>by chance: "after" share · median</th></tr>
${CR.map((c) => { const s = c.leadSummary; return `<tr><td>${esc(c.name.split(" (")[0])}</td><td>${s.n}</td><td>${s.peakedFirst} of ${s.n} (${f1(100 * s.peakedFirst / s.n)}%)</td><td>${s.medianPeakLead}</td><td>${f1(s.placebo.peakedFirstPct)}% · ${s.placebo.medianPeakLead}</td><td>${s.bottomedAfter} of ${s.n} (${f1(100 * s.bottomedAfter / s.n)}%)</td><td>${s.medianTroughLag}</td><td>${f1(s.placebo.bottomedAfterPct)}% · ${s.placebo.medianTroughLag}</td></tr>`; }).join("")}</table></div>`;

/* ---------- 4 · dollar, yields, thesis ---------- */
const hz4 = [63, 252];
const cell = (s) => s?.n ? `${pct(s.mean, 1)} avg · ${f1(s.up)}% up<br>${ci(s)} <span class="mut">(${s.months} months)</span><br>${vs(s.vs)}` : "—";
const regTable = `<div class="scroll"><table><tr><th>10-year yield · dollar (each vs its own 200-day average)</th>${hz4.map((h) => `<th>S&P next ${h} sessions</th>`).join("")}</tr>
<tr class="base"><td>all days, 1971 → now</td>${hz4.map((h) => `<td>${cell(M.base[h])}</td>`).join("")}</tr>
${Object.entries(M.regimes).map(([k, g]) => `<tr${(k === "yield up · dollar up") ? ' class="nowrow"' : ""}><td>${k}${k === "yield up · dollar up" ? " ← today" : ""}</td>${hz4.map((h) => `<td>${cell(g[h])}</td>`).join("")}</tr>`).join("")}</table></div>`;
const thesisRows = [
  ["5–10% below the 1-year high · yields HIGH (top third of their last 10 years)", "pullback5to10", "highYield"], ["5–10% below · yields middle third", "pullback5to10", "midYield"], ["5–10% below · yields LOW (bottom third)", "pullback5to10", "lowYield"], ["5–10% below · any yields", "pullback5to10", "all"],
  ["5–10% below · 10-year yield at or above 4%", "pullbackAbs4", "yieldAtLeast4"], ["5–10% below · 10-year yield under 4%", "pullbackAbs4", "yieldUnder4"],
  ["10–20% below · yields HIGH", "pullback10to20", "highYield"], ["10–20% below · yields LOW", "pullback10to20", "lowYield"],
  ["20%+ below · yields HIGH", "pullback20plus", "highYield"], ["20%+ below · yields LOW", "pullback20plus", "lowYield"],
];
const obRows = [["RSI(14) ≥ 70 · any story", "overbought", "all"], ["RSI ≥ 70 · yields HIGH", "overbought", "highYield"], ["RSI ≥ 70 · yields LOW", "overbought", "lowYield"], ["RSI ≥ 70 · yields RISING", "overbought", "yieldRising"], ["RSI ≥ 70 · yields FALLING", "overbought", "yieldFalling"],
  ["10%+ above the 200-day · any story", "extended", "all"], ["10%+ above · yields HIGH", "extended", "highYield"], ["10%+ above · yields LOW", "extended", "lowYield"], ["10%+ above · yields RISING", "extended", "yieldRising"], ["10%+ above · yields FALLING", "extended", "yieldFalling"]];
const thTable = (rows) => `<div class="scroll"><table><tr><th>S&P condition on the day</th><th>1971 → now · next 63 sessions</th><th>next 252 sessions (1 year)</th><th>1990 → now · next 63</th><th>next 252</th></tr>
<tr class="base"><td>all days</td><td>${cell(th.base[63])}</td><td>${cell(th.base[252])}</td><td>${cell(th90.base[63])}</td><td>${cell(th90.base[252])}</td></tr>
${rows.map(([lab, g, k]) => `<tr><td>${lab}</td><td>${cell(th[g][k][63])}</td><td>${cell(th[g][k][252])}</td><td>${cell(th90[g][k][63])}</td><td>${cell(th90[g][k][252])}</td></tr>`).join("")}</table></div>`;
const yChart = lineChart(M.weeklyY, { W: 1400, H: 300, title: "10-year Treasury yield (%), weekly, 1990 → now", yfmt: (v) => v.toFixed(1) + "%" });
const dChart = lineChart(M.weeklyD, { W: 1400, H: 300, title: "US dollar index (DXY), weekly, 1990 → now", yfmt: (v) => v.toFixed(0) });

/* ---------- 5 · seasonality ---------- */
const seasonChart = (E, lab) => barChart(E.by.map((m) => ({ label: m.month, v: m.mean, ci: m.ci, tip: `${m.month}: average ${m.mean}% · ${m.up}% of years up · 90% range ${m.ci?.join(" to ")} · n=${m.n}` })), { W: 1400, H: 300, title: `S&P 500 average month, ${lab} (bars = average, white whisker = 90% range of that average)`, base: E.all.mean, baseLabel: `all months ${E.all.mean > 0 ? "+" : ""}${E.all.mean}%` });
const seasonTable = (E) => `<div class="scroll"><table><tr><th>Month</th><th>Years</th><th>Average</th><th>90% range of the average</th><th>Median</th><th>Share up</th><th>Worst</th><th>Best</th><th>vs all months</th></tr>${E.by.map((m) => `<tr><td><b>${m.month}</b></td><td>${m.n}</td><td>${pct(m.mean, 2)}</td><td>${ci(m)}</td><td>${pct(m.median, 2)}</td><td>${f1(m.up)}%</td><td>${pct(m.worst)}</td><td>${pct(m.best)}</td><td>${vs(m.vs)}</td></tr>`).join("")}</table></div>`;
const calRow = (lab, s, base) => `<tr><td>${lab}</td><td>${n0(s.n)}</td><td>${pct(s.mean, 2)}</td><td>${ci(s)}</td><td>${f1(s.up)}%</td><td>${base ? vs(s.ci && base.mean != null ? (s.ci[0] > base.mean ? "above" : s.ci[1] < base.mean ? "below" : "overlaps") : null) : "—"}</td></tr>`;
const calTable = `<div class="scroll"><table><tr><th>Calendar slice (S&P 500 price)</th><th>Cases</th><th>Average</th><th>90% range</th><th>Share up</th><th>vs ordinary</th></tr>
<tr class="base"><td>any calendar week, 1990 →</td><td>${n0(S.opex.allWeeks.n)}</td><td>${pct(S.opex.allWeeks.mean, 2)}</td><td>${ci(S.opex.allWeeks)}</td><td>${f1(S.opex.allWeeks.up)}%</td><td></td></tr>
${calRow("option-expiry week (the week holding the 3rd Friday)", S.opex.expiryWeek, S.opex.allWeeks)}${calRow("quarterly expiry week (Mar, Jun, Sep, Dec)", S.opex.quarterlyExpiryWeek, S.opex.allWeeks)}${calRow("the week after expiry", S.opex.weekAfter, S.opex.allWeeks)}
<tr class="base"><td>any ordinary session, 1953 →</td><td>${n0(S.holidays.allDays.n)}</td><td>${pct(S.holidays.allDays.mean, 3)}</td><td>${ci(S.holidays.allDays)}</td><td>${f1(S.holidays.allDays.up)}%</td><td></td></tr>
${calRow("the session before a market holiday, 1953 →", S.holidays.preHoliday, S.holidays.allDays)}${calRow("the session after a market holiday", S.holidays.postHoliday, S.holidays.allDays)}${calRow("the session before a holiday, 2000 → only", S.holidays.recent.preHoliday, S.holidays.recent.allDays)}</table></div>`;

/* ---------- 6 · Fed ---------- */
const oddsRows = (k, p, when) => { const outs = [["Cut >25", "Cut >25bps", "50+ bps decrease"], ["Cut 25", "Cut 25bps", "25 bps decrease"], ["Hold", "Fed maintains rate", "No change"], ["Hike 25", "Hike 25bps", "25 bps increase"], ["Hike >25", "Hike >25bps", "50+ bps increase"]];
  return outs.map(([lab, ko, po]) => { const km = k?.markets.find((m) => m.outcome === ko), pm = p?.markets.find((m) => m.outcome === po); const hi = Math.max(km?.last ?? 0, pm?.yes ?? 0) > 0.5;
    return `<tr${hi ? ' class="nowrow"' : ""}><td>${when}</td><td><b>${lab}</b></td><td>${km ? `<b>${f1(100 * km.last)}%</b> <span class="mut">(bid ${f1(100 * km.bid)} / ask ${f1(100 * km.ask)})</span>` : "—"}</td><td>${km ? n0(km.volume) : "—"}</td><td>${pm ? `<b>${f1(100 * pm.yes)}%</b> <span class="mut">(bid ${f1(100 * pm.bid)} / ask ${f1(100 * pm.ask)})</span>` : "—"}</td><td>${pm ? "$" + n0(pm.volumeUsd) : "—"}</td></tr>`; }).join(""); };
const oddsTable = `<div class="scroll"><table><tr><th>Meeting</th><th>Outcome</th><th>Kalshi (last price = implied chance)</th><th>Kalshi contracts traded</th><th>Polymarket ("yes" price)</th><th>Polymarket volume</th></tr>${oddsRows(kOct, pOct, "28 Oct 2026")}${oddsRows(kDec, pDec, "9 Dec 2026")}</table></div>`;
const oddsBars = (() => { const W = 1400, H = 150; const items = [["Kalshi · 28 Oct", kOct, "k"], ["Polymarket · 28 Oct", pOct, "p"], ["Kalshi · 9 Dec", kDec, "k"], ["Polymarket · 9 Dec", pDec, "p"]]; let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Market-implied odds">`; const Lm = 200, R = 20, rowH = 26;
  items.forEach(([lab, e, t], i) => { const y = 20 + i * (rowH + 6); const hold = t === "k" ? kHold(e)?.last : pHold(e)?.yes, hike = t === "k" ? kHike(e)?.last : pHike(e)?.yes; const w = W - Lm - R;
    s += T(Lm - 10, y + 18, lab, "end", "#C4C4D0", 13, 600);
    s += `<rect x="${Lm}" y="${y}" width="${w * hold}" height="${rowH}" fill="#3A3A48"><title>hold ${f1(100 * hold)}%</title></rect>` + T(Lm + 8, y + 18, `hold ${f1(100 * hold)}%`, "start", "#D2D2D2", 13, 600);
    s += `<rect x="${Lm + w * hold + 2}" y="${y}" width="${w * hike}" height="${rowH}" fill="${DN}" fill-opacity=".8"><title>hike 25 ${f1(100 * hike)}%</title></rect>` + T(Lm + w * hold + 10, y + 18, `hike 25 bp ${f1(100 * hike)}%`, "start", "#0B0B12", 13, 700); });
  return s + "</svg>"; })();
const W6 = { into5: "5 sessions before (close D−6 → D−1)", day: "decision day (close D−1 → D)", next1: "day after (D → D+1)", after5: "next 5 sessions (D → D+5)", after21: "next 21 sessions (D → D+21)" };
const fedTable = `<div class="scroll"><table><tr><th>Window around the decision day D</th><th>All ${F.meetings} scheduled meetings, 1994 →</th><th>Any window of the same length</th><th>vs any window</th><th>2013 → hikes</th><th>holds</th><th>cuts</th></tr>
${Object.entries(W6).map(([k, lab]) => { const w = F.windows[k]; const b = w.byType2013; return `<tr><td>${lab}</td><td>${pct(w.meetings.mean, 2)} avg · ${f1(w.meetings.up)}% up<br>${ci(w.meetings)}</td><td>${pct(w.anyWindow.mean, 2)}</td><td>${vs(w.meetings.vs)}</td><td>${b.hike.n ? `${pct(b.hike.mean, 2)} <span class="mut">(${b.hike.n})</span>` : "—"}</td><td>${b.hold.n ? `${pct(b.hold.mean, 2)} <span class="mut">(${b.hold.n})</span>` : "—"}</td><td>${b.cut.n ? `${pct(b.cut.mean, 2)} <span class="mut">(${b.cut.n})</span>` : "—"}</td></tr>`; }).join("")}</table></div>`;

/* ---------- today strip ---------- */
const tile = (lab, val, sub, c = "") => `<div class="tile"><div class="tl">${lab}</div><div class="tv ${c}">${val}</div><div class="ts">${sub}</div></div>`;
const tiles = [
  tile("RSP ÷ SPY", ordinal(rsp.now.levelPctAll) + " pct", `equal vs cap weight · ${f1(rsp.now.change252)}% in a year`, "dn"),
  tile("VIX ÷ 3-month VIX", f3(V.now.ratio), `below 1 = calm · inverted ${f1(V.invertedPct)}% of days`, V.now.ratio > 1 ? "dn" : "up"),
  tile("Junk ÷ quality bonds", `${f1(CR[0].now.fromAllTimeHigh)}%`, "HYG ÷ LQD from its high · with interest", CR[0].now.fromAllTimeHigh > -3 ? "up" : "dn"),
  tile("10-year yield", `${f2(M.now.y10)}%`, `${M.now.yieldUp ? "rising" : "falling"} (vs 200-day ${f2(M.now.y10Avg200)}) · ${ordinal(M.now.y10Pct10y)} pct of 10y`, M.now.yieldUp ? "up" : "dn"),
  tile("Dollar (DXY)", f2(M.now.dxy), `${M.now.dollarUp ? "rising" : "falling"} (vs 200-day ${f2(M.now.dxyAvg200)})`, M.now.dollarUp ? "up" : "dn"),
  tile("S&P 500", n0(M.now.gspc), `${f1(M.now.drawdown)}% from 1-year high · RSI ${f1(M.now.rsi)} · ${f1(M.now.ext200)}% over 200-day`, M.now.drawdown > -1 ? "up" : "dn"),
  tile("September", pct(sepAll.mean), `avg since 1928 · up in ${f1(sepAll.up)}% of years`, "dn"),
  tile("Fed, 28 Oct", `${f1(100 * kHike(kOct)?.last)}% hike`, `Kalshi · Polymarket ${f1(100 * pHike(pOct)?.yes)}%`, "dn"),
].join("");

const src = Object.entries(D.sources).map(([k, s]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(s.provider)}</td><td>${date(s.from)}</td><td>${date(s.to)}</td><td>${n0(s.bars)}</td></tr>`).join("");
const faults = D.dataFaults.map((f) => `<li><b>${esc(f.what)}.</b> ${esc(f.detail)}</li>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Market Regime Research</title>
<style>
body{margin:0;background:#07070C;color:#B8B8C8;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:36px;margin:0 0 6px;color:#D2D2D2}h2{font-size:28px;margin:54px 0 8px;color:#D2D2D2;border-top:1px solid #1E1E28;padding-top:22px}h3{font-size:20px;margin:26px 0 6px;color:#C8C8D2}
p,li{max-width:1100px}.q{color:#A0A0B2;font-size:14px}.mut{color:#8A8A9C}.ci{color:#A8A8BA;font-size:13px;font-family:ui-monospace,Menlo,monospace}
ol.lead{font-size:19px;color:#C8C8D2;max-width:1160px;padding-left:24px}ol.lead li{margin:0 0 14px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1100px;color:#C8C8D2}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:1400px;margin:14px 0}
.tile{background:#0B0B12;border:1px solid #1E1E28;padding:12px 14px}.tl{font:12px ui-monospace,Menlo,monospace;color:#A0A0B2;text-transform:uppercase;letter-spacing:.05em}.tv{font-size:30px;font-weight:700;color:#D2D2D2;margin:4px 0}.ts{font-size:13px;color:#A0A0B2}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#B0B0C2;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace;background:#0B0B12}
tr.base td{background:#0F0F18}tr.nowrow td{background:#141420}tr.closed td{color:#9090A2}
.chart{display:block;width:100%;height:auto;background:#0B0B12;border:1px solid #1E1E28;margin:12px 0;max-width:1400px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;max-width:1400px}.grid .chart{margin:0}
.up{color:#00FFA3}.dn{color:#FF2D55}
.key{font-size:14px;color:#B0B0C2}.key i{display:inline-block;width:12px;height:12px;border-radius:6px;vertical-align:-1px;margin:0 4px 0 12px}
dl{max-width:1120px}dt{color:#C8C8D2;font-weight:600;margin-top:10px}dd{margin:2px 0 0 0}
a{color:#C8C8D2}
@media(max-width:700px){body{padding:18px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:16px}.tiles{grid-template-columns:repeat(2,1fr)}.tv{font-size:22px}.grid{grid-template-columns:1fr}table{font-size:12px}th,td{padding:5px 6px}}
</style></head><body>
<h1>Market regime: six questions, measured</h1>
<div class="q">28 Sep 2026 · closes to Fri ${date(D.asOf)} · research, not buy rules · built ${D.generated.slice(0, 16).replace("T", " ")} UTC · the numbers live in <a href="regime.json">regime.json</a> · a proposal for a Hub panel: <a href="PROPOSAL.html">PROPOSAL.html</a></div>

<div class="status"><b>STATUS · all six studies ran on real data.</b> Equal vs cap weight (17 pairs), the VIX curve, credit stress, dollar and 10-year yield with Alan's thesis, seasonality, and the Fed — including what prediction markets price for 28 Oct. Every average carries a 90% range; "not different" means the range includes the ordinary-day average. Green = up / better, red = down / worse. Nothing here says buy or sell.</div>

<h2>Where things stand today</h2>
<div class="tiles">${tiles}</div>

<h2>What the measurements say</h2>
<ol class="lead">${lead.map((l) => `<li>${l}</li>`).join("\n")}</ol>

<h2>1 · Equal weight vs cap weight</h2>
<p><b>The question:</b> is the average stock keeping up with the giants, and when the gap got extreme before, what came next? Each line is the equal-weight fund's price divided by the cap-weight fund's. <span class="up">Rising</span> = the average stock is winning; <span class="dn">falling</span> = the giants are. Dots mark the start of a visit to an extreme: <span class="dn">red</span> = the ratio was in its lowest 5% of distance below its own 200-day average, <span class="up">green</span> = its highest 5% above (hover a dot for what followed).</p>
${pairTable}
<p class="q">Percentile: where today's ratio ranks against every earlier day of that pair (0 = lowest ever, 100 = highest). "Cases" count separate visits, at least 63 sessions apart. Price only, no dividends — equal-weight funds pay a little more, so the real gap is slightly smaller than drawn.</p>
<div class="grid">${pairCharts}</div>

<h2>2 · The VIX curve: VIX vs 3-month VIX</h2>
<p><b>The question:</b> when near-term fear (VIX) rises above 3-month fear (VIX3M), the curve is <b>inverted</b> — how often, what was the market doing, and what followed? Ratio = VIX ÷ VIX3M; above the dashed line at 1.0 = inverted.</p>
${lineChart(V.weekly, { W: 1400, H: 380, title: "VIX ÷ 3-month VIX, weekly closes", refs: [{ v: 1, label: "1.0 — above this line the curve is inverted (stress)" }], yfmt: (v) => v.toFixed(2), subtitle: `${V.from.slice(0, 4)} → now` })}
${vixYears}
<h3>SPY after inverted days vs all days</h3>
${vixTable}
<p><b>Pivot lows:</b> of the <b>${V.lows.n}</b> SPY swing lows that ended a fall of 5% or more (pivots on closes, 10 sessions each side), <b>${V.lows.nearInversion}</b> (${f1(100 * V.lows.nearInversion / V.lows.n)}%) came during an inversion or within two weeks of one ending. Those windows cover ${f1(V.lows.chanceCoverage)}% of all sessions, so by chance about ${Math.round(V.lows.n * V.lows.chanceCoverage / 100)} would. ${V.episodesWithSwingLow} of ${V.episodes.length} inversion episodes had such a low (any depth) nearby.</p>
<h3>The 14 deepest inversions</h3>
${epTable}

<h2>3 · Credit stress: junk bonds vs quality bonds</h2>
<p><b>The question:</b> do bond investors flinch before stock investors? HYG (junk) ÷ LQD (investment grade) and HYG ÷ IEF (7–10 year Treasuries), both with the interest they pay reinvested. <span class="dn">Falling</span> = investors are demanding more to hold risky debt (stress).</p>
${creditCharts}
<h3>Lead and lag around S&P drops of 7% or more (${CR[0].leadSummary.n} since 2007)</h3>
${leadTable}
<p class="q">Measured in a window of ${CR[0].leadSummary.window} sessions either side of each S&P swing top / bottom. "By chance" repeats the same measurement centred on every 5th ordinary session: a ratio that drifts makes its window peak land early or late by itself, and that is the bar to beat.</p>
<div class="grid"><div><h3>Biggest HYG ÷ LQD drawdowns</h3>${ddTable(CR[0])}</div><div><h3>Biggest HYG ÷ IEF drawdowns</h3>${ddTable(CR[1])}</div></div>

<h2>4 · The dollar, the 10-year yield, and Alan's thesis</h2>
<p><b>Direction</b> here means above (rising) or below (falling) its own 200-day average — the Station's long line. S&P 500 index from FMP, 1971 → now (the dollar index starts in 1971).</p>
${yChart}${dChart}
${regTable}
<h3>Thesis 1 · "High yields + a pullback = a stronger buy zone"</h3>
<p>"High" = the 10-year yield in the top third of its own previous 10 years (it is at the ${ordinal(M.now.y10Pct10y)} percentile today); "low" = bottom third. "Pullback" = the S&P's close that far below its highest close of the past year. Checked twice: the full record since 1971, and since 1990 (the 1970s had high yields and a poor market for their own reasons).</p>
${thTable(thesisRows)}
<h3>Thesis 2 · "Overbought is overbought, extended is extended — regardless of the story"</h3>
<p>If the thesis holds, overbought days should be followed by the same thing whether yields are high or low, rising or falling.</p>
${thTable(obRows)}

<h2>5 · Seasonality, with its uncertainty</h2>
${seasonChart(S.months.all, `${S.months.all.from.slice(0, 4)}–${S.months.all.to.slice(0, 4)}`)}
${seasonChart(S.months.last30y, "last 30 years (1996–2026)")}
<details><summary>Month table, 1928 →</summary>${seasonTable(S.months.all)}</details>
<details><summary>Month table, 1950 →</summary>${seasonTable(S.months.since1950)}</details>
<details open><summary>Month table, last 30 years</summary>${seasonTable(S.months.last30y)}</details>
<h3>Option expiry and holidays</h3>
${calTable}
<p class="q">September 2026 is not finished, so it is left out. Monthly returns are month-end close to month-end close. "90% range" = the middle 90% of 2,000 re-draws of the history (bootstrap): if a month's range sits entirely above or below the all-months line, the month looks genuinely different; otherwise it does not.</p>

<h2>6 · The Fed</h2>
<h3>What markets price for the next two meetings (read ${esc(O.fetchedAt)})</h3>
${oddsBars}
${oddsTable}
<p><b>Fed-funds futures:</b> FMP's continuous 30-day fed-funds future (ZQUSD) was ${f2(O.futures?.price)} at ${esc(O.futures?.asOf?.slice(0, 16).replace("T", " "))} UTC, i.e. an average overnight rate of <b>${f3(O.futures?.impliedRate)}%</b>; the effective rate was ${f2(O.futures?.effrRecent)}% in August and the Fed raised its range by 0.25 on 16 Sep. FMP does not say which contract month that quote is, so it is <b>not</b> turned into meeting odds here. If it is the November contract, it prices roughly a two-in-three chance of another 0.25 in October — consistent with the prediction markets, but that is an inference. CME's FedWatch page blocks automated reading (its terms forbid it), so the official FedWatch odds are not on this page.</p>
<h3>The S&P 500 around FOMC decisions</h3>
${fedTable}
<p class="q">Decision day move: the median absolute S&P move was ${f2(F.decisionDayMove.meetingsMedianAbs)}% on decision days vs ${f2(F.decisionDayMove.allDaysMedianAbs)}% on all days. Dates: the Fed's own published schedules (scheduled meetings only; the emergency moves of 3 and 15 Mar 2020 are left out); hike / hold / cut from FMP's decision rows, which start in 2013. Recent: ${F.recent.map((r) => `${date(r.d)} ${r.change > 0 ? "+" : ""}${r.change}`).join(" · ")}. Next: ${F.next.map((m) => date(m.d)).join(" · ")}.</p>

<h2>What could be wrong</h2>
<ul>
<li><b>Overlap.</b> Forward returns from neighbouring days share most of their future, so thousands of "days" are really a few dozen episodes. The ranges resample whole calendar months to account for it, and the tables show the number of months. Treat anything under ~20 months as a hint.</li>
<li><b>Thresholds are choices.</b> "High yields" (top third of 10 years), "pullback" (5–10% below the 1-year high), RSI 70, 10% above the 200-day, the 5% extremes of each ratio — each is one reasonable cut, stated on the page, not a discovered number. The 4%-yield rows are there to show how much the answer moves with the cut.</li>
<li><b>Different eras.</b> 1971–1989 had inflation and rising rates; the 1990 → rows exist because the answer changes with the era.</li>
<li><b>Price only.</b> No dividends in the S&P, SPY or equal-vs-cap ratios; the credit ratios do include interest (they would drift otherwise).</li>
<li><b>Pivots on closes.</b> The chart API's SPY history carries some impossible wick prints (e.g. 2 Jun 2009 low 87.53 against a close of 94.87), so swing points here use closing prices, not wicks.</li>
<li><b>Prediction markets are thin next to futures</b> and move with news; the odds are a snapshot at ${esc(O.fetchedAt)}.</li>
${faults}
</ul>

<h2>What was not done</h2>
<ul>
<li>No Trendoscope diagonals or cloud-order combinations with the VIX curve yet — only pivots and RSI. That is the next step if the inversion/low link is worth pursuing.</li>
<li>No international equal-vs-cap pair (none found on FMP with history); no live mid- or small-cap pair (both Invesco funds stopped trading in 2023).</li>
<li>No official CME FedWatch odds (blocked; its terms forbid scraping). No paid source was used.</li>
<li>Hike / hold / cut split only from 2013 (FMP's decision rows start there); 1994–2012 meetings are in the totals without a type.</li>
<li>Nothing is weighted by relevance or market cap; no Hub panel was built (see <a href="PROPOSAL.html">the proposal</a>); nothing was deployed and no database was touched.</li>
</ul>

<h2>Where every number comes from</h2>
<div class="scroll"><table><tr><th>Series</th><th>Source</th><th>From</th><th>To</th><th>Daily bars</th></tr>${src}
<tr><td><b>FOMC dates</b></td><td>federalreserve.gov (historical pages 1994–2020, calendar page 2021–2027) + FMP decision rows 2013 →</td><td>Feb 1994</td><td>Dec 2027</td><td>${F.meetings} past meetings</td></tr>
<tr><td><b>Prediction markets</b></td><td>Kalshi public market data (series KXFEDDECISION), Polymarket public gamma API — read-only, no account</td><td colspan="3">${esc(O.fetchedAt)}</td></tr></table></div>
<p class="q">FMP data was pulled by a small script run on the Fly bar-service machine (research/statistics/regime/fly-run.mjs), because the FMP key lives only there; the key never left Fly. The chart API was read from this Mac with the Hub's origin header. Code: research/statistics/regime/ · tests: tests/statistics-regime.test.mjs.</p>
</body></html>`;
fs.writeFileSync(path.join(outDir, "MARKET-REGIME.html"), html);
console.log("wrote", path.join(outDir, "MARKET-REGIME.html"), (html.length / 1024).toFixed(0) + " KB");

/* ---------- PROPOSAL.html · a Hub "market regime" panel (not built) ---------- */
const spark = (series, n = 52) => { const s = series.slice(-n); if (s.length < 2) return ""; const W = 220, H = 44; const v = s.map((p) => p[1]); const lo = Math.min(...v), hi = Math.max(...v) || 1; const X = (i) => 4 + (W - 8) * i / (s.length - 1), Y = (x) => 4 + (H - 8) * (1 - (x - lo) / ((hi - lo) || 1));
  let o = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" aria-hidden="true">`; for (let i = 1; i < s.length; i++) o += `<line x1="${X(i - 1)}" y1="${Y(v[i - 1])}" x2="${X(i)}" y2="${Y(v[i])}" stroke="${v[i] >= v[i - 1] ? UP : DN}" stroke-width="1.8"/>`; return o + "</svg>"; };
const gauge = (lab, val, sub, sp, flash = false, c = "") => `<div class="g${flash ? " flash" : ""}"><div class="tl">${lab}</div><div class="tv ${c}">${val}</div>${sp}<div class="ts">${sub}</div></div>`;
const mock = [
  gauge("BREADTH · RSP ÷ SPY", ordinal(rsp.now.levelPctAll) + " pct", "equal vs cap · lowest 5% ever → flashes", spark(rsp.weekly), rsp.now.levelPctAll <= 5, "dn"),
  gauge("FEAR CURVE · VIX ÷ VIX3M", f3(V.now.ratio), "inverted above 1.00", spark(V.weekly), V.now.ratio > 1, V.now.ratio > 1 ? "dn" : "up"),
  gauge("CREDIT · HYG ÷ LQD", `${f1(CR[0].now.fromAllTimeHigh)}%`, "from its high, with interest", spark(CR[0].weekly), CR[0].now.fromAllTimeHigh < -5, "up"),
  gauge("10-YEAR", `${f2(M.now.y10)}%`, `${M.now.yieldUp ? "rising" : "falling"} · ${ordinal(M.now.y10Pct10y)} pct of 10 years`, spark(M.weeklyY), M.now.y10Pct10y >= 95, M.now.yieldUp ? "up" : "dn"),
  gauge("DOLLAR · DXY", f2(M.now.dxy), M.now.dollarUp ? "rising" : "falling", spark(M.weeklyD), false, M.now.dollarUp ? "up" : "dn"),
  gauge("CALENDAR", "September", `avg ${f2(sepAll.mean)}% since 1928 · next expiry 16 Oct`, "", false, "dn"),
  gauge("FED · 28 OCT", `${f1(100 * kHike(kOct)?.last)}% hike`, `Kalshi · Polymarket ${f1(100 * pHike(pOct)?.yes)}% · in 30 days`, "", false, "dn"),
].join("");
const prop = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Market Regime Panel</title>
<style>
body{margin:0;background:#07070C;color:#B8B8C8;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#D2D2D2}h2{font-size:24px;margin:36px 0 8px;color:#D2D2D2}p,li{max-width:1100px}.q{color:#A0A0B2;font-size:14px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1100px;color:#C8C8D2}
.strip{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;background:#0B0B12;border:1px solid #1E1E28;padding:10px;max-width:1440px}
.g{background:#07070C;border:1px solid #1E1E28;padding:10px 12px}.g.flash{animation:fl 1.6s ease-in-out infinite;border-color:#FF2D55}@keyframes fl{50%{box-shadow:0 0 14px #FF2D5566}}
.tl{font:11px ui-monospace,Menlo,monospace;color:#A0A0B2;letter-spacing:.05em}.tv{font-size:24px;font-weight:700;color:#D2D2D2;margin:2px 0}.ts{font-size:12px;color:#A0A0B2}
table{border-collapse:collapse;font-size:14px;margin:10px 0}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#B0B0C2;font:600 13px ui-monospace,Menlo,monospace;background:#0B0B12}
.up{color:#00FFA3}.dn{color:#FF2D55}a{color:#C8C8D2}.scroll{overflow-x:auto}
@media(max-width:900px){body{padding:18px 16px 60px;font-size:16px}h1{font-size:26px}.strip{grid-template-columns:repeat(2,1fr)}table{font-size:12px}}
</style></head><body>
<h1>Proposal: a "market regime" strip on the Hub</h1>
<div class="q">28 Sep 2026 · proposal only — nothing here is built or deployed · numbers below are the real closes of ${date(D.asOf)} from <a href="MARKET-REGIME.html">the research page</a></div>
<div class="status"><b>The idea in one line:</b> seven gauges, one row, the backdrop Alan checks before trading — breadth, fear curve, credit, rates, dollar, calendar, Fed — each showing today's reading, its rank in its own history, a one-year line, and a <b>flash</b> when it enters the zone that only its most extreme 5% of history reached. No buy or sell words.</div>
<h2>What it would look like</h2>
<div class="strip">${mock}</div>
<p class="q">Mock-up drawn from today's data. The breadth gauge is flashing because RSP ÷ SPY is in the lowest 5% of its 23 years. Each gauge opens the matching section of the research page (what followed past extremes, with the uncertainty).</p>
<h2>How each gauge works</h2>
<div class="scroll"><table><tr><th>Gauge</th><th>Reading</th><th>Flashes when</th><th>Data today</th><th>Missing</th></tr>
<tr><td>Breadth</td><td>RSP ÷ SPY percentile; tap = the 11 sector pairs as a heat row</td><td>bottom or top 5% of its history</td><td>chart API (RSP, SPY, XL*)</td><td>RSP* sector history before Jun 2023 (reused-ticker cut, coordinator item)</td></tr>
<tr><td>Fear curve</td><td>VIX ÷ VIX3M</td><td>above 1.00 (inverted)</td><td>VIX on chart API</td><td>VIX3M — add ^VIX3M to the chart API's FMP macro list</td></tr>
<tr><td>Credit</td><td>HYG ÷ LQD with interest, % from high</td><td>more than 5% below its high</td><td>HYG, LQD on chart API (price only)</td><td>dividend-adjusted series; HYG's pre-2007 reused-ticker stretch must be cut</td></tr>
<tr><td>10-year</td><td>level, direction vs 200-day, percentile of 10 years</td><td>top or bottom 5% of 10 years</td><td>US10Y on chart API</td><td>—</td></tr>
<tr><td>Dollar</td><td>DXY, direction vs 200-day</td><td>top or bottom 5% of 10 years</td><td>DXY on chart API</td><td>—</td></tr>
<tr><td>Calendar</td><td>this month's record (avg, share up, 90% range), expiry week, pre-holiday day</td><td>never (information, not an alarm)</td><td>computed once a month from ^GSPC</td><td>a monthly job</td></tr>
<tr><td>Fed</td><td>next meeting, days to go, Kalshi + Polymarket hike / hold / cut</td><td>when the leading outcome's odds move 15 points in a day</td><td>public APIs, no key</td><td>a small Fly job every 15 minutes writing one JSON (the browser should not call Kalshi / Polymarket directly)</td></tr></table></div>
<h2>States</h2>
<p>Loading: the tile shows its label and a dim dash. Stale (a source older than its expected session): the tile says <b>stale since …</b> in red, no number. Error: "no data" with the source name. Empty history (a new fund): shows the reading without a percentile.</p>
<h2>Where it lives</h2>
<p>Recommended: its own <b>REGIME</b> tab beside USUAL DAY, with the strip also shown compact under the tape on the dashboard. The Hub map's timeframe selector does not drive it (these are daily readings).</p>
<h2>Build size</h2>
<p>About a day for one lane once VIX3M and the two history cuts are in the chart API: one Fly job (prediction markets), one small Hub module reading the chart API, the tests, and headless proof. No database table needed; if Alan wants the history of the odds kept, one additive table.</p>
</body></html>`;
fs.writeFileSync(path.join(outDir, "PROPOSAL.html"), prop);
console.log("wrote", path.join(outDir, "PROPOSAL.html"));
