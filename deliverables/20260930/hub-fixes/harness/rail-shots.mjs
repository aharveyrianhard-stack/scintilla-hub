// Item 1 proof shots: the LIKED list scrolled to its end, photographed 3 s later (a live tick has had time to land).
// 1680: wheel down over the list. 390: the list runs across the top; swipe it left with a finger.
// usage: node rail-shots.mjs <hubRoot> <outPrefix> <width>
import { serve, open, sleep } from "./rig.mjs";
import fs from "node:fs";
const [root, outp, W] = process.argv.slice(2);
const width = +W;
const { server, origin } = await serve(root);
const { browser, context } = await open({ width });
await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("hub.company.expanded", "1"); localStorage.setItem("hub.chart.range", "1D"); sessionStorage.setItem("hub.station.hubpane", "1"); } catch (_) {} });
const page = await context.newPage();
await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof S !== "undefined" && S.fav && S.fav.length > 50 && document.querySelectorAll('[data-act="row"][data-t]').length > 50, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-act="row"][data-t]').click());
await page.waitForFunction(() => document.body.classList.contains("co-exp") && document.querySelectorAll("#cvRail .cv-rail__r").length > 50, null, { timeout: 30000 });
await sleep(2500);
const st = () => page.evaluate(() => { const r = el("cvRail"), rows = r.querySelectorAll(".cv-rail__r"), last = rows[rows.length - 1];
  const lb = last.getBoundingClientRect(), rb = r.getBoundingClientRect();
  return { top: Math.round(r.scrollTop), left: Math.round(r.scrollLeft), maxTop: r.scrollHeight - r.clientHeight, maxLeft: r.scrollWidth - r.clientWidth,
    page: document.scrollingElement.scrollTop, main: el("main").scrollTop, rows: rows.length, lastT: last.dataset.t,
    lastVisible: lb.left >= rb.left - 1 && lb.right <= rb.right + 1 && lb.top >= rb.top - 1 && lb.bottom <= rb.bottom + 1 }; });
const R = { width, start: await st() };
const box = await page.evaluate(() => { const b = el("cvRail").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; });
if (width < 600) {
  const cdp = await context.newCDPSession(page);
  for (let i = 0; i < 40; i++) await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(box.x), y: Math.round(box.y), xDistance: -Math.round(box.w * 0.8), yDistance: 0, gestureSourceType: "touch", speed: 3000, preventFling: true });
} else {
  await page.mouse.move(box.x, box.y);
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 100); await sleep(20); }
}
R.atEnd = await st();
await sleep(3000);
R.after3s = await st();
await page.screenshot({ path: outp + ".png" });
if (width < 600) {
  const cdp = await context.newCDPSession(page);
  for (let i = 0; i < 48; i++) await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(box.x), y: Math.round(box.y), xDistance: Math.round(box.w * 0.8), yDistance: 0, gestureSourceType: "touch", speed: 3000, preventFling: true });
  R.back = await st();
}
fs.writeFileSync(outp + ".json", JSON.stringify(R, null, 1));
console.log(JSON.stringify(R));
await browser.close(); server.close();
