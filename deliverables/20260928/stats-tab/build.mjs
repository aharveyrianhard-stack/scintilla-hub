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
import { stepsChart, twoPanelChart, barsChart, pct, signed, thousands, esc, PAL } from "./charts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const S8 = JSON.parse(readFileSync(join(ROOT, "research/statistics/data/s8-summary.json"), "utf8"));
const S9 = JSON.parse(readFileSync(join(ROOT, "research/statistics/data/s9-research.json"), "utf8"));
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

/* ── the six cards, every number from the two JSON files ─────────────────────────────────────────────── */
const spy8 = S8.funds.SPY, spy9 = S9.instruments.SPY, band = S9.band.SPY.full;
const rows = (T) => spy8.rows.find((r) => r.T === T);
const stocksAny = S8.stocks.states[0];

/* 1 · market: SPY low RSI above vs below the 200-day */
const c1steps = [5, 10, 15, 20, 25, 30].map((T) => { const r = rows(T); return { label: `bottom ${T}%`, short: `≤${T}%`, values: [r.on.win, r.off.win], n: [r.on.n, r.off.n] }; });
const r10 = rows(10);
const c1 = {
  id: "market-spy-low-rsi-vs-200day", theme: "market",
  question: "Does a low SPY RSI mean more when SPY is above its 200-day than below it?",
  answer: `Yes, on the record so far. SPY's RSI in its bottom 10% while SPY was above its 200-day was up 20 sessions later ${pct(r10.on.win)} of ${r10.on.n} times (any uptrend day ${pct(spy8.any.on.win)}). The same reading below the 200-day: ${pct(r10.off.win)} of ${r10.off.n}, a coin flip against ${pct(spy8.any.off.win)} for any downtrend day.`,
  uncertainty: `The bottom-10% share over all days is ${pct(r10.all.win)} with a 95% range of ${rng(r10.ci)} (months resampled), and ${pct(r10.on.win)} is right at the level random uptrend days reach 1 time in 20 (S8), so read it as suggestive, not settled. The RSI full-history lane (28 Sep, in flight) is re-measuring this zone with a 90% range; if it disagrees, this card changes.`,
  sample: { instrument: "SPY", from: spy8.from, to: DATA_TO, days: spy8.any.all.n, episodes: r10.all.n, unit: "days · episodes at bottom 10%" },
  study: "S8", review: { by: "S9 research program, 27 Sep (restated the reading, added the 3%-above check: 84.2% of 57)", status: "reviewed" },
  chart: { kind: "steps", args: { title: "SPY: up 20 sessions after its RSI reached its bottom X% — above vs below the 200-day", subtitle: `share of episodes up after 20 sessions · own 3-year RSI percentile · green = above that state's any-day line, red = below`, steps: c1steps, series: [{ label: "SPY above its 200-day" }, { label: "SPY below its 200-day" }], refs: [{ value: spy8.any.on.win, label: `any uptrend day ${pct(spy8.any.on.win)}` }, { value: spy8.any.off.win, label: `any downtrend day ${pct(spy8.any.off.win)}` }], yMin: 40, yMax: 90 } },
};

