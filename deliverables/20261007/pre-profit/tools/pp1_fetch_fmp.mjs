#!/usr/bin/env node
// PP1 · the keyed leg. Runs on a THROW-AWAY Fly machine (the vendor key lives only there) and PRINTS one document:
// for each ticker the quarterly income statement, balance sheet and cash-flow statement (the lines the Hub's own
// tables do not hold: short-term investments, interest, how the build-out was paid for), the analysts' annual
// estimates with their high and low, and — with CALLS=1 — the newest earnings calls' text.
// It writes to no table and never prints the key or a URL that carries it. FMP /stable/ routes only.
//
//   TICKERS=CRWV,IREN PROBE=1 node pp1_fetch_fmp.mjs      # field names and row counts only
//   TICKERS=… QUARTERS=32 node pp1_fetch_fmp.mjs          # statements + estimates
//   TICKERS=… CALLS=2 ONLY=calls node pp1_fetch_fmp.mjs   # the two newest calls' text
import { gzipSync } from "node:zlib"
const BASE = "https://financialmodelingprep.com/stable/"
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])
export const redact = (s) => String(s).replace(/([?&]apikey=)[^&\s]*/gi, "$1***")

export function makeFmp({ key, fetchFn = fetch, sleepFn = (ms) => new Promise((r) => setTimeout(r, ms)), attempts = 5, stats = { calls: 0, retries: 0 } }) {
  if (!key) throw new Error("no vendor key in this environment (value not logged)")
  const fmp = async function (path) {
    const url = BASE + path + (path.includes("?") ? "&" : "?") + "apikey=" + encodeURIComponent(key)
    for (let used = 1; ; used++) {
      let res
      stats.calls++
      try { res = await fetchFn(url, { signal: AbortSignal.timeout(45000) }) } catch (e) {
        if (used >= attempts) throw new Error(`${path.split("?")[0]}: ${redact(e.message).slice(0, 120)}`)
        stats.retries++; await sleepFn(500 * used); continue
      }
      if (res.status === 200) { const j = await res.json(); if (j && j["Error Message"]) throw new Error(`${path.split("?")[0]}: rejected`); return j }
      if (!RETRYABLE.has(res.status) || used >= attempts) throw new Error(`${path.split("?")[0]}: http ${res.status}`)
      stats.retries++; await sleepFn((res.status === 429 ? 2500 : 500) * used)
    }
  }
  fmp.stats = stats
  return fmp
}

