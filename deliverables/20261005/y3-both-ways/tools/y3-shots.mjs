// Y3 — headless pictures of the report page at 1680 and 390. Never a visible window; every non-GET request is blocked and counted.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json');
const { chromium } = require('playwright-core');
const HERE = dirname(fileURLToPath(import.meta.url)), PAGE = pathToFileURL(join(HERE, '..', 'Y3-BOTH-WAYS.html')).href;
const browser = await chromium.launch({ headless: true });
let blocked = 0; const out = [];
try {
  for (const [name, width, height] of [['1680', 1680, 1050], ['390', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await ctx.route('**/*', (route) => { if (route.request().method() !== 'GET') { blocked++; return route.abort(); } return route.continue(); });
    const page = await ctx.newPage();
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.screenshot({ path: join(HERE, '..', 'screens', 'top-' + name + '.jpg'), type: 'jpeg', quality: 80 });
    await page.locator('h2').nth(2).scrollIntoViewIfNeeded();
    await page.evaluate(() => { const h = document.querySelectorAll('h2')[2]; window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 10); });
    await page.screenshot({ path: join(HERE, '..', 'screens', 'settled-' + name + '.jpg'), type: 'jpeg', quality: 80 });
    const facts = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth - window.innerWidth, rows: document.querySelectorAll('tr').length,
      minFont: Math.min(...[...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
      nav: !!document.querySelector('[data-scnav-slot]') }));
    out.push({ name, ...facts });
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ blocked_non_get: blocked, shots: out }));
