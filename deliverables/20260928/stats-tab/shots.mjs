/* shots.mjs — ONE headless Chrome, several screenshots, then the browser is killed.
   Same DevTools approach as scripts/shot-cdp.mjs (a real 390 viewport through Emulation, not --window-size), but one
   browser for the whole list, because on 28 Sep Alan is trading on this MacBook and the brief allows one short run.
   Usage: node deliverables/20260928/stats-tab/shots.mjs <outDir> <url> <name> <width> <height> [<url> <name> <w> <h> …]
   Headless always. Never a window on Alan's screen. */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const [outDir, ...rest] = process.argv.slice(2);
const jobs = [];
for (let i = 0; i + 3 < rest.length; i += 4) jobs.push({ url: rest[i], name: rest[i + 1], width: +rest[i + 2], height: +rest[i + 3] });
if (!jobs.length) { console.error("no jobs"); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333 + Math.floor(Math.random() * 400);
const dir = `${process.env.TMPDIR || "/tmp"}/scshot-${PORT}`;
const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  "--hide-scrollbars", `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kill = () => { try { ch.kill("SIGKILL"); } catch {} };
process.on("exit", kill); process.on("SIGINT", () => { kill(); process.exit(1); });
try {
  async function json(path) { for (let i = 0; i < 40; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(250); } } throw new Error("chrome did not answer"); }
  const ver = await json("/json/version");
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const waits = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m.result); waits.delete(m.id); } };
  const raw = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  for (const j of jobs) {
    const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params = {}) => raw(method, params, sessionId);
    await send("Emulation.setDeviceMetricsOverride", { width: j.width, height: j.height, deviceScaleFactor: 1, mobile: j.width < 700 });
    await send("Page.enable");
    await send("Page.navigate", { url: j.url });
    await sleep(2500);
    const m = await send("Runtime.evaluate", { expression: "JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.body.scrollHeight,minFont:(function(){var mn=99;document.querySelectorAll('body *').forEach(function(e){if(!e.textContent.trim()||e.closest('svg'))return;var f=parseFloat(getComputedStyle(e).fontSize);if(f&&f<mn)mn=f;});return mn;})()})", returnByValue: true });
    const dims = JSON.parse(m.result.value);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    const out = join(outDir, j.name);
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`${j.name} viewport=${dims.cw} scrollWidth=${dims.sw} pageHeight=${dims.h} minHtmlFont=${dims.minFont}px overflow=${dims.sw > dims.cw ? "YES" : "no"}`);
    await raw("Target.closeTarget", { targetId });
  }
  ws.close();
} finally { kill(); }
process.exit(0);
