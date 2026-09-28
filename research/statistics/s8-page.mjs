/* Writes deliverables/20260927/ladder/LADDER.html from data/s8-ladder.json and data/s8-timing.json.
   node research/statistics/s8-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const d = JSON.parse(fs.readFileSync(path.join(here, "data/s8-ladder.json"), "utf8"));
const tm = JSON.parse(fs.readFileSync(path.join(here, "data/s8-timing.json"), "utf8"));
const outDir = path.join(root, "deliverables/20260927/ladder");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "LADDER.html");
const K = d.constants, I = d.indexes, N = d.names.fwd, R = d.names.to_report;

/* ---------- formatting ---------- */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const n0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US");
const f1 = (x) => x == null ? "—" : (+x).toFixed(1);
const pct = (x) => x == null ? "—" : `<span class="${x > 0 ? "up" : x < 0 ? "dn" : ""}">${x > 0 ? "+" : ""}${(+x).toFixed(2)}%</span>`;
/* a share up, coloured against its own any-day line: green above it, red below */
const sh = (x, base) => x == null ? "—" : `<span class="${base == null ? "" : x > base ? "up" : x < base ? "dn" : ""}">${f1(x)}%</span>`;
const vs = (x, base) => x == null || base == null ? "" : `<span class="${x - base > 0 ? "up" : x - base < 0 ? "dn" : ""}">${x - base > 0 ? "+" : ""}${(x - base).toFixed(1)}</span>`;
const ci = (c) => c?.[0] == null ? "" : `<br><span class="q">${f1(c[0])}–${f1(c[1])}</span>`;
const c8 = (c) => c ? `${c.same} of ${c.of}` : "—";
const few = (s, min = 20) => !s || s.n < min;
const cell = (s, base, min = 20) => few(s, min) ? `<span class="q">${s ? `${s.n} — too few` : "—"}</span>` : `${sh(s.win, base)} <span class="q">· ${n0(s.n)}</span>`;
const bandLabel = Object.fromEntries([...K.DIST_BANDS.map((b) => [b.key, b.label]), ["at", `at the average (within ${K.AT_AVERAGE_UD} usual day)`]]);
const BANDS7 = [...K.DIST_BANDS.map((b) => b.key), "at"];
const ML = K.MA_LABEL, SL = K.STATE_LABEL;

/* ---------- the numbers the opening sentences quote ---------- */
const spy = I.SPY, sb = spy.base["all:20"].full, sOn = spy.base["on:20"].full;
const r = (sym, key) => I[sym].rows[key];
const spy5 = r("SPY", "rsi<=5|all|20"), spy10on = r("SPY", "rsi<=10|on|20"), spy10off = r("SPY", "rsi<=10|off|20"), spyOff = spy.base["off:20"].full;
const fc = r("SPY", "firstcut:rsi<=10&d200>+3%|all|20"), fcDn = r("SPY", "firstcut:rsi<=10&d200<-3%|all|20");
const anyAll = N["any|all|20"].ep.full, n5 = N["rsi<=5|all|20"].ep, n10 = N["rsi<=10|all|20"].ep, n30 = N["rsi<=30|all|20"].ep;
const hot = N["any|spyRSI>70|20"].ep.full, pull = N["any|spy>200&spyRSI<=30|20"].ep.full;
const best = d.combos.chosen[0];
const ext = r("SPY", "s50:p90-100|all|20").ep, extI = r("IWM", "s50:p90-100|all|20").ep, iwmB = I.IWM.base["all:20"].full, s200lo = r("SPY", "s200:p0-10|all|20").ep;
const nv = d.names.per_name.NVDA, co = d.names.per_name.COST;
const repAll = R["any|all"], repWash = R["any|spyRSI<=30"];
const lead = [
  `<b>Start with the market, not the stock.</b> A stock's own RSI at the bottom 5% of its 3-year history was up 20 sessions later ${f1(n5.full.win)}% of the time, against ${f1(anyAll.win)}% for any day, and it beat SPY over the same days only ${f1(n5.vs_spy.beat)}% of the time — it mostly rode the tide. By the bottom 30% the edge is gone (${f1(n30.full.win)}%).`,
  `<b>For SPY itself a low RSI buys a bigger bounce, not better odds</b> — except in an uptrend. SPY RSI in its bottom 10% while SPY was above its 200-day: up ${f1(spy10on.ep.win)}% of ${spy10on.ep.n} times (any uptrend day ${f1(sOn.win)}%; ${spy10on.ep.win > spy10on.shuffle.p95 ? "above" : "right at"} the ${f1(spy10on.shuffle.p95)}% that random uptrend days reach 1 time in 20). The same RSI below the 200-day: ${f1(spy10off.ep.win)}%, a coin flip. The first cut's “more than 3% above the 200-day” version checks out: ${f1(fc.ep.win)}% of ${fc.ep.n} (${f1(fcDn.ep.win)}% when more than 3% below).`,
  `<b>“Extended” is not the danger for SPY; being far below the 200-day is.</b> SPY in the top 10% of its own distance above the 50-day was up ${f1(ext.win)}% after 20 sessions (any day ${f1(sb.win)}%). Small caps are the exception: IWM that stretched, ${f1(extI.win)}% (any day ${f1(iwmB.win)}%). SPY in the bottom 10% of its distance to the 200-day: ${f1(s200lo.win)}%.`,
  `<b>The best combination that held in both halves of history:</b> the stock's RSI in its bottom ${best.cond.match(/rsi<=(\d+)/)[1]}%, while the stock is still well above its own 200-day, and the market in this state: ${esc(SL[best.state])}. Up ${f1(best.disc.win)}% in 2004–2016 and ${f1(best.conf.win)}% in 2017–2026, against ${f1(d.combos.base_halves.disc.win)}% and ${f1(d.combos.base_halves.conf.win)}% for any day — but only ${n0(best.disc.n + best.conf.n)} trades in ${best.disc.months + best.conf.months} entry months, so it is a rare setup, not a daily one.`,
  `<b>Into earnings (timing now corrected), the stock's RSI adds almost nothing</b>: the 20-session run to the last close before a report was up ${f1(repAll.full.win)}% of ${n0(repAll.full.n)} times; with SPY's RSI in its bottom 30% at the start, ${f1(repWash.full.win)}%. NVDA's last 12 run-ups were ${nv.to_report.any.last12.win === 100 ? "all" : f1(nv.to_report.any.last12.win) + "%"} up (${f1(nv.to_report.any.full.win)}% over its whole history) — that is today's NVDA, not a rule. COST's low-RSI entries before a report went ${f1(co.to_report["rsi<=20"]?.l5?.win)}% up in the last five years.`,
];

