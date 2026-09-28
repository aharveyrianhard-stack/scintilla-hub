/* BOTTOMS · page + saved charts. node research/statistics/bottoms/bottoms-page.mjs
   Reads deliverables/20260928/bottoms/data/bottoms.json, writes BOTTOMS.html and charts/*.svg next to it.
   The BACK / CLOSE pair is placed exactly as scripts/inject-scnav.py would (slot above the h1, snippet before </body>),
   without running that script (it walks other pages; this lane touches only its own). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { lineChart, barChart, stackChart, UP, DN } from "./svg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const DIR = path.join(ROOT, "deliverables/20260928/bottoms"), CH = path.join(DIR, "charts");
const J = JSON.parse(fs.readFileSync(path.join(DIR, "data/bottoms.json"), "utf8"));
fs.mkdirSync(CH, { recursive: true });
const SAME = "#8A8A9E", NONE = "#2A2A36";
const saved = [];
const save = (name, svg) => { fs.writeFileSync(path.join(CH, name), svg); saved.push(name); return `<figure><img src="charts/${name}" alt="${name}" loading="lazy"><figcaption><a href="charts/${name}">charts/${name}</a></figcaption></figure>`; };
const n0 = (x) => x == null ? "—" : Math.round(x).toString(), n1 = (x) => x == null ? "—" : (Math.round(x * 10) / 10).toString(), n2 = (x) => x == null ? "—" : (Math.round(x * 100) / 100).toFixed(2);
const ord = (x) => { const v = Math.round(x), t = v % 100, u = v % 10; return v + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };
const pct = (x) => x == null ? "—" : `${Math.round(x)}%`;
const pv = (p) => p == null ? "—" : p < 0.01 ? "under 1 in 100" : `${n2(p)}`;
const P1 = J.part1, P2 = J.part2, P3 = J.part3;
const row = (curve, t) => { const r = curve.rows.find((x) => x[0] === t); return r ? { t: r[0], days: r[1], hit: r[2], eps: r[3], fa: r[4], caught: r[5] } : null; };
const COND = [["vix", "VIX (own percentile)"], ["ratio", "VIX ÷ VIX3M (own percentile)"], ["PCC", "Total put/call (PCC)"], ["PCCE", "Equity put/call (PCCE)"], ["PCCI", "Index put/call (PCCI)"],
  ["credit", "Credit: HYG÷LQD below its peak"], ["rsi", "RSI(14) low (own percentile)"], ["below200", "Below the 200-day (own percentile)"], ["breadth", "Few names above their 50-day"], ["volume", "Volume vs its 50-day"], ["dispersion", "Dispersion across names"]];

/* ---------- PART 1 ---------- */
const TURNS = [["vix", "VIX peak"], ["ratio", "VIX÷VIX3M peak"], ["pcc", "Put/call (PCC) peak"], ["pcce", "Equity put/call peak"], ["credit", "Credit (HYG÷LQD) trough"], ["rsi", "RSI trough"], ["breadth", "% above 50-day trough"]];
const turnRows = (G) => TURNS.map(([k, label]) => { const t = G.turns[k]; const tot = t.n || 1; return { label, parts: [{ v: 100 * t.before / tot, col: UP }, { v: 100 * t.same / tot, col: SAME }, { v: 100 * t.after / tot, col: DN }, { v: 100 * t.none / tot, col: NONE }] }; });
const LEG = [{ name: "turned BEFORE the price low", col: UP }, { name: "same day", col: SAME }, { name: "AFTER the price low", col: DN }, { name: "no turn in that swing", col: NONE }];
let figs1 = "";
for (const s of ["SPY", "QQQ", "IWM"]) {
  const G = P1[s].summary.all, deep = { ...G, turns: Object.fromEntries(Object.keys(G.turns).map((k) => { const a = P1[s].summary["10–20%"].turns[k], b = P1[s].summary["20%+"].turns[k]; return [k, { n: a.n + b.n, before: a.before + b.before, same: a.same + b.same, after: a.after + b.after, none: a.none + b.none }]; })) };
  figs1 += save(`p1-turns-${s}.svg`, stackChart({ title: `${s} · who turned first, at every swing low (${G.n} lows, ${P1[s].from.slice(0, 4)}–2026)`, sub: `Each condition's own swing (same 10-bar pivot rule) nearest the price low, inside the swing that contains it.`, rows: turnRows(G), legend: LEG }));
  figs1 += save(`p1-turns-${s}-deep.svg`, stackChart({ title: `${s} · the same, only lows that ended a fall of 10% or more (${P1[s].nDeep} lows)`, rows: turnRows(deep), legend: LEG }));
}
// VIX offset histogram, pooled
const offs = ["SPY", "QQQ", "IWM"].flatMap((s) => P1[s].lows.map((r) => r.vixTurn)).filter((x) => x != null);
const hb = []; for (let o = -20; o <= 20; o++) hb.push({ label: o % 5 === 0 ? String(o) : "", v: offs.filter((x) => (o === -20 ? x <= -20 : o === 20 ? x >= 20 : x === o)).length, col: o < 0 ? UP : o === 0 ? SAME : DN, show: false });
const figVixHist = save("p1-vix-offset.svg", barChart({ title: `VIX swing high vs the price swing low — sessions apart (SPY+QQQ+IWM, ${offs.length} lows)`, sub: "left of 0 (green) = the VIX peaked first · 0 = same session · right (red) = the VIX peaked after the price low · ends hold ±20 and beyond", bars: hb, yLabel: "number of lows", xLabel: "sessions from the price low to the VIX's own swing high" }));
// event-aligned
const evFig = (key, title, yLabel, sub, sym = "SPY") => {
  const E = P1[sym].ev[key], mk = (rows) => rows.map((r) => [r.o, r.med]);
  return save(`p1-ev-${key}-${sym}.svg`, lineChart({ title, sub, xLabel: "sessions from the swing (0 = the low / the top)", yLabel, marks: [{ x: 0, label: "the swing" }],
    series: [{ name: `all ${P1[sym].nLows} lows (band = middle half)`, pts: mk(E.all), band: E.all.map((r) => [r.o, r.q1, r.q3]) }, { name: `lows after 10%+ falls (${P1[sym].nDeep})`, pts: mk(E.deep), dash: "9 6" }, { name: "swing highs (tops)", pts: mk(E.tops), dash: "2 6", width: 2 }] }));
};
const figsEv = [
  evFig("vixPct", "VIX around SPY swing lows — own-history percentile (median)", "VIX percentile vs all its earlier days", "100 = the highest VIX ever seen up to that day"),
  evFig("ratio", "VIX ÷ VIX3M around SPY swing lows (median)", "ratio (above 1.00 = inverted)", "1.00 = near-term fear equals 3-month fear; above it the curve is inverted"),
  evFig("pccPct", "Total put/call (Cboe PCC) around SPY swing lows — own percentile (median)", "put/call percentile", "higher = more puts bought per call than usual"),
  evFig("pccePct", "Equity put/call (Cboe PCCE) around SPY swing lows — own percentile (median)", "equity put/call percentile", "stock options only (no index hedges)"),
  evFig("credit", "Credit (HYG ÷ LQD, dividend-adjusted) around SPY swing lows", "% vs its level on the day of the low", "junk bonds against investment-grade bonds; falling = credit stress"),
  evFig("rsi", "RSI(14) of SPY around its swing lows (median)", "RSI(14)", "the low day is often NOT the lowest RSI — see who turned first"),
  evFig("a50", "Share of the 486 served names above their 50-day, around SPY swing lows", "% of names above their 50-day", "today's universe, back-filled — see 'what could be wrong'"),
];

