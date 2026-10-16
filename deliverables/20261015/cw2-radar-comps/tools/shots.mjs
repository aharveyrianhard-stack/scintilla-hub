/* CW2 · the pictures, headless, every non-file request blocked: the page at 1680 (first screen, the summary, every card, the peer-set check, where the method breaks, the whole page) and the first screen at 390; what was on the page.   OUT=<dir> PIC=<dir> node shots.mjs */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const OUT = process.env.OUT, PIC = process.env.PIC; fs.mkdirSync(PIC, { recursive: true });
const report = []; const browser = await chromium.launch({ headless: true });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h } }); const page = await context.newPage(); const errors = [], net = [];
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); net.push(u); r.abort(); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("file://" + path.join(OUT, "RADAR-COMPS.html"), { waitUntil: "load" }); await page.waitForFunction(() => window.CW2_PAGE_READY === true); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(PIC, `radar-comps-0-first-screen-${w}.png`) });
    if (w === 1680) {
      const shot = async (name, sel) => { const c = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.max(0, r.left + scrollX), y: r.top + scrollY, width: Math.min(r.width, innerWidth), height: r.height }; }, sel); if (c && c.height > 4) await page.screenshot({ path: path.join(PIC, `${name}-${w}.png`), fullPage: true, clip: { x: c.x, y: c.y, width: Math.min(w, c.width), height: Math.min(c.height, 14000) } }); };
      await shot("radar-comps-1-summary", "table.rank");
      const ids = await page.evaluate(() => [...document.querySelectorAll("section.card")].map((e) => e.id.slice(2)));
      for (const t of ids) await shot(`radar-comps-2-card-${t}`, `#c-${t}`);
      await shot("radar-comps-3-peer-set-check", "table.pc"); await shot("radar-comps-4-where-it-breaks", "#breaks");
      await page.screenshot({ path: path.join(process.env.FULL || PIC, `radar-comps-full-page-${w}.png`), fullPage: true });
    }
    const info = await page.evaluate(() => { const leaves = [...document.body.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim() && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0 && !e.closest("svg") && !e.closest("script") && !e.closest("style")); const text = document.body.innerText;
      return { scrollW: document.scrollingElement.scrollWidth, innerW: innerWidth, pageH: document.scrollingElement.scrollHeight, minFont: Math.min(...leaves.map((e) => parseFloat(getComputedStyle(e).fontSize))), fields: document.querySelectorAll("svg.ff").length, cards: document.querySelectorAll("section.card").length, tables: document.querySelectorAll("table").length, widestTable: Math.max(...[...document.querySelectorAll("table")].map((t) => t.scrollWidth)), laneCodes: (text.match(/\b(CW[12]|CS[0-9]|CP[0-9]|C[3-6]b?|PP1)\b/g) || []).length, invented: (text.match(/\bundefined\b|\bNaN\b|\[object/g) || []).length, title: document.title }; });
    report.push({ width: w, errors, blockedRequests: net.length, ...info }); await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, "reads/_shots.json"), JSON.stringify({ takenAt: new Date().toISOString(), report }, null, 1)); console.log(JSON.stringify(report, null, 1)); console.log("pictures:", fs.readdirSync(PIC).filter((f) => f.endsWith(".png")).length);
