/* V1 — counts the distinct values per role across a walk's measurements.  node count.mjs measure-before-1680.json [--detail] */
import fs from "node:fs";
const file = process.argv[2], detail = process.argv.includes("--detail");
const d = JSON.parse(fs.readFileSync(file, "utf8"));
const byRole = {}, panels = new Map(), dividers = new Map(), buttons = new Map(), tabs = new Map();
for (const r of d.results) {
  for (const t of r.text) {
    const k = `${t.fs}px / ${t.fw} / ${t.ls}`;
    const m = (byRole[t.role] ||= new Map()); const e = m.get(k) || { n: 0, where: new Map() }; e.n++;
    const w = e.where.get(t.sel) || { n: 0, surf: new Set(), eg: t.txt }; w.n++; w.surf.add(r.surface); e.where.set(t.sel, w); m.set(k, e);
    if (t.role === "tab") { const kk = k + " / " + t.tt; const x = tabs.get(kk) || { n: 0, sels: new Set() }; x.n++; x.sels.add(t.sel); tabs.set(kk, x); }
  }
  for (const p of r.panels) { const k = `bg ${p.bg} · border ${p.border} · radius ${p.radius} · shadow ${p.shadow}`; const e = panels.get(k) || { n: 0, sels: new Set() }; e.n++; e.sels.add(p.sel); panels.set(k, e); }
  for (const p of r.dividers) { const e = dividers.get(p.line) || { n: 0, sels: new Set() }; e.n++; e.sels.add(p.sel); dividers.set(p.line, e); }
  for (const b of r.buttons) { const k = `${b.fs}px / ${b.fw} / ${b.ls} · border ${b.border} · radius ${b.radius} · bg ${b.bg}`; const e = buttons.get(k) || { n: 0, sels: new Set() }; e.n++; e.sels.add(b.sel); buttons.set(k, e); }
}
const summary = { file, width: d.width, surfaces: d.results.map((r) => r.surface), roles: {}, panels: panels.size, dividers: dividers.size, buttons: buttons.size, tabStyles: tabs.size };
for (const [role, m] of Object.entries(byRole)) summary.roles[role] = m.size;
console.log(JSON.stringify(summary));
if (detail) {
  for (const [role, m] of Object.entries(byRole)) {
    console.log(`\n## ${role} — ${m.size} variants`);
    for (const [k, e] of [...m].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k}  ×${e.n}  ` + [...e.where].sort((a, b) => b[1].n - a[1].n).slice(0, 5).map(([s, w]) => `${s}(${w.n};${[...w.surf].slice(0,2).join(",")};"${w.eg.slice(0,18)}")`).join(" "));
  }
  console.log(`\n## panels — ${panels.size}`); for (const [k, e] of [...panels].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k} ×${e.n} ${[...e.sels].slice(0, 4).join(" ")}`);
  console.log(`\n## dividers — ${dividers.size}`); for (const [k, e] of [...dividers].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k} ×${e.n} ${[...e.sels].slice(0, 4).join(" ")}`);
  console.log(`\n## buttons — ${buttons.size}`); for (const [k, e] of [...buttons].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k} ×${e.n} ${[...e.sels].slice(0, 4).join(" ")}`);
  console.log(`\n## splits`); for (const r of d.results) if (r.split) console.log(`  ${r.surface} ${JSON.stringify(r.split)}`);
  console.log(`\n## master tabs`); console.log(JSON.stringify(d.results[0].mtabs));
}
