// Quant loop run 1 · fetch finished daily bars from the chart API, once, into a local cache.
// Read-only: GET /candles?symbol=&tf=D&limit=6000. Nothing is written anywhere
// except <cache>/<SYMBOL>.json and <cache>/manifest.json. Every study reads these same bytes.
//   node tools/quant-loop/fetch-bars.mjs <cache-dir> [--resume]   (the 13 run-1 names only;
//   --resume keeps every symbol that already answered 200 and asks again, one at a time, only for the rest)
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const API = "https://scintilla-massive-chart-api.fly.dev";
export const TARGETS = ["GOOGL", "NBIS", "AVGO", "BE", "AMZN", "VST", "MU", "WMT"]; // public.station_targets, as recorded 25 Sep
export const FUNDS = ["SPY", "QQQ", "DIA", "IWM", "SMH"];
const HDR = { Origin: "https://scintillahub.ai" };

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: HDR });
      const body = await r.text();
      if (r.ok) return { status: r.status, body };
      if (r.status < 500) return { status: r.status, body };
    } catch (e) { if (i === 2) return { status: 0, body: String(e) }; }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return { status: 0, body: "" };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cache = process.argv[2];
  if (!cache) { console.error("usage: fetch-bars.mjs <cache-dir> [--resume]"); process.exit(2); }
  fs.mkdirSync(cache, { recursive: true });
  let symbols = [...TARGETS, ...FUNDS];                    // D7 scope: the 8 station_targets + 5 funds, nothing else
  const resume = process.argv.includes("--resume") && fs.existsSync(path.join(cache, "manifest.json"))
    ? JSON.parse(fs.readFileSync(path.join(cache, "manifest.json"), "utf8")) : null;
  const manifest = { started_utc: new Date().toISOString(), api: API, request: `${API}/candles?symbol=<S>&tf=D&limit=6000`, symbols: {} };
  if (resume) {                                  // keep what already came back 200; ask again only for the rest
    manifest.started_utc = resume.started_utc; manifest.resumed_utc = new Date().toISOString();
    for (const [k, r] of Object.entries(resume.symbols)) if (r.status === 200) manifest.symbols[k] = r;
    symbols = symbols.filter((s) => !manifest.symbols[s]);
  }
  const lanes = resume ? 1 : 4;
  let next = 0;
  async function worker() {
    while (next < symbols.length) {
      const s = symbols[next++];
      const { status, body } = await get(`${API}/candles?symbol=${encodeURIComponent(s)}&tf=D&limit=6000`);
      const rec = { status, bytes: body.length, sha256: crypto.createHash("sha256").update(body).digest("hex") };
      if (status === 200) {
        fs.writeFileSync(path.join(cache, s + ".json"), body);
        const j = JSON.parse(body); const ser = j.series || [];
        Object.assign(rec, { provider: j.provider, price_basis: j.price_basis, bars: ser.length, api_count: j.full_series_count ?? j.candles,
          first: ser.length ? new Date(ser[0].t).toISOString().slice(0, 10) : null,
          last: ser.length ? new Date(ser[ser.length - 1].t).toISOString().slice(0, 10) : null,
          finality_verified: j.bar_finality?.verified ?? null, acquired_utc: j.derived_utc ?? null,
          refresh_attempted: j.daily_refresh?.attempted ?? null, forming_last: j.current_session?.forming_last_candle ?? null });
      }
      manifest.symbols[s] = rec;
    }
  }
  await Promise.all(Array.from({ length: lanes }, worker));
  manifest.finished_utc = new Date().toISOString();
  fs.writeFileSync(path.join(cache, "manifest.json"), JSON.stringify(manifest, null, 1));
  const v = Object.values(manifest.symbols);
  console.log(`fetched ${v.filter((r) => r.status === 200).length}/${v.length}; non-200: ${Object.entries(manifest.symbols).filter(([, r]) => r.status !== 200).map(([k, r]) => k + ":" + r.status).join(",") || "none"}; refresh attempted on ${v.filter((r) => r.refresh_attempted).length}; forming last bar on ${v.filter((r) => r.forming_last).length}`);
}
