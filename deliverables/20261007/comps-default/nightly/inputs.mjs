/* THE NIGHTLY COMPS REBUILD · step 1 and 2 — the inputs. Designed 7 Oct 2026; NOT INSTALLED (see DESIGN.md).
   Reads only. Two sources, both the ones the Hub page itself reads:
     the chart API's /quotes        the settled close of the session, for every symbol the Hub serves
     the Hub's public tables        the fifteen the comps engine loads, through the Hub's public read key
   The key comes from the environment (SB_ANON_KEY) or the private file the knockout's tools already use (.anon beside
   deliverables/20261007/knockout/tools/, never committed) and is never printed. Nothing is written but the files beside the run.
     node inputs.mjs --day 2026-10-07 --out <scratch> [--check-only]
   Exit 0 = inputs written · exit 3 = the close has not settled yet (run again later) · exit 4 = a table could not be read.     */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const argv = process.argv.slice(2), opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const DAY = opt("--day"), OUT = opt("--out", "."), CHECK = argv.includes("--check-only"); if (!/^\d{4}-\d{2}-\d{2}$/.test(DAY || "")) { console.error("--day YYYY-MM-DD"); process.exit(2); }
export const SETTLED_SHARE = 0.95;   // the close counts as settled when this share of the stocks the Hub serves report it
const API = "https://scintilla-massive-chart-api.fly.dev", SB = "https://wadinxqplrggagkvrdag.supabase.co/rest/v1", ORIGIN = { Origin: "https://scintillahub.ai" };
const keyFile = path.join(WT, "deliverables/20261007/knockout/tools/.anon"), KEY = (process.env.SB_ANON_KEY || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, "utf8") : "")).trim();
const back = (n) => new Date(Date.parse(DAY + "T00:00:00Z") - n * 86400e3).toISOString().slice(0, 10);
async function get(url, headers, tries = 4) { for (let a = 0; ; a++) { try { const r = await fetch(url, { headers }); if (r.status === 200 || r.status === 206) return r; throw new Error("HTTP " + r.status); } catch (e) { if (a >= tries - 1) throw e; await new Promise((ok) => setTimeout(ok, 1500 * (a + 1))); } } }
async function table(p) { const rows = []; for (let from = 0; ; from += 1000) { const r = await get(`${SB}/${p}`, { apikey: KEY, Authorization: "Bearer " + KEY, Range: `${from}-${from + 999}`, "Range-Unit": "items" }), page = await r.json(); rows.push(...page); if (page.length < 1000) return rows; } }

/* 1 · the universe the Hub serves, then its closes in chunks */
if (!KEY) { console.error("no read key: set SB_ANON_KEY or place the knockout's .anon file"); process.exit(4); }
const tickers = (await table("tickers?select=ticker&order=ticker.asc")).map((r) => r.ticker);
const quotes = {}; let generated = null;
for (let i = 0; i < tickers.length; i += 60) { const j = await (await get(`${API}/quotes?symbols=${tickers.slice(i, i + 60).map(encodeURIComponent).join(",")}`, ORIGIN)).json(); generated = j.generated_utc || generated; Object.assign(quotes, j.quotes || {}); }
const stocks = Object.values(quotes).filter((q) => q && q.provider === "MASSIVE"), done = stocks.filter((q) => q.today_session_close_state === "COMPLETED" && q.today_session_close > 0 && q.today_session_et === DAY);
const share = stocks.length ? done.length / stocks.length : 0;
console.log(JSON.stringify({ day: DAY, asked: tickers.length, answered: Object.keys(quotes).length, stocks: stocks.length, closed_today: done.length, share: Number(share.toFixed(3)), needed: SETTLED_SHARE, generated_utc: generated }));
if (share < SETTLED_SHARE) { console.log(`NOT SETTLED: ${done.length} of ${stocks.length} stocks report a completed close for ${DAY}. Nothing is built; run again later.`); process.exit(3); }
if (CHECK) process.exit(0);
fs.mkdirSync(path.join(OUT, "snap"), { recursive: true });
fs.writeFileSync(path.join(OUT, "quotes-all-raw.json"), JSON.stringify({ fetched_utc: new Date().toISOString().replace(/\.\d+Z$/, "Z"), universe_count: tickers.length, quotes }));

/* 2 · the fifteen tables, the same columns the knockout's snapshot reads, dated from the day of the run */
const PLAN = [
  ["company_profile", "company_profile?select=ticker,name,exchange,sector,industry,market_cap,price,shares_out,is_etf,is_fund,is_adr,is_actively_trading,country,ipo_date,updated_ts,shares_outstanding,float_shares,dividend_yield,facts_as_of&order=ticker.asc"],
  ["ticker_industry", "ticker_industry?select=ticker,fmp_industry,fmp_sector,sic_code,sic_description&order=ticker.asc"], ["tickers", "tickers?select=*&order=ticker.asc"], ["ticker_cohorts", "ticker_cohorts?select=ticker,cohort&order=ticker.asc,cohort.asc"],
  ["fmp_peers", "fmp_peers?select=ticker,peer,position,fetched_at&order=ticker.asc,position.asc"], ["peer_sources", "peer_sources?select=ticker,peer,source,position,fetched_at&order=ticker.asc,source.asc,position.asc"], ["fundamentals", "fundamentals?select=*&order=ticker.asc"],
  ["analyst_estimates", `analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_eps_high,est_eps_low,est_revenue_avg,price_target_avg,num_analysts_eps,num_analysts_rev,updated_ts&fiscal_date=gte.${back(645)}&order=ticker.asc,period.asc,fiscal_date.asc`],
  ["fundamentals_history", `fundamentals_history?select=*&fiscal_date=gte.${back(1500)}&order=ticker.asc,fiscal_date.desc`], ["cashflow_history", `cashflow_history?select=ticker,period,fiscal_year,fiscal_date,operating_cf,capex,free_cf,stock_comp&fiscal_date=gte.${back(2200)}&order=ticker.asc,fiscal_date.desc`],
  ["balance_history", `balance_history?select=*&fiscal_date=gte.${back(800)}&order=ticker.asc,fiscal_date.desc`], ["composite_staged", "composite_staged?select=ticker,tf,composite,updated_ts&tf=eq.D&order=ticker.asc,updated_ts.desc"],
  ["filer_currency", "filer_currency?select=ticker,reported_currency,listing_currency,is_adr,shares_dil,statement_date,source&order=ticker.asc"], ["fx_rates", `fx_rates?select=pair,date,rate&date=gte.${back(1200)}&order=date.asc,pair.asc`],
  ["earnings_events", `earnings_events?select=ticker,date,eps_actual,eps_estimate,revenue_actual,revenue_estimate,surprise_pct,report_time,confirmed,superseded_at&date=gte.${back(860)}&order=ticker.asc,date.asc`],
];
const meta = {};
for (const [name, p] of PLAN) { try { const rows = await table(p); fs.writeFileSync(path.join(OUT, "snap", name + ".json"), JSON.stringify(rows)); meta[name] = { rows: rows.length, path: p, read_utc: new Date().toISOString() }; console.log(name.padEnd(22), "rows", rows.length); } catch (e) { console.error(name, "could not be read:", String(e.message || e).slice(0, 120)); process.exit(4); } }
fs.writeFileSync(path.join(OUT, "snap", "_meta.json"), JSON.stringify(meta, null, 1));