/* ---------- step 1 · timing ---------- */
const T0 = tm.s6_pooled, V = tm.validation_on_export_times;
const tmNames = ["JPM", "WMT", "HD", "COST", "NVDA", "AAPL"].map((t) => { const p = tm.per_name[t]; if (!p) return "";
  return `<tr><td><b>${t}</b></td><td>${f1(p.bmo_share)}%</td><td>${p.moved}</td><td>${sh(p.old.runup_up)} → ${sh(p.corrected.runup_up)}</td><td>${pct(p.old.runup_med)} → ${pct(p.corrected.runup_med)}</td><td>${f1(p.old.abs_day_med)}% → ${f1(p.corrected.abs_day_med)}%</td></tr>`; }).join("");

/* ---------- step 2 · index staircases ---------- */
function staircase(sym, h = 20) {
  const X = I[sym]; if (!X || X.missing) return `<p>${sym}: no bars.</p>`;
  const b = X.base[`all:${h}`].full, bo = X.base[`on:${h}`].full, bf = X.base[`off:${h}`].full, b5 = X.base[`all:${h}`].l5;
  const rows = K.RSI_LEVELS.map((T) => {
    const a = X.rows[`rsi<=${T}|all|${h}`], on = X.rows[`rsi<=${T}|on|${h}`], off = X.rows[`rsi<=${T}|off|${h}`], band = X.rows[`rsi(${K.RSI_LEVELS[K.RSI_LEVELS.indexOf(T) - 1] ?? 0},${T}]|all|${h}`];
    const beat = a.shuffle && a.ep.win > a.shuffle.p95;
    return `<tr><td><b>bottom ${T}%</b></td><td>${n0(a.ep.n)}<br><span class="q">${n0(a.non.n)} non-overl.</span></td><td>${sh(a.ep.win, b.win)}${ci(a.ci)}</td><td>${vs(a.ep.win, b.win)}${a.shuffle ? `<br><span class="q">shuffle 95th ${f1(a.shuffle.p95)}${beat ? " · above" : ""}</span>` : ""}</td>
<td>${pct(a.ep.med)}</td><td>${cell(on.ep, bo.win, 15)}</td><td>${cell(off.ep, bf.win, 15)}</td><td>${cell(a.l5, b5.win, 15)}</td><td>${cell(a.rc, b.win, 15)}</td><td>${c8(a.c8)}</td><td>${band ? cell(band.ep, b.win, 15) : ""}</td></tr>`;
  }).join("");
  return `<div class="scroll"><table><tr><th>${sym} own RSI(14) at or below</th><th>Episodes</th><th>Up after ${h} (95% range, month-clustered)</th><th>vs any day (points)</th><th>Middle result</th><th>Trend on (above 200-day) · n</th><th>Trend off · n</th><th>Last 5 years · n</th><th>Last 250 episodes · n</th><th>Last 8 went up</th><th>Only this step (between the previous level and this one)</th></tr>
<tr class="base"><td><b>any day</b></td><td>${n0(b.n)} days</td><td>${f1(b.win)}%</td><td></td><td>${pct(b.med)}</td><td>${f1(bo.win)}% · ${n0(bo.n)}</td><td>${f1(bf.win)}% · ${n0(bf.n)}</td><td>${f1(b5.win)}% · ${n0(b5.n)}</td><td></td><td></td><td></td></tr>${rows}</table></div>`;
}
function maTable(sym, h = 20) {
  const X = I[sym], b = X.base[`all:${h}`].full, bo = X.base[`on:${h}`].full, bf = X.base[`off:${h}`].full;
  return `<div class="scroll"><table><tr><th>${sym} · where the close sat against the average</th>${K.MA_KEYS.map((k) => `<th>${ML[k]}<br><span class="q">up · n · middle · trend on / off</span></th>`).join("")}</tr>
${BANDS7.map((bk) => `<tr><td>${esc(bandLabel[bk])}</td>${K.MA_KEYS.map((k) => { const x = X.rows[`${k}:${bk}|all|${h}`], on = X.rows[`${k}:${bk}|on|${h}`], off = X.rows[`${k}:${bk}|off|${h}`], m = X.band_meaning[`${k}:${bk}`];
  return `<td>${cell(x.ep, b.win)} · ${pct(x.ep.med)}<br><span class="q">${m.ud_median == null ? "" : `typically ${m.ud_median > 0 ? "+" : ""}${m.ud_median} usual days (${m.pct_median > 0 ? "+" : ""}${m.pct_median}%)`}</span><br>${cell(on.ep, bo.win, 15)} / ${cell(off.ep, bf.win, 15)}</td>`; }).join("")}</tr>`).join("")}
</table></div>`;
}
const EXT_SYMS = ["SPY", "QQQ", "IWM", "DIA", "SMH"];
const extTable = `<div class="scroll"><table><tr><th>Stretched above the average (own top X% of distances)</th>${EXT_SYMS.map((s) => `<th>${s}<br><span class="q">any day ${f1(I[s].base["all:20"].full.win)}%</span></th>`).join("")}</tr>
${["e21", "s50", "s200"].flatMap((k) => K.EXTENDED_LEVELS.map((E) => `<tr><td>${ML[k]} · top ${100 - E}%</td>${EXT_SYMS.map((s) => { const x = I[s].rows[`${k}:ext>=${E}|all|20`]; return `<td>${cell(x.ep, I[s].base["all:20"].full.win)} · ${pct(x.ep.med)}</td>`; }).join("")}</tr>`)).join("")}</table></div>`;
function grid(sym, k) {
  const X = I[sym], b = X.base["all:20"].full;
  return `<div class="scroll"><table><tr><th>${sym} · RSI × ${ML[k]} · up after 20 · episodes</th>${BANDS7.map((bk) => `<th>${esc(bandLabel[bk])}</th>`).join("")}</tr>
${[10, 20, 30, 50].map((T) => `<tr><td><b>RSI bottom ${T}%</b></td>${BANDS7.map((bk) => { const x = X.rows[`rsi<=${T}&${k}:${bk}|all|20`]; return `<td>${cell(x?.ep, b.win, 15)}</td>`; }).join("")}</tr>`).join("")}</table></div>`;
}
const sectors = ["XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"];
const sectorSummary = `<div class="scroll"><table><tr><th>Fund</th><th>History used</th><th>Any day</th>${[5, 10, 20, 30].map((T) => `<th>RSI bottom ${T}%</th>`).join("")}<th>Bottom 10% · trend on</th><th>Bottom 10% · trend off</th><th>Top 10% above 50-day</th></tr>
${["SPY", "QQQ", "IWM", "DIA", "SMH", ...sectors].map((s) => { const X = I[s]; if (!X || X.missing) return ""; const b = X.base["all:20"].full;
  return `<tr><td><b>${s}</b></td><td>${X.first_percentile_day} →${X.gap_note ? `<br><span class="q">${esc(X.gap_note)}</span>` : ""}</td><td>${f1(b.win)}% · ${pct(b.med)}</td>${[5, 10, 20, 30].map((T) => `<td>${cell(X.rows[`rsi<=${T}|all|20`].ep, b.win, 15)}</td>`).join("")}
