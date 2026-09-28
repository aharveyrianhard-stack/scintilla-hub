/* REGIME · FMP pull — runs ON FLY ONLY (the key lives in the Fly app's secrets, never on the Mac).
   Read-only GETs to FMP. Prints ONE line: base64(gzip(JSON)) of the results — data only, never the key or a keyed URL.
   Jobs come from the REGIME_JOBS env/argv JSON: [{kind:"eod"|"eodadj"|"econ", symbol, from, to}].
   Runner (Mac): node research/statistics/regime/fly-run.mjs <jobs.json> <out.json>  (pipes this file through fly ssh). */
const zlib = await import("node:zlib");
const KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com/stable/";
const jobs = JSON.parse(globalThis.REGIME_JOBS || process.argv[2] || "[]");
async function get(path, params) {
  const q = new URLSearchParams({ ...params, apikey: KEY });
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(BASE + path + "?" + q.toString());
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500)); continue; }
      const txt = await r.text();
      try { return { status: r.status, body: JSON.parse(txt) }; } catch { return { status: r.status, body: null, err: txt.slice(0, 120).replace(KEY, "***") }; }
    } catch (e) { if (a === 2) return { status: 0, body: null, err: String(e.message || e).replace(KEY, "***") }; }
  }
  return { status: 429, body: null };
}
const out = [];
for (const j of jobs) {
  let res;
  if (j.kind === "eod") res = await get("historical-price-eod/full", { symbol: j.symbol, from: j.from || "1920-01-01", to: j.to || "2026-12-31" });
  else if (j.kind === "eodadj") res = await get("historical-price-eod/dividend-adjusted", { symbol: j.symbol, from: j.from || "1990-01-01", to: j.to || "2026-12-31" });
  else if (j.kind === "econ") res = await get("economic-calendar", { from: j.from, to: j.to });
  else res = { status: 0, body: null, err: "unknown kind" };
  let body = res.body;
  if (Array.isArray(body) && (j.kind === "eod")) body = body.map((b) => [b.date, b.open, b.high, b.low, b.close, b.volume]);
  if (Array.isArray(body) && (j.kind === "eodadj")) body = body.map((b) => [b.date, b.adjOpen, b.adjHigh, b.adjLow, b.adjClose, b.volume]);
  if (Array.isArray(body) && j.kind === "econ") body = body.filter((e) => /^(US)$/i.test(e.country || "") && /Fed Interest Rate Decision|FOMC Statement|FOMC Press/i.test(e.event || ""));
  out.push({ ...j, status: res.status, err: res.err || null, n: Array.isArray(body) ? body.length : null, rows: body });
}
process.stdout.write("REGIMEB64:" + zlib.gzipSync(Buffer.from(JSON.stringify(out))).toString("base64") + "\n");
