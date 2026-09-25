/* Builds research/statistics/data/summary.json: the statistics package for every name.
   node research/statistics/build.mjs --cache <dir>   reads <dir>/<SYMBOL>.json saved from the chart API
   node research/statistics/build.mjs --fetch          asks the chart API itself (GET /candles?tf=D, finished bars only)
   Data source is the chart API only. Nothing is written anywhere except data/summary.json. */
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyseSymbol, WINDOWS, MIN_N } from "./stats.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cache = args.includes("--cache") ? args[args.indexOf("--cache") + 1] : null;
const API = "https://scintilla-massive-chart-api.fly.dev";
const TARGETS = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT"];     // public.station_targets, 25 Sep
const FUNDS = ["SPY", "QQQ", "DIA", "IWM", "SMH"];

async function universe() {
  if (cache && fs.existsSync(path.join(cache, "..", "universe.json"))) return JSON.parse(fs.readFileSync(path.join(cache, "..", "universe.json"), "utf8"));
  const r = await fetch(API + "/universe", { headers: { Origin: "https://scintillahub.ai" } }); return r.json();
}
async function candles(sym) {
  if (cache) { const f = path.join(cache, sym + ".json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; }
  const r = await fetch(`${API}/candles?tf=D&symbol=${encodeURIComponent(sym)}`, { headers: { Origin: "https://scintillahub.ai" } });
  return r.ok ? r.json() : null;
}

const u = await universe();
const symbols = [...TARGETS, ...FUNDS, ...u.symbols.filter((s) => !TARGETS.includes(s) && !FUNDS.includes(s))];
const out = { built_utc: new Date().toISOString(), source: `chart API ${API}/candles?tf=D — finished daily bars only, split-adjusted as served`,
  universe: { count: u.count, sha256: u.universe_sha256 }, targets: TARGETS, funds: FUNDS,
  windows: Object.fromEntries(Object.entries(WINDOWS).map(([k, v]) => [k, Number.isFinite(v) ? v : "all history"])), min_n: MIN_N,
  method: "see research/statistics/stats.mjs header — prior observations only, sample sd, percentile with half-ties, Wilder RSI, SMA200 distance, 60-session usual day",
  symbols: {}, missing: [] };
for (const sym of symbols) {
  const j = await candles(sym);
  if (!j || !Array.isArray(j.series) || j.series.length < 2) { out.missing.push(sym); continue; }
  const a = analyseSymbol(j.series);
  a.provider = j.provider; a.price_basis = j.price_basis; a.api_series_count = j.full_series_count ?? j.candles ?? null;
  a.acquired_utc = j.derived_utc ?? null;
  out.symbols[sym] = a;
}
fs.mkdirSync(path.join(here, "data"), { recursive: true });
fs.writeFileSync(path.join(here, "data", "summary.json"), JSON.stringify(out, (k, v) => (typeof v === "number" && !Number.isInteger(v)) ? Math.round(v * 1e4) / 1e4 : v));
console.log(`symbols ${Object.keys(out.symbols).length}, missing ${out.missing.length} ${out.missing.join(",")}, bytes ${fs.statSync(path.join(here, "data", "summary.json")).size}`);
