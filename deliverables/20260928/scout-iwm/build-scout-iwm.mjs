#!/usr/bin/env node
/* SCOUT (28 Sep) — turns one scout run (the provider job services/scout/scout-job.mjs, branch
   provider/scout-20260928) into the two static data files the pages read:
     deliverables/20260928/scout-iwm/scout-iwm-data.js          IWM's holdings + the served names' review
     deliverables/20260928/etf-valuation/etf-valuation-data.js  fund P/E, total earnings, NAV premium, basket move
   Inputs (read-only): the job's JSON(.gz), the chart API /geiger answer, the chart API /universe answer.
   Usage: node build-scout-iwm.mjs --scout scout-out.json.gz --geiger geiger.json --universe universe.json */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// the provider branch commit the run used (the one-off machine's image does not stamp uploaded code)
const CODE = (process.argv.includes('--code') ? process.argv[process.argv.indexOf('--code') + 1] : null) || 'provider/scout-20260928'
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null }
const readJson = p => { const b = readFileSync(p); return JSON.parse((b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b).toString()) }
const toMassive = s => String(s || '').trim().toUpperCase().replace(/-/g, '.')
const r4 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4

export function buildIwm (scout, geiger, universe, fund = 'IWM') {
  const served = new Set(universe.symbols.map(toMassive))
  const by = new Map(scout.stocks.map(s => [s.t, s]))
  const bench = by.get(fund) || {}
  const G = geiger.symbols || {}
  const gOf = t => G[t] || G[t.replace(/\./g, '-')] || null
  const rows = []
  for (const h of scout.lists[fund] || []) {
    const s = by.get(h.t) || {}
    const rs3 = s.ret_3m != null && bench.ret_3m != null ? r4((1 + s.ret_3m) / (1 + bench.ret_3m) - 1) : null
    rows.push({ t: h.t, name: s.name || h.name, sector: s.sector || null, w: h.w, mcap: s.market_cap ?? null, dv: s.dollar_vol_20d ?? null,
      rsi: s.rsi14 ?? null, rsip: s.rsi_pct ?? null, v50: s.pct_vs_50 ?? null, v200: s.pct_vs_200 ?? null, hi: s.from_52w_high ?? null,
      ret3: s.ret_3m ?? null, rs3, pe: s.pe_ttm ?? null, de: s.debt_to_equity ?? null, earn: s.earnings_ttm ?? null, fcf: s.fcf_ttm ?? null,
      rep: s.next_report ?? null, chg: s.chg_today ?? null, served: served.has(h.t), priced: s.sessions > 0 })
  }
  const servedRows = rows.filter(r => r.served).map(r => { const g = gOf(r.t); return { ...r, geiger: g ? g.composite : null, gt: g ? g.trend : null, gm: g ? g.momentum : null } })
  const et = new Date(scout.snapshot_utc).toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }) + ' ET'
  const runDay = new Date(scout.computed_utc).toLocaleDateString('en-US', { timeZone: 'America/New_York', day: 'numeric', month: 'short' })
  const f = (scout.funds || []).find(x => x.fund === fund) || {}
  return {
    meta: { fund, holdings: rows.length, holdings_updated: String(f.holdings_updated || '').slice(0, 10), as_of: scout.as_of_session,
      today: new Date(scout.computed_utc).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }), snapshot_et: et, run_label: runDay,
      served_count: servedRows.length, served_weight: servedRows.reduce((a, r) => a + (r.w || 0), 0),
      unpriced: rows.filter(r => !r.priced).length, first_session: scout.first_session, sessions: scout.sessions,
      iwm: { rsi14: bench.rsi14, rsi_pct: bench.rsi_pct, pct_vs_50: bench.pct_vs_50, pct_vs_200: bench.pct_vs_200, from_52w_high: bench.from_52w_high, ret_3m: bench.ret_3m },
      geiger_computed_utc: geiger.computed_utc || null, code_commit: scout.code_commit, sources: scout.sources },
    rows, served: servedRows,
  }
}

// The holdings that move a fund's P/E most: the five biggest loss drags (weight × earnings yield most
// negative), and what the P/E would be without them — so an outlier is visible, never silently dropped.
export function drags (list) {
  const cov = list.filter(h => h.w > 0 && h.ey != null && Number.isFinite(h.ey))
  const W = cov.reduce((a, h) => a + h.w, 0), WE = cov.reduce((a, h) => a + h.w * h.ey, 0)
  const worst = cov.slice().sort((a, b) => a.w * a.ey - b.w * b.ey).slice(0, 5).filter(h => h.ey < 0)
  const w5 = worst.reduce((a, h) => a + h.w, 0), we5 = worst.reduce((a, h) => a + h.w * h.ey, 0)
  return { top_drags: worst.map(h => ({ t: h.t, name: h.name, w: r4(h.w), ey: r4(h.ey) })),
    pe_without_top_drags: WE - we5 > 0 ? Math.round((W - w5) / (WE - we5) * 100) / 100 : null }
}

