/* C5 · headless proof of the standalone scorecard page. NEVER a visible window. Static page served from this folder over a
   throwaway local server; no API, no database, no key. Every non-GET request is blocked and counted.
   node shots.mjs → shots/scorecard-1680.png, shots/scorecard-390.png, shots/facts.json */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { fileURLToPath } from "node:url"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, "shots"); fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".json": "application/json", ".js": "text/javascript", ".mjs": "text/javascript" };
const srv = http.createServer((req, res) => { const f = path.join(HERE, decodeURIComponent(req.url.split("?")[0])); if (!f.startsWith(HERE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const facts = [];
async function shoot(file, width, name, { clipTo = null, full = false, selector = null } = {}) {
  const mobile = width < 500, ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 }, deviceScaleFactor: 1, isMobile: mobile });
  let blocked = 0; await ctx.route("**/*", (route) => { if (route.request().method() !== "GET") { blocked++; return route.abort(); } return route.continue(); });
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/${file}`, { waitUntil: "load" }); await page.waitForTimeout(300);
  const out = path.join(OUT, name);
  if (selector) { const el = await page.$(selector); await el.screenshot({ path: out }); }
  else if (clipTo) await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height: clipTo } }); else await page.screenshot({ path: out, fullPage: full });
  const m = await page.evaluate(() => ({ title: document.title, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h: document.documentElement.scrollHeight, tables: document.querySelectorAll("table").length, bars: document.querySelectorAll(".bar i").length, h2s: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim().slice(0, 48)), has_scnav: !!document.querySelector("[data-scnav-slot]") && document.documentElement.outerHTML.includes("scnav"), min_font: Math.min(...[...document.querySelectorAll(".words, td, li, p, .bars .l, .bars .v, .names .nm")].map((e) => parseFloat(getComputedStyle(e).fontSize))) }));   // body text (table headers and tile labels are 10 px uppercase labels by the house tokens)
  facts.push({ file, width, name, errors, blocked_non_get: blocked, horizontal_overflow: m.scrollW > m.innerW, ...m });
  await ctx.close();
}
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-1680.png", { clipTo: 2400 });   // the top of the page, as the standard's shots do (a full-page PNG weighs 2 MB)
await shoot("SOURCE-SCORECARD.html", 390, "scorecard-390.png", { clipTo: 2400 });
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-s1-1680.png", { selector: "#s1 + .panel" });
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-s2-1680.png", { selector: "#s2 + .panel" });
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-s4-1680.png", { selector: "#s4 + .panel" });
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-s5-1680.png", { selector: "#s5 + .panel" });
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-lrcx-1680.png", { selector: "#s7 + h3 + .panel" });
await shoot("SOURCE-SCORECARD.html", 1680, "scorecard-jpm-1680.png", { selector: "#s7 + h3 + .panel + h3 + .panel" });
await shoot("SOURCE-SCORECARD.html", 390, "scorecard-s1-390.png", { selector: "#s1 + .panel" });
await shoot("SOURCE-SCORECARD.html", 390, "scorecard-lrcx-390.png", { selector: "#s7 + h3 + .panel" });
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, "facts.json"), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts.map((f) => ({ name: f.name, errors: f.errors.length, blocked: f.blocked_non_get, overflow: f.horizontal_overflow, h: f.h, tables: f.tables, bars: f.bars, scnav: f.has_scnav, min_font: f.min_font }))));
