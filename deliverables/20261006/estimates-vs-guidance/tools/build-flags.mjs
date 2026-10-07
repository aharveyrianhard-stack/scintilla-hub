/* ER1 · reads data/estimates.json, applies flag-rule.mjs, writes data/flags.json. Usage: node tools/build-flags.mjs */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { flagName, cagr } from "./flag-rule.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)), D = path.join(here, "..", "data");
const E = JSON.parse(fs.readFileSync(path.join(D, "estimates.json"), "utf8")).names;
// which annual row is the "current year" (FY0) and the next (FY1), per name — calendar names: 2026/2027; July/Sept fiscal names: the year just reported is FY0
const FY0 = { GOOGL: "2026-12-31", AMZN: "2026-12-31", WDC: "2026-07-03", STX: "2026-07-03", MU: "2026-09-03", LRCX: "2026-06-28" };
const out = {};
for (const [t, b] of Object.entries(E)) {
  const rows = b.annual, i0 = rows.findIndex(r => r.fy === FY0[t]);
  const fy0 = rows[i0], fy1 = rows[i0 + 1], fy2 = rows[i0 + 2], fy3 = rows[i0 + 3], fy4 = rows[i0 + 4];
  const fy0Start = t === "GOOGL" || t === "AMZN" ? "2026-01-01" : t === "MU" ? "2025-09-01" : t === "LRCX" ? "2025-07-01" : "2025-07-05";
  const quarters = b.quarters.map(q => {
    // the street "actual" for that quarter = the FMP earnings row reported in the 6 weeks after the quarter end
    const rep = b.reported.find(r => r.date > q.date && (Date.parse(r.date) - Date.parse(q.date)) < 50 * 86400e3);
    return { ...q, street_eps: rep ? rep.eps_actual : null, in_fy0: q.date > fy0Start && q.date <= FY0[t] };
  });
  const snaps = b.snapshots[fy1 ? fy1.fy : ""] || [];
  const last = snaps.length ? snaps[snaps.length - 1].as_of : null;
  const snapshotDays = last ? Math.round((Date.UTC(2026, 9, 6) - Date.parse(last)) / 86400e3) : null;
  const keyChanged = Object.keys(b.snapshots).some(k => k !== fy1?.fy && k.slice(0, 4) === fy1?.fy.slice(0, 4));
  const r = flagName({ fy0, fy1, quarters, guide: { eps: b.guidance.eps_guide, pm: b.guidance.eps_guide_pm }, nextQuarterConsensus: b.next_report?.eps_est ?? null, snapshotDays, snapshotKeyChanged: keyChanged });
  // long-term growth: from the clean base of FY1 to the last year with at least 10 analysts
  const horizon = [fy1, fy2, fy3, fy4].filter(Boolean);
  const reliable = horizon.filter(r => r.n_eps >= 10);
  const lastRel = reliable[reliable.length - 1];
  const yrs = lastRel ? horizon.indexOf(lastRel) : 0;
  out[t] = { ...r, fy0: fy0.fy, fy0_eps: fy0.eps, fy1: fy1?.fy, fy1_eps: fy1?.eps, fy1_n: fy1?.n_eps, fy2_eps: fy2?.eps, fy2_n: fy2?.n_eps, fy3_eps: fy3?.eps, fy3_n: fy3?.n_eps, fy4_eps: fy4?.eps, fy4_n: fy4?.n_eps,
    cagr: lastRel && yrs > 0 ? { from: fy1.fy, to: lastRel.fy, years: yrs, eps: +cagr(fy1.eps, lastRel.eps, yrs).toFixed(4), rev: +cagr(fy1.rev_b, lastRel.rev_b, yrs).toFixed(4), n_from: fy1.n_eps, n_to: lastRel.n_eps } : null,
    snapshots: snaps, snapshotDays, keyChanged };
}
fs.writeFileSync(path.join(D, "flags.json"), JSON.stringify(out, null, 1));
for (const [t, r] of Object.entries(out)) console.log(t, r.basis, r.chip, "| oneOff", r.oneOffPerShare, "clean", r.cleanFy0, "| shown", r.growthShown?.toFixed(3), "clean", r.growthClean?.toFixed(3), "| cagr", r.cagr);