export function runSummary (scout, iwm) {
  const secs = Math.round((Date.parse(scout.snapshot_utc) - Date.parse(scout.computed_utc)) / 1000)
  const src = scout.bar_sources || {}
  const priced = scout.stocks.filter(s => s.common && s.sessions > 0).length
  const et = t => new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) + ' ET'
  return {
    scout_count: `${priced.toLocaleString('en-US')} US stocks`,
    headline: `one pass over ${scout.sessions} trading days and ${priced.toLocaleString('en-US')} US common stocks took ${Math.floor(secs / 60)} min ${secs % 60} s, most of it waiting on FMP's bulk-file pacing; reading and computing the prices took under a minute.`,
    rows: [
      ['Ran', `${et(scout.computed_utc)} on a temporary Fly machine (batch app's keys, removed afterwards); provider code ${CODE}`],
      ['Price history', `${scout.first_session} → ${scout.as_of_session} · ${scout.sessions} trading days · ${(src.r2_day_aggs_v1 || 0)} from our R2 day files, ${(src.grouped_fetched || 0) + (src.breadth_grouped_cache || 0)} from Massive grouped daily`],
      ['Days with no data', (scout.missing_sessions || []).map(m => `${m.session} (${m.why === 'grouped_empty_0' ? 'market closed — national day of mourning' : m.why})`).join(', ') || 'none'],
      ['Splits applied', `${scout.splits_in_window.toLocaleString('en-US')} split events in the window`],
      ['Stocks with prices', `${priced.toLocaleString('en-US')} US common stocks (+ funds and served names: ${scout.stocks.length.toLocaleString('en-US')} rows)`],
      ['Company numbers', `${scout.counts.fmp_profiles.toLocaleString('en-US')} FMP profiles (all listings worldwide) · ratios and key metrics, one file each`],
      ['Funds', `${scout.counts.funds} funds with holdings (IWM, IJR, VB, SPY, QQQ and every fund the Hub carries)`],
      ['IWM', `${iwm.rows.length.toLocaleString('en-US')} holdings lines · ${iwm.rows.length - iwm.meta.unpriced} priced · ${iwm.meta.unpriced} are cash, collateral, rights (CVRs) or private lines with no price`],
      ['Check against Alan\'s own reading', `IWM RSI 14 = ${iwm.meta.iwm.rsi14} → higher than only ${iwm.meta.iwm.rsi_pct}% of its own days since ${scout.first_session} (Alan, 27 Sep: "IWM is at its bottom 7% RSI")`],
      ['Run time', `${Math.round(secs / 60)} min ${secs % 60} s from start to the last read`],
    ],
  }
}

