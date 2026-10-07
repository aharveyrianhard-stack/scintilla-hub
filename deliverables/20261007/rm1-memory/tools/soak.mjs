#!/usr/bin/env node
// RM1 soak harness — leaves one page open in HEADLESS Chromium and measures, every N minutes,
// what a left-open window accumulates: JS heap, DOM nodes, detached nodes, listeners, timers,
// canvases, sockets, request loops and the real process memory (what Activity Monitor shows).
//
//   node soak.mjs --name hub-before --url https://scintillahub.ai/ --minutes 90 --interval 5 --out <dir>
//        [--override map.json]   serve named URLs from local files (the "after" run of a branch)
//        [--no-snapshots]        skip the two heap snapshots (quick probes)
//        [--click <selector>]    one click after load, for a view that needs opening (a company page)
//
// Safety: headless is hard-coded; every non-GET request is blocked and counted; service workers
// are blocked so nothing can bypass that; nothing is typed, clicked or saved.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const NAME = String(arg("name", "soak"));
const URL_ = String(arg("url"));
const MINUTES = Number(arg("minutes", 90));
const INTERVAL = Number(arg("interval", 5));
const SETTLE_S = Number(arg("settle", 120));
const OUT = path.resolve(String(arg("out", "./out-" + NAME)));
const SNAPSHOTS = !arg("no-snapshots", false);
const OVERRIDE = arg("override", null);
const CLICK = arg("click", null);          // one read-only click after load (e.g. open a company from its board row)
const VIEW_W = Number(arg("width", 1680)), VIEW_H = Number(arg("height", 1050)), DSF = Number(arg("dsf", 2));
const HERE = path.dirname(new URL(import.meta.url).pathname);

fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), "[" + NAME + "]", ...a);

