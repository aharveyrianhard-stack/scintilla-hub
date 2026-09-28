/* build.mjs — builds the Statistics tab prototype from ALREADY-PUBLISHED results only.
   Inputs: research/statistics/data/s8-summary.json (the ladder, 27 Sep) and s9-research.json (the research program,
   27 Sep). No bars are downloaded, nothing is re-measured; every number on a card is read from those two files (the
   only arithmetic added is a share over the published per-decline records and a 95% range on a published count).
   Outputs, all next to this file:
     findings.json      the manifest — the only door onto the tab; a card missing any required field does not render
     charts/*.svg       every chart, saved twice (1200 wide for the desk, 390 for the phone), dated, self-describing
     index.html         the tab itself, with the same SVGs inlined so hover works
   Run: node deliverables/20260928/stats-tab/build.mjs   (from the repo root) */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENTRY, entryFaults } from "./entry.mjs";
import { twoPanelChart, barsChart, rangeChart, curveChart, rangeVerdict, pct, signed, thousands, esc, PAL } from "./charts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const S8 = JSON.parse(readFileSync(join(ROOT, "research/statistics/data/s8-summary.json"), "utf8"));
const S9 = JSON.parse(readFileSync(join(ROOT, "research/statistics/data/s9-research.json"), "utf8"));
const L = JSON.parse(readFileSync(join(ROOT, "research/statistics/data/s8-ladder.json"), "utf8"));   // the ladder's full rows: ranges, shuffles, the combination search
const BUILT = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const STAMP = "20260928";
const DATA_TO = "2026-09-25";

/* Wilson 95% range on a published share and count — the honest width of a percentage from n cases. */
export function wilson(share, n) {
  if (!n) return null;
  const p = share / 100, z = 1.96, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, hw = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - hw) * 100, Math.min(1, c + hw) * 100];
}
const median = (a) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quart = (a, q) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const rng = (r) => (r ? `${r[0].toFixed(1)}–${r[1].toFixed(1)}%` : "—");

const S8_PAGE = "/deliverables/20260927/ladder/LADDER.html";
const S9_PAGE = "/deliverables/20260927/research-program/RESEARCH-PROGRAM.html";
const STUDIES = {
  S8: { id: "S8", title: "The ladder: if I bought at this RSI level, or at this average, how did it go?", page: S8_PAGE, date: "2026-09-27", json: "/research/statistics/data/s8-summary.json", built: S8.built_utc },
  S9: { id: "S9", title: "The research program: questions first, pivots not windows, the market first", page: S9_PAGE, date: "2026-09-27", json: "/research/statistics/data/s9-research.json", built: S9.generated },
};
const THEMES = [
  { id: "market", title: "Market first · the rising tide", why: "Rising tide lifts all boats. Every stock study is read in the market's state; the market's own numbers come first." },
  { id: "pullbacks", title: "Pullbacks and bottoms", why: "Alan buys well and sells too early. What separates a dip that makes a new high from one that does not, and where 'deep below the 200-day' becomes a problem." },
  { id: "rsi", title: "RSI percentiles", why: "Own-history percentiles, 1 to 100, never a fixed number: an RSI of 35 means one thing for SPY and another for Bitcoin." },
  { id: "fear", title: "Fear, greed and macro", why: "Trade the fear/greed cycle and manage risk between the extremes: the VIX, put/call, the dollar and yields, read at the market's own turning points." },
  { id: "leaders", title: "Leaders", why: "A few names drive most returns. Which names were already leaders before the quarter's winners were known, and what they had in common." },
  { id: "execution", title: "Execution", why: "The setups that held in both halves of history, how rare they are, and what an entry into a report is worth." },
];

/* ── the cards, every number from the published JSON files ───────────────────────────────────────────────
   28 Sep review round: each card now carries its METHOD (what the horizon is, how the condition is cut). The entry
   rules below admit a card to the tab only if its horizon is a pivot/swing (not a fixed count of sessions), its
   condition is read over the full distribution (not a forced cut-off), and it has a named review. Cards that fail
   are kept, fixed and drawn, but HELD BACK below the tab with the reason printed. */
const spy8 = S8.funds.SPY, band = S9.band.SPY.full;
const ladRow = (key) => L.indexes.SPY.rows[key];
const stocksAny = S8.stocks.states[0];
const INST = ["SPY", "QQQ", "IWM"];
const rebounds = (t) => S9.instruments[t].all.filter((d) => typeof d.newHigh === "boolean");
const share = (a, f) => (a.length ? (100 * a.filter(f).length) / a.length : null);

/* Spearman rank correlation (ties share their average rank). */
export function spearman(xs, ys) {
  const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; };
  const rx = rank(xs), ry = rank(ys), n = xs.length, mx = (n + 1) / 2;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - mx); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - mx) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
/* "Has fallen at least X% from its last swing high": every whole percent from 0 to the deepest decline, no buckets. */
export function fallenCurve(recs) {
  const deepest = Math.max(...recs.map((d) => -d.depth)), out = [];
  for (let X = 0; X <= Math.floor(deepest); X++) { const g = recs.filter((d) => -d.depth >= X); out.push({ X, n: g.length, share: share(g, (d) => d.newHigh), range: wilson(share(g, (d) => d.newHigh), g.length) }); }
  return out;
}

