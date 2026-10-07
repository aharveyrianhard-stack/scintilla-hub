/* PA1 · photographs the new page headlessly (never a window) at 1680 × 1050 and 1920 × 1080: THE CHAIN (top, the knockouts, the picks,
   the whole page) and MARKET DISCUSSION. The branch's files are served under the Hub's hostname; every non-GET is answered locally and
   counted. node shots.mjs → shots/pa1-*.png + shots/pa1-facts.json */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../.."), OUT = path.join(HERE, "shots"), URL0 = "https://scintillahub.ai/deliverables/20261005/pa1-allocation/";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars"] });
const writes = [], errors = [], facts = {};
try {
  for (const [w, h] of [[1680, 1050], [1920, 1080], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: w < 500 });
    await ctx.route("**/*", async (route) => { const req = route.request(), u = new URL(req.url()); if (req.method() !== "GET" && req.method() !== "HEAD") { writes.push(req.method() + " " + u.host + u.pathname); return route.fulfill({ status: 201, body: "[]" }); } if (u.host === "scintillahub.ai") { const f = localFile(u.pathname); return f ? route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: "" }); } return route.continue(); });
    const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(w + ": " + String(e.message).slice(0, 200)));
    await page.goto(URL0 + "?view=chain", { waitUntil: "networkidle" }); await sleep(700);
    await page.screenshot({ path: path.join(OUT, `pa1-chain-${w}.png`) });
    const f = await page.evaluate(() => { const R = window.PA1 && window.PA1.result; const txt = document.getElementById("app").innerText; const specs = document.querySelector("details.sc-pagespecs"); const content = txt.replace(specs ? specs.innerText : "", "");
      return { heatCols: document.querySelectorAll(".heat .col").length, hot: R ? R.H.hot : null, cold: R ? R.H.cold : null, kos: R ? R.kos.map((k) => [k.label, k.K.members.length, k.K.survivors.join(" "), k.K.outliers.out.map((o) => o.ticker).join(" ")]) : null, picks: R ? R.picks.map((p) => p.ticker) : null, dials: document.querySelectorAll("[data-dial]").length, minFont: Math.min(...[...document.querySelectorAll("#app *")].filter((e) => e.innerText && e.innerText.trim() && getComputedStyle(e).display !== "none").map((e) => parseFloat(getComputedStyle(e).fontSize))), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, height: document.documentElement.scrollHeight, sentencesInPanels: (content.match(/\b[a-z]{3,} [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+\b/g) || []).slice(0, 5), specs: !!specs }; });
    facts[`chain-${w}`] = f;
    if (w >= 1000) {
      await page.evaluate(() => document.querySelector(".ko").scrollIntoView()); await sleep(300); await page.screenshot({ path: path.join(OUT, `pa1-knockout-${w}.png`) });
      await page.evaluate(() => [...document.querySelectorAll("h2")].find((h) => /^PICKS/.test(h.innerText)).scrollIntoView()); await sleep(300); await page.screenshot({ path: path.join(OUT, `pa1-picks-${w}.png`) });
      await page.screenshot({ path: path.join(OUT, `pa1-chain-${w}-full.png`), fullPage: true });
      /* a dial moves: survivors 3 → 5, then reset */
      await page.fill("#d-survivors", "5"); await page.dispatchEvent("#d-survivors", "change"); await sleep(300);
      facts[`chain-${w}`].dialSurvivors5 = await page.evaluate(() => window.PA1.result.picks.length); await page.click("#reset"); await sleep(300);
      facts[`chain-${w}`].afterReset = await page.evaluate(() => window.PA1.result.picks.length);
    }
    await page.goto(URL0 + "?view=discussion", { waitUntil: "networkidle" }); await sleep(600);
    await page.screenshot({ path: path.join(OUT, `pa1-discussion-${w}.png`) });
    facts[`discussion-${w}`] = await page.evaluate(() => { const R = window.PA1.result; return { strongest: R.FC.strongest.map((r) => r.ticker + " " + r.chain.toFixed(2)), weakest: R.FC.weakest.map((r) => r.ticker + " " + r.chain.toFixed(2)), rows: document.querySelectorAll(".disc .row").length, height: document.documentElement.scrollHeight, fitsOneScreen: document.querySelector(".disc").getBoundingClientRect().bottom <= innerHeight }; });
    await ctx.close();
  }
  facts.writes = writes.length; facts.errors = errors;
  fs.writeFileSync(path.join(OUT, "pa1-facts.json"), JSON.stringify(facts, null, 1)); console.log(JSON.stringify(facts, null, 1));
} finally { await browser.close(); }
