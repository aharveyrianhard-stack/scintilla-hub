// headless shots of the report (no visible window; every non-GET request blocked and counted)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json')
const { chromium } = require('playwright-core')
const path = fileURLToPath(new URL('./O1-OFFHUB.html', import.meta.url))
const shots = fileURLToPath(new URL('./shots/', import.meta.url))
const b = await chromium.launch({ headless: true })
let blocked = 0
for (const [w, h, name] of [[1680, 1050, 'top-1680'], [390, 844, 'top-390']]) {
  const pg = await b.newPage({ viewport: { width: w, height: h } })
  await pg.route('**/*', r => { if (r.request().method() !== 'GET') { blocked++; return r.abort() } r.continue() })
  await pg.goto('file://' + path); await pg.waitForTimeout(300)
  const sw = await pg.evaluate(() => document.documentElement.scrollWidth)
  await pg.screenshot({ path: `${shots}${name}.png`, fullPage: false })
  console.log(JSON.stringify({ name, viewport: [w, h], scrollWidth: sw, sideways: sw > w }))
  await pg.close()
}
console.log(JSON.stringify({ non_get_blocked: blocked })); await b.close()
