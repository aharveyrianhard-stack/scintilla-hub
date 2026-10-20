/* CW3 · the pictures, headless, every non-file request blocked: first screen at 1680 and 390, the summary, every card, the whole page. OUT=<dir> node shots.mjs */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const OUT = process.env.OUT; const PIC = path.join(OUT, "pictures"); fs.mkdirSync(PIC, { recursive: true });
const report = { shots: [], errors: [], net: [] }; const browser = await chromium.launch({ headless: true });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h } }); const page = await context.newPage();
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); report.net.push(u); r.abort(); });
    page.on("pageerror", (e) => report.errors.push(String(e)));
    await page.goto("file://" + path.join(OUT, "COMPS-RADAR.html"), { waitUntil: "load" }); await page.waitForFunction(() => window.CW3_PAGE_READY === true); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(PIC, `comps-0-first-screen-${w}.png`) }); report.shots.push(`comps-0-first-screen-${w}.png`);
    report["sideways_" + w] = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (w === 1680) {
      const shot = async (name, sel) => { const c = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left + scrollX), y: r.top + scrollY, width: Math.min(r.width, innerWidth), height: r.height }; }, sel); if (c && c.height > 4) { await page.screenshot({ path: path.join(PIC, `${name}-${w}.png`), fullPage: true, clip: { x: c.x, y: c.y, width: Math.min(w, c.width), height: Math.min(c.height, 14000) } }); report.shots.push(`${name}-${w}.png`); } };
      await shot("comps-1-summary", "#summary");
      const ids = await page.evaluate(() => [...document.querySelectorAll("section.card")].map((e) => e.id.slice(2)));
      for (const t of ids) await shot(`comps-2-card-${t}`, `#c-${t}`);
      report.height = await page.evaluate(() => document.documentElement.scrollHeight);
      report.cards = ids.length; report.undefined_nan = await page.evaluate(() => (document.body.innerText.match(/undefined|NaN/g) || []).length);
    }
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(PIC, "_shots.json"), JSON.stringify(report, null, 1)); console.log(JSON.stringify({ shots: report.shots.length, errors: report.errors, net: report.net.length, cards: report.cards, height: report.height, sideways_1680: report.sideways_1680, sideways_390: report.sideways_390, undefined_nan: report.undefined_nan }));
