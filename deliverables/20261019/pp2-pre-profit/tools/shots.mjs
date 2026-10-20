// Headless only. Opens the local page file, blocks every network request (the page needs none), and writes the pictures:
// first screen at 1680 and 390, the ranked table (two screens), four cards and the failers section at 1680, plus a report.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const [page_path, out_dir] = process.argv.slice(2);
const CARDS = (process.argv[4] || "NBIS,CBRS,IREN,AAOI").split(",");
const browser = await chromium.launch({ headless: true });
let blocked = 0, errors = [];
const report = {};
try {
  for (const [w, name] of [[1680, "1680"], [390, "390"]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1 });
    await ctx.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith("file:")) return r.continue(); blocked++; return r.abort(); });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await p.goto("file://" + encodeURI(page_path));
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => {
      const de = document.documentElement;
      const small = [...document.querySelectorAll("body *")].filter((e) => e.children.length === 0 && e.textContent.trim().length > 0)
        .map((e) => parseFloat(getComputedStyle(e).fontSize)).reduce((a, b) => Math.min(a, b), 99);
      const txt = document.body.innerText;
      const bad = (txt.match(/\b(None|undefined|NaN|nan|null)\b/g) || []).length;
      return { height: de.scrollHeight, width: de.scrollWidth, client: de.clientWidth, smallest_font: small, bad_strings: bad,
               tables: document.querySelectorAll("table").length, cards: document.querySelectorAll(".card").length, rank_rows: document.querySelectorAll("table.rank tbody tr").length, ready: de.dataset.ready };
    });
    report[name] = m;
    await p.screenshot({ path: `${out_dir}/pp2-0-first-screen-${name}.png` });
    if (name === "1680") {
      const shot = async (sel, label, dy = -10, tall = false) => {
        const el = await p.$(sel); if (!el) return;
        await el.scrollIntoViewIfNeeded(); await p.evaluate((d) => window.scrollBy(0, d), dy); await p.waitForTimeout(150);
        if (tall) { const bb = await el.boundingBox(); await p.screenshot({ path: `${out_dir}/${label}.png`, clip: { x: 0, y: bb.y + window.scrollY, width: 1680, height: Math.min(bb.height + 20, 6000) }, fullPage: true }); }
        else await p.screenshot({ path: `${out_dir}/${label}.png` });
      };
      // the ranked table in full (element screenshot)
      const rank = await p.$("#rank + p + div.wrap"); if (rank) await rank.screenshot({ path: `${out_dir}/pp2-1-ranked-table-1680.png` });
      const two = await p.$("div.two"); if (two) await two.screenshot({ path: `${out_dir}/pp2-1b-five-and-five-1680.png` });
      for (const t of CARDS) { const el = await p.$(`#n-${t}`); if (el) await el.screenshot({ path: `${out_dir}/pp2-2-card-${t}-1680.png` }); }
      const cb = await p.$("#classb + p + div.wrap"); if (cb) await cb.screenshot({ path: `${out_dir}/pp2-3-class-b-1680.png` });
      const fl = await p.$("#failers + ul"); if (fl) await fl.screenshot({ path: `${out_dir}/pp2-4-cash-filter-failers-1680.png` });
    }
    await ctx.close();
  }
} finally { await browser.close(); }
report.blocked_requests = blocked; report.page_errors = errors;
fs.writeFileSync(`${out_dir}/_report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
