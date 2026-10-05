/* F1 (3 Oct 2026) · THE REAL PAGE, HEADLESS. NEVER a visible window.
   Opens the DEPLOYED Hub (https://scintillahub.ai, live database, live chart API), and for each name: opens the company view,
   clicks every company tab and every READ section, and records what the pane actually says. Also reads the board row the page
   built for the name (BOARD_SNAPSHOT) and the EARNINGS room calendar rows. Every non-GET request is answered locally and counted
   (nothing is written anywhere).
     node page-probe.mjs <names file (JSON array)> <out.json> [workers=3] [shotsDir]
   One JSON row per name: { ticker, board:{…}, tabs:{ TAB: { text, len } }, read:{ SECTION: text }, errors, writes } */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [namesFile, outFile, workersS = "3", shotsDir = ""] = process.argv.slice(2);
const NAMES = JSON.parse(fs.readFileSync(namesFile, "utf8"));
const SHOT = new Set((process.env.SHOT || "").split(",").filter(Boolean));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TABS = ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"];
const READS = ["BUSINESS", "VERDICT", "CATALYSTS", "WATCH"];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const results = [];
let writes = 0;
async function worker (queue, wi) {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const m = route.request().method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes++; return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.length < 50 && errors.push(String(e.message).slice(0, 160)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => typeof openCo === "function" && typeof BOARD_SNAPSHOT !== "undefined" && BOARD_SNAPSHOT && BOARD_SNAPSHOT.rows && BOARD_SNAPSHOT.rows.length > 100, null, { timeout: 120000 }).catch(() => {});
  await sleep(4000);
  while (queue.length) {
    const t = queue.shift();
    const row = { ticker: t, tabs: {}, read: {}, worker: wi };
    const e0 = errors.length;
    try {
      row.board = await page.evaluate((t) => {
        const r = (BOARD_SNAPSHOT.rows || []).find((x) => x.t === t);
        if (!r) return null;
        const pick = {}; for (const k of ["price", "c", "fpe", "mc", "rev", "revCcy", "rsi", "g", "tr", "mo", "rv"]) pick[k] = r[k] === undefined ? "undefined" : r[k];
        return pick;
      }, t);
      await page.evaluate((t) => { openCo(t); }, t);
      await page.waitForFunction((t) => S.coData && S.coData.t === t && !S.coData._loading, t, { timeout: 30000 }).catch(() => {});
      await sleep(1200);
      for (const tab of TABS) {
        await page.evaluate((tab) => { const b = document.querySelector('[data-act="cotab"][data-tab="' + tab + '"]'); if (b) b.click(); }, tab);
        await sleep(tab === "COMPS" ? 6000 : tab === "FUNDAMENTALS" ? 5000 : tab === "SOCIAL" ? 4000 : 1600);
        const got = await page.evaluate((tab) => {
          const box = document.getElementById("coRailContent") || document.querySelector(".cv-body") || document.body;
          let text = (box.innerText || "").replace(/\s+/g, " ").trim();
          let frame = null;
          if (tab === "FUNDAMENTALS") { const f = document.getElementById("coFundFrame"); frame = f ? f.getAttribute("src") : null; }
          return { text: text.slice(0, 1200), len: text.length, frame };
        }, tab);
        if (tab === "FUNDAMENTALS") {
          const fr = page.frames().find((f) => /fundamentals-v1/.test(f.url()));
          if (fr) { try { const ft = await fr.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim()); got.frameText = ft.slice(0, 900); got.frameLen = ft.length } catch (e) { got.frameText = "FRAME READ FAILED " + e.message } }
        }
        row.tabs[tab] = got;
        if (SHOT.has(t) && shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${t}-${tab}-1680.png`) }); }
        if (tab === "READ") {
          for (const sec of READS) {
            await page.evaluate((sec) => { const b = document.querySelector('[data-act="readtab"][data-tab="' + sec + '"]'); if (b) b.click(); }, sec);
            await sleep(500);
            row.read[sec] = await page.evaluate(() => { const e = document.getElementById("readTxt"); return e ? e.innerText.replace(/\s+/g, " ").trim().slice(0, 600) : null; });
            if (SHOT.has(t) && shotsDir) await page.screenshot({ path: path.join(shotsDir, `${t}-READ-${sec}-1680.png`) });
          }
        }
      }
    } catch (e) { row.fail = String(e.message).slice(0, 200); }
    row.errors = errors.slice(e0);
    results.push(row);
    process.stderr.write(`${results.length}/${NAMES.length} ${t}\n`);
  }
  await context.close();
}
try {
  const queue = [...NAMES];
  await Promise.all(Array.from({ length: +workersS }, (_, i) => worker(queue, i)));
} finally { await browser.close(); }
fs.writeFileSync(outFile, JSON.stringify({ built_utc: new Date().toISOString(), site: "https://scintillahub.ai (deployed)", writes_blocked: writes, rows: results }));
console.log(JSON.stringify({ names: results.length, writes_blocked: writes, failed: results.filter((r) => r.fail).length }));
