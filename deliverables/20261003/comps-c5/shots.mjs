/* Headless proof for comps C5 (3 Oct). NEVER a visible window. This branch's Hub under its real hostname (files from
   HUB_ROOT), the live database with the public key, the live chart API; every non-GET answered locally and counted.
     node shots.mjs <width> <ticker>  → shots/after/<T>-<w>.png (the set + the range), <T>-field-<w>.png, <T>-table-<w>.png,
     <T>-full-<w>.png (the whole tab) and one JSON line of facts. 1680 × 1050 on the desktop. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [widthS, ticker = "AMZN"] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots", "after");
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], apiFail = [], errors = [], out = { width, ticker };
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
  page.on("response", (r) => { if (/massive-chart-api/.test(r.url()) && r.status() >= 400) apiFail.push(new URL(r.url()).pathname + " " + r.status()); });
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);
  await page.evaluate((t) => { openCo(t); }, ticker); await sleep(3000);
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
  let ok = false; try { await page.waitForSelector("#scCompsTab #cm5Field .row", { timeout: 180000 }); ok = true; } catch (_) {}
  await sleep(1500);
  const facts = () => page.evaluate(() => {
    const box = document.getElementById("scCompsTab"); if (!box) return { box: false };
    const txt = (s) => { const e = box.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 600) : null; };
    const all = box.innerText, specs = box.querySelector("details.sc-pagespecs"), content = all.replace(specs ? specs.innerText : "", "");
    return { box: true, lines: txt(".linew"), setRows: box.querySelectorAll("table.p tbody tr").length - 1, peers: [...box.querySelectorAll("table.p tbody tr td.tk")].map((e) => e.textContent).slice(1), seats: box.querySelectorAll("table.p .seat").length, notin: txt(".notin"),
      band: [...box.querySelectorAll("#cm5Band text")].map((t) => t.textContent), ways: [...box.querySelectorAll('[data-cm="way"]')].map((b) => b.textContent + (b.classList.contains("on") ? " [on]" : "")), miniRows: box.querySelectorAll("#cm5Mini .mr").length, weights: [...box.querySelectorAll(".wrow div b")].map((b) => b.textContent).join(" "),
      fieldRows: box.querySelectorAll("#cm5Field .row").length, outlierMarks: box.querySelectorAll("#cm5Field .out").length, outlierWords: [...box.querySelectorAll("#cm5Field .out-n")].map((t) => t.textContent), pegRow: [...box.querySelectorAll("#cm5Field .row")].map((r) => r.innerText.replace(/\s+/g, " ").trim()).find((t) => /^PEG/.test(t)) || null,
      specs: !!specs, specsOpen: specs ? specs.open : null, sentencesInContent: (content.match(/[a-z]{3,}\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+\s[a-z]+/g) || []).slice(0, 6), banned: { descr: /what a dollar|candidates from FMP|the box is their middle half|is not expected to grow/i.test(content), plusSigns: (content.match(/\+\d/g) || []).length },
      rowSample: [...box.querySelectorAll("#cm5Field .row")].slice(0, 3).map((r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 90)), boxW: box.clientWidth, boxSW: box.scrollWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, err: txt(".err") };
  });
  const shot = async (name, sel) => { await page.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: "start" }); }, sel || "#scCompsTab"); await sleep(400); await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) }); };
  out.ok = ok;
  await shot(ticker); out.tab = await facts();
  await shot(`${ticker}-range`, "#scCompsTab .sec:nth-of-type(2)");
  await shot(`${ticker}-field`, "#cm5Field");
  /* keep one outlier by a click, then let the rule exclude it again (the write is counted, answered locally) */
  const o = await page.$("#cm5Field .out"); if (o) { await o.click(); await sleep(900); out.afterKeep = await facts(); const k = await page.$("#cm5Field .out.kept"); if (k) { await k.click(); await sleep(900); } }
  await page.evaluate(() => { const d = document.querySelector('details.d[data-d="table"]'); if (d) d.open = true; }); await sleep(900);
  await shot(`${ticker}-table`, 'details.d[data-d="table"]');
  out.table = await page.evaluate(() => { const t = document.querySelector('details.d[data-d="table"] table'); if (!t) return null; return { cols: t.querySelectorAll("thead tr:last-child th").length, peers: t.querySelectorAll("tbody tr[data-peer]").length, outFlags: t.querySelectorAll(".flag").length }; });
  await page.evaluate(() => { const d = document.querySelector("details.sc-pagespecs"); if (d) d.open = true; const box = document.getElementById("scCompsTab"); for (let e = box; e && e !== document.body; e = e.parentElement) { e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
  await sleep(800); await page.locator("#scCompsTab").screenshot({ path: path.join(OUT, `${ticker}-full-${width}.png`), timeout: 120000 });
  out.errors = errors; out.apiFail = apiFail; out.writes = writes.length; out.writeList = writes.slice(0, 5);
  console.log(JSON.stringify(out));
} finally { await browser.close(); }
