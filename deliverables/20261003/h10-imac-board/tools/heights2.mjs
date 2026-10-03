/* H10 (3 Oct) — the iMac board, measured. Headless only (Alan, 24 Sep: never a visible window).
   The Hub is served from this branch under its real hostname (the chart API only answers that origin); every non-GET
   request is answered locally and counted, never sent; the page's own GET reads go through (read-only).
     node perf.mjs [label]                 label names the output file (default "after")
   env: INDEX_FILE=<path>  serve that file as /index.html (the "before" run serves the live line's index.html)
        CPU=6              CPU throttling rate (Chrome DevTools' "6x slowdown")
        W=2240 H=1260      the iMac's screen in CSS pixels (24" iMac, 4480 × 2520 at device scale 2)
        DSF=2              device scale factor
        COHORTS=ALL,RADAR
   What it does, per cohort: open the DASHBOARD on that cohort, wait for the live rows, then
     (a) SCROLL   — 4 s of mouse-wheel scrolling over the board;
     (b) REFRESH  — three board refreshes that each change the order (every row's Geiger nudged by a seeded ±0.04, the
                    same path a /geiger pull takes: mergeBoardRows → sync), pointer OFF the board, 2.5 s after each;
     (c) SCROLL+REFRESH — the same three refreshes fired while the wheel is turning, pointer ON the board.
   For each: frames (requestAnimationFrame gaps), long tasks (> 50 ms), Chrome's own style/layout/script time, whether
   the row under the pointer changed, and the scroll position drift. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const label = process.argv[2] || "verify";
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const INDEX_FILE = process.env.INDEX_FILE || null;
const CPU = Number(process.env.CPU || 6);
const W = Number(process.env.W || 2240), H = Number(process.env.H || 1260), DSF = Number(process.env.DSF || 2);
const COHORTS = (process.env.COHORTS || "ALL,RADAR").split(",");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(root, pathname) {
  if (INDEX_FILE && (pathname === "/" || pathname === "/index.html")) return INDEX_FILE;
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, serviceWorkers: "block" });
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
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
const RECORDER_SRC = 1;
/* the recorder: frame gaps and long tasks between start() and stop() */
const RECORDER = () => {
  if (window.__h10) return;
  const R = window.__h10 = { on: false, frames: [], long: [] };
  let last = 0;
  const loop = (t) => { if (R.on && last) R.frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver((l) => { if (R.on) for (const e of l.getEntries()) R.long.push(e.duration); }).observe({ entryTypes: ["longtask"] }); } catch (_) {}
  R.start = () => { R.frames = []; R.long = []; R.on = true; };
  R.stop = () => { R.on = false; return { frames: R.frames.slice(), long: R.long.slice() }; };
  /* one refresh that changes the order: every row's Geiger nudged by a seeded ±amp, through the feed's own merge + sync */
  R.refresh = (seed, amp) => {
    let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const before = (S.boardOrder || []).slice();
    /* about one name in twelve moves (a weekend: crypto and futures trade, equities do not) */
    const fresh = (S.rows || []).map((r) => { const hit = rnd() < 0.08, d = (rnd() * 2 - 1) * amp;
      return Object.assign({}, r, { g: r.g == null || !hit ? r.g : Math.max(-1, Math.min(1, r.g + d)) }); });
    const t0 = performance.now();
    mergeBoardRows(fresh, false); sync();
    const ms = performance.now() - t0;
    const after = (S.boardOrder || []).slice();
    let moved = 0; for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) moved++;
    return { ms, moved, n: after.length };
  };
  R.underPointer = (x, y) => { const e = document.elementFromPoint(x, y); const r = e && e.closest && e.closest(".sc-board__row"); return r ? r.getAttribute("data-t") : null; };
};


const out = { label, errors };
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 90000 }).catch(() => {});
  await sleep(3000);
  await page.evaluate(() => document.querySelector('[data-act="coh"][data-key="ALL"]').click());
  await page.waitForFunction(() => document.querySelectorAll("#boardScroll .sc-board__row").length > 300 && !S.boardPending, null, { timeout: 60000 });
  await sleep(5000);
  out.h = await page.evaluate(async () => { const bs = document.getElementById("boardScroll"); const r = () => ({ st: bs.scrollTop, sh: bs.scrollHeight, ch: bs.clientHeight, oy: getComputedStyle(bs).overflowY, h: getComputedStyle(bs).height });
    const a = r(); bs.scrollTop = 1e7; await new Promise((x) => setTimeout(x, 300)); const b = r(); const rows = [...bs.querySelectorAll(".sc-board__row")];
    const last = rows[rows.length - 1].getBoundingClientRect(), box = bs.getBoundingClientRect();
    return { a, b, lastTopInBox: last.top - box.top, lastBottomInBox: last.bottom - box.top, n: rows.length, lastT: rows[rows.length-1].getAttribute("data-t") }; });
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 400); }
await browser.close();
console.log(JSON.stringify(out));
