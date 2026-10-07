/* RS1 (7 Oct 2026) — IN THE BOARD'S FULL-SCREEN MODE, DOES THE BREATHING COPY OF AN RSI NUMBER SIT ON THE NUMBER?
     node fullscreen-glow-check.mjs <label> <indexFile>
   The breath is a copy of the number (::after) whose opacity pulses (SLOW1, 6 Oct). The copy was centred in the cell; in
   full-screen mode the cell is right-aligned, so the copy sat left of the number and the cell read "72 72". This opens the
   page headless (never a visible window), finds a breathing cell, freezes the breath at its brightest, measures where
   the number and its copy sit in normal and in full-screen mode, and photographs both at 3x.
   The browser opens https://scintillahub.ai/ and this script answers the page from <indexFile>; the one read of the
   not-yet-applied table is answered from the loader's dry run; every other read is live; every non-GET request is
   aborted and counted. Writes rec-fullscreen-glow-<label>.json here and ../pictures/fullscreen-glow-<label>-*.png */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [label = "branch", indexFile = ""] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
if (!indexFile || !fs.existsSync(indexFile)) { console.error("no page file"); process.exit(2); }
const dryFile = path.join(here, "..", "data", "rsi-own-dry-run.json"), outDir = path.join(here, "..", "pictures");
const dryBy = new Map(JSON.parse(fs.readFileSync(dryFile, "utf8")).rows.map((r) => [r.ticker, r]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { label, at: new Date().toISOString(), page_file: path.basename(indexFile), writes: 0, errors: 0 };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 3, serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { out.writes++; return route.abort(); }
    if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html")) return route.fulfill({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body: fs.readFileSync(indexFile) });
    if (u.pathname === "/rest/v1/rsi_own_percentiles") {
      const want = (u.searchParams.get("ticker") || "").replace(/^(in\.\(|eq\.)/, "").replace(/\)$/, "").split(",").map(decodeURIComponent).filter(Boolean);
      const cols = (u.searchParams.get("select") || "").split(",").filter(Boolean);
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(want.map((t) => dryBy.get(t)).filter(Boolean).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])))) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", () => out.errors++);
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 60000 }).catch(() => {});
  await sleep(8000);
  const measure = async (mode) => {
    // a breathing cell in view; pause every glow at its brightest
    const info = await page.evaluate(() => {
      for (const a of document.getAnimations()) if (a.animationName === "rsi-xt") { a.pause(); a.currentTime = 2000; }
      const cells = [...document.querySelectorAll("#boardScroll .sc-rsi.is-xt[id^='lr_']")].filter((c) => { const r = c.getBoundingClientRect(); return r.top > 200 && r.bottom < innerHeight - 40; });
      const c = cells[0]; if (!c) return null;
      const r = c.getBoundingClientRect(), cs = getComputedStyle(c), af = getComputedStyle(c, "::after");
      // where the number's own glyphs are, measured with a Range over the text node
      const rg = document.createRange(); rg.selectNodeContents(c.firstChild || c); const tr = rg.getBoundingClientRect();
      return { t: c.id.slice(3), text: c.textContent.trim(), cell: { x: r.x, y: r.y, w: r.width, h: r.height }, glyphs: { x: tr.x, w: tr.width },
        cell_text_align: cs.textAlign, cell_padding: cs.paddingLeft + " / " + cs.paddingRight, cell_display: cs.display,
        after: { position: af.position, left: af.left, right: af.right, width: af.width, textAlign: af.textAlign, paddingLeft: af.paddingLeft, opacity: af.opacity },
        body_exp: document.body.classList.contains("exp"), fullscreen: !!document.querySelector(".sc-secfs") };
    });
    /* where the copy lands: centred in the cell, or flush with the edge the cell aligns to */
    if (info) { const c = info.cell, g = info.glyphs, a = info.after.textAlign; info.number_centre = +(g.x + g.w / 2).toFixed(1);
      info.copy_centre = +(a === "right" || a === "end" ? c.x + c.w - g.w / 2 : a === "left" || a === "start" ? c.x + g.w / 2 : c.x + c.w / 2).toFixed(1);
      info.copy_offset_px = +(info.copy_centre - info.number_centre).toFixed(1); }
    out[mode] = info;
    if (info) await page.screenshot({ path: path.join(outDir, "fullscreen-glow-" + label + "-" + mode + ".png"), clip: { x: Math.max(0, info.cell.x - 60), y: Math.max(0, info.cell.y - info.cell.h), width: info.cell.w + 120, height: info.cell.h * 3 } });
  };
  await measure("normal");
  // the board panel's own full-screen control
  const clicked = await page.evaluate(() => { const b = document.getElementById("boardScroll"); let p = b; while (p && !p.querySelector(':scope > * .sc-fsico[data-act="secfs"], :scope > .sc-fsico[data-act="secfs"]')) p = p.parentElement; const btn = p && p.querySelector('.sc-fsico[data-act="secfs"]'); if (!btn) return false; btn.click(); return true; });
  out.fullscreen_clicked = clicked;
  await sleep(2500);
  await measure("fullscreen");
} catch (e) { out.failed = String(e && e.message || e).slice(0, 300); }
finally { await browser.close(); }
fs.writeFileSync(path.join(here, `rec-fullscreen-glow-${label}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ label, normal: out.normal && { t: out.normal.t, text: out.normal.text, cell_align: out.normal.cell_text_align, copy_align: out.normal.after.textAlign, copy_offset_px: out.normal.copy_offset_px }, fullscreen: out.fullscreen && { t: out.fullscreen.t, text: out.fullscreen.text, cell_align: out.fullscreen.cell_text_align, copy_align: out.fullscreen.after.textAlign, copy_offset_px: out.fullscreen.copy_offset_px }, writes: out.writes, errors: out.errors, failed: out.failed || null }));
