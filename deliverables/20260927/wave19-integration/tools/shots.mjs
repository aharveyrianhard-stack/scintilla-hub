/* WAVE 19 — headless proof of the integrated candidate (never a visible window).
   https://scintillahub.ai/* is answered from this checkout, so the chart API sees its real Origin; /api/* GETs go to
   the live Hub; every other GET (Supabase reads, the chart API) goes to the real service, read-only. Every non-GET
   (Supabase writes, /api POSTs) is answered here with an empty 201 and recorded, never sent.
   Run from the repo root:  node deliverables/20260927/wave19-integration/tools/shots.mjs [1680|390] */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "deliverables/20260927/wave19-integration/shots");
const W = Number(process.argv[2] || 1680), phone = W < 600;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) {
  let f = path.normalize(path.join(ROOT, decodeURIComponent(p)));
  if (!f.startsWith(ROOT)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], log = { width: W, shots: [] };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: W, height: phone ? 844 : 1050 }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: phone, hasTouch: phone });
await ctx.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname);
    return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
  if (u.host === "scintillahub.ai" && !u.pathname.startsWith("/api/")) {
    const f = localFile(u.pathname);
    if (!f) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) });
  }
  return route.continue();
});
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.length < 30 && errors.push(new URL(page.url()).pathname + " · " + String(e.message).slice(0, 200) + " · " + String(e.stack || "").split("\n").slice(1, 3).join(" | ").slice(0, 240)));
const shot = async (name, extra) => { const file = path.join(OUT, name + "-" + W + ".png"); await page.screenshot({ path: file });
  log.shots.push({ name, file: path.relative(ROOT, file), ...(extra || {}) }); };
const text = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 300) : null; }, sel);
const rsiCells = () => page.evaluate(() => { const c = [...document.querySelectorAll(".sc-board__row .sc-rsi")];
  return { rows: c.length, numbers: c.filter((x) => /^\d+$/.test(x.textContent.trim())).length, sample: c.slice(0, 8).map((x) => x.textContent.trim()) }; });

// 1 · the dashboard, tape on top
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".sc-board__row", { timeout: 60000 }).catch(() => {});
for (let i = 0; i < 40; i++) { const r = await rsiCells(); if (r.rows && r.numbers >= Math.min(5, r.rows)) break; await sleep(1000); }
await sleep(4000);
await shot("dashboard", { tape: await text(".sc-tape"), rsi: await rsiCells() });
// 2 · pick a name from the board: the ticker goes into the title
const pick = await page.evaluate(() => { const r = document.querySelector('.sc-board__row[data-t="MU"]') || document.querySelector(".sc-board__row"); if (!r) return null; r.click(); return r.dataset.t; });
await sleep(9000);
await shot("picked-" + (pick || "none"), { headIdent: await text("#headIdent"), rsi: await rsiCells() });
// 3 · the company's GEIGER tab: the ladder
await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="GEIGER"]'); if (b) b.click(); });
await sleep(8000);
const lad = await page.evaluate(() => { const z = document.querySelector(".gsum .gs-zT") || document.querySelector(".gsum");
  const t = z ? (z.innerText || "").replace(/\s+/g, " ").trim() : null; return { found: !!z, numbers: t ? (t.match(/-?\d+(\.\d+)?/g) || []).length : 0, text: t && t.slice(0, 300) }; });
const gsumVis = await page.evaluate(() => { const g = document.querySelector(".gsum"); if (!g) return false; g.scrollIntoView({ block: "start" }); return true; });
await sleep(800);
await shot("geiger-tab", { ladder: lad, gsumVisible: gsumVis });
// 4 · the earnings room, 5 · USUAL DAY
for (const [sec, name] of [["EVENTS", "earnings-room"], ["USUAL", "usual-day"]]) {
  await page.evaluate((s) => { window.scrollTo(0, 0); if (typeof go === "function") go(s); }, sec);
  await sleep(7000);
  await shot(name, { sec: await page.evaluate(() => (typeof S !== "undefined" && S.sec) || null) });
}
// 6-9 · the pages
for (const [p, name, wait] of [["/deliverables/20260927/comps-r3/index.html?t=MU", "comps-r3-MU", 14000], ["/deliverables/20260927/market-map/index.html", "market-map", 12000],
  ["/workshop/", "workshop", 3000], ["/preview/company-view/", "trial-company-view", 15000]]) {
  await page.goto("https://scintillahub.ai" + p, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(wait);
  const extra = name === "trial-company-view" ? { banner: await text("#trialBanner"), rsi: await rsiCells() } : { title: await page.title() };
  await shot(name, extra);
}
// 10 · the trial with a name open (the R3 view)
const tpick = await page.evaluate(() => { const r = document.querySelector('.sc-board__row[data-t="MU"]') || document.querySelector(".sc-board__row"); if (!r) return null; r.click(); return r.dataset.t; });
await sleep(10000);
await shot("trial-company-view-" + (tpick || "none"), { tabs: await page.evaluate(() => [...document.querySelectorAll('[data-act="cotab"]')].map((b) => b.dataset.tab)) });
log.errors = errors; log.writesBlocked = writes.length; log.writeSample = [...new Set(writes)].slice(0, 10);
await browser.close();
console.log(JSON.stringify(log, null, 1));
