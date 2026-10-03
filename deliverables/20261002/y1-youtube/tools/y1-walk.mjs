/* Y1 (2 Oct) — headless walk of SOCIAL › YOUTUBE. Never a visible window (Alan, 24 Sep). The Hub is served from this
   branch under its real hostname; every non-GET request is answered locally and counted, never sent.
     node y1-walk.mjs <label>   → screens/<label>-{1680,390}-{raw,cards,edit}.png + walk-<label>.json
   The json records the raw table's column widths, the Edit-tickers count vs the chips drawn, and what sits under the
   Edit button (the ECONOMIC misclick check). */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const label = process.argv[2] || "before";
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
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
/* Y1_SIMULATE=1: answer GET yt-config with what the NEW (undeployed) yt-config would answer, built by the same shared
   planner from the measured fixture (RADAR + cohorts read 2 Oct) and the jobs' measured last-run times. Labelled
   "simulated" wherever it is shown. */
let SIM = null;
if (process.env.Y1_SIMULATE) {
  const P = await import(path.join(hubRoot, "supabase/functions/_shared/yt-search-plan.mjs"));
  const M = JSON.parse(fs.readFileSync(path.join(hubRoot, "tests/fixtures/y1-youtube/measured-20261002.json"), "utf8"));
  const by = {}; for (const r of M.cohorts) (by[r.ticker] = by[r.ticker] || []).push(r.cohort);
  const searched = P.searchList(M.radar);
  const rank = (c) => c === "INDEXES" ? "0" : "1_" + c;
  const radar = M.radar.map((r) => ({ ticker: r.ticker, cohort: by[r.ticker] ? P.bestCohort(by[r.ticker]) : "OTHER", searched: searched.includes(r.ticker) }))
    .sort((a, b) => rank(a.cohort) < rank(b.cohort) ? -1 : rank(a.cohort) > rank(b.cohort) ? 1 : a.ticker < b.ticker ? -1 : 1);
  SIM = { cfg: { source: "radar", radar, searched, excluded: P.NEVER_SEARCH, max: searched.length,
      plan: { ...P.dayPlan(searched.length, 20), every_min: 20, daily_quota: P.DAILY_QUOTA, cost_per_search: P.COST_PER_SEARCH, searches_today: null } },
    status: { jobs: { subscriptions: { at: "2026-10-03T02:00:09Z", seen: 45, new_videos: 0, rss_failed: null }, searches: { at: "2026-10-02T23:30:13Z" }, sentiment: { at: "2026-10-03T00:25:06Z" } } } };
}
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const out = { label, at: new Date().toISOString(), views: [], writes, errors };
async function view(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: "block", isMobile: width < 500, hasTouch: width < 500 });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      writes.push({ method: m, url: u.host + u.pathname });
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
    }
    if (SIM && u.pathname.endsWith("/functions/v1/yt-config")) return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(u.searchParams.get("status") === "1" ? SIM.status : SIM.cfg) });
    if (u.host === "www.youtube.com" && u.pathname.includes("iframe_api")) return route.fulfill({ status: 200, body: "" });   // no player boot
    if (u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(hubRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(width + ": " + String(e.message).slice(0, 200)));
  const r = { width };
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-act="mtab"][data-sec="SOCIAL"]', { state: "attached", timeout: 60000 });
  await sleep(4000);
  await page.evaluate(() => document.querySelector('[data-act="mtab"][data-sec="SOCIAL"]').click());
  await page.waitForSelector('[data-act="soctab"][data-tab="YOUTUBE"]', { timeout: 30000 });
  await page.evaluate(() => document.querySelector('[data-act="soctab"][data-tab="YOUTUBE"]').click());
  await page.waitForSelector(".sc-ytc, .sc-yt__empty", { timeout: 60000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(screens, `${label}-${width}-cards.jpg`), type: "jpeg", quality: 78 });
  await page.evaluate(() => document.querySelector('[data-act="ytviewmode"][data-v="RAW"]').click());
  await page.waitForSelector(".sc-ytraw__row", { timeout: 30000 });
  await sleep(800);
  await page.screenshot({ path: path.join(screens, `${label}-${width}-raw.jpg`), type: "jpeg", quality: 78 });
  r.raw = await page.evaluate(() => {
    const row = document.querySelector(".sc-ytraw__row"); const w = {};
    if (row) for (const c of row.children) { const k = [...c.classList].find((x) => x !== "sc-ytraw__c" && x !== "sc-ytage") || "?"; w[k] = Math.round(c.getBoundingClientRect().width); }
    const ttl = row && row.querySelector(".ttl"); const cs = ttl && getComputedStyle(ttl);
    const fresh = document.querySelector(".sc-ytfresh");
    return { rows: document.querySelectorAll(".sc-ytraw__row").length, widths: w, titleFont: cs && cs.fontSize, titleLines: ttl ? Math.round(ttl.getBoundingClientRect().height / parseFloat(cs.lineHeight || "16")) : null,
      rowClickable: !!(row && row.dataset.act === "ytopenraw"), fresh: fresh ? fresh.textContent.trim() : null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  /* the misclick check: the Edit button's box against every master tab, and what the browser hits at the button's centre */
  r.edit = await page.evaluate(() => {
    const b = document.querySelector('[data-act="ytedit"]'); if (!b) return { missing: true };
    const bb = b.getBoundingClientRect();
    const hits = [...document.querySelectorAll('[data-act="mtab"]')].filter((t) => { const q = t.getBoundingClientRect();
      return q.width && !(q.right <= bb.left || q.left >= bb.right || q.bottom <= bb.top || q.top >= bb.bottom); }).map((t) => t.dataset.sec);
    const econ = document.querySelector('[data-act="mtab"][data-sec="ECONOMIC"]'); const eb = econ && econ.getBoundingClientRect();
    const cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2; const at = document.elementFromPoint(cx, cy);
    const gap = eb ? Math.round(Math.max(0, bb.top - eb.bottom, eb.top - bb.bottom)) : null;
    return { box: [bb.left, bb.top, bb.width, bb.height].map(Math.round), econBox: eb ? [eb.left, eb.top, eb.width, eb.height].map(Math.round) : null,
      overlapsMasterTabs: hits, centreHits: at ? (at.closest("[data-act]") || at).getAttribute("data-act") + ":" + ((at.closest("[data-act]") || {}).dataset || {}).sec : null, verticalGapToEconomic: gap };
  });
  await page.evaluate(() => document.querySelector('[data-act="ytedit"]').click());
  await page.waitForFunction(() => { const b = document.getElementById("ytCfgBody"); return b && !/loading/.test(b.textContent); }, null, { timeout: 30000 }).catch(() => {});
  await sleep(600);
  await page.screenshot({ path: path.join(screens, `${label}-${width}-edit.jpg`), type: "jpeg", quality: 78 });
  r.cfg = await page.evaluate(() => {
    const body = document.getElementById("ytCfgBody");
    return { count: (document.getElementById("ytCfgNum") || {}).textContent, chips: document.querySelectorAll(".sc-ytcfg__chip").length,
      selectedDrawn: document.querySelectorAll(".sc-ytcfg__chip.sel").length, groups: [...document.querySelectorAll(".sc-ytcfg__grp")].map((g) => g.textContent),
      bodyScroll: body ? body.scrollHeight + "/" + body.clientHeight : null, text: body ? body.textContent.slice(0, 300) : null,
      note: (document.querySelector(".sc-ytcfg__cnt") || {}).textContent };
  });
  out.views.push(r);
  await context.close();
}
try { await view(1680, 1050); await view(390, 844); }
catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await browser.close().catch(() => {}); }
fs.writeFileSync(path.join(here, `walk-${label}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
