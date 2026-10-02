/* X1 · headless proof of the mock pages and the proposal page. NEVER a visible window. Served from this folder over a throwaway
   local server; nothing fetched from outside, nothing written anywhere. node harness/mock-shots.mjs → shots/mock-*.png + shots/mock-facts.json */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const HERE = process.cwd(), OUT = path.join(HERE, "shots");
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/json", ".js": "text/javascript", ".css": "text/css" };
const srv = http.createServer((req, res) => { const f = path.join(HERE, decodeURIComponent(req.url.split("?")[0])); if (!f.startsWith(HERE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
const facts = []; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shoot(file, width, name, { clicks = [], full = false, clipTo = null } = {}) {
  const mobile = width < 500, ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1050 }, deviceScaleFactor: 1, isMobile: mobile });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { const u = new URL(r.url()); if (u.host !== `127.0.0.1:${srv.address().port}`) errors.push("OUTSIDE REQUEST " + r.url()); });
  await page.goto(`${base}/${file}`, { waitUntil: "load" }); await sleep(400);
  for (const c of clicks) { await page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); }, c); await sleep(350); }
  const out = path.join(OUT, name);
  if (clipTo) await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height: clipTo } }); else await page.screenshot({ path: out, fullPage: full });
  const m = await page.evaluate(() => ({ title: document.title, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h: document.documentElement.scrollHeight, bt_cols: document.querySelectorAll(".bt .col").length, tiles: document.querySelectorAll(".grid .tile").length, svgs: document.querySelectorAll("svg.rrg").length, rows: document.querySelectorAll("table tr").length, head: (document.querySelector(".head") || {}).textContent || null, h2s: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim().slice(0, 50)) }));
  facts.push({ file, width, name, clicks, errors, horizontal_overflow: m.scrollW > m.innerW, ...m }); console.log(name, JSON.stringify({ err: errors.length, overflow: m.scrollW > m.innerW, cols: m.bt_cols, tiles: m.tiles, svgs: m.svgs, rows: m.rows, head: (m.head || "").slice(0, 90) }));
  await ctx.close();
}
for (const w of [1680, 390]) {
  await shoot("mock-A-compare-panel.html", w, `mock-A-${w}-order-sectors.png`, { clipTo: w === 390 ? 1500 : 1050 });
  await shoot("mock-A-compare-panel.html", w, `mock-A-${w}-order-tech-funds.png`, { clicks: ['.bt .col[data-node="SEC_TECH"]'], clipTo: w === 390 ? 1500 : 1050 });
  await shoot("mock-A-compare-panel.html", w, `mock-A-${w}-rotation-names.png`, { clicks: ['.bt .col[data-node="SEC_TECH"]', '.bt .col[data-node="SMH"]', '.bt .col[data-node="COHORT_AI_ACCELERATORS"]', '[data-lens="ROTATION"]'], clipTo: w === 390 ? 1700 : 1050 });
  await shoot("mock-A-compare-panel.html", w, `mock-A-${w}-map-favorites.png`, { clicks: ['[data-list="FAVORITES"]', '[data-lens="MAP"]'], clipTo: w === 390 ? 1700 : 1050 });
  await shoot("mock-A-compare-panel.html", w, `mock-A-${w}-order-favorites.png`, { clicks: ['[data-list="FAVORITES"]'], clipTo: w === 390 ? 1500 : 1050 });
  await shoot("mock-B-four-tabs.html", w, `mock-B-${w}-compare.png`, { clipTo: w === 390 ? 1700 : 1050 });
  await shoot("mock-B-four-tabs.html", w, `mock-B-${w}-rotation.png`, { clicks: ['[data-tab="ROTATION"]'], clipTo: w === 390 ? 1700 : 1050 });
  await shoot("mock-B-four-tabs.html", w, `mock-B-${w}-relative.png`, { clicks: ['[data-tab="RELATIVE"]'], clipTo: w === 390 ? 1700 : 1050 });
  await shoot("mock-B-four-tabs.html", w, `mock-B-${w}-map-tech.png`, { clicks: ['[data-scope="TECH"]', '[data-tab="MAP"]'], clipTo: w === 390 ? 1700 : 1050 });
  await shoot("mock-C-split.html", w, `mock-C-${w}.png`, { full: true });
  await shoot("mock-scope-selector.html", w, `mock-scope-${w}-favorites.png`, { clipTo: w === 390 ? 1500 : 1050 });
  await shoot("mock-scope-selector.html", w, `mock-scope-${w}-path.png`, { clicks: ['[data-scope="PATH"]'], clipTo: w === 390 ? 1500 : 1050 });
  await shoot("mock-scope-selector.html", w, `mock-scope-${w}-favorites-tag-aihw.png`, { clicks: ['[data-tag="AI HW"]'], clipTo: w === 390 ? 1500 : 1050 });
  if (fs.existsSync("COMPARE-PROPOSAL.html")) { await shoot("COMPARE-PROPOSAL.html", w, `proposal-${w}-top.png`, { clipTo: w === 390 ? 2400 : 2000 }); await shoot("COMPARE-PROPOSAL.html", w, `proposal-${w}-full.png`, { full: true }); }
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, "mock-facts.json"), JSON.stringify(facts, null, 1));
console.log("done", facts.length, "errors", facts.reduce((a, f) => a + f.errors.length, 0), "overflow", facts.filter((f) => f.horizontal_overflow).map((f) => f.name));
