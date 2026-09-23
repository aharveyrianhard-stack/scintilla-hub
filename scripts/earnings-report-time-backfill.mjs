#!/usr/bin/env node
/* EVENTS earnings — fill report_time from Nasdaq's public earnings calendar.
 *
 * ALAN'S QUESTION (23 Sep): "Why do I see time unknown in a couple of these?
 * Costco and Micron… ASML." Because the stored calendar carries no report time for
 * almost any upcoming row. This fills that in from a source that STATES it, and
 * records which source said so.
 *
 * THE RULES IT WILL NOT BREAK
 *   1. It never guesses. Nasdaq's "time-not-supplied" writes nothing, and the card
 *      goes on saying the time was not announced.
 *   2. It never overwrites. A row that already carries a report_time is left alone,
 *      whoever wrote it.
 *   3. It matches on ticker AND date. Where our date and Nasdaq's disagree, it
 *      writes nothing and reports the disagreement — a different date is a
 *      different event, and correcting dates is not this script's job.
 *   4. It writes nothing at all unless --apply is given. The default is a dry run
 *      that prints exactly what it would do.
 *   5. It reads its key from the environment and never prints it.
 *
 * USE
 *   node scripts/earnings-report-time-backfill.mjs                  # dry run, 30 days
 *   node scripts/earnings-report-time-backfill.mjs --days 45
 *   SUPABASE_SERVICE_ROLE_KEY=… node scripts/earnings-report-time-backfill.mjs --apply
 *   (--report <path> writes the whole measurement as JSON)
 */
const SB = process.env.SUPABASE_URL || "https://wadinxqplrggagkvrdag.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/* Nasdaq states one of three things. Only two of them are a time. */
export const NASDAQ_TIME = { "time-pre-market": "BMO", "time-after-hours": "AMC", "time-not-supplied": null };
export const SOURCE_NAME = "nasdaq-calendar";

/** what to write for one of our rows, given what the source says for that same day.
 *  Returns null whenever nothing may be written, with the reason. */
export function decide(row, hit) {
  const have = row.report_time != null && String(row.report_time).trim() !== "";
  if (have) return { write: null, reason: "ALREADY_SET" };
  if (!hit) return { write: null, reason: "SOURCE_HAS_NO_ROW_FOR_THIS_DAY" };
  if (!(hit.time in NASDAQ_TIME)) return { write: null, reason: "SOURCE_TIME_NOT_UNDERSTOOD:" + hit.time };
  const t = NASDAQ_TIME[hit.time];
  if (!t) return { write: null, reason: "SOURCE_STATES_NO_TIME" };
  return { write: t, reason: "FILLED" };
}

const iso = (d) => d.toISOString().slice(0, 10);
const shift = (d, n) => iso(new Date(Date.parse(d + "T12:00:00Z") + n * 864e5));

