import { daily, findFlags, UNIVERSE, RULES } from "./bull-flag.mjs";
const all = {}; for (const s of UNIVERSE) { try { all[s] = await daily(s); } catch {} }
const median=(a)=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null;};
const CUT = Date.UTC(2015, 0, 1);
for (const gain of [0.10, 0.15]) {
  const R = { ...RULES, pole_min_gain: gain, flag_max_giveback: 0.5, flag_must_tighten: true };
  for (const h of [20, 60]) {
    const half = { early: [], late: [] }, baseHalf = { early: [], late: [] };
    for (const s of Object.keys(all)) {
      for (const f of findFlags(all[s], R)) if (f.i + h < all[s].length)
        half[all[s][f.i].t < CUT ? "early" : "late"].push((all[s][f.i+h].c/all[s][f.i].c-1)*100);
      for (let i = 0; i + h < all[s].length; i++)
        baseHalf[all[s][i].t < CUT ? "early" : "late"].push((all[s][i+h].c/all[s][i].c-1)*100);
    }
    const f = (a) => a.length ? `${a.length} signals, ${(a.filter(x=>x>0).length/a.length*100).toFixed(1)}% up, median ${median(a).toFixed(2)}%` : "none";
    const b = (a) => `${(a.filter(x=>x>0).length/a.length*100).toFixed(1)}% / ${median(a).toFixed(2)}%`;
    console.log(`pole ${(gain*100).toFixed(0)}% · ${h}d  2003-2014: ${f(half.early)}   [any day ${b(baseHalf.early)}]`);
    console.log(`pole ${(gain*100).toFixed(0)}% · ${h}d  2015-2026: ${f(half.late)}   [any day ${b(baseHalf.late)}]`);
  }
}
