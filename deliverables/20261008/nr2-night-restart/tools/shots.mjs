// The pictures of NIGHT-RESTART.html. Headless only, the page is opened from disk, and the test browser may ask the network for nothing.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
let asked = 0;
try {
  for (const [w, h] of [[1680, 1000], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.route("**/*", (route) => (route.request().url().startsWith("file:") ? route.continue() : (asked += 1, route.abort("blockedbyclient"))));
    const p = await ctx.newPage();
    await p.goto(pathToFileURL(join(here, "NIGHT-RESTART.html")).href, { waitUntil: "load" });
    await p.screenshot({ path: join(here, "shots", `page-${w}.png`), fullPage: true });
    const facts = await p.evaluate(() => {
      const grey = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); if (!m) return true; const v = m.slice(1, 4).map(Number); return Math.max(...v) - Math.min(...v) <= 24 && Math.max(...v) <= 210; };
      const els = [...document.querySelectorAll("main *")];
      return {
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        smallestText: Math.min(...els.filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
        notGrey: els.filter((e) => !grey(getComputedStyle(e).color) || !grey(getComputedStyle(e).backgroundColor) || !grey(getComputedStyle(e).borderTopColor)).length,
        bars: [...document.querySelectorAll(".mem .bar")].map((b) => Math.round(b.getBoundingClientRect().width)),
        valuesClipped: [...document.querySelectorAll(".mem .val")].filter((v) => v.getBoundingClientRect().right > document.documentElement.clientWidth).length,
        nav: !!document.querySelector(".scnav"),
      };
    });
    console.log(`page at ${w}:`, JSON.stringify(facts));
    // the top of the page as it opens, and the picture of the memory with one bar's note showing
    await p.screenshot({ path: join(here, "shots", `page-${w}-top.png`) });
    await p.focus(".mem .row:nth-of-type(2) .bar");
    await p.screenshot({ path: join(here, "shots", `page-${w}-note.png`) });
    if (w === 390) {
      for (const [name, title] of [["flow", "What happens at 4 am"], ["test", "The test, with you watching"], ["morning", "What you read in the morning"]]) {
        await p.evaluate((t) => { const e = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim() === t); window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 12); }, title);
        await p.screenshot({ path: join(here, "shots", `page-390-${name}.png`) });
      }
    }
    await ctx.close();
  }
  console.log("requests the test browser tried to make outside this page's own file:", asked);
} finally { await browser.close(); }
