/* L2 CHART-SPEED — headless waterfall harness (never a visible window: Alan, 24 Sep).
   node speed.mjs job.json  → one JSON object on stdout.

   job = { name, target:"live"|"local", hubRoot?, stationRoot?, scenario:"hub"|"station",
           t:"MU", openAfterMs:0|20000, how:"row"|"early", stationPath:"/deck/?scene=targets3D",
           runs:["cold","warm"], watchMs:30000, width:1680, height:1050 }

   target "live"  : scintillahub.ai and station.scintillahub.ai exactly as deployed.
   target "local" : the SAME hostnames, but https://scintillahub.ai/* is served from hubRoot and
                    https://station.scintillahub.ai/* from stationRoot (when given), so the chart API sees
                    its real origins and no cross-origin check is relaxed. /api/* GETs go to the live Hub.
   Both targets: every non-GET (Supabase writes, /api POSTs) is answered locally with an empty 201 and
   recorded, never sent.

   cold = a brand-new browser profile (empty HTTP cache, empty localStorage).
   warm = the SAME profile, page reloaded (HTTP cache + localStorage kept from the cold run).

   Records, relative to the moment the chart was asked for (the click / openCo, or page start on the Station):
     · every request (chart API, Supabase, Station/Hub documents & scripts, other) with start, end, bytes on the
       wire, and whether the browser served it from its own cache (CDP Network events);
     · for each chart frame: when the price line, clouds, RSI fan (lines with values), lens and Geiger chip first
       appeared (polling the frame's own host object every 50 ms);
     · main-thread busy time: long tasks (>50 ms) summed per frame, plus CDP TaskDuration for the renderer. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon", ".woff2": "font/woff2" };
function localFile(root, pathname) {
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
function kind(u) {
  if (/massive-chart-api/.test(u.host)) return "chartapi";
  if (/supabase\.co$/.test(u.host)) return "supabase";
  if (u.host === "station.scintillahub.ai") return "station";
  if (u.host === "scintillahub.ai") return "hub";
  return "other";
}
const writes = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const out = { job: job.name, target: job.target, scenario: job.scenario, at: new Date().toISOString(), runs: [], writes };
try {
  const context = await browser.newContext({ viewport: { width: job.width || 1680, height: job.height || 1050 }, deviceScaleFactor: 1,
    serviceWorkers: "block" });
  /* Station rotation paused so the page under test stays the page under test (per-browser setting, this profile only). */
  await context.addInitScript((extra) => {
    try { if (location.host === "station.scintillahub.ai") { localStorage.setItem("station.rotate.paused", "1"); } } catch (_) {}
    try { for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v); } catch (_) {}
    window.__lt = { sum: 0, n: 0, max: 0, list: [] };
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.sum += e.duration; window.__lt.n++;
        window.__lt.max = Math.max(window.__lt.max, e.duration); if (window.__lt.list.length < 400) window.__lt.list.push([Math.round(performance.timeOrigin + e.startTime), Math.round(e.duration)]); } })
        .observe({ type: "longtask", buffered: true });
    } catch (_) {}
  }, job.localStorage || {});
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      writes.push({ method: m, url: u.host + u.pathname });
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
    }
    if (job.target === "local" && ((u.host === "scintillahub.ai" && job.hubRoot) || (u.host === "station.scintillahub.ai" && job.stationRoot))) {
      if (u.host === "scintillahub.ai" && u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(u.host === "scintillahub.ai" ? job.hubRoot : job.stationRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream",
        "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });

  for (const runKind of job.runs || ["cold", "warm"]) {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Performance.enable");
    const reqs = new Map();
    let T0 = 0;   /* wall-clock ms of "the chart was asked for" */
    let NAV = Date.now();
    cdp.on("Network.requestWillBeSent", (e) => {
      if (reqs.has(e.requestId)) return;
      let u; try { u = new URL(e.request.url); } catch (_) { return; }
      if (u.protocol === "data:" || u.protocol === "blob:") return;
      reqs.set(e.requestId, { url: u.host + u.pathname + (u.search ? u.search.replace(/&authority=provider/, "") : ""), kind: kind(u),
        method: e.request.method, wall: Date.now(), end: null, bytes: 0, cache: false, status: null, frame: e.frameId });
    });
    cdp.on("Network.requestServedFromCache", (e) => { const r = reqs.get(e.requestId); if (r) r.cache = true; });
    cdp.on("Network.responseReceived", (e) => { const r = reqs.get(e.requestId); if (!r) return; r.status = e.response.status;
      if (e.response.fromDiskCache || e.response.fromPrefetchCache) r.cache = true;
      r.ttfbWall = Date.now(); });
    cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (!r) return; r.end = Date.now(); r.bytes = e.encodedDataLength; });
    cdp.on("Network.loadingFailed", (e) => { const r = reqs.get(e.requestId); if (!r) return; r.end = Date.now(); r.failed = e.errorText; });
    const errors = []; page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
    const perf0 = await cdp.send("Performance.getMetrics");

    /* per-frame milestone probe */
    const firstSeen = {};   /* frameKey → { price, clouds, fan1, fan6, lens, geiger } (ms after T0) */
    const probeFrames = async () => {
      const frames = page.frames().filter((f) => /station\.scintillahub\.ai\/(chart\/|station-shells\/chart-v1)/.test(f.url()));
      await Promise.all(frames.map(async (f) => {
        let st; try {
          st = await f.evaluate(() => {
            const host = document.querySelector(".sc-nchart[data-t]");
            if (!host) return null;
            const fan = host._rsiMemo;
            const fanLines = fan && fan.lines ? fan.lines.filter((l) => l.values && l.values.some((v) => v != null)).length : 0;
            const g = host.querySelector(".sc-nchart__live-geiger");
            return { t: host.dataset.t, price: !!(host._series && host._series.length > 1 && host._plot), cached: !!host._paintedFromCache,
              clouds: !!(host._cloudMap && (host._cloudMap.map || host._cloudMap.lines || host._cloudMap.length)),
              cloudRows: !!(host._cloudRows && host._cloudRows.length), fanLines, fanWanted: fan && fan.lines ? fan.lines.length : 0,
              lens: !!(host._lens && (host._lens.spot || host._lens.drawn || host._lens.bars)),
              geiger: !!(g && !g.hidden && g.style.visibility === "visible"),
              lt: window.__lt ? { sum: Math.round(window.__lt.sum), n: window.__lt.n, max: Math.round(window.__lt.max) } : null };
          });
        } catch (_) { return; }
        if (!st) return;
        const key = f.url().replace(/^https:\/\/station\.scintillahub\.ai/, "").slice(0, 160);
        const now = Date.now() - T0;
        const s = firstSeen[key] || (firstSeen[key] = { t: st.t });
        s.last = st;
        if (st.price && s.price == null) s.price = now;
        if ((st.clouds || st.cloudRows) && s.clouds == null) s.clouds = now;
        if (st.fanLines >= 1 && s.fan1 == null) s.fan1 = now;
        if (st.fanWanted && st.fanLines >= st.fanWanted && s.fanAll == null) s.fanAll = now;
        if (st.lens && s.lens == null) s.lens = now;
        if (st.geiger && s.geiger == null) s.geiger = now;
      }));
    };

    const run = { run: runKind };
    if (job.scenario === "hub") {
      NAV = Date.now();
      await page.goto("https://scintillahub.ai" + (job.hubPath || "/"), { waitUntil: "commit", timeout: 60000 });
      if (job.openAfterMs) await sleep(job.openAfterMs);
      /* wait until the page can open a company: the board row (how:"row") or openCo existing (how:"early") */
      const readyBy = Date.now() + 30000;
      let how = null;
      while (Date.now() < readyBy) {
        how = await page.evaluate(({ t, mode }) => {
          const row = document.querySelector('.sc-board__row[data-t="' + t + '"]');
          if (mode === "row" && row) return "row";
          if (mode === "early" && typeof window.openCo === "function") return row ? "row" : "openCo";
          return null;
        }, { t: job.t, mode: job.how || "row" }).catch(() => null);
        if (how) break;
        await sleep(50);
      }
      run.pageReadyMs = Date.now() - NAV;
      T0 = Date.now();
      run.how = await page.evaluate((t) => { const row = document.querySelector('.sc-board__row[data-t="' + t + '"]');
        if (row) { row.click(); return "row"; } if (typeof openCo === "function") { openCo(t); return "openCo"; } return "none"; }, job.t).catch((e) => "err " + e.message);
    } else {
      NAV = Date.now(); T0 = NAV;
      await page.goto("https://station.scintillahub.ai" + (job.stationPath || "/deck/?scene=targets3D"), { waitUntil: "commit", timeout: 60000 });
    }
    const until = T0 + (job.watchMs || 30000);
    while (Date.now() < until) { await probeFrames(); await sleep(50); }
    const perf1 = await cdp.send("Performance.getMetrics");
    const metric = (m, k) => (m.metrics.find((x) => x.name === k) || {}).value || 0;
    run.taskSeconds = +(metric(perf1, "TaskDuration") - metric(perf0, "TaskDuration")).toFixed(2);
    run.scriptSeconds = +(metric(perf1, "ScriptDuration") - metric(perf0, "ScriptDuration")).toFixed(2);
    run.topLongTasks = await page.evaluate(() => window.__lt ? { sum: Math.round(window.__lt.sum), n: window.__lt.n, max: Math.round(window.__lt.max) } : null).catch(() => null);
    run.frames = firstSeen;
    run.requests = [...reqs.values()].map((r) => ({ kind: r.kind, url: r.url.slice(0, 180), method: r.method,
      start: r.wall - T0, ttfb: r.ttfbWall ? r.ttfbWall - T0 : null, end: r.end ? r.end - T0 : null, bytes: r.bytes, cache: r.cache, status: r.status, failed: r.failed || undefined }))
      .sort((a, b) => a.start - b.start);
    run.summary = {};
    for (const k of ["chartapi", "supabase", "station", "hub", "other"]) {
      const rs = run.requests.filter((r) => r.kind === k);
      const win = rs.filter((r) => r.start >= -1000 && r.start <= 10000);
      run.summary[k] = { total: rs.length, inFirst10s: win.length, bytes: rs.reduce((a, r) => a + (r.bytes || 0), 0), cached: rs.filter((r) => r.cache).length };
    }
    run.errors = errors;
    out.runs.push(run);
    await page.close();
  }
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await browser.close().catch(() => {}); }
console.log(JSON.stringify(out));
