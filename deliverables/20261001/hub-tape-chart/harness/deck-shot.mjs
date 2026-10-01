import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [scene, out, W] = process.argv.slice(2); const root = process.env.STATION_ROOT; const width = +W || 1680;
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json" };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1050 }, deviceScaleFactor: width < 600 ? 2 : 1 });
await context.route("**/*", (route) => { const req = route.request(), u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
  if (root && u.host === "station.scintillahub.ai") { let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html"; let f = root + p;
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
    if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f) }); }
  return route.continue(); });
const page = await context.newPage();
await page.goto("https://station.scintillahub.ai/" + scene, { waitUntil: "domcontentloaded" });
await sleep(+process.env.WAIT || 9000);
await page.screenshot({ path: out });
await browser.close();
