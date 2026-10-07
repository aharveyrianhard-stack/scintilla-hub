// GL1 — the pictures: the Hub board and the compare cards, before (as deployed) and after (this branch, switched on).
//
//   before = https://scintillahub.ai/ as deployed.
//   after  = this branch's files served at the same address, with ?gl1=1 (the switch), and the chart API's /geiger
//            answer given the three things the GL1 back end adds for each name: the LIVE numbers, `reading` and
//            `price_utc`. Those live numbers are not invented: data/live-readings.json holds what the GL1 publisher
//            code computed for every FAVORITES / RADAR name from the provider's real bars and stored minutes a few
//            minutes before the picture (provider repo, scripts/gl1/gl1-agreement.mjs --publisher-only). Everything
//            else on the page is the live service, untouched.
// Headless only; ONE page at a time; every request that is not a GET is stopped and counted (HC1's rig).
//   node deliverables/20261007/gl1-geiger-live/tools/capture.mjs <before|after> <width>
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openHub, sleep, REPO } from "../../../20261006/hc1-compare-one-screen/tools/rig.mjs";

const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WHICH = process.argv[2] || "after", W = +(process.argv[3] || 1680), FORM = process.argv[4] === "2" ? "2" : "1";
const TAG = WHICH + (WHICH === "after" && FORM === "2" ? "-formB" : "");
const PHONE = W < 500, H = PHONE ? 844 : 1050;
const SHOTS = path.join(D, "shots");
const out = { which: WHICH, width: W, at: new Date().toISOString() };
const livePath = path.join(D, "data", "live-readings.json");
const LIVE = WHICH === "after" && fs.existsSync(livePath) ? JSON.parse(fs.readFileSync(livePath, "utf8")) : null;

