/* COIL LAB · the headless proof, PASS 6 (6 Oct 2026). Headless Chrome only, the Mac's GPU through ANGLE on Metal, the cross-origin
   check relaxed so the page can read /geiger from 127.0.0.1, every non-GET request blocked and counted. 1680 × 1050 @2.
     · BEFORE   pass 5 (the worktree at 74883f8, served as it is) from pass 5's 12 angles → shots/p6-before-NN.jpg
     · AFTER    this branch (the contained laser) from the same 12 angles → shots/p6-after-NN.jpg; at each angle api.spill() (every
                pixel the bars change lies inside a bar's footprint; the page prints 0A0A0F), the colour audit with the type off,
                the picture itself read back (the page colour at four points of the coil's pane), and the front row's labels
     · SPIN     the same slow 200 px drag on pass 5 and on this branch → degrees per 100 px; over the top; the coast; double-click home
     · LABELS   five slow drags with every rendered frame recorded: labels that changed state twice within 500 ms (must be 0),
                and at every sampled frame the front row all shown
     · LIST     the list's height against the coil's; its order against the readings; a row lights its bar, a bar lights its row
     · TUMBLE   a full tumble by mouse, 16 frames → shots/p6-tumble-NN.jpg, the contact sheets and a video
   Writes shots/proof-p6.json.   node proof-p6.mjs [--only=before|after|spin|labels|list|tumble] */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "../../.."), SHOTS = resolve(HERE, "shots"); mkdirSync(SHOTS, { recursive: true });
