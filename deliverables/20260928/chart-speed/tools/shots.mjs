/* L2 CHART-SPEED — headless screenshots of the AFTER state (the Station branch served locally under its real hostname,
   the Hub live). node shots.mjs <outdir>. Never a visible window. Non-GET requests are answered locally, never sent. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const OUT = process.argv[2];
const ST = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/station-chart-speed-20260928";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(root, p) {
  let f = path.normalize(path.join(root, decodeURIComponent(p)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const res = [];
try {
  for (const [name, url, w, h, mobile, open] of [
    ["hub-mu-1680", "https://scintillahub.ai/", 1680, 1050, false, "MU"],
    ["hub-mu-390", "https://scintillahub.ai/", 390, 844, true, "MU"],
    ["station-targets-1680", "https://station.scintillahub.ai/deck/?scene=targets3D", 1680, 1050, false, null],
    ["station-targets-390", "https://station.scintillahub.ai/deck/?scene=targets3D", 390, 844, true, null]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
    await ctx.addInitScript(() => { try { if (location.host === "station.scintillahub.ai") localStorage.setItem("station.rotate.paused", "1"); } catch (_) {} });
    await ctx.route("**/*", async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
      if (u.host === "station.scintillahub.ai") {
        const f = localFile(ST, u.pathname);
        if (!f) return route.fulfill({ status: 404, body: "not found" });
        return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
      }
      return route.continue();
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (open) {
      await sleep(12000);
      await page.evaluate((t) => { const row = document.querySelector('.sc-board__row[data-t="' + t + '"]'); if (row) row.click(); else openCo(t); }, open);
      await sleep(12000);
    } else await sleep(15000);
    const file = path.join(OUT, name + ".jpg");
    await page.screenshot({ path: file, type: "jpeg", quality: 80 });
    res.push({ name, file, overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth) });
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(res));
