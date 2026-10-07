// The pictures for NIGHT-RELOAD.html. Headless only, ONE page at a time, and the test browser may send nothing but GET.
//   1. the live X health page (the only page opened against live). Its own request is a POST, so it is answered here with
//      the same rows, read a moment earlier by a plain GET from this script. The key it carries is used in memory, never written.
//   2. this deliverable page from disk at 1680 and at 390 wide.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEALTH = "https://station.scintillahub.ai/x-health/";

const LOCAL_ONLY = process.argv.includes("--local-only");   // re-shoot this page without opening the live one again
const html = LOCAL_ONLY ? "" : await (await fetch(HEALTH)).text();
const key = (/const KEY = "([^"]+)"/.exec(html) || [])[1], rpc = (/const URL_RPC = "([^"]+)"/.exec(html) || [])[1];
if (!LOCAL_ONLY && (!key || !rpc)) throw new Error("the health page no longer carries its address");
const rows = LOCAL_ONLY ? [] : await (await fetch(rpc, { headers: { apikey: key, Authorization: "Bearer " + key } })).json();
if (!LOCAL_ONLY) console.log("rows read by GET:", rows.length, rows.map((r) => `${r.client} ${r.pane_browser} bridge ${r.bridge_version} usable ${r.region_usable} whole ${r.whole_frame} paints ${r.paints_per_min}`).join(" | "));

const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
let blocked = 0, answered = 0;
try {
  if (!LOCAL_ONLY) {
  const context = await browser.newContext({ viewport: { width: 1680, height: 620 }, deviceScaleFactor: 1, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
  await context.route("**/*", (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.continue();
    blocked += 1;
    if (req.url().startsWith(rpc)) { answered += 1; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) }); }
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  await page.goto(HEALTH, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("#grid .card").length > 0, null, { timeout: 15000 });
  await page.screenshot({ path: join(here, "shots", "x-health-live-1680.png") });
  console.log("health page:", await page.evaluate(() => [...document.querySelectorAll("#grid .card")].map((c) => c.innerText.replace(/\s+/g, " ").slice(0, 150))));
  await page.close(); await context.close();
  console.log(`non-GET requests from the test browser: ${blocked} (answered locally: ${answered}, refused: ${blocked - answered})`);
  }

  for (const [w, h] of [[1680, 1000], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(pathToFileURL(join(here, "NIGHT-RELOAD.html")).href, { waitUntil: "load" });
    await p.screenshot({ path: join(here, "shots", `page-${w}.png`), fullPage: true });
    const facts = await p.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      height: document.documentElement.scrollHeight,
      smallestText: Math.min(...[...document.querySelectorAll("main *")].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))),
      imgOk: [...document.images].every((i) => i.complete && i.naturalWidth > 0), nav: !!document.querySelector(".scnav"),
    }));
    console.log(`page at ${w}:`, JSON.stringify(facts));
    if (w === 390) {   // a phone screen at a time: a 9,000 px strip cannot be judged by eye
      for (const [name, title] of [["top", "What happens at 4 am"], ["found", "What I found"], ["permission", "The one permission"], ["plan", "The test plan"]]) {
        await p.evaluate((t) => { const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === t); window.scrollTo(0, name_y(h)); function name_y(e) { return e.getBoundingClientRect().top + window.scrollY - (t === "What happens at 4 am" ? 9999 : 12); } }, title);
        await p.screenshot({ path: join(here, "shots", `page-390-${name}.png`) });
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); }
