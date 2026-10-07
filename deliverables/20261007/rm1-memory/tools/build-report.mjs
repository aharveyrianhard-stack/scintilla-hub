#!/usr/bin/env node
// RM1 — build the report page from the soak runs: the before → after table, the charts, the table views.
//   node build-report.mjs <runs-dir> <facts.json> <out.html>
// Charts follow the house rule (no grey lines: red and green only) with the two hues stepped until the
// palette check passed on this panel colour (before #CC1F44, after #1DAD7B; CVD ΔE 11.0, contrast ≥ 3:1).
import fs from "node:fs";
import path from "node:path";

const [RUNS, FACTS_FILE, OUT] = process.argv.slice(2);
const facts = JSON.parse(fs.readFileSync(FACTS_FILE, "utf8"));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mb = (b) => b / 1048576;
const readRun = (dir) => { const f = path.join(RUNS, dir, "samples.jsonl"); return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; };
const readMeta = (dir) => { const f = path.join(RUNS, dir, "meta.json"); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; };
const readThreads = (file, name, t0) => {
  const f = path.join(RUNS, file); if (!fs.existsSync(f) || !t0) return [];
  return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.runs[name])
    .map((r) => ({ minute: +((Date.parse(r.at) - t0) / 60000).toFixed(1), v: r.runs[name].rendererThreads })).filter((p) => p.minute >= -1 && p.minute <= 92);
};
const slope = (pts) => {            // least squares, per hour
  const n = pts.length; if (n < 3) return NaN;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0; for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den ? (num / den) * 60 : NaN;
};

const METRICS = [
  { key: "heap", label: "JS heap after a forced clean-up", unit: "MB", digits: 1, get: (s) => mb(s.heap.used), plain: "what the page's own code is holding" },
  { key: "buffers", label: "Buffers held", unit: "MB", digits: 1, get: (s) => mb(s.heap.backingStores || 0), plain: "raw blocks of bytes the code keeps (pictures, tables)" },
  { key: "nodes", label: "Page nodes alive", unit: "", digits: 0, get: (s) => s.domCounters.nodes, plain: "every piece of the page the browser is keeping, on screen or not" },
  { key: "detached", label: "Nodes kept but off the page", unit: "", digits: 0, get: (s) => (s.detached && s.detached.nodes != null ? s.detached.nodes : NaN), plain: "pieces removed from the screen but still held" },
  { key: "listeners", label: "Event listeners", unit: "", digits: 0, get: (s) => s.domCounters.jsEventListeners, plain: "pieces of code waiting for a click, a message, a resize" },
  { key: "intervals", label: "Repeating timers", unit: "", digits: 0, get: (s) => s.totals.intervalsActive, plain: "clocks that fire again and again" },
  { key: "timeouts", label: "One-shot timers waiting", unit: "", digits: 0, get: (s) => s.totals.timeoutsPending, plain: "clocks waiting to fire once" },
  { key: "documents", label: "Documents alive", unit: "", digits: 0, get: (s) => s.domCounters.documents, plain: "the page plus every pane inside it" },
  { key: "canvasMpx", label: "Canvas area", unit: "Mpx", digits: 1, get: (s) => s.totals.canvasPixels / 1e6, plain: "drawing surfaces, in millions of pixels (4 bytes each)" },
  { key: "sockets", label: "Open live sockets", unit: "", digits: 0, get: (s) => s.net.wsOpen, plain: "always-open lines to the data" },
  { key: "requests", label: "Requests per 5 minutes", unit: "", digits: 0, get: (s) => s.net.requestsSinceLast, plain: "how hard the page keeps asking for data" },
  { key: "rss", label: "Process memory, whole test browser", unit: "MB", digits: 0, get: (s) => mb(s.process.rssTotal || 0), plain: "the nearest thing to Activity Monitor's number" }
];
const PAGES = [
  { id: "hub", title: "The Hub, left on its dashboard", before: "before-hub", after: "after-hub", charts: ["heap", "nodes", "listeners", "intervals", "threads", "rss"] },
  { id: "hubco", title: "The Hub with a company open (NVDA)", before: "before-hubco", after: "after-hubco", charts: ["heap", "buffers", "nodes", "listeners", "intervals", "threads", "rss"] },
  { id: "station", title: "The Station (charts, video list, X pane)", before: "before-station", after: "after-station", charts: ["heap", "buffers", "nodes", "listeners", "intervals", "documents", "canvasMpx", "rss"] }
];
const COLOR = { before: "#CC1F44", after: "#1DAD7B" };

