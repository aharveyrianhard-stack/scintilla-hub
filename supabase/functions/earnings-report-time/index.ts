// SCINTILLA · earnings-report-time v1 — fill report_time from Nasdaq's public calendar.
//
// WHY THIS EXISTS. The job that catches earnings (fmp-events v2) writes ticker, date,
// EPS and revenue and NOTHING ELSE — its row builder has no report_time field at all.
// So an upcoming report has no stated time until something else supplies one, which is
// why Alan saw "time unknown" on Costco, Micron and ASML. M26 filled 44 rows by hand
// from a Mac. This is that same fill, running by itself in Supabase, with no key on any
// Mac and nobody to remember to run it.
//
// THE RULES IT WILL NOT BREAK — the same four the reviewed script keeps:
//   1. It never guesses. Nasdaq's "time-not-supplied" writes nothing, and the card goes
//      on saying the time was not announced.
//   2. It never overwrites. The write itself carries `report_time=is.null`, so the
//      DATABASE refuses a row that was filled between the read and the write.
//   3. It matches on ticker AND date. A different date is a different event; where the
//      two disagree it writes nothing and reports the disagreement.
//   4. It touches one column plus its own provenance — report_time, report_time_source,
//      report_time_set_at. Never a price, never an estimate, never a result.
// It reads its keys from the function environment and never prints them.
const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const SOURCE_NAME = "nasdaq-calendar";
const NASDAQ_TIME: Record<string, string | null> = {
  "time-pre-market": "BMO",
  "time-after-hours": "AMC",
  "time-not-supplied": null,
};
/** what may be written for one of our rows, given what the source says for that day */
export function decide(row: any, hit: any) {
  const have = row.report_time != null && String(row.report_time).trim() !== "";
  if (have) return { write: null, reason: "ALREADY_SET" };
  if (!hit) return { write: null, reason: "SOURCE_HAS_NO_ROW_FOR_THIS_DAY" };
  if (!(hit.time in NASDAQ_TIME)) return { write: null, reason: "SOURCE_TIME_NOT_UNDERSTOOD:" + hit.time };
  const t = NASDAQ_TIME[hit.time];
  if (!t) return { write: null, reason: "SOURCE_STATES_NO_TIME" };
  return { write: t, reason: "FILLED" };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: string, n: number) => iso(new Date(Date.parse(d + "T12:00:00Z") + n * 864e5));
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };

async function pg(path: string) {
  const r = await fetch(SB + "/rest/v1/" + path, { headers: H });
  if (!r.ok) throw new Error("read " + path.split("?")[0] + " -> " + r.status);
  return r.json();
}
async function patch(path: string, body: unknown) {
  const r = await fetch(SB + "/rest/v1/" + path, {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("write -> " + r.status);
}
const flag = (value: string) =>
  fetch(SB + "/rest/v1/app_config?on_conflict=key", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "earnings_time_busy", value }),
  }).catch(() => {});
async function nasdaqDay(d: string) {
  const r = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${d}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error("nasdaq " + d + " -> " + r.status);
  const j = await r.json();
  return (j?.data?.rows || []) as any[];
}

Deno.serve(async (req) => {
  const started = Date.now();
  const url = new URL(req.url);
  const days = Math.min(60, Math.max(1, +(url.searchParams.get("days") || "45")));
  const dry = url.searchParams.get("dry") === "1";
  try {
    /* SINGLE FLIGHT, like every other job in this estate: a run that overlaps another
       would ask Nasdaq twice for the same days and write the same rows twice. */
    const busy = await pg("app_config?select=value&key=eq.earnings_time_busy").catch(() => []);
    const since = busy?.[0]?.value ? Date.now() - +busy[0].value : Infinity;
    if (since < 20 * 60e3) return Response.json({ skipped: "ANOTHER_RUN_IN_FLIGHT", since_ms: since });
    await flag(String(Date.now()));

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const end = shift(today, days);
    const universe = new Set((await pg("cohorts?select=ticker")).map((r: any) => r.ticker));
    /* only the rows that are actually missing a time: the read is the same filter the
       write will use, so the job does no work it is not allowed to finish */
    const rows = (await pg(
      `earnings_events?select=ticker,date,report_time&date=gte.${today}&date=lte.${end}&report_time=is.null&order=date.asc&limit=2000`,
    )).filter((r: any) => universe.has(r.ticker));

    const cal = new Map<string, any>(), seen = new Map<string, string[]>(), failed: any[] = [];
    for (let d = today; d <= end; d = shift(d, 1)) {
      const w = new Date(d + "T12:00:00Z").getUTCDay();
      if (w === 0 || w === 6) continue;
      try {
        for (const x of await nasdaqDay(d)) {
          cal.set(x.symbol + "|" + d, { time: x.time });
          if (!seen.has(x.symbol)) seen.set(x.symbol, []);
          seen.get(x.symbol)!.push(d);
        }
      } catch (e) { failed.push({ date: d, error: String((e as Error).message || e) }); }
      await new Promise((r) => setTimeout(r, 250));                 // the source is public: do not hammer it
    }

    const fills: any[] = [], skipped: Record<string, number> = {}, disagreements: any[] = [];
    for (const row of rows) {
      const d = decide(row, cal.get(row.ticker + "|" + row.date));
      if (d.write) { fills.push({ ticker: row.ticker, date: row.date, report_time: d.write }); continue; }
      skipped[d.reason] = (skipped[d.reason] || 0) + 1;
      const elsewhere = (seen.get(row.ticker) || []).filter((x) => x !== row.date);
      if (d.reason === "SOURCE_HAS_NO_ROW_FOR_THIS_DAY" && elsewhere.length)
        disagreements.push({ ticker: row.ticker, our_date: row.date, source_dates: elsewhere });
    }

    let written = 0;
    if (!dry) {
      const set_at = new Date().toISOString();
      for (const f of fills) {
        await patch(
          `earnings_events?ticker=eq.${encodeURIComponent(f.ticker)}&date=eq.${f.date}&report_time=is.null`,
          { report_time: f.report_time, report_time_source: SOURCE_NAME, report_time_set_at: set_at },
        );
        written++;
      }
    }
    const out = {
      ran_utc: new Date().toISOString(), ms: Date.now() - started, dry,
      window: { from: today, to: end, days },
      rows_missing_a_time: rows.length, would_fill: fills.length, written,
      skipped, date_disagreements: disagreements, source_day_failures: failed,
    };
    await flag("0");
    /* the last run is left where anything can read it: a job nobody can check is a job
       nobody can trust */
    await fetch(SB + "/rest/v1/app_config?on_conflict=key", {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "earnings_time_last", value: JSON.stringify(out).slice(0, 4000) }),
    }).catch(() => {});
    return Response.json(out);
  } catch (e) {
    await flag("0");
    return Response.json({ failed: String((e as Error).message || e) }, { status: 500 });
  }
});
