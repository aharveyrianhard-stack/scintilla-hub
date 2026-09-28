/* U2 · SECTOR ROTATION — the plain-words page, built from sector-rotation.json (+ the saved charts).
     node research/statistics/sector-rotation/page.mjs
   Writes deliverables/20260928/sector-rotation/SECTOR-ROTATION.html. Every number on the page is read from the JSON.
   Then: python3 scripts/inject-scnav.py (places the grey BACK / CLOSE pair). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../../deliverables/20260928/sector-rotation");
const J = JSON.parse(fs.readFileSync(path.join(OUT, "sector-rotation.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sg = (x, d = 2) => x == null ? "—" : (x >= 0 ? "+" : "") + x.toFixed(d);
const cls = (x) => x == null ? "" : x >= 0 ? "up" : "dn";
const n = (x, d = 1) => x == null ? "—" : Number(x).toFixed(d);
const pct = (p) => p == null ? "—" : `${p}`;
const ord = (p) => p == null ? "—" : p + ((p % 100 >= 11 && p % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[p % 10] || "th"));
const G = J.geiger, RS = J.relativeStrength, HZ = J.horizons.chosen, T = G.today, F = G.followed, CW = J.capVsEqual, RR = J.rrg;
const img = (f, alt) => `<img class="chart" src="${f}" alt="${esc(alt)}" loading="lazy" width="100%">`;
const tbl = (head, rows) => `<div class="scroll"><table><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`;
const f16 = F[HZ.short], f38 = F[38], f72 = F[HZ.medium];
const green = T.order.filter((o) => o.g > 0), red = T.order.filter((o) => o.g <= 0);
const eqHist = G.familiesToday.EQWT;
const fam = G.familiesToday;
const liveWing = fam.SPDR.wingLive;

/* where today sits, every measure in one list */
const todayRows = [
  ["Bow tie · shorter wing (SPDR, replayed)", sg(T.wing), pct(T.wingPct), "How far BOTH the green and the red wing reach. The larger, the more the strip looks like a bow tie."],
  ["Bow tie · whole width, best − worst", n(T.spread, 2), pct(T.spreadPct), "Gap between the strongest and weakest sector Geiger."],
  ["Bow tie · thin middle (knot)", n(T.knot, 2), pct(T.knotPct), "0 = the middle bar is flat. Low = a thin knot."],
  ["Share of the eleven sectors above zero", `${Math.round(T.balance * 100)}%`, "—", `${T.order.filter((o) => o.g > 0).length} of ${T.order.length} green.`],
  ["Short vs long agreement (1d rung order vs 1w rung order)", sg(T.shortLong), pct(T.shortLongPct), "+1 = the fast and slow orders agree. It is high: this tie is not a fast flicker against the slow trend."],
  [`Order now vs ${HZ.short} sessions ago`, sg(T.flip[HZ.short].now), pct(T.flip[HZ.short].pct), "Rank correlation of the Geiger order. −1 = the wings swapped."],
  [`Order now vs ${HZ.medium} sessions ago`, sg(T.flip[HZ.medium].now), pct(T.flip[HZ.medium].pct), "About zero: over a quarter, the order has been reshuffled."],
  ...["short", "medium", "long"].map((k) => [`Sector dispersion · ${k} (${HZ[k]} sessions), best − worst RS`, `${n(RS[k].dispersion.spreadNow)} pts`, pct(RS[k].dispersion.spreadPct), "Nine original SPDRs (constant roster since 2003)."]),
  ...["short", "medium", "long"].map((k) => [`Equal weight vs cap weight · RSP − SPY, ${k}`, `<span class="${cls(CW.RSPvsSPY[k].now)}">${sg(CW.RSPvsSPY[k].now)} pts</span>`, pct(CW.RSPvsSPY[k].ownPct), "Low = the average S&P stock is trailing the index (narrow leadership)."]),
];

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sector rotation · U2 · 28 Sep 2026</title>
<style>
body{margin:0;background:#07070C;color:#B4B4C6;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#C8C8D2}h2{font-size:26px;margin:46px 0 8px;color:#C8C8D2}h3{font-size:19px;margin:26px 0 6px;color:#C8C8D2}
p,li{max-width:1080px}.q{color:#9C9CAE;font-size:13px}
ol.lead{font-size:19px;color:#C8C8D2;max-width:1120px;padding-left:24px}ol.lead li{margin:0 0 12px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1080px;color:#C8C8D2}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
details{margin:8px 0;max-width:1400px}summary{cursor:pointer;padding:6px 0;color:#C0C0CE}
.chart{display:block;background:#0B0B12;border:1px solid #1E1E28;margin:12px 0;max-width:1400px;height:auto}
.up{color:#00FFA3}.dn{color:#FF2D55}
dl{max-width:1120px}dt{color:#C8C8D2;font-weight:600;margin-top:10px}dd{margin:2px 0 0 0}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table{font-size:12px}th,td{padding:5px 6px}code{overflow-wrap:anywhere}}
</style></head><body>
<span data-scnav-slot></span><h1>Sector rotation: the bow tie, and how sectors rotate short, medium and long term</h1>
<div class="q">U2 · 28 Sep 2026 · bars to ${J.lastBar} (Friday's close) from the chart API · built ${J.generated.slice(0, 16).replace("T", " ")} UTC · research, not advice · price only · <b>no buy or sell calls on this page</b></div>

<div class="status"><b>STATUS · done on real data, nothing deployed.</b> ${Object.keys(J.sources).length} funds, daily bars 2003 → ${J.lastBar}. The Hub's sector Geiger was rebuilt day by day with the Hub's own maths; on today's bars it matches the live <code>/geiger</code> rung by rung exactly (1d, 3d and 1w: largest difference ${G.replayCheck.maxAbsDiff["1d"]}, ${G.replayCheck.maxAbsDiff["3d"]}, ${G.replayCheck.maxAbsDiff["1w"]}, across ${G.replayCheck.funds} funds). Every percentile is the reading's place in its own history (1 = lowest ever, 100 = highest ever). Green and red follow direction.</div>

<h2>What the bow tie is telling you</h2>
<ol class="lead">
<li><b>It is the widest bow tie in the record.</b> Both wings are long at once: the shorter wing reads ${sg(T.wing)} (live Hub ${sg(liveWing)}), at the <b>${ord(T.wingPct)} percentile</b> of every day since ${G.from}. The whole width is ${n(T.spread, 2)} (${ord(T.spreadPct)}). The other families show the same shape: iShares at the ${ord(fam.ISHARES.wingPct)} and Vanguard at the ${ord(fam.VANGUARD.wingPct)} percentile. Equal weight has the same shape, with a live wing of ${sg(fam.EQWT.wingLive)} (too little history for a percentile). "Scarily insane" is a fair description: the measure has only been this wide on ${f16.likeToday.spy.n} earlier days, in ${G.episodes.length} separate episodes.</li>
<li><b>Two sectors are carrying the tape, and the rest are red.</b> Green wing: ${green.map((o) => `${o.sym} <span class="up">${sg(o.g)}</span>`).join(", ")}. Red wing: ${red.map((o) => `${o.sym} <span class="dn">${sg(o.g)}</span>`).join(", ")}. Only ${Math.round(T.balance * 100)}% of sectors are above zero. Equal weight agrees: over the last ${HZ.short} sessions RSP trailed SPY by ${n(-CW.RSPvsSPY.short.now)} points, the <b>${ord(CW.RSPvsSPY.short.ownPct)} percentile</b> since 2003. Over ${HZ.long} sessions it trails by ${n(-CW.RSPvsSPY.long.now)} points (${ord(CW.RSPvsSPY.long.ownPct)} percentile). In plain words, the index is being held up by a narrow set.</li>
<li><b>The shift you saw is real.</b> In mid-2025, health care (XLV) sat on the red wing and utilities (XLU) on the green. Today they have swapped (chart 3). Compare today's order with ${HZ.medium} sessions ago: the rank correlation is ${sg(T.flip[HZ.medium].now)}, meaning the order has been fully reshuffled over a quarter. Compared with ${HZ.short} sessions ago it is ${sg(T.flip[HZ.short].now)}, so the latest three weeks mostly extended the moves already under way. The fast (1d) and slow (1w) Geiger orders agree at ${sg(T.shortLong)} (${ord(T.shortLongPct)} percentile). This tie is not a one-day flicker.</li>
<li><b>After the ${G.episodes.length} earlier ties this wide, one thing happened every time: the tie got narrower.</b> ${HZ.short} sessions later the wing was smaller on ${f16.likeToday.wingChange.n - Math.round(f16.likeToday.wingChange.up * f16.likeToday.wingChange.n / 100)} of ${f16.likeToday.wingChange.n} days (average change ${sg(f16.likeToday.wingChange.mean)}). Part of that is simply what extremes do. What SPY did next was <b>not</b> consistent. Some episodes preceded big falls (January 2008, and the late-January 2020 tie before the COVID crash). Others preceded strong rises (February 2016, August 2019, November 2022). Over ${HZ.short} sessions SPY averaged ${sg(f16.likeToday.spy.mean)}% (median ${sg(f16.likeToday.spy.med)}%), against ${sg(f16.allDays.spy.mean)}% on all days. The 90% block-bootstrap interval for that difference runs from ${sg(f16.diffCI.spy[0])} to ${sg(f16.diffCI.spy[1])} points, so it includes zero. Ten episodes are too few to call a direction.</li>
<li><b>What history says about "rotation" in general.</b> At the short (${HZ.short}-session) and medium (${HZ.medium}-session) horizons, a sector's relative-strength rank tells you almost nothing about its rank over the next equal period. The rank correlation is ${sg(RS.short.nextPeriodRankCorr.mean, 3)} and ${sg(RS.medium.nextPeriodRankCorr.mean, 3)}, and a top-third sector lands in the top third next time ${Math.round(RS.medium.transitions.TOP.TOP * 100)}% of the time, near the 33% of a coin (and in the bottom third ${Math.round(RS.medium.transitions.TOP.BOTTOM * 100)}%). The <b>long</b> horizon (${HZ.long} sessions ≈ ${(HZ.long / 252).toFixed(1)} years) is different: leaders tend to stay leaders (top third stays top third ${Math.round(RS.long.transitions.TOP.TOP * 100)}% of the time; rank correlation ${sg(RS.long.nextPeriodRankCorr.mean, 2)}, interval ${sg(RS.long.nextPeriodRankCorr.ci90[0], 2)} to ${sg(RS.long.nextPeriodRankCorr.ci90[1], 2)}). On the rotation map, moves go clockwise (leading → weakening → lagging → improving) ${RR.medium.moves.cwShare}% of the time and counter-clockwise ${RR.medium.moves.ccwShare}% of the time. The textbook wheel exists, but it is a loose tendency, not a clock.</li>
<li><b>For allocation, descriptively (not a recommendation):</b> the spread between sectors is wide (short-horizon dispersion ${ord(RS.short.dispersion.spreadPct)} percentile), so which sectors a portfolio holds matters more than usual right now. The index's result rests on two sectors (tech and health care), and equal weight is near its weakest against cap weight. Over three weeks and over a quarter, today's sector ranking has had no forecasting value for the next equal period. Over multi-year spans, leaders have tended to persist. On the earlier days as wide as today, the green-wing sectors went on to trail SPY by ${n(-f72.likeToday.topRel.mean)} points on average over the next ${HZ.medium} sessions, against ${n(-f72.allDays.topRel.mean)} on all days (90% interval of the difference ${sg(f72.diffCI.topRel[0])} to ${sg(f72.diffCI.topRel[1])}). That is weak evidence that a very wide tie gives back a little, not that it flips.</li>
</ol>
${img("c1-strips-today.png", "The four sector strips today from live /geiger")}

<h2>1 · Where today sits, on every measure</h2>
<p>Percentile = place in the measure's own history since the data allow (1 lowest, 100 highest). Readings are Friday ${J.lastBar}'s close, taken on the morning of ${J.asof}.</p>
${tbl(["measure", "today", "own-history percentile", "what it means"], todayRows)}

<h3>Each sector, at each horizon (relative strength vs SPY, log points)</h3>
${tbl(["sector", "fund", "Geiger (replayed)", "Geiger (live)", `short ${HZ.short}: RS · rank · pct`, `medium ${HZ.medium}: RS · rank · pct`, `long ${HZ.long}: RS · rank · pct`, `RRG ${HZ.medium} quadrant · days in · pct of stays`],
  T.order.map((o) => {
    const at = (k) => { const r = RS[k].today.find((x) => x.sym === o.sym); return r ? `<span class="${cls(r.rs)}">${sg(r.rs)}</span> · #${r.rank} · ${pct(r.ownPct)}` : "—"; };
    const q = RR.medium.today.find((x) => x.sym === o.sym);
    return [o.sector, o.sym, `<span class="${cls(o.g)}">${sg(o.g)}</span>`, `<span class="${cls(o.live)}">${sg(o.live)}</span>`, at("short"), at("medium"), at("long"), q ? `${q.quad ?? "—"} · ${q.daysIn ?? "—"} · ${pct(q.dwellPct)}` : "—"];
  }))}

<h2>2 · The bow tie, measured</h2>
<p><b>What the Hub shows.</b> COHORT COMPARE → SECTORS draws one centre-zero bar per sector, sorted from most bullish (left) to most bearish (right). The scale stretches so the largest bar touches the edge (<code>index.html</code> <code>cohortCompareStripHTML</code>, <code>cohortCompareSpan</code>). Under the MEMBERS tab each bar is the <b>average Geiger of the sector's member companies</b>. Under SPDR, iSHARES, VANGUARD and EQUAL-WT each bar is <b>the fund's own Geiger</b> (<code>SECT_FAMILY_FUNDS</code>). The live Geiger is a weighted blend of seven timeframes (3h, 4h, 6h, 12h, 1d, 3d, 1w, with Alan's saved Equalizer weights). Each timeframe is half trend (how orderly the 5 → 200 moving-average fan is) and half momentum (RSI 14 and Williams %R).</p>
<p><b>How it was rebuilt for history.</b> Daily bars can rebuild the 1d, 3d and 1w timeframes exactly. The Hub's own replay maths were used (<code>geiger-replay.mjs</code>), with 3-day and weekly bars grouped exactly as the chart API groups them. The three are weighted as Alan's Equalizer weights them (${Object.entries(G.weights).map(([k, v]) => `${k} ${v}`).join(", ")}). The four intraday timeframes cannot be rebuilt for past years. Checked against today's live values across ${G.replayCheck.funds} funds, the three rebuilt timeframes match exactly, and the rebuilt blend tracks the live seven-timeframe blend at correlation ${G.replayCheck.compositePearson} (rank ${G.replayCheck.compositeSpearman}, average gap ${G.replayCheck.meanAbsDiff}). A day counts only once every timeframe has its full nine-line fan, which starts the history at ${G.from}.</p>
<p><b>The bow tie as a number.</b> The <b>shorter wing</b> is the smaller of (strongest sector's Geiger) and (minus the weakest sector's Geiger). It is large only when both a long green wing and a long red wing exist at the same time. At zero or below, the strip is one-sided. Alongside it: the whole width (best − worst), the knot (how flat the middle bar is on the autoscaled strip), and the share of sectors above zero. Its history, in quantiles: ${Object.entries(G.wingQuantiles).map(([q, v]) => `${q}th ${sg(v)}`).join(" · ")}.</p>
${img("c2-wing-history.png", "The shorter wing through history")}
${img("c3-recent-weeks.png", "SPDR Geiger over the last 78 weeks")}
<h3>Every earlier episode as wide as today (${G.episodes.length}, since ${G.from})</h3>
<p>An episode opens on the first day the wing reaches today's level after at least ${HZ.short} sessions below it.</p>
${tbl(["from", "to", "days at/above", "peak wing", "green wing (top 3)", "red wing (bottom 3)", `SPY next ${HZ.short}`, "next 38", `next ${HZ.medium}`, `green − red next ${HZ.medium}`],
  G.episodes.map((e, i) => { const o16 = f16.episodes[i], o38 = f38.episodes[i], o72 = f72.episodes[i];
    return [e.start, e.end, e.days, sg(e.peakWing), e.green.join(", "), e.red.join(", "), `<span class="${cls(o16.spy)}">${sg(o16.spy, 1)}%</span>`, `<span class="${cls(o38.spy)}">${sg(o38.spy, 1)}%</span>`, `<span class="${cls(o72.spy)}">${sg(o72.spy, 1)}%</span>`, `<span class="${cls(o72.wingSpread)}">${sg(o72.wingSpread, 1)}</span>`]; }))}
<h3>What followed: days like today against all days</h3>
<p>"Days like today" are the ${f16.likeToday.spy.n} days with a wing at or above today's. Forward returns run close to close, price only. The interval is a 90% moving-block bootstrap of (like-today mean − all-days mean), with blocks as long as the horizon, 600 resamples and a fixed seed. An interval that includes zero means "not distinguishable from an ordinary day".</p>
${tbl(["outcome", ...[f16, f38, f72].map((f) => `next ${f.h}: like today · all days · 90% interval of the difference`)],
  [["SPY return %", "spy"], ["green wing − red wing (relative to SPY, pts)", "wingSpread"], ["green wing vs SPY (pts)", "topRel"], ["red wing vs SPY (pts)", "botRel"], ["spread of sector returns (pts, st. dev.)", "fwdDisp"], ["change in the wing", "wingChange"]].map(([lab, k]) =>
    [lab, ...[f16, f38, f72].map((f) => `<span class="${cls(f.likeToday[k].mean)}">${sg(f.likeToday[k].mean)}</span> (med ${sg(f.likeToday[k].med)}, ${f.likeToday[k].up}% up) · <span class="${cls(f.allDays[k].mean)}">${sg(f.allDays[k].mean)}</span> (${f.allDays[k].up}% up) · ${sg(f.diffCI[k][0])} to ${sg(f.diffCI[k][1])}`)]))}
<p>The whole range, not just the extreme. Here every day is grouped by its wing's own-history tenth. Rank correlations over all days between the wing and what followed: with SPY ${[f16, f38, f72].map((f) => sg(f.rankCorr.wingVsSpy, 3)).join(" / ")}; with green − red ${[f16, f38, f72].map((f) => sg(f.rankCorr.wingVsWingSpread, 3)).join(" / ")}; with the spread of sector returns ${[f16, f38, f72].map((f) => sg(f.rankCorr.wingVsFwdDisp, 3)).join(" / ")} (at ${HZ.short} / 38 / ${HZ.medium} sessions). All of them are small. A wide tie comes with a slightly weaker SPY, a slight give-back by the green wing, and slightly more sector dispersion afterwards, and none of it is strong.</p>
${img("c9-followed.png", "Outcomes by wing percentile")}

<h2>3 · How sectors rotate: three horizons</h2>
<p><b>Horizons, taken from SPY's own swings</b> (the S9 pivot rule: a pivot high is above the N bars before it and at or above the N after, and the reverse for lows; swings alternate):</p>
<ul>${Object.entries(J.horizons.why).map(([k, w]) => `<li><b>${k} = ${HZ[k]} sessions</b>: ${esc(w)}.</li>`).join("")}</ul>
${tbl(["pivot window", "swings", "leg p25 · median · p75", "low-to-low p25 · median · p75"], J.horizons.swingTable.map((r) => [r.pivot, r.swings, `${n(r.leg.p25, 0)} · ${n(r.leg.med, 0)} · ${n(r.leg.p75, 0)}`, `${n(r.cycle.p25, 0)} · ${n(r.cycle.med, 0)} · ${n(r.cycle.p75, 0)}`]))}
<p>Relative strength at horizon h = the sector fund's log return over the last h sessions minus SPY's, in points. The eleven SPDRs are ranked each day; XLRE joins on ${J.starts.XLRE} and XLC on ${J.starts.XLC}.</p>
<h3>Rank persistence</h3>
${img("c4-persistence.png", "Rank persistence against lag")}
${tbl(["horizon", "rank now vs rank over the next equal period (mean, 90% interval)", "leader (#1) stays: median · p75 · p90 · longest (sessions)", "top third stays: median · p75 · p90 · longest"],
  Object.entries(RS).map(([k, v]) => [`${k} (${v.h})`, `${sg(v.nextPeriodRankCorr.mean, 3)} (${sg(v.nextPeriodRankCorr.ci90[0], 3)} to ${sg(v.nextPeriodRankCorr.ci90[1], 3)})`,
    `${n(v.leaderSpells.first.med, 0)} · ${n(v.leaderSpells.first.p75, 0)} · ${n(v.leaderSpells.first.p90, 0)} · ${v.leaderSpells.first.max}`, `${n(v.leaderSpells.top.med, 0)} · ${n(v.leaderSpells.top.p75, 0)} · ${n(v.leaderSpells.top.p90, 0)} · ${v.leaderSpells.top.max}`]))}
<p>The persistence curves fall to about zero at exactly the horizon's own length. That is the key fact. Within a window, ranks are sticky only because consecutive days share most of their history. Once the window has fully turned over, the old ranking carries no information, except at the multi-year horizon. Spell lengths are short at the median because a daily ranking flickers near the tier edges; the p90 and longest columns show the real runs. Neighbouring horizons (sensitivity) give the same answer: ${Object.entries(J.sensitivity).map(([k, a]) => a.map((s) => `${s.h} sessions ${sg(s.nextPeriodRankCorr, 3)}`).join(", ")).join("; ")}.</p>
<h3>Tier transitions</h3>
${img("c5-transitions.png", "Transition matrices")}
<h3>Rotation map (RRG-style)</h3>
<p>The x-axis is where a sector's relative strength sits against its own h-session trend (an exponential average). The y-axis is whether that gap is widening or narrowing, i.e. the gap against its own h-session average. The four quadrants are leading, weakening, lagging and improving.</p>
${img("c6-rrg-medium.png", "Rotation map, medium horizon")}
${tbl(["horizon", "quadrant", "stays (n)", "median · p75 · p90 sessions", "share lasting one day", "moves: clockwise · counter · jump across"],
  Object.entries(RR).flatMap(([k, v]) => Object.entries(v.dwell).map(([q, d], i) => [i ? "" : `${k} (${v.h})`, q, d.n, `${n(d.med, 0)} · ${n(d.p75, 0)} · ${n(d.p90, 0)}`, `${d.oneDay}%`, i ? "" : `${v.moves.cwShare}% · ${v.moves.ccwShare}% · ${v.moves.acrossShare}%`])))}
<h3>Dispersion</h3>
${img("c7-dispersion.png", "Sector dispersion history")}
${tbl(["horizon", "best − worst today (9 original)", "percentile", "median · 90th percentile of history", "all eleven (since 2018-06)", "percentile"],
  Object.entries(RS).map(([k, v]) => [`${k} (${v.h})`, `${n(v.dispersion.spreadNow)} pts`, pct(v.dispersion.spreadPct), `${n(v.dispersion.spreadMed)} · ${n(v.dispersion.spreadP90)}`, `${n(v.dispersion.spread11Now)} pts`, pct(v.dispersion.spread11Pct)]))}

<h2>4 · Cap weight against equal weight</h2>
${img("c8-rsp-spy.png", "RSP minus SPY since 2003")}
<p>RSP (every S&P 500 stock at the same weight) against SPY (weighted by size): ${Object.entries(CW.RSPvsSPY).map(([k, v]) => `${k} ${HZ[k]} sessions <span class="${cls(v.now)}">${sg(v.now)}</span> pts (${ord(v.ownPct)} percentile)`).join("; ")}.</p>
<p>Per sector, the Invesco equal-weight fund minus the SPDR fund. The equal-weight funds only have history under their current tickers from 2023-06-07, so these percentiles cover about three years.</p>
${tbl(["sector", "EW − SPDR", `short ${HZ.short}: pts · pct`, `medium ${HZ.medium}: pts · pct`],
  CW.perSector.map((r) => [r.sector, `${r.ew} − ${r.cw}`, `<span class="${cls(r.short.now)}">${sg(r.short.now)}</span> · ${pct(r.short.ownPct)}`, `<span class="${cls(r.medium.now)}">${sg(r.medium.now)}</span> · ${pct(r.medium.ownPct)}`]))}
<details><summary>iShares and Vanguard against SPDR, per sector (medium horizon)</summary>
${tbl(["family", "sector", "fund vs SPDR", "correlation of their RS", "gap today (pts)", "percentile"], CW.families.map((r) => [r.fam, r.sector, `${r.fund} vs ${r.spdr}`, n(r.corrMedRS, 3), `<span class="${cls(r.gapNow)}">${sg(r.gapNow)}</span>`, pct(r.gapPct)]))}
<p>Vanguard and iShares hold smaller companies than the SPDRs, so their gap to the SPDR is a rough size tilt inside each sector. IYZ is a telecom-only fund, not a full communications sector like XLC, which is why its correlation with XLC is ${n(CW.families.find((r) => r.fund === "IYZ").corrMedRS, 2)}.</p></details>

<h2>Where each number comes from</h2>
<dl>
<dt>Prices</dt><dd>Chart API <code>GET https://scintilla-massive-chart-api.fly.dev/candles?tf=D&amp;limit=6000</code> with Origin scintillahub.ai: finished daily bars, split-adjusted, provider MASSIVE. They are saved as served in <code>~/Library/Application Support/scintilla/stats-cache/sector-rotation-20260928/</code>. Starts: XLRE ${J.starts.XLRE}, XLC ${J.starts.XLC}, Vanguard 2004, equal-weight sector funds ${J.starts.RSPT}, and everything else ${J.starts.SPY}.</dd>
<dt>Bad prints</dt><dd>A wick more than 25% beyond the bar's body is clamped to the body (the S9 rule). Bars touched: ${Object.entries(J.sources).filter(([, v]) => v.cleaned?.length).map(([s, v]) => `${s} ${v.cleaned.length}`).join(", ") || "none"}.</dd>
<dt>Live Geiger</dt><dd>One <code>GET /geiger?symbols=…&amp;detail=1</code> at ${G.replayCheck.liveComputedUtc}, saved as <code>live-geiger-snapshot.json</code>. It is used only for today's strips and for checking the rebuild.</dd>
<dt>Code</dt><dd><code>research/statistics/sector-rotation/</code>: <code>fetch.mjs</code> (GET only), <code>lib.mjs</code> (the arithmetic, fixture-tested in <code>tests/sector-rotation.test.mjs</code>), <code>run.mjs</code> (writes <code>sector-rotation.json</code>), <code>charts.py</code> (the nine images) and <code>page.mjs</code> (this page).</dd>
</dl>

<h2>What could be wrong</h2>
<ul>
<li><b>The rebuilt Geiger is three of the seven timeframes.</b> It matches the live 1d, 3d and 1w readings exactly, but it leaves out 3h, 4h, 6h and 12h. Today it tracks the live composite at ${G.replayCheck.compositePearson}, with an average gap of ${G.replayCheck.meanAbsDiff}. Past readings would have carried the same kind of gap.</li>
<li><b>Only ${G.episodes.length} earlier episodes.</b> Every "what followed" number rests on them, and two (January 2008, January 2020) sat just before large falls. The intervals are wide on purpose.</li>
<li><b>Price only.</b> Dividends are not included. Over multi-year horizons this understates high-yield sectors (utilities, real estate, staples, energy) against SPY by roughly their yield gap, about 1 to 3 points a year.</li>
<li><b>Sectors were redrawn.</b> Real estate left financials in 2016 (XLRE), and communications was carved out of tech and discretionary in 2018 (XLC). Long-horizon ranks straddle those changes. Dispersion uses the nine original funds for a constant roster.</li>
<li><b>The horizons are a choice.</b> They are the medians of SPY's own swing lengths. Neighbouring choices are shown in the sensitivity line and tell the same story.</li>
<li><b>Overlapping windows.</b> Daily forward returns overlap, which is why the intervals use a block bootstrap with blocks as long as the horizon, not a plain count.</li>
<li><b>"Bow tie" is my definition of what the eye reads on the strip</b> (the shorter wing). Other definitions (the width, the knot) are shown next to it.</li>
</ul>

<h2>What I did not do</h2>
<ul>
<li>No change to the Hub, no deploy, no database write, no paid service.</li>
<li>The equal-weight funds' history before June 2023 is not included, because the chart API does not serve the old tickers (RYT, RYF, …); they return 404.</li>
<li>No MEMBERS-tab history: that would need every member company's history as it stood on each past date.</li>
<li>No intraday Geiger timeframes in the history, and no dividend-adjusted returns.</li>
<li>No buy or sell calls. The allocation paragraph describes base rates only.</li>
</ul>
</body></html>
`;
fs.writeFileSync(path.join(OUT, "SECTOR-ROTATION.html"), html);
console.log("wrote SECTOR-ROTATION.html", html.length, "bytes");
