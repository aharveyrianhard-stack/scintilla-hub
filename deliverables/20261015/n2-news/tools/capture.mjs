// N2 — the pictures and the measurements behind them: the live NEWS room (before) against /preview/news/ on this branch (after).
//   before = https://scintillahub.ai/ as deployed, NEWS room, its default scope        after = this worktree's files served at the same address
// Headless only (HC1's rig.mjs): one browser at a time, service workers blocked, every request that is not a GET is stopped and counted.
//   node deliverables/20261015/n2-news/tools/capture.mjs            all six pictures
//   node deliverables/20261015/n2-news/tools/capture.mjs after 390  one
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { openHub, sleep, REPO } from "../../../20261006/hc1-compare-one-screen/tools/rig.mjs";

const D = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = path.join(D, "shots"), DATA = path.join(D, "data");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DATA, { recursive: true });
const SIZES = [[1680, 1050], [2560, 1440], [390, 844]];
const only = process.argv[2], onlyW = +process.argv[3] || null;

const measureBefore = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s), zoom = +getComputedStyle(document.body).zoom || 1;
  const arts = Array.from(document.querySelectorAll("#newsList .sc-art")), vis = (e) => { const b = e.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight && b.height > 0; };
  const hl = q("#newsList .sc-art .hl"), ts = q("#newsList .sc-art .rts"), src = q("#newsList .sc-art .rsrc"), tk = q("#newsList .sc-art .rtk");
  const px = (e) => e ? +(parseFloat(getComputedStyle(e).fontSize) * zoom).toFixed(1) : null;
  return { bodyZoom: zoom, viewport: [innerWidth, innerHeight], headlinesLoaded: arts.length, headlinesOnScreen: arts.filter(vis).length,
    titleDrawnPx: px(hl), timeDrawnPx: px(ts), sourceDrawnPx: px(src), tickerDrawnPx: px(tk),
    scope: (q("#newsScopeLbl") || {}).textContent || null, sideways: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
});
const measureAfter = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const arts = Array.from(document.querySelectorAll(".art")), vis = (e) => { const b = e.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight && b.height > 0; };
  const px = (e) => e ? +parseFloat(getComputedStyle(e).fontSize).toFixed(1) : null;
  const groups = Array.from(document.querySelectorAll(".grp")).map((g) => (g.querySelector(".grp__ttl") || {}).textContent + " " + (g.querySelector(".grp__n") || {}).textContent);
  const ttl = q(".art__ttl"), lines = ttl ? Math.round(ttl.getBoundingClientRect().height / (parseFloat(getComputedStyle(ttl).lineHeight) || 1)) : null;
  const cut = Array.from(document.querySelectorAll(".art__ttl, .art__meta, .mv__tk, .scope, .hd__brand")).filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1 && !e.classList.contains("art__ttl")).map((e) => e.textContent.slice(0, 40));
  return { viewport: [innerWidth, innerHeight], headlinesLoaded: arts.length, headlinesOnScreen: arts.filter(vis).length, titlePx: px(ttl), metaPx: px(q(".art__meta")), chipPx: px(q(".chip")),
    firstTitleLines: lines, groups, moved: Array.from(document.querySelectorAll(".mv__tk")).slice(0, 5).map((e) => e.textContent), scope: (q(".scope.is-on") || {}).textContent || null,
    pushStatus: (q("#pushSt") || {}).textContent || null, sideways: Math.max(0, document.documentElement.scrollWidth - innerWidth), cutLabels: cut };
});

const out = {};
for (const [w, h] of SIZES) {
  if (onlyW && onlyW !== w) continue;
  if (!only || only === "before") {
    const hub = await openHub({ width: w, height: h, local: null });
    try {
      await sleep(9000);
      await hub.page.evaluate(() => { try { go("NEWS"); } catch (e) { return String(e); } });
      for (let i = 0; i < 20; i++) { await sleep(1500); if (await hub.page.evaluate(() => document.querySelectorAll("#newsList .sc-art").length > 3)) break; }
      await sleep(2500);
      const m = await measureBefore(hub.page);
      await hub.page.screenshot({ path: path.join(SHOTS, `before-${w}.jpg`), type: "jpeg", quality: 82, fullPage: false });
      out[`before-${w}`] = { ...m, blockedWrites: hub.count.blocked, consoleErrors: hub.count.consoleErrors.slice(0, 3) };
      console.log("before", w, JSON.stringify(m));
    } finally { await hub.close(); }
  }
  if (!only || only === "after") {
    const hub = await openHub({ width: w, height: h, local: REPO, hash: "preview/news/" });
    try {
      for (let i = 0; i < 24; i++) { await sleep(1500); if (await hub.page.evaluate(() => document.querySelectorAll(".art").length > 3 && document.querySelectorAll(".mv").length > 0)) break; }
      await sleep(2000);
      const m = await measureAfter(hub.page);
      await hub.page.screenshot({ path: path.join(SHOTS, `after-${w}.jpg`), type: "jpeg", quality: 82, fullPage: false });
      if (w < 500) { await hub.page.evaluate(() => window.scrollTo(0, document.querySelector(".feed").getBoundingClientRect().top + window.scrollY - 90)); await sleep(600); await hub.page.screenshot({ path: path.join(SHOTS, `after-${w}-feed.jpg`), type: "jpeg", quality: 82 }); }
      out[`after-${w}`] = { ...m, servedLocal: hub.count.servedLocal, blockedWrites: hub.count.blocked, consoleErrors: hub.count.consoleErrors.slice(0, 3) };
      console.log("after", w, JSON.stringify(m));
    } finally { await hub.close(); }
  }
}
const f = path.join(DATA, "measure.json");
const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
fs.writeFileSync(f, JSON.stringify({ ...prev, ...out, at: new Date().toISOString() }, null, 1));
console.log("written", f);
