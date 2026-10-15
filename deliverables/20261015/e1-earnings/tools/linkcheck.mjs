import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const S = "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/fd3adf3c-9b73-4014-b745-3e7fcbb6d5d4/scratchpad";
const urls = [
  ["jpm-call-businesswire", "https://www.businesswire.com/news/home/20260917326544/en/JPMorganChase-to-Host-Third-Quarter-2026-Earnings-Call/"],
  ["bac-call-prnewswire", "https://www.prnewswire.com/news-releases/bank-of-america-to-report-third-quarter-2026-financial-results-and-host-investor-conference-call-on-october-14-302893974.html"],
  ["tsm-ir", "https://investor.tsmc.com/english"],
];
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36" });
for (const [name, u] of urls) {
  const p = await ctx.newPage(); const hops = [];
  p.on("response", (r) => { if (r.request().isNavigationRequest() && r.frame() === p.mainFrame()) hops.push(r.status() + " " + r.url().slice(0, 160)); });
  try { await p.goto(u, { waitUntil: "domcontentloaded", timeout: 45000 }); await p.waitForTimeout(4000); } catch (e) { hops.push("ERR " + String(e.message).slice(0, 120)); }
  const info = await p.evaluate(() => ({ url: location.href.slice(0, 200), title: document.title.slice(0, 160), h1: (document.querySelector("h1") || {}).innerText || "", hasSearchBox: !!document.querySelector('input[type="search"], input[name*="search" i], form[action*="search" i]'), text: document.body.innerText.replace(/\s+/g, " ").slice(0, 500) })).catch(() => null);
  await p.screenshot({ path: `${S}/shots/link-${name}.png` }).catch(() => {});
  console.log(JSON.stringify({ name, hops, info }));
  await p.close();
}
await b.close();
