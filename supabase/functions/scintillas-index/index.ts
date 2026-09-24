// SCINTILLA · scintillas-index v1 (M63) — who joined an index, and who left.
//
// WHY THIS IS ITS OWN FUNCTION AND NOT A MODE OF scintillas-detect.
// scintillas-detect makes a promise, pinned by a test: it never calls FMP. Its dilution pass reads
// the SEC, which is free, and its price pass reads our own chart API. This pass DOES call a paid
// provider, so it lives on its own, runs on its own cadence (twice a day is plenty — index changes
// are announced days ahead), and can be turned off without touching anything else.
//
// WHAT IT DOES. Three reads, one per index: the provider's own constituent-change history for the
// S&P 500, 400 and 600. detect.mjs turns each provider row — which can add one name and drop
// another in the same breath — into one event per company, and the rows go into public.scintillas
// with kind 'index_change' and a dedupe_key that makes a re-run a no-op.
//
// THE RULES IT KEEPS.
//   1. THE KEY IS SERVER-SIDE. It is read from this function's environment, never sent to the
//      browser, never written into a response, and never logged.
//   2. Bandwidth is bounded and stated: three requests per run, no candles, no filings.
//   3. It writes to ONE table, public.scintillas, ignore-duplicates.
//   4. It invents nothing. A row without a date, or dated outside the window, is skipped with a
//      reason in the response.
//
//   ?days=21   how far back a change still counts as a signal (default 21, max 90)
//   ?dry=1     detect and report, write nothing
import { detectIndexChanges } from "../scintillas-detect/detect.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FMP = Deno.env.get("FMP_API_KEY") || "";
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";
const MAX_ROWS_PER_INDEX = 60;          // the provider answers newest-first; a day's window needs far fewer

/* the three indexes Alan named, with the provider's own path for each one's change history */
const INDEX_SOURCES: [string, string][] = [
  ["sp500_constituent", "S&P 500"],
  ["sp400_constituent", "S&P MidCap 400"],
  ["sp600_constituent", "S&P SmallCap 600"],
];

const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const iso = (d: Date) => d.toISOString();
function sessionET(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
async function insert(rows: any[]) {
  if (!rows.length) return { inserted: 0 };
  const r = await fetch(SB + "/rest/v1/scintillas?on_conflict=dedupe_key", {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error("insert -> " + r.status + " " + (await r.text()).slice(0, 200));
  const back = await r.json();
  return { inserted: Array.isArray(back) ? back.length : 0 };
}
function countReasons(skipped: any[]) {
  const out: Record<string, number> = {};
  for (const s of skipped || []) out[s.reason] = (out[s.reason] || 0) + 1;
  return out;
}
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body, null, 1), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const started = Date.now();
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days")) || 21));
  const dry = url.searchParams.get("dry") === "1";
  const now = new Date();
  const today = sessionET(now);
  const report: any = { fn: "scintillas-index", today, at: iso(now), window_days: days, dry, kinds: {}, skipped_counts: {}, notes: [] };

  try {
    if (!FMP) return json({ ...report, error: "FMP_API_KEY is not set on this function" }, 503);

    /* the universe is the Hub's own list: an index change on a name we do not carry is not a
       signal for this desk, and saying so is cheaper than storing it. */
    let symbols: string[] = [];
    try {
      const u = await (await fetch(CHART + "/universe")).json();
      symbols = (u.symbols || u.universe || []).map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
      report.notes.push("universe: " + symbols.length + " names");
    } catch (_) {
      report.notes.push("universe unreadable — every change in the window is kept, none filtered out");
    }

    const events: any[] = [];
    for (const [path, name] of INDEX_SOURCES) {
      try {
        const r = await fetch("https://financialmodelingprep.com/api/v3/historical/" + path +
          "?apikey=" + encodeURIComponent(FMP));
        if (!r.ok) { report.notes.push(name + ": provider answered " + r.status); continue; }
        const rows = await r.json();
        const got = detectIndexChanges({
          changes: Array.isArray(rows) ? rows.slice(0, MAX_ROWS_PER_INDEX) : [],
          index: name, ts: iso(now), today, universe: symbols.length ? symbols : null, maxAgeDays: days,
        });
        events.push(...got.events);
        report.notes.push(name + ": " + got.events.length + " change(s) inside the window, " + got.skipped.length + " row(s) skipped");
        report.skipped_counts[path] = countReasons(got.skipped);
      } catch (e) {
        /* never the url (it carries the key) and never the key: only that the read failed */
        report.notes.push(name + ": read failed (" + String((e as any)?.name || "error") + ")");
      }
    }
    report.kinds.index_change = events.length;
    report.detected = events.length;
    if (!dry) {
      const { inserted } = await insert(events);
      report.inserted = inserted;
      report.already_stored = events.length - inserted;
    }
    report.provider_reads = INDEX_SOURCES.length;
    report.ms = Date.now() - started;
    return json(report, 200);
  } catch (e) {
    return json({ ...report, error: String((e as any)?.message || e).slice(0, 300), ms: Date.now() - started }, 500);
  }
});
