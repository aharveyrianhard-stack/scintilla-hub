/* TR1 · headless shots of the deliverable page itself (never a visible window): 1680 and 390, top and full. */
import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
try {
  for (const w of [1680, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 1050 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
    let nonGet = 0; await ctx.route("**/*", (r) => { if (r.request().method() !== "GET") { nonGet++; return r.abort(); } return r.continue(); });
    await page.goto(pathToFileURL(path.join(D, "TREE-ADOPTED.html")).href, { waitUntil: "load" });
    await page.evaluate(async () => { for (const i of document.images) { i.loading = "eager"; if (!i.complete) await new Promise((r) => { i.onload = i.onerror = r; }); } });
    await page.screenshot({ path: path.join(D, "shots", `page-${w}-top.png`) });
    for (const [n, sel] of [["tree", "h2:nth-of-type(2)"], ["index", "h2:nth-of-type(3)"], ["weak", "h2:nth-of-type(5)"]]) { await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel); await page.screenshot({ path: path.join(D, "shots", `page-${w}-${n}.png`) }); }
    const f = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, imgs: [...document.images].map((i) => i.naturalWidth > 0), nav: !!document.querySelector("[data-scnav], .scnav, #scnav"), minFont: Math.min(...[...document.querySelectorAll("td,th,p,pre,figcaption,span")].map((x) => parseFloat(getComputedStyle(x).fontSize))), rows: document.querySelectorAll("tbody tr").length }));
    console.log(JSON.stringify({ w, ...f, errors, nonGet })); await ctx.close();
  }
} finally { await browser.close(); }
