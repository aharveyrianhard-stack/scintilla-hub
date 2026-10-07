/* PP1 · headless pictures of PRE-PROFIT.html at 1680 and 390. NEVER a visible window. The page is static (one small
   script of its own, nothing fetched), so it is opened from the file; every request that is not a GET is blocked and
   counted, and any request that leaves the file is counted too.
     node tools/shots.mjs      → shots/<width>-<nn>-<what>.png and shots/shots-facts.json */
import { createRequire } from "node:module"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"), { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, ".."), OUT = path.join(ROOT, "shots"); fs.mkdirSync(OUT, { recursive: true });
const SECTIONS = ["four", "shelf", "map", "margin", "money", "dilution", "quality", "history", "knockout", "loads", "off"], facts = {};
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
try {
  for (const [w, h] of [[1680, 1050], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 }), page = await context.newPage();
    const errors = [], nonGet = [], offFile = [];
    await page.route("**/*", (r) => { const q = r.request(); if (q.method() !== "GET") { nonGet.push(q.url()); return r.abort(); } if (!q.url().startsWith("file:")) offFile.push(q.url()); r.continue(); });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(pathToFileURL(path.join(ROOT, "PRE-PROFIT.html")).href, { waitUntil: "load" });
    await page.screenshot({ path: path.join(OUT, `${w}-00-first-screen.png`) });
    const cap = w > 500 ? 1700 : 2600;                                   // a tall table is pictured from its top; the page itself holds the rest
    for (let i = 0; i < SECTIONS.length; i++) {
      const el = await page.$("#" + SECTIONS[i]); await el.scrollIntoViewIfNeeded(); const b = await el.boundingBox();
      await page.screenshot({ path: path.join(OUT, `${w}-${String(i + 1).padStart(2, "0")}-${SECTIONS[i]}.png`), fullPage: true, clip: { x: 0, y: Math.max(0, b.y + (await page.evaluate(() => window.scrollY))), width: w, height: Math.min(b.height, cap) } });
    }
    /* the name finder works: type a name, count the rows left */
    await page.fill("#find", "iren"); const found = await page.$$eval("#shelftable tbody tr[data-find]", (rs) => rs.filter((r) => r.style.display !== "none").length); await page.fill("#find", "");
    await page.fill("#find2", "coreweave"); const found2 = await page.$$eval("#loadtable tbody tr[data-find]", (rs) => rs.filter((r) => r.style.display !== "none").length); await page.fill("#find2", "");
    await page.evaluate(() => { document.querySelector("details.sc-pagespecs").open = true; });
    await (await page.$("details.sc-pagespecs")).screenshot({ path: path.join(OUT, `${w}-99-page-specs-open.png`) });
    facts[w] = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, height: document.documentElement.scrollHeight,
      sections: document.querySelectorAll("body > section").length, cards: document.querySelectorAll("#four .card").length, shelf_rows: document.querySelectorAll("#shelftable tbody tr[data-find]").length, load_rows: document.querySelectorAll("#loadtable tbody tr[data-find]").length, dots: document.querySelectorAll("#map .wide circle").length,
      smallest_font_px: Math.min(...[...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().width > 0 && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))),
      svg_text_scaled_under_11: [...document.querySelectorAll("svg text")].filter((t) => { const s = t.ownerSVGElement, r = s.getBoundingClientRect(), vb = s.viewBox.baseVal; return r.width > 0 && vb && vb.width && parseFloat(t.getAttribute("font-size") || 11) * (r.width / vb.width) < 10.9; }).length,
      scnav: !!document.querySelector("nav.scnav button[data-go=back]") && !!document.querySelector("nav.scnav button[data-go=close]") && document.querySelector("nav.scnav").getBoundingClientRect().height > 10,
      too_wide: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest(".tw") && !e.closest(".scrolly")).slice(0, 6).map((e) => e.tagName + "." + (e.className && e.className.baseVal !== undefined ? "svg" : e.className) + " " + Math.round(e.getBoundingClientRect().right)),
      scroll_boxes_wider_than_they_show: [...document.querySelectorAll(".tw")].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      colours_off_grey: (() => { const bad = new Set(), ok = new Set(["60,170,110", "200,80,80", "60,180,200"]); for (const e of document.querySelectorAll("body *")) { for (const p of ["color", "backgroundColor", "borderTopColor", "fill", "stroke"]) { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(getComputedStyle(e)[p]); if (!m || m[4] === "0") continue; const c = [+m[1], +m[2], +m[3]]; if (ok.has(c.join(","))) continue; if (Math.max(...c) - Math.min(...c) > 24 || Math.max(...c) > 210) bad.add(c.join(",")); } } return [...bad].slice(0, 8); })(),
      internal_codes: (document.body.innerText.match(/\b(CP1|ER1|CZ1|GH1|KO1|PP1|NP1|FD1|CF1|CF3|TR1|TR2|LB1|LB2|NQ1|C5b?|C6b?|PA6|AL7|HM1)\b/g) || []).slice(0, 8), text_has_buy_sell: /\b(buy now|sell now|you should buy|you should sell)\b/i.test(document.body.innerText),
      empty_cells_shown_as_none_or_nan: (document.body.innerText.match(/\b(None|NaN|undefined|null)\b/g) || []).slice(0, 6) }));
    facts[w].page_errors = errors; facts[w].non_get_blocked = nonGet.length; facts[w].requests_off_file = offFile.length; facts[w].finder_rows_for_iren = found; facts[w].finder_rows_for_coreweave = found2;
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, "shots-facts.json"), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts));
