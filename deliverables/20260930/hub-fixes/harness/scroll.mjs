// Item 1 — the LIKED rail in the expanded view: wheel, trackpad (many small deltas), touch, over the list, over the
// chart, at both ends. Records the rail's scrollTop and the page's scroll on a timeline and afterwards watches 20 s for a
// snap-back (a live tick of the open name re-centres the rail on it).
// usage: node scroll.mjs <hubRoot> <outJson> [width]
import { serve, open, sleep } from "./rig.mjs";
import fs from "node:fs";
const [root, out, W] = process.argv.slice(2);
const width = +(W || 1680);
const { server, origin } = await serve(root);
const blocked = [];
const { browser, context } = await open({ width, blocked });
await context.addInitScript(() => { try { localStorage.setItem("hub.company.expanded", "1"); localStorage.setItem("hub.chart.range", "1D"); } catch (_) {} });
const page = await context.newPage();
const R = { width, root, steps: [] };
await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof S !== "undefined" && S.fav && S.fav.length > 50 && document.querySelectorAll('.ch[data-act="row"],[data-act="row"]').length > 50, null, { timeout: 60000 });
R.liked = await page.evaluate(() => S.fav.length);
// open the first name on the board → expanded view (EXPAND remembered on)
await page.evaluate(() => { const r = document.querySelector('[data-act="row"][data-t]'); r.click(); });
await page.waitForFunction(() => document.body.classList.contains("co-exp") && document.querySelectorAll("#cvRail .cv-rail__r").length > 50, null, { timeout: 30000 });
await sleep(1500);
const st = () => page.evaluate(() => { const r = document.getElementById("cvRail"), se = document.scrollingElement;
  const on = r.querySelector(".cv-rail__r.on"); const rows = r.querySelectorAll(".cv-rail__r");
  const last = rows[rows.length - 1], lb = last.getBoundingClientRect(), rb = r.getBoundingClientRect();
  return { t: performance.now() | 0, rail: Math.round(r.scrollTop), railMax: r.scrollHeight - r.clientHeight, page: se.scrollTop, pageMax: se.scrollHeight - se.clientHeight,
    main: Math.round(document.getElementById("main").scrollTop), rows: rows.length, open: on && on.dataset.t,
    lastRowVisible: lb.bottom <= rb.bottom + 1 && lb.top >= rb.top, overscroll: getComputedStyle(r).overscrollBehaviorY };
});
const box = await page.evaluate(() => { const b = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; };
  return { rail: b("cvRail"), chart: b("cvChart") }; });
R.box = box; R.start = await st();
// find every ancestor that scrolls, for the record
R.scrollers = await page.evaluate(() => { const o = []; let n = document.getElementById("cvRail").parentElement;
  while (n) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) o.push((n.id ? "#" + n.id : n.tagName.toLowerCase()) + "." + [...n.classList].join(".") + " " + n.scrollHeight + "/" + n.clientHeight); n = n.parentElement; }
  const se = document.scrollingElement; o.push("scrollingElement " + se.scrollHeight + "/" + se.clientHeight); return o; });
const cdp = await context.newCDPSession(page);
async function run(name, fn, watchMs = 0) {
  const before = await st(); const tl = [before];
  let stop = false; const sampler = (async () => { while (!stop) { await sleep(120); tl.push(await st()); } })();
  await fn(); await sleep(400);
  const after = await st();
  let snap = null;
  if (watchMs) { const until = Date.now() + watchMs; while (Date.now() < until) { await sleep(250); const s = await st(); if (Math.abs(s.rail - after.rail) > 30 && !snap) snap = { afterMs: Math.round(s.t - after.t), from: after.rail, to: s.rail }; } }
  stop = true; await sampler;
  const end = await st();
  const step = { name, before, after, end, snapBack: snap, pageMoved: after.page !== before.page || end.page !== before.page || after.main !== before.main || end.main !== before.main,
    maxPage: Math.max(...tl.map((x) => x.page)), maxMain: Math.max(...tl.map((x) => x.main)), railPath: tl.map((x) => x.rail).filter((v, i, a) => i === 0 || v !== a[i - 1]).slice(0, 60) };
  R.steps.push(step); console.log(name, JSON.stringify({ rail: [before.rail, after.rail, end.rail], max: after.railMax, page: [before.page, after.page, end.page], main: [before.main, after.main, end.main], maxMain: Math.max(...tl.map((x) => x.main)), last: after.lastRowVisible, snap }));
  return step;
}
const X = box.rail.x, Y = box.rail.y;
// 1 wheel (mouse notches of 100 px) down over the list, to the end and past it
await run("wheel-down-over-list", async () => { await page.mouse.move(X, Y); for (let i = 0; i < 80; i++) { await page.mouse.wheel(0, 100); await sleep(30); } }, 20000);
// 2 keep wheeling at the bottom end: must not move the page
await run("wheel-past-bottom", async () => { for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 100); await sleep(30); } });
// 3 wheel up to the top and past it
await run("wheel-up-over-list", async () => { for (let i = 0; i < 100; i++) { await page.mouse.wheel(0, -100); await sleep(30); } }, 3000);
// 4 trackpad: many small pixel deltas (a precise two-finger swipe), down then up
await run("trackpad-down", async () => { for (let i = 0; i < 400; i++) { await page.mouse.wheel(0, 18); await sleep(8); } }, 20000);
await run("trackpad-up", async () => { for (let i = 0; i < 400; i++) { await page.mouse.wheel(0, -18); await sleep(8); } });
// 5 touch: finger swipes over the list (synthesized touch scroll gestures), down then up
await run("touch-down", async () => { for (let i = 0; i < 13; i++) await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(X), y: Math.round(Y), yDistance: -Math.round(box.rail.h * 0.8), gestureSourceType: "touch", speed: 1500, preventFling: true }); }, 20000);
await run("touch-up", async () => { for (let i = 0; i < 13; i++) await cdp.send("Input.synthesizeScrollGesture", { x: Math.round(X), y: Math.round(Y), yDistance: Math.round(box.rail.h * 0.8), gestureSourceType: "touch", speed: 1500, preventFling: true }); });
// 6 wheel over the chart: the chart frame takes it (zoom), the rail and the page stay put
await run("wheel-over-chart", async () => { await page.mouse.move(box.chart.x, box.chart.y); for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 100); await sleep(40); } });
// 7 scroll down part way, then wait a full minute of live ticks: does the list stay where it was left?
await page.mouse.move(X, Y);
await run("park-mid-list-60s", async () => { for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 100); await sleep(30); } }, 60000);
R.blocked = blocked;
await page.screenshot({ path: out.replace(/\.json$/, ".png") });
fs.writeFileSync(out, JSON.stringify(R, null, 1));
await browser.close(); server.close();
console.log("liked", R.liked, "scrollers", R.scrollers, "blocked", blocked.length);
