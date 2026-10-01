// H4 board harness — HEADLESS ONLY (never a visible window). usage: node board.mjs <index.html|LIVE> <width> <outdir> <tag>
// The Hub document at https://scintillahub.ai/ is answered with the local file under test (or the live page for LIVE),
// so the chart API sees its own origin. Every other request goes to the live services as the page sends it, and EVERY
// non-GET request is aborted: nothing here can write a like, a list, a setting or any table row.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [file, W, OUT, TAG] = process.argv.slice(2);
const html = file === "LIVE" ? null : fs.readFileSync(file);
const width = +W || 1680, phone = width < 600, H = phone ? 844 : 1050;
const result = { tag: TAG, width, at: new Date().toISOString(), blocked: [], errors: [], steps: {} };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { result.blocked.push(req.method() + " " + u.host + u.pathname); return route.abort(); }
    if (html && u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(String(e).slice(0, 240)));
  const shot = async (name, clip) => { const p = OUT + "/" + TAG + "-" + width + "-" + name + ".png"; await page.screenshot(clip ? { path: p, clip } : { path: p }); return p; };
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && document.querySelectorAll('.sc-board__row[data-t]').length > 5 &&
    [...document.querySelectorAll('.sc-board__row')].filter((r) => r.getAttribute("data-sc-geiger") != null).length > 5, null, { timeout: 90000 });
  /* the trend/momentum read lands after /geiger; wait until the cells are painted (… = still pending) */
  await page.waitForFunction(() => [...document.querySelectorAll(".sc-board__row .gwx-tm")].some((c) => /[+−-]\d/.test(c.textContent)), null, { timeout: 60000 }).catch(() => result.errors.push("trend/momentum never painted"));
  await sleep(2500);
  const geo = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll(".sc-board__row")].slice(0, 6);
    const r0 = rows[0], cells = r0 ? [...r0.children].filter((c) => getComputedStyle(c).display !== "none") : [];
    const hdr = document.querySelector(".ch.hdr");
    return { rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height * 10) / 10),
      drawnCells: cells.length, drawnHeader: hdr ? [...hdr.children].filter((c) => getComputedStyle(c).display !== "none").map((c) => c.textContent.trim()) : [],
      geigerCellW: r0 && r0.querySelector(".sc-gcell") ? Math.round(r0.querySelector(".sc-gcell").getBoundingClientRect().width)
        : r0 && r0.querySelector(".sc-gmini") ? Math.round(r0.querySelector(".sc-gmini").getBoundingClientRect().width) : null,
      boardW: r0 ? Math.round(r0.getBoundingClientRect().width) : null, secfs: document.body.classList.contains("secfs"),
      v2: document.body.classList.contains("brd-v2") };
  });
  result.steps.normal = await geo();
  await shot("1-normal");
  if (file === "LIVE" && !process.env.HDR) { await browser.close(); fs.writeFileSync(OUT + "/" + TAG + "-" + width + ".json", JSON.stringify(result, null, 1)); process.exit(0); }

  if (file !== "LIVE") {
  /* 2 · THE BREAKDOWN — click the Geiger bar of the 3rd row that has trend and momentum; the row must not move */
  const pick = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".sc-board__row")];
    const ok = rows.filter((r) => window.SCIN_TM_SHOWN && window.SCIN_TM_SHOWN[r.dataset.t] && window.SCIN_TM_SHOWN[r.dataset.t].mo != null && r.querySelector(".sc-gcell .sc-gmini i"));
    const r = ok[Math.min(2, ok.length - 1)]; if (!r) return null;
    r.scrollIntoView({ block: "center" });
    return r.dataset.t;
  });
  await sleep(400);
  const before = await page.evaluate((t) => { const r = document.querySelector('.sc-board__row[data-t="' + t + '"]').getBoundingClientRect(); return { top: r.top, h: r.height, sel: S.sec, left: LEFT_T || null }; }, pick);
  await page.click('.sc-board__row[data-t="' + pick + '"] .sc-gcell');
  await sleep(500);
  result.steps.overlay = await page.evaluate(([t, b]) => {
    const p = document.getElementById("gPop"), row = document.querySelector('.sc-board__row[data-t="' + t + '"]'), rr = row.getBoundingClientRect();
    const pr = p && !p.hidden ? p.getBoundingClientRect() : null, gc = row.querySelector(".sc-gcell").getBoundingClientRect();
    return { ticker: t, open: !!pr, text: p ? p.innerText.replace(/\s+/g, " ").trim() : "", shown: window.SCIN_TM_SHOWN[t], rowG: (S.rows.find((x) => x.t === t) || {}).g,
      rowMovedPx: Math.round((rr.top - b.top) * 10) / 10, rowHeightBefore: b.h, rowHeightAfter: rr.height,
      companyOpened: (LEFT_T || null) !== b.left && S.sec === "COMPANY", ariaExpanded: row.querySelector(".sc-gcell").getAttribute("aria-expanded"),
      popRect: pr && { left: Math.round(pr.left), top: Math.round(pr.top), w: Math.round(pr.width), h: Math.round(pr.height) },
      barRect: { left: Math.round(gc.left), top: Math.round(gc.top), bottom: Math.round(gc.bottom), w: Math.round(gc.width) },
      insideViewport: pr ? pr.left >= 0 && pr.right <= innerWidth && pr.top >= 0 && pr.bottom <= innerHeight : null, overlays: document.querySelectorAll(".sc-gpop").length };
  }, [pick, before]);
  await shot("2-overlay");
  /* Esc closes it; the keyboard opens it again (Tab focus + Enter); a click away closes it; another bar moves it */
  await page.keyboard.press("Escape"); await sleep(200);
  const afterEsc = await page.evaluate(() => ({ open: !document.getElementById("gPop").hidden, focusIsBar: document.activeElement && document.activeElement.classList.contains("sc-gcell"), secfs: document.body.classList.contains("secfs"), sec: S.sec }));
  await page.focus('.sc-board__row[data-t="' + pick + '"] .sc-gcell'); await page.keyboard.press("Enter"); await sleep(250);
  const afterEnter = await page.evaluate(() => ({ open: !document.getElementById("gPop").hidden, sec: S.sec }));
  const second = await page.evaluate((t) => { const rows = [...document.querySelectorAll(".sc-board__row")]; const i = rows.findIndex((r) => r.dataset.t === t); const r = rows[i - 2]; return r && r.dataset.t; }, pick);   // a row ABOVE: the open overlay sits under its own bar
  await page.click('.sc-board__row[data-t="' + second + '"] .sc-gcell'); await sleep(250);
  const moved = await page.evaluate(() => ({ count: document.querySelectorAll(".sc-gpop:not([hidden])").length, ticker: (document.querySelector("#gPop .gp-h b") || {}).textContent }));
  await page.mouse.click(Math.round(width * 0.5), 20); await sleep(250);
  const afterAway = await page.evaluate(() => ({ open: !document.getElementById("gPop").hidden }));
  result.steps.overlayClose = { afterEsc, afterEnter, moved, afterAway, secondTicker: second };

  /* 3 · FULL SCREEN — ⛶ on the board, then re-rank by TREND (pointer) and MOMENTUM (keyboard) */
  await page.evaluate(() => { const b = document.querySelector('#boardPanel [data-act="secfs"]') || [...document.querySelectorAll('[data-act="secfs"]')].find((x) => x.closest(".sc-board, #boardPanel")); b && b.click(); });
  await sleep(900);
  result.steps.fullscreen = await geo();
  await shot("3-fullscreen");
  const order = () => page.evaluate(() => [...document.querySelectorAll(".sc-board__row")].slice(0, 12).map((r) => {
    const v = window.SCIN_TM_SHOWN[r.dataset.t]; return { t: r.dataset.t, tr: v ? v.tr : null, mo: v ? v.mo : null,
      cells: [...r.querySelectorAll(".gwx-tm .gwx-tmn")].map((c) => c.textContent), read: (r.querySelector(".gwx-read") || {}).textContent }; }));
  await page.click('.ch.hdr [data-key="tr"]'); await sleep(700);
  const byTrend = await order();
  const hdrT = await page.evaluate(() => document.querySelector('.ch.hdr [data-key="tr"]').textContent);
  await shot("4-fs-sorted-trend");
  await page.focus('.ch.hdr [data-key="mo"]'); await page.keyboard.press("Enter"); await sleep(700);
  const byMom = await order();
  const hdrM = await page.evaluate(() => document.querySelector('.ch.hdr [data-key="mo"]').textContent);
  await shot("5-fs-sorted-momentum");
  const desc = (a, k) => a.every((x, i) => i === 0 || x[k] == null || a[i - 1][k] == null || a[i - 1][k] >= x[k]);
  result.steps.sort = { trendHeader: hdrT, trendDescending: desc(byTrend, "tr"), byTrend: byTrend.slice(0, 8),
    momentumHeader: hdrM, momentumDescending: desc(byMom, "mo"), byMomentum: byMom.slice(0, 8), keyboard: "Momentum re-rank done with focus + Enter" };
  /* the breakdown in full screen too */
  await page.evaluate(() => { const g = document.querySelectorAll(".sc-board__row .sc-gcell")[1]; g && g.click(); });
  await sleep(400);
  result.steps.fsOverlay = await page.evaluate(() => ({ open: !document.getElementById("gPop").hidden, secfs: document.body.classList.contains("secfs") }));
  await shot("6-fs-overlay");
  await page.keyboard.press("Escape"); await sleep(200);
  result.steps.fsAfterEsc = await page.evaluate(() => ({ overlayOpen: !document.getElementById("gPop").hidden, stillFullScreen: document.body.classList.contains("secfs") }));
  await page.keyboard.press("Escape"); await sleep(400);
  /* sort back to the Geiger so the next shots read like the normal board */
  await page.evaluate(() => { S.sort = { key: "g", dir: 1 }; sortBoardBy("g"); });
  await sleep(400);

  }
  /* 4 · THE HEADER TICKER — pin an up name and a down name (by today's change on the board) */
  const names = await page.evaluate(() => { const rows = (S.rows || []).filter((r) => r.c != null && r.price != null);
    const up = rows.slice().sort((a, b) => b.c - a.c)[Math.min(3, rows.length - 1)], dn = rows.slice().sort((a, b) => a.c - b.c)[Math.min(3, rows.length - 1)];
    return { up: up && up.t, dn: dn && dn.t }; });
  result.steps.header = {};
  for (const k of ["up", "dn"]) {
    const t = names[k];
    await page.evaluate((x) => { const r = document.querySelector('.sc-board__row[data-t="' + x + '"]'); if (r) { r.scrollIntoView({ block: "center" }); r.click(); } else openCo(x); }, t);
    await sleep(3500);
    result.steps.header[k] = await page.evaluate((x) => { const c = document.getElementById("coChg"), p = document.getElementById("coPx"), h = document.getElementById("headIdent");
      const cs = c && getComputedStyle(c), hr = h && h.getBoundingClientRect(), cr = c && c.getBoundingClientRect();
      return { ticker: x, boardChange: (S.rows.find((r) => r.t === x) || {}).c, text: c && c.textContent, color: cs && cs.color, cls: c && c.className,
        price: p && p.textContent, priceColor: p && getComputedStyle(p).color, inHeader: !!(c && c.closest("#headIdent")),
        changeVisible: !!(cr && cr.width > 0 && hr && cr.right <= hr.right + 1 && cr.right <= innerWidth), changeRect: cr && { l: Math.round(cr.left), r: Math.round(cr.right), w: Math.round(cr.width) } }; }, t);
    /* the tick "scintillate" flash (≈0.5 s, the tick's own direction) is not the resting colour: sample over 3 s, then shoot
       at a moment with no flash running on the price or the change */
    result.steps.header[k].samples = [];
    for (let i = 0; i < 6; i++) {
      result.steps.header[k].samples.push(await page.evaluate(() => { const c = document.getElementById("coChg"), p = document.getElementById("coPx");
        const flashing = document.getAnimations().filter((a) => a.playState === "running" && (a.effect && (a.effect.target === c || a.effect.target === p))).length;
        return { text: c && c.textContent, color: c && getComputedStyle(c).color, flashing }; }));
      await sleep(500);
    }
    await page.waitForFunction(() => { const c = document.getElementById("coChg"), p = document.getElementById("coPx");
      return !document.getAnimations().some((a) => a.playState === "running" && a.effect && (a.effect.target === c || a.effect.target === p)); }, null, { timeout: 8000, polling: 50 }).catch(() => {});
    await page.evaluate(() => { window.scrollTo(0, 0); document.scrollingElement && (document.scrollingElement.scrollTop = 0); });
    await sleep(300);
    await shot("7-header-" + k, { x: 0, y: 0, width, height: phone ? 120 : 90 });
    await shot("8-page-" + k);
  }
} catch (e) { result.errors.push("harness: " + String(e).slice(0, 300)); }
finally { await browser.close(); }
fs.writeFileSync(OUT + "/" + TAG + "-" + width + ".json", JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1).slice(0, 6000));
