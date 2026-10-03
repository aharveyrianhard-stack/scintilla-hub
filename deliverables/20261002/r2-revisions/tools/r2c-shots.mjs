/* R2 Part C (2 Oct) — headless shots of the ESTIMATES tab (never a visible window — Alan, 24 Sep). The Hub is served from a
   checkout (HUB_ROOT: this branch, or the base a389c7c for "before") under its real hostname, the way H8's walk does it; every
   non-GET request is answered locally and counted, never sent. Reads go to the live database with the page's own anon key.
     node r2c-shots.mjs <label> <T,T,…> [width]     width 1680 → 1680 × 1050 at device scale 2; width 390 → 390 × 844 at scale 2
   Writes shots/<label>-<T>-<width>.png (the viewport) and shots/<label>-<T>-<width>-strip.png (the tab's content, or the
   REVISIONS strip itself when it is drawn) and shots/<label>-<width>.json (what the strip printed, errors, blocked writes). */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label = "after", list = "NVDA,MU", wArg = "1680"] = process.argv.slice(2);
const W = +wArg, H = W >= 1000 ? 1050 : 844;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const shots = path.join(here, "..", "shots");
fs.mkdirSync(shots, { recursive: true });
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
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, serviceWorkers: "block",
  isMobile: W < 768, hasTouch: W < 768 });
await context.addInitScript(() => { try { localStorage.setItem("hub.company.tab", "ESTIMATES"); } catch (_) {} });
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
const out = { label, width: W, hubRoot, at: new Date().toISOString(), results: [], writes, errors };
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => {});
  await sleep(5000);
  for (const t of String(list).split(",")) {
    const r = { t };
    await page.evaluate((x) => openCo(x), t);
    try { await page.waitForSelector('[data-act="cotab"][data-tab="ESTIMATES"]', { timeout: 30000 }); } catch (_) { r.noTab = true; }
    await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="ESTIMATES"]'); if (b) b.click(); });
    try { await page.waitForSelector(".sc-rvs .sc-rvs-row, .sc-rvs .sc-rvs-wait, .sc-est-sechead", { timeout: 30000 }); } catch (_) { r.noEst = true; }
    await page.waitForFunction(() => !document.querySelector(".sc-rvs .sc-rvs-wait") || /No analyst notes|could not be read/.test(document.querySelector(".sc-rvs .sc-rvs-wait").textContent), null, { timeout: 20000 }).catch(() => { r.stillLoading = true; });
    await sleep(2500);
    const full = path.join(shots, `${label}-${t}-${W}.png`);
    await page.screenshot({ path: full, type: "png" }); r.file = full;
    /* the tab scrolls, so the strip is taller than its window: for the close-up it is cloned, unrolled, into an overlay of the
       same width in the same page (same CSS), shot, and removed. The viewport shot above is the page as the person sees it. */
    const unrolled = await page.evaluate(() => {
      const s = document.querySelector(".sc-rvs") || document.querySelector("#coRailContent"); if (!s) return false;
      const w = s.getBoundingClientRect().width, box = document.createElement("div");
      box.id = "r2cShot"; box.style.cssText = "position:absolute;left:0;top:0;z-index:2147483647;padding:12px 14px;background:var(--bg,#0a0a10);width:" + Math.round(w + 28) + "px";
      const c = s.cloneNode(true); c.querySelectorAll("details").forEach((d) => d.removeAttribute("open")); box.appendChild(c); document.body.appendChild(box); window.scrollTo(0, 0); return true;
    });
    if (unrolled) {
      const zf = path.join(shots, `${label}-${t}-${W}-strip.png`);
      const el = await page.$("#r2cShot"); await el.screenshot({ path: zf, type: "png" }); r.strip = zf; r.rect = await el.boundingBox();
      await page.evaluate(() => { const b = document.getElementById("r2cShot"); if (b) b.remove(); });
    }
    r.printed = await page.evaluate(() => {
      const s = document.querySelector(".sc-rvs"); if (!s) return null;
      return { arrows: [...s.querySelectorAll(".sc-rvs-arr")].map((a) => a.textContent.replace(/\s+/g, " ").trim()),
        say: (s.querySelector(".sc-rvs-say") || {}).textContent || "", rows: [...s.querySelectorAll(":scope > .sc-rvs-row")].slice(0, 8).map((a) => a.textContent.replace(/\s+/g, " ").trim()),
        rowCount: s.querySelectorAll(".sc-rvs-row").length, firstSection: (document.querySelector(".sc-est-sechead .t") || {}).textContent || "" };
    });
    r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    out.results.push(r);
  }
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await browser.close().catch(() => {}); }
const file = path.join(shots, `${label}-${W}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ file, results: out.results.map((r) => ({ t: r.t, printed: r.printed && { arrows: r.printed.arrows, rows: r.printed.rowCount, first: r.printed.firstSection }, noTab: r.noTab, stillLoading: r.stillLoading, overflow: r.overflow })), errors: out.errors, writes: out.writes.length, error: out.error }, null, 1));
