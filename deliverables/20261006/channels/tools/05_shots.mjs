/* CHN1 step 5 — headless pictures of the page and a few measurements. Never a visible window (Alan, 24 Sep).
     node 05_shots.mjs
   The page is one self-contained file, opened from disk. Every request that is not this file is refused and counted (there should be
   none); every non-GET request likewise. Shots → ../shots, the record → ../shots/record.json */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url));
const pageFile = path.join(here, "..", "CHANNELS.html"), shots = path.join(here, "..", "shots");
fs.mkdirSync(shots, { recursive: true });
const url = pathToFileURL(pageFile).href;
const record = { at: new Date().toISOString(), page: "CHANNELS.html", bytes: fs.statSync(pageFile).size, widths: {} };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  for (const width of [1680, 390]) {
    const phone = width < 700, rec = { outside_requests: [], non_get: [], errors: [] };
    const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 2 : 1, serviceWorkers: "block", ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    await context.route("**/*", (route) => {
      const req = route.request();
      if (req.method() !== "GET") { rec.non_get.push(req.method() + " " + req.url().slice(0, 120)); return route.abort(); }
      if (req.url() !== url) { rec.outside_requests.push(req.url().slice(0, 120)); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => rec.errors.push(String(e.message).slice(0, 200)));
    page.on("console", (m) => { if (m.type() === "error") rec.errors.push("console: " + m.text().slice(0, 200)); });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(300);
    rec.measured = await page.evaluate(() => {
      const de = document.documentElement, small = [];
      // every piece of text the reader can see, and its real size on screen (SVG text scales with its picture)
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n, min = 99, count = 0;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim(), el = n.parentElement;
        if (!t || !el || el.closest("script,style,.tip")) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
        if (el.closest("details") && !el.closest("details").open && el.tagName !== "SUMMARY") continue;
        let px = parseFloat(cs.fontSize); const svg = el.closest("svg");
        if (svg) { const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(); if (vb && vb.width) px = px * r.width / vb.width; }
        count++; if (px < min) min = px; if (px < 10.95 && small.length < 12) small.push({ px: Math.round(px * 100) / 100, text: t.slice(0, 40), svg: !!svg });
      }
      const charts = [...document.querySelectorAll(".cw")].map((w) => ({ wrap: Math.round(w.clientWidth), svg: Math.round(w.querySelector("svg").getBoundingClientRect().width), scrolls: w.scrollWidth > w.clientWidth + 1, scroll_left: Math.round(w.scrollLeft) }));
      return { page_scrolls_sideways: de.scrollWidth > window.innerWidth + 1, doc_width: de.scrollWidth, window_width: window.innerWidth, text_nodes: count, smallest_text_px: Math.round(min * 100) / 100, below_11px: small,
               charts, tables: [...document.querySelectorAll(".tw")].map((w) => ({ wrap: Math.round(w.clientWidth), table: Math.round(w.scrollWidth) })),
               h1: document.querySelector("h1").textContent.slice(0, 60), sections: document.querySelectorAll("section").length, svgs: document.querySelectorAll("svg").length };
    });
    await page.screenshot({ path: path.join(shots, `page-${width}.png`), fullPage: true });
    // each picture on its own, and each section
    const cws = await page.$$(".cw"); const names = ["spy-whole", "spy-year", "qqq-whole", "qqq-year", "rebounds-side-by-side-spy", "rebounds-side-by-side-qqq"];
    for (let i = 0; i < cws.length; i++) { await cws[i].scrollIntoViewIfNeeded(); await cws[i].screenshot({ path: path.join(shots, `${names[i]}-${width}.png`) }); }
    const secs = await page.$$("section"); const sn = ["plain-words", "todays-read", "sec-spy", "sec-qqq", "channels-table", "lows-table", "rebounds-side-by-side", "rebounds-table", "pierces-table"];
    for (let i = 0; i < secs.length; i++) { if ([0, 1, 4, 5, 6, 7, 8].includes(i)) { await secs[i].scrollIntoViewIfNeeded(); await secs[i].screenshot({ path: path.join(shots, `${sn[i]}-${width}.png`) }); } }
    if (phone) {   // what the phone actually shows first, and a picture as it opens (scrolled to today)
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(shots, `phone-top-${width}.png`) });
      await cws[1].scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shots, `phone-spy-year-${width}.png`) });
    } else {       // the hover reader: point at a day on SPY's year picture and read what it says
      const box = await cws[1].boundingBox(); await cws[1].scrollIntoViewIfNeeded(); const b2 = await cws[1].boundingBox();
      await page.mouse.move(b2.x + b2.width * 0.30, b2.y + b2.height * 0.5); await page.waitForTimeout(150);
      rec.hover = await page.evaluate(() => { const t = document.querySelectorAll(".cw .tip")[1]; return { visible: getComputedStyle(t).visibility === "visible", text: t.innerText.replace(/\s+/g, " ").slice(0, 400) }; });
      await cws[1].screenshot({ path: path.join(shots, `spy-year-hover-${width}.png`) });
      await page.mouse.move(5, 5);
      // PAGE SPECS opened
      await page.evaluate(() => { document.querySelector("details.sc-pagespecs").open = true; });
      const det = await page.$("details.sc-pagespecs"); await det.scrollIntoViewIfNeeded(); await det.screenshot({ path: path.join(shots, `page-specs-${width}.png`) });
    }
    record.widths[width] = rec;
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(shots, "record.json"), JSON.stringify(record, null, 1));
console.log(JSON.stringify(record, null, 1));
