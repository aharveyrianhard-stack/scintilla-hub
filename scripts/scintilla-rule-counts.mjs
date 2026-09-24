/* HOW MANY SCINTILLAS WOULD EACH DEFAULT HAVE PRODUCED? (M48, Alan: "so the defaults are measured,
   not guessed"). Read-only: daily bars from the chart API, the same source the detector uses. It
   replays the last N sessions and counts, per session, how many names each rule family would have
   marked. Nothing is written to any table.

   node scripts/scintilla-rule-counts.mjs [sessions] [maxSymbols] > counts.json                  */
import fs from "node:fs";
import { assetClassOf, priceRuleFor, priceVerdict, stdev, dailyReturnsPct } from "./scintillas-detect.mjs";

const API = process.env.SC_CHART_API || "https://scintilla-massive-chart-api.fly.dev";
const SESSIONS = Number(process.argv[2] || 60);
const MAX = Number(process.argv[3] || 140);
const LOOKBACK = Number(process.env.SC_LOOKBACK || 60);   // the usual day is measured over this many sessions
const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));

const get = async (path) => {
  const r = await fetch(API + path, { headers: { origin: "https://scintillahub.ai" } });
  if (!r.ok) throw new Error(path.split("?")[0] + " -> " + r.status);
  return r.json();
};
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { error: String(e.message || e) }; } }
  }));
  return out;
}

const u = await get("/universe");
const all = (u.symbols || u.universe || []).map((s) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
/* every fund named in the rules file is measured; the single names are a deterministic even
   sample of the rest, so the count is reproducible and the API is asked for a bounded number. */
const funds = all.filter((s) => assetClassOf(s, RULES) !== "equity");
const singles = all.filter((s) => assetClassOf(s, RULES) === "equity");
const room = Math.max(0, MAX - funds.length);
const step = Math.max(1, Math.ceil(singles.length / room));
const sample = funds.concat(singles.filter((_, i) => i % step === 0)).slice(0, MAX);

const need = SESSIONS + LOOKBACK + 5;
/* the same bars answer every sweep of the thresholds, so they are fetched once and kept in a
   local cache file: the chart API is one small machine and this is a read-only measurement. */
const CACHE = process.env.SC_BARS_CACHE || "";
let bars = {};
if (CACHE && fs.existsSync(CACHE)) bars = JSON.parse(fs.readFileSync(CACHE, "utf8"));
const missing = sample.filter((s) => !bars[s] || !bars[s].length);
await pool(missing, 5, async (sym) => {
  const c = await get("/candles?symbol=" + encodeURIComponent(sym) + "&tf=1d&limit=" + need);
  const rows = (c.series || c.candles || c.bars || c.rows || []);
  bars[sym] = rows.map((b) => ({
    day: typeof (b.t ?? b.time ?? b.date) === "number" ? new Date(b.t ?? b.time).toISOString().slice(0, 10) : String((b.t ?? b.time ?? b.date) || "").slice(0, 10),
    c: Number(b.c ?? b.close),
  })).filter((b) => b.day && Number.isFinite(b.c));
});

if (CACHE && missing.length) fs.writeFileSync(CACHE, JSON.stringify(bars));

const days = [...new Set(Object.values(bars).flatMap((rows) => rows.map((r) => r.day)))].sort();
const replay = days.slice(-SESSIONS);
const perDay = [], byClass = {};
for (const day of replay) {
  const row = { day, statistical: 0, raw: 0, both: 0, either: 0, examined: 0 };
  for (const sym of sample) {
    const rows = bars[sym] || [];
    const at = rows.findIndex((r) => r.day === day);
    if (at < 1) continue;
    const hist = rows.slice(Math.max(0, at - LOOKBACK), at);           // ends BEFORE the day being judged
    const rets = dailyReturnsPct(hist);
    if (rets.length < RULES.usual_day.min_sessions) continue;
    const usual = stdev(rets);
    if (!(usual > 0)) continue;
    const movePct = (rows[at].c / rows[at - 1].c - 1) * 100;
    const rule = priceRuleFor(sym, RULES);
    const v = priceVerdict(movePct, usual, rule);
    row.examined++;
    const s = v.fired.includes("statistical"), r = v.fired.includes("raw");
    if (s) row.statistical++;
    if (r) row.raw++;
    if (s && r) row.both++;
    if (s || r) {
      row.either++;
      const k = rule.asset_class;
      byClass[k] = byClass[k] || { asset_class: k, names_measured: 0, statistical: 0, raw: 0, either: 0 };
      byClass[k].statistical += s ? 1 : 0; byClass[k].raw += r ? 1 : 0; byClass[k].either += 1;
    }
  }
  perDay.push(row);
}
for (const k in byClass) byClass[k].names_measured = sample.filter((s) => assetClassOf(s, RULES) === k).length;
const stat = (key) => {
  const xs = perDay.map((d) => d[key]).sort((a, b) => a - b);
  return { mean: +(xs.reduce((a, b) => a + b, 0) / (xs.length || 1)).toFixed(2), median: xs[Math.floor(xs.length / 2)] ?? 0, max: xs[xs.length - 1] ?? 0, min: xs[0] ?? 0 };
};
console.log(JSON.stringify({
  rules_version: RULES.version, api: API, sessions_replayed: perDay.length, lookback_sessions: LOOKBACK,
  symbols_asked: sample.length, funds_in_sample: funds.length, singles_in_sample: sample.length - funds.length,
  universe_size: all.length, sampling: "every fund named in the rules, plus every " + step + (step === 1 ? "st" : "th") + " single name",
  per_day: { statistical: stat("statistical"), raw: stat("raw"), both: stat("both"), either: stat("either"), examined: stat("examined") },
  by_asset_class: byClass, days: perDay,
}, null, 1));
