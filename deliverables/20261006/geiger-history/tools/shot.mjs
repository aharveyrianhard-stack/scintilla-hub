// headless pictures of the page at 1680 and 390. Never a visible window; every non-GET request is blocked and counted.
import { createRequire } from "node:module"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)); const page = "file://" + path.join(here, "..", "GEIGER-HISTORY.html");
const b = await chromium.launch({ headless: true });
try {
  for (const [w, h, name] of [[1680, 1050, "1680"], [390, 844, "390"]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    let blocked = 0, errs = []; await ctx.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort(); } r.continue(); });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(String(e).slice(0, 120))); await p.goto(page, { waitUntil: "load" }); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(here, "..", "shots", `history-top-${name}.png`) });
    await p.screenshot({ path: path.join(here, "..", "shots", `history-full-${name}.png`), fullPage: true });
    const secs = await p.$$("section"); const names = ["0-short-answers", "1-own-history", "2-two-weeks", "3-seven-dates", "4-zoomed-out", "5-oscillator"];
    for (let i = 0; i < secs.length && i < names.length; i++) await secs[i].screenshot({ path: path.join(here, "..", "shots", `${names[i]}-${name}.png`) });
    if (name === "1680") {   // the hover layer: move over the first history chart and picture it
      const hit = await p.$(".wide svg.hist .hit"); await hit.scrollIntoViewIfNeeded(); const bx = await hit.boundingBox(); await p.mouse.move(bx.x + bx.width * 0.62, bx.y + bx.height * 0.4); await p.waitForTimeout(200);
      const tip = await p.evaluate(() => { const t = document.getElementById("tip"); return t.style.display + " | " + t.textContent; });
      await p.screenshot({ path: path.join(here, "..", "shots", `hover-${name}.png`) }); console.log("hover tip:", tip);
      await p.evaluate(() => document.querySelector("details").open = true); await p.waitForTimeout(100);
      await (await p.$("details")).screenshot({ path: path.join(here, "..", "shots", `page-specs-${name}.png`) });
    }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    const small = await p.evaluate(() => { let n = 0; for (const el of document.querySelectorAll("main *")) { if (el.closest("svg")) continue; if (!el.childNodes.length || ![...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) continue; if (parseFloat(getComputedStyle(el).fontSize) < 11) n++; } return n; });
    const svgSmall = await p.evaluate(() => { let n = 0; for (const t of document.querySelectorAll("svg.hist text")) { if (!t.ownerSVGElement.getBoundingClientRect().width) continue; { const s = t.ownerSVGElement, r = s.getBoundingClientRect(); const scale = r.width / s.viewBox.baseVal.width; if (parseFloat(t.getAttribute("font-size")) * scale < 10.5) n++; } } return n; });
    console.log(name, "done; blocked non-GET", blocked, "page errors", errs.length, errs.slice(0, 3), "page scroll width", sw, "| html text under 11px:", small, "| chart labels drawn under 10.5px:", svgSmall);
    await ctx.close();
  }
} finally { await b.close(); }