// base-rate curves
const baseFig = (sym, key, label, C = P1[sym].curves[key], D = P1[sym].curvesDeep[key]) => {
  const pts = (c, i) => c.rows.map((r) => [r[0], r[i]]);
  return save(`p1-base-${key}-${sym}.svg`, lineChart({ title: `${sym} · ${label}`, w: 760, h: 440, sub: `any day: ${n1(C.base)}% have a low within 10 bars (10%+ lows: ${n1(D.base)}%)`,
    xLabel: "condition at or beyond this own-history percentile", yLabel: "%", yDomain: [0, 100], yMarks: [{ y: C.base, label: `any day ${n0(C.base)}%` }],
    series: [{ name: "days → a low follows", pts: pts(C, 2), width: 3 }, { name: "lows caught", pts: pts(C, 5), width: 1.3 }, { name: "days → a 10%+ low", pts: pts(D, 2), dash: "10 6", width: 2.2 }, { name: "10%+ lows caught", pts: pts(D, 5), dash: "2 5", width: 1.8 }] }));
};
const figsBase = COND.map(([k, label]) => P1.SPY.curves[k] ? baseFig("SPY", k, label) : "").join("");
const comboNames = Object.keys(P1.SPY.combos);
const figCombo = baseFig("SPY", "combo4", "VIX + put/call + RSI + breadth, all four at once", P1.SPY.combos[comboNames.at(-1)], P1.SPY.combosDeep[comboNames.at(-1)]);

/* ---------- PART 2 ---------- */
const G2 = P2.groups, OUTL = { toNextHigh: "Return to the next swing high", fallBeforeHigh: "Worst fall before that next swing high", barsToHigh: "Sessions to the next swing high", furtherFall: "Further fall before the close is back above the 200-day", toReclaim: "Sessions until the close is back above the 200-day" };
const p2Fig = (key, yLabel, sub) => {
  const S = (g, extra = {}) => ({ name: { pooled: "pooled (band = 90% bootstrap)", indexes: "4 index funds", sectors: "11 sectors + SMH", stocks: "20 largest stocks" }[g], pts: G2[g][key].bins.map((b) => [(b.lo + b.hi) / 2, b.med]), ...extra });
  return save(`p2-${key}.svg`, lineChart({ title: OUTL[key], sub, xLabel: "distance to the 200-day as an own-history percentile (1 = the deepest below it has ever been; 50 = its usual distance)", yLabel,
    series: [S("pooled", { band: G2.pooled[key].bins.map((b) => [(b.lo + b.hi) / 2, b.bandLo, b.bandHi]), width: 3 }), S("indexes", { dash: "9 6" }), S("sectors", { dash: "3 5" }), S("stocks", { width: 1.3 })] }));
};
const figsP2 = [p2Fig("furtherFall", "median further fall, %", "days below the 200-day only · the line falls where deeper days fell further"), p2Fig("toReclaim", "median sessions", "days below the 200-day only"),
  p2Fig("toNextHigh", "median return, %", "every day · price at the next confirmed swing high vs that day's close"), p2Fig("fallBeforeHigh", "median worst fall, %", "every day · lowest close before the next swing high")];
