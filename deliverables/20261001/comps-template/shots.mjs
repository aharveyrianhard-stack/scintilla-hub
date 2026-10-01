/* Headless proof for the comps template (C3). NEVER a visible window. This branch's Hub under its real hostname (files
   from HUB_ROOT), the live database with the public key, the live chart API; every non-GET answered locally and counted.
     node shots.mjs <width> <ticker>  → shots/<T>-<w>.png (card + rows), <T>-cw-<w>.png (C weighted chosen),
     <T>-table-<w>.png (the table open), <T>-full-<w>.png (the whole tab, un-clipped), and one JSON line of facts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [widthS, ticker = "TSM"] = process.argv.slice(2); const EXP = process.env.EXP === "1", TAG = ticker + (EXP ? "-exp" : "");
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots");
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1000;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], apiFail = [], errors = [], out = { width, ticker };
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
  await context.addInitScript((exp) => { try { localStorage.setItem("hub.company.expanded", exp ? "1" : "0"); } catch (_) {} }, EXP);
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") { if (u.pathname.startsWith("/api/")) return route.continue(); const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => { if (/massive-chart-api/.test(r.url()) && r.status() >= 400) apiFail.push(new URL(r.url()).pathname + " " + r.status()); });
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);
  await page.evaluate((t) => { openCo(t); }, ticker); await sleep(3000);
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
  let ok = false; try { await page.waitForSelector("#scCompsTab .ct-card", { timeout: 120000 }); ok = true; } catch (_) {}
  await sleep(1500);
  const facts = () => page.evaluate(() => {
    const box = document.getElementById("scCompsTab"); if (!box) return { box: false };
    const txt = (s) => { const e = box.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 400) : null; };
    const rect = (s) => { const e = box.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }; };
    const pane = box.closest("#coRailContent") || box.parentElement, pr = pane.getBoundingClientRect();
    return { box: true, card: txt(".ct-card"), rows: box.querySelectorAll(".ct-row").length, rowsDrawn: [...box.querySelectorAll(".ct-row svg")].filter((s) => s.childElementCount > 5).length, marks: box.querySelectorAll(".me-dot").length,
      rowText: [...box.querySelectorAll(".ct-row")].map((r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 80)), fx: txt(".ct-fx"), store: txt(".ct-store"), way: (box.querySelector(".ct-sw button.on") || {}).textContent,
      cardRect: rect(".ct-card"), rowsRect: rect("#ctRows"), paneRect: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), h: Math.round(pr.height), scrollH: pane.scrollHeight, clientH: pane.clientHeight }, fitsPane: (() => { const r = rect("#ctRows"); return r ? r.bottom <= pr.bottom + 1 : null; })(),
      disclosures: [...box.querySelectorAll("details.ct-d")].map((d) => d.querySelector("summary").innerText.replace(/\s+/g, " ").trim().slice(0, 60) + (d.open ? " [open]" : "")), tickerMentions: (box.innerText.match(new RegExp("\\b" + box.dataset.t + " TODAY\\b", "g")) || []).length,
      boxW: box.clientWidth, boxSW: box.scrollWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, err: txt(".err") };
  });
  const shot = async (name) => { await page.evaluate(() => { const e = document.getElementById("scCompsTab"); if (e) e.scrollIntoView({ block: "start" }); }); await sleep(400); await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) }); };
  out.ok = ok;
  await shot(TAG); out.tab = await facts();
  await page.click('[data-ct="way"][data-w="CW"]').catch(() => {}); await sleep(700);
  await shot(`${TAG}-cw`); out.cw = await facts();
  await page.click('[data-ct="way"][data-w="B"]').catch(() => {}); await sleep(500);
  await page.evaluate(() => { const d = document.querySelector('details.ct-d[data-d="table"]'); if (d) d.open = true; }); await sleep(800);
  await page.evaluate(() => { const d = document.querySelector('details.ct-d[data-d="table"]'); if (d) d.scrollIntoView({ block: "start" }); }); await sleep(400);
  await page.screenshot({ path: path.join(OUT, `${TAG}-table-${width}.png`) });
  out.table = await page.evaluate(() => { const t = document.querySelector('details.ct-d[data-d="table"] table'); if (!t) return null; return { cols: t.querySelectorAll("thead tr:last-child th").length, peers: t.querySelectorAll("tbody tr[data-peer]").length, me: (t.querySelector("tbody tr.me") || {}).innerText?.replace(/\s+/g, " ").trim().slice(0, 200), far: t.querySelectorAll(".flag.far").length, nm: t.querySelectorAll(".flag:not(.far)").length, w: t.scrollWidth }; });
  await page.evaluate(() => { for (const d of document.querySelectorAll("details.ct-d")) d.open = true; }); await sleep(1500);
  await page.evaluate(() => { const box = document.getElementById("scCompsTab"); for (let e = box; e && e !== document.body; e = e.parentElement) { e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
  await sleep(800); await page.locator("#scCompsTab").screenshot({ path: path.join(OUT, `${TAG}-full-${width}.png`), timeout: 120000 });
  out.errors = errors; out.apiFail = apiFail; out.writes = writes.length;
  console.log(JSON.stringify(out));
} finally { await browser.close(); }
