// RM1 — the same page live and from the branch, at 1680 and at 390 wide (headless): nothing on screen should differ.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const OUT = process.argv[2];
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return ""; } };
const maps = { hub: JSON.parse(fs.readFileSync("override-hub.json", "utf8")), station: JSON.parse(fs.readFileSync("override-station.json", "utf8")) };
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
try {
  for (const [name, url] of [["hub", "https://scintillahub.ai/"], ["station", "https://station.scintillahub.ai/"]]) {
    for (const version of ["live", "branch"]) {
      const overrides = new Map(version === "branch" ? Object.entries(maps[name]).map(([u, f]) => [urlKey(u), f]) : []);
      for (const [w, h] of [[1680, 1050], [390, 844]]) {
        const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
        await context.route("**/*", (route) => {
          const req = route.request(), local = overrides.get(urlKey(req.url()));
          if (req.method() !== "GET") return route.abort("blockedbyclient");
          if (local) return route.fulfill({ status: 200, contentType: /\.m?js$/.test(local) ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) });
          return route.continue();
        });
        const page = await context.newPage(); const errors = [];
        page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
        await page.goto(url, { waitUntil: "load", timeout: 120000 });
        await page.waitForTimeout(22000);
        const file = OUT + "/" + name + "-" + version + "-" + w + ".jpg";
        await page.screenshot({ path: file, type: "jpeg", quality: 72 });
        const facts = await page.evaluate(() => ({ title: document.title, rows: document.querySelectorAll(".sc-board__row").length, frames: document.querySelectorAll("iframe").length, night: typeof hubNightReloadDue === "function" || typeof nightReloadDue === "function" }));
        console.log(name, version, w + " wide:", JSON.stringify(facts), "page errors:", errors.length ? errors.join(" | ") : "none");
        await context.close();
      }
    }
  }
} finally { await browser.close(); }