/* 1 · market: SPY low RSI above vs below the 200-day — dots with S8's month-clustered 95% ranges */
const c1T = [5, 10, 15, 20, 25, 30];
const c1rows = c1T.map((T) => ({ T, on: ladRow(`rsi<=${T}|on|20`), off: ladRow(`rsi<=${T}|off|20`) }));
const anyOn = spy8.any.on.win, anyOff = spy8.any.off.win;
const crossCount = c1rows.reduce((k, r) => k + (rangeVerdict(r.on.ci[0], r.on.ci[1], anyOn) === "crosses") + (rangeVerdict(r.off.ci[0], r.off.ci[1], anyOff) === "crosses"), 0);
const r10 = c1rows.find((r) => r.T === 10), r5 = c1rows.find((r) => r.T === 5), r20 = c1rows.find((r) => r.T === 20);
const ov = [Math.max(r10.on.ci[0], r10.off.ci[0]), Math.min(r10.on.ci[1], r10.off.ci[1])];
const c1 = {
  id: "market-spy-low-rsi-vs-200day", theme: "market",
  question: "Does a low SPY RSI mean more when SPY is above its 200-day than below it?",
  answer: `Not in a way that can be told apart from chance, at any step. At SPY's RSI bottom 10%: above its 200-day, up 20 sessions later ${pct(r10.on.ep.win)} of ${r10.on.ep.n} times, 95% range ${rng(r10.on.ci)}, which contains any uptrend day's ${pct(anyOn)}; below it, ${pct(r10.off.ep.win)} of ${r10.off.ep.n}, range ${rng(r10.off.ci)}, which contains any downtrend day's ${pct(anyOff)}. The two ranges overlap from ${pct(ov[0])} to ${pct(ov[1])}. The steps do not even agree with each other: at the bottom 5% the below-200 reading sits further above its line (${pct(r5.off.ep.win)} vs ${pct(anyOff)}) than the above-200 one (${pct(r5.on.ep.win)} vs ${pct(anyOn)}), and at the bottom 20% the above-200 reading is under its line (${pct(r20.on.ep.win)} vs ${pct(anyOn)}). ${crossCount} of the ${c1rows.length * 2} ranges on the chart cross their any-day line.`,
  uncertainty: `Ranges are S8's month-clustered 95% ranges. The above-200 reading at the bottom 10% (${pct(r10.on.ep.win)}) is exactly the level random uptrend days reach 1 time in 20 (S8 shuffle, 95th percentile ${pct(r10.on.shuffle.p95)}). The RSI full-history lane (28 Sep, in flight) reports no reliable gain over any day in this zone.`,
  sample: { instrument: "SPY", from: spy8.from, to: DATA_TO, days: spy8.any.all.n, episodes: r10.on.ep.n + r10.off.ep.n, unit: "days · episodes at bottom 10% (above + below)" },
  method: { horizon: { kind: "sessions", text: "up after a fixed 20 sessions" }, cutoffs: { kind: "fixed", text: "fixed steps of the RSI percentile (bottom 5, 10, … 30%) and a fixed 200-day line" } },
  study: "S8", review: { by: "S8's own month-clustered ranges and 200-draw shuffle (inside the study, not a second lane)", status: "reviewed", level: "in-study" },
  chart: { kind: "range", args: { title: "SPY: up 20 sessions after its RSI reached its bottom X% — above vs below the 200-day, with 95% ranges", subtitle: "dot = share of episodes up after 20 sessions · line = S8's month-clustered 95% range · green/red = dot above/below that state's any-day line", groups: c1rows.map((r) => ({ label: `bottom ${r.T}%`, short: `≤${r.T}%`, sub: `${r.on.ep.n} · ${r.off.ep.n}`, marks: [{ value: r.on.ep.win, lo: r.on.ci[0], hi: r.on.ci[1], n: r.on.ep.n, ref: anyOn, tip: `bottom ${r.T}% · above 200-day: ${pct(r.on.ep.win)} of ${r.on.ep.n} · 95% range ${rng(r.on.ci)} · any uptrend day ${pct(anyOn)}` }, { value: r.off.ep.win, lo: r.off.ci[0], hi: r.off.ci[1], n: r.off.ep.n, ref: anyOff, tip: `bottom ${r.T}% · below 200-day: ${pct(r.off.ep.win)} of ${r.off.ep.n} · 95% range ${rng(r.off.ci)} · any downtrend day ${pct(anyOff)}` }] })), series: [{ label: "SPY above its 200-day" }, { label: "SPY below its 200-day" }], refs: [{ value: anyOn, label: `any uptrend day ${pct(anyOn)}` }, { value: anyOff, label: `any downtrend day ${pct(anyOff)}` }], yMin: 30, yMax: 95 } },
};

