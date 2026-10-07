// HM2 — one headless picture of one page. Never a visible window; every non-GET request is blocked and counted.
// usage: node shoot.mjs <url> <out.jpg> [width=1680] [height=1050] [waitMs=20000] [--full] [--map=overrides.json] [--eval=file.js] [--clip=selector]
//   --map   JSON { "<host+path>": "<local file>" }  → that address is answered from the local file (the branch's page on the live address)
//   --data  JSON { "<substring of a GET url>": "<local json file>" } → that read is answered from the local file (a table not created yet)
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [url, out, w = "1680", h = "1050", wait = "20000", ...flags] = process.argv.slice(2);
const flag = (n) => { const f = flags.find((x) => x.startsWith("--" + n + "=")); return f ? f.slice(n.length + 3) : null; };
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return ""; } };
const map = new Map(flag("map") ? Object.entries(JSON.parse(fs.readFileSync(flag("map"), "utf8"))) : []);
const data = flag("data") ? Object.entries(JSON.parse(fs.readFileSync(flag("data"), "utf8"))) : [];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
let blocked = 0; const served = [];
try {
  const context = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
  await context.route("**/*", (route) => {
    const req = route.request();
    if (req.method() !== "GET") { blocked++; return route.abort("blockedbyclient"); }
    const local = map.get(urlKey(req.url()));
    if (local) { served.push(urlKey(req.url())); return route.fulfill({ status: 200, contentType: /\.m?js$/.test(local) ? "text/javascript; charset=utf-8" : /\.json$/.test(local) ? "application/json" : "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) }); }
    const d = data.find(([k]) => req.url().includes(k));
    if (d) { served.push("data:" + d[0]); return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "cache-control": "no-store", "content-range": "0-0/*" }, body: fs.readFileSync(d[1]) }); }
    return route.continue();
  });
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(+wait);
  let facts = null;
  if (flag("eval")) facts = await page.evaluate(fs.readFileSync(flag("eval"), "utf8"));
  if (flag("evalwait")) await page.waitForTimeout(+flag("evalwait"));
  const clip = flag("clip");
  if (clip) { const el = await page.$(clip); if (!el) console.log("CLIP NOT FOUND", clip); else await el.screenshot({ path: out, type: "jpeg", quality: 80 }); }
  else await page.screenshot({ path: out, type: "jpeg", quality: 78, fullPage: flags.includes("--full") });
  console.log(JSON.stringify({ out, w: +w, title: await page.title(), blockedNonGet: blocked, served: [...new Set(served)], pageErrors: errors, facts }));
  await context.close();
} finally { await browser.close(); }