<td>${cell(X.rows["rsi<=10|on|20"].ep, X.base["on:20"].full.win, 15)}</td><td>${cell(X.rows["rsi<=10|off|20"].ep, X.base["off:20"].full.win, 15)}</td><td>${cell(X.rows["s50:p90-100|all|20"].ep, b.win, 15)}</td></tr>`; }).join("")}</table></div>`;

/* ---------- step 3 · names ---------- */
const ST = K.STATES;
const nameLadder = `<div class="scroll"><table><tr><th>Stock's own RSI at or below · up after 20 sessions (episodes)</th>${ST.map((s) => `<th>${esc(SL[s])}</th>`).join("")}</tr>
<tr class="base"><td><b>any day</b></td>${ST.map((s) => `<td>${f1(N[`any|${s}|20`].ep.full.win)}% · ${pct(N[`any|${s}|20`].ep.full.med)}</td>`).join("")}</tr>
${K.RSI_LEVELS.map((T) => `<tr><td><b>bottom ${T}%</b></td>${ST.map((s) => { const x = N[`rsi<=${T}|${s}|20`]?.ep; return `<td>${cell(x?.full, N[`any|${s}|20`].ep.full.win, 100)}</td>`; }).join("")}</tr>`).join("")}</table></div>`;
function nameDetail(s, h = 20, cond = (T) => `rsi<=${T}`, levels = K.RSI_LEVELS, label = (T) => `RSI bottom ${T}%`) {
  const b = N[`any|${s}|${h}`].ep;
  return `<div class="scroll"><table><tr><th>${esc(SL[s])} · ${h} sessions</th><th>Episodes · months</th><th>Up (95% range, month-clustered)</th><th>Shuffle 95th</th><th>Middle</th><th>vs SPY same days: middle · beat SPY</th><th>Last 5 years</th><th>Each name's last 12</th><th>Last 8 years beat the any-day line</th><th>Non-overlapping trades</th></tr>
<tr class="base"><td><b>any day</b></td><td>${n0(b.full.n)} days</td><td>${f1(b.full.win)}%${ci(b.ci)}</td><td></td><td>${pct(b.full.med)}</td><td>${pct(b.vs_spy.med)} · ${f1(b.vs_spy.beat)}%</td><td>${f1(b.l5.win)}%</td><td>${f1(b.last12.win)}%</td><td></td><td></td></tr>
${levels.map((T) => { const x = N[`${cond(T)}|${s}|${h}`]; if (!x?.ep) return ""; const e = x.ep;
  return `<tr><td><b>${esc(label(T))}</b></td><td>${n0(e.full.n)} · ${e.months}</td><td>${sh(e.full.win, b.full.win)}${ci(e.ci)}</td><td>${x.shuffle ? `${f1(x.shuffle.p95)}${e.full.win > x.shuffle.p95 ? " · above" : ""}` : "—"}</td><td>${pct(e.full.med)}</td>
<td>${pct(e.vs_spy.med)} · ${sh(e.vs_spy.beat, 50)}</td><td>${cell(e.l5, b.l5.win)}</td><td>${cell(e.last12, b.last12.win)}</td><td>${e.cy ? `${e.cy.same} of ${e.cy.of}` : "—"}</td><td>${cell(x.non?.full, b.full.win)}</td></tr>`; }).join("")}</table></div>`;
}
const maNames = `<div class="scroll"><table><tr><th>Stock vs its own average · up after 20 (episodes)</th>${["all", "spy>200&spyRSI<=30", "spy<200&spyRSI<=30", "spyRSI>70"].map((s) => K.MA_KEYS.map((k) => `<th>${ML[k]}<br><span class="q">${esc(s === "all" ? "any market" : s)}</span></th>`).join("")).join("")}</tr>
${BANDS7.map((bk) => `<tr><td>${esc(bandLabel[bk])}</td>${["all", "spy>200&spyRSI<=30", "spy<200&spyRSI<=30", "spyRSI>70"].map((s) => K.MA_KEYS.map((k) => `<td>${cell(N[`${k}:${bk}|${s}|20`]?.ep?.full, N[`any|${s}|20`].ep.full.win, 100)}</td>`).join("")).join("")}</tr>`).join("")}</table></div>`;
const repTable = `<div class="scroll"><table><tr><th>Run to the last close before the report · entry = first close in the 20 before it meeting the rule</th>${["all", "spy>200", "spy<200", "spyRSI<=30", "spy>200&spyRSI<=30", "spyRSI>70"].map((s) => `<th>${esc(SL[s])}</th>`).join("")}</tr>
${["any", ...K.RSI_LEVELS.map((T) => `rsi<=${T}`)].map((c) => `<tr${c === "any" ? ' class="base"' : ""}><td><b>${c === "any" ? "enter at the window start (no rule)" : `RSI bottom ${c.slice(5)}%`}</b></td>${["all", "spy>200", "spy<200", "spyRSI<=30", "spy>200&spyRSI<=30", "spyRSI>70"].map((s) => { const x = R[`${c}|${s}`]; const b = R[`any|${s}`];
  return `<td>${cell(x?.full, c === "any" ? null : b.full.win, 50)}${x ? `<br><span class="q">mid ${x.full.med > 0 ? "+" : ""}${x.full.med}% · vs SPY ${x.vs_spy.med > 0 ? "+" : ""}${x.vs_spy.med} · 5y ${f1(x.l5.win)}% · last 12 ${f1(x.last12.win)}%</span>` : ""}</td>`; }).join("")}</tr>`).join("")}</table></div>`;