/* 2 · pullbacks: once SPY has fallen X% from its last swing high, how often did the next swing make a new high? */
const curves = Object.fromEntries(INST.map((t) => [t, fallenCurve(rebounds(t))]));
const refNH = Object.fromEntries(INST.map((t) => [t, share(rebounds(t), (d) => d.newHigh)]));
const at = (t, X) => curves[t].find((p) => p.X === X);
const firstBelow = (t) => curves[t].find((p) => p.share < refNH[t])?.X;
const sens = S9.sensitivity.SPY;
const c2 = {
  id: "pullbacks-spy-fallen-so-far-to-new-high", theme: "pullbacks",
  question: "Once SPY has fallen X% from its last swing high, how often did the next swing go on to make a new high?",
  answer: `The further it has already fallen, the less often the rebound made a new high, and this uses only what is known during the fall. Of all ${rebounds("SPY").length} SPY declines since 2003, ${pct(refNH.SPY)} were followed by a new high. Of the ${at("SPY", 5).n} that got at least 5% deep, ${pct(at("SPY", 5).share)}; of the ${at("SPY", 10).n} that got at least 10% deep, ${pct(at("SPY", 10).share)}. QQQ and IWM fall the same way but less steeply: at 10% down, QQQ ${pct(at("QQQ", 10).share)} of ${at("QQQ", 10).n} and IWM ${pct(at("IWM", 10).share)} of ${at("IWM", 10).n}, so SPY's ${pct(at("SPY", 10).share)} is not repeated in its siblings. ${(() => { const a = Math.min(...INST.map(firstBelow)), b = Math.max(...INST.map(firstBelow)); return `All three drop under their own all-declines line from about ${a === b ? a : a + "–" + b}% down.`; })()}`,
  uncertainty: `Counts shrink along the curve: SPY has ${at("SPY", 10).n} declines that got 10% deep (95% range ${rng(at("SPY", 10).range)}, not clustered) and ${at("SPY", 20).n} that got 20% deep, which is a list, not a rate; the chart fades points as their count falls instead of cutting them off. Swings are 10/10 pivots: the swing high is confirmed 10 bars after it, and one long fall can be split into several pivot declines (SPY's deepest here is ${(-Math.min(...rebounds("SPY").map((d) => d.depth))).toFixed(1)}%, not 2008's full fall). With a 20-bar pivot the count of SPY declines that reached 10% goes from ${sens["10"].big10} to ${sens["20"].big10} (S9 sensitivity), so the deep end depends on the pivot width.`,
  sample: { instrument: "SPY · QQQ · IWM", from: "2003-09-11", to: DATA_TO, days: 5797, episodes: rebounds("SPY").length, unit: "SPY bars · SPY declines (pivot to pivot)" },
  method: { horizon: { kind: "pivot", text: "the next swing high after the decline's low (10/10 pivots)" }, cutoffs: { kind: "full", text: "every whole percent of fall from 0 to the deepest decline" } },
  study: "S9", review: { by: `Same measurement on QQQ and IWM, drawn on the chart (inside the study, not a second lane): all three fall as the decline deepens; SPY's deep end is lower than both siblings'`, status: "reviewed", level: "in-study" },
  chart: { kind: "curve", args: { title: "Once the index had fallen X% from its last swing high: how often the next swing made a new high", subtitle: "every decline between 10/10 pivots since 2003 · each point = the declines that got at least X% deep · green/red = above/below that index's own all-declines share · faint = few declines · dotted line = SPY's all-declines share", xLabel: "fallen so far from the last swing high", xMax: Math.ceil(Math.max(...INST.map((t) => curves[t].at(-1).X)) / 5) * 5, yMin: 0, yMax: 100, series: INST.map((t, i) => ({ label: t, ref: { value: refNH[t], label: `all declines SPY ${refNH.SPY.toFixed(1)} · QQQ ${refNH.QQQ.toFixed(1)} · IWM ${pct(refNH.IWM)}` }, showRef: i === 0, points: curves[t].map((p) => ({ x: p.X, y: p.share, n: p.n, tip: `${t} at least ${p.X}% down: ${pct(p.share)} of ${p.n} went on to a new high · 95% range ${rng(p.range)} · all ${t} declines ${pct(refNH[t])}` })) })) } },
};

/* 3 · pullbacks: the 200-day band — up after 60 drawn as the DIFFERENCE from any day, so bars start at zero */
const shortBand = (b) => (b.includes("more than") ? (b.includes("below") ? "−10%+" : "+10%+") : (b.includes("below") ? "−" : "+") + b.replace(/ (below|above)/, ""));
const c3groups = band.bands.map((b) => ({ label: b.band.replace("more than ", ">"), short: shortBand(b.band), sub: `${b.shareDays}% of days`, days: b.days, up60: b.up60, up60d: +(b.up60 - band.base.up60).toFixed(1), mdd60Bad: b.mdd60Bad }));
const bb = (name) => band.bands.find((b) => b.band === name);
const dmin = Math.min(...c3groups.map((g) => g.up60d)), dmax = Math.max(...c3groups.map((g) => g.up60d));
const c3 = {
  id: "pullbacks-spy-200day-band", theme: "pullbacks",
  question: "How far below its 200-day does SPY have to be before “deep below” becomes a problem?",
  answer: `More than 10% below (${bb("more than 10% below").shareDays}% of SPY's days) is where the wide outcomes live: up 60 sessions later ${pct(bb("more than 10% below").up60)} of the time (any day ${pct(band.base.up60)}) with a middle result of ${signed(bb("more than 10% below").med60)}, but ${pct(bb("more than 10% below").mdd60Bad)} of those days saw a close 10% lower inside the 60 sessions. Days 2–5% above the line: up ${pct(bb("2–5% above").up60)}, and only ${pct(bb("2–5% above").mdd60Bad)} saw a 10% drop.`,
  uncertainty: `Days cluster: the ${bb("more than 10% below").days} days more than 10% below come from a handful of bear markets (2008–09, 2020, 2022), so the shares are those episodes, not ${bb("more than 10% below").days} independent draws. No range is published per band. Slope of the 200-day and the 50/200 order are not yet a second dimension (S9 C3).`,
  sample: { instrument: "SPY", from: band.from, to: band.to, days: band.days, episodes: band.bands.length, unit: "days · bands" },
  method: { horizon: { kind: "sessions", text: "a fixed 60 sessions, and a fixed 10% drop inside them" }, cutoffs: { kind: "fixed", text: "fixed distance bands (0–2, 2–5, 5–10, >10% from the 200-day)" } },
  study: "S9", review: { by: "S9 breaking-point table (first close below the 200-day, then 1..15% below) tells the same story from the other side (inside the study)", status: "reviewed", level: "in-study" },
  chart: { kind: "twoPanel", args: { title: "SPY by its distance from the 200-day: up after 60 sessions vs any day, and how often a 10% drop followed", subtitle: `close ÷ 200-day SMA − 1 · every day 2004–2026 · top: share up after 60 sessions MINUS any day's ${pct(band.base.up60)}, in points (green above, red below) · bottom: the drop share, in the down colour`, groups: c3groups, panels: [{ key: "up60d", label: `up 60 sessions later, points vs any day (${pct(band.base.up60)})`, mode: "sign", unit: "pts", yMin: Math.floor(dmin / 5) * 5, yMax: Math.max(5, Math.ceil(dmax / 5) * 5), valueFmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1), tip: (g) => `${g.label}: up 60 sessions later ${pct(g.up60)} vs any day ${pct(band.base.up60)} (${g.up60d > 0 ? "+" : ""}${g.up60d.toFixed(1)} points) · ${thousands(g.days)} days` }, { key: "mdd60Bad", label: "a close 10% lower within 60 sessions", mode: "down", yMax: 50 }] } },
};

