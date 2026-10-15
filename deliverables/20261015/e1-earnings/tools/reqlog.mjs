/* list every request the EARNINGS room makes on a cold load (live), grouped by table/path, with ms and bytes */
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const b = await chromium.launch({ headless: true, args: ["--disable-gpu"] });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
await ctx.route("**/*", (route) => { const m = route.request().method(); if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "[]" }); return route.continue(); });
const p = await ctx.newPage(); const t0 = Date.now(); const st = new Map(); const rows = [];
p.on("request", (r) => st.set(r, Date.now()));
p.on("requestfinished", async (r) => { const s = st.get(r); let bytes = 0; try { bytes = (await r.sizes()).responseBodySize; } catch (_) {} rows.push({ u: r.url(), start: s - t0, ms: Date.now() - s, bytes }); });
await p.goto("https://scintillahub.ai/#earnings", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(15000);
const grp = {};
for (const r of rows) { const u = new URL(r.u); let k = u.host + u.pathname; if (/supabase/.test(u.host)) k = "supabase " + u.pathname.replace("/rest/v1/", ""); grp[k] = grp[k] || { n: 0, ms: 0, bytes: 0, first: r.start, maxms: 0 }; const g = grp[k]; g.n++; g.ms += r.ms; g.bytes += r.bytes; g.maxms = Math.max(g.maxms, r.ms); g.first = Math.min(g.first, r.start); }
const list = Object.entries(grp).sort((a, b) => b[1].bytes - a[1].bytes);
console.log("total requests", rows.length, "bytes", rows.reduce((a, r) => a + r.bytes, 0));
for (const [k, g] of list.slice(0, 40)) console.log(String(g.n).padStart(3), String(g.bytes).padStart(8), "B", String(g.maxms).padStart(5), "ms max", String(g.first).padStart(6), "ms first", k.slice(0, 110));
console.log("--- earnings-related in detail");
for (const r of rows.filter((r) => /earnings|transcript|cohorts|company_profile/.test(r.u))) console.log(r.start, r.ms + "ms", r.bytes + "B", r.u.replace(/^https:\/\/[^/]+\/rest\/v1\//, "").slice(0, 170));
await b.close();
