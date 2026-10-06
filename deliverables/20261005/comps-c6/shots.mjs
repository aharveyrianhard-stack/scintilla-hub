/* Headless proof for comps C6 (5 Oct). NEVER a visible window. A Hub checkout under its real hostname (files from the
   root given), the live database with the public key, the live chart API; every non-GET answered locally and counted.
     node shots.mjs <width> <ticker> <before|after> [hubRoot] → shots/<which>/<T>-<w>.png (the set + the range),
     <T>-table-<w>.png (the table, open) and one JSON line of facts. before = the C5b checkout, after = this branch. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [widthS, ticker = "MU", which = "after", rootArg] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = rootArg ? path.resolve(rootArg) : path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots", which);
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], errors = [], out = { width, ticker, which };
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") { if (u.pathname.startsWith("/api/")) return route.continue(); const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);
  await page.evaluate((t) => { openCo(t); }, ticker); await sleep(3000);
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
  let ok = false; try { await page.waitForSelector("#scCompsTab #cm5Field .row", { timeout: 180000 }); ok = true; } catch (_) {}
  await sleep(1500); out.ok = ok;
  const facts = () => page.evaluate(() => {
    const box = document.getElementById("scCompsTab"); if (!box) return { box: false };
    const specs = box.querySelector("details.sc-pagespecs"), content = box.innerText.replace(specs ? specs.innerText : "", "");
    return { peers: [...box.querySelectorAll("table.p tbody tr td.tk")].map((e) => e.textContent.replace(/\s+/g, " ").trim()).slice(1), outlierRows: [...box.querySelectorAll("table.p tr.o6")].map((r) => r.dataset.o6), lastRows: [...box.querySelectorAll("table.p tbody tr")].slice(-3).map((r) => r.className),
      head: [...box.querySelectorAll(".sec .hd")].map((h) => h.innerText.replace(/\s+/g, " ").trim().slice(0, 140))[1] || null, wwo: (box.querySelector("#cm5Wwo") || {}).innerText || null, band: [...box.querySelectorAll("#cm5Band text")].map((t) => t.textContent),
      oldHollow: box.querySelectorAll("#cm5Field .out").length, specsRule: specs ? (specs.innerText.match(/Outliers[^\n]{0,260}/) || [null])[0] : null,
      sentencesInContent: (content.match(/[a-z]{3,}\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+/g) || []).slice(0, 6), boxW: box.clientWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  const shot = async (name, sel) => { await page.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: "start" }); }, sel); await sleep(500); await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) }); };
  await shot(ticker, "#scCompsTab"); out.tab = await facts();
  if (which === "after") {
    /* keep the first outlier by a click on its ◇ (the write is counted, answered locally), read, then let the rule have it back */
    const o = await page.$('#scCompsTab table.p [data-cm="keeppeer"]');
    if (o) { const t = await o.getAttribute("data-t"); await o.click(); await sleep(1200); const f = await facts(); out.afterKeep = { kept: t, outlierRows: f.outlierRows, wwo: f.wwo, head: f.head }; const k = await page.$(`#scCompsTab table.p [data-cm="keeppeer"][data-t="${t}"]`); if (k) { await k.click(); await sleep(1200); out.afterUnkeep = (await facts()).outlierRows; } }
  }
  /* the pieces, each as its own picture: the panel is unrolled (no clipping) so the whole set, range and table can be seen;
     in the Hub the panel scrolls and the table scrolls sideways */
  await page.evaluate(() => { const d = document.querySelector('details.d[data-d="table"]'); if (d) d.open = true; const box = document.getElementById("scCompsTab"); for (let e = box; e && e !== document.body; e = e.parentElement) { e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
  await sleep(1000);
  const part = async (name, sel) => { try { await page.locator(sel).first().screenshot({ path: path.join(OUT, `${name}-${width}.png`), timeout: 60000 }); } catch (e) { out["fail_" + name] = String(e.message).slice(0, 120); } };
  await part(`${ticker}-set`, "#scCompsTab > .sec:nth-of-type(1)"); await part(`${ticker}-range`, "#scCompsTab > .sec:nth-of-type(2)");
  /* the table: the tab laid over the whole window (in the Hub it sits in the company panel and scrolls sideways) */
  await page.evaluate(() => { const box = document.getElementById("scCompsTab"); for (const [k, v] of Object.entries({ position: "fixed", inset: "0", width: "100vw", height: "100vh", "max-width": "none", "z-index": "2147483000", background: "#0B0C14", overflow: "auto", padding: "10px" })) box.style.setProperty(k, v, "important"); box.style.setProperty("zoom", "0.8"); for (const e of box.querySelectorAll(":scope > .sec, :scope > details.sc-pagespecs")) e.style.display = "none"; document.body.appendChild(box); });
  await sleep(1200); await page.evaluate(() => { const d = document.querySelector('details.d[data-d="table"]'); if (d) d.scrollIntoView({ block: "start" }); }); await sleep(500);
  const clip = await page.evaluate(() => { const r = document.querySelector('details.d[data-d="table"]').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top), width: Math.min(innerWidth, Math.ceil(r.right) + 10), height: Math.min(innerHeight - Math.max(0, r.top), Math.ceil(r.height) + 4) }; });
  await page.screenshot({ path: path.join(OUT, `${ticker}-table-${width}.png`), clip });
  out.table = await page.evaluate(() => { const t = document.querySelector('details.d[data-d="table"] table'); if (!t) return null; return { peers: [...t.querySelectorAll("tbody tr[data-peer]")].map((r) => r.dataset.peer + (r.classList.contains("o6") ? "*" : "")), marks: t.querySelectorAll("td.fl").length, c5OutTags: t.querySelectorAll(".flag").length, medRows: [...t.querySelectorAll("tr.stat")].map((r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 150)), reasons: [...t.querySelectorAll("tbody tr.o6 td:last-child")].map((e) => e.textContent) }; });
  out.errors = errors; out.writes = writes.length; out.writeList = writes.slice(0, 4);
  console.log(JSON.stringify(out));
} finally { await browser.close(); }
