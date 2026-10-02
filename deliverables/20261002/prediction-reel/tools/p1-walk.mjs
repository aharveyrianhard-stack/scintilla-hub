/* P1 (2 Oct) — the headless walk of the PREDICTION MARKETS → band, the topic pane and the REGIME card. Never a visible
   window (Alan, 24 Sep). The Hub is served from this branch (hubRoot) under its real hostname, the way H8's walk does
   it; every non-GET request is answered locally and counted, never sent; the page's own GET reads of the tables go
   through (read-only, anon).
     node p1-walk.mjs 1680      the dashboard at 1680 × 1050, device scale 2: the band (zoomed), the pane after the first
                                chip is tapped (zoomed), and the REGIME view's prediction markets card (zoomed)
     node p1-walk.mjs 390       the phone at 390 × 844: the band and the pane stacked under the board
   Every shot lands in ../screens/; the record (chips read, order, flashes, the status chip, page errors, writes) in
   ../tools/walk-<width>.json. */
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
const writes = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 1 : 2, serviceWorkers: "block",
  ...(phone ? { isMobile: true, hasTouch: true } : {}) });
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
const out = { width, hubRoot, at: new Date().toISOString(), writes, errors };
/* an element is shot by its own handle (Playwright scrolls it on screen itself: the bands sit at the page foot, where a
   viewport clip lands outside the image); with no selector, the whole page */
