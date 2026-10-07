/* PA1 (5 Oct) · item 1: photographs TODAY's ALLOCATION tab headlessly (never a window). The branch's files are served
   under the Hub's real hostname so the page's own reads (public key, chart API) work; every non-GET is answered
   locally and counted. node shots-today.mjs  → shots/today-allocation-<w>.png (top) and -full (whole page) + facts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], errors = [], facts = {};
try {
  for (const [w, h] of [[1680, 1050]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: "block" });
    await context.route("**/*", async (route) => {
      const req = route.request(), u = new URL(req.url()), m = req.method();
      if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
      if (u.host === "scintillahub.ai") { if (u.pathname.startsWith("/api/")) return route.continue(); const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
    await page.goto("https://scintillahub.ai/allocation/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(25000);
    await page.screenshot({ path: path.join(OUT, `today-allocation-${w}.png`) });
    facts[w] = await page.evaluate(() => {
      const t = (s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 400) : null; };
      const all = document.body.innerText;
      return { title: document.title, height: document.documentElement.scrollHeight, h1: t("h1"), says: t("#l1says"), words: all.length, headings: [...document.querySelectorAll("h1,h2,h3")].map((e) => e.innerText.replace(/\s+/g, " ").trim().slice(0, 80)).slice(0, 60), toggles: document.querySelectorAll("input,select,button").length, invested: (all.match(/\b\d{1,3}% invested/g) || []).slice(0, 5), missing: (all.match(/could not be read|did not come back|not available|missing/gi) || []).length };
    });
    await page.screenshot({ path: path.join(OUT, `today-allocation-${w}-full.png`), fullPage: true });
    await context.close();
  }
  facts.writes = writes.length; facts.writeList = writes.slice(0, 8); facts.errors = errors;
  fs.writeFileSync(path.join(OUT, "today-facts.json"), JSON.stringify(facts, null, 1));
  console.log(JSON.stringify(facts, null, 1));
} finally { await browser.close(); }
