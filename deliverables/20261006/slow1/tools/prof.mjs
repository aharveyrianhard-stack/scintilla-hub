import fs from "node:fs";
for (const f of process.argv.slice(2)) { const p = JSON.parse(fs.readFileSync(f));
  const byId = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const self = new Map(), incl = new Map(); let total = 0, idle = 0;
  const key = (cf) => `${cf.functionName || "(anon)"} ${cf.url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]}:${cf.lineNumber + 1}`;
  for (let i = 0; i < p.samples.length; i++) { const d = p.timeDeltas[i] || 0; total += d; let n = byId.get(p.samples[i]); if (n.callFrame.functionName === "(idle)") { idle += d; continue; }
    self.set(key(n.callFrame), (self.get(key(n.callFrame)) || 0) + d);
    const seen = new Set(); for (let id = n.id; id != null; id = parent.get(id)) { const k = key(byId.get(id).callFrame); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + d); } } }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `    ${(v / 1000).toFixed(0).padStart(6)} ms  ${k}`).join("\n");
  console.log(`\n### ${f.split("/").pop()}  busy ${((total - idle) / 1000).toFixed(0)} ms of ${(total / 1000).toFixed(0)} ms (${(((total - idle) / total) * 100).toFixed(1)}%)\n  SELF\n${top(self, 12)}\n  INCLUSIVE (page functions)\n${top(new Map([...incl].filter(([k]) => !/^\((root|program|garbage)/.test(k) && / \//.test(k))), 22)}`); }
