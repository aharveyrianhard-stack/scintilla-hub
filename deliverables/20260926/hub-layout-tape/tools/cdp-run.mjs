/* D1 — headless driver over the DevTools protocol (never a visible window: Alan, 24 Sep).
   node cdp-run.mjs job.json  →  runs each step, prints one JSON result line.
   A job: { url, width, height, mobile, steps:[ {wait:ms} | {eval:"js"} | {click:"css"} | {shot:"file.png", full?:bool}
            | {rects:{name:"css"}} | {cpu:secs} ] }
   {cpu:N} measures N seconds: the page's main-thread busy time (Performance.getMetrics TaskDuration) and the CPU
   time of the whole headless Chrome process tree (ps), both scaled to seconds per minute. */
import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9400 + Math.floor(Math.random() * 500);
const dir = `${process.env.TMPDIR || "/tmp"}/d1cdp-${PORT}`;
const flags = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  "--hide-scrollbars", "--mute-audio", "--autoplay-policy=user-gesture-required", `--user-data-dir=${dir}`, `--remote-debugging-port=${PORT}`, "about:blank"];
const ch = spawn(CHROME, flags, { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(); const out = { url: job.url, width: job.width, height: job.height, rects: {}, evals: [], cpu: null, console: [] };
function kill() { try { ch.kill("SIGKILL"); } catch (_) {} try { rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
process.on("exit", kill);
setTimeout(() => { out.error = "timeout"; console.log(JSON.stringify(out)); process.exit(2); }, (job.timeout || 180) * 1000);
async function json(path) { for (let i = 0; i < 60; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}${path}`)).json(); } catch { await sleep(250); } } throw new Error("no debug port"); }
function treeCpu() {             // seconds of CPU for chrome + every descendant
  const rows = execSync("ps -axo pid=,ppid=,time=").toString().trim().split("\n").map((l) => l.trim().split(/\s+/));
  const kids = new Map(); for (const [p, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  const t = new Map(rows.map(([p, , tm]) => [p, tm]));
  const toS = (s) => { const [a, b] = s.split("."); const parts = a.split(":").map(Number); let v = 0; for (const x of parts) v = v * 60 + x; return v + (b ? Number("0." + b) : 0); };
  let sum = 0; const st = [String(ch.pid)];
  while (st.length) { const p = st.pop(); if (t.has(p)) sum += toS(t.get(p)); for (const k of kids.get(p) || []) st.push(k); }
  return sum;
}
const ver = await json("/json/version");
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waits = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m.result || { error: m.error }); waits.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled" && out.console.length < 40) out.console.push(m.params.type + ": " + (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  else if (m.method === "Runtime.exceptionThrown" && out.console.length < 40) out.console.push("EXC: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 200)); };
const raw = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const { targetId } = await raw("Target.createTarget", { url: "about:blank" });
const { sessionId } = await raw("Target.attachToTarget", { targetId, flatten: true });
const send = (m, p = {}) => raw(m, p, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: job.width, height: job.height, deviceScaleFactor: job.dpr || 1, mobile: !!job.mobile });
if (job.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Page.enable"); await send("Runtime.enable"); await send("Performance.enable");
if (job.localStorage) await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{${Object.entries(job.localStorage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)})`).join(";")}}catch(e){}` });
await send("Page.navigate", { url: job.url });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text } : r.result?.value; };
for (const s of job.steps || []) {
  if (s.wait) await sleep(s.wait);
  if (s.eval) { const v = await ev(s.eval); if (s.as) (out.named ||= {})[s.as] = v; else out.evals.push(v); }
  if (s.click) out.evals.push(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(s.click)}); if(!e) return "missing ${s.click.replace(/"/g, "'")}"; e.click(); return "clicked"})()`));
  if (s.rects) {
    const r = await ev(`(()=>{const o={}; for (const [k,sel] of Object.entries(${JSON.stringify(s.rects)})) { const e=document.querySelector(sel); if(!e){o[k]=null;continue;} const b=e.getBoundingClientRect(); o[k]={x:Math.round(b.left+scrollX),y:Math.round(b.top+scrollY),w:Math.round(b.width),h:Math.round(b.height),text:(e.innerText||"").slice(0,120)}; } return o;})()`);
    Object.assign(out.rects, r);
  }
  if (s.shot) {
    const dims = await ev("({w:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!s.full });
    writeFileSync(s.shot, Buffer.from(shot.data, "base64"));
    (out.shots ||= []).push({ file: s.shot, ...dims, overflow: dims.w > dims.cw });
  }
  if (s.until) { let ok = false; for (let i = 0; i < (s.tries || 60); i++) { if (await ev(`!!(${s.until})`) === true) { ok = true; break; } await sleep(500); } (out.untils ||= []).push(ok); }
  if (s.mark) { (out.marks ||= {})[s.mark] = +treeCpu().toFixed(2); }
  if (s.cpu) {
    const m0 = await send("Performance.getMetrics"); const c0 = treeCpu(); const t0 = Date.now();
    await sleep(s.cpu * 1000);
    const m1 = await send("Performance.getMetrics"); const c1 = treeCpu(); const dt = (Date.now() - t0) / 1000;
    const g = (m, k) => (m.metrics.find((x) => x.name === k) || {}).value || 0;
    out.cpu = { seconds: +dt.toFixed(1), mainThreadSecPerMin: +(((g(m1, "TaskDuration") - g(m0, "TaskDuration")) / dt) * 60).toFixed(3),
      scriptSecPerMin: +(((g(m1, "ScriptDuration") - g(m0, "ScriptDuration")) / dt) * 60).toFixed(3),
      processTreeSecPerMin: +(((c1 - c0) / dt) * 60).toFixed(2), jsHeapMB: +(g(m1, "JSHeapUsedSize") / 1048576).toFixed(1), nodes: g(m1, "Nodes") };
  }
}
out.wallS = +((Date.now() - T0) / 1000).toFixed(1);
console.log(JSON.stringify(out));
ws.close(); kill(); process.exit(0);
