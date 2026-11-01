// 1 Nov 2026 (coordinator). THE SECOND NET for rating changes, on his names only. Alan: "there's something funky with the price target cuts and all of that shit, ratings changes,
// because I've seen on Twitter a lot of them, and the dot-com session was not aware of them ... those should be notification area shit too".
// The headline feeds (analyst-feed-5m -> analyst_target_news -> notify_rating_row) can go thin: the research session measured 5 of 28 target cuts on 30 Oct when TheFly's stories stopped.
// So every 15 minutes, for each name he follows: FMP's per-stock grades (clean firm names, a date, no time) -> a card for each upgrade or downgrade dated today,
// and once an hour the analysts' average target -> a card when it falls 1% or more (no firm named, FMP gives none there). Each event carries one key, so it cards once.
// Third pass: the memory names that are not Hub symbols. FMP files SK hynix under SKHY, HBM or KS, never its Korean symbol, and the collector keeps Hub symbols only, so their stories never reached the cards.
// The markets session caught this on 1 Nov; here the headline's words decide, with the same rule as the collector's cards.
// ?dry=1 writes nothing and returns what it would card; &hours= and &pages= look further back. Writes only public.notify_stream and public.rating_net_state. The FMP key comes from public.app_config and never leaves this function.
const SB = Deno.env.get("SUPABASE_URL") || "", SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const FMP = "https://financialmodelingprep.com/stable/", CONC = 8, FALL = 0.99, WORD_H = 6;
const NO_SYMBOL: Array<[RegExp, string]> = [[/sk hynix/i, "SK HYNIX"], [/kioxia/i, "KIOXIA"], [/samsung electronics/i, "SAMSUNG"]];
const ROUNDUP = /top analyst calls|top \d+ stock calls|what you missed|wall street's top|buy\/sell:|now streaming|here's what/i;
/* the same rule as public.notify_rating_row: only what the headline says counts. A memory name's target cut reaches the phone like a followed name's */
function headlineLevel(t: string) {
  if (/\b(downgrade|upgrade)|\bcut to (hold|neutral|sell|underweight|underperform|equal|market perform|sector perform)/i.test(t)) return 2;
  if (/\bPT\b|target/i.test(t) && /lower|\bcut|reduc|trim/i.test(t)) return 2;
  if (/\bPT\b|target/i.test(t) && /rais|boost|increas|hike|\blifts?\b/i.test(t)) return 1;
  return /initiat/i.test(t) ? 1 : 0;
}
async function pg(path: string, init: RequestInit = {}) { const r = await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error(path.split("?")[0] + " -> " + r.status + " " + t.slice(0, 200)); return t ? JSON.parse(t) : null; }
const rpc = (fn: string, a: Record<string, unknown> = {}) => pg("rpc/" + fn, { method: "POST", body: JSON.stringify(a) });
let cronKeyYes: { b: string; until: number } | null = null;
async function authorized(req: Request) { const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!b) return false; if (b === SERVICE) return true; if (cronKeyYes && cronKeyYes.b === b && Date.now() < cronKeyYes.until) return true; try { if ((await rpc("push_cron_key_ok", { k: b })) === true) { cronKeyYes = { b, until: Date.now() + 600_000 }; return true; } } catch (_) { /* a failed lookup is a no */ } return false; }
async function fmp(path: string, key: string) { try { const r = await fetch(FMP + path + (path.includes("?") ? "&" : "?") + "apikey=" + encodeURIComponent(key), { signal: AbortSignal.timeout(12000) }); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j) ? j : []; } catch (_) { return []; } }
const nyDate = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const nyHour = (d = new Date()) => +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(d);
Deno.serve(async (req) => {
  if (!(await authorized(req))) return J({ error: "unauthorized" }, 401);
  try {
    const u = new URL(req.url), today = nyDate(), hour = nyHour(), avgRun = new Date().getUTCMinutes() < 15 || u.searchParams.get("avg") === "1", dry = u.searchParams.get("dry") === "1", wordH = +(u.searchParams.get("hours") || WORD_H);
    const K = String((await pg("app_config?select=value&key=eq.FMP_KEY"))?.[0]?.value || "").trim(); if (!K) return J({ error: "no key" }, 500);
    const names: string[] = (await rpc("push_followed")).map((r: { ticker: string }) => r.ticker).filter((t: string) => !/USD$|^\^/.test(t));
    const state = new Map<string, number>((await pg("rating_net_state?select=ticker,avg_target") || []).map((r: { ticker: string; avg_target: number }) => [r.ticker, +r.avg_target]));
    // a change the headline net already carded today for this name stays one card
    const carded = new Set<string>((await pg("notify_stream?select=ticker&source=eq.Ratings&level=gte.2&at=gte." + encodeURIComponent(new Date(Date.now() - 86400000).toISOString()) + "&title=ilike.*grade*") || []).map((r: { ticker: string }) => r.ticker));
    const cards: unknown[] = [], next: unknown[] = []; let read = 0;
    for (let i = 0; i < names.length; i += CONC) await Promise.all(names.slice(i, i + CONC).map(async (t) => {
      read++;
      for (const g of await fmp("grades?symbol=" + encodeURIComponent(t) + "&limit=5", K)) {
        const action = String(g.action || "").toLowerCase(); if (g.date !== today || (action !== "upgrade" && action !== "downgrade")) continue;
        cards.push({ level: carded.has(t) ? 1 : 2, kind: "news", ticker: t, title: t + " " + action + "d by " + g.gradingCompany + ": " + g.previousGrade + " to " + g.newGrade, source: "Ratings", key: "rating-net|" + t + "|" + g.gradingCompany + "|" + g.date + "|" + g.newGrade, event_at: new Date().toISOString() });
      }
      if (!avgRun) return;
      const v = +((await fmp("price-target-consensus?symbol=" + encodeURIComponent(t), K))?.[0]?.targetConsensus || 0); if (!(v > 0)) return;
      const old = state.get(t); next.push({ ticker: t, avg_target: v, at: new Date().toISOString() });
      if (old && v < old * FALL) { const pct = Math.round(1000 * (v / old - 1)) / 10; cards.push({ level: pct <= -3 ? 2 : 1, kind: "news", ticker: t, title: t + ": analysts' average price target fell " + Math.abs(pct).toFixed(1) + "% to $" + v.toFixed(2) + ", from $" + old.toFixed(2), source: "Ratings", pct, key: "rating-avg|" + t + "|" + today + "|" + v.toFixed(2), event_at: new Date().toISOString() }); }
    }));
    const seen = new Set<string>();
    for (const route of ["grades-latest-news", "price-target-latest-news"]) for (let page = 0; page < +(u.searchParams.get("pages") || 2); page++) for (const x of await fmp(route + "?page=" + page + "&limit=100", K)) {
      const t = String(x.newsTitle || ""), who = NO_SYMBOL.find(([re]) => re.test(t)); if (!who || ROUNDUP.test(t) || !(Date.now() - Date.parse(x.publishedDate) < wordH * 3600000)) continue;
      const key = "rating|" + (x.newsURL || who[1] + "|" + t), level = headlineLevel(t); if (!level || seen.has(key)) continue; seen.add(key);
      const m = /\$?([\d,.]+)\s+from\s+\$?([\d,.]+)/.exec(t), pct = m ? Math.round(1000 * (parseFloat(m[1].replace(/,/g, "")) / parseFloat(m[2].replace(/,/g, "")) - 1)) / 10 : NaN;
      cards.push({ level, kind: "news", ticker: who[1], title: t.slice(0, 300), source: "Ratings", url: x.newsURL || null, pct: Number.isFinite(pct) ? pct : null, key, event_at: x.publishedDate });
    }
    if (dry) return J({ dry: true, names: names.length, cards: cards.length, sample: cards.slice(0, 30) });
    if (next.length) await pg("rating_net_state?on_conflict=ticker", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(next) });
    if (cards.length) await pg("notify_stream?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(cards) });
    return J({ names: names.length, read, today, hour, avgRun, cards: cards.length, sample: cards.slice(0, 3) });
  } catch (e) { return J({ error: String(e).slice(0, 400) }, 500); }
});
