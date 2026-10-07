/* K1 (5 Oct 2026) — item 10 (M24): how long the chart API's /quotes takes right now, as the Hub calls it.
   GET only, from this Mac, with the Hub's origin. No key.  node quotes-latency.mjs [rounds=15] [gapMs=2000]
   Three request sizes each round: one name, the FAVORITES board (63 names), and the ALL board as the Hub asks for it (500 names in one request).
   Prints and saves quotes-latency.json: per size the count, the answers by status, and the min / median / p90 / max in ms. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url)), API = "https://scintilla-massive-chart-api.fly.dev", H = { Origin: "https://scintillahub.ai" };
const rounds = Number(process.argv[2] || 15), gap = Number(process.argv[3] || 2000), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uni = await (await fetch(API + "/universe", { headers: H })).json().catch(() => null);
const all = (uni && (uni.symbols || uni.universe || uni.tickers) || []).map((x) => (typeof x === "string" ? x : x.symbol || x.ticker)).filter(Boolean);
if (all.length < 100) { console.log("universe not read", uni && Object.keys(uni)); process.exit(1); }
const sizes = { one: all.slice(0, 1), board63: all.slice(0, 63), all500: all.slice(0, 500) };   // the Hub's 2-second tick asks for at most 500 names in one request (index.html: want.slice(0, 500)); 590 in one request is refused (400)
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : null; };
const out = { at: new Date().toISOString(), api: API, universe: all.length, rounds, gap_ms: gap, image: null, sizes: {} }, samples = { one: [], board63: [], all500: [] };
try { const h = await (await fetch(API + "/health", { headers: H })).json(); out.image = h.image || h.code_commit || h.commit || (h.build && h.build.commit) || null; out.health_state = h.state || h.status || null; } catch (_) {}
for (let i = 0; i < rounds; i++) {
  for (const [name, syms] of Object.entries(sizes)) {
    const t0 = performance.now(); let status = 0, bytes = 0, returned = null, states = null;
    try { const r = await fetch(API + "/quotes?symbols=" + encodeURIComponent(syms.join(",")), { headers: H, signal: AbortSignal.timeout(30000) }); status = r.status; const t = await r.text(); bytes = t.length;
      try { const j = JSON.parse(t); const qs = Array.isArray(j.quotes) ? j.quotes : Object.values(j.quotes || {}); returned = qs.length; states = qs.reduce((a, x) => { a[x.state] = (a[x.state] || 0) + 1; return a; }, {}); } catch (_) {} }
    catch (e) { status = String(e.name || "ERR"); }
    samples[name].push({ ms: Math.round(performance.now() - t0), status, bytes, returned, states });
  }
  await sleep(gap);
}
for (const [name, s] of Object.entries(samples)) {
  const ms = s.map((x) => x.ms), by = s.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
  out.sizes[name] = { symbols: sizes[name].length, calls: s.length, by_status: by, min_ms: Math.min(...ms), median_ms: q(ms, 0.5), p90_ms: q(ms, 0.9), max_ms: Math.max(...ms), over_1s: ms.filter((x) => x > 1000).length,
    kb: Math.round((s.find((x) => x.bytes) || {}).bytes / 1024) || null, returned: (s.find((x) => x.returned != null) || {}).returned ?? null, states_last: s[s.length - 1].states };
}
out.samples = samples;
fs.writeFileSync(path.join(here, process.env.OUT || "quotes-latency.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ at: out.at, image: out.image, universe: out.universe, sizes: out.sizes }, null, 1));