// the lines kept from each statement: [our name, the vendor's names for it, first that is present wins]
export const KEEP = {
  income: [["date", ["date"]], ["filed", ["filingDate", "fillingDate", "acceptedDate"]], ["fy", ["fiscalYear", "calendarYear"]], ["period", ["period"]], ["ccy", ["reportedCurrency"]],
    ["revenue", ["revenue"]], ["gross_profit", ["grossProfit"]], ["operating_income", ["operatingIncome"]], ["ebitda", ["ebitda"]], ["ebit", ["ebit"]],
    ["dep_amort", ["depreciationAndAmortization"]], ["interest_expense", ["interestExpense"]], ["interest_income", ["interestIncome"]], ["net_interest", ["netInterestIncome"]],
    ["pretax", ["incomeBeforeTax"]], ["tax", ["incomeTaxExpense"]], ["net_income", ["netIncome"]], ["shares", ["weightedAverageShsOut"]], ["shares_dil", ["weightedAverageShsOutDil"]],
    ["eps_dil", ["epsDiluted", "epsdiluted"]], ["rnd", ["researchAndDevelopmentExpenses"]], ["sga", ["sellingGeneralAndAdministrativeExpenses"]]],
  balance: [["date", ["date"]], ["filed", ["filingDate", "fillingDate", "acceptedDate"]], ["period", ["period"]], ["ccy", ["reportedCurrency"]],
    ["cash", ["cashAndCashEquivalents"]], ["sti", ["shortTermInvestments"]], ["cash_sti", ["cashAndShortTermInvestments"]], ["lt_investments", ["longTermInvestments"]],
    ["current_assets", ["totalCurrentAssets"]], ["ppe_net", ["propertyPlantEquipmentNet"]], ["total_assets", ["totalAssets"]],
    ["short_debt", ["shortTermDebt"]], ["long_debt", ["longTermDebt"]], ["leases", ["capitalLeaseObligations"]], ["leases_current", ["capitalLeaseObligationsCurrent"]], ["leases_noncurrent", ["capitalLeaseObligationsNonCurrent"]],
    ["total_debt", ["totalDebt"]], ["net_debt", ["netDebt"]], ["deferred_revenue", ["deferredRevenue"]], ["deferred_revenue_nc", ["deferredRevenueNonCurrent"]],
    ["current_liabilities", ["totalCurrentLiabilities"]], ["total_liabilities", ["totalLiabilities"]], ["equity", ["totalStockholdersEquity"]], ["preferred", ["preferredStock"]], ["minority", ["minorityInterest"]]],
  cashflow: [["date", ["date"]], ["filed", ["filingDate", "fillingDate", "acceptedDate"]], ["period", ["period"]], ["ccy", ["reportedCurrency"]],
    ["operating_cf", ["netCashProvidedByOperatingActivities", "operatingCashFlow"]], ["capex", ["capitalExpenditure"]], ["ppe_spend", ["investmentsInPropertyPlantAndEquipment"]],
    ["acquisitions", ["acquisitionsNet"]], ["buy_investments", ["purchasesOfInvestments"]], ["sell_investments", ["salesMaturitiesOfInvestments"]],
    ["net_debt_issued", ["netDebtIssuance"]], ["lt_debt_issued", ["longTermNetDebtIssuance"]], ["st_debt_issued", ["shortTermNetDebtIssuance"]],
    ["net_stock_issued", ["netStockIssuance"]], ["net_common_issued", ["netCommonStockIssuance"]], ["common_issued", ["commonStockIssuance"]], ["common_bought", ["commonStockRepurchased"]],
    ["net_preferred_issued", ["netPreferredStockIssuance"]], ["dividends", ["commonDividendsPaid", "netDividendsPaid"]], ["other_financing", ["otherFinancingActivities"]],
    ["financing_cf", ["netCashProvidedByFinancingActivities"]], ["investing_cf", ["netCashProvidedByInvestingActivities"]], ["stock_comp", ["stockBasedCompensation"]],
    ["dep_amort", ["depreciationAndAmortization"]], ["free_cf", ["freeCashFlow"]], ["interest_paid", ["interestPaid"]], ["working_capital", ["changeInWorkingCapital"]]],
  estimates: [["date", ["date"]], ["revenue_low", ["revenueLow"]], ["revenue_high", ["revenueHigh"]], ["revenue_avg", ["revenueAvg"]], ["ebitda_avg", ["ebitdaAvg"]], ["ebitda_low", ["ebitdaLow"]], ["ebitda_high", ["ebitdaHigh"]],
    ["ebit_avg", ["ebitAvg"]], ["net_income_avg", ["netIncomeAvg"]], ["eps_avg", ["epsAvg"]], ["eps_low", ["epsLow"]], ["eps_high", ["epsHigh"]], ["n_rev", ["numAnalystsRevenue"]], ["n_eps", ["numAnalystsEps"]]],
}
/** rows of vendor objects → { cols, rows } keeping only the lines above (a line the vendor does not send is null) */
export function compact(rows, kind) {
  const keep = KEEP[kind], list = Array.isArray(rows) ? rows : []
  // a number sent as text becomes a number; a date (or any other text) is kept as its first ten characters
  const val = (v) => (typeof v !== "string" ? v : /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()) ? Number(v) : v.slice(0, 10))
  return { cols: keep.map(([n]) => n), rows: list.map((r) => keep.map(([, alts]) => { for (const a of alts) if (r[a] !== undefined && r[a] !== null) return val(r[a]); return null })) }
}
const PATHS = (t, q) => ({
  income: `income-statement?symbol=${encodeURIComponent(t)}&period=quarter&limit=${q}`,
  balance: `balance-sheet-statement?symbol=${encodeURIComponent(t)}&period=quarter&limit=${q}`,
  cashflow: `cash-flow-statement?symbol=${encodeURIComponent(t)}&period=quarter&limit=${q}`,
  estimates: `analyst-estimates?symbol=${encodeURIComponent(t)}&period=annual&page=0&limit=12`,
})
export async function fetchTicker(fmp, ticker, { quarters = 32, calls = 0, only = null, probe = false }) {
  const out = { t: ticker, errors: [] }
  const step = async (name, fn) => { try { return await fn() } catch (e) { out.errors.push(`${name}: ${redact(e.message).slice(0, 140)}`); return null } }
  if (only !== "calls") {
    const P = PATHS(ticker, quarters)
    for (const kind of Object.keys(P)) {
      const rows = await step(kind, () => fmp(P[kind]))
      if (probe) out[kind] = { n: Array.isArray(rows) ? rows.length : null, keys: Array.isArray(rows) && rows[0] ? Object.keys(rows[0]) : [] }
      else out[kind] = compact(rows, kind)
    }
  }
  if (calls > 0) {
    const dates = await step("call-dates", () => fmp(`earning-call-transcript-dates?symbol=${encodeURIComponent(ticker)}`))
    const list = (Array.isArray(dates) ? dates : []).map((r) => ({ year: r.fiscalYear ?? r.year, quarter: r.quarter, date: String(r.date || "").slice(0, 10) })).sort((a, b) => (a.date < b.date ? 1 : -1))
    out.calls_on_file = list.length; out.calls = []
    for (const c of list.slice(0, calls)) {
      const t = await step("call", () => fmp(`earning-call-transcript?symbol=${encodeURIComponent(ticker)}&year=${c.year}&quarter=${c.quarter}`))
      const row = Array.isArray(t) ? t[0] : t
      if (row && row.content) out.calls.push({ year: c.year, quarter: c.quarter, date: String(row.date || c.date).slice(0, 10), content: probe ? String(row.content).slice(0, 200) : row.content })
    }
  }
  return out
}
export async function run({ env, nowMs, fetchFn = fetch }) {
  const tickers = String(env.TICKERS || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  if (!tickers.length) throw new Error("TICKERS is empty")
  const fmp = makeFmp({ key: env.FMP_API_KEY || env.FMP_KEY, fetchFn })
  const opt = { quarters: Number(env.QUARTERS || 32), calls: Number(env.CALLS || 0), only: env.ONLY || null, probe: env.PROBE === "1" }
  const names = new Array(tickers.length); let next = 0
  const worker = async () => { for (;;) { const i = next++; if (i >= tickers.length) return; names[i] = await fetchTicker(fmp, tickers[i], opt) } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(Number(env.POOL || 4), 8)) }, worker))
  return { schema: "scintilla.pre_profit.fmp_leg.v1", fetched_utc: new Date(nowMs).toISOString(), took_s: Math.round((Date.now() - nowMs) / 1000), calls: fmp.stats.calls, retries: fmp.stats.retries, options: opt, names }
}
import { pathToFileURL } from "node:url"
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ env: process.env, nowMs: Date.now() })
    .then((doc) => {
      if (process.env.PROBE === "1") { process.stdout.write(JSON.stringify(doc, null, 1) + "\n"); return }
      const b64 = gzipSync(Buffer.from(JSON.stringify(doc))).toString("base64")       // packed: a few megabytes over a console line otherwise
      process.stdout.write("PP1-BEGIN\n"); for (let i = 0; i < b64.length; i += 4000) process.stdout.write(b64.slice(i, i + 4000) + "\n"); process.stdout.write("PP1-END\n")
    })
    .catch((e) => { console.error(redact(e.message)); process.exit(1) })
}
