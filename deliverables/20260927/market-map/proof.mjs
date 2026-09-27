/* Headless proof for the 3D market map: screenshots at an exact viewport + CPU while idle and while rotating.
   Headless always (Alan: never a browser window on his screen). Software WebGL (SwiftShader) so the 3D canvas renders
   without a GPU. The chart API only answers Origin https://scintillahub.ai, so THIS throwaway headless browser runs with
   the cross-origin check relaxed (--disable-web-security, own temp profile). The page itself is unchanged.

   node proof.mjs <url> <out.png> <width> <height> <mobile 0|1> [cpu]
   With "cpu": 60 s idle after the map settles, then 60 s of continuous mouse-drag rotation; reports CPU-seconds per minute
   for the whole Chrome process tree (ps) and the page's main-thread task time (DevTools Performance.getMetrics). */
import { spawn, execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const [url, out, width, height, mobile, cpu] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333 + Math.floor(Math.random() * 400);
const dir = `${process.env.TMPDIR || "/tmp"}/mmshot-${PORT}`;
// MM_GL=metal asks headless Chrome for the Mac's real GPU (ANGLE on Metal) instead of software GL, to compare CPU cost.
const GL = process.env.MM_GL === "metal" ? ["--use-angle=metal"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const ch = spawn(CHROME, ["--headless=new", ...GL, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--disable-web-security",
  `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (code) => { try { ws.close(); } catch {} ch.kill("SIGKILL"); try { rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(code); };
async function json(path) {
  for (let i = 0; i < 40; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(250); } }
  throw new Error("chrome did not answer on the debug port");
}
const ver = await json("/json/version");
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m.result || m.error); waits.delete(m.id); } };
const raw = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
const send = (m, p = {}) => raw(m, p, sessionId);
const evaluate = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.value; };
await send("Emulation.setDeviceMetricsOverride", { width: +width, height: +height, deviceScaleFactor: 1, mobile: mobile === "1" });
await send("Page.enable"); await send("Performance.enable");
await send("Page.navigate", { url });
let st = null;
for (let i = 0; i < 90; i++) { await sleep(1000); st = await evaluate("window.__mm ? JSON.stringify({ready:!!__mm.ready,settled:!!__mm.settled,paused:!!__mm.paused,counts:__mm.counts,geigerErr:__mm.geigerErr,quotesErr:__mm.quotesErr,quotes:Object.keys(__mm.quotes).length}) : null"); if (st && JSON.parse(st).paused) break; }
const extra = process.argv[8];
if (extra) { await evaluate(extra); await sleep(2500); }
const gl = await evaluate("(()=>{const c=document.querySelector('#graph canvas');if(!c)return 'no canvas';const g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 'context unavailable';const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})()");
const dims = JSON.parse(await evaluate("JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})"));
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(JSON.stringify({ out, state: st && JSON.parse(st), renderer: gl, overflow: dims.sw > dims.cw }));

if (cpu === "cpu") {
  const tree = () => { // cumulative CPU seconds of every process in this Chrome's tree (identified by its unique profile dir)
    const lines = execSync(`ps -Ao time=,command= | grep -F -- "${dir}" | grep -v grep`).toString().trim().split("\n");
    return lines.reduce((s, l) => { const t = l.trim().split(/\s+/)[0]; const p = t.split(":").map(Number); return s + (p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2]); }, 0);
  };
  const task = async () => (await send("Performance.getMetrics")).metrics.find((m) => m.name === "TaskDuration").value;
  let c0 = tree(), t0 = await task();
  await sleep(60000);
  let c1 = tree(), t1 = await task();
  const idle = { chrome_tree_cpu_s_per_min: +(c1 - c0).toFixed(2), page_main_thread_s_per_min: +(t1 - t0).toFixed(2), paused: JSON.parse(await evaluate("JSON.stringify(__mm.paused)")) };
  const cx = +width / 2 - 190, cy = +height / 2;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount: 1 });
  c0 = tree(); t0 = await task();
  const end = Date.now() + 60000; let k = 0;
  while (Date.now() < end) { k++; await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx + 120 * Math.sin(k / 30), y: cy + 30 * Math.cos(k / 45), button: "left", buttons: 1 }); await sleep(16); }
  c1 = tree(); t1 = await task();
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", buttons: 0, clickCount: 1 });
  const rotating = { chrome_tree_cpu_s_per_min: +(c1 - c0).toFixed(2), page_main_thread_s_per_min: +(t1 - t0).toFixed(2), drag_events: k };
  await sleep(3000);
  const back = JSON.parse(await evaluate("JSON.stringify(__mm.paused)"));
  console.log(JSON.stringify({ cpu: { idle, rotating, paused_again_after_release: back, gl: process.env.MM_GL === "metal" ? "GPU (ANGLE/Metal)" : "software (SwiftShader)" } }));
}
done(0);
