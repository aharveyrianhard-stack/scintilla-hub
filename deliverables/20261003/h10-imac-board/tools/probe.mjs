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

const out = { errors };
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 90000 }).catch(() => {});
  await sleep(3000);
  await page.evaluate(() => { const b = document.querySelector('[data-act="coh"][data-key="ALL"]'); b.click(); });
  await sleep(6000);
  out.probe = await page.evaluate(() => {
    const bs = document.getElementById("boardScroll"); const rows = bs.querySelectorAll(".sc-board__row");
    const anims = document.getAnimations().map((a) => { const t = a.effect && a.effect.target; return (t ? (t.className && t.className.baseVal == null ? String(t.className).slice(0,40) : t.tagName) + (bs.contains(t) ? " [board]" : "") : "?") + " :: " + (a.animationName || a.constructor.name); });
    const agg = {}; anims.forEach((k) => agg[k] = (agg[k] || 0) + 1);
    const hs = {}; [...rows].slice(0, 50).forEach((r) => { const h = r.getBoundingClientRect().height.toFixed(2); hs[h] = (hs[h] || 0) + 1; });
    return { rows: rows.length, els: bs.querySelectorAll("*").length, rowH: hs, anims: Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,30),
      cs: getComputedStyle(rows[0]).cssText ? null : { cv: getComputedStyle(rows[0]).contentVisibility, contain: getComputedStyle(rows[0]).contain, wc: getComputedStyle(rows[0]).willChange }, scrollH: bs.scrollHeight, clientH: bs.clientHeight };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const bb = await page.evaluate(() => { const b = document.getElementById("boardScroll").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.move(bb.x + bb.w * 0.4, bb.y + 300); await sleep(500);
  const events = [];
  cdp.on("Tracing.dataCollected", (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: process.env.CC ? "input,cc,benchmark,disabled-by-default-cc.debug.scheduler,devtools.timeline" : "devtools.timeline,disabled-by-default-devtools.timeline.stack,disabled-by-default-devtools.timeline.invalidationTracking", transferMode: "ReportEvents" });
  const t0 = Date.now(); let i = 0; while (Date.now() - t0 < 2500) { await page.mouse.wheel(0, (++i % 20 < 10) ? 90 : -90); await sleep(50); }
  await cdp.send("Tracing.end"); await done;
  const agg = {};
  for (const e of events) { if (e.ph !== "X" || !e.dur) continue; const k = e.name; (agg[k] = agg[k] || { n: 0, ms: 0 }); agg[k].n++; agg[k].ms += e.dur / 1000; }
  out.trace = Object.entries(agg).sort((a, b) => b[1].ms - a[1].ms).slice(0, 22).map(([k, v]) => k + " n=" + v.n + " " + Math.round(v.ms) + "ms");
  const forced = {}; for (const e of events) { if ((e.name === "Layout" || e.name === "UpdateLayoutTree") && e.args && e.args.beginData && e.args.beginData.stackTrace) { const f = e.args.beginData.stackTrace[0]; const k = e.name + " <- " + f.functionName + "@" + f.lineNumber; forced[k] = (forced[k] || 0) + 1; } }
  out.forced = Object.entries(forced).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const inv = {}; for (const e of events) { if (e.name === "ScheduleStyleRecalculation" || e.name === "InvalidateLayout") { const st = e.args && e.args.data && e.args.data.stackTrace; const k = e.name + " <- " + (st && st[0] ? st[0].functionName + "@" + st[0].lineNumber : "?"); inv[k] = (inv[k] || 0) + 1; } }
  const lay = { dirty: 0, total: 0, n: 0 }; for (const e of events) if (e.name === "Layout" && e.args && e.args.beginData) { lay.n++; lay.dirty += e.args.beginData.dirtyObjects || 0; lay.total += e.args.beginData.totalObjects || 0; }
  out.layoutObjects = lay;
  const li = {}; for (const e of events) { if (e.name === "LayoutInvalidationTracking" || e.name === "StyleRecalcInvalidationTracking" || e.name === "StyleInvalidatorInvalidationTracking") { const d = e.args && e.args.data || {}; const st = d.stackTrace && d.stackTrace[0]; const k = e.name.replace("InvalidationTracking","") + " " + (d.reason || "") + " " + (d.nodeName || "") + " <- " + (st ? st.functionName + "@" + st.lineNumber : "-"); li[k] = (li[k] || 0) + 1; } }
  out.layoutInval = Object.entries(li).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const af = {}; for (const e of events) { if (e.name === "Animation" && e.args && e.args.data && (e.args.data.compositeFailed != null || e.args.data.unsupportedProperties)) { const d = e.args.data; const k = (d.name || d.id || "?") + " failed=" + d.compositeFailed + " props=" + JSON.stringify(d.unsupportedProperties || []); af[k] = (af[k] || 0) + 1; } }
  if (process.env.CC) { const mr = {}; for (const e of events) { const a = JSON.stringify(e.args || {}); const m = a.match(/main_thread_(?:scrolling_)?reasons?[^,}]*/gi) || a.match(/MainThreadScrollingReason[^,}]*/gi); if (m) for (const x of m) mr[e.name + " " + x] = (mr[e.name + " " + x] || 0) + 1; }
    out.mainScroll = Object.entries(mr).slice(0, 20); const names = {}; for (const e of events) if (/[Ss]croll/.test(e.name)) names[e.name] = (names[e.name] || 0) + 1; out.scrollEvents = Object.entries(names).sort((a,b)=>b[1]-a[1]).slice(0, 25); }
  out.animFail = Object.entries(af).slice(0, 20);
  out.invalid = Object.entries(inv).sort((a, b) => b[1] - a[1]).slice(0, 15);
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 400); }
fs.writeFileSync(path.join(here, "probe-" + label + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify(out, null, 1));