async function pg(path, key) {
  const r = await fetch(SB + "/rest/v1/" + path, { headers: { apikey: key, Authorization: "Bearer " + key } });
  if (!r.ok) throw new Error("read " + path.split("?")[0] + " -> " + r.status);
  return r.json();
}
async function patch(path, body, key) {
  const r = await fetch(SB + "/rest/v1/" + path, {
    method: "PATCH",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("write -> " + r.status + " " + (await r.text()).slice(0, 120));
}
async function nasdaqDay(d) {
  const r = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${d}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error("nasdaq " + d + " -> " + r.status);
  const j = await r.json();
  return (j && j.data && j.data.rows) || [];
}

async function main(argv) {
  const arg = (k, dflt) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : dflt; };
  const apply = argv.includes("--apply");
  const days = +arg("--days", 30);
  const reportPath = arg("--report", "");
  const readKey = ANON || SERVICE;
  if (!readKey) throw new Error("no key in the environment: set SUPABASE_ANON_KEY (read) or SUPABASE_SERVICE_ROLE_KEY (write)");
  if (apply && !SERVICE) throw new Error("--apply needs SUPABASE_SERVICE_ROLE_KEY in the environment");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const end = shift(today, days);
  const universe = new Set((await pg("cohorts?select=ticker", readKey)).map((r) => r.ticker));
  const rows = (await pg(`earnings_events?select=ticker,date,report_time,confirmed&date=gte.${today}&date=lte.${end}&order=date.asc&limit=2000`, readKey))
    .filter((r) => universe.has(r.ticker));

  /* one request per weekday, the calendar's own unit */
  const cal = new Map();   // "TICKER|date" -> {time}
  const seen = new Map();  // TICKER -> [dates]
  const failed = [];
  for (let d = today; d <= end; d = shift(d, 1)) {
    const w = new Date(d + "T12:00:00Z").getUTCDay();
    if (w === 0 || w === 6) continue;
    try {
      for (const x of await nasdaqDay(d)) {
        cal.set(x.symbol + "|" + d, { time: x.time });
        if (!seen.has(x.symbol)) seen.set(x.symbol, []);
        seen.get(x.symbol).push(d);
      }
    } catch (e) { failed.push({ date: d, error: String(e.message || e) }); }
    await new Promise((r) => setTimeout(r, 250));
  }

  const before = rows.filter((r) => r.report_time != null && String(r.report_time).trim() !== "").length;
  const fills = [], skipped = {}, disagreements = [];
  for (const row of rows) {
    const d = decide(row, cal.get(row.ticker + "|" + row.date));
    if (d.write) fills.push({ ticker: row.ticker, date: row.date, report_time: d.write });
    else {
      skipped[d.reason] = (skipped[d.reason] || 0) + 1;
      const elsewhere = (seen.get(row.ticker) || []).filter((x) => x !== row.date);
      if (d.reason === "SOURCE_HAS_NO_ROW_FOR_THIS_DAY" && elsewhere.length)
        disagreements.push({ ticker: row.ticker, our_date: row.date, source_dates: elsewhere });
    }
  }

  let written = 0;
  if (apply) {
    for (const f of fills) {
      /* report_time is only ever written INTO AN EMPTY ONE: the filter says so at
         the database, not just here, so a row filled between the read and the write
         is still not overwritten. */
      await patch(`earnings_events?ticker=eq.${encodeURIComponent(f.ticker)}&date=eq.${f.date}&report_time=is.null`,
        { report_time: f.report_time, report_time_source: SOURCE_NAME, report_time_set_at: new Date().toISOString() }, SERVICE);
      written++;
    }
  }

  const out = {
    ran_utc: new Date().toISOString(), applied: apply, window: { from: today, to: end, days },
    rows: rows.length, with_time_before: before, would_fill: fills.length,
    with_time_after: before + fills.length,
    coverage_before_pct: rows.length ? +((before / rows.length) * 100).toFixed(1) : 0,
    coverage_after_pct: rows.length ? +(((before + fills.length) / rows.length) * 100).toFixed(1) : 0,
    written, skipped, date_disagreements: disagreements, source_day_failures: failed,
    named_by_alan: ["COST", "MU", "ASML"].map((t) => {
      const r = rows.filter((x) => x.ticker === t)[0];
      if (!r) return { ticker: t, in_window: false };
      const f = fills.filter((x) => x.ticker === t)[0];
      return { ticker: t, date: r.date, before: r.report_time, after: f ? f.report_time : r.report_time, source: f ? SOURCE_NAME : null };
    }),
    fills,
  };
  if (reportPath) (await import("node:fs")).writeFileSync(reportPath, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, fills: out.fills.slice(0, 12), fills_total: out.fills.length }, null, 1));
  if (!apply) console.log("\nDRY RUN — nothing was written. Re-run with --apply and SUPABASE_SERVICE_ROLE_KEY set to write these " + fills.length + " rows.");
}

if (process.argv[1] && process.argv[1].endsWith("earnings-report-time-backfill.mjs")) {
  main(process.argv.slice(2)).catch((e) => { console.error("FAILED:", e.message || e); process.exit(1); });
}
