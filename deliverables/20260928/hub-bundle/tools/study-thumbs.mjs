/* N6 (28 Sep) — one thumbnail per study for the studies index. Each is cut from a chart the study already saved (or, where a
   study draws its chart inline and saved none, from that chart on the study's own page; where a study has no chart at all,
   from its own saved screenshot). Headless only. Writes deliverables/20260928/studies-index/thumbs/<key>.png (640×360).
   Run from the repo root:  node deliverables/20260928/hub-bundle/tools/study-thumbs.mjs */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(decodeURIComponent(new URL("../../../../", import.meta.url).pathname));
const D = path.join(ROOT, "deliverables/20260928");
const OUT = path.join(D, "studies-index/thumbs");
export const STUDIES = [
  // key, source (relative to deliverables/20260928), crop [x,y,w,h] in source pixels or null for the whole image
  { key: "rsi-full-history", file: "rsi-full-history/after-1680-spy-3y.png", crop: [34, 120, 1614, 566] },
  { key: "rsi-ladder", file: "rsi-ladder/charts/ladder-btc-spy-qqq.svg" },
  { key: "bottoms", file: "bottoms/charts/p1-vix-offset.svg" },
  { key: "market-regime", page: "market-regime/MARKET-REGIME.html", sel: "svg.chart" },
  { key: "leaders", file: "leaders/leaders-top10-share.svg" },
  { key: "stats-tab", file: "stats-tab/charts/20260928-pullbacks-spy-fallen-so-far-to-new-high-1200.svg" },
  { key: "sector-rotation", file: "sector-rotation/c2-wing-history.png" },
  { key: "statistician", file: "statistician/charts/a-200day-intervals.svg" },
  { key: "statistician-2", file: "statistician-2/charts/q1-floor-share-full.svg" },
  { key: "comps-labels", file: "comps-labels/shots/chartA-1680.png" },
  { key: "market-map-r3", file: "market-map-r3/shots/desktop-1680-whole.png" },
  { key: "scout", file: "scout/shots/design-1680-top.png", crop: [0, 0, 1680, 945], page_view: true },
  { key: "scout-iwm", file: "scout/shots/iwm-1680-top.png", crop: [0, 0, 1680, 945], page_view: true },
  { key: "etf-valuation", file: "scout/shots/etf-1680-top.png", crop: [0, 0, 1680, 945], page_view: true },
  { key: "coverage-tree", file: "coverage-tree/shots/coverage-tree-1680.png", crop: [0, 0, 1680, 945], page_view: true },
  { key: "prediction-markets", file: "prediction-markets/shots/v2-1680-top.png", crop: [0, 0, 1680, 945], page_view: true },
  { key: "putcall-audit", file: "putcall-audit/close-vs-cboe.svg" },
];
const W = 640, H = 360;
if (path.resolve(decodeURIComponent(new URL(import.meta.url).pathname)) === path.resolve(process.argv[1])) {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--disable-gpu", "--hide-scrollbars"] });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
  const report = [];
  try {
    for (const s of STUDIES) {
      let src = s.file ? path.join(D, s.file) : null, crop = s.crop || null;
      if (s.page) {   // a chart drawn inline on the study page: shoot that element to a temporary file first
        await page.goto("file://" + path.join(D, s.page), { waitUntil: "load" });
        await page.waitForTimeout(600);
        const el = page.locator(s.sel).first();
        src = path.join(OUT, "_" + s.key + ".png");
        await el.screenshot({ path: src });
      }
      assert(fs.existsSync(src), s.key + ": source missing " + src);
      const html = `<!doctype html><html><body style="margin:0;background:#0e0e0e">
        <div id="t" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#0e0e0e"><div id="c" style="position:absolute;overflow:hidden"><img id="i" src="file://${src}"></div></div>
        <script>
          const img = document.getElementById("i"), crop = ${JSON.stringify(crop)};
          img.onload = () => {
            const [x, y, w, h] = crop || [0, 0, img.naturalWidth, img.naturalHeight];
            const k = Math.min(${W} / w, ${H} / h);
            /* the crop box, centred and clipped: nothing outside the chosen chart shows */
            Object.assign(document.getElementById("c").style, { width: w * k + "px", height: h * k + "px",
              left: (${W} - w * k) / 2 + "px", top: (${H} - h * k) / 2 + "px" });
            Object.assign(img.style, { position: "absolute", width: img.naturalWidth * k + "px", height: img.naturalHeight * k + "px",
              left: -x * k + "px", top: -y * k + "px" });
            document.body.dataset.ready = img.naturalWidth + "x" + img.naturalHeight;
          };
        </script></body></html>`;
      const tmp = path.join(OUT, "_frame.html");
      fs.writeFileSync(tmp, html);
      await page.goto("file://" + tmp);
      await page.waitForSelector("body[data-ready]");
      const dims = await page.evaluate(() => document.body.dataset.ready);
      await page.locator("#t").screenshot({ path: path.join(OUT, s.key + ".png") });
      fs.rmSync(tmp);
      if (s.page) fs.rmSync(src);
      report.push({ key: s.key, source: s.file || s.page + " " + s.sel, source_px: dims, crop, page_view: !!s.page_view });
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, "thumbs.json"), JSON.stringify({ built_utc: new Date().toISOString(), size: [W, H], thumbs: report }, null, 1));
  console.log(report.length + " thumbnails →", path.relative(ROOT, OUT));
}
function assert(c, m) { if (!c) throw new Error(m); }
