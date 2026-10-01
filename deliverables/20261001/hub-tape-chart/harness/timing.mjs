// Item 3 — "click a row at 0 s, at 3 s, at 15 s after load": time to the chart's price, to its clouds, and whether
// DATA DELAYED shows. Real network and real origin: the Hub document at https://scintillahub.ai/ (and its build check at
// /index.html) is answered with the local file under test; every other request goes to the live services exactly as
// the page sends it. Non-GET requests are aborted (nothing is ever written). A fresh browser per run (cold cache).
// usage: node timing.mjs <index.html> <label> <outJson> [delays=0,3,15] [reps=2] [ticker=NVDA]
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [file, label, out, D, REPS, TICK, SCOPE] = process.argv.slice(2);
const delays = (D || "0,3,15").split(",").map(Number), reps = +(REPS || 2), ticker = TICK || "NVDA";
const html = fs.readFileSync(file);
const SIM = +(process.env.SIM_SERIAL_MS || 0);
const runs = [];
for (let rep = 0; rep < reps; rep++) for (const delay of delays) {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
  await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("hub.company.expanded", "0"); localStorage.setItem("hub.chart.range", "1D"); } catch (_) {} });
  await context.route("**/*", (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
    if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html") && req.resourceType() === "document")
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
    if (u.host === "scintillahub.ai" && u.pathname === "/index.html")
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
    /* SIM_SERIAL_MS (a MODEL, labelled as such in the report): the chart API answers one request after another at this cost
       each (P6, 30 Sep 10:30 ET: ~0.12 s of main-thread work per request). The real answer is fetched; it is released no earlier
       than its turn in one first-come queue. An aborted request keeps its turn, as a server keeps working on it. */
    if (SIM && u.host === "scintilla-massive-chart-api.fly.dev") {
      SLOT.free = Math.max(SLOT.free, Date.now()) + SIM; const at = SLOT.free;
      return route.fetch().then(async (resp) => { const w = at - Date.now(); if (w > 0) await sleep(w); return route.fulfill({ response: resp }); }).catch(() => {});
    }
    return route.continue();
  });
  const page = await context.newPage();
  var SLOT = SLOT || { free: 0 }; SLOT.free = 0;
  const T0 = Date.now(), reqs = new Map(), done = [];
  const kind = (url) => /\/sparklines\?/.test(url) ? "sparkbatch" : /\/candles\?.*tf=240.*limit=13/.test(url) ? "spark" : /fly\.dev/.test(url) ? "api" : null;
  page.on("request", (r) => { const k = kind(r.url()); if (k) reqs.set(r, { k, at: Date.now() - T0, frame: /station\./.test(r.frame().url()) ? "chart" : "hub", url: r.url().replace(/^https:\/\/[^/]+/, "") }); });
  const fin = (r, ok) => { const x = reqs.get(r); if (x) { x.end = Date.now() - T0; x.ok = ok; done.push(x); reqs.delete(r); } };
  page.on("requestfinished", (r) => fin(r, true)); page.on("requestfailed", (r) => fin(r, false));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction((t) => typeof S !== "undefined" && document.querySelector('[data-act="row"][data-t="' + t + '"]'), ticker, { timeout: 60000 });
  /* SCOPE=ALL: Alan's ~590-name board. The ALL tab is clicked as soon as the board can be clicked, and "load" counts
     from the moment ALL's rows are on screen (its sparkline burst starts then) */
  if (SCOPE === "ALL") {
    await page.evaluate(() => { const b = document.querySelector('[data-act="coh"][data-key="ALL"]'); b.click(); });
    await page.waitForFunction((t) => S.coh === "ALL" && document.querySelectorAll('[data-act="row"][data-t]').length > 300 && document.querySelector('[data-act="row"][data-t="' + t + '"]'), ticker, { timeout: 60000 });
  }
  const ready = Date.now() - T0;
  if (delay) await sleep(delay * 1000);
  const inflightAtClick = [...reqs.values()].filter((x) => x.k === "spark" || x.k === "sparkbatch").length;
  const sparkDoneAtClick = done.filter((x) => x.k === "spark").length;
  const click = Date.now() - T0;
  await page.evaluate((t) => { const r = document.querySelector('[data-act="row"][data-t="' + t + '"]'); r.click(); }, ticker);
  let frame = null;
  for (let i = 0; i < 200 && !frame; i++) { const h = await page.$("#coChartFrame"); frame = h && (await h.contentFrame()); if (!frame || !/\/chart\//.test(frame.url())) { frame = null; await sleep(25); } }
  let price = null, clouds = null, delayed = false, last = null;
  const until = Date.now() + 30000;
  while (Date.now() < until && (price == null || clouds == null)) {
    const s = await frame.evaluate((t) => { const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null; const m = h.querySelector(".sc-nchart__msg");
      return { t: h.dataset.t, price: !!(h._series && h._series.length >= 2 && h.dataset.t === t), clouds: !!(h._cloudMap && h._cloudMap.map), state: h.dataset.dataState || "", msg: m && !m.hidden ? m.textContent : "" }; }, ticker).catch(() => null);
    const now = Date.now() - T0;
    if (s) { last = s; if (s.price && price == null) price = now - click; if (s.clouds && clouds == null) clouds = now - click; if (s.state === "delayed" || /delayed/i.test(s.msg)) delayed = true; }
    await sleep(40);
  }
  await sleep(1500);
  const chartReads = done.filter((x) => x.frame === "chart" && x.at >= click).map((x) => ({ ms: x.end - x.at, at: x.at - click, url: x.url.slice(0, 70) }));
  const sparks = done.filter((x) => x.k === "spark" || x.k === "sparkbatch");
  const sparkDuringChart = sparks.filter((x) => x.end > click && x.at < click + (clouds || 30000)).length;
  const r = { sim: SIM || null, label, scope: SCOPE || "LIKED", rep, delay, ticker, ready, click, price, clouds, delayed, last, inflightAtClick, sparkDoneAtClick, sparkDuringChart,
    sparkTotal: sparks.length, sparkBatch: sparks.filter((x) => x.k === "sparkbatch").length,
    sparkMedianMs: (() => { const a = sparks.filter((x) => x.k === "spark").map((x) => x.end - x.at).sort((a, b) => a - b); return a.length ? a[a.length >> 1] : null; })(),
    sparkLastEnd: sparks.length ? Math.max(...sparks.map((x) => x.end)) : null,
    chartReads };
  runs.push(r);
  console.log(JSON.stringify({ label, rep, delay, price, clouds, delayed, inflightAtClick, sparkDuringChart, sparkTotal: r.sparkTotal, sparkMedianMs: r.sparkMedianMs, chartReadMax: Math.max(0, ...chartReads.map((x) => x.ms)) }));
  await browser.close();
}
fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), runs }, null, 1));
