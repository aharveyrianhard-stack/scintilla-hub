// 1 Nov 2026 (coordinator). THE NEWS SCOUT. Alan: "I'm paying for all of these fucking news sources already, and I don't really ever look at it ... It's never gonna pop into my
// mind to go over to scroll through the news section ... I need my systems to notify".
// Every minute it reads FMP's newest stock headlines, press releases and market news, throws out what is not news, and hands the rest to the switchboard (public.notify_stream).
//   DROPPED        lawyer spam (class actions, "investors have opportunity"), and the content mills (Zacks, Motley Fool, 24/7 Wall St, MarketBeat, Seeking Alpha opinion, ...)
//   LEVEL 2        a real desk or a company's own press release on a name on his lists (MINE, RADAR, FAVORITES, Hub favorites); big macro words on the market desks. Macs + phone.
//   LEVEL 1        the same sources on any other name in the universe, and the rest of the market desks. Macs only, silent: the stream.
//   THROTTLE       one phone ping per name per ten minutes; the next ones on that name stay in the Mac stream.
// MEASURED over 25 Oct - 1 Nov from public.news (fmp feed, one row per headline): 112 desk + 75 wire a day across the universe, 67 + 25 of them on his names; lawyers 45, mills 589 a day.
// One FMP call per source per minute (the plan allows 3,000 a minute). Rows are copies of headlines; nothing writes to public.news.
const SB = Deno.env.get("SUPABASE_URL") || "", SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const FMP = "https://financialmodelingprep.com/stable/";
const SOURCES: Array<[string, string]> = [["stock", "news/stock-latest?page=0&limit=100"], ["press", "news/press-releases-latest?page=0&limit=50"], ["market", "news/general-latest?page=0&limit=50"]];
const MAX_AGE_S = 45 * 60, THROTTLE_MIN = 10;