/* 4 · rsi: a stock's own RSI percentile, pooled over the stocks — dots with S8's month-clustered ranges */
const c4rows = stocksAny.rows.map((r) => { const f = L.names.fwd[`rsi<=${r.T}|all|20`]; return { T: r.T, win: r.x.win, n: r.x.n, ci: f?.ep?.ci || f?.ci || null, p95: f?.shuffle?.p95 }; });
const s5 = c4rows.find((r) => r.T === 5), s30 = c4rows.find((r) => r.T === 30), anyStock = stocksAny.any.win;
const c4cross = c4rows.filter((r) => rangeVerdict(r.ci?.[0], r.ci?.[1], anyStock) === "crosses").length;
const c4 = {
  id: "rsi-stock-own-percentile-vs-any-day", theme: "rsi",
  question: "Does a stock's own low RSI beat any day, and how far down its own ladder does the edge last?",
  answer: `A stock's RSI in the bottom 5% of its own 3-year history was up 20 sessions later ${pct(s5.win)} of ${thousands(s5.n)} times, against ${pct(anyStock)} for any day: a ${(s5.win - anyStock).toFixed(1)}-point gap whose 95% range (${rng(s5.ci)}) reaches ${s5.ci[0] < anyStock ? "just below" : "down to"} the any-day line. It shrinks step by step and is gone by the bottom 30% (${pct(s30.win)}). ${c4cross} of the ${c4rows.length} steps have a range that crosses the line. At the bottom 5% the stock beat SPY over the same days only ${pct(L.names.fwd["rsi<=5|all|20"].ep.vs_spy.beat)} of the time: it mostly rode the tide.`,
  uncertainty: `Episodes fire together in sell-offs (many names on the same days), so the month-clustered range is the one that counts: ${rng(s5.ci)} at the bottom 5%, touching the any-day ${pct(anyStock)}. Random same-size draws of days reach ${pct(s5.p95)} 1 time in 20 (S8 shuffle), which ${pct(s5.win)} beats; the two checks disagree, so this is not settled. Pooled over ${S8.stocks.count} names, unweighted by size or era.`,
  sample: { instrument: `${S8.stocks.count} stocks`, from: "2004", to: DATA_TO, days: stocksAny.any.n, episodes: s5.n, unit: "stock-days · episodes at bottom 5%" },
  method: { horizon: { kind: "sessions", text: "up after a fixed 20 sessions" }, cutoffs: { kind: "fixed", text: "fixed steps of the own-RSI percentile (bottom 5, 10, … 70%)" } },
  study: "S8", review: { by: "S8 lane: month-clustered 95% ranges and a 200-draw shuffle on the pooled stock rows, both drawn or quoted here (inside the study)", status: "reviewed", level: "in-study" },
  chart: { kind: "range", args: { title: `${S8.stocks.count} stocks: up 20 sessions after the stock's own RSI reached its bottom X%, with 95% ranges`, subtitle: "own 3-year percentile · pooled episodes · dot = share up · line = S8's month-clustered 95% range · green/red = dot above/below the any-day line · hollow = range crosses it", groups: c4rows.map((r) => ({ label: `≤${r.T}%`, sub: thousands(r.n), marks: [{ value: r.win, lo: r.ci?.[0], hi: r.ci?.[1], n: r.n, ref: anyStock, tip: `own RSI at or below its ${r.T}th percentile: up after 20 in ${pct(r.win)} of ${thousands(r.n)} episodes · 95% range ${rng(r.ci)} · any day ${pct(anyStock)}` }] })), series: [], refs: [{ value: anyStock, label: `any day ${pct(anyStock)}` }], yMin: 50, yMax: 65 } },
};

