/* F1 (3 Oct 2026) · WHICH NAMES A ROUND-ROBIN LOADER TAKES THIS RUN — new names first, bounded.
   Alan, 3 Oct: "It is pretty crazy how you guys just don't ingest things well." Measured: fmp-fundamentals walks fmp_full_universe
   10 names every 6 h (a lap ≈ 13 days), fmp-analyst and fmp-events 30 names every 4–6 h (≈ 3 days), so a name admitted on 28 Sep
   still had no statements on 3 Oct (70 of the 104 v3 names). The rule here, shared by the three loaders:
     · NEWCOMERS FIRST — up to `cap` names of the loader's own pool that have NOTHING in its table yet (have = the tickers with a row),
       rotated by the run's offset so a name the provider never answers cannot hold a seat forever;
     · THE REST of the slice is the unchanged round-robin, and only the round-robin part moves the stored offset.
   Neighbours (tested together in tests/f1-loader-slice.test.mjs): the stored offset still advances by the round-robin's length; a run
   with no newcomer is byte-for-byte the old slice; the slice size never grows (the FMP call budget is unchanged); the ?sym= and
   ?offset= overrides are untouched (they bypass this). Pattern: Kubernetes' priority-then-fairness queues — new work first, capped,
   so the steady-state rotation keeps its share. Pure: no I/O. */
export function planSlice ({ universe, have, newcomerPool = universe, offset = 0, size, cap = Math.ceil(size / 2) }) {
  const U = [...new Set(universe)].sort()
  const L = U.length
  if (!L || !(size > 0)) return { slice: [], next: 0, newcomers: [] }
  const off = ((Math.trunc(offset) % L) + L) % L
  const inU = new Set(U), H = have instanceof Set ? have : new Set(have || [])
  const missing = [...new Set(newcomerPool)].filter((t) => inU.has(t) && !H.has(t)).sort()
  const take = Math.max(0, Math.min(cap, size, missing.length))
  const start = missing.length ? off % missing.length : 0
  const newcomers = Array.from({ length: take }, (_, i) => missing[(start + i) % missing.length])
  const seat = new Set(newcomers), rr = []
  for (let i = 0; rr.length < size - newcomers.length && i < L; i++) { const t = U[(off + i) % L]; if (!seat.has(t)) rr.push(t) }
  return { slice: [...newcomers, ...rr], next: (off + rr.length) % L, newcomers }
}

/* the FMP spelling of a Hub ticker: tickers.fmp_symbol when set (MOG.A → MOG-A), else the ticker itself */
export function fmpSymbolMap (rows) {
  const m = {}
  for (const r of rows || []) if (r && r.ticker && r.fmp_symbol) m[r.ticker] = String(r.fmp_symbol).trim()
  return (t) => encodeURIComponent(m[t] || t)
}
