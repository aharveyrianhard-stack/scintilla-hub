/* CP3 · headless pictures of ONE-BASIS.html at 1680 and 390. NEVER a visible window. The page is static (nothing fetched
   but its own pictures), so it is opened from the file; every request that is not a GET is blocked and counted, and any
   request that leaves the file is counted too.   node tools/shots.mjs   → shots/<width>-<nn>-<what>.png + shots-facts.json */
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"), { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, ".."), OUT = path.join(ROOT, "shots"); fs.mkdirSync(OUT, { recursive: true });
const facts = {}, browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 }), page = await context.newPage();
    const errors = [], nonGet = [], offFile = [];
    await page.route("**/*", (r) => { const q = r.request(); if (q.method() !== "GET") { nonGet.push(q.url()); return r.abort(); } if (!q.url().startsWith("file:")) offFile.push(q.url()); r.continue(); });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(pathToFileURL(path.join(ROOT, "ONE-BASIS.html")).href, { waitUntil: "load" });
    for (const f of fs.readdirSync(OUT)) if (f.startsWith(w + "-")) fs.unlinkSync(path.join(OUT, f));
    await page.screenshot({ path: path.join(OUT, `${w}-00-first-screen.png`) });
    const ids = await page.$$eval("body > section", (s) => s.map((x) => x.id)), cap = w > 500 ? 1700 : 2600;
    for (let i = 0; i < ids.length; i++) {
      const el = await page.$("#" + ids[i]); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox(), y = Math.max(0, b.y + (await page.evaluate(() => window.scrollY)));
      await page.screenshot({ path: path.join(OUT, `${w}-${String(i + 1).padStart(2, "0")}-${ids[i]}.png`), fullPage: true, clip: { x: 0, y, width: w, height: Math.min(b.height, cap) } });
    }
    await page.evaluate(() => { document.querySelector("details.sc-pagespecs").open = true; });
    await (await page.$("details.sc-pagespecs")).screenshot({ path: path.join(OUT, `${w}-99-page-specs-open.png`) });
    facts[w] = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, height: document.documentElement.scrollHeight,
      sections: [...document.querySelectorAll("body > section")].map((s) => s.id), rows30: document.querySelectorAll("#table30 tbody tr").length, cells_that_differ: document.querySelectorAll("#table30 .mx.diff").length, core_panels: document.querySelectorAll("section.core").length,
      smallest_font_px: Math.min(...[...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().width > 0 && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))),
      scnav: !!document.querySelector("nav.scnav button[data-go=back]") && !!document.querySelector("nav.scnav button[data-go=close]") && document.querySelector("nav.scnav").getBoundingClientRect().height > 10,
      too_wide: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 6).map((e) => e.tagName + "." + (e.className && e.className.baseVal !== undefined ? "svg" : e.className) + " " + Math.round(e.getBoundingClientRect().right)),
      images: [...document.images].map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 })),
      colours_off_grey: (() => { const bad = new Set(), ok = new Set(["60,170,110", "200,80,80", "60,180,200"]); for (const e of document.querySelectorAll("body *")) { for (const p of ["color", "backgroundColor", "borderTopColor"]) { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(getComputedStyle(e)[p]); if (!m || m[4] === "0") continue; const c = [+m[1], +m[2], +m[3]]; if (ok.has(c.join(","))) continue; if (Math.max(...c) - Math.min(...c) > 24 || Math.max(...c) > 210) bad.add(c.join(",")); } } return [...bad].slice(0, 8); })(),
      internal_codes: (document.body.innerText.match(/\b(CP[123]|ER1|CZ1|GH1|KO1|FD1|PP1|AL[78]|DM[12]|TR1|TR2|LB1|LB2|NQ1|C5b?|C6b?|PA6|HM1)\b/g) || []).slice(0, 8), text_has_buy_sell: /\b(buy now|sell now|you should buy|you should sell)\b/i.test(document.body.innerText) }));
    facts[w].page_errors = errors; facts[w].non_get_blocked = nonGet.length; facts[w].requests_off_file = offFile.length;
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, "shots-facts.json"), JSON.stringify(facts, null, 1));
for (const w of Object.keys(facts)) { const f = facts[w]; console.log(w, "· sideways", f.sideways, "· smallest font", f.smallest_font_px, "· BACK/CLOSE", f.scnav, "· off-grey", JSON.stringify(f.colours_off_grey), "· codes", JSON.stringify(f.internal_codes), "· errors", f.page_errors.length, "· non-GET", f.non_get_blocked, "· off-file", f.requests_off_file, "· rows", f.rows30, "· cells that differ", f.cells_that_differ, "· core", f.core_panels, "· too wide", JSON.stringify(f.too_wide), "· height", f.height); }
