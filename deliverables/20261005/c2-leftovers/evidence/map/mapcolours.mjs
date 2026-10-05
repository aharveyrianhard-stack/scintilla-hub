// C2 item 5 rig (5 Oct 2026). Headless only. Times the ALL market map: click ALL, then how long until the rows are on the
// board and until the 4H colours have landed (L0_MAP_CACHE holds the entry for the cohort on screen). Logs every chart-API
// /sparklines request. Every non-GET request is refused and counted.
//   node mapcolours.mjs live                      → https://scintillahub.ai/?v=<now>
//   node mapcolours.mjs <folder with index.html>  → that folder served on 127.0.0.1; the chart API is proxied from node with
//                                                   the scintillahub.ai origin (the API accepts only that origin)
import fs from "node:fs"; import http from "node:http"; import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const [target, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const RUNS = +(opt.runs || 3), W = +(opt.w || 1680), H = W < 600 ? 844 : 1050;
let base = "https://scintillahub.ai", server = null;
if (target !== "live") {
  const root = path.resolve(target);
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
  server = http.createServer((req, res) => {
    let file = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end("nf"); }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" }); res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + server.address().port;
}
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const out = { target, base: target === "live" ? base : "local", W, at: new Date().toISOString(), runs: [] };
for (let n = 0; n < RUNS; n++) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: W < 600, hasTouch: W < 600 });
  const run = { blocked: 0, spark: [], other: 0 };
  let t0 = 0;
  await ctx.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), u = new URL(url);
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { run.blocked++; return route.abort(); }
    if (u.host === "scintilla-massive-chart-api.fly.dev" && target !== "live") {
      const s = Date.now();
      try {
        const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        const body = await r.text();
        if (u.pathname === "/sparklines") run.spark.push({ startMs: t0 ? s - t0 : null, ms: Date.now() - s, status: r.status, n: (u.searchParams.get("symbols") || "").split(",").length, tf: u.searchParams.get("tf"), kb: Math.round(body.length / 1024) });
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
      } catch (e) { return route.abort(); }
    }
    return route.fallback();
  });
  const page = await ctx.newPage();
  if (target === "live") {
    const open = new Map();
    page.on("request", (r) => { if (r.url().includes("/sparklines")) open.set(r, Date.now()); });
    page.on("requestfinished", async (r) => { if (!open.has(r)) return; const s = open.get(r), u = new URL(r.url()); const resp = await r.response();
      run.spark.push({ startMs: t0 ? s - t0 : null, ms: Date.now() - s, status: resp ? resp.status() : 0, n: (u.searchParams.get("symbols") || "").split(",").length, tf: u.searchParams.get("tf") }); });
  }
  await page.goto(base + "/?v=" + Date.now(), { waitUntil: "domcontentloaded" });
  /* the page's own first board (the default list) and its colours, before ALL is asked for */
  await page.waitForFunction(() => { try { return shownRows().length > 0 && !!L0_MAP_NOW; } catch (_) { return false; } }, null, { timeout: 60000 });
  run.defaultRows = await page.evaluate(() => shownRows().length);
  await page.waitForTimeout(1500);
  run.spark.length = 0;
  t0 = Date.now();
  await page.click('[data-act="coh"][data-key="ALL"]');
  const poll = async (fn, max) => { const s = Date.now(); while (Date.now() - s < max) { const v = await page.evaluate(fn).catch(() => null); if (v) return { ms: Date.now() - t0, v }; await page.waitForTimeout(40); } return null; };
  const rows = await poll(() => { try { const n = shownRows().length; return n > 200 ? n : 0; } catch (_) { return 0; } }, 30000);
  const tiles = await poll(() => { try { const k = L0_MAP_NOWK; return k && k.split(",").length > 200 ? k.split(",").length : 0; } catch (_) { return 0; } }, 30000);
  const colours = await poll(() => { try { const e = L0_MAP_CACHE[L0_MAP_NOWK]; return e && e.n > 200 ? { hit: e.hit, n: e.n, tf: e.tf } : null; } catch (_) { return null; } }, 60000);
  await page.waitForTimeout(400);
  run.rowsMs = rows && rows.ms; run.rows = rows && rows.v; run.mapAskedMs = tiles && tiles.ms; run.coloursMs = colours && colours.ms; run.colours = colours && colours.v;
  run.coloursAfterRowsMs = colours && rows ? colours.ms - rows.ms : null;
  run.header = await page.evaluate(() => { const h = document.querySelector(".sc-l0map__hd, [data-l0-map-head], .sc-l0-head"); return h ? h.textContent.trim().slice(0, 160) : null; }).catch(() => null);
  if (opt.shot && n === RUNS - 1) await page.screenshot({ path: opt.shot });
  out.runs.push(run);
  console.error(`run ${n + 1}: rows ${run.rows} at ${run.rowsMs} ms · colours at ${run.coloursMs} ms (${run.coloursAfterRowsMs} after rows) · hit ${run.colours && run.colours.hit}/${run.colours && run.colours.n} · sparklines ${run.spark.length} req [${run.spark.map((s) => s.n + ":" + s.ms).join(" ")}] · blocked ${run.blocked}`);
  await ctx.close();
}
await browser.close(); if (server) server.close();
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
out.median = { rowsMs: med(out.runs.map((r) => r.rowsMs)), coloursMs: med(out.runs.map((r) => r.coloursMs)), coloursAfterRowsMs: med(out.runs.map((r) => r.coloursAfterRowsMs)) };
console.log(JSON.stringify(out, null, 1));
