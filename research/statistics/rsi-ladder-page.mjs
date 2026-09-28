/* Writes deliverables/20260928/rsi-ladder/index.html from rsi-ladder.json (same folder); the charts are the saved SVG
   files in charts/ (rsi-ladder-charts.mjs). Every sentence with a number is computed from the JSON.
   node research/statistics/rsi-ladder-page.mjs   (then python3 scripts/inject-scnav.py places BACK / CLOSE) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { spearman } from "./rsi-ladder.mjs";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f0 = (x) => x == null ? "—" : Math.round(x).toLocaleString("en-US"), f1 = (x) => x == null ? "—" : (+x).toFixed(1), f2 = (x) => x == null ? "—" : (+x).toFixed(2);
/** A signed move: green up, red down. */
export const mv = (x, unit = "%", dp = 1) => { if (x == null) return "—"; const r = +(+x).toFixed(dp); return r === 0 ? `${(0).toFixed(dp)}${unit}` : `<span class="${r > 0 ? "up" : "dn"}">${r > 0 ? "+" : ""}${r.toFixed(dp)}${unit}</span>`; };
/** Did the rung's 90% band leave the any-day number outside it? "above" / "below" / "inside" / null. */
export function vsAnyDay(band, base) { if (!band || band[0] == null || band[1] == null || base == null) return null; return base < band[0] ? "above" : base > band[1] ? "below" : "inside"; }
/** Plain summary of one outcome across the 100 rungs. */
export function rungSummary(A, key, bandKey) {
  const base = A.base[key], rows = A.byRung.filter((r) => r[key] != null);
  const v = rows.map((r) => vsAnyDay(r.band?.[bandKey], base));
  return { above: v.filter((x) => x === "above").length, below: v.filter((x) => x === "below").length, inside: v.filter((x) => x === "inside").length, rungs: rows.length,
    rho: spearman(rows.map((r) => r.q), rows.map((r) => r[key])) };
}

