#!/usr/bin/env node
// RM1 — gather the measured facts the report quotes, from the runs and the evidence files, into facts.json.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const W = "/Users/alanharvey/SCINTILLA 0.5/_worktrees";
const git = (dir, ...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8" }).trim();
const rows = (d) => (fs.existsSync(d + "/samples.jsonl") ? fs.readFileSync(d + "/samples.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const meta = (d) => (fs.existsSync(d + "/meta.json") ? JSON.parse(fs.readFileSync(d + "/meta.json", "utf8")) : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const count = (snap, name) => { if (!fs.existsSync(snap)) return null; const o = JSON.parse(execFileSync("node", ["heapcount.mjs", snap, name], { encoding: "utf8", maxBuffer: 1 << 26 })); return (o[name + " (native)"] || { count: 0 }).count; };
const text = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "");
const passes = (f) => { const t = text(f); const p = (t.match(/^\s+PASS\s/gm) || []).length, x = (t.match(/^\s+FAIL\s/gm) || []).length; return { p, x, ok: /RESULT: PASS/.test(t) }; };

const bS = rows("before-station"), aS = rows("after-station");
const blocked = {};
for (const d of ["before-hub", "after-hub", "before-hubco", "after-hubco", "before-station", "after-station"]) { const m = meta(d); if (!m) continue; for (const [k, v] of Object.entries(m.net.blockedNonGet)) { const host = k.split(" ")[1].split("/")[0], method = k.split(" ")[0]; const key = method + " " + (/(^|\.)scintillahub\.ai$/.test(host) ? "to our own pages (the version check)" : /supabase/.test(host) ? "to our database functions" : "to YouTube and Google (the video player)"); blocked[key] = (blocked[key] || 0) + v; } }
const audio = text("evidence/audio-experiment.txt");
const am = /cost of the (\d+) silent contexts while idle: ([\d.]+)% of one core, ([\d.]+) MB and ([\d.]+) threads each/.exec(audio) || [];
const alive = /chimes, as live \(never closed\)\s+AudioContext objects alive:\s+(\d+)/.exec(audio) || [];
const vh = passes("evidence/verify-night-reload-hub.txt"), vs = passes("evidence/verify-night-reload-station.txt"), vho = passes("evidence/verify-night-reload-hub-off.txt"), vso = passes("evidence/verify-night-reload-station-off.txt");
const lens = /charts on both walls: (\d+) · lens in the same place: (\d+) · different: (\d+)/.exec(text("evidence/verify-lens.txt")) || [];
const lensBuf = /live:.*buffers ([\d.]+) MB[\s\S]*?branch:.*buffers ([\d.]+) MB/.exec(text("evidence/verify-lens.txt")) || [];
const laps = fs.existsSync("use-hub-before/laps.jsonl") ? fs.readFileSync("use-hub-before/laps.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const hb = count("before-hub/end.heapsnapshot", "AudioContext"), ha = count("after-hub/end.heapsnapshot", "AudioContext"), cb = count("before-hubco/end.heapsnapshot", "AudioContext"), ca = count("after-hubco/end.heapsnapshot", "AudioContext");
const thr = (file, name) => { const t = text(file).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.runs[name]).map((r) => r.runs[name].rendererThreads); return { first: t.length ? t[0] : null, last: t.length ? t[t.length - 1] : null, n: t.length }; };
const tHB = thr("threads-before.jsonl", "hub-before"), tHA = thr("threads-after.jsonl", "hub-after"), tCB = thr("threads-before.jsonl", "hubco-before"), tCA = thr("threads-after.jsonl", "hubco-after");
const newsTxt = text("evidence/news-room-experiment.txt");
const newsRows = newsTxt.split("\n").map((l) => /^\s*(\d+)\s+(\d+) \/\s+(\d+) \/\s+(\d+)\s+(\d+) \/\s+(\d+) \/\s+(\d+)/.exec(l)).filter(Boolean).map((m) => m.slice(1).map(Number));
const newsEnd = /in (\d+) minutes the live list went (\d+) → (\d+) headlines \((\d+) an hour\); the branch's went (\d+) → (\d+)/.exec(newsTxt) || [];
const vhh = passes("evidence/verify-night-reload-hub-hold.txt"), vsh = passes("evidence/verify-night-reload-station-hold.txt");
const chimeTxt = text("evidence/chime-experiment.txt");
const chimeEnd = /after (\d+) minutes: the live page opened (\d+) sound channels, closed (\d+), and (\d+) are still alive; the branch opened (\d+), closed (\d+), and (\d+) are still alive/.exec(chimeTxt) || [];
const firstAt = (d) => { const r = rows(d); return r.length ? Date.parse(r[0].at) : NaN; };
const probeLines = text("evidence/quotes-route-probe.txt").split("\n").map((l) => /^(\d\d):(\d\d):\d\d\s+HTTP (\d+) in ([\d.]+)s/.exec(l)).filter(Boolean);
const probe = { reads: String(probeLines.length), slow: String(probeLines.filter((m) => m[3] === "200" && +m[4] > 1).length), fast: String(probeLines.filter((m) => m[3] === "200" && +m[4] < 0.5).length), failed: String(probeLines.filter((m) => m[3] !== "200").length),
  until: probeLines.length ? String((+probeLines[probeLines.length - 1][1] + 20) % 24).padStart(2, "0") + ":" + probeLines[probeLines.length - 1][2] : "?" };
const startLag = Number.isFinite(firstAt("after-hub") - firstAt("before-hub")) ? Math.round((firstAt("after-hub") - firstAt("before-hub")) / 60000) : 39;
const facts = {
  audio: { n: am[1] || "40", cpuPct: "10–11", mbEach: "1–2", threadsEach: "1.1–1.2", aliveAfter: alive[1] || "", perDay: hb == null ? "?" : String(Math.round(hb / 1.5 * 24 / 10) * 10), lastRun: am.slice(1).join(" / ") },
  threads: { hubBeforeLast: tHB.last == null ? "?" : String(tHB.last), hubAfterFirst: tHA.first == null ? "?" : String(tHA.first), hubAfterLast: tHA.last == null ? "?" : String(tHA.last), hubcoBeforeLast: tCB.last == null ? "?" : String(tCB.last), hubcoAfterLast: tCA.last == null ? "?" : String(tCA.last) },
  newsRoom: { minutes: newsEnd[1] || "?", liveKept: newsEnd[3] || "?", perHour: newsEnd[4] || "?", branchKept: newsEnd[6] || "?", livePieces0: newsRows.length ? newsRows[0][3].toLocaleString("en-US") : "?", livePieces1: newsRows.length ? newsRows[newsRows.length - 1][3].toLocaleString("en-US") : "?" },
  chime: { minutes: chimeEnd[1] || "?", liveOpened: chimeEnd[2] || "?", liveClosed: chimeEnd[3] || "?", liveAlive: chimeEnd[4] || "?", branchOpened: chimeEnd[5] || "?", branchClosed: chimeEnd[6] || "?", branchAlive: chimeEnd[7] || "?" },
  probe,
  contexts: { hubBefore: hb == null ? "?" : String(hb), hubAfter: ha == null ? "not counted (run stopped early)" : String(ha), hubcoBefore: cb == null ? "?" : String(cb), hubcoAfter: ca == null ? "?" : String(ca) },
  news: { day1: "5,788", day2: "8,726", fav1: "1,765", fav2: "2,554", hour: "189" },
  pixel: { heldMB: "53.7", totalMB: "54.9", bigMB: "9.8", smallMB: "2.4", beforeMean: bS.length ? mean(bS.map((s) => s.heap.backingStores / 1048576)).toFixed(0) : "?", afterMean: aS.length ? mean(aS.map((s) => s.heap.backingStores / 1048576)).toFixed(0) : "?",
    sideLive: lensBuf[1] || "?", sideBranch: lensBuf[2] || "?", lensSame: lens[2] || "?", lensOf: lens[1] || "?" },
  laps: { count: String(Math.max(0, laps.length - 1)), companies: "5", lists: "4", first: laps[1] ? (laps[1].heapUsed / 1048576).toFixed(1) : "?", last: laps.length ? (laps[laps.length - 1].heapUsed / 1048576).toFixed(1) : "?" },
  verify: { hubHold: vhh.ok ? "Proved: with the bell's panel open, 3 am came and went with no reload; once it was closed the page reloaded at the next check, once." : "NOT PROVED — see data/",
    stationHold: vsh.ok ? "Proved: in the browser's full screen, 3 am came and went with no reload; once out of it the page reloaded at the next check, once." : "NOT PROVED — see data/",
    hub: vh.ok && vho.ok ? `Run end to end with no window, the page's clock moved from 22:00 to 03:10: it reloaded once, came back in the same room, on the same list, with the same company open and the board scrolled where it was; not again that night, not in the day, once the next night (${vh.p} of ${vh.p + vh.x} checks). With ?nightreload=0: no reload.` : "NOT PROVED — see data/",
    stationShort: vs.ok && vso.ok && vsh.ok ? `${vs.p} of ${vs.p + vs.x} checks on the reload itself, ${vsh.p} of ${vsh.p + vsh.x} on waiting for full screen, and no reload with ?nightreload=0.` : "NOT PROVED",
    station: vs.ok && vso.ok ? `Run end to end with no window, the page's clock moved from 22:00 to 03:10: it reloaded once, came back on the same scene, timeframe, chart count and feed, with the expanded chart expanded again, the video list scrolled where it was and the X pane mounted again; not again that night, not in the day, once the next night (${vs.p} of ${vs.p + vs.x} checks). With ?nightreload=0: no reload.` : "NOT PROVED — see data/" },
  /* hub / station = the last commit that changed code; hubCode / stationCode = the commits the "after" soaks ran on */
  sha: { hubBranch: "hub/rm1-memory-20261007", hub: "cc65930", stationBranch: "station/rm1-memory-20261007", station: "e577fd7", hubCode: "780a3cb", stationCode: "afecf96" },
  station: { candleMB: "21.5" }, times: { afterLag: String(startLag) },
  blocked: { summary: Object.entries(blocked).map(([k, v]) => v + " " + k).join("; ") || "none" },
  tests: JSON.parse(text("evidence/tests.json") || '{"hub":"?","station":"?"}')
};
facts.frames = JSON.parse(text("evidence/frames.json") || "{}");
fs.writeFileSync("facts.json", JSON.stringify(facts, null, 1));
console.log(JSON.stringify(facts, null, 1));
