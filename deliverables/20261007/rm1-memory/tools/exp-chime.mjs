// RM1 experiment — the Hub's own chime and alarm, live page and branch page side by side for ten minutes.
// Counts every sound channel each page opens, how many it closes, and how many are still alive at the end
// (after a forced clean-up, counted in the page's memory picture).
// The chart API is NOT read by these two pages (those requests are refused here): the chime only needs the news
// reads, and this test must put no load on the live price path. Refusing the price reads also makes each page
// raise its feed-down alarm once, which is the second place a channel is opened.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const MINUTES = Number(process.argv[2] || 10);
const urlKey = (u) => { try { const x = new URL(u); return x.host + x.pathname; } catch (_) { return ""; } };
const map = JSON.parse(fs.readFileSync("override-hub-wt.json", "utf8"));
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"] });
try {
  const open = async (branch) => {
    const overrides = new Map(branch ? Object.entries(map).map(([u, f]) => [urlKey(u), f]) : []);
    const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
    await context.addInitScript(() => {
      const count = (window.__channels = { opened: 0, closed: 0 });
      const Real = window.AudioContext;
      if (!Real) return;
      const close = Real.prototype.close;
      Real.prototype.close = function () { count.closed++; return close.apply(this, arguments); };
      window.AudioContext = new Proxy(Real, { construct(target, args) { count.opened++; return new target(...args); } });
    });
    let refused = 0;
    await context.route("**/*", (route) => {
      const req = route.request(), local = overrides.get(urlKey(req.url()));
      if (req.method() !== "GET") return route.abort("blockedbyclient");
      if (/scintilla-massive-chart-api\.fly\.dev$/.test(new URL(req.url()).hostname)) { refused++; return route.abort("blockedbyclient"); }
      if (local) return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "cache-control": "no-store" }, body: fs.readFileSync(local) });
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto("https://scintillahub.ai/", { waitUntil: "load", timeout: 120000 });
    return { page, cdp: await context.newCDPSession(page), refused: () => refused };
  };
  const [live, branch] = await Promise.all([open(false), open(true)]);
  const t0 = Date.now();
  const read = async ({ page, cdp }) => {
    await cdp.send("HeapProfiler.enable"); await cdp.send("HeapProfiler.collectGarbage"); await new Promise((r) => setTimeout(r, 1200)); await cdp.send("HeapProfiler.collectGarbage");
    let text = ""; const on = ({ chunk }) => { text += chunk; };
    cdp.on("HeapProfiler.addHeapSnapshotChunk", on); await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false }); cdp.off("HeapProfiler.addHeapSnapshotChunk", on);
    const snap = JSON.parse(text), nf = snap.snapshot.meta.node_fields, NF = nf.length, oName = nf.indexOf("name"), oType = nf.indexOf("type"), types = snap.snapshot.meta.node_types[oType];
    let alive = 0; for (let i = 0; i < snap.nodes.length; i += NF) if (types[snap.nodes[i + oType]] === "native" && snap.strings[snap.nodes[i + oName]] === "AudioContext") alive++;
    const c = await page.evaluate(() => ({ ...window.__channels, alerts: (document.querySelectorAll("#alertList .sc-alert") || []).length, title: document.title }));
    return { ...c, alive };
  };
  console.log("minute   live: opened / closed / alive      branch: opened / closed / alive      (alerts in the bell: live, branch)");
  for (let i = 0; i <= MINUTES; i += 2) {
    const wait = t0 + i * 60000 + 20000 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const [a, b] = await Promise.all([read(live), read(branch)]);
    console.log(String(i).padStart(4) + "        " + String(a.opened).padStart(6) + " / " + String(a.closed).padStart(6) + " / " + String(a.alive).padStart(5) + "                " + String(b.opened).padStart(6) + " / " + String(b.closed).padStart(6) + " / " + String(b.alive).padStart(5) + "              (" + a.alerts + ", " + b.alerts + ")" + (i === MINUTES ? "   titles: " + JSON.stringify(a.title) + " / " + JSON.stringify(b.title) : ""));
    if (i === MINUTES) console.log(`after ${MINUTES} minutes: the live page opened ${a.opened} sound channels, closed ${a.closed}, and ${a.alive} are still alive; the branch opened ${b.opened}, closed ${b.closed}, and ${b.alive} are still alive`);
  }
  console.log("price reads refused here (none reached the chart API): live page " + live.refused() + ", branch page " + branch.refused());
} finally { await browser.close(); }
