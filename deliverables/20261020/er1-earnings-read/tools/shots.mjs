/* ER1 · the pictures, headless, every non-file request blocked: first screen at 1680 and 390, each SVG picture, the summary, the season
   screen, every reporter section, the calendar, plus the whole page height and a count of undefined/NaN. OUT=<deliverable dir> node shots.mjs */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const OUT = process.env.OUT; const PIC = path.join(OUT, "pictures"); fs.mkdirSync(PIC, { recursive: true });
const report = { shots: [], errors: [], net: [], built_utc: new Date().toISOString() }; const browser = await chromium.launch({ headless: true });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await context.newPage();
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); report.net.push(u); r.abort(); });
    page.on("pageerror", (e) => report.errors.push(String(e)));
    await page.goto("file://" + path.join(OUT, "EARNINGS-READ-20261020.html"), { waitUntil: "load" }); await page.waitForFunction(() => window.ER1_PAGE_READY === true); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(PIC, `er1-0-first-screen-${w}.png`) }); report.shots.push(`er1-0-first-screen-${w}.png`);
    report["sideways_" + w] = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (w === 1680) {
      const shot = async (name, sel, maxH = 14000) => { const c = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left + scrollX), y: r.top + scrollY, width: Math.min(r.width, innerWidth), height: r.height }; }, sel); if (c && c.height > 4) { await page.screenshot({ path: path.join(PIC, `${name}-${w}.png`), fullPage: true, clip: { x: c.x, y: c.y, width: Math.min(w, c.width), height: Math.min(c.height, maxH) } }); report.shots.push(`${name}-${w}.png`); } };
      await shot("er1-1-reaction-day", "#pic-reaction"); await shot("er1-1-whole-move", "#pic-total"); await shot("er1-1-eps-surprise", "#pic-surprise");
      await shot("er1-2-summary", "#summary-table"); 
      const seasonBox = await page.evaluate(() => { const a = document.querySelector("#season").getBoundingClientRect(); const b = document.querySelector(".season").getBoundingClientRect(); return { x: 0, y: a.top + scrollY, width: innerWidth, height: b.bottom - a.top }; });
      await page.screenshot({ path: path.join(PIC, `er1-3-season-${w}.png`), fullPage: true, clip: seasonBox }); report.shots.push(`er1-3-season-${w}.png`);
      const ids = await page.evaluate(() => [...document.querySelectorAll("section.card")].map((e) => e.id.slice(2)));
      for (const t of ids) await shot(`er1-4-${t}`, `#c-${t}`);
      await shot("er1-5-calendar", "#calendar-table", 6000);
      report.height = await page.evaluate(() => document.documentElement.scrollHeight); report.sections = ids.length;
      report.undefined_nan = await page.evaluate(() => (document.body.innerText.match(/undefined|NaN/g) || []).length);
      report.summary_rows = await page.evaluate(() => document.querySelectorAll("#summary-table tbody tr").length); report.calendar_rows = await page.evaluate(() => document.querySelectorAll("#calendar-table tbody tr").length);
    }
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(PIC, "_shots.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ shots: report.shots.length, errors: report.errors, net: report.net.length, sections: report.sections, height: report.height, sideways_1680: report.sideways_1680, sideways_390: report.sideways_390, undefined_nan: report.undefined_nan, summary_rows: report.summary_rows, calendar_rows: report.calendar_rows }));
