/* X1 · one read of the live board's % change per row (field r.c), headless, every non-GET aborted. → shots/state-chg.json */
import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json"); const { chromium } = require("playwright-core");
const EXE = process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
try { const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } }); const blocked = [];
  await ctx.route("**/*", (r) => (["GET", "HEAD", "OPTIONS"].includes(r.request().method()) ? r.continue() : (blocked.push(r.request().method()), r.abort())));
  const page = await ctx.newPage(); await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof S !== "undefined" && window.SC_RANK_READY && document.querySelectorAll("#boardPanel .sc-board__row[data-t]").length > 5, null, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 6000));
  const out = await page.evaluate(() => ({ at: new Date().toISOString(), keys: Object.keys(S.rows[1] || {}), chg: Object.fromEntries((S.rows || []).map((r) => [r.t, r.c == null ? null : +r.c])), price: Object.fromEntries((S.rows || []).map((r) => [r.t, r.p ?? r.price ?? null])) }));
  fs.writeFileSync("shots/state-chg.json", JSON.stringify(out)); console.log("rows", Object.keys(out.chg).length, "with chg", Object.values(out.chg).filter((v) => v != null).length, "keys", out.keys.join(","), "blocked", blocked.length);
} finally { await browser.close(); }
