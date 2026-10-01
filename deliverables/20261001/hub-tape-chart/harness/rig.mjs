// H2 rig — headless only. Serves a Hub root locally; the chart API is fetched by node with the scintillahub.ai
// origin (the API admits only that origin) and handed to the page with CORS relaxed. EVERY non-GET request is
// aborted, so nothing here can write to hub_favorites, station_lists or any other table.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
export const { chromium } = require("playwright-core");
export const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/json" };
export async function serve(root) {
  const server = http.createServer((req, res) => {
    const clean = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.normalize(path.join(root, clean));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end("nf"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: "http://127.0.0.1:" + server.address().port };
}
// opts.stationRoot: serve a local Station build for station.scintillahub.ai (else the live Station is used)
// opts.chartDelayMs: optional function(url) → extra ms before a chart API reply (never used for the real measurements)
export async function open({ width = 1680, height, log = null, stationOrigin = null, blocked = null } = {}) {
  const H = height || (width < 600 ? 844 : 1050), MOBILE = width < 600;
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: 1, isMobile: MOBILE, hasTouch: true });
  await context.route("**/*", async (route) => {
    const req = route.request(), url = req.url(), u = new URL(url), host = u.host;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { if (blocked) blocked.push(req.method() + " " + u.host + u.pathname); return route.abort(); }
    if (host.startsWith("127.0.0.1")) return route.fallback();
    if (stationOrigin && host === "station.scintillahub.ai") return route.continue({ url: stationOrigin + u.pathname + u.search });
    if (host === "scintilla-massive-chart-api.fly.dev") {
      const t0 = Date.now();
      try {
        const r = await fetch(url, { headers: { origin: "https://scintillahub.ai", referer: "https://scintillahub.ai/" } });
        const body = await r.text();
        if (log) log.push({ path: u.pathname + u.search, ms: Date.now() - t0, status: r.status, at: t0, end: Date.now(), frame: req.frame() && req.frame().url().includes("/chart/") ? "chart" : "hub" });
        return route.fulfill({ status: r.status, contentType: "application/json", body, headers: { "access-control-allow-origin": "*" } });
      } catch (e) { if (log) log.push({ path: u.pathname + u.search, ms: Date.now() - t0, status: 0, at: t0, end: Date.now(), err: String(e) }); return route.abort(); }
    }
    return route.fallback();
  });
  return { browser, context };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
