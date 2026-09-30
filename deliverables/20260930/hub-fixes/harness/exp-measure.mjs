import { serve, open, sleep } from "./rig.mjs";
const [root, W, H] = process.argv.slice(2);
const { server, origin } = await serve(root);
const { browser, context } = await open({ width: +W, height: +H });
await context.addInitScript(() => { if (window.top !== window) return; try { localStorage.setItem("hub.company.expanded", "1"); sessionStorage.setItem("hub.station.hubpane", "1"); } catch (_) {} });
const page = await context.newPage();
await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof S !== "undefined" && document.querySelectorAll('[data-act="row"][data-t]').length > 20, null, { timeout: 60000 });
await page.evaluate(() => document.querySelector('[data-act="row"][data-t]').click());
await page.waitForFunction(() => document.body.classList.contains("co-exp") && el("cv"), null, { timeout: 30000 }); await sleep(1500);
console.log(JSON.stringify(await page.evaluate(() => {
  const r = (n) => { const b = n.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; };
  const tapes = [...document.querySelectorAll("body > *")].map((n) => [n.id || n.className.toString().slice(0, 30), r(n)]).filter((x) => x[1][2] > 0);
  return { vh: innerHeight, zoom: getComputedStyle(document.body).zoom, body: r(document.body), main: r(el("main")), mainClient: el("main").clientHeight, mainScroll: el("main").scrollHeight,
    cv: r(el("cv")), cvCss: getComputedStyle(el("cv")).height, rail: r(el("cvRail")), chart: r(el("cvChart")), tapes };
}), null, 1));
await browser.close(); server.close();
