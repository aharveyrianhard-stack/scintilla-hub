/* RV1 — headless reproduction of the cohort board's RVol sort (no visible window). node rv1-harness.mjs job.json
   target "live": https://scintillahub.ai as deployed. target "local": scintillahub.ai/* served from job.hubRoot (the worktree),
   /api/* and every other host go to the network. Every non-GET request is answered locally with an empty 201 and recorded,
   so the page can never write to the database from here.
   Instrumentation (read-only): computeBoardOrder and mergeBoardRows are wrapped to log WHEN the board order is recomputed,
   with WHICH sort key and from WHERE (stack), and a MutationObserver counts row moves in #boardScroll between reads. */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
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
/* in the page: the board as drawn, top to bottom, with the number beside the battery and the row's own values */
const READ = (n) => {
  const bs = document.getElementById("boardScroll");
  if (!bs) return { noBoard: true };
  const byT = {}; for (const r of (S.rows || [])) byT[r.t] = r;
  const rows = [...bs.querySelectorAll(".sc-board__row")].map((el) => {
    const t = el.getAttribute("data-t"), txt = (el.querySelector(".sc-vol__n") || {}).textContent || "";
    const shown = parseFloat(txt), r = byT[t] || {};
    return { t, shown: txt, num: isFinite(shown) ? shown : null, rv: r.rv == null ? null : r.rv, rvS: r.rvS == null ? null : r.rvS, g: r.g == null ? null : +(+r.g).toFixed(3) };
  });
  const hdr = bs.querySelector(".ch.hdr .is-sorted");
  /* monotone in the SHOWN number, nulls last, for the direction the header claims */
  const dir = S.sort && S.sort.dir;
  let breaks = [], seenNull = false, prev = null;
  rows.forEach((r, i) => {
    if (r.num == null) { seenNull = true; return; }
    if (seenNull) breaks.push({ at: i, t: r.t, why: "number after a dash" });
    if (prev != null && (dir < 0 ? r.num > prev.num + 1e-9 : r.num < prev.num - 1e-9)) breaks.push({ at: i, t: r.t, num: r.num, after: prev.t, afterNum: prev.num });
    prev = r;
  });
  /* the same rule, counted plainly: neighbouring printed numbers that step the wrong way (dashes skipped), and numbers printed
     below a dash. A board ranked by RVol has 0 and 0. */
  const nums = rows.filter((r) => r.num != null).map((r) => r.num);
  let wrongSteps = 0; for (let i = 1; i < nums.length; i++) if (dir < 0 ? nums[i] > nums[i - 1] + 1e-9 : nums[i] < nums[i - 1] - 1e-9) wrongSteps++;
  const firstDashAt = rows.findIndex((r) => r.num == null);
  const numbersBelowDash = firstDashAt < 0 ? 0 : rows.slice(firstDashAt).filter((r) => r.num != null).length;
  const order = S.boardOrder || [];
  const domOrder = rows.map((r) => r.t);
  return {
    at: new Date().toISOString(), coh: S.coh, sortKey: S.sort && S.sort.key, sortDir: dir, header: hdr ? hdr.textContent : null,
    rankReady: !!window.SC_RANK_READY, seedAt: S.boardSeedAt == null ? null : S.boardSeedAt, rows: rows.length,
    withShownNumber: rows.filter((r) => r.num != null).length, withRv: rows.filter((r) => r.rv != null).length,
    domMatchesBoardOrder: domOrder.join(",") === order.filter((t) => domOrder.includes(t)).join(","),
    breaks: breaks.length, firstBreaks: breaks.slice(0, 6), top: rows.slice(0, n || 15),
    wrongSteps, numberedRows: nums.length, firstDashAt, numbersBelowDash, shownSeq: rows.map((r) => r.num),
    pulls: (window.__RV1 && window.__RV1.pulls) || 0, orders: ((window.__RV1 && window.__RV1.orders) || []).slice(-6),
    moves: (window.__RV1 && window.__RV1.moves) || 0, rewindOn: document.body.classList.contains("gwx-on")
  };
};
const INSTRUMENT = () => {
  if (window.__RV1) return true;
  if (typeof computeBoardOrder !== "function" || typeof mergeBoardRows !== "function") return false;
  const R = window.__RV1 = { pulls: 0, orders: [], moves: 0 };
  const cbo = computeBoardOrder, mbr = mergeBoardRows;
  window.computeBoardOrder = function () {
    const out = cbo.apply(this, arguments);
    const st = (new Error().stack || "").split("\n").slice(2, 6).map((s) => s.trim().replace(/^at /, "").replace(/\(https?:\/\/[^)]*?(:\d+:\d+)\)/, "$1")).join(" < ");
    R.orders.push({ at: new Date().toISOString().slice(11, 23), key: S.sort && S.sort.key, dir: S.sort && S.sort.dir, rankReady: !!window.SC_RANK_READY, top5: out.slice(0, 5), from: st });
    if (R.orders.length > 400) R.orders.shift();
    return out;
  };
  window.mergeBoardRows = function (fresh, replace) {
    R.pulls++; R.lastPull = new Date().toISOString();
    return mbr.apply(this, arguments);
  };
  const watch = () => {
    const bs = document.getElementById("boardScroll");
    if (!bs || bs.__rv1) return;
    bs.__rv1 = true;
    new MutationObserver((ms) => { for (const m of ms) R.moves += m.addedNodes.length; }).observe(bs, { childList: true });
  };
  watch(); setInterval(watch, 500);
  return true;
};
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const out = { job: job.name, target: job.target, started: new Date().toISOString(), results: [], writes: [], errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: job.width || 1680, height: job.height || 1050 }, deviceScaleFactor: 1, serviceWorkers: "block",
    timezoneId: "America/New_York" });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { out.writes.push(m + " " + u.host + u.pathname); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (job.target === "local" && u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(job.hubRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => out.errors.length < 30 && out.errors.push(String(e.message).slice(0, 220)));
  for (const s of job.steps) {
    const r = { step: s.do, ...(s.label ? { label: s.label } : {}) };
    const t0 = Date.now();
    try {
      if (s.do === "load") {
        await page.goto("https://scintillahub.ai" + (s.path || "/"), { waitUntil: "domcontentloaded", timeout: 90000 });
        r.domContentLoadedMs = Date.now() - t0;
        while (Date.now() - t0 < 30000 && !(await page.evaluate(INSTRUMENT))) await sleep(50);
        r.instrumented = await page.evaluate(() => !!window.__RV1);
      }
      else if (s.do === "ready") {   /* the board is live: rank-ready, no cached seed, and the volume read is on the rows */
        while (Date.now() - t0 < (s.ms || 90000)) {
          const ok = await page.evaluate(() => !!(window.SC_RANK_READY && S.boardSeedAt == null && (S.rows || []).length && (S.rows || []).some((r) => r.rv != null) && document.querySelector("#boardScroll .sc-board__row")));
          if (ok) break; await sleep(250);
        }
        r.waitedMs = Date.now() - t0;
      }
      else if (s.do === "wait") await sleep(s.ms);
      else if (s.do === "viewport") { await page.setViewportSize({ width: s.width, height: s.height }); await sleep(s.ms || 1500); }
      else if (s.do === "click") {   /* a real mouse click, as Alan's */
        const loc = page.locator(s.sel).first();
        await loc.scrollIntoViewIfNeeded({ timeout: 10000 });
        await loc.click({ timeout: 10000 });
        r.sel = s.sel; await sleep(s.ms || 1200);
      }
      else if (s.do === "clickAt") {   /* a real mouse press at a fraction of an element's box (a range track Playwright will not "click") */
        const b = await page.locator(s.sel).first().boundingBox();
        if (!b) throw new Error("no box for " + s.sel);
        const x = b.x + b.width * (s.fx == null ? 0.5 : s.fx), y = b.y + b.height * (s.fy == null ? 0.5 : s.fy);
        await page.mouse.click(x, y); r.sel = s.sel; r.at = { x: Math.round(x), y: Math.round(y) }; await sleep(s.ms || 1200);
      }
      else if (s.do === "drag") {   /* a real drag along an element's box, from fraction fx0 to fx1 (the rewind thumb) */
        const b = await page.locator(s.sel).first().boundingBox();
        if (!b) throw new Error("no box for " + s.sel);
        const y = b.y + b.height / 2, x0 = b.x + b.width * s.fx0, x1 = b.x + b.width * s.fx1;
        await page.mouse.move(x0, y); await page.mouse.down();
        for (let i = 1; i <= 12; i++) { await page.mouse.move(x0 + (x1 - x0) * i / 12, y); await sleep(30); }
        await page.mouse.up(); r.from = Math.round(x0); r.to = Math.round(x1); await sleep(s.ms || 1500);
        r.asof = await page.evaluate(() => (document.getElementById("gwxDt") || {}).textContent || null);
      }
      else if (s.do === "key") { await page.keyboard.press(s.key); await sleep(s.ms || 1200); }
      else if (s.do === "read") r.value = await page.evaluate(READ, s.n || 15);
      else if (s.do === "watch") {   /* read every few seconds without touching anything */
        r.samples = [];
        while (Date.now() - t0 < s.ms) { await sleep(s.every || 5000); const v = await page.evaluate(READ, 15);
          r.samples.push({ at: v.at, pulls: v.pulls, moves: v.moves, sortKey: v.sortKey, sortDir: v.sortDir, breaks: v.breaks, wrongSteps: v.wrongSteps, numbersBelowDash: v.numbersBelowDash, top15: v.top.map((x) => x.t + " " + x.shown).join(" · ") }); }
        r.value = await page.evaluate(READ, s.n || 15);
      }
      else if (s.do === "align") {   /* what sits under the RVol label: the label's box vs the battery cells' boxes in the first rows */
        r.value = await page.evaluate(() => {
          const bs = document.getElementById("boardScroll"), h = bs && bs.querySelector('.ch.hdr .sc-hcell[data-key="rv"]');
          if (!h) return { noHeader: true };
          const box = (e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x0: Math.round(b.left), x1: Math.round(b.right), y: Math.round(b.top), w: Math.round(b.width), shown: cs.display !== "none" && cs.visibility !== "hidden" && b.width > 0 }; };
          const hb = box(h), rows = [...bs.querySelectorAll(".sc-board__row")].slice(0, 5);
          const cells = rows.map((row) => { const c = row.querySelector(".sc-vol"); if (!c) return { t: row.getAttribute("data-t"), none: true };
            const cb = box(c), mid = (cb.x0 + cb.x1) / 2, over = Math.max(0, Math.min(hb.x1, cb.x1) - Math.max(hb.x0, cb.x0));
            /* the header label straight above this cell's centre */
            const above = document.elementsFromPoint(mid, hb.y + 4).find((e) => e.classList && (e.classList.contains("sc-hcell") || (e.parentElement && e.parentElement.classList.contains("hdr"))));
            return { t: row.getAttribute("data-t"), cell: cb, overlapPx: Math.round(over), labelAbove: above ? above.textContent.trim() : null, n: (c.querySelector(".sc-vol__n") || {}).textContent || null }; });
          const hdrCells = [...bs.querySelectorAll(".ch.hdr > *")].map((e) => ({ label: e.textContent.trim(), shown: getComputedStyle(e).display !== "none" }));
          const rowCells = rows[0] ? [...rows[0].children].map((e) => ({ cls: e.className.split(" ")[0], shown: getComputedStyle(e).display !== "none" })) : [];
          return { vw: innerWidth, vh: innerHeight, bodyZoom: getComputedStyle(document.body).zoom, secfs: document.body.classList.contains("secfs"), motion: document.body.classList.contains("gwx-motion"),
            header: hb, cells, hdrShown: hdrCells.filter((c) => c.shown).map((c) => c.label || "·").join(" | "), rowShown: rowCells.filter((c) => c.shown).map((c) => c.cls).join(" | ") };
        });
      }
      else if (s.do === "eval") r.value = await page.evaluate(s.js);
      else if (s.do === "shot") { await page.screenshot({ path: s.file, type: "png", fullPage: false }); r.file = path.basename(s.file); }
    } catch (e) { r.err = String(e.message).slice(0, 300); }
    r.ms = Date.now() - t0;
    out.results.push(r);
    if (job.log) process.stderr.write(JSON.stringify({ step: r.step, label: r.label, ms: r.ms, err: r.err, sort: r.value && (r.value.sortKey + "/" + r.value.sortDir), breaks: r.value && r.value.breaks, wrongSteps: r.value && r.value.wrongSteps, numbersBelowDash: r.value && r.value.numbersBelowDash, pulls: r.value && r.value.pulls }) + "\n");
  }
} finally {
  out.ended = new Date().toISOString();
  await browser.close();
  fs.writeFileSync(job.out, JSON.stringify(out, null, 1));
}
