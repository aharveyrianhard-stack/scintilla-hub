/* Headless proof for the r3 market map (tree): a scripted walk with screenshots, and CPU while idle and while turning.
   Headless always (Alan: never a browser window on his screen). Software WebGL (SwiftShader) so the canvas renders without
   a GPU. The chart API only answers Origin https://scintillahub.ai, so THIS throwaway headless browser runs with the
   cross-origin check relaxed (--disable-web-security, its own temp profile, deleted at the end). The page is unchanged.

   node proof.mjs <url> <width> <height> <mobile 0|1> '<steps JSON>'
   steps: {"shot":"out.png","full":true} · {"click":"XLK"} (a real mouse click on that ball) · {"key":"Escape"} ·
          {"eval":"js"} · {"wait":ms} · {"cpu":true} (60 s idle, then 60 s of mouse-drag turning) · {"state":true} */
import { spawn, execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const [url, width, height, mobile, stepsJSON] = process.argv.slice(2);
const steps = JSON.parse(stepsJSON || "[]");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333 + (process.pid % 400);
const dir = `${process.env.TMPDIR || "/tmp"}/mmr3-${PORT}`;
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
const evaluate = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.value; };
await send("Emulation.setDeviceMetricsOverride", { width: +width, height: +height, deviceScaleFactor: 1, mobile: mobile === "1" });
function treeCpu() {
  const lines = execSync(`ps -Ao time=,command= | grep -F -- "${dir}" | grep -v grep`).toString().trim().split("\n");
  return lines.reduce((s, l) => { const t = l.trim().split(/\s+/)[0]; const p = t.split(":").map(Number); return s + (p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]); }, 0);
}
const taskTime = async () => (await send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
await send("Page.enable"); await send("Performance.enable"); await send("Runtime.enable");
await send("Page.navigate", { url });
for (let i = 0; i < 80; i++) { await sleep(500); if (await evaluate("!!(window.__mm && __mm.ready)")) break; }
const settle = async () => { for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate("!!(window.__mm && __mm.paused)")) return; } };
await settle();
const stateNow = () => evaluate("JSON.stringify({selected:__mm.selected,flat:__mm.flat,paused:__mm.paused,frames:__mm.frames,labels:__mm.labelsShown,counts:__mm.counts,geigerErr:__mm.geigerErr,quotesErr:__mm.quotesErr,card:(document.querySelector('#card h2')||{}).textContent})").then(JSON.parse);
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
  if (s.key) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: s.key, code: s.key, windowsVirtualKeyCode: s.key === "Escape" ? 27 : 0 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: s.key, code: s.key, windowsVirtualKeyCode: s.key === "Escape" ? 27 : 0 });
    await sleep(400); await settle();
    log.push({ key: s.key, after: await stateNow() });
  }
  if (s.state) log.push({ state: await stateNow() });
  if (s.shot) {
    const params = { format: "png" };
    if (s.full) { const m = await send("Page.getLayoutMetrics"); const cs = m.cssContentSize || m.contentSize; params.captureBeyondViewport = true; params.clip = { x: 0, y: 0, width: +width, height: Math.ceil(cs.height), scale: 1 }; }
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
console.log(JSON.stringify({ url, width, renderer: gl, log, page_errors: pageErrors }, null, 1));
done(0);
