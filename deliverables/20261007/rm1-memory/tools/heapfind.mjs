#!/usr/bin/env node
// RM1 — list the biggest objects of one class in a heap snapshot, each with the chain that holds it.
//   node heapfind.mjs <file.heapsnapshot> <class-regex> [--n 12]
import fs from "node:fs";
const [file, pattern] = process.argv.slice(2);
const N = Number((process.argv.indexOf("--n") !== -1 && process.argv[process.argv.indexOf("--n") + 1]) || 12);
const re = new RegExp(pattern);
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
const iEdges = buf.indexOf('"edges":[', nodesP.end);
const edgesP = parseInts(buf, iEdges + 9), edges = edgesP.values;
const iStrings = buf.indexOf('"strings":[', edgesP.end);
let tail = buf.subarray(iStrings + 10).toString("utf8"); tail = tail.slice(0, tail.lastIndexOf("]") + 1);
const strings = JSON.parse(tail);
const nf = meta.node_fields, NF = nf.length, ef = meta.edge_fields, EF = ef.length;
const oType = nf.indexOf("type"), oName = nf.indexOf("name"), oSelf = nf.indexOf("self_size"), oEdges = nf.indexOf("edge_count");
const nodeTypes = meta.node_types[oType], edgeTypes = meta.edge_types[ef.indexOf("type")];
const eType = ef.indexOf("type"), eName = ef.indexOf("name_or_index"), eTo = ef.indexOf("to_node");
const Nn = nodes.length / NF;
const label = (i) => { const t = nodeTypes[nodes[i * NF + oType]], n = strings[nodes[i * NF + oName]]; return t === "closure" ? "closure " + n : t === "object" || t === "native" ? n : "(" + t + ") " + String(n).slice(0, 50); };
const firstEdge = new Uint32Array(Nn + 1);
for (let i = 0, e = 0; i < Nn; i++) { firstEdge[i] = e; e += nodes[i * NF + oEdges]; if (i === Nn - 1) firstEdge[Nn] = e; }
const parent = new Int32Array(Nn).fill(-1), parentEdge = new Int32Array(Nn).fill(-1), seen = new Uint8Array(Nn);
const queue = new Uint32Array(Nn); let qh = 0, qt = 0; queue[qt++] = 0; seen[0] = 1;
while (qh < qt) {
  const u = queue[qh++];
  for (let e = firstEdge[u]; e < firstEdge[u + 1]; e++) {
    const et = edgeTypes[edges[e * EF + eType]]; if (et === "weak" || et === "shortcut") continue;
    const v = edges[e * EF + eTo] / NF; if (seen[v]) continue;
    seen[v] = 1; parent[v] = u; parentEdge[v] = e; queue[qt++] = v;
  }
}
const edgeLabel = (e) => { const et = edgeTypes[edges[e * EF + eType]], ni = edges[e * EF + eName]; return et === "element" || et === "hidden" ? "[" + ni + "]" : (et === "context" ? "{ctx}." : et === "internal" ? "<" : ".") + String(strings[ni]).slice(0, 48) + (et === "internal" ? ">" : ""); };
const hits = [];
let total = 0, count = 0;
for (let i = 0; i < Nn; i++) if (re.test(label(i))) { const s = nodes[i * NF + oSelf]; hits.push([s, i]); total += s; count++; }
hits.sort((a, b) => b[0] - a[0]);
console.log(count + " objects matching /" + pattern + "/, " + (total / 1048576).toFixed(2) + " MB in all");
for (const [size, i] of hits.slice(0, N)) {
  const parts = []; let cur = i, guard = 0;
  while (cur > 0 && parent[cur] !== -1 && guard++ < 40) { parts.push(edgeLabel(parentEdge[cur]) + " → " + label(cur).slice(0, 44)); cur = parent[cur]; }
  console.log("\n" + (size / 1048576).toFixed(2) + " MB  " + label(i) + (seen[i] ? "" : "  (unreachable)"));
  console.log("   " + parts.reverse().join("  ").slice(0, 1100));
}
