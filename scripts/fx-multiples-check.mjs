/* C5b (3 Oct 2026) · one currency per multiple: the FMP facts behind the check, on Fly. PRINTS JSON; writes nothing.
   Runs on a throw-away machine of scintilla-massive-stocks-batch (the FMP key is FMP_API_KEY there; never printed):
     node fx-multiples-check.mjs --sweep            every served symbol's statement currency (income-statement reportedCurrency)
     node fx-multiples-check.mjs PDD BABA AMZN …    per symbol: profile, quote, 8 quarterly income statements, 2 quarterly
                                                    balance sheets, the newest quarterly key-metrics row (the marketCap the
                                                    Hub's fundamentals.market_cap is copied from), annual estimates, and
                                                    FMP's own one-currency multiples (ratios-ttm, key-metrics-ttm); plus
                                                    the <CCY>USD daily closes since 2024 for every reporting currency met.
   /stable/ routes only. Output: one JSON document on stdout. */
const KEY = process.env.FMP_API_KEY || process.env.FMP_KEY;
if (!KEY) { console.error("no FMP key in the environment"); process.exit(2); }
const API = "https://scintilla-massive-chart-api.fly.dev", HUB = "https://scintillahub.ai", FMP = "https://financialmodelingprep.com/stable/";
const args = process.argv.slice(2), sweep = args.includes("--sweep"), asked = args.filter((a) => !a.startsWith("--")).map((s) => s.toUpperCase());
const get = async (ep, q) => {
  const qs = Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(`${FMP}${ep}?${qs}&apikey=${KEY}`); if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500)); continue; } if (!r.ok) return { status: r.status }; return await r.json(); }
    catch (e) { if (a === 2) return { err: String(e.message).slice(0, 80) }; }
  }
  return { status: 429 };
};
const pool = async (items, n, fn) => { let i = 0; const out = {}; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const s = items[i++]; out[s] = await fn(s); } })); return out; };
const pickIS = (r) => ({ date: r.date, period: r.period, fiscalYear: r.fiscalYear, reportedCurrency: r.reportedCurrency, revenue: r.revenue, grossProfit: r.grossProfit, operatingIncome: r.operatingIncome, ebitda: r.ebitda, netIncome: r.netIncome, eps: r.eps, epsDiluted: r.epsDiluted, weightedAverageShsOutDil: r.weightedAverageShsOutDil });
const pickBS = (r) => ({ date: r.date, period: r.period, reportedCurrency: r.reportedCurrency, netDebt: r.netDebt, totalDebt: r.totalDebt, cashAndCashEquivalents: r.cashAndCashEquivalents });
const arr = (x) => (Array.isArray(x) ? x : []);
const doc = { source: "FMP /stable/ (profile, quote, income-statement, balance-sheet-statement, key-metrics, analyst-estimates, ratios-ttm, key-metrics-ttm, historical-price-eod/light)", taken: new Date().toISOString() };
if (sweep) {
  const u = await (await fetch(API + "/universe", { headers: { Origin: HUB } })).json();
  const symbols = (u.symbols || []).filter((s) => !/USD$/.test(s));
  doc.sweep = await pool(symbols, 6, async (s) => { const j = arr(await get("income-statement", { symbol: s, limit: 1 })); return j[0] ? { ccy: j[0].reportedCurrency || null, date: j[0].date } : null; });
}
if (asked.length) {
  doc.companies = await pool(asked, 4, async (s) => {
    const [profile, quote, isq, bsq, kmq, est, rttm, kmttm] = await Promise.all([
      get("profile", { symbol: s }), get("quote", { symbol: s }), get("income-statement", { symbol: s, period: "quarter", limit: 8 }),
      get("balance-sheet-statement", { symbol: s, period: "quarter", limit: 2 }), get("key-metrics", { symbol: s, period: "quarter", limit: 1 }),
      get("analyst-estimates", { symbol: s, period: "annual", limit: 6 }), get("ratios-ttm", { symbol: s }), get("key-metrics-ttm", { symbol: s }),
    ]);
    const p = arr(profile)[0] || {}, q = arr(quote)[0] || {}, r = arr(rttm)[0] || {}, k = arr(kmttm)[0] || {}, m = arr(kmq)[0] || {};
    return {
      profile: { price: p.price, marketCap: p.marketCap, currency: p.currency, country: p.country, isAdr: p.isAdr, exchange: p.exchange },
      quote: { price: q.price, marketCap: q.marketCap, sharesOutstanding: q.sharesOutstanding, timestamp: q.timestamp },
      income_q: arr(isq).map(pickIS), balance_q: arr(bsq).map(pickBS),
      key_metrics_q: { date: m.date, reportedCurrency: m.reportedCurrency, marketCap: m.marketCap, enterpriseValue: m.enterpriseValue },
      estimates: arr(est).map((e) => ({ date: e.date, epsAvg: e.epsAvg, revenueAvg: e.revenueAvg, ebitdaAvg: e.ebitdaAvg })),
      fmp_ttm: { pe: r.priceToEarningsRatioTTM, ps: r.priceToSalesRatioTTM, ev_ebitda_ratios: r.enterpriseValueMultipleTTM, ev_sales_km: k.evToSalesTTM, ev_ebitda_km: k.evToEBITDATTM, marketCap_km: k.marketCap, enterpriseValue_km: k.enterpriseValueTTM, peg: r.priceToEarningsGrowthRatioTTM, fpeg: r.forwardPriceToEarningsGrowthRatioTTM },
    };
  });
  const ccys = [...new Set(Object.values(doc.companies).flatMap((c) => c.income_q.map((x) => x.reportedCurrency)).filter((c) => c && c !== "USD"))];
  doc.fx = await pool(ccys, 3, async (c) => arr(await get("historical-price-eod/light", { symbol: c + "USD", from: "2024-01-01" })).map((x) => [x.date, x.price]).sort((a, b) => a[0].localeCompare(b[0])));
}
process.stdout.write(JSON.stringify(doc));
