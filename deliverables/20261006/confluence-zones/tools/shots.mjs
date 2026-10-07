#!/usr/bin/env node
// CZ1 — headless pictures of the page at 1680 (desk) and 390 (phone), and a check that it draws without errors.
// Headless only (a test window once took over Alan's screen). The page is opened from the file; every request that
// is not a GET is blocked and counted; nothing is sent anywhere. The browser is closed before the script returns.
//
//   node tools/shots.mjs            → shots/*.png and shots/shots-receipt.json
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, "..", "CONFLUENCE-ZONES.html"), OUT = path.join(HERE, "..", "shots");
const { chromium } = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json")("playwright-core");
fs.mkdirSync(OUT, { recursive: true });

const receipt = { page: "CONFLUENCE-ZONES.html", at: new Date().toISOString(), headless: true, views: [] };
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, width, height, scale] of [["1680", 1680, 1050, 1], ["390", 390, 844, 2]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
    const page = await ctx.newPage();
    const errors = [], blocked = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.route("**/*", (route) => { const r = route.request(); if (r.method() !== "GET") { blocked.push(`${r.method()} ${r.url()}`); return route.abort(); } return route.continue(); });
    await page.goto(pathToFileURL(PAGE).href, { waitUntil: "load" });
    await page.waitForSelector("html[data-cz1-ready='1']", { timeout: 15000 });
    const facts = await page.evaluate(() => {
      const q = (s) => document.querySelector(s), n = (s) => document.querySelectorAll(s).length;
      const small = [...document.querySelectorAll("main *")].filter((e) => e.children.length === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 11).length;
      const svgSmall = [...document.querySelectorAll("svg text")].filter((e) => parseFloat(e.getAttribute("font-size") || getComputedStyle(e).fontSize) < 11).length;
      return { title: document.title, lead: q("#lead").textContent.slice(0, 220), sideways_scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, page_height: document.documentElement.scrollHeight,
        mu_plot_paths: n("#mu-plot svg path"), mu_plot_labels: n("#mu-plot svg text"), mu_zone_bands: n("#mu-plot svg rect.zb"), mu_forming_dots: n("#mu-plot svg circle") - 1,
        ladders: n(".ladders > div"), name_rows: n("details.fold"), tables: n("table"), table_rows: n("tbody tr"), text_under_11px: small, svg_text_under_11px: svgSmall, nav_buttons: n(".scnav button") };
    });
    const shot = async (file, sel) => { const el = sel ? await page.$(sel) : null; if (sel && !el) return null; if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(OUT, file) }); } else await page.screenshot({ path: path.join(OUT, file) }); return file; };
    const files = [await shot(`top-${name}.png`), await shot(`every-name-${name}.png`, "section:nth-of-type(3)"), await shot(`the-table-${name}.png`, "section:nth-of-type(4)")];
    if (name === "390") files.push(await shot("micron-section-390.png", "section:nth-of-type(1)"), await shot("parent-child-section-390.png", "section:nth-of-type(2)"));
    // closer crops, for reading the pictures at full size
    files.push(await shot(`micron-plot-${name}.png`, "#mu-plot"), await shot(`ladders-${name}.png`, "#pc-ladders-a"), await shot(`ladders-vistra-${name}.png`, "#pc-ladders-b"), await shot(`micron-questions-${name}.png`, "#mu-qa"), await shot(`micron-zones-${name}.png`, "#mu-zones"), await shot(`pair-reads-${name}.png`, "#pc-reads"));
    // the hover read: bring the plot into view first, then put the pointer on session 4 and picture it without scrolling
    if (name === "1680") { await page.waitForTimeout(500); const plot = await page.$("#mu-plot"); await plot.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -40)); const box = await (await page.$("#mu-hit")).boundingBox(), pb = await plot.boundingBox();
      await page.mouse.move(box.x + (box.width * 4) / 20, box.y + box.height / 2); await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, "micron-hover-session4-1680.png"), clip: { x: pb.x, y: Math.max(0, pb.y), width: pb.width, height: Math.min(pb.height, height - Math.max(0, pb.y)) } }); files.push("micron-hover-session4-1680.png");
      await page.mouse.move(2, 2); await page.click("#reading button[data-r='slope']"); await page.waitForTimeout(150); files.push(await shot("micron-slope-held-1680.png", "#mu-plot")); await page.click("#reading button[data-r='trend']"); await page.waitForTimeout(150); files.push(await shot("micron-trend-price-1680.png", "#mu-plot")); await page.click("#reading button[data-r='flat']"); }
    // one fold opened, to see a name's detail
    if (name === "1680") { await page.evaluate(() => { const d = [...document.querySelectorAll("details.fold")].find((x) => x.querySelector("summary span").textContent === "DRAM"); if (d) d.open = true; }); const d = await page.$("details.fold[open]"); if (d) { await d.scrollIntoViewIfNeeded(); await d.screenshot({ path: path.join(OUT, "dram-open-1680.png") }); files.push("dram-open-1680.png"); } }
    receipt.views.push({ view: name, width, errors, non_get_blocked: blocked, facts, files: files.filter(Boolean) });
    await ctx.close();
  }
} finally { await browser.close(); }
receipt.browser_closed = true;
fs.writeFileSync(path.join(OUT, "shots-receipt.json"), JSON.stringify(receipt, null, 1));
for (const v of receipt.views) console.log(`${v.view}: errors ${v.errors.length} · non-GET blocked ${v.non_get_blocked.length} · sideways scroll ${v.facts.sideways_scroll} · plot paths ${v.facts.mu_plot_paths} · zone bands ${v.facts.mu_zone_bands} · forming dots ${v.facts.mu_forming_dots} · ladders ${v.facts.ladders} · name rows ${v.facts.name_rows} · tables ${v.facts.tables} · text<11px ${v.facts.text_under_11px} · svg text<11px ${v.facts.svg_text_under_11px} · nav buttons ${v.facts.nav_buttons} · files ${v.files.length}`);
for (const v of receipt.views) for (const e of v.errors) console.log(`  ERROR [${v.view}] ${e}`);
if (receipt.views.some((v) => v.errors.length)) process.exitCode = 1;
