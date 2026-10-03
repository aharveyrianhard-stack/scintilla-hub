// A4 (3 Oct 2026) · our price-target consensus before → after quarantine, against FMP's own (public.price_target_consensus).
// "Our consensus" = A3's method on the Hub (index.html ptcFirmSet): each firm's newest target dated in the 183 days before FMP's
// update stamp, weekly-roundup headlines left out; mean, median, low, high over those firms.
//   before = every row, FMP's adj_target (what A3's branch did)    after = rows not quarantined, adj_target_checked
// Agreement: |ours − FMP| ≤ 1% of FMP on the mean (and, for "all four", on the median, low and high too).
// Usage: node compare.mjs <classified.json> <ptc.json> <out.json>
import { readFileSync, writeFileSync } from "node:fs";
const [cls, ptcPath, outPath] = process.argv.slice(2);
const rows = JSON.parse(readFileSync(cls, "utf8")).filter((r) => r.kind === "TARGET");
const ptc = JSON.parse(readFileSync(ptcPath, "utf8"));
const DAY = 86400e3, DAYS = 183, TOL = 0.01;
const ROUNDUP = /top \d+ stock calls|wall street'?s top|stock calls this week/i;   // index.html REV_ROUNDUP
const fk = (f) => String(f || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");   // index.html revFirmKey
const num = (v) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const byT = new Map();
for (const r of rows) (byT.get(r.ticker) || byT.set(r.ticker, []).get(r.ticker)).push(r);

function firmSet(list, anchor, clean) {
  const since = anchor - DAYS * DAY, by = new Map();
  for (const r of list) {
    if (ROUNDUP.test(r.title || "")) continue;
    if (clean && r.quality === "quarantine") continue;
    const ms = new Date(r.published_utc).getTime();
    if (!(ms > since && ms <= anchor)) continue;
    const v = clean ? (num(r.adj_target_checked) ?? num(r.adj_target) ?? num(r.target)) : (num(r.adj_target) ?? num(r.target));
    if (v == null || v <= 0) continue;
    const k = fk(r.firm); if (!k) continue;
    const o = by.get(k); if (!o || o.ms < ms) by.set(k, { ms, v, r });
  }
  const vs = [...by.values()].map((x) => x.v).sort((a, b) => a - b), n = vs.length;
  if (!n) return { n: 0, by };
  return { n, by, mean: vs.reduce((a, v) => a + v, 0) / n, med: n % 2 ? vs[(n - 1) / 2] : (vs[n / 2 - 1] + vs[n / 2]) / 2, lo: vs[0], hi: vs[n - 1] };
}
const close = (a, b) => a != null && b != null && b !== 0 && Math.abs(a - b) / Math.abs(b) <= TOL;
const out = [];
for (const p of ptc) {
  const list = byT.get(p.ticker); if (!list) continue;
  const f = { mean: num(p.target_avg), med: num(p.target_median), lo: num(p.target_low), hi: num(p.target_high) };
  if (f.mean == null) continue;
  const u = num(p.updated_ts), anchor = u > 1e12 ? u : u * 1000;
  const b = firmSet(list, anchor, false), a = firmSet(list, anchor, true);
  const why = [];
  for (const [k, x] of b.by) {
    const y = a.by.get(k);
    if (!y) why.push({ firm: x.r.firm, was: x.v, now: null, cause: x.r.quality_reason });
    else if (Math.abs(y.v - x.v) > 1e-6) why.push({ firm: x.r.firm, was: x.v, now: y.v, cause: x.r.quality === "quarantine" ? x.r.quality_reason : (y.r.quality_reason || "").split(";").find((s) => s.startsWith("split_mismatch")) || "older note" });
  }
  for (const [k, y] of a.by) if (!b.by.has(k)) why.push({ firm: y.r.firm, was: null, now: y.v, cause: "kept note (a quarantined roundup had hidden it)" });
  const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
  out.push({ ticker: p.ticker, fmp: f, anchor: new Date(anchor).toISOString(),
    before: { n: b.n, mean: r2(b.mean), med: r2(b.med), lo: r2(b.lo), hi: r2(b.hi) },
    after: { n: a.n, mean: r2(a.mean), med: r2(a.med), lo: r2(a.lo), hi: r2(a.hi) },
    agree_before: close(b.mean, f.mean), agree_after: close(a.mean, f.mean),
    all4_before: ["mean", "med", "lo", "hi"].every((k) => close(b[k], f[k])), all4_after: ["mean", "med", "lo", "hi"].every((k) => close(a[k], f[k])),
    gap_after_pct: a.mean != null ? r2((a.mean / f.mean - 1) * 100) : null, why });
}
const s = (k) => out.filter((x) => x[k]).length;
const summary = { tickers: out.length, tolerance: "1% of FMP", mean_agree_before: s("agree_before"), mean_agree_after: s("agree_after"),
  all4_agree_before: s("all4_before"), all4_agree_after: s("all4_after"), changed_by_quarantine: out.filter((x) => x.why.length).length };
writeFileSync(outPath, JSON.stringify({ summary, rows: out }, null, 1));
console.log(JSON.stringify(summary));
for (const t of ["AMZN", "NVDA", "MU"]) { const x = out.find((y) => y.ticker === t); console.log(t, JSON.stringify({ fmp: x.fmp, before: x.before, after: x.after, why: x.why })); }