const data = {};
for (const page of PAGES) {
  data[page.id] = {};
  for (const which of ["before", "after"]) {
    const rows = readRun(page[which]), meta = readMeta(page[which]);
    const t0 = rows.length ? Date.parse(rows[0].at) : 0;
    const series = {};
    for (const m of METRICS) series[m.key] = rows.map((s) => ({ minute: s.minute, v: m.get(s) })).filter((p) => Number.isFinite(p.v));
    /* from which reading were the live quote reads failing? (the incident of 7 Oct, 10:50 ET) */
    const quoteReads = rows.map((s) => { const hit = s.net.topRequestsSinceLast.find(([k]) => /fly\.dev\/quotes$/.test(k)); return hit ? hit[1] : 0; });
    const usual = quoteReads.slice(1, 6).reduce((a, b) => a + b, 0) / Math.max(1, quoteReads.slice(1, 6).length);
    const firstBad = rows.findIndex((s, i) => i > 2 && quoteReads[i] < usual * 0.7);
    const degradedFrom = firstBad > 0 ? rows[firstBad - 1].minute : null;
    series.threads = readThreads(which === "before" ? "threads-before.jsonl" : "threads-after.jsonl", page[which].replace(/^(before|after)-(.*)$/, "$2-$1"), t0);
    data[page.id][which] = { rows: rows.length, minutes: rows.length ? rows[rows.length - 1].minute : 0, degradedFrom, series, meta: meta ? { blocked: meta.net.blockedNonGet, served: meta.net.served || {}, ws: meta.net.ws, wsSent: meta.net.wsSent, errors: meta.pageEvents.errors, crashed: meta.pageEvents.crashed, startedAt: meta.startedAt, endedAt: meta.endedAt } : null };
  }
}
const ALL = METRICS.concat([{ key: "threads", label: "Threads in the page's process", unit: "", digits: 0, plain: "each open sound channel keeps one" }]);
const metricOf = (key) => ALL.find((m) => m.key === key);
const stat = (pts) => {
  if (!pts || !pts.length) return null;
  const first = pts[0].v, last = pts[pts.length - 1].v, vals = pts.map((p) => p.v);
  return { first, last, min: Math.min(...vals), max: Math.max(...vals), mean: vals.reduce((a, b) => a + b, 0) / vals.length, perHour: slope(pts.map((p) => [p.minute, p.v])), n: pts.length, span: pts[pts.length - 1].minute - pts[0].minute };
};
const fmt = (v, d) => (Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const signed = (v, d) => (Number.isFinite(v) ? (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), d) : "—");

