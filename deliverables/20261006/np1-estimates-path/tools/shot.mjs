// NP1 — headless pictures of the page at 1680 and 390 wide. Never a visible window. Every non-GET request is blocked and counted.
//   node tools/shot.mjs            writes shots/np1-{1680,390}-{top,full}.png and prints what it measured
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json")
const { chromium } = require("playwright-core")
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const page = pathToFileURL(join(root, "NP1-ESTIMATES-PATH.html")).href
const b = await chromium.launch({ headless: true })
const out = []
try {
  for (const [w, h, name] of [[1680, 1050, "1680"], [390, 844, "390"]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1, serviceWorkers: "block" })
    let blocked = 0, requests = 0
    await ctx.route("**/*", (r) => { requests++; if (r.request().method() !== "GET") { blocked++; return r.abort() } r.continue() })
    const p = await ctx.newPage()
    const errors = []
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)))
    await p.goto(page, { waitUntil: "load" }); await p.waitForTimeout(500)
    await p.screenshot({ path: join(root, "shots", `np1-${name}-top.png`) })
    await p.screenshot({ path: join(root, "shots", `np1-${name}-full.png`), fullPage: true })
    const m = await p.evaluate(() => {
      const de = document.documentElement
      const small = [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11).length
      const wide = [...document.querySelectorAll("main *")].filter((el) => !el.closest(".wrap,.scroll") && el.getBoundingClientRect().right > de.clientWidth + 1).map((el) => el.className || el.tagName).slice(0, 5)
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, height: de.scrollHeight, textUnder11px: small, spillsRight: wide, rows: document.querySelectorAll("#list tbody tr").length }
    })
    // the filter chips: press "listed under 2 years" and count the rows left showing
    await p.click('#chips button[data-k="NEW_LISTING"]')
    const shown = await p.evaluate(() => [...document.querySelectorAll("#list tbody tr")].filter((r) => r.style.display !== "none").length)
    out.push({ width: w, ...m, rowsAfterNewListingChip: shown, requests, nonGetBlocked: blocked, pageErrors: errors })
    await ctx.close()
  }
} finally { await b.close() }
console.log(JSON.stringify(out, null, 1))
