/* K1 — pictures of the report page itself (headless), 1680 and 390 wide, with the checks the lane rules ask for. */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../../../.."), out = {};
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars"] });
try {
  for (const w of [1680, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 1050 }, deviceScaleFactor: 1, serviceWorkers: "block" });
    await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); if (u.host !== "scintillahub.ai") return route.abort();
      let f = path.join(root, decodeURIComponent(u.pathname)); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream" }, body: fs.readFileSync(f) }); });
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
    await page.goto("https://scintillahub.ai/deliverables/20261005/k1-backlog/K1-BACKLOG.html", { waitUntil: "load" });
    await page.evaluate(async () => { for (const i of document.images) { i.loading = "eager"; } await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))); });
    out[w] = await page.evaluate(() => {
      const bad = [], small = [];
      for (const el of document.querySelectorAll("main *")) { const cs = getComputedStyle(el); if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const fs = parseFloat(cs.fontSize); if (fs < 11) small.push(el.tagName + " " + fs);
        const m = cs.color.match(/\d+/g).map(Number); if (Math.max(...m.slice(0, 3)) > 210 || Math.max(...m.slice(0, 3)) - Math.min(...m.slice(0, 3)) > 24) bad.push(el.tagName + " " + cs.color); }
      return { overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, images: document.images.length, broken: [...document.images].filter((i) => !i.naturalWidth).length,
        rows: document.querySelectorAll("tbody tr").length, navPair: !!document.querySelector("[class*=scnav], #scnav, .sc-nav"), smallText: [...new Set(small)].slice(0, 5), nonGrey: [...new Set(bad)].slice(0, 5), h: document.documentElement.scrollHeight };
    });
    out[w].errors = errs;
    await page.screenshot({ path: path.join(here, "..", "shots", `report-top-${w}.png`) });
    await page.evaluate(() => document.querySelector("table").scrollIntoView({ block: "start" })); await page.screenshot({ path: path.join(here, "..", "shots", `report-table-${w}.png`) });
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
