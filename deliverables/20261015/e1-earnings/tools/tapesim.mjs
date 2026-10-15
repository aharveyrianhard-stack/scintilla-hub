/* proves the wiring of the "transcript in" flash on the dashboard's top tape WITHOUT any database write: a transcript row for a
   name on today's tape is placed in TR_NEW in the page, the tape is re-rendered, and the mark + the one-shot scintillation are read back */
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [hubRoot] = process.argv.slice(2); const S = "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/fd3adf3c-9b73-4014-b745-3e7fcbb6d5d4/scratchpad";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css" };
const b = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars"] });
const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, serviceWorkers: "block" });
await ctx.route("**/*", (route) => { const r = route.request(), u = new URL(r.url()), m = r.method();
  if (m !== "GET" && m !== "HEAD" && m !== "OPTIONS") return route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" }, body: "[]" });
  if (u.host === "scintillahub.ai" && !u.pathname.startsWith("/api/")) { let f = path.join(hubRoot, u.pathname === "/" ? "index.html" : u.pathname); if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, headers: { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }, body: fs.readFileSync(f) }); return route.fulfill({ status: 404, body: "" }); }
  return route.continue(); });
const p = await ctx.newPage();
await p.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(12000);
const r = await p.evaluate(() => {
  const txt = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
  const names = [...document.querySelectorAll("#topTapeSlot .ern-ec[data-t]")].map((e) => e.dataset.t);
  const t = names.find((n) => (ERN_ROWS || []).some((r) => r.ticker === n && r.date === todayISO())) || names[0];
  const row = (ERN_ROWS || []).find((r) => r.ticker === t) || null;
  if (!row) return { names, t, err: "no row" };
  const before = document.querySelectorAll("#topTapeSlot .ern-trin").length;
  /* the simulated arrival: the call held on the report day, stored one minute ago */
  TR_NEW = [{ ticker: t, quarter: "Q3 2026", call_date: row.date, at: Date.now() - 60e3, key: t + "|" + row.date + "|sim" }];
  renderTopTape(Math.floor(Date.now() / 1000));
  const items = [...document.querySelectorAll("#topTapeSlot .ern-ec[data-t='" + t + "']")];
  const marks = items.map((e) => e.querySelector(".ern-trin")).filter(Boolean);
  const r = document.getElementById("topTape").getBoundingClientRect();
  return { t, names: names.slice(0, 8), before, after: document.querySelectorAll("#topTapeSlot .ern-trin").length, markText: marks[0] ? txt(marks[0]) : null, markTitle: marks[0] ? marks[0].title : null,
    flashed: marks.map((m) => !!m.__scintDone), animated: marks.map((m) => typeof m.getAnimations === "function" ? m.getAnimations().length : null), tape: { y: Math.round(r.top), h: Math.round(r.height) } };
});
console.log(JSON.stringify(r));
if (r.tape) await p.screenshot({ path: `${S}/shots/after-1680-toptape-sim.png`, clip: { x: 0, y: Math.max(0, r.tape.y - 2), width: 1680, height: r.tape.h + 4 } });
await b.close();
