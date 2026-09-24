/* Headless screenshot at an exact viewport, over the DevTools protocol.
   Chrome's --window-size floors at ~500px on macOS, so --screenshot at 390 silently crops a
   500px layout. This drives Emulation.setDeviceMetricsOverride instead, which is a real 390
   viewport. Headless always (Alan: never a browser window on his screen). */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [url, out, width, height, mobile] = process.argv.slice(2);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333 + Math.floor(Math.random() * 400);
const dir = `${process.env.TMPDIR || "/tmp"}/scshot-${PORT}`;
const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--disable-extensions", "--hide-scrollbars", `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`,
  "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(path) {
  for (let i = 0; i < 40; i++) {
    try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); }
    catch { await sleep(250); }
  }
  throw new Error("chrome did not answer on the debug port");
}
const ver = await json("/json/version");            // GET works on every Chrome; /json/new needs PUT on new builds
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m.result); waits.delete(m.id); } };
const raw = (method, params = {}, sessionId) => new Promise((res) => {
  const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
const send = (method, params = {}) => raw(method, params, sessionId);
await send("Emulation.setDeviceMetricsOverride", {
  width: +width, height: +height, deviceScaleFactor: 1, mobile: mobile === "1",
});
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(3500);
const m = await send("Runtime.evaluate", { expression: "JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.body.scrollHeight})", returnByValue: true });
const dims = JSON.parse(m.result.value);
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`${out} viewport=${dims.cw} scrollWidth=${dims.sw} pageHeight=${dims.h} overflow=${dims.sw > dims.cw ? "YES" : "no"}`);
ws.close(); ch.kill("SIGKILL");
process.exit(0);
