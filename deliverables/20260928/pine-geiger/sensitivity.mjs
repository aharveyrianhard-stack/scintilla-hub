/* N8 · how much could a different price feed move the Geiger? GET only; writes sensitivity.json.
   TradingView's prints can differ from Massive's by a cent here and there. For each symbol this re-reads the
   bars /geiger used, nudges every bar's high/low/close by an independent random amount within ±1 cent
   (keeping high ≥ close ≥ low), recomputes the Geiger with the same maths as the Pine script, 300 times,
   and reports how far it moved. It also lists the fan pairs that sit closest together (the ones a cent can flip). */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const API = "https://scintilla-massive-chart-api.fly.dev", HDR = { Origin: "https://scintillahub.ai" };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SYMS = ["SPY", "QQQ", "IWM", "DIA", "RSP", "XLK", "XLE", "XLF", "XLV", "XLU"];
const W = { "3h": 1.235817, "4h": 2.278755, "6h": 3.178477, "12h": 3.172702, "1d": 3.178477, "3d": 2.576738, "1w": 0.987499 };
const TOK = { "3h": "180", "4h": "240", "6h": "6h", "12h": "12h", "1d": "D", "3d": "3D", "1w": "W" };
const get = async (u) => { for (let a = 0; a < 4; a++) { try { const r = await fetch(u, { headers: HDR, signal: AbortSignal.timeout(60000) }); if (r.ok) return r.json(); } catch (_) {} await new Promise((z) => setTimeout(z, 800 * (a + 1))); } throw new Error(u); };
const cl = (x) => Math.max(-1, Math.min(1, x));
function read(c, h, l) {
  const n = c.length; const E = [5, 8, 13, 21, 34].filter((k) => n >= k).map((k) => { const a = 2 / (k + 1); let e = c[0]; for (let i = 1; i < n; i++) e = c[i] * a + e * (1 - a); return e; });
  const S = [50, 100, 150, 200].filter((k) => n >= k).map((k) => { let s = 0; for (let j = n - k; j < n; j++) s += c[j]; return s / k; });
  const f = [...E, ...S], p = f.length - 1; let io = 0; const gaps = []; for (let i = 0; i < p; i++) { if (f[i] > f[i + 1]) io++; gaps.push(Math.abs(f[i] - f[i + 1])); }
  const trend = (2 * io - p) / p;
  let g = 0, ls = 0; for (let i = 1; i <= 14; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else ls -= d; } g /= 14; ls /= 14;
  for (let i = 15; i < n; i++) { const d = c[i] - c[i - 1]; g = (g * 13 + (d > 0 ? d : 0)) / 14; ls = (ls * 13 + (d < 0 ? -d : 0)) / 14; }
  const rsi = 100 - 100 / (1 + (ls === 0 ? 1e9 : g / ls));
  let hh = -1e18, ll = 1e18; for (let j = n - 14; j < n; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); }
  const wr = hh > ll ? (hh - c[n - 1]) / (hh - ll) * -100 : -50;
  const mom = (cl((rsi - 23) / 54 * 2 - 1) * 0.6 + cl((wr + 90) / 80 * 2 - 1) * 0.4);
  return { comp: 0.5 * trend + 0.5 * mom, minGap: Math.min(...gaps) };
}
let seed = 20260928; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const g = await get(`${API}/geiger?symbols=${SYMS.join(",")}&detail=1`);
const out = { run_utc: new Date().toISOString(), geiger_computed_utc: g.computed_utc, trials: 300, cents: 1, symbols: {} };
for (const s of SYMS) {
  const rungs = {};
  for (const k of Object.keys(W)) {
    const bars = (await get(`${API}/candles?symbol=${s}&tf=${encodeURIComponent(TOK[k])}&limit=230&authority=provider`)).series;
    rungs[k] = bars.filter((b) => b.t <= Date.parse(g.symbols[s].rungs[k].newest)).slice(-230);
  }
  const G = (jit) => { let ws = 0, sc = 0; let closest = Infinity;
    for (const [k, b] of Object.entries(rungs)) {
      const c = [], h = [], l = [];
      for (const x of b) { const cc = +x.c + (jit ? (R() * 2 - 1) * 0.01 : 0); c.push(cc); h.push(Math.max(cc, +x.h + (jit ? (R() * 2 - 1) * 0.01 : 0))); l.push(Math.min(cc, +x.l + (jit ? (R() * 2 - 1) * 0.01 : 0))); }
      const r = read(c, h, l); ws += W[k]; sc += W[k] * r.comp; closest = Math.min(closest, r.minGap / c.at(-1));
    }
    return { g: sc / ws, closest };
  };
  const base = G(false), d = [];
  for (let t = 0; t < 300; t++) d.push(Math.abs(G(true).g - base.g));
  d.sort((a, b) => a - b);
  out.symbols[s] = { geiger: +base.g.toFixed(4), median_move: +d[150].toFixed(4), p95_move: +d[284].toFixed(4), max_move: +d[299].toFixed(4), closest_fan_pair_pct_of_price: +(100 * base.closest).toFixed(4) };
  console.log(s, out.symbols[s]);
}
fs.writeFileSync(path.join(HERE, "sensitivity.json"), JSON.stringify(out, null, 1));
