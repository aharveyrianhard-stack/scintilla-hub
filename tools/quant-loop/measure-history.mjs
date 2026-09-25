#!/usr/bin/env node
// Ask the chart API what history actually exists, per symbol. Nothing is assumed:
// every number below is what the API answered, and the request is printed with it.
// Read-only: GET /candles only. Never writes anywhere.
const API = "https://scintilla-massive-chart-api.fly.dev";

// Stocks and funds come from Massive; the macro set comes from FMP through the same API.
const SYMBOLS = [
  ["AAPL", "stock"], ["MSFT", "stock"], ["NVDA", "stock"], ["F", "stock"],
  ["SPY", "fund"], ["DIA", "fund"], ["XLE", "fund"], ["GLD", "fund"],
  ["VIX", "macro"], ["DXY", "macro"], ["US10Y", "macro"], ["DXUSD", "macro"],
  ["CLUSD", "macro"], ["GCUSD", "macro"], ["SIUSD", "macro"], ["BTCUSD", "macro"],
];

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

async function measure(symbol, group) {
  const url = `${API}/candles?symbol=${encodeURIComponent(symbol)}&tf=D`;
  const t0 = Date.now();
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json();
  const series = Array.isArray(body.series) ? body.series : [];
  const out = {
    symbol, group, asked: url, http: res.status, ms: Date.now() - t0,
    bars_counted: series.length,              // counted row by row, not estimated
    bars_reported: body.full_series_count ?? null, // the API's own exact count
    first_day: series.length ? day(series[0].t) : null,
    last_day: series.length ? day(series[series.length - 1].t) : null,
    provider: body.provider ?? null,
    price_basis: body.price_basis ?? null,
    source: body.source_namespace ?? null,
    absence: body.absence ?? null,
  };
  out.counts_agree = out.bars_reported === null || out.bars_reported === out.bars_counted;
  return out;
}

const rows = [];
for (const [symbol, group] of SYMBOLS) {
  try { rows.push(await measure(symbol, group)); }
  catch (e) { rows.push({ symbol, group, error: String(e && e.message || e) }); }
}
const stamp = new Date().toISOString();
process.stdout.write(JSON.stringify({ measured_utc: stamp, api: API, rows }, null, 1) + "\n");
console.error(`\n${"symbol".padEnd(8)}${"from".padEnd(12)}${"to".padEnd(12)}${"bars".padStart(7)}  source`);
for (const r of rows) {
  if (r.error) { console.error(`${r.symbol.padEnd(8)}ERROR ${r.error}`); continue; }
  console.error(`${r.symbol.padEnd(8)}${String(r.first_day).padEnd(12)}${String(r.last_day).padEnd(12)}${String(r.bars_counted).padStart(7)}  ${r.provider}${r.counts_agree ? "" : "  COUNT MISMATCH"}`);
}
