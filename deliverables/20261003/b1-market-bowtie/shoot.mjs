#!/usr/bin/env node
/* B1 · photographs the proposal headlessly (never a window) at 1680 × 1050 (MacBook) and 1920 × 1080 (Apple TV / iMac):
   the three looks and the three readings, into shots/. Non-GET requests are blocked and counted.
   node shoot.mjs [base url]   (serve the worktree root first: python3 -m http.server 8793) */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:8793";
const path = "/deliverables/20261003/b1-market-bowtie/";
const browser = await chromium.launch({ headless: true });
let posts = 0;
const shots = [
  ["strip-heat", "index.html?look=strip&read=heat"],
  ["strip-bowtie", "index.html?look=strip&read=bowtie"],
  ["fan-heat-tech", "index.html?look=fan&read=heat&sector=TECH"],
  ["fan-bowtie-financials", "index.html?look=fan&read=bowtie&sector=FINANCIALS"],
  ["fan-pair", "index.html?look=fan&read=pair"],
  ["cohorts-heat", "index.html?look=cohorts&read=heat"],
  ["fan-close-only", "index.html?look=fan&read=heat&src=close&sector=UTILITIES"],
];
const facts = {};
for (const [w, h, tag] of [[1680, 1050, "1680"], [1920, 1080, "1920"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.route("**/*", (r) => { if (r.request().method() !== "GET") { posts++; return r.abort(); } r.continue(); });
  for (const [name, url] of shots) {
    await page.goto(base + path + url, { waitUntil: "networkidle" }); await page.waitForTimeout(400);
    await page.screenshot({ path: join(HERE, "shots", `${name}-${tag}.png`) });
    facts[`${name}-${tag}`] = await page.evaluate(() => ({
      cols: [...document.querySelectorAll(".fan")].map((f) => f.querySelectorAll(".col").length),
      firstLabels: [...document.querySelectorAll(".fan")][0] ? [...document.querySelectorAll(".fan")[0].querySelectorAll(".col")].map((c) => c.querySelector(".lbl").textContent + " " + c.querySelector(".val").textContent) : [],
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
      minFont: Math.min(...[...document.querySelectorAll("body *")].filter((e) => e.textContent.trim() && getComputedStyle(e).display !== "none").map((e) => parseFloat(getComputedStyle(e).fontSize))),
    }));
  }
  // the report page, top and the soundness table
  await page.goto(base + path + "B1-MARKET-BOWTIE.html", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(HERE, "shots", `report-top-${tag}.png`) }).catch(() => {});
  await page.close();
}
facts.nonGetBlocked = posts;
require("node:fs").writeFileSync(join(HERE, "shots", "facts.json"), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts, null, 1));
await browser.close();
