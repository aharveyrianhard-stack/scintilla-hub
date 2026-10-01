/* Headless proof for the I1 proposal page. NEVER a visible window. The worktree is served under the Hub's real hostname
   (https://scintillahub.ai/* → files from HUB_ROOT) so the page's fetch of board-20261001.json works; nothing else is
   requested. node shots.mjs <width> → shots/page-<width>-full.png and section clips. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), HUB_ROOT = path.resolve(HERE, "../../../.."), OUT = path.join(HERE, "..", "shots");
const width = +process.argv[2] || 1680, mobile = width < 500, height = mobile ? 844 : 1050;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
function localFile(p) { let f = path.normalize(path.join(HUB_ROOT, decodeURIComponent(p))); if (!f.startsWith(HUB_ROOT)) return null; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; }
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
const other = [];
await ctx.route("**/*", async (route) => { const u = new URL(route.request().url());
  if (u.host === "scintillahub.ai") { const f = localFile(u.pathname); if (!f) return route.fulfill({ status: 404, body: "nf" }); return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream" }, body: fs.readFileSync(f) }); }
  other.push(u.host + u.pathname); return route.abort(); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
await page.goto("https://scintillahub.ai/deliverables/20261001/iconography/ICONOGRAPHY.html", { waitUntil: "load" }); await page.waitForTimeout(1500);
fs.mkdirSync(OUT, { recursive: true });
const facts = await page.evaluate(() => ({ states: document.querySelectorAll("#states tbody tr").length, grid: document.querySelectorAll("#grid tbody tr").length, scanCols: document.querySelectorAll("#scan .col").length, scanRows: document.querySelectorAll("#scan .col:first-child .r").length,
  before: document.querySelectorAll("#mockBefore .row").length, afterC: document.querySelectorAll("#mockC .row").length, afterB: document.querySelectorAll("#mockB .row").length, phone: document.querySelectorAll("#mockPhone .row").length, pops: document.querySelectorAll("#pops .pop").length,
  rowH: (document.querySelector("#mockC .row") || {}).offsetHeight, readW: (document.querySelector("#mockC .rdi") || {}).offsetWidth, geigerW: (document.querySelector("#mockC .gcell") || {}).offsetWidth, beforeGeigerW: (document.querySelector("#mockBefore .gcell") || {}).offsetWidth,
  pageW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, firstStates: [...document.querySelectorAll("#states tbody tr")].slice(0, 9).map((r) => r.innerText.replace(/\s+/g, " ").slice(0, 110)) }));
console.log(JSON.stringify({ width, facts, errors, other: other.slice(0, 5) }, null, 1));
await page.screenshot({ path: path.join(OUT, `page-${width}-full.png`), fullPage: true });
for (const [n, sel] of [["grid", "#grid"], ["scan", "#scan"], ["mock-before", "#mockBefore"], ["mock-c", "#mockC"], ["mock-b", "#mockB"], ["mock-phone", "#mockPhone"], ["pops", "#pops"], ["station", "#stationMock"], ["states", "#states"], ["cands", ".cands"]]) {
  const el = await page.$(sel); if (el) await el.screenshot({ path: path.join(OUT, `${n}-${width}.png`) }); }
await browser.close();
