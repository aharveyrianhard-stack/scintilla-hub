/* Headless proof for POINT-IN-TIME.html (never a visible window). The page is static: no API calls.
   node shot.mjs <out.png> <width> <height> <mobile 0|1>
   Prints the page's scroll width, so a phone-width overflow shows up as a number, not only in the picture. */
import { spawn } from "node:child_process"; import { writeFileSync, rmSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const [out, width, height, mobile, anchor] = process.argv.slice(2);   // anchor: optional heading text to scroll to
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333 + Math.floor(Math.random() * 400), dir = `${process.env.TMPDIR || "/tmp"}/srshot-${PORT}`;
const ch = spawn(CHROME, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
  `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; const done = (c) => { try { ws.close(); } catch {} ch.kill("SIGKILL"); try { rmSync(dir, { recursive: true, force: true }); } catch {} process.exit(c); };
setTimeout(() => { console.error("timeout"); done(2); }, 60000);
let list; for (let i = 0; i < 40 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { await sleep(250); } }
ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m.result || m.error); waits.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: +width, height: +height, deviceScaleFactor: 1, mobile: mobile === "1" });
await send("Page.enable");
await send("Page.navigate", { url: "file://" + path.join(HERE, "POINT-IN-TIME.html") });
await sleep(1500);
if (anchor) { await send("Runtime.evaluate", { expression: `[...document.querySelectorAll("h2,h3")].find(h => h.textContent.includes(${JSON.stringify(anchor)}))?.scrollIntoView()` }); await sleep(2000); }
const m = await send("Runtime.evaluate", { expression: "JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: innerWidth, imgs: [...document.images].filter(i => i.complete && i.naturalWidth > 0).length, allImgs: document.images.length})", returnByValue: true });
console.log(m.result.value);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(path.resolve(out), Buffer.from(shot.data, "base64"));
console.log("saved", out); done(0);
