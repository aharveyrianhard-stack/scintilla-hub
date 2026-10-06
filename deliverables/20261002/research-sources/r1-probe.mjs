// r1-probe.mjs — R1 research probe (2 Oct 2026). Runs once on a throw-away Fly machine of
// scintilla-massive-stocks-batch, reads FMP_KEY and MASSIVE_KEY from the environment, calls READ-ONLY
// routes and prints ONE JSON document to stdout. Nothing is written anywhere. The keys never appear in
// the output: every route is recorded without its key and the final text is scrubbed of both values.
import { readFileSync } from "node:fs";

let FMP = process.env.FMP_KEY || process.env.FMP_API_KEY || "", FMP_SOURCE = process.env.FMP_KEY ? "env FMP_KEY" : (process.env.FMP_API_KEY ? "env FMP_API_KEY" : "");
const MAS = process.env.MASSIVE_KEY || "";
if (!FMP && process.env.MASSIVE_DATABASE_URL) {
  // the provider's own pattern (services/fmp-lane/pre2003-daily.mjs): the FMP key lives in app_config; read it once, never log it
  try { const { default: pg } = await import("pg"); const c = new pg.Client({ connectionString: process.env.MASSIVE_DATABASE_URL, ssl: process.env.MASSIVE_DATABASE_CA ? { rejectUnauthorized: true, ca: process.env.MASSIVE_DATABASE_CA.replaceAll(String.raw`\n`, "\n") } : { rejectUnauthorized: false } }); await c.connect();   // Q5 (5 Oct): the certificate is checked when the database's authority is supplied — the provider repo's packages/db/tls.mjs is the one documented home of this rule
    const { rows } = await c.query("select value from public.app_config where key='FMP_KEY' limit 1"); await c.end();
    FMP = (rows?.[0]?.value || "").trim(); if (FMP) FMP_SOURCE = "app_config.FMP_KEY via MASSIVE_DATABASE_URL"; } catch (e) { FMP_SOURCE = "app_config read failed: " + String(e).slice(0, 120); }
}
const U = JSON.parse(readFileSync("/app/r1-universe.json", "utf8")).rows;
const UNI = new Set(U.map((r) => r.ticker));
const FMP2HUB = new Map(U.map((r) => [r.fmp, r.ticker]));
const inUni = (sym) => UNI.has(sym) || FMP2HUB.has(sym);

const out = { ran_at: new Date().toISOString(), keys_present: { FMP: !!FMP, FMP_SOURCE, MASSIVE_KEY: !!MAS },
  calls: { fmp: 0, massive: 0, sec: 0 }, probes: [], derived: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TODAY = "2026-10-02";

async function call(provider, name, path, params = {}, keep = 3, extra = null) {
  const base = provider === "fmp" ? "https://financialmodelingprep.com/stable/" : "https://api.massive.com";
  const u = new URL(base + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const shown = u.pathname + u.search;
  const init = { headers: { "User-Agent": "scintilla-r1-probe/1.0" }, signal: AbortSignal.timeout(45000) };
  if (provider === "fmp") u.searchParams.set("apikey", FMP); else init.headers.Authorization = "Bearer " + MAS;
  const t0 = Date.now();
  let status = 0, text = "", body = null;
  let hdr = null;
  try { const r = await fetch(u, init); status = r.status; text = await r.text(); try { body = JSON.parse(text); } catch { body = null; } hdr = { sunset: r.headers.get("sunset"), link: r.headers.get("link"), deprecation: r.headers.get("deprecation") }; }
  catch (e) { status = -1; text = String(e); }
  out.calls[provider]++;
  const arr = Array.isArray(body) ? body : (body && Array.isArray(body.results) ? body.results : null);
  const rec = { provider, name, route: shown, status, ms: Date.now() - t0, bytes: text.length, ...(hdr && (hdr.sunset || hdr.link || hdr.deprecation) ? { deprecation_headers: hdr } : {}),
    rows: arr ? arr.length : (body ? 1 : 0),
    fields: arr ? (arr[0] && typeof arr[0] === "object" ? Object.keys(arr[0]) : []) : (body && typeof body === "object" ? Object.keys(body) : []),
    sample: arr ? arr.slice(0, keep) : (body ?? text.slice(0, 300)) };
  if (body && !Array.isArray(body) && typeof body === "object" && arr) rec.envelope = Object.fromEntries(Object.entries(body).filter(([k]) => k !== "results").map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 120) : v]));
  if (extra) { try { rec.extra = extra(body, arr); } catch (e) { rec.extra = { error: String(e).slice(0, 200) }; } }
  out.probes.push(rec);
  await sleep(provider === "fmp" ? 220 : 60);
  return { status, body, arr };
}

