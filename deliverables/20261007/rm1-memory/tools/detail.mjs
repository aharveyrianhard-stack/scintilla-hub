#!/usr/bin/env node
// RM1 — what changed between two samples of a soak run: frames, listener/timer call sites, DOM containers, requests.
//   node detail.mjs <run-dir> [fromIndex] [toIndex]
import fs from "node:fs";
const dir = process.argv[2];
const rows = fs.readFileSync(dir + "/samples.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const a = rows[Number(process.argv[3] ?? 0)], b = rows[Number(process.argv[4] ?? rows.length - 1)];
console.log("== " + dir + ": sample " + a.index + " (min " + a.minute + ") → sample " + b.index + " (min " + b.minute + ")");
const kind = (f) => String(f.href || "").replace(/^https?:\/\/[^/]+/, "").split("?")[0] || "/";
const sumBy = (s, pick) => { const m = new Map(); for (const f of s.frames) { if (!f.dom) continue; for (const [k, v] of pick(f)) m.set(kind(f) + " | " + k, (m.get(kind(f) + " | " + k) || 0) + v); } return m; };
const diff = (title, pick, n = 14, min = 1) => {
  const A = sumBy(a, pick), B = sumBy(b, pick), out = [];
  for (const k of new Set([...A.keys(), ...B.keys()])) { const d = (B.get(k) || 0) - (A.get(k) || 0); if (Math.abs(d) >= min) out.push([d, B.get(k) || 0, k]); }
  out.sort((x, y) => y[0] - x[0]);
  console.log("\n" + title + "  (Δ, now, where)");
  for (const [d, now, k] of out.slice(0, n)) console.log("  " + String((d > 0 ? "+" : "") + d).padStart(8) + String(now).padStart(9) + "  " + k);
};
const frameKinds = (s) => { const m = {}; for (const f of s.frames) m[kind(f)] = (m[kind(f)] || 0) + 1; return m; };
console.log("frames then:", JSON.stringify(frameKinds(a)));
console.log("frames now: ", JSON.stringify(frameKinds(b)));
console.log("now, per frame:");
for (const f of b.frames) if (f.dom) console.log("   " + String(f.href).replace(/^https?:\/\/[^/]+/, "").slice(0, 78).padEnd(80) + " el=" + f.dom.elements + " int=" + f.timers.intervalsActive + " to=" + f.timers.timeoutsPending + " canv=" + f.canvases.live + "/" + (f.canvases.pixels / 1e6).toFixed(1) + "Mpx lis+=" + f.listeners.adds + " lis-=" + f.listeners.removes);
diff("INTERVALS ACTIVE by call site", (f) => f.timers.intervalsActiveBySite, 16);
diff("INTERVALS CREATED by call site", (f) => f.timers.intervalsCreatedBySite, 12);
diff("TIMEOUTS CREATED by call site", (f) => f.timers.timeoutsCreatedBySite, 14, 5);
diff("TIMEOUTS PENDING by call site", (f) => f.timers.timeoutsPendingBySite, 8);
diff("LISTENERS ADDED by call site", (f) => f.listeners.addsBySite, 18, 2);
diff("LISTENERS REMOVED by call site", (f) => f.listeners.removesBySite, 8, 2);
diff("OBSERVERS CREATED by call site", (f) => f.observers.created, 8);
diff("CANVASES CREATED by call site", (f) => f.canvases.createdBySite, 8);
diff("DOM CONTAINERS (descendant elements)", (f) => f.dom.byContainer, 16, 3);
console.log("\nrequests in the last interval:"); for (const [k, v] of b.net.topRequestsSinceLast.slice(0, 16)) console.log("  " + String(v).padStart(6) + "  " + k);
console.log("\ndetached now:", JSON.stringify(b.detached).slice(0, 500));
