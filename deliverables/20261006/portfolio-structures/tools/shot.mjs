// PF1 · headless pictures of the study page at 1680 and 390. Never a visible window; every non-GET request is blocked and counted.
import { createRequire } from "node:module"; import path from "node:path"; import fs from "node:fs"; import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url)); const page = "file://" + path.join(here, "..", "PORTFOLIO-STRUCTURES.html");
const shots = path.join(here, "..", "shots"); fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ headless: true });
const report = {};
for (const [w, h, name] of [[1680, 1050, "1680"], [390, 844, "390"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  let blocked = 0, external = 0; const errors = [];
  await ctx.route("**/*", (r) => { const q = r.request(); if (q.method() !== "GET") { blocked++; return r.abort(); } if (!q.url().startsWith("file:")) { external++; return r.abort(); } r.continue(); });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto(page, { waitUntil: "load" }); await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(shots, `pf1-01-top-${name}.png`) });
  await p.screenshot({ path: path.join(shots, `pf1-99-full-${name}.png`), fullPage: true });
  const figs = await p.$$("figure.chart"); let i = 0;
  for (const f of figs) { i++; await f.scrollIntoViewIfNeeded(); await f.screenshot({ path: path.join(shots, `pf1-chart-${String(i).padStart(2, "0")}-${name}.png`) }); }
  const heads = await p.$$eval("h2", (els) => els.map((e) => e.textContent.trim()));
  const named = [["table", "The comparison table"], ["read", "My read, and the two that fit best"], ["episodes", "The last two years, episode by episode"], ["plug", "How each of the two would plug into the allocation tool"],
                 ["alternatives", "Alternatives you did not name"], ["decisions", "Decisions for Alan"]];
  for (const t of heads) { const m = t.match(/^([1-6]) · /); if (m) named.push([`s${m[1]}`, t]); }      // one picture per structure section
  for (const [k, title] of named) {
    const sec = await p.evaluateHandle((t) => { const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === t); return h ? h.nextElementSibling : null; }, title);
    const el = sec.asElement(); if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(shots, `pf1-${k}-${name}.png`) }); }
  }
  // the hover read-out on the first line chart (desktop only)
  if (name === "1680") { const svg = await p.$("svg.lc"); if (svg) { await svg.scrollIntoViewIfNeeded(); const bx = await svg.boundingBox(); await p.mouse.move(bx.x + bx.width * 0.45, bx.y + bx.height * 0.5); await p.waitForTimeout(150); await (await svg.evaluateHandle((s) => s.closest("figure"))).asElement().screenshot({ path: path.join(shots, `pf1-hover-${name}.png`) }); } }
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const small = await p.evaluate(() => { let n = 0; for (const e of document.querySelectorAll("main *")) { if (!e.childNodes.length || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue; if (e.closest("svg")) continue; if (parseFloat(getComputedStyle(e).fontSize) < 11) n++; } return n; });
  report[name] = { blockedNonGet: blocked, externalRequests: external, pageErrors: errors, h2: heads.length, charts: figs.length, horizontalOverflowPx: overflow, textUnder11px: small };
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(shots, "shots-report.json"), JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));
