// r1-probe2.mjs — second, smaller R1 probe (2 Oct 2026): the gaps the first run left. Same rules: read-only, keys from the
// environment, nothing printed but scrubbed JSON.
import { readFileSync } from "node:fs";
const FMP = process.env.FMP_KEY || process.env.FMP_API_KEY || "", MAS = process.env.MASSIVE_KEY || "";
const U = JSON.parse(readFileSync("/app/r1-universe.json", "utf8")).rows; const UNI = new Set(U.map((r) => r.ticker)); const inUni = (s) => UNI.has(s);
const out = { ran_at: new Date().toISOString(), keys_present: { FMP: !!FMP, MASSIVE_KEY: !!MAS }, calls: { fmp: 0, massive: 0, sec: 0 }, probes: [], derived: {}, errors: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(provider, name, path, params = {}, keep = 3, extra = null) {
  const base = provider === "fmp" ? "https://financialmodelingprep.com/stable/" : "https://api.massive.com";
  const u = new URL(base + path); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const shown = u.pathname + u.search; const init = { headers: { "User-Agent": "scintilla-r1-probe/1.0" }, signal: AbortSignal.timeout(45000) };
  if (provider === "fmp") u.searchParams.set("apikey", FMP); else init.headers.Authorization = "Bearer " + MAS;
  const t0 = Date.now(); let status = 0, text = "", body = null, hdr = null;
  try { const r = await fetch(u, init); status = r.status; text = await r.text(); try { body = JSON.parse(text); } catch { body = null; } hdr = { sunset: r.headers.get("sunset"), deprecation: r.headers.get("deprecation") }; } catch (e) { status = -1; text = String(e); }
  out.calls[provider]++;
  const arr = Array.isArray(body) ? body : (body && Array.isArray(body.results) ? body.results : null);
  const rec = { provider, name, route: shown, status, ms: Date.now() - t0, bytes: text.length, ...(hdr && (hdr.sunset || hdr.deprecation) ? { deprecation_headers: hdr } : {}), rows: arr ? arr.length : (body ? 1 : 0),
    fields: arr ? (arr[0] && typeof arr[0] === "object" ? Object.keys(arr[0]) : []) : (body && typeof body === "object" ? Object.keys(body) : []), sample: arr ? arr.slice(0, keep) : (body ?? text.slice(0, 300)) };
  if (extra) { try { rec.extra = extra(body, arr); } catch (e) { rec.extra = { error: String(e).slice(0, 200) }; } }
  out.probes.push(rec); await sleep(provider === "fmp" ? 220 : 60); return { status, body, arr };
}
const SEC_UA = { "User-Agent": "ScintillaHub research research@scintillahub.ai", "Accept-Encoding": "gzip, deflate" };
const clean = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'").replace(/\s+/g, " ");
async function secText(url, maxBytes = 4000000) { out.calls.sec++; const r = await fetch(url, { headers: SEC_UA, signal: AbortSignal.timeout(40000) }); const html = (await r.text()).slice(0, maxBytes); return { status: r.status, bytes: html.length, txt: clean(html) }; }
async function lockup(url) { try { const { status, bytes, txt } = await secText(url); const hits = []; const re = /[^.]{0,220}lock-?up[^.]{0,260}\./gi; let m, n = 0; while ((m = re.exec(txt)) && n < 80) { n++; if (/\b(\d{2,3})\s*days?\b/i.test(m[0])) hits.push(m[0].trim()); }
  const days = [...txt.matchAll(/\b(\d{2,3})\s*days?\b[^.]{0,160}?lock-?up|lock-?up[^.]{0,200}?\b(\d{2,3})\s*days?\b/gi)].map((x) => Number(x[1] || x[2])); const cnt = {}; for (const d of days) cnt[d] = (cnt[d] || 0) + 1;
  return { status, bytes, mentions_total: n, clauses_with_days: hits.slice(0, 5), day_counts: cnt }; } catch (e) { return { error: String(e).slice(0, 200) }; } }
const sect = async (name, fn) => { try { await fn(); } catch (e) { out.errors.push({ section: name, error: String(e && e.stack || e).slice(0, 500) }); } };

await sect("A · the two 2026 listings in our universe + CRWV's prospectus", async () => {
  const A = {};
  for (const [from, to] of [["2026-05-01", "2026-05-31"], ["2026-06-01", "2026-06-30"]]) await call("fmp", `ipos-calendar ${from}..${to} (narrow)`, "ipos-calendar", { from, to }, 2, (b, a) => ({ rows: (a || []).length, in_universe: (a || []).filter((r) => inUni(r.symbol)).map((r) => ({ symbol: r.symbol, date: r.date, company: r.company, actions: r.actions, shares: r.shares, priceRange: r.priceRange, marketCap: r.marketCap })), priced: (a || []).filter((r) => r.actions === "Priced").map((r) => r.symbol + " " + r.date).slice(0, 60) }));
  for (const [s, from, to] of [["SPCX", "2026-04-01", "2026-07-31"], ["CBRS", "2026-03-01", "2026-06-30"], ["CRWV", "2025-02-01", "2025-04-30"]]) {
    const per = {};
    const pr = await call("fmp", `profile ${s}`, "profile", { symbol: s }, 1, (b, a) => ({ companyName: a?.[0]?.companyName, ipoDate: a?.[0]?.ipoDate, exchange: a?.[0]?.exchange, marketCap: a?.[0]?.marketCap, isEtf: a?.[0]?.isEtf, isFund: a?.[0]?.isFund }));
    per.profile = pr.arr?.[0] ? { companyName: pr.arr[0].companyName, ipoDate: pr.arr[0].ipoDate, exchange: pr.arr[0].exchange, marketCap: pr.arr[0].marketCap, price: pr.arr[0].price, isEtf: pr.arr[0].isEtf } : null;
    const f = await call("fmp", `sec-filings-search/symbol ${s} ${from}..${to}`, "sec-filings-search/symbol", { symbol: s, from, to, page: 0, limit: 1000 }, 2, (b, a) => ({ forms: Object.entries((a || []).reduce((m, r) => (m[r.formType] = (m[r.formType] || 0) + 1, m), {})), ipo_forms: (a || []).filter((r) => /^(S-1|S-1\/A|F-1|F-1\/A|424B4|424B1)$/.test(r.formType)).map((r) => ({ formType: r.formType, filingDate: r.filingDate, link: r.finalLink || r.link })).slice(0, 10) }));
    const ipoForms = (f.arr || []).filter((r) => /^(424B4|424B1|S-1|F-1)$/.test(r.formType)).sort((a, b) => String(a.filingDate).localeCompare(String(b.filingDate)));
    per.ipo_forms = ipoForms.map((r) => ({ formType: r.formType, filingDate: r.filingDate, link: r.finalLink || r.link })).slice(0, 6);
    const final = ipoForms.find((r) => /^424B/.test(r.formType)) || ipoForms[0];
    if (final) per.lockup_clause_from_sec = { form: final.formType, filingDate: final.filingDate, link: final.finalLink || final.link, ...(await lockup(final.finalLink || final.link)) };
    const mi = await call("massive", `vX/reference/ipos ${s}`, "/vX/reference/ipos", { ticker: s, limit: 5 }, 3);
    per.massive = (mi.arr || []).map((r) => ({ issuer_name: r.issuer_name, listing_date: r.listing_date, announced_date: r.announced_date, ipo_status: r.ipo_status, final_issue_price: r.final_issue_price, total_offer_size: r.total_offer_size, shares_outstanding: r.shares_outstanding, max_shares_offered: r.max_shares_offered }));
    const ipoDate = per.profile?.ipoDate || per.massive?.[0]?.listing_date || null; per.ipo_date_used = ipoDate;
    if (ipoDate) { const d = new Date(ipoDate + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 180); per.unlock_if_180_days = d.toISOString().slice(0, 10); }
    A[s] = per;
  }
  out.derived.A = A;
});

await sect("B · 424B5 equity-vs-debt classifier on the universe filers of the last 30 days", async () => {
  const r = await call("fmp", "sec-filings-search/form-type 424B5 last 30 days", "sec-filings-search/form-type", { formType: "424B5", from: "2026-09-02", to: "2026-10-02", page: 0, limit: 1000 }, 1);
  const uni = (r.arr || []).filter((x) => inUni(x.symbol)).sort((a, b) => String(b.filingDate).localeCompare(String(a.filingDate)));
  const seen = new Set(), picks = []; for (const x of uni) { if (seen.has(x.symbol)) continue; seen.add(x.symbol); picks.push(x); if (picks.length >= 12) break; }
  const B = { universe_filings: uni.length, distinct_universe_filers: seen.size, classified: [] };
  for (const x of picks) {
    const url = x.finalLink || x.link; let rec = { symbol: x.symbol, filingDate: String(x.filingDate).slice(0, 10), link: url };
    try { const { status, txt } = await secText(url, 400000); const head = txt.slice(0, 12000);
      const equity = /\d[\d,]*\s+shares of (?:our |its )?(?:Class [AB] )?common stock/i.test(head) || /common stock offering/i.test(head);
      const notes = /%\s*(?:senior |convertible |subordinated |fixed[- ]rate )*notes due \d{4}/i.test(head) || /\bNotes due \d{4}/i.test(head);
      const atm = /at-the-market|\bATM\b offering|equity distribution agreement/i.test(head);
      const pref = /preferred stock/i.test(head) && !equity;
      const m = head.match(/[^.]{0,120}(?:shares of (?:our |its )?(?:Class [AB] )?common stock|Notes due \d{4}|at-the-market)[^.]{0,120}\./i);
      rec = { ...rec, sec_status: status, class: equity ? (notes ? "equity+notes?" : "EQUITY (common stock)") : notes ? "DEBT (notes)" : atm ? "ATM programme" : pref ? "preferred" : "unclassified", evidence: m ? m[0].trim().slice(0, 260) : null };
    } catch (e) { rec.error = String(e).slice(0, 160); }
    B.classified.push(rec); await sleep(150);
  }
  out.derived.B = B;
});

await sect("C · Massive successor financials + related companies + Benzinga guidance entitlement", async () => {
  const C = {};
  for (const s of ["MU", "NVDA"]) {
    const n = {};
    for (const [p, nm] of [["/stocks/financials/v1/income-statements", "income"], ["/stocks/financials/v1/cash-flow-statements", "cashflow"], ["/stocks/financials/v1/balance-sheets", "balance"], ["/stocks/financials/v1/ratios", "ratios"]]) {
      const r = await call("massive", `${p} ${s}`, p, { ticker: s, timeframe: "annual", limit: 2, sort: "period_end", order: "desc" }, 1, (b, a) => ({ rows: (a || []).length, fields: a?.[0] ? Object.keys(a[0]) : [], first: a?.[0] ? Object.fromEntries(Object.entries(a[0]).filter(([k]) => /period|fiscal|date|timeframe|revenue|net_income|capital_expend|depreciation|free_cash|operating_cash|shares|eps|ebitda|margin|ratio|tax/i.test(k)).slice(0, 40)) : null }));
      n[nm] = r.status === 200 ? { rows: r.arr?.length, fields: r.arr?.[0] ? Object.keys(r.arr[0]).length : 0 } : { status: r.status, body: typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 200) : null };
    }
    const rc = await call("massive", `v1/related-companies/${s}`, `/v1/related-companies/${s}`, {}, 10, (b, a) => ({ related: (a || []).map((x) => x.ticker) }));
    n.related_companies = (rc.arr || []).map((x) => x.ticker);
    C[s] = n;
  }
  for (const p of ["/benzinga/v1/guidance", "/benzinga/v1/earnings", "/benzinga/v2/news"]) await call("massive", `${p} MU (entitlement check)`, p, { ticker: "MU", limit: 1 }, 1);
  await call("massive", "/stocks/v1/short-interest MU", "/stocks/v1/short-interest", { ticker: "MU", limit: 2 }, 2);
  out.derived.C = C;
});

let text = JSON.stringify(out, null, 1);
for (const k of [FMP, MAS]) if (k && k.length > 6) { text = text.split(k).join("<KEY>"); text = text.split(encodeURIComponent(k)).join("<KEY>"); }
process.stdout.write("\n===R1JSON===\n" + text + "\n===END===\n");
