// SLOW1 soak: one headless page, kept open N minutes, sampled every minute.
// usage: node soak.mjs <label> <url> <throttle> <minutes> <outdir> [setup]
// setup: name of a function in setups.mjs run after load (click into a view)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label, url, throttleS, minutesS, outdir, setupName] = process.argv.slice(2);
const throttle = Number(throttleS), minutes = Number(minutesS);
fs.mkdirSync(outdir, { recursive: true });
const out = (n) => path.join(outdir, `${label}-${n}`);
const MAP = process.env.SLOW_MAP ? JSON.parse(process.env.SLOW_MAP) : null; // {origin, dir} serve local files over a live origin

const INIT = () => {
  if (window.__slow) return;
  const S = (window.__slow = {
    lt: [], ltN: 0, ltMs: 0, iv: new Map(), to: new Map(), ivMade: 0, toMade: 0, sites: {}, ivSites: {},
    ws: 0, wsOpen: 0, es: 0, esOpen: 0, raf: 0, fetches: 0, mo: 0, t0: performance.now(),
  });
  const site = () => {
    const st = (new Error().stack || "").split("\n").slice(3, 7).map((l) => l.trim().replace(/^at /, ""));
    return st.find((l) => !/__slow|<anonymous>:\d+:\d+\)?$/.test(l) || true) || "?";
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        S.ltN++; S.ltMs += e.duration; try { window.__slowLT && window.__slowLT(Math.round(e.duration)); } catch {}
        if (S.lt.length < 4000) S.lt.push([Math.round(e.startTime), Math.round(e.duration)]);
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {}
  const _si = window.setInterval, _ci = window.clearInterval, _st = window.setTimeout, _ct = window.clearTimeout;
  window.setInterval = function (fn, ms, ...a) {
    const s = site(); const key = `${ms | 0}ms @ ${s}`;
    const id = _si.call(window, fn, ms, ...a);
    S.iv.set(id, key); S.ivMade++; S.ivSites[key] = (S.ivSites[key] || 0) + 1; return id;
  };
  window.clearInterval = function (id) { S.iv.delete(id); S.to.delete(id); return _ci.call(window, id); };
  window.setTimeout = function (fn, ms, ...a) {
    S.toMade++;
    let id;
    const wrapped = typeof fn === "function" ? function () { S.to.delete(id); return fn.apply(this, arguments); } : fn;
    id = _st.call(window, wrapped, ms, ...a);
    if ((ms | 0) >= 200) { const key = `${ms | 0}ms @ ${site()}`; S.to.set(id, key); S.sites[key] = (S.sites[key] || 0) + 1; }
    return id;
  };
  window.clearTimeout = function (id) { S.to.delete(id); S.iv.delete(id); return _ct.call(window, id); };
  const _raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (fn) { S.raf++; return _raf.call(window, fn); };
  const W = window.WebSocket;
  if (W) {
    window.WebSocket = function (u, p) {
      const w = p === undefined ? new W(u) : new W(u, p);
      S.ws++; S.wsOpen++; (S.wsUrls ||= []).push(String(u).split("?")[0]);
      w.addEventListener("close", () => S.wsOpen--); return w;
    };
    window.WebSocket.prototype = W.prototype;
    for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) window.WebSocket[k] = W[k];
  }
  const E = window.EventSource;
  if (E) {
    window.EventSource = function (u, o) {
      const e = new E(u, o); S.es++; S.esOpen++; (S.esUrls ||= []).push(String(u).split("?")[0]);
      const _c = e.close.bind(e); e.close = () => { S.esOpen--; _c(); }; return e;
    };
    window.EventSource.prototype = E.prototype;
  }
  const M = window.MutationObserver;
  window.MutationObserver = function (cb) { S.mo++; return new M(cb); };
  window.MutationObserver.prototype = M.prototype;
};

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
const LT = { n: 0, ms: 0, max: 0, byMin: [], over200: 0 };
await ctx.exposeBinding("__slowLT", (_src, d) => { LT.n++; LT.ms += d; LT.max = Math.max(LT.max, d); if (d >= 200) LT.over200++; LT.byMin[minuteIdx] = (LT.byMin[minuteIdx] || 0) + 1; });
await ctx.addInitScript(INIT);
const req = { total: 0, blocked: 0, blockedBy: {}, byMin: [], byKey: {}, byKeyMin: [], failed: 0, bytes: 0, slow: [] };
let minuteIdx = 0;
const keyOf = (u) => { try { const x = new URL(u); return x.host + x.pathname.replace(/\/[0-9A-Za-z_-]{16,}(?=\/|$)/g, "/:id").slice(0, 70); } catch { return u.slice(0, 60); } };
await ctx.route("**/*", async (route) => {
  const r = route.request();
  if (r.method() !== "GET") {
    req.blocked++; const k = r.method() + " " + keyOf(r.url()); req.blockedBy[k] = (req.blockedBy[k] || 0) + 1;
    return route.abort("blockedbyclient");
  }
  if (MAP && r.url().startsWith(MAP.origin)) {
    const u = new URL(r.url()); let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(MAP.dir, p);
    if ((MAP.only || []).some((x) => p === x) && fs.existsSync(f)) return route.fulfill({ path: f });
  }
  return route.continue();
});
const page = await ctx.newPage();
const starts = new Map();
page.on("request", (r) => {
  req.total++; req.byMin[minuteIdx] = (req.byMin[minuteIdx] || 0) + 1;
  const k = keyOf(r.url()); req.byKey[k] = (req.byKey[k] || 0) + 1;
  (req.byKeyMin[minuteIdx] ||= {})[k] = (req.byKeyMin[minuteIdx][k] || 0) + 1;
  starts.set(r, Date.now());
});
page.on("requestfinished", (r) => { const t = Date.now() - (starts.get(r) || Date.now()); starts.delete(r); if (t > 1500) req.slow.push([t, r.method(), keyOf(r.url()), minuteIdx]); });
page.on("requestfailed", (r) => { req.failed++; starts.delete(r); });
const errors = []; page.on("pageerror", (e) => errors.length < 50 && errors.push(String(e).slice(0, 300)));
const consoleErr = {}; page.on("console", (m) => { if (m.type() === "error") { const k = m.text().slice(0, 140); consoleErr[k] = (consoleErr[k] || 0) + 1; } });

