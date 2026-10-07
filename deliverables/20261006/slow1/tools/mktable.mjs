import fs from "node:fs";
const load = (d, l) => JSON.parse(fs.readFileSync(`${d}/${l}-result.json`));
const paint = (d, l) => { try { const j = JSON.parse(fs.readFileSync(`${d}/${l}-paint.trace-summary.json`)).sum; return j; } catch { return {}; } };
const col = (d, l) => { const r = load(d, l), s = r.samples, a = s[0], b = s.at(-1), m = b.m, top = r.final.perFrame[0], p = paint(d, l);
  const per = (k) => (b[k] - a[k]) / m; const mb = (x) => (x / 1e6).toFixed(0);
  const fr = s.map((x) => x.pageFrames), ls = s.map((x) => x.listeners), iv = s.map((x) => x.iv), hp = s.map((x) => x.heapGc / 1e6);
  return { "Main thread busy": ((b.taskS - a.taskS) / (m * 60) * 100).toFixed(1) + "%", "Long tasks (> 50 ms) per minute": (top.ltN / m).toFixed(1), "Time inside long tasks, s per minute": (top.ltMs / m / 1000).toFixed(2),
    "Script, s per minute": per("scriptS").toFixed(2), "Layout, s per minute": per("layoutS").toFixed(2), "Style, s per minute": per("styleS").toFixed(2),
    "Paint, ms in a 20 s trace": p.Paint ? `${p.Paint.ms} (${p.Paint.n} paints)` : "–", "Layouts in a 20 s trace": p.Layout ? String(p.Layout.n) : "–",
    "JS heap after GC, MB: start → 5 min → 15 min (peak)": `${mb(a.heapGc)} → ${mb(s[5].heapGc)} → ${mb(b.heapGc)} (${Math.max(...hp).toFixed(0)})`,
    "DOM nodes: start → end": `${a.nodes} → ${b.nodes}`, "Event listeners: min–max": `${Math.min(...ls)}–${Math.max(...ls)}`, "Repeating timers alive: min–max": `${Math.min(...iv)}–${Math.max(...iv)}`,
    "One-shot timers set per minute": per("toMade").toFixed(0), "WebSockets open": String(b.wsOpen), "Event streams (SSE) open": String(b.esOpen), "Frames (documents) alive: min–max": `${Math.min(...fr)}–${Math.max(...fr)}`,
    "Requests per minute": per("req").toFixed(0), "Requests that took > 1.5 s (15 min)": `${r.req.slow.length} of ${r.req.total}`, "Slowest request": r.req.slow.length ? (Math.max(...r.req.slow.map((x) => x[0])) / 1000).toFixed(1) + " s" : "–", "Non-GET requests blocked": String(r.req.blocked) }; };
const table = (title, cols) => { const data = cols.map(([h, d, l]) => [h, col(d, l)]); const rows = Object.keys(data[0][1]);
  return `### ${title}\n\n| | ${data.map((c) => c[0]).join(" | ")} |\n|---|${data.map(() => "---:").join("|")}|\n` + rows.map((k) => `| ${k} | ${data.map((c) => c[1][k]).join(" | ")} |`).join("\n") + "\n"; };
let out = "";
out += table("Hub — live page (before)", [["Default tab · 1×", "before", "hub-default-1x"], ["Default tab · 4×", "before", "hub-default-4x"], ["Cohort board full screen · 1×", "before", "hub-boardfs-1x"], ["Cohort board full screen · 4×", "before", "hub-boardfs-4x"]]);
out += "\n" + table("Station — live page", [["Default page · 1×", "before", "st-default-1x"], ["Default page · 4×", "before", "st-default-4x"], ["Busiest page (16 charts) · 1×", "before", "st-busiest-1x"], ["Busiest page (16 charts) · 4×", "before", "st-busiest-4x"]]);
out += "\n" + table("Hub — the branch `hub/slow1-20261006` (after)", [["Default tab · 1×", "after", "hub-default-1x"], ["Default tab · 4×", "after", "hub-default-4x"], ["Cohort board full screen · 1×", "after", "hub-boardfs-1x"], ["Cohort board full screen · 4×", "after", "hub-boardfs-4x"]]);
fs.writeFileSync("tables.md", out); console.log(out);
