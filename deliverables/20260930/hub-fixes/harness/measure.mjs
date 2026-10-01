import { serve, open, sleep } from "./rig.mjs";
const [root, W, H, EXP] = process.argv.slice(2);
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: +W, height: +H });
await context.addInitScript((exp) => { if (window.top !== window) return; try { localStorage.setItem("hub.company.expanded", exp); localStorage.setItem("hub.chart.range", "1D"); sessionStorage.setItem("hub.station.hubpane", "1"); } catch (_) {} }, EXP);
const page = await context.newPage();
await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof S !== "undefined" && document.querySelectorAll('[data-act="row"][data-t]').length > 20, null, { timeout: 60000 });
await page.evaluate(() => { const r = document.querySelector('[data-act="row"][data-t="MU"]') || document.querySelector('[data-act="row"][data-t]'); r.click(); });
await page.waitForSelector("#coChartFrame"); await sleep(1500);
console.log(JSON.stringify(await page.evaluate(() => {
  const b = (s) => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), getComputedStyle(n).overflowY]; };
  const chain = []; let n = el("cv"); while (n && n !== document.body) { const r = n.getBoundingClientRect(); chain.push((n.id || n.className.toString().slice(0, 40)) + " " + Math.round(r.top) + "+" + Math.round(r.height) + " ov=" + getComputedStyle(n).overflowY); n = n.parentElement; }
  return { cv: b("#cv"), line: b("#cvLine"), chart: b("#cvChart"), side: b(".cv-side"), tabs: b("#cvTabs"), slot: b(".cv-side > .sc-chartpanel__slot"), chain };
}), null, 1));
await browser.close(); server.close();
