/* TR2 · headless shots of the deliverable page itself (never a visible window): 1680 and 390, one per section.
   Prints per width: sideways overflow (px), the smallest text on the page (SVG included), page errors, non-GET requests
   blocked, whether the BACK / CLOSE pair is there, and how many elements carry a colour that is not a grey within the rule. */
import path from "node:path"; import fs from "node:fs"; import { fileURLToPath, pathToFileURL } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
fs.mkdirSync(path.join(D, "shots"), { recursive: true });
const SECTIONS = [["evening", "#evening"], ["tree", "#tree"], ["cross", "#cross"], ["frontier", "#frontier"], ["consumer", "#consumer"], ["powertrain", "#powertrain"], ["platforms", "#platforms"], ["factors", "#factors"], ["picks", "#picks"], ["lanes", "#lanes"], ["funds", "#funds"], ["realestate", "#realestate"], ["migration", "#migration"]];
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
let fail = false;
try {
  for (const w of [1680, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 500 ? 844 : 1050 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
    let nonGet = 0; await ctx.route("**/*", (r) => { if (r.request().method() !== "GET") { nonGet++; return r.abort(); } return r.continue(); });
    await page.goto(pathToFileURL(path.join(D, "TREE-REVISION.html")).href, { waitUntil: "load" });
    await page.screenshot({ path: path.join(D, "shots", `page-${w}-top.png`) });
    for (const [n, sel] of SECTIONS) { await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel); await page.screenshot({ path: path.join(D, "shots", `page-${w}-${n}.png`) }); }
    for (const [n, sel, dy] of [["factors-2", "#factors", 1000], ["factors-3", "#factors", 2000], ["powertrain-2", "#powertrain", 800], ["lanes-2", "#lanes", 900]]) { await page.evaluate(([s, d]) => { document.querySelector(s).scrollIntoView(); window.scrollBy(0, d); }, [sel, dy]); if (w >= 500) await page.screenshot({ path: path.join(D, "shots", `page-${w}-${n}.png`) }); }
    // the picture scrolls inside its own panel on a phone: two more looks at it, at full size
    await page.evaluate(() => document.querySelector("#tree").scrollIntoView());
    for (const [n, f] of [["tree-mid", 0.45], ["tree-right", 1]]) { await page.evaluate((f) => { const p = document.querySelector(".treewrap"); p.scrollLeft = (p.scrollWidth - p.clientWidth) * f; }, f); if (w < 500) await page.screenshot({ path: path.join(D, "shots", `page-${w}-${n}.png`) }); }
    await page.evaluate(() => { document.querySelector(".treewrap").scrollLeft = 0; });
    if (w >= 500) await page.locator("svg.tree").screenshot({ path: path.join(D, "shots", `page-${w}-tree-picture.png`) });
    const f = await page.evaluate(() => {
      const own = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const svg = document.querySelector("svg.tree"); const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      let minFont = 1e9, minWhere = ""; const badCol = new Set();
      const grey = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return true; const [r, g, b, a] = m[1].split(/[ ,/]+/).map(Number); if (a === 0) return true; return Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210; };
      for (const el of document.querySelectorAll("body *")) {
        if (el.closest(".scnav, script, style, title") || ["SCRIPT", "STYLE"].includes(el.tagName)) continue;
        const cs = getComputedStyle(el); const inSvg = !!el.closest("svg");
        if (own(el) && el.tagName.toLowerCase() !== "title") { const fs = parseFloat(cs.fontSize) * (inSvg ? scale : 1); if (fs < minFont) { minFont = fs; minWhere = el.tagName + ":" + el.textContent.trim().slice(0, 30); } }
        for (const p of ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "outlineColor"].concat(inSvg ? ["fill", "stroke"] : [])) if (!grey(cs[p])) badCol.add(p + " " + cs[p]);
      }
      const tight = [...svg.querySelectorAll("text[data-w]")].filter((t) => t.getComputedTextLength() > Number(t.dataset.w)).map((t) => t.textContent);
      const nav = document.querySelector(".scnav");
      return { overflow_px: document.documentElement.scrollWidth - window.innerWidth, min_font_px: Math.round(minFont * 100) / 100, min_font_at: minWhere, svg_scale: Math.round(scale * 1000) / 1000, svg_texts_wider_than_their_box: tight,
        colours_outside_the_rule: [...badCol], back_close_present: !!nav && nav.querySelectorAll("button").length === 2 && !!nav.closest("[data-scnav-slot]"), nodes_in_list: document.querySelector("pre").textContent.split("\n").length,
        table_rows: document.querySelectorAll("tbody tr").length, not_run_yet: [...document.querySelectorAll(".notrun")].map((x) => x.textContent), specs_closed: !document.querySelector("details.sc-pagespecs").open,
        tree_panel_scrolls: document.querySelector(".treewrap").scrollWidth > document.querySelector(".treewrap").clientWidth };
    });
    console.log(JSON.stringify({ w, ...f, page_errors: errors.length, errors, non_get_blocked: nonGet }));
    if (f.overflow_px > 0 || f.min_font_px < 11 || errors.length || f.colours_outside_the_rule.length || !f.back_close_present || f.svg_texts_wider_than_their_box.length) fail = true;
    await ctx.close();
  }
} finally { await browser.close(); }
if (fail) { console.error("PAGE CHECK FAILED"); process.exit(1); }
