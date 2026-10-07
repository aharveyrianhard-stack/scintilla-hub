/* ER1 (6 Oct 2026) · reads FMP stable routes for GOOGL AMZN WDC STX MU LRCX and writes /tmp/er1-out.json. Never prints the key. */
import fs from "node:fs";
const FMP = process.env.FMP_API_KEY || process.env.FMP_KEY;
if (!FMP) { console.error("no FMP key in env"); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0, http = {};
async function fmp(path) {
  for (let a = 0; a < 4; a++) {
    calls++;
    let r;
    try { r = await fetch(`https://financialmodelingprep.com${path}${path.includes("?") ? "&" : "?"}apikey=${FMP}`); }
    catch (e) { await sleep(800 * (a + 1)); continue; }
    http[r.status] = (http[r.status] || 0) + 1;
    if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
    if (!r.ok) return { _status: r.status };
    try { return await r.json(); } catch (_) { return { _status: "bad-json" }; }
  }
  return { _status: "gave-up" };
}
const T = (process.env.ER1_TICKERS || "GOOGL,AMZN,WDC,STX,MU,LRCX").split(",");
const out = { generated_utc: new Date().toISOString(), tickers: {} };
for (const t of T) {
  const o = {};
  o.est_annual = await fmp(`/stable/analyst-estimates?symbol=${t}&period=annual&page=0&limit=12`);
  o.est_quarter = await fmp(`/stable/analyst-estimates?symbol=${t}&period=quarter&page=0&limit=10`);
  o.earnings = await fmp(`/stable/earnings?symbol=${t}&limit=16`);
  o.income_annual = await fmp(`/stable/income-statement?symbol=${t}&period=annual&limit=4`);
  o.income_quarter = await fmp(`/stable/income-statement?symbol=${t}&period=quarter&limit=8`);
  o.pt_consensus = await fmp(`/stable/price-target-consensus?symbol=${t}`);
  o.grades_consensus = await fmp(`/stable/grades-consensus?symbol=${t}`);
  o.filings = await fmp(`/stable/sec-filings-search/symbol?symbol=${t}&from=2025-10-01&to=2026-10-07&page=0&limit=60`);
  o.news = await fmp(`/stable/news/stock?symbols=${t}&limit=40`);
  o.transcript_dates = await fmp(`/stable/earning-call-transcript-dates?symbol=${t}`);
  o.transcripts = [];
  const dates = Array.isArray(o.transcript_dates) ? o.transcript_dates.slice(0, 3) : [];
  for (const d of dates) {
    const q = d.quarter ?? d.fiscalYear?.quarter, y = d.fiscalYear ?? d.year;
    const tr = await fmp(`/stable/earning-call-transcript?symbol=${t}&year=${y}&quarter=${q}`);
    o.transcripts.push({ year: y, quarter: q, date: d.date, data: tr });
    await sleep(300);
  }
  out.tickers[t] = o;
  await sleep(400);
}
out.calls = calls; out.http = http;
fs.writeFileSync("/tmp/er1-out.json", JSON.stringify(out));
console.log(JSON.stringify({ calls, http, tickers: Object.fromEntries(T.map(t => [t, { est: Array.isArray(out.tickers[t].est_annual) ? out.tickers[t].est_annual.length : out.tickers[t].est_annual, tr_dates: Array.isArray(out.tickers[t].transcript_dates) ? out.tickers[t].transcript_dates.length : out.tickers[t].transcript_dates, tr_ok: out.tickers[t].transcripts.map(x => Array.isArray(x.data) ? (x.data[0]?.content || "").length : x.data?._status) }])) }));
