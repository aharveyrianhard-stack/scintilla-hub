import fs from "node:fs";
const dir = process.argv[2]; const want = process.argv[3] || "";
const labels = fs.readdirSync(dir).filter((x) => x.endsWith("-result.json")).map((x) => x.replace("-result.json", "")).filter((x) => x.includes(want)).sort();
const mb = (x) => (x / 1e6).toFixed(1);
const rows = [];
for (const l of labels) {
  const r = JSON.parse(fs.readFileSync(`${dir}/${l}-result.json`)); const s = r.samples; const a = s[0], b = s.at(-1), mid = s[Math.min(2, s.length - 1)];
  const mins = b.m; const per = (k) => ((b[k] - a[k]) / mins);
  const ltPerMin = s.slice(1).map((x, i) => x.ltN - s[i].ltN);
  const reqPerMin = s.slice(1).map((x, i) => x.req - s[i].req);
  const heapSlope = (b.heapGc - mid.heapGc) / (b.m - mid.m) / 1e6;
  rows.push({ run: l, "load dom/idle ms": `${r.domMs}/${r.idleMs}`, "long tasks/min": per("ltN").toFixed(1), "long-task ms/min": per("ltMs").toFixed(0), "main busy %": ((b.taskS - a.taskS) / (mins * 60) * 100).toFixed(1), "script s/min": per("scriptS").toFixed(2), "layout s/min": per("layoutS").toFixed(2), "style s/min": per("styleS").toFixed(2),
    "heap MB m0→end": `${mb(a.heapGc)}→${mb(b.heapGc)}`, "heap MB/min (m2→end)": heapSlope.toFixed(2), "DOM nodes": `${a.nodes}→${b.nodes}`, listeners: `${a.listeners}→${b.listeners}`, "intervals live": `${a.iv}→${b.iv}`, "timeouts made/min": per("toMade").toFixed(0), "rAF/min": per("raf").toFixed(0), "ws open": b.wsOpen, "es open": b.esOpen, "req/min": per("req").toFixed(0), "req min-by-min": reqPerMin.join(","), "LT min-by-min": ltPerMin.join(","), frames: `${a.pageFrames}→${b.pageFrames}`, docs: `${a.docs}→${b.docs}`, "non-GET blocked": r.req.blocked, setup: r.setupNote });
}
if (process.argv[4] !== "detail") { for (const r of rows) { console.log("\n## " + r.run); for (const [k, v] of Object.entries(r)) if (k !== "run") console.log("  " + k.padEnd(24) + v); } }
fs.writeFileSync(`${dir}/table.json`, JSON.stringify(rows, null, 1));
if (process.argv[4] === "detail") for (const l of labels) {
  const r = JSON.parse(fs.readFileSync(`${dir}/${l}-result.json`));
  console.log("\n#### " + l);
  console.log(" top requests:", Object.entries(r.req.byKey).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v} ${k}`).join(" | "));
  console.log(" blocked:", JSON.stringify(r.req.blockedBy));
  console.log(" slow requests >1.5s:", r.req.slow.length, r.req.slow.sort((a, b) => b[0] - a[0]).slice(0, 6).map((x) => x[0] + "ms " + x[2]).join(" | "));
  console.log(" live intervals:", Object.entries(r.final.liveIv).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${v}× ${k}`).join(" | "));
  console.log(" timeout sites:", Object.entries(r.final.toSites).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v}× ${k}`).join(" | "));
  console.log(" ws:", [...new Set(r.final.wsUrls)].join(","), "es:", [...new Set(r.final.esUrls)].join(","));
  console.log(" frames:", r.final.perFrame.map((f) => `${f.u.replace(/^[^/]+/, "")} lt${f.ltN}/${f.ltMs}ms iv${f.iv} dom${f.dom} age${Math.round(f.age / 1000)}s`).join(" | ").slice(0, 1500));
  console.log(" page errors:", r.errors.slice(0, 3), Object.entries(r.consoleErr).slice(0, 4));
  for (const ph of ["early", "late"]) { const f = `${dir}/${l}-${ph}.cpuprofile`; if (!fs.existsSync(f)) continue; const p = JSON.parse(fs.readFileSync(f));
    const self = new Map(); const byId = new Map(p.nodes.map((n) => [n.id, n])); const dt = p.timeDeltas; let total = 0, idle = 0;
    for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]); const d = dt[i] || 0; total += d; const cf = n.callFrame; if (cf.functionName === "(idle)") { idle += d; continue; } const k = `${cf.functionName || "(anon)"} ${cf.url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + d); }
    console.log(` cpu ${ph}: busy ${((total - idle) / 1000).toFixed(0)} ms of ${(total / 1000).toFixed(0)} ms →`, [...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / 1000).toFixed(0)}ms ${k}`).join(" | ")); }
  const t = `${dir}/${l}-paint.trace-summary.json`; if (fs.existsSync(t)) { const j = JSON.parse(fs.readFileSync(t)); console.log(" trace 20s:", Object.entries(j.sum).slice(0, 14).map(([k, v]) => `${k} ${v.ms}ms/${v.n}`).join(" | ")); }
  if (r.loading) { const agg = {}; for (const [k, t, d] of r.loading.done) { const a = (agg[k] ||= { n: 0, ms: 0, max: 0 }); a.n++; a.ms += d; a.max = Math.max(a.max, d); } for (const [k, t, d] of r.loading.still) { const a = (agg[k + " [STILL SHOWING]"] ||= { n: 0, ms: 0, max: 0 }); a.n++; a.ms += d; a.max = Math.max(a.max, d); }
    console.log(" loading marks:"); for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].ms - a[1].ms).slice(0, 14)) console.log(`   ${v.n}× total ${(v.ms / 1000).toFixed(1)}s max ${(v.max / 1000).toFixed(1)}s  ${k}`); }
}
