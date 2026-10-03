/* R2 Part B (2 Oct) — the headless walk of the UNLOCK chips on the EARNINGS → band and the STATS lock-up line. Never a
   visible window (Alan, 24 Sep). The Hub is served from this branch under its real hostname (the P1 / H8 walks' way);
   every non-GET request is answered locally and counted, never sent; the page's own GET reads go through (anon).
     node r2u-walk.mjs 1680   1680 × 1050 at device scale 2: the dashboard, the band held still on its UNLOCK run (zoomed),
                              CBRS and SPCX STATS · ACTIVITY & DATES (zoomed)
     node r2u-walk.mjs 390    the phone at 390 × 844: the band and CBRS STATS
   The band is a marquee: for the zoomed shot its track is paused and slid so the UNLOCK run is in the window (a
   screenshot aid only — the page itself is not changed). Shots → ../screens/, the record → ./walk-<width>.json. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const width = Number(process.argv[2] || 1680);
const phone = width < 700;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const screens = path.join(here, "..", "screens");
fs.mkdirSync(screens, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(root, pathname) {
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], errors = [], ulkReads = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 1 : 2, serviceWorkers: "block",
  ...(phone ? { isMobile: true, hasTouch: true } : {}) });
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
    writes.push({ method: m, url: u.host + u.pathname });
    return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
  }
  if (/\/rest\/v1\/ipo_lockups/.test(u.pathname)) ulkReads.push(u.pathname + "?" + [...u.searchParams.keys()].join("&"));
  if (u.host === "scintillahub.ai") {
    if (u.pathname.startsWith("/api/")) return route.continue();
    const f = localFile(hubRoot, u.pathname);
    if (!f) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
const out = { width, hubRoot, at: new Date().toISOString(), writes, errors, ulkReads };
const shot = async (name, sel) => {
  const file = path.join(screens, name + "-" + width + ".png");
  if (sel) { const h = await page.$(sel); if (h) { try { await h.screenshot({ path: file, type: "png" }); return file; } catch (e) { out["shotError_" + name] = String(e.message).slice(0, 160); } } }
  await page.screenshot({ path: file, type: "png", fullPage: false });
  return file;
};
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 });
  try { await page.waitForFunction(() => document.querySelector("#topTapeBand .ulk-it"), null, { timeout: 60000 }); } catch (_) { out.noChips = true; }
  await sleep(2500);
  out.band = await page.evaluate(() => {
    const b = document.querySelector("#topTapeBand"); if (!b) return null;
    const all = [...b.querySelectorAll(".sc-tape__item")], half = Math.floor(all.length / 2);
    const items = all.slice(0, half).map((c) => ({ cls: c.className.replace(/sc-tape__item\s*/, ""), text: c.textContent.replace(/\s+/g, " ").trim() }));
    const ulk = [...b.querySelectorAll(".ulk-it")].slice(0, Math.floor(b.querySelectorAll(".ulk-it").length / 2));
    return { label: (b.querySelector(".sc-tape__lbl") || {}).textContent, items, unlockChips: ulk.map((c) => ({ text: c.textContent.replace(/\s+/g, " ").trim(), t: c.dataset.t, title: c.title,
      colour: getComputedStyle(c.querySelector(".ulk-lbl")).color })), rows: typeof ULK_ROWS !== "undefined" && ULK_ROWS ? ULK_ROWS.length : null };
  });
  await shot("dashboard", null);
  /* hold the marquee still with the UNLOCK run in its window, then zoom on the band */
  out.slid = await page.evaluate((ph) => {
    const b = document.querySelector("#topTapeBand"), tr = b && b.querySelector(".sc-tape__track");
    const head = b && b.querySelector(ph ? ".ulk-it" : ".ulk-head");      /* the phone's window is narrow: start at the first chip */
    if (!tr || !head) return false;
    tr.style.animation = "none";
    const x = head.offsetLeft - (ph ? 6 : 40);
    tr.style.transform = "translateX(" + (-x) + "px)";
    return x;
  }, phone);
  await sleep(400);
  await shot("band-unlocks", "#topTape");
  /* the earnings window holds about two chips at 1680: step through every chip of the run, two at a time */
  if (!phone) {
    const n = await page.evaluate(() => Math.floor(document.querySelectorAll("#topTapeBand .ulk-it").length / 2));
    for (let i = 0; i < n; i += 2) {
      await page.evaluate((k) => { const tr = document.querySelector("#topTapeBand .sc-tape__track"), c = document.querySelectorAll("#topTapeBand .ulk-it")[k];
        if (tr && c) tr.style.transform = "translateX(" + (-(c.offsetLeft - 8)) + "px)"; }, i);
      await sleep(250);
      await shot("band-unlocks-" + (i / 2 + 1), "#topTape");
    }
  }
  /* the company view: tap the CBRS chip, then STATS */
  for (const t of phone ? ["CBRS"] : ["CBRS", "SPCX"]) {
    const ok = await page.evaluate((tt) => { const c = document.querySelector('#topTapeBand .ulk-it[data-t="' + tt + '"]'); if (!c) return false; c.click(); return true; }, t);
    out["tapped_" + t] = ok;
    await sleep(2500);
    await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="STATS"]'); if (b) b.click(); });
    try { await page.waitForFunction(() => document.querySelector("#coRailContent .st-ulk"), null, { timeout: 30000 }); } catch (_) { out["noStatsLine_" + t] = true; }
    await sleep(800);
    out["stats_" + t] = await page.evaluate(() => {
      const l = document.querySelector("#coRailContent .st-ulk");
      const blk = l && l.closest(".st-blk");
      return l ? { line: l.textContent.replace(/\s+/g, " ").trim(), title: l.title.slice(0, 400), block: blk ? blk.textContent.replace(/\s+/g, " ").trim().slice(0, 600) : null } : null;
    });
    await page.evaluate(() => { const l = document.querySelector("#coRailContent .st-ulk"); const blk = l && l.closest(".st-blk"); if (blk) { blk.id = "ulkBlk"; blk.scrollIntoView({ block: "center" }); } });
    await sleep(300);
    await shot("stats-" + t, "#ulkBlk");
    if (!phone && t === "CBRS") await shot("company-" + t, null);
  }
} catch (e) { out.fatal = String(e && e.stack || e).slice(0, 600); }
fs.writeFileSync(path.join(here, "walk-" + width + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify({ width, chips: out.band && out.band.unlockChips && out.band.unlockChips.map((c) => c.text), rows: out.band && out.band.rows, slid: out.slid,
  statsCBRS: out.stats_CBRS && out.stats_CBRS.line, statsSPCX: out.stats_SPCX && out.stats_SPCX.line, writes: writes.length, errors, ulkReads: ulkReads.length, fatal: out.fatal, noChips: out.noChips }, null, 1));
