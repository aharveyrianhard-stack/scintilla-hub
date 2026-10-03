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
const label = process.argv[2] || "after";
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
const SIZES = (process.env.SIZES || "1280x690,1440x810,1680x1050,1920x1080,2240x1260,2560x1440").split(",").map((x) => x.split("x").map(Number));
const T = process.env.TICKER || "NVDA";
const shots = path.join(here, "..", "screens"); fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--hide-scrollbars", "--mute-audio"] });
/* the clip detector — runs in the page (inside #leftPanel and the header tab row) and in every frame of the company view */
const DETECT = (rootSel) => {
  const root = rootSel ? document.querySelector(rootSel) : document.body; if (!root) return { err: "no root " + rootSel };
  const out = []; const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const name = (e) => (e.id ? "#" + e.id : "") + (e.getAttribute && e.getAttribute("class") ? "." + String(e.getAttribute("class")).trim().split(/\s+/).slice(0, 2).join(".") : "") || e.tagName.toLowerCase();
  const path = (e) => { const p = []; for (let x = e; x && x !== root && p.length < 4; x = x.parentElement) p.unshift(x.tagName.toLowerCase() + (x.id ? "#" + x.id : "") + (x.getAttribute("class") ? "." + String(x.getAttribute("class")).trim().split(/\s+/)[0] : "")); return p.join(">"); };
  const txt = (e) => (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  for (const e of root.querySelectorAll("*")) {
    const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (e.closest("[aria-hidden='true']") && !e.closest("svg")) continue;
    const isSvgKid = e instanceof SVGElement && e.tagName.toLowerCase() !== "svg";
    /* 1 · its own content is cut: overflow hidden/clip and more content than box (text cut by ellipsis included) */
    if (!isSvgKid && /(hidden|clip)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && (e.textContent || "").trim())
      out.push({ kind: "own-content-cut", el: name(e), path: path(e), by: e.scrollWidth - e.clientWidth, text: txt(e) });
    /* 1b · a sideways scroller whose content runs past its box: what is past the edge shows only on a sideways scroll */
    if (!isSvgKid && /(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && (e.textContent || "").trim())
      out.push({ kind: "sideways-scroller", el: name(e), path: path(e), by: e.scrollWidth - e.clientWidth, text: txt(e) });
    /* 2 · it sticks out of the frame's viewport */
    if (r.right > vw + 0.5) out.push({ kind: "past-right-edge", el: name(e), path: path(e), by: +(r.right - vw).toFixed(1), text: txt(e) });
    /* 3 · it sticks out of its nearest clipping ancestor (svg: its own svg box) */
    let a = e.parentElement;
    for (; a && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (/(hidden|clip|auto|scroll)/.test(acs.overflowX) || (a.tagName && a.tagName.toLowerCase() === "svg" && acs.overflow !== "visible")) break;
    }
    if (a && a !== document.documentElement) {
      const ar = a.getBoundingClientRect();
      const over = Math.max(r.right - ar.right, ar.left - r.left);
      if (over > 0.5 && (isSvgKid ? /^(text|tspan)$/i.test(e.tagName) : true) && (e.textContent || "").trim())
        out.push({ kind: "cut-by-ancestor", el: name(e), clip: name(a), path: path(e), by: +over.toFixed(1), text: txt(e) });
    }
  }
  /* keep the innermost report per text, largest first */
  const seen = new Set(); const uniq = [];
  for (const o of out.sort((x, y) => y.by - x.by)) { const k = o.kind + "|" + o.text + "|" + o.el; if (seen.has(k)) continue; seen.add(k); uniq.push(o); }
  return { vw, vh, n: uniq.length, items: uniq.slice(0, 60) };
};
const out = { label, T, at: new Date().toISOString(), sizes: {} };
for (const [W, H] of SIZES) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push({ method: m, url: u.host + u.pathname }); return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "[]" }); }
    if (u.host === "scintillahub.ai") {
      if (u.pathname.startsWith("/api/")) return route.continue();
      const f = localFile(hubRoot, u.pathname);
      if (!f) return route.fulfill({ status: 404, body: "not found" });
      return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "access-control-allow-origin": "*", "cache-control": "no-store" }, body: fs.readFileSync(f) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 30 && errors.push(W + ": " + String(e.message).slice(0, 160)));
  const r = {};
  try {
    await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
    await sleep(3000);
    await page.evaluate((t) => openCo(t), T);
    await sleep(9000);
    r.tab = await page.evaluate(() => S.coTab);
    r.page = await page.evaluate(DETECT, "#leftPanel");
    r.header = await page.evaluate(DETECT, ".sc-dashwrap");
    r.tabs = {};
    if (process.env.ALLTABS) for (const tb of await page.evaluate(() => CO_TABS.slice())) {
      await page.evaluate((x) => { const b = document.querySelector('#cvTabs [data-tab="' + x + '"]'); if (b) b.click(); }, tb);
      await sleep(2500);
      const d = await page.evaluate(DETECT, "#leftPanel");
      r.tabs[tb] = d.items.filter((it) => !/^(GEIGER|FUNDAMENTALS|ESTIMATES|COMPS|FINANCIALS|STATS|NEWS|SOCIAL|EARNINGS|READ)$/.test(it.text)).slice(0, 12);
      if (tb === "READ") await page.screenshot({ path: path.join(shots, label + "-read-" + W + "x" + H + ".png") });
    }
    if (process.env.ALLTABS) { await page.evaluate(() => { const b = document.querySelector('#cvTabs [data-tab="GEIGER"]'); if (b) b.click(); }); await sleep(2000); }
    r.frames = [];
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      const fe = await f.frameElement().catch(() => null); if (!fe) continue;
      const inPanel = await fe.evaluate((x) => !!x.closest("#leftPanel")).catch(() => false); if (!inPanel) continue;
      const box = await fe.boundingBox();
      const d = await f.evaluate(DETECT, null).catch((e) => ({ err: String(e.message).slice(0, 120) }));
      r.frames.push({ url: f.url().replace(/[?#].*$/, ""), box, ...d });
    }
    const lp = await page.$("#leftPanel");
    await lp.screenshot({ path: path.join(shots, label + "-co-" + W + "x" + H + ".png") });
    const b = await lp.boundingBox();
    await page.screenshot({ path: path.join(shots, label + "-co-right-" + W + "x" + H + ".png"), clip: { x: Math.max(0, b.x + b.width - 420), y: b.y, width: Math.min(420, b.width), height: Math.min(b.height, H - b.y) } });
  } catch (e) { r.fatal = String(e && e.message || e).slice(0, 300); }
  out.sizes[W + "x" + H] = r;
  await context.close();
}
out.writes = writes.length; out.errors = errors;
fs.writeFileSync(path.join(here, "crop-" + label + ".json"), JSON.stringify(out, null, 1));
await browser.close();
for (const [k, r] of Object.entries(out.sizes)) {
  console.log("==", k, r.fatal || "", "tab", r.tab, "page", r.page && r.page.n, "header", r.header && r.header.n, "frames", (r.frames || []).map((f) => f.url + " n=" + f.n + (f.err ? " " + f.err : "")).join(" ; "));
}
