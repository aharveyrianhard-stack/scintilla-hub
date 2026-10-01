// H3 deck timing — a fresh headless browser opens a Station deck scene (live, or a local Station build with STATION_ROOT)
// and records, per chart pane, the time from navigation to its price and to its clouds, plus every chart-API read with its
// duration and the server's x-hot-read (hit = the API's ready copy, miss = built for this request). Nothing is written.
// usage: node deck-timing.mjs <scene> <label> [reps=1] [width=1680]
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [scene, label, REPS, W] = process.argv.slice(2);
const stationRoot = process.env.STATION_ROOT || null, width = +W || 1680;
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png" };
for (let rep = 0; rep < (+REPS || 1); rep++) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1050 } });
  await context.route("**/*", (route) => { const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (stationRoot && u.host === "station.scintillahub.ai") {
      let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
      let f = stationRoot + p; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
      if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f), headers: { "cache-control": "no-store" } });
    }
    return route.continue(); });
  const page = await context.newPage();
  const T0 = Date.now(), reads = [], open = new Map();
  page.on("request", (r) => { if (/fly\.dev/.test(r.url())) open.set(r, Date.now() - T0); });
  page.on("requestfinished", async (r) => { if (!open.has(r)) return; const at = open.get(r); open.delete(r);
    const resp = await r.response().catch(() => null); const h = resp ? await resp.allHeaders().catch(() => ({})) : {};
    reads.push({ at, ms: Date.now() - T0 - at, hot: h["x-hot-read"] || "", url: r.url().replace(/^https:\/\/[^/]+/, "").replace(/&authority=provider/, "").slice(0, 120) }); });
  await page.goto("https://station.scintillahub.ai/deck/?scene=" + scene, { waitUntil: "domcontentloaded" });
  let panes = [], done = false; const until = Date.now() + 40000;
  while (!done && Date.now() < until) {
    const now = Date.now() - T0;
    const s = await page.evaluate(() => [...document.querySelectorAll("iframe")].map((f) => { try { const h = f.contentDocument && f.contentDocument.querySelector("#chartSlot .sc-nchart");
      return h ? { t: h.dataset.t, price: !!(h._series && h._series.length >= 2), clouds: !!(h._cloudMap && h._cloudMap.map) } : null; } catch (_) { return null; } }).filter(Boolean)).catch(() => []);
    for (const x of s) { let p = panes.find((q) => q.t === x.t); if (!p) panes.push(p = { t: x.t, price: null, clouds: null });
      if (x.price && p.price == null) p.price = now; if (x.clouds && p.clouds == null) p.clouds = now; }
    done = panes.length >= 2 && panes.every((p) => p.price != null && p.clouds != null);
    await sleep(40);
  }
  await sleep(1200);
  const all = { label, scene, rep, at: new Date().toISOString(), panes, cloudsAll: panes.every((p) => p.clouds != null) ? Math.max(...panes.map((p) => p.clouds)) : null,
    priceAll: panes.every((p) => p.price != null) ? Math.max(...panes.map((p) => p.price)) : null, reads: reads.sort((a, b) => a.at - b.at) };
  console.log(JSON.stringify({ label, rep, panes: panes.length, priceAll: all.priceAll, cloudsAll: all.cloudsAll, nReads: reads.length, miss: reads.filter((r) => r.hot === "miss").length, hit: reads.filter((r) => r.hot === "hit").length, slowest: reads.slice().sort((a, b) => b.ms - a.ms).slice(0, 3).map((r) => r.ms + "ms " + r.hot + " " + r.url) }));
  fs.mkdirSync("../data", { recursive: true });
  fs.writeFileSync("../data/deck-" + label + "-" + rep + ".json", JSON.stringify(all, null, 1));
  await browser.close();
}
