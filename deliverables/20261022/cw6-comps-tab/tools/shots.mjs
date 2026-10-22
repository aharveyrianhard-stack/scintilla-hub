/* CW6 · headless pictures of the COMPS tab. NEVER a visible window. This branch's Hub under its real hostname (files from
   HUB_ROOT), the live database with the public key (GET only), the live chart API; every non-GET is answered locally and
   counted; any request to fmp-proxy is counted (the tab must make none).
     node tools/shots.mjs <width> <height> <TICKER>[,<TICKER>…]   → pictures/<T>-<w>x<h>.png (the tab's first screen),
     pictures/<T>-<w>x<h>-full.png (the whole tab, folds open) and one JSON line of facts per name. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [wS, hS, list = "MU"] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../../.."), OUT = path.join(HERE, "..", "pictures");
const width = +wS, height = +hS;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  for (const ticker of list.split(",")) {
    const writes = [], fmp = [], errors = [], reads = { files: 0, store: 0, pg: 0, chart: 0 }, out = { ticker, width, height };
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block" });
    await context.route("**/*", async (route) => {
      const req = route.request(), u = new URL(req.url()), m = req.method();
      if (/fmp-proxy/.test(u.pathname)) { fmp.push(m + " " + u.pathname + u.search.slice(0, 60)); return route.fulfill({ status: 403, body: "blocked in the proof: the tab must not call fmp-proxy" }); }
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
      if (u.host === "scintillahub.ai") {
        if (u.pathname.startsWith("/api/")) return route.continue();
        const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" });
        if (u.pathname.startsWith("/deliverables/20261022/cw6-comps-tab/")) { reads.files++; if (u.pathname.includes("/store/")) reads.store++; }
        return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) });
      }
      if (/supabase\.co$/.test(u.host) && u.pathname.startsWith("/rest/")) reads.pg++;
      if (/massive-chart-api/.test(u.host)) reads.chart++;
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 240)));
    page.on("console", (msg) => { if (msg.type() === "error" && errors.length < 20 && /cw6|comps/i.test(msg.text())) errors.push("console: " + msg.text().slice(0, 200)); });
    await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(8000);
    const r0 = { ...reads };
    await page.evaluate((t) => { openCo(t); }, ticker); await sleep(2500);
    await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
    let ok = false; try { await page.waitForSelector("#scCompsTab.cw6 #cw6Field svg.field text", { timeout: 120000, state: "attached" }); ok = true; } catch (_) {}
    try { await page.waitForFunction(() => { const s = document.getElementById("cw6BroadSum"); return s && !/^reading/.test(s.textContent); }, null, { timeout: 120000 }); } catch (_) {}
    await sleep(1200);
    out.ok = ok;
    out.facts = await page.evaluate(() => {
      const box = document.getElementById("scCompsTab"); if (!box) return { box: false };
      const t = (s) => { const e = box.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; };
      return { box: true, own: box._cw6 ? { ...box._cw6.reads, path: box._cw6.path, band: box._cw6.band, midpoint: box._cw6.R && box._cw6.R.midpoint, read: box._cw6.R && box._cw6.R.read, thin: box._cw6.R && box._cw6.R.thin, refuse: box._cw6.refuse || null } : null, err: t(".err"), set: t(".setl"), verdict: t(".verdict"), alan: t(".alan"), wob: t(".wob"), field: [...box.querySelectorAll("#cw6Field svg text")].map((e) => e.textContent).slice(0, 40), swing: t(".swing"), cycle: t(".cyc"), broad: t("#cw6BroadSum"),
        peers: box.querySelectorAll("table.t tbody tr").length, undef: /undefined|NaN/.test(box.innerText), boxW: box.clientWidth, boxSW: box.scrollWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    await page.evaluate(() => { const b = document.getElementById("scCompsTab"); if (b) b.scrollIntoView({ block: "start" }); });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, `${ticker}-${width}x${height}.png` ) });
    await page.evaluate(() => { document.querySelectorAll("#scCompsTab details").forEach((d) => { d.open = true; }); const box = document.getElementById("scCompsTab"); for (let e = box; e && e !== document.body; e = e.parentElement) { e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("max-height", "none", "important"); e.style.setProperty("height", "auto", "important"); } });
    await sleep(900);
    await page.locator("#scCompsTab").screenshot({ path: path.join(OUT, `${ticker}-${width}x${height}-full.png`), timeout: 120000 });
    out.reads = { files: reads.files - r0.files, store: reads.store - r0.store, pg: reads.pg - r0.pg, chart: reads.chart - r0.chart };
    out.errors = errors; out.writes = writes.length; out.writeList = writes.slice(0, 5); out.fmp_proxy_calls = fmp.length;
    console.log(JSON.stringify(out));
    await context.close();
  }
} finally { await browser.close(); }
