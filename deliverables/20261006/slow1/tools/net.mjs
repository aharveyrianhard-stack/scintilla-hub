// load phases + bytes on the wire: node net.mjs <label> <url> <throttle> <seconds> [branchIndexFile]
import { createRequire } from "node:module"; import fs from "node:fs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label, url, thr, secs, file] = process.argv.slice(2); const throttle = +thr;
const b = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 } });
let blocked = 0;
await ctx.route("**/*", (r) => { const q = r.request(); if (q.method() !== "GET") { blocked++; return r.abort(); } const u = new URL(q.url());
  if (file && u.origin === "https://scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html")) return r.fulfill({ path: file, contentType: "text/html; charset=utf-8" }); return r.continue(); });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable"); if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
const keyOf = (u) => { try { const x = new URL(u); return x.host.replace("wadinxqplrggagkvrdag.", "") + x.pathname.replace(/\/[0-9A-Za-z_-]{24,}(?=\/|$)/g, "/:id").slice(0, 60); } catch { return "?"; } };
const urls = new Map(), by = {}; let bytes = 0, n = 0;
cdp.on("Network.requestWillBeSent", (e) => urls.set(e.requestId, e.request.url));
cdp.on("Network.loadingFinished", (e) => { const k = keyOf(urls.get(e.requestId) || ""); const a = (by[k] ||= { n: 0, kB: 0 }); a.n++; a.kB += e.encodedDataLength / 1024; bytes += e.encodedDataLength; n++; });
const t0 = Date.now(); const marks = []; let running = true;
await p.goto(url, { waitUntil: "commit", timeout: 60000 });
(async () => { while (running) { try {
  const m = await p.evaluate(() => { const q = (s) => document.querySelectorAll(s).length; const ms = document.getElementById("marketStatus");
    const rows = [...document.querySelectorAll('[data-act="row"]')]; const priced = rows.filter((r) => r.getAttribute("data-sc-price") || /\d/.test((r.children[4] || r).textContent || "")).length;
    return { pending: q(".sc-pending"), boardPending: q(".sc-board__pending"), rows: rows.length, rsi: [...document.querySelectorAll(".sc-rsi[id^='lr_']")].filter((c) => /\d/.test(c.textContent)).length, status: ms ? ms.textContent.trim().slice(0, 40) : null, iframes: q("iframe") }; });
  let chartsLoading = 0, charts = 0; for (const f of p.frames()) if (/chart-v1/.test(f.url())) { charts++; try { if (await f.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); return !h || !h._series || h._series.length < 2; })) chartsLoading++; } catch { chartsLoading++; } }
  marks.push({ t: Date.now() - t0, ...m, charts, chartsLoading }); } catch {} await new Promise((r) => setTimeout(r, 150)); } })();
await p.waitForTimeout(+secs * 1000); running = false;
const first = (pred) => { const i = marks.findIndex(pred); return i < 0 ? null : marks[i].t; };
const lastWhere = (pred) => { let t = null; for (const m of marks) if (pred(m)) t = m.t; return t; };
const out = { label, throttle, seconds: +secs, blocked, requests: n, MB: +(bytes / 1048576).toFixed(2),
  hub: { firstRowsMs: first((m) => m.rows > 0), allPendingGoneMs: marks.some((m) => m.pending > 0) ? lastWhere((m) => m.pending > 0) : null, maxPending: Math.max(0, ...marks.map((m) => m.pending)), rsiFirstMs: first((m) => m.rsi > 0), rsiMostMs: first((m) => m.rows > 0 && m.rsi >= m.rows * 0.8) },
  station: { firstChartFrameMs: first((m) => m.charts > 0), firstChartDrawnMs: first((m) => m.charts > 0 && m.chartsLoading < m.charts), allChartsDrawnMs: first((m) => m.charts > 0 && m.chartsLoading === 0), statusSeen: [...new Set(marks.map((m) => m.status).filter(Boolean))].slice(0, 12), loadingStatusMs: marks.filter((m) => /loading/i.test(m.status || "")).length * 150 },
  top: Object.entries(by).sort((a, b) => b[1].kB - a[1].kB).slice(0, 10).map(([k, v]) => `${Math.round(v.kB)}kB/${v.n} ${k}`) };
fs.writeFileSync(`probe/net-${label}.json`, JSON.stringify({ ...out, marks }, null, 0)); console.log(JSON.stringify(out, null, 1)); await b.close();
