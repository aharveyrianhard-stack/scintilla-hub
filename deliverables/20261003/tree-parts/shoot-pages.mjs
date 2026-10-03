#!/usr/bin/env node
/* T12 · photographs the gallery and the report headlessly at 1920 × 1080 (never a window): the top of each page and the
   sections named below, into shots/page-*.png.   node shoot-pages.mjs [base url] */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:8791";
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--headless=new", "--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
let posts = 0; await page.route("**/*", (r) => { if (r.request().method() !== "GET") { posts++; return r.abort(); } r.continue(); });
const shoot = async (file, anchors) => {
  await page.goto(`${base}/deliverables/20261003/tree-parts/${file}`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  const tag = file.replace(/\.html$/, "").toLowerCase();
  await page.screenshot({ path: join(HERE, "shots", `page-${tag}-top.png`) });
  for (const a of anchors) { await page.evaluate((id) => { const e = document.getElementById(id); if (e) e.scrollIntoView({ block: "start" }); window.scrollBy(0, -60); }, a); await page.waitForTimeout(300); await page.screenshot({ path: join(HERE, "shots", `page-${tag}-${a}.png`) }); }
  const h = await page.evaluate(() => document.documentElement.scrollHeight); console.log(file, "height", h, "overflow-x", await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
};
await shoot("index.html", ["bar", "label", "cell", "table", "sheet", "cohort-table", "step", "podium", "lists", "hud", "levels", "nav", "modes"]);
await shoot("TREE-PARTS.html", ["org", "cohorts", "shots"]);
console.log("non-GET requests blocked", posts);
await browser.close();
