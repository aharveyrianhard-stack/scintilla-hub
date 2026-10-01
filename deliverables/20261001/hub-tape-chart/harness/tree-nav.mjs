// H3 tree nav — headless. The Hub at https://scintillahub.ai/ is answered from the local branch (index.html and every file
// under it that exists locally); everything else is live. Click TREE, wait for the tree map, shoot it, press its BACK,
// confirm the Hub is back. usage: node tree-nav.mjs <hubRoot> <outPrefix> <width>
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs"; import path from "node:path";
const [root, out, W] = process.argv.slice(2);
const width = +W || 1680;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1050 }, deviceScaleFactor: width < 600 ? 2 : 1, isMobile: width < 600, hasTouch: width < 600 });
const MIME = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", png: "image/png", svg: "image/svg+xml" };
await context.route("**/*", (route) => { const req = route.request(), u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
  if (u.host === "scintillahub.ai") { let f = path.join(root, decodeURIComponent(u.pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: MIME[f.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(f) }); }
  return route.continue(); });
const page = await context.newPage();
page.on("pageerror", (e) => console.error("pageerror:", String(e).slice(0, 160)));
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector('#mtabs [data-sec="TREE"]'), null, { timeout: 60000 });
await sleep(2500);
await page.screenshot({ path: out + "-hub.png" });
const tabs = await page.evaluate(() => [...document.querySelectorAll("#mtabs .sc-mtab")].map((b) => b.textContent.trim()));
await page.click('#mtabs [data-sec="TREE"]');
await page.waitForURL(/tree-map/, { timeout: 30000 });
await sleep(6000);
const tree = await page.evaluate(() => ({ url: location.pathname, title: document.title, nav: [...document.querySelectorAll("[data-go]")].map((b) => b.getAttribute("data-go") + ":" + b.textContent.trim()) }));
await page.screenshot({ path: out + "-tree.png" });
await page.click('[data-go="back"]');
await page.waitForURL((u) => u.pathname === "/", { timeout: 30000 });
const back = await page.evaluate(() => location.href);
console.log(JSON.stringify({ tabs, tree, back }));
await browser.close();
