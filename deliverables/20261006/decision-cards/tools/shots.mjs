/* CP1 · headless pictures of DECISION-CARDS.html at 1680 and 390. NEVER a visible window. The page is static (no
   script, nothing fetched), so it is opened from the file; every request that is not a GET would be blocked and counted.
     node tools/shots.mjs      → shots/<width>-<nn>-<what>.png and shots/shots-facts.json */
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"), { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, ".."), OUT = path.join(ROOT, "shots"); fs.mkdirSync(OUT, { recursive: true });
const NAMES = ["mu-with-sndk", "mu-levels-and-size", "lagging-and-parents", "other-cards", "comps-before-after", "peer-sets", "fixes", "knockout", "cross-check", "wiring"];
const facts = {};
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 }), page = await context.newPage();
    const errors = [], nonGet = [];
    await page.route("**/*", (r) => { if (r.request().method() !== "GET") { nonGet.push(r.request().url()); return r.abort(); } r.continue(); });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(pathToFileURL(path.join(ROOT, "DECISION-CARDS.html")).href, { waitUntil: "load" });
    await page.screenshot({ path: path.join(OUT, `${w}-00-first-screen.png`) });
    const secs = await page.$$("body > section");
    for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: path.join(OUT, `${w}-${String(i + 1).padStart(2, "0")}-${NAMES[i] || "section"}.png`) });
    await (await page.$("#card-MU")).screenshot({ path: path.join(OUT, `${w}-card-MU.png`) });
    await (await page.$("#card-SNDK")).screenshot({ path: path.join(OUT, `${w}-card-SNDK.png`) });
    await (await page.$("#card-WDC")).screenshot({ path: path.join(OUT, `${w}-card-WDC.png`) });
    await (await page.$("#card-BE")).screenshot({ path: path.join(OUT, `${w}-card-BE.png`) });
    await (await page.$("#card-EQIX")).screenshot({ path: path.join(OUT, `${w}-card-EQIX.png`) });
    await page.evaluate(() => { document.querySelector("details.sc-pagespecs").open = true; });
    await (await page.$("details.sc-pagespecs")).screenshot({ path: path.join(OUT, `${w}-99-page-specs-open.png`) });
    facts[w] = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, cards: document.querySelectorAll("article.card").length, sections: document.querySelectorAll("body > section").length, height: document.documentElement.scrollHeight,
      smallest_font_px: Math.min(...[...document.querySelectorAll("body *")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))),
      smallest_drawn_svg_text_px: Math.min(...[...document.querySelectorAll("svg[viewBox]")].filter((v) => v.getBoundingClientRect().width > 0 && v.querySelector("text")).map((v) => { const k = v.getBoundingClientRect().width / v.viewBox.baseVal.width; return Math.min(...[...v.querySelectorAll("text")].map((t) => parseFloat(getComputedStyle(t).fontSize) * k)); })),
      scnav: !!document.querySelector("nav.scnav button[data-go=back]") && !!document.querySelector("nav.scnav button[data-go=close]") && document.querySelector("nav.scnav").getBoundingClientRect().top < 120 && document.querySelector("nav.scnav").getBoundingClientRect().height > 10,
      too_wide: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest(".scroll")).slice(0, 6).map((e) => e.tagName + "." + (e.className && e.className.baseVal !== undefined ? "svg" : e.className) + " " + Math.round(e.getBoundingClientRect().right)), text_has_buy_sell: /\b(buy now|sell now|you should buy|you should sell)\b/i.test(document.body.innerText) }));
    facts[w].page_errors = errors; facts[w].non_get_blocked = nonGet.length;
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, "shots-facts.json"), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts));
