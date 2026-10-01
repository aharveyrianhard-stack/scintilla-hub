// Item 2 — the company view's chart: which RSI the embedded Station pane draws, and how tall its panel is.
// usage: node rsi.mjs <hubRoot|https://scintillahub.ai> <outPrefix> <width> <expanded 0|1> [ticker]
import { serve, open, sleep } from "./rig.mjs";
import fs from "node:fs";
const [root, outp, W, EXP, TICK] = process.argv.slice(2);
const width = +W, live = /^https?:/.test(root);
let server = null, origin = root;
if (!live) ({ server, origin } = await serve(root));
const blocked = [];
const { browser, context } = await open({ width, blocked });
await context.addInitScript((exp) => { if (window.top !== window) return; try { localStorage.setItem("hub.company.expanded", exp); localStorage.setItem("hub.chart.range", "1D"); sessionStorage.setItem("hub.station.hubpane", "1"); } catch (_) {} }, EXP);
const page = await context.newPage();
await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof S !== "undefined" && document.querySelectorAll('[data-act="row"][data-t]').length > 20, null, { timeout: 60000 });
const t = TICK || "MU";
await page.evaluate((t) => { const r = document.querySelector('[data-act="row"][data-t="' + t + '"]') || document.querySelector('[data-act="row"][data-t]'); r.scrollIntoView({ block: "center" }); r.click(); }, t);
await page.waitForSelector("#coChartFrame", { timeout: 30000 });
const fh = await page.$("#coChartFrame");
let frame = null;
for (let i = 0; i < 100 && !frame; i++) { frame = await fh.contentFrame(); if (!frame || !/\/chart\//.test(frame.url())) { frame = null; await sleep(200); } }
// wait for the RSI panel to be drawn (or 30 s)
let drawn = null;
for (let i = 0; i < 150; i++) {
  drawn = await frame.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); return h && h._rsiDrawn ? JSON.parse(JSON.stringify({ ...h._rsiDrawn, hostH: h.clientHeight, hostW: h.clientWidth })) : null; }).catch(() => null);
  if (drawn && drawn.lines && drawn.lines.length && (drawn.chip || drawn.mode !== "rsi-only")) break;
  await sleep(200);
}
await sleep(1500);
drawn = await frame.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); return h && h._rsiDrawn ? JSON.parse(JSON.stringify({ ...h._rsiDrawn, hostH: h.clientHeight, hostW: h.clientWidth })) : null; }).catch((e) => ({ err: String(e) }));
const src = await page.evaluate(() => el("coChartFrame").getAttribute("src"));
const box = await page.evaluate(() => { const r = el("coChartFrame").getBoundingClientRect(), c = (el("cvChart") || el("coChartFrame")).getBoundingClientRect(); return { frame: { x: r.left, y: r.top, w: r.width, h: r.height }, holder: { x: c.left, y: c.top, w: c.width, h: c.height }, vh: innerHeight }; });
// clipping checks: is the frame fully on screen / inside its holder; does the RSI panel fit its own drawing
const R = { width, expanded: EXP, live, src, box, drawn, blocked };
if (drawn && drawn.height != null) {
  const lineH = 11 + 4;                        /* the Station's title row: font + 4 */
  R.check = {
    rsiPanelPx: drawn.height,
    pxPer10Rsi: +((drawn.height - 6) / 10).toFixed(1),
    guideGap30to70: drawn.guides ? Math.abs(drawn.guides.find((g) => g.v === 30).y - drawn.guides.find((g) => g.v === 70).y) : null,
    titleRowCovers: drawn.guides ? (drawn.top + lineH + 1) > drawn.guides.find((g) => g.v === 70).y : null,
    chipInside: drawn.chip ? drawn.chip.box.y >= drawn.top - .5 && drawn.chip.box.y + drawn.chip.box.h <= drawn.top + drawn.height + .5 : null,
    chipDisplaced: drawn.chip ? drawn.chip.displaced : null,
    frameInsideViewport: box.frame.y >= 0 && box.frame.y + box.frame.h <= box.vh + 1,
  };
}
await page.screenshot({ path: outp + ".png" });
await fh.screenshot({ path: outp + "-chart.png" }).catch(() => {});
fs.writeFileSync(outp + ".json", JSON.stringify(R, null, 1));
console.log(JSON.stringify({ src, box: box.frame, mode: drawn && drawn.mode, lines: drawn && drawn.lines && drawn.lines.map((l) => l.key), chip: drawn && drawn.chip && drawn.chip.text, check: R.check, blocked: blocked.length }));
await browser.close(); if (server) server.close();
