/* RS1 — is the number on the board the same measure as the scale it is judged against? Read-only (GETs).
   The board prints FMP's stored daily RSI(14) (provider_indicators_current, the page's own public read). The scale is
   Wilder's RSI(14) on the chart API's daily bars (the loader's dry run). For every name where both describe the same
   session, the gap between the two is measured. Prints no key. → ../data/fmp-vs-own.json
     node deliverables/20261006/rs1-rsi-own-extremes/tools/compare-fmp.mjs   (from the Hub repo root) */
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
const SB = (html.match(/const SB\s*=\s*"([^"]+)"/) || [])[1];
const anonAt = html.indexOf("const ANON");
const ANON = (html.slice(anonAt, anonAt + 900).match(/"((?:eyJ|sb_publishable_)[A-Za-z0-9._-]{20,})"/) || [])[1];
if (!SB || !ANON) { console.error("could not find the page's read constants"); process.exit(1); }
const dig = "(" + [...html.slice(html.indexOf("const SC_FMP_REFERENCE_DIGESTS")).slice(0, 700).matchAll(/"([0-9a-f]{64})"/g)].map((m) => m[1]).join(",") + ")";
const own = JSON.parse(fs.readFileSync("deliverables/20261006/rs1-rsi-own-extremes/data/rsi-own-dry-run.json", "utf8")).rows;
const byT = Object.fromEntries(own.map((r) => [r.ticker, r]));
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } }); if (!r.ok) throw new Error("read " + r.status); return r.json(); };
const tick = own.map((r) => r.ticker);
let rows = [];
for (let i = 0; i < tick.length; i += 60)
  rows = rows.concat(await pg("provider_indicators_current?ticker=in.(" + tick.slice(i, i + 60).map(encodeURIComponent).join(",") + ")&provider=eq.FMP&timeframe=eq.1day&indicator=eq.rsi&period_length=eq.14&universe_hash=in." + dig + "&select=ticker,value,source_date,session_state"));
const same = [];
for (const r of rows) { const o = byT[r.ticker]; if (o && String(r.source_date).slice(0, 10) === o.as_of) same.push({ t: r.ticker, fmp: Number(r.value), ours: o.rsi, gap: Math.abs(Number(r.value) - o.rsi) }); }
const g = same.map((x) => x.gap).sort((a, b) => a - b), q = (p) => +(g[Math.min(g.length - 1, Math.floor(p * g.length))] || 0).toFixed(2);
const out = { made: new Date().toISOString(), board_rows_read: rows.length, same_session_pairs: same.length, session: own[0] && own[0].as_of,
  gap_median: q(.5), gap_p90: q(.9), gap_p99: q(.99), gap_max: +(g[g.length - 1] || 0).toFixed(2), within_0_05: same.filter((x) => x.gap <= 0.05).length,
  largest: same.sort((a, b) => b.gap - a.gap).slice(0, 8).map((x) => ({ t: x.t, fmp: +x.fmp.toFixed(2), ours: x.ours })) };
fs.writeFileSync("deliverables/20261006/rs1-rsi-own-extremes/data/fmp-vs-own.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
