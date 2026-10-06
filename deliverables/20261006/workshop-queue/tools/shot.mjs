// headless pictures of the page at 1680 and 390. Never a visible window; every non-GET request is blocked and counted.
import { createRequire } from "node:module"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)); const page = "file://" + path.join(here, "..", "WORKSHOP-QUEUE.html");
const b = await chromium.launch({ headless: true });
for (const [w, h, name] of [[1680, 1050, "1680"], [390, 844, "390"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  let blocked = 0, errs = 0; await ctx.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort(); } r.continue(); });
  const p = await ctx.newPage(); p.on("pageerror", () => errs++); await p.goto(page, { waitUntil: "load" }); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(here, "..", "shots", `queue-top-${name}.png`) });
  await p.screenshot({ path: path.join(here, "..", "shots", `queue-full-${name}.png`), fullPage: true });
  const secs = await p.$$("section"); const names = ["1-queue", "2-what-when", "3-names-raised", "4-mu-21day", "5-top-down", "6-parents", "7-bottom-up"];
  for (let i = 0; i < secs.length && i < names.length; i++) await secs[i].screenshot({ path: path.join(here, "..", "shots", `${names[i]}-${name}.png`) });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(name, "done; blocked non-GET", blocked, "page errors", errs, "page scroll width", sw);
  await ctx.close();
}
await b.close();
