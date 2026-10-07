// RM1 — how many headlines does the news table gain a day? Read through the Hub's own read helper (GET only).
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", (route) => route.request().method() === "GET" ? route.continue() : route.abort("blockedbyclient"));
  const page = await context.newPage();
  await page.goto("https://scintillahub.ai/", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 12000));
  const out = await page.evaluate(async () => {
    const now = Math.floor(Date.now() / 1000), res = {};
    for (const [label, from, to] of [["last 1 h", now - 3600, now], ["last 24 h", now - 86400, now], ["24-48 h ago", now - 172800, now - 86400]]) {
      let n = 0, favN = 0, offset = 0;
      const fav = new Set((typeof listMembers === "function" && typeof S !== "undefined" ? listMembers(S.coh) : []) || []);
      for (;;) {
        const rows = await pg("news?select=ticker,published_ts&published_ts=gte." + from + "&published_ts=lt." + to + "&order=published_ts.desc&limit=1000&offset=" + offset);
        if (!Array.isArray(rows) || !rows.length) break;
        n += rows.length; for (const r of rows) if (fav.has(String(r.ticker).toUpperCase())) favN++;
        if (rows.length < 1000 || offset > 60000) break; offset += 1000;
      }
      res[label] = { all: n, onTheBootList: favN };
    }
    return { scope: typeof S !== "undefined" ? S.coh : null, res };
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); }
