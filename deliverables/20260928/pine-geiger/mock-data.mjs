/* N8 · the values for the page's mock of the TradingView table: the 16 default rows (11 SPDR sectors +
   SPY QQQ IWM DIA RSP), computed with the Pine script's maths (pine-port.mjs) on the bars the live /geiger
   read, weighted by the rungs /geiger names. GET only; writes mock-data.json. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { rungRead } from "./pine-port.mjs";
const API = "https://scintilla-massive-chart-api.fly.dev", HDR = { Origin: "https://scintillahub.ai" };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROWS = ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY", "XLC", "SPY", "QQQ", "IWM", "DIA", "RSP"];
const get = async (u) => { for (let a = 0; a < 4; a++) { try { const r = await fetch(u, { headers: HDR, signal: AbortSignal.timeout(60000) }); if (r.ok) return r.json(); } catch (_) {} await new Promise((z) => setTimeout(z, 800 * (a + 1))); } throw new Error(u); };
const g = await get(`${API}/geiger?symbols=${ROWS.join(",")}&detail=1`);
const out = { geiger_computed_utc: g.computed_utc, rows: [] };
for (const s of ROWS) {
  let ws = 0, sc = 0, st = 0, sm = 0, wm = 0, n = 0;
  for (const pr of g.participating_rungs) {
    const lr = g.symbols[s].rungs[pr.equalizer_key]; if (!lr || lr.availability === "ABSENT") continue;
    const bars = (await get(`${API}/candles?symbol=${s}&tf=${encodeURIComponent(pr.tf_token)}&limit=230&authority=provider`)).series
      .filter((b) => b.t <= Date.parse(lr.newest)).slice(-230);
    const r = rungRead(bars.map((x) => +x.c), bars.map((x) => +x.h), bars.map((x) => +x.l)); if (!r) continue;
    n++; ws += pr.weight; sc += pr.weight * r.comp; st += pr.weight * r.trend; if (r.mom != null) { sm += pr.weight * r.mom; wm += pr.weight; }
  }
  const row = { sym: s, geiger: sc / ws, trend: st / ws, mom: wm ? sm / wm : null, rungs: n, live: g.symbols[s].composite };
  out.rows.push(row); console.log(s, row.geiger.toFixed(4), row.live);
}
fs.writeFileSync(path.join(HERE, "mock-data.json"), JSON.stringify(out, null, 1));
