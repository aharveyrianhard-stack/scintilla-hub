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
const out = { label, W, H, DSF, CPU, at: new Date().toISOString(), index: INDEX_FILE || "branch", cohorts: {}, writes, errors };

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
const summarize = (rec, m0, m1) => {
  const f = rec.frames.slice().sort((a, b) => a - b), n = f.length;
  const q = (p) => n ? +f[Math.min(n - 1, Math.floor(p * n))].toFixed(1) : null;
  const span = rec.frames.reduce((a, b) => a + b, 0);
  return { frames: n, fps: span ? +(n / (span / 1000)).toFixed(1) : null, medianMs: q(0.5), p95Ms: q(0.95), worstMs: n ? +f[n - 1].toFixed(1) : null,
    over50: f.filter((x) => x > 50).length,
    longTasks: rec.long.length, longMs: Math.round(rec.long.reduce((a, b) => a + b, 0)), longMax: rec.long.length ? Math.round(Math.max(...rec.long)) : 0,
    styleMs: Math.round((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000), layoutMs: Math.round((m1.LayoutDuration - m0.LayoutDuration) * 1000),
    scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000), taskMs: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000) };
};
const boardBox = async () => page.evaluate(() => { const b = document.getElementById("boardScroll").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
const wheel = async (ms, dy = 90, every = 50) => { const t0 = Date.now(); let dir = 1, i = 0; while (Date.now() - t0 < ms) { await page.mouse.wheel(0, dir * dy); if (++i % 20 === 0) dir = -dir; await sleep(every); } };

try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 90000 }).catch(() => {});
  await sleep(4000);
  await page.evaluate(RECORDER);
  if (process.env.HIDE_AFTER) await page.addStyleTag({ content: "#boardScroll > .sc-board__row:nth-child(n+" + (2 + +process.env.HIDE_AFTER) + "){display:none !important}" });
  if (process.env.NOANIM) await page.addStyleTag({ content: "*,*::before,*::after{animation:none !important;transition:none !important}" });
  out.rankReady = await page.evaluate(() => window.SC_RANK_READY === true);
  for (const coh of COHORTS) {
    const r = { };
    await page.evaluate((k) => { const b = document.querySelector('[data-act="coh"][data-key="' + k + '"]'); if (b) b.click(); else { S.coh = k; restartFeed(); } }, coh);
    await page.waitForFunction(() => document.querySelectorAll("#boardScroll .sc-board__row").length > 0 && !S.boardPending, null, { timeout: 60000 }).catch(() => {});
    await sleep(5000);
    r.rows = await page.evaluate(() => document.querySelectorAll("#boardScroll .sc-board__row").length);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    const bb = await boardBox();
    const px = bb.x + bb.w * 0.4, py = bb.y + Math.min(bb.h * 0.35, 300);
    /* (a) scroll */
    await page.mouse.move(px, py); await sleep(800);
    let m0 = await metrics(); await page.evaluate(() => __h10.start());
    if (process.env.PROFILE && coh === "ALL") { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
    await wheel(4000);
    if (process.env.PROFILE && coh === "ALL") {
      const { profile } = await cdp.send("Profiler.stop"); const self = {}; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const dt = profile.timeDeltas; const cnt = {}; profile.samples.forEach((id, i) => { cnt[id] = (cnt[id] || 0) + (dt[i] || 0); });
      for (const [id, us] of Object.entries(cnt)) { const n = byId.get(+id); const k = n.callFrame.functionName + "@" + n.callFrame.lineNumber; self[k] = (self[k] || 0) + us; }
      { const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id); const incl = {};
        profile.samples.forEach((id, i) => { const us = dt[i] || 0; const seen = new Set(); for (let x = id; x != null; x = parent.get(x)) { const m = byId.get(x); const k = m.callFrame.functionName + "@" + m.callFrame.lineNumber; if (seen.has(k)) continue; seen.add(k); incl[k] = (incl[k] || 0) + us; } });
        out.scrollIncl = Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, us]) => k + " " + Math.round(us / 1000) + "ms"); }
      out.profileTop = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => k + " " + Math.round(us / 1000) + "ms");
    }
    let rec = await page.evaluate(() => __h10.stop()); let m1 = await metrics();
    r.scroll = summarize(rec, m0, m1);
    await page.evaluate(() => { document.getElementById("boardScroll").scrollTop = 0; }); await sleep(2500);
    /* (b) three refreshes, pointer off the board */
    await page.mouse.move(5, H - 5); await sleep(1000);
    m0 = await metrics(); await page.evaluate(() => __h10.start());
    r.refreshCalls = [];
    if (process.env.PROFILE === "refresh" && coh === "ALL") { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
    for (let k = 0; k < 3; k++) { r.refreshCalls.push(await page.evaluate((s) => __h10.refresh(s, 0.12), 1000 + k)); await sleep(2500); }
    if (process.env.PROFILE === "refresh" && coh === "ALL") {
      const { profile } = await cdp.send("Profiler.stop"); const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map();
      for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
      const self = {}, incl = {}; profile.samples.forEach((id, i) => { const us = profile.timeDeltas[i] || 0; const n = byId.get(id); const k0 = n.callFrame.functionName + "@" + n.callFrame.lineNumber; self[k0] = (self[k0] || 0) + us;
        const seen = new Set(); for (let x = id; x != null; x = parent.get(x)) { const m = byId.get(x); const k = m.callFrame.functionName + "@" + m.callFrame.lineNumber; if (seen.has(k)) continue; seen.add(k); incl[k] = (incl[k] || 0) + us; } });
      out.refreshSelf = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, us]) => k + " " + Math.round(us / 1000) + "ms");
      const qp = {}; profile.samples.forEach((id, i) => { const n = byId.get(id); if (!/^querySelector/.test(n.callFrame.functionName)) return; const p = byId.get(parent.get(id)); const k = n.callFrame.functionName + " <- " + (p ? p.callFrame.functionName + "@" + p.callFrame.lineNumber : "?"); qp[k] = (qp[k] || 0) + (profile.timeDeltas[i] || 0); });
      out.qsCallers = Object.entries(qp).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, us]) => k + " " + Math.round(us / 1000) + "ms");
      out.refreshIncl = Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, us]) => k + " " + Math.round(us / 1000) + "ms");
    }
    rec = await page.evaluate(() => __h10.stop()); m1 = await metrics();
    r.refresh = summarize(rec, m0, m1);
    /* (c) three refreshes while scrolling, pointer on the board */
    await page.evaluate(() => { document.getElementById("boardScroll").scrollTop = 0; }); await sleep(1500);
    await page.mouse.move(px, py); await sleep(800);
    m0 = await metrics(); await page.evaluate(() => __h10.start());
    r.scrollRefreshCalls = [];
    if (process.env.PROFILE === "sr" && coh === "ALL") { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
    const wheelP = wheel(5200);
    for (let k = 0; k < 3; k++) { await sleep(1300); r.scrollRefreshCalls.push(await page.evaluate((s) => __h10.refresh(s, 0.12), 2000 + k)); }
    await wheelP;
    rec = await page.evaluate(() => __h10.stop()); m1 = await metrics();
    if (process.env.PROFILE === "sr" && coh === "ALL") {
      const { profile } = await cdp.send("Profiler.stop"); const byId = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map();
      for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
      const incl = {}; profile.samples.forEach((id, i) => { const us = profile.timeDeltas[i] || 0; const seen = new Set(); for (let x = id; x != null; x = parent.get(x)) { const m = byId.get(x); const k = m.callFrame.functionName + "@" + m.callFrame.lineNumber; if (seen.has(k)) continue; seen.add(k); incl[k] = (incl[k] || 0) + us; } });
      out.srIncl = Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, us]) => k + " " + Math.round(us / 1000) + "ms");
    }
    r.scrollRefresh = summarize(rec, m0, m1);
    /* (d) the row under a resting pointer, and the scroll position, across one refresh */
    await sleep(2500);
    await page.evaluate(() => { document.getElementById("boardScroll").scrollTop = 600; }); await sleep(1500);
    const st0 = await page.evaluate(() => document.getElementById("boardScroll").scrollTop);
    const u0 = await page.evaluate(([x, y]) => __h10.underPointer(x, y), [px, py]);
    const call = await page.evaluate((s) => __h10.refresh(s, 0.2), 3000);
    await sleep(300);
    const u1 = await page.evaluate(([x, y]) => __h10.underPointer(x, y), [px, py]);
    await sleep(3500);
    const u2 = await page.evaluate(([x, y]) => __h10.underPointer(x, y), [px, py]);
    const st2 = await page.evaluate(() => document.getElementById("boardScroll").scrollTop);
    r.pointer = { moved: call.moved, before: u0, after300ms: u1, after3800ms: u2, scrollTop0: st0, scrollTop2: st2 };
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    out.cohorts[coh] = r;
  }
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 400); }
fs.writeFileSync(path.join(here, "perf-" + label + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify(out, null, 1));
