// Station chart-frame cache bench: local copy of the Station files, today's header vs the proposed one.
// usage: node stbench.mjs <dir> <cacheControl> <throttle> <cycles>
import { createRequire } from "node:module"; import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import zlib from "node:zlib";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [dir, cc, thr, cyc] = process.argv.slice(2); const throttle = +thr, cycles = +cyc;
const stat = { full: 0, fullBytes: 0, notMod: 0, byPath: {} };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css" };
const BENCH = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#0a0a0c"><div id=g style="display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:500px"></div></body>`;
const gz = new Map();
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/__bench.html") { res.writeHead(200, { "content-type": TYPES[".html"] }); return res.end(BENCH); }
  let f = path.join(dir, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const buf = fs.readFileSync(f); const etag = '"' + crypto.createHash("md5").update(buf).digest("hex") + '"';
  const h = { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": cc === "SPLIT" ? (/\.m?js$/.test(f) ? "no-cache" : "no-store, max-age=0, must-revalidate") : cc, etag, "content-encoding": "gzip" };
  if (req.headers["if-none-match"] === etag) { stat.notMod++; res.writeHead(304, h); return res.end(); }
  if (!gz.has(f)) gz.set(f, zlib.gzipSync(buf)); const body = gz.get(f);
  stat.full++; stat.fullBytes += body.length; stat.byPath[p] = (stat.byPath[p] || 0) + 1; res.writeHead(200, h); res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const origin = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--disable-web-security"] });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
let blocked = 0; await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
cdp.on("Fetch.requestPaused", (e) => { if (e.request.method !== "GET") { blocked++; cdp.send("Fetch.failRequest", { requestId: e.requestId, errorReason: "BlockedByClient" }).catch(() => {}); } else cdp.send("Fetch.continueRequest", { requestId: e.requestId }).catch(() => {}); });
await cdp.send("Performance.enable"); if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
await page.goto(origin + "/__bench.html");
const SETS = [["SPY", "QQQ", "IWM", "DIA", "NVDA", "AAPL", "MSFT", "AMZN"], ["GOOGL", "META", "AVGO", "TSLA", "MU", "AMD", "TSM", "ORCL"], ["XLK", "XLI", "XLC", "XLF", "XLY", "XLE", "XLP", "XLV"]];
const rows = [];
for (let c = 0; c < cycles; c++) {
  const s0 = { ...stat }; const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const r = await page.evaluate(({ tickers }) => new Promise((done) => {
    const g = document.getElementById("g"); g.innerHTML = ""; const t0 = performance.now(); const ready = {}; let n = 0;
    const on = (e) => { const d = e.data; if (d && d.sc === "chart-load-request") { try { e.source.postMessage({ sc: "chart-load-grant", token: d.token, generation: d.generation }, location.origin); } catch (_) {} return; } if (d && d.sc === "chart-data-state" && d.hasSeries && !ready[d.ticker]) { ready[d.ticker] = Math.round(performance.now() - t0); if (++n >= tickers.length) fin(); } };
    const fin = () => { removeEventListener("message", on); clearTimeout(to);
      const fr = [...document.querySelectorAll("iframe")].map((f) => { try { const P = f.contentWindow.performance, nav = P.getEntriesByType("navigation")[0]; const off = P.timeOrigin - performance.timeOrigin - t0;
        const api = P.getEntriesByType("resource").filter((e) => /fly\.dev/.test(e.name)).map((e) => [e.name.replace(/^https:\/\/[^/]+/, "").slice(0, 60), Math.round(e.startTime + off), Math.round(e.duration)]);
        const own = P.getEntriesByType("resource").filter((e) => !/fly\.dev/.test(e.name)); return { frameStart: Math.round(off), html: Math.round(nav.responseEnd), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), ownN: own.length, ownEnd: Math.round(Math.max(0, ...own.map((e) => e.responseEnd))), api }; } catch (e) { return String(e); } });
      done({ ready, all: Math.round(performance.now() - t0), n, fr }); };
    addEventListener("message", on); const to = setTimeout(fin, 45000);
    for (const t of tickers) { const f = document.createElement("iframe"); f.style.cssText = "border:0;width:100%;height:100%"; f.src = "/station-shells/chart-v1/?shell=v1&bare=1&t=" + t + "&range=3D&view=auto&bubble=4h%3A12"; g.appendChild(f); }
  }), { tickers: SETS[c % SETS.length] });
  await page.waitForTimeout(1500);
  const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const firsts = Object.values(r.ready).sort((a, b) => a - b);
  if (process.env.DETAIL) console.error(JSON.stringify(r.fr.slice(0, 2), null, 0), JSON.stringify(r.ready));
  rows.push({ cycle: c + 1, charts: r.n, firstMs: firsts[0], medianMs: firsts[Math.floor(firsts.length / 2)], allMs: r.all, downloads: stat.full - s0.full, kB: Math.round((stat.fullBytes - s0.fullBytes) / 1024), revalidated304: stat.notMod - s0.notMod, mainThreadS: +(m1.TaskDuration - m0.TaskDuration).toFixed(2), scriptS: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(2) });
}
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
console.log(JSON.stringify({ cc, throttle, blocked, rows }));
await browser.close(); server.close();