const permTable = `<div class="scroll"><table><tr><th>outcome</th>${["indexes", "sectors", "stocks", "pooled"].map((g) => `<th>${g}: rank link (ρ)</th><th>random-shift 95% range</th><th>chance of this by luck</th>`).join("")}</tr>${Object.keys(OUTL).map((k) => `<tr><td>${OUTL[k]}</td>${["indexes", "sectors", "stocks", "pooled"].map((g) => { const x = G2[g][k]; return `<td>${n2(x.rho)}</td><td>${n2(x.nullLo)} … ${n2(x.nullHi)}</td><td>${pv(x.p)}</td>`; }).join("")}</tr>`).join("")}</table></div>`;
const perRows = Object.entries(P2.per).map(([s, p]) => p.missing ? `<tr><td>${s}</td><td colspan="7">missing</td></tr>` : `<tr><td>${s}</td><td>${p.group}</td><td>${p.from}</td><td>${p.days}</td><td>${p.belowDays} (${p.belowStretches} stretches)</td><td>${n2(p.deepest)}% (${p.deepestDate})</td><td class="${p.now.d >= 0 ? "up" : "dn"}">${n2(p.now.d)}%</td><td>${n1(p.now.pct)}</td></tr>`).join("");

/* ---------- PART 3 ---------- */
const figSize = save("p3-tide-by-size.svg", lineChart({ title: "Rising tide: share of the 486 names moving WITH SPY, by the size of SPY's day", sub: `x = SPY's move size as its own percentile (bins of 5) · ${P3.upDays.n} up days, ${P3.downDays.n} down days since 2003`,
  xLabel: "size of SPY's daily move (own percentile; right = bigger)", yLabel: "% of names moving the same way (median)", yDomain: [40, 100],
  series: [{ name: "SPY up days: % of names up", pts: P3.bySizeUp.map((b) => [(b.lo + b.hi) / 2, b.med]), band: P3.bySizeUp.map((b) => [(b.lo + b.hi) / 2, b.q1, b.q3]) }, { name: "SPY down days: % of names down", pts: P3.bySizeDown.map((b) => [(b.lo + b.hi) / 2, b.med]), dash: "9 6" }] }));
const figDist = save("p3-tide-dist.svg", lineChart({ title: "The whole distribution: on an SPY up day, what share of names rose?", sub: "every SPY up / down day since 2003, sorted — read across: at the 50th percentile day, x% of names moved with SPY",
  xLabel: "percentile of days (1 = the narrowest day, 99 = the broadest)", yLabel: "% of names moving with SPY", yDomain: [0, 100],
  series: [{ name: "SPY up days (486 names)", pts: P3.upDays.pct.map((v, i) => [i + 1, v]) }, { name: "SPY down days (486 names)", pts: P3.downDays.pct.map((v, i) => [i + 1, v]), dash: "9 6" }, { name: "11 sector funds, up days", pts: P3.sectUp.pct.map((v, i) => [i + 1, v]), dash: "2 5", width: 1.8 }] }));
const D3 = P3.dispersion;
const figDisp = save("p3-dispersion.svg", lineChart({ title: "Dispersion across the 486 names around SPY swing lows and tops", sub: "dispersion = spread of the day's moves across names (middle half, high minus low), as its own percentile",
  xLabel: "sessions from the swing", yLabel: "dispersion percentile (median)", marks: [{ x: 0, label: "the swing" }],
  series: [{ name: "all lows", pts: D3.lows.map((r) => [r.o, r.med]), band: D3.lows.map((r) => [r.o, r.q1, r.q3]) }, { name: "lows after 10%+ falls", pts: D3.deep.map((r) => [r.o, r.med]), dash: "9 6" }, { name: "tops", pts: D3.tops.map((r) => [r.o, r.med]), dash: "2 6", width: 2 }] }));
const L = P3.levels.a50, lv = (o) => o.pct.map(([p, v]) => [p, v]);
const figLevels = save("p3-levels-a50.svg", lineChart({ title: "Guide levels: % of names above their 50-day — where it sat at lows vs tops vs any day", sub: `read across: e.g. at the 50th percentile, half of all SPY swing lows had fewer than ${n0(L.lows.pct[3][1])}% of names above their 50-day`,
  xLabel: "percentile of the occasions", yLabel: "% of names above their 50-day", yDomain: [0, 100], legend: true,
  series: [{ name: "any day", pts: lv(L.allDays), width: 1.4 }, { name: `SPY swing lows (${L.lows.n})`, pts: lv(L.lows) }, { name: `lows after 10%+ falls (${L.deepLows.n})`, pts: lv(L.deepLows), dash: "9 6" }, { name: `SPY swing highs (${L.highs.n})`, pts: lv(L.highs), dash: "2 6" }] }));
