// read-only: the Hub page's own public key, GETs only. Proves the new live slice + by-name check on real rows.
import { readFileSync } from "node:fs";
const ROOT = process.argv[2];
const P = await import(ROOT + "/supabase/functions/sentiment-news/plan.mjs");
const html = readFileSync(ROOT + "/index.html", "utf8");
const key = (html.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/) || [])[0];
if (!key) { console.log("no public key found in the page"); process.exit(0); }
const SB = "https://wadinxqplrggagkvrdag.supabase.co/rest/v1/";
const H = { apikey: key, Authorization: "Bearer " + key };
const get = async (p) => { const t = Date.now(); const r = await fetch(SB + p, { headers: H }); const b = await r.text(); return { ok: r.ok, status: r.status, ms: Date.now() - t, rows: r.ok ? JSON.parse(b) : null, body: r.ok ? "" : b.slice(0, 160) }; };
const check = async (rows) => {
  const f = P.urlInFilters(rows.map((r) => r.url));
  const have = new Set(); let maxLen = 0, bad = 0, t = Date.now();
  for (let i = 0; i < f.length; i += 6) {
    const got = await Promise.all(f.slice(i, i + 6).map((x) => get("news_headline_sentiment?select=url,ticker&" + x + "&limit=1000")));
    for (const g of got) { if (!g.ok) { bad++; console.log("  filter failed", g.status, g.body); } else for (const r of g.rows) have.add(r.url + "\t" + r.ticker); }
  }
  for (const x of f) maxLen = Math.max(maxLen, x.length);
  const un = rows.filter((r) => r.ticker && r.url && !have.has(r.url + "\t" + r.ticker));
  return { filters: f.length, longest_filter_chars: maxLen, failed_filters: bad, ms: Date.now() - t, unscored: un.length, odd_urls: rows.filter((r) => /[,()"\\]/.test(r.url)).length };
};
const neu = await get(P.liveQuery(600));
console.log("NEW live read (newest arrivals):", { ok: neu.ok, status: neu.status, ms: neu.ms, rows: neu.rows?.length, body: neu.body });
if (neu.ok) {
  const ts = neu.rows.map((r) => +r.published_ts), up = neu.rows.map((r) => +r.updated_ts);
  console.log("  arrival span min:", Math.round((Math.max(...up) - Math.min(...up)) / 60), " publish span h:", Math.round((Math.max(...ts) - Math.min(...ts)) / 3600));
  console.log("  by-name check:", await check(neu.rows));
}
const old = await get("news?select=url,ticker,title,snippet,site,published_ts&published_ts=not.is.null&order=published_ts.desc&limit=600");
console.log("OLD live read (newest by publish time):", { ok: old.ok, status: old.status, ms: old.ms, rows: old.rows?.length, body: old.body });
if (old.ok) console.log("  by-name check:", await check(old.rows));
