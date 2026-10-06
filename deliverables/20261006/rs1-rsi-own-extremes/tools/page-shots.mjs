/* RS1 — headless pictures of the deliverable page itself (1680 and 390), to check it reads and nothing overflows. */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url));
const page_ = "file://" + path.join(here, "..", "RS1-RSI-OWN-EXTREMES.html");
const browser = await chromium.launch({ headless: true });
try {
  for (const w of [1680, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 844 : 1050 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(page_, { waitUntil: "load" });
    await page.evaluate(() => { const d = document.querySelector("details.sc-pagespecs"); if (d) d.open = true; });
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth, imgs: [...document.images].map((i) => [i.getAttribute("src"), i.naturalWidth]).filter((x) => !x[1]),
      small: [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length }));
    console.log(w, JSON.stringify(m));
    await page.screenshot({ path: path.join(here, "..", "pictures", `page-${w}.png`), fullPage: true });
    await ctx.close();
  }
} finally { await browser.close(); }