export const DESK = new Set(["reuters.com", "cnbc.com", "wsj.com", "barrons.com", "marketwatch.com", "benzinga.com", "businessinsider.com", "techcrunch.com", "investors.com", "nytimes.com", "foxbusiness.com", "ft.com", "bloomberg.com", "theguardian.com", "news.sky.com", "apnews.com", "axios.com", "theinformation.com"]);
export const WIRE = new Set(["businesswire.com", "globenewswire.com", "prnewswire.com", "newsfilecorp.com", "feeds.newsfilecorp.com", "thenewswire.com", "accesswire.com", "accessnewswire.com"]);
const VIDEO_DESKS = /bloomberg|cnbc|yahoo finance/i;
// Alan, 1 Nov: "why do I have to sign into Wall Street Journal? I don't have Wall Street Journal." FMP gives the headline and a short summary, not the article. These sites wall it, so the card opens that summary.
export const WALLED = new Set(["wsj.com", "barrons.com", "marketwatch.com", "ft.com", "bloomberg.com", "nytimes.com", "theinformation.com", "investors.com", "businessinsider.com"]);
const READ_PAGE = "https://station.scintillahub.ai/notify/read.html";
export const LAWYERS = /(class action|lead plaintiff|securities (fraud|litigation|investigation|class)|shareholder (alert|investigation|rights|class)|investor (alert|deadline|notice)|investors? (have|has|face|should|are encouraged|who (lost|suffered|purchased|bought))|law (firm|offices)|\bLLP\b|encourages? .{0,80}(investors|shareholders)|on behalf of (investors|shareholders)|fraud investigation|deadline (alert|reminder)|\b(rosen|pomerantz|levi & korsinsky|faruqi|bragar|hagens berman|schall|kessler topaz|robbins geller|bernstein liebhard|gross law|glancy|howard g\. smith|kirby mcinerney|sbs law|bronstein|portnoy|block & leviton|holzer|johnson fistel|berger montague|edelson|kaskela|halper sadeh|ademi|monteverde)\b)/i;
export const BIG_MACRO = /\b(Fed|FOMC|Powell|Warsh|Hassett|CPI|PCE|payrolls?|jobs report|GDP|tariffs?|Treasury yields?|OPEC|Hormuz|recession|rate (cut|hike)s?|inflation)\b/;
// a column, not news: it stays in the Mac stream and does not ping the phone. Alan's first real phone ping was "Stock of the Day: Is Palantir Breaking Support?"
export const COLUMN = /(\?\s*$|^stock of the day|^top wall street analysts|^\d+ (stocks?|reasons|things)|^(should|could|what to|here's|here is|why you)\b)/i;
export const normTitle = (t: string) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function classOf(a: { site?: string; publisher?: string; title?: string }) {
  const site = String(a.site || "").toLowerCase().replace(/^www\./, "");
  if (!a.title || LAWYERS.test(a.title)) return null;
  if (DESK.has(site)) return "desk";
  if (WIRE.has(site)) return "wire";
  if (site === "youtube.com" && VIDEO_DESKS.test(String(a.publisher || ""))) return "video";
  return null;
}
// FMP's publishedDate is US-Eastern wall clock with no zone (news-feed measured this on 18 Sep)
const NY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const nyOffset = (t: number) => { const p: Record<string, number> = {}; for (const x of NY.formatToParts(new Date(t))) p[x.type] = +x.value; return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t; };
export function fmpEpoch(s: unknown) { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s || "").trim()); if (!m) { const p = Date.parse(String(s || "")); return Number.isFinite(p) ? Math.floor(p / 1000) : 0; } const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)); let t = wall - nyOffset(wall); t = wall - nyOffset(t); return Math.floor(t / 1000); }
async function pg(path: string, init: RequestInit = {}) { const r = await fetch(SB + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } }); const text = await r.text(); if (!r.ok) throw new Error(path.split("?")[0] + " -> " + r.status + " " + text.slice(0, 200)); return text ? JSON.parse(text) : null; }
const rpc = (fn: string, args: Record<string, unknown> = {}) => pg("rpc/" + fn, { method: "POST", body: JSON.stringify(args) });
let cronKeyYes: { b: string; until: number } | null = null;
async function authorized(req: Request) { const b = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!b) return false; if (b === SERVICE) return true; if (cronKeyYes && cronKeyYes.b === b && Date.now() < cronKeyYes.until) return true; try { if ((await rpc("push_cron_key_ok", { k: b })) === true) { cronKeyYes = { b, until: Date.now() + 600_000 }; return true; } } catch (_) { /* a failed lookup is a no */ } return false; }
async function sha(s: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(d).slice(0, 12)).map((b) => b.toString(16).padStart(2, "0")).join(""); }

