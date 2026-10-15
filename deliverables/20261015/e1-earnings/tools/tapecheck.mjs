import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [hubRoot, outPrefix] = process.argv.slice(2);
const S = "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/fd3adf3c-9b73-4014-b745-3e7fcbb6d5d4/scratchpad";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
const b = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars"] });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
await ctx.route("**/*", (route) => { const r = route.request(), u = new URL(r.url()), m = r.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "[]" });
  if (u.host === "scintillahub.ai" && !u.pathname.startsWith("/api/")) { let f = path.join(hubRoot, u.pathname === "/" ? "index.html" : u.pathname); if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); return route.fulfill({ status: 404, body: "" }); }
  return route.continue(); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 160)));
const probe = () => p.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)]; const txt = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
  return { sec: S.sec, topTapeTrin: q("#topTapeSlot .ern-trin").length, topTapeItemsWithTrin: q("#topTapeSlot .ern-ec, #topTapeSlot .ern-it").filter((e) => e.querySelector(".ern-trin")).map((e) => txt(e)).slice(0, 6),
    roomTapeTrin: q("#ernRoomTape .ern-trin").length, roomTrinItems: q("#ernRoomTape .ern-ec").filter((e) => e.querySelector(".ern-trin")).map((e) => txt(e)).slice(0, 6),
    chips: q(".ern-trchip").map((e) => txt(e)), TR_NEW: (typeof TR_NEW !== "undefined" ? TR_NEW.map((x) => x.ticker + " " + x.quarter + " " + new Date(x.at).toISOString()) : null), stripH: (document.getElementById("ernTrNew") || { offsetHeight: null }).offsetHeight,
    topTapeRect: (() => { const e = document.getElementById("topTape"); if (!e) return null; const r = e.getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height) }; })() }; });
await p.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(12000);
const dash = await probe(); console.log("DASHBOARD", JSON.stringify(dash));
if (dash.topTapeRect) await p.screenshot({ path: `${S}/shots/${outPrefix}-toptape.png`, clip: { x: 0, y: Math.max(0, dash.topTapeRect.y - 4), width: 1680, height: Math.min(80, dash.topTapeRect.h + 8) } });
await p.goto("https://scintillahub.ai/#earnings", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(10000);
const room = await probe(); console.log("ROOM", JSON.stringify(room));
const r = await p.evaluate(() => { const e = document.getElementById("ernTrNew"); if (!e) return null; const b = e.getBoundingClientRect(); return { y: Math.round(b.top), h: Math.round(b.height) }; });
if (r && r.h) await p.screenshot({ path: `${S}/shots/${outPrefix}-trstrip.png`, clip: { x: 0, y: r.y - 50, width: 1680, height: r.h + 60 } });
console.log("errors", JSON.stringify(errs.slice(0, 5)));
await b.close();
