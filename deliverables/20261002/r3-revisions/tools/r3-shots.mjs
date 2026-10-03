/* R3 (2 Oct, night) — headless shots of the ESTIMATES tab's R3 pieces (adapted from r2-revisions/tools/r2c-shots.mjs) (never a visible window — Alan, 24 Sep). The Hub is served from a
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
    await page.waitForFunction(() => document.querySelector(".sc-rvh .sc-rvh-svg, .sc-rvh .sc-rvs-wait") && !/Reading/.test((document.querySelector(".sc-rvh") || {}).textContent || ""), null, { timeout: 30000 }).catch(() => { r.histLoading = true; });
    await sleep(1500);
    const full = path.join(shots, `${label}-${t}-${W}.png`);
    await page.screenshot({ path: full, type: "png" }); r.file = full;
    /* each R3 piece cloned, unrolled, into an overlay of the same width in the same page (same CSS), shot, removed */
    const shoot = async (name, sel, click) => {
      if (click) await page.evaluate((k) => { const b = document.querySelector('.sc-rvh-firms [data-rvh-firm="' + k + '"]'); if (b) b.click(); }, click);
      if (click) await sleep(400);
      const ok = await page.evaluate((s) => {
        const parts = s.split("+").map((q) => document.querySelector(q)).filter(Boolean); if (!parts.length) return false;
        const w = parts[0].getBoundingClientRect().width, box = document.createElement("div");
        box.id = "r3Shot"; box.style.cssText = "position:absolute;left:0;top:0;z-index:2147483647;padding:12px 14px;background:var(--bg,#0a0a10);width:" + Math.round(w + 28) + "px";
        for (const p of parts) { const c = p.cloneNode(true); c.querySelectorAll("details").forEach((d) => d.removeAttribute("open")); box.appendChild(c); }
        document.body.appendChild(box); window.scrollTo(0, 0); return true;
      }, sel);
      if (!ok) { r[name] = null; return; }
      const zf = path.join(shots, `${label}-${t}-${W}-${name}.png`);
      const el = await page.$("#r3Shot"); await el.screenshot({ path: zf, type: "png" }); r[name] = zf;
      await page.evaluate(() => { const b = document.getElementById("r3Shot"); if (b) b.remove(); });
    };
    await shoot("strip", ".sc-rvs");
    await shoot("hist", ".sc-rvh");
    await shoot("tape", ".sc-rvt+.sc-grsec");
    const firstHot = await page.evaluate(() => { const b = document.querySelector(".sc-rvh-firms button.hot") || document.querySelector(".sc-rvh-firms button"); return b ? b.getAttribute("data-rvh-firm") : null; });
    if (firstHot) await shoot("firm", ".sc-rvh", firstHot);
    r.printed = await page.evaluate(() => {
      const q = (s) => document.querySelector(s), tx = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : null);
      return { arrows: [...document.querySelectorAll(".sc-rvs-arr")].map(tx), est: [...document.querySelectorAll(".sc-rve-t tr")].map(tx),
        histSay: tx(q(".sc-rvh-say")), firms: [...document.querySelectorAll(".sc-rvh-firms button")].slice(0, 12).map(tx),
        pxSegments: document.querySelectorAll(".sc-rvh-svg .px line").length, firmLines: document.querySelectorAll(".sc-rvh-svg g.fl").length,
        tape: [...document.querySelectorAll(".sc-rvt .rvt-it")].slice(0, 10).map(tx), tapeItems: document.querySelectorAll(".sc-rvt .rvt-it").length / 2,
        notesOpen: tx(q(".sc-rvh-nh")), sections: [...document.querySelectorAll(".sc-est-sechead")].map((h) => tx(h.querySelector(".n")) + " " + tx(h.querySelector(".t"))) };
    });
    r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    out.results.push(r);
  }
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await browser.close().catch(() => {}); }
const file = path.join(shots, `${label}-${W}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ file, results: out.results.map((r) => ({ t: r.t, printed: r.printed, noTab: r.noTab, histLoading: r.histLoading, overflow: r.overflow })), errors: out.errors, writes: out.writes.length, error: out.error }, null, 1));