const h = await openHub({ width: W, height: H, local: WHICH === "before" ? null : REPO, hash: WHICH === "after" ? "?gl1=" + FORM : "" });
const { page, count } = h;
if (LIVE) {
  // the GL1 back end's additions, laid over the real answer of the moment (the last route added is asked first)
  await page.route(/scintilla-massive-chart-api\.fly\.dev\/geiger(\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    let res;
    try { res = await route.fetch(); } catch (_) { return route.fallback(); }
    let j; try { j = await res.json(); } catch (_) { return route.fulfill({ response: res }); }
    let n = 0;
    for (const [sym, v] of Object.entries(j.symbols || {})) {
      const L = LIVE.names[sym];
      if (!L) { v.reading = "settled"; continue; }
      v.settled = { composite: L.settled.c, trend: L.settled.t, momentum: L.settled.m };
      v.composite = L.live.c; v.trend = L.live.t; v.momentum = L.live.m;
      v.reading = L.reading; v.rungs_live = L.rungs_live;
      // the age a reader would see: the same gap between the newest minute and the clock as when it was computed
      v.price_utc = new Date(Date.now() - LIVE.price_age_ms).toISOString();
      if (Array.isArray(v.rungs) === false && v.rungs && L.rungs) for (const [k, r] of Object.entries(v.rungs)) if (L.rungs[k] && r) { r.trend_signed = L.rungs[k][0]; r.momentum_signed = L.rungs[k][1]; }
      n++;
    }
    j.reading = "live"; j.reading_default = "live";
    out.liveNamesLaidOver = n;
    return route.fulfill({ response: res, json: j });
  });
}
const shot = async (name, opts = {}) => { const f = `${name}-${TAG}-${W}.png`; await page.screenshot({ path: path.join(SHOTS, f), ...opts }); return f; };
const boxOf = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; }, sel);
try {
  await page.waitForFunction(() => typeof LISTS_READ !== "undefined" && LISTS_READ && document.querySelectorAll(".sc-board__row").length > 5, null, { timeout: 90000 });
  await sleep(6000);
  out.board = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".sc-board__row")).slice(0, 12);
    const cell = (r) => r.querySelector(".sc-gcell");
    return { rows: document.querySelectorAll(".sc-board__row").length, gl1On: typeof scGl1On === "function" ? scGl1On() : null,
      tag: (document.querySelector(".sc-gl1tag") || {}).textContent || null, meanTM: (document.querySelector(".sc-cohgeiger__tm") || {}).textContent || null,
      sample: rows.map((r) => { const c = cell(r), t = c && c.querySelector(".sc-gtm__txt"), b = c ? c.getBoundingClientRect() : null;
        return { t: (r.querySelector(".sc-ctk") || {}).textContent, text: t ? t.textContent : null, textShown: t ? getComputedStyle(t).display !== "none" : null,
          cellW: b ? Math.round(b.width) : null, rowH: Math.round(r.getBoundingClientRect().height), overflow: c ? c.scrollWidth - c.clientWidth : null,
          thinBars: c ? c.querySelectorAll(".sc-gtm__bar").length : 0, title: c && c.querySelector(".sc-gtm") ? c.querySelector(".sc-gtm").getAttribute("title") : null }; }),
      sideways: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
  });
  out.shots = { page: await shot("1-dashboard") };
  // the board alone, and its Geiger column close up
  const board = await boxOf(".sc-board__scroll") || await boxOf("#board");
  const hdr = await page.evaluate(() => { const e = document.querySelector(".sc-cohgeiger"); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
  if (hdr && board) {
    const top = Math.max(0, hdr.y - 4), bottom = Math.min(H, board.y + Math.min(board.height, PHONE ? 520 : 470));
    out.shots.board = await shot("2-board", { clip: { x: Math.max(0, hdr.x - 4), y: top, width: Math.min(W, hdr.width + 8), height: bottom - top } });
  }
  const g = await page.evaluate(() => { const cs = Array.from(document.querySelectorAll(".sc-board__row .sc-gcell")).slice(0, 9); if (!cs.length) return null;
    const a = cs[0].getBoundingClientRect(), z = cs[cs.length - 1].getBoundingClientRect(); return { x: a.left - 150, y: a.top - 6, width: a.width + 158, height: z.bottom - a.top + 12 }; });
  if (g) out.shots.cells = await shot("3-geiger-cells", { clip: { x: Math.max(0, g.x), y: g.y, width: Math.min(W - Math.max(0, g.x), g.width), height: g.height } });
  // the compare cards
  { const sel = '[data-act="l0tab"][data-tab="COHORT"]';
    await page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -8); } }, sel);
    try { await page.click(sel, { timeout: 5000 }); } catch (_) {}
    try { await page.waitForFunction(() => document.querySelectorAll(".sc-cmpx__card .sc-cohstrip__col").length > 3, null, { timeout: 30000 }); } catch (_) {}
    await sleep(2500);
    await page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.scrollIntoView({ block: "start" }); window.scrollBy(0, -8); } }, sel); await sleep(300); }
  out.compare = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".sc-cmpx__card"));
    return { cards: cards.map((c) => ({ view: (c.querySelector(".sc-cmpx__ttl") || {}).textContent, columns: c.querySelectorAll(".sc-cohstrip__col").length,
      withThinBars: c.querySelectorAll(".sc-vtm").length, sideways: Math.max(0, c.scrollWidth - c.clientWidth),
      barH: (() => { const v = c.querySelector(".sc-vmini"); return v ? Math.round(v.getBoundingClientRect().height) : null; })() })) };
  });
  const cmp = await boxOf("#cohCompare") || await boxOf(".sc-cmpx");
  if (cmp) { if (PHONE) out.shots.compare = await shot("4-compare-cards"); else out.shots.compare = await shot("4-compare-cards", { clip: { x: cmp.x, y: Math.max(0, cmp.y), width: Math.min(W - cmp.x, cmp.width), height: Math.min(H - Math.max(0, cmp.y), cmp.height) } }); }
} catch (e) { out.error = String(e && e.message || e).slice(0, 300); try { out.shots = { ...(out.shots || {}), failure: await shot("0-failure") }; } catch (_) {} }
out.requests = { nonGetStopped: count.blocked, servedFromBranch: count.servedLocal, consoleErrors: count.consoleErrors.slice(0, 8) };
await h.close();
fs.writeFileSync(path.join(D, "data", `capture-${TAG}-${W}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ which: WHICH, width: W, board: out.board && { rows: out.board.rows, gl1On: out.board.gl1On, tag: out.board.tag, meanTM: out.board.meanTM, first: out.board.sample.slice(0, 3) }, compare: out.compare, shots: out.shots, requests: out.requests, error: out.error || null }, null, 1));