const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
const sessions = [cdp];
page.on("frameattached", async (f) => { // out-of-process frames need their own session + throttle
  try { const s = await ctx.newCDPSession(f); await s.send("Performance.enable"); if (throttle > 1) await s.send("Emulation.setCPUThrottlingRate", { rate: throttle }); sessions.push(s); } catch {}
});
const perf = async () => {
  const tot = {};
  for (const s of sessions) { try { const { metrics } = await s.send("Performance.getMetrics"); for (const m of metrics) tot[m.name] = (tot[m.name] || 0) + m.value; } catch {} }
  return tot;
};
const frameStats = async () => {
  const agg = { ltN: 0, ltMs: 0, iv: 0, to: 0, ivMade: 0, toMade: 0, ws: 0, wsOpen: 0, es: 0, esOpen: 0, raf: 0, mo: 0, frames: 0, ivSites: {}, liveIv: {}, liveTo: {}, toSites: {}, lt: [], wsUrls: [], esUrls: [], perFrame: [] };
  for (const f of page.frames()) {
    try {
      const s = await f.evaluate(() => { const S = window.__slow; if (!S) return null; const cnt = (m) => { const o = {}; for (const v of m.values()) o[v] = (o[v] || 0) + 1; return o; };
        return { ltN: S.ltN, ltMs: S.ltMs, iv: S.iv.size, to: S.to.size, ivMade: S.ivMade, toMade: S.toMade, ws: S.ws, wsOpen: S.wsOpen, es: S.es, esOpen: S.esOpen, raf: S.raf, mo: S.mo, ivSites: S.ivSites, liveIv: cnt(S.iv), liveTo: cnt(S.to), toSites: S.sites, lt: S.lt, wsUrls: S.wsUrls || [], esUrls: S.esUrls || [], dom: document.getElementsByTagName("*").length, age: Math.round(performance.now() - S.t0) }; });
      if (!s) continue; agg.frames++;
      for (const k of ["ltN", "ltMs", "iv", "to", "ivMade", "toMade", "ws", "wsOpen", "es", "esOpen", "raf", "mo"]) agg[k] += s[k];
      const u = keyOf(f.url());
      for (const [m, src] of [["ivSites", s.ivSites], ["liveIv", s.liveIv], ["liveTo", s.liveTo], ["toSites", s.toSites]]) for (const [k, v] of Object.entries(src)) { const kk = k.replace(/https?:\/\/[^/]+/g, ""); agg[m][kk] = (agg[m][kk] || 0) + v; }
      agg.wsUrls.push(...s.wsUrls); agg.esUrls.push(...s.esUrls);
      agg.perFrame.push({ u, ltN: s.ltN, ltMs: Math.round(s.ltMs), iv: s.iv, to: s.to, raf: s.raf, dom: s.dom, age: s.age, toMade: s.toMade });
    } catch {}
  }
  return agg;
};

const t0 = Date.now();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
const domMs = Date.now() - t0;
try { await page.waitForLoadState("networkidle", { timeout: 45000 }); } catch {}
const idleMs = Date.now() - t0;
let setupNote = "";
if (setupName) { const setups = await import("./setups.mjs"); try { setupNote = await setups[setupName](page); } catch (e) { setupNote = "SETUP FAILED: " + String(e).slice(0, 300); } }
await page.waitForTimeout(3000);
await page.screenshot({ path: out("start.png") }).catch(() => {});

