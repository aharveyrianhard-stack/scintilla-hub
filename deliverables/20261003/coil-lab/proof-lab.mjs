/* COIL LAB · the headless proof (3 Oct 2026). Headless Chrome only (Alan: never a window on his screen), with the Mac's real
   GPU through ANGLE on Metal (--use-angle=metal; the renderer string is recorded), the cross-origin check relaxed so the
   page can read the chart API's /geiger from 127.0.0.1 (the API answers https://scintillahub.ai only), every non-GET
   request blocked and counted. It serves the worktree itself on a local port, then:
     · for each of the three directions at 1680 × 1050 @2 (MacBook): a video of the landing and of a replayed tick, stills
       at home (70°), from the side and from below, and MEASURE FPS (4 s of turning, every frame rendered);
     · the phone (390 × 844) at home for each direction;
     · the tape: the three variants on Friday 2 Oct, on 24 Sep (34), 28 Sep (32) and all three (78), at 1680 and 390.
   Writes shots/*.png, shots/*.webm, shots/proof.json.    node proof-lab.mjs [--quick] */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../.."), SHOTS = resolve(HERE, "shots"); mkdirSync(SHOTS, { recursive: true });
const PORT = 8791, BASE = `http://127.0.0.1:${PORT}/deliverables/20261003/coil-lab/index.html`;
const QUICK = process.argv.includes("--quick");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await sleep(900);
const out = { when: new Date().toISOString(), gpu: null, runs: [], writes: [], errors: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--disable-web-security", "--hide-scrollbars", "--disable-extensions", "--no-first-run"] });
try {
  async function page(w, h, dpr, mobile, video) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, ...(video ? { recordVideo: { dir: SHOTS, size: { width: Math.round(w * (video.scale || 1)), height: Math.round(h * (video.scale || 1)) } } } : {}) });
    await ctx.route("**/*", (route) => { const req = route.request(); if (req.method() !== "GET") { out.writes.push(req.method() + " " + req.url()); return route.abort(); } route.continue(); });
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => out.errors.push(String(e))); pg.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text().slice(0, 300)); });
    return { ctx, pg };
  }
  const ready = async (pg) => { await pg.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 60000 }); await sleep(400); };
  const st = (pg) => pg.evaluate(() => ({ list: __lab.listName, from: __lab.listFrom, rows: __lab.rows.length, missing: __lab.missing, geigerFrom: __lab.geigerFrom, mode: __lab.coil && __lab.coil.mode(), placed: __lab.coil && (({ H, ups, dns, none, outerR }) => ({ H: +H.toFixed(1), ups, dns, none, outerR: +outerR.toFixed(1) }))(__lab.coil.placed()), camera: __lab.coil && __lab.coil.elevation(), err3d: __lab.err3d, stamp: document.getElementById("stamp").textContent }));
  const MODES = ["laser", "guide", "holo"];

  // ---- the coil, MacBook 1680 × 1050 @2: video per direction (land + tick), stills, fps ----
  for (const mode of MODES) {
    const { ctx, pg } = await page(1680, 1050, 2, false, QUICK ? null : { scale: 0.5 });
    await pg.goto(`${BASE}?mode=${mode}&list=favorites`); await ready(pg);
    const run = { mode, w: 1680, h: 1050, dpr: 2, state: await st(pg) };
    await sleep(2600); // the landing (58 steps × 28 ms stagger + 900 ms)
    await pg.screenshot({ path: `${SHOTS}/coil-${mode}-1680-home.png` });
    const tick = await pg.evaluate(() => __lab.replayTick()); run.tick_changes = tick; await sleep(900);
    await pg.screenshot({ path: `${SHOTS}/coil-${mode}-1680-tick.png` }); await sleep(1200);
    await pg.evaluate(() => __lab.coil.orbitTo(8, 28)); await sleep(500); await pg.screenshot({ path: `${SHOTS}/coil-${mode}-1680-side.png` });
    await pg.evaluate(() => __lab.coil.orbitTo(-18, 28)); await sleep(500); await pg.screenshot({ path: `${SHOTS}/coil-${mode}-1680-below.png` });
    await pg.evaluate(() => __lab.coil.home()); await sleep(900);
    // a real drag turns it (left button = rotate)
    await pg.mouse.move(840, 560); await pg.mouse.down(); for (let i = 1; i <= 10; i++) { await pg.mouse.move(840 + i * 22, 560 + i * 9); await sleep(16); } await pg.mouse.up(); await sleep(400);
    run.after_drag = await pg.evaluate(() => __lab.coil.elevation());
    await pg.mouse.dblclick(840, 300); await sleep(900); run.after_dblclick = await pg.evaluate(() => __lab.coil.elevation());
    run.measure = await pg.evaluate(() => __lab.coil.measure(4000)); out.gpu = run.measure.gpu;
    await sleep(300);
    await pg.evaluate(() => __lab.coil.land()); await sleep(2800); // land again, on video
    run.labels = await pg.evaluate(() => __lab.coil.labels().slice(0, 6));
    const video = pg.video(); await ctx.close();
    if (video) { const p = await video.path(); const dst = `${SHOTS}/coil-${mode}-1680.webm`; if (existsSync(dst)) unlinkSync(dst); renameSync(p, dst); run.video = `shots/coil-${mode}-1680.webm`; }
    out.runs.push(run); console.log("COIL", mode, JSON.stringify({ fps: run.measure.fps, frames: run.measure.frames, tris: run.measure.triangles, calls: run.measure.calls, tick: run.tick_changes, drag: run.after_drag, home: run.after_dblclick, placed: run.state.placed, missing: run.state.missing }));
  }
  // ---- the phone ----
  for (const mode of MODES) {
    const { ctx, pg } = await page(390, 844, 2, true, null);
    await pg.goto(`${BASE}?mode=${mode}&list=favorites`); await ready(pg); await sleep(2600);
    await pg.screenshot({ path: `${SHOTS}/coil-${mode}-390-home.png` });
    const m = await pg.evaluate(() => __lab.coil.measure(2500));
    out.runs.push({ mode, w: 390, h: 844, dpr: 2, state: await st(pg), measure: m }); console.log("COIL phone", mode, m.fps, "fps");
    await ctx.close();
  }
  // ---- the other two lists, LASER, one still each ----
  for (const list of ["radar", "liked"]) {
    const { ctx, pg } = await page(1680, 1050, 2, false, null);
    await pg.goto(`${BASE}?mode=laser&list=${list}`); await ready(pg); await sleep(3200);
    await pg.screenshot({ path: `${SHOTS}/coil-laser-1680-${list}.png` }); out.runs.push({ mode: "laser", list, w: 1680, state: await st(pg) }); await ctx.close();
  }
  // ---- the tape ----
  for (const [w, h, dpr, mobile] of [[1680, 1050, 2, false], [390, 844, 2, true]]) {
    for (const day of ["2026-10-02", "2026-09-24", "2026-09-28", "all3"]) {
      const { ctx, pg } = await page(w, h, dpr, mobile, null);
      await pg.goto(`${BASE}?tab=tape&day=${day}`); await ready(pg); await sleep(700);
      const t = await pg.evaluate(() => ({ tape: __lab.tape, spread: { points: __lab.spread.points, labels: __lab.spread.labels.length }, ladder: __lab.ladder }));
      // label collisions in T2: any two printed names overlapping
      t.spread_label_overlaps = await pg.evaluate(() => { const L = __lab.spread.labels; let n = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (Math.abs(L[i].x - L[j].x) < (L[i].w + L[j].w) / 2 && Math.abs(L[i].y - L[j].y) < L[i].h) n++; return n; });
      for (const id of ["t1", "t2", "t3"]) { const el = await pg.$("#" + id); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${SHOTS}/tape-${id}-${day}-${w}.png` }); }
      out.runs.push({ tape: day, w, h, ...t }); console.log("TAPE", day, w, JSON.stringify(t)); await ctx.close();
    }
  }
} finally {
  await browser.close(); server.kill("SIGKILL");
}
// clean stray video files playwright left behind
for (const f of readdirSync(SHOTS)) if (/^[0-9a-f]{32}\.webm$/.test(f)) unlinkSync(resolve(SHOTS, f));
writeFileSync(`${SHOTS}/proof.json`, JSON.stringify(out, null, 1));
console.log("GPU", out.gpu); console.log("writes blocked", out.writes.length, out.writes.slice(0, 5)); console.log("errors", out.errors.length, out.errors.slice(0, 8));