/* 5 · fear: every SPY decline, how deep it went against the VIX on the day of its low — one dot per decline */
const vixRecs = (t) => S9.instruments[t].all.filter((d) => d.vixLow != null);
const rho = Object.fromEntries(INST.map((t) => [t, spearman(vixRecs(t).map((d) => -d.depth), vixRecs(t).map((d) => d.vixLow))]));
const spyV = vixRecs("SPY"), vSorted = spyV.map((d) => d.vixLow).sort((a, b) => a - b);
const vq = (q) => quart(vSorted, q);
const midFifth = spyV.filter((d) => d.vixLow >= vq(0.4) && d.vixLow <= vq(0.6)).map((d) => -d.depth);
const c5 = {
  id: "fear-vix-at-spy-swing-lows", theme: "fear",
  question: "How high was the VIX at SPY's swing lows, against how far SPY had fallen?",
  answer: `Deeper declines ended with a higher VIX: the rank correlation between how far SPY fell and the VIX on the day of the low is ${rho.SPY.toFixed(2)} over ${spyV.length} declines since 2003 (QQQ ${rho.QQQ.toFixed(2)}, IWM ${rho.IWM.toFixed(2)}). The middle VIX at a SPY low was ${vq(0.5).toFixed(1)}. But the spread is wide: the ${midFifth.length} declines whose VIX at the low sat in the middle fifth of SPY's own lows (${vq(0.4).toFixed(1)}–${vq(0.6).toFixed(1)}) ranged from ${Math.min(...midFifth).toFixed(1)}% to ${Math.max(...midFifth).toFixed(1)}% deep.`,
  uncertainty: `The VIX on the day of the low is known only once the low is confirmed (10 bars later), so this is a description of past lows, not a level that calls one. The four deepest declines carry the top-right of the chart on their own. VIX 3-month, put/call and Fear & Greed are not on this card yet (S9 D1–D3; the market-regime lane, 28 Sep, in flight).`,
  sample: { instrument: "SPY swing lows · VIX", from: "2003-09-11", to: DATA_TO, days: 5797, episodes: spyV.length, unit: "bars · declines" },
  method: { horizon: { kind: "pivot", text: "the swing low itself (10/10 pivots)" }, cutoffs: { kind: "full", text: "every decline drawn, no depth buckets" } },
  study: "S9", review: { by: `S9's depth tables for QQQ and IWM order the same way (QQQ's 6 shallowest dips excepted); the rank correlation on QQQ and IWM is computed the same way (inside the study)`, status: "reviewed", level: "in-study" },
  chart: { kind: "curve", args: { title: "Every SPY decline since 2003: how far it fell, and the VIX on the day of its low", subtitle: "one dot per decline between 10/10 pivots · the VIX is a fear measure, so it is drawn in the down colour; brighter = higher", xLabel: "depth of the decline (swing high to swing low)", xMax: Math.ceil(Math.max(...spyV.map((d) => -d.depth)) / 5) * 5, yMin: 0, yMax: Math.ceil(Math.max(...spyV.map((d) => d.vixLow)) / 10) * 10, yUnit: "", line: false, mode: "down", series: [{ label: "SPY declines", points: spyV.map((d) => ({ x: -d.depth, y: d.vixLow, n: 1, mode: "down", opacity: 0.35 + 0.6 * Math.min(1, d.vixLow / 70), tip: `${d.hi} → ${d.lo}: fell ${(-d.depth).toFixed(1)}% · VIX at the low ${d.vixLow.toFixed(1)}${d.newHigh === true ? " · next swing made a new high" : d.newHigh === false ? " · next swing did not make a new high" : ""}` })) }] } },
};

/* 6 · execution: the best combination — picked on BOTH halves, so neither half is a check */
const comboL = L.combos.chosen[0], combo = S8.combos[0], tested = L.combos.tested;
const discR = wilson(comboL.disc.win, comboL.disc.n);
const c6 = {
  id: "execution-best-combo-both-halves", theme: "execution",
  question: "What did the best-scoring entry combination do, and has it been tested on data it was not chosen on?",
  answer: `It has not. This is the best of ${thousands(tested)} combinations, chosen on the weaker of its two halves: ${combo.cond}, while ${combo.state}. Up 20 sessions later ${pct(comboL.disc.win)} of ${comboL.disc.n} trades in 2004–2016 and ${pct(comboL.conf.win)} of ${comboL.conf.n} in 2017–2026, against ${pct(L.combos.base_halves.disc.win)} and ${pct(L.combos.base_halves.conf.win)} for any day. Both halves were used to pick it, so neither half is a check, and no untouched period was held back. ${comboL.disc.n + comboL.conf.n} trades in ${comboL.disc.months + comboL.conf.months} entry months: a rare setup.`,
  uncertainty: `Picking the best of ${thousands(tested)} on both halves lifts both halves' numbers by an unknown amount (the winner's curse). The 95% range on all ${comboL.full.n} trades (${rng(comboL.ci)}) and the shuffle (random days in the same market state reach ${pct(comboL.shuffle.p95)} 1 time in 20) do not correct for that choice. A fair test: choose on 2004–2016 only and report 2017–2026 untouched. Price only, no costs.`,
  sample: { instrument: `${S8.stocks.count} stocks`, from: "2004", to: DATA_TO, days: L.combos.base_halves.disc.n + L.combos.base_halves.conf.n, episodes: comboL.disc.n + comboL.conf.n, unit: "any-day entries (both halves) · trades" },
  method: { horizon: { kind: "sessions", text: "up after a fixed 20 sessions" }, cutoffs: { kind: "fixed", text: "fixed cut-offs: stock RSI bottom 20%, top 10% extension above the 200-day, SPY RSI bottom 30%" } },
  study: "S8", review: { by: "none — the half-and-half split was part of how it was chosen, so it is not a review; no hold-out test exists", status: "unreviewed", level: "none" },
  chart: { kind: "range", args: { title: `The best of ${thousands(tested)} combinations, picked using both halves — not a hold-out test`, subtitle: "stock RSI bottom 20% + top-10% extension above its 200-day + SPY RSI bottom 30% · dot = share up after 20 sessions · line = 95% range (2004–2016: plain count range, not month-clustered; 2017–2026: S8's)", groups: [{ label: "2004–2016", sub: `${comboL.disc.n} trades`, marks: [{ value: comboL.disc.win, lo: discR[0], hi: discR[1], n: comboL.disc.n, ref: L.combos.base_halves.disc.win, tip: `2004–2016: up after 20 in ${pct(comboL.disc.win)} of ${comboL.disc.n} · plain 95% range ${rng(discR)} · any day ${pct(L.combos.base_halves.disc.win)} · used to pick it` }] }, { label: "2017–2026", sub: `${comboL.conf.n} trades`, marks: [{ value: comboL.conf.win, lo: comboL.ci_conf[0], hi: comboL.ci_conf[1], n: comboL.conf.n, ref: L.combos.base_halves.conf.win, tip: `2017–2026: up after 20 in ${pct(comboL.conf.win)} of ${comboL.conf.n} · 95% range ${rng(comboL.ci_conf)} · any day ${pct(L.combos.base_halves.conf.win)} · also used to pick it` }] }], series: [], refs: [{ value: L.combos.base_halves.disc.win, label: `any day ${pct(L.combos.base_halves.disc.win)} (2004–2016) · ${pct(L.combos.base_halves.conf.win)} (2017–2026)` }], yMin: 40, yMax: 85 } },
};

