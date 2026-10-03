/* P2 (2 Oct) — the headless walk of SENTIMENT → PREDICTION MARKETS. Never a visible window (Alan, 24 Sep). The Hub is
   served from this branch (hubRoot) under its real hostname, as P1's walk does; every non-GET request is answered
   locally and counted, never sent; the page's own GET reads of the tables and of Polymarket's public API go through.
     node p2-walk.mjs 1680      the section at 1680 × 1050, device scale 2: the room, the proposals, a row tapped (the ladder in the right-hand panel)
     node p2-walk.mjs 390       the phone at 390 × 844
   Shots land in ../screens/; the record (groups, rows, flashes, the status line, proposals, page errors, writes) in ../tools/walk-<width>.json */
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
const shot = async (name, sel) => {
  const file = path.join(screens, name + "-" + width + ".png");
  if (sel) {
    const h = await page.$(sel);
    if (h) { try { await h.screenshot({ path: file, type: "png" }); return file; } catch (e) { out["shotError_" + name] = String(e.message).slice(0, 160); } }
  }
  await page.screenshot({ path: file, type: "png", fullPage: false });
  return file;
};
try {
  await page.goto("https://scintillahub.ai/#prediction", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#pmSection", { timeout: 60000 });
  try { await page.waitForFunction(() => document.querySelector("#pmSection .pmx-row") && typeof PM !== "undefined" && PM.hist && typeof PMX !== "undefined" && PMX.props, null, { timeout: 60000 }); } catch (_) { out.noHistory = true; }
  await sleep(3500);
  out.room = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".sc-soctab")].map((b) => ({ text: b.textContent, on: b.classList.contains("is-on") }));
    const sec = document.querySelector("#pmSection"); if (!sec) return { tabs, section: null };
    const st = sec.querySelector(".pmx-status");
    const groups = [...sec.querySelectorAll(".pmx-grp")].map((g) => ({ head: g.querySelector(".pmx-grp__h").textContent.replace(/\s+/g, " ").trim(), rows: g.querySelectorAll(".pmx-row").length, quiet: g.querySelectorAll(".pmx-row--quiet").length }));
    const rows = [...sec.querySelectorAll(".pmx-row[data-topic]")].map((r) => ({ topic: r.dataset.topic, text: r.textContent.replace(/\s+/g, " ").trim().slice(0, 140), wild: r.classList.contains("is-wild"),
      chg: (r.querySelector(".pmx-row__c") || {}).className || "", link: (r.querySelector(".pmx-row__v a") || {}).href || null }));
    const props = [...sec.querySelectorAll(".pmx-prop")].map((p) => p.textContent.replace(/\s+/g, " ").trim().slice(0, 220));
    return { tabs, status: st ? st.textContent.replace(/\s+/g, " ").trim() : null, statusRed: !!sec.querySelector(".pmx-status__p.is-red"), groups, rowCount: rows.length,
      wild: rows.filter((r) => r.wild).map((r) => r.topic), linked: rows.filter((r) => r.link).length, rows: rows.slice(0, 60), proposals: props, propsFoot: (sec.querySelector(".pmx-foot") || {}).textContent || null,
      railCards: [...document.querySelectorAll("#snRail .card h4")].map((h) => h.textContent), S: { sec: S.sec, sentiTab: S.sentiTab }, pmErr: PM.err, latestRows: PM.latest ? PM.latest.length : 0, histSeries: PM.hist ? Object.keys(PM.hist).length : 0,
      bandLabelAct: (document.querySelector("#pmBand .sc-tape__lbl") || {}).dataset ? document.querySelector("#pmBand .sc-tape__lbl").dataset.act : null };
  });
  out.shotRoom = await shot("section");
  out.shotStatus = await shot("section-top", "#pmSection .pmx-status");
  const firstGrp = await page.$("#pmSection .pmx-grp");
  if (firstGrp) out.shotGroups = await shot("section-groups", "#pmSection .pmx-grp");
  /* the proposals: scroll the room's scroller to them */
  await page.evaluate(() => { const p = document.querySelector(".pmx-props"); if (p) p.scrollIntoView({ block: "start" }); });
  await sleep(500);
  out.shotProposals = await shot("proposals", ".pmx-props");
  /* a row tapped: the first flashing row, else the first row */
  const sel = (out.room && out.room.wild && out.room.wild.length) ? '#pmSection .pmx-row[data-topic="' + out.room.wild[0] + '"]' : "#pmSection .pmx-row[data-topic]";
  await page.evaluate((s) => { const r = document.querySelector(s); if (r) { r.scrollIntoView({ block: "center" }); r.click(); } }, sel);
  try { await page.waitForFunction(() => document.querySelector("#snRail #pmPanel .pm-row"), null, { timeout: 30000 }); } catch (_) { out.noPane = true; }
  await sleep(3000);
  out.pane = await page.evaluate(() => {
    const p = document.querySelector("#snRail #pmPanel"); if (!p) return null;
    return { topic: p.dataset.topic, head: (p.querySelector(".pm-panel__head") || {}).textContent, rows: [...p.querySelectorAll(".pm-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim().slice(0, 160)),
      lines: p.querySelectorAll(".pm-row .rg-svg").length, foot: (p.querySelector(".pm-panel__foot") || {}).textContent, open: S.sec + "|" + S.sentiTab, openRow: !!document.querySelector("#pmSection .pmx-row.is-open") };
  });
  await page.evaluate(() => { const p = document.querySelector("#snRail"); if (p) p.scrollIntoView({ block: "start" }); });
  await sleep(300);
  out.shotPane = await shot("pane", "#snRail");
  out.shotRoomOpen = await shot("section-open");
  /* ✕ gives the rail its cards back */
  await page.click('#snRail [data-act="pmclose"]').catch(() => {});
  await sleep(500);
  out.afterClose = await page.evaluate(() => ({ pane: !!document.querySelector("#snRail #pmPanel"), cards: document.querySelectorAll("#snRail .card").length }));
  /* the band's label, from the dashboard, opens the section */
  await page.evaluate(() => { location.hash = ""; go("DASHBOARD"); });
  await sleep(2500);
  await page.evaluate(() => { const b = document.querySelector('#pmBand [data-act="pmsection"]'); if (b) b.click(); });
  await sleep(2500);
  out.fromBand = await page.evaluate(() => ({ sec: S.sec, tab: S.sentiTab, section: !!document.querySelector("#pmSection"), rows: document.querySelectorAll("#pmSection .pmx-row").length }));
} catch (e) { out.fatal = String(e && e.message || e).slice(0, 400); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, "walk-" + width + ".json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, room: out.room && { ...out.room, rows: out.room.rows && out.room.rows.slice(0, 6) } }, null, 1));
