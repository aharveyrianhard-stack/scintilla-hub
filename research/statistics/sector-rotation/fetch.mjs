/* U2 · SECTOR ROTATION — fetch. GET only, from the chart API; nothing is written anywhere but the cache
   directory and this lane's deliverable folder.
     node research/statistics/sector-rotation/fetch.mjs [--cache-root <dir>] [--force]
   · Daily bars: GET /candles?tf=D&limit=6000&symbol=X (Origin https://scintillahub.ai), saved as served to
     <cache-root>/sector-rotation-20260928/<SYM>.json. Finished bars only (the API drops the forming session).
   · Live Geiger: one GET /geiger?symbols=…&detail=1 for every fund, saved to
     deliverables/20260928/sector-rotation/live-geiger-snapshot.json. It is the yardstick the replay is checked
     against; it is not used as history. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { ALL_SYMS } from "./universe.mjs";

const API = "https://scintilla-massive-chart-api.fly.dev", HDR = { Origin: "https://scintillahub.ai" };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const ROOT = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const DIR = path.join(ROOT, "sector-rotation-20260928");
const OUT = path.resolve(HERE, "../../../deliverables/20260928/sector-rotation");
fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

async function get(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(120000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (_) { /* retry */ }
    await new Promise((z) => setTimeout(z, 1000 * (a + 1)));
  }
  throw new Error("GET failed " + url);
}

const log = [];
for (const sym of ALL_SYMS) {
  const f = path.join(DIR, sym + ".json");
  if (fs.existsSync(f) && !args.includes("--force")) { log.push([sym, "cached"]); continue; }
  const j = await get(`${API}/candles?tf=D&limit=6000&symbol=${encodeURIComponent(sym)}`);
  if (!j || !Array.isArray(j.series) || !j.series.length) { log.push([sym, "ABSENT"]); continue; }
  fs.writeFileSync(f, JSON.stringify(j));
  log.push([sym, j.series.length, new Date(j.series[0].t).toISOString().slice(0, 10), new Date(j.series.at(-1).t).toISOString().slice(0, 10)]);
}
for (const r of log) console.log(r.join("  "));

const g = await get(`${API}/geiger?symbols=${ALL_SYMS.join(",")}&detail=1`);
if (g) {
  // keep what the replay check needs; drop nothing that identifies the read
  const keep = { fetched_utc: new Date().toISOString(), computed_utc: g.computed_utc, equalizer_receipt_sha256: g.equalizer_receipt_sha256,
    participating_rungs: g.participating_rungs, verification: g.verification, symbols: {} };
  for (const [s, v] of Object.entries(g.symbols || {})) {
    keep.symbols[s] = { composite: v.composite, trend: v.trend, momentum: v.momentum,
      rungs: Object.fromEntries(Object.entries(v.rungs || {}).map(([k, r]) => [k, { newest: r.newest, bars_used: r.bars_used,
        trend_signed: r.trend_signed, momentum_signed: r.momentum_signed, tf_composite: r.tf_composite, rsi14: r.rsi14, williams14: r.williams14 }])) };
  }
  fs.writeFileSync(path.join(OUT, "live-geiger-snapshot.json"), JSON.stringify(keep, null, 1));
  console.log("live geiger:", Object.keys(keep.symbols).length, "symbols, computed", g.computed_utc);
}
