#!/usr/bin/env node
// RM1 — compare two V8 heap snapshots of the same page session (start, end) and name what grew.
//   node heapdiff.mjs start.heapsnapshot end.heapsnapshot [--paths 3] [--top 30] [--json out.json]
// Objects are matched by V8's object id, which is stable inside one session and only ever rises,
// so "new" = alive at the end with an id the start snapshot had not handed out yet.
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf("--" + n); return i === -1 ? d : args[i + 1]; };
const [startFile, endFile] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const TOP = Number(flag("top", 30)), PATHS = Number(flag("paths", 3)), JSON_OUT = flag("json", null);

function parseInts(buf, from) {
  // buf[from] is the first byte after '['; returns { values, end } with end at the closing ']'
  let cap = 1 << 20, out = new Float64Array(cap), n = 0, cur = 0, has = false, i = from;
  for (; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 48 && c <= 57) { cur = cur * 10 + (c - 48); has = true; }
    else {
      if (has) { if (n === cap) { cap *= 2; const g = new Float64Array(cap); g.set(out); out = g; } out[n++] = cur; cur = 0; has = false; }
      if (c === 93) break;
    }
  }
  return { values: out.subarray(0, n), end: i };
}

function load(file) {
  const buf = fs.readFileSync(file);
  const iNodes = buf.indexOf('"nodes":[');
  const header = JSON.parse(buf.subarray(0, iNodes).toString("utf8").replace(/,\s*$/, "") + "}");
  const meta = header.snapshot.meta;
  const nodes = parseInts(buf, iNodes + 9);
  const iEdges = buf.indexOf('"edges":[', nodes.end);
  const edges = parseInts(buf, iEdges + 9);
  const iStrings = buf.indexOf('"strings":[', edges.end);
  let tail = buf.subarray(iStrings + 10).toString("utf8");
  tail = tail.slice(0, tail.lastIndexOf("]") + 1);
  const strings = JSON.parse(tail);
  return { meta, nodes: nodes.values, edges: edges.values, strings, nodeCount: header.snapshot.node_count };
}

function view(snap) {
  const nf = snap.meta.node_fields, NF = nf.length;
  const oType = nf.indexOf("type"), oName = nf.indexOf("name"), oId = nf.indexOf("id"), oSelf = nf.indexOf("self_size"),
    oEdges = nf.indexOf("edge_count"), oDet = nf.indexOf("detachedness");
  const nodeTypes = snap.meta.node_types[oType];
  const ef = snap.meta.edge_fields, EF = ef.length;
  const eType = ef.indexOf("type"), eName = ef.indexOf("name_or_index"), eTo = ef.indexOf("to_node");
  const edgeTypes = snap.meta.edge_types[eType];
  const N = snap.nodes.length / NF;
  const className = (i) => {
    const t = nodeTypes[snap.nodes[i * NF + oType]], name = snap.strings[snap.nodes[i * NF + oName]];
    const det = oDet >= 0 && snap.nodes[i * NF + oDet] === 2 ? "Detached " : "";
    switch (t) {
      case "object": return det + (name || "(object)");
      case "native": return det + (name || "(native)");
      case "closure": return "(closure)";
      case "string": case "concatenated string": case "sliced string": return "(string)";
      case "array": return "(array) " + (name || "");
      case "code": return "(compiled code)";
      case "hidden": return "(system) " + (name || "").split(" ")[0];
      case "object shape": return "(object shape)";
      case "number": return "(number)";
      case "regexp": return "(regexp)";
      case "synthetic": return "(synthetic) " + name;
      default: return "(" + t + ")";
    }
  };
  return { NF, EF, N, oType, oName, oId, oSelf, oEdges, eType, eName, eTo, nodeTypes, edgeTypes, className,
    id: (i) => snap.nodes[i * NF + oId], self: (i) => snap.nodes[i * NF + oSelf], name: (i) => snap.strings[snap.nodes[i * NF + oName]],
    type: (i) => nodeTypes[snap.nodes[i * NF + oType]] };
}

const mb = (b) => (b / 1048576).toFixed(2) + " MB";
const t0 = Date.now();
const A = load(startFile), B = load(endFile);
const va = view(A), vb = view(B);

let maxStartId = 0, totalA = 0, totalB = 0;
const startIds = new Set();
const aggA = new Map(), aggB = new Map(), aggNew = new Map();
for (let i = 0; i < va.N; i++) {
  const id = va.id(i); startIds.add(id); if (id > maxStartId) maxStartId = id;
  const k = va.className(i), s = va.self(i); totalA += s;
  const e = aggA.get(k) || { n: 0, size: 0 }; e.n++; e.size += s; aggA.set(k, e);
}
const newNodes = [];
let newSize = 0, survivors = 0;
for (let i = 0; i < vb.N; i++) {
  const k = vb.className(i), s = vb.self(i); totalB += s;
  const e = aggB.get(k) || { n: 0, size: 0 }; e.n++; e.size += s; aggB.set(k, e);
  if (!startIds.has(vb.id(i))) {
    newSize += s; newNodes.push(i);
    const g = aggNew.get(k) || { n: 0, size: 0, sample: [] }; g.n++; g.size += s; if (g.sample.length < 400) g.sample.push(i); aggNew.set(k, g);
  } else survivors++;
}