const shot = async (name, sel) => {
  const file = path.join(screens, name + "-" + width + ".png");
  if (sel) {
    const h = await page.$(sel);
    if (h) { try { await h.screenshot({ path: file, type: "png" }); return file; } catch (e) { out["shotError_" + name] = String(e.message).slice(0, 160); } }
  }
  await page.screenshot({ path: file, type: "png", fullPage: true });
  return file;
};
try {
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 60000 });
  try { await page.waitForFunction(() => document.querySelector("#pmBand .pm-it") && typeof PM !== "undefined" && PM.hist, null, { timeout: 60000 }); } catch (_) { out.noHistory = true; }
  await sleep(4000);
  out.band = await page.evaluate(() => {
    const b = document.querySelector("#pmBand"); if (!b) return null;
    const st = b.querySelector(".pm-status");
    const chips = [...b.querySelectorAll(".pm-it")];
    const half = chips.length / 2;
    return { status: st ? st.textContent : null, statusRed: !!(st && st.classList.contains("is-red")), statusTitle: st ? st.title : null,
      chips: chips.slice(0, Math.max(1, Math.floor(half))).map((c) => ({ topic: c.dataset.topic, text: c.textContent.replace(/\s+/g, " ").trim(), wild: c.classList.contains("is-wild"),
        colour: (c.querySelector(".pm-chg") || {}).className || "", title: c.title })),
      total: chips.length, label: (b.querySelector(".sc-tape__lbl") || {}).textContent, pmErr: (typeof PM !== "undefined" && PM.err) || null,
      histSeries: typeof PM !== "undefined" && PM.hist ? Object.keys(PM.hist).length : 0, latestRows: typeof PM !== "undefined" && PM.latest ? PM.latest.length : 0 };
  });
  /* the band: scroll it on screen and shoot the dashboard + a zoom on the band */
  await page.evaluate(() => { const b = document.querySelector("#bands"); if (b) b.scrollIntoView({ block: "end" }); });
  await sleep(600);
  out.dashboard = await shot("dashboard", null);
  out.bandZoom = await shot("band", "#pmBand");
  /* the pane: tap the first chip (the biggest move) */
  /* the chips ride a marquee, so Playwright's own click never finds them "stable": the tap goes through the page's
     click() (the same document-level dispatcher a finger reaches) */
  const first = await page.$("#pmBand .pm-it");
  if (first) {
    out.tapped = await first.getAttribute("data-topic");
    await page.evaluate(() => { const c = document.querySelector("#pmBand .pm-it"); if (c) c.click(); });
    try { await page.waitForSelector("#pmPanel", { timeout: 20000 }); } catch (_) { out.noPanel = true; }
    try { await page.waitForFunction(() => document.querySelector("#pmPanel .rg-svg") && document.querySelector("#pmPanel a[href*='polymarket.com/event/']"), null, { timeout: 30000 }); } catch (_) { out.panelIncomplete = true; }
    await sleep(1500);
    out.panel = await page.evaluate(() => {
      const p = document.querySelector("#pmPanel"); if (!p) return null;
      return { topic: p.dataset.topic, head: (p.querySelector(".pm-panel__head") || {}).textContent, sub: (p.querySelector(".pm-panel__sub") || {}).textContent,
        rows: [...p.querySelectorAll(".pm-row")].map((r) => ({ q: (r.querySelector(".pm-row__q") || {}).textContent, p: (r.querySelector(".pm-row__p") || {}).textContent, line: !!r.querySelector(".rg-svg"), wild: r.classList.contains("is-wild") })),
        links: [...p.querySelectorAll("a[target=_blank]")].map((a) => a.href), foot: (p.querySelector(".pm-panel__foot") || {}).textContent,
        inLeftPanel: !!p.closest("#leftPanel"), top: p.getBoundingClientRect().top, boardTop: (document.querySelector(".sc-board") || p).getBoundingClientRect().top };
    });
    if (!phone) await page.evaluate(() => { const p = document.querySelector("#leftPanel"); if (p) p.scrollIntoView({ block: "center" }); });
    await sleep(400);
    out.paneShot = await shot("pane", "#leftPanel");
    if (phone) { out.paneFull = await shot("pane-full", null); }
    /* ✕ CLOSE gives Layer 0 back */
    await page.evaluate(() => { const b = document.querySelector('[data-act="pmclose"]'); if (b) b.click(); });
    await sleep(600);
    out.closedBack = await page.evaluate(() => !document.querySelector("#pmPanel") && !!document.querySelector("#layer0"));
  }
  if (!phone) {
    /* REGIME: ECONOMIC → REGIME, then the prediction markets card */
    await page.evaluate(() => { S.sec = "ECONOMIC"; S.econView = "REGIME"; sync(); });
    try { await page.waitForFunction(() => document.querySelector("#rgBody .rg-cat"), null, { timeout: 40000 }); } catch (_) { out.noRegime = true; }
    await sleep(1500);
    out.regime = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("#rgBody .rg-card")];
      const card = cards.find((c) => /prediction markets/.test((c.querySelector("h4") || {}).textContent || ""));
      if (!card) return { card: false, cards: cards.map((c) => (c.querySelector("h4") || {}).textContent) };
      return { card: true, headings: [...card.querySelectorAll(".rg-tbl-l")].map((h) => h.textContent), rows: card.querySelectorAll(".rg-cat").length,
        dim: [...card.querySelectorAll(".rg-dimnote")].length, lines: card.querySelectorAll(".rg-svg").length, text: card.textContent.replace(/\s+/g, " ").slice(0, 1500),
        nofeed: !!card.querySelector(".rg-nofeed"), catalystOdds: /catalyst_odds/.test(document.querySelector("#rgBody").textContent) };
    });
    await page.evaluate(() => { const cards = [...document.querySelectorAll("#rgBody .rg-card")]; const c = cards.find((x) => /prediction markets/.test((x.querySelector("h4") || {}).textContent || "")); if (c) c.scrollIntoView({ block: "start" }); });
    await sleep(500);
    const cardHandle = await page.evaluateHandle(() => { const cards = [...document.querySelectorAll("#rgBody .rg-card")]; return cards.find((x) => /prediction markets/.test((x.querySelector("h4") || {}).textContent || "")) || null; });
    const cel = cardHandle.asElement();
    if (cel) { const f = path.join(screens, "regime-card-" + width + ".png"); try { await cel.screenshot({ path: f, type: "png" }); out.regimeShot = f; } catch (e) { out.shotError_regime = String(e.message).slice(0, 160); } }
    out.regimeFull = await shot("regime", null);
  }
} catch (e) { out.fatal = String(e && e.stack || e).slice(0, 800); }
fs.writeFileSync(path.join(here, "walk-" + width + ".json"), JSON.stringify(out, null, 1));
await browser.close();
console.log(JSON.stringify({ width, band: out.band && { status: out.band.status, red: out.band.statusRed, chips: out.band.total, err: out.band.pmErr, hist: out.band.histSeries, first: out.band.chips.slice(0, 5).map((c) => c.text + (c.wild ? " ◆" : "")) },
  tapped: out.tapped, panelRows: out.panel && out.panel.rows.length, links: out.panel && out.panel.links.length, closedBack: out.closedBack, regime: out.regime && { rows: out.regime.rows, dim: out.regime.dim, lines: out.regime.lines, nofeed: out.regime.nofeed, catalystOdds: out.regime.catalystOdds },
  errors: out.errors, writes: out.writes.length, fatal: out.fatal, noHistory: out.noHistory, noPanel: out.noPanel, panelIncomplete: out.panelIncomplete }, null, 1));
