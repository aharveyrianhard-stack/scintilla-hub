/* Headless proof for the TREE MAP (29 Sep), from the r3 proof: a scripted walk with screenshots, and CPU while idle and while turning.
   Headless always (Alan: never a browser window on his screen). Software WebGL (SwiftShader) so the canvas renders without
   a GPU. The chart API only answers Origin https://scintillahub.ai, so THIS throwaway headless browser runs with the
   cross-origin check relaxed (--disable-web-security, its own temp profile, deleted at the end). The page is unchanged.

   node proof.mjs <url> <width> <height> <mobile 0|1> '<steps JSON>'
   steps: {"shot":"out.png","full":true} · {"click":"XLK"} (a real mouse click on that ball) · {"key":"Escape"} ·
          {"eval":"js"} · {"wait":ms} · {"box":true} (share of the canvas the whole tree covers) · {"cpu":true} (60 s idle, then 60 s of mouse-drag turning) · {"state":true} */
import { spawn, execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const [url, width, height, mobile, stepsJSON] = process.argv.slice(2);
const steps = JSON.parse(stepsJSON || "[]");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9733 + (process.pid % 200);
const dir = `${process.env.TMPDIR || "/tmp"}/tmap-${PORT}`;
// MM_GL=metal asks headless Chrome for the Mac's real GPU (ANGLE on Metal) instead of software GL, to compare CPU cost.
const GL = process.env.MM_GL === "metal" ? ["--use-angle=metal"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const ch = spawn(CHROME, ["--headless=new", ...GL, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--disable-web-security",
  `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
const done = (code) => { try { ws.close(); } catch {} ch.kill("SIGKILL"); try { rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(code); };
setTimeout(() => { console.log(JSON.stringify({ error: "timeout" })); done(2); }, 300000);
async function json(path) {
  for (let i = 0; i < 40; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(250); } }
  throw new Error("chrome did not answer on the debug port");
}
const ver = await json("/json/version");
ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
const pageErrors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value || a.description).join(" "));
  if (waits.has(m.id)) { waits.get(m.id)(m.result || m.error); waits.delete(m.id); } };
const raw = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
const send = (m, p = {}) => raw(m, p, sessionId);
const evaluate = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) pageErrors.push("eval: " + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text)); return r.result && r.result.value; };
const DPR = +(process.env.PROOF_DPR || 1); // 1 Oct: Alan's Retina screens are scale 2; the run is made at 1 and 2
await send("Emulation.setDeviceMetricsOverride", { width: +width, height: +height, deviceScaleFactor: DPR, mobile: mobile === "1" });
function treeCpu() {
  const lines = execSync(`ps -Ao time=,command= | grep -F -- "${dir}" | grep -v grep`).toString().trim().split("\n");
  return lines.reduce((s, l) => { const t = l.trim().split(/\s+/)[0]; const p = t.split(":").map(Number); return s + (p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]); }, 0);
}
const taskTime = async () => (await send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
await send("Page.enable"); await send("Performance.enable"); await send("Runtime.enable");
await send("Page.navigate", { url });
for (let i = 0; i < 80; i++) { await sleep(500); if (await evaluate("!!(window.__mm && __mm.ready)")) break; }
for (let i = 0; i < 80; i++) { if (await evaluate("!!(window.__mm && (__mm.view === 'outline' || __mm.screenOf))")) break; await sleep(300); } // T6: the 3D module is mounted before the walk starts (paused is true before it mounts)
const settle = async () => { for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate("!!(window.__mm && __mm.paused)")) return; } };
await settle();
const stateNow = () => evaluate("JSON.stringify({view:__mm.view,area:__mm.cluster||null,areaCount:__mm.clusterCount||null,canvas:!!__mm.canvas,selected:__mm.selected,flat:__mm.flat,paused:__mm.paused,frames:__mm.frames,labels:__mm.labelsShown,counts:__mm.counts,geigerErr:__mm.geigerErr,scoutErr:__mm.scoutErr,err3d:__mm.err3d,card:(document.querySelector('#card h2')||{}).textContent,rows:document.querySelectorAll('#outline .row').length,detail:__mm.detail,order:__mm.order,hidden:__mm.hidden?__mm.hidden().length:null,shown:__mm.shownKinds?__mm.shownKinds():null,folds:__mm.folds?Object.keys(__mm.folds()).length:null,chips:__mm.chipsDrawn?__mm.chipsDrawn():null,sections:__mm.sectionsWithChip?__mm.sectionsWithChip():null,coil:__mm.coilOrder||null})").then(JSON.parse);
const log = [];
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.eval) { await evaluate(s.eval); await sleep(300); await settle(); }
  if (s.click) {
    const xy = await evaluate(`JSON.stringify(__mm.screenOf(${JSON.stringify(s.click)}))`).then(JSON.parse);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: xy[0], y: xy[1], button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    await sleep(400); await settle();
    log.push({ click: s.click, at: xy.map(Math.round), after: await stateNow() });
  }
  if (s.clickSel) { // a real mouse click on a DOM element (the 3D chip on a section label, a button)
    const r = JSON.parse(await evaluate(`JSON.stringify((() => { const e = document.querySelector(${JSON.stringify(s.clickSel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, getComputedStyle(e).display]; })())`));
    if (r) for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r[0], y: r[1], button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
    await sleep(1600); await settle();
    log.push({ clickSel: s.clickSel, at: r && r.slice(0, 2).map(Math.round), found: !!r, after: await stateNow() });
  }
  if (s.hover) { const xy = await evaluate(`JSON.stringify(__mm.screenOf(${JSON.stringify(s.hover)}))`).then(JSON.parse); await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: xy[0], y: xy[1] }); await sleep(300); log.push({ hover: s.hover, tip: await evaluate("(document.getElementById('tip')||{}).innerText||''") }); }
  if (s.unhover) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: +height - 4 }); await sleep(200); }
  if (s.key) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: s.key, code: s.key, windowsVirtualKeyCode: s.key === "Escape" ? 27 : 0 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: s.key, code: s.key, windowsVirtualKeyCode: s.key === "Escape" ? 27 : 0 });
    await sleep(400); await settle();
    log.push({ key: s.key, after: await stateNow() });
  }
  if (s.state) log.push({ state: await stateNow() });
  if (s.probe) log.push({ probe: s.probe, value: JSON.parse(await evaluate(`JSON.stringify((() => (${s.probe}))())`) || "null") }); // T6: any page fact, logged (an expression)
  if (s.area) { await evaluate(`__mm.openArea(${JSON.stringify(s.area)})`); await sleep(1800); await settle(); log.push({ area: s.area, after: await stateNow() }); }
  if (s.back) { const before = await evaluate("JSON.stringify(__mm.pose ? __mm.pose() : null)"); await evaluate(`__mm.closeArea()`); await sleep(1400); await settle(); log.push({ back: true, after: await stateNow(), pose: JSON.parse(await evaluate("JSON.stringify(__mm.pose ? __mm.pose() : null)")) }); }
  if (s.pan) { await evaluate(`__mm.panBy(${+s.pan[0]}, ${+s.pan[1]})`); await sleep(500); await settle(); log.push({ pan: s.pan, pose: JSON.parse(await evaluate("JSON.stringify(__mm.pose())")) }); }
  if (s.zoom) { await evaluate(`__mm.zoomAt(${+s.zoom[0]}, ${+s.zoom[1]}, ${+s.zoom[2]})`); await sleep(500); await settle(); log.push({ zoom: s.zoom, pose: JSON.parse(await evaluate("JSON.stringify(__mm.pose())")) }); }
  if (s.wheel) { // a real wheel event on the canvas, toward the pointer
    for (let i = 0; i < (s.wheel[2] || 5); i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: +s.wheel[0], y: +s.wheel[1], deltaX: 0, deltaY: -120 }); await sleep(60); }
    await sleep(600); await settle(); log.push({ wheel: s.wheel, pose: JSON.parse(await evaluate("JSON.stringify(__mm.pose())")) });
  }
  if (s.pose) log.push({ pose: JSON.parse(await evaluate("JSON.stringify(__mm.pose())")) });
  if (s.labels) { // every printed label against the node it is anchored to (screen px): the "labels don't match nodes" check
    const L = JSON.parse(await evaluate(`JSON.stringify(__mm.labelsNow ? __mm.labelsNow() : [])`));
    const canvas = JSON.parse(await evaluate(`JSON.stringify((() => { const c = document.querySelector("#graph").getBoundingClientRect(); const cv = document.querySelector("#gl canvas"); const r = cv ? cv.getBoundingClientRect() : null; return { w: c.width, h: c.height, buffer: cv ? [cv.width, cv.height] : null, css: r ? [Math.round(r.width), Math.round(r.height)] : null, dpr: devicePixelRatio }; })())`));
    const rows = L.map((l) => { const cx = l.align === "left" ? l.x : l.x + l.w / 2; const dx = l.align === "left" ? Math.abs(l.x - l.nx) : Math.abs(cx - l.nx); const dy = l.y + (l.align ? l.h / 2 : 0) - l.ny; return { id: l.id, text: l.text, dx: +dx.toFixed(1), dy: +dy.toFixed(1), inside: l.x >= -1 && l.y >= -1 && l.x + l.w <= canvas.w + 1 && l.y + l.h <= canvas.h + 1 }; });
    log.push({ labels: { view: await evaluate("__mm.view"), canvas, count: rows.length, max_dx: Math.max(0, ...rows.map((r) => r.dx)), max_dy: Math.max(0, ...rows.map((r) => r.dy)), min_dy: Math.min(0, ...rows.map((r) => r.dy)), outside: rows.filter((r) => !r.inside).length, rows } });
  }
  if (s.crumbs) log.push({ crumbs: JSON.parse(await evaluate("JSON.stringify(__mm.crumbs())")) });
  if (s.order) { const o = JSON.parse(await evaluate(`JSON.stringify(__mm.orderOnScreen ? __mm.orderOnScreen(${JSON.stringify(s.order)}) : null)`)); log.push({ order: s.order, on_screen: o, outline: JSON.parse(await evaluate(`JSON.stringify(__mm.outlineOrder ? __mm.outlineOrder(${JSON.stringify(s.order)}) : null)`)) }); }
  if (s.find) { const r = await evaluate(`JSON.stringify(__mm.find(${JSON.stringify(s.find)}))`); await evaluate(`__mm.select(${JSON.stringify(s.find)})`); await sleep(500); await settle(); log.push({ find: s.find, result: JSON.parse(r), after: await stateNow() }); }
  if (s.view) { await evaluate(`__mm.setView(${JSON.stringify(s.view)})`); await sleep(1500); await settle(); log.push({ view: s.view, after: await stateNow() }); }
  if (s.type) { await evaluate(`(() => { const q = document.getElementById('q'); q.value = ${JSON.stringify(s.type)}; q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); })()`); await sleep(600); await settle(); log.push({ typed: s.type, after: await stateNow() }); }
  if (s.box) { // how much of the canvas the whole tree covers: projected box of every node vs the canvas box (28 Sep review)
    const bx = JSON.parse(await evaluate(`JSON.stringify((() => { const c = document.querySelector('#graph').getBoundingClientRect(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      const k = document.querySelector('#legend'), kr = k && k.open ? k.getBoundingClientRect() : null; let underKey = 0;
      for (const id of __mm.byId.keys()) { const [x, y] = __mm.screenOf(id); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (kr && x >= kr.left && x <= kr.right && y >= kr.top && y <= kr.bottom) underKey++; }
      return { canvas: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)], nodes: [x0, y0, x1, y1].map(Math.round),
        height_share: +((y1 - y0) / c.height).toFixed(3), width_share: +((x1 - x0) / c.width).toFixed(3), sector_rows: __mm.sectorRows, labels: __mm.labelsShown, key_open: !!kr, balls_under_key: underKey }; })())`));
    log.push({ box: bx });
  }
  if (s.shot) {
    const params = { format: "png" };
    if (s.full) { const m = await send("Page.getLayoutMetrics"); const cs = m.cssContentSize || m.contentSize; params.captureBeyondViewport = true; params.clip = { x: 0, y: 0, width: +width, height: Math.ceil(cs.height), scale: 1 }; }
    if (s.clip) params.clip = { x: s.clip[0], y: s.clip[1], width: s.clip[2], height: s.clip[3], scale: s.clip[4] || 2 }; // T6: a zoomed crop, to look closely
    const shot = await send("Page.captureScreenshot", params);
    writeFileSync(s.shot, Buffer.from(shot.data, "base64"));
    const dims = JSON.parse(await evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})"));
    log.push({ shot: s.shot, state: await stateNow(), overflow_x: dims.sw > dims.cw });
  }
  if (s.cpu) {
    let c0 = treeCpu(), t0 = await taskTime(); const f0 = await evaluate("__mm.frames");
    await sleep(60000);
    const idle = { chrome_tree_cpu_s_per_min: +(treeCpu() - c0).toFixed(2), page_main_thread_s_per_min: +((await taskTime()) - t0).toFixed(2), frames_drawn: (await evaluate("__mm.frames")) - f0 };
    const cx = +width / 2 - 200, cy = +height / 2;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount: 1 });
    c0 = treeCpu(); t0 = await taskTime(); const f1 = await evaluate("__mm.frames");
    const end = Date.now() + 60000; let k = 0;
    while (Date.now() < end) { k++; await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx + 120 * Math.sin(k / 30), y: cy + 30 * Math.cos(k / 45), button: "left", buttons: 1 }); await sleep(16); }
    const turning = { chrome_tree_cpu_s_per_min: +(treeCpu() - c0).toFixed(2), page_main_thread_s_per_min: +((await taskTime()) - t0).toFixed(2), frames_drawn: (await evaluate("__mm.frames")) - f1 };
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", buttons: 0, clickCount: 1 });
    await sleep(3000);
    log.push({ cpu: { idle, turning, paused_again_after_release: await evaluate("__mm.paused"), gl: process.env.MM_GL === "metal" ? "GPU (ANGLE/Metal)" : "software (SwiftShader)" } });
  }
}
const gl = await evaluate("(()=>{const c=document.querySelector('#graph canvas');if(!c)return 'no canvas';const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 'context unavailable';const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()");
process.stdout.write(JSON.stringify({ url, width, dpr: DPR, renderer: gl, log, page_errors: pageErrors }, null, 1) + "\n", () => done(0)); // flushed before exit: a big log was cut short when piped
