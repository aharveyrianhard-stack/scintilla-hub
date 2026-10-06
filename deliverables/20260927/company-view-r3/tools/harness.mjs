/* R3 copy of D2's harness: with no stationRoot the Station frame is the LIVE Station (only the Hub is local).
   D2 — headless proof harness for the company view (never a visible window: Alan, 24 Sep).
   node harness.mjs job.json  → prints one JSON line per step.
   target "live"  : https://scintillahub.ai as deployed (its Station frame is the live Station).
   target "local" : the SAME hostnames, but https://scintillahub.ai/* is served from HUB_ROOT and
                    https://station.scintillahub.ai/* from STATION_ROOT (the two branches), so the
                    chart API sees its real origins and nothing needs relaxing. /api/* GETs go to the
                    live Hub. In BOTH targets every non-GET request (Supabase writes, /api POSTs) is
                    answered locally with an empty 201 and recorded, never sent.
   Measures: time from openCo(<t>) to the Station frame's clouds being drawn (host._cloudMap), and to
   its RSI pane being drawn (host._rsiMemo with values); CPU-seconds per minute of the whole headless
   browser process tree (ps), the same method as D1's eval-measure. */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writes = [];
function localFile(root, pathname) {
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const server = await chromium.launchServer({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const browserPid = String(server.process().pid);
const browser = await chromium.connect(server.wsEndpoint());
function treeCpu() {
  const rows = execSync("ps -axo pid=,ppid=,time=").toString().trim().split("\n").map((l) => l.trim().split(/\s+/));
  const kids = new Map(); for (const [p, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  const t = new Map(rows.map(([p, , tm]) => [p, tm]));
  const toS = (s) => { const [a, b] = s.split("."); let v = 0; for (const x of a.split(":").map(Number)) v = v * 60 + x; return v + (b ? Number("0." + b) : 0); };
  let sum = 0; const st = [browserPid];
  while (st.length) { const p = st.pop(); if (t.has(p)) sum += toS(t.get(p)); for (const k of kids.get(p) || []) st.push(k); }
  return sum;
}
const out = { job: job.name, target: job.target, results: [], writes };
try {
  const context = await browser.newContext({ viewport: { width: job.width || 1680, height: job.height || 1050 }, deviceScaleFactor: 1,
    serviceWorkers: "block", isMobile: !!job.mobile, hasTouch: !!job.mobile });
  if (job.localStorage) await context.addInitScript((kv) => { try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch (_) {} }, job.localStorage);
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      writes.push({ method: m, url: u.host + u.pathname });
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
    }
    if (job.target === "local" && (u.host === "scintillahub.ai" || (u.host === "station.scintillahub.ai" && job.stationRoot))) {
      if (u.host === "scintillahub.ai" && u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(u.host === "scintillahub.ai" ? job.hubRoot : job.stationRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  /* the chart API calls, with when they started and ended (ms since the last "open") */
  const api = []; let openAt = 0; const started = new Map();
  if (job.apiLog) {
    page.on("request", (r) => { if (/massive-chart-api/.test(r.url())) started.set(r, Date.now()); });
    const done = (r, ok) => { const t0 = started.get(r); if (t0 == null || !openAt) return; const u = new URL(r.url());
      api.push({ path: u.pathname + "?" + [...u.searchParams].filter(([k]) => k !== "authority").map(([k, v]) => k + "=" + v).join("&"), from: /station/.test(r.frame() && r.frame().url() || "") ? "frame" : "hub",
        start: t0 - openAt, end: Date.now() - openAt, ok }); };
    page.on("requestfinished", (r) => done(r, true)); page.on("requestfailed", (r) => done(r, false));
  }
  const frameProbe = async () => {
    const f = page.frames().find((x) => /station\.scintillahub\.ai\/chart\//.test(x.url()));
    if (!f) return null;
    try {
      return await f.evaluate(() => {
        const host = [...document.querySelectorAll("[data-t]")].find((e) => e._series) || null;
        if (!host) return { host: false };
        const fan = host._rsiMemo; const rsi = !!(fan && fan.lines && fan.lines.some((l) => l.values && l.values.some((v) => v != null)));
        return { host: true, t: host.dataset.t, bars: host._series ? host._series.length : 0, clouds: !!(host._cloudMap && host._cloudMap.map),
          rsi, rsiLines: fan ? fan.lines.map((l) => l.key) : [], range: host._range || null };
      });
    } catch (_) { return null; }
  };
  await page.goto("https://scintillahub.ai" + (job.path || "/"), { waitUntil: "domcontentloaded", timeout: 60000 });   /* R3 — job.path: e.g. /preview/company-view/ */
  for (const s of job.steps) {
    const r = { step: s.do };
    if (s.do === "wait") await sleep(s.ms);
    else if (s.do === "waitFor") { try { await page.waitForSelector(s.sel, { timeout: s.ms || 30000 }); r.ok = true; } catch (_) { r.ok = false; } }
    else if (s.do === "eval") r.value = await page.evaluate(s.js);
    else if (s.do === "key") { await page.keyboard.press(s.key); }
    else if (s.do === "click") { try { await page.click(s.sel, { timeout: 5000 }); r.ok = true; } catch (e) { r.ok = false; r.err = String(e.message).slice(0, 120); } }
    else if (s.do === "open") {
      /* the board row if it is on screen, otherwise the same function the row calls */
      const t0 = Date.now(); openAt = t0;
      r.how = await page.evaluate((t) => { const row = document.querySelector('.sc-board__row[data-t="' + t + '"]');
        if (row) { row.click(); return "row"; }
        /* Q5 (5 Oct): openCo is the PAGE's function (index.html), reached here inside the browser. It is named through
           globalThis so the reference is explicit, and a page that does not carry it answers by name instead of throwing. */
        if (typeof globalThis.openCo !== "function") return "NO_OPENCO_ON_PAGE";
        globalThis.openCo(t); return "openCo"; }, s.t);
      if (s.clouds) {
        let firstFrame = null, clouds = null, rsi = null, last = null;
        while (Date.now() - t0 < (s.ms || 40000)) {
          last = await frameProbe();
          if (last && last.host && last.bars && firstFrame == null) firstFrame = Date.now() - t0;
          if (last && last.clouds && clouds == null) clouds = Date.now() - t0;
          if (last && last.rsi && rsi == null) rsi = Date.now() - t0;
          if (clouds != null && (rsi != null || !s.rsi)) break;
          await sleep(100);
        }
        Object.assign(r, { priceMs: firstFrame, cloudsMs: clouds, rsiMs: rsi, probe: last });
      }
    }
    else if (s.do === "probe") r.probe = await frameProbe();
    else if (s.do === "shot") { await page.screenshot({ path: s.file, type: s.file.endsWith(".jpg") ? "jpeg" : "png", fullPage: !!s.full, ...(s.file.endsWith(".jpg") ? { quality: 82 } : {}) }); r.file = s.file;
      r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); }
    else if (s.do === "rects") r.rects = await page.evaluate((sels) => { const o = {}; for (const [k, sel] of Object.entries(sels)) { const e = document.querySelector(sel);
        if (!e) { o[k] = null; continue; } const b = e.getBoundingClientRect(); o[k] = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), text: (e.innerText || "").replace(/\s+/g, " ").slice(0, 160) }; } return o; }, s.sels);
    else if (s.do === "cpu") { const a = treeCpu(), t0 = Date.now(); await sleep(s.secs * 1000); const b = treeCpu(); r.cpuSPerMin = +((b - a) / ((Date.now() - t0) / 60000)).toFixed(2); }
    else if (s.do === "scroll") r.value = await page.evaluate((a) => { const e = document.querySelector(a.sel); if (!e) return null; e.scrollTop = a.top || 0; return e.scrollHeight + "/" + e.clientHeight; }, s);
    else if (s.do === "frameReloads") r.value = await page.evaluate(() => window.__frameLoads || null);
    out.results.push(r);
  }
  out.errors = errors; if (job.apiLog) out.api = api.sort((a, b) => a.start - b.start);
} catch (e) { out.error = String(e && e.stack || e).slice(0, 600); }
finally { await browser.close().catch(() => {}); await server.close().catch(() => {}); }
console.log(JSON.stringify(out));