/* 2 · pullbacks: depth of the decline → the rebound made a new high */
const allRebounds = spy9.all.filter((d) => typeof d.newHigh === "boolean");
const newHighAll = (100 * allRebounds.filter((d) => d.newHigh).length) / allRebounds.length;
const c2groups = spy9.depthTable.map((b) => ({ label: b.bucket, sub: `${b.n} declines`, bars: [{ value: b.newHigh, n: b.n, tip: `${b.bucket}: ${pct(b.newHigh)} of ${b.n} rebounds made a new high · 95% range ${rng(wilson(b.newHigh, b.n))}` }] }));
const dt = (bucket) => spy9.depthTable.find((b) => b.bucket === bucket);
const c2 = {
  id: "pullbacks-spy-depth-to-new-high", theme: "pullbacks",
  question: "When SPY pulls back, does the depth of the decline tell whether the next swing makes a new high?",
  answer: `It does, sharply. Declines of 3–5% (${dt("3–5%").n} since 2003): ${pct(dt("3–5%").newHigh)} of the rebounds made a new high. 5–10% (${dt("5–10%").n}): ${pct(dt("5–10%").newHigh)}. 10–20% (${dt("10–20%").n}): ${pct(dt("10–20%").newHigh)}. Across all ${allRebounds.length} declines: ${pct(newHighAll)}. That is the “selling too early” question in numbers: on a 3–5% pullback the next swing usually makes a new high; on a 10%+ decline it usually does not.`,
  uncertainty: `Counts are small in the deep buckets: 10–20% has ${dt("10–20%").n} declines (95% range ${rng(wilson(dt("10–20%").newHigh, dt("10–20%").n))}) and 20%+ has ${dt("20%+").n}, which is a list, not a rate. Swings are 10/10 pivots, known only 10 bars later.`,
  sample: { instrument: "SPY", from: "2003-09-11", to: DATA_TO, days: 5797, episodes: allRebounds.length, unit: "bars · declines (pivot to pivot)" },
  study: "S9", review: { by: "S9 lane's own sensitivity rows (pivot windows 5 and 20: the counts change, the big declines do not)", status: "reviewed" },
  chart: { kind: "bars", args: { title: "SPY: share of rebounds that made a new high, by depth of the decline", subtitle: "every decline since 2003 between 10/10 pivots · green = above the all-declines share, red = below", groups: c2groups, ref: { value: newHighAll, label: `all declines ${pct(newHighAll)}` }, yMax: 100 } },
};

/* 3 · pullbacks: the 200-day band */
const shortBand = (b) => (b.includes("more than") ? (b.includes("below") ? "−10%+" : "+10%+") : (b.includes("below") ? "−" : "+") + b.replace(/ (below|above)/, ""));
const c3groups = band.bands.map((b) => ({ label: b.band.replace("more than ", ">"), short: shortBand(b.band), sub: `${b.shareDays}% of days`, days: b.days, up60: b.up60, mdd60Bad: b.mdd60Bad }));
const bb = (name) => band.bands.find((b) => b.band === name);
const c3 = {
  id: "pullbacks-spy-200day-band", theme: "pullbacks",
  question: "How far below its 200-day does SPY have to be before “deep below” becomes a problem?",
  answer: `More than 10% below (${bb("more than 10% below").shareDays}% of SPY's days) is where the wide outcomes live: up 60 sessions later ${pct(bb("more than 10% below").up60)} of the time (any day ${pct(band.base.up60)}) with a middle result of ${signed(bb("more than 10% below").med60)}, but ${pct(bb("more than 10% below").mdd60Bad)} of those days saw a close 10% lower inside the 60 sessions. Days 2–5% above the line: up ${pct(bb("2–5% above").up60)}, and only ${pct(bb("2–5% above").mdd60Bad)} saw a 10% drop.`,
  uncertainty: `Days cluster: the ${bb("more than 10% below").days} days more than 10% below come from a handful of bear markets (2008–09, 2020, 2022), so the shares are those episodes, not ${bb("more than 10% below").days} independent draws. Slope of the 200-day and the 50/200 order are not yet a second dimension (S9 C3).`,
  sample: { instrument: "SPY", from: band.from, to: band.to, days: band.days, episodes: band.bands.length, unit: "days · bands" },
  study: "S9", review: { by: "S9 breaking-point table (first close below / 5% / 10% below) tells the same story from the other side", status: "reviewed" },
  chart: { kind: "twoPanel", args: { title: "SPY by its distance from the 200-day: up after 60 sessions, and how often a 10% drop followed", subtitle: "close ÷ 200-day SMA − 1 · every day 2004–2026 · green = above the any-day line, red = below; the drop share is drawn in the down colour", groups: c3groups, panels: [{ key: "up60", label: "up 60 sessions later", mode: "vsRef", ref: { value: band.base.up60, label: `any day ${pct(band.base.up60)}` }, yMax: 100, yMin: 40 }, { key: "mdd60Bad", label: "a close 10% lower within 60 sessions", mode: "down", yMax: 50 }] } },
};

