/* COIL LAB · the headless proof, PASS 4 (5 Oct 2026, afternoon). Headless Chrome only, the Mac's GPU through ANGLE on Metal, the
   cross-origin check relaxed so the page can read /geiger from 127.0.0.1, every non-GET request blocked and counted. LASER, cap off.
     · PICTURES  home, zoomed in (½ the distance), zoomed out (2×), from the side — at 1920 × 1080 @1 and 1680 × 1050 @2;
     · THE PX    beam core / halo / ticker / value at the three zooms (api.beamPx) and the labels shown / thinned;
     · THE ZOOM  20 wheel ticks in, 20 out, recorded per rendered frame: fps while moving, the biggest single-frame step as a share
                 of the travel, the longest gap between frames, labels that popped in or out per second (api.record);
     · RED       the lit pixels by hue at home: per step and mean brightness, red against green (api.pixelShare);
     · FPS       a 4 s MEASURE FPS turn; · THE SPHERES  ★ FAVORITES vs ◎ RADAR with the new type; · a 10 s zoom video at 1680.
   Writes shots/p4-*.png, shots/p4-zoom-1680.webm, shots/proof-p4.json.   node proof-p4.mjs [--quick] */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../.."), SHOTS = resolve(HERE, "shots"); mkdirSync(SHOTS, { recursive: true });
