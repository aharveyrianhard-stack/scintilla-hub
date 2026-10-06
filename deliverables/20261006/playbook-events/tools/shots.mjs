// Headless pictures of the study page at 1680 and 390 wide. Never a visible window; every non-GET request is blocked and counted.
import { createRequire } from "module"; import path from "path"; import { fileURLToPath, pathToFileURL } from "url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)); const page_url = pathToFileURL(path.join(here, "..", "PLAYBOOK-EVENTS.html")).href; const out = path.join(here, "..", "shots");
const browser = await chromium.launch({ headless: true }); let blocked = 0; const report = {};
for (const [w, h] of [[1680, 1000], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  await page.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort(); } return r.continue(); });
  const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(page_url, { waitUntil: "load" });
  await page.evaluate(async () => { for (const i of document.images) { i.loading = "eager"; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); } });
  const info = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, imgs: document.images.length, broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute("src")), tables: document.querySelectorAll("table").length, sections: [...document.querySelectorAll("section h2")].map(x => [x.textContent.slice(0, 40), Math.round(x.getBoundingClientRect().top + scrollY)]), nav: !!document.querySelector(".scnav"), small: [...document.querySelectorAll("body *")].filter(el => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11).length }));
  report[w] = { ...info, errors };
  await page.screenshot({ path: path.join(out, `page-${w}-full.png`), fullPage: true });
  await page.screenshot({ path: path.join(out, `page-${w}-top.png`) });
  for (const [name, y] of info.sections) { const n = name.trim()[0]; await page.evaluate(yy => scrollTo(0, yy - 10), y); await page.screenshot({ path: path.join(out, `page-${w}-s${n}.png`) }); }
  await ctx.close();
}
await browser.close(); console.log(JSON.stringify({ blocked_non_get: blocked, report }, null, 1));
