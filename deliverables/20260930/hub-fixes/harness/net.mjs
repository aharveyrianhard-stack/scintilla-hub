import { serve, open, sleep } from "./rig.mjs";
const [root] = process.argv.slice(2);
const { server, origin } = await serve(root);
const log = [];
const { browser, context } = await open({ width: 1680, log });
await context.addInitScript(() => { if (window.top !== window) return;
  const of = window.fetch; window.__stk = [];
  window.fetch = function (u, o) { const s = String(u && u.url || u); if (/candles\?symbol=.*limit=13|sparklines/.test(s)) { if (window.__stk.length < 3) window.__stk.push(s + "\n" + new Error().stack.split("\n").slice(1, 6).join("\n")); } return of.apply(this, arguments); };
});
const page = await context.newPage();
const t0 = Date.now();
await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
await sleep(25000);
const stk = await page.evaluate(() => window.__stk);
const groups = {};
for (const x of log) { const k = x.path.replace(/symbol=[^&]+/, "symbol=X"); (groups[k] = groups[k] || []).push(x); }
for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
  const ms = v.map((x) => x.ms).sort((a, b) => a - b);
  console.log(v.length, k, "median", ms[ms.length >> 1], "p90", ms[Math.floor(ms.length * .9)], "first@", v[0].at - t0, "last@", Math.max(...v.map((x) => x.end)) - t0);
}
console.log(stk.join("\n----\n"));
await browser.close(); server.close();