Deno.serve(async (req) => {
  if (!(await authorized(req))) return J({ error: "unauthorized" }, 401);
  try {
    const now = Math.floor(Date.now() / 1000), dry = new URL(req.url).searchParams.get("dry") === "1";
    const cfg = await pg("app_config?select=key,value&key=in.(FMP_KEY,fmp_enabled)"); const C: Record<string, string> = {}; for (const r of cfg) C[r.key] = String(r.value || "").replace(/"/g, "").trim();
    if (!C.FMP_KEY || C.fmp_enabled !== "1") return J({ skipped: "fmp off" });
    const [fol, uni] = await Promise.all([rpc("push_followed"), pg("fmp_full_universe?select=ticker")]);
    const followed = new Set((fol || []).map((r: { ticker: string }) => r.ticker)), universe = new Set((uni || []).map((r: { ticker: string }) => r.ticker));
    const counts: Record<string, unknown> = {}; const groups = new Map<string, { source: string; title: string; url: string; site: string; text: string; t: number; cls: string; lane: string; tickers: Set<string> }>();
    await Promise.all(SOURCES.map(async ([lane, path]) => {
      const r = await fetch(FMP + path + "&apikey=" + encodeURIComponent(C.FMP_KEY), { signal: AbortSignal.timeout(12000) });
      if (!r.ok) { counts[lane] = "http " + r.status; return; }
      const rows = await r.json(); let kept = 0;
      for (const a of Array.isArray(rows) ? rows : []) {
        const cls = classOf(a); if (!cls) continue;
        const t = fmpEpoch(a.publishedDate); if (!t || t > now + 300 || now - t > MAX_AGE_S) continue;
        const nt = normTitle(a.title); let g = groups.get(nt);
        if (!g) { g = { source: a.publisher || a.site || "", title: String(a.title), url: a.url || "", site: String(a.site || "").toLowerCase().replace(/^www\./, ""), text: String(a.text || ""), t, cls, lane, tickers: new Set() }; groups.set(nt, g); kept++; }
        if (a.symbol) g.tickers.add(String(a.symbol));
      }
      counts[lane] = { read: Array.isArray(rows) ? rows.length : 0, kept };
    }));
    // level by his lists; a named stock outside the universe is not on his map at all
    const out: Array<Record<string, unknown>> = [];
    for (const [nt, g] of groups) {
      const mine = [...g.tickers].filter((x) => followed.has(x)), known = [...g.tickers].filter((x) => universe.has(x));
      let level = 0;
      if (mine.length) level = 2; else if (known.length) level = 1;
      else if (!g.tickers.size) level = BIG_MACRO.test(g.title) ? 2 : 1;
      if (level === 2 && COLUMN.test(g.title)) level = 1;
      if (!level) continue;
      const shown = (mine.length ? mine : known).slice(0, 3);
      const key = "news|" + (await sha(nt)), walled = WALLED.has(g.site) && !!g.text;
      out.push({ key, summary: g.text.slice(0, 700) || null, source_url: g.url || null, level, kind: g.lane === "market" ? "macro" : g.cls === "wire" || g.lane === "press" ? "press" : "news", ticker: shown.join(" · ") || null, title: g.title.slice(0, 300), source: String(g.source).slice(0, 60), url: walled ? READ_PAGE + "?k=" + encodeURIComponent(key) : g.url, event_at: new Date(g.t * 1000).toISOString() });
    }
    if (!out.length) return J({ counts, new: 0 });
    const have = await pg("notify_stream?select=key&key=in.(" + out.map((o) => encodeURIComponent(String(o.key))).join(",") + ")"); const seen = new Set((have || []).map((r: { key: string }) => r.key));
    const fresh = out.filter((o) => !seen.has(o.key)).sort((a, b) => String(a.event_at).localeCompare(String(b.event_at)));
    if (!fresh.length) return J({ counts, new: 0 });
    // one phone ping per name per ten minutes
    const since = new Date(Date.now() - THROTTLE_MIN * 60000).toISOString();
    const recent = await pg("notify_stream?select=ticker&level=gte.2&ticker=not.is.null&at=gte." + encodeURIComponent(since)); const busy = new Set<string>(); for (const r of recent || []) for (const x of String(r.ticker).split(" · ")) busy.add(x);
    for (const o of fresh) { if (o.level === 2 && o.ticker) { const names = String(o.ticker).split(" · "); if (names.every((x) => busy.has(x))) o.level = 1; else for (const x of names) busy.add(x); } }
    // the day's move on the first name, from the same paid feed
    const syms = [...new Set(fresh.map((o) => String(o.ticker || "").split(" · ")[0]).filter(Boolean))].slice(0, 60);
    if (syms.length) { try { const q = await (await fetch(FMP + "batch-quote?symbols=" + encodeURIComponent(syms.join(",")) + "&apikey=" + encodeURIComponent(C.FMP_KEY), { signal: AbortSignal.timeout(8000) })).json(); const pct = new Map((Array.isArray(q) ? q : []).map((r: { symbol: string; changePercentage: number }) => [r.symbol, r.changePercentage])); for (const o of fresh) { const v = pct.get(String(o.ticker || "").split(" · ")[0]); if (typeof v === "number" && Number.isFinite(v)) o.pct = Math.round(v * 100) / 100; } } catch (_) { /* a card without its percent is still a card */ } }
    if (dry) return J({ counts, dry: true, fresh });
    for (const o of fresh) if (!("pct" in o)) o.pct = null;
    const ins = await pg("notify_stream?on_conflict=key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(fresh) });
    return J({ counts, new: Array.isArray(ins) ? ins.length : 0, level2: fresh.filter((o) => o.level === 2).length });
  } catch (e) { return J({ error: String(e).slice(0, 400) }, 500); }
});