/* 4 · rsi: a stock's own RSI percentile, pooled over 313 stocks */
const c4groups = stocksAny.rows.map((r) => ({ label: `≤${r.T}%`, sub: thousands(r.x.n), bars: [{ value: r.x.win, n: r.x.n, tip: `own RSI at or below its ${r.T}th percentile: up after 20 in ${pct(r.x.win)} of ${thousands(r.x.n)} episodes (any day ${pct(stocksAny.any.win)})` }] }));
const s5 = stocksAny.rows.find((r) => r.T === 5), s30 = stocksAny.rows.find((r) => r.T === 30);
const c4 = {
  id: "rsi-stock-own-percentile-vs-any-day", theme: "rsi",
  question: "Does a stock's own low RSI beat any day, and how far down its own ladder does the edge last?",
  answer: `A stock's RSI in the bottom 5% of its own 3-year history was up 20 sessions later ${pct(s5.x.win)} of ${thousands(s5.x.n)} times, against ${pct(stocksAny.any.win)} for any day. The edge shrinks step by step and is gone by the bottom 30% (${pct(s30.x.win)}). S8 adds that at the bottom 5% the stock beat SPY over the same days only 51.6% of the time: it mostly rode the tide.`,
  uncertainty: `Episodes fire together in sell-offs (many names on the same days), so the effective sample is far smaller than the count; S8's month-clustered ranges for the fund rows are 8–20 points wide. Pooled over 313 names, unweighted by size or era.`,
  sample: { instrument: `${S8.stocks.count} stocks`, from: "2004", to: DATA_TO, days: stocksAny.any.n, episodes: s5.x.n, unit: "stock-days · episodes at bottom 5%" },
  study: "S8", review: { by: "S8 lane: month-clustered 95% ranges and a 200-draw shuffle on every fund row; the pooled stock rows carry the same method", status: "reviewed" },
  chart: { kind: "bars", args: { title: "313 stocks: up 20 sessions after the stock's own RSI reached its bottom X%", subtitle: "own 3-year percentile · pooled episodes · green = above the any-day line, red = below", groups: c4groups, ref: { value: stocksAny.any.win, label: `any day ${pct(stocksAny.any.win)}` }, yMin: 50, yMax: 65 } },
};

/* 5 · fear: VIX at the SPY swing low by depth (median and quartiles from the per-decline records) */
const bucketOf = (d) => { const x = -d.depth; return x < 3 ? "0–3%" : x < 5 ? "3–5%" : x < 10 ? "5–10%" : x < 20 ? "10–20%" : "20%+"; };
const c5groups = spy9.depthTable.map((b) => {
  const v = spy9.all.filter((d) => bucketOf(d) === b.bucket).map((d) => d.vixLow);
  return { label: b.bucket, sub: `${b.n} declines`, bars: [{ value: b.vixLowMed, n: b.n, mode: "down", opacity: 0.35 + 0.6 * Math.min(1, b.vixLowMed / 70), tip: `${b.bucket}: VIX at the low, middle ${b.vixLowMed} · quarter to three-quarter ${quart(v, 0.25)?.toFixed(1)}–${quart(v, 0.75)?.toFixed(1)} · ${b.n} declines` }] };
});
const c5 = {
  id: "fear-vix-at-spy-swing-lows", theme: "fear",
  question: "How high is the VIX at the low, given how far SPY has fallen so far?",
  answer: `The VIX at SPY's swing low rises with the depth: middle ${dt("0–3%").vixLowMed} on 0–3% dips, ${dt("3–5%").vixLowMed} on 3–5%, ${dt("5–10%").vixLowMed} on 5–10%, ${dt("10–20%").vixLowMed} on 10–20% and ${dt("20%+").vixLowMed} on the ${dt("20%+").n} declines of 20% or more. A VIX in the low 20s has marked the low of a 5–10% decline far more often than of a 10%+ one.`,
  uncertainty: `These are the VIX on the day of the low, not a level that calls the low in advance; the quarter-to-three-quarter ranges (in the hover) overlap between neighbouring buckets. VIX 3-month, put/call and Fear & Greed are not yet on this card (S9 D1–D3; the market-regime lane, 28 Sep, in flight).`,
  sample: { instrument: "SPY swing lows · VIX", from: "2003-09-11", to: DATA_TO, days: 5797, episodes: spy9.all.length, unit: "bars · declines" },
  study: "S9", review: { by: "S9 depth tables for QQQ and IWM show the same ordering", status: "reviewed" },
  chart: { kind: "bars", args: { title: "VIX at SPY's swing low, by how far SPY fell (middle of each bucket)", subtitle: "the VIX is a fear measure, so it is drawn in the down colour; darker = higher", groups: c5groups, mode: "down", yMax: 70, unit: "", valueFmt: (v) => v.toFixed(1) } },
};

