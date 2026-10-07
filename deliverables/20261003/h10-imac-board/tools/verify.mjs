/* H10 (3 Oct) — the iMac board, measured. Headless only (Alan, 24 Sep: never a visible window).
   The Hub is served from this branch under its real hostname (the chart API only answers that origin); every non-GET
   request is answered locally and counted, never sent; the page's own GET reads go through (read-only).
     node perf.mjs [label]                 label names the output file (default "after")
   env: INDEX_FILE=<path>  serve that file as /index.html (the "before" run serves the live line's index.html)
        CPU=6              CPU throttling rate (Chrome DevTools' "6x slowdown")
        W=2240 H=1260      the iMac's screen in CSS pixels (24" iMac, 4480 × 2520 at device scale 2)
        DSF=2              device scale factor
        COHORTS=ALL,RADAR
   What it does, per cohort: open the DASHBOARD on that cohort, wait for the live rows, then
     (a) SCROLL   — 4 s of mouse-wheel scrolling over the board;
     (b) REFRESH  — three board refreshes that each change the order (every row's Geiger nudged by a seeded ±0.04, the
                    same path a /geiger pull takes: mergeBoardRows → sync), pointer OFF the board, 2.5 s after each;
     (c) SCROLL+REFRESH — the same three refreshes fired while the wheel is turning, pointer ON the board.
   For each: frames (requestAnimationFrame gaps), long tasks (> 50 ms), Chrome's own style/layout/script time, whether
   the row under the pointer changed, and the scroll position drift. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const label = process.argv[2] || "verify";
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = process.env.HUB_ROOT || path.resolve(here, "../../../..");
const INDEX_FILE = process.env.INDEX_FILE || null;
const CPU = Number(process.env.CPU || 6);
const W = Number(process.env.W || 2240), H = Number(process.env.H || 1260), DSF = Number(process.env.DSF || 2);
const COHORTS = (process.env.COHORTS || "ALL,RADAR").split(",");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function localFile(root, pathname) {
  if (INDEX_FILE && (pathname === "/" || pathname === "/index.html")) return INDEX_FILE;
  let f = path.normalize(path.join(root, decodeURIComponent(pathname)));
  if (!f.startsWith(root)) return null;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, serviceWorkers: "block" });
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
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
const RECORDER_SRC = 1;
/* the recorder: frame gaps and long tasks between start() and stop() */
const RECORDER = () => {
  if (window.__h10) return;
  const R = window.__h10 = { on: false, frames: [], long: [] };
  let last = 0;
  const loop = (t) => { if (R.on && last) R.frames.push(t - last); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver((l) => { if (R.on) for (const e of l.getEntries()) R.long.push(e.duration); }).observe({ entryTypes: ["longtask"] }); } catch (_) {}
  R.start = () => { R.frames = []; R.long = []; R.on = true; };
  R.stop = () => { R.on = false; return { frames: R.frames.slice(), long: R.long.slice() }; };
  /* one refresh that changes the order: every row's Geiger nudged by a seeded ±amp, through the feed's own merge + sync */
  R.refresh = (seed, amp) => {
    let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const before = (S.boardOrder || []).slice();
    /* about one name in twelve moves (a weekend: crypto and futures trade, equities do not) */
    const fresh = (S.rows || []).map((r) => { const hit = rnd() < 0.08, d = (rnd() * 2 - 1) * amp;
      return Object.assign({}, r, { g: r.g == null || !hit ? r.g : Math.max(-1, Math.min(1, r.g + d)) }); });
    const t0 = performance.now();
    mergeBoardRows(fresh, false); sync();
    const ms = performance.now() - t0;
    const after = (S.boardOrder || []).slice();
    let moved = 0; for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) moved++;
    return { ms, moved, n: after.length };
  };
  R.underPointer = (x, y) => { const e = document.elementFromPoint(x, y); const r = e && e.closest && e.closest(".sc-board__row"); return r ? r.getAttribute("data-t") : null; };
};

