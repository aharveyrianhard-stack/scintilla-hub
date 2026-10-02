/* Scintilla · H8 (2 Oct) · THE STATS TAB'S MISSING FACTS — runs on a throw-away Fly machine of scintilla-massive-stocks-batch
   (the FMP key lives only in that app's secrets; this Mac has none). It READS FMP's stable routes and PRINTS JSON; it never
   writes a table and never prints the key or a URL that carries it. The coordinator loads the JSON from the Mac as UPDATEs on
   public.company_profile (the eight H8 columns), keyed by ticker.
     routes · /stable/shares-float?symbol=T   → outstandingShares, floatShares (shares outstanding and the float)
            · /stable/dividends?symbol=T      → the last dividend per share, its ex-date and FMP's annualised yield at that date
            · /stable/etf/info?symbol=T       → for a fund: expense ratio, AUM, holdings, inception, NAV (etf_info has 1 row)
            · short interest: FMP's stable routes do not carry it — H8_MODE=probe tries /stable/short-interest and records the answer
   run · H8_MODE=probe node /app/h8-fmp-facts.mjs           (MU + SPY: the key NAMES each route returns, nothing else)
       · H8_MODE=full  node /app/h8-fmp-facts.mjs           (every ticker in /app/h8-tickers.json → /tmp/h8-out.json, one ROW line each)
   Options: H8_TICKERS=MU,SPY (limit), H8_FILE=/app/h8-tickers.json. */
import fs from "node:fs";
const FMP = process.env.FMP_API_KEY || process.env.FMP_KEY;
if (!FMP) { console.error("no FMP key in this environment (FMP_API_KEY / FMP_KEY)"); process.exit(2); }
const MODE = process.env.H8_MODE || "probe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0, http = {};
async function fmp(path) {   // the key is appended here and nowhere else; errors are counted by status, never echoed with the URL
  for (let attempt = 0; attempt < 4; attempt++) {
    calls++;
    let r;
    try { r = await fetch(`https://financialmodelingprep.com${path}${path.includes("?") ? "&" : "?"}apikey=${FMP}`); }
    catch (e) { await sleep(800 * (attempt + 1)); continue; }
    http[r.status] = (http[r.status] || 0) + 1;
    if (r.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    if (!r.ok) return { _status: r.status };
    try { return await r.json(); } catch (_) { return { _status: "bad-json" }; }
  }
  return { _status: "gave-up" };
}
const num = (v) => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const first = (x) => Array.isArray(x) ? (x[0] || null) : (x && typeof x === "object" && !x._status ? x : null);
const keysOf = (x) => { const o = first(x); return o ? Object.keys(o) : (x && x._status ? ["HTTP " + x._status] : (Array.isArray(x) ? ["(empty array)"] : ["(none)"])); };

async function facts(t, isEtf) {
  const out = { ticker: t, src: {} };
  const sf = first(await fmp(`/stable/shares-float?symbol=${encodeURIComponent(t)}`));
  if (sf) {
    const so = num(sf.outstandingShares), fl = num(sf.floatShares);
    if (so != null && so > 0) { out.shares_outstanding = so; out.src.shares_outstanding = "shares-float.outstandingShares"; }
    if (fl != null && fl > 0) { out.float_shares = fl; out.src.float_shares = "shares-float.floatShares"; }
    if (sf.date) out.shares_date = String(sf.date).slice(0, 10);
  }
  await sleep(60);
  const dv = await fmp(`/stable/dividends?symbol=${encodeURIComponent(t)}`);
  if (Array.isArray(dv) && dv.length) {
    const rows = dv.filter((d) => d && d.date).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const L = rows[0];
    const dps = num(L.dividend) != null ? num(L.dividend) : num(L.adjDividend);
    if (dps != null) { out.dividend_per_share = dps; out.src.dividend_per_share = "dividends[last].dividend"; }
    out.ex_dividend_date = String(L.date).slice(0, 10); out.src.ex_dividend_date = "dividends[last].date";
    if (num(L.yield) != null) { out.dividend_yield = num(L.yield); out.src.dividend_yield = "dividends[last].yield (annualised at that date, %)"; }
    if (L.frequency) out.dividend_frequency = String(L.frequency);
    const cut = new Date(Date.now() - 366 * 864e5).toISOString().slice(0, 10);
    out.dividends_ttm = rows.filter((d) => String(d.date).slice(0, 10) >= cut).reduce((s, d) => s + (num(d.dividend) || 0), 0);
  } else if (Array.isArray(dv)) out.dividends_none = true;
  if (isEtf) {
    await sleep(60);
    const ei = first(await fmp(`/stable/etf/info?symbol=${encodeURIComponent(t)}`));
    if (ei) out.etf = { expense_ratio: num(ei.expenseRatio), aum: num(ei.assetsUnderManagement), holdings_count: num(ei.holdingsCount),
      inception_date: ei.inceptionDate ? String(ei.inceptionDate).slice(0, 10) : null, nav: num(ei.nav), etf_company: ei.etfCompany || null,
      website: ei.website || null, name: ei.name || null, avg_volume: num(ei.avgVolume), description: ei.description ? String(ei.description).slice(0, 2000) : null,
      sectors: Array.isArray(ei.sectorsList) ? ei.sectorsList : null };
  }
  return out;
}

if (MODE === "probe") {
  for (const t of ["MU", "SPY"]) {
    for (const route of ["/stable/profile", "/stable/quote", "/stable/key-metrics-ttm", "/stable/shares-float", "/stable/dividends", "/stable/etf/info", "/stable/short-interest"]) {
      const r = await fmp(`${route}?symbol=${t}`);
      console.log(`KEYS ${t} ${route} → ${keysOf(r).join(", ")}${Array.isArray(r) ? " · rows " + r.length : ""}`);
      await sleep(80);
    }
    console.log("ROW " + JSON.stringify(await facts(t, t === "SPY")));
  }
  console.log(`DONE calls ${calls} http ${JSON.stringify(http)}`);
} else {
  const list = JSON.parse(fs.readFileSync(process.env.H8_FILE || "/app/h8-tickers.json", "utf8"));
  const asked = process.env.H8_TICKERS ? new Set(process.env.H8_TICKERS.split(",").map((s) => s.trim().toUpperCase())) : null;
  const rows = [];
  for (const it of list) {
    const t = typeof it === "string" ? it : it.ticker;
    if (asked && !asked.has(t)) continue;
    const r = await facts(t, !!(it && it.is_etf));
    rows.push(r);
    if (rows.length % 50 === 0) console.log(`… ${rows.length} of ${list.length} · calls ${calls}`);
    await sleep(60);
  }
  fs.writeFileSync("/tmp/h8-out.json", JSON.stringify({ at: new Date().toISOString(), calls, http, rows }));
  console.log(`DONE ${rows.length} names · calls ${calls} · http ${JSON.stringify(http)} · with shares ${rows.filter((r) => r.shares_outstanding != null).length} · float ${rows.filter((r) => r.float_shares != null).length} · dividend ${rows.filter((r) => r.dividend_per_share != null).length} · etf ${rows.filter((r) => r.etf).length}`);
}