const H = P3.history, years = H.dates.map((d) => +d.slice(0, 4) + (+d.slice(5, 7) - 1) / 12 + (+d.slice(8, 10)) / 365);
const lowMarks = P1.SPY.lows.filter((r) => r.depth <= -10).map((r) => { const y = +r.date.slice(0, 4) + (+r.date.slice(5, 7) - 1) / 12 + (+r.date.slice(8, 10)) / 365; return { x0: y - 0.02, x1: y + 0.02 }; });
const figHist = save("p3-a50-history.svg", lineChart({ title: "% of the served names above their 50-day, 2003 → 25 Sep 2026 (weekly points)", sub: "shaded columns = SPY swing lows that ended a fall of 10% or more", w: 1400, h: 440,
  xLabel: "year", yLabel: "% above 50-day", yDomain: [0, 100], xFmt: (v) => String(Math.round(v)), marks: lowMarks, legend: false, series: [{ name: "", pts: H.a50.map((v, i) => [years[i], v]), width: 1.2 }] }));

/* ---------- words ---------- */
const S1 = P1.SPY.summary, sDeep = (s, k) => { const a = P1[s].summary["10–20%"].turns[k], b = P1[s].summary["20%+"].turns[k]; return { n: a.n + b.n, first: a.before + b.before + a.same + b.same, before: a.before + b.before, same: a.same + b.same, after: a.after + b.after }; };
const vS = S1.all.turns.vix, vD = sDeep("SPY", "vix"), rD = sDeep("SPY", "rsi"), pD = sDeep("SPY", "pcc"), cD = sDeep("SPY", "credit");
const b90 = (k, s = "SPY") => row(P1[s].curves[k], 90), d90 = (k, s = "SPY") => row(P1[s].curvesDeep[k], 90), inv = P1.SPY.curves.inverted.rows[0], invD = P1.SPY.curvesDeep.inverted.rows[0];
const c4 = row(P1.SPY.combos[comboNames.at(-1)], 80), c4d = row(P1.SPY.combosDeep[comboNames.at(-1)], 80);
const ff = G2.pooled.furtherFall, rc = G2.pooled.toReclaim, th = G2.pooled.toNextHigh;
const now = P3.now;
const findings = [
  `<b>The VIX does not lag the bottom — it turns with it or just before it.</b> At SPY's ${vS.n} swing lows since 2003, the VIX's own swing high (same 10-bar pivot rule) came on the <b>same session in ${vS.same}</b>, <b>before in ${vS.before}</b> and after in only ${vS.after} (no VIX swing in that stretch: ${vS.none}). For lows that ended a fall of 10% or more: before or same day in <b>${vD.first} of ${vD.n}</b>. QQQ and IWM look the same (charts below).`,
  `<b>RSI and put/call usually turn FIRST.</b> SPY's RSI(14) made its swing low before the price low in ${S1.all.turns.rsi.before} of ${S1.all.turns.rsi.n} lows (${rD.before} of ${rD.n} deep ones) — the momentum low comes first, then price makes a slightly lower low. The put/call ratio (PCC) peaked before the price low in ${pD.before} of ${pD.n} deep lows. Credit is the slowest and the least reliable: over all ${S1.all.turns.credit.n} SPY lows the HYG÷LQD trough came after the price low in ${S1.all.turns.credit.after} and there was no credit swing at all in ${S1.all.turns.credit.none} (most small dips never reach credit); at the deep lows it turned before or with price in ${cD.first} of ${cD.n}.`,
  `<b>Every signal cries wolf — measured.</b> A random SPY day has a ${n0(P1.SPY.curves.vix.base)}% chance that a swing low follows within 10 bars. With the VIX at or above its 90th own percentile the chance is ${n0(b90("vix").hit)}%; ${n0(b90("vix").fa)}% of those VIX episodes were false alarms (no low followed); and ${n0(100 - b90("vix").caught)}% of all lows happened WITHOUT it. It is a deep-low detector, not an any-low detector: it was on before ${n0(d90("vix").caught)}% of the 10%+ lows.`,
  `<b>The best single companions to the VIX are RSI and put/call.</b> RSI at or beyond its 90th stress percentile (a low reading for its own history) was followed by a low on ${n0(b90("rsi").hit)}% of days (vs ${n0(P1.SPY.curves.rsi.base)}% any day) and caught every 10%+ low at the 80th–90th level. Equity put/call at its 90th percentile: ${n0(b90("PCCE").hit)}% of days followed by a low. All four together (VIX, put/call, RSI, breadth, each at or beyond its 80th percentile) : ${n0(c4.hit)}% of days followed by a low, ${n0(c4.fa)}% of episodes false alarms, ${n0(c4.caught)}% of lows caught (${n0(c4d.caught)}% of the 10%+ lows).`,
  `<b>VIX above VIX3M (inverted curve)</b> is a yes/no condition, no threshold to choose: ${n0(inv[1])} SPY days since 2006, ${n0(inv[2])}% followed by a low within 10 bars; ${n0(inv[4])}% of inversion episodes had no low follow; it was on before ${n0(inv[5])}% of all lows but ${n0(invD[5])}% of the 10%+ lows. At the 10%+ lows the inversion was present somewhere in the fall ${n1((P1.SPY.summary["10–20%"].invertedInDecline * P1.SPY.summary["10–20%"].n + P1.SPY.summary["20%+"].invertedInDecline * P1.SPY.summary["20%+"].n) / (P1.SPY.summary["10–20%"].n + P1.SPY.summary["20%+"].n))}% of the time.`,
  `<b>Deep below the 200-day IS a measured problem — for the fall and the wait, not for the eventual bounce.</b> Pooling ${Object.values(P2.per).filter((p) => !p.missing).length} instruments (4 index funds, 11 sectors + SMH, the 20 largest US stocks), days in the deepest 5% of their own history below the 200-day went on to fall a further <b>${n1(-ff.bins[0].med)}%</b> (median) before a close back above it (any below-200 day: ${n1(-ff.all)}%), and took a median <b>${n0(rc.bins[0].med)} sessions</b> to get back (any below-200 day: ${n0(rc.all)}). The link holds in every group (rank link ρ ${n2(G2.indexes.furtherFall.rho)} indexes, ${n2(G2.sectors.furtherFall.rho)} sectors, ${n2(G2.stocks.furtherFall.rho)} stocks; shuffles that keep each series' clustering never produced it). But those same deep days also had the biggest median rise to the next swing high: <b>${n1(th.bins[0].med)}%</b> vs ${n1(th.all)}% for any day. Deep = wider range both ways.`,
  `<b>The rising tide is real and scales with the day.</b> On a median SPY up day ${n0(P3.upDays.pct[49])}% of the 486 names rise; on the biggest 5% of SPY days it is ${n0(P3.bySizeUp.at(-1).med)}% (up) and ${n0(P3.bySizeDown.at(-1).med)}% (down). Over whole SPY swings the tide is stronger: a median ${n0(P3.legs.up.med)}% of names rose over an up-swing, ${n0(P3.legs.up.sectMed)}% of the sectors. Dispersion peaks AT lows (median ${ord(D3.lows[30].med)} percentile on the low day; ${ord(D3.deep[30].med)} at 10%+ lows) and is ordinary at tops (${ord(D3.tops[30].med)}).`,
  `<b>Today's tide (25 Sep close) is narrow.</b> SPY closed ${n1(-now.spyFromHigh)}% below its highest close, yet only ${n0(now.a50)}% of names are above their 50-day (${ord(now.a50pct)} percentile of their own history), only ${n0(now.sinceLowShare)}% of names are above where they were at SPY's last swing low (${now.lastSwingLow}), and equal-weight (RSP) has lagged SPY by ${n1(-now.eqwVsCapSinceLow)} points since that low. Research reading, not a call.`,
];

