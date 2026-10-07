/* COIL LAB · the headless proof, PASS 2 (3 Oct 2026). Headless Chrome only (Alan: never a window on his screen), with the Mac's
   real GPU through ANGLE on Metal (--use-angle=metal; the renderer string is recorded), the cross-origin check relaxed so the
   page can read the chart API's /geiger from 127.0.0.1 (the API answers https://scintillahub.ai only), every non-GET
   request blocked and counted. It serves the worktree itself on a local port, then:
     · the coil, each of the three directions, at 1680 × 1050 @2 (MacBook) and 1920 × 1080 @1 (Apple TV): home (70°) and
       side (8°) stills; at home the fill (the coil's projected height as a share of the view), the label check (0 must read
       mirrored or upside down; the ticker's printed px), the pixel shares (red vs green of the lit pixels); a 4 s MEASURE FPS;
       at 1680 a video of the landing, a replayed tick, side, a drag and the turn (--quick skips the videos);
     · the phone (390 × 844) at home for each direction;
     · the tape: T1 and T3 (the ladder, inline and as the bigger-screen mode opened by a tap on the strip) on Friday 2 Oct,
       24 Sep and all three, at 1680 and 1920; the ladder's two sides measured (px per × on each side must agree).
   Writes shots/p2-*.png, shots/p2-*.webm, shots/proof-p2.json (pass 1's shots/*.png and proof.json stay as the "before").
   node proof-lab.mjs [--quick] [--only=coil|tape] */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../.."), SHOTS = resolve(HERE, "shots"); mkdirSync(SHOTS, { recursive: true });