/* 6 · execution: the best combination in both halves of history */
const combo = S8.combos[0];
const c6groups = [
  { label: "2004–2016", sub: `${combo.disc.n} trades`, bars: [{ value: combo.disc.win, n: combo.disc.n, ref: S8.base_halves.disc.win, tip: `2004–2016: up after 20 in ${pct(combo.disc.win)} of ${combo.disc.n} (any day ${pct(S8.base_halves.disc.win)})` }] },
  { label: "2017–2026", sub: `${combo.conf.n} trades`, bars: [{ value: combo.conf.win, n: combo.conf.n, ref: S8.base_halves.conf.win, tip: `2017–2026: up after 20 in ${pct(combo.conf.win)} of ${combo.conf.n} (any day ${pct(S8.base_halves.conf.win)})` }] },
];
const c6 = {
  id: "execution-best-combo-both-halves", theme: "execution",
  question: "Did the best entry combination hold in both halves of history, or was it found in one and fitted to the other?",
  answer: `It held. ${combo.cond}, while ${combo.state}: up 20 sessions later ${pct(combo.disc.win)} in 2004–2016 (found there) and ${pct(combo.conf.win)} in 2017–2026 (checked there), against ${pct(S8.base_halves.disc.win)} and ${pct(S8.base_halves.conf.win)} for any day. But only ${combo.disc.n + combo.conf.n} trades in 85 entry months: a rare setup, not a daily one.`,
  uncertainty: `${combo.disc.n + combo.conf.n} trades that mostly fired in the same sell-off months; a 95% range on ${combo.conf.n} trades is ${rng(wilson(combo.conf.win, combo.conf.n))}. Middle result ${signed(combo.disc.med)} and ${signed(combo.conf.med)}. Price only, no costs.`,
  sample: { instrument: `${S8.stocks.count} stocks`, from: "2004", to: DATA_TO, days: S8.base_halves.disc.n + S8.base_halves.conf.n, episodes: combo.disc.n + combo.conf.n, unit: "any-day entries (both halves) · trades" },
  study: "S8", review: { by: "S8 lane: the half-and-half split is the review (discovery half, confirmation half)", status: "reviewed" },
  chart: { kind: "bars", args: { title: "The best combination, found in 2004–2016 and checked in 2017–2026", subtitle: "stock RSI bottom 20% + close in the top 10% of its distance above its 200-day + SPY RSI bottom 30% · green = above that half's any-day line", groups: c6groups, ref: { value: S8.base_halves.disc.win, label: `any day ${pct(S8.base_halves.disc.win)} · ${pct(S8.base_halves.conf.win)}` }, yMin: 40, yMax: 80 } },
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
  if (card.chart.kind === "steps") return stepsChart(a);
  if (card.chart.kind === "twoPanel") return twoPanelChart(a);
  return barsChart(a);
};
mkdirSync(join(HERE, "charts"), { recursive: true });
const REQUIRED = ["id", "theme", "question", "answer", "uncertainty", "sample", "study", "review", "chart"];
const manifest = { built: BUILT, dataTo: DATA_TO, stamp: STAMP, rules: REQUIRED, themes: THEMES, studies: STUDIES, cards: [], candidates: CANDIDATES };
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
  const { chart, ...rest } = c;
  manifest.cards.push({ ...rest, chart: { kind: chart.kind, files, title: chart.args.title } });
}
writeFileSync(join(HERE, "findings.json"), JSON.stringify(manifest, null, 2));