const rows = [];
for (const k of new Set([...aggA.keys(), ...aggB.keys()])) {
  const a = aggA.get(k) || { n: 0, size: 0 }, b = aggB.get(k) || { n: 0, size: 0 }, g = aggNew.get(k) || { n: 0, size: 0 };
  rows.push({ cls: k, nStart: a.n, nEnd: b.n, dN: b.n - a.n, sizeStart: a.size, sizeEnd: b.size, dSize: b.size - a.size, newN: g.n, newSize: g.size });
}
console.log("start:", startFile, "nodes", va.N, "self", mb(totalA));
console.log("end:  ", endFile, "nodes", vb.N, "self", mb(totalB));
console.log("net growth:", mb(totalB - totalA), "| objects alive at end that did not exist at start:", newNodes.length, mb(newSize), "| survivors from start:", survivors);

const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
const table = (title, list) => {
  console.log("\n" + title);
  console.log(pad("class", 46), lpad("count start", 12), lpad("count end", 11), lpad("Δcount", 9), lpad("Δsize", 12), lpad("new count", 10), lpad("new size", 12));
  for (const r of list) console.log(pad(r.cls.slice(0, 45), 46), lpad(r.nStart, 12), lpad(r.nEnd, 11), lpad((r.dN > 0 ? "+" : "") + r.dN, 9), lpad(mb(r.dSize), 12), lpad(r.newN, 10), lpad(mb(r.newSize), 12));
};
table("BIGGEST AT THE END", [...rows].sort((a, b) => b.sizeEnd - a.sizeEnd).slice(0, Math.min(TOP, 16)).map((r) => ({ ...r, dSize: r.sizeEnd })).map((r) => (r.cls += "  [size at end →]", r)));
table("TOP BY NET SIZE GROWTH", [...rows].sort((a, b) => b.dSize - a.dSize).slice(0, TOP));
table("TOP BY NET COUNT GROWTH", [...rows].sort((a, b) => b.dN - a.dN).slice(0, TOP));

// ---- who holds the new objects: shortest path from the GC roots ----------------------------
if (PATHS > 0) {
  const { NF, EF, N } = vb;
  const firstEdge = new Uint32Array(N + 1);
  for (let i = 0, e = 0; i < N; i++) { firstEdge[i] = e; e += B.nodes[i * NF + vb.oEdges]; if (i === N - 1) firstEdge[N] = e; }
  const parent = new Int32Array(N).fill(-1), parentEdge = new Int32Array(N).fill(-1), dist = new Int32Array(N).fill(-1);
  const queue = new Uint32Array(N); let qh = 0, qt = 0;
  queue[qt++] = 0; dist[0] = 0;
  while (qh < qt) {
    const u = queue[qh++];
    for (let e = firstEdge[u]; e < firstEdge[u + 1]; e++) {
      const et = vb.edgeTypes[B.edges[e * EF + vb.eType]];
      if (et === "weak" || et === "shortcut") continue;
      const v = B.edges[e * EF + vb.eTo] / NF;
      if (dist[v] !== -1) continue;
      dist[v] = dist[u] + 1; parent[v] = u; parentEdge[v] = e; queue[qt++] = v;
    }
  }
  const edgeLabel = (e) => {
    const et = vb.edgeTypes[B.edges[e * EF + vb.eType]], ni = B.edges[e * EF + vb.eName];
    return et === "element" || et === "hidden" ? "[" + ni + "]" : (et === "context" ? "{ctx}." : et === "internal" ? "<" : ".") + String(B.strings[ni]).slice(0, 40) + (et === "internal" ? ">" : "");
  };
  const pathOf = (i) => {
    const parts = []; let cur = i, guard = 0;
    while (cur > 0 && parent[cur] !== -1 && guard++ < 60) { parts.push(edgeLabel(parentEdge[cur]) + " → " + vb.className(cur).slice(0, 40) + (vb.type(cur) === "closure" ? " " + vb.name(cur) : "")); cur = parent[cur]; }
    return parts.reverse();
  };
  console.log("\nWHO HOLDS THE NEW OBJECTS (shortest path from the roots; most common path per class)");
  const interesting = [...aggNew.entries()].filter(([k]) => !/^\(system\)|^\(compiled code\)|^\(object shape\)|^\(synthetic\)/.test(k))
    .sort((a, b) => b[1].size - a[1].size).slice(0, Math.min(TOP, 18));
  for (const [cls, g] of interesting) {
    const shapes = new Map();
    for (const i of g.sample) {
      if (dist[i] === -1) { shapes.set("(unreachable from roots — pending collection)", (shapes.get("(unreachable from roots — pending collection)") || 0) + 1); continue; }
      const key = pathOf(i).map((p) => p.replace(/\[\d+\]/g, "[n]")).join("  ");
      shapes.set(key, (shapes.get(key) || 0) + 1);
    }
    console.log("\n■ " + cls + " — " + g.n + " new, " + mb(g.size));
    for (const [shape, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, PATHS)) console.log("   " + n + "/" + g.sample.length + " sampled: " + shape.slice(0, 900));
  }
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ start: { nodes: va.N, self: totalA }, end: { nodes: vb.N, self: totalB }, newObjects: newNodes.length, newSize,
  bySize: [...rows].sort((a, b) => b.dSize - a.dSize).slice(0, 60), byCount: [...rows].sort((a, b) => b.dN - a.dN).slice(0, 60) }, null, 1));
console.error("(" + ((Date.now() - t0) / 1000).toFixed(1) + "s)");
