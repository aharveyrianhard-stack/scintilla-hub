/* SCINTILLA · 28 Sep — fill USUAL DAY's sigma history from the stored daily bars, for the coordinator.

   WHAT IT DOES. For every name the chart API serves, reads the WHOLE daily series (back to 11 Sep 2003 where the
   name traded then), measures every day close-against-previous-close with the rules file's test
   (supabase/functions/heartbeat-daily/sigma.mjs — imported, not copied), and upserts:
     public.sigma_events_daily   one row per name per day that fired        on conflict (ticker, date)
     public.sigma_day_counts     one row per date: names measured, fired, up, down   on conflict (date)
   It never touches a price table and never writes public.scintillas (the live detector's own store).

   RUN (the coordinator; keys from the environment, never printed):
     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sigma-history-backfill.mjs
   Re-running is safe (upserts). A nightly top-up is the same command with --since <yesterday>.

   --dry            compute and report, write nothing (needs no key: the chart API is read with the Hub's origin)
   --out FILE       with --dry, also save every row as JSON (the local proof reads this)
   --symbols A,B    only these names
   --since DATE     only write rows on or after DATE (the maths still reads the whole series) */
import fs from "node:fs";
import { sigmaHistory, dayCounts } from "../supabase/functions/heartbeat-daily/sigma.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes("--" + k);
const CHART = process.env.SC_CHART_API || "https://scintilla-massive-chart-api.fly.dev";
const SB = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = has("dry");
const OUT = arg("out", null);
const SINCE = arg("since", null);
const ONLY = (arg("symbols", "") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const PAR = 6;                                  // names read at once — bounded, stated
if (!DRY && (!SB || !SERVICE)) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass --dry)."); process.exit(2); }

const rules = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
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

async function upsert(table, conflict, rows) {
  if (DRY || !rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const r = await fetch(SB + "/rest/v1/" + table + "?on_conflict=" + conflict, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json",
                 Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(slice),
    });
    if (!r.ok) throw new Error("upsert " + table + " " + r.status + " " + (await r.text()).slice(0, 200));
    done += slice.length;
  }
  return done;
}

const main = async () => {
  let symbols = ONLY;
  if (!symbols.length) {
    const u = await chartGet("/universe");
    symbols = (u.symbols || u.universe || []).map((s) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
  }
  console.log(`${symbols.length} names · whole daily series · ${DRY ? "DRY RUN" : "writing"}${SINCE ? " · rows from " + SINCE : ""}`);
  const per = [], firstBar = {}, fails = [];
  let wroteE = 0;
  for (let i = 0; i < symbols.length; i += PAR) {
    const chunk = symbols.slice(i, i + PAR);
    const got = await Promise.all(chunk.map(async (sym) => {
      try {
        const h = sigmaHistory(sym, barsOf(await chartGet(`/candles?symbol=${encodeURIComponent(sym)}&tf=1d&limit=10000`)), rules);
        firstBar[sym] = { from: h.from, joins_cut: h.joins_cut, measured: h.measured.length, events: h.events.length };
        return h;
      } catch (e) { fails.push(sym + ": " + String(e.message || e).slice(0, 60)); return null; }
    }));
    for (const h of got) if (h) {
      per.push(h);
      wroteE += await upsert("sigma_events_daily", "ticker,date", SINCE ? h.events.filter((e) => e.date >= SINCE) : h.events);
    }
    if ((i / PAR) % 10 === 0) console.log(`  ${Math.min(i + PAR, symbols.length)}/${symbols.length} names`);
  }
  const counts = dayCounts(per);
  const wroteC = await upsert("sigma_day_counts", "date", SINCE ? counts.filter((c) => c.date >= SINCE) : counts);
  const events = per.reduce((a, h) => a + h.events.length, 0);
  const summary = {
    names: per.length, failed: fails, events, days: counts.length,
    first_day: counts.length ? counts[0].date : null, last_day: counts.length ? counts[counts.length - 1].date : null,
    names_on_first_day: counts.length ? counts[0].names_measured : 0, reused_ticker_cuts: Object.keys(firstBar).filter((s) => firstBar[s].joins_cut),
    written: DRY ? "nothing (dry run)" : { sigma_events_daily: wroteE, sigma_day_counts: wroteC }, rules_version: rules.version,
  };
  console.log(JSON.stringify(summary));
  if (DRY && OUT) fs.writeFileSync(OUT, JSON.stringify({ summary, firstBar, counts, events: per.flatMap((h) => h.events) }));
};
main().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
