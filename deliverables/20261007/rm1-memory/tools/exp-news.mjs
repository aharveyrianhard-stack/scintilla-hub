// RM1 experiment — the NEWS room left open on ALL: the live Hub and the branch's side by side, same minutes, real headlines.
// Every 2 minutes: how many headlines the list holds in memory, and how many pieces of the page the list is made of.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const MINUTES = Number(process.argv[2] || 14);
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return ""; } };
const map = JSON.parse(fs.readFileSync("override-hub.json", "utf8"));
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
try {
  const open = async (branch) => {
    const overrides = new Map(branch ? Object.entries(map).map(([u, f]) => [urlKey(u), f]) : []);
    const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
    await context.route("**/*", (route) => {
      const req = route.request(), local = overrides.get(urlKey(req.url()));
      if (req.method() !== "GET") return route.abort("blockedbyclient");
      if (local) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto("https://scintillahub.ai/", { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(15000);
    await page.evaluate(() => { document.querySelector('[data-act="coh"][data-key="ALL"]').click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { document.querySelector('[data-act="mtab"][data-sec="NEWS"]').click(); });
    await page.waitForTimeout(6000);
    return page;
  };
  const [live, branch] = await Promise.all([open(false), open(true)]);
  const read = (page) => page.evaluate(() => { const hit = NEWS_CACHE.get("ALL"), list = document.getElementById("newsList"); return { room: S.sec, list: S.coh, kept: hit ? hit.items.length : null, drawn: list ? list.children.length : null, pieces: list ? list.getElementsByTagName("*").length : null }; });
  console.log("minute  live: kept / drawn / pieces of the page      branch: kept / drawn / pieces of the page");
  const t0 = Date.now(); let first = null, last = null;
  for (let i = 0; i <= MINUTES / 2; i++) {
    const [a, b] = await Promise.all([read(live), read(branch)]);
    if (!first) first = { a, b }; last = { a, b };
    console.log(String(((Date.now() - t0) / 60000).toFixed(0)).padStart(4) + "    " + String(a.kept).padStart(5) + " / " + String(a.drawn).padStart(4) + " / " + String(a.pieces).padStart(5) + "                          " + String(b.kept).padStart(5) + " / " + String(b.drawn).padStart(4) + " / " + String(b.pieces).padStart(5) + (i === 0 ? "   (" + a.room + " on " + a.list + ")" : ""));
    if (i < MINUTES / 2) await new Promise((r) => setTimeout(r, 120000));
  }
  const mins = (Date.now() - t0) / 60000;
  console.log(`in ${mins.toFixed(0)} minutes the live list went ${first.a.kept} → ${last.a.kept} headlines (${((last.a.kept - first.a.kept) / mins * 60).toFixed(0)} an hour); the branch's went ${first.b.kept} → ${last.b.kept}`);
} finally { await browser.close(); }
