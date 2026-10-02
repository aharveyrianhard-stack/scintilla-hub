/* Headless proof for A1 analytics knockouts. NEVER a visible window. Serves this branch's files from a local port
   (so the page's module imports and its data file load as on the Hub), lets GETs to the live database through for the
   decisions read, and answers every non-GET locally and COUNTS it: nothing is written anywhere.
     node shots.mjs <width>  → shots/<step>-<width>.png for the five steps, and one JSON line of facts. */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const width = +(process.argv[2] || 1680), mobile = width < 500, height = mobile ? 844 : 1050;
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); let f = path.normalize(path.join(ROOT, p)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); } if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, "127.0.0.1", r)); const PORT = server.address().port;
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], errors = [], out = { width };
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await context.route("**/*", async (route) => { const req = route.request(), u = new URL(req.url()), m = req.method(); if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "" }); } return route.continue(); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto(`http://127.0.0.1:${PORT}/deliverables/20261002/analytics-knockouts/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#today", { timeout: 60000 }); await sleep(800);
  const shotAt = async (id, name) => { await page.evaluate((i) => { const e = document.getElementById(i); if (e) window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 6); }, id); await sleep(400); await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) }); };
  const text = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 600) : null; }, sel);
  await shotAt("heat", "1-heat"); out.balance = await text("#heat + .panel .say"); out.sectors = await page.evaluate(() => document.querySelectorAll("#heat + .panel table")[0].querySelectorAll("tbody tr").length);
  await shotAt("field", "2-field"); out.fieldRows = await page.evaluate(() => document.querySelectorAll("#field + .panel table tbody tr").length); out.fieldHead = await text("#field + .panel .say");
  await shotAt("knockout", "3-knockout"); out.standings = await page.evaluate(() => [...document.querySelectorAll("#knockout + .panel .grid table tbody tr")].slice(0, 5).map((r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 80))); out.why = await page.evaluate(() => [...document.querySelectorAll("#knockout + .panel .why")].map((e) => e.innerText.slice(0, 160)));
  /* a toggle re-runs the bracket: turn the Geiger comparison off and read the standings again */
  const before = out.standings.slice(); await page.click('[data-ko="geiger"][data-k="on"][data-v="0"]'); await sleep(500);
  out.standingsGeigerOff = await page.evaluate(() => [...document.querySelectorAll("#knockout + .panel .grid table tbody tr")].slice(0, 5).map((r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 80))); out.toggleChanged = JSON.stringify(before) !== JSON.stringify(out.standingsGeigerOff);
  await page.click("[data-reset='ko']"); await sleep(400);
  /* a pairing's comparisons */
  await page.evaluate(() => { const c = document.querySelector("td.c[data-pair]"); if (c) c.click(); }); await sleep(400); out.pair = await text("#pair");
  await page.evaluate(() => { const e = document.querySelector("#knockout + .panel .mx"); if (e) e.closest(".tw").scrollIntoView({ block: "start" }); }); await sleep(300); await page.screenshot({ path: path.join(OUT, `3b-results-${width}.png`) });
  /* the swipe: one KEEP in the test browser — the write is blocked by this harness and counted */
  await shotAt("swipe", "4-swipe-before");
  await page.evaluate(() => { const b = document.querySelector('[data-swipe][data-v="KEEP"]'); if (b) b.click(); }); await sleep(900);
  await shotAt("swipe", "4-swipe"); out.counter = await text("#swipe + .panel .counter"); out.firstCard = await text("#swipe + .panel .card");
  await shotAt("today", "5-today"); out.today = await page.evaluate(() => [...document.querySelectorAll("#today + .panel .say")].map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 400)));
  out.overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth }));
  out.writesBlocked = writes; out.errors = errors;
  console.log(JSON.stringify(out));
} finally { await browser.close(); server.close(); }
