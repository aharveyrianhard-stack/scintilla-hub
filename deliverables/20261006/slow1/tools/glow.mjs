import { createRequire } from "node:module"; import fs from "node:fs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const b = await chromium.launch({ headless: true });
for (const [name, file] of [["live", null], ["branch", "/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-slow1-20261006/index.html"]]) {
  const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 4 });
  await ctx.route("**/*", (r) => { const q = r.request(); if (q.method() !== "GET") return r.abort(); const u = new URL(q.url());
    if (file && u.origin === "https://scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html")) return r.fulfill({ path: file, contentType: "text/html; charset=utf-8" }); return r.continue(); });
  const p = await ctx.newPage(); await p.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" }); await p.waitForSelector(".sc-rsi.is-xt", { timeout: 40000 }).catch(() => {}); await p.waitForTimeout(2500);
  const info = await p.evaluate(() => { const c = document.querySelector(".sc-rsi.is-xt"); if (!c) return null; c.scrollIntoView({ block: "center" });
    const all = document.getAnimations().filter((a) => a.animationName === "rsi-xt"); const r0 = c.getBoundingClientRect();
    return { n: document.querySelectorAll(".sc-rsi.is-xt").length, anims: all.length, id: c.id, txt: c.textContent, dv: c.getAttribute("data-v"), rect: [r0.x, r0.y, r0.width, r0.height].map(Math.round), after: getComputedStyle(c, "::after").content }; });
  console.log(name, JSON.stringify(info)); if (!info) continue;
  for (const [ph, t] of [["trough", 0], ["peak", 2000]]) { await p.evaluate((t) => { for (const a of document.getAnimations()) if (a.animationName === "rsi-xt") { a.pause(); a.currentTime = t; } }, t); await p.waitForTimeout(250);
    const r = await p.evaluate((id) => { const x = document.getElementById(id).getBoundingClientRect(); return { x: x.x - 14, y: x.y - 10, width: x.width + 28, height: x.height + 20 }; }, info.id);
    await p.screenshot({ path: `probe/glow-${name}-${ph}.png`, clip: r }); }
  await ctx.close(); }
await b.close();
