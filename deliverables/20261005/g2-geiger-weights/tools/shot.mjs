import { createRequire } from "node:module"
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json")
const { chromium } = require("playwright-core")
const file = process.argv[2], out = process.argv[3]
const browser = await chromium.launch({ headless: true })
let blocked = 0
for (const [w, name] of [[1680, "wide"], [390, "phone"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort() } return r.continue() })
  const errs = []; page.on("pageerror", e => errs.push(String(e))); page.on("console", m => { if (m.type() === "error") errs.push(m.text()) })
  await page.goto("file://" + file); await page.waitForTimeout(400)
  const info = await page.evaluate(() => {
    const small = [...document.querySelectorAll("body *")].filter(e => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length
    const svgSmall = [...document.querySelectorAll("svg text")].filter(e => e.getBoundingClientRect().height < 9).length
    return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, h: document.documentElement.scrollHeight, small, svgSmall, svgs: document.querySelectorAll("svg").length, tables: document.querySelectorAll("table").length, nav: !!document.querySelector("[data-scnav-slot]") && document.body.innerText.includes("BACK") }
  })
  console.log(name, JSON.stringify(info), "errors", errs.length, errs.slice(0, 2))
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true })
  await page.screenshot({ path: `${out}/${name}-top.png` })
  if (w === 1680) { for (const [i, y] of [[1, 1000], [2, 2000], [3, 3000], [4, 4000]]) { await page.evaluate(yy => scrollTo(0, yy), y); await page.waitForTimeout(100); await page.screenshot({ path: `${out}/${name}-s${i}.png` }) } }
  else { for (const [i, y] of [[1, 900], [2, 2600]]) { await page.evaluate(yy => scrollTo(0, yy), y); await page.waitForTimeout(100); await page.screenshot({ path: `${out}/${name}-s${i}.png` }) } }
  await ctx.close()
}
await browser.close(); console.log("non-GET blocked", blocked)