/* ---------- step 4 · recency ---------- */
const brk = d.regime_breaks.map((b) => `<tr><td><b>${b.t}</b></td><td>${f1(b.full.win)}% of ${b.full.n}</td><td>${f1(b.l5.win)}% of ${b.l5.n}</td><td>${sh(b.last12.win, b.full.win)} of ${b.last12.n}</td><td>${c8(b.c8)}</td><td>${pct(b.full.med)} → ${pct(b.last12.med)}</td></tr>`).join("");
function nameCard(t) {
  const p = d.names.per_name[t]; if (!p) return "";
  const lv = ["any", ...K.RSI_LEVELS.map((T) => `rsi<=${T}`)];
  return `<h3>${t} · ${p.reports} reports measured (${p.first} → ${p.last})</h3><div class="scroll"><table><tr><th>Entry</th><th>Run to report · full</th><th>Last 5 years</th><th>Last 12 reports</th><th>Last 8 went up</th><th>vs SPY (middle)</th><th>20 sessions from an RSI episode · full</th><th>· last 5 years</th></tr>
${lv.map((k) => { const x = p.to_report[k], f = p.fwd20[k]; if (!x) return "";
  return `<tr${k === "any" ? ' class="base"' : ""}><td>${k === "any" ? "window start / any day" : `RSI bottom ${k.slice(5)}%`}</td><td>${cell(x.full, k === "any" ? null : p.to_report.any.full.win, 5)} · ${pct(x.full.med)}</td><td>${cell(x.l5, k === "any" ? null : p.to_report.any.l5.win, 4)}</td><td>${cell(x.last12, k === "any" ? null : p.to_report.any.last12.win, 3)}</td><td>${c8(x.c8)}</td><td>${pct(x.vs_spy_med)}</td>
<td>${f ? `${cell(f.full, k === "any" ? null : p.fwd20.any.full.win, 5)} · ${pct(f.full.med)}` : ""}</td><td>${f ? cell(f.l5, k === "any" ? null : p.fwd20.any.l5.win, 4) : ""}</td></tr>`; }).join("")}</table></div>`;
}

