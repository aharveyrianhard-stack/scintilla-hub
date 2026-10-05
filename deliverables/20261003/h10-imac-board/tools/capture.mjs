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
const caps = path.join(here, "..", "captures"); fs.mkdirSync(caps, { recursive: true });
const tmpv = path.join(caps, "_raw_" + label); fs.mkdirSync(tmpv, { recursive: true });
const W0 = 1680, H0 = 1050;
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: W0, height: H0 }, deviceScaleFactor: 1, serviceWorkers: "block", recordVideo: { dir: tmpv, size: { width: W0, height: H0 } } });
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
page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 160)));
const t0 = Date.now(); const marks = {};
const mark = (k) => { marks[k] = (Date.now() - t0) / 1000; };
let box = null;
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 90000 }).catch(() => {});
  await sleep(3000);
  await page.evaluate(() => document.querySelector('[data-act="coh"][data-key="ALL"]').click());
  await page.waitForFunction(() => document.querySelectorAll("#boardScroll .sc-board__row").length > 300 && !S.boardPending, null, { timeout: 60000 });
  await sleep(5000);
  box = await page.evaluate(() => { const b = document.getElementById("boardPanel").getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(Math.min(b.height, innerHeight - b.y)) }; });
  await page.mouse.move(W0 - 5, H0 - 5);
  /* A RE-SORT: three names from far down the board jump into the top five; two near the top drop away; as a /geiger pull would */
  const resort = () => page.evaluate(() => {
    const ord = (S.boardOrder || []).slice(); const byT = {}; for (const r of S.rows) byT[r.t] = r;
    const top = byT[ord[0]].g, pick = [ord[40], ord[95], ord[160]], drop = [ord[1], ord[3]];
    const fresh = S.rows.map((r) => { const x = Object.assign({}, r); const i = pick.indexOf(r.t); if (i >= 0) x.g = Math.min(1, top + 0.02 - i * 0.01); if (drop.includes(r.t)) x.g = -0.2; return x; });
    mergeBoardRows(fresh, false); sync(); return { pick, drop };
  });
  await sleep(1500); mark("resort1"); out_pick = await resort(); await sleep(2500);
  mark("resort2"); await resort(); await sleep(2500);
  /* the replay: PLAY on the rewind bar, a few seconds */
  const hasPlay = await page.evaluate(() => !!document.getElementById("gwxPlay"));
  if (hasPlay) { mark("play"); await page.evaluate(() => document.getElementById("gwxPlay").click()); await sleep(6500); mark("playEnd"); await page.evaluate(() => { const p = document.getElementById("gwxPlay"); if (p && p.classList.contains("is-on")) p.click(); }); }
  await sleep(800);
} catch (e) { errors.push("fatal " + String(e && e.message || e).slice(0, 200)); }
var out_pick;
const vid = await page.video().path().catch(() => null);
await context.close(); await browser.close();
fs.writeFileSync(path.join(caps, label + "-capture.json"), JSON.stringify({ label, box, marks, pick: out_pick, errors, writes: writes.length, vid }, null, 1));
console.log(JSON.stringify({ label, box, marks, pick: out_pick, errors, vid }));
