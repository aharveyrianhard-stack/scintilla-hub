/* E1 — headless measurement harness for the EARNINGS room (no visible window). node e1-harness.mjs job.json
   target "live": https://scintillahub.ai as deployed. target "local": scintillahub.ai/* served from job.hubRoot (the worktree),
   /api/* and every other host go to the network. Every non-GET request is answered locally with an empty 201 and recorded. */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
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
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const out = { job: job.name, target: job.target, width: job.width, results: [], writes: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: job.width || 1680, height: job.height || 1050 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  if (job.localStorage) await context.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch (_) {} }, job.localStorage);
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { out.writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (job.target === "local" && u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(job.hubRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => out.errors.length < 30 && out.errors.push(String(e.message).slice(0, 220)));
  /* every request, start→end, from the first navigation */
  const reqs = []; const t00 = Date.now(); const started = new Map(); let inflight = 0, lastDone = Date.now();
  page.on("request", (r) => { started.set(r, Date.now()); inflight++; });
  const fin = (r, ok) => { const s = started.get(r); inflight = Math.max(0, inflight - 1); lastDone = Date.now(); if (s == null) return;
    let size = 0; try { const z = r.sizes ? null : null; } catch (_) {}
    reqs.push({ url: r.url().slice(0, 220), type: r.resourceType(), start: s - t00, ms: Date.now() - s, ok }); };
  page.on("requestfinished", async (r) => { fin(r, true); try { const sz = await r.sizes(); const q = reqs[reqs.length - 1]; if (q && q.url === r.url().slice(0, 220)) q.bytes = sz.responseBodySize + sz.responseHeadersSize; } catch (_) {} });
  page.on("requestfailed", (r) => fin(r, false));
  const vp = { w: job.width, h: job.height };
  const rectOf = (sel) => page.evaluate(({ sel, vp }) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect();
    const sq = e.closest(".se-sqbody"); const r = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom),
      inViewport: b.top >= 0 && b.bottom <= vp.h, fullyVisible: b.top >= 0 && b.bottom <= vp.h, text: (e.innerText || "").replace(/\s+/g, " ").slice(0, 140) };
    if (sq) { const sb = sq.getBoundingClientRect(); r.square = { top: Math.round(sb.top), bottom: Math.round(sb.bottom), scrollTop: Math.round(sq.scrollTop), scrollH: sq.scrollHeight, clientH: sq.clientHeight };
      r.visibleInSquare = b.top >= sb.top - 1 && b.bottom <= sb.bottom + 1; }
    return r; }, { sel, vp });
  for (const s of job.steps) {
    const r = { step: s.do, ...(s.label ? { label: s.label } : {}) };
    try {
      if (s.do === "load") {
        const t0 = Date.now();
        await page.goto("https://scintillahub.ai" + (s.path || "/#earnings"), { waitUntil: "domcontentloaded", timeout: 90000 });
        r.domContentLoadedMs = Date.now() - t0;
        let first = null, firstSel = s.firstSel || ".se-drow, .se-chip, .se-cell";
        while (Date.now() - t0 < (s.ms || 60000)) {
          const n = await page.evaluate((q) => document.querySelectorAll(q).length, firstSel);
          if (n && first == null) { first = Date.now() - t0; r.firstCardsMs = first; break; }
          await sleep(50);
        }
        /* complete = the network has been quiet for 2 s (nothing in flight) */
        while (Date.now() - t0 < (s.ms || 60000)) { if (inflight === 0 && Date.now() - lastDone > 2000) break; await sleep(100); }
        r.completeMs = Date.now() - t0 - (inflight === 0 ? 2000 : 0);
        r.requests = reqs.length;
        r.bytesTotal = reqs.reduce((a, q) => a + (q.bytes || 0), 0);
        r.slowest = reqs.slice().sort((a, b) => b.ms - a.ms).slice(0, 12);
        r.biggest = reqs.slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 8);
        r.perf = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? { ttfb: Math.round(n.responseStart), html: Math.round(n.responseEnd), domInteractive: Math.round(n.domInteractive), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize } : null; });
        r.counts = await page.evaluate(() => ({ drows: document.querySelectorAll(".se-drow").length, chips: document.querySelectorAll(".se-chip").length, cells: document.querySelectorAll(".se-cell").length, sec: (window.S && S.sec) || null }));
      }
      else if (s.do === "wait") await sleep(s.ms);
      else if (s.do === "click") { const ok = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; e.scrollIntoView({ block: "nearest" }); e.click(); return true; }, s.sel); r.ok = ok; r.sel = s.sel; await sleep(s.ms || 900); }
      else if (s.do === "rect") { r.rects = {}; for (const [k, sel] of Object.entries(s.sels)) r.rects[k] = await rectOf(sel); }
      else if (s.do === "eval") r.value = await page.evaluate(s.js);
      else if (s.do === "shot") { await page.screenshot({ path: s.file, type: "png", fullPage: !!s.full }); r.file = path.basename(s.file); }
    } catch (e) { r.err = String(e.message).slice(0, 200); }
    out.results.push(r);
  }
} catch (e) { out.error = String(e.stack || e).slice(0, 600); }
await browser.close();
console.log(JSON.stringify(out));
