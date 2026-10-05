// offline end-to-end run of the bundled function against a fake database (no network)
import { readFileSync } from "node:fs";
const ROOT = process.argv[2];
const lexBytes = readFileSync(ROOT + "/data/news-lexicon/lm-headline-v1.json");
let handler;
globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: "http://db", SUPABASE_SERVICE_ROLE_KEY: "k" })[k] }, serve: (h) => { handler = h; } };
const day = (d, h = 15) => Math.floor(Date.parse(d + `T${String(h).padStart(2, "0")}:00:00Z`) / 1000);
const mk = (i, ts, title) => ({ url: "https://n.test/" + i, ticker: "T" + (i % 5), title: title || (i % 2 ? "Shares surge after record profit beat" : "Company faces lawsuit and weak outlook"), snippet: "", site: "s", published_ts: ts, updated_ts: 1791234000 - i });
let DB;
const reset = (news, scored, cfg = {}, state = []) => { DB = { news, nhs: scored.slice(), cfg: { ...cfg }, state: state.slice(), daily: [], reads: [], writes: { nhs: 0 } }; };
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status });
  if (url.includes("lm-headline")) return new Response(lexBytes);
  const u = new URL(url); const table = u.pathname.split("/").pop(); const q = u.searchParams;
  const method = opt.method || "GET";
  if (method === "GET") DB.reads.push(table + "?" + decodeURIComponent(u.search.slice(1)).slice(0, 110));
  const lim = +(q.get("limit") || 1000), off = +(q.get("offset") || 0);
  const page = (rows) => json(rows.slice(off, off + Math.min(lim, 1000)));
  if (table === "app_config") {
    if (method === "POST") { for (const r of [].concat(JSON.parse(opt.body))) DB.cfg[r.key] = r.value; return json(null, 201); }
    const k = q.get("key").replace("eq.", ""); return json(k in DB.cfg ? [{ value: DB.cfg[k] }] : []);
  }
  if (table === "sentiment_backfill_state") { if (method === "POST") { DB.state = JSON.parse(opt.body); return json(null, 201); } return json(DB.state); }
  if (table === "sentiment_ticker_daily") { DB.daily.push(...JSON.parse(opt.body)); return json(null, 201); }
  if (table === "news") {
    let rows = DB.news.slice();
    for (const v of q.getAll("published_ts")) { if (v.startsWith("lt.")) rows = rows.filter((r) => r.published_ts < +v.slice(3)); if (v.startsWith("eq.")) rows = rows.filter((r) => r.published_ts === +v.slice(3)); }
    const ord = q.get("order") || "";
    if (ord.startsWith("updated_ts.desc")) rows.sort((a, b) => b.updated_ts - a.updated_ts);
    else if (ord.startsWith("published_ts.desc")) rows.sort((a, b) => b.published_ts - a.published_ts);
    return page(rows);
  }
  if (table === "news_headline_sentiment") {
    if (method === "POST") { const rows = JSON.parse(opt.body); DB.writes.nhs += rows.length; for (const r of rows) { const i = DB.nhs.findIndex((x) => x.url === r.url && x.ticker === r.ticker); if (i >= 0) DB.nhs[i] = r; else DB.nhs.push(r); } return json(null, 201); }
    let rows = DB.nhs.slice();
    const inq = q.get("url");
    if (inq) { const set = new Set(JSON.parse("[" + inq.slice(4, -1) + "]")); rows = rows.filter((r) => set.has(r.url)); }
    for (const v of q.getAll("published_ts")) { const [op, n] = v.split("."); rows = rows.filter((r) => op === "gte" ? r.published_ts >= +n : op === "lte" ? r.published_ts <= +n : op === "lt" ? r.published_ts < +n : true); }
    return page(rows);
  }
  return json({ message: "unknown " + table }, 404);
};
await import(process.argv[3]);
const call = async (qs) => (await handler(new Request("http://f/sentiment-news?" + qs, { method: "POST" }))).json();
const out = {};
// 1 · LIVE: 600 newest arrivals; 200 of them published days ago (late), 100 already scored
{
  const news = Array.from({ length: 900 }, (_, i) => mk(i, i < 400 ? day("2026-10-05") - i : day("2026-09-" + String(10 + (i % 15)).padStart(2, "0"))));
  const scored = news.slice(0, 100).map((r) => ({ url: r.url, ticker: r.ticker, published_ts: r.published_ts, score: 1, hits: [], question: false }));
  reset(news, scored);
  const r1 = await call("mode=live&limit=600");
  const r2 = await call("mode=live&limit=600");
  out.live = { read: r1.read, already: r1.already_scored, wrote: r1.wrote_items, days_touched: r1.days_touched.length, rebuilt: r1.days_rebuilt.map((d) => d.day), deferred: r1.days_deferred.length,
    second_run: { wrote: r2.wrote_items, already: r2.already_scored, rebuilt: r2.days_rebuilt.map((d) => d.day), deferred: r2.days_deferred.length },
    news_read: DB.reads.filter((x) => x.startsWith("news?"))[0], failed: r1.failed || r2.failed || null };
  let runs = 2, left = r2.days_deferred.length; while (left && runs < 20) { left = (await call("mode=live&limit=600")).days_deferred.length; runs++; }
  out.live.runs_until_every_day_rebuilt = runs; out.live.daily_days = new Set(DB.daily.map((d) => d.day)).size;
}
// 2 · BACK-FILL: 2,600 headlines, 1,300 of them on one publish stamp; state says done=false
{
  const news = [...Array.from({ length: 700 }, (_, i) => mk(i, day("2026-09-20") - i)), ...Array.from({ length: 1300 }, (_, i) => mk(1000 + i, day("2026-07-30", 7))), ...Array.from({ length: 600 }, (_, i) => mk(5000 + i, day("2026-07-01") - i))];
  reset(news, [], {}, [{ source: "news", done: false, cursor_ts: null }]);
  const runs = []; let fin = null;
  for (let i = 0; i < 12; i++) { const r = await call("mode=backfill&limit=1500"); if (r.failed) { runs.push("FAILED " + r.failed); break; } if (r.finished) { fin = i; break; } runs.push({ read: r.read, wrote: r.wrote_items, done: r.backfill?.done ?? (r.note || null) }); }
  out.backfill = { slices: runs, answered_finished_on_call: fin, scored_rows: DB.nhs.length, of: news.length, written_twice: DB.writes.nhs - DB.nhs.length };
}
// 3 · BACK-FILL with since: stops at the floor
{
  const news = Array.from({ length: 2500 }, (_, i) => mk(i, day("2026-10-05") - i * 900));
  reset(news, [], {}, [{ source: "news", done: false, cursor_ts: null }]);
  const runs = []; for (let i = 0; i < 6; i++) { const r = await call("mode=backfill&since=2026-09-23"); if (r.finished || r.failed) break; runs.push({ read: r.read, done: r.backfill.done, why: r.backfill.why }); }
  out.since = { slices: runs, state_done: DB.state[0].done };
}
console.log(JSON.stringify(out, null, 1));
