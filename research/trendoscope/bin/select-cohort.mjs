#!/usr/bin/env node
// Pilot cohort selection (packet §5). Selection is by SHA-256 seed rank inside
// liquidity x volatility cells measured BEFORE the evaluation interval. No symbol is chosen
// because its chart looks interesting, and the cohort is reproducible from the seed alone.
import { writeFileSync, mkdirSync } from "node:fs";
import { fetchBars, fetchJson } from "../lib/bars.mjs";
import { fileURLToPath } from "node:url";
import { sha256, canonicalJson, EVAL_SEED } from "../lib/settings.mjs";

const POOL_SIZE = 40, PICK = 8, MEASURE_BARS = 60;
const OUT = fileURLToPath(new URL("../extracts/", import.meta.url));
const rank = (symbol) => sha256(`${EVAL_SEED}|${symbol}`);

const universe = await fetchJson("/universe");
const ranked = [...universe.symbols].map((s) => ({ symbol: s, rank: rank(s) }))
  .sort((a, b) => (a.rank < b.rank ? -1 : 1));
const pool = ranked.slice(0, POOL_SIZE);

// Measure liquidity and realized volatility from completed daily bars only.
const measured = [];
const failures = [];
for (let i = 0; i < pool.length; i += 3) {
  const batch = pool.slice(i, i + 3);
  const results = await Promise.all(batch.map(async (p) => {
    try {
      const ex = await fetchBars(p.symbol, "1D", { limit: 400 });
      const bars = ex.bars.slice(-MEASURE_BARS);
      if (bars.length < MEASURE_BARS) return { symbol: p.symbol, error: `only ${bars.length} daily bars` };
      const dv = bars.map((b) => b.c * b.v).sort((a, b) => a - b);
      const rets = bars.slice(1).map((b, j) => Math.log(b.c / bars[j].c));
      const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
      const sd = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1));
      return { symbol: p.symbol, rank: p.rank,
        median_dollar_volume: dv[Math.floor(dv.length / 2)],
        realized_vol_annualized: sd * Math.sqrt(252),
        measure_window: { from: bars[0].t, to: bars[bars.length - 1].t, bars: bars.length },
        provenance: ex.provenance };
    } catch (e) { return { symbol: p.symbol, error: String(e.message).slice(0, 160) }; }
  }));
  for (const r of results) (r.error ? failures : measured).push(r);
  process.stderr.write(`measured ${measured.length}/${pool.length}\r`);
}

// 4 liquidity quartiles x 2 volatility halves = 8 cells; best seed rank wins each cell.
const byLiq = [...measured].sort((a, b) => a.median_dollar_volume - b.median_dollar_volume);
const q = (i) => Math.min(3, Math.floor((i / byLiq.length) * 4));
byLiq.forEach((m, i) => { m.liquidity_quartile = q(i) + 1; });
const volSorted = [...measured].sort((a, b) => a.realized_vol_annualized - b.realized_vol_annualized);
const medVol = volSorted[Math.floor(volSorted.length / 2)].realized_vol_annualized;
for (const m of measured) m.volatility_half = m.realized_vol_annualized >= medVol ? "high" : "low";

const cells = new Map();
for (const m of measured) {
  const k = `Q${m.liquidity_quartile}-${m.volatility_half}`;
  if (!cells.has(k)) cells.set(k, []);
  cells.get(k).push(m);
}
const cohort = [];
for (const [cell, list] of [...cells].sort()) {
  list.sort((a, b) => (a.rank < b.rank ? -1 : 1));
  if (list[0]) cohort.push({ ...list[0], cell });
}
cohort.sort((a, b) => (a.rank < b.rank ? -1 : 1));

const payload = {
  generated_utc: new Date().toISOString(),
  seed: EVAL_SEED,
  selection_rule: `SHA-256(seed|symbol) rank; pool = first ${POOL_SIZE} ranked symbols of the frozen universe; ` +
    `cells = 4 median-dollar-volume quartiles x 2 realized-volatility halves measured on the last ${MEASURE_BARS} completed daily bars; ` +
    `best seed rank per cell; target ${PICK} symbols`,
  universe_snapshot: { count: universe.count, universe_sha256: universe.universe_sha256 },
  asset_class_coverage: {
    equities_etfs: cohort.length,
    futures: 0, crypto: 0,
    gap: "The chart API universe is 364 US equities/ETFs. BTCUSD, ETHUSD and NQ are NOT served, " +
         "so the packet's 4-futures and BTC/ETH cohort legs cannot be replayed from this source. " +
         "ES exists in the universe as Eversource Energy (an equity), NOT the E-mini future.",
  },
  pool: pool.map((p) => p.symbol),
  measured_count: measured.length,
  failures,
  cohort: cohort.map((c) => ({ symbol: c.symbol, cell: c.cell, rank: c.rank,
    median_dollar_volume: c.median_dollar_volume, realized_vol_annualized: c.realized_vol_annualized,
    liquidity_quartile: c.liquidity_quartile, volatility_half: c.volatility_half })),
  timeframes: ["1H", "3H", "4H", "1D"],
};
payload.cohort_sha256 = sha256(canonicalJson(payload.cohort));
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}cohort.json`, JSON.stringify(payload, null, 1));
console.log(`\ncohort (${cohort.length}): ${cohort.map((c) => `${c.symbol}[${c.cell}]`).join(" ")}`);
console.log(`cohort_sha256 ${payload.cohort_sha256}  failures=${failures.length}`);
