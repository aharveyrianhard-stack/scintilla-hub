/* Scintilla · A1 analytics knockouts (2 Oct) · the first allocation read, stated once. Pure.
   Weights by group and by name under stated baselines; cash is the remainder. No advice, no trades: it is what the
   pipe says under Alan's toggles, and every toggle has an editable baseline.

   baselines:
     cash_pct        25   the part that stays in cash before anything else is read
     lead_weights    [3, 2, 1]  the heat's first, second and third group share the invested part in these proportions
     balance_weight  1    the oversold leg (the group the heat ranks most oversold) gets this weight beside them
     extended_at     90   a group whose stretch is at or above this percentile of its own history is EXTENDED
     extended_cut    0.5  an extended group's weight is multiplied by this (the rest goes to cash)
     thin_at         5    a group with fewer served names than this is THIN: it still gets a weight, and it is named
   groups: [{ id, label, role: "lead" | "balance", stretch, served, finalists: [tickers], passed: Set }] */

export const BASELINE = { cash_pct: 25, lead_weights: [3, 2, 1], balance_weight: 1, extended_at: 90, extended_cut: 0.5, thin_at: 5 };

export function allocate(groups, opts = {}) {
  const B = { ...BASELINE, ...opts };
  const invested = Math.max(0, Math.min(100, 100 - B.cash_pct));
  let li = 0;
  const raw = groups.map((g) => {
    const base = g.role === "balance" ? B.balance_weight : (B.lead_weights[li++] ?? 0);
    const extended = g.stretch != null && g.stretch >= B.extended_at;
    const thin = g.served != null && g.served < B.thin_at;
    return { ...g, base, extended, thin, weight_raw: base * (extended ? B.extended_cut : 1), full_raw: base };
  });
  const full = raw.reduce((s, g) => s + g.full_raw, 0);
  const out = raw.map((g) => {
    const pct = full > 0 ? (invested * g.weight_raw) / full : 0;
    const all = g.finalists || [], names = all.filter((t) => !(g.passed && g.passed.has(t)));
    const per = all.length ? pct / all.length : 0;          // the equal share of every finalist
    const held = per * names.length;                          // a PASS gives its share to cash
    return { id: g.id, label: g.label, sector: g.sector || null, role: g.role, base: g.base, extended: g.extended, thin: g.thin, stretch: g.stretch ?? null, served: g.served ?? null, pct, names: names.map((t) => ({ ticker: t, pct: per })), to_cash: pct - held, held };
  });
  const held = out.reduce((s, g) => s + g.held, 0);
  const cash = 100 - held;
  const bySector = {};
  for (const g of out) { const s = g.sector || "—"; bySector[s] = (bySector[s] || 0) + g.held; }
  return { baselines: B, invested, groups: out, cash, by_sector: bySector };
}