/* ---------- step 5 · examples ---------- */
const plainCond = (c) => c.replace(/rsi<=(\d+)/, "stock RSI in its bottom $1%").replace(/&/g, " + ").replace(/(e13|e21|s50|s200):([\w-]+)/, (_, k, b) => `close ${bandLabel[b]} vs its ${ML[k]}`);
const ex = d.combos.chosen.map((c, i) => `<h3>${i + 1} · ${esc(plainCond(c.cond))} · market: ${esc(SL[c.state])}</h3>
<table><tr><th></th><th>2004–2016 (found)</th><th>2017–2026 (confirmed)</th><th>Any day, same half</th><th>The market state alone</th></tr>
<tr><td>Trades (non-overlapping) · entry months</td><td>${n0(c.disc.n)} · ${c.disc.months}</td><td>${n0(c.conf.n)} · ${c.conf.months}</td><td>${n0(d.combos.base_halves.disc.n)} · ${n0(d.combos.base_halves.conf.n)}</td><td>${n0(c.state_alone?.full?.n)}</td></tr>
<tr><td>Up after 20 sessions</td><td>${sh(c.disc.win, d.combos.base_halves.disc.win)}</td><td>${sh(c.conf.win, d.combos.base_halves.conf.win)}${ci(c.ci_conf)}</td><td>${f1(d.combos.base_halves.disc.win)}% · ${f1(d.combos.base_halves.conf.win)}%</td><td>${f1(c.state_alone?.full?.win)}%</td></tr>
<tr><td>Middle result</td><td>${pct(c.disc.med)}</td><td>${pct(c.conf.med)}</td><td>${pct(d.combos.base_halves.disc.med)} · ${pct(d.combos.base_halves.conf.med)}</td><td>${pct(c.state_alone?.full?.med)}</td></tr>
<tr><td>Checks</td><td colspan="4">whole-history 95% range (month-clustered) ${f1(c.ci[0])}–${f1(c.ci[1])}% · shuffle baseline (same names, same market state, random days) ${f1(c.shuffle.mean)}%, 95th ${f1(c.shuffle.p95)}% · vs SPY same days: middle ${pct(c.vs_spy.med)}, beat SPY ${f1(c.vs_spy.beat)}%</td></tr></table>
<div class="scroll"><table><tr><th>Ticker</th><th>Entry (close)</th><th>Stock RSI · own %</th><th>vs ${ML[c.trades[0]?.ma] ?? "average"}: % · usual days · own %</th><th>SPY RSI own % · SPY vs 200-day</th><th>Exit 20 sessions later (close)</th><th>Result</th><th>SPY same days</th></tr>
${c.trades.map((t) => `<tr><td><b>${t.ticker}</b></td><td>${t.entry}<br>${t.entry_close}</td><td>${f1(t.rsi)} · ${f1(t.rsi_pct)}%</td><td>${pct(t.ma_dist_pct)} · ${t.ma_dist_ud} · ${f1(t.ma_own_pct)}%</td><td>${f1(t.spy_rsi_pct)}% · ${pct(t.spy_d200)}</td><td>${t.exit}<br>${t.exit_close}</td><td>${pct(t.ret)}</td><td>${pct(t.spy_ret)}</td></tr>`).join("")}</table></div>`).join("\n");
const repTop = d.combos.to_report_top10.slice(0, 5).map((c) => `<tr><td>${esc(plainCond(c.cond))}<br><span class="q">${esc(SL[c.state])}</span></td><td>${n0(c.disc.n)} · ${sh(c.disc.win, d.combos.to_report_base.disc.win)}</td><td>${n0(c.conf.n)} · ${sh(c.conf.win, d.combos.to_report_base.conf.win)}</td><td>${pct(c.full.med)}</td><td>${pct(c.vs_spy.med)}</td><td>${cell(c.last12, null, 10)}</td></tr>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>The ladder · S8 · 27 Sep 2026</title>
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
.up{color:#00FFA3}.dn{color:#FF2D55}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table{font-size:12px}th,td{padding:5px 6px}code{overflow-wrap:anywhere}}
</style></head><body>
<span data-scnav-slot></span><h1>The ladder: if I bought at this RSI level, or at this average, how did it go?</h1>
<p class="q">S8 · 27 Sep 2026 · built ${esc(d.built_utc.slice(0, 16).replace("T", " "))} UTC · forward outcomes only · price only · nothing here predicts</p>
<ol class="lead">${lead.map((s) => `<li>${s}</li>`).join("")}</ol>
<div class="status"><b>STATUS · built and measured on real data.</b> ${Object.keys(I).length} index and sector funds, ${n0(d.names.count)} stocks, bars to ${esc(spy.last)}. Every number is measured <b>forward</b> from the close of the day the condition was true, with every reading taken from that day's bar and earlier. A green share is above that row's own any-day line and a red one is below it; a green or red return is up or down.</div>

<h2>How to read every table</h2>
<ul>
<li><b>RSI at or below X%</b>: RSI(14) (Wilder's) ranked against the fund's or stock's own previous 3 years (756 sessions, at least 250 readings). “Bottom 5%” means lower than 95% of its own readings over the past 3 years. Today's reading is never inside its own sample.</li>
<li><b>The averages</b> are the Station cloud lines exactly (<code>station-clouds.js</code>): 13- and 21-day EMAs started at the first close, weight 2/(n+1), not used for the first 60 sessions; 50- and 200-day simple averages. <b>Distance</b> is counted in <b>usual days</b> (the % gap ÷ the instrument's own 60-session spread of daily moves). The bands (bottom 10%, 10–25%, …, top 10%) are the distance's rank in its own previous 3 years, so every instrument gets its own bands; each cell says what the band meant in usual days and %. <b>At the average</b> = within ½ usual day of it.</li>
<li><b>Episode</b> = the first day of an unbroken run of days the condition is true (a week of low RSI counts once). <b>Non-overlapping trades</b> = the first signal, then the next one only after the holding period is over. Entry and exit are closes. No costs.</li>
<li><b>Up after 20</b> = the close 20 sessions later is above the entry close. <b>Middle</b> = the median result. <b>Trend on</b> = the instrument closed above its own 200-day that day.</li>
<li><b>95% range</b> = a bootstrap that resamples whole calendar months, because sell-offs make many days (and many names) fire together. <b>Shuffle 95th</b> = draw the same number of random days from the same instrument (and, for stocks, the same market state) 200 times; a share above the 95th of those draws is not luck of the draw.</li>
<li><b>Recency columns</b>: full history · last 5 years (entries from ${K.LAST5}) · last 250 episodes (funds) or each stock's own last 12 episodes / last 12 reports (stocks). <b>Last 8</b> = how many of the latest 8 episodes went up (funds, single stocks); for pooled stocks, in how many of the last 8 calendar years the condition beat that year's any-day line.</li>
</ul>

<h2>1 · First, the report-timing fault — fixed</h2>
<p>The earnings export had a before-open / after-close flag on only ${n0(tm.sources.export)} of ${n0(Object.values(tm.sources).reduce((a, b) => a + b, 0))} reports. S6 treated a blank as “after the close”, so for a morning reporter (JPM, WMT, HD…) the “run-up” quietly included the report-day reaction. <b>FMP's calendar was not used</b>: its key is not in this machine's environment, and the brief allows the environment only. So every missing time was <b>inferred and flagged</b> in a new file, <code>research/statistics/data/earnings-export-timed-20260927.json</code>:</p>
<ul>
<li><b>The rule:</b> a report before the open moves the overnight gap into the report date, and one after the close moves it into the next session. When one gap is at least twice the other and at least one usual day, that decides it (${n0(tm.sources["inferred: opening gap"])} reports). When neither gap is clear, the name's own clear calls within 3 years decide (${n0(tm.sources["inferred: the name's clear calls within 3 years"])}). A report dated on a weekend or holiday reacts on the next session either way (${n0(tm.sources["inferred: no session on the date"])}). Still unknown: ${n0(tm.sources.unknown)} — these are left out of the run-to-report study.</li>
<li><b>Checked against the ${n0(V.agree + V.disagree + V.ambiguous + V.either)} reports whose time the export does carry:</b> where the gap rule made a call, it agreed ${f1(V.agreement_pct)}% of the time (${V.agree} right, ${V.disagree} wrong, ${V.ambiguous} left to the neighbour rule).</li>
<li><b>What changed in S6</b> (all names pooled): ${n0(T0.reports_moved_to_the_earlier_session)} reports moved to the earlier news session. The run-up was up ${f1(T0.old_convention.runup_share_up)}% → <b>${f1(T0.corrected.runup_share_up)}%</b>, middle ${pct(T0.old_convention.runup_median)} → <b>${pct(T0.corrected.runup_median)}</b>. The report-day move (middle size, either direction) grew from ${f1(T0.old_convention.abs_report_day_median)}% to <b>${f1(T0.corrected.abs_report_day_median)}%</b> — the reaction now lands on the report day, where it belongs. Pooled, the run-up barely changes; name by name it can change a lot:</li>
</ul>
<div class="scroll"><table><tr><th>Name</th><th>Reports now before the open</th><th>Reports moved</th><th>Run-up up: old → corrected</th><th>Run-up middle</th><th>Report-day size (middle)</th></tr>${tmNames}</table></div>

<h2>2 · The market first — the tide</h2>
<p>Each staircase answers: if you bought the fund on the first day its RSI reached this level, how did it go 20 sessions later? Every row includes all the lower rows (“bottom 20%” includes the bottom 5%); the last column shows only that step. 10- and 40-session versions are in the JSON (<code>indexes.&lt;fund&gt;.rows["rsi&lt;=T|all|10"]</code>).</p>
<h3>SPY</h3>${staircase("SPY")}
<details><summary>SPY at 10 and at 40 sessions</summary>${staircase("SPY", 10)}${staircase("SPY", 40)}</details>
<h3>QQQ</h3><p class="q">QQQ's bars have a hole from Nov 2004 to Mar 2011 (the QQQQ ticker years). The chart API does not serve QQQQ (“SYMBOL_NOT_TRACKED”), so QQQ is read from 2011 on and its ranking starts in 2012.</p>${staircase("QQQ")}
<h3>IWM</h3>${staircase("IWM")}
<h3>DIA</h3>${staircase("DIA")}
<h3>SMH</h3>${staircase("SMH")}
<h3>Every fund on one line (20 sessions)</h3>${sectorSummary}
<details><summary>The full staircase for each sector fund</summary>${sectors.map((s) => `<h3>${s}</h3>${staircase(s)}`).join("")}</details>

<h3>Where you bought against the average (SPY)</h3>
<p>Each cell: share up after 20 sessions, episodes, middle result; below it what the band meant for SPY, then the trend-on / trend-off split.</p>${maTable("SPY")}
<details><summary>QQQ, IWM, DIA, SMH against the averages</summary>${["QQQ", "IWM", "DIA", "SMH"].map((s) => `<h3>${s}</h3>${maTable(s)}`).join("")}</details>
<h3>“Extended” — your stress case</h3>
<p>The close in the top 30 / 20 / 10 / 5% of its own distances above the average. Green means it did <i>better</i> than any day, which is the opposite of the worry.</p>${extTable}
<h3>RSI × average (SPY)</h3>${grid("SPY", "s200")}${grid("SPY", "e21")}
<details><summary>The same grid for QQQ, IWM, DIA and SMH (200-day)</summary>${["QQQ", "IWM", "DIA", "SMH"].map((s) => grid(s, "s200")).join("")}</details>

<h2>3 · Stocks, with the tide stated</h2>
<p>${n0(d.names.count)} stocks with bars (every name in the earnings export that has at least 400 daily bars; the funds GLD, USO, MAGS, EWG, EWY and IEF are left out, and so is SPCX, whose bars join a SPAC fund to Apr 2026 and SpaceX from Jun 2026). Each entry is labelled with the market's state that day: SPY above or below its 200-day, and SPY's own RSI rank. Every result is also compared with SPY over the very same sessions: <b>did the stock beat the tide, or just ride it?</b></p>
<h3>The RSI ladder in each market state (20 sessions, episodes; cells with fewer than 100 are marked)</h3>${nameLadder}
<h3>In detail: any market</h3>${nameDetail("all")}
<h3>In detail: a pullback in a rising market</h3>${nameDetail("spy>200&spyRSI<=30")}
<h3>In detail: a sell-off in a falling market</h3>${nameDetail("spy<200&spyRSI<=30")}
<details><summary>Every other market state, and 10 / 40 sessions</summary>${["spy>200", "spy<200", "spyRSI<=30", "spyRSI30-70", "spyRSI>70"].map((s) => `<h3>${esc(SL[s])}</h3>${nameDetail(s)}`).join("")}<h3>Any market · 10 sessions</h3>${nameDetail("all", 10)}<h3>Any market · 40 sessions</h3>${nameDetail("all", 40)}</details>
<h3>Stocks against their own averages</h3>${maNames}
<h3>The run to the report (timing corrected)</h3>
<p>For each report: the 20 closes before the last close before the news. Entry at the first of those closes where the rule is true, exit at the last close before the news (no report risk held). The top row enters at the window start with no rule. Market state is read on the entry day. ${n0(d.names.reports_used)} reports; ${n0(d.names.reports_unknown_timing_left_out)} left out because their time is still unknown.</p>${repTable}

<h2>4 · Recent vs history — where a name has changed</h2>
<p>Names whose last 12 run-ups into a report differ from their own whole history by 25 points or more (at least 40 reports measured). A break like this means the name's past is a weak guide to its present.</p>
<div class="scroll"><table><tr><th>Name</th><th>Run-up up · full history</th><th>Last 5 years</th><th>Last 12</th><th>Last 8 went up</th><th>Middle: full → last 12</th></tr>${brk}</table></div>
${nameCard("NVDA")}${nameCard("COST")}

<h2>5 · The strongest combinations, with trades</h2>
<p><b>How they were picked.</b> Every stock condition (RSI bottom 5/10/20/30/40/50% × each average band × each market state) was scored on 20-session non-overlapping trades. A combination qualified only with at least ${K.MIN_HALF} trades and ${K.MIN_MONTHS} different entry months in <b>both</b> 2004–2016 and 2017–2026, and both halves' middle results above the any-day middle. The score is the <i>smaller</i> of the two halves' lift over the any-day share. ${n0(d.combos.tested)} combinations qualified. The top 5 are below, one per average band — the same stock condition in a narrower market state is mostly the same trades, so only its best state is shown. Each shows five real trades from 2017 on: the three latest winners and the two latest losers, each from a different name and a different month.</p>
${ex}
<h3>The same search, into the report</h3>
<div class="scroll"><table><tr><th>Combination · market</th><th>2004–16 trades · up</th><th>2017–26 trades · up</th><th>Middle</th><th>vs SPY</th><th>Each name's last 12</th></tr>${repTop}</table></div>
<p class="q">Any report window, same halves: ${f1(d.combos.to_report_base.disc.win)}% and ${f1(d.combos.to_report_base.conf.win)}%.</p>

<h2>6 · What could be wrong</h2>
<ul>
<li><b>Many tries.</b> ${n0(d.combos.tested)} combinations qualified for the both-halves test, and more were looked at. With that many tries, some will look good by chance. Requiring both halves and checking the shuffle baseline cuts this down but does not remove it. Treat the top 5 as candidates, not rules.</li>
<li><b>Survivors only.</b> ${esc(d.survivorship)}.</li>
<li><b>Price only.</b> ${esc(d.price_basis)}.</li>
<li><b>Report times are inferred</b> for ${f1(100 * (1 - tm.sources.export / Object.values(tm.sources).reduce((a, b) => a + b, 0)))}% of reports (95% agreement where they could be checked). A wrong time moves one session between the run-up and the report day.</li>
<li><b>Clustering.</b> Stock entries bunch into the same sell-offs. The month-clustered ranges are wide for exactly that reason — a combination seen in “200 trades” may be only 40 or 50 separate months.</li>
<li><b>Regimes.</b> A ranking over the previous 3 years adapts, but 2004–2026 holds only a handful of bear markets, and funds like SPY spent 78% of days above their 200-day, so the “trend off” rows are thin.</li>
<li><b>QQQ</b> starts in 2011 (see above). <b>XLC</b> starts in 2018 and <b>XLRE</b> in 2015, so their rows are short.</li>
</ul>
<h2>What I did not do</h2>
<ul><li>No FMP call: its key is not in this machine's environment. No database write, no deploy, no push. No paid model API.</li>
<li>No costs, slippage, stops or position sizing. Exits are fixed (10/20/40 sessions, or the last close before the report).</li>
<li>No intraday data; entries and exits are daily closes.</li>
<li>The S6 page and its <code>runup-into-earnings.json</code> were left as they were. The corrected numbers are in <code>data/s8-timing.json</code> and summarised in part 1.</li></ul>
<p class="q">Data: <code>research/statistics/data/s8-ladder.json</code>, <code>s8-timing.json</code>, <code>earnings-export-timed-20260927.json</code>. Scripts: <code>research/statistics/ladder.mjs</code> (definitions), <code>s8-timing.mjs</code>, <code>s8-ladder.mjs</code>, <code>s8-page.mjs</code>. Tests: <code>tests/statistics-s8-ladder.test.mjs</code>.</p>
</body></html>`;
fs.writeFileSync(outFile, html);
/* a small summary for the statistics page's S8 section (the page never loads the 7.5 MB file) */
const strip = (x) => x ? { n: x.n, win: x.win, med: x.med } : null;
const summary = { built_utc: d.built_utc, deliverable: "../../deliverables/20260927/ladder/LADDER.html",
  lead: lead.map((s) => s.replace(/<[^>]+>/g, "")),
  funds: Object.fromEntries(Object.entries(I).filter(([, X]) => !X.missing).map(([sym, X]) => [sym, { from: X.first_percentile_day, note: X.gap_note,
    any: { all: strip(X.base["all:20"].full), on: strip(X.base["on:20"].full), off: strip(X.base["off:20"].full) },
    rows: K.RSI_LEVELS.map((T) => ({ T, all: strip(X.rows[`rsi<=${T}|all|20`].ep), ci: X.rows[`rsi<=${T}|all|20`].ci, p95: X.rows[`rsi<=${T}|all|20`].shuffle?.p95 ?? null,
      on: strip(X.rows[`rsi<=${T}|on|20`].ep), off: strip(X.rows[`rsi<=${T}|off|20`].ep), l5: strip(X.rows[`rsi<=${T}|all|20`].l5) })) }])),
  stocks: { count: d.names.count, states: ["all", "spy>200&spyRSI<=30", "spy<200&spyRSI<=30", "spyRSI>70"].map((s) => ({ s, label: SL[s], any: strip(N[`any|${s}|20`].ep.full),
    rows: K.RSI_LEVELS.map((T) => ({ T, x: strip(N[`rsi<=${T}|${s}|20`]?.ep?.full) })) })) },
  combos: d.combos.chosen.map((c) => ({ cond: plainCond(c.cond), state: SL[c.state], disc: strip(c.disc), conf: strip(c.conf) })), base_halves: { disc: strip(d.combos.base_halves.disc), conf: strip(d.combos.base_halves.conf) } };
fs.writeFileSync(path.join(here, "data/s8-summary.json"), JSON.stringify(summary));
console.log("wrote", outFile, (html.length / 1024).toFixed(0) + " KB");
