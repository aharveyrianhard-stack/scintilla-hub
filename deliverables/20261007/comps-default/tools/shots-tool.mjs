/* CP5 · pictures of the allocation tool's click-through as the tool's branch would show it — headless, one page at a time, served
   from the tool's own folder by its test harness (every request that is not a read is blocked and counted).
     node shots-tool.mjs <toolRoot> <outDir>                                                                             */
import path from "node:path"; import fs from "node:fs";
const [toolArg, outArg] = process.argv.slice(2), TOOL = path.resolve(toolArg), OUT = path.resolve(outArg); fs.mkdirSync(OUT, { recursive: true });
const { openPage } = await import(TOOL + "/tests/_harness.mjs"); const facts = [];
for (const [w, h, sym, file, core] of [[1680, 1050, "NVDA", "tool-NVDA-1680.png", false], [1680, 1050, "AVGO", "tool-AVGO-1680.png", false], [390, 844, "NVDA", "tool-NVDA-390.png", false], [1680, 1050, null, "tool-core-1680.png", true]]) {
  const { page, close, errors, nonGet } = await openPage({ width: w, height: h });
  try {
    if (core) { const f = await page.evaluate(() => { const el = document.getElementById("core"); if (el) el.scrollIntoView({ block: "start" }); const chips = [...document.querySelectorAll("#core .c3-chip")].filter((c) => /NOT A TARGET/.test(c.textContent)).map((c) => (c.closest("tr") || {}).getAttribute ? c.closest("tr").getAttribute("data-sym") : null); return { not_a_target_chips: chips, rows: document.querySelectorAll("#core tr[data-sym]").length }; }); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${file}`, fullPage: false }); facts.push({ file, ...f, errors: errors.length, writes_blocked: nonGet.blocked }); console.log(file, JSON.stringify(f)); continue; }
    await page.evaluate((s) => C4.open(s), sym); await page.waitForFunction(() => document.querySelector("#c4body .sec table"), null, { timeout: 60000 }); await page.waitForTimeout(800);
    const f = await page.evaluate(() => { const b = document.getElementById("c4body"), leaf = [...b.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim() && e.getClientRects().length); return { nat: (b.querySelector(".nat") || {}).innerText || null, cases: [...b.querySelectorAll(".case")].map((e) => e.innerText.slice(0, 90)), sideways: document.documentElement.scrollWidth > window.innerWidth + 1, under11px: leaf.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 11).length, evening: /\bevenings?\b/i.test(b.innerText), sections: [...b.querySelectorAll(".hd b")].map((e) => e.innerText) }; });
    const sheet = page.locator(".c4-sheet"); await page.evaluate(() => { const s = document.querySelector(".c4-sheet"); s.style.height = "auto"; s.style.overflow = "visible"; const d = document.getElementById("c4drawer"); d.style.position = "absolute"; d.style.inset = "0 0 auto 0"; d.style.height = "auto"; });
    await page.waitForTimeout(300); await sheet.screenshot({ path: `${OUT}/${file}` });
    facts.push({ file, sym, width: w, ...f, errors: errors.filter((e) => !/ResizeObserver|chart-api|Failed to fetch|NetworkError|Load failed/.test(e)).length, writes_blocked: nonGet.blocked }); console.log(file, JSON.stringify({ nat: !!f.nat, cases: f.cases.length, sideways: f.sideways, under11px: f.under11px, evening: f.evening, writes_blocked: nonGet.blocked }));
  } finally { await close(); }
}
fs.writeFileSync(`${OUT}/tool-facts.json`, JSON.stringify(facts, null, 1));
