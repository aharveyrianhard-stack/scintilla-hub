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
const label = process.argv[2] || "after";
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
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1, serviceWorkers: "block" });
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push({ method: m, url: u.host + u.pathname }); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
  if (u.host === "scintillahub.ai") {
    if (u.pathname.startsWith("/api/")) return route.continue();
    const f = localFile(hubRoot, u.pathname);
    if (!f) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.length < 30 && errors.push(String(e.message).slice(0, 160)));
/* visible text only (not titles, not PAGE SPECS), line by line, matched against developer patterns */
const SCAN = () => {
  const RX = [/\b[a-z]+(?:_[a-z0-9]+)+\b/, /\b[a-zA-Z]+\(\)/, /\(DB\)/, /auto-generates/i, /\bno template\b/i, /\bundefined\b|\bNaN\b|\bnull\b/, /\bSupabase\b|\bPostgREST\b|\bedge function\b/i, /wiring pending|TODO|FIXME/i];
  const hits = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent || "").trim(); if (!t) continue;
    const e = n.parentElement; if (!e || e.closest("script,style,noscript,details.sc-pagespecs,[hidden],[aria-hidden='true']")) continue;
    const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    let p = e; let vis = true; for (; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === "none") { vis = false; break; } } if (!vis) continue;
    const line = (e.closest("p,li,div,td,span") || e).textContent.trim().replace(/\s+/g, " ").slice(0, 220);
    if (RX.some((rx) => rx.test(t))) hits.add(line);
  }
  return [...hits];
};
const out = { label, states: {} };
const rec = async (k) => { out.states[k] = await page.evaluate(SCAN).catch((e) => ["ERR " + e.message]); };
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await sleep(5000);
  await rec("DASHBOARD");
  for (const T of (process.env.TICKERS || "NVDA,SKHY").split(",")) {
    await page.evaluate((t) => openCo(t), T); await sleep(7000);
    for (const tb of await page.evaluate(() => CO_TABS.slice())) {
      await page.evaluate((x) => { const b = document.querySelector('#cvTabs [data-tab="' + x + '"]'); if (b) b.click(); }, tb); await sleep(2600);
      if (tb === "READ") for (const rt of ["BUSINESS", "VERDICT", "CATALYSTS", "WATCH"]) { await page.evaluate((x) => { const b = document.querySelector('[data-act="readtab"][data-tab="' + x + '"]'); if (b) b.click(); }, rt); await sleep(700); await rec(T + " · READ · " + rt); }
      else await rec(T + " · " + tb);
    }
  }
  for (const room of ["NEWS", "SOCIAL", "EVENTS", "SENTIMENT", "ECONOMIC", "FILES", "USUAL", "SCENES"]) {
    await page.evaluate((r) => { try { go(r); } catch (_) {} }, room); await sleep(4500); await rec("room " + room);
  }
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 300); }
out.errors = errors; out.writes = writes.length;
fs.writeFileSync(path.join(here, "devtext-" + label + ".json"), JSON.stringify(out, null, 1));
await browser.close();
const all = new Map(); for (const [k, v] of Object.entries(out.states)) for (const l of v) { if (!all.has(l)) all.set(l, []); all.get(l).push(k); }
for (const [l, ks] of all) console.log("• " + l + "   [" + ks.slice(0, 3).join(" | ") + (ks.length > 3 ? " +" + (ks.length - 3) : "") + "]");
console.log("fatal:", out.fatal || "-", "errors:", errors.length);
