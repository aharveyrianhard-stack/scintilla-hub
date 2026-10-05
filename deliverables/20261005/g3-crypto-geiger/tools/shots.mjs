// Headless shots of the report at 1680 and 390 wide. Every non-GET request is blocked and counted.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json')
const { chromium } = require('playwright-core')
const [page_, out] = process.argv.slice(2)
const browser = await chromium.launch({ headless: true })
let blocked = 0; const errors = []
try {
  for (const w of [1680, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1 })
    await ctx.route('**/*', r => { if (r.request().method() !== 'GET') { blocked++; return r.abort() } return r.continue() })
    const p = await ctx.newPage()
    p.on('pageerror', e => errors.push(String(e)))
    await p.goto(pathToFileURL(page_).href)
    await p.screenshot({ path: `${out}/g3-${w}.png`, fullPage: true })
    await p.screenshot({ path: `${out}/g3-${w}-top.png` })
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight,
      minFont: Math.min(...[...document.querySelectorAll('main *')].filter(e => e.children.length === 0 && e.textContent.trim()).map(e => parseFloat(getComputedStyle(e).fontSize))) }))
    console.log(w, JSON.stringify(m))
    await ctx.close()
  }
} finally { await browser.close() }
console.log('non-GET blocked', blocked, 'page errors', errors.length, errors.slice(0, 3))
