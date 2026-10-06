// SCINTILLA · rsi-own-daily v1 (RS1, 6 Oct 2026) — store every name's own RSI scale, once a day.
//
// WHY THIS EXISTS. Alan, 6 Oct: "I see Netflix at 33 and I don't think that's green enough." The board coloured RSI on
// one fixed 30 / 70 ruler. This function gives every name its own: where its daily RSI(14) has actually lived over
// its own last two years. The Hub and the Station read the row and colour the number by where it sits on that scale.
//
// WHAT IT DOES. Asks the chart API which names it serves (plus the thirteen macro series it serves outside that list:
// VIX, the yields, the dollar, oil, gold, silver, Bitcoin, the index futures), reads each one's finished daily bars,
// and REPLACES the name's one row in public.rsi_own_percentiles: the RSI at the newest finished close, its percentile in the name's
// own two-year window, the 10th / 20th / 50th / 80th / 90th percentile values and the whole 0..100 grid. The maths
// lives in ./rsi-own.mjs — pure, shared with scripts/rsi-own-load.mjs and with the tests.
//
// THE RULES IT WILL NOT BREAK.
//   1. It writes to ONE table, public.rsi_own_percentiles, and never to a price table.
//   2. Running it twice leaves one row per name: the upsert is on (ticker).
//   3. It never invents a number. A name with too little history gets no row and a counted reason in the response;
//      a name with under one year gets a row marked eligible=false, and the page keeps 30 / 70 for it.
//   4. Keys are read from the environment and never printed.
//   5. Bandwidth is bounded and stated: one /universe call plus one /candles call per name, in chunks, with a cap.
//
// MODES.
//   (no query)                  — every served name.
//   ?symbols=NFLX,SPY           — only these names (a repair, or a new listing).
//   ?dry=1                      — compute and report, write nothing.
import { rsiOwnRow, RSI_OWN_VERSION, MACRO_SYMBOLS } from "./rsi-own.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";

// Two calendar years is at most 731 bars (a 7-day series); Wilder's smoothing wants a long run-in before the window
// so the first day of the window is already settled. 1,300 bars is the window plus about 1.5 years of run-in.
const BARS = 1300;
const MAX_SYMBOLS = 1200;          // the served universe is ~590 + 13 macro; the cap is a stop, not a target
const CHUNK = 20;                  // names fetched in parallel
const UPSERT_ROWS = 200;           // rows per PostgREST write (each row carries a 101-number grid)

const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };

async function chartGet(path: string) {
  const r = await fetch(CHART + path, { headers: { origin: "https://scintillahub.ai" } });
  if (!r.ok) throw new Error("chart " + r.status + " " + path.split("?")[0]);
  return await r.json();
}

async function upsert(rows: any[]) {
  if (!rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += UPSERT_ROWS) {
    const slice = rows.slice(i, i + UPSERT_ROWS);
    const r = await fetch(SB + "/rest/v1/rsi_own_percentiles?on_conflict=ticker", {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(slice),
    });
    if (!r.ok) throw new Error("upsert " + r.status + " " + (await r.text()).slice(0, 200));
    done += slice.length;
  }
  return done;
}

const barsOf = (c: any) => (c.series || c.candles || c.bars || c.rows || []) as any[];

Deno.serve(async (req) => {
  const t0 = Date.now();
  const u = new URL(req.url);
  const only = (u.searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const dry = u.searchParams.get("dry") === "1";

  try {
    let symbols: string[] = only;
    if (!symbols.length) {
      const universe = await chartGet("/universe");
      symbols = (universe.symbols || universe.universe || [])
        .map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
      // the macro series the chart API serves daily are not in /universe: VIX, the yields, the dollar, oil, gold, Bitcoin
      symbols = [...new Set([...symbols, ...MACRO_SYMBOLS])];
    }
    symbols = symbols.slice(0, MAX_SYMBOLS);

    const rows: any[] = [];
    const skipped: any[] = [];
    let short = 0, failed = 0, young = 0;
    const computedAt = new Date().toISOString();

    for (let i = 0; i < symbols.length; i += CHUNK) {
      await Promise.all(symbols.slice(i, i + CHUNK).map(async (sym) => {
        let bars: any[];
        try {
          bars = barsOf(await chartGet("/candles?symbol=" + encodeURIComponent(sym) + "&tf=1d&limit=" + BARS));
        } catch (e) {
          failed++; skipped.push({ symbol: sym, reason: "CANDLES_FAILED", detail: String(e).slice(0, 80) }); return;
        }
        const got = rsiOwnRow(sym, bars);
        if (!got.row) { short++; skipped.push({ symbol: sym, reason: got.reason, bars: got.bars }); return; }
        if (!got.row.eligible) young++;
        rows.push({ ...got.row, computed_at: computedAt });
      }));
    }

    const written = dry ? 0 : await upsert(rows);
    const asOf: Record<string, number> = {};
    for (const r of rows) asOf[r.as_of] = (asOf[r.as_of] || 0) + 1;
    return new Response(JSON.stringify({
      ok: true, dry, version: RSI_OWN_VERSION, symbols: symbols.length, rows: rows.length, written,
      eligible: rows.length - young, under_one_year: young, short_history: short, candle_failures: failed,
      as_of: asOf, skipped: skipped.slice(0, 40), ms: Date.now() - t0,
    }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 300), ms: Date.now() - t0 }),
      { status: 500, headers: { "content-type": "application/json" } });
  }
});
