/* Scintilla · comps labels · the data-sanity check for the peers of the dated snapshot.
   Reads, for every peer in snapshot-<date>.json: the second trailing EPS on the Hub's fundamentals row
   (adjusted_eps_ttm) and the last four quarters' net income (fundamentals_history), and takes today's
   market value from fmp-marketcap-<date>.json (FMP batch-quote, read through the FMP connector).
   Then runs labels.mjs sanity() on each peer. Writes checks-<date>.json next to this file.
   Run: node deliverables/20260928/comps-labels/checks.mjs [DATE]
   The Hub's public read key is discovered at run time from the Hub's own pages; never written or printed. */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sanity } from "./labels.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATE = process.argv[2] || "2026-09-28";
const HUB = "https://scintillahub.ai", SB = "https://wadinxqplrggagkvrdag.supabase.co";
const snap = JSON.parse(readFileSync(path.join(here, `snapshot-${DATE}.json`), "utf8"));
const fmp = JSON.parse(readFileSync(path.join(here, `fmp-marketcap-${DATE}.json`), "utf8"));

let KEY = null;
for (const page of ["/pip.html", "/index.html"]) {
  const m = (await (await fetch(HUB + page)).text()).match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]+/);
  if (m) { KEY = m[0]; break; }
}
if (!KEY) throw new Error("no read key could be found on the Hub's pages");
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };

const T = snap.in.peers.map((p) => p.ticker);
const inq = "in.(" + T.join(",") + ")";
const [fund, hist] = await Promise.all([
  pg(`fundamentals?select=ticker,eps_ttm,adjusted_eps_ttm,market_cap&ticker=${inq}`),
  pg(`fundamentals_history?select=ticker,period,fiscal_date,net_income&ticker=${inq}&period=neq.FY&order=fiscal_date.desc`),
]);
const peers = snap.in.peers.map((p) => {
  const f = fund.find((r) => r.ticker === p.ticker) || {};
  const q = hist.filter((r) => r.ticker === p.ticker).slice(0, 4);
  const ni_ttm = q.length === 4 && q.every((r) => r.net_income != null) ? q.reduce((s, r) => s + r.net_income, 0) : null;
  const mcap = fmp.quotes[p.ticker] ? fmp.quotes[p.ticker].marketCap : null;
  const s = sanity({ ticker: p.ticker, multiple: p.multiple, eps: p.eps, eps_adj: f.adjusted_eps_ttm ?? null, ni_ttm, mcap });
  return { ticker: p.ticker, multiple: p.multiple, eps: p.eps, eps_adj: f.adjusted_eps_ttm ?? null, ni_ttm, quarters: q.map((r) => r.fiscal_date), mcap, pe_mcap: s.pe_mcap, faults: s.faults };
});
const out = {
  taken: new Date().toISOString(), date: DATE, snapshot: `snapshot-${DATE}.json`,
  rule: "a peer is set aside when its reported and adjusted trailing EPS differ more than 2×, or when today's market value ÷ its last four quarters' net income and its P/E differ more than 1.5×",
  sources: { eps_adj: "fundamentals.adjusted_eps_ttm", ni_ttm: "fundamentals_history.net_income, last four quarters", mcap: fmp.source + " read " + fmp.read_utc + ", quotes stamped " + fmp.quote_time_utc },
  peers, faulty: peers.filter((p) => p.faults.length).map((p) => p.ticker),
};
const file = path.join(here, `checks-${DATE}.json`);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(file);
for (const p of peers) console.log(p.ticker.padEnd(5), "P/E", p.multiple.toFixed(1).padStart(5), "· mcap÷NI", p.pe_mcap == null ? "  —  " : p.pe_mcap.toFixed(1).padStart(5), "· EPS", p.eps, "adj", p.eps_adj, p.faults.length ? "· FAULT: " + p.faults.map((f) => f.check).join("+") : "");
