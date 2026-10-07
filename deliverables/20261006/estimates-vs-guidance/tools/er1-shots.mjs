// ER1 · headless screenshots of the deliverable page at 1680 and 390 wide. Never a visible window.
import { createRequire } from "node:module"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)), page = path.join(here, "..", "ESTIMATES-VS-GUIDANCE.html");
const b = await chromium.launch({ headless: true });
let blocked = 0;
for (const w of [1680, 390]) {
  const c = await b.newContext({ viewport: { width: w, height: w === 1680 ? 1050 : 844 }, deviceScaleFactor: 1 });
  await c.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort(); } r.continue(); });
  const p = await c.newPage(); await p.goto("file://" + page); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(here, "..", "shots", `page-${w}.png`), fullPage: true });
  await p.screenshot({ path: path.join(here, "..", "shots", `top-${w}.png`), fullPage: false });
  console.log(w, "ok, height", await p.evaluate(() => document.body.scrollHeight), "scrollWidth", await p.evaluate(() => document.documentElement.scrollWidth));
  await c.close();
}
await b.close(); console.log("non-GET blocked:", blocked);
