// U5b · headless proof shots of WHAT-LIVES-WHERE.html at 1680 and 390. Never a visible window; every non-GET request is blocked.
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url'; import path from 'node:path'; import fs from 'node:fs';
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json');
const { chromium } = require('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url)); const page_ = 'file://' + path.join(here, 'WHAT-LIVES-WHERE.html');
fs.mkdirSync(path.join(here, 'shots'), { recursive: true });
const b = await chromium.launch({ headless: true }); let blocked = 0;
for (const [w, h, tag] of [[1680, 1050, '1680'], [390, 844, '390']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.route('**/*', r => { if (r.request().method() !== 'GET') { blocked++; return r.abort(); } r.continue(); });
  const p = await ctx.newPage(); await p.goto(page_, { waitUntil: 'load' });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth); const ch = await p.evaluate(() => document.documentElement.clientWidth);
  await p.screenshot({ path: path.join(here, 'shots', `top-${tag}.png`) });
  await p.evaluate(() => document.querySelector('#tree').scrollIntoView()); await p.screenshot({ path: path.join(here, 'shots', `tree-${tag}.png`) });
  await p.evaluate(() => document.querySelector('#one').scrollIntoView()); await p.screenshot({ path: path.join(here, 'shots', `one-${tag}.png`) });
  await p.evaluate(() => document.querySelector('#sound').scrollIntoView()); await p.screenshot({ path: path.join(here, 'shots', `sound-${tag}.png`) });
  const nav = await p.$eval('.scnav', n => n.textContent.trim()).catch(() => 'NO SCNAV');
  console.log(JSON.stringify({ tag, scrollWidth: sw, clientWidth: ch, sideways: sw > ch, scnav: nav, blocked }));
  await ctx.close();
}
await b.close();
