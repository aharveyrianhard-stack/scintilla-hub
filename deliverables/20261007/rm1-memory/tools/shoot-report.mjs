// RM1 — screenshot a local report page headless at 1680 and at 390 wide.
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [file, outPrefix] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
    await page.goto("file://" + file);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, figures: document.querySelectorAll("figure.ch").length, minFont: Math.min(...[...document.querySelectorAll("body *")].filter((n) => n.childNodes.length && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((n) => parseFloat(getComputedStyle(n).fontSize))) }));
    await page.screenshot({ path: outPrefix + "-" + w + ".png", fullPage: true });
    if (w === 1680) { const total = await page.evaluate(() => document.documentElement.scrollHeight); for (let y = 0, i = 0; y < total; y += 1900, i++) await page.screenshot({ path: outPrefix + "-part" + i + ".png", fullPage: true, clip: { x: 0, y, width: 1680, height: Math.min(1900, total - y) } }); }
    if (w === 1680) { const fig = page.locator("figure.ch").first(); await fig.scrollIntoViewIfNeeded(); const box = await fig.locator("svg").boundingBox(); await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5); await page.waitForTimeout(200); await fig.screenshot({ path: outPrefix + "-hover.png" }); }
    console.log(w + " wide:", JSON.stringify(overflow), "page errors:", errors.length ? errors.join(" | ") : "none");
  }
} finally { await browser.close(); }
