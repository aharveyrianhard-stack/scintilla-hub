/* FD1 · HOW FAR THE STORED MARKET VALUE IS FROM TODAY'S, for every served company. Read-only (`.anon` in the working folder).
   fundamentals.market_cap is FMP's key-metrics market value at the latest fiscal period end (its writer says so);
   company_profile.market_cap is refreshed every day by fmp-backfill (06:25Z) and equals its price × its shares.
     node market-value-scan.mjs <out.json> */
import { writeFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { REPORTS_IN } = await import(WT + "/supabase/functions/comps-feed/feed.mjs"); const { pg } = await import("./fixed-feed.mjs");
const page = async (q) => { const all = []; for (let off = 0; off < 20000; off += 1000) { const r = await pg(q + `&limit=1000&offset=${off}`); all.push(...r); if (r.length < 1000) break; } return all; };
const prof = (await page("company_profile?select=ticker,price,market_cap,shares_out,updated_ts,is_etf&order=ticker.asc")).filter((r) => !r.is_etf), fund = await page("fundamentals?select=ticker,price,market_cap,updated_ts&order=ticker.asc");
const jobs = await pg("fmp_bandwidth_log?select=fn,at,symbols&fn=in.(fmp-backfill,mcap-refresh,fmp-fundamentals)&order=at.desc&limit=40").catch(() => []);
const P = Object.fromEntries(prof.map((r) => [r.ticker, r])), day = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null), today = new Date().toISOString().slice(0, 10);
const rows = fund.filter((f) => P[f.ticker] && P[f.ticker].market_cap > 0 && f.market_cap > 0 && !REPORTS_IN[f.ticker]).map((f) => ({ ticker: f.ticker, stored_over_today: f.market_cap / P[f.ticker].market_cap, fundamentals_row: day(f.updated_ts), profile_row: day(P[f.ticker].updated_ts) })).sort((a, b) => a.stored_over_today - b.stored_over_today);
const q = (p) => rows[Math.floor((rows.length - 1) * p)].stored_over_today, off = (x) => rows.filter((r) => Math.abs(r.stored_over_today - 1) > x).length, r3 = (v) => Math.round(v * 1000) / 1000;
const ages = fund.filter((f) => f.updated_ts).map((f) => (Date.now() / 1000 - f.updated_ts) / 86400).sort((a, b) => a - b);
const doc = { taken: new Date().toISOString(), what: "fundamentals.market_cap ÷ company_profile.market_cap for every served company that reports in dollars", dollar_reporters: rows.length, foreign_reporters_left_out: Object.keys(REPORTS_IN).length,
  profile: { companies: prof.length, refreshed_today: prof.filter((r) => day(r.updated_ts) === today).length, market_value_is_price_times_shares: prof.filter((r) => r.price > 0 && r.market_cap > 0 && r.shares_out > 0 && Math.abs(r.market_cap / (r.price * r.shares_out) - 1) < 0.01).length },
  stored_over_today: { p5: r3(q(0.05)), p25: r3(q(0.25)), median: r3(q(0.5)), p75: r3(q(0.75)), p95: r3(q(0.95)), more_than_10pct_off: off(0.1), more_than_25pct_off: off(0.25), more_than_50pct_off: off(0.5) },
  fundamentals_row_age_days: { median: r3(ages[Math.floor(ages.length / 2)]), oldest: r3(ages[ages.length - 1]), rows: ages.length },
  jobs: { profile_refresh: jobs.filter((j) => j.fn === "fmp-backfill").slice(0, 3).map((j) => j.at), fundamentals_refresh: jobs.filter((j) => j.fn === "fmp-fundamentals").slice(0, 5).map((j) => ({ at: j.at, symbols: j.symbols })), mcap_refresh_runs_in_log: jobs.filter((j) => j.fn === "mcap-refresh").length },
  furthest: [...rows.slice(0, 8), ...rows.slice(-8)].map((r) => ({ ...r, stored_over_today: r3(r.stored_over_today) })) };
writeFileSync(process.argv[2] || "market-value-scan.json", JSON.stringify(doc, null, 1));
console.log("dollar reporters", doc.dollar_reporters, "·", JSON.stringify(doc.stored_over_today), "· profile:", JSON.stringify(doc.profile), "· fundamentals row age:", JSON.stringify(doc.fundamentals_row_age_days), "· jobs:", JSON.stringify(doc.jobs));
