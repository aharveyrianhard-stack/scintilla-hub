/* U4b · headless shots of U4B-FACTS.html (never a visible window). Usage: node deliverables/20261003/u4b-facts/shots.mjs */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const DIR = dirname(fileURLToPath(import.meta.url)), URL = pathToFileURL(join(DIR, "U4B-FACTS.html")).href;
const browser = await chromium.launch({ headless: true });
let blocked = 0;
try {
  for (const [w, h, tag] of [[1680, 1050, "1680"], [390, 844, "390"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.route("**/*", (r) => (r.request().method() === "GET" ? r.continue() : (blocked++, r.abort())));
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(URL, { waitUntil: "load" });
    await page.screenshot({ path: join(DIR, `shots/top-${tag}.png`) });
    for (const id of ["skhy", "facts-h"]) { await page.locator("#" + id).scrollIntoViewIfNeeded(); await page.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await page.screenshot({ path: join(DIR, `shots/${id}-${tag}.png`) }); }
    /* sort by "C4 peer of" (descending) and filter "LIKED"-style: check the table reacts */
    await page.locator('#facts th[data-i="11"]').click();
    const first = await page.locator("#facts tbody tr").first().locator("td").first().textContent();
    await page.fill("#q", "MEMORY_SEMICAP"); const shown = await page.locator("#qn").textContent();
    await page.evaluate(() => document.getElementById("facts-h").scrollIntoView());
    await page.screenshot({ path: join(DIR, `shots/facts-sorted-${tag}.png`) });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(JSON.stringify({ width: w, page_errors: errs, top_after_sort_by_c4: first, filter_memory_semicap: shown, horizontal_overflow_px: overflow }));
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ non_get_blocked: blocked }));
