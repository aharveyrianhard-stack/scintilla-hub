/* PA2 · photographs the page headlessly (never a window) at 1680 × 1050, 1920 × 1080 and 390 (phone): the first screen (NOW + the pies),
   the EQUALIZER, one ring's fundamentals table, the PICKS, the whole page; moves a slider and checks the page re-ran; RESET.
   The branch's files are served under the Hub's hostname; every non-GET is answered locally and counted.
   node shots-pa2.mjs → shots/pa2-*.png + shots/pa2-facts.json */
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
    const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(w + ": " + String(e.message).slice(0, 200))); page.on("console", (m) => { if (m.type() === "error") errors.push(w + " console: " + m.text().slice(0, 200)); });
    await page.goto(URL0, { waitUntil: "networkidle" }); await sleep(700);
    await page.screenshot({ path: path.join(OUT, `pa2-now-${w}.png`) });
    const f = await page.evaluate(() => { const R = window.PA2 && window.PA2.result; const txt = document.getElementById("app").innerText; const specs = document.querySelector("details.sc-pagespecs"); const content = txt.replace(specs ? specs.innerText : "", "");
      const vis = [...document.querySelectorAll("#app *")].filter((e) => e.innerText && e.innerText.trim() && getComputedStyle(e).display !== "none" && e.offsetParent !== null && !e.closest("details.sc-pagespecs"));
      return { invested: R.own.invested, cash: R.B.cash, reading: R.own.reading, measure: R.own.measure, book: R.B.sectors.map((s) => [s.label, +s.share.toFixed(1), s.cohorts.map((c) => [c.label, +c.share.toFixed(1), c.names.map((n) => n.ticker).join(" ")])]),
        hot: R.H.hot, cold: R.H.cold, rings: R.kos.map((k) => [k.label, k.K.members.length, k.K.survivors.join(" "), k.K.outliers.out.map((o) => o.ticker).join(" ")]), picks: R.picks.map((p) => p.ticker + " " + p.share.toFixed(1) + "%"),
        strongest: R.FC.strongest.map((r) => r.ticker), weakest: R.FC.weakest.map((r) => r.ticker), knobs: document.querySelectorAll("[data-knob]").length, sliders: document.querySelectorAll("input[data-knob]").length, chips: document.querySelectorAll("button[data-knob]").length,
        pieArcs: document.querySelectorAll(".pie path").length, pieLabels: document.querySelectorAll(".pie text").length, heatCards: document.querySelectorAll(".heat .col").length, ringTables: document.querySelectorAll("details.ring").length, ringCols: document.querySelector("details.ring[open] thead") ? document.querySelector("details.ring[open] thead").querySelectorAll("th").length : 0,
        minFont: Math.min(...vis.map((e) => parseFloat(getComputedStyle(e).fontSize))), overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, height: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(2),
        codes: (content.match(/\b(se \d|rot[ −-]|fallback|FENCE|WEIGHTS COMPS|MAD\)|B1 THIN|way C)\b/gi) || []).slice(0, 8), specs: !!specs, tabs: document.querySelectorAll("nav.tabs a").length, firstScreenHasPie: document.querySelector(".pie svg").getBoundingClientRect().top < innerHeight, scnav: !!document.querySelector(".scnav") }; });
    facts[`${w}`] = f;
    if (w >= 1000) {
      const shot = async (sel, name) => { await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel); await sleep(350); await page.screenshot({ path: path.join(OUT, `pa2-${name}-${w}.png`) }); };
      await shot("#equalizer", "equalizer"); await shot("#heat", "heat"); await shot("#rings", "ring"); await shot("#picks", "picks");
      await page.evaluate(() => scrollTo(0, 0)); await sleep(200); await page.screenshot({ path: path.join(OUT, `pa2-page-${w}-full.png`), fullPage: true });
      /* the equalizer drives it: the sector cap 40 → 10 reshapes the book; names held 3 → 1; HOW MANY RISING; then RESET */
      const before = f.book.map((s) => s[1]).join(",");
      await page.fill('input[data-knob="max_sector"]', "10"); await page.dispatchEvent('input[data-knob="max_sector"]', "change"); await sleep(400);
      f.capAt10 = await page.evaluate(() => ({ book: window.PA2.result.B.sectors.map((s) => s.label + " " + s.share.toFixed(1)), cash: +window.PA2.result.B.cash.toFixed(1), unplaced: +window.PA2.result.B.unplaced.toFixed(1) }));
      await page.fill('input[data-knob="survivors"]', "1"); await page.dispatchEvent('input[data-knob="survivors"]', "change"); await sleep(400);
      f.held1 = await page.evaluate(() => window.PA2.result.picks.map((p) => p.ticker));
      await page.click('button[data-knob="own.measure"][data-val="breadth"]'); await sleep(400);
      f.breadth = await page.evaluate(() => ({ invested: window.PA2.result.own.invested, reading: window.PA2.result.own.reading }));
      await page.evaluate(() => document.querySelector("#equalizer").scrollIntoView()); await sleep(300); await page.screenshot({ path: path.join(OUT, `pa2-equalizer-moved-${w}.png`) });
      await page.evaluate(() => scrollTo(0, 0)); await sleep(300); await page.screenshot({ path: path.join(OUT, `pa2-now-moved-${w}.png`) });
      await page.click("#reset"); await sleep(400);
      f.afterReset = await page.evaluate(() => ({ book: window.PA2.result.B.sectors.map((s) => +s.share.toFixed(1)).join(","), picks: window.PA2.result.picks.length, invested: window.PA2.result.own.invested, moved: document.querySelectorAll(".val.moved").length }));
      f.resetRestores = f.afterReset.book === before;
      /* the whole ring unfolds */
      await page.evaluate(() => { const d = document.querySelector("details.ring[open] details.more"); if (d) d.open = true; }); await sleep(300);
      f.ringUnfoldedRows = await page.evaluate(() => [...document.querySelectorAll("details.ring[open] tbody tr")].filter((r) => getComputedStyle(r.querySelector("td")).display !== "none").length);
      await page.evaluate(() => { const d = document.querySelector("details.ring[open] details.more"); if (d) d.open = false; }); await sleep(300);
      f.ringFoldedRows = await page.evaluate(() => [...document.querySelectorAll("details.ring[open] tbody tr")].filter((r) => getComputedStyle(r.querySelector("td")).display !== "none").length);
    } else { await page.evaluate(() => document.querySelector("#equalizer").scrollIntoView()); await sleep(300); await page.screenshot({ path: path.join(OUT, `pa2-equalizer-${w}.png`) }); await page.evaluate(() => document.querySelector("#rings").scrollIntoView()); await sleep(300); await page.screenshot({ path: path.join(OUT, `pa2-ring-${w}.png`) }); }
    await ctx.close();
  }
  facts.writes = writes.length; facts.errors = errors;
  fs.writeFileSync(path.join(OUT, "pa2-facts.json"), JSON.stringify(facts, null, 1)); console.log(JSON.stringify(facts, null, 1));
} finally { await browser.close(); }
