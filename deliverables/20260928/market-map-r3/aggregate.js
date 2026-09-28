/* MARKET-MAP r3 · the holdings aggregate — one small module the page and the tests both import, so the maths on the screen
   is the maths the tests check.

   holdingsAggregate(fund, geigerOf)
     fund.holdings.served_weights = [[ticker, weight_pct], …]  (every holding the Hub serves, from the FMP holdings file)
     fund.holdings.total_weight_pct                           (every row of the fund's file, cash included)
     geigerOf(ticker) → the live composite (−1…+1) or null when the Geiger has no reading for it
   returns
     value            the weight-blended Geiger of the holdings that have a reading: Σ w·g / Σ w over those holdings only
                      (their weights are re-scaled to add to 100% — nothing is filled in for the rest)
     count            how many holdings went in
     weight_pct       their weight in the fund
     coverage_pct     that weight as a share of the whole fund (weight_pct / total_weight_pct × 100)
     not_read         served holdings the Geiger had no reading for (listed, never guessed)
   or null when no holding has a reading.

   divergence(fundG, aggG) → { diff, text } — diff = aggregate − fund. Positive: the holdings read stronger than the fund. */
export function holdingsAggregate(fund, geigerOf) {
  const h = fund && fund.holdings;
  if (!h || !Array.isArray(h.served_weights) || !(h.total_weight_pct > 0)) return null;
  let sw = 0, swg = 0, count = 0;
  const notRead = [];
  for (const [t, w] of h.served_weights) {
    const g = geigerOf(t);
    if (!(w > 0)) continue;
    if (g == null || !Number.isFinite(g)) { notRead.push(t); continue; }
    sw += w; swg += w * g; count++;
  }
  if (!count) return null;
  return { value: swg / sw, count, weight_pct: sw, coverage_pct: (100 * sw) / h.total_weight_pct, not_read: notRead };
}

export function divergence(fundG, aggG) {
  if (fundG == null || aggG == null || !Number.isFinite(fundG) || !Number.isFinite(aggG)) return null;
  const diff = aggG - fundG, a = Math.abs(diff).toFixed(2);
  if (a === "0.00") return { diff, text: "fund and holdings read the same" };
  return { diff, text: diff > 0 ? `holdings stronger than the fund by ${a}` : `holdings weaker than the fund by ${a}` };
}
