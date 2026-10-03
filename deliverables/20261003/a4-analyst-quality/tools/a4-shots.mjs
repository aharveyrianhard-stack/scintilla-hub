/* A4 (3 Oct 2026) — a copy of A3's headless shot tool (deliverables/20261003/a3-analysts/tools/a3-shots.mjs), writing to A4's shots/. A3: Never a
   visible window (Alan, 24 Sep). The Hub is served from a checkout (HUB_ROOT: this branch, or a clean 9d2b1ca for "before") under
   its real hostname, so the chart API's origin check passes without relaxing anything; every non-GET request is answered
   locally and counted, never sent. Reads go to the live database with the page's own anon key.
     node a3-shots.mjs <label> <T,T,…> [width]     1680 → 1680 × 1050 at device scale 2 · 390 → 390 × 844 at scale 2
   Writes shots/<label>-<T>-<width>.png (the screen as it opens), shots/<label>-<T>-<width>-tab.png (the whole tab, unrolled)
   and, when the tab has A3's sub-tabs, shots/<label>-<T>-<width>-<SUB>.png per sub-tab; shots/<label>-<width>.json says what
   was printed, the page errors and the blocked writes. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label = "after", list = "AMZN,NVDA,MU", wArg = "1680"] = process.argv.slice(2);
const W = +wArg, H = W >= 1000 ? 1050 : 844;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const shots = path.join(here, "..", "shots");
fs.mkdirSync(shots, { recursive: true });
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
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, serviceWorkers: "block", isMobile: W < 768, hasTouch: W < 768 });
await context.addInitScript(() => { try { localStorage.setItem("hub.company.tab", "ESTIMATES"); localStorage.removeItem("hub.estimates.sub"); } catch (_) {} });
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url()), m = req.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
    writes.push({ method: m, url: u.host + u.pathname });
    return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
  }
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
const out = { label, width: W, hubRoot, at: new Date().toISOString(), results: [], writes, errors };
/* the tab's content, cloned and unrolled into an overlay of the same width in the same page (same CSS), shot, removed */
async function shootTab(file, openSpecs) {
  const ok = await page.evaluate((openSpecs) => {
    const rc = document.getElementById("coRailContent"); if (!rc) return false;
    const w = rc.getBoundingClientRect().width, box = document.createElement("div");
    box.id = "a3Shot"; box.className = rc.className; box.style.cssText = "position:absolute;left:0;top:0;z-index:2147483647;padding:10px 12px;background:#000;overflow:visible;height:auto;max-height:none;width:" + Math.round(w + 24) + "px";
    box.innerHTML = rc.innerHTML;
    /* a swipe keeps its own scroll position in the clone */
    const src = rc.querySelectorAll(".sc-fsw"), dst = box.querySelectorAll(".sc-fsw");
    document.body.appendChild(box);
    dst.forEach((d, i) => { if (src[i]) d.scrollLeft = src[i].scrollLeft; });
    if (openSpecs) box.querySelectorAll("details.sc-pagespecs").forEach((d) => { d.open = true; });
    window.scrollTo(0, 0); return true;
  }, !!openSpecs);
  if (!ok) return null;
  const el = await page.$("#a3Shot"); await el.screenshot({ path: file, type: "png" });
  await page.evaluate(() => { const b = document.getElementById("a3Shot"); if (b) b.remove(); });
  return file;
}
const printed = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s), tx = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : null);
  const rc = q("#coRailContent");
  return {
    hero: tx(q(".sc-ptc")), subs: [...document.querySelectorAll(".sc-esub [data-sub]")].map((b) => (b.classList.contains("on") ? "*" : "") + tx(b)),
    sections: [...document.querySelectorAll("#coRailContent .sc-est-sechead")].map((h) => tx(h.querySelector(".n")) + " " + tx(h.querySelector(".t"))),
    cards: [...document.querySelectorAll(".sc-fsw .sc-fcard")].slice(0, 6).map(tx), cardCount: document.querySelectorAll(".sc-fsw .sc-fcard").length,
    specs: !!q("#coRailContent details.sc-pagespecs"), descInContent: document.querySelectorAll("#coRailContent .sc-esub-body :is(.sc-rvs-note,.sc-est-note,.sc-est-hint,.sc-rvs-say,.sc-rvh-say,.sc-est-ptwhat)").length, arrows: [...document.querySelectorAll(".sc-rvs-arr")].map(tx),
    railH: rc ? Math.round(rc.getBoundingClientRect().height) : null, tabH: rc ? rc.scrollHeight : null,
  };
});
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => {});
  await sleep(5000);
  for (const t of String(list).split(",")) {
    const r = { t };
    await page.evaluate((x) => openCo(x), t);
    try { await page.waitForSelector('[data-act="cotab"][data-tab="ESTIMATES"]', { timeout: 30000 }); } catch (_) { r.noTab = true; }
    await page.evaluate(() => { const b = document.querySelector('[data-act="cotab"][data-tab="ESTIMATES"]'); if (b) b.click(); });
    try { await page.waitForSelector("#coRailContent .sc-est-sechead, #coRailContent .sc-ptc", { timeout: 30000 }); } catch (_) { r.noEst = true; }
    /* the analyst reads land: no "reading" left in the strip / the hero / the firms */
    await page.waitForFunction(() => {
      const rc = document.getElementById("coRailContent"); if (!rc) return false;
      return !/Reading the analysts|reading…|Reading every firm/.test(rc.textContent);
    }, null, { timeout: 40000 }).catch(() => { r.stillLoading = true; });
    await sleep(2500);
    r.file = path.join(shots, `${label}-${t}-${W}.png`);
    await page.screenshot({ path: r.file, type: "png" });
    r.tab = await shootTab(path.join(shots, `${label}-${t}-${W}-tab.png`), true);   // PAGE SPECS open in this one
    r.printed = await printed();
    const subs = await page.evaluate(() => [...document.querySelectorAll(".sc-esub [data-sub]")].map((b) => b.dataset.sub));
    r.subShots = {};
    for (const s of subs) {
      await page.evaluate((k) => { const b = document.querySelector('.sc-esub [data-sub="' + k + '"]'); if (b) b.click(); }, s);
      await sleep(900);
      const f = path.join(shots, `${label}-${t}-${W}-${s}.png`);
      await page.screenshot({ path: f, type: "png" });
      r.subShots[s] = { screen: f, tab: await shootTab(path.join(shots, `${label}-${t}-${W}-${s}-tab.png`)), printed: await printed() };
    }
    /* the swipe, driven like a reader: a mouse wheel over it, a mouse drag, a drag that ends on a card (must not open it), a tap */
    if (subs.includes("FIRMS")) {
      await page.evaluate(() => { const b = document.querySelector('.sc-esub [data-sub="FIRMS"]'); if (b) b.click(); });
      await sleep(700);
      const sw = await page.$("#coRailContent .sc-fsw");
      if (sw) {
        await sw.scrollIntoViewIfNeeded();
        const box = await sw.boundingBox(), L = () => page.evaluate(() => document.querySelector("#coRailContent .sc-fsw").scrollLeft);
        const it = { start: await L() };
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 400); await sleep(400); it.afterWheel = await L();
        await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 250, box.y + box.height / 2, { steps: 8 }); await page.mouse.up(); await sleep(300);
        it.afterDrag = await L();
        it.openAfterDrag = await page.evaluate(() => !!document.querySelector("#coRailContent .sc-fsw-box .sc-rvh-notes"));
        await page.evaluate(() => { const s = document.querySelector("#coRailContent .sc-fsw"); s.scrollLeft = 0; });
        await sleep(200);
        const card = await page.$("#coRailContent .sc-fcard"); if (card) { await card.click(); await sleep(600); }
        it.openAfterTap = await page.evaluate(() => { const n = document.querySelector("#coRailContent .sc-rvh-nh"); return n ? n.textContent.replace(/\s+/g, " ").trim() : null; });
        it.framed = await page.evaluate(() => !!document.querySelector("#coRailContent .sc-fcard.on"));
        r.swipe = it;
        await page.screenshot({ path: path.join(shots, `${label}-${t}-${W}-FIRMS-open.png`), type: "png" });
        r.swipe.tab = await shootTab(path.join(shots, `${label}-${t}-${W}-FIRMS-open-tab.png`));
        await page.evaluate(() => { const x = document.querySelector("#coRailContent .sc-fsw-box .sc-rvh-x"); if (x) x.click(); });
      }
    }
    if (subs.length) await page.evaluate((k) => { const b = document.querySelector('.sc-esub [data-sub="' + k + '"]'); if (b) b.click(); }, subs[0]);
    r.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    out.results.push(r);
  }
} catch (e) { out.error = String(e && e.stack || e).slice(0, 800); }
finally { await browser.close().catch(() => {}); }
const file = path.join(shots, `${label}-${W}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ file, results: out.results.map((r) => ({ t: r.t, printed: r.printed, stillLoading: r.stillLoading, overflow: r.overflow, subs: Object.keys(r.subShots || {}), swipe: r.swipe && { ...r.swipe, tab: undefined } })), errors: out.errors, writes: out.writes.length, error: out.error }, null, 1));
