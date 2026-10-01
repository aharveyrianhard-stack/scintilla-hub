// H3 pane — open a Station chart URL directly (headless), wait, dump the pane's state, screenshot.
// usage: node pane.mjs <url> <out.png> <width> <height> [waitMs]   (STATION_ROOT=… serves a local Station build)
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [url, out, W, H, WAIT] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: +W || 900, height: +H || 600 }, deviceScaleFactor: 1 });
const stationRoot = process.env.STATION_ROOT || null, reqs = [];
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
  if (stationRoot && u.host === "station.scintillahub.ai") {
    let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
    let f = stationRoot + p; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
    if (fs.existsSync(f)) { const ext = f.split(".").pop(); const ct = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(f), headers: { "cache-control": "no-store" } }); }
  }
  return route.continue();
});
const page = await context.newPage();
const T0 = Date.now();
page.on("requestfinished", (r) => { if (/fly\.dev|supabase/.test(r.url())) reqs.push({ at: Date.now() - T0, url: r.url().replace(/^https:\/\/[^/]+/, "").slice(0, 110) }); });
page.on("requestfailed", (r) => { if (/fly\.dev|supabase/.test(r.url())) reqs.push({ at: Date.now() - T0, fail: r.failure() && r.failure().errorText, url: r.url().replace(/^https:\/\/[^/]+/, "").slice(0, 110) }); });
page.on("pageerror", (e) => console.error("pageerror:", String(e).slice(0, 200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
await sleep(+WAIT || 9000);
const st = await page.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null;
  const g = h.querySelector(".sc-nchart__live-geiger"), lens = h.querySelector(".sc-nchart__lens"), m = h.querySelector(".sc-nchart__msg");
  return { t: h.dataset.t, range: h._range, n: h._series && h._series.length, last: h._series && h._series[h._series.length - 1], forming: h._forming || null,
    clouds: !!(h._cloudMap && h._cloudMap.map), lens: lens ? { display: lens.style.display, why: h.dataset.lensWhy || null } : null,
    geiger: g ? { hidden: g.hidden, vis: g.style.visibility, text: g.textContent } : null, msg: m && !m.hidden ? m.textContent : "",
    rsi: (document.querySelector(".sc-rsi, .sc-nchart__rsi, [class*=rsi]") || {}).className || null, state: h.dataset.dataState || "" }; });
console.log(JSON.stringify(st));
console.log(JSON.stringify(reqs.slice(0, 40)));
await page.screenshot({ path: out });
await browser.close();
