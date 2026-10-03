/* R2 Part A (2 Oct) — the headless walk of the OFFERINGS surfaces. Never a visible window (Alan, 24 Sep). The Hub is
   served from this branch under its real hostname (as P1's and H8's walks do); every non-GET request is answered locally
   and counted, never sent; the page's own GET reads of the tables go through (read-only, anon).
     node r2a-walk.mjs 1680    1680 × 1050 at device scale 2: CAPITAL & DILUTION in FINANCIALS for CoreWeave (ATM),
                               Sysco (a stock sale, then bonds) and Axon (a convertible); the ALERTS room still parked
     node r2a-walk.mjs 390     the phone at 390 × 844: the same
   Shots land in ../screens/<name>-<width>.png; the record (rows read, marks drawn, page errors, writes) in walk-<width>.json. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const width = Number(process.argv[2] || 1680);
const phone = width < 700;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const screens = path.join(here, "..", "screens");
fs.mkdirSync(screens, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(root, pathname) {
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 1 : 2, serviceWorkers: "block",
  ...(phone ? { isMobile: true, hasTouch: true } : {}) });
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
    writes.push({ method: m, url: u.host + u.pathname });
    return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
  }
  if (u.host === "scintillahub.ai") {
    if (u.pathname.startsWith("/api/")) return route.continue();
    const f = localFile(hubRoot, u.pathname);
    if (!f) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
const out = { width, hubRoot, at: new Date().toISOString(), writes, errors };
const shot = async (name, sel, pad) => {
  const file = path.join(screens, name + "-" + width + ".png");
  if (sel) {
    const h = await page.$(sel);
    if (h) {
      try {
        await h.scrollIntoViewIfNeeded();
        if (pad) { const b = await h.boundingBox(); if (b) { await page.screenshot({ path: file, type: "png", clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(width - Math.max(0, b.x - pad), b.width + 2 * pad), height: b.height + 2 * pad } }); return file; } }
        await h.screenshot({ path: file, type: "png" }); return file;
      } catch (e) { out["shotError_" + name] = String(e.message).slice(0, 160); }
    }
  }
  await page.screenshot({ path: file, type: "png" });
  return file;
};
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 });
  await sleep(2500);
  out.alertsParked = await page.evaluate(() => typeof roomHTML === "function" && (S.sec = "ALERTS", /parked/.test(roomHTML())));
  await page.evaluate(() => { S.sec = "DASHBOARD"; });
  out.boardMarks = await page.evaluate(() => document.querySelectorAll(".of-mark").length);
  out.co = {};
  for (const t of (process.env.R2A_TICKERS || "CRWV,SYY,AXON").split(",")) {
    await page.evaluate((x) => openCo(x), t);
    await sleep(2500);
    await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="FINANCIALS"]'); if (b) b.click(); });
    await page.waitForSelector("#ofCap_" + t + " .of-row, #ofCap_" + t + " .of-empty:not(:empty)", { timeout: 30000 }).catch(() => {});
    await page.waitForFunction((x) => { const n = document.querySelector("#ofCap_" + x); return n && !/reading/.test(n.innerText); }, t, { timeout: 30000 }).catch(() => {});
    await sleep(800);
    out.co[t] = await page.evaluate((x) => { const n = document.querySelector("#ofCap_" + x); return n ? { rows: n.querySelectorAll(".of-row").length,
      chips: [...n.querySelectorAll(".of-row .of-chip")].map((c) => c.textContent).join(" "), cash: (n.querySelector(".of-cash") || {}).innerText } : null; }, t);
    await shot("financials-" + t.toLowerCase(), "#ofCap_" + t, phone ? 4 : 8);
    if (t === "CRWV") await shot("financials-crwv-wide", null);
  }
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 300); }
fs.writeFileSync(path.join(here, "walk-" + width + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify({ width, alertsParked: out.alertsParked, boardMarks: out.boardMarks, co: out.co, writes: writes.length, errors, fatal: out.fatal }, null, 0));