const PORT = 8792, BASE = `http://127.0.0.1:${PORT}/deliverables/20261003/coil-lab/index.html`;
const QUICK = process.argv.includes("--quick"), ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await sleep(900);
const out = { when: new Date().toISOString(), pass: 2, quick: QUICK, gpu: null, runs: [], writes: [], errors: [] };
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
  const probe = (pg) => pg.evaluate(() => ({ fill: __lab.coil.fill(), labels: __lab.coil.labelCheck(), pixels: __lab.coil.pixelShare(), camera: __lab.coil.elevation(), hud: document.getElementById("hud").textContent }));
  const MODES = ["laser", "guide", "holo"];
  const SCREENS = [{ name: "macbook", w: 1680, h: 1050, dpr: 2 }, { name: "appletv", w: 1920, h: 1080, dpr: 1 }];

  if (!ONLY || ONLY === "coil") for (const S of SCREENS) for (const mode of MODES) {
    const video = !QUICK && S.w === 1680;
    const { ctx, pg } = await page(S.w, S.h, S.dpr, false, video ? { scale: 0.5 } : null);
    await pg.goto(`${BASE}?mode=${mode}&list=favorites`); await ready(pg);
    const run = { mode, screen: S.name, w: S.w, h: S.h, dpr: S.dpr, state: await st(pg) };
    await sleep(2700); // the landing (58 steps × 28 ms stagger + 900 ms)
    run.home = await probe(pg); run.hud_has_fps_before_measure = /fps/.test(run.home.hud);
    await pg.screenshot({ path: `${SHOTS}/p2-coil-${mode}-${S.w}-home.png` });
    if (video) { const tick = await pg.evaluate(() => __lab.replayTick()); run.tick_changes = tick; await sleep(900); await pg.screenshot({ path: `${SHOTS}/p2-coil-${mode}-${S.w}-tick.png` }); await sleep(1200); }
    await pg.evaluate(() => __lab.coil.orbitTo(8, 28)); await sleep(500); run.side = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p2-coil-${mode}-${S.w}-side.png` });
    await pg.evaluate(() => __lab.coil.orbitTo(-18, 208)); await sleep(500); run.below_opposite = await probe(pg); // the far side, from under the rim: the labels must still read
    if (video) await pg.screenshot({ path: `${SHOTS}/p2-coil-${mode}-${S.w}-below.png` });
    await pg.evaluate(() => __lab.coil.home()); await sleep(900);
    if (video) { await pg.mouse.move(840, 560); await pg.mouse.down(); for (let i = 1; i <= 10; i++) { await pg.mouse.move(840 + i * 22, 560 + i * 9); await sleep(16); } await pg.mouse.up(); await sleep(400); run.after_drag = await pg.evaluate(() => __lab.coil.elevation()); run.after_drag_labels = await pg.evaluate(() => __lab.coil.labelCheck()); await pg.mouse.dblclick(840, 300); await sleep(900); run.after_dblclick = await pg.evaluate(() => __lab.coil.elevation()); }
    await pg.click("#measure"); await sleep(300); run.hud_while_measuring = await pg.evaluate(() => document.getElementById("hud").textContent);
    await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); run.measure = await pg.evaluate(() => __lab.lastMeasure); out.gpu = run.measure.gpu;
    run.hud_after_measure = await pg.evaluate(() => document.getElementById("hud").textContent);
    if (video) { await pg.evaluate(() => __lab.coil.land()); await sleep(2800); }
    const v = pg.video(); await ctx.close();
    if (v) { const p = await v.path(); const dst = `${SHOTS}/p2-coil-${mode}-1680.webm`; if (existsSync(dst)) unlinkSync(dst); renameSync(p, dst); run.video = `shots/p2-coil-${mode}-1680.webm`; }
    out.runs.push(run); console.log("COIL", S.name, mode, JSON.stringify({ fill: run.home.fill.h, labels: run.home.labels, px: run.home.pixels, side_wrong: run.side.labels.wrong, below_wrong: run.below_opposite.labels.wrong, fps: run.measure.fps, ms: run.measure.render_ms_per_frame, tris: run.measure.triangles, calls: run.measure.calls, hud0: run.hud_has_fps_before_measure }));
  }
  if (!ONLY || ONLY === "coil") for (const mode of MODES) {
    const { ctx, pg } = await page(390, 844, 2, true, null);
    await pg.goto(`${BASE}?mode=${mode}&list=favorites`); await ready(pg); await sleep(2700);
    const home = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p2-coil-${mode}-390-home.png` });
    const m = await pg.evaluate(() => __lab.coil.measure(2500));
    out.runs.push({ mode, screen: "phone", w: 390, h: 844, dpr: 2, state: await st(pg), home, measure: m }); console.log("COIL phone", mode, m.fps, "fps · fill", home.fill.h, "· wrong labels", home.labels.wrong);
    await ctx.close();
  }
  if (!ONLY || ONLY === "coil") for (const list of ["radar", "liked"]) {
    const { ctx, pg } = await page(1920, 1080, 1, false, null);
    await pg.goto(`${BASE}?mode=laser&list=${list}`); await ready(pg); await sleep(3400);
    const home = await probe(pg); await pg.screenshot({ path: `${SHOTS}/p2-coil-laser-1920-${list}.png` }); out.runs.push({ mode: "laser", list, screen: "appletv", w: 1920, state: await st(pg), home }); console.log("COIL", list, "fill", home.fill.h, "wrong", home.labels.wrong, "red/green", home.pixels.red_to_green); await ctx.close();
  }
  // ---- the tape ----
  if (!ONLY || ONLY === "tape") for (const S of [...SCREENS, { name: "phone", w: 390, h: 844, dpr: 2, mobile: true }]) for (const day of ["2026-10-02", "2026-09-24", "all3"]) {
    const { ctx, pg } = await page(S.w, S.h, S.dpr, !!S.mobile, null);
    await pg.goto(`${BASE}?tab=tape&day=${day}`); await ready(pg); await sleep(700);
    const t = await pg.evaluate(() => ({ tape: __lab.tape, ladder: __lab.ladder }));
    // the ladder's two sides: px of bar per × usual, left and right, must agree; the × column always ends in ×
    t.sides = await pg.evaluate(() => { const r = (sel) => [...document.querySelectorAll(sel)].map((i) => ({ z: +i.dataset.z, px: i.getBoundingClientRect().width })).filter((o) => o.z > 0); const up = r("#t3 .t3r.up .t3b i"), dn = r("#t3 .t3r.dn .t3b i"); const k = (a) => a.length ? a.reduce((s, o) => s + o.px / o.z, 0) / a.length : null; const xs = [...document.querySelectorAll("#t3 .t3x")].map((e) => e.textContent); return { up_px_per_x: k(up) && +k(up).toFixed(2), dn_px_per_x: k(dn) && +k(dn).toFixed(2), x_col_all_x: xs.every((s) => /×$/.test(s)), x_col: xs.slice(0, 6), order_up: [...document.querySelectorAll("#t3 .t3r.up .t3n")].map((e) => e.textContent).slice(0, 5), order_dn: [...document.querySelectorAll("#t3 .t3r.dn .t3n")].map((e) => e.textContent).slice(0, 5) }; });
    for (const id of ["t1", "t3"]) { const el = await pg.$("#" + id); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${SHOTS}/p2-tape-${id}-${day}-${S.w}.png` }); }
    // the bigger-screen mode: a tap on the strip opens the ladder as the whole screen; BACK closes it
    await pg.evaluate(() => { document.getElementById("tape").scrollTop = 0; window.scrollTo(0, 0); }); await sleep(100); const cv = await pg.$("#t1 canvas"); const bb = await cv.boundingBox(); await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(300); // the strip back in view, then a real tap on it
    t.zoom = await pg.evaluate(() => ({ open: document.getElementById("zoom").classList.contains("on"), ...__lab.zoom, text: document.getElementById("zoomn").textContent }));
    await pg.screenshot({ path: `${SHOTS}/p2-tape-zoom-${day}-${S.w}.png` });
    await pg.evaluate(() => document.getElementById("zoomback").click()); await sleep(200); t.zoom_closed = await pg.evaluate(() => !document.getElementById("zoom").classList.contains("on"));
    out.runs.push({ tape: day, screen: S.name, w: S.w, h: S.h, ...t }); console.log("TAPE", day, S.w, JSON.stringify({ ladder: t.ladder, sides: t.sides, zoom: t.zoom.open, rowH: t.zoom.rowH, closed: t.zoom_closed })); await ctx.close();
  }
} finally {
  await browser.close(); server.kill("SIGKILL");
}
for (const f of readdirSync(SHOTS)) if (/^[0-9a-f]{32}\.webm$/.test(f)) unlinkSync(resolve(SHOTS, f));
// a partial run (--only) merges into the main proof: its part's runs replace the old ones, the rest stay
if (ONLY && !QUICK && existsSync(`${SHOTS}/proof-p2.json`)) { const old = JSON.parse(readFileSync(`${SHOTS}/proof-p2.json`, "utf8")); const keep = old.runs.filter((r) => (ONLY === "tape" ? !r.tape : !!r.tape)); out.runs = [...keep, ...out.runs]; out.gpu = out.gpu || old.gpu; out.merged_from = old.when; }
writeFileSync(`${SHOTS}/proof-p2${QUICK ? "-quick" : ""}.json`, JSON.stringify(out, null, 1));
console.log("GPU", out.gpu); console.log("writes blocked", out.writes.length, out.writes.slice(0, 5)); console.log("errors", out.errors.length, out.errors.slice(0, 8));
