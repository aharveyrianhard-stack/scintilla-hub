// D2 (6 Oct 2026) · read-only: what FMP answers for the funds that have no stored fund facts (etf_info / etf_holdings).
// Runs on a throw-away batch machine (the FMP key exists only there). PRINTS one JSON — never the key, never a URL, no table write.
// Per fund: the info row (the same fields fmp-backfill?job=etf stores) and the ten largest lines + the line count.
const K = process.env.FMP_API_KEY || process.env.FMP_KEY || ''
if (!K) { console.log(JSON.stringify({ error: 'no FMP key in the environment' })); process.exit(0) }
const funds = (process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean)
const base = 'https://financialmodelingprep.com/stable', N = (v) => (v == null || v === '' || !isFinite(+v)) ? null : +v
const get = async (path) => { try { const r = await fetch(base + path + '&apikey=' + K, { signal: AbortSignal.timeout(25000) }); if (!r.ok) return { http: r.status }; return await r.json() } catch (e) { return { err: String(e && e.name || e).slice(0, 40) } } }
const out = { read_utc: new Date().toISOString(), asked: funds.length, funds: {} }
for (let i = 0; i < funds.length; i += 4) {
  await Promise.all(funds.slice(i, i + 4).map(async (t) => {
    const [h, inf] = await Promise.all([get('/etf/holdings?symbol=' + encodeURIComponent(t)), get('/etf/info?symbol=' + encodeURIComponent(t))])
    const d = Array.isArray(inf) ? inf[0] : null, seen = new Set(), rows = []
    for (const x of (Array.isArray(h) ? h : [])) { const name = String(x.name || x.asset || ''); if (!x.asset || !name || seen.has(name)) continue; seen.add(name); rows.push({ asset: x.asset, name, weight_pct: N(x.weightPercentage) }) }
    rows.sort((a, b) => (b.weight_pct ?? -1) - (a.weight_pct ?? -1))
    out.funds[t] = { info: d && d.symbol ? { name: d.name, description: d.description, etf_company: d.etfCompany, expense_ratio: N(d.expenseRatio), aum: N(d.assetsUnderManagement), inception_date: d.inceptionDate, holdings_count: N(d.holdingsCount), sectors: Array.isArray(d.sectorsList) ? d.sectorsList : null } : null,
      info_answer: Array.isArray(inf) ? inf.length : inf, lines: rows.length, raw_lines: Array.isArray(h) ? h.length : h, top10: rows.slice(0, 10) }
  }))
}
console.log(JSON.stringify(out))
