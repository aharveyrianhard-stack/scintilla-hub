/* F1 · headless shots of F1-FULL-TREATMENT.html at 1680 and 390 (never a visible window); prints sideways-scroll facts. */
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { createRequire } from 'node:module'
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json'); const { chromium } = require('playwright-core')
const HERE = path.dirname(fileURLToPath(import.meta.url)), url = pathToFileURL(path.join(HERE, 'F1-FULL-TREATMENT.html')).href
const b = await chromium.launch({ headless: true })
try {
  for (const w of [1680, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 1000 } })
    await p.goto(url); await p.waitForTimeout(600)
    await p.screenshot({ path: path.join(HERE, 'shots', `report-top-${w}.png`) })
    await p.evaluate(() => document.querySelectorAll('h2')[2].scrollIntoView()); await p.waitForTimeout(200)
    await p.screenshot({ path: path.join(HERE, 'shots', `report-56-${w}.png`) })
    const f = await p.evaluate(() => ({ sideways: document.documentElement.scrollWidth > innerWidth + 1, minFont: Math.min(...[...document.querySelectorAll('body *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))) }))
    console.log(w, JSON.stringify(f)); await p.close()
  }
} finally { await b.close() }
