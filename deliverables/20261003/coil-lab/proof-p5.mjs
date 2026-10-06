/* COIL LAB · the headless proof, PASS 5 (5 Oct 2026, night). Headless Chrome only, the Mac's GPU through ANGLE on Metal, the
   cross-origin check relaxed so the page can read /geiger from 127.0.0.1, every non-GET request blocked and counted. 1680 × 1050 @2.
     · BEFORE   the untouched pass 4 page (the worktree at 253b610, served as it is) from 12 angles → shots/p5-before-NN.png
     · AFTER    this branch's page (matte) from the same 12 angles → shots/p5-after-NN.png
     · CAUSE    the glow look with one layer switched at a time (bloom, additive blending, the white line, the halo, the glass sphere,
                the fog), type off, at the 12 angles: how many lit pixels are the Hub's own green / red, how many are washed toward
                white (the shine), how much of the frame is a dim veil and what colour it is (the hue) — api.pixelAudit()
     · SPIN     real mouse drags: over the pole, sideways, diagonal; the coast after release; double-click home; the wheel as pass 4
     · TUMBLE   a full tumble by mouse, 16 frames → shots/p5-tumble-NN.png, a contact sheet and a video
   Writes shots/proof-p5.json.   node proof-p5.mjs [--only=before|after|cause|spin|tumble] */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../.."), SHOTS = resolve(HERE, "shots"); mkdirSync(SHOTS, { recursive: true });