const out = { label, errors, writes };
const ev = (f, a) => page.evaluate(f, a);
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 90000 }).catch(() => {});
  await sleep(3000);
  await page.evaluate(RECORDER);
  await ev(() => document.querySelector('[data-act="coh"][data-key="ALL"]').click());
  await page.waitForFunction(() => document.querySelectorAll("#boardScroll .sc-board__row").length > 300 && !S.boardPending, null, { timeout: 60000 });
  await sleep(4000);
  const state = () => ev(() => { const bs = document.getElementById("boardScroll"); const rows = [...bs.children].filter((k) => k.classList.contains("sc-board__row"));
    const dom = rows.map((r) => r.getAttribute("data-t")); const model = orderedShownRows().map((r) => r.t);
    return { n: rows.length, win: bs.classList.contains("is-win"), inLayout: rows.filter((r) => getComputedStyle(r).display !== "none").length,
      rowH: bs.__rowH, scrollH: bs.scrollHeight, clientH: bs.clientHeight, scrollTop: bs.scrollTop, domEqModel: dom.join() === model.join(), ghosts: bs.querySelectorAll(".sc-board__ghost").length,
      held: BOARD_UI.held, slides: BOARD_UI.slides }; });
  out.s0 = await state();
  /* the board's full height with windowing off, for comparison */
  out.fullH = await ev(() => { const bs = document.getElementById("boardScroll"); bs.classList.remove("is-win"); const h = bs.scrollHeight; boardWindow(bs, true); return h; });
  /* scroll to the bottom and the middle: the rows that should be on screen are */
  out.bottom = await ev(async () => { const bs = document.getElementById("boardScroll"); bs.scrollTop = bs.scrollHeight; await new Promise((r) => setTimeout(r, 300));
    const b = bs.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width * 0.4, b.bottom - 20); const r = e && e.closest(".sc-board__row");
    const rows = [...bs.children].filter((k) => k.classList.contains("sc-board__row")); return { last: rows[rows.length - 1].getAttribute("data-t"), atBottom: r && r.getAttribute("data-t"), scrollTop: bs.scrollTop }; });
  out.middle = await ev(async () => { const bs = document.getElementById("boardScroll"); const res = [];
    for (const st of [0, 3000, 7000, 12000, 1e7]) { bs.scrollTop = st; await new Promise((r) => setTimeout(r, 250));
      const z = boardZoom(bs), box = bs.getBoundingClientRect(), H = bs.__rowH, start = bs.__start;
      const rows = [...bs.children].filter((k) => k.classList.contains("sc-board__row")); let maxErr = 0, shown = 0, onScreen = 0;
      rows.forEach((r, i) => { if (getComputedStyle(r).display === "none") return; shown++; const t = r.getBoundingClientRect().top, want = box.top + (start - bs.scrollTop + i * H) * z; maxErr = Math.max(maxErr, Math.abs(t - want)); if (t < box.bottom && t > box.top - H * z) onScreen++; });
      /* every on-screen slot is filled by a displayed row: hit-test 6 points */
      let holes = 0; for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) { const e = document.elementFromPoint(box.left + box.width * 0.3, box.top + box.height * f); if (!(e && e.closest(".sc-board__row"))) holes++; }
      res.push({ st: Math.round(bs.scrollTop), shown, onScreen, maxErrPx: +maxErr.toFixed(2), holes }); }
    return res; });
  /* three refreshes with the pointer away: order follows the model, and every row reads exactly as a full rebuild would */
  await page.mouse.move(5, H - 5);
  out.refresh = [];
  for (let k = 0; k < 3; k++) { out.refresh.push(await ev((s) => __h10.refresh(s, 0.12), 5000 + k)); await sleep(2200); }
  out.s1 = await state();
  out.sameAsRebuild = await ev(async () => { const bs = document.getElementById("boardScroll"); const txt = () => [...bs.children].filter((k) => k.classList.contains("sc-board__row")).map((r) => r.getAttribute("data-t") + "|" + [...r.children].filter((c) => !c.classList.contains("gwx-rk")).map((c) => c.textContent.trim()).join("|") + "|" + [...r.attributes].filter((a) => /^data-sc-(price|chg-pct|prev-close|geiger)$/.test(a.name)).map((a) => a.name + "=" + a.value).join(","));
    const a = txt(); boardRender(bs); boardWindow(bs, true); await new Promise((r) => setTimeout(r, 400)); const b = txt(); let diff = 0, first = null; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { diff++; if (!first) first = [a[i], b[i]]; } return { rows: a.length, diff, first }; }).catch((e) => ({ err: String(e.message) }));
  /* hold: refresh while the wheel turns over the board — the order waits, then lands after the reader stops */
  const bb = await ev(() => { const b = document.getElementById("boardScroll").getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await ev(() => { document.getElementById("boardScroll").scrollTop = 0; }); await sleep(400);
  await page.mouse.move(bb.x + bb.w * 0.4, bb.y + 200);
  const wheelP = (async () => { for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, i % 8 < 4 ? 60 : -60); await sleep(60); } })();
  await sleep(300);
  out.holdCall = await ev(() => __h10.refresh(7777, 0.3));
  await sleep(200);
  out.duringScroll = await state();
  await wheelP;
  await page.mouse.move(5, H - 5);
  await sleep(2200);
  out.afterStop = await state();
  /* the slide is a slide: rows on screen carry a transform for a moment after a re-sort */
  await ev(() => { document.getElementById("boardScroll").scrollTop = 0; }); await sleep(300);
  out.sliding = await ev(async () => { __h10.refresh(9191, 0.4); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const bs = document.getElementById("boardScroll"); return { sliding: bs.querySelectorAll(".sc-board__row.is-sliding").length, ghosts: bs.querySelectorAll(".sc-board__ghost").length,
      sample: [...bs.querySelectorAll(".sc-board__row.is-sliding")].slice(0, 3).map((r) => getComputedStyle(r).transform) }; });
  await sleep(1000);
  out.s2 = await state();
  out.rewind = await ev(() => ({ hasBar: !!document.getElementById("gwxBar"), play: !!document.getElementById("gwxPlay") }));
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 400); }
fs.writeFileSync(path.join(here, "verify-" + label + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify(out, null, 1));