// spinner / "loading" watch: sample visible loading text every 500 ms in the top document
await page.evaluate(() => {
  const L = (window.__load = { cur: new Map(), done: [] });
  const scan = () => {
    const seen = new Set(); const now = performance.now();
    const els = document.querySelectorAll('[class*="load" i],[class*="spin" i],[class*="skel" i],[aria-busy="true"]');
    const add = (el, why) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return;
      const k = why + " | " + (el.id ? "#" + el.id : "") + "." + String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 60) + " | " + (el.textContent || "").trim().slice(0, 50); seen.add(k); if (!L.cur.has(k)) L.cur.set(k, now); };
    els.forEach((e) => add(e, "class"));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n, c = 0;
    while ((n = w.nextNode()) && c < 20000) { c++; const t = n.nodeValue; if (t && t.length < 80 && /loading|fetching|waiting|connecting|retrying|delayed|^…$/i.test(t.trim()) && n.parentElement && !n.parentElement.closest(".pm-out")) add(n.parentElement, "text"); }
    for (const [k, t] of L.cur) if (!seen.has(k)) { L.cur.delete(k); if (L.done.length < 3000) L.done.push([k, Math.round(t), Math.round(now - t)]); }
  };
  setInterval.call ? null : null; (window.__slowScan = scan);
});
// the scan runs from node so it is not counted as a page timer
let scanning = true;
(async () => { while (scanning) { try { await page.evaluate(() => window.__slowScan && window.__slowScan()); } catch {} await new Promise((r) => setTimeout(r, 1000)); } })();

const samples = [];
const snap = async (m) => {
  const p = await perf(); const f = await frameStats();
  let heapGc = null;
  try { await cdp.send("HeapProfiler.collectGarbage"); const p2 = await perf(); heapGc = p2.JSHeapUsedSize; } catch {}
  samples.push({ m, t: Date.now() - t0, heap: p.JSHeapUsedSize, heapGc, nodes: p.Nodes, listeners: p.JSEventListeners, docs: p.Documents, frames: p.Frames, layoutS: p.LayoutDuration, styleS: p.RecalcStyleDuration, scriptS: p.ScriptDuration, taskS: p.TaskDuration, layoutN: p.LayoutCount, styleN: p.RecalcStyleCount,
    ltN: LT.n, ltMs: LT.ms, ltMax: LT.max, ltOver200: LT.over200, iv: f.iv, to: f.to, ivMade: f.ivMade, toMade: f.toMade, wsOpen: f.wsOpen, ws: f.ws, esOpen: f.esOpen, es: f.es, raf: f.raf, pageFrames: f.frames, req: req.total, blocked: req.blocked });
  return f;
};
await snap(0);
// CPU profile of minute 1-2 and of the last minute; a 20 s paint/layout trace in minute 3
const profile = async (name, ms) => { try { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); await cdp.send("Profiler.start"); await page.waitForTimeout(ms); const { profile } = await cdp.send("Profiler.stop"); fs.writeFileSync(out(name + ".cpuprofile"), JSON.stringify(profile)); } catch (e) { fs.writeFileSync(out(name + ".err"), String(e)); } };
const trace = async (name, ms) => {
  try { const b = await browser.newBrowserCDPSession(); const ev = []; b.on("Tracing.dataCollected", (d) => ev.push(...d.value));
    await b.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] } });
    await page.waitForTimeout(ms); const done = new Promise((r) => b.once("Tracing.tracingComplete", r)); await b.send("Tracing.end"); await done;
    const sum = {}; for (const e of ev) if (e.ph === "X" && e.dur) { const s = (sum[e.name] ||= { n: 0, ms: 0 }); s.n++; s.ms += e.dur / 1000; }
    fs.writeFileSync(out(name + ".trace-summary.json"), JSON.stringify({ windowMs: ms, sum: Object.fromEntries(Object.entries(sum).sort((a, b) => b[1].ms - a[1].ms).slice(0, 30).map(([k, v]) => [k, { n: v.n, ms: Math.round(v.ms) }])) }, null, 1));
  } catch (e) { fs.writeFileSync(out(name + ".err"), String(e)); }
};
let last;
for (let m = 1; m <= minutes; m++) {
  const end = t0 + idleMs - idleMs + (Date.now() - t0) + 0; // placeholder
  const minuteStart = Date.now();
  minuteIdx = m;
  if (m === 2) await profile("early", 50000);
  else if (m === 3 && minutes >= 4) await trace("paint", 20000);
  else if (m === minutes && minutes >= 4) await profile("late", 50000);
  const left = 60000 - (Date.now() - minuteStart); if (left > 0) await page.waitForTimeout(left);
  last = await snap(m);
  fs.writeFileSync(out("samples.json"), JSON.stringify(samples));
}
scanning = false;
await page.screenshot({ path: out("end.png") }).catch(() => {});
const loading = await page.evaluate(() => ({ done: window.__load.done, still: [...window.__load.cur].map(([k, t]) => [k, Math.round(t), Math.round(performance.now() - t)]) })).catch(() => null);
fs.writeFileSync(out("result.json"), JSON.stringify({ label, url, throttle, minutes, domMs, idleMs, setupNote, LT, samples, final: last, req, errors, consoleErr, loading }, null, 1));
await browser.close();
console.log(label, "done", { domMs, idleMs, setupNote, req: req.total, blocked: req.blocked });
