#!/usr/bin/env node
// Builds /prototypes/projection-cloud/index.html from the instruments' own daily history on the chart API.
// The page is self-contained (house rule for /prototypes/): the statistics are computed HERE and embedded,
// with provenance. Re-run to refresh.  node scripts/projection-cloud/build.mjs [--from <dir of SYM-D.json>] [--out <file>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HORIZONS, NAMED_HORIZONS, forwardBands, rollingLevelBands, todayStats } from "./stats.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FROM = opt("--from", null);
const OUT = opt("--out", path.join(root, "prototypes", "projection-cloud", "index.html"));
const API = opt("--api", "https://scintilla-massive-chart-api.fly.dev");

export const INSTRUMENTS = [
  { sym: "US10Y", name: "US 10-year Treasury yield", unit: "% yield", dp: 2 },
  { sym: "DXY", name: "US Dollar Index", unit: "index points", dp: 1 },
  { sym: "SPY", name: "SPDR S&P 500 ETF", unit: "$ per share, split-adjusted", dp: 0 },
  { sym: "KO", name: "Coca-Cola", unit: "$ per share, split-adjusted", dp: 2 },
  { sym: "WMT", name: "Walmart", unit: "$ per share, split-adjusted", dp: 2 },
  { sym: "AAPL", name: "Apple", unit: "$ per share, split-adjusted", dp: 2 },
];
const WINDOWS = [
  { key: "all", label: "All history", sessions: Infinity },
  { key: "y20", label: "20 years", sessions: 20 * 252 },
  { key: "y10", label: "10 years", sessions: 10 * 252 },
];

const r6 = (x) => (x == null || !isFinite(x) ? null : +x.toPrecision(6));
const rObj = (o) => { const out = {}; for (const [k, v] of Object.entries(o)) out[k] = typeof v === "number" ? r6(v) : v; return out; };

async function load(sym) {
  if (FROM) return JSON.parse(fs.readFileSync(path.join(FROM, sym + "-D.json"), "utf8"));
  const res = await fetch(`${API}/candles?symbol=${encodeURIComponent(sym)}&tf=D`);
  if (!res.ok) throw new Error(`${sym}: HTTP ${res.status}`);
  return res.json();
}

