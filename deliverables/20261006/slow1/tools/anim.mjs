import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const url = process.argv[2]; const setup = process.argv[3];
const b = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 } });
await ctx.route("**/*", (r) => r.request().method() === "GET" ? r.continue() : r.abort());
const p = await ctx.newPage(); await p.goto(url, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(9000);
if (setup) { const s = await import("./setups.mjs"); await s[setup](p); }
for (const f of p.frames()) { try {
  const r = await f.evaluate(() => { const o = {}; for (const a of document.getAnimations()) { const e = a.effect, t = e && e.target; const tm = e.getComputedTiming(); const props = [...new Set(e.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !["offset", "easing", "composite", "computedOffset"].includes(x))))].join("+");
      const vis = t ? (() => { const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; })() : false;
      const k = `${a.animationName || a.transitionProperty || a.constructor.name} [${props}] ${tm.iterations === Infinity ? "INFINITE" : "x" + tm.iterations} ${Math.round(tm.duration)}ms on ${t ? t.tagName.toLowerCase() + "." + String(t.className.baseVal ?? t.className).split(" ").slice(0, 2).join(".") + (e.pseudoElement || "") : "?"} state=${a.playState}`; (o[k] ||= { n: 0, vis: 0 }); o[k].n++; if (vis) o[k].vis++; } return o; });
  const e = Object.entries(r); if (e.length) { console.log("FRAME", f.url().slice(0, 90)); for (const [k, v] of e.sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(v.n).padStart(4)} (${v.vis} on screen)  ${k}`); } } catch {} }
await b.close();