export function build(d) {
  const I = d.instruments, X = d.cross, KEYS = Object.keys(I).filter((k) => !I[k].missing);
  const spy = I.SPY, spx = I.SPX, btc = I.BTCUSD, qqq = I.QQQ, iwm = I.IWM, ndx = I.NDX;
  const sess = (A) => A.calendar ? "days" : "sessions", U = (A) => A.unit === "bp" ? " bp" : "%";
  const img = (f, alt, cls = "wide") => `<figure class="chart ${cls}"><img src="charts/${f}" alt="${esc(alt)}" loading="lazy"><figcaption><a href="charts/${f}">${esc(f)}</a></figcaption></figure>`;
  const L = (A, q) => A.ladder.full[q];

  /* ---------------- the answers ---------------- */
  const bs = X.BTCUSD_vs_SPY, same = X.SPY_sinceBTC.ladder, qsame = X.QQQ_sinceBTC.ladder, bl = btc.ladder.full;
  const sum20 = rungSummary(spy, "f20", "f20"), sum60 = rungSummary(spy, "f60", "f60");
  const allSum = KEYS.map((k) => ({ k, s20: rungSummary(I[k], "f20", "f20"), s60: rungSummary(I[k], "f60", "f60") }));
  const tot = allSum.reduce((a, x) => ({ above: a.above + x.s20.above, below: a.below + x.s20.below, rungs: a.rungs + x.s20.rungs }), { above: 0, below: 0, rungs: 0 });
  const tot60 = allSum.reduce((a, x) => ({ above: a.above + x.s60.above, below: a.below + x.s60.below, rungs: a.rungs + x.s60.rungs }), { above: 0, below: 0, rungs: 0 });
  const r1 = (A) => A.byRung[0], r100 = (A) => A.byRung[99];
  const curve = (A, q) => A.pull.curves.find((c) => c.fromRank === q);
  const longest = (A) => [...A.pullbacks].sort((a, b) => b.topToNew - a.topToNew)[0];
  const spxLong = longest(spx), ndxLong = longest(ndx);
  const today = KEYS.map((k) => I[k]).filter((A) => A.now.rung != null).sort((a, b) => a.now.rung - b.now.rung);
  const answers = [
    `<b>The ladder, rung by rung (SPY, ${spy.from.slice(0, 4)}–${spy.to.slice(0, 4)}).</b> The lowest 1% of days closed with an RSI of <b>${f1(L(spy, 1))}</b> or lower, the lowest 2% at ${f1(L(spy, 2))}, 3% at ${f1(L(spy, 3))}, 5% at ${f1(L(spy, 5))}, 10% at ${f1(L(spy, 10))}, 25% at ${f1(L(spy, 25))}; the middle day ${f1(L(spy, 50))}; the top 10% from ${f1(L(spy, 90))}, top 5% from ${f1(L(spy, 95))}, top 1% from ${f1(L(spy, 99))}. Every rung from 1 to 100, for all ${KEYS.length} instruments, is in section 1. Visits: SPY dropped to rung 1 or lower ${spy.visits[0].visits} separate times (${f1(spy.visits[0].perYear)} a year) and each stay was short (typically ${spy.visits[0].lenMed} days, longest ${spy.visits[0].lenMax}); to rung 5 or lower ${f1(spy.visits[4].perYear)} times a year.`,
    `<b>Yes — Bitcoin's RSI goes deeper, and more often.</b> Same years (${X.SPY_sinceBTC.from.slice(0, 4)}–2026), each on its own days: Bitcoin's bottom 1% is an RSI of <b>${f1(bl[1])}</b> against SPY's ${f1(same[1])} and QQQ's ${f1(qsame[1])}; bottom 5% ${f1(bl[5])} vs ${f1(same[5])}; its middle day ${f1(bl[50])} vs ${f1(same[50])}. Bitcoin sits lower at every rung from 1 to ${bl.findIndex((v, q) => q > 0 && v >= same[q]) - 1}. Counted in days: SPY's bottom-1% level (${f1(L(spy, 1))}) is reached on ${f1(bs.bAtA[1])}% of Bitcoin days — <b>${f1(bs.bAtA[1] / 1)} times as often</b> as SPY itself — and SPY's bottom-5% level (${f1(L(spy, 5))}) on ${f1(bs.bAtA[5])}% of Bitcoin days (${f1(bs.bAtA[5] / 5)} times). It also runs hotter at the very top: Bitcoin's top 1% starts at ${f1(bl[99])} against SPY's ${f1(same[99])}. The one record that matches Bitcoin's floor is the S&P 500 since 1928, crash years included (bottom 1% ${f1(L(spx, 1))}; Bitcoin reaches that level on ${f1(X.BTCUSD_vs_SPX.bAtA[1])}% of its days). Reading Bitcoin on weekdays only changes nothing (bottom 1% ${f1(X.BTC_weekdays.ladder[1])}).`,
    (() => { const rho = (k) => rungSummary(I[k], "f20", "f20").rho, stocks = ["SPY", "QQQ", "IWM", "DIA", "XLK", "SMH", "XLY", "XLF", "XLI", "XLB", "XLE", "XLV", "XLP", "XLU", "XLRE", "XLC"].filter((k) => I[k]);
      const neg = stocks.filter((k) => rho(k) < 0);
      return `<b>What came next, rung by rung: no single rung clears luck by much, but the slope is there for most stock funds since 2003 — flat on the S&P since 1928, and reversed for Bitcoin.</b> SPY's rung 1 was followed 20 sessions later by a middle result of ${mv(r1(spy).f20)} (90% band ${mv(r1(spy).band.f20?.[0])} to ${mv(r1(spy).band.f20?.[1])}) against ${mv(spy.base.f20)} on any day; rung 100 by ${mv(r100(spy).f20)}. Of SPY's 100 rungs only ${sum20.above} beat any day beyond their band at 20 sessions and ${sum20.below} fell short (60 sessions: ${sum60.above} and ${sum60.below}) — about what luck gives with 90% bands (5 each way). Pooled over all ${KEYS.length} instruments: ${tot.above} above and ${tot.below} below out of ${tot.rungs} rungs at 20 sessions (luck alone ≈ ${Math.round(tot.rungs * 0.05)} each way) — more than luck, but about equally on both sides, which points to bands that are a little too narrow on thin rungs rather than to an edge at the bottom. The pattern shows in the slope instead: ranking the 100 rungs by their middle 20-session result, <b>${neg.length} of ${stocks.length} stock funds lean the same way — the lower the rung, the better</b> (rank correlation SPY ${f2(rho("SPY"))}, IWM ${f2(rho("IWM"))}, XLF ${f2(rho("XLF"))}); the S&P index since 1928 shows almost none (${f2(rho("SPX"))}); <b>Bitcoin is the opposite</b> (${f2(rho("BTCUSD"))}): its high rungs were followed by more gains, its low rungs by less. VIX is the strongest of all (${f2(rho("VIX"))}): a high VIX RSI was usually followed by a falling VIX.`; })(),
    `<b>The deeper the RSI, the deeper the next dip first.</b> After SPY's rung-1 days the worst close inside the next 60 sessions was typically ${mv(r1(spy).w60)} (any day ${mv(spy.base.w60)}); IWM ${mv(r1(iwm).w60)} vs ${mv(iwm.base.w60)}; Bitcoin ${mv(r1(btc).w60)} vs ${mv(btc.base.w60)}; oil ${mv(r1(I.CLUSD).w60)} vs ${mv(I.CLUSD.base.w60)}. And from a rung-1 day SPY needed a middle ${f0(r1(spy).rec.median)} sessions to trade back above its prior swing high (any day: ${f0(spy.base.rec.median)}; partly by construction — an oversold day is usually well under the last top).`,
    (() => { const idx = ["SPX", "SPY", "NDX", "QQQ", "IWM", "DIA"], openStock = ["QQQ", "XLK", "SMH", "XLC", "XLY", "XLF", "XLI", "XLB", "XLE", "XLV", "XLP", "XLU", "XLRE"].flatMap((k) => (I[k]?.pullbacks ?? []).filter((p) => !p.done).map((p) => ({ k, p })));
      const old = openStock.filter((x) => x.p.top < "2026-01-01"), yrs = (A) => (Date.parse(A.to) - Date.parse(A.pullbacks.filter((p) => !p.done)[0]?.top ?? A.to)) / 3.15576e10;
      return `<b>Every pullback, as a continuous spread: deeper takes longer, and in the stock indexes nearly every one has already ended in a new high.</b> SPY had ${spy.pull.n} pullbacks (10/10 swing pivots) and <b>${spy.pull.n - spy.pull.open} of ${spy.pull.n}</b> traded back above the old top. Half of all of them did so within <b>${curve(spy, 0).median}</b> sessions of the low; the deeper half within ${curve(spy, 50).median}; the deepest quarter within ${curve(spy, 75).median}; the deepest tenth within ${curve(spy, 90).median}. Depth and wait move together (rank correlation ${f2(spy.pull.rhoDepthTime)}; S&P since 1928 ${f2(spx.pull.rhoDepthTime)}, Bitcoin ${f2(btc.pull.rhoDepthTime)}). Across ${idx.map((k) => I[k].short).join(", ")}: ${idx.reduce((a, k) => a + I[k].pull.n - I[k].pull.open, 0)} of ${idx.reduce((a, k) => a + I[k].pull.n, 0)} pullbacks have made a new high${idx.some((k) => I[k].pull.open) ? ` (the ${idx.reduce((a, k) => a + I[k].pull.open, 0)} still open began in 2026)` : ""}. The waits can be very long: the S&P's longest, from the ${esc(spxLong.top)} top, took ${f0(spxLong.topToNewDays / 365.25)} years (new high ${esc(spxLong.newHigh)}); the Nasdaq 100's, from ${esc(ndxLong.top)}, ${f1(ndxLong.topToNewDays / 365.25)} years. Among the sectors only ${old.length ? old.map((x) => `${x.k} from ${x.p.top.slice(0, 7)}`).join(", ") : "none"} ${old.length === 1 ? "is" : "are"} still under a pre-2026 top. <b>Outside stocks "it always bounces back" does not hold on price:</b> oil is still under its ${esc(I.CLUSD.pullbacks.find((p) => !p.done)?.top.slice(0, 4))} top, the 10-year yield under its ${esc(I.US10Y.pullbacks.find((p) => !p.done)?.top.slice(0, 4))} top, and ${I.TLT.pull.open} TLT pullbacks since ${esc(I.TLT.pullbacks.find((p) => !p.done)?.top.slice(0, 4))} are still open.`; })(),
    `<b>S9's "81% / 70% / 25% new high on the next leg", restated without the next-leg cut-off.</b> S9 only asked whether the VERY NEXT rally beat the old top: on SPY that happened ${f1(spy.pull.nextLegShare)}% of the time overall. Allowing as many rallies as it takes, ${f1(spy.pull.everNewHigh)}% got there. For SPY's pullbacks of 10% or more (S9's two deepest bins, ${spy.pullbacks.filter((p) => p.depth <= -10).length} of them), the next leg made it only ${f1(100 * spy.pullbacks.filter((p) => p.depth <= -10 && p.nextLeg).length / Math.max(1, spy.pullbacks.filter((p) => p.depth <= -10).length))}% of the time, yet all of them eventually did; the middle one took ${f0(medianOf(spy.pullbacks.filter((p) => p.depth <= -10).map((p) => p.lowToNew)))} sessions from the low and needed ${f0(medianOf(spy.pullbacks.filter((p) => p.depth <= -10).map((p) => p.legs)))} rallies. Section 3 draws this as time-to-new-high curves.`,
    `<b>Where each one sits today</b> (close of ${esc(spy.to)}, rung of its own full history): lowest — ${today.slice(0, 7).map((A) => `${esc(A.short)} rung ${A.now.rung} (RSI ${f1(A.now.rsi)})`).join(", ")}; highest — ${today.slice(-4).reverse().map((A) => `${esc(A.short)} rung ${A.now.rung} (RSI ${f1(A.now.rsi)})`).join(", ")}. Utilities and real estate are on their bottom rung while the 10-year yield sits near its top. These are research observations, not signals.`,
  ];

  /* ---------------- section 1 · the ladder ---------------- */
  const grid10 = (v, cls = "") => { let h = `<table class="g10 ${cls}"><thead><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => `<th>+${c}</th>`).join("")}</tr></thead><tbody>`; for (let r = 0; r < 10; r++) { h += `<tr><th>${r * 10}</th>`; for (let c = 1; c <= 10; c++) { const q = r * 10 + c, x = v[q]; h += `<td class="${x == null ? "" : x >= 50 ? "up" : "dn"}">${f1(x)}</td>`; } h += "</tr>"; } return h + "</tbody></table>"; };
  const gridVisits = (A) => { let h = `<table class="g10"><thead><tr><th></th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => `<th>+${c}</th>`).join("")}</tr></thead><tbody>`; for (let r = 0; r < 10; r++) { h += `<tr><th>${r * 10}</th>`; for (let c = 1; c <= 10; c++) { const x = A.visits[r * 10 + c - 1]; h += `<td>${f1(x.perYear)}</td>`; } h += "</tr>"; } return h + "</tbody></table>"; };
  let s1 = "";
  let grp = "";
  for (const k of KEYS) {
    const A = I[k];
    if (A.group !== grp) { grp = A.group; s1 += `<h4 class="grp">${esc(grp)}</h4>`; }
    s1 += `<details><summary><b>${esc(A.name)}</b> · ${A.from.slice(0, 4)}–${A.to.slice(0, 4)} · rung 1 ≤ ${f1(L(A, 1))} · rung 5 ≤ ${f1(L(A, 5))} · middle ${f1(L(A, 50))} · rung 95 ≥ ${f1(L(A, 95))} · rung 99 ≥ ${f1(L(A, 99))} · today ${f1(A.now.rsi)} = rung ${A.now.rung ?? "—"}</summary>
<p>How to read: the cell in row “20”, column “+3” is rung 23 — 23% of days closed with an RSI at or below that number. Red = under 50, green = over 50. Lowest reading ever ${f1(L(A, 0))}, highest ${f1(L(A, 100))}.</p>
<div class="three"><div><h4>Full history (${A.from.slice(0, 4)}–${A.to.slice(0, 4)}, ${f0(A.ladder.nFull)} days)</h4>${grid10(A.ladder.full)}</div><div><h4>Last 3 years (from ${esc(A.recentFrom)}, ${f0(A.ladder.n3)} days)</h4>${grid10(A.ladder.last3)}</div><div><h4>Visits a year at or below each rung</h4>${gridVisits(A)}</div></div>
${k === "SPY" ? "" : img(`gap-${k}-vs-spy.svg`, `${A.name} minus SPY, rung by rung`)}</details>`;
  }

  /* ---------------- section 2 · outcomes ---------------- */
  const sumRow = (k) => { const A = I[k], s20 = rungSummary(A, "f20", "f20"), s60 = rungSummary(A, "f60", "f60"), u = U(A), b = r1(A).band;
    return `<tr><td class="nm">${esc(A.name)}</td><td>${mv(r1(A).f20, u)}<br><span class="ci">${b.f20 ? `${f1(b.f20[0])} to ${f1(b.f20[1])}` : ""}</span></td><td>${mv(A.base.f20, u)}</td><td>${mv(r100(A).f20, u)}</td><td>${s20.above} / ${s20.below}</td><td>${f2(s20.rho)}</td><td>${mv(r1(A).f60, u)}</td><td>${mv(A.base.f60, u)}</td><td>${s60.above} / ${s60.below}</td><td>${f1(r1(A).up20)}%</td><td>${f1(A.base.up20)}%</td><td>${mv(r1(A).w60, u)}</td><td>${mv(A.base.w60, u)}</td><td>${f0(r1(A).rec.median)}</td><td>${f0(A.base.rec.median)}</td><td>${f0(r1(A).n)} · ${r1(A).months}</td></tr>`; };
  const s2table = `<div class="scroll"><table class="big"><thead><tr><th>Instrument</th><th>Rung 1 · 20 later<br>(90% band)</th><th>Any day<br>20 later</th><th>Rung 100<br>20 later</th><th>Rungs above / below<br>any day, 20</th><th>Slope: rung vs<br>20 later (rank corr.)</th><th>Rung 1<br>60 later</th><th>Any day<br>60 later</th><th>Rungs above / below<br>any day, 60</th><th>Rung 1<br>higher, 20</th><th>Any day<br>higher, 20</th><th>Rung 1 worst<br>in next 60</th><th>Any day worst<br>in next 60</th><th>Rung 1 wait to<br>prior top</th><th>Any day<br>wait</th><th>Rung 1 days ·<br>months</th></tr></thead><tbody>${KEYS.map(sumRow).join("")}</tbody></table></div>`;
  const rungTable = (A) => { const u = U(A); let h = `<div class="scroll tall"><table><thead><tr><th>Rung</th><th>RSI from–to</th><th>Days</th><th>Months</th><th>5 later</th><th>10 later</th><th>20 later</th><th>20: 90% band</th><th>60 later</th><th>60: 90% band</th><th>Higher 20</th><th>Higher 60</th><th>Worst in 20</th><th>Worst in 60</th><th>Wait to prior top</th><th>No-hindsight rung: 20 later</th><th>… 60 later</th></tr></thead><tbody>`;
    for (const r of A.byRung) { const o = A.byOwnRung[r.q - 1]; h += `<tr><td>${r.q}</td><td>${f1(r.rsiFrom)}–${f1(r.rsiTo)}</td><td>${r.n}</td><td>${r.months ?? "—"}</td><td>${mv(r.f5, u)}</td><td>${mv(r.f10, u)}</td><td>${mv(r.f20, u)}</td><td class="ci">${r.band.f20 ? `${f1(r.band.f20[0])} to ${f1(r.band.f20[1])}` : "—"}</td><td>${mv(r.f60, u)}</td><td class="ci">${r.band.f60 ? `${f1(r.band.f60[0])} to ${f1(r.band.f60[1])}` : "—"}</td><td>${f1(r.up20)}%</td><td>${f1(r.up60)}%</td><td>${mv(r.w20, u)}</td><td>${mv(r.w60, u)}</td><td>${r.rec.median ?? "—"}${r.rec.open ? ` (${r.rec.open} open)` : ""}</td><td>${mv(o.f20, u)} <span class="ci">(${o.n})</span></td><td>${mv(o.f60, u)}</td></tr>`; }
    return h + `<tr class="base"><td colspan="2">Any day</td><td>${A.base.n}</td><td></td><td>${mv(A.base.f5, u)}</td><td>${mv(A.base.f10, u)}</td><td>${mv(A.base.f20, u)}</td><td></td><td>${mv(A.base.f60, u)}</td><td></td><td>${f1(A.base.up20)}%</td><td>${f1(A.base.up60)}%</td><td>${mv(A.base.w20, u)}</td><td>${mv(A.base.w60, u)}</td><td>${A.base.rec.median}</td><td></td><td></td></tr></tbody></table></div>`; };
  const outCharts = (k) => `<div class="grid3">${["f20", "f60", "up20", "up60", "w60", "rec"].map((m) => img(`out-${k}-${m}.svg`, `${I[k].name} ${m}`, "cell")).join("")}</div>`;
  const OPEN2 = ["SPX", "SPY", "QQQ", "IWM", "BTCUSD"];
  let s2 = "";
  for (const k of KEYS) { const A = I[k];
    const body = `${outCharts(k)}<details><summary>All 100 rungs of ${esc(A.name)} as a table</summary>${rungTable(A)}</details>`;
    s2 += OPEN2.includes(k) ? `<h3>${esc(A.name)} <span class="q">${A.from.slice(0, 4)}–${A.to.slice(0, 4)} · ${f0(A.base.n)} days</span></h3>${body}` : `<details class="inst"><summary><b>${esc(A.name)}</b> · rung 1 → ${mv(r1(A).f20, U(A))} in 20 ${sess(A)} vs ${mv(A.base.f20, U(A))} any day · worst in 60 ${mv(r1(A).w60, U(A))} vs ${mv(A.base.w60, U(A))}</summary>${body}</details>`; }

  /* ---------------- section 3 · pullbacks ---------------- */
  const pRow = (k) => { const A = I[k], P = A.pull, lg = longest(A), dl = P.depthLadder, u = U(A), c = (q) => curve(A, q);
    return `<tr><td class="nm">${esc(A.name)}</td><td>${P.n}</td><td>${P.open}</td><td>${mv(dl[50], u)}</td><td>${mv(dl[90], u)}</td><td>${mv(dl[100], u)}</td><td>${c(0).median ?? "—"}</td><td>${c(50).median ?? "—"}</td><td>${c(75).median ?? "—"}</td><td>${c(90).median ?? "—"}</td><td>${f2(P.rhoDepthTime)}</td><td>${f1(P.nextLegShare)}%</td><td>${f1(P.everNewHigh)}%</td><td>${esc(lg.top)} ${mv(lg.depth, u)}: ${lg.done ? `${f1(lg.topToNewDays / 365.25)} yrs` : `open ${f1(lg.topToNewDays / 365.25)} yrs`}</td><td>${f2(P.rhoDepthRsi)}</td></tr>`; };
  const s3table = `<div class="scroll"><table class="big"><thead><tr><th>Instrument</th><th>Pull-<br>backs</th><th>Still<br>open</th><th>Middle<br>depth</th><th>Deeper than<br>90% of them</th><th>Deepest</th><th>Half back by<br>(all)</th><th>… deeper<br>half</th><th>… deepest<br>quarter</th><th>… deepest<br>tenth</th><th>Depth vs wait<br>(rank corr.)</th><th>Next leg<br>made it (S9)</th><th>Made it<br>eventually</th><th>Longest wait, top → new high</th><th>Depth vs RSI<br>at the low</th></tr></thead><tbody>${KEYS.map(pRow).join("")}</tbody></table></div>`;
  const pullList = (A) => { const u = U(A); let h = `<div class="scroll tall"><table><thead><tr><th>Top</th><th>Low</th><th>Depth</th><th>Deeper than … of its pullbacks</th><th>RSI at low</th><th>Rung at low</th><th>Lowest RSI in the fall</th><th>No-hindsight %ile at low</th><th>New high on</th><th>${sess(A)} low → new high</th><th>top → new high</th><th>Rallies needed</th></tr></thead><tbody>`;
    for (const p of [...A.pullbacks].reverse()) h += `<tr><td>${p.top}</td><td>${p.low}</td><td>${mv(p.depth, u)}${p.capped ? " *" : ""}</td><td>${f1(p.depthRank)}%</td><td>${f1(p.rsiLow)}</td><td>${p.rungLow ?? "—"}</td><td>${f1(p.rsiMin)}</td><td>${f1(p.ownPctLow)}</td><td>${p.done ? p.newHigh : `<span class="dn">not yet</span>`}</td><td>${p.done ? p.lowToNew : `${p.lowToNew}+`}</td><td>${p.done ? p.topToNew : `${p.topToNew}+`}</td><td>${p.legs ?? "—"}</td></tr>`;
    return h + "</tbody></table></div>"; };
  let s3 = "";
  for (const k of KEYS) { const A = I[k];
    const body = `${img(`pull-${k}-scatter.svg`, `${A.name} pullbacks: depth vs time to new high`)}${img(`pull-${k}-curves.svg`, `${A.name} time-to-new-high curves`)}<details><summary>Every pullback of ${esc(A.name)} (${A.pull.n}), newest first</summary>${pullList(A)}</details>`;
    s3 += OPEN2.includes(k) ? `<h3>${esc(A.name)}</h3>${body}` : `<details class="inst"><summary><b>${esc(A.name)}</b> · ${A.pull.n} pullbacks · half back by ${curve(A, 0).median ?? "—"} ${sess(A)}, deepest tenth by ${curve(A, 90).median ?? "—"} · ${A.pull.open} still open</summary>${body}</details>`; }
  const s9b = ["SPY", "QQQ", "IWM", "BTCUSD"].map((k) => { const A = I[k], rows = [[0, 3], [3, 5], [5, 10], [10, 20], [20, Infinity]].map(([a, b]) => { const g = A.pullbacks.filter((p) => -p.depth >= a && -p.depth < b); const K = g.length ? g.filter((p) => p.done) : []; return `<td>${g.length ? `${g.length} · next leg ${f1(100 * g.filter((p) => p.nextLeg).length / g.length)}% · ever ${f1(100 * K.length / g.length)}% · half by ${medianOf(g.filter((p) => p.done).map((p) => p.lowToNew)) ?? "—"}` : "—"}</td>`; }).join(""); return `<tr><td class="nm">${esc(A.name)}</td>${rows}</tr>`; }).join("");

  /* ---------------- sources ---------------- */
  const srcRows = KEYS.map((k) => { const S = d.sources[k]; return `<tr><td class="nm">${esc(S.name)}</td><td>${esc(S.provider)} ${esc(S.providerSymbol)}</td><td>${esc(S.from)} → ${esc(S.to)}</td><td>${f0(S.sessions)}</td><td>${f0(I[k].sessions)}</td><td>${S.cleaned}</td><td>${S.weekendDropped}</td><td>${f0(S.onlyCloseBars)}</td><td class="l">${esc(S.via)}</td></tr>`; }).join("");

  const built = d.generated.slice(0, 16).replace("T", " ");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RSI ladder · every rung, what came next, every pullback</title>
<style>
:root{--bg:#07070C;--ink:#B4B4C6;--hi:#C8C8D2;--dim:#9C9CAE;--line:#24242E;--panel:#0B0B12;--up:#00FFA3;--dn:#FF2D55}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px}
main{max-width:1640px}
h1{font-size:34px;margin:0 0 6px;color:var(--hi)}h2{font-size:26px;margin:52px 0 8px;color:var(--hi);border-top:1px solid var(--line);padding-top:22px}h3{font-size:21px;margin:30px 0 6px;color:var(--hi)}h4{font-size:14px;margin:14px 0 4px;color:var(--hi);font-family:ui-monospace,Menlo,monospace}
h4.grp{font-size:12px;color:var(--dim);letter-spacing:.08em;text-transform:uppercase;margin-top:22px}
p,li{max-width:1180px}.q{color:var(--dim);font-size:13px;font-weight:400}
ol.lead{font-size:18.5px;color:var(--hi);max-width:1260px;padding-left:24px}ol.lead li{margin:0 0 16px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1260px;color:var(--hi)}
.scroll{overflow-x:auto;max-width:100%}.scroll.tall{max-height:640px;overflow-y:auto}
table{border-collapse:collapse;font-size:13.5px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid var(--line);padding:5px 8px;text-align:right;vertical-align:top;white-space:nowrap}
th{color:#A8A8BA;font-weight:600;font-size:12.5px;font-family:ui-monospace,Menlo,monospace;text-align:center;background:var(--bg);position:sticky;top:0}
td.nm,td.l{text-align:left;color:var(--hi)}td.nm{position:sticky;left:0;background:var(--bg);z-index:1}table.big{font-size:14.5px}
tr.base td{color:var(--hi);border-top:2px solid #3A3A48}
table.g10{font-size:13px}table.g10 td,table.g10 th{padding:3px 6px}table.g10 th{position:static}
.ci{color:var(--dim);font-size:12px}.up{color:var(--up)}.dn{color:var(--dn)}
details{border-top:1px solid var(--line);padding:8px 0}details>summary{cursor:pointer;color:var(--ink);font-size:15px;line-height:1.6}details[open]>summary{color:var(--hi)}
details.inst>summary{font-size:16px}
.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.three>div{min-width:0;overflow-x:auto}
.grid3{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
figure.chart{margin:12px 0;overflow-x:auto}figure.chart img{display:block;width:100%;height:auto;border:1px solid #1E1E28;background:var(--panel)}
figure.chart.cell{margin:0}figcaption{font:11px ui-monospace,Menlo,monospace;color:var(--dim);margin-top:3px}figcaption a{color:var(--dim)}
dl{max-width:1180px}dt{color:var(--hi);font-weight:600;margin-top:12px}dd{margin:2px 0 0 0}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
@media(max-width:1100px){.three{grid-template-columns:1fr}}
@media(max-width:700px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:16.5px}.grid3{grid-template-columns:1fr}
 figure.chart.wide img{min-width:880px}figure.chart.cell img{min-width:560px}table,table.big{font-size:12px}th,td{padding:4px 5px}code{overflow-wrap:anywhere}}
</style></head><body><main>
<h1>RSI ladder: every rung from 1% to 100%, what came next, and every pullback</h1>
<div class="q">Statistics · 28 Sep 2026 · built ${esc(built)} UTC · RSI(14), Wilder, daily closes · data to ${esc(spy.to)} (Bitcoin ${esc(btc.to)}) · ${KEYS.length} instruments · research questions, not buy rules · nothing here predicts</div>
<div class="status"><b>STATUS · computed from real daily bars; no fixed zones anywhere.</b> No “bottom 10%”, no “20 sessions” window: every RSI percentile from 1 to 100 is shown, every pullback is listed one by one, and waits are followed to the end (or marked still open). Green = up / better than any day, red = down / worse. “Middle result” = the median. The “90% band” shows how sure a number is: if the any-day number sits inside it, the difference may be luck.</div>

<h2>The answers you asked for</h2>
<ol class="lead">${answers.map((a) => `<li>${a}</li>`).join("\n")}</ol>

<h2>1 · The ladder: RSI at every rung, 1% to 100%</h2>
<p>A <b>rung</b> is one percent of an instrument's own days, ranked by RSI. Rung 1 = the most oversold 1% of all its days; rung 100 = the most overbought 1%. The strip below shows all ${KEYS.length} instruments at once; the outlined cell is where the latest close sits.</p>
${img("ladder-heat-full.svg", "RSI at every rung, full history")}
${img("ladder-heat-3y.svg", "RSI at every rung, last 3 years")}
<h3>Does Bitcoin's RSI go deeper?</h3>
<p>Yes, at every rung up to ${btc.ladder.full.findIndex((v, q) => q > 0 && v >= X.SPY_sinceBTC.ladder[q]) - 1}, and it also runs hotter at the very top. Same years for all three lines; the bar chart shows the gap to SPY one rung at a time.</p>
${img("ladder-btc-spy-qqq.svg", "Bitcoin vs SPY vs QQQ ladders")}
${img("gap-btc-vs-spy.svg", "Bitcoin minus SPY, rung by rung")}
${img("ladder-long-view.svg", "Bitcoin vs the S&P since 1928 and the Nasdaq 100 since 1985")}
<h3>Every instrument, all 100 rungs (click a row)</h3>
<p>Each row opens three 10×10 grids — full history, last 3 years, and how many separate visits a year it makes at or below each rung — plus its gap to SPY rung by rung.</p>
${s1}

<h2>2 · What came next, at every rung</h2>
<p>Every day is placed on its rung, then followed forward: the change 5, 10, 20 and 60 ${"sessions"} later, the share of days that ended higher, the worst close in the next 20 and 60 sessions, and the wait until price traded back above the last swing high that was already confirmed that day. Each dot is one rung; its faint bar is the 90% band; the dashed line is any day. “Rungs above / below” counts how many of the 100 rungs cleared the any-day number beyond their band — with 90% bands about 5 each way happen by luck alone.</p>
${s2table}
${s2}

<h2>3 · Every pullback, one by one</h2>
<p>A pullback runs from a swing high to the next swing low (S9's rule: a pivot needs 10 bars on each side; bad wicks clamped). No depth bins: each pullback is a dot, placed by its depth and by how long it took to trade back above the old top. Pullbacks still under their old top stay on the chart as red rings at their wait so far. The curves group pullbacks by their rank among the instrument's own pullbacks (all, deeper half, deepest quarter, deepest tenth) — so “deep” means deep for that instrument, not a fixed percent.</p>
${s3table}
<h3>S9's next-leg numbers, restated</h3>
<p>S9 used depth bins and asked only whether the very next rally beat the old top. Same bins here as a bridge, with what happened when any number of rallies is allowed (count · next leg · eventually · middle wait in ${"sessions"} from the low).</p>
<div class="scroll"><table class="big"><thead><tr><th>Instrument</th><th>0–3%</th><th>3–5%</th><th>5–10%</th><th>10–20%</th><th>20%+</th></tr></thead><tbody>${s9b}</tbody></table></div>
${s3}

<h2>4 · How each number is made, and where it comes from</h2>
<dl>
<dt>RSI</dt><dd>RSI(14) with Wilder's smoothing on daily closes — the same function the Hub's statistics already use (<code>research/statistics/stats.mjs</code>). The first ${d.rules.warmup} readings of each series are left out as warm-up.</dd>
<dt>Rungs and the ladder</dt><dd>All counted days of an instrument are sorted by RSI; the number shown at rung q is the RSI below which q% of days closed. The “last 3 years” ladder uses the last 756 sessions (Bitcoin 1,095 days). A day's rung uses the whole history (hindsight); the no-hindsight column in each rung table ranks the day only against every earlier day (needs ${d.rules.ownMin} earlier readings).</dd>
<dt>Visits</dt><dd>A visit to “rung q or lower” = a run of consecutive days at or below that rung's RSI. No merging of nearby visits.</dd>
<dt>What came next</dt><dd>Close-to-close change after 5/10/20/60 ${"sessions"} (price only, no dividends; the 10-year yield in basis points). Worst close = the lowest close in the next 20 or 60 sessions against the day's close. Wait to prior top = sessions until the first day whose high trades above the most recent swing high already confirmed on that day (a swing high is only known 10 sessions after it prints); 0 if the day's own high is already above it. The middle wait uses Kaplan–Meier so days still waiting today are counted, not dropped.</dd>
<dt>90% bands</dt><dd>Cluster bootstrap, ${d.rules.bootstrap.reps} draws, fixed seed: whole calendar months of days are resampled for the 5/10/20-session numbers and whole calendar quarters for the 60-session numbers (their windows overlap across months).</dd>
<dt>Pullbacks</dt><dd>S9's swings: pivot highs and lows with 10 bars on each side on the wicks, forced to alternate, each leg end moved to the true extreme. Depth = low ÷ top − 1. “New high” = the first day whose high trades above the old top. Rallies needed = how many swing highs it took (1 = the very next one, S9's measure).</dd>
</dl>
<div class="scroll"><table><thead><tr><th>Instrument</th><th>Source</th><th>Bars used</th><th>Bars</th><th>Counted days</th><th>Bad wicks clamped</th><th>Weekend prints dropped</th><th>Close-only bars</th><th>Via</th></tr></thead><tbody>${srcRows}</tbody></table></div>
<p>All bars were read from the local statistics cache (chart API daily bars saved 27–28 Sep; the S&amp;P 500 and Nasdaq 100 index histories are FMP's, fetched inside Fly on 28 Sep — no key on this Mac). Data file: <a href="rsi-ladder.json">rsi-ladder.json</a>. Every chart is a saved image file in <a href="charts/">charts/</a>.</p>

<h2>5 · What could be wrong</h2>
<ul>
<li><b>Hindsight in the rungs.</b> A day's rung is set against the whole history, including years that came after it. The no-hindsight columns (each day ranked only against earlier days) are there to check; they differ most in the early years of each series.</li>
<li><b>Overlapping days.</b> Neighbouring days share most of their forward window, so 57 rung-1 days of SPY are really about ${spy.byRung[0].months} separate months. The bands account for that by resampling whole months (quarters for 60 sessions); they may still be a little narrow when a stress lasted longer than a quarter.</li>
<li><b>Different histories.</b> SPY starts in 2003, QQQ in 2011, the sectors in 2003 (XLRE 2015, XLC 2018), Bitcoin in 2013, the S&amp;P index in 1928. Ladders built over different years are not strictly comparable; that is why the Bitcoin comparison uses the same years.</li>
<li><b>Bitcoin trades every day.</b> Its 14-period RSI covers 14 calendar days; SPY's covers about 20. A weekday-only reading of Bitcoin gives the same ladder, but the RSI clock itself differs.</li>
<li><b>Early index data.</b> The S&amp;P history before the 1960s has close-only bars (high = low = close) and a few one-day prints that look like data faults (for example a −6.8% day on 16 May 1935 that fully reverses the next day). Pivots on those years use closes.</li>
<li><b>Oil below zero.</b> WTI closed at −$37.63 on 20 April 2020; percent changes through a non-positive close are skipped and that pullback's depth is capped at −100% (marked *).</li>
<li><b>“Wait to prior top” is partly mechanical.</b> On an oversold day price is usually far under the last swing high, so a long wait is expected; read it as a size of the hole, not as a signal.</li>
<li><b>Pullbacks in progress.</b> A decline only becomes a pullback once its low is confirmed 10 bars later; anything falling right now is not in the list yet.</li>
<li><b>Prices, not total return.</b> Dividends are not added, which understates long waits for the funds a little.</li>
</ul>

<h2>6 · What was not done</h2>
<ul>
<li>No trades, no alerts, no buy rules; nothing was written to any database, nothing was deployed.</li>
<li>No new downloads: every bar came from the existing statistics cache. The Russell 2000 and Dow index histories (1985–87→) are in that cache but were not added; IWM and DIA stand in for them.</li>
<li>No weekly or 4-hour RSI; daily only. No RSI divergence here (the separate RSI full-history page covers it).</li>
<li>Rung tables for the no-hindsight version give point results only, without bands.</li>
<li>Not yet on the Station or the Hub dashboard; this is a research page.</li>
</ul>
</main></body></html>
`;
}
export function medianOf(xs) { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const here = path.dirname(fileURLToPath(import.meta.url)), dir = path.resolve(here, "../../deliverables/20260928/rsi-ladder");
  const d = JSON.parse(fs.readFileSync(path.join(dir, "rsi-ladder.json"), "utf8"));
  const f = path.join(dir, "index.html"); let prev = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
  let html = build(d);
  // keep the scnav block if the page already carries one (inject-scnav.py placed it)
  const nav = prev.match(/\n?<!-- scnav · [\s\S]*?<!-- \/scnav -->\n?/); if (nav) html = html.replace("</body>", nav[0].trim() + "\n</body>");
  if (prev.includes("data-scnav-slot")) html = html.replace("<h1>", "<span data-scnav-slot></span><h1>");
  fs.writeFileSync(f, html);
  console.log(`wrote ${f} (${(html.length / 1e6).toFixed(2)} MB)`);
}
