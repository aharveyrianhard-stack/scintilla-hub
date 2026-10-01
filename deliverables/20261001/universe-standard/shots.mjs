/* U1 · headless proof. NEVER a visible window. Static pages served from this folder over a throwaway local server;
   no API, no database, no key. node shots.mjs → shots/*.png and one JSON line of facts. */
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
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/${file}`, { waitUntil: "load" }); await page.waitForTimeout(300);
  const out = path.join(OUT, name);
  if (selector) { const el = await page.$(selector); await el.screenshot({ path: out }); }
  else if (clipTo) await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height: clipTo } });
  else await page.screenshot({ path: out, fullPage: full });
  const m = await page.evaluate(() => ({ title: document.title, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h: document.documentElement.scrollHeight, tables: document.querySelectorAll("table").length, h2s: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim().slice(0, 40)) }));
  facts.push({ file, width, name, errors, horizontal_overflow: m.scrollW > m.innerW, ...m });
  await ctx.close();
}
await shoot("UNIVERSE-STANDARD.html", 1680, "standard-1680.png", { clipTo: 2400 });
await shoot("UNIVERSE-STANDARD.html", 1680, "standard-s5-1680.png", { selector: "#s5 + .panel" });
await shoot("UNIVERSE-STANDARD.html", 1680, "standard-s4-1680.png", { selector: "#s4 + .panel" });
await shoot("UNIVERSE-STANDARD.html", 1680, "standard-s6-1680.png", { selector: "#s6 + .panel" });
await shoot("UNIVERSE-STANDARD.html", 1680, "standard-full-1680.png", { full: true });
await shoot("UNIVERSE-STANDARD.html", 390, "standard-390.png", { clipTo: 2400 });
await shoot("UNIVERSE-STANDARD.html", 390, "standard-s5-390.png", { selector: "#s5 + .panel" });
await shoot("agreement-ladder.html", 1680, "ladder-1680.png", { full: true });
await shoot("agreement-ladder.html", 390, "ladder-390.png", { clipTo: 1800 });
await shoot("agreement-3d.html", 1680, "3d-1680.png", { full: true });
await shoot("agreement-3d.html", 390, "3d-390.png", { full: true });
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, "facts.json"), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts.map((f) => ({ name: f.name, errors: f.errors.length, overflow: f.horizontal_overflow, h: f.h, tables: f.tables }))));