/* ── the page ─────────────────────────────────────────────────────────────────────────────────────────── */
const themeCards = (t) => manifest.cards.filter((c) => c.theme === t.id);
const cardHTML = (c) => `
<article class="card" id="${esc(c.id)}" data-theme="${esc(c.theme)}">
  <h3 class="q">${esc(c.question)}</h3>
  <div class="viz">
    <div class="desk">${inline[c.id + ":d"]}</div>
    <div class="phone">${inline[c.id + ":p"]}</div>
    <div class="readout" aria-live="polite">hover a bar for its count and range</div>
  </div>
  <p class="a">${esc(c.answer)}</p>
  <p class="u"><b>How sure:</b> ${esc(c.uncertainty)}</p>
  <dl class="meta">
    <div><dt>Sample</dt><dd>${esc(c.sample.instrument)} · ${esc(c.sample.from)} → ${esc(c.sample.to)} · ${thousands(c.sample.days)} · ${thousands(c.sample.episodes)} (${esc(c.sample.unit)})</dd></div>
    <div><dt>Study</dt><dd><a href="${esc(STUDIES[c.study].page)}">${esc(c.study)} · ${esc(STUDIES[c.study].title)}</a> · <a href="${esc(STUDIES[c.study].json)}">the numbers</a></dd></div>
    <div><dt>Review</dt><dd>${esc(c.review.by)}</dd></div>
    <div><dt>Chart file</dt><dd><a href="${esc(c.chart.files.desk)}" download>${esc(c.chart.files.desk.replace("charts/", ""))}</a> · <a href="${esc(c.chart.files.phone)}" download>phone</a></dd></div>
  </dl>
</article>`;
const candHTML = (t) => CANDIDATES.filter((x) => x.theme === t.id).map((x) => `<li><b>${esc(x.lane)}</b> — ${esc(x.what)} <span class="st">${esc(x.state)}</span></li>`).join("");
const themeHTML = (t) => {
  const cs = themeCards(t), cand = candHTML(t);
  return `
<section class="theme" id="t-${esc(t.id)}">
  <header><h2>${esc(t.title)}</h2><p class="why">${esc(t.why)}</p></header>
  ${cs.map(cardHTML).join("") || `<div class="empty">No finding has passed review under this theme yet. Nothing is drawn here until one does.</div>`}
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
<p class="sub">${manifest.cards.length} findings · from ${Object.keys(STUDIES).length} reviewed studies (S8, S9 · 27 Sep 2026) · data to ${DATA_TO} · built ${BUILT} · research questions, not buy rules · nothing here predicts</p>
<nav class="strip" aria-label="Themes">${THEMES.map((t) => `<a href="#t-${t.id}">${esc(t.title.split(" · ")[0])} <b>${themeCards(t).length || "–"}</b></a>`).join("")}<a href="STATS-TAB.html">the rules of this tab →</a></nav>
<div class="status"><b>What this tab is.</b> One card per question. Each card carries one chart that is also saved as a file next to this page, one plain sentence with the numbers, how sure the number is, the sample and the dates, the study it came from and who reviewed it. A study that has not been reviewed shows up only as a name under “measuring now”. Green is up or better than any day; red is down or worse. A fear measure is drawn in red.</div>
${THEMES.map(themeHTML).join("")}
<div class="rules"><h2>What may enter, and what never does</h2>
<ul>
<li>A card needs all of: a stated question · a measured answer with its uncertainty · a saved chart (both sizes) · the sample and date range · a link to the study and its numbers · a review by a second lane or a second method. Missing one, the build refuses it.</li>
<li>Never: a raw table dump, a study nobody has reviewed, a number without a chart, a chart without a date, a grey line, a buy rule.</li>
<li>At most twelve cards on the tab. A new card that answers an old question replaces it; the old chart stays in the study's folder.</li>
</ul>
<p>The full rules, the visual standard and the Hub proposal: <a href="STATS-TAB.html">STATS-TAB.html</a>. The manifest: <a href="findings.json">findings.json</a>. The drawing code: <a href="charts.mjs">charts.mjs</a>.</p></div>
<script>
/* hover readout: the bar's <title> already gives a native tooltip; this repeats it in text under the chart so the
   phone (no hover) can tap a bar and read it. */
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
writeFileSync(join(HERE, "index.html"), page);
console.log(`built ${manifest.cards.length} cards, ${manifest.cards.length * 2} chart files, index.html, findings.json`);
