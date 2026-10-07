// HM2 (7 Oct 2026) — the economic calendar BEFORE June 2024, for the surprise strips.
//
// Alan: "macro prints — all of the historical information, do we have it? … It's only really useful in a historical
// context." What is stored today: public.econ_calendar holds actual / consensus / previous for every US release from
// 7 June 2024 on (the day the fmp-economic job began). FMP's economic calendar goes back further; this reads it.
//
// IT PRINTS JSON AND WRITES NOTHING. It runs where the FMP key lives (a throw-away machine of
// scintilla-massive-stocks-batch — the key is read from the environment and is never printed, logged or put in a
// message), and the coordinator loads what it prints:
//   node hm2-econ-calendar-backfill.mjs [from=2015-01-01] [to=2024-06-06] > econ-calendar-backfill.json
//   node hm2-econ-calendar-backfill.mjs --sql < econ-calendar-backfill.json > econ-calendar-backfill.sql
// The SQL is `insert … on conflict (event_ts, country, event) do nothing`: it only ADDS rows older than the table's
// first one and can never change a row the live job wrote.
//
// SCOPE: the US, and only the eighteen release families the strips show (the same names, the same "(Sep)" rule
// as the page). ASKED IN 30-DAY WINDOWS: fmp-economic's own note (R52, 12 Aug) measured that one long window comes
// back cut short with no warning.
import fs from "node:fs";

export const FAMILIES = Object.freeze(["Non Farm Payrolls", "Unemployment Rate", "Initial Jobless Claims", "JOLTs Job Openings",
  "Inflation Rate YoY", "Core Inflation Rate MoM", "Core PCE Price Index MoM", "Producer Price Index MoM",
  "Retail Sales MoM", "Durable Goods Orders MoM", "ISM Manufacturing PMI", "ISM Services PMI", "GDP Growth Rate QoQ",
  "Michigan Consumer Sentiment", "Industrial Production MoM", "Housing Starts", "Total Vehicle Sales", "Fed Interest Rate Decision"]);
const MONTH_TAG = /\s*\((Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)\s*$/i;      // the page's EC_MONTH_TAG
export const baseOf = (event) => String(event || "").replace(MONTH_TAG, "").trim();
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

/** FMP calendar rows → econ_calendar rows (fmp-economic's own mapping), US + the strip families only, one per key. */
export function calendarRows(list, families = FAMILIES) {
  const want = new Set(families), seen = new Set(), out = [];
  for (const x of list || []) {
    if (!x || !x.date || !x.event || x.country !== "US" || !want.has(baseOf(x.event))) continue;
    const event_ts = Math.floor(new Date(String(x.date).replace(" ", "T") + "Z").getTime() / 1000);
    if (!Number.isFinite(event_ts)) continue;
    const key = event_ts + "|US|" + x.event;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ event_ts, country: "US", event: String(x.event), actual: num(x.actual), previous: num(x.previous), estimate: num(x.estimate), impact: x.impact || null });
  }
  return out.sort((a, b) => a.event_ts - b.event_ts || a.event.localeCompare(b.event));
}
export function windows(from, to, days = 30) {
  const out = [], end = Date.parse(to + "T00:00:00Z");
  for (let t = Date.parse(from + "T00:00:00Z"); t <= end; t += days * 86400e3)
    out.push([new Date(t).toISOString().slice(0, 10), new Date(Math.min(end, t + (days - 1) * 86400e3)).toISOString().slice(0, 10)]);
  return out;
}
export function toSql(rows) {
  const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
  const now = Math.floor(Date.now() / 1000);
  return "-- HM2 · econ_calendar history · " + rows.length + " US rows · additive (do nothing on a row that exists)\n" +
    "insert into public.econ_calendar (event_ts, country, event, actual, previous, estimate, impact, updated_ts) values\n" +
    rows.map((r) => "  (" + [r.event_ts, lit(r.country), lit(r.event), lit(r.actual), lit(r.previous), lit(r.estimate), lit(r.impact), now].join(", ") + ")").join(",\n") +
    "\non conflict (event_ts, country, event) do nothing;\n";
}

if (import.meta.url === new URL("file://" + process.argv[1]).href || process.argv[1]?.endsWith("hm2-econ-calendar-backfill.mjs")) {
  const args = process.argv.slice(2);
  if (args.includes("--sql")) {
    process.stdout.write(toSql(JSON.parse(fs.readFileSync(0, "utf8")).rows));
  } else {
    const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)), from = dates[0] || "2015-01-01", to = dates[1] || "2024-06-06";
    const K = process.env.FMP_API_KEY || process.env.FMP_KEY;
    if (!K) { console.error("no FMP key in this environment (FMP_API_KEY): run this on the Fly machine, not on the Mac"); process.exit(2); }
    const all = [], failed = [];
    for (const [a, b] of windows(from, to)) {
      const u = new URL("https://financialmodelingprep.com/stable/economic-calendar");
      u.searchParams.set("from", a); u.searchParams.set("to", b); u.searchParams.set("apikey", K);
      try {
        const r = await fetch(u, { headers: { "User-Agent": "scintilla-hm2-backfill/1.0" } });
        if (!r.ok) { failed.push(a + " HTTP " + r.status); continue; }
        const list = await r.json();
        if (Array.isArray(list)) all.push(...list); else failed.push(a + " not a list");
      } catch (e) { failed.push(a + " " + String(e.message).slice(0, 60)); }     // the message never carries the address
      await new Promise((res) => setTimeout(res, 150));
    }
    const rows = calendarRows(all), by = {};
    for (const r of rows) { const b = baseOf(r.event); (by[b] ||= { n: 0, both: 0, first: null }).n++; if (r.actual != null && r.estimate != null) by[b].both++; by[b].first ??= new Date(r.event_ts * 1000).toISOString().slice(0, 10); }
    process.stdout.write(JSON.stringify({ from, to, read: all.length, rows, families: by, failed }));
    console.error(rows.length + " rows · " + Object.keys(by).length + " of " + FAMILIES.length + " families · " + failed.length + " windows failed");
  }
}