const V5ROOT = "/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-v5-coil-20261005"; // pass 5, untouched (74883f8)
const PORT = 8807, PORT5 = 8808, REL = "/deliverables/20261003/coil-lab/";
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const want = (k) => !ONLY || ONLY.split(",").includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const servers = [spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" }), spawn("python3", ["-m", "http.server", String(PORT5), "--bind", "127.0.0.1"], { cwd: V5ROOT, stdio: "ignore" })];
await sleep(1000);
const JSONP = `${SHOTS}/proof-p6.json`;
const out = existsSync(JSONP) && ONLY ? JSON.parse(readFileSync(JSONP, "utf8")) : {}; Object.assign(out, { when: new Date().toISOString(), pass: 6, screen: { w: 1680, h: 1050, dpr: 2 } }); out.writes = out.writes || []; out.errors = out.errors || [];
const W = 1680, H = 1050, DPR = 2;
const ANGLES = [[70, null], [45, 40], [20, 28], [8, 28], [0, 90], [-8, 150], [-18, 208], [-45, 250], [-70, 300], [89, 0], [-89, 0], [30, 180]]; // pass 5's 12: elevation, azimuth (null = home's)
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal", "--disable-web-security", "--hide-scrollbars", "--disable-extensions", "--no-first-run"] });
try {
  async function page(video, vp = { width: W, height: H }, dpr = DPR) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, ...(video ? { recordVideo: { dir: SHOTS, size: { width: W / 2, height: H / 2 } } } : {}) });
    await ctx.route("**/*", (route) => { const req = route.request(); if (req.method() !== "GET") { out.writes.push(req.method() + " " + req.url()); return route.abort(); } route.continue(); });
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => out.errors.push(String(e))); pg.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text().slice(0, 300)); });
    return { ctx, pg };
  }
  const open = async (pg, port, q) => { await pg.goto(`http://127.0.0.1:${port}${REL}index.html?${q}`); await pg.waitForFunction(() => window.__lab && window.__lab.ready, null, { timeout: 60000 }); await sleep(3400); };
  const Q = "mode=laser&list=favorites";
  const nn = (i) => String(i + 1).padStart(2, "0");
  const goto = async (pg, [el, az]) => { await pg.evaluate(([el, az, haz]) => __lab.coil.orbitTo(el, az == null ? haz : az), [el, az, out.home_az]); await sleep(900); await pg.evaluate(() => document.getElementById("gl").dispatchEvent(new Event("pointerup"))); await sleep(120); }; // 900 ms: past the labels' 500 ms dwell, so the picture is the settled one
  const stamp = (pg) => pg.evaluate(() => ({ stamp: document.getElementById("stamp").textContent, geigerFrom: __lab.geigerFrom, rows: __lab.rows.length }));
  const att = (pg) => pg.evaluate(() => __lab.coil.attitude());
  const angleBetween = (a, b) => +((Math.acos(Math.max(-1, Math.min(1, a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2]))) * 180) / Math.PI).toFixed(1);
  const settle = async (pg) => { for (let i = 0; i < 80; i++) { const a = await att(pg); if (!a.coasting && !a.moving) return; await sleep(50); } };
  const drag = async (pg, cx, cy, dx, dy, steps = 30, hold = 60, gap = 8) => { await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let i = 1; i <= steps; i++) { await pg.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps); await sleep(gap); } await sleep(hold); await pg.mouse.up(); };
  // the picture itself, read back: a lossless capture of the screen, decoded in the page, sampled at four points of the coil's pane (well clear of the coil, the type and the list)
  const readBack = async (pg) => { const png = (await pg.screenshot({ type: "png" })).toString("base64"); return pg.evaluate(async (b64) => { const r = document.getElementById("gl").getBoundingClientRect(), img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext("2d", { colorSpace: "srgb" }); g.drawImage(img, 0, 0); const k = img.naturalWidth / window.innerWidth;
      const at = (x, y) => Array.from(g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)); return { points: [at(r.left + 30, r.top + 30), at(r.right - 30, r.top + 30), at(r.left + 30, r.top + r.height * 0.5), at(r.right - 30, r.top + r.height * 0.5)], where: "30 px in from the pane's top corners and from its left and right edges at mid height" }; }, png); };

  if (want("before")) {
    const { ctx, pg } = await page(false); await open(pg, PORT5, Q); out.home_az = (await pg.evaluate(() => __lab.coil.elevation())).az;
    out.before = { served: "pass 5, the worktree at 74883f8, untouched", state: await stamp(pg), shots: [] };
    for (let i = 0; i < ANGLES.length; i++) { await goto(pg, ANGLES[i]); const p = `shots/p6-before-${nn(i)}.jpg`; await pg.screenshot({ path: resolve(HERE, p), type: "jpeg", quality: 88 }); out.before.shots.push({ n: i + 1, el: ANGLES[i][0], az: ANGLES[i][1] ?? out.home_az, path: p, labels: await pg.evaluate(() => { const L = __lab.coil.labelStats(); return { shown: L.shown, hidden: L.hidden }; }) }); }
    await ctx.close(); console.log("BEFORE", out.before.shots.length, "shots · home az", out.home_az);
  }
  if (want("after")) {
    const { ctx, pg } = await page(false); await open(pg, PORT, Q); if (out.home_az == null) out.home_az = (await pg.evaluate(() => __lab.coil.elevation())).az;
    out.after = { served: "this branch, the contained laser", state: await stamp(pg), spec: await pg.evaluate(() => __lab.coil.look_spec()), beam: await pg.evaluate(() => __lab.coil.beamPx()), shots: [] };
    for (let i = 0; i < ANGLES.length; i++) { await goto(pg, ANGLES[i]); const p = `shots/p6-after-${nn(i)}.jpg`; await pg.screenshot({ path: resolve(HERE, p), type: "jpeg", quality: 88 });
      const m = await pg.evaluate(() => { const c = __lab.coil, L = c.labels(), S = c.labelStats(), chk = c.labelCheck(); const front = L.filter((x) => x.front); c.labelsOn(false); const a = c.pixelAudit(), sp = c.spill(); c.labelsOn(true);
        return { spill: sp, audit: { page_corner_rgb: a.page_corner_rgb, washed_share_of_lit: a.washed_share_of_lit, white_share_of_lit: a.white_share_of_lit, veil_share_of_frame: a.veil_share_of_frame, true_green_of_greenish: a.true_green_of_greenish, true_red_of_reddish: a.true_red_of_reddish }, labels: { shown: S.shown, hidden: S.hidden, wrong: chk.wrong, px: chk.rule_px, front: front.length, front_shown: front.filter((x) => x.shown).length, front_names: front.map((x) => x.t), front_overlaps: S.front_overlaps, slid: front.filter((x) => x.slot > 0).length, max_slot: Math.max(0, ...front.map((x) => x.slot)) } }; });
      out.after.shots.push({ n: i + 1, el: ANGLES[i][0], az: ANGLES[i][1] ?? out.home_az, path: p, ...m, picture: await readBack(pg) }); }
    await pg.evaluate(() => __lab.coil.home()); await sleep(1200);
    for (const [k, r] of [["in", 0.5], ["out", 2]]) { await pg.evaluate((r) => __lab.coil.zoom(r), r); await sleep(900); out.after["zoom_" + k] = await pg.evaluate(() => { const c = __lab.coil; const b = c.beamPx(); c.labelsOn(false); const s = c.spill(); c.labelsOn(true); return { beam: b, outside_a_footprint: s.outside_a_footprint, corners: s.corners }; }); await pg.screenshot({ path: `${SHOTS}/p6-after-zoom-${k}.jpg`, type: "jpeg", quality: 88 }); }
    await ctx.close();
    { const { ctx, pg } = await page(false); await open(pg, PORT, "mode=laser&compare=favorites,radar&cap=sphere"); await pg.screenshot({ path: `${SHOTS}/p6-after-spheres.jpg`, type: "jpeg", quality: 88 }); out.after.spheres = await pg.evaluate(() => { const c = __lab.coil; c.labelsOn(false); const s = c.spill(); c.labelsOn(true); return { outside_a_footprint: s.outside_a_footprint, corners: s.corners, rank: __lab.rank }; }); await ctx.close(); }
    const S = out.after.shots; out.after.sum = { outside_a_footprint: S.reduce((a, s) => a + s.spill.outside_a_footprint, 0), bar_px: S.reduce((a, s) => a + s.spill.px_the_bars_changed, 0), corners_all_page: S.every((s) => s.spill.corners.every((c) => c.join() === "10,10,15")), picture_points_all_page: S.every((s) => s.picture.points.every((c) => c.join() === "10,10,15")), washed_max: Math.max(...S.map((s) => s.audit.washed_share_of_lit)), white_max: Math.max(...S.map((s) => s.audit.white_share_of_lit)), front_all_shown: S.every((s) => s.labels.front === s.labels.front_shown), front_overlaps: S.reduce((a, s) => a + s.labels.front_overlaps, 0), wrong: S.reduce((a, s) => a + s.labels.wrong, 0) };
    console.log("AFTER", JSON.stringify(out.after.sum), "type/footprint px", out.after.beam.type_px, out.after.beam.core_px);
  }
  if (want("spin")) {
    const cx = W / 2 - 80, cy = 560, s = out.spin = {};
    // the same slow drag on both pages: 200 px to the right, 40 steps, held before release so nothing coasts
    for (const [tag, port] of [["pass5", PORT5], ["pass6", PORT]]) { const { ctx, pg } = await page(false); await open(pg, port, Q); const turns = [];
      for (const [dx, dy] of [[200, 0], [0, 200], [-200, 0], [0, -200], [141, 141], [-141, 141]]) { await pg.evaluate(() => __lab.coil.home()); await sleep(1300); const a0 = await att(pg); await drag(pg, cx, cy, dx, dy, 50, 500, 17); await settle(pg); turns.push(angleBetween(a0, await att(pg))); }
      s[tag] = { rotate_speed: (await pg.evaluate(() => __lab.coil.look_spec())).spin.rotate_speed, six_drags_of_200px_deg: turns, deg_per_100px: +(turns.reduce((a, b) => a + b, 0) / turns.length / 2).toFixed(1) }; await ctx.close(); }
    s.ratio = +(s.pass6.deg_per_100px / s.pass5.deg_per_100px).toFixed(2);
    const { ctx, pg } = await page(false); await open(pg, PORT, Q); s.home = await att(pg); s.drags = [];
    // free in every direction: down (over the top and on), sideways, diagonal
    let prev = s.home; for (const [what, dx, dy] of [["drag down 440 px", 0, 440], ["the same again", 0, 440], ["and again (over the top by now)", 0, 440], ["drag right 500 px", 500, 0], ["drag up-left 300 / 300 px", -300, -300]]) { await drag(pg, cx, cy, dx, dy, 40, 200); await settle(pg); const a = await att(pg); s.drags.push({ what, after: a, turned_deg: angleBetween(prev, a) }); prev = a; }
    s.over_the_pole = s.drags.some((d) => d.after.upside_down); await pg.screenshot({ path: `${SHOTS}/p6-spin-over-the-top.jpg`, type: "jpeg", quality: 88 });
    // the coast: a quick flick released while moving
    const before = await att(pg); await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let i = 1; i <= 8; i++) { await pg.mouse.move(cx + i * 30, cy + i * 8); await sleep(8); } const atRelease = await att(pg); await pg.mouse.up();
    const trace = await pg.evaluate(() => new Promise((res) => { const t0 = performance.now(), f = []; let still = 0, last = null; const step = (now) => { const a = __lab.coil.attitude(); const moved = last ? Math.hypot(a.dir[0] - last[0], a.dir[1] - last[1], a.dir[2] - last[2]) : 1; last = a.dir; f.push([+(now - t0).toFixed(0), a.dir]); still = moved < 1e-4 ? still + 1 : 0; if (still > 12 || now - t0 > 4000) res(f); else requestAnimationFrame(step); }; requestAnimationFrame(step); }));
    const lastMove = (() => { for (let i = trace.length - 1; i > 0; i--) if (Math.hypot(trace[i][1][0] - trace[i - 1][1][0], trace[i][1][1] - trace[i - 1][1][1], trace[i][1][2] - trace[i - 1][1][2]) >= 1e-4) return i; return 0; })();
    const end = await att(pg); s.coast = { flick_px: [240, 64], turned_while_dragging_deg: angleBetween(before, atRelease), coasted_after_release_deg: angleBetween(atRelease, end), coast_ms: trace[lastMove][0], stopped: !end.coasting };
    await pg.mouse.dblclick(cx, cy); await sleep(1100); await settle(pg); const h = await att(pg); s.home_again = { dir_off_deg: angleBetween(s.home, h), up: h.up, upright: h.up[1] > 0.999 };
    // the wheel, as pass 4 measured it
    await pg.mouse.move(cx, cy); await pg.evaluate(() => __lab.coil.record(true)); for (let i = 0; i < 20; i++) { await pg.mouse.wheel(0, -120 * DPR); await sleep(30); } await sleep(700); for (let i = 0; i < 20; i++) { await pg.mouse.wheel(0, 120 * DPR); await sleep(30); } await sleep(700);
    const w = await pg.evaluate(() => __lab.coil.record(false)); delete w.trace; s.wheel = w;
    await pg.evaluate(() => __lab.coil.home()); await sleep(1100);
    await pg.click("#measure"); await pg.waitForFunction(() => __lab.lastMeasure && !__lab.measuring, null, { timeout: 20000 }); s.measure = await pg.evaluate(() => __lab.lastMeasure); out.gpu = s.measure.gpu;
    await ctx.close();
    console.log("SPIN", JSON.stringify({ pass5: s.pass5, pass6: s.pass6, ratio: s.ratio, over: s.over_the_pole, drags: s.drags.map((d) => [d.turned_deg, d.after.upside_down]), coast: s.coast, home_again: s.home_again, wheel: { fps: w.fps_while_moving, reflips_s: w.reflips_per_second }, fps: s.measure.fps }));
  }
  if (want("labels")) {
    // five slow drags (the coil turning under the hand), every rendered frame recorded; between frames the front row is sampled
    const { ctx, pg } = await page(false); await open(pg, PORT, Q); const cx = W / 2 - 80, cy = 560;
    await pg.evaluate(() => { __lab.coil.record(true); window.__front = { samples: 0, missing: 0, names: new Set(), overlaps: 0 }; window.__iv = setInterval(() => { const L = __lab.coil.labels(); const f = L.filter((x) => x.front); __front.samples++; __front.missing += f.filter((x) => !x.shown).length; f.forEach((x) => __front.names.add(x.t)); }, 50); });
    const DR = [[420, 0], [0, 300], [-380, 120], [200, -340], [-300, -200]];
    for (const [dx, dy] of DR) { await drag(pg, cx, cy, dx, dy, 90, 60, 16); await sleep(700); }
    const rec = await pg.evaluate(() => { clearInterval(window.__iv); const r = __lab.coil.record(false); delete r.trace; return { rec: r, front: { samples: __front.samples, missing: __front.missing, distinct_names_that_were_front: __front.names.size } }; });
    out.labels = { drags: DR.length, seconds: rec.rec.seconds, frames: rec.rec.frames, changes: rec.rec.pops, reflips_within_500ms: rec.rec.reflips_within_500ms, front_samples: rec.front.samples, front_labels_missing: rec.front.missing, distinct_front_names: rec.front.distinct_names_that_were_front, rule: (await pg.evaluate(() => __lab.coil.look_spec())).front_rule };
    await ctx.close(); console.log("LABELS", JSON.stringify(out.labels));
  }
  if (want("list")) {
    const { ctx, pg } = await page(false); await open(pg, PORT, Q); const L = out.list = {};
    L.favorites = await pg.evaluate(() => { const gl = document.getElementById("gl").getBoundingClientRect(), rk = document.getElementById("rank").getBoundingClientRect(), lis = [...document.querySelectorAll("#rk li")], f = lis[0].getBoundingClientRect(), l = lis[lis.length - 1].getBoundingClientRect(); const rows = lis.map((li) => ({ n: +li.querySelector(".n").textContent, t: li.dataset.t, v: li.querySelector(".v").textContent }));
      const ord = __lab.coil.order(), want = __lab.rows.filter((r) => r.v != null).sort((a, b) => b.v - a.v || (a.t < b.t ? -1 : 1)).map((r) => r.t).concat(__lab.rows.filter((r) => r.v == null).map((r) => r.t));
      const bars = __lab.coil.labels(), byT = Object.fromEntries(bars.map((b) => [b.t, b.tip])); let tipsDescend = true; for (let i = 1; i < ord.length; i++) if (ord[i].v != null && ord[i - 1].v != null && byT[ord[i].t] > byT[ord[i - 1].t] + 1e-6) tipsDescend = false;
      return { rank: __lab.rank, coil_pane_h: +gl.height.toFixed(1), list_panel_h: +rk.height.toFixed(1), list_top_minus_coil_top: +(rk.top - gl.top).toFixed(1), list_bottom_minus_coil_bottom: +(rk.bottom - gl.bottom).toFixed(1), first_row_top: +f.top.toFixed(1), last_row_bottom: +l.bottom.toFixed(1), scrolls: document.getElementById("rk").scrollHeight > document.getElementById("rk").clientHeight + 1, font_px: parseFloat(getComputedStyle(lis[0]).fontSize), width_px: +rk.width.toFixed(1), width_share_of_screen: +(rk.width / innerWidth).toFixed(3), rows: rows.length, first: rows.slice(0, 3), last: rows.slice(-3), numbered_1_to_n: rows.every((r, i) => r.n === i + 1), order_is_reading_desc: rows.map((r) => r.t).join() === want.join(), bar_tips_descend_down_the_list: tipsDescend }; });
    // a row lights its bar
    const row = pg.locator('#rk li[data-t="NVDA"]'); await row.hover(); await sleep(400);
    L.row_to_bar = await pg.evaluate(() => { const c = __lab.coil; return { hovered_row: "NVDA", bar_lit: c.highlighted(), row_on: document.querySelector('#rk li[data-t="NVDA"]').classList.contains("on"), label_shown: c.labels().find((x) => x.t === "NVDA").shown }; }); await pg.screenshot({ path: `${SHOTS}/p6-list-row-lights-bar.jpg`, type: "jpeg", quality: 88 });
    L.row_to_bar.spill_while_lit = await pg.evaluate(() => { const c = __lab.coil; c.labelsOn(false); c.highlight("NVDA"); const s = c.spill(); c.labelsOn(true); return { outside_a_footprint: s.outside_a_footprint, corners: s.corners }; });
    await pg.mouse.move(700, 150); await pg.evaluate(() => { __lab.coil.highlight(null); }); await sleep(900);
    // a bar lights its row: the mouse goes to where a bar prints (the first point of it that belongs to it alone)
    L.bar_to_row = []; for (const t of ["CEG", "WMT", "TSLA", "AVGO", "SNOW"]) { const hit = await pg.evaluate((t) => { const c = __lab.coil, r = document.getElementById("gl").getBoundingClientRect(); for (const [x, y] of c.barPx(t)) if (c.barAt(x, y) === t) return [x + r.left, y + r.top]; return null; }, t); if (!hit) { L.bar_to_row.push({ t, reachable: false }); continue; }
      await pg.mouse.move(hit[0] - 3, hit[1] - 3); await pg.mouse.move(hit[0], hit[1]); await sleep(300); L.bar_to_row.push({ t, reachable: true, row_on: await pg.evaluate(() => [...document.querySelectorAll("#rk li.on")].map((li) => li.dataset.t)), bar_lit: await pg.evaluate(() => __lab.coil.highlighted()) }); if (t === "TSLA") await pg.screenshot({ path: `${SHOTS}/p6-list-bar-lights-row.jpg`, type: "jpeg", quality: 88 }); }
    await pg.mouse.move(30, 150); await sleep(300); L.after_leaving = await pg.evaluate(() => ({ bar_lit: __lab.coil.highlighted(), rows_on: document.querySelectorAll("#rk li.on").length }));
    // the other lists: 17 names and 144 names
    for (const name of ["radar", "liked"]) { await pg.click(`[data-list="${name}"]`); await sleep(3600); L[name] = await pg.evaluate(() => { const gl = document.getElementById("gl").getBoundingClientRect(), rk = document.getElementById("rank").getBoundingClientRect(); return { rank: __lab.rank, coil_pane_h: +gl.height.toFixed(1), list_panel_h: +rk.height.toFixed(1), width_px: +rk.width.toFixed(1), font_px: parseFloat(getComputedStyle(document.querySelector("#rk li")).fontSize), scrolls: document.getElementById("rk").scrollHeight > document.getElementById("rk").clientHeight + 1 }; }); await pg.screenshot({ path: `${SHOTS}/p6-list-${name}.jpg`, type: "jpeg", quality: 88 }); }
    await ctx.close();
    // the phone
    { const { ctx, pg } = await page(false, { width: 390, height: 844 }, 3); await open(pg, PORT, Q); await pg.screenshot({ path: `${SHOTS}/p6-phone-390.jpg`, type: "jpeg", quality: 88 }); L.phone = await pg.evaluate(() => { const gl = document.getElementById("gl").getBoundingClientRect(), rk = document.getElementById("rank").getBoundingClientRect(); const c = __lab.coil; const S = c.labelStats(); c.labelsOn(false); const s = c.spill(); c.labelsOn(true); return { rank: __lab.rank, coil_pane: [+gl.width.toFixed(0), +gl.height.toFixed(0)], list: [+rk.width.toFixed(0), +rk.height.toFixed(0)], font_px: parseFloat(getComputedStyle(document.querySelector("#rk li")).fontSize), page_scrolls_sideways: document.documentElement.scrollWidth > innerWidth, labels: { shown: S.shown, front: S.front, px: S.px }, outside_a_footprint: s.outside_a_footprint, corners: s.corners }; }); await ctx.close(); }
    console.log("LIST", JSON.stringify({ fav: L.favorites, row_to_bar: L.row_to_bar, bar_to_row: L.bar_to_row, leave: L.after_leaving, radar: L.radar, liked: L.liked, phone: L.phone }));
  }
  if (want("tumble")) {
    const run = async (video) => { const { ctx, pg } = await page(video); await open(pg, PORT, Q); const cx = W / 2 - 80, cy = 560, frames = [];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 0.9 + 0.5, dx = Math.cos(a) * 380, dy = Math.sin(a) * 380; await pg.mouse.move(cx, cy); await pg.mouse.down(); for (let k = 1; k <= 14; k++) { await pg.mouse.move(cx + (dx * k) / 14, cy + (dy * k) / 14); await sleep(video ? 16 : 6); } await sleep(video ? 0 : 150); await pg.mouse.up(); if (!video) await pg.mouse.move(700, 60); await sleep(video ? 250 : 1000);
        if (!video) { const p = `shots/p6-tumble-${nn(i)}.jpg`; await pg.screenshot({ path: resolve(HERE, p), type: "jpeg", quality: 88 }); frames.push({ n: i + 1, path: p, attitude: await att(pg), ...(await pg.evaluate(() => { const c = __lab.coil, L = c.labels().filter((x) => x.front); c.labelsOn(false); const a = c.pixelAudit(), s = c.spill(); c.labelsOn(true); return { audit: { washed: a.washed_share_of_lit, veil: a.veil_share_of_frame }, outside_a_footprint: s.outside_a_footprint, corners_page: s.corners.every((x) => x.join() === "10,10,15"), front: L.length, front_shown: L.filter((x) => x.shown).length }; })) }); } }
      if (video) { await pg.mouse.dblclick(cx, cy); await sleep(1400); const v = pg.video(); await ctx.close(); const p = await v.path(); const dst = `${SHOTS}/p6-tumble-1680.webm`; if (existsSync(dst)) unlinkSync(dst); renameSync(p, dst); return "shots/p6-tumble-1680.webm"; }
      await ctx.close(); return frames; };
    out.tumble = { drag_px: 380, note: "380 px a drag — twice pass 5's 190, because the same drag now turns the coil half as far", frames: await run(false) }; out.tumble.upside_down_frames = out.tumble.frames.filter((f) => f.attitude.upside_down).length; out.tumble.video = await run(true);
    const { ctx, pg } = await page(false, { width: W, height: H }, 1);
    const sheet = async (name, cols, cells) => { await pg.setViewportSize({ width: 1680, height: Math.ceil(cells.length / cols) * Math.round((1680 / cols) * (H / W) + 22) + 8 }); await pg.setContent(`<body style="margin:0;background:#0a0a0f;font:600 11px ui-monospace,Menlo,monospace;color:#868aaa"><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px">${cells.map((c) => `<div><img src="http://127.0.0.1:${PORT}${REL}${c.path}" style="width:100%;display:block"><div style="padding:3px 2px;letter-spacing:.08em">${c.cap}</div></div>`).join("")}</div></body>`); await sleep(1800); await pg.screenshot({ path: `${SHOTS}/${name}.jpg`, type: "jpeg", quality: 90, fullPage: true }); };
    const cap = (i) => `${i + 1} · el ${ANGLES[i][0]}° az ${ANGLES[i][1] ?? out.home_az}°`;
    await sheet("p6-sheet-before", 3, ANGLES.map((_, i) => ({ path: `shots/p6-before-${nn(i)}.jpg`, cap: cap(i) + " · BEFORE (pass 5)" })));
    await sheet("p6-sheet-after", 3, ANGLES.map((_, i) => ({ path: `shots/p6-after-${nn(i)}.jpg`, cap: cap(i) + " · AFTER (pass 6)" })));
    await sheet("p6-sheet-tumble", 4, out.tumble.frames.map((f) => ({ path: f.path, cap: `tumble ${f.n}${f.attitude.upside_down ? " · upside down" : ""}` })));
    await ctx.close(); console.log("TUMBLE", out.tumble.frames.length, "frames ·", out.tumble.upside_down_frames, "upside down ·", out.tumble.video, "· outside", out.tumble.frames.reduce((a, f) => a + f.outside_a_footprint, 0), "· front missing", out.tumble.frames.reduce((a, f) => a + f.front - f.front_shown, 0));
  }
} finally {
  await browser.close(); for (const s of servers) s.kill("SIGKILL");
}
for (const f of readdirSync(SHOTS)) if (/^[0-9a-f]{32}\.webm$/.test(f) || /^page@[0-9a-f]+\.webm$/.test(f)) unlinkSync(resolve(SHOTS, f));
writeFileSync(JSONP, JSON.stringify(out, null, 1));
console.log("GPU", out.gpu); console.log("writes blocked", out.writes.length, out.writes.slice(0, 5)); console.log("errors", out.errors.length, out.errors.slice(0, 8));
