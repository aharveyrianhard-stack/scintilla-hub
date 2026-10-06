/* ST2 (6 Oct 2026) — headless pictures and the motion check. Never a visible window (Alan, 24 Sep).
     node st2-shots.mjs <live|local> <width>
   live  = https://scintillahub.ai as deployed (BEFORE);  local = the preview copy served as the same hostname's "/"
   (AFTER; every other file comes from this branch, or from the live site when the branch has none; /api/ goes to live).
   Every non-GET request is answered here and counted, never sent. Shots → ../shots, the record → ../tools/rec-<mode>-<width>.json */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { withoutScnav } from "./st2-patch.mjs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [mode = "local", w = "1680"] = process.argv.slice(2);
const width = Number(w), phone = width < 700;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(here, "../../../..");
const shots = path.join(here, "..", "shots");
const preview = path.join(here, "..", "preview", "index.html");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(pathname) {
  if (pathname === "/" || pathname === "/index.html") return preview;
  let f = path.normalize(path.join(hubRoot, decodeURIComponent(pathname)));
  if (!f.startsWith(hubRoot)) return null;
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], errors = [];
const out = { mode, width, at: new Date().toISOString(), writes, errors };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 2 : 1, serviceWorkers: "block",
    ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") {
      writes.push({ method: m, url: u.host + u.pathname });
      return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" });
    }
    if (mode === "local" && u.host === "scintillahub.ai" && !u.pathname.startsWith("/api/")) {
      const f = localFile(u.pathname);
      /* served as the Hub's own "/", the preview is shown without the sub-page BACK / CLOSE pair it carries in its folder */
      if (f) return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: f === preview ? withoutScnav(fs.readFileSync(f, "utf8")) : fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 }).catch(() => { out.noBoard = true; });
  await page.waitForSelector("#scintStrip .sc-ss", { timeout: 60000 }).catch(() => { out.noStrip = true; });
  await sleep(4000);
  const read = () => page.evaluate(() => {
    const host = document.querySelector("#scintStrip"), ss = host && host.querySelector(".sc-ss");
    if (!ss) return null;
    const r = ss.getBoundingClientRect(), track = ss.querySelector(".sc-tape__track"), win = ss.querySelector(".sc-tape__win");
    const items = [...ss.querySelectorAll(".sc-ss__it")];
    const inWin = win ? items.filter((i) => { const b = i.getBoundingClientRect(), wr = win.getBoundingClientRect(); return b.left >= wr.left && b.right <= wr.right; }) : [];
    return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height * 10) / 10 },
      text: ss.textContent.replace(/\s+/g, " ").trim().slice(0, 400), count: (ss.querySelector(".sc-ss__n") || {}).textContent || null,
      stripTitle: (ss.getAttribute("title") || "").slice(0, 2000), tape: !!track,
      items: items.length, distinct: new Set(items.map((i) => i.dataset.kind + "|" + i.dataset.sub + "|" + i.dataset.ts)).size,
      fullyVisible: inWin.length, firstVisible: inWin.slice(0, 12).map((i) => i.textContent.replace(/\s+/g, " ").trim()),
      firstItemTitle: items[0] ? items[0].getAttribute("title") : null,
      x: track ? new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 : null,
      dur: track ? track.style.animationDuration : null, half: track ? track.scrollWidth / 2 : null, win: win ? win.clientWidth : null,
      today: typeof scintToday === "function" ? scintToday().length : null,
      boardTop: (() => { const b = document.querySelector(".sc-body2"); return b ? Math.round(b.getBoundingClientRect().top * 10) / 10 : null; })(),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      fontPx: items[0] ? getComputedStyle(items[0]).fontSize : null };
  });
  const clipOf = (s) => ({ x: 0, y: Math.max(0, s.rect.y - 46), width, height: Math.round(s.rect.h) + 92 });
  const s0 = await read();
  out.strip = s0;
  out.shots = [];
  const full = path.join(shots, mode + "-" + width + "-screen.png");
  await page.screenshot({ path: full, type: "png" }); out.shots.push(full);
  if (s0) {
    /* two frames one second apart, of the strip and the bands around it */
    const f1 = path.join(shots, mode + "-" + width + "-strip-t0.png"), f2 = path.join(shots, mode + "-" + width + "-strip-t1.png");
    const a = await read(); const t0 = Date.now(); await page.screenshot({ path: f1, type: "png", clip: clipOf(s0) });
    await sleep(Math.max(0, 1000 - (Date.now() - t0)));
    const b = await read(); await page.screenshot({ path: f2, type: "png", clip: clipOf(s0) });
    out.shots.push(f1, f2);
    out.twoFrames = { x0: a.x, x1: b.x, movedPx: a.x != null && b.x != null ? Math.round((a.x - b.x) * 10) / 10 : null };
    if (s0.tape) {
      /* ten seconds, one reading a second (performance.now on the page's own clock) */
      const samples = [];
      for (let i = 0; i <= 10; i++) {
        samples.push(await page.evaluate(() => ({ t: performance.now(), x: new DOMMatrixReadOnly(getComputedStyle(document.querySelector("#scintStrip .sc-tape__track")).transform).m41 })));
        if (i < 10) await sleep(1000);
      }
      const half = s0.half, steps = samples.slice(1).map((s, i) => { let dx = samples[i].x - s.x; if (dx < 0) dx += half; return Math.round((dx / ((s.t - samples[i].t) / 1000)) * 10) / 10; });
      out.tenSeconds = { xs: samples.map((s) => Math.round(s.x * 10) / 10), pxPerSecond: steps, everySecondMoved: steps.every((v) => v > 30 && v < 60) };
      /* the other tapes' speed, read the same way at the same moment */
      out.otherTapes = await page.evaluate(() => [...document.querySelectorAll(".sc-tape .sc-tape__track")].filter((t) => t.offsetParent && !t.closest("#scintStrip")).slice(0, 6).map((t) => {
        const half = t.scrollWidth / 2, dur = parseFloat(t.style.animationDuration || getComputedStyle(t).animationDuration);
        return { tape: ((t.closest(".sc-tape").querySelector(".sc-tape__lbl") || {}).textContent || "").trim(), pxPerSecond: dur ? Math.round((half / dur) * 10) / 10 : null, fontPx: getComputedStyle(t).fontSize };
      }));
      if (!phone) {
        /* hover pauses */
        await page.mouse.move(s0.rect.x + 60, s0.rect.y + s0.rect.h / 2); await sleep(300);
        const h0 = await read(); await sleep(1000); const h1 = await read();
        out.hover = { x0: h0.x, x1: h1.x, paused: h0.x === h1.x };
        await page.mouse.move(5, 5); await sleep(300);
        const r0 = await read(); await sleep(1000); const r1 = await read();
        out.hover.resumedMovedPx = Math.round((r0.x - r1.x) * 10) / 10;
      }
      /* a NEW scintilla: one more row put into the page's own list (nothing is written anywhere), then the page's own render */
      out.flash = await page.evaluate(async () => {
        const calls = [];
        const orig = Element.prototype.animate;
        Element.prototype.animate = function (kf, opt) { if (this.closest && this.closest("#scintStrip")) calls.push({ cls: this.className, text: this.textContent, parent: this.parentElement && this.parentElement.dataset.sub, kf: JSON.stringify(kf).slice(0, 120), dur: opt && opt.duration }); return orig.apply(this, arguments); };
        const before = document.querySelectorAll("#scintStrip .sc-ss__it").length, n0 = document.querySelector("#scintStrip .sc-ss__n").textContent;
        const row = { ts: new Date().toISOString(), kind: "price_outlier", subject: "ZZST2", subject_kind: "ticker", direction: 1, magnitude: 3.1, source: "st2-proof",
          detail: { move_pct: 8.34, daily_vol_pct: 2.7, n_days: 60, session: todayISO() } };
        SCINT_ROWS.unshift(row); SCINT_BY = null;
        scintStripRender();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const first = document.querySelector("#scintStrip .sc-ss__it");
        const res = { countBefore: n0, countAfter: document.querySelector("#scintStrip .sc-ss__n").textContent, itemsBefore: before, itemsAfter: document.querySelectorAll("#scintStrip .sc-ss__it").length,
          firstItem: first.textContent.replace(/\s+/g, " ").trim(), firstItemTitle: first.getAttribute("title"),
          firstItemLeftInWindow: Math.round(first.getBoundingClientRect().left - document.querySelector("#scintStrip .sc-tape__win").getBoundingClientRect().left),
          animateCalls: calls.slice(0, 6), animateCallsN: calls.length };
        calls.length = 0;
        scintStripRender();                                   /* the next tick: the same row must NOT flash again */
        res.secondRenderAnimateCalls = calls.length;
        Element.prototype.animate = orig;
        return res;
      });
      const ff = path.join(shots, mode + "-" + width + "-flash.png");
      await page.evaluate(() => { SCINT_SEEN.delete("strip|price_outlier|ZZST2"); scintStripRender(); });   /* replay it for the picture only */
      await page.screenshot({ path: ff, type: "png", clip: clipOf(s0) }); out.shots.push(ff);
      await page.evaluate(() => { SCINT_ROWS.shift(); SCINT_BY = null; scintStripRender(); });
      await sleep(600);
      /* a click opens the thing: the first real ticker on the tape */
      out.click = await page.evaluate(async () => {
        const it = [...document.querySelectorAll("#scintStrip .sc-ss__it")].find((i) => i.dataset.kind === "price_outlier");
        if (!it) return null;
        const t = it.dataset.sub, sec0 = S.sec, co0 = S.co || S.ticker || null;
        it.click();
        await new Promise((r) => setTimeout(r, 2500));
        return { clicked: t, secBefore: sec0, secAfter: S.sec, pinned: (typeof S !== "undefined" && (S.sel || S.co || S.pin || S.ticker)) || null,
          title: (document.querySelector(".sc-hdr__title, #coTitle, .cv-head") || {}).textContent || null, hash: location.hash,
          bodyHasTicker: document.body.innerText.slice(0, 4000).includes(t) };
      });
      const cf = path.join(shots, mode + "-" + width + "-after-click.png");
      await page.screenshot({ path: cf, type: "png" }); out.shots.push(cf);
    }
  }
} catch (e) { out.fatal = String(e && e.stack || e).slice(0, 600); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, "rec-" + mode + "-" + width + ".json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