// ---- charts (static SVG; the hover layer is added by the page's own small script) -----------------
const niceStep = (span, target) => { const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
function chart(pageId, key) {
  const m = metricOf(key), b = data[pageId].before.series[key] || [], a = data[pageId].after.series[key] || [];
  const all = b.concat(a); if (!all.length) return "";
  const W = 430, H = 214, L = 52, R = 108, T = 14, B = 30, iw = W - L - R, ih = H - T - B;
  let lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
  if (hi - lo < (m.digits === 0 ? 2 : 0.2)) { const pad = m.digits === 0 ? 2 : 0.5; hi = hi + pad; lo = Math.max(0, lo - pad); }   /* a flat line still gets a readable scale */
  let step = niceStep(hi - lo, 4); if (m.digits === 0) step = Math.max(1, step);                                                  /* counts are whole numbers */
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (lo > 0 && lo < (hi - lo) * 0.6) lo = 0;
  const X = (min) => L + (Math.max(0, Math.min(90, min)) / 90) * iw, Y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih;
  const digits = step < 1 ? 1 : 0;
  let g = "";
  for (let v = lo; v <= hi + step / 2; v += step) g += `<line x1="${L}" x2="${L + iw}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" class="tick" text-anchor="end">${fmt(v, digits)}</text>`;
  for (const min of [0, 30, 60, 90]) g += `<text x="${X(min).toFixed(1)}" y="${H - 10}" class="tick" text-anchor="middle">${min}${min === 90 ? " min" : ""}</text>`;
  const pathOf = (pts) => pts.map((p, i) => (i ? "L" : "M") + X(p.minute).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
  const line = (pts, cls) => {
    if (!pts.length) return "";
    const from = data[pageId][cls].degradedFrom;
    if (from == null) return `<path d="${pathOf(pts)}" class="ln ${cls}"/>`;
    const good = pts.filter((p) => p.minute <= from + 0.01);
    const faint = (good.length ? [good[good.length - 1]] : []).concat(pts.filter((p) => p.minute > from + 0.01));   /* joined to the last healthy reading: no gap */
    return (good.length > 1 ? `<path d="${pathOf(good)}" class="ln ${cls}"/>` : "") + (faint.length > 1 ? `<path d="${pathOf(faint)}" class="ln ${cls} faint"/>` : "");
  };
  // end labels: values in ink, a dot in the series colour; pushed apart when the two ends collide
  const ends = [["before", b], ["after", a]].filter(([, pts]) => pts.length).map(([name, pts]) => ({ name, x: X(pts[pts.length - 1].minute), y: Y(pts[pts.length - 1].v), v: pts[pts.length - 1].v }));
  /* one line each ("136 before"); when the two ends meet they are set 15 px apart and joined to their dots by a hairline */
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 15) { const mid = Math.max(T + 8, Math.min(T + ih - 8, (ends[0].y + ends[1].y) / 2)), up = ends[0].y < ends[1].y || (ends[0].y === ends[1].y) ? 0 : 1; ends[up].ly = mid - 7.5; ends[1 - up].ly = mid + 7.5; }
  let lab = "";
  for (const e of ends) { const ly = e.ly == null ? e.y : e.ly;
    lab += `<circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="4" class="dot ${e.name}"/>` + (Math.abs(ly - e.y) > 1 || e.x < L + iw - 2 ? `<line x1="${(e.x + 5).toFixed(1)}" y1="${e.y.toFixed(1)}" x2="${(L + iw + 9).toFixed(1)}" y2="${ly.toFixed(1)}" class="lead"/>` : "") +
      `<text x="${(L + iw + 12).toFixed(1)}" y="${(ly + 4).toFixed(1)}"><tspan class="endv">${fmt(e.v, m.digits)}</tspan><tspan class="endn" dx="5">${e.name}</tspan></text>`; }
  const sb = stat(b), sa = stat(a);
  const aria = `${m.label}${m.unit ? " in " + m.unit : ""}. Before: ${sb ? fmt(sb.first, m.digits) + " to " + fmt(sb.last, m.digits) : "no data"}. After: ${sa ? fmt(sa.first, m.digits) + " to " + fmt(sa.last, m.digits) : "no data"}.`;
  return `<figure class="ch" data-page="${pageId}" data-key="${key}" tabindex="0" aria-label="${esc(aria)}">
    <figcaption><b>${esc(m.label)}</b>${m.unit ? ` <i>${esc(m.unit)}</i>` : ""}<span>${esc(m.plain || "")}</span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" data-l="${L}" data-iw="${iw}" data-t="${T}" data-ih="${ih}" data-lo="${lo}" data-hi="${hi}">${g}${line(b, "before")}${line(a, "after")}${lab}
      <line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" visibility="hidden"/><circle class="hv before" r="4" visibility="hidden"/><circle class="hv after" r="4" visibility="hidden"/></svg>
    <div class="tip" hidden></div></figure>`;
}

// ---- the before → after table -----------------------------------------------------------------------
function summaryTable(page) {
  const keys = ["heap", "buffers", "nodes", "detached", "listeners", "intervals", "timeouts", "documents", "canvasMpx", "sockets", "requests", "threads", "rss"];
  let rows = "";
  for (const key of keys) {
    const m = metricOf(key), sb = stat(data[page.id].before.series[key]), sa = stat(data[page.id].after.series[key]);
    if (!sb && !sa) continue;
    if ((!sb || sb.max === 0) && (!sa || sa.max === 0) && key !== "detached") continue;
    const cell = (s) => (s ? `<td>${fmt(s.first, m.digits)}</td><td>${fmt(s.last, m.digits)}</td><td>${fmt(s.min, m.digits)} – ${fmt(s.max, m.digits)}</td><td>${signed(s.perHour, m.digits === 0 ? 0 : 1)}</td>` : `<td>—</td><td>—</td><td>—</td><td>—</td>`);
    rows += `<tr><td>${esc(m.label)}${m.unit ? " (" + esc(m.unit) + ")" : ""}${key === "threads" && sb && sb.span < 80 ? ` <i>· before: from minute ${fmt(data[page.id].before.series.threads[0].minute, 0)}</i>` : ""}</td>${cell(sb)}${cell(sa)}</tr>`;
  }
  return `<div class="tw"><table class="sum"><thead><tr><th rowspan="2">${esc(page.title)}</th><th colspan="4" class="grp"><span class="key before"></span>BEFORE · live</th><th colspan="4" class="grp"><span class="key after"></span>AFTER · the branch</th></tr>
    <tr><th>start</th><th>end</th><th>low – high</th><th>per hour</th><th>start</th><th>end</th><th>low – high</th><th>per hour</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function tableView(page) {
  const keys = ["heap", "buffers", "nodes", "detached", "listeners", "intervals", "timeouts", "documents", "canvasMpx", "requests", "rss"];
  const head = `<tr><th>minute</th>${keys.map((k) => `<th colspan="2">${esc(metricOf(k).label)}${metricOf(k).unit ? " (" + metricOf(k).unit + ")" : ""}</th>`).join("")}</tr><tr><th></th>${keys.map(() => "<th>before</th><th>after</th>").join("")}</tr>`;
  const minutes = [...new Set([].concat(...["before", "after"].map((w) => (data[page.id][w].series.heap || []).map((p) => Math.round(p.minute)))))].sort((x, y) => x - y);
  const at = (w, k, min) => { const p = (data[page.id][w].series[k] || []).find((q) => Math.round(q.minute) === min); return p ? fmt(p.v, metricOf(k).digits) : "—"; };
  return `<details class="tv"><summary>TABLE VIEW · every 5-minute reading</summary><div class="tw"><table class="raw"><thead>${head}</thead><tbody>${minutes.map((min) => `<tr><td>${min}</td>${keys.map((k) => `<td>${at("before", k, min)}</td><td>${at("after", k, min)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}

const pageSections = PAGES.map((page) => {
  const d = data[page.id];
  const note = `before: ${d.before.rows} readings over ${fmt(d.before.minutes, 0)} minutes · after: ${d.after.rows} readings over ${fmt(d.after.minutes, 0)} minutes (stopped early — see "What went wrong during the test")`;
  const faintNote = d.before.degradedFrom != null || d.after.degradedFrom != null
    ? `faint line = the live quote feed was failing (before: from minute ${d.before.degradedFrom == null ? "—" : fmt(d.before.degradedFrom, 0)}; after: from minute ${d.after.degradedFrom == null ? "—" : fmt(d.after.degradedFrom, 0)}; both 10:50 ET)` : "";
  return `<section id="${page.id}"><h2>${esc(page.title)}</h2>
    <p class="legend"><span><i class="key before"></i>before — the live page</span><span><i class="key after"></i>after — the branch, served over the live address with live data</span>${faintNote ? `<span><i class="key before faint"></i><i class="key after faint" style="margin-left:-4px"></i>${esc(faintNote)}</span>` : ""}<span class="dim">${esc(note)}</span></p>
    <div class="grid">${page.charts.map((k) => chart(page.id, k)).join("")}</div>
    ${summaryTable(page)}${tableView(page)}</section>`;
}).join("\n");

const template = fs.readFileSync(new URL("./report-template.tpl", import.meta.url), "utf8");
const compact = {};
for (const page of PAGES) { compact[page.id] = {}; for (const w of ["before", "after"]) { compact[page.id][w] = {}; for (const k of page.charts) compact[page.id][w][k] = (data[page.id][w].series[k] || []).map((p) => [p.minute, +p.v.toFixed(2)]); } }
const units = {}; for (const m of ALL) units[m.key] = [m.label, m.unit, m.digits];
let html = template.replace("<!--PAGES-->", pageSections).replace("/*DATA*/", "const RM1 = " + JSON.stringify({ series: compact, units }) + ";");
html = html.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, k) => { const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), facts); return v == null ? "<mark>?" + k + "</mark>" : esc(v); });
fs.writeFileSync(OUT, html);
const summary = {};
for (const page of PAGES) { summary[page.id] = {}; for (const w of ["before", "after"]) { summary[page.id][w] = { readings: data[page.id][w].rows, minutes: data[page.id][w].minutes, meta: data[page.id][w].meta }; for (const m of ALL) { const s = stat(data[page.id][w].series[m.key]); if (s) summary[page.id][w][m.key] = { start: +s.first.toFixed(2), end: +s.last.toFixed(2), low: +s.min.toFixed(2), high: +s.max.toFixed(2), mean: +s.mean.toFixed(2), perHour: +s.perHour.toFixed(2), readings: s.n }; } } }
for (const page of PAGES) for (const w of ["before", "after"]) summary[page.id][w].liveQuotesFailingFromMinute = data[page.id][w].degradedFrom;
fs.writeFileSync(path.join(path.dirname(OUT), "data", "summary.json"), JSON.stringify(summary, null, 1));
fs.writeFileSync(path.join(path.dirname(OUT), "data", "series.json"), JSON.stringify(compact));
const missing = (html.match(/<mark>\?[^<]+<\/mark>/g) || []);
console.log("wrote", OUT, (html.length / 1024).toFixed(0) + " KB;", missing.length ? "MISSING FACTS: " + [...new Set(missing)].join(" ") : "all facts filled");
