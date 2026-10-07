/* CP5 · what the LIVE Hub's COMPS tab prints right now for the twelve names — the deployed site itself, read headless on ONE page,
   one name after the other. Every request that is not a read is answered locally and counted; nothing is written anywhere.
     node live-tab-read.mjs <outDir> TICKER …                                                                            */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [outArg, ...tickers] = process.argv.slice(2), OUT = path.resolve(outArg), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const writes = [], errors = [], rows = [];
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  await context.route("**/*", async (route) => { const req = route.request(), m = req.method(); if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { const u = new URL(req.url()); writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); } return route.continue(); });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 30 && errors.push(String(e.message).slice(0, 240)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(10000);
  for (const T of tickers) {
    const r = { ticker: T, read_utc: new Date().toISOString() };
    try {
      r.dash = await page.evaluate((t) => { const row = (typeof S !== "undefined" && S.rows || []).find((x) => x.t === t); return row ? { fpe: row.fpe ?? null, price: row.p ?? row.price ?? row.last ?? null } : null; }, T);
      await page.evaluate((t) => { openCo(t); }, T); await sleep(2500);
      await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="COMPS"]'); if (b) b.click(); });
      let last = "", still = 0; for (let i = 0; i < 90 && still < 3; i++) { await sleep(1000); const t = await page.evaluate(() => { const b = document.getElementById("scCompsTab"); return b ? b.innerText : ""; }); if (t === last && t.length > 400 && !/BUILDING|LOADING|loading…/.test(t.slice(0, 200))) still++; else still = 0; last = t; }
      r.text = last.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").slice(0, 6000); r.len = last.length;
      r.module = await page.evaluate(() => (performance.getEntriesByType("resource").map((e) => e.name).filter((u) => /comps[^/]*\/tab\.mjs/.test(u)).pop() || "").replace("https://scintillahub.ai", ""));
      if (["GOOGL", "NVDA", "AVGO", "MU"].includes(T)) { try { await page.screenshot({ path: path.join(OUT, `live-hub-${T}-1680.png`), timeout: 60000 }); r.shot = `live-hub-${T}-1680.png`; } catch (e) { r.shotFail = String(e.message).slice(0, 100); } }
    } catch (e) { r.error = String(e && e.message || e).slice(0, 200); }
    rows.push(r); fs.writeFileSync(path.join(OUT, "live-tab.jsonl"), rows.map((x) => JSON.stringify(x)).join("\n") + "\n");
    console.log(T, r.error ? "ERROR " + r.error : `len ${r.len} · ${r.module} · dash fpe ${r.dash && r.dash.fpe}`);
  }
  console.log(JSON.stringify({ done: true, errors: errors.slice(0, 5), n_errors: errors.length, writes_blocked: writes.length, writes: [...new Set(writes)].slice(0, 8) }));
} finally { await browser.close(); }