out.errors = [];
const section = async (name, fn) => { try { await fn(); } catch (e) { out.errors.push({ section: name, error: String(e && e.stack || e).slice(0, 600) }); } };
await section("Q1", async () => {
/* ---------- Q1 · IPO lock-up / unlock dates ---------- */
const IPO5 = ["ALAB", "ARM", "RDDT", "CRWV", "NBIS"];
const WINDOWS = [["2023-09-01", "2023-09-30"], ["2024-03-01", "2024-03-31"], ["2024-10-01", "2024-10-31"], ["2025-03-01", "2025-04-15"], ["2025-10-01", TODAY]];
const q1 = { calendar_rows_in_universe: [], disclosure_in_universe: [], prospectus_in_universe: [], per_name: {} };
for (const [from, to] of WINDOWS) {
  const c = await call("fmp", `ipos-calendar ${from}..${to}`, "ipos-calendar", { from, to }, 3,
    (b, a) => ({ symbols_in_universe: (a || []).filter((r) => inUni(r.symbol)).map((r) => ({ symbol: r.symbol, date: r.date, company: r.company, exchange: r.exchange, actions: r.actions, shares: r.shares, priceRange: r.priceRange, marketCap: r.marketCap })) }));
  for (const r of c.arr || []) if (inUni(r.symbol)) q1.calendar_rows_in_universe.push({ window: from + ".." + to, ...r });
  const d = await call("fmp", `ipos-disclosure ${from}..${to}`, "ipos-disclosure", { from, to }, 3,
    (b, a) => ({ symbols_in_universe: (a || []).filter((r) => inUni(r.symbol)).slice(0, 40) }));
  for (const r of d.arr || []) if (inUni(r.symbol)) q1.disclosure_in_universe.push({ window: from + ".." + to, ...r });
  const p = await call("fmp", `ipos-prospectus ${from}..${to}`, "ipos-prospectus", { from, to }, 3,
    (b, a) => ({ symbols_in_universe: (a || []).filter((r) => inUni(r.symbol)).slice(0, 40) }));
  for (const r of p.arr || []) if (inUni(r.symbol)) q1.prospectus_in_universe.push({ window: from + ".." + to, ...r });
}
const SEC_UA = { "User-Agent": "ScintillaHub research research@scintillahub.ai", "Accept-Encoding": "gzip, deflate" };
async function lockupClause(url) {
  // reads the public filing document and returns the sentences that mention a lock-up — the text FMP/Massive do not carry
  out.calls.sec++;
  try {
    const r = await fetch(url, { headers: SEC_UA, signal: AbortSignal.timeout(40000) });
    const html = await r.text();
    const txt = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    const hits = [];
    const re = /[^.]{0,220}lock-?up[^.]{0,260}\./gi;
    let m, n = 0;
    while ((m = re.exec(txt)) && n < 60) { n++; if (/\b(\d{2,3})\s*days?\b/i.test(m[0])) hits.push(m[0].trim()); }
    const days = [...txt.matchAll(/lock-?up[^.]{0,200}?\b(\d{2,3})\s*days?\b/gi)].map((x) => Number(x[1]));
    return { status: r.status, bytes: html.length, mentions_total: n, clauses_with_days: hits.slice(0, 6), day_counts_seen: [...new Set(days)].slice(0, 10) };
  } catch (e) { return { error: String(e).slice(0, 200) }; }
}
for (const s of IPO5) {
  const per = {};
  const prof = await call("fmp", `profile ${s}`, "profile", { symbol: s }, 1, (b, a) => ({ ipoDate: a?.[0]?.ipoDate, companyName: a?.[0]?.companyName, cik: a?.[0]?.cik, exchange: a?.[0]?.exchange }));
  per.fmp_profile_ipoDate = prof.arr?.[0]?.ipoDate ?? null;
  const f = await call("fmp", `sec-filings-search/symbol ${s} (IPO forms)`, "sec-filings-search/symbol", { symbol: s, from: "2023-01-01", to: TODAY, page: 0, limit: 1000 }, 2,
    (b, a) => ({ forms: Object.entries((a || []).reduce((m, r) => (m[r.formType] = (m[r.formType] || 0) + 1, m), {})),
      ipo_forms: (a || []).filter((r) => /^(S-1|S-1\/A|424B4|424B1|F-1|F-1\/A|424B3)$/.test(r.formType)).map((r) => ({ formType: r.formType, filingDate: r.filingDate, acceptedDate: r.acceptedDate, link: r.link || r.finalLink })).slice(0, 12) }));
  const ipoForms = (f.arr || []).filter((r) => /^(424B4|424B1|S-1|F-1)$/.test(r.formType)).sort((a, b) => String(a.filingDate).localeCompare(String(b.filingDate)));
  per.fmp_ipo_forms = ipoForms.map((r) => ({ formType: r.formType, filingDate: r.filingDate, link: r.finalLink || r.link })).slice(0, 6);
  const final = ipoForms.find((r) => /^424B/.test(r.formType)) || ipoForms[0];
  if (final && (final.finalLink || final.link)) per.lockup_clause_from_sec = { form: final.formType, filingDate: final.filingDate, link: final.finalLink || final.link, ...(await lockupClause(final.finalLink || final.link)) };
  const mi = await call("massive", `vX/reference/ipos ${s}`, "/vX/reference/ipos", { ticker: s, limit: 10 }, 5);
  per.massive_ipos_fields = mi.arr?.[0] ? Object.keys(mi.arr[0]) : [];
  per.massive_ipos_rows = (mi.arr || []).map((r) => ({ listing_date: r.listing_date, ipo_status: r.ipo_status, announced_date: r.announced_date, final_issue_price: r.final_issue_price, total_offer_size: r.total_offer_size, shares_outstanding: r.shares_outstanding, lockup: r.lockup_expiration_date ?? r.lock_up_expiration_date ?? r.lockup ?? null }));
  const mt = await call("massive", `v3/reference/tickers/${s}`, `/v3/reference/tickers/${s}`, {}, 1);
  const t = mt.body?.results || {};
  per.massive_ticker = { list_date: t.list_date, share_class_shares_outstanding: t.share_class_shares_outstanding, weighted_shares_outstanding: t.weighted_shares_outstanding, market_cap: t.market_cap, sic_code: t.sic_code, sic_description: t.sic_description, cik: t.cik };
  const ipoDate = per.fmp_profile_ipoDate || per.massive_ipos_rows?.[0]?.listing_date || t.list_date || null;
  per.ipo_date_used = ipoDate;
  if (ipoDate) { const d = new Date(ipoDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 180); per.unlock_if_180_days = d.toISOString().slice(0, 10); per.unlock_is_assumption = true; }
  q1.per_name[s] = per;
}
const massiveRecent = await call("massive", "vX/reference/ipos last 12 months", "/vX/reference/ipos", { "listing_date.gte": "2025-10-01", limit: 250, sort: "listing_date", order: "desc" }, 3,
  (b, a) => ({ total: (a || []).length, in_universe: (a || []).filter((r) => inUni(r.ticker)).map((r) => ({ ticker: r.ticker, listing_date: r.listing_date, ipo_status: r.ipo_status, issuer_name: r.issuer_name })), statuses: Object.entries((a || []).reduce((m, r) => (m[r.ipo_status] = (m[r.ipo_status] || 0) + 1, m), {})) }));
q1.massive_recent_in_universe = (massiveRecent.arr || []).filter((r) => inUni(r.ticker)).map((r) => ({ ticker: r.ticker, listing_date: r.listing_date, ipo_status: r.ipo_status }));
// the docs the API itself exposes: the OpenAPI spec, searched for anything about lock-ups, dilution or offerings
{
  out.calls.massive++;
  let spec = "", st = 0;
  try { const r = await fetch("https://api.massive.com/openapi", { headers: { Authorization: "Bearer " + MAS, "User-Agent": "scintilla-r1-probe/1.0" }, signal: AbortSignal.timeout(45000) }); st = r.status; spec = await r.text(); } catch (e) { spec = ""; st = -1; }
  const find = (re) => { const o = []; let m; while ((m = re.exec(spec)) && o.length < 12) o.push(spec.slice(Math.max(0, m.index - 90), m.index + 110).replace(/\s+/g, " ")); return o; };
  let ipoProps = null;
  try { const j = JSON.parse(spec); const p = j.paths?.["/vX/reference/ipos"]; const sch = p?.get?.responses?.["200"]?.content?.["application/json"]?.schema; const props = sch?.properties?.results?.items?.properties; ipoProps = props ? Object.keys(props) : null; } catch { ipoProps = null; }
  q1.massive_openapi = { status: st, bytes: spec.length, ipos_result_fields: ipoProps, mentions_lockup: find(/lock[- ]?up/gi), mentions_dilution: find(/dilut/gi), mentions_offering: find(/offering/gi).slice(0, 6), paths_with_ipo: (spec.match(/"\/[^"]*ipo[^"]*"/gi) || []).slice(0, 10) };
}
out.derived.q1 = q1;
});
await section("Q2", async () => {

/* ---------- Q2 · dilution signals ---------- */
const q2 = { filers_in_universe: {}, names: {} };
const FROM30 = "2026-09-02";
for (const form of ["424B5", "424B4", "S-3", "S-3ASR", "424B3", "S-1"]) {
  const r = await call("fmp", `sec-filings-search/form-type ${form} last 30 days`, "sec-filings-search/form-type", { formType: form, from: FROM30, to: TODAY, page: 0, limit: 1000 }, 2,
    (b, a) => ({ total: (a || []).length, distinct_symbols: new Set((a || []).map((x) => x.symbol)).size, in_universe: (a || []).filter((x) => inUni(x.symbol)).map((x) => ({ symbol: x.symbol, filingDate: x.filingDate, acceptedDate: x.acceptedDate, link: x.finalLink || x.link })).slice(0, 60) }));
  q2.filers_in_universe[form] = (r.arr || []).filter((x) => inUni(x.symbol)).map((x) => ({ symbol: x.symbol, filingDate: x.filingDate, acceptedDate: x.acceptedDate, link: x.finalLink || x.link }));
}
await call("fmp", "sec-filings-8k last 7 days (fields only)", "sec-filings-8k", { from: "2026-09-25", to: TODAY, page: 0, limit: 1000 }, 2,
  (b, a) => ({ total: (a || []).length, in_universe: (a || []).filter((x) => inUni(x.symbol)).length, has_items_field: !!(a?.[0] && Object.keys(a[0]).some((k) => /item/i.test(k))) }));
await call("fmp", "shares-float-all (bulk, page 0)", "shares-float-all", { page: 0, limit: 5 }, 3);
// three names: universe names that filed a 424B5 / 424B4 / S-3 in the last 30 days, newest first; else the newest non-universe 424B5 filers
const cand = [];
for (const form of ["424B5", "424B4", "S-3", "S-3ASR"]) for (const x of q2.filers_in_universe[form] || []) cand.push({ ...x, form });
cand.sort((a, b) => String(b.filingDate).localeCompare(String(a.filingDate)));
let picked = [...new Set(cand.map((x) => x.symbol))].slice(0, 3);
q2.pick_source = picked.length ? "universe filers (424B5/424B4/S-3) last 30 days" : "no universe filer found; newest 424B5 filers overall";
if (picked.length < 3) {
  const all = out.probes.find((p) => p.name.startsWith("sec-filings-search/form-type 424B5"))?.extra;
  const r = out.probes.find((p) => p.name.startsWith("sec-filings-search/form-type 424B5"));
  const more = Array.isArray(r?.sample) ? r.sample.map((x) => x.symbol) : [];
  for (const s of more) if (picked.length < 3 && s && !picked.includes(s)) picked.push(s);
}
q2.picked = picked;
for (const s of picked) {
  const n = { filings_in_window: cand.filter((x) => x.symbol === s).map((x) => ({ form: x.form, filingDate: x.filingDate, link: x.link })) };
  const sf = await call("fmp", `shares-float ${s}`, "shares-float", { symbol: s }, 1);
  n.shares_float_now = sf.arr?.[0] || null;
  const ev = await call("fmp", `enterprise-values ${s} quarterly`, "enterprise-values", { symbol: s, period: "quarter", limit: 8 }, 8);
  n.shares_by_quarter = (ev.arr || []).map((r) => ({ date: r.date, numberOfShares: r.numberOfShares, marketCapitalization: r.marketCapitalization }));
  const is = await call("fmp", `income-statement ${s} quarterly (share counts)`, "income-statement", { symbol: s, period: "quarter", limit: 5 }, 1);
  n.weighted_shares_by_quarter = (is.arr || []).map((r) => ({ date: r.date, filingDate: r.filingDate, weightedAverageShsOut: r.weightedAverageShsOut, weightedAverageShsOutDil: r.weightedAverageShsOutDil }));
  const fl = await call("fmp", `sec-filings-search/symbol ${s} since 1 Jul`, "sec-filings-search/symbol", { symbol: s, from: "2026-07-01", to: TODAY, page: 0, limit: 100 }, 2,
    (b, a) => ({ forms: (a || []).map((r) => ({ formType: r.formType, filingDate: r.filingDate, acceptedDate: r.acceptedDate })).slice(0, 40) }));
  n.all_forms_since_jul = (fl.arr || []).map((r) => r.formType + " " + r.filingDate).slice(0, 40);
  const mt = await call("massive", `v3/reference/tickers/${s}`, `/v3/reference/tickers/${s}`, {}, 1);
  const t = mt.body?.results || {};
  n.massive_shares_now = { share_class_shares_outstanding: t.share_class_shares_outstanding, weighted_shares_outstanding: t.weighted_shares_outstanding, market_cap: t.market_cap };
  const nw = await call("massive", `v2/reference/news ${s} since 1 Sep`, "/v2/reference/news", { ticker: s, limit: 50, order: "desc", "published_utc.gte": "2026-09-01" }, 2,
    (b, a) => ({ total: (a || []).length, offering_headlines: (a || []).filter((x) => /offering|dilut|shelf|convertible|at-the-market|ATM program|priced|secondary/i.test(x.title + " " + (x.description || ""))).map((x) => ({ published_utc: x.published_utc, publisher: x.publisher?.name, title: x.title })).slice(0, 10) }));
  n.massive_news_offering_hits = nw.arr ? (nw.arr || []).filter((x) => /offering|dilut|shelf|convertible|at-the-market|ATM program|priced|secondary/i.test(x.title + " " + (x.description || ""))).map((x) => ({ published_utc: x.published_utc, publisher: x.publisher?.name, title: x.title })).slice(0, 10) : null;
  q2.names[s] = n;
}
out.derived.q2 = q2;
});
await section("Q3", async () => {

/* ---------- Q3 · analyst targets, grades, estimates, DCF inputs ---------- */
const q3 = { per_name: {} };
for (const s of ["MU", "NVDA"]) {
  const n = {};
  const ptn = await call("fmp", `price-target-news ${s}`, "price-target-news", { symbol: s, page: 0, limit: 10 }, 10);
  n.price_target_news_newest = ptn.arr?.[0]?.publishedDate ?? null; n.price_target_news_rows = ptn.arr?.length ?? 0;
  const pts = await call("fmp", `price-target-summary ${s}`, "price-target-summary", { symbol: s }, 1); n.price_target_summary = pts.arr?.[0] || null;
  const ptc = await call("fmp", `price-target-consensus ${s}`, "price-target-consensus", { symbol: s }, 1); n.price_target_consensus = ptc.arr?.[0] || null;
  const g = await call("fmp", `grades ${s}`, "grades", { symbol: s, limit: 10 }, 10); n.grades_newest = g.arr?.[0] ?? null; n.grades_rows = g.arr?.length ?? 0;
  const gh = await call("fmp", `grades-historical ${s}`, "grades-historical", { symbol: s, limit: 6 }, 6); n.grades_historical_rows = gh.arr?.length ?? 0;
  const gc = await call("fmp", `grades-consensus ${s}`, "grades-consensus", { symbol: s }, 1); n.grades_consensus = gc.arr?.[0] || null;
  await call("fmp", `grades-news ${s}`, "grades-news", { symbol: s, page: 0, limit: 5 }, 5);
  const ea = await call("fmp", `analyst-estimates ${s} annual`, "analyst-estimates", { symbol: s, period: "annual", page: 0, limit: 10 }, 10);
  n.estimates_annual = (ea.arr || []).map((r) => ({ date: r.date, revenueAvg: r.revenueAvg, ebitdaAvg: r.ebitdaAvg, ebitAvg: r.ebitAvg, netIncomeAvg: r.netIncomeAvg, sgaExpenseAvg: r.sgaExpenseAvg, epsAvg: r.epsAvg, numAnalystsRevenue: r.numAnalystsRevenue, numAnalystsEps: r.numAnalystsEps }));
  n.estimates_annual_fields = ea.arr?.[0] ? Object.keys(ea.arr[0]) : [];
  n.estimates_annual_reach = (ea.arr || []).map((r) => r.date).sort().slice(-1)[0] ?? null;
  const eq = await call("fmp", `analyst-estimates ${s} quarterly`, "analyst-estimates", { symbol: s, period: "quarter", page: 0, limit: 12 }, 12);
  n.estimates_quarter_reach = (eq.arr || []).map((r) => r.date).sort().slice(-1)[0] ?? null; n.estimates_quarter_rows = eq.arr?.length ?? 0;
  const rs = await call("fmp", `ratings-snapshot ${s}`, "ratings-snapshot", { symbol: s }, 1); n.ratings_snapshot = rs.arr?.[0] || null;
  await call("fmp", `ratings-historical ${s}`, "ratings-historical", { symbol: s, limit: 3 }, 3);
  const d1 = await call("fmp", `discounted-cash-flow ${s}`, "discounted-cash-flow", { symbol: s }, 1); n.dcf = d1.arr?.[0] || null;
  const d2 = await call("fmp", `levered-discounted-cash-flow ${s}`, "levered-discounted-cash-flow", { symbol: s }, 1); n.levered_dcf = d2.arr?.[0] || null;
  const d3 = await call("fmp", `custom-discounted-cash-flow ${s}`, "custom-discounted-cash-flow", { symbol: s }, 12);
  n.custom_dcf_fields = d3.arr?.[0] ? Object.keys(d3.arr[0]) : []; n.custom_dcf_years = (d3.arr || []).map((r) => r.year).slice(0, 12);
  n.custom_dcf_assumptions = d3.arr?.[0] ? Object.fromEntries(Object.entries(d3.arr[0]).filter(([k]) => /percentage|wacc|rate|beta|premium|terminal|growth|cost|tax|margin/i.test(k))) : null;
  const cf = await call("fmp", `cash-flow-statement ${s} annual`, "cash-flow-statement", { symbol: s, period: "annual", limit: 3 }, 1);
  n.cash_flow_history = (cf.arr || []).map((r) => ({ date: r.date, operatingCashFlow: r.operatingCashFlow, capitalExpenditure: r.capitalExpenditure, depreciationAndAmortization: r.depreciationAndAmortization, changeInWorkingCapital: r.changeInWorkingCapital, freeCashFlow: r.freeCashFlow, stockBasedCompensation: r.stockBasedCompensation }));
  const km = await call("fmp", `key-metrics ${s}`, "key-metrics", { symbol: s, limit: 1 }, 1); n.key_metrics_fields = km.arr?.[0] ? Object.keys(km.arr[0]) : [];
  const mf = await call("massive", `vX/reference/financials ${s} annual`, "/vX/reference/financials", { ticker: s, timeframe: "annual", limit: 1 }, 0,
    (b, a) => { const f = a?.[0]?.financials || {}; return { fiscal_year: a?.[0]?.fiscal_year, end_date: a?.[0]?.end_date, filing_date: a?.[0]?.filing_date, source_filing_url: a?.[0]?.source_filing_url, sections: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Object.keys(v || {})])), revenues: f.income_statement?.revenues?.value, net_income: f.income_statement?.net_income_loss?.value, capex_like: Object.entries(f.cash_flow_statement || {}).filter(([k]) => /invest|capital|property|equipment/i.test(k)).map(([k, v]) => [k, v?.value]) }; });
  n.massive_financials = mf.body?.results?.[0] ? { fiscal_year: mf.body.results[0].fiscal_year, sections: Object.fromEntries(Object.entries(mf.body.results[0].financials || {}).map(([k, v]) => [k, Object.keys(v || {}).length + " line items"])) } : { status: mf.status };
  q3.per_name[s] = n;
}
await call("fmp", "price-target-latest-news (all tickers)", "price-target-latest-news", { page: 0, limit: 10 }, 10,
  (b, a) => ({ in_universe: (a || []).filter((x) => inUni(x.symbol)).map((x) => ({ symbol: x.symbol, publishedDate: x.publishedDate, analystCompany: x.analystCompany, priceTarget: x.priceTarget, adjPriceTarget: x.adjPriceTarget, priceWhenPosted: x.priceWhenPosted })) }));
await call("fmp", "grades-latest-news (all tickers)", "grades-latest-news", { page: 0, limit: 10 }, 5);
await call("fmp", "treasury-rates (DCF risk-free)", "treasury-rates", { from: "2026-09-25", to: TODAY }, 2);
await call("fmp", "market-risk-premium (DCF)", "market-risk-premium", {}, 3, (b, a) => ({ us: (a || []).find((x) => /United States/i.test(x.country)) }));
for (const p of ["/benzinga/v1/analyst-insights", "/benzinga/v1/ratings", "/benzinga/v1/consensus-ratings"]) await call("massive", `${p} MU (entitlement check)`, p, { ticker: "MU", limit: 1 }, 1);
out.derived.q3 = q3;
});

/* ---------- print, scrubbed ---------- */
let text = JSON.stringify(out, null, 1);
for (const k of [FMP, MAS]) if (k && k.length > 6) { text = text.split(k).join("<KEY>"); text = text.split(encodeURIComponent(k)).join("<KEY>"); }
process.stdout.write("\n===R1JSON===\n" + text + "\n===END===\n");