// Never let a credential reach a log or a file: no query strings, no tokens.
const scrub = (s) => String(s)
  .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<jwt>")
  .replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, "<sbkey>")
  .replace(/((?:api_?key|key|token|access_token|authorization|code|pair)=)[^&\s"']+/gi, "$1<redacted>")
  .replace(/(https?:\/\/[^\s?"']+)\?[^\s"')]*/g, "$1?…");
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return "(bad url)"; } };
const bump = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const overrides = new Map();
if (OVERRIDE) {
  const raw = JSON.parse(fs.readFileSync(String(OVERRIDE), "utf8"));
  for (const [u, file] of Object.entries(raw)) overrides.set(urlKey(u), file);
}
const mime = (file) => file.endsWith(".js") || file.endsWith(".mjs") ? "text/javascript; charset=utf-8"
  : file.endsWith(".css") ? "text/css; charset=utf-8" : file.endsWith(".json") ? "application/json" : "text/html; charset=utf-8";

const net = { blockedNonGet: {}, requests: {}, requestsTotal: 0, failed: {}, served: {}, ws: {}, wsOpen: 0, wsSent: {}, wsFramesIn: 0 };
const pageEvents = { errors: {}, console: {}, crashed: false };

let browser;
const shutdown = async (code) => { try { if (browser) await browser.close(); } catch (_) {} process.exit(code); };
process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

const rssByPid = (pids) => {
  if (!pids.length) return {};
  try {
    const out = execFileSync("ps", ["-o", "pid=,rss=", "-p", pids.join(",")], { encoding: "utf8" });
    const map = {};
    for (const line of out.trim().split("\n")) { const [pid, rss] = line.trim().split(/\s+/); map[pid] = Number(rss) * 1024; }
    return map;
  } catch (_) { return {}; }
};

async function takeSnapshot(cdp, file) {
  const stream = fs.createWriteStream(file);
  const onChunk = ({ chunk }) => stream.write(chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  const t = Date.now();
  await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await new Promise((r) => stream.end(r));
  log("heap snapshot", path.basename(file), (fs.statSync(file).size / 1048576).toFixed(1) + " MB in", ((Date.now() - t) / 1000).toFixed(1) + "s");
}

async function main() {
  browser = await chromium.launch({
    headless: true,                              // never a visible window on this Mac
    args: ["--enable-precise-memory-info", "--autoplay-policy=no-user-gesture-required", "--mute-audio"]
  });
  const context = await browser.newContext({
    viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: DSF,
    serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
  });
  await context.addInitScript({ path: path.join(HERE, "instrument.js") });

  await context.route("**/*", async (route) => {
    const req = route.request();
    const key = urlKey(req.url());
    if (req.method() !== "GET") { bump(net.blockedNonGet, req.method() + " " + key); return route.abort("blockedbyclient"); }
    const local = overrides.get(key);
    if (local) {
      bump(net.served, key);
      return route.fulfill({ status: 200, contentType: mime(local), headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) });
    }
    return route.continue();
  });

  const page = await context.newPage();
  page.on("request", (r) => { net.requestsTotal++; bump(net.requests, r.method() + " " + urlKey(r.url())); });
  page.on("requestfailed", (r) => bump(net.failed, urlKey(r.url()) + " :: " + scrub((r.failure() || {}).errorText || "")));
  page.on("websocket", (ws) => {
    const key = urlKey(ws.url());
    bump(net.ws, key + " opened"); net.wsOpen++;
    ws.on("close", () => { bump(net.ws, key + " closed"); net.wsOpen--; });
    ws.on("framereceived", () => { net.wsFramesIn++; });
    ws.on("framesent", (f) => {
      let kind = "other";
      try { const j = JSON.parse(typeof f.payload === "string" ? f.payload : ""); kind = String(j.event || j.type || (Array.isArray(j) ? j[3] : "") || "json"); } catch (_) {}
      bump(net.wsSent, key + " :: " + kind);
    });
  });
  page.on("pageerror", (e) => bump(pageEvents.errors, scrub(String(e && e.message || e)).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") bump(pageEvents.console, scrub(m.text()).replace(/\d+/g, "#").slice(0, 160)); });
  page.on("crash", () => { pageEvents.crashed = true; log("PAGE CRASHED"); });

  const cdp = await context.newCDPSession(page);
  const bcdp = await browser.newBrowserCDPSession();
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.enable");

  log("loading", urlKey(URL_), "viewport", VIEW_W + "x" + VIEW_H + "@" + DSF, OVERRIDE ? "(branch files served over the live origin)" : "(live)");
  await page.goto(URL_, { waitUntil: "load", timeout: 180000 });
  if (CLICK) {
    await sleep(25000);
    await page.click(String(CLICK), { timeout: 30000 });
    log("clicked", String(CLICK));
  }
  log("loaded ->", urlKey(page.url()), "; settling", SETTLE_S + "s");
  await sleep(SETTLE_S * 1000);

  const samplesFile = path.join(OUT, "samples.jsonl");
  fs.writeFileSync(samplesFile, "");
  let lastReq = 0, lastWsIn = 0, lastReqMap = {};
  const t0 = Date.now();

  const sample = async (index) => {
    const s = { index, minute: +((Date.now() - t0) / 60000).toFixed(2), at: new Date().toISOString() };
    const before = await cdp.send("Runtime.getHeapUsage");
    await cdp.send("HeapProfiler.collectGarbage"); await sleep(400);
    await cdp.send("HeapProfiler.collectGarbage"); await sleep(400);
    const after = await cdp.send("Runtime.getHeapUsage");
    s.heap = { usedBeforeGC: before.usedSize, used: after.usedSize, total: after.totalSize,
      backingStores: after.backingStorageSize ?? null, embedder: after.embedderHeapUsedSize ?? null };
    const pm = {}; for (const m of (await cdp.send("Performance.getMetrics")).metrics) pm[m.name] = m.value;
    s.perf = { nodes: pm.Nodes, documents: pm.Documents, frames: pm.Frames, listeners: pm.JSEventListeners, layoutObjects: pm.LayoutObjects,
      resources: pm.Resources, scriptSeconds: pm.ScriptDuration, taskSeconds: pm.TaskDuration, layoutCount: pm.LayoutCount, recalcStyleCount: pm.RecalcStyleCount };
    try { s.domCounters = await cdp.send("Memory.getDOMCounters"); } catch (e) { s.domCounters = null; }
    try {
      const d = await cdp.send("DOM.getDetachedDomNodes");
      const count = (n) => 1 + (n.children || []).reduce((a, c) => a + count(c), 0);
      s.detached = { roots: d.detachedNodes.length, nodes: d.detachedNodes.reduce((a, n) => a + count(n.treeNode), 0),
        top: d.detachedNodes.map((n) => ({ tag: n.treeNode.nodeName, n: count(n.treeNode),
          attrs: scrub((n.treeNode.attributes || []).join(" ")).slice(0, 80) })).sort((a, b) => b.n - a.n).slice(0, 12) };
    } catch (e) { s.detached = { error: String(e.message || e).slice(0, 80) }; }

    s.frames = [];
    for (const f of page.frames()) {
      try { const r = await f.evaluate(() => (window.__rm1 ? window.__rm1.report() : null)); if (r) s.frames.push(r); else s.frames.push({ href: urlKey(f.url()), thirdParty: true }); }
      catch (e) { s.frames.push({ href: urlKey(f.url()), error: String(e.message || e).slice(0, 80) }); }
    }
    const own = s.frames.filter((f) => f.dom);
    s.totals = {
      frames: s.frames.length, ownFrames: own.length,
      attachedElements: own.reduce((a, f) => a + f.dom.elements, 0),
      intervalsActive: own.reduce((a, f) => a + f.timers.intervalsActive, 0),
      timeoutsPending: own.reduce((a, f) => a + f.timers.timeoutsPending, 0),
      listenerAdds: own.reduce((a, f) => a + f.listeners.adds, 0),
      listenerRemoves: own.reduce((a, f) => a + f.listeners.removes, 0),
      canvasesLive: own.reduce((a, f) => a + f.canvases.live, 0),
      canvasesDetached: own.reduce((a, f) => a + f.canvases.detached, 0),
      canvasPixels: own.reduce((a, f) => a + f.canvases.pixels, 0),
      canvasDomCount: own.reduce((a, f) => a + f.dom.canvases, 0),
      iframes: own.reduce((a, f) => a + f.dom.iframes, 0)
    };
    if (s.domCounters) s.totals.detachedEstimate = s.domCounters.nodes - s.totals.attachedElements;

    try {
      const info = await bcdp.send("SystemInfo.getProcessInfo");
      const rss = rssByPid(info.processInfo.map((p) => p.id));
      const byType = {}; const renderers = [];
      for (const p of info.processInfo) { const v = rss[p.id] || 0; bump(byType, p.type, v); if (p.type === "renderer") renderers.push(v); }
      s.process = { rssTotal: Object.values(byType).reduce((a, b) => a + b, 0), rssByType: byType,
        renderers: renderers.sort((a, b) => b - a), cpuSeconds: info.processInfo.reduce((a, p) => a + p.cpuTime, 0) };
      const targets = (await bcdp.send("Target.getTargets")).targetInfos;
      s.targets = {}; for (const t of targets) bump(s.targets, t.type);
    } catch (e) { s.process = { error: String(e.message || e).slice(0, 80) }; }

    const reqDelta = {};
    for (const [k, v] of Object.entries(net.requests)) { const d = v - (lastReqMap[k] || 0); if (d) reqDelta[k] = d; }
    lastReqMap = { ...net.requests };
    s.net = { requestsTotal: net.requestsTotal, requestsSinceLast: net.requestsTotal - lastReq, wsOpen: net.wsOpen,
      wsFramesInSinceLast: net.wsFramesIn - lastWsIn, blockedNonGetTotal: Object.values(net.blockedNonGet).reduce((a, b) => a + b, 0),
      topRequestsSinceLast: Object.entries(reqDelta).sort((a, b) => b[1] - a[1]).slice(0, 25) };
    lastReq = net.requestsTotal; lastWsIn = net.wsFramesIn;
    s.pageErrors = Object.values(pageEvents.errors).reduce((a, b) => a + b, 0);
    s.consoleErrors = Object.values(pageEvents.console).reduce((a, b) => a + b, 0);

    fs.appendFileSync(samplesFile, JSON.stringify(s) + "\n");
    const mb = (b) => (b / 1048576).toFixed(1);
    log("t=" + String(s.minute).padStart(5), "heap", mb(s.heap.used) + "MB", "nodes", s.domCounters ? s.domCounters.nodes : "?",
      "attached", s.totals.attachedElements, "detached", s.detached.nodes ?? ("~" + s.totals.detachedEstimate), "listeners", s.domCounters ? s.domCounters.jsEventListeners : "?",
      "intervals", s.totals.intervalsActive, "timeouts", s.totals.timeoutsPending, "canvases", s.totals.canvasesLive + "(" + (s.totals.canvasPixels / 1e6).toFixed(1) + "Mpx)",
      "frames", s.totals.frames, "ws", s.net.wsOpen, "req+", s.net.requestsSinceLast, "rss", s.process.rssTotal ? mb(s.process.rssTotal) + "MB" : "?");
    return s;
  };

  await page.screenshot({ path: path.join(OUT, "shot-start.jpg"), type: "jpeg", quality: 70 }).catch((e) => log("screenshot failed", e.message));
  await sample(0);
  if (SNAPSHOTS) await takeSnapshot(cdp, path.join(OUT, "start.heapsnapshot"));
  await cdp.send("HeapProfiler.startSampling", { samplingInterval: 16384, includeObjectsCollectedByMajorGC: false, includeObjectsCollectedByMinorGC: false });

  const ticks = Math.round(MINUTES / INTERVAL);
  for (let i = 1; i <= ticks; i++) {
    const due = t0 + i * INTERVAL * 60000;
    while (Date.now() < due) await sleep(Math.min(5000, Math.max(50, due - Date.now())));
    if (pageEvents.crashed) break;
    await sample(i);
  }

  try {
    const prof = await cdp.send("HeapProfiler.getSamplingProfile");
    fs.writeFileSync(path.join(OUT, "sampling-profile.json"), scrub(JSON.stringify(prof.profile)));
    await cdp.send("HeapProfiler.stopSampling");
  } catch (e) { log("sampling profile failed", e.message); }
  await page.screenshot({ path: path.join(OUT, "shot-end.jpg"), type: "jpeg", quality: 70 }).catch((e) => log("screenshot failed", e.message));
  if (SNAPSHOTS && !pageEvents.crashed) await takeSnapshot(cdp, path.join(OUT, "end.heapsnapshot"));

  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ name: NAME, url: urlKey(URL_), finalUrl: urlKey(page.url()), minutes: MINUTES,
    interval: INTERVAL, settleSeconds: SETTLE_S, click: CLICK || null, viewport: [VIEW_W, VIEW_H, DSF], override: OVERRIDE ? [...overrides.keys()] : null,
    startedAt: new Date(t0).toISOString(), endedAt: new Date().toISOString(), net, pageEvents }, null, 1));
  log("done; blocked non-GET requests:", JSON.stringify(net.blockedNonGet));
  await browser.close();
}

main().catch(async (e) => { console.error("[" + NAME + "] FAILED", scrub(e && e.stack || e)); await shutdown(1); });
