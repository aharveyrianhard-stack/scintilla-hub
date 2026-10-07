/* COIL LAB · the headless proof, PASS 3 (5 Oct 2026). Headless Chrome only, the Mac's GPU through ANGLE on Metal, the cross-origin
   check relaxed so the page can read /geiger from 127.0.0.1, every non-GET request blocked and counted. LASER is the base.
     · NO BOXES   home at 1680 × 1050 @2 and 1920 × 1080 @1, cap off, beside the same view with V2b's boxes (boxes=1);
     · LABELS     0 mirrored / upside-down labels at home, from the side, from below the far rim, after a real drag; the ticker's
                  printed px at three zoom levels (home, twice as close, twice as far) with how many labels are shown / thinned;
     · THE SPHERE one set, and FAVORITES vs RADAR side by side; the alternative (step width = market cap);
     · FPS        a 4 s MEASURE FPS turn, cap off and with two spheres;
     · VIDEOS     at 1680: a drag without boxes, a zoom in and out, the two spheres turning (--quick skips them).
   Writes shots/p3-*.png, shots/p3-*.webm, shots/proof-p3.json.   node proof-p3.mjs [--quick] */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../.."), SHOTS = resolve(HERE, "shots"); mkdirSync(SHOTS, { recursive: true });
const PORT = 8794, BASE = `http://127.0.0.1:${PORT}/deliverables/20261003/coil-lab/`;
const QUICK = process.argv.includes("--quick");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await sleep(900);
const out = { when: new Date().toISOString(), pass: 3, quick: QUICK, gpu: null, runs: [], writes: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--disable-web-security", "--hide-scrollbars", "--disable-extensions", "--no-first-run"] });
try {
  async function page(w, h, dpr, video) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(video ? { recordVideo: { dir: SHOTS, size: { width: Math.round(w / 2), height: Math.round(h / 2) } } } : {}) });
    await ctx.route("**/*", (route) => { const req = route.request(); if (req.method() !== "GET") { out.writes.push(req.method() + " " + req.url()); return route.abort(); } route.continue(); });
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => out.errors.push(String(e))); pg.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text().slice(0, 300)); });
    return { ctx, pg };
  }
  const open = async (pg, q) => { await pg.goto(`${BASE}index.html?${q}`); await pg.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 60000 }); await sleep(3000); };
  const st = (pg) => pg.evaluate(() => ({ list: __lab.listName, compare: __lab.compare, cap: __lab.coil.capMode(), boxes: __lab.coil.boxes(), rows: __lab.rows.length, geigerFrom: __lab.geigerFrom, sets: __lab.coil.sets(), capScale: __lab.coil.capScale(), camera: __lab.coil.elevation(), fill: __lab.coil.fill(), stamp: document.getElementById("stamp").textContent }));
  const probe = (pg) => pg.evaluate(() => ({ labels: __lab.coil.labelCheck(), pixels: __lab.coil.pixelShare(), camera: __lab.coil.elevation() }));
  const finishVideo = async (ctx, pg, name) => { const v = pg.video(); await ctx.close(); if (v) { const p = await v.path(); const dst = `${SHOTS}/${name}.webm`; if (existsSync(dst)) unlinkSync(dst); renameSync(p, dst); return `shots/${name}.webm`; } return null; };
  const SCREENS = [{ name: "macbook", w: 1680, h: 1050, dpr: 2 }, { name: "appletv", w: 1920, h: 1080, dpr: 1 }];

  for (const S of SCREENS) {
    // 1 · no boxes vs V2b's boxes, cap off, the same list and view
    for (const boxes of [0, 1]) { const { ctx, pg } = await page(S.w, S.h, S.dpr, false); await open(pg, `mode=laser&list=favorites&cap=off&boxes=${boxes}`); const run = { item: "boxes", boxes, screen: S.name, w: S.w, h: S.h, state: await st(pg), home: await probe(pg) }; await pg.screenshot({ path: `${SHOTS}/p3-boxes-${boxes ? "v2b" : "none"}-${S.w}.png` }); out.runs.push(run); console.log("BOXES", S.name, boxes, JSON.stringify({ wrong: run.home.labels.wrong, px: run.home.labels.ticker_px_median, red: run.home.pixels.red, green: run.home.pixels.green })); await ctx.close(); }
    // 2 · labels: 0 wrong at home / side / below / after a drag; 3 · the px at three zoom levels
    { const video = !QUICK && S.w === 1680; const { ctx, pg } = await page(S.w, S.h, S.dpr, video); await open(pg, "mode=laser&list=favorites&cap=off");
      const run = { item: "labels", screen: S.name, w: S.w, h: S.h, state: await st(pg) };
      run.home = await probe(pg);
      await pg.evaluate(() => __lab.coil.orbitTo(8, 28)); await sleep(500); run.side = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p3-labels-side-${S.w}.png` });
      await pg.evaluate(() => __lab.coil.orbitTo(-18, 208)); await sleep(500); run.below_opposite = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p3-labels-below-${S.w}.png` });
      await pg.evaluate(() => __lab.coil.home()); await sleep(900);
      await pg.mouse.move(S.w / 2, S.h / 2); await pg.mouse.down(); for (let i = 1; i <= 12; i++) { await pg.mouse.move(S.w / 2 + i * 24, S.h / 2 + i * 10); await sleep(16); } await pg.mouse.up(); await sleep(400);
      run.after_drag = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p3-labels-drag-${S.w}.png` });
      await pg.evaluate(() => __lab.coil.home()); await sleep(900);
      run.zoom = {}; for (const [k, r] of [["home", 1], ["in", 0.5], ["out", 2]]) { run.zoom[k] = await pg.evaluate((r) => __lab.coil.zoom(r), r); await sleep(250); await pg.evaluate(() => { document.getElementById("hud").dispatchEvent(new Event("x")); }); await pg.evaluate(() => window.__lab && (document.getElementById("gl").dispatchEvent(new Event("pointerup")))); await sleep(120); run.zoom[k].hud = await pg.evaluate(() => document.getElementById("hud").textContent); await pg.screenshot({ path: `${SHOTS}/p3-zoom-${k}-${S.w}.png` }); }
      if (video) { await pg.evaluate(() => __lab.coil.home()); await sleep(800); for (let i = 0; i < 16; i++) { await pg.mouse.wheel(0, -120); await sleep(70); } await sleep(500); for (let i = 0; i < 28; i++) { await pg.mouse.wheel(0, 120); await sleep(70); } await sleep(600); await pg.evaluate(() => __lab.coil.home()); await sleep(900); }
      await pg.click("#measure"); await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); run.measure = await pg.evaluate(() => __lab.lastMeasure); out.gpu = run.measure.gpu;
      run.video = await finishVideo(ctx, pg, `p3-labels-zoom-${S.w}`); out.runs.push(run);
      console.log("LABELS", S.name, JSON.stringify({ wrong: [run.home.labels.wrong, run.side.labels.wrong, run.below_opposite.labels.wrong, run.after_drag.labels.wrong], px: { home: run.zoom.home.ticker_px_median, in: run.zoom.in.ticker_px_median, out: run.zoom.out.ticker_px_median }, shown: { home: run.zoom.home.labels, in: run.zoom.in.labels, out: run.zoom.out.labels }, thinned: { home: run.zoom.home.hidden_by_thinning, in: run.zoom.in.hidden_by_thinning, out: run.zoom.out.hidden_by_thinning }, fps: run.measure.fps })); }
    // 4 · the sphere: one set; two side by side; the alternative
    for (const [name, q] of [["sphere-favorites", "mode=laser&list=favorites&cap=sphere"], ["sphere-favorites-vs-radar", "mode=laser&compare=favorites,radar&cap=sphere"], ["sphere-radar-vs-liked", "mode=laser&compare=radar,liked&cap=sphere"], ["width-favorites", "mode=laser&list=favorites&cap=width"]]) {
      const video = !QUICK && S.w === 1680 && name === "sphere-favorites-vs-radar"; const { ctx, pg } = await page(S.w, S.h, S.dpr, video); await open(pg, q);
      const run = { item: name, screen: S.name, w: S.w, h: S.h, state: await st(pg), home: await probe(pg) }; await pg.screenshot({ path: `${SHOTS}/p3-${name}-${S.w}.png` });
      if (name.startsWith("sphere")) { // the sphere's printed radius in px at home: its equator's projected half-width
        run.sphere_px = await pg.evaluate(() => __lab.coil.spherePx());
      }
      if (name === "sphere-favorites-vs-radar" || name === "width-favorites") { await pg.click("#measure"); await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); run.measure = await pg.evaluate(() => __lab.lastMeasure); }
      if (video) { await pg.evaluate(() => __lab.coil.orbitTo(30, -40)); await sleep(700); await pg.evaluate(() => __lab.coil.home()); await sleep(1200); }
      run.video = await finishVideo(ctx, pg, `p3-${name}-${S.w}`); if (!video) run.video = null; out.runs.push(run);
      console.log("CAP", S.name, name, JSON.stringify({ sets: run.state.sets.map((s) => [s.name, s.capSumT, s.capR]), wrong: run.home.labels.wrong, shown: run.home.labels.labels, thinned: run.home.labels.hidden_by_thinning, fps: run.measure && run.measure.fps }));
    }
  }
  // the tree-label demo page at 1920
  { const { ctx, pg } = await page(1920, 1080, 1, false); await pg.goto(`${BASE}label-scale-demo.html`); await sleep(600); const d = await pg.evaluate(() => window.__demo); out.runs.push({ item: "tree-label-demo", demo: d }); await pg.screenshot({ path: `${SHOTS}/p3-tree-label-demo-1920.png`, fullPage: true }); console.log("DEMO", JSON.stringify(d)); await ctx.close(); }
} finally {
  await browser.close(); server.kill("SIGKILL");
}
for (const f of readdirSync(SHOTS)) if (/^[0-9a-f]{32}\.webm$/.test(f)) unlinkSync(resolve(SHOTS, f));
writeFileSync(`${SHOTS}/proof-p3${QUICK ? "-quick" : ""}.json`, JSON.stringify(out, null, 1));
console.log("GPU", out.gpu); console.log("writes blocked", out.writes.length, out.writes.slice(0, 5)); console.log("errors", out.errors.length, out.errors.slice(0, 8));
