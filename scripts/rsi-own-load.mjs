/* SCINTILLA · RS1 (6 Oct 2026) — fill every name's own RSI scale, from this Mac, for the coordinator.

   WHAT IT DOES. For every name the chart API serves, reads its finished daily bars, works out Wilder's RSI(14) for
   every day, and writes ONE row per name to public.rsi_own_percentiles: the RSI at the newest finished close, where
   that sits in the name's own last two calendar years (its percentile), the 10th / 20th / 50th / 80th / 90th
   percentile values, and the whole 0..100 grid. The maths is supabase/functions/rsi-own-daily/rsi-own.mjs —
   imported, not copied, so this script and the nightly function can never drift.

   IT WRITES ONLY public.rsi_own_percentiles, on conflict (ticker). It never touches a price table.
   Keys come from the environment and are never printed:

     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/rsi-own-load.mjs

   --dry            compute and report, write nothing (needs no key: the chart API is read with the Hub's origin)
   --out FILE       also save every row as JSON (the pictures and the playbook lines read this file)
   --sql FILE       also save the load as one SQL file of upserts, for applying by hand instead of with a key
   --symbols A,B    only these names
   --as-of DATE     compute every name as of that session's close (bars after it are ignored). Minutes after a close
                    the chart API has today's finished bar for some names and not yet for others; this keeps one load
                    on one day. Without it each name uses its newest finished bar.
   --bars N         daily bars read per name (default 1300 = the two-year window plus about 1.5 years of run-in)

   NAMES. The chart API's /universe (the stocks and funds) plus the thirteen macro series it serves outside that list
   (MACRO_SYMBOLS in rsi-own.mjs: VIX, the yields, the dollar, oil, gold, silver, Bitcoin, the index futures). */
import fs from "node:fs";
import { rsiOwnRow, RSI_OWN_VERSION, MACRO_SYMBOLS } from "../supabase/functions/rsi-own-daily/rsi-own.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes("--" + k);
const CHART = process.env.SC_CHART_API || "https://scintilla-massive-chart-api.fly.dev";
const SB = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = has("dry");
const OUT = arg("out", null);
const SQL = arg("sql", null);
const BARS = Math.max(300, parseInt(arg("bars", "1300"), 10) || 1300);
const AS_OF = arg("as-of", null);
if (AS_OF && !/^\d{4}-\d{2}-\d{2}$/.test(AS_OF)) { console.error("--as-of wants a date like 2026-10-05"); process.exit(2); }
const ONLY = (arg("symbols", "") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const PAR = 6;                                  // names read at once — bounded, stated
if (!DRY && (!SB || !SERVICE)) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass --dry)."); process.exit(2); }

const chartGet = async (p) => {
  for (let k = 0; k < 3; k++) {
    const r = await fetch(CHART + p, { headers: { origin: "https://scintillahub.ai" } });
    if (r.ok) return r.json();
    if (r.status < 500 && r.status !== 429) throw new Error("chart " + r.status);
    await new Promise((res) => setTimeout(res, 1500 * (k + 1)));
  }
  throw new Error("chart retries exhausted");
};
const barsOf = (c) => c.series || c.candles || c.bars || c.rows || [];

