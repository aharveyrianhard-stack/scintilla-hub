/* R2 Part B (2 Oct) — the headless walk of the IPO LOCK-UPS card on the EARNINGS page and the STATS lock-up line, and the
   proof that the dashboard's EARNINGS → band carries no unlock (Alan: "I decide when we put a dashboard strip"). Never a
   visible window (Alan, 24 Sep). The Hub is served from this branch under its real hostname (the P1 / H8 walks' way);
   every non-GET request is answered locally and counted, never sent; the page's own GET reads go through (anon).
     node r2u-walk.mjs 1680   1680 × 1050 at device scale 2: the dashboard, the EARNINGS page and its IPO LOCK-UPS card
                              (zoomed), CBRS and SPCX STATS · ACTIVITY & DATES (zoomed), reached by tapping the card's rows
     node r2u-walk.mjs 390    the phone at 390 × 844: the same, CBRS only
   Shots → ../screens/, the record → ./walk-<width>.json. */
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
  try { await page.waitForFunction(() => document.querySelector("#topTapeBand .sc-tape__item"), null, { timeout: 60000 }); } catch (_) { out.noBand = true; }
  await sleep(2500);
  /* 1 · the dashboard's EARNINGS band carries NO unlock (Alan: "dashboard strips are very precious") */
  out.band = await page.evaluate(() => {
    const b = document.querySelector("#topTapeBand");
    return b ? { unlockChips: b.querySelectorAll(".ulk-it, .ulk-head").length, mentionsUnlock: /UNLOCK/i.test(b.textContent), label: (b.querySelector(".sc-tape__lbl") || {}).textContent } : null;
  });
  await shot("dashboard", null);
  /* 2 · the EARNINGS page (top nav) and its IPO LOCK-UPS card */
  await page.evaluate(() => { const t = document.querySelector('#mtabs [data-act="mtab"][data-sec="EVENTS"]'); if (t) t.click(); });
  try { await page.waitForFunction(() => document.querySelector("#evLockups table, #evLockups .sc-senttxt"), null, { timeout: 30000 }); } catch (_) { out.noCard = true; }
  try { await page.waitForFunction(() => document.querySelector("#evLockups table"), null, { timeout: 30000 }); } catch (_) { out.noTable = true; }
  await sleep(1200);
  out.card = await page.evaluate(() => {
    const h = document.querySelector("#evLockups"); if (!h) return null;
    const card = h.closest(".card"); if (card) card.id = "ulkCard";
    return { heading: card ? (card.querySelector("h4") || {}).textContent : null,
      rows: [...h.querySelectorAll("tr.ulk-r")].map((r) => ({ t: r.dataset.t, past: r.classList.contains("is-past"), text: r.textContent.replace(/\s+/g, " ").trim(), title: r.title.slice(0, 300) })),
      terms: [...h.querySelectorAll("tr.ulk-x")].map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 400)),
      past_header: !!h.querySelector("tr.ulk-h"), foot: (h.querySelector(".ulk-foot") || {}).textContent };
  });
  if (phone) {
    /* the phone stacks the page and EARNINGS EXTRAS is a short scrolling box: open it full screen with its own ⛶ button,
       the way a phone user would, then scroll to the card */
    out.phoneFullscreen = await page.evaluate(() => { const b = document.querySelector("#evExtras") && document.querySelector("#evExtras").closest(".panel").querySelector('[data-act="secfs"]'); if (!b) return false; b.click(); return true; });
    await sleep(1200);
  }
  await page.evaluate(() => { const c = document.querySelector("#ulkCard"); if (c) c.scrollIntoView({ block: "start" }); });
  await sleep(400);
  await shot("earnings-lockups", phone ? null : "#ulkCard");
  await shot("earnings-page", null);
  /* the rail scrolls on its own: bring the dimmed ENDED part into view and shoot the card again */
  await page.evaluate(() => { const h = document.querySelector("#evLockups tr.ulk-h"); if (h) h.scrollIntoView({ block: "center" }); });
  await sleep(400);
  await shot("earnings-lockups-ended", phone ? null : "#ulkCard");
  if (phone && out.phoneFullscreen) { await page.keyboard.press("Escape"); await sleep(600); }
  /* 3 · tap a card row → the company → STATS · ACTIVITY & DATES */
  for (const t of phone ? ["CBRS"] : ["CBRS", "SPCX"]) {
    if (t !== "CBRS") {      /* back to the EARNINGS page for the next row */
      await page.evaluate(() => { const b = document.querySelector('#mtabs [data-act="mtab"][data-sec="EVENTS"]'); if (b) b.click(); });
      try { await page.waitForFunction(() => document.querySelector("#evLockups table"), null, { timeout: 30000 }); } catch (_) {}
      await sleep(800);
    }
    out["tapped_" + t] = await page.evaluate((tt) => { const r = document.querySelector('#evLockups tr.ulk-r[data-t="' + tt + '"]'); if (!r) return false; r.click(); return true; }, t);
    await sleep(2500);
    await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="STATS"]'); if (b) b.click(); });
    try { await page.waitForFunction(() => document.querySelector("#coRailContent .st-ulk"), null, { timeout: 30000 }); } catch (_) { out["noStatsLine_" + t] = true; }
    await sleep(800);
    out["stats_" + t] = await page.evaluate(() => {
      const l = document.querySelector("#coRailContent .st-ulk");
      return l ? { line: l.textContent.replace(/\s+/g, " ").trim(), title: l.title.slice(0, 400) } : null;
    });
    await page.evaluate(() => { const l = document.querySelector("#coRailContent .st-ulk"); const blk = l && l.closest(".st-blk"); if (blk) { blk.id = "ulkBlk"; blk.scrollIntoView({ block: "center" }); } });
    await sleep(300);
    await shot("stats-" + t, "#ulkBlk");
  }
} catch (e) { out.fatal = String(e && e.stack || e).slice(0, 600); }
fs.writeFileSync(path.join(here, "walk-" + width + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify({ width, band: out.band, card: out.card && { heading: out.card.heading, rows: out.card.rows.map((r) => (r.past ? "(dim) " : "") + r.text), past_header: out.card.past_header },
  statsCBRS: out.stats_CBRS && out.stats_CBRS.line, statsSPCX: out.stats_SPCX && out.stats_SPCX.line, writes: writes.length, errors, ulkReads: ulkReads.length, fatal: out.fatal, noCard: out.noCard, noTable: out.noTable }, null, 1));
