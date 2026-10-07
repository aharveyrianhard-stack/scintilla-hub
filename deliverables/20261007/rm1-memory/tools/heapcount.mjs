#!/usr/bin/env node
// RM1 — count the objects of given class names in a heap snapshot (exact name match), with their node types.
//   node heapcount.mjs <file.heapsnapshot> AudioContext,OscillatorNode,HTMLDocument
import fs from "node:fs";
const [file, namesArg] = process.argv.slice(2);
const names = new Set(String(namesArg).split(","));
const buf = fs.readFileSync(file);
const iNodes = buf.indexOf('"nodes":[');
const meta = JSON.parse(buf.subarray(0, iNodes).toString("utf8").replace(/,\s*$/, "") + "}").snapshot.meta;
let cap = 1 << 20, nodes = new Float64Array(cap), n = 0, cur = 0, has = false, i = iNodes + 9;
for (; i < buf.length; i++) { const c = buf[i]; if (c >= 48 && c <= 57) { cur = cur * 10 + (c - 48); has = true; } else { if (has) { if (n === cap) { cap *= 2; const g = new Float64Array(cap); g.set(nodes); nodes = g; } nodes[n++] = cur; cur = 0; has = false; } if (c === 93) break; } }
let tail = buf.subarray(buf.indexOf('"strings":[', i) + 10).toString("utf8"); tail = tail.slice(0, tail.lastIndexOf("]") + 1);
const strings = JSON.parse(tail);
const nf = meta.node_fields, NF = nf.length, oType = nf.indexOf("type"), oName = nf.indexOf("name"), oSelf = nf.indexOf("self_size"), types = meta.node_types[oType];
const out = {};
for (let k = 0; k < n; k += NF) { const name = strings[nodes[k + oName]]; if (!names.has(name)) continue; const key = name + " (" + types[nodes[k + oType]] + ")"; out[key] = out[key] || { count: 0, bytes: 0 }; out[key].count++; out[key].bytes += nodes[k + oSelf]; }
console.log(JSON.stringify(out));
