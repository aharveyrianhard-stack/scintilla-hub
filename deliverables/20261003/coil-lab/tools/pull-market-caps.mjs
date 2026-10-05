/* PASS 3 (5 Oct 2026) · the market caps the sphere is built from. Reads company_profile (ticker, name, market_cap, updated_ts,
   is_etf) through the Hub's own public read path — the same anon read the board's MKT CAP column makes — for every name in the
   three lists (data/hub-lists-20261003.json). GET only; nothing written; the key is read from the Hub page at run time and never
   printed or stored here. Writes data/market-caps-<date>.json.   node tools/pull-market-caps.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), LAB = resolve(HERE, ".."), ROOT = resolve(LAB, "../../..");
const hub = readFileSync(resolve(ROOT, "index.html"), "utf8");
const SB = hub.match(/const SB\s*=\s*"([^"]+)"/)[1], ANON = hub.match(/window\.SC_ANON_KEY\)\s*\|\|\s*"([^"]+)"/)[1];
const lists = JSON.parse(readFileSync(resolve(LAB, "data/hub-lists-20261003.json"), "utf8"));
const tickers = [...new Set([...lists.favorites, ...lists.radar, ...lists.liked].map((t) => String(t).toUpperCase()))].sort();
const out = { read_utc: new Date().toISOString(), source: "company_profile (ticker, name, market_cap, updated_ts, is_etf) through the Hub's public read path — the board's MKT CAP cell reads the same column; nothing written", tickers: tickers.length, rows: {} };
for (let i = 0; i < tickers.length; i += 60) {
  const chunk = tickers.slice(i, i + 60);
  const r = await fetch(`${SB}/rest/v1/company_profile?select=ticker,name,market_cap,updated_ts,is_etf&ticker=in.(${chunk.map((t) => `"${t}"`).join(",")})`, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
  if (!r.ok) throw new Error("company_profile → " + r.status);
  for (const row of await r.json()) out.rows[row.ticker] = { name: row.name, market_cap: row.market_cap, updated_ts: row.updated_ts, is_etf: row.is_etf };
}
out.with_cap = Object.values(out.rows).filter((r) => Number(r.market_cap) > 0).length;
out.without_cap = tickers.filter((t) => !(out.rows[t] && Number(out.rows[t].market_cap) > 0));
const day = out.read_utc.slice(0, 10).replace(/-/g, "");
writeFileSync(resolve(LAB, `data/market-caps-${day}.json`), JSON.stringify(out, null, 1));
console.log(`market caps: ${out.with_cap} of ${tickers.length} names have a cap on file; without:`, out.without_cap.join(" "));
