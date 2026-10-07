// O2 (5 Oct 2026) — which list the Hub dashboard opens on. HEADLESS ONLY.
// usage: node board-open.mjs <live | path/to/index.html> <width> <outdir> <tag>
//   live  = the deployed page at https://scintillahub.ai/ exactly as served (nothing substituted);
//   a path = that file answered as the Hub document (every other read still goes to the live services).
// EVERY non-GET request is aborted and counted: nothing can write a like, a list or a row.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [src, W, OUT, TAG] = process.argv.slice(2);
const html = src === "live" ? null : fs.readFileSync(src), width = +W || 1680, phone = width < 600;
const result = { tag: TAG, source: src === "live" ? "https://scintillahub.ai/ as deployed" : src, width, at: new Date().toISOString(), blocked: [], errors: [], steps: {} };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { result.blocked.push(req.method() + " " + u.host + u.pathname); return route.abort(); }
    if (html && u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(String(e).slice(0, 240)));
  const seen = [];
  await page.exposeFunction("__coh", (c) => seen.push(c));
  await page.addInitScript(() => { const t = setInterval(() => { try { if (typeof S !== "undefined") window.__coh(S.coh + "|" + document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length); } catch (_) {} }, 150); setTimeout(() => clearInterval(t), 30000); });
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && window.SC_RANK_READY && document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length > 0, null, { timeout: 90000 });
  await sleep(6000);
  const state = () => page.evaluate(() => ({ coh: S.coh, sec: S.sec,
    favorites: typeof LISTS !== "undefined" ? LISTS.favorites.length : null, liked: (S.fav || []).length,
    tabs: [...document.querySelectorAll("[data-act='coh']")].filter((b) => b.offsetParent).map((b) => b.textContent.trim().replace(/\s+/g, " ")).slice(0, 6),
    tabOn: [...document.querySelectorAll("[data-act='coh']")].filter((b) => b.offsetParent && (b.classList.contains("on") || b.getAttribute("aria-pressed") === "true" || b.classList.contains("is-on"))).map((b) => b.textContent.trim().replace(/\s+/g, " ")),
    rows: [...document.querySelectorAll("#boardPanel .sc-board__row[data-t]")].map((r) => r.dataset.t) }));
  result.steps.open = await state();
  result.cohTimeline = [...new Set(seen)];
  await page.screenshot({ path: `${OUT}/${TAG}-open.png` });
  /* LIKED is one tap away */
  const tapped = await page.evaluate(() => { const b = [...document.querySelectorAll("[data-act='coh'][data-key='FAV']")].find((x) => x.offsetParent); if (!b) return false; b.click(); return true; });
  await sleep(2500);
  result.steps.likedTap = Object.assign({ tapped }, await state());
  await page.screenshot({ path: `${OUT}/${TAG}-liked-one-tap.png` });
  /* does the page remember the tab? reload the same browser */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && window.SC_RANK_READY && document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length > 0, null, { timeout: 90000 });
  await sleep(6000);
  result.steps.reopen = await state();
} finally { await browser.close(); }
fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(result, null, 1));
const o = result.steps.open, l = result.steps.likedTap, r = result.steps.reopen;
console.log(TAG, width, "| opens on", o.coh, "tab lit", JSON.stringify(o.tabOn), "rows", o.rows.length, "favorites", o.favorites, "liked", o.liked, "| timeline", result.cohTimeline.slice(0, 8).join(","),
  "| after tapping LIKED:", l.tapped, l.coh, l.rows.length, "| reopened on", r.coh, "| errs", result.errors.length, "blocked writes", result.blocked.length);