async function upsert(rows) {
  if (DRY || !rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const r = await fetch(SB + "/rest/v1/rsi_own_percentiles?on_conflict=ticker", {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json",
                 Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(slice),
    });
    if (!r.ok) throw new Error("upsert rsi_own_percentiles " + r.status + " " + (await r.text()).slice(0, 200));
    done += slice.length;
  }
  return done;
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const sqlFor = (rows) =>
  "-- RS1 · load for public.rsi_own_percentiles · " + rows.length + " names · written by scripts/rsi-own-load.mjs --sql\n" +
  "-- Needs 20261006_rsi_own_percentiles.sql first. Safe to run twice: one row per name, replaced on conflict.\n" +
  "begin;\n" +
  rows.map((r) =>
    "insert into public.rsi_own_percentiles (ticker,as_of,window_from,sessions,eligible,rsi,pct,p10,p20,p50,p80,p90,grid,source,version) values (" +
    [q(r.ticker), q(r.as_of), q(r.window_from), r.sessions, r.eligible, r.rsi, r.pct, r.p10, r.p20, r.p50, r.p80, r.p90,
     "array[" + r.grid.join(",") + "]::double precision[]", q(r.source), q(r.version)].join(",") +
    ") on conflict (ticker) do update set as_of=excluded.as_of,window_from=excluded.window_from,sessions=excluded.sessions," +
    "eligible=excluded.eligible,rsi=excluded.rsi,pct=excluded.pct,p10=excluded.p10,p20=excluded.p20,p50=excluded.p50," +
    "p80=excluded.p80,p90=excluded.p90,grid=excluded.grid,source=excluded.source,version=excluded.version,computed_at=now();"
  ).join("\n") + "\ncommit;\n";

const main = async () => {
  let symbols = ONLY;
  if (!symbols.length) {
    const u = await chartGet("/universe");
    symbols = (u.symbols || u.universe || []).map((s) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
    symbols = [...new Set([...symbols, ...MACRO_SYMBOLS])];
  }
  console.log(`${symbols.length} names · ${BARS} daily bars each · ${RSI_OWN_VERSION}${AS_OF ? " · as of " + AS_OF : ""} · ${DRY ? "DRY RUN (nothing is written)" : "writing public.rsi_own_percentiles"}`);
  const computedAt = new Date().toISOString();
  const rows = [], skipped = [];
  for (let i = 0; i < symbols.length; i += PAR) {
    await Promise.all(symbols.slice(i, i + PAR).map(async (sym) => {
      try {
        const got = rsiOwnRow(sym, barsOf(await chartGet(`/candles?symbol=${encodeURIComponent(sym)}&tf=1d&limit=${BARS}`)), { asOf: AS_OF });
        /* computed_at travels with the row: a merge-duplicates upsert only updates the columns it is sent */
        if (got.row) rows.push({ ...got.row, computed_at: computedAt }); else skipped.push({ symbol: sym, reason: got.reason, bars: got.bars });
      } catch (e) { skipped.push({ symbol: sym, reason: "CANDLES_FAILED", detail: String(e.message || e).slice(0, 60) }); }
    }));
  }
  rows.sort((a, b) => a.ticker.localeCompare(b.ticker));
  const written = await upsert(rows);

  const young = rows.filter((r) => !r.eligible);
  const asOf = {};
  for (const r of rows) asOf[r.as_of] = (asOf[r.as_of] || 0) + 1;
  const elig = rows.filter((r) => r.eligible);
  const lows = elig.filter((r) => r.pct <= 10).sort((a, b) => a.pct - b.pct);
  const highs = elig.filter((r) => r.pct >= 90).sort((a, b) => b.pct - a.pct);
  /* how the two rulers disagree, counted on the newest finished close */
  const fixedLow = elig.filter((r) => r.rsi <= 30), fixedHigh = elig.filter((r) => r.rsi >= 70);
  const summary = {
    version: RSI_OWN_VERSION, dry: DRY, names_asked: symbols.length, rows: rows.length, written,
    eligible: elig.length, under_one_year: young.length, skipped: skipped.length, as_of: asOf,
    at_own_low_10: lows.length, at_own_high_90: highs.length,
    at_fixed_30_or_less: fixedLow.length, at_fixed_70_or_more: fixedHigh.length,
    own_low_but_above_30: lows.filter((r) => r.rsi > 30).length,
    own_high_but_below_70: highs.filter((r) => r.rsi < 70).length,
    at_30_or_less_but_not_own_low: fixedLow.filter((r) => r.pct > 10).length,
    at_70_or_more_but_not_own_high: fixedHigh.filter((r) => r.pct < 90).length,
  };
  console.log(JSON.stringify(summary, null, 1));
  const line = (r) => `${r.ticker.padEnd(8)} rsi ${r.rsi.toFixed(1).padStart(5)}  pct ${r.pct.toFixed(1).padStart(5)}  own 10th ${r.p10.toFixed(1)}  90th ${r.p90.toFixed(1)}  (${r.sessions} days from ${r.window_from})`;
  console.log("\nAT THEIR OWN LOW (≤ 10th), lowest first:"); for (const r of lows.slice(0, 15)) console.log("  " + line(r));
  console.log("\nAT THEIR OWN HIGH (≥ 90th), highest first:"); for (const r of highs.slice(0, 15)) console.log("  " + line(r));
  if (young.length) console.log("\nUNDER ONE YEAR (keep 30 / 70): " + young.map((r) => r.ticker + " " + r.sessions + "d").join(", "));
  if (skipped.length) console.log("\nNO ROW: " + skipped.map((s) => s.symbol + " " + s.reason).join(", "));

  if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ summary, rows, skipped }, null, 0)); console.log("\nrows saved → " + OUT); }
  if (SQL) { fs.writeFileSync(SQL, sqlFor(rows)); console.log("load SQL saved → " + SQL); }
};
main().catch((e) => { console.error("FAILED: " + String(e.message || e)); process.exit(1); });
