#!/usr/bin/env node
// RM1 — read a sampling heap profile taken over the soak and list the code lines whose
// allocations were STILL ALIVE at the end (collected objects are not in the profile).
//   node allocsites.mjs sampling-profile.json [--top 25]
import fs from "node:fs";
const file = process.argv[2];
const TOP = Number((process.argv.indexOf("--top") !== -1 && process.argv[process.argv.indexOf("--top") + 1]) || 25);
const prof = JSON.parse(fs.readFileSync(file, "utf8"));

const short = (cf) => {
  let u = cf.url || "";
  try { u = new URL(u).pathname; } catch (_) {}
  return (cf.functionName || "(anonymous)") + " @ " + (u || "(native)") + ":" + (cf.lineNumber + 1) + ":" + (cf.columnNumber + 1);
};
const isUser = (cf) => !!cf.url && !/instrument\.js|^extensions::|^node:|playwright/.test(cf.url);

let total = 0;
const byLeaf = new Map(), byUser = new Map(), byScript = new Map();
const walk = (node, stack) => {
  const here = stack.concat([node.callFrame]);
  if (node.selfSize > 0) {
    total += node.selfSize;
    const leaf = short(node.callFrame);
    const l = byLeaf.get(leaf) || { size: 0, stack: null }; l.size += node.selfSize;
    if (!l.stack) l.stack = here.slice(-7).reverse().map(short); byLeaf.set(leaf, l);
    // nearest frame that is the page's own code
    let user = null;
    for (let i = here.length - 1; i >= 0; i--) if (isUser(here[i])) { user = here[i]; break; }
    const key = user ? short(user) : "(no page frame — browser internals)";
    const g = byUser.get(key) || { size: 0, stack: null }; g.size += node.selfSize;
    if (!g.stack) g.stack = here.filter(isUser).slice(-6).reverse().map(short); byUser.set(key, g);
    let script = "(native)";
    if (user) { try { script = new URL(user.url).pathname; } catch (_) { script = user.url; } }
    byScript.set(script, (byScript.get(script) || 0) + node.selfSize);
  }
  for (const c of node.children || []) walk(c, here);
};
walk(prof.head, []);

const mb = (b) => (b / 1048576).toFixed(2) + " MB";
console.log("live allocations made during the soak (sampled):", mb(total));
console.log("\nBY FILE");
for (const [k, v] of [...byScript.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log("  " + mb(v).padStart(10) + "  " + k);
console.log("\nBY PAGE CODE LINE (nearest page frame to the allocation)");
for (const [k, v] of [...byUser.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, TOP)) {
  console.log("  " + mb(v.size).padStart(10) + "  " + k);
  if (v.stack && v.stack.length > 1) console.log("              called from: " + v.stack.slice(1, 5).join("  ←  "));
}
console.log("\nBY EXACT ALLOCATING FUNCTION");
for (const [k, v] of [...byLeaf.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 12)) console.log("  " + mb(v.size).padStart(10) + "  " + k);
