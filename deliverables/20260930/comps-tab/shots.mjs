/* Headless proof for the COMPS tab (C2, 30 Sep). NEVER a visible window. This branch's Hub is served under its real
   hostname (https://scintillahub.ai/* → files from HUB_ROOT), so the chart API sees its own origin; Supabase reads go to
   the live database with the public key, as the Hub itself; every non-GET request is answered locally with an empty 201
   and counted, never sent (so a decision write never reaches the database from here — the tab then keeps it in the
   browser and says so, which is also what happens until the migration is applied).
     node shots.mjs <width> [ticker] → shots/{board,tab,off,back,cohort}-<width>.png (+ *-full.png of the whole tab) */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [widthS, ticker = "MU"] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots");
const width = +widthS, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], apiFail = [], errors = [], out = { width, ticker, steps: [] };
try {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(() => { try { localStorage.removeItem("sc_comps_decisions"); localStorage.setItem("hub.company.expanded", "0"); } catch (_) {} });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") { if (u.pathname.startsWith("/api/")) return route.continue(); const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "not found" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  page.on("response", (r) => { if (/massive-chart-api/.test(r.url()) && r.status() >= 400) apiFail.push(new URL(r.url()).pathname + " " + r.status()); });
  page.on("requestfailed", (r) => { if (/massive-chart-api/.test(r.url())) apiFail.push(new URL(r.url()).pathname + " failed"); });
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(9000);
  await page.screenshot({ path: path.join(OUT, `board-${width}.png`) });
  await page.evaluate((t) => { openCo(t); }, ticker);
  await sleep(3000);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#cvTabs [data-tab]')].map((b) => b.dataset.tab));
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
  let ok = false; try { await page.waitForSelector("#scCompsTab table.cp-tbl", { timeout: 90000 }); ok = true; } catch (_) {}
  try { await page.waitForSelector("#cpCohort table.cp-tbl", { timeout: 60000 }); } catch (_) {}
  await sleep(1200);
  const facts = () => page.evaluate(() => {
    const box = document.getElementById("scCompsTab"); if (!box) return { box: false };
    const txt = (s) => { const e = box.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 300) : null; };
    const stat = (cls, label) => [...box.querySelectorAll("table.cp-tbl tr.stat" + cls)].find((r) => r.innerText.trim().toLowerCase().startsWith(label))?.innerText.replace(/\s+/g, " ").trim();
    return { box: true, mounted: box.dataset.mounted, head: txt(".cp-head"), store: txt(".cp-store"), peers: box.querySelectorAll("table.cp-tbl tbody tr[data-peer]").length, off: box.querySelectorAll("table.cp-tbl tbody tr.off").length,
      far: box.querySelectorAll(".cp-flag.far").length, nm: box.querySelectorAll(".cp-flag.nm").length, allMedian: stat(":not(.sel)", "median"), selMedian: stat(".sel", "median"), fieldRows: box.querySelectorAll("#cpField .cp-row").length, fieldDrawn: [...box.querySelectorAll("#cpField svg")].filter((s) => s.childElementCount > 5).length,
      waysDrawn: (box.querySelector("#cpWays svg") || {}).childElementCount || 0, upside: [...box.querySelectorAll(".cp-upbox")].map((e) => e.innerText.replace(/\s+/g, " ").trim().slice(0, 120)), decisions: txt("#cpDecisions"), cohortRows: box.querySelectorAll("#cpCohort tbody tr").length, cohortFirst: (box.querySelector("#cpCohort tbody tr") || {}).innerText?.replace(/\s+/g, " ").trim().slice(0, 140),
      boxW: box.clientWidth, boxSW: box.scrollWidth, tableSW: (box.querySelector(".cp-tw") || {}).scrollWidth, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  const shot = async (name, sel) => {
    if (sel) await page.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: "start" }); }, sel); else await page.evaluate(() => { const e = document.getElementById("scCompsTab"); if (e) e.scrollIntoView({ block: "start" }); });
    await sleep(500); await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) });
  };
  out.tabs = tabs; out.ok = ok;
  await shot("tab"); out.steps.push({ step: "tab", ...(await facts()) });
  // two peers off: AXTI, then ARM (each opens the reason row; pick DIFFERENT BUSINESS and save)
  for (const t of ["AXTI", "ARM"]) {
    await page.click(`[data-cp="peer"][data-t="${t}"]`); await sleep(700);
    await page.click(`[data-cp="chip"][data-r="DIFFERENT BUSINESS"]`).catch(() => {}); await sleep(200);
    await page.click(`[data-cp="savereason"]`).catch(() => {}); await sleep(900);
  }
  await shot("off"); out.steps.push({ step: "off", ...(await facts()) });
  await shot("cohort", "#cpCohort"); out.steps.push({ step: "cohort", ...(await facts()) });
  await shot("ways", "#cpWays"); 
  // the whole tab, un-clipped, with the two peers off
  await page.evaluate(() => { const box = document.getElementById("scCompsTab"); for (let e = box; e && e !== document.body; e = e.parentElement) { e.style.setProperty("overflow", "visible", "important"); e.style.setProperty("height", "auto", "important"); e.style.setProperty("max-height", "none", "important"); } });
  await sleep(800); await page.locator("#scCompsTab").screenshot({ path: path.join(OUT, `off-${width}-full.png`), timeout: 120000 });
  // put back
  await page.click('[data-cp="putall"]'); await sleep(1200);
  await page.evaluate(() => { const e = document.getElementById("scCompsTab"); if (e) e.scrollIntoView({ block: "start" }); }); await sleep(400);
  await page.screenshot({ path: path.join(OUT, `back-${width}.png`) }); out.steps.push({ step: "back", ...(await facts()) });
  // persistence: reload the page, open the tab again — the browser-kept decisions must still be there
  await page.evaluate((t) => { openCo(t); }, ticker); await sleep(1500);
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="ESTIMATES"]'); if (b) b.click(); }); await sleep(1500);
  out.estimatesHasNoComps = await page.evaluate(() => !document.getElementById("scCompsLive") && !document.querySelector("#coRailContent .cp") && !!document.querySelector("#coRailContent .sc-est-sechead"));
  await page.screenshot({ path: path.join(OUT, `estimates-${width}.png`) });
  out.errors = errors; out.apiFail = apiFail; out.writes = writes.length; out.writesSample = writes.slice(0, 6);
  console.log(JSON.stringify(out));
} finally { await browser.close(); }
