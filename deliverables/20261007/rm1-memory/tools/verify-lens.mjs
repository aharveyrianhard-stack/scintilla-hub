// RM1 — is the context lens placed where it was? The live Station and the branch's, side by side, same scene, same moment.
// For every chart on the wall: its name, whether the lens is showing, and the lens's box. And the buffers each page holds.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return ""; } };
const map = JSON.parse(fs.readFileSync("override-station.json", "utf8"));
const SCENE = process.argv[2] || "sectorFamilies";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
try {
  const open = async (branch) => {
    const overrides = new Map(branch ? Object.entries(map).map(([u, f]) => [urlKey(u), f]) : []);
    const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
    await context.route("**/*", (route) => {
      const req = route.request(), local = overrides.get(urlKey(req.url()));
      if (req.method() !== "GET") return route.abort("blockedbyclient");
      if (local) return route.fulfill({ status: 200, contentType: /\.m?js$/.test(local) ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto("https://station.scintillahub.ai/deck/?scene=" + SCENE, { waitUntil: "load", timeout: 120000 });
    return { page, cdp: await context.newCDPSession(page) };
  };
  const [live, branch] = await Promise.all([open(false), open(true)]);
  await new Promise((r) => setTimeout(r, 45000));
  const read = async ({ page, cdp }) => {
    // hold the rotation still for the reading: both pages are read within the same second
    const charts = [];
    for (const f of page.frames()) {
      if (!/\/station-shells\/chart-v1/.test(f.url())) continue;
      try {
        const r = await f.evaluate(() => {
          const host = document.querySelector("#chartSlot .sc-nchart"), lens = host && host.querySelector(".sc-nchart__lens"), area = host && host.querySelector(".sc-nchart__area");
          const visible = !!(window.frameElement && !/slot-spare|slot-next/.test(window.frameElement.className) && window.frameElement.offsetWidth > 0);
          return { t: host ? host.dataset.t : null, range: host ? host._range || null : null, onWall: visible, pane: area ? [area.clientWidth, area.clientHeight] : null,
            lens: lens && lens.style.display !== "none" && lens.width > 0 ? [Math.round(parseFloat(lens.style.left)), Math.round(parseFloat(lens.style.top)), Math.round(parseFloat(lens.style.width)), Math.round(parseFloat(lens.style.height))] : null,
            why: lens ? lens.dataset.why || null : null, copyBytes: host && host._inkAt ? (typeof host._inkAt.held === "function" ? host._inkAt.held() : "kept (live has no meter)") : 0 };
        });
        if (r.t) charts.push(r);
      } catch (_) {}
    }
    await cdp.send("HeapProfiler.enable"); await cdp.send("HeapProfiler.collectGarbage"); await new Promise((r) => setTimeout(r, 500)); await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    return { charts, buffersMB: +(heap.backingStorageSize / 1048576).toFixed(1), heapMB: +(heap.usedSize / 1048576).toFixed(1), scene: await page.evaluate(() => SCENE + " · " + RANGE + " · " + CHART_COUNT + " charts") };
  };
  const [a, b] = await Promise.all([read(live), read(branch)]);
  console.log("live:   " + a.scene + " · buffers " + a.buffersMB + " MB · JS heap " + a.heapMB + " MB");
  console.log("branch: " + b.scene + " · buffers " + b.buffersMB + " MB · JS heap " + b.heapMB + " MB");
  let same = 0, differ = 0, both = 0;
  const key = (c) => c.t + "|" + c.range + "|" + (c.pane || []).join("x");
  for (const c of a.charts.filter((c) => c.onWall)) {
    const d = b.charts.find((x) => x.onWall && key(x) === key(c));
    if (!d) { console.log("  " + String(c.t).padEnd(6) + " on the live wall only at this instant (the wall rotates)"); continue; }
    both++;
    const eq = JSON.stringify(c.lens) === JSON.stringify(d.lens);
    if (eq) same++; else differ++;
    console.log("  " + String(c.t).padEnd(6) + " pane " + (c.pane || []).join("x").padEnd(9) + " lens live " + JSON.stringify(c.lens).padEnd(22) + " branch " + JSON.stringify(d.lens).padEnd(22) + (eq ? " SAME" : " DIFFERENT") + "   copy held: live " + c.copyBytes + " · branch " + d.copyBytes + " bytes");
  }
  console.log("charts on both walls: " + both + " · lens in the same place: " + same + " · different: " + differ);
  await live.page.screenshot({ path: "shots/lens-live.jpg", type: "jpeg", quality: 70 }); await branch.page.screenshot({ path: "shots/lens-branch.jpg", type: "jpeg", quality: 70 });
} finally { await browser.close(); }
