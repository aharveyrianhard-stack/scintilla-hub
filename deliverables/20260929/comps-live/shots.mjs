/* Headless proof for the comps on the live company view (C1, 29 Sep). NEVER a visible window (Alan, 24 Sep).
   The worktree's Hub is served under its real hostname (https://scintillahub.ai/* → files from HUB_ROOT), the way the
   D2/R4 harness does it, so the chart API sees its own origin and nothing is relaxed. Supabase reads go to the live
   database (public read key, as the Hub itself). Every non-GET request is answered locally with an empty 201 and
   counted, never sent. node shots.mjs <tag> <width> <ticker> [compare: NVDA,GEV]
   Writes shots/<tag>-<width>-view.png (the pane as it sits on screen) and shots/<tag>-<width>.png (the whole COMPS
   section, ancestors un-clipped for the capture only), and prints one JSON line of what is actually on the page. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [tag, widthS, ticker = "MU", compare = ""] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots");
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], apiFail = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
  await context.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch (_) {} }, { "sc.comps.compare": JSON.stringify(compare ? compare.split(",") : []), "hub.company.expanded": "0" });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  page.on("requestfailed", (r) => { if (/massive-chart-api/.test(r.url())) apiFail.push(new URL(r.url()).pathname); });
  page.on("response", (r) => { if (/massive-chart-api/.test(r.url()) && r.status() >= 400) apiFail.push(new URL(r.url()).pathname + " " + r.status()); });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);
  await page.evaluate((t) => { openCo(t); }, ticker);
  await sleep(3500);
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="ESTIMATES"]'); if (b) b.click(); });
  let ok = false; try { await page.waitForSelector("#scCompsLive .cl-ladder", { timeout: 90000 }); ok = true; } catch (_) {}
  let cmpOk = null; if (compare) { try { await page.waitForSelector("#scCompsLive .cl-cmpgrid", { timeout: 90000 }); cmpOk = true; } catch (_) { cmpOk = false; } }
  await sleep(1500);
  await page.evaluate(() => { const e = document.getElementById("scCompsLive"); if (e) e.scrollIntoView({ block: "start" }); });
  await sleep(600);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${tag}-${width}-view.png`), type: "png" });
  const facts = await page.evaluate(() => {
    const box = document.getElementById("scCompsLive"); if (!box) return { box: false };
    const txt = (s) => { const e = box.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 400) : null; };
    return { box: true, mounted: box.dataset.mounted, rows: box.querySelectorAll(".cl-row:not(.cl-way)").length, rowsDrawn: [...box.querySelectorAll(".cl-row:not(.cl-way) svg")].filter((s) => s.childElementCount > 3).length,
      ways: box.querySelectorAll(".cl-row.cl-way").length, waysDrawn: [...box.querySelectorAll(".cl-row.cl-way svg")].filter((s) => s.childElementCount > 3).length,
      steps: box.querySelectorAll(".cl-ladder .cl-step").length, stamp: txt(".cl-stamp"), band: txt(".cl-way .cl-ups"), sentence: txt(".cl-sentence"), note: txt(".cl-note"),
      words: [...box.querySelectorAll("text.cl-word")].map((t) => t.textContent).filter((v, i, a) => a.indexOf(v) === i),
      cmpRows: box.querySelectorAll(".cl-cmprow").length, cmpDrawn: [...box.querySelectorAll(".cl-cmprow svg")].filter((s) => s.childElementCount > 3).length, cmpNote: [...box.querySelectorAll(".cl-note")].map((n) => n.innerText).find((t) => /Ranked/.test(t)) || null,
      err: txt(".cl-err"), boxW: box.clientWidth, boxSW: box.scrollWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, wide: !!box.querySelector(".cl-grid.cl-wide") };
  });
  /* the whole section: un-clip the scrolling ancestors for the capture only (overflow and height; nothing else moves),
     then let Playwright capture the element itself, however tall */
  await page.evaluate(() => { const box = document.getElementById("scCompsLive"); for (let e = box; e && e !== document.body; e = e.parentElement) { e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
  await sleep(800);
  const r = await page.evaluate(() => { const b = document.getElementById("scCompsLive").getBoundingClientRect(); return { x: Math.round(b.left + scrollX), y: Math.round(b.top + scrollY), width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
  await page.locator("#scCompsLive").screenshot({ path: path.join(OUT, `${tag}-${width}.png`), type: "png", timeout: 120000 });
  console.log(JSON.stringify({ tag, width, ticker, compare: compare || null, ok, cmpOk, section: r, ...facts, errors, apiFail, writes: writes.length, writesSample: writes.slice(0, 5) }));
} finally { await browser.close(); }