const levelTable = (key, label) => { const Lk = P3.levels[key]; const cols = [["allDays", "any day"], ["lows", "SPY swing lows"], ["deepLows", "lows after 10%+"], ["highs", "SPY swing highs"]]; return `<table><tr><th>${label}</th>${[5, 10, 25, 50, 75, 90, 95].map((p) => `<th>${p}th pct</th>`).join("")}<th>n</th></tr>${cols.map(([k, l]) => `<tr><td>${l}</td>${Lk[k].pct.map(([, v]) => `<td>${n1(v)}</td>`).join("")}<td>${Lk[k].n}</td></tr>`).join("")}</table>`; };
const condAtLows = (s) => { const A = P1[s].summary; const cols = ["all", "0–3%", "3–5%", "5–10%", "10–20%", "20%+"]; const R = [["n", (g) => g.n], ["VIX", (g) => g.at.vix?.med], ["VIX own pct", (g) => g.at.vixPct?.med], ["VIX÷VIX3M", (g) => n2(g.at.ratio?.med)], ["inverted on the low day %", (g) => g.invertedAtLow], ["inverted somewhere in the fall %", (g) => g.invertedInDecline], ["put/call PCC", (g) => n2(g.at.pcc?.med)], ["PCC own pct", (g) => g.at.pccPct?.med], ["credit fall in the decline %", (g) => g.at.creditDecline?.med], ["RSI(14)", (g) => g.at.rsi?.med], ["RSI own pct", (g) => g.at.rsiPct?.med], ["% from 200-day", (g) => g.at.d200?.med], ["closed below 200-day %", (g) => g.below200], ["volume ÷ 50-day", (g) => n2(g.at.volRatio?.med)], ["% names above 50-day", (g) => g.at.a50?.med], ["% names above 200-day", (g) => g.at.a200?.med], ["dispersion pct", (g) => g.at.dispPct?.med], ["cloud line reached: 13 EMA %", (g) => g.lines.e13], ["… 21 EMA %", (g) => g.lines.e21], ["… 50 SMA %", (g) => g.lines.s50], ["… 200 SMA %", (g) => g.lines.s200]];
  return `<div class="scroll"><table><tr><th>${s} · median at the low</th>${cols.map((c) => `<th>${c === "all" ? "all lows" : "fall of " + c}</th>`).join("")}</tr>${R.map(([l, fn]) => `<tr><td>${l}</td>${cols.map((c) => `<td>${A[c] && A[c].n ? (typeof fn(A[c]) === "number" ? n1(fn(A[c])) : fn(A[c]) ?? "—") : "—"}</td>`).join("")}</tr>`).join("")}</table></div>`; };
