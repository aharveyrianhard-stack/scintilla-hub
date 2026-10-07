// HC1 — bug (a), "the Geiger panel crops the right side of the embedded chart": is the company view's chart frame ever wider
// than, or covered by, the panel around it? One headless browser on this branch's page, the company view open on one name,
// the window resized through fifteen widths, collapsed and expanded. At each: the frame's box against its panel's, what
// (if anything) sits on top of the frame's right edge, and — from inside the Station's own pane — its canvas against its width.
// GET only. Writes data/chart-frame-sweep.json.
//   node deliverables/20261006/hc1-compare-one-screen/tools/chart-frame-sweep.mjs [NAME]
import fs from "fs";
import path from "path";
import { openHub, sleep, D, REPO } from "./rig.mjs";

const NAME = process.argv[2] || "EQIX";
const WIDTHS = [1000, 1100, 1200, 1280, 1366, 1440, 1512, 1600, 1680, 1728, 1800, 1920, 2048, 2240, 2560];
const out = { at: new Date().toISOString(), name: NAME, browser: "headless Chromium (Playwright)", rows: [] };
const h = await openHub({ width: 1680, height: 1000, local: REPO });
try {
  const p = h.page;
  await p.waitForSelector("#boardScroll .sc-board__row", { timeout: 90000 }); await sleep(2500);
  await p.evaluate((t) => { const r = document.querySelector('#boardScroll .sc-board__row[data-t="' + t + '"] .sc-ctk'); if (r) r.scrollIntoView({ block: "center" }); }, NAME);
  await p.click('#boardScroll .sc-board__row[data-t="' + NAME + '"] .sc-ctk'); await sleep(6500);
  for (const mode of ["collapsed", "expanded"]) {
    if (mode === "expanded") { await p.click('[data-act="coexpand"]'); await sleep(5500); }
    for (const W of WIDTHS) {
      await p.setViewportSize({ width: W, height: W >= 2000 ? 1300 : 950 }); await sleep(1800);
      const fr = p.frames().find((f) => /station\.scintillahub\.ai\/chart\//.test(f.url()));
      let pane = null;
      try { pane = await fr.evaluate(() => { const host = Array.from(CHART_HOSTS)[0], cv = host && host.querySelector("canvas"); return { width: innerWidth, contentWidth: document.documentElement.scrollWidth, canvas: cv ? Math.round(cv.getBoundingClientRect().width) : null }; }); } catch (e) { pane = { error: String(e).slice(0, 80) }; }
      const m = await p.evaluate(() => {
        const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }, q = (s) => document.querySelector(s);
        const f = document.getElementById("coChartFrame"), fb = f.getBoundingClientRect(), over = [];
        for (const dx of [3, 20, 45, 70, 100]) for (const fy of [0.12, 0.5, 0.8, 0.93]) { const e = document.elementFromPoint(fb.right - dx, fb.top + fb.height * fy); if (e && e !== f) over.push((e.id || e.className || e.tagName).toString().slice(0, 40)); }
        return { zoom: +getComputedStyle(document.body).zoom, panel: r(q("#leftPanel")), frame: r(f), tabsPanel: r(q(".cv-side")), frameCss: f.clientWidth + "×" + f.clientHeight, coveredBy: Array.from(new Set(over)) };
      });
      const cut = (m.frame[1] > m.panel[1] + 1 ? "frame runs past its panel; " : "") + (m.coveredBy.length ? "covered by " + m.coveredBy.join(", ") + "; " : "") +
        (mode === "expanded" && m.tabsPanel && m.tabsPanel[0] < m.frame[1] - 1 ? "the tabs panel starts inside the frame; " : "") + (pane && pane.canvas > pane.width + 1 ? "the pane's canvas is wider than the pane; " : "") + (pane && pane.contentWidth > pane.width + 1 ? "the pane scrolls sideways; " : "");
      out.rows.push({ width: W, mode, zoom: m.zoom, frame: m.frame, panel: m.panel, tabsPanel: mode === "expanded" ? m.tabsPanel : null, frameCss: m.frameCss, pane, verdict: cut ? cut.trim() : "whole" });
      console.log(String(W).padStart(4), mode.padEnd(9), "zoom", m.zoom, "frame", JSON.stringify(m.frame), "panel", JSON.stringify(m.panel), "pane", JSON.stringify(pane), "→", cut || "whole");
    }
  }
  out.cutAnywhere = out.rows.some((r) => r.verdict !== "whole");
  out.requests = { stoppedNonGet: h.count.blocked };
} finally { fs.writeFileSync(path.join(D, "data", "chart-frame-sweep.json"), JSON.stringify(out, null, 1)); await h.close(); }
console.log("sizes checked:", out.rows.length, "· cut anywhere:", out.cutAnywhere);
