/* ER1 (6 Oct 2026) · "estimate vs guidance" flag — one mechanical rule, no judgement inside.
   Inputs per name (all from data we already hold: FMP annual + quarter estimates, FMP income statements, FMP earnings calendar,
   the company's own next-quarter EPS guide read from its call or press release, and the Hub's daily snapshot table).
   Output: a list of flags and a clean growth base, so the ESTIMATES tab, the comps growth credit and the DCF can read it. */
export const RULE = {
  oneOffShareOfPretax: 0.25,   // a reported quarter where other (non-operating) income is more than 25% of pre-tax profit carries a one-off
  oneOffShareOfYear: 0.15,     // ... and the after-tax one-offs are at least 15% of the year's consensus EPS → the year is INFLATED
  guideBand: 0.05,             // next-quarter consensus within ±5% of the company's guided midpoint = IN LINE
  thinAnalysts: 10,            // fewer than 10 analysts on a year → THIN (no growth credit from that year)
  wideRange: 0.40,             // (high − low) / average above 40% → WIDE (growth credit halved)
  staleDays: 3,                // no Hub snapshot in the last 3 New York days → STALE
  basisBand: 0.10              // street actual within 10% of GAAP diluted → the consensus is on a GAAP basis
};
const pct = (a, b) => (b ? (a / b - 1) : null);
export function flagName(x, rule = RULE) {
  // x: { fy0: {eps,n,low,high}, fy1: {eps,n,low,high}, quarters: [{other_inc_b, pretax_b, tax_b, ni_b, eps_dil, in_fy0}],
  //      guide: {eps|null, pm}, nextQuarterConsensus: number|null, snapshotDays: number|null, snapshotKeyChanged: bool }
  const flags = [];
  // 0 · on which basis is the consensus kept? If the street "actual" EPS of the reported quarters is within 10% of GAAP diluted EPS,
  //     the consensus follows GAAP (Alphabet, Amazon) and one-off gains sit inside it. If the street number is far below GAAP, the
  //     consensus is non-GAAP (Western Digital after the SanDisk gains) and the gains are already outside it.
  let street = 0, gaap = 0;
  for (const q of x.quarters || []) if (q.in_fy0 && q.street_eps != null && q.eps_dil != null) { street += q.street_eps; gaap += q.eps_dil; }
  const basis = gaap ? (Math.abs(street / gaap - 1) < rule.basisBand ? "GAAP" : "NON-GAAP") : "UNKNOWN";
  // 1 · one-offs inside the current year (only when the consensus is on a GAAP basis)
  let oneOffPerShare = 0, gaapOneOffPerShare = 0;
  for (const q of x.quarters || []) {
    if (!q.in_fy0 || !q.pretax_b) continue;
    const share = q.other_inc_b / q.pretax_b;
    if (share > rule.oneOffShareOfPretax && q.ni_b && q.eps_dil) {
      const taxRate = q.tax_b / q.pretax_b;                 // the quarter's own effective rate
      const shares = q.ni_b / q.eps_dil;                     // diluted shares, billions
      gaapOneOffPerShare += (q.other_inc_b * (1 - taxRate)) / shares;
    }
  }
  if (basis === "GAAP") oneOffPerShare = gaapOneOffPerShare;
  else if (gaapOneOffPerShare > 0) flags.push({ code: "GAAP-GAIN-OUTSIDE", text: `GAAP carries about ${gaapOneOffPerShare.toFixed(2)} a share of one-off gains; the consensus is non-GAAP and leaves them out` });
  const fy0 = x.fy0 && x.fy0.eps, fy1 = x.fy1 && x.fy1.eps;
  const cleanFy0 = fy0 != null ? fy0 - oneOffPerShare : null;
  const inflated = fy0 != null && oneOffPerShare / fy0 >= rule.oneOffShareOfYear;
  if (inflated) flags.push({ code: "ONE-OFF", text: `current-year EPS ${fy0.toFixed(2)} carries about ${oneOffPerShare.toFixed(2)} a share of one-off gains; clean base ${cleanFy0.toFixed(2)}` });
  // 2 · next-quarter consensus against the company's own guide
  let guideVerdict = "NO EPS GUIDE";
  if (x.guide && x.guide.eps != null && x.nextQuarterConsensus != null) {
    const gap = pct(x.nextQuarterConsensus, x.guide.eps);
    guideVerdict = Math.abs(gap) <= rule.guideBand ? "IN LINE" : gap > 0 ? "ABOVE GUIDE" : "BELOW GUIDE";
    if (guideVerdict !== "IN LINE") flags.push({ code: guideVerdict.replace(" ", "-"), text: `next-quarter consensus ${x.nextQuarterConsensus} is ${(gap * 100).toFixed(1)}% ${gap > 0 ? "above" : "below"} the guided ${x.guide.eps}` });
  } else flags.push({ code: "NO-EPS-GUIDE", text: "the company gives no EPS number; the consensus cannot be checked against one" });
  // 3 · thin or wide next-year consensus
  if (x.fy1) {
    if (x.fy1.n != null && x.fy1.n < rule.thinAnalysts) flags.push({ code: "THIN", text: `only ${x.fy1.n} analysts on next year` });
    const range = (x.fy1.high - x.fy1.low) / x.fy1.eps;
    if (range > rule.wideRange) flags.push({ code: "WIDE", text: `next-year range ${x.fy1.low}–${x.fy1.high} is ${(range * 100).toFixed(0)}% of the average` });
  }
  // 4 · the Hub's own copy
  if (x.snapshotKeyChanged) flags.push({ code: "KEY-CHANGED", text: "the fiscal-year date key changed after the report; the revision strip cannot join old and new copies" });
  if (x.snapshotDays != null && x.snapshotDays > rule.staleDays) flags.push({ code: "STALE", text: `last Hub snapshot ${x.snapshotDays} days old` });
  const growthShown = fy0 != null && fy1 != null ? pct(fy1, fy0) : null;
  const growthClean = cleanFy0 && fy1 != null ? pct(fy1, cleanFy0) : null;
  return { flags, basis, guideVerdict, oneOffPerShare: +oneOffPerShare.toFixed(2), cleanFy0: cleanFy0 == null ? null : +cleanFy0.toFixed(2), growthShown, growthClean,
           chip: flags.length ? flags.map(f => f.code).join(" · ") : "CONSISTENT" };
}
export function cagr(a, b, years) { return a > 0 && b > 0 && years > 0 ? Math.pow(b / a, 1 / years) - 1 : null; }