const readTable = (sym) => { const ts = [50, 80, 90, 95, 99]; return `<div class="scroll"><table><tr><th>${sym} · condition</th>${ts.map((t) => `<th>at/over ${t}th: days → low follows</th><th>episodes false alarm</th><th>lows caught (10%+ caught)</th>`).join("")}</tr>${COND.filter(([k]) => P1[sym].curves[k]).map(([k, l]) => `<tr><td>${l}<br><span class="q">any day ${n0(P1[sym].curves[k].base)}%</span></td>${ts.map((t) => { const r = row(P1[sym].curves[k], t), d = row(P1[sym].curvesDeep[k], t); return `<td>${n0(r.days)} → ${pct(r.hit)}</td><td>${pct(r.fa)} of ${r.eps}</td><td>${pct(r.caught)} (${pct(d.caught)})</td>`; }).join("")}</tr>`).join("")}${comboNames.map((k) => `<tr><td>${k}</td>${ts.map((t) => { const r = row(P1[sym].combos[k], t), d = row(P1[sym].combosDeep[k], t); return `<td>${n0(r.days)} → ${pct(r.hit)}</td><td>${pct(r.fa)} of ${r.eps}</td><td>${pct(r.caught)} (${pct(d.caught)})</td>`; }).join("")}</tr>`).join("")}</table></div>`; };
const srcRows = Object.entries(J.sources).filter(([k]) => !P3 || ["VIX", "^VIX3M (eod)", "PCC", "PCCE", "PCCI", "PCSPX", "HYG (eodadj)", "LQD (eodadj)", "SPY", "QQQ", "IWM", "DIA", "RSP", ...J.caps.top20, "XLK", "SMH"].includes(k)).map(([k, v]) => `<tr><td>${k}</td><td>${v.src}</td><td>${v.from}</td><td>${v.to}</td><td>${v.bars}</td></tr>`).join("");

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bottoms · conditions at swing lows · 28 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#B4B4C6;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#C8C8D2}h2{font-size:27px;margin:52px 0 8px;color:#C8C8D2;border-top:1px solid #24242E;padding-top:22px}h3{font-size:20px;margin:30px 0 6px;color:#C8C8D2}
p,li{max-width:1100px}.q{color:#9C9CAE;font-size:13px}
ol.lead{font-size:18px;color:#C8C8D2;max-width:1160px;padding-left:24px}ol.lead li{margin:0 0 14px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1100px;color:#C8C8D2}
figure{margin:18px 0}figure img{width:100%;max-width:1400px;height:auto;display:block;border:1px solid #1E1E28}figcaption{font:12px ui-monospace,Menlo,monospace;color:#8A8A9E}figcaption a{color:#9C9CAE}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:10px}.grid figure{margin:6px 0}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
td.up{color:#00FFA3}td.dn{color:#FF2D55}
.gauges{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;max-width:1400px}.g{background:#0B0B12;border:1px solid #24242E;padding:12px 14px}.g b{display:block;font:13px ui-monospace,Menlo,monospace;color:#9C9CAE}.g span{font-size:30px;color:#C8C8D2}.g i{font-style:normal;font-size:13px;color:#9C9CAE;display:block}
@media (max-width:700px){body{padding:16px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>Bottoms: what happens around the lows, the 200-day as a fact, and the rising tide</h1>
<p class="q">Statistics lane · 28 Sep 2026 · daily bars to the 25 Sep close · research questions, not buy rules · every chart is a saved file in <code>charts/</code> next to this page</p>
<div class="status"><b>STATUS · done for SPY, QQQ and IWM, the 200-day test on 36 instruments, and the tide on all 486 served names.</b> Every swing uses the S9 pivot rule (a low lower than the 10 bars on each side). Every "how extreme" is an own-history percentile — today against every earlier day of the same series, never a trailing window. No fixed look-ahead windows: outcomes run to the next swing or to the close back above the 200-day. Up = green, down = red on every line.</div>

<h2>What we found, in plain words</h2>
<ol class="lead">${findings.map((f) => `<li>${f}</li>`).join("")}</ol>

<h2>1 · What happens around the lows — and does the VIX find the reversal?</h2>
<p>Every confirmed swing low of SPY (${P1.SPY.nLows} since ${P1.SPY.from}), QQQ (${P1.QQQ.nLows} since ${P1.QQQ.from}) and IWM (${P1.IWM.nLows} since ${P1.IWM.from}), all depths. For each one we recorded the conditions on the day of the low and, for each condition, when its OWN swing (same pivot rule) happened: before the price low, the same day, or after. The bars below show those shares.</p>
<h3>Who turned first</h3>
<div class="grid">${figs1}</div>
${figVixHist}
<h3>The conditions on the day of the low, by how deep the fall was</h3>
<p>Medians. "Own pct" = where that day sat in the series' whole earlier history (100 = the most extreme ever up to then). Depth groups are the S9 groups.</p>
${condAtLows("SPY")}${condAtLows("QQQ")}${condAtLows("IWM")}
<h3>The shape of a bottom: days −30 to +60 around SPY swing lows (and tops for contrast)</h3>
<div class="grid">${figsEv.join("")}</div>
<h3>Base rates — how often each condition fired WITHOUT a low following, and how often lows came without it</h3>
<p>For every threshold from the 1st to the 99th own percentile (no chosen cut-off — the whole curve): <b>thick line</b> = share of days at or beyond that level with a swing low on the day or within the next 10 bars (the pivot rule's own window); <b>thin line</b> = share of all swing lows where the condition was on at some point in the 10 bars up to the low. Dashed = the same two for lows that ended a fall of 10% or more. The triangle on the right edge marks the chance for any day. Where the thick line sits above the triangle the condition is better than chance; the gap between 100% and it is the false-alarm rate.</p>
<div class="grid">${figsBase}${figCombo}</div>
<p>The same curves read at a few points (episodes = runs of consecutive days the condition was on; a false alarm = an episode with no low on it or within 10 bars after it):</p>
${readTable("SPY")}
<details><summary>QQQ and IWM readouts</summary>${readTable("QQQ")}${readTable("IWM")}</details>

<h2>2 · "Deep below the 200-day is a problem" — tested as a fact</h2>
<p>Pool: SPY, QQQ, IWM, DIA · the 11 SPDR sector funds + SMH · the 20 largest US companies by market cap today (FMP, 28 Sep: ${J.caps.top20.join(", ")}). Daily split-adjusted bars from the chart API. For every day, the distance to the 200-day average is turned into that instrument's own-history percentile (1 = the deepest below it had ever been up to then). Outcomes need no fixed window: the move to the next confirmed swing high, the worst fall before it, and — for days below the 200-day — how much further price fell and how many sessions it took before a close back above the 200-day.</p>
<p><b>Bands</b>: 90% bootstrap, resampling whole stretches above/below the 200-day (the independent units), 150 draws. <b>Test</b>: within each instrument the percentile series is rotated by a random amount against its outcomes (keeps each series' clustering, breaks the link), 400 times; the table shows the observed rank link, the 95% range from the rotations, and how often a rotation matched it.</p>
<div class="grid">${figsP2.join("")}</div>
${permTable}
<p><b>Where it holds:</b> the further-fall and time-to-reclaim links are present in every group and far outside the rotation range. <b>Where it does not:</b> the fall before the next swing high and the sessions to it barely depend on the distance (ρ about ${n2(G2.pooled.fallBeforeHigh.rho)} and ${n2(G2.pooled.barsToHigh.rho)}) — being deep below the 200-day does not make the next rally slower to arrive. Part of the further-fall link is arithmetic: the deeper a close is, the further price must travel to get back above the average, which leaves more time to fall.</p>
<details><summary>Per instrument (history, stretches below the 200-day, deepest, today)</summary><div class="scroll"><table><tr><th>symbol</th><th>group</th><th>from</th><th>days</th><th>days below 200-day</th><th>deepest below</th><th>today vs 200-day</th><th>today own pct</th></tr>${perRows}</table></div></details>

<h2>3 · Rising tide lifts all boats</h2>
<p>Universe: the ${P3.universe.served} names the chart API serves today (${P3.universe.namesFirst} had history in 2003, ${P3.universe.namesLast} now; a date is used when at least ${P3.universe.minNames} names reported). Sector funds: the 11 SPDRs.</p>
${figSize}${figDist}${figDisp}
<h3>Over whole swings</h3>
<p>Up-swings (${P3.legs.up.n}): median ${n0(P3.legs.up.med)}% of names rose (middle half ${n0(P3.legs.up.q1)}–${n0(P3.legs.up.q3)}%, narrowest ${n0(P3.legs.up.min)}%); sectors ${n0(P3.legs.up.sectMed)}%. Down-swings (${P3.legs.down.n}): median ${n0(P3.legs.down.med)}% fell; sectors ${n0(P3.legs.down.sectMed)}%. Bigger swings carry more boats (rank link with swing size ${n2(P3.legs.up.rhoSize)} up, ${n2(P3.legs.down.rhoSize)} down). All 11 sectors moved with SPY on ${n0(P3.allSectorsWith.up)}% of up days and ${n0(P3.allSectorsWith.down)}% of down days.</p>
<h3>Levels to use as guides</h3>
${figLevels}
<div class="scroll">${levelTable("a50", "% names above 50-day")}${levelTable("a200", "% names above 200-day")}${levelTable("up", "% names up on the day")}${levelTable("dispPct", "dispersion percentile")}</div>
${figHist}
<h3>Five tide gauges we could put on the Hub (today's readings, 25 Sep close)</h3>
<div class="gauges">
<div class="g"><b>1 · TIDE TODAY</b><span>${n0(now.up)}%</span><i>of ${now.names} names rose (${ord(now.upPct)} own pct); SPY ${n2(now.spyMove)}%</i></div>
<div class="g"><b>2 · SECTOR AGREEMENT</b><span>${now.sectorsUp}/${now.sectorsN}</span><i>SPDR sectors up with SPY</i></div>
<div class="g"><b>3 · PARTICIPATION SINCE THE LAST SWING LOW</b><span>${n0(now.sinceLowShare)}%</span><i>of names above their close of ${now.lastSwingLow} (SPY's last swing low); a normal up-swing carries ${n0(P3.legs.up.med)}%</i></div>
<div class="g"><b>4 · % ABOVE 50-DAY</b><span>${n0(now.a50)}%</span><i>${ord(now.a50pct)} own pct · half of all SPY swing lows sat below ${n0(L.lows.pct[3][1])}%, half of tops above ${n0(L.highs.pct[3][1])}%</i></div>
<div class="g"><b>5 · DISPERSION</b><span>${ord(now.dispPct)}</span><i>own pct · lows median ${ord(D3.lows[30].med)}, 10%+ lows ${ord(D3.deep[30].med)}, tops ${ord(D3.tops[30].med)}</i></div>
<div class="g"><b>+ EQUAL vs CAP WEIGHT</b><span>${n1(now.eqwVsCapSinceLow)}</span><i>points RSP vs SPY since ${now.lastSwingLow}</i></div>
</div>

<h2>Where each number comes from</h2>
<ul>
<li>Prices, VIX and the Cboe put/call ratios (PCC total, PCCE equity, PCCI index; PCSPX only from 2019, not used): the chart API <code>https://scintilla-massive-chart-api.fly.dev/candles?tf=D</code>, finished daily bars, split-adjusted as served. Copies made by earlier lanes were reused; the 122 served names and the put/call series they lacked were fetched once on 28 Sep and cached.</li>
<li>VIX3M, and HYG and LQD dividend-adjusted: FMP, pulled on Fly by the regime lane on 28 Sep (the key never left Fly). Credit line = HYG ÷ LQD.</li>
<li>Market caps for the top-20 list: FMP batch market cap, 28 Sep, through this session's connector.</li>
<li>Code: <code>research/statistics/bottoms/</code> (bottoms-lib.mjs = the arithmetic, bottoms.mjs = the run, bottoms-page.mjs = this page and its charts). Pivots, swings, RSI, cloud lines and bad-wick clamps are reused from S9 (<code>s9-research.mjs</code>). Data: <a href="data/bottoms.json">data/bottoms.json</a>.</li>
</ul>
<details><summary>Sources used (first and last bar)</summary><div class="scroll"><table><tr><th>series</th><th>from</th><th>first</th><th>last</th><th>bars</th></tr>${srcRows}</table></div></details>

<h2>What could be wrong</h2>
<ul>
<li><b>Survivorship.</b> The tide and breadth use TODAY's 486 names back-filled to 2003. Names that failed or left are missing, so past breadth reads a little healthier than it was, and the early years carry about ${P3.universe.namesFirst} names, not 486.</li>
<li><b>QQQ starts in ${P1.QQQ.from.slice(0, 4)}.</b> The cached QQQ history has a gap of more than a year; the S9 rule analyses only what follows it, so QQQ misses 2003–2010 (and 2008).</li>
<li><b>Short histories for the other gauges.</b> Put/call from Nov 2006, VIX3M from Jul 2006, HYG from Apr 2007: lows before those dates count as "no reading", which lowers their "lows caught" share a little.</li>
<li><b>Swings are known 10 bars late.</b> A low is only confirmed 10 sessions after it; the base rates measure what was TRUE, not what was visible on the day.</li>
<li><b>Few deep lows.</b> ${P1.SPY.nDeep} SPY lows ended a fall of 10% or more; percentages on those carry wide error.</li>
<li><b>Put/call is one printed number a day</b> and noisy; its "turn" uses the same pivot rule on that single number.</li>
<li><b>Overlap in the 200-day pool.</b> SPY, DIA, the sectors and the megacaps move together; the pooled bands resample stretches within each instrument, not across them, so the pooled band is somewhat too narrow. The per-group rows are the safer read.</li>
</ul>
<h2>What was not done</h2>
<ul>
<li>No Hub page wiring, no deploy, no database write. The gauges above are proposals with today's readings, not live widgets.</li>
<li>No longer history from ^GSPC (1927+) for the swing-low study — the served SPY from 2003 was used, as S9 did.</li>
<li>The breadth branch (<code>candidate/breadth-20260927</code>) carries an ingest job but no history yet, so breadth here is computed from the cached bars of the served names.</li>
<li>No intraday data; every reading is a daily close.</li>
</ul>
</body></html>`;
const snippet = fs.readFileSync(path.join(ROOT, "scripts/scnav-snippet.html"), "utf8").trim();
const withNav = html.replace("<h1>", "<span data-scnav-slot></span><h1>").replace("</body>", snippet + "\n</body>");
fs.writeFileSync(path.join(DIR, "BOTTOMS.html"), withNav);
console.log("wrote BOTTOMS.html +", saved.length, "charts");
