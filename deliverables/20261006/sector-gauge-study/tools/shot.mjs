// headless pictures of the study page at 1680 and 390. Never a visible window.
import { createRequire } from "node:module"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)); const page = "file://" + path.join(here, "..", "SECTOR-GAUGE-STUDY.html");
const b = await chromium.launch({ headless: true });
for (const [w, h, name] of [[1680, 1050, "1680"], [390, 844, "390"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  let blocked = 0; await ctx.route("**/*", r => { if (r.request().method() !== "GET") { blocked++; return r.abort(); } r.continue(); });
  const p = await ctx.newPage(); await p.goto(page, { waitUntil: "load" }); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(here, "..", "shots", `study-top-${name}.png`) });
  await p.screenshot({ path: path.join(here, "..", "shots", `study-full-${name}.png`), fullPage: true });
  const rrg = await p.$("svg[aria-label^='Relative Rotation']"); if (rrg) await rrg.screenshot({ path: path.join(here, "..", "shots", `rrg-${name}.png`) });
  const g = await p.$("svg[aria-label^='The sector gauge']"); if (g) await g.screenshot({ path: path.join(here, "..", "shots", `gauge-${name}.png`) });
  console.log(name, "done; blocked non-GET", blocked);
  await ctx.close();
}
await b.close();