export function analyse(meta, j) {
  const series = (j.series || []).filter((b) => b && b.c != null && b.t != null);
  const closes = series.map((b) => Number(b.c));
  const dates = series.map((b) => new Date(b.t).toISOString().slice(0, 10));
  const n = closes.length;
  if (n < 600) throw new Error(`${meta.sym}: only ${n} sessions`);
  const windows = {};
  for (const w of WINDOWS) {
    const from = Math.max(0, n - w.sessions);
    if (w.key !== "all" && from === 0) { windows[w.key] = windows.all; continue; }
    windows[w.key] = {
      from, label: w.label,
      bands: forwardBands(closes, { from }).map(rObj),
      today: rObj(todayStats(closes, dates, { from })),
    };
  }
  return {
    ...meta,
    provider: j.provider, provider_symbol: j.provider_symbol || j.symbol, price_basis: j.price_basis, source_namespace: j.source_namespace,
    sessions: n, first: dates[0], last: dates[n - 1], acquired_utc: j.provider_refresh?.acquired_utc || null, derived_utc: j.derived_utc || null,
    rolling: rollingLevelBands(closes, dates).map((p) => ({ k: p.k, d: p.d, q: p.q.map(r6) })),
    windows,
  };
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

export function page(data) {
  const css = fs.readFileSync(path.join(here, "style.css"), "utf8");
  const js = fs.readFileSync(path.join(here, "render.js"), "utf8");
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const prov = data.instruments.map((i) => `<tr><td>${esc(i.sym)}</td><td>${esc(i.provider)} · ${esc(i.provider_symbol)}</td><td>${esc(i.price_basis)}</td><td>${i.sessions.toLocaleString("en-US")}</td><td>${esc(i.first)} → ${esc(i.last)}</td><td>${esc(i.acquired_utc || "–")}</td></tr>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SCINTILLA · Projection cloud</title><style>
${css.trim()}
</style></head><body><div class="wrap">
<header><span class="brand">SCINTILLA</span><nav class="hlinks" aria-label="Where this sits"><a href="/prototypes/">← Prototypes</a><a href="https://scintillahub.ai/" target="_blank" rel="noopener">Hub ↗</a></nav></header>
<nav class="pn" aria-label="Page sections"><a href="#overview">Overview</a><a href="#today">Today</a><a href="#clouds">Clouds</a><a href="#method">Method</a><a href="#sources">Sources</a></nav>
<main>
<section class="part" id="overview"><h1>Projection cloud</h1>
<p class="lede">A chart with no bars and no price line — only the cloud. For each instrument, the cloud behind today is the spread of its own closes over the trailing year, session by session. The cloud in front of today is the same history carried forward: every move of one week, one month, three, six and twelve months that the instrument has ever made, applied to today's close and drawn as percentile bands, with ±1σ and ±2σ lines beside them. The dot is today. The numbers say where today sits in that history.</p>
<p class="k">A review prototype on real daily closes from the chart API. It is not a forecast and not part of the dashboard: it shows where history has put a move of this size, nothing more.</p>
<div class="filters" role="group" aria-label="History window"><span class="fl">History used for the bands</span><button type="button" data-win="all" aria-pressed="true">All history</button><button type="button" data-win="y20" aria-pressed="false">20 years</button><button type="button" data-win="y10" aria-pressed="false">10 years</button></div>
</section>
<section class="part" id="today"><h2 class="pt">Today, all six</h2><div id="aggregate"></div></section>
<section class="part" id="clouds"><h2 class="pt">The clouds</h2><div id="panels"></div></section>
<section class="part" id="method"><h2 class="pt">Method, in plain words</h2>
<dl class="spec">
<dt>Behind today</dt><dd>For each of the last 500 sessions, the 5th, 25th, 50th, 75th and 95th percentiles of the closes in the 250 sessions ending there. The price itself is not drawn; the cloud is where it has been living.</dd>
<dt>In front of today</dt><dd>For every session in the chosen history, the ratio of the close h sessions later to that session's close, for h from 1 to 250. The bands are the 5th, 25th, 50th, 75th and 95th percentiles of those ratios, multiplied by today's close. Solid thin lines are the mean ±1 and ±2 standard deviations of the log ratios — where a bell curve would put the edges, so the gap between the lines and the bands shows the fat tails.</dd>
<dt>Z-score</dt><dd>Today's close minus the mean of the last 250 closes, divided by their standard deviation. The percentile beside it is the share of those 250 closes at or below today's.</dd>
<dt>One-year change</dt><dd>Today's close against the close 250 sessions ago, ranked against every one-year change in the chosen history.</dd>
<dt>Units and basis</dt><dd>Yields are in percent, indices in points, shares in split-adjusted dollars; the basis is stated per instrument below and comes from the chart API unchanged. Percentile bands are empirical; nothing is fitted, smoothed or extrapolated.</dd>
<dt>Not built yet</dt><dd>Cycle detection and the aggregation of several instruments' cycles into one read. This page establishes the single-instrument cloud first.</dd>
</dl></section>
<section class="part" id="sources"><h2 class="pt">Sources</h2>
<table class="prov"><thead><tr><th>Instrument</th><th>Provider · symbol</th><th>Basis</th><th>Sessions</th><th>Range</th><th>Acquired (UTC)</th></tr></thead><tbody>
${prov}
</tbody></table>
<p class="lede" style="margin-top:10px">Daily closes served by the Scintilla chart API (${esc(data.source)}), read once when this page was built: ${esc(data.generated_utc)}. Rebuild the page to refresh.</p>
</section>
</main>
<footer>Projection cloud · review prototype · <a href="/prototypes/">back to Prototypes</a></footer>
</div>
<script id="cloud-data" type="application/json">${json}</script>
<script>
${js.trim()}
</script>
</body></html>
`;
}

async function main() {
  const instruments = [];
  for (const meta of INSTRUMENTS) {
    const j = await load(meta.sym);
    const a = analyse(meta, j);
    instruments.push(a);
    const t = a.windows.all.today;
    console.log(`${meta.sym.padEnd(6)} ${a.sessions} sessions ${a.first}..${a.last} close ${t.level} z1y ${t.z_1y?.toFixed(2)} pct1y ${t.pct_level_1y?.toFixed(0)} ret1y ${(t.ret_1y * 100).toFixed(1)}% (pct ${t.ret_1y_pct?.toFixed(0)})`);
  }
  const data = { generated_utc: new Date().toISOString(), source: API, horizons: HORIZONS, named: NAMED_HORIZONS, windows: WINDOWS.map((w) => ({ key: w.key, label: w.label })), instruments };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const html = page(data);
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${OUT} (${html.length.toLocaleString("en-US")} bytes)`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
