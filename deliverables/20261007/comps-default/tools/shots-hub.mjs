/* CP5 · pictures of the Hub's COMPS tab as THIS BRANCH would show it — headless, ONE page per width, one name after the other.
   The branch's files are served under the real hostname (so the chart API answers), live tables and prices are read, and every
   request that is not a read is answered locally and counted. Nothing is deployed and nothing is written.
     node shots-hub.mjs <hubRoot> <outDir> <width> TICKER …                                                              */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const [rootArg, outArg, wArg, ...tickers] = process.argv.slice(2), HUB = path.resolve(rootArg), OUT = path.resolve(outArg), width = Number(wArg), height = width < 600 ? 844 : 1050, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const local = (p) => { let f = path.normalize(path.join(HUB, decodeURIComponent(p))); if (!f.startsWith(HUB)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; };
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] }), writes = [], errors = [], rows = [];
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: width < 600, hasTouch: width < 600 });
  await context.route("**/*", async (route) => { const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") { if (u.pathname.startsWith("/api/")) return route.continue(); const f = local(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); }
    return route.continue(); });
  const page = await context.newPage(); page.on("pageerror", (e) => errors.length < 30 && errors.push(String(e.message).slice(0, 240)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 }); await sleep(10000);
  for (const T of tickers) { const r = { ticker: T, width };
    try {
      await page.evaluate((t) => { openCo(t); }, T); await sleep(2500);
      await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
      let last = "", still = 0; for (let i = 0; i < 90 && still < 3; i++) { await sleep(1000); const t = await page.evaluate(() => { const b = document.getElementById("scCompsTab"); return b ? b.innerText : ""; }); if (t === last && t.length > 400 && !/BUILDING|LOADING|loading…/.test(t.slice(0, 200))) still++; else still = 0; last = t; }
      Object.assign(r, await page.evaluate(() => { const b = document.getElementById("scCompsTab"), ce = b.querySelector(".ce") || b; const leaf = [...b.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getClientRects().length);
        return { source: (b.dataset.source || (b.querySelector("[data-source]") || {}).dataset?.source || null), has_nat: !!b.querySelector(".nat"), nat: (b.querySelector(".nat") || {}).innerText || null, cases: [...b.querySelectorAll(".case")].map((e) => e.innerText.slice(0, 160)), under11px: leaf.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).length, page_scrolls_sideways: document.documentElement.scrollWidth > window.innerWidth + 1, sections: [...b.querySelectorAll(".hd b")].map((e) => e.innerText) }; }));
      r.text = last.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").slice(0, 1500); r.has_evening = /\bevenings?\b/i.test(last); r.codes = (last.match(/\b(CP\d|C6b?|v[12]\b|rung)\b/g) || []).slice(0, 5);
      await page.evaluate(() => { const box = document.getElementById("scCompsTab"); window.__cp5 = []; for (let e = box; e && e !== document.body; e = e.parentElement) { window.__cp5.push([e, e.getAttribute("style")]); e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
      await sleep(700); r.shot = `hub-tab-${T}-${width}.png`; try { await page.locator("#scCompsTab").screenshot({ path: path.join(OUT, r.shot), timeout: 60000 }); } catch (e) { r.shotFail = String(e.message).slice(0, 100); }
      await page.evaluate(() => { for (const [e, st] of (window.__cp5 || [])) { if (st == null) e.removeAttribute("style"); else e.setAttribute("style", st); } window.__cp5 = null; }); await sleep(300);
    } catch (e) { r.error = String(e && e.message || e).slice(0, 200); }
    rows.push(r); console.log(JSON.stringify({ ...r, text: undefined, head: (r.text || "").slice(0, 220) }));
  }
  console.log(JSON.stringify({ done: true, errors: errors.slice(0, 6), n_errors: errors.length, writes_blocked: writes.length }));
  fs.writeFileSync(path.join(OUT, `hub-tab-facts-${width}.json`), JSON.stringify({ rows, errors, writes_blocked: writes.length }, null, 1));
} finally { await browser.close(); }
