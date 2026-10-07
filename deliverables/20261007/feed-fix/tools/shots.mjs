/* FD1 · headless pictures of FEED-FIX.html at 1680 and 390, screen by screen, and the facts a reader would check:
   no sideways scroll, no text under 11px, the BACK / CLOSE pair in place, no page error, no request that is not a GET.
   NEVER a visible window.   node shots.mjs   (writes ../shots/) */
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"), { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, ".."), OUT = ROOT + "/shots", URL_ = pathToFileURL(ROOT + "/FEED-FIX.html").href;
fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
const browser = await chromium.launch({ headless: true }), facts = { taken_utc: new Date().toISOString(), page: "deliverables/20261007/feed-fix/FEED-FIX.html", visible_windows: 0, widths: {} };
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w === 390 ? 2 : 1 }), page = await ctx.newPage(), nonGet = [], errors = [];
    await page.route("**/*", (r) => { if (r.request().method() !== "GET") { nonGet.push(r.request().method()); return r.abort(); } r.continue(); });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
    await page.goto(URL_, { waitUntil: "load" }); await page.waitForTimeout(300);
    const f = await page.evaluate(() => {
      const de = document.documentElement, small = [], seen = new Set();
      for (const el of document.querySelectorAll("body *")) { if (el.closest("details:not([open])") && el.tagName !== "SUMMARY") continue; const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!own) continue; const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; const px = parseFloat(getComputedStyle(el).fontSize); if (px < 11) { const k = el.className + "|" + px; if (!seen.has(k)) { seen.add(k); small.push({ cls: el.className || el.tagName, px, text: el.textContent.trim().slice(0, 40) }); } } }
      const over = [...document.querySelectorAll(".panel,.tile,.ch .row,.vl,.nm,table.t")].filter((el) => !el.closest(".scroll") && el.scrollWidth > el.clientWidth + 1).map((el) => (el.className || el.tagName) + " " + el.scrollWidth + ">" + el.clientWidth).slice(0, 12);
      const dots = [...document.querySelectorAll(".dot")].filter((d) => d.getBoundingClientRect().width > 0);
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, height: de.scrollHeight, sideways_scroll: de.scrollWidth > de.clientWidth, text_under_11px: small, clipped: over, back_close: [...document.querySelectorAll(".scnav button")].map((b) => b.textContent.trim()), panels: document.querySelectorAll(".panel").length, tiles: document.querySelectorAll(".tile").length, rows: document.querySelectorAll(".ch .row").length, dots: dots.length, smallest_dot_px: Math.min(...dots.map((d) => d.getBoundingClientRect().width)), tooltips: document.querySelectorAll("[data-tip]").length };
    });
    /* the hover layer answers: point at Micron's first row and read the tooltip */
    const row = page.locator(".ch .row[data-tip]").first(); await row.scrollIntoViewIfNeeded(); await row.hover(); await page.waitForTimeout(120);
    f.tooltip_on_hover = await page.evaluate(() => { const t = document.getElementById("tip"); return t && t.style.display === "block" ? t.textContent.slice(0, 120) : null; });
    await page.mouse.move(2, 2); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100);
    const n = Math.ceil(f.height / h); f.screens = n;
    for (let i = 0; i < n; i++) { await page.evaluate((y) => window.scrollTo(0, y), i * h); await page.waitForTimeout(80); await page.screenshot({ path: `${OUT}/${w}-${String(i + 1).padStart(2, "0")}.png` }); }
    /* PAGE SPECS open, its first screen */
    await page.evaluate(() => { const d = document.querySelector("details.sc-pagespecs"); d.open = true; d.scrollIntoView(); }); await page.waitForTimeout(150); await page.screenshot({ path: `${OUT}/${w}-specs.png` });
    f.specs_text_px = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("details.sc-pagespecs p")).fontSize));
    f.non_get_blocked = nonGet.length; f.page_errors = errors; facts.widths[w] = f; await ctx.close();
    console.log(w, "· height", f.height, "· screens", n, "· sideways scroll", f.sideways_scroll, "· text under 11px", f.text_under_11px.length, "· clipped", f.clipped.length, "· BACK/CLOSE", f.back_close.join(" "), "· dots", f.dots, "smallest", f.smallest_dot_px, "· tooltip", JSON.stringify(f.tooltip_on_hover), "· errors", errors.length, "· non-GET", nonGet.length);
  }
} finally { await browser.close(); }
fs.writeFileSync(OUT + "/shots-facts.json", JSON.stringify(facts, null, 1));
