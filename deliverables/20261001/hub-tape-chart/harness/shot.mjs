// H3 shot — headless. usage: node shot.mjs <index.html|LIVE> <out.png> <width> [js-to-run-before-shot] [waitMs] [fullPage]
// The Hub document at https://scintillahub.ai/ is answered with the local file under test (or the live one for LIVE);
// every other request goes to the live services as the page sends it. Non-GET requests are aborted (nothing is written).
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [file, out, W, JS, WAIT, FULL] = process.argv.slice(2);
const html = file === "LIVE" ? null : fs.readFileSync(file);
const width = +W || 1680, H = width < 600 ? 844 : 1050;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: width < 600 ? 2 : 1, isMobile: width < 600, hasTouch: width < 600 });
const stationRoot = process.env.STATION_ROOT || null;
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
  if (html && u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
  if (stationRoot && u.host === "station.scintillahub.ai") {
    let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
    let f = stationRoot + p; if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html"; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
    if (fs.existsSync(f)) { const ext = f.split(".").pop(); const ct = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(f), headers: { "cache-control": "no-store" } }); }
  }
  /* SIM_RVOL=1 (a SIMULATION, labelled as such in the report): the real board_volume answer is fetched and handed to the page
     with every row re-stamped as written now, and rvol_at_time filled from the row's own session_rvol where it is empty —
     to show what the board does the moment the writer's rows are current. Read only; nothing is written anywhere. */
  if (process.env.SIM_RVOL && /\/rest\/v1\/board_volume/.test(u.pathname)) {
    const r = await route.fetch(); const rows = await r.json().catch(() => []); const now = new Date().toISOString();
    const out = (Array.isArray(rows) ? rows : []).map((x) => ({ ...x, updated_ts: now, rvol_at_time: x.rvol_at_time ?? x.session_rvol }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out), headers: { "access-control-allow-origin": "*" } });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => console.error("pageerror:", String(e).slice(0, 200)));
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof S !== "undefined" && document.querySelectorAll('[data-act="row"][data-t]').length > 5, null, { timeout: 60000 }).catch(() => console.error("rows not seen"));
await sleep(+WAIT || 4000);
if (JS) { const r = await page.evaluate(JS).catch((e) => "ERR " + e); if (r !== undefined) console.log(typeof r === "string" ? r : JSON.stringify(r)); await sleep(+(process.env.AFTER || 3000)); }
await page.screenshot({ path: out, fullPage: FULL === "1" });
await browser.close();
