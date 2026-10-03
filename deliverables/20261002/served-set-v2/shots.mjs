/* U3 · headless proof. NEVER a visible window. The page is served from this folder over a throwaway local server;
   no API, no database, no key. node deliverables/20261002/served-set-v2/shots.mjs → shots/*.png and shots/facts.json */
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
  page.on("request", (r) => { if (r.method() !== "GET") { errors.push("non-GET request blocked: " + r.url()); } });
  await page.route("**/*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
  await page.goto(`${base}/${file}`, { waitUntil: "load" }); await page.waitForTimeout(300);
  const out = path.join(OUT, name);
  if (selector) { const el = await page.$(selector); await el.screenshot({ path: out }); }
  else if (clipTo) await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height: clipTo } });
  else await page.screenshot({ path: out, fullPage: full });
  const m = await page.evaluate(() => ({ title: document.title, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h: document.documentElement.scrollHeight, tables: document.querySelectorAll("table").length, svgs: document.querySelectorAll("svg").length, h2s: [...document.querySelectorAll("h2")].map((h) => h.textContent.trim().slice(0, 40)), scnav: !!document.querySelector(".scnav") }));
  facts.push({ file, width, name, errors, horizontal_overflow: m.scrollW > m.innerW, ...m });
  await ctx.close();
}
await shoot("SERVED-SET-V2.html", 1680, "desktop-1680.png", { clipTo: 2400 });
await shoot("SERVED-SET-V2.html", 1680, "sectors-1680.png", { selector: "#s2 ~ .panel" });
await shoot("SERVED-SET-V2.html", 1680, "equal-1680.png", { selector: "#s3 + .panel" });
await shoot("SERVED-SET-V2.html", 1680, "spdr-1680.png", { selector: "#s4 ~ .panel" });
await shoot("SERVED-SET-V2.html", 390, "phone-390.png", { clipTo: 2400 });
await browser.close(); srv.close();
fs.writeFileSync(path.join(OUT, "facts.json"), JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts.map((f) => ({ name: f.name, errors: f.errors, overflow: f.horizontal_overflow, h: f.h, tables: f.tables, svgs: f.svgs, scnav: f.scnav }))));
