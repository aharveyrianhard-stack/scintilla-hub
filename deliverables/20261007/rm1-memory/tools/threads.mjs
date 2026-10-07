// RM1 — every 5 minutes, for each running soak: threads and resident memory of its whole headless-browser family.
// (Threads are how a leaked sound channel shows from outside the page: each open AudioContext keeps one.)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const OUT = process.argv[2], UNTIL = Date.now() + Number(process.argv[3] || 90) * 60000;
const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: "utf8" }); } catch (_) { return ""; } };
const once = () => {
  const procs = sh("ps", ["-Ao", "pid=,ppid=,rss=,command="]).trim().split("\n").map((l) => { const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(l); return m ? { pid: +m[1], ppid: +m[2], rss: +m[3], cmd: m[4] } : null; }).filter(Boolean);
  const runs = procs.filter((p) => /node (soak|usecycle)\.mjs --name (\S+)/.test(p.cmd));
  const row = { at: new Date().toISOString(), runs: {} };
  for (const run of runs) {
    const name = /--name (\S+)/.exec(run.cmd)[1];
    const family = []; const walk = (pid) => { for (const p of procs) if (p.ppid === pid) { family.push(p); walk(p.pid); } }; walk(run.pid);
    if (!family.length) continue;
    const threads = sh("ps", ["-M", "-o", "pid=", "-p", family.map((p) => p.pid).join(",")]).trim().split("\n").filter(Boolean).length;
    const renderers = family.filter((p) => /--type=renderer/.test(p.cmd));
    const rThreads = renderers.length ? sh("ps", ["-M", "-o", "pid=", "-p", renderers.map((p) => p.pid).join(",")]).trim().split("\n").filter(Boolean).length : 0;
    row.runs[name] = { processes: family.length, threads, rendererThreads: rThreads, rssMB: Math.round(family.reduce((a, p) => a + p.rss, 0) / 1024),
      audioServiceRssMB: Math.round(family.filter((p) => /audio\.mojom/.test(p.cmd)).reduce((a, p) => a + p.rss, 0) / 1024) };
  }
  fs.appendFileSync(OUT, JSON.stringify(row) + "\n");
};
once();
const timer = setInterval(() => { once(); if (Date.now() > UNTIL) { clearInterval(timer); } }, 300000);
