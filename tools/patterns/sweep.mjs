import { daily, findFlags, UNIVERSE, RULES } from "./bull-flag.mjs";
const all = {};
for (const s of UNIVERSE) { try { all[s] = await daily(s); } catch {} }
const median = (a) => { const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null; };
const base = {};
for (const h of [20, 60]) { const m=[]; for (const s of Object.keys(all)) for (let i=0;i+h<all[s].length;i++) m.push((all[s][i+h].c/all[s][i].c-1)*100);
  base[h] = { up: (m.filter(x=>x>0).length/m.length*100).toFixed(1), med: median(m).toFixed(2) }; }
console.log("any day  20d:", base[20], " 60d:", base[60]);
console.log("gain  give  tight |   n  | 20d up%  med%  | 60d up%  med%");
for (const gain of [0.06, 0.08, 0.10, 0.15]) for (const give of [0.4, 0.5, 0.62]) for (const tight of [true, false]) {
  const R = { ...RULES, pole_min_gain: gain, flag_max_giveback: give, flag_must_tighten: tight };
  const rows = { 20: [], 60: [] }; let n = 0;
  for (const s of Object.keys(all)) { const f = findFlags(all[s], R); n += f.length;
    for (const h of [20, 60]) for (const x of f) if (x.i + h < all[s].length) rows[h].push((all[s][x.i+h].c/all[s][x.i].c-1)*100); }
  const fmt = (h) => rows[h].length ? `${(rows[h].filter(x=>x>0).length/rows[h].length*100).toFixed(1).padStart(5)}  ${median(rows[h]).toFixed(2).padStart(6)}` : "   —       —";
  console.log(`${(gain*100).toFixed(0).padStart(4)}% ${(give*100).toFixed(0).padStart(4)}% ${String(tight).padStart(5)} | ${String(n).padStart(4)} | ${fmt(20)}  | ${fmt(60)}`);
}
