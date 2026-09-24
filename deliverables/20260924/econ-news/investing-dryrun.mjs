/* M70 — DRY RUN for the Investing.com lane. It fetches the five live feeds and runs the CANDIDATE's OWN
   parsing and de-duplication functions (they are lifted out of news-feed-v23-investing-CANDIDATE.ts by
   name, so this cannot drift from what would be deployed), then asks the live news table, READ-ONLY with
   the public anon key, how many of those links it already holds. It writes NOTHING. Usage:
     node deliverables/20260924/econ-news/investing-dryrun.mjs            */
import fs from "node:fs";
import vm from "node:vm";
const SRC = fs.readFileSync(new URL("./news-feed-v23-investing-CANDIDATE.ts", import.meta.url), "utf8");
const grab = (re, what) => { const m = SRC.match(re); if (!m) throw new Error("not found in the candidate: " + what); return m[0]; };
const code = [
  grab(/function tag\(b,name\)\{.*\n/, "tag"),
  grab(/function clean\(s\)\{.*\n/, "clean"),
  grab(/function rssItems\(xml\)\{.*\n/, "rssItems"),
  grab(/function gts\(s\)\{.*\n/, "gts"),
  grab(/const INVESTING_FEEDS=\[.*\n/, "INVESTING_FEEDS"),
  grab(/const MARKET_BUCKET='\_MARKET'.*\n/, "MARKET_BUCKET"),
  grab(/const normTitle=.*\n/, "normTitle"),
  grab(/const normUrl=.*\n/, "normUrl"),
].join("");
const ctx = vm.createContext({});
vm.runInContext(code + ";({tag,clean,rssItems,gts,INVESTING_FEEDS,MARKET_BUCKET,normTitle,normUrl})", ctx);
const F = vm.runInContext("({rssItems,gts,INVESTING_FEEDS,MARKET_BUCKET,normTitle,normUrl})", ctx);

const SB = "https://wadinxqplrggagkvrdag.supabase.co";
const ANON = process.env.SC_ANON_KEY || fs.readFileSync(new URL("../../../index.html", import.meta.url), "utf8")
  .match(/"(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9[^"]+)"/)[1];
const now = Math.floor(Date.now() / 1000);

const perFeed = [];
const rows = [], seenUrl = new Set(), seenTitle = new Set();
let dupInBatch = 0, future = 0;
for (const [url, name] of F.INVESTING_FEEDS) {
  let items = [], status = 0;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (compatible; ScintillaHub/1.0)" } });
    status = r.status;
    if (r.ok) items = F.rssItems(await r.text());
  } catch (e) { status = String(e.message || e); }
  let kept = 0;
  for (const x of items) {
    const u = F.normUrl(x.link), t = F.normTitle(x.title);
    if (!u || !t || seenUrl.has(u) || seenTitle.has(t)) { dupInBatch++; continue; }
    seenUrl.add(u); seenTitle.add(t);
    const ts = F.gts(x.pub) || Math.floor(Date.parse(x.pub || "") / 1000) || now;
    if (ts > now + 3600) { future++; continue; }
    rows.push({ ticker: F.MARKET_BUCKET, url: x.link, title: x.title, site: "Investing.com", snippet: "", published_ts: ts, updated_ts: now, feed: "investing" });
    kept++;
  }
  perFeed.push({ name, url, status, items: items.length, new_after_batch_dedupe: kept });
}
/* the same read the lane makes before it offers anything to the table */
let held = new Set();
if (rows.length) {
  /* the lane's own read: scoped to the market bucket, which is what the (ticker,url) index can answer */
  const q = SB + "/rest/v1/news?select=url&ticker=eq." + "_MARKET" +
    "&url=in.(" + rows.map((r) => '"' + r.url.replace(/"/g, '\\"') + '"').join(",") + ")";
  const r = await fetch(q, { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
  const body = await r.json();
  if (Array.isArray(body)) held = new Set(body.map((x) => x.url));
  else console.log("  (the table read answered:", JSON.stringify(body).slice(0, 120) + ")");
}
const fresh = rows.filter((r) => !held.has(r.url));
const age = (t) => Math.round((now - t) / 60);
console.log("INVESTING.COM DRY RUN  " + new Date().toISOString() + "   (nothing was written)");
for (const f of perFeed) console.log("  " + String(f.status).padEnd(4) + " " + String(f.items).padStart(2) + " items  +" +
  String(f.new_after_batch_dedupe).padStart(2) + " new   " + f.name + "   " + f.url);
console.log("  ---");
console.log("  items offered by the five feeds : " + perFeed.reduce((s, f) => s + f.items, 0));
console.log("  dropped, same story twice       : " + dupInBatch);
console.log("  dropped, timestamp in the future: " + future);
console.log("  already in the news table       : " + (rows.length - fresh.length));
console.log("  WOULD BE STORED                 : " + fresh.length);
console.log("  newest / oldest headline age    : " + Math.min(...fresh.map((r) => age(r.published_ts))) + " min / " +
  Math.max(...fresh.map((r) => age(r.published_ts))) + " min");
console.log("  every row carries               : ticker=" + F.MARKET_BUCKET + " · site=Investing.com · snippet=" +
  JSON.stringify(fresh[0] ? fresh[0].snippet : "") + " (no article text)");
console.log("  sample:");
for (const r of fresh.slice(0, 6)) console.log("    · " + new Date(r.published_ts * 1000).toISOString().slice(11, 16) + "Z  " + r.title.slice(0, 78));
