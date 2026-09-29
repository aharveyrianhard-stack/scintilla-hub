/* Headless proof for COMPS-R3-LABELS.html (never a visible window). The page reads its snapshot files and
   an ES module two folders up, so it is served over http from the repo root by a tiny static server here;
   no API is called (the snapshots are on disk).
   node shot.mjs <out.png> <width> <height> <mobile 0|1> [TICKER] [heading to scroll to]
   Prints the page's scroll width (a phone-width overflow shows up as a number), the count of rows drawn,
   and the count of label lanes that could not be laid out. */
import { spawn } from "node:child_process"; import { writeFileSync, rmSync, readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http"; import path from "node:path"; import { fileURLToPath } from "node:url";
const [out, width, height, mobile, ticker = "MU", anchor] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const REL = path.relative(ROOT, HERE).split(path.sep).join("/");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css" };
const srv = createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" }); res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const HP = srv.address().port;
const PORT = 9333 + Math.floor(Math.random() * 400), dir = `${process.env.TMPDIR || "/tmp"}/r3shot-${PORT}`;
const ch = spawn(CHROME, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
  `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; const done = (c) => { try { ws.close(); } catch {} ch.kill("SIGKILL"); try { rmSync(dir, { recursive: true, force: true }); } catch {} srv.close(); process.exit(c); };
setTimeout(() => { console.error("timeout"); done(2); }, 60000);
let list; for (let i = 0; i < 40 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch { await sleep(250); } }
ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (waits.has(m.id)) { waits.get(m.id)(m.result || m.error); waits.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const k = ++id; waits.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: +width, height: +height, deviceScaleFactor: 1, mobile: mobile === "1" });
await send("Page.enable");
await send("Page.navigate", { url: `http://127.0.0.1:${HP}/${REL}/COMPS-R3-LABELS.html#${ticker}` });
await sleep(2500);
if (anchor) { await send("Runtime.evaluate", { expression: `[...document.querySelectorAll("h2")].find(h => h.textContent.includes(${JSON.stringify(anchor)}))?.scrollIntoView()` }); await sleep(1500); }
const m = await send("Runtime.evaluate", { expression: `JSON.stringify({scrollW: document.documentElement.scrollWidth, innerW: innerWidth, rows: document.querySelectorAll(".row").length, svgs: [...document.querySelectorAll(".row svg")].filter(s => s.childElementCount > 0).length, title: document.title, err: document.querySelector(".err")?.textContent || null, words: [...document.querySelectorAll("text.word")].map(t => t.textContent).filter((v, i, a) => a.indexOf(v) === i)})`, returnByValue: true });
console.log(m.result.value);
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !anchor, clip: anchor ? undefined : { x: 0, y: 0, width: +width, height: +height, scale: 1 } });
writeFileSync(path.resolve(out), Buffer.from(shot.data, "base64"));
console.log("saved", out); done(0);
