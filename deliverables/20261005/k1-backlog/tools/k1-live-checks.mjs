/* K1 (5 Oct) — read-only looks at the LIVE Hub and Station for the older backlog lines that may already be done.
   Headless, GET only (every other request is answered locally and counted).  node k1-live-checks.mjs */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)), shots = path.join(here, "..", "shots"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writes = [], out = { at: new Date().toISOString(), writes };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
  await ctx.route("**/*", (route) => { const m = route.request().method(); if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push(m + " " + new URL(route.request().url()).host); return route.fulfill({ status: 201, body: "[]" }); } return route.continue(); });
  /* SCI-26 — YouTube "how long ago", the Hub */
  let page = await ctx.newPage();
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { S.socTab = "YOUTUBE"; go("SOCIAL"); });
  await page.waitForSelector(".sc-ytage", { timeout: 40000 }).catch(() => { out.hubNoAge = true; });
  await sleep(2500);
  out.hubYouTube = await page.evaluate(() => { const a = [...document.querySelectorAll(".sc-ytage")].map((e) => e.textContent.trim()); return { cardsWithAge: a.length, sample: a.slice(0, 6) }; });
  await page.screenshot({ path: path.join(shots, "live-hub-youtube-age.png") });
  await page.close();
  /* SCI-26 — the Station's video shell; SCI-33 — the chart's label ticker · $ · % */
  for (const shell of ["personal-video-v1", "scintilla-video-v1"]) {
    page = await ctx.newPage();
    await page.goto("https://station.scintillahub.ai/station-shells/" + shell + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".age[data-published]", { timeout: 40000 }).catch(() => { out["noAge_" + shell] = true; });
    await sleep(2000);
    out["station_" + shell] = await page.evaluate(() => { const a = [...document.querySelectorAll(".age[data-published]")].map((e) => e.textContent.trim()); return { cardsWithAge: a.length, sample: a.slice(0, 6) }; });
    if (shell === "personal-video-v1") await page.screenshot({ path: path.join(shots, "live-station-youtube-age.png") });
    await page.close();
  }
  page = await ctx.newPage(); await page.setViewportSize({ width: 900, height: 520 });
  await page.goto("https://station.scintillahub.ai/station-shells/chart-v1/?t=NVDA&range=1D&bare=1", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => { const h = document.querySelector(".sc-nchart"); return h && h._series && h._series.length > 20; }, null, { timeout: 60000 }).catch(() => {});
  await sleep(2500);
  out.stationChartLabel = await page.evaluate(() => { const l = document.querySelector(".sc-nchart__live"); return l ? l.textContent.replace(/\s+/g, " ").trim() : null; });
  await page.screenshot({ path: path.join(shots, "live-station-chart-label.png") });
} catch (e) { out.failed = String((e && e.stack) || e).slice(0, 400); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, "live-checks.json"), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