const CARDS = [c1, c2, c3, c4, c5, c6];



/* Lanes measuring today: named as candidates, never rendered as findings. */
const CANDIDATES = [
  { lane: "rsi-full-history", theme: "rsi", what: "RSI(14) on the full history: S&P to 1928, Nasdaq, VIX, oil, gold and the rest; percentile tables 1..100, zone visits, divergence", state: "measured 28 Sep · review pending" },
  { lane: "market-regime", theme: "fear", what: "equal vs cap weight, VIX ÷ VIX3M, credit stress, dollar and 10-year, seasonality, the Fed", state: "measured 28 Sep · review pending" },
  { lane: "rsi-ladder", theme: "rsi", what: "the percentile → RSI value ladder per instrument, own history, 1..100", state: "in flight" },
  { lane: "bottoms", theme: "pullbacks", what: "what recurs around bottoms: VIX reversal, breadth, the first higher low", state: "in flight" },
  { lane: "leaders", theme: "leaders", what: "share of market returns carried by the leaders, and what they had in common before the quarter's winners were known (S9 E1)", state: "in flight" },
  { lane: "scout", theme: "execution", what: "the cheap third tier: every US stock screened nightly from bulk data (IWM scout, fund valuation)", state: "design + prototype 28 Sep · not a statistics finding" },
];

/* ── render ───────────────────────────────────────────────────────────────────────────────────────────── */
const draw = (card, compact) => {
  const a = { ...card.chart.args, id: card.id + (compact ? "-390" : "-1200"), compact, footer: `${card.study} · ${STUDIES[card.study].date} · ${card.sample.instrument} · ${card.sample.from} → ${card.sample.to} · built ${BUILT} · ${card.id}` };
  if (card.chart.kind === "range") return rangeChart(a);
  if (card.chart.kind === "curve") return curveChart(a);
  if (card.chart.kind === "twoPanel") return twoPanelChart(a);
  return barsChart(a);
};
mkdirSync(join(HERE, "charts"), { recursive: true });
const REQUIRED = ["id", "theme", "question", "answer", "uncertainty", "sample", "method", "study", "review", "chart"];
const manifest = { built: BUILT, dataTo: DATA_TO, stamp: STAMP, rules: REQUIRED, entry: ENTRY, themes: THEMES, studies: STUDIES, cards: [], heldBack: [], candidates: CANDIDATES };
const inline = {};
for (const c of CARDS) {
  for (const k of REQUIRED) if (c[k] == null) throw new Error(`card ${c.id} lacks ${k}`);
  if (!THEMES.some((t) => t.id === c.theme)) throw new Error(`card ${c.id}: unknown theme ${c.theme}`);
  const files = {};
  for (const compact of [false, true]) {
    const svg = draw(c, compact), name = `${STAMP}-${c.id}-${compact ? 390 : 1200}.svg`;
    writeFileSync(join(HERE, "charts", name), svg);
    files[compact ? "phone" : "desk"] = "charts/" + name;
    inline[c.id + (compact ? ":p" : ":d")] = svg;
  }
  const { chart, ...rest } = c, faults = entryFaults(c);
  const entry = { ...rest, chart: { kind: chart.kind, files, title: chart.args.title } };
  if (faults.length) manifest.heldBack.push({ ...entry, heldBecause: faults }); else manifest.cards.push(entry);
}
if (manifest.cards.length > 12) throw new Error("at most twelve cards on the tab");
writeFileSync(join(HERE, "findings.json"), JSON.stringify(manifest, null, 2));

