/* CW2 · GET-only reads for the 23 RADAR names: profile, tags, home cohort, FMP peers, served-on-the-Hub, analyst targets (the tool's way). */
import fs from "node:fs"; import { sbGet, paged } from "./sb.mjs";
const S = process.env.S; const R = JSON.parse(fs.readFileSync(S + "/db/radar.json", "utf8")).rows.map((r) => r.ticker);
const inList = "in.(" + R.map(encodeURIComponent).join(",") + ")";
const out = { read_utc: new Date().toISOString(), radar: R };
out.profiles = await sbGet(`company_profile?select=ticker,name,industry,sector,market_cap,country,is_etf,updated_ts&ticker=${inList}`).catch((e) => ({ error: String(e) }));
out.tags = await sbGet(`ticker_cohorts?select=ticker,cohort&ticker=${inList}&order=ticker.asc`).catch((e) => ({ error: String(e) }));
out.home = await sbGet(`tickers?select=ticker,cohort&ticker=${inList}`).catch((e) => ({ error: String(e) }));
out.fmp_peers = await sbGet(`fmp_peers?select=ticker,peer,position,fetched_at&ticker=${inList}&order=ticker.asc,position.asc`).catch((e) => ({ error: String(e) }));
const uni = await paged("ticker_cohorts?select=ticker&order=ticker.asc"); out.universe = [...new Set(uni.map((r) => String(r.ticker).toUpperCase()))];
out.served = Object.fromEntries(R.map((t) => [t, out.universe.includes(t)]));
/* tag sizes for every tag the 23 carry (C3b's tightest-tag rule needs them) */
const tagNames = [...new Set((out.tags.error ? [] : out.tags).map((r) => String(r.cohort).toUpperCase()).concat((out.home.error ? [] : out.home).map((r) => r.cohort && String(r.cohort).toUpperCase()).filter(Boolean)))];
out.tag_members = {}; for (const c of tagNames) out.tag_members[c] = [...new Set((await sbGet(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(c)}&order=ticker.asc`)).map((r) => String(r.ticker).toUpperCase()))];
/* analyst targets, the allocation tool's way (CW1): checked TARGET notes, quality ok, last 90 days, one per firm (newest), the median */
const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
const an = await sbGet(`analyst_target_news?select=ticker,firm,adj_target_checked,published_utc&kind=eq.TARGET&quality=eq.ok&adj_target_checked=not.is.null&published_utc=gte.${since}&ticker=${inList}&order=ticker.asc,published_utc.desc&limit=5000`).catch((e) => ({ error: String(e) }));
out.analysts = {}; if (!an.error) { const byT = {}; for (const r of an) { const t = (byT[r.ticker] = byT[r.ticker] || {}); const f = r.firm || "(no firm)"; if (!(f in t)) t[f] = { target: +r.adj_target_checked, published: r.published_utc.slice(0, 10) }; }
  for (const T of R) { const firms = byT[T] || {}; const v = Object.values(firms).map((x) => x.target).filter((x) => x > 0).sort((a, b) => a - b); if (!v.length) { out.analysts[T] = { n: 0 }; continue; } const med = v.length % 2 ? v[v.length >> 1] : (v[(v.length >> 1) - 1] + v[v.length >> 1]) / 2; out.analysts[T] = { median: med, n: v.length, low: v[0], high: v[v.length - 1], since, firms: Object.entries(firms).filter(([, x]) => x.target > 0).sort((a, b) => a[1].target - b[1].target).map(([firm, x]) => ({ firm, ...x })) }; } } else out.analysts = an;
fs.writeFileSync(S + "/db/radar-db.json", JSON.stringify(out, null, 1));
console.log("profiles", out.profiles.length, "tags", out.tags.length, "home", out.home.length, "fmp_peers rows", out.fmp_peers.error || out.fmp_peers.length, "universe", out.universe.length);
console.log("not served:", R.filter((t) => !out.served[t]).join(" ") || "none");
console.log("tags per name:", R.map((t) => t + ":" + (out.tags.filter((r) => r.ticker === t).map((r) => r.cohort).join("/") || "-")).join("  "));
console.log("home:", out.home.map((r) => r.ticker + "=" + r.cohort).join(" "));
console.log("fmp peers per name:", R.map((t) => t + ":" + (out.fmp_peers.error ? "?" : out.fmp_peers.filter((r) => r.ticker === t).length)).join(" "));
console.log("analysts:", R.map((t) => t + ":" + (out.analysts[t] && out.analysts[t].n ? out.analysts[t].median + "(" + out.analysts[t].n + ")" : "none")).join(" "));
console.log("tag sizes:", Object.entries(out.tag_members).map(([k, v]) => k + "=" + v.length).join(" "));