const PORT = 8795, BASE = `http://127.0.0.1:${PORT}/deliverables/20261003/coil-lab/`;
const QUICK = process.argv.includes("--quick");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await sleep(900);
const out = { when: new Date().toISOString(), pass: 4, quick: QUICK, gpu: null, runs: [], writes: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--disable-web-security", "--hide-scrollbars", "--disable-extensions", "--no-first-run"] });
try {
  async function page(w, h, dpr, video) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(video ? { recordVideo: { dir: SHOTS, size: { width: Math.round(w / 2), height: Math.round(h / 2) } } } : {}) });
    await ctx.route("**/*", (route) => { const req = route.request(); if (req.method() !== "GET") { out.writes.push(req.method() + " " + req.url()); return route.abort(); } route.continue(); });
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => out.errors.push(String(e))); pg.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text().slice(0, 300)); });
    return { ctx, pg };
  }
  const open = async (pg, q) => { await pg.goto(`${BASE}index.html?${q}`); await pg.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 60000 }); await sleep(3200); };
  const st = (pg) => pg.evaluate(() => ({ list: __lab.listName, compare: __lab.compare, cap: __lab.coil.capMode(), boxes: __lab.coil.boxes(), rows: __lab.rows.length, geigerFrom: __lab.geigerFrom, sets: __lab.coil.sets(), camera: __lab.coil.elevation(), fill: __lab.coil.fill(), stamp: document.getElementById("stamp").textContent }));
  const probe = (pg) => pg.evaluate(() => ({ labels: __lab.coil.labelCheck(), beam: __lab.coil.beamPx(), pixels: __lab.coil.pixelShare(), camera: __lab.coil.elevation() }));
  const finishVideo = async (ctx, pg, name) => { const v = pg.video(); await ctx.close(); if (v) { const p = await v.path(); const dst = `${SHOTS}/${name}.webm`; if (existsSync(dst)) unlinkSync(dst); renameSync(p, dst); return `shots/${name}.webm`; } return null; };
  // one wheel tick = 120 CSS px of deltaY. Headless Chrome through CDP delivers the delta in device px at deviceScaleFactor 2 (the page saw 60 per event
  // in the first run), so the proof sends 120 × dpr and the record prints the px the page actually saw (wheel_px_abs = ticks × 120).
  let DPR = 1; const wheel = async (pg, n, dir, gap) => { for (let i = 0; i < n; i++) { await pg.mouse.wheel(0, dir * 120 * DPR); await sleep(gap); } };
  const SCREENS = [{ name: "appletv", w: 1920, h: 1080, dpr: 1 }, { name: "macbook", w: 1680, h: 1050, dpr: 2 }];

  for (const S of SCREENS) {
    DPR = S.dpr; const { ctx, pg } = await page(S.w, S.h, S.dpr, false); await open(pg, "mode=laser&list=favorites&cap=off");
    await pg.mouse.move(S.w / 2, S.h / 2);
    const run = { item: "laser", screen: S.name, w: S.w, h: S.h, state: await st(pg), zoom: {} };
    // 1 · the three zooms and the side, each with its px
    for (const [k, r] of [["home", 1], ["in", 0.5], ["out", 2]]) { await pg.evaluate((r) => __lab.coil.zoom(r), r); await sleep(350); await pg.evaluate(() => document.getElementById("gl").dispatchEvent(new Event("pointerup"))); await sleep(120); run.zoom[k] = await probe(pg); run.zoom[k].hud = await pg.evaluate(() => document.getElementById("hud").textContent); await pg.screenshot({ path: `${SHOTS}/p4-${k}-${S.w}.png` }); }
    await pg.evaluate(() => __lab.coil.orbitTo(8, 28)); await sleep(400); run.side = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p4-side-${S.w}.png` });
    await pg.evaluate(() => __lab.coil.orbitTo(-18, 208)); await sleep(400); run.below_opposite = await probe(pg);
    // 2 · the wheel: 20 ticks in, 20 out, recorded per rendered frame
    await pg.evaluate(() => __lab.coil.zoom(1)); await sleep(400);
    await pg.evaluate(() => __lab.coil.record(true));
    await wheel(pg, 20, -1, 30); await sleep(700); await wheel(pg, 20, 1, 30); await sleep(700);
    run.wheel = await pg.evaluate(() => __lab.coil.record(false)); run.wheel_end = await pg.evaluate(() => ({ camera: __lab.coil.elevation(), target: __lab.coil.zoomTarget(), labels: __lab.coil.labelCheck() }));
    // 3 · fps: the 4 s turn
    await pg.click("#measure"); await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); run.measure = await pg.evaluate(() => __lab.lastMeasure); out.gpu = run.measure.gpu;
    out.runs.push(run); await ctx.close();
    console.log("LASER", S.name, JSON.stringify({ type: [run.zoom.home.beam.type_px, run.zoom.in.beam.type_px, run.zoom.out.beam.type_px], core: [run.zoom.home.beam.core_px, run.zoom.in.beam.core_px, run.zoom.out.beam.core_px], halo: [run.zoom.home.beam.halo_px, run.zoom.in.beam.halo_px, run.zoom.out.beam.halo_px], shown: [run.zoom.home.labels.labels, run.zoom.in.labels.labels, run.zoom.out.labels.labels], wrong: [run.zoom.home.labels.wrong, run.side.labels.wrong, run.below_opposite.labels.wrong], red: { per_step_ratio: run.zoom.home.pixels.red_per_step_over_green_per_step, mean: [run.zoom.home.pixels.red_mean_brightness, run.zoom.home.pixels.green_mean_brightness] }, wheel: { px: run.wheel.wheel_px_abs, fps: run.wheel.fps_while_moving, pops_s: run.wheel.pops_per_second, net: run.wheel.net_changes, reflips: run.wheel.reflips_within_500ms, max_step_share: run.wheel.max_frame_step_share_of_travel, gap: run.wheel.longest_gap_ms_while_moving, ratio_end: run.wheel_end.labels.distance_ratio }, fps: run.measure.fps }));
    // 4 · the spheres with the new type
    { const { ctx, pg } = await page(S.w, S.h, S.dpr, false); await open(pg, "mode=laser&compare=favorites,radar&cap=sphere"); const r2 = { item: "spheres", screen: S.name, w: S.w, h: S.h, state: await st(pg), home: await probe(pg), sphere_px: await pg.evaluate(() => __lab.coil.spherePx()) }; await pg.screenshot({ path: `${SHOTS}/p4-spheres-${S.w}.png` }); await pg.click("#measure"); await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); r2.measure = await pg.evaluate(() => __lab.lastMeasure); out.runs.push(r2); await ctx.close(); console.log("SPHERES", S.name, JSON.stringify({ r_px: r2.sphere_px.map((x) => [x.name, x.r_px]), type: r2.home.beam.type_px, core: r2.home.beam.core_px, fps: r2.measure.fps })); }
    // 5 · the 10 s zoom video at 1680
    if (!QUICK && S.w === 1680) { const { ctx, pg } = await page(S.w, S.h, S.dpr, true); await open(pg, "mode=laser&list=favorites&cap=off"); await pg.mouse.move(S.w / 2, S.h / 2); await sleep(800); await wheel(pg, 20, -1, 60); await sleep(1500); await wheel(pg, 40, 1, 60); await sleep(1500); await wheel(pg, 20, -1, 60); await sleep(900); await pg.evaluate(() => __lab.coil.home()); await sleep(1000); const v = await finishVideo(ctx, pg, "p4-zoom-1680"); out.runs.push({ item: "video", screen: S.name, video: v }); console.log("VIDEO", v); }
  }
} finally {
  await browser.close(); server.kill("SIGKILL");
}
for (const f of readdirSync(SHOTS)) if (/^[0-9a-f]{32}\.webm$/.test(f)) unlinkSync(resolve(SHOTS, f));
writeFileSync(`${SHOTS}/proof-p4${QUICK ? "-quick" : ""}.json`, JSON.stringify(out, null, 1));
console.log("GPU", out.gpu); console.log("writes blocked", out.writes.length, out.writes.slice(0, 5)); console.log("errors", out.errors.length, out.errors.slice(0, 8));
