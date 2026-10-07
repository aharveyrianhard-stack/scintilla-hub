/* LD1 · headless proof of the page. NEVER a visible window. The page is one self-contained file: every request other than
   the file itself is refused and counted, so nothing leaves this Mac.
     node shots.mjs   →  ../shots/ld1-<width>-<part>.png for 1680 and 390, plus one JSON line of facts. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), PAGE = path.join(HERE, "..", "LEADERS-VS-LAGGARDS.html"), OUT = path.join(HERE, "..", "shots");
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const facts = [];
try {
  for (const width of [1680, 390]) {
    const mobile = width < 500, height = mobile ? 844 : 1050;
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, serviceWorkers: "block", isMobile: mobile, hasTouch: mobile });
    const refused = [], errors = [];
    await context.route("**/*", (route) => { const u = route.request().url(); if (u.startsWith("file:")) return route.continue(); refused.push(route.request().method() + " " + u.slice(0, 80)); return route.abort(); });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
    await page.evaluate(() => document.querySelectorAll("details.more").forEach((d) => (d.open = false)));
    const heads = await page.$$eval("h2", (hs) => hs.map((h) => ({ text: h.textContent.trim(), y: Math.round(h.getBoundingClientRect().top + window.scrollY) })));
    await page.screenshot({ path: path.join(OUT, `ld1-${width}-top.png`) });
    for (const [i, h] of heads.entries()) {
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 46)), h.y);
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(OUT, `ld1-${width}-s${i + 1}.png`) });
    }
    // places a section heading does not land on: the Cerebras picture (2c), two parts of the opinion, and two parts of the re-check
    for (const [name, sel, starts] of [["cbrs", "h3", "2c"], ["opinion-cbrs", ".opinion h4", "Cerebras (CBRS)"], ["opinion-mv", ".opinion h4", "Market value"], ["recheck-cbrs", "h3", "11b"], ["recheck-estimates", "h3", "11c"], ["oos", "h3", "11g"]]) {
      const y = await page.evaluate(([sel, starts]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim().toLowerCase().startsWith(starts.toLowerCase())); return e ? Math.round(e.getBoundingClientRect().top + window.scrollY) : null; }, [sel, starts]);
      if (y == null) { errors.push("no element for the " + name + " shot"); continue; }
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 46)), y); await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(OUT, `ld1-${width}-${name}.png`) });
    }
    await page.evaluate(() => { const d = document.querySelector("details.sc-pagespecs"); d.open = true; d.scrollIntoView(); });
    await page.screenshot({ path: path.join(OUT, `ld1-${width}-specs.png`) });
    const f = await page.evaluate(() => {
      const small = [...document.querySelectorAll("body *")].filter((e) => e.childNodes.length && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).length;
      return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, height: document.documentElement.scrollHeight, scnav: !!document.querySelector(".scnav"), smallText: small,
               tables: document.querySelectorAll("table").length, svgs: document.querySelectorAll("svg").length, h2: document.querySelectorAll("h2").length };
    });
    facts.push({ width, ...f, sections: heads.map((h) => h.text), refused: refused.length, errors });
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(facts));
