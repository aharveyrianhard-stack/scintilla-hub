#!/usr/bin/env node
// RM1 — how much memory does a NAMED variable hold? For every object a script-level or closure
// variable of the given name points at, the retained size = what would be freed if it went away
// (everything reachable from the roots now, minus everything reachable without that object).
//   node heapvars.mjs <file.heapsnapshot> chartCache,cloudDailyCache,rsiSourceCache [--each]
import fs from "node:fs";
const [file, namesArg] = process.argv.slice(2);
const EACH = process.argv.includes("--each");
const names = new Set(String(namesArg).split(","));
function parseInts(buf, from) {
  let cap = 1 << 20, out = new Float64Array(cap), n = 0, cur = 0, has = false, i = from;
  for (; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 48 && c <= 57) { cur = cur * 10 + (c - 48); has = true; }
    else { if (has) { if (n === cap) { cap *= 2; const g = new Float64Array(cap); g.set(out); out = g; } out[n++] = cur; cur = 0; has = false; } if (c === 93) break; }
  }
  return { values: out.subarray(0, n), end: i };
}
const buf = fs.readFileSync(file);
const iNodes = buf.indexOf('"nodes":[');
const meta = JSON.parse(buf.subarray(0, iNodes).toString("utf8").replace(/,\s*$/, "") + "}").snapshot.meta;
const nodesP = parseInts(buf, iNodes + 9), nodes = nodesP.values;
const edgesP = parseInts(buf, buf.indexOf('"edges":[', nodesP.end) + 9), edges = edgesP.values;
let tail = buf.subarray(buf.indexOf('"strings":[', edgesP.end) + 10).toString("utf8"); tail = tail.slice(0, tail.lastIndexOf("]") + 1);
const strings = JSON.parse(tail);
const nf = meta.node_fields, NF = nf.length, ef = meta.edge_fields, EF = ef.length;
const oType = nf.indexOf("type"), oName = nf.indexOf("name"), oSelf = nf.indexOf("self_size"), oEdges = nf.indexOf("edge_count");
const nodeTypes = meta.node_types[oType], edgeTypes = meta.edge_types[ef.indexOf("type")];
const eType = ef.indexOf("type"), eName = ef.indexOf("name_or_index"), eTo = ef.indexOf("to_node");
const N = nodes.length / NF;
const firstEdge = new Uint32Array(N + 1);
for (let i = 0, e = 0; i < N; i++) { firstEdge[i] = e; e += nodes[i * NF + oEdges]; if (i === N - 1) firstEdge[N] = e; }
const WEAK = edgeTypes.indexOf("weak"), SHORTCUT = edgeTypes.indexOf("shortcut"), CONTEXT = edgeTypes.indexOf("context"), PROPERTY = edgeTypes.indexOf("property");
const queue = new Uint32Array(N), seen = new Uint8Array(N);
const reach = (skip) => {
  seen.fill(0); let qh = 0, qt = 0, size = 0; queue[qt++] = 0; seen[0] = 1;
  while (qh < qt) {
    const u = queue[qh++]; size += nodes[u * NF + oSelf];
    for (let e = firstEdge[u]; e < firstEdge[u + 1]; e++) {
      const et = edges[e * EF + eType]; if (et === WEAK || et === SHORTCUT) continue;
      const v = edges[e * EF + eTo] / NF; if (seen[v] || v === skip) continue;
      seen[v] = 1; queue[qt++] = v;
    }
  }
  return size;
};
const all = reach(-1);
// where each named variable points (context = let/const/closure variables; property on a Window = var/global)
const targets = new Map();   // name -> Set(node)
for (let u = 0; u < N; u++) for (let e = firstEdge[u]; e < firstEdge[u + 1]; e++) {
  const et = edges[e * EF + eType]; if (et !== CONTEXT && et !== PROPERTY) continue;
  const nm = strings[edges[e * EF + eName]]; if (!names.has(nm)) continue;
  const v = edges[e * EF + eTo] / NF; const t = nodeTypes[nodes[v * NF + oType]];
  if (t !== "object" && t !== "array" && t !== "native" && t !== "closure") continue;
  if (!targets.has(nm)) targets.set(nm, new Set()); targets.get(nm).add(v);
}
const mb = (b) => (b / 1048576).toFixed(2) + " MB";
console.log(file + " — reachable heap " + mb(all));
for (const nm of names) {
  const set = targets.get(nm) || new Set(); let total = 0; const each = [];
  for (const v of set) { const kept = all - reach(v); total += kept; each.push(kept); }
  each.sort((a, b) => b - a);
  console.log("  " + nm.padEnd(26) + String(set.size).padStart(4) + " objects   holds " + mb(total).padStart(11) + (each.length ? "   largest " + mb(each[0]) : "") + (EACH ? "   each: " + each.slice(0, 20).map((x) => (x / 1048576).toFixed(1)).join(" ") : ""));
}
