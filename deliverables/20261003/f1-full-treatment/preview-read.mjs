/* F1 (3 Oct 2026) · READ, BEFORE AND AFTER THE STAGED DOSSIER — on the DEPLOYED page, headless, nothing written anywhere.
   "after": the page's own GET of ticker_context for this one name is answered with the staged row (data/staged-20261003.json), so
   READ renders through the Hub's own code exactly as it will once the load is applied. Every non-GET is answered locally and counted.
     node preview-read.mjs <TICKER> <before|after> <width>   → shots/preview-<T>-<mode>-<SECTION>-<width>.png + one JSON line */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module'
const require = createRequire('/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json')
const { chromium } = require('playwright-core')
const [T, mode, widthS] = process.argv.slice(2), width = +widthS, mobile = width < 500
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'shots')
const staged = JSON.parse(fs.readFileSync(path.join(HERE, 'data/staged-20261003.json'), 'utf8'))
const row = staged.ticker_context.find((r) => r.ticker === T)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--hide-scrollbars', '--mute-audio'] })
let writes = 0, served = 0
const out = { ticker: T, mode, width, read: {} }
try {
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 }, deviceScaleFactor: 1, serviceWorkers: 'block', isMobile: mobile, hasTouch: mobile })
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u = req.url(), m = req.method()
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') { writes++; return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '[]' }) }
    if (mode === 'after' && row && /\/rest\/v1\/ticker_context\?/.test(u) && u.includes('ticker=eq.' + encodeURIComponent(T))) {
      served++
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify([{ ticker: T, narrative: null, business_now: row.business_now, catalysts: row.catalysts, watch_notes: row.watch_notes, enriched_ts: Math.floor(Date.parse(staged.built_utc) / 1000), updated_ts: Math.floor(Date.parse(staged.built_utc) / 1000) }]) })
    }
    return route.continue()
  })
  const page = await ctx.newPage()
  await page.goto('https://scintillahub.ai/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction(() => typeof openCo === 'function' && typeof BOARD_SNAPSHOT !== 'undefined' && BOARD_SNAPSHOT && BOARD_SNAPSHOT.rows && BOARD_SNAPSHOT.rows.length > 100, null, { timeout: 120000 }).catch(() => {})
  await sleep(3000)
  await page.evaluate((t) => openCo(t), T)
  await page.waitForFunction((t) => S.coData && S.coData.t === t, T, { timeout: 30000 }).catch(() => {})
  await sleep(1500)
  await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="READ"]'); if (b) b.click() })
  await sleep(900)
  fs.mkdirSync(OUT, { recursive: true })
  for (const sec of ['BUSINESS', 'CATALYSTS', 'WATCH']) {
    await page.evaluate((s) => { const b = document.querySelector('[data-act="readtab"][data-tab="' + s + '"]'); if (b) b.click() }, sec)
    await sleep(600)
    out.read[sec] = await page.evaluate(() => { const e = document.getElementById('readTxt'); return e ? e.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null })
    await page.evaluate(() => { const e = document.getElementById('readTxt'); if (e) e.scrollIntoView({ block: 'center' }) })
    await sleep(300)
    await page.screenshot({ path: path.join(OUT, `preview-${T}-${mode}-${sec}-${width}.png`) })
  }
  out.sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
} finally { await browser.close() }
out.writes_blocked = writes; out.staged_reads_answered = served
console.log(JSON.stringify(out))