// ---- corrections for a run made before the provider's valuation_rev 2 (provider/scout-20260928 4f85a7c) ----
// The 28 Sep 09:41 ET run predates three fixes the reviewer asked for. Everything needed to apply them is in
// the run itself, so the pages are corrected here the same way the job now computes them:
//  1. total earnings counted a company once per LINE: FMP puts the whole company's market cap on each share
//     class (GOOGL and GOOG both ≈ $4.1T), so Alphabet's ~$245B was added twice in SPY and QQQ. Lines are grouped
//     by the company they were priced from (same ticker, or same FMP company name — the run carries no ISINs)
//     and only the largest-weight line is kept. Only US$ lines are removed; any other currency is left and counted.
//  2. "fund's share" used FMP's per-holding dollar values, which are in the wrong units for some funds (IJR's
//     summed to $101,989 against $104.2B). When the sum is outside 0.5–2× the fund's assets, each holding's
//     dollars are weight ÷ total weight × assets instead.
//  3. FMP's "nav" field has no date and is often a copied close: no premium is computed; the page says which
//     close it equals (to the cent) or is nearest to.
const MV_AUM_OK = [0.5, 2]
export function lookThrough (list, aum) {
  const L = list.filter(h => Number.isFinite(h.w) && h.w > 0)
  const W = L.reduce((a, h) => a + h.w, 0)
  const mvSum = L.reduce((a, h) => a + (Number.isFinite(h.mv) ? h.mv : 0), 0)
  const ratio = aum > 0 ? mvSum / aum : null
  const source = ratio == null ? (mvSum > 0 ? 'fmp_unchecked' : null) : (ratio >= MV_AUM_OK[0] && ratio <= MV_AUM_OK[1]) ? 'fmp' : 'weight_x_aum'
  let e = 0, v = 0
  if (source) for (const h of L) {
    if (!Number.isFinite(h.ey)) continue
    const mv = source === 'weight_x_aum' ? h.w / W * aum : h.mv
    if (Number.isFinite(mv)) { e += mv * h.ey; v += mv }
  }
  return { fund_look_through_earnings_ttm: source ? Math.round(e) : null, fund_look_through_value: source ? Math.round(v) : null,
    market_value_to_aum: ratio == null ? null : Math.round(ratio * 1e4) / 1e4, market_value_source: source }
}
export function duplicateEarnings (list, byT) {
  const groups = new Map()
  for (const h of list) {
    const s = byT.get(h.t)
    if (!s || !Number.isFinite(s.earnings_ttm) || !(h.w > 0)) continue
    const key = (s.name || h.t).toLowerCase()
    ;(groups.get(key) || groups.set(key, []).get(key)).push({ t: h.t, w: h.w, e: s.earnings_ttm, usd: (s.currency || 'USD') === 'USD' })
  }
  let removed = 0, lines = 0; const pairs = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    g.sort((a, b) => b.w - a.w)
    const extra = g.slice(1).filter(x => x.usd)
    if (!extra.length) continue
    removed += extra.reduce((a, x) => a + x.e, 0); lines += extra.length
    pairs.push([g[0].t, ...extra.map(x => x.t)].join('+'))
  }
  return { removed: Math.round(removed), lines, pairs }
}
export function navFieldReading (nav, recentCloses = []) {
  const rc = (recentCloses || []).filter(c => c && Number.isFinite(c.c) && c.c > 0)
  if (!(nav > 0) || !rc.length) return { nav_field_equals_close: null, nav_field_nearest_close: null, nav_field_gap_to_nearest: null }
  let best = rc[0]
  for (const c of rc) if (Math.abs(c.c - nav) < Math.abs(best.c - nav)) best = c
  return { nav_field_equals_close: Math.abs(best.c - nav) < 0.005 ? best.d : null, nav_field_nearest_close: best.d,
    nav_field_gap_to_nearest: Math.round((nav / best.c - 1) * 1e5) / 1e5 }
}
export function correctFund (f, list, byT, legacy) {
  const { premium_vs_nav_live, premium_vs_nav_prev_close, ...rest } = f
  if (!legacy) return rest
  const dup = duplicateEarnings(list, byT)
  return { ...rest, ...lookThrough(list, f.aum), ...navFieldReading(f.nav, f.recent_closes),
    holdings_total_earnings_ttm: f.holdings_total_earnings_ttm - dup.removed,
    holdings_total_earnings_as_run: f.holdings_total_earnings_ttm,
    total_earnings_duplicate_lines: dup.lines, total_earnings_duplicates: dup.pairs }
}

export function buildFunds (scout, universe) {
  const served = new Set(universe.symbols.map(toMassive))
  const legacy = !(scout.valuation_rev >= 2)
  const byT = new Map(scout.stocks.map(s => [s.t, s]))
  return {
    meta: { computed_utc: scout.computed_utc, snapshot_utc: scout.snapshot_utc, as_of: scout.as_of_session, sources: scout.sources, code_commit: scout.code_commit,
      corrected_in_build: legacy ? ['total earnings: one line per company', "fund's share: holding dollars checked against assets", "FMP nav field: which close it matches, no premium"] : [] },
    funds: (scout.funds || []).map(f => ({ ...correctFund(f, scout.lists[f.fund] || [], byT, legacy), served: served.has(toMassive(f.fund)), ...drags(scout.lists[f.fund] || []),
      tech: f.tech ? { rsi14: f.tech.rsi14, rsi_pct: f.tech.rsi_pct, pct_vs_200: f.tech.pct_vs_200, ret_3m: f.tech.ret_3m } : null })),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scout = readJson(arg('scout')); const geiger = readJson(arg('geiger')); const universe = readJson(arg('universe'))
  const iwm = buildIwm(scout, geiger, universe)
  writeFileSync(join(HERE, 'scout-iwm-data.js'), '/* built by build-scout-iwm.mjs from one scout run — do not edit */\nwindow.SCOUT_IWM = ' + JSON.stringify(iwm) + ';\n')
  const etfDir = join(HERE, '..', 'etf-valuation'); mkdirSync(etfDir, { recursive: true })
  writeFileSync(join(etfDir, 'etf-valuation-data.js'), '/* built by scout-iwm/build-scout-iwm.mjs from one scout run — do not edit */\nwindow.ETF_VAL = ' + JSON.stringify(buildFunds(scout, universe)) + ';\n')
  writeFileSync(join(HERE, '..', 'scout', 'scout-run.js'), '/* built by scout-iwm/build-scout-iwm.mjs from one scout run — do not edit */\nwindow.SCOUT_RUN = ' + JSON.stringify(runSummary(scout, iwm)) + ';\n')
  console.log(JSON.stringify({ iwm_rows: iwm.rows.length, served: iwm.served.length, served_weight: iwm.meta.served_weight, unpriced: iwm.meta.unpriced, funds: scout.funds.length }))
}