/* ── the page ─────────────────────────────────────────────────────────────────────────────────────────── */
const themeCards = (t) => manifest.cards.filter((c) => c.theme === t.id);
const themeHeld = (t) => manifest.heldBack.filter((c) => c.theme === t.id);
const cardHTML = (c) => `
<article class="card${c.heldBecause ? " held" : ""}" id="${esc(c.id)}" data-theme="${esc(c.theme)}">
  ${c.heldBecause ? `<p class="hold"><b>Held back from the tab:</b> ${c.heldBecause.map(esc).join(" · ")}</p>` : ""}
  <h3 class="q">${esc(c.question)}</h3>
  <div class="viz">
    <div class="desk">${inline[c.id + ":d"]}</div>
    <div class="phone">${inline[c.id + ":p"]}</div>
    <div class="readout" aria-live="polite">hover or tap a mark for its count and range</div>
  </div>
  <p class="a">${esc(c.answer)}</p>
  <p class="u"><b>How sure:</b> ${esc(c.uncertainty)}</p>
  <dl class="meta">
    <div><dt>Sample</dt><dd>${esc(c.sample.instrument)} · ${esc(c.sample.from)} → ${esc(c.sample.to)} · ${thousands(c.sample.days)} · ${thousands(c.sample.episodes)} (${esc(c.sample.unit)})</dd></div>
    <div><dt>Study</dt><dd><a href="${esc(STUDIES[c.study].page)}">${esc(c.study)} · ${esc(STUDIES[c.study].title)}</a> · <a href="${esc(STUDIES[c.study].json)}">the numbers</a></dd></div>
    <div><dt>Review</dt><dd>${esc(c.review.by)}</dd></div>
    <div><dt>Method</dt><dd>${esc(c.method.horizon.text)} · ${esc(c.method.cutoffs.text)}</dd></div>
    <div><dt>Chart file</dt><dd><a href="${esc(c.chart.files.desk)}" download>${esc(c.chart.files.desk.replace("charts/", ""))}</a> · <a href="${esc(c.chart.files.phone)}" download>phone</a></dd></div>
  </dl>
</article>`;
const candHTML = (t) => CANDIDATES.filter((x) => x.theme === t.id).map((x) => `<li><b>${esc(x.lane)}</b> — ${esc(x.what)} <span class="st">${esc(x.state)}</span></li>`).join("");
const themeHTML = (t) => {
  const cs = themeCards(t), cand = candHTML(t), held = themeHeld(t);
  return `
<section class="theme" id="t-${esc(t.id)}">
  <header><h2>${esc(t.title)}</h2><p class="why">${esc(t.why)}</p></header>
  ${cs.map(cardHTML).join("") || `<div class="empty">No finding has passed the entry rules under this theme yet. Nothing is drawn here until one does.</div>`}
  ${held.length ? `<p class="heldline">Held back under this theme: ${held.map((c) => `<a href="#${esc(c.id)}">${esc(c.question)}</a>`).join(" · ")} (shown below the tab, with the reason)</p>` : ""}
  ${cand ? `<div class="cand"><h4>Measuring now · not on the tab until reviewed</h4><ul>${cand}</ul></div>` : ""}
</section>`;
};

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statistics · findings</title>
<meta name="description" content="The curated Statistics tab: a small fixed set of findings cards, one question, one saved chart, one plain sentence each, from reviewed studies only.">
<style>
:root{--bg:${PAL.bg};--panel:${PAL.panel};--hair:${PAL.hair};--ink:${PAL.ink};--muted:${PAL.muted};--faint:${PAL.faint};--up:${PAL.up};--dn:${PAL.dn};color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--faint);text-underline-offset:3px}
a:hover{text-decoration-color:var(--ink)}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
h1{font-size:30px;line-height:1.15;margin:8px 0 6px;color:#C8C8D2;font-weight:700}
.sub{font:12px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted);letter-spacing:.04em}
.strip{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 8px}
.strip a{font:600 11px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--muted);border:1px solid var(--hair);border-radius:3px;padding:9px 11px}
.strip a:hover{color:var(--ink);border-color:var(--muted)}
.strip a b{color:var(--ink);font-weight:700}
.status{border-left:3px solid var(--muted);background:var(--panel);padding:12px 16px;margin:14px 0 26px;font-size:15px;max-width:1120px}
.theme{margin:34px 0 0;padding-top:18px;border-top:1px solid var(--hair)}
.theme header h2{font-size:22px;margin:0 0 4px;color:#C8C8D2}
.why{margin:0 0 14px;color:var(--muted);font-size:14px;max-width:1120px}
.card{background:var(--panel);border:1px solid var(--hair);border-radius:6px;padding:18px 20px 12px;margin:0 0 18px}
.q{font-size:19px;line-height:1.3;margin:0 0 12px;color:#C8C8D2}
.viz svg{display:block;width:100%;height:auto;border-radius:4px}
.viz .phone{display:none}
.readout{font:12px/1.4 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:var(--muted);padding:6px 2px 0;min-height:22px}
.a{font-size:16px;margin:10px 0 6px;max-width:1120px}
.u{font-size:13.5px;color:var(--muted);margin:0 0 10px;max-width:1120px}
.u b{color:var(--ink);font-weight:600}
.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 22px;margin:0;padding-top:10px;border-top:1px solid var(--hair);font-size:12.5px}
.meta div{display:flex;gap:10px;min-width:0}
.meta dt{flex:0 0 70px;color:var(--faint);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding-top:2px}
.meta dd{margin:0;color:var(--muted);overflow-wrap:anywhere}
.empty{border:1px dashed var(--hair);border-radius:6px;padding:16px 18px;color:var(--muted);font-size:14px}
.heldline{font-size:13px;color:var(--muted);margin:8px 0 0}
.hold{margin:0 0 10px;padding:8px 12px;border-left:3px solid var(--dn);background:var(--bg);font-size:13.5px;color:var(--ink)}
.card.held{border-style:dashed}
details.heldback{margin:40px 0 0;padding-top:18px;border-top:1px solid var(--hair)}
details.heldback summary{cursor:pointer;font-size:18px;color:#C8C8D2;font-weight:700;margin-bottom:10px}
details.heldback .why{margin-top:6px}
.cand{margin:4px 0 0;padding:10px 0 0}
.cand h4{margin:0 0 6px;font:600 11px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.cand ul{margin:0;padding-left:18px;color:var(--muted);font-size:13px}
.cand li{margin:2px 0}
.cand .st{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11px;color:var(--faint);margin-left:6px}
.rules{margin:40px 0 0;padding-top:18px;border-top:1px solid var(--hair);color:var(--muted);font-size:14px;max-width:1120px}
.rules h2{font-size:18px;color:#C8C8D2;margin:0 0 8px}
.rules ul{padding-left:20px;margin:6px 0}
@media (max-width:760px){
  body{padding:20px 16px 60px;font-size:15px}
  h1{font-size:24px}
  .card{padding:14px 12px 10px}
  .q{font-size:17px}
  .viz .desk{display:none}.viz .phone{display:block}
  .meta{grid-template-columns:1fr}
  .meta dt{flex-basis:64px}
}
</style></head>
<body>
<div data-scnav-slot></div>
<h1>Statistics · findings</h1>
<p class="sub">${manifest.cards.length} findings on the tab · ${manifest.heldBack.length} held back · from ${Object.keys(STUDIES).length} studies (S8, S9 · 27 Sep 2026) · data to ${DATA_TO} · built ${BUILT} · research questions, not buy rules · nothing here predicts</p>
<nav class="strip" aria-label="Themes">${THEMES.map((t) => `<a href="#t-${t.id}">${esc(t.title.split(" · ")[0])} <b>${themeCards(t).length || "–"}</b></a>`).join("")}<a href="STATS-TAB.html">the rules of this tab →</a></nav>
<div class="status"><b>What this tab is.</b> One card per question. Each card carries one chart that is also saved as a file next to this page, one plain sentence with the numbers, how sure the number is, the sample and the dates, the study it came from and who reviewed it. A study that has not been reviewed shows up only as a name under “measuring now”. A card measured over a fixed window (“up after 20 sessions”) or a forced cut-off (“the bottom 10%”) is held back below the tab until it is re-measured on pivots and full percentiles. Green is up or better than any day; red is down or worse. A dot is hollow when its 95% range crosses its any-day line. A fear measure is drawn in red.</div>
${THEMES.map(themeHTML).join("")}
<details class="heldback" id="held-back"><summary>Held back from the tab · ${manifest.heldBack.length} cards</summary>
<p class="why">These are fixed and drawn honestly, but they fail an entry rule: a fixed window of sessions, a forced cut-off, or no review. Each says which. They stay here as the record of what the window studies showed, until a pivot and percentile 1..100 re-measure replaces them.</p>
${manifest.heldBack.map(cardHTML).join("")}
</details>
<div class="rules"><h2>What may enter, and what never does</h2>
<ul>
<li>A card needs all of: a stated question · a measured answer with its uncertainty · a saved chart (both sizes) · the sample and date range · its method (horizon and cut) · a link to the study and its numbers · a named review. Missing one, the build refuses it.</li>
<li>To be on the tab (not held back): ${ENTRY.map(esc).join(" · ")}.</li>
<li>Never: a raw table dump, a study nobody has reviewed, a number without a chart, a chart without a date, a grey line, a bar that starts above zero, a buy rule, a fixed window, a forced cut-off.</li>
<li>At most twelve cards on the tab. A new card that answers an old question replaces it; the old chart stays in the study's folder.</li>
</ul>
<p>The full rules, the visual standard and the Hub proposal: <a href="STATS-TAB.html">STATS-TAB.html</a>. The manifest: <a href="findings.json">findings.json</a>. The drawing code: <a href="charts.mjs">charts.mjs</a>.</p></div>
<script>
/* hover readout: the mark's <title> already gives a native tooltip; this repeats it in text under the chart so the
   phone (no hover) can tap a bar and read it. */
/* a link to a held-back card (or to #held-back) opens the fold it sits in */
function openHeld() { var h = location.hash && document.getElementById(location.hash.slice(1)); var d = h && (h.tagName === "DETAILS" ? h : h.closest("details")); if (d) { d.open = true; h.scrollIntoView(); } }
window.addEventListener("hashchange", openHeld); openHeld();
document.querySelectorAll(".card").forEach(function (card) {
  var out = card.querySelector(".readout");
  card.querySelectorAll(".mark").forEach(function (m) {
    var show = function () { out.textContent = m.getAttribute("data-tip"); };
    m.addEventListener("mouseenter", show); m.addEventListener("click", show); m.addEventListener("touchstart", show, { passive: true });
  });
});
</script>
</body></html>
`;
/* the BACK / CLOSE pair, from the one shared snippet, placed exactly as scripts/inject-scnav.py places it — so a rebuild
   never strips it */
const SCNAV = readFileSync(join(ROOT, "scripts", "scnav-snippet.html"), "utf8").trim();
writeFileSync(join(HERE, "index.html"), page.replace("</body>", SCNAV + "\n</body>"));
console.log(`built ${manifest.cards.length} cards, ${manifest.cards.length * 2} chart files, index.html, findings.json`);
