#!/usr/bin/env node
// RM1 — the "in use" test: does each lap of ordinary clicking leave something behind?
// One lap = open several companies from the board, walk every room on the master tabs, switch the
// board's list and come back. After every lap: force a collection and count what is still alive.
// A page that cleans up after itself is flat from lap to lap; growth per lap is a leak per click.
//   node usecycle.mjs --name hub-use --url https://scintillahub.ai/ --laps 10 --out <dir> [--override map.json]
// Headless only; every non-GET request is blocked and counted; the list buttons (♥ ★ ◎) are never clicked.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i === -1 ? d : process.argv[i + 1]; };
const NAME = String(arg("name", "use")), URL_ = String(arg("url")), LAPS = Number(arg("laps", 10)), OUT = path.resolve(String(arg("out", "./use-" + NAME)));
const OVERRIDE = arg("override", null), DWELL = Number(arg("dwell", 4000));
const HERE = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), "[" + NAME + "]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return "(bad url)"; } };
const overrides = new Map();
if (OVERRIDE) for (const [u, f] of Object.entries(JSON.parse(fs.readFileSync(String(OVERRIDE), "utf8")))) overrides.set(urlKey(u), f);
const blocked = {};
let browser;
process.on("SIGTERM", async () => { try { await browser.close(); } catch (_) {} process.exit(143); });

browser = await chromium.launch({ headless: true, args: ["--enable-precise-memory-info", "--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });
  await context.addInitScript({ path: path.join(HERE, "instrument.js") });
  await context.route("**/*", (route) => {
    const req = route.request(), key = urlKey(req.url());
    if (req.method() !== "GET") { blocked[req.method() + " " + key] = (blocked[req.method() + " " + key] || 0) + 1; return route.abort("blockedbyclient"); }
    const local = overrides.get(key);
    if (local) return route.fulfill({ status: 200, contentType: local.endsWith(".js") || local.endsWith(".mjs") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = {};
  page.on("pageerror", (e) => { const k = String(e && e.message || e).slice(0, 140); errors[k] = (errors[k] || 0) + 1; });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable"); await cdp.send("HeapProfiler.enable");
  await page.goto(URL_, { waitUntil: "load", timeout: 180000 });
  await sleep(45000);

  const rooms = await page.evaluate(() => [...document.querySelectorAll('[data-act="mtab"][data-sec]')].map((n) => n.dataset.sec).filter((v, i, a) => a.indexOf(v) === i));
  const cohorts = await page.evaluate(() => [...document.querySelectorAll('[data-act="coh"][data-key]')].map((n) => n.dataset.key).filter((v, i, a) => a.indexOf(v) === i));
  const tickers = await page.evaluate(() => [...document.querySelectorAll('.sc-board__row[data-t]')].slice(0, 5).map((n) => n.dataset.t));
  log("rooms", rooms.join(","), "| lists", cohorts.slice(0, 8).join(","), "| names", tickers.join(","));

  /* the press is sent to the control itself (the Hub listens on the document), so a tab bar that has
     tucked itself away or a row scrolled out of view is still pressed, as a keyboard user would */
  const skipped = {};
  const click = async (selector, label) => {
    let ok = false;
    try { ok = await page.evaluate((sel) => { const n = document.querySelector(sel); if (!n) return false; n.click(); return true; }, selector); } catch (_) {}
    if (!ok) skipped[label] = (skipped[label] || 0) + 1;
    await sleep(DWELL);
    return ok;
  };
  async function takeSnapshot(file) {
    const stream = fs.createWriteStream(file);
    const onChunk = ({ chunk }) => stream.write(chunk);
    cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
    await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
    cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
    await new Promise((r) => stream.end(r));
    log("heap snapshot", path.basename(file), (fs.statSync(file).size / 1048576).toFixed(1) + " MB");
  }
  const sample = async (lap) => {
    await cdp.send("HeapProfiler.collectGarbage"); await sleep(400); await cdp.send("HeapProfiler.collectGarbage"); await sleep(400);
    const heap = await cdp.send("Runtime.getHeapUsage"), dom = await cdp.send("Memory.getDOMCounters");
    let detached = null; try { const d = await cdp.send("DOM.getDetachedDomNodes"); const count = (n) => 1 + (n.children || []).reduce((a, c) => a + count(c), 0); detached = d.detachedNodes.reduce((a, n) => a + count(n.treeNode), 0); } catch (_) {}
    const frames = [];
    for (const f of page.frames()) { try { const r = await f.evaluate(() => (window.__rm1 ? window.__rm1.report() : null)); if (r) frames.push(r); } catch (_) {} }
    const s = { lap, at: new Date().toISOString(), heapUsed: heap.usedSize, backingStores: heap.backingStorageSize ?? null, nodes: dom.nodes, documents: dom.documents, listeners: dom.jsEventListeners, detached,
      intervals: frames.reduce((a, f) => a + f.timers.intervalsActive, 0), timeoutsPending: frames.reduce((a, f) => a + f.timers.timeoutsPending, 0),
      canvases: frames.reduce((a, f) => a + f.canvases.live, 0), canvasesDetached: frames.reduce((a, f) => a + f.canvases.detached, 0), frameCount: page.frames().length, frames };
    fs.appendFileSync(path.join(OUT, "laps.jsonl"), JSON.stringify(s) + "\n");
    log("lap " + String(lap).padStart(2), "heap", (s.heapUsed / 1048576).toFixed(1) + "MB", "nodes", s.nodes, "docs", s.documents, "listeners", s.listeners, "intervals", s.intervals, "timeouts", s.timeoutsPending, "canvases", s.canvases + "(" + s.canvasesDetached + " detached)", "detachedNodes", s.detached, "frames", s.frameCount);
  };
  fs.writeFileSync(path.join(OUT, "laps.jsonl"), "");
  await sample(0);
  const home = await page.evaluate(() => (typeof S !== "undefined" && S.coh) || null);
  for (let lap = 1; lap <= LAPS; lap++) {
    const names = await page.evaluate(() => [...document.querySelectorAll('.sc-board__row[data-t]')].slice(0, 5).map((n) => n.dataset.t));
    for (const t of names) await click('.sc-board__row[data-t="' + t + '"] .sc-ctk', "company");
    for (const r of rooms) if (r !== "DASHBOARD") await click('[data-act="mtab"][data-sec="' + r + '"]', "room " + r);
    await click('[data-act="mtab"][data-sec="DASHBOARD"]', "room DASHBOARD");
    for (const c of cohorts.filter((c) => c !== home).slice(0, 3)) await click('[data-act="coh"][data-key="' + c + '"]', "list " + c);
    if (home) await click('[data-act="coh"][data-key="' + home + '"]', "list " + home + " (home)");
    await sleep(3000);
    await sample(lap);
    if (lap === 2) await takeSnapshot(path.join(OUT, "lap2.heapsnapshot"));
  }
  await takeSnapshot(path.join(OUT, "end.heapsnapshot"));
  log("presses that found no control:", JSON.stringify(skipped));
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ name: NAME, url: urlKey(URL_), laps: LAPS, rooms, cohorts, tickers, home, skipped, blocked, errors, override: OVERRIDE ? [...overrides.keys()] : null }, null, 1));
  await page.screenshot({ path: path.join(OUT, "shot-end.jpg"), type: "jpeg", quality: 60 }).catch(() => {});
  log("done; blocked non-GET:", JSON.stringify(blocked));
} finally { await browser.close(); }
