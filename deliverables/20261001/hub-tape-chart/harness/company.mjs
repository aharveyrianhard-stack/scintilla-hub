// H3 company — open the Hub (local file or LIVE) headless at a width, click a ticker, wait for its Station pane, dump the
// pane's state and screenshot the page. Non-GET requests are aborted (nothing is written).
// usage: node company.mjs <index.html|LIVE> <out.png> <width> <ticker> <range> [extraWaitMs] [expanded 0|1]
// STATION_ROOT=… answers station.scintillahub.ai from a local Station build.
import { chromium, EXE, sleep } from "./rig.mjs";
import fs from "node:fs";
const [file, out, W, T, R, WAIT, EXP] = process.argv.slice(2);
const html = file === "LIVE" ? null : fs.readFileSync(file);
const width = +W || 1680, H = width < 600 ? 844 : 1050;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width, height: H }, deviceScaleFactor: width < 600 ? 2 : 1, isMobile: width < 600, hasTouch: width < 600 });
await context.addInitScript(([r, e]) => { if (window.top !== window) return; try { localStorage.setItem("hub.chart.range", r); localStorage.setItem("hub.company.expanded", e); } catch (_) {} }, [R || "1D", EXP || "0"]);
const stationRoot = process.env.STATION_ROOT || null;
await context.route("**/*", async (route) => {
  const req = route.request(), u = new URL(req.url());
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) return route.abort();
  if (html && u.host === "scintillahub.ai" && (u.pathname === "/" || u.pathname === "/index.html"))
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html, headers: { "cache-control": "no-store" } });
  if (stationRoot && u.host === "station.scintillahub.ai") {
    let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
    let f = stationRoot + p; if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
    if (fs.existsSync(f)) { const ext = f.split(".").pop(); const ct = { html: "text/html; charset=utf-8", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json", svg: "image/svg+xml", png: "image/png" }[ext] || "application/octet-stream";
      return route.fulfill({ status: 200, contentType: ct, body: fs.readFileSync(f), headers: { "cache-control": "no-store" } }); }
  }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", (e) => console.error("pageerror:", String(e).slice(0, 200)));
await page.goto("https://scintillahub.ai/", { waitUntil: "domcontentloaded" });
await page.waitForFunction((t) => typeof S !== "undefined" && document.querySelector('[data-act="row"][data-t="' + t + '"]'), T, { timeout: 60000 });
await sleep(1500);
await page.evaluate((t) => document.querySelector('[data-act="row"][data-t="' + t + '"]').click(), T);
let frame = null;
for (let i = 0; i < 300 && !frame; i++) { const h = await page.$("#coChartFrame"); frame = h && (await h.contentFrame()); if (!frame || !/\/chart\//.test(frame.url())) { frame = null; await sleep(50); } }
const t0 = Date.now(); let st = null;
while (Date.now() - t0 < 30000) {
  st = await frame.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null;
    const g = h.querySelector(".sc-nchart__live-geiger"), lens = h.querySelector(".sc-nchart__lens"), m = h.querySelector(".sc-nchart__msg");
    const rsiTag = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^RSI D/.test((n.textContent || "").trim()));
    return { t: h.dataset.t, range: h._range, n: h._series && h._series.length, forming: h._forming || null, clouds: !!(h._cloudMap && h._cloudMap.map),
      lens: lens ? { display: lens.style.display || "block", why: h.dataset.lensWhy || null } : null,
      geiger: g ? { hidden: g.hidden, vis: g.style.visibility, text: g.textContent } : null, msg: m && !m.hidden ? m.textContent : "", rsiTag: rsiTag ? rsiTag.textContent.trim() : null }; }).catch(() => null);
  if (st && st.n > 1 && st.clouds && st.geiger && st.geiger.vis === "visible" && (!/lens/.test(process.env.NEED || "") || (st.lens && st.lens.display !== "none"))) break;
  await sleep(250);
}
await sleep(+WAIT || 2500);
st = await frame.evaluate(() => { const h = document.querySelector("#chartSlot .sc-nchart"); if (!h) return null;
  const g = h.querySelector(".sc-nchart__live-geiger"), lens = h.querySelector(".sc-nchart__lens"), m = h.querySelector(".sc-nchart__msg");
  const rsiTag = [...document.querySelectorAll("*")].find((n) => n.children.length === 0 && /^RSI D/.test((n.textContent || "").trim()));
  return { url: location.search, t: h.dataset.t, range: h._range, n: h._series && h._series.length, forming: h._forming || null, clouds: !!(h._cloudMap && h._cloudMap.map),
    lens: lens ? { display: lens.style.display || "block", why: h.dataset.lensWhy || null } : null,
    geiger: g ? { hidden: g.hidden, vis: g.style.visibility, text: g.textContent } : null, msg: m && !m.hidden ? m.textContent : "", rsiTag: rsiTag ? rsiTag.textContent.trim() : null }; }).catch((e) => String(e));
const bar = await page.evaluate(() => [...document.querySelectorAll(".sc-cofr__tf, .cv-tf, [data-act=corange]")].map((b) => b.textContent.trim()).join(" "));
console.log(JSON.stringify({ waitedMs: Date.now() - t0, bar, pane: st }));
await page.screenshot({ path: out });
await browser.close();
