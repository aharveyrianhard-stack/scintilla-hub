/* RS1 (6 Oct 2026) — headless before → after pictures of the Hub board's RSI column. Never a visible window (Alan, 24 Sep).
     node rs1-shots.mjs <before|after> <width> [beforeIndexFile]
   The browser opens the REAL address https://scintillahub.ai/ and this script answers the page itself from disk, so the
   page's origin is the Hub's and every price / RSI / database GET goes out live:
     before = the page as it is on origin/hub/release-20260923 (the file passed as the third argument)
     after  = this branch's index.html
   THE AFTER PICTURE NEEDS A TABLE THAT IS NOT IN THE DATABASE YET. public.rsi_own_percentiles is created by a migration
   the coordinator applies; until then the live database answers 404 and the page (correctly) stays on 30 / 70. So in
   "after" this script answers that ONE read from ../data/rsi-own-dry-run.json — the rows the loader's dry run produced
   from the live chart API for the 5 Oct close — in the shape the database would send. Every other read is live.
   Every non-GET request is aborted and counted, never sent. Pictures → ../pictures, the record → rec-<mode>-<width>.json */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [mode = "after", w = "1680", beforeFile = ""] = process.argv.slice(2);
const width = Number(w), phone = width < 700;
const here = path.dirname(fileURLToPath(import.meta.url));
const hubRoot = path.resolve(here, "../../../..");
const pics = path.join(here, "..", "pictures");
const indexFile = mode === "before" ? beforeFile : path.join(hubRoot, "index.html");
if (!indexFile || !fs.existsSync(indexFile)) { console.error("no page file for mode " + mode); process.exit(2); }
const dry = JSON.parse(fs.readFileSync(path.join(here, "..", "data", "rsi-own-dry-run.json"), "utf8")).rows;
const dryBy = new Map(dry.map((r) => [r.ticker, r]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = ["NFLX", "SPY", "QQQ", "IWM", "RSP", "SMH", "TLT", "TSM", "MU", "NVDA", "CBRS", "VIX", "US10Y", "DXUSD", "GCUSD"];
const writes = [], errors = [];
const out = { mode, width, at: new Date().toISOString(), page: path.relative(hubRoot, indexFile), writes, errors, own_table_reads_answered_from_dry_run: 0, own_table_rows_sent: 0 };
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars", "--mute-audio"] });
try {
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1050 }, deviceScaleFactor: phone ? 2 : 1, serviceWorkers: "block",
    ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await context.route("**/*", async (route) => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") { writes.push({ method: m, url: u.host + u.pathname }); return route.abort(); }
    if (u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
      return route.fulfill({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body: fs.readFileSync(indexFile) });
    if (u.pathname === "/rest/v1/rsi_own_percentiles") {
      /* the table is not applied yet: answered here from the loader's dry run, exactly as PostgREST would (see the header) */
      const want = (u.searchParams.get("ticker") || "").replace(/^(in\.\(|eq\.)/, "").replace(/\)$/, "").split(",").map(decodeURIComponent).filter(Boolean);
      const since = (u.searchParams.get("as_of") || "").replace(/^gte\./, "");
      const cols = (u.searchParams.get("select") || "").split(",").filter(Boolean);
      const rows = want.map((t) => dryBy.get(t)).filter((r) => r && (!since || r.as_of >= since)).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
      out.own_table_reads_answered_from_dry_run++; out.own_table_rows_sent += rows.length;
      return route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify(rows) });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.length < 20 && errors.push(String(e.message).slice(0, 200)));
  await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".sc-board__row[data-t]", { timeout: 90000 });
  await page.waitForFunction(() => window.SC_RANK_READY === true, null, { timeout: 60000 }).catch(() => {});
  await sleep(3000);
  out.opening_list = await page.evaluate(() => (typeof S !== "undefined" ? S.coh : null));
  /* ALL: the one list that is sure to hold NFLX */
  await page.evaluate(() => { const el = [...document.querySelectorAll('[data-act="coh"][data-key="ALL"]')].find((e) => e.offsetParent) || document.querySelector('[data-act="coh"][data-key="ALL"]'); el.click(); });
  await page.waitForFunction(() => document.querySelectorAll("#boardScroll .sc-board__row").length > 300 && !S.boardPending, null, { timeout: 90000 });
  await page.waitForFunction(() => /\d/.test((document.getElementById("lr_NFLX") || {}).textContent || ""), null, { timeout: 90000 }).catch(() => { out.noNflxRsi = true; });
  /* the RSI column fills 35 names at a time: wait until it has stopped filling */
  let filled = -1;
  for (let i = 0; i < 40; i++) { const n = await page.evaluate(() => [...document.querySelectorAll(".sc-rsi[id^='lr_']")].filter((c) => /\d/.test(c.textContent)).length); if (n === filled && i > 4) break; filled = n; await sleep(1500); }
  out.rsi_cells_filled = filled;
  await sleep(mode === "after" ? 5000 : 2000);
  const cell = (t) => page.evaluate((t) => {
    const c = document.getElementById("lr_" + t); if (!c) return null;
    const cs = getComputedStyle(c);
    return { text: c.textContent.trim(), color: cs.color, inline: c.style.color || null, breathes: c.classList.contains("is-xt"), title: c.title || null, data_own: c.getAttribute("data-own") };
  }, t);
  /* the glow at its brightest, so a still picture shows which cells breathe */
  const glow = () => page.evaluate(() => { let n = 0; for (const a of document.getAnimations()) if (a.animationName === "rsi-xt") { a.pause(); a.currentTime = 2000; n++; } return n; });
  out.board = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("#boardScroll .sc-rsi[id^='lr_']")], withN = cells.filter((c) => /\d/.test(c.textContent));
    return { rows: document.querySelectorAll("#boardScroll .sc-board__row").length, rsi_cells_with_a_number: withN.length,
      breathing: withN.filter((c) => c.classList.contains("is-xt")).length, with_own_scale_hover: withN.filter((c) => c.getAttribute("data-own")).length };
  });
  /* every cell's class and colour against what the rule says for the number it shows (after only): must be empty */
  out.disagreements = await page.evaluate(() => {
    if (typeof rsiOwnRead !== "function") return null;
    const bad = [], norm = (c) => { const d = document.createElement("i"); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
    for (const c of document.querySelectorAll("#boardScroll .sc-rsi[id^='lr_']")) {
      const t = c.id.slice(3), row = (S.rows || []).find((r) => r.t === t), filled = c.getAttribute("data-hu-rsi");
      const v = row && row.rsi != null ? row.rsi : filled != null ? +filled : null;
      if (v == null) continue;
      const rd = rsiOwnRead(t, v), wantGlow = row && row.rsi != null ? rd.extreme : rd.own && rd.extreme;
      if (wantGlow !== c.classList.contains("is-xt") || norm(rd.color) !== getComputedStyle(c).color || String(Math.round(v)) !== c.textContent.trim())
        bad.push({ t, v, shown: c.textContent.trim(), wantGlow, glows: c.classList.contains("is-xt"), wantColor: norm(rd.color), color: getComputedStyle(c).color });
    }
    return bad;
  });
  out.breathing_names = await page.evaluate(() => [...document.querySelectorAll("#boardScroll .sc-rsi.is-xt[id^='lr_']")].map((c) => c.id.slice(3) + " " + c.textContent.trim()));
  const shot = async (name, opts) => { const f = path.join(pics, `${mode}-${width}-${name}.png`); await page.screenshot({ path: f, ...opts }); return path.basename(f); };
  out.shots = {};
  /* 1 · NFLX in the middle of the screen */
  await page.evaluate(() => document.querySelector('#boardScroll [data-act="row"][data-t="NFLX"]').scrollIntoView({ block: "center" }));
  await sleep(1500); await glow(); await sleep(300);
  out.shots.screen = await shot("screen-nflx", {});
  const rowBox = await page.evaluate(() => { const r = document.querySelector('#boardScroll [data-act="row"][data-t="NFLX"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const pad = phone ? 5 : 6;
  out.shots.rows = await shot("nflx-rows", { clip: { x: Math.max(0, rowBox.x - 2), y: Math.max(0, rowBox.y - rowBox.h * pad), width: Math.min(width - Math.max(0, rowBox.x - 2), rowBox.w + 4), height: rowBox.h * (pad * 2 + 1) } });
  out.cells = {};
  for (const t of WATCH) out.cells[t] = await cell(t);
  /* 2 · the board sorted by RSI, lowest first: the whole green end of the column in one picture */
  const hdr = await page.evaluate(() => { const h = [...document.querySelectorAll('#boardScroll .ch.hdr [data-act="sort"], #boardScroll .hdr [data-key]')].find((e) => /^RSI/i.test(e.textContent.trim())); if (!h) return false; h.click(); return true; });
  if (hdr) {
    await sleep(2500);
    const asc = await page.evaluate(() => (typeof S !== "undefined" && S.sort ? S.sort.dir : null));
    if (asc !== 1) { await page.evaluate(() => { const h = [...document.querySelectorAll('#boardScroll .ch.hdr [data-act="sort"], #boardScroll .hdr [data-key]')].find((e) => /^RSI/i.test(e.textContent.trim())); h && h.click(); }); await sleep(2500); }
    await page.evaluate(() => { const s = document.getElementById("boardScroll"); if (s) s.scrollTop = 0; });
    await sleep(1500); await glow(); await sleep(300);
    out.sorted_by = await page.evaluate(() => (typeof S !== "undefined" ? S.sort : null));
    out.shots.sorted_low = await shot("sorted-rsi-lowest", {});
    out.top_rows_lowest_rsi = await page.evaluate(() => [...document.querySelectorAll("#boardScroll .sc-board__row")].slice(0, 14).map((r) => { const c = r.querySelector(".sc-rsi"); return { t: r.getAttribute("data-t"), rsi: c ? c.textContent.trim() : null, color: c ? getComputedStyle(c).color : null, breathes: !!(c && c.classList.contains("is-xt")), hover: c ? c.title : null }; }));
  } else out.noSortHeader = true;
} catch (e) { out.failed = String(e && e.message || e).slice(0, 300); }
finally { await browser.close(); }
out.writes_attempted = writes.length; out.page_errors = errors.length;
fs.writeFileSync(path.join(here, `rec-${mode}-${width}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ mode, width, failed: out.failed || null, opening_list: out.opening_list, board: out.board, NFLX: out.cells && out.cells.NFLX, writes: writes.length, errors: errors.length, own_reads: out.own_table_reads_answered_from_dry_run, shots: out.shots }, null, 1));