const V4ROOT = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-v2-coil-lab-20261003"; // pass 4, untouched (253b610)
const PORT = 8797, PORT4 = 8798, REL = "/deliverables/20261003/coil-lab/";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const want = (k) => !ONLY || ONLY.split(",").includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const servers = [spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(PORT4), "--bind", "127.0.0.1"], { cwd: V4ROOT, stdio: "ignore" })];
await sleep(1000);
const JSONP = `${SHOTS}/proof-p5.json`;
const out = existsSync(JSONP) && ONLY ? JSON.parse(readFileSync(JSONP, "utf8")) : {}; Object.assign(out, { when: new Date().toISOString(), pass: 5, screen: { w: 1680, h: 1050, dpr: 2 } }); out.writes = []; out.errors = [];
const W = 1680, H = 1050, DPR = 2;
const ANGLES = [[70, null], [45, 40], [20, 28], [8, 28], [0, 90], [-8, 150], [-18, 208], [-45, 250], [-70, 300], [89, 0], [-89, 0], [30, 180]]; // elevation, azimuth (null = home's)
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--disable-web-security", "--hide-scrollbars", "--disable-extensions", "--no-first-run"] });
try {
  async function page(video) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, ...(video ? { recordVideo: { dir: SHOTS, size: { width: W / 2, height: H / 2 } } } : {}) });
    await ctx.route("**/*", (route) => { const req = route.request(); if (req.method() !== "GET") { out.writes.push(req.method() + " " + req.url()); return route.abort(); } route.continue(); });
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => out.errors.push(String(e))); pg.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text().slice(0, 300)); });
    return { ctx, pg };
  }
  const open = async (pg, port, q) => { await pg.goto(`http://127.0.0.1:${port}${REL}index.html?${q}`); await pg.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 60000 }); await sleep(3400); };
  const Q = "mode=laser&list=favorites"; // the page as it opens: LASER, ★ FAVORITES, the sphere
  const nn = (i) => String(i + 1).padStart(2, "0");
  const goto = async (pg, [el, az]) => { await pg.evaluate(([el, az, haz]) => __lab.coil.orbitTo(el, az == null ? haz : az), [el, az, out.home_az]); await sleep(380); await pg.evaluate(() => document.getElementById("gl").dispatchEvent(new Event("pointerup"))); await sleep(120); };
  const stamp = (pg) => pg.evaluate(() => ({ stamp: document.getElementById("stamp").textContent, geigerFrom: __lab.geigerFrom, rows: __lab.rows.length, sets: __lab.coil.sets() }));

  if (want("before")) {
    const { ctx, pg } = await page(false); await open(pg, PORT4, Q); out.home_az = (await pg.evaluate(() => __lab.coil.elevation())).az;
    out.before = { served: "pass 4, the worktree at 253b610, untouched", state: await stamp(pg), shots: [] };
    for (let i = 0; i < ANGLES.length; i++) { await goto(pg, ANGLES[i]); const p = `shots/p5-before-${nn(i)}.png`; await pg.screenshot({ path: resolve(HERE, p) }); out.before.shots.push({ n: i + 1, el: ANGLES[i][0], az: ANGLES[i][1] ?? out.home_az, path: p, pixels: await pg.evaluate(() => __lab.coil.pixelShare()) }); }
    await ctx.close(); console.log("BEFORE", out.before.shots.length, "shots · home az", out.home_az);
  }
  if (want("after")) {
    const { ctx, pg } = await page(false); await open(pg, PORT, Q); if (out.home_az == null) out.home_az = (await pg.evaluate(() => __lab.coil.elevation())).az;
    out.after = { served: "this branch, matte", state: await stamp(pg), spec: await pg.evaluate(() => __lab.coil.look_spec()), beam: await pg.evaluate(() => __lab.coil.beamPx()), labels: await pg.evaluate(() => __lab.coil.labelCheck()), shots: [] };
    for (let i = 0; i < ANGLES.length; i++) { await goto(pg, ANGLES[i]); const p = `shots/p5-after-${nn(i)}.png`; await pg.screenshot({ path: resolve(HERE, p) }); out.after.shots.push({ n: i + 1, el: ANGLES[i][0], az: ANGLES[i][1] ?? out.home_az, path: p, labels: await pg.evaluate(() => { const c = __lab.coil.labelCheck(); return { shown: c.labels, wrong: c.wrong, px: c.rule_px }; }) }); }
    // the other two zooms and the two-sphere view, matte
    await pg.evaluate(() => __lab.coil.home()); await sleep(900);
    for (const [k, r] of [["in", 0.5], ["out", 2]]) { await pg.evaluate((r) => __lab.coil.zoom(r), r); await sleep(350); out.after["beam_" + k] = await pg.evaluate(() => __lab.coil.beamPx()); await pg.screenshot({ path: `${SHOTS}/p5-after-zoom-${k}.png` }); }
    await ctx.close();
    { const { ctx, pg } = await page(false); await open(pg, PORT, "mode=laser&compare=favorites,radar&cap=sphere"); await pg.screenshot({ path: `${SHOTS}/p5-after-spheres.png` }); await pg.evaluate(() => __lab.coil.orbitTo(8, 20)); await sleep(400); await pg.screenshot({ path: `${SHOTS}/p5-after-spheres-side.png` }); await ctx.close(); }
    console.log("AFTER", out.after.shots.length, "shots", JSON.stringify(out.after.spec), "type/core px", out.after.beam.type_px, out.after.beam.core_px);
  }
  if (want("cause")) {
    // one page, the glow look (pass 4's materials), the type off so only the 3D is counted; each variant switches ONE layer off
    const { ctx, pg } = await page(false); await open(pg, PORT, Q + "&look=glow"); if (out.home_az == null) out.home_az = (await pg.evaluate(() => __lab.coil.elevation())).az;
    const ALL = { bloom: true, additive: true, hot: true, halo: true, sphere: true, fog: true, labels: false };
    const VARIANTS = [["pass 4 as it is", {}], ["no bloom", { bloom: false }], ["no additive blending", { additive: false }], ["no bloom, no additive", { bloom: false, additive: false }], ["no white line", { hot: false }], ["no halo", { halo: false }], ["no glass sphere", { sphere: false }], ["no fog", { fog: false }]];
    out.cause = { note: "per angle: washed = lit pixels that are bright and under 0.45 saturation (the shine); veil = pixels brighter than the page and the zero band but darker than a bar (the hue), with their mean colour; true = lit pixels within 24 a channel of 00FFA3 or FF2D55", variants: [] };
    const audit = async () => { const rows = []; for (const a of ANGLES) { await pg.evaluate(([el, az, haz]) => __lab.coil.orbitTo(el, az == null ? haz : az), [a[0], a[1], out.home_az]); await sleep(120); rows.push(await pg.evaluate(() => __lab.coil.pixelAudit())); } return rows; };
    const sum = (rows) => { const t = (k) => rows.reduce((s, r) => s + r[k], 0), lit = t("lit"), px = t("px"); const worst = rows.map((r, i) => [i + 1, r.washed_share_of_lit]).sort((a, b) => b[1] - a[1])[0]; const veil = t("veil"); const vr = [0, 1, 2].map((c) => Math.round(rows.reduce((s, r) => s + (r.veil_rgb ? r.veil_rgb[c] * r.veil : 0), 0) / Math.max(1, veil)));
      return { page_corner_rgb: rows[0].page_corner_rgb, true_share_of_lit: +((t("true_green") + t("true_red")) / lit).toFixed(4), true_red_of_reddish: +(t("true_red") / Math.max(1, t("reddish"))).toFixed(4), true_green_of_greenish: +(t("true_green") / Math.max(1, t("greenish"))).toFixed(4), washed_share_of_lit: +(t("washed") / lit).toFixed(4), white_share_of_lit: +(t("white") / lit).toFixed(4), worst_angle_washed: worst, veil_share_of_frame: +(veil / px).toFixed(4), veil_rgb: vr, lit_share_of_frame: +(lit / px).toFixed(4), frame_mean_rgb: [0, 1, 2].map((c) => +(rows.reduce((s, r) => s + r.frame_mean_rgb[c], 0) / rows.length).toFixed(1)) }; };
    for (const [name, off] of VARIANTS) { await pg.evaluate((d) => __lab.coil.diag(d), { ...ALL, ...off }); await sleep(250); const rows = await audit(); const v = { name, off: Object.keys(off), sum: sum(rows), per_angle: rows.map((r, i) => ({ n: i + 1, washed: r.washed_share_of_lit, white: r.white_share_of_lit, veil: r.veil_share_of_frame, veil_rgb: r.veil_rgb, true: r.true_share_of_lit })) }; out.cause.variants.push(v); console.log("CAUSE", name.padEnd(24), JSON.stringify(v.sum)); }
    // two pictures of the worst angle with the layers named: pass 4, and pass 4 without the sum (no bloom, no additive)
    const worstN = out.cause.variants[0].sum.worst_angle_washed[0]; out.cause.worst_angle = { n: worstN, el: ANGLES[worstN - 1][0], az: ANGLES[worstN - 1][1] ?? out.home_az };
    for (const [tag, off] of [["glow", {}], ["nobloom", { bloom: false }], ["noadditive", { additive: false }], ["neither", { bloom: false, additive: false }]]) { await pg.evaluate((d) => __lab.coil.diag(d), { ...ALL, labels: true, ...off }); await goto(pg, ANGLES[worstN - 1]); await pg.screenshot({ path: `${SHOTS}/p5-cause-${tag}.png` }); }
    // and matte, audited the same way
    await pg.evaluate(() => { __lab.coil.diag({ bloom: true, additive: true, hot: true, halo: true, sphere: true, fog: true, labels: false }); __lab.coil.setLook("matte"); }); await sleep(250);
    { const rows = await audit(); const v = { name: "MATTE (pass 5)", off: [], sum: sum(rows), per_angle: rows.map((r, i) => ({ n: i + 1, washed: r.washed_share_of_lit, white: r.white_share_of_lit, veil: r.veil_share_of_frame, veil_rgb: r.veil_rgb, true: r.true_share_of_lit, true_red_of_reddish: r.true_red_of_reddish, true_green_of_greenish: r.true_green_of_greenish })) }; out.cause.matte = v; console.log("CAUSE", v.name.padEnd(24), JSON.stringify(v.sum)); }
    out.cause.scene = await pg.evaluate(() => __lab.coil.look_spec());
    await ctx.close();
  }
  if (want("spin")) {
    const { ctx, pg } = await page(false); await open(pg, PORT, Q); const cx = W / 2, cy = 560;
    const att = () => pg.evaluate(() => __lab.coil.attitude());
    const drag = async (dx, dy, steps = 30, hold = 60) => { await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let i = 1; i <= steps; i++) { await pg.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps); await sleep(8); } await sleep(hold); await pg.mouse.up(); };
    const settle = async () => { for (let i = 0; i < 80; i++) { const a = await att(); if (!a.coasting && !a.moving) return; await sleep(50); } };
    const angleBetween = (a, b) => +((Math.acos(Math.max(-1, Math.min(1, a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2]))) * 180) / Math.PI).toFixed(1);
    const s = out.spin = { controls: (await pg.evaluate(() => __lab.coil.look_spec())).controls, home: await att(), drags: [] };
    // 1 · straight up the screen, twice: the camera goes over the top of the coil and on — past the pole OrbitControls stops at
    await drag(0, 420, 40, 200); await settle(); const a1 = await att(); s.drags.push({ what: "drag down 420 px (the view climbs over the top)", after: a1, turned_deg: angleBetween(s.home, a1) });
    await drag(0, 420, 40, 200); await settle(); const a2 = await att(); s.drags.push({ what: "the same again", after: a2, turned_deg: angleBetween(a1, a2) });
    s.over_the_pole = s.drags.some((d) => d.after.upside_down); await pg.screenshot({ path: `${SHOTS}/p5-spin-over-the-pole.png` });
    // 2 · sideways, then diagonal: three different axes
    await drag(500, 0, 40, 200); await settle(); const a3 = await att(); s.drags.push({ what: "drag right 500 px", after: a3, turned_deg: angleBetween(a2, a3) });
    await drag(-300, -300, 40, 200); await settle(); const a4 = await att(); s.drags.push({ what: "drag up-left 300 / 300 px", after: a4, turned_deg: angleBetween(a3, a4) }); await pg.screenshot({ path: `${SHOTS}/p5-spin-diagonal.png` });
    // 3 · the coast: a quick flick, released while moving — per frame until it stops
    const before = await att(); await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let i = 1; i <= 8; i++) { await pg.mouse.move(cx + i * 30, cy + i * 8); await sleep(8); } const atRelease = await att(); await pg.mouse.up();
    const trace = await pg.evaluate(() => new Promise((res) => { const t0 = performance.now(), f = []; let still = 0, last = null; const step = (now) => { const a = __lab.coil.attitude(); const moved = last ? Math.hypot(a.dir[0] - last[0], a.dir[1] - last[1], a.dir[2] - last[2]) : 1; last = a.dir; f.push([+(now - t0).toFixed(0), a.dir, a.coasting]); still = moved < 1e-4 ? still + 1 : 0; if (still > 12 || now - t0 > 4000) res(f); else requestAnimationFrame(step); }; requestAnimationFrame(step); }));
    const lastMove = (() => { for (let i = trace.length - 1; i > 0; i--) if (Math.hypot(trace[i][1][0] - trace[i - 1][1][0], trace[i][1][1] - trace[i - 1][1][1], trace[i][1][2] - trace[i - 1][1][2]) >= 1e-4) return i; return 0; })();
    const end = await att(); s.coast = { flick_px: [240, 64], turned_while_dragging_deg: angleBetween(before, atRelease), coasted_after_release_deg: angleBetween(atRelease, end), coast_ms: trace[lastMove][0], frames: trace.length, stopped: !end.coasting };
    // 4 · double-click: home again, upright
    await pg.mouse.dblclick(cx, cy); await sleep(1100); await settle(); s.after_double_click = await att(); s.home_again = { dir_off_deg: angleBetween(s.home, s.after_double_click), up: s.after_double_click.up, upright: s.after_double_click.up[1] > 0.999 }; await pg.screenshot({ path: `${SHOTS}/p5-spin-home-again.png` });
    // 5 · the wheel, as pass 4 measured it: 20 ticks in, 20 out
    await pg.mouse.move(cx, cy); await pg.evaluate(() => __lab.coil.record(true)); for (let i = 0; i < 20; i++) { await pg.mouse.wheel(0, -120 * DPR); await sleep(30); } await sleep(700); for (let i = 0; i < 20; i++) { await pg.mouse.wheel(0, 120 * DPR); await sleep(30); } await sleep(700);
    const w = await pg.evaluate(() => __lab.coil.record(false)); delete w.trace; s.wheel = w; s.wheel_end = await pg.evaluate(() => __lab.coil.labelCheck());
    // 6 · the wheel while the view is upside down keeps the attitude
    await drag(0, 500, 30, 200); await settle(); const u0 = await att(); for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, -120 * DPR); await sleep(30); } await sleep(700); const u1 = await att(); s.zoom_keeps_attitude = { before: u0, after: u1, dir_off_deg: angleBetween(u0, u1), up_kept: Math.hypot(u0.up[0] - u1.up[0], u0.up[1] - u1.up[1], u0.up[2] - u1.up[2]) < 0.01 };
    await pg.evaluate(() => __lab.coil.home()); await sleep(1100);
    await pg.click("#measure"); await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); s.measure = await pg.evaluate(() => __lab.lastMeasure); out.gpu = s.measure.gpu;
    await ctx.close();
    console.log("SPIN", JSON.stringify({ over_the_pole: s.over_the_pole, drags: s.drags.map((d) => [d.turned_deg, d.after.el, d.after.upside_down]), coast: s.coast, home_again: s.home_again, wheel: { fps: w.fps_while_moving, gap: w.longest_gap_ms_while_moving, step: w.max_frame_step_share_of_travel, reflips_s: w.reflips_per_second }, zoom_keeps: [s.zoom_keeps_attitude.dir_off_deg, s.zoom_keeps_attitude.up_kept], fps: s.measure.fps }));
  }
  if (want("tumble")) {
    // a full tumble by mouse: 16 drags of 150 px, the direction turning a little each time, a picture after each; then the same as a video
    const run = async (video) => { const { ctx, pg } = await page(video); await open(pg, PORT, Q); const cx = W / 2, cy = 560, frames = [];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 0.9 + 0.5, dx = Math.cos(a) * 190, dy = Math.sin(a) * 190; await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let k = 1; k <= 12; k++) { await pg.mouse.move(cx + (dx * k) / 12, cy + (dy * k) / 12); await sleep(video ? 16 : 6); } await sleep(video ? 0 : 150); await pg.mouse.up(); await sleep(video ? 250 : 900);
        if (!video) { const p = `shots/p5-tumble-${nn(i)}.png`; await pg.screenshot({ path: resolve(HERE, p) }); frames.push({ n: i + 1, path: p, attitude: await pg.evaluate(() => __lab.coil.attitude()), audit: await pg.evaluate(() => { __lab.coil.diag({ labels: false }); const a = __lab.coil.pixelAudit(); __lab.coil.diag({ labels: true }); return { washed: a.washed_share_of_lit, veil: a.veil_share_of_frame, true: a.true_share_of_lit }; }) }); } }
      if (video) { await pg.mouse.dblclick(cx, cy); await sleep(1400); const v = pg.video(); await ctx.close(); const p = await v.path(); const dst = `${SHOTS}/p5-tumble-1680.webm`; if (existsSync(dst)) unlinkSync(dst); renameSync(p, dst); return "shots/p5-tumble-1680.webm"; }
      await ctx.close(); return frames; };
    out.tumble = { frames: await run(false) }; out.tumble.upside_down_frames = out.tumble.frames.filter((f) => f.attitude.upside_down).length; out.tumble.video = await run(true);
    // the contact sheets (for a glance): before / after 12 angles, and the tumble
    const { ctx, pg } = await page(false);
    const sheet = async (name, cols, cells) => { await pg.setViewportSize({ width: 1680, height: Math.ceil(cells.length / cols) * Math.round((1680 / cols) * (H / W) + 22) + 8 }); await pg.setContent(`<body style="margin:0;background:#0a0a0f;font:600 11px ui-monospace,Menlo,monospace;color:#868aaa"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px">${cells.map((c) => `<div><img src="http://127.0.0.1:${PORT}${REL}${c.path}" style="width:100%;display:block"><div style="padding:3px 2px;letter-spacing:.08em">${c.cap}</div></div>`).join("")}</div></body>`); await sleep(1500); await pg.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
    const cap = (i) => `${i + 1} · el ${ANGLES[i][0]}° az ${ANGLES[i][1] ?? out.home_az}°`;
    await sheet("p5-sheet-before", 4, ANGLES.map((_, i) => ({ path: `shots/p5-before-${nn(i)}.png`, cap: cap(i) + " · BEFORE" })));
    await sheet("p5-sheet-after", 4, ANGLES.map((_, i) => ({ path: `shots/p5-after-${nn(i)}.png`, cap: cap(i) + " · AFTER" })));
    await sheet("p5-sheet-tumble", 4, out.tumble.frames.map((f) => ({ path: f.path, cap: `tumble ${f.n}${f.attitude.upside_down ? " · upside down" : ""}` })));
    await ctx.close(); console.log("TUMBLE", out.tumble.frames.length, "frames ·", out.tumble.upside_down_frames, "upside down ·", out.tumble.video);
  }
} finally {
  await browser.close(); for (const s of servers) s.kill("SIGKILL");
}
for (const f of readdirSync(SHOTS)) if (/^[0-9a-f]{32}\.webm$/.test(f) || /^page@[0-9a-f]+\.webm$/.test(f)) unlinkSync(resolve(SHOTS, f));
writeFileSync(JSONP, JSON.stringify(out, null, 1));
console.log("GPU", out.gpu); console.log("writes blocked", out.writes.length, out.writes.slice(0, 5)); console.log("errors", out.errors.length, out.errors.slice(0, 8));
