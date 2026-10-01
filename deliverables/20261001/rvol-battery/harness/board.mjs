// H5 RVOL battery harness — HEADLESS ONLY (never a visible window). usage: node board.mjs <index.html|LIVE> <width> <outdir> <tag>
// Same method as H4's harness: the Hub document at https://scintillahub.ai/ is answered with the local file under test (or
// the live page for LIVE), so the chart API sees its own origin. Every other request goes to the live services as the page
// sends it, and EVERY non-GET request is aborted: nothing here can write a like, a list, a setting or any table row.
// It opens the LIKED board (the default scope), measures the RVOL cell of every drawn row, shoots the board, zooms three
// rows, then does the same in full screen (⛶).
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
fs.mkdirSync(OUT, { recursive: true });
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
  await page.waitForFunction(() => typeof S !== "undefined" && S.coh === "FAV" && document.querySelectorAll(".sc-board__row[data-t]").length > 5 &&
    [...document.querySelectorAll(".sc-board__row")].filter((r) => r.getAttribute("data-sc-geiger") != null).length > 5, null, { timeout: 90000 });
  /* the RVOL readings come with the board pull (board_volume); wait until at least one row has one (or give up and say so) */
  await page.waitForFunction(() => (S.rows || []).some((r) => r.rv != null || r.rvS != null), null, { timeout: 60000 })
    .catch(() => result.errors.push("no row carried an RVOL reading within 60 s"));
  await sleep(2500);

  const measure = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll(".sc-board__row[data-t]")];
    const out = rows.map((r) => {
      const v = r.querySelector(".sc-vol"); if (!v) return { t: r.dataset.t, cell: null };
      const cs = getComputedStyle(v), rc = v.getBoundingClientRect();
      const dots = v.querySelector(".sc-vol__dots"), dr = dots && getComputedStyle(dots).display !== "none" ? dots.getBoundingClientRect() : null;
      /* the number is the text node(s) after the dots: measure it with a Range so its own width is known */
      const range = document.createRange(); let numW = 0, numTxt = "";
      for (const n of v.childNodes) if (n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains("sc-vol__dots"))) {
        range.selectNodeContents(n); const b = range.getBoundingClientRect(); numW += b.width; numTxt += n.textContent; }
      const gap = parseFloat(cs.columnGap || cs.gap) || 0;
      return { t: r.dataset.t, shown: cs.display !== "none" && rc.width > 0, cellW: Math.round(rc.width * 10) / 10,
        dotsW: dr ? Math.round(dr.width * 10) / 10 : 0, dotsH: dr ? Math.round(dr.height * 10) / 10 : 0, lit: v.querySelectorAll(".sc-vol__dots i.on").length,
        numW: Math.round(numW * 10) / 10, num: numTxt.trim(), gap, stacked: cs.flexDirection === "column",
        /* side by side: battery + gap + number; stacked (the phone): the wider of the two */
        need: Math.round((cs.flexDirection === "column" ? Math.max(dr ? dr.width : 0, numW) : (dr ? dr.width : 0) + (dr && numW ? gap : 0) + numW) * 10) / 10,
        cellH: Math.round(rc.height * 10) / 10, rowH: Math.round(r.getBoundingClientRect().height * 10) / 10,
        clipped: v.scrollWidth > v.clientWidth + 0.5 || (dr && (dr.right > rc.right + 0.5 || dr.left < rc.left - 0.5)),
        fontPx: parseFloat(cs.fontSize), title: v.getAttribute("title") || "",
        row: (S.rows.find((x) => x.t === r.dataset.t) || {}) };
    }).map((m) => { const row = m.row; delete m.row; return Object.assign(m, { rvAt: row.rv != null ? row.rv : null, rvS: row.rvS != null ? row.rvS : null, rvAsOf: row.rvAsOf || null }); });
    const hdr = document.querySelector(".ch.hdr");
    const note = document.querySelector(".sc-cohgeiger__n");
    return { secfs: document.body.classList.contains("secfs"), rows: out.length,
      drawnHeader: hdr ? [...hdr.children].filter((c) => getComputedStyle(c).display !== "none").map((c) => c.textContent.trim()) : [],
      shownCells: out.filter((m) => m.shown).length, cutCells: out.filter((m) => m.shown && (m.clipped || m.cellW + 0.5 < m.need)).map((m) => m.t),
      withReading: out.filter((m) => m.rvAt != null || m.rvS != null).length,
      summary: note ? note.innerText.replace(/\s+/g, " ").trim() : null, summaryTitle: note && note.querySelector(".sc-rvnote") ? note.querySelector(".sc-rvnote").getAttribute("title") : null,
      geigerW: (() => { const g = document.querySelector(".sc-board__row .sc-gcell, .sc-board__row .sc-gmini"); return g ? Math.round(g.getBoundingClientRect().width) : null; })(),
      tickerW: (() => { const g = document.querySelector(".sc-board__row .sc-ctk"); return g ? Math.round(g.getBoundingClientRect().width) : null; })(),
      cells: out,
      /* every OTHER drawn cell too (header labels and the first 12 rows): what this change could have squeezed */
      otherCuts: (() => { const bad = [];
        const cut = (el) => el.scrollWidth > el.clientWidth + 0.5;
        if (hdr) [...hdr.children].forEach((c, i) => { if (getComputedStyle(c).display !== "none" && cut(c)) bad.push("header " + (i + 1) + " '" + c.textContent.trim() + "' " + c.scrollWidth + ">" + c.clientWidth); });
        rows.slice(0, 12).forEach((r) => [...r.children].forEach((c, i) => { if (getComputedStyle(c).display !== "none" && !c.classList.contains("sc-gcell") && cut(c)) bad.push(r.dataset.t + " cell " + (i + 1) + " '" + c.textContent.trim() + "'"); }));
        return bad; })(),
      colW: (() => { const r0 = rows[0]; return r0 ? [...r0.children].filter((c) => getComputedStyle(c).display !== "none").map((c) => Math.round(c.getBoundingClientRect().width)) : []; })() };
  });
  /* zoom: three rows that carry a reading, at 3× device pixels (layout unchanged — only the pixel density) */
  const zoom = async (name) => {
    const box = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".sc-board__row[data-t]")].filter((r) => { const x = (S.rows.find((y) => y.t === r.dataset.t) || {}); return x.rv != null || x.rvS != null; });
      const pick = rows.slice(0, 3); if (!pick.length) return null;
      pick[0].scrollIntoView({ block: "center" });
      const a = pick[0].getBoundingClientRect(), b = pick[pick.length - 1].getBoundingClientRect(), hdr = document.querySelector(".ch.hdr").getBoundingClientRect();
      return { x: Math.max(0, Math.floor(a.left)), y: Math.max(0, Math.floor(a.top)), width: Math.ceil(a.width), height: Math.ceil(b.bottom - a.top), tickers: pick.map((r) => r.dataset.t) };
    });
    if (!box) return null;
    await sleep(200);
    const box2 = await page.evaluate((ts) => { const a = document.querySelector('.sc-board__row[data-t="' + ts[0] + '"]').getBoundingClientRect(), b = document.querySelector('.sc-board__row[data-t="' + ts[ts.length - 1] + '"]').getBoundingClientRect();
      return { x: Math.max(0, Math.floor(a.left)), y: Math.max(0, Math.floor(a.top)), width: Math.ceil(a.width), height: Math.ceil(b.bottom - a.top) }; }, box.tickers);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: H, deviceScaleFactor: 3, mobile: phone });
    await sleep(300);
    await shot(name, box2);
    /* the same three rows, only from the Geiger's right edge to the row's end: the batteries large */
    const tight = await page.evaluate((ts) => { const a = document.querySelector('.sc-board__row[data-t="' + ts[0] + '"]'), b = document.querySelector('.sc-board__row[data-t="' + ts[ts.length - 1] + '"]');
      const v = a.querySelector(".sc-vol").getBoundingClientRect(), ra = a.getBoundingClientRect(), rb_ = b.getBoundingClientRect(), g = a.querySelector(".sc-gcell") || a.querySelector(".sc-vol");
      const x = Math.max(0, Math.floor(Math.min(g.getBoundingClientRect().left, v.left) - 4));
      return { x, y: Math.max(0, Math.floor(ra.top)), width: Math.ceil(ra.right - x), height: Math.ceil(rb_.bottom - ra.top) }; }, box.tickers);
    await shot(name + "-rvol", tight);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: H, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    await sleep(200);
    return box.tickers;
  };

  await page.evaluate(() => { const s = document.getElementById("boardScroll"); s && s.scrollTo(0, 0); window.scrollTo(0, 0); });
  result.steps.normal = await measure();
  await shot("1-normal");
  result.steps.normalZoomRows = await zoom("2-normal-zoom");

  /* STALE, SIMULATED: the live LIKED rows are current, so the second zoomed row's cell is re-drawn by the page's own
     volCellHTML exactly as a 6 Jul row arrives (rv and rvS null, the row's date kept for the tooltip). Nothing is written. */
  if (file !== "LIVE") {
    result.steps.staleDemo = await page.evaluate((ts) => { const t = ts && ts[1]; const row = t && document.querySelector('.sc-board__row[data-t="' + t + '"]'); if (!row) return null;
      const old = row.querySelector(".sc-vol"); const tmp = document.createElement("div"); tmp.innerHTML = volCellHTML(null, null, "2026-07-06T18:03:29Z");
      old.replaceWith(tmp.firstChild); const v = row.querySelector(".sc-vol");
      return { ticker: t, html: v.outerHTML, lit: v.querySelectorAll(".sc-vol__dots i.on").length, dots: v.querySelectorAll(".sc-vol__dots i").length, text: v.textContent, title: v.getAttribute("title") }; }, result.steps.normalZoomRows);
    await zoom("5-stale-simulated");
    await page.evaluate(() => { S.boardOrder = computeBoardOrder(); updateBoard(); });   /* the board's own repaint puts the real cell back */
    await sleep(600);
  }

  if (file !== "LIVE" || process.env.FS) {
    const fsClick = () => page.evaluate(() => { const b = document.querySelector('#boardPanel [data-act="secfs"]') || [...document.querySelectorAll('[data-act="secfs"]')].find((x) => x.closest(".sc-board, #boardPanel")); b && b.click(); });
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
      await fsClick(); await sleep(1200);
      if (await page.evaluate(() => document.body.classList.contains("secfs"))) break;
      result.errors.push("full screen did not open on try " + (i + 1));
    }
    await page.evaluate(() => { const s = document.getElementById("boardScroll"); s && s.scrollTo(0, 0); });
    result.steps.fullscreen = await measure();
    await shot("3-fullscreen");
    result.steps.fsZoomRows = await zoom("4-fullscreen-zoom");
    await page.keyboard.press("Escape"); await sleep(300);
  }
} catch (e) { result.errors.push("harness: " + String(e).slice(0, 300)); }
finally { await browser.close(); }
fs.writeFileSync(OUT + "/" + TAG + "-" + width + ".json", JSON.stringify(result, null, 1));
const brief = (s) => s && { otherCuts: s.otherCuts, colW: s.colW.join(" "), secfs: s.secfs, rows: s.rows, shownCells: s.shownCells, cutCells: s.cutCells, withReading: s.withReading, header: s.drawnHeader.join("|"),
  summary: s.summary, geigerW: s.geigerW, tickerW: s.tickerW, sample: s.cells.slice(0, 4).map((c) => [c.t, c.cellW, c.dotsW, c.numW, c.need, c.lit, c.num, c.fontPx, c.rvAt, c.rvS]) };
console.log(JSON.stringify({ tag: TAG, width, errors: result.errors, blocked: result.blocked.length, normal: brief(result.steps.normal), fullscreen: brief(result.steps.fullscreen) }, null, 1));
