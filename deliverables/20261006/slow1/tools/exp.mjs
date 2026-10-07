import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const url = process.argv[2]; const variants = JSON.parse(process.argv[3]);
const b = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 } });
await ctx.route("**/*", (r) => r.request().method() === "GET" ? r.continue() : r.abort());
const p = await ctx.newPage(); await p.goto(url, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(12000);
if (process.env.PRE) await p.evaluate(process.env.PRE); const cdp = await ctx.newCDPSession(p); await cdp.send("Performance.enable");
const bs = await b.newBrowserCDPSession();
const measure = async (ms) => { const ev = []; const h = (d) => ev.push(...d.value); bs.on("Tracing.dataCollected", h);
  const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  await bs.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline"] } }); await p.waitForTimeout(ms);
  const done = new Promise((r) => bs.once("Tracing.tracingComplete", r)); await bs.send("Tracing.end"); await done; bs.off("Tracing.dataCollected", h);
  const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const s = {}; for (const e of ev) if (e.ph === "X" && e.dur) { (s[e.name] ||= [0, 0]); s[e.name][0]++; s[e.name][1] += e.dur / 1000; }
  const g = (k) => s[k] ? `${Math.round(s[k][1])}ms/${s[k][0]}` : "0";
  return `mainBusy ${(((m1.TaskDuration - m0.TaskDuration) / (ms / 1000)) * 100).toFixed(1)}%  Layout ${g("Layout")}  Style ${g("UpdateLayoutTree")}  Paint ${g("Paint")}  Layerize ${g("Layerize")}  PrePaint ${g("PrePaint")}  Commit ${g("Commit")}  Raster ${g("RasterTask")}`; };
for (const [name, css] of variants) { const h = css ? await p.addStyleTag({ content: css }) : null; await p.waitForTimeout(1500); console.log(name.padEnd(34), await measure(10000)); if (h) await h.evaluate((n) => n.remove()); }
await b.close();
