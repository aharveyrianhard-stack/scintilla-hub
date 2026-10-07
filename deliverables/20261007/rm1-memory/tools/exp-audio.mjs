// RM1 experiment — what does an AudioContext that is never closed cost, and does the browser ever take it back?
// Headless; a blank page; the Hub's own chime code, run N times with and without close().
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("/Users/alanharvey/SCINTILLA 0.5/visual-supervisor/package.json");
const { chromium } = require("playwright-core");
const N = 40;
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto("about:blank");
  const cdp = await page.context().newCDPSession(page), bcdp = await browser.newBrowserCDPSession();
  await cdp.send("HeapProfiler.enable");
  const measure = async (label) => {
    await cdp.send("HeapProfiler.collectGarbage"); await new Promise((r) => setTimeout(r, 1500)); await cdp.send("HeapProfiler.collectGarbage"); await new Promise((r) => setTimeout(r, 500));
    let text = ""; const on = ({ chunk }) => { text += chunk; };
    cdp.on("HeapProfiler.addHeapSnapshotChunk", on); await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false }); cdp.off("HeapProfiler.addHeapSnapshotChunk", on);
    const snap = JSON.parse(text), nf = snap.snapshot.meta.node_fields.length, oName = snap.snapshot.meta.node_fields.indexOf("name");
    let contexts = 0; for (let i = 0; i < snap.nodes.length; i += nf) if (snap.strings[snap.nodes[i + oName]] === "AudioContext") contexts++;
    const info = (await bcdp.send("SystemInfo.getProcessInfo")).processInfo;
    const pids = info.map((p) => p.id);
    const ps = execFileSync("ps", ["-M", "-o", "pid=", "-p", pids.join(",")], { encoding: "utf8" }).trim().split("\n").length;
    const rss = execFileSync("ps", ["-o", "rss=", "-p", pids.join(",")], { encoding: "utf8" }).trim().split("\n").reduce((a, b) => a + Number(b), 0) / 1024;
    const cpu = info.reduce((a, p) => a + p.cpuTime, 0);
    console.log(label.padEnd(44), "AudioContext objects alive:", String(contexts).padStart(3), "| threads (all browser processes):", String(ps).padStart(4), "| RSS", rss.toFixed(0) + " MB", "| cpu s", cpu.toFixed(2));
    return { contexts, threads: ps, rss, cpu };
  };
  const base = await measure("blank page");
  // the Hub's chime, as written on live b80c01e (index.html:27106-27116): a context per chime, never closed
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended" && ac.resume) { ac.resume(); }
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(660, ac.currentTime);
      g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.09, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.32);
      o.connect(g); g.connect(ac.destination); o.start(ac.currentTime); o.stop(ac.currentTime + 0.34);
      await new Promise((r) => setTimeout(r, 60));
    }
  }, N);
  await new Promise((r) => setTimeout(r, 4000));
  const leaked = await measure(N + " chimes, as live (never closed)");
  const c0 = leaked.cpu; await new Promise((r) => setTimeout(r, 20000));
  const idle = await measure("  …20 s later, nothing playing");
  console.log("   cost of the " + N + " silent contexts while idle: " + ((idle.cpu - c0) / 20 * 100).toFixed(1) + "% of one core, " + ((leaked.rss - base.rss) / N).toFixed(1) + " MB and " + ((leaked.threads - base.threads) / N).toFixed(1) + " threads each");
  // closing them (what the fix does after each chime) gives everything back
  const page2 = await (await browser.newContext()).newPage(); await page2.goto("about:blank");
  await page.close();
  const cdp2 = await page2.context().newCDPSession(page2); await cdp2.send("HeapProfiler.enable");
  await page2.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination); o.start(ac.currentTime); o.stop(ac.currentTime + 0.05);
      await new Promise((r) => { o.onended = r; setTimeout(r, 400); });
      await ac.close();
    }
  }, N);
  await new Promise((r) => setTimeout(r, 3000));
  const info = (await bcdp.send("SystemInfo.getProcessInfo")).processInfo;
  const threads = execFileSync("ps", ["-M", "-o", "pid=", "-p", info.map((p) => p.id).join(",")], { encoding: "utf8" }).trim().split("\n").length;
  const alive = await page2.evaluate(() => 0);
  console.log((N + " chimes, each closed when it ends").padEnd(44), "threads (all browser processes):", String(threads).padStart(4), "(blank page had " + base.threads + ")");
} finally { await browser.close(); }
