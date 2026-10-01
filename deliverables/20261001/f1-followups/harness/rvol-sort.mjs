// F1 item 1 — the RVOL column sorts by pace. HEADLESS ONLY. usage: node rvol-sort.mjs <index.html> <width> <outdir> <tag>
// The Hub document at https://scintillahub.ai/ is answered with the local file under test; every other read goes to the live
// services as the page sends it, and EVERY non-GET request is aborted (nothing here can write a like, a setting or a row).
// SIM_RVOL=1 is a SIMULATION, labelled as such in the report: board_volume's real answer is handed to the page with every row
// re-stamped as written now (rvol_at_time filled from the row's own session_rvol where empty), and then one name in four
// is withheld, so both "has a reading" and "no reading" rows are on the board. Read only; nothing is written anywhere.
// Steps: the board as it opens (Geiger ▼) → Tab focus on the RVol header + Enter → click it again → full screen (⛶) → click.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [file, W, OUT, TAG] = process.argv.slice(2);
const html = fs.readFileSync(file), width = +W || 1680, phone = width < 600, H = phone ? 844 : 1050;
const result = { tag: TAG, width, sim: !!process.env.SIM_RVOL, at: new Date().toISOString(), blocked: [], errors: [], steps: {} };
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) { result.blocked.push(req.method() + " " + u.host + u.pathname); return route.abort(); }
    if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
    if (process.env.SIM_RVOL && /\/rest\/v1\/board_volume/.test(u.pathname)) {
      const r = await route.fetch(); const rows = await r.json().catch(() => []); const now = new Date().toISOString();
      const out = (Array.isArray(rows) ? rows : []).filter((x, i) => i % 4 !== 3)
        .map((x) => ({ ...x, updated_ts: now, rvol_at_time: x.rvol_at_time ?? x.session_rvol }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out), headers: { "access-control-allow-origin": "*" } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => result.errors.push(String(e).slice(0, 240)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && window.SC_RANK_READY && document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length > 5, null, { timeout: 90000 });
  await sleep(4000);
  const state = () => page.evaluate(() => {
    const hdr = [...document.querySelectorAll("#boardPanel .ch.hdr > *")].map((c) => c.textContent.trim());
    const rows = [...document.querySelectorAll("#boardPanel .sc-board__row[data-t]")].map((r) => {
      const d = (S.rows || []).find((x) => x.t === r.dataset.t) || {};
      const n = r.querySelector(".sc-vol__n");
      return { t: r.dataset.t, rv: d.rv == null ? null : d.rv, shown: n ? n.textContent : null };
    });
    const firstEmpty = rows.findIndex((r) => r.rv == null);
    const vals = rows.filter((r) => r.rv != null).map((r) => r.rv);
    return { sort: { ...S.sort }, secfs: document.body.classList.contains("secfs"), header: hdr.filter(Boolean).join(" | "),
      marked: hdr.filter((h) => /[▼▲]/.test(h)), rows: rows.length, withReading: vals.length,
      emptyAllLast: firstEmpty < 0 || rows.slice(firstEmpty).every((r) => r.rv == null),
      descending: vals.every((v, i) => !i || vals[i - 1] >= v), ascending: vals.every((v, i) => !i || vals[i - 1] <= v),
      top: rows.slice(0, 8).map((r) => r.t + " " + (r.shown || "")), bottom: rows.slice(-4).map((r) => r.t + " " + (r.shown || "")) };
  });
  const shot = async (name) => {
    const box = await page.evaluate(() => { const b = document.querySelector("#boardPanel"); b.scrollIntoView({ block: "start" });
      const r = b.getBoundingClientRect(); return { x: r.left, y: Math.max(0, r.top), w: r.width, h: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; });
    await sleep(400);
    const p = OUT + "/" + TAG + "-" + width + "-" + name + ".png";
    await page.screenshot({ path: p, clip: { x: box.x, y: box.y, width: box.w, height: Math.max(200, box.h) } });
    return p;
  };
  result.steps.open = await state(); await shot("1-open");
  /* the keyboard: focus the RVol header button and press Enter, like any other header */
  await page.focus('#boardPanel .ch.hdr [data-key="rv"]'); await page.keyboard.press("Enter"); await sleep(900);
  result.steps.enter = await state(); await shot("2-rvol-desc-enter");
  await page.click('#boardPanel .ch.hdr [data-key="rv"]'); await sleep(900);
  result.steps.click2 = await state(); await shot("3-rvol-asc-click");
  /* full screen: the board's ⛶, then RVol once more (it flips back to highest first) */
  await page.evaluate(() => { const b = document.querySelector('#boardPanel [data-act="secfs"]') || [...document.querySelectorAll('[data-act="secfs"]')].find((x) => x.closest(".sc-board, #boardPanel")); b && b.click(); });
  await sleep(1500);
  await page.click('#boardPanel .ch.hdr [data-key="rv"]'); await sleep(900);
  result.steps.secfs = await state();
  await page.screenshot({ path: OUT + "/" + TAG + "-" + width + "-4-fullscreen-rvol-desc.png" });
  for (const [k, s] of Object.entries(result.steps))
    console.log(k, JSON.stringify({ sort: s.sort, secfs: s.secfs, marked: s.marked, rows: s.rows, withReading: s.withReading, emptyAllLast: s.emptyAllLast, desc: s.descending, asc: s.ascending, top: s.top.slice(0, 5), bottom: s.bottom }));
} finally {
  await browser.close();
  fs.writeFileSync(OUT + "/" + TAG + "-" + width + ".json", JSON.stringify(result, null, 1));
  console.log("blocked", result.blocked.length, "errors", result.errors.length, result.errors.slice(0, 3).join(" / "));
}
